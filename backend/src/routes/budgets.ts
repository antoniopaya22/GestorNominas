import { Router } from "express";
import { z } from "zod";
import { getBudgetSummary, categoryBelongsToUser, upsertBudget } from "../services/budgets.service.js";

export const budgetsRouter = Router();

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM");

// Resumen del mes: para presupuestar, y asignado/actividad/disponible por categoría.
budgetsRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = monthSchema.safeParse(req.query.month);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parámetro month inválido (usa YYYY-MM)" });
    }

    const summary = await getBudgetSummary(userId, parsed.data);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  categoryId: z.number().int().positive(),
  month: monthSchema,
  assigned: z.number(),
});

// Asignar (o reasignar) un importe a una categoría en un mes — upsert.
budgetsRouter.put("/", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors });
    }

    const belongsToUser = await categoryBelongsToUser(userId, parsed.data.categoryId);
    if (!belongsToUser) return res.status(404).json({ error: "Categoría no encontrada" });

    const row = await upsertBudget(userId, parsed.data.categoryId, parsed.data.month, parsed.data.assigned);
    res.json(row);
  } catch (err) {
    next(err);
  }
});
