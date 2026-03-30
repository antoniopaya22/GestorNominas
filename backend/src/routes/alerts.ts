import { Router } from "express";
import { db } from "../db/index.js";
import { alertRules, alertHistory } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const alertsRouter = Router();

const ruleSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["salary_drop", "missing_payslip", "concept_change", "custom_threshold"]),
  config: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

// List alert rules
alertsRouter.get("/rules", async (_req, res, next) => {
  try {
    const rules = await db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
    res.json(rules.map((r) => ({ ...r, config: JSON.parse(r.config) })));
  } catch (err) {
    next(err);
  }
});

// Create alert rule
alertsRouter.post("/rules", async (req, res, next) => {
  try {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const [rule] = await db
      .insert(alertRules)
      .values({ ...parsed.data, config: JSON.stringify(parsed.data.config) })
      .returning();
    res.status(201).json({ ...rule, config: JSON.parse(rule.config) });
  } catch (err) {
    next(err);
  }
});

// Update alert rule
alertsRouter.put("/rules/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.config) data.config = JSON.stringify(data.config);

    const [updated] = await db.update(alertRules).set(data).where(eq(alertRules.id, id)).returning();
    if (!updated) return res.status(404).json({ error: "Regla no encontrada" });
    res.json({ ...updated, config: JSON.parse(updated.config) });
  } catch (err) {
    next(err);
  }
});

// Delete alert rule
alertsRouter.delete("/rules/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(alertRules).where(eq(alertRules.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Regla no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// List alert history
alertsRouter.get("/history", async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === "true";
    const conditions = unreadOnly ? eq(alertHistory.read, false) : undefined;

    const history = await db
      .select()
      .from(alertHistory)
      .where(conditions)
      .orderBy(desc(alertHistory.createdAt))
      .limit(50);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// Mark alert as read
alertsRouter.put("/history/:id/read", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await db.update(alertHistory).set({ read: true }).where(eq(alertHistory.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Mark all alerts as read
alertsRouter.put("/history/read-all", async (_req, res, next) => {
  try {
    await db.update(alertHistory).set({ read: true }).where(eq(alertHistory.read, false));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
