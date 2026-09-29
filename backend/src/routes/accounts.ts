import { Router } from "express";
import { db } from "../db/index.js";
import { accounts } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { validateIdParam } from "../middleware/params.js";
import { getAccountsWithBalance } from "../services/finance.service.js";

export const accountsRouter = Router();
accountsRouter.param("id", validateIdParam);

const accountSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  type: z.enum(["bank", "credit_card", "cash", "investment", "other"]).optional(),
  currency: z.string().max(10).optional(),
  initialBalance: z.number().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(50).nullish(),
});

// List all accounts with calculated balance
accountsRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const result = await getAccountsWithBalance(userId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// Get single account
accountsRouter.get("/:id", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const id = Number(req.params.id);
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json(account);
  } catch (err) {
    next(err);
  }
});

// Create account
accountsRouter.post("/", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos de cuenta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [account] = await db
      .insert(accounts)
      .values({ ...parsed.data, userId })
      .returning();
    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
});

// Update account
accountsRouter.put("/:id", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const id = Number(req.params.id);
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos de cuenta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [updated] = await db
      .update(accounts)
      .set(parsed.data)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Delete account
accountsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const id = Number(req.params.id);
    const [deleted] = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    if (!deleted) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Toggle archive status
accountsRouter.patch("/:id/archive", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const id = Number(req.params.id);

    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });

    const [updated] = await db
      .update(accounts)
      .set({ archived: !account.archived })
      .where(eq(accounts.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
