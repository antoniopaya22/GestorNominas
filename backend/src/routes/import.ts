import { Router } from "express";
import { readFileSync, unlinkSync } from "fs";
import { db } from "../db/index.js";
import { accounts, categoryGroups, categories, transactions } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { uploadCsv } from "../middleware/upload.js";
import {
  parseYnabCsv,
  isTransfer,
  getTransferTarget,
  isInflowCategory,
} from "../parsers/ynab-csv-parser.js";

export const importRouter = Router();

// Import YNAB CSV
importRouter.post("/ynab", uploadCsv.single("file"), async (req, res, next) => {
  const file = req.file;
  try {
    const { userId } = req.user!;
    const dryRun = req.query.dryRun === "true";

    if (!file) {
      return res.status(400).json({ error: "No se ha subido ningún archivo" });
    }

    const content = readFileSync(file.path, "utf-8");
    const parsed = parseYnabCsv(content);

    // 1. Create accounts that don't exist
    const existingAccounts = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId));
    const accountMap = new Map(existingAccounts.map((a) => [a.name, a.id]));

    for (const accName of parsed.accounts) {
      if (!accountMap.has(accName)) {
        const type = inferAccountType(accName);
        const [created] = await db
          .insert(accounts)
          .values({ userId, name: accName, type })
          .returning();
        accountMap.set(accName, created.id);
      }
    }

    // 2. Create category groups and categories that don't exist
    const existingGroups = await db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.userId, userId));
    const groupMap = new Map(existingGroups.map((g) => [g.name, g.id]));

    for (const [groupName, catNames] of parsed.categoryGroups) {
      if (!groupMap.has(groupName)) {
        const [created] = await db
          .insert(categoryGroups)
          .values({ userId, name: groupName })
          .returning();
        groupMap.set(groupName, created.id);
      }
    }

    // Now create categories
    const allCats = await db.select().from(categories);
    const catMap = new Map<string, number>(); // "group|category" → id
    for (const cat of allCats) {
      const group = existingGroups.find((g) => g.id === cat.groupId);
      // Also check newly created groups
      let groupName = group?.name;
      if (!groupName) {
        for (const [name, id] of groupMap) {
          if (id === cat.groupId) { groupName = name; break; }
        }
      }
      if (groupName) {
        catMap.set(`${groupName}|${cat.name}`, cat.id);
      }
    }

    for (const [groupName, catNames] of parsed.categoryGroups) {
      const groupId = groupMap.get(groupName)!;
      for (const catName of catNames) {
        const key = `${groupName}|${catName}`;
        if (!catMap.has(key)) {
          const [created] = await db
            .insert(categories)
            .values({ groupId, name: catName })
            .returning();
          catMap.set(key, created.id);
        }
      }
    }

    // 3. Detect potential duplicates
    const existingTx = await db
      .select({ date: transactions.date, amount: transactions.amount, accountId: transactions.accountId, payee: transactions.payee })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const existingSet = new Set(
      existingTx.map((t) => `${t.date}|${t.amount}|${t.accountId}|${t.payee ?? ""}`)
    );

    let duplicateCount = 0;
    function isDuplicate(date: string, amount: number, accountId: number, payee: string | null): boolean {
      const key = `${date}|${amount}|${accountId}|${payee ?? ""}`;
      return existingSet.has(key);
    }

    // If dry run, compute the preview and return without inserting
    if (dryRun) {
      let previewCount = 0;
      for (const row of parsed.rows) {
        const accountId = accountMap.get(row.account);
        if (!accountId) continue;
        const amount = row.inflow > 0 && row.outflow === 0 ? row.inflow : row.outflow;
        if (amount === 0) continue;
        previewCount++;
        if (isDuplicate(row.date, amount, accountId, row.payee || null)) {
          duplicateCount++;
        }
      }

      return res.json({
        ok: true,
        dryRun: true,
        summary: {
          accounts: parsed.accounts.length,
          categoryGroups: parsed.categoryGroups.size,
          categories: Array.from(parsed.categoryGroups.values()).reduce(
            (sum, s) => sum + s.size,
            0,
          ),
          transactions: previewCount,
          duplicates: duplicateCount,
          dateRange: parsed.dateRange,
        },
      });
    }

    // 4. Create transactions
    // Process non-transfer rows first, then handle transfers
    const nonTransferRows = parsed.rows.filter((r) => !isTransfer(r.payee));
    const transferRows = parsed.rows.filter((r) => isTransfer(r.payee));

    let importedCount = 0;

    // Non-transfer transactions
    for (const row of nonTransferRows) {
      const accountId = accountMap.get(row.account);
      if (!accountId) continue;

      let type: "expense" | "income" | "transfer" = "expense";
      let amount = row.outflow;

      if (row.inflow > 0 && row.outflow === 0) {
        type = "income";
        amount = row.inflow;
      } else if (row.outflow > 0) {
        type = "expense";
        amount = row.outflow;
      }

      if (amount === 0) continue;

      // Track duplicates
      if (isDuplicate(row.date, amount, accountId, row.payee || null)) {
        duplicateCount++;
      }

      let categoryId: number | null = null;
      if (row.categoryGroup && row.category && !isInflowCategory(row.categoryGroup)) {
        categoryId = catMap.get(`${row.categoryGroup}|${row.category}`) ?? null;
      }

      await db.insert(transactions).values({
        userId,
        accountId,
        categoryId,
        type,
        amount,
        date: row.date,
        payee: row.payee || null,
        memo: row.memo || null,
        cleared: row.cleared,
        flag: row.flag || null,
        importedFrom: "ynab",
      });
      importedCount++;
    }

    // Transfer transactions — pair outflows with inflows
    // Group by date + amount to find pairs
    const pendingTransfers: Array<{ row: typeof transferRows[0]; side: "out" | "in" }> = [];
    for (const row of transferRows) {
      if (row.outflow > 0) {
        pendingTransfers.push({ row, side: "out" });
      } else if (row.inflow > 0) {
        pendingTransfers.push({ row, side: "in" });
      }
    }

    // Match pairs: outflow from account A to "Transfer : B" pairs with inflow to B from "Transfer : A"
    const matched = new Set<number>();
    for (let i = 0; i < pendingTransfers.length; i++) {
      if (matched.has(i)) continue;
      const entry = pendingTransfers[i];
      if (entry.side !== "out") continue;

      const targetName = getTransferTarget(entry.row.payee);
      const amount = entry.row.outflow;

      // Find matching inflow
      let pairIdx = -1;
      for (let j = 0; j < pendingTransfers.length; j++) {
        if (matched.has(j) || i === j) continue;
        const other = pendingTransfers[j];
        if (
          other.side === "in" &&
          other.row.account === targetName &&
          Math.abs(other.row.inflow - amount) < 0.01 &&
          other.row.date === entry.row.date
        ) {
          pairIdx = j;
          break;
        }
      }

      const fromAccountId = accountMap.get(entry.row.account);
      if (!fromAccountId) continue;

      // Create outflow side
      const [outTx] = await db
        .insert(transactions)
        .values({
          userId,
          accountId: fromAccountId,
          categoryId: null,
          type: "transfer",
          amount,
          date: entry.row.date,
          payee: entry.row.payee || null,
          memo: entry.row.memo || null,
          cleared: entry.row.cleared,
          flag: entry.row.flag || null,
          importedFrom: "ynab",
        })
        .returning();

      matched.add(i);
      importedCount++;

      if (pairIdx >= 0) {
        const pair = pendingTransfers[pairIdx];
        const toAccountId = accountMap.get(pair.row.account);
        if (toAccountId) {
          const [inTx] = await db
            .insert(transactions)
            .values({
              userId,
              accountId: toAccountId,
              categoryId: null,
              type: "transfer",
              amount: pair.row.inflow,
              date: pair.row.date,
              payee: pair.row.payee || null,
              memo: pair.row.memo || null,
              cleared: pair.row.cleared,
              flag: pair.row.flag || null,
              importedFrom: "ynab",
              transferId: outTx.id,
            })
            .returning();

          // Link back
          await db
            .update(transactions)
            .set({ transferId: inTx.id })
            .where(eq(transactions.id, outTx.id));

          matched.add(pairIdx);
          importedCount++;
        }
      }
    }

    // Handle unmatched inflows (transfers where outflow is missing from export)
    for (let i = 0; i < pendingTransfers.length; i++) {
      if (matched.has(i)) continue;
      const entry = pendingTransfers[i];
      const accountId = accountMap.get(entry.row.account);
      if (!accountId) continue;

      const amount = entry.side === "in" ? entry.row.inflow : entry.row.outflow;
      if (amount === 0) continue;

      await db.insert(transactions).values({
        userId,
        accountId,
        categoryId: null,
        type: "transfer",
        amount,
        date: entry.row.date,
        payee: entry.row.payee || null,
        memo: entry.row.memo || null,
        cleared: entry.row.cleared,
        flag: entry.row.flag || null,
        importedFrom: "ynab",
        transferId: entry.side === "in" ? 0 : null, // 0 = unmatched inflow sentinel
      });
      importedCount++;
    }

    res.status(201).json({
      ok: true,
      summary: {
        accounts: parsed.accounts.length,
        categoryGroups: parsed.categoryGroups.size,
        categories: Array.from(parsed.categoryGroups.values()).reduce(
          (sum, s) => sum + s.size,
          0,
        ),
        transactions: importedCount,
        duplicates: duplicateCount,
        dateRange: parsed.dateRange,
      },
    });
  } catch (err) {
    next(err);
  } finally {
    // Cleanup temp file
    if (file) {
      try { unlinkSync(file.path); } catch {}
    }
  }
});

function inferAccountType(name: string): "bank" | "credit_card" | "cash" | "investment" | "other" {
  const lower = name.toLowerCase();
  if (lower.includes("tarjeta") || lower.includes("credito") || lower.includes("crédito")) {
    return "credit_card";
  }
  if (lower.includes("efectivo")) return "cash";
  if (lower.includes("ahorro") || lower.includes("inversión") || lower.includes("inversion")) {
    return "investment";
  }
  return "bank";
}
