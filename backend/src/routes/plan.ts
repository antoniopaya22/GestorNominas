import { Router } from "express";
import { z } from "zod";
import { getPlan, setTarget } from "../services/budget.service.js";
import { assignWithHistory, moveWithHistory, undo, redo, getRecentMoves } from "../services/budget-history.service.js";

export const planRouter = Router();

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes inválido (YYYY-MM)");

planRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = monthSchema.safeParse(req.query.month);
    if (!parsed.success) {
      return res.status(400).json({ error: "Parámetro 'month' inválido (YYYY-MM)" });
    }
    const plan = await getPlan(userId, parsed.data);
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

const assignSchema = z.object({
  month: monthSchema,
  amount: z.number().finite(),
});

planRouter.put("/categories/:categoryId/assign", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const categoryId = Number(req.params.categoryId);
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors });
    }
    const result = await assignWithHistory(userId, categoryId, parsed.data.month, parsed.data.amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const targetSchema = z.object({ amount: z.number().finite().positive().nullable() });

planRouter.put("/categories/:categoryId/target", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const categoryId = Number(req.params.categoryId);
    const parsed = targetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors });
    }
    const result = await setTarget(userId, categoryId, parsed.data.amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const moveSchema = z.object({
  month: monthSchema,
  fromCategoryId: z.number().int().positive().nullable(),
  toCategoryId: z.number().int().positive().nullable(),
  amount: z.number().finite().positive(),
});

planRouter.post("/move", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten().fieldErrors });
    }
    const { month, fromCategoryId, toCategoryId, amount } = parsed.data;
    if (fromCategoryId == null && toCategoryId == null) {
      return res.status(400).json({ error: "Debe indicar origen o destino" });
    }
    const result = await moveWithHistory(userId, month, fromCategoryId, toCategoryId, amount);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

planRouter.post("/undo", async (req, res, next) => {
  try {
    const result = await undo(req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

planRouter.post("/redo", async (req, res, next) => {
  try {
    const result = await redo(req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

planRouter.get("/recent-moves", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const moves = await getRecentMoves(req.user!.userId, limit);
    res.json(moves);
  } catch (err) {
    next(err);
  }
});
