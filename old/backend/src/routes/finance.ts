import { Router } from "express";
import { z } from "zod";
import {
  getFinanceSummary,
  getMonthlyTrends,
  getCategoryBreakdown,
  getAccountsWithBalance,
  getTopPayees,
  getFinanceAnalytics,
} from "../services/finance.service.js";

export const financeRouter = Router();

const financeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD").optional(),
  accountId: z.coerce.number().int().positive().optional(),
  groupId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
}).refine((data) => !data.from || !data.to || data.from <= data.to, {
  message: "La fecha final debe ser posterior o igual a la inicial",
  path: ["to"],
});

// Financial KPIs summary
financeRouter.get("/summary", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const summary = await getFinanceSummary(userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// Monthly income vs expenses trends
financeRouter.get("/trends", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = financeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const trends = await getMonthlyTrends({
      userId,
      from: parsed.data.from,
      to: parsed.data.to,
      accountId: parsed.data.accountId,
      groupId: parsed.data.groupId,
      categoryId: parsed.data.categoryId,
    });
    res.json({ data: trends });
  } catch (err) {
    next(err);
  }
});

// Spending breakdown by category
financeRouter.get("/breakdown", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = financeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const breakdown = await getCategoryBreakdown({
      userId,
      from: parsed.data.from,
      to: parsed.data.to,
      accountId: parsed.data.accountId,
      groupId: parsed.data.groupId,
      categoryId: parsed.data.categoryId,
    });
    res.json({ data: breakdown });
  } catch (err) {
    next(err);
  }
});

// Summary per account
financeRouter.get("/by-account", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const accs = await getAccountsWithBalance(userId);
    res.json({ data: accs });
  } catch (err) {
    next(err);
  }
});

// Top payees by spending
financeRouter.get("/by-payee", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = financeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const payees = await getTopPayees({
      userId,
      from: parsed.data.from,
      to: parsed.data.to,
      accountId: parsed.data.accountId,
      groupId: parsed.data.groupId,
      categoryId: parsed.data.categoryId,
    });
    res.json({ data: payees });
  } catch (err) {
    next(err);
  }
});

// Aggregated finance analytics dashboard
financeRouter.get("/analytics", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const parsed = financeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const analytics = await getFinanceAnalytics({
      userId,
      from: parsed.data.from,
      to: parsed.data.to,
      accountId: parsed.data.accountId,
      groupId: parsed.data.groupId,
      categoryId: parsed.data.categoryId,
    });

    res.json(analytics);
  } catch (err) {
    next(err);
  }
});
