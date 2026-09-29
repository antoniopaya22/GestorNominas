import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import {
  payslips,
  payslipConcepts,
  payslipNotes,
  payslipTags,
  profiles,
  transactions,
  accounts,
  categories,
  categoryGroups,
  tags,
  recurringTransactions,
  alertRules,
  alertHistory,
  users,
} from "../db/schema.js";
import { eq, and, sql, gte, lte, like, desc, asc, inArray } from "drizzle-orm";

export const exportRouter = Router();

// Exportación completa de todos los datos del usuario (derecho de
// portabilidad RGPD) — un único JSON con todo lo que hay en cada tabla que
// cuelga de su cuenta. A diferencia del export de arriba (solo nóminas,
// aplanado para CSV), este no filtra ni resume nada.
exportRouter.get("/all", async (req, res, next) => {
  try {
    const { userId } = req.user!;

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const userProfiles = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const profileIds = userProfiles.map((p) => p.id);

    const userPayslips = profileIds.length
      ? await db.select().from(payslips).where(inArray(payslips.profileId, profileIds))
      : [];
    const payslipIds = userPayslips.map((p) => p.id);

    const [concepts, notes, payslipTagLinks, userTags, userAccounts, groups, cats, txs, recurring, rules, history] =
      await Promise.all([
        payslipIds.length
          ? db.select().from(payslipConcepts).where(inArray(payslipConcepts.payslipId, payslipIds))
          : Promise.resolve([]),
        payslipIds.length
          ? db.select().from(payslipNotes).where(inArray(payslipNotes.payslipId, payslipIds))
          : Promise.resolve([]),
        payslipIds.length
          ? db.select().from(payslipTags).where(inArray(payslipTags.payslipId, payslipIds))
          : Promise.resolve([]),
        db.select().from(tags).where(eq(tags.userId, userId)),
        db.select().from(accounts).where(eq(accounts.userId, userId)),
        db.select().from(categoryGroups).where(eq(categoryGroups.userId, userId)),
        db
          .select({ category: categories })
          .from(categories)
          .innerJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
          .where(eq(categoryGroups.userId, userId))
          .then((rows) => rows.map((r) => r.category)),
        db.select().from(transactions).where(eq(transactions.userId, userId)),
        db.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId)),
        db.select().from(alertRules).where(eq(alertRules.userId, userId)),
        db.select().from(alertHistory).where(eq(alertHistory.userId, userId)),
      ]);

    res.setHeader("Content-Disposition", `attachment; filename="sueldia-datos-${userId}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      user,
      profiles: userProfiles,
      payslips: userPayslips,
      payslipConcepts: concepts,
      payslipNotes: notes,
      payslipTags: payslipTagLinks,
      tags: userTags,
      accounts: userAccounts,
      categoryGroups: groups,
      categories: cats,
      transactions: txs,
      recurringTransactions: recurring,
      alertRules: rules.map((r) => ({ ...r, config: JSON.parse(r.config) })),
      alertHistory: history,
    });
  } catch (err) {
    next(err);
  }
});

const exportQuerySchema = z.object({
  profileId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  type: z.enum(["ordinal", "extra"]).optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});

exportRouter.get("/", async (req, res, next) => {
  try {
    const parsed = exportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId } = req.user!;

    // Only user's profiles
    const userProfiles = await db.select().from(profiles).where(eq(profiles.userId, userId));
    const userProfileIds = userProfiles.map((p) => p.id);

    if (userProfileIds.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="nominas.csv"');
      return res.send("Sin datos");
    }

    const { profileId, year, type, format } = parsed.data;

    const conditions = [eq(payslips.parsingStatus, "parsed")];
    if (profileId) {
      if (!userProfileIds.includes(profileId)) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        return res.send("Sin datos");
      }
      conditions.push(eq(payslips.profileId, profileId));
    } else {
      conditions.push(
        sql`${payslips.profileId} IN (${sql.join(userProfileIds.map((id) => sql`${id}`), sql`, `)})`
      );
    }
    if (year) conditions.push(eq(payslips.periodYear, year));
    if (type) conditions.push(eq(payslips.payslipType, type));

    const allPayslips = await db
      .select()
      .from(payslips)
      .where(and(...conditions))
      .orderBy(payslips.periodYear, payslips.periodMonth);

    const profileMap = new Map(userProfiles.map((p) => [p.id, p.name]));

    // Get concepts for all payslips
    const payslipIds = allPayslips.map((p) => p.id);
    let allConcepts: Array<{ payslipId: number; category: string; name: string; amount: number }> = [];

    if (payslipIds.length > 0) {
      allConcepts = await db
        .select({
          payslipId: payslipConcepts.payslipId,
          category: payslipConcepts.category,
          name: payslipConcepts.name,
          amount: payslipConcepts.amount,
        })
        .from(payslipConcepts)
        .where(
          sql`${payslipConcepts.payslipId} IN (${sql.join(
            payslipIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
    }

    const conceptsByPayslip = new Map<number, typeof allConcepts>();
    for (const c of allConcepts) {
      const list = conceptsByPayslip.get(c.payslipId) || [];
      list.push(c);
      conceptsByPayslip.set(c.payslipId, list);
    }

    // Build flat rows for CSV
    const rows = allPayslips.map((p) => {
      const concepts = conceptsByPayslip.get(p.id) || [];
      const devengos = concepts.filter((c) => c.category === "devengo");
      const deducciones = concepts.filter((c) => c.category === "deduccion");

      return {
        Perfil: profileMap.get(p.profileId) ?? "",
        Tipo: p.payslipType === "extra" ? "Paga Extra" : "Mensual",
        Periodo: p.periodMonth && p.periodYear ? `${String(p.periodMonth).padStart(2, "0")}/${p.periodYear}` : "",
        Empresa: p.company ?? "",
        "Salario Bruto": p.grossSalary ?? "",
        "Salario Neto": p.netSalary ?? "",
        Devengos: devengos.map((c) => `${c.name}: ${c.amount.toFixed(2)}`).join("; "),
        Deducciones: deducciones.map((c) => `${c.name}: ${c.amount.toFixed(2)}`).join("; "),
        Archivo: p.fileName,
        "Fecha Subida": p.createdAt,
      };
    });

    if (format === "csv") {
      if (rows.length === 0) {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="nominas.csv"');
        return res.send("Sin datos");
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = String(row[h as keyof typeof row] ?? "");
              // Escape CSV values
              if (val.includes(",") || val.includes('"') || val.includes("\n")) {
                return `"${val.replace(/"/g, '""')}"`;
              }
              return val;
            })
            .join(",")
        ),
      ];

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="nominas.csv"');
      res.send("\uFEFF" + csvLines.join("\n")); // BOM for Excel UTF-8
    } else if (format === "json") {
      res.setHeader("Content-Disposition", 'attachment; filename="nominas.json"');
      res.json(rows);
    } else {
      res.status(400).json({ error: "Formato no soportado. Usa csv o json" });
    }
  } catch (err) {
    next(err);
  }
});

// ─── Transaction Export ─────────────────────────────────────────
const transactionExportSchema = z.object({
  format: z.enum(["csv", "json"]).default("csv"),
  accountId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  groupId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  cleared: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
});

exportRouter.get("/transactions", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = transactionExportSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de exportación inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { format, accountId, categoryId, groupId, from, to, type, cleared, search } = parsed.data;

    const conditions = [eq(transactions.userId, userId)];
    if (accountId) conditions.push(eq(transactions.accountId, accountId));
    if (categoryId) conditions.push(eq(transactions.categoryId, categoryId));
    if (groupId) {
      conditions.push(
        sql`${transactions.categoryId} IN (
          SELECT ${categories.id} FROM ${categories}
          WHERE ${categories.groupId} = ${groupId}
        )`,
      );
    }
    if (from) conditions.push(gte(transactions.date, from));
    if (to) conditions.push(lte(transactions.date, to));
    if (type) conditions.push(eq(transactions.type, type));
    if (cleared === "true") conditions.push(eq(transactions.cleared, true));
    if (cleared === "false") conditions.push(eq(transactions.cleared, false));
    if (search) {
      conditions.push(
        sql`(${transactions.payee} ILIKE ${"%" + search + "%"} OR ${transactions.memo} ILIKE ${"%" + search + "%"})`,
      );
    }

    const rows = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        type: transactions.type,
        amount: transactions.amount,
        payee: transactions.payee,
        memo: transactions.memo,
        cleared: transactions.cleared,
        accountName: accounts.name,
        categoryName: sql<string>`coalesce(${categories.name}, '')`,
        groupName: sql<string>`coalesce(${categoryGroups.name}, '')`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(and(...conditions))
      .orderBy(asc(transactions.date), asc(transactions.id));

    const exportRows = rows.map((r) => ({
      Fecha: r.date,
      Tipo: r.type === "expense" ? "Gasto" : r.type === "income" ? "Ingreso" : "Transferencia",
      Importe: r.amount,
      Beneficiario: r.payee ?? "",
      Cuenta: r.accountName,
      Grupo: r.groupName,
      Categoría: r.categoryName,
      Nota: r.memo ?? "",
      Estado: r.cleared ? "Liquidada" : "Pendiente",
    }));

    if (format === "json") {
      res.setHeader("Content-Disposition", 'attachment; filename="transacciones.json"');
      return res.json(exportRows);
    }

    if (exportRows.length === 0) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="transacciones.csv"');
      return res.send("Sin datos");
    }

    const headers = Object.keys(exportRows[0]);
    const csvLines = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h as keyof typeof row] ?? "");
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="transacciones.csv"');
    res.send("\uFEFF" + csvLines.join("\n"));
  } catch (err) {
    next(err);
  }
});
