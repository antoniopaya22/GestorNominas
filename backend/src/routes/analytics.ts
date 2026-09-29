import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { profiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { predictNext } from "../utils/math.js";
import {
  fetchAnalyticsData,
  toMonthlyData,
  buildTrends,
  detectAnomalies,
  buildAlerts,
  buildExtrasSummary,
} from "../services/analytics.service.js";

export const analyticsRouter = Router();

const analyticsQuerySchema = z.object({
  profileId: z.coerce.number().int().positive("profileId debe ser un número positivo").optional(),
});

const EMPTY_ANALYTICS = { trends: null, predictions: null, alerts: [], anomalies: [], extras: [] };

analyticsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = analyticsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId } = req.user!;

    const userProfileRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.userId, userId));
    const userProfileIds = userProfileRows.map((r) => r.id);

    if (userProfileIds.length === 0) {
      return res.json(EMPTY_ANALYTICS);
    }

    const profileId = parsed.data.profileId;
    if (profileId && !userProfileIds.includes(profileId)) {
      return res.json(EMPTY_ANALYTICS);
    }

    const { allPayslips, allConcepts } = await fetchAnalyticsData(userProfileIds, profileId);
    if (allPayslips.length === 0) {
      return res.json(EMPTY_ANALYTICS);
    }

    const monthlyData = toMonthlyData(allPayslips);
    const { trends, netTrend, yoyNet, currentYear, currentYearData } =
      buildTrends(monthlyData, allPayslips, allConcepts);
    const predictions = predictNext(monthlyData, 3);
    const anomalies = detectAnomalies(monthlyData, allPayslips, allConcepts);
    const alerts = buildAlerts(monthlyData, netTrend, currentYear, currentYearData, yoyNet);
    const extras = buildExtrasSummary(allPayslips);

    res.json({ trends, predictions, anomalies, alerts, extras });
  } catch (err) {
    next(err);
  }
});
