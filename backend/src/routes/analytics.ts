import { Router } from "express";
import { db } from "../db/index.js";
import { payslips, payslipConcepts, profiles } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export const analyticsRouter = Router();

analyticsRouter.get("/", async (req, res, next) => {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;

    const conditions = [eq(payslips.parsingStatus, "parsed")];
    if (profileId) conditions.push(eq(payslips.profileId, profileId));

    const allPayslips = await db
      .select()
      .from(payslips)
      .where(and(...conditions))
      .orderBy(payslips.periodYear, payslips.periodMonth);

    if (allPayslips.length === 0) {
      return res.json({ trends: null, predictions: null, alerts: [], anomalies: [] });
    }

    // Get all concepts
    const payslipIds = allPayslips.map((p) => p.id);
    let allConcepts: Array<{
      payslipId: number; category: string; name: string; amount: number;
    }> = [];

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

    // Monthly data sorted chronologically
    const monthlyData = allPayslips.map((p) => ({
      month: `${p.periodYear}-${String(p.periodMonth ?? 0).padStart(2, "0")}`,
      gross: p.grossSalary ?? 0,
      net: p.netSalary ?? 0,
      year: p.periodYear ?? 0,
    }));

    // ─── TRENDS ───────────────────────────────────────────────
    const grossValues = monthlyData.map((d) => d.gross);
    const netValues = monthlyData.map((d) => d.net);

    const grossTrend = calculateTrend(grossValues);
    const netTrend = calculateTrend(netValues);

    // Monthly series for charts (frontend expects arrays)
    const grossSeries = monthlyData.map((d) => ({ month: d.month, value: round(d.gross) }));
    const netSeries = monthlyData.map((d) => ({ month: d.month, value: round(d.net) }));

    // Year-over-year comparison (per month)
    const currentYear = Math.max(...monthlyData.map((d) => d.year));
    const prevYear = currentYear - 1;
    const currentYearData = monthlyData.filter((d) => d.year === currentYear);
    const prevYearData = monthlyData.filter((d) => d.year === prevYear);

    const yoyGrossArr: Array<{ month: string; current: number; previous: number; change: number }> = [];
    const yoyNetArr: Array<{ month: string; current: number; previous: number; change: number }> = [];

    if (prevYearData.length > 0) {
      for (const cur of currentYearData) {
        const monthNum = cur.month.split("-")[1];
        const prev = prevYearData.find((d) => d.month.split("-")[1] === monthNum);
        if (prev) {
          yoyGrossArr.push({
            month: cur.month,
            current: round(cur.gross),
            previous: round(prev.gross),
            change: round(cur.gross - prev.gross),
          });
          yoyNetArr.push({
            month: cur.month,
            current: round(cur.net),
            previous: round(prev.net),
            change: round(cur.net - prev.net),
          });
        }
      }
    }

    // ─── PREDICTION (simple linear regression) ────────────────
    const predictions = predictNext(monthlyData, 3);

    // ─── CONCEPT TRENDS ─────────────────────────────────────────
    const conceptsByMonth = new Map<string, Map<string, number>>();
    for (const c of allConcepts) {
      const p = allPayslips.find((ps) => ps.id === c.payslipId);
      if (!p) continue;
      const month = `${p.periodYear}-${String(p.periodMonth ?? 0).padStart(2, "0")}`;
      if (!conceptsByMonth.has(c.name)) conceptsByMonth.set(c.name, new Map());
      const monthMap = conceptsByMonth.get(c.name)!;
      monthMap.set(month, (monthMap.get(month) ?? 0) + c.amount);
    }

    // Build concept trends as Record<name, Array<{ month, value }>>
    const conceptTrendsRecord: Record<string, Array<{ month: string; value: number }>> = {};
    for (const [name, monthMap] of conceptsByMonth.entries()) {
      const values = Array.from(monthMap.values());
      if (avg(values) > 10) {
        conceptTrendsRecord[name] = Array.from(monthMap.entries())
          .map(([month, value]) => ({ month, value: round(value) }))
          .sort((a, b) => a.month.localeCompare(b.month));
      }
    }

    // ─── ANOMALY DETECTION ────────────────────────────────────
    const anomalies: Array<{
      type: string;
      severity: "info" | "warning" | "critical";
      month: string;
      message: string;
      value: number;
      expected: number;
    }> = [];

    // Detect gross salary anomalies (>2 std dev from mean)
    const grossMean = avg(grossValues);
    const grossStd = stdDev(grossValues);
    for (const d of monthlyData) {
      if (grossStd > 0 && Math.abs(d.gross - grossMean) > 2 * grossStd) {
        anomalies.push({
          type: "salary_anomaly",
          severity: Math.abs(d.gross - grossMean) > 3 * grossStd ? "critical" : "warning",
          month: d.month,
          message: d.gross > grossMean
            ? `Salario bruto inusualmente alto`
            : `Salario bruto inusualmente bajo`,
          value: round(d.gross),
          expected: round(grossMean),
        });
      }
    }

    // Detect IRPF rate changes
    const irpfConcepts = allConcepts.filter((c) => c.name.toLowerCase().includes("irpf"));
    if (irpfConcepts.length >= 2) {
      const irpfByPayslip = new Map<number, number>();
      for (const c of irpfConcepts) {
        irpfByPayslip.set(c.payslipId, (irpfByPayslip.get(c.payslipId) ?? 0) + c.amount);
      }
      const irpfRates = allPayslips
        .filter((p) => irpfByPayslip.has(p.id) && p.grossSalary && p.grossSalary > 0)
        .map((p) => ({
          month: `${p.periodYear}-${String(p.periodMonth ?? 0).padStart(2, "0")}`,
          rate: round(((irpfByPayslip.get(p.id) ?? 0) / p.grossSalary!) * 100),
        }));

      for (let i = 1; i < irpfRates.length; i++) {
        const diff = Math.abs(irpfRates[i].rate - irpfRates[i - 1].rate);
        if (diff > 2) {
          anomalies.push({
            type: "irpf_change",
            severity: diff > 5 ? "critical" : "warning",
            month: irpfRates[i].month,
            message: `Cambio significativo en tipo IRPF: ${irpfRates[i - 1].rate}% → ${irpfRates[i].rate}%`,
            value: irpfRates[i].rate,
            expected: irpfRates[i - 1].rate,
          });
        }
      }
    }

    // ─── ALERTS ─────────────────────────────────────────────────
    const alerts: Array<{
      type: string;
      severity: "info" | "warning" | "critical";
      message: string;
    }> = [];

    // Net salary decreasing trend
    if (netTrend.direction === "down" && Math.abs(netTrend.slopePercent) > 1) {
      alerts.push({
        type: "net_decreasing",
        severity: Math.abs(netTrend.slopePercent) > 3 ? "critical" : "warning",
        message: `Tu salario neto tiene tendencia a la baja (${netTrend.slopePercent.toFixed(1)}% mensual)`,
      });
    }

    // Missing months from recent year
    if (currentYearData.length > 0) {
      const currentMonth = new Date().getMonth() + 1;
      const expectedMonths = currentMonth;
      const actualMonths = currentYearData.length;
      if (actualMonths < expectedMonths - 1) {
        alerts.push({
          type: "missing_payslips",
          severity: "info",
          message: `Faltan nóminas de ${currentYear}: tienes ${actualMonths} de ${expectedMonths} meses esperados`,
        });
      }
    }

    // Retention rate warning
    const retentionRate = grossMean > 0 ? (avg(netValues) / grossMean) * 100 : 0;
    if (retentionRate < 65 && retentionRate > 0) {
      alerts.push({
        type: "high_retention",
        severity: "warning",
        message: `Tu tasa de retención es del ${retentionRate.toFixed(1)}%, superiror a la media`,
      });
    }

    // YoY decrease
    if (yoyNetArr.length > 0) {
      const avgCurrentNet = avg(yoyNetArr.map((d) => d.current));
      const avgPrevNet = avg(yoyNetArr.map((d) => d.previous));
      if (avgPrevNet > 0) {
        const changePercent = round(((avgCurrentNet - avgPrevNet) / avgPrevNet) * 100);
        if (changePercent < -5) {
          alerts.push({
            type: "yoy_decrease",
            severity: "warning",
            message: `Tu salario neto medio bajó un ${Math.abs(changePercent).toFixed(1)}% respecto al año anterior`,
          });
        }
      }
    }

    res.json({
      trends: {
        gross: grossSeries,
        net: netSeries,
        yoyGross: yoyGrossArr,
        yoyNet: yoyNetArr,
        conceptTrends: conceptTrendsRecord,
      },
      predictions,
      anomalies,
      alerts,
    });
  } catch (err) {
    next(err);
  }
});

// ─── Helper functions ─────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateTrend(values: number[]): {
  direction: "up" | "down" | "stable";
  slopePercent: number;
  slope: number;
} {
  if (values.length < 2) return { direction: "stable", slopePercent: 0, slope: 0 };

  // Simple linear regression
  const n = values.length;
  const x = values.map((_, i) => i);
  const xMean = avg(x);
  const yMean = avg(values);

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - xMean) * (values[i] - yMean);
    den += (x[i] - xMean) ** 2;
  }

  const slope = den !== 0 ? num / den : 0;
  const slopePercent = yMean !== 0 ? (slope / yMean) * 100 : 0;

  return {
    direction: slopePercent > 0.5 ? "up" : slopePercent < -0.5 ? "down" : "stable",
    slopePercent: round(slopePercent),
    slope: round(slope),
  };
}

function predictNext(
  data: Array<{ month: string; gross: number; net: number }>,
  months: number,
): Array<{ month: string; predictedGross: number; predictedNet: number }> {
  if (data.length < 3) return [];

  const grossValues = data.map((d) => d.gross);
  const netValues = data.map((d) => d.net);

  const n = grossValues.length;
  const x = grossValues.map((_, i) => i);
  const grossSlope = linearSlope(x, grossValues);
  const netSlope = linearSlope(x, netValues);
  const grossIntercept = avg(grossValues) - grossSlope * avg(x);
  const netIntercept = avg(netValues) - netSlope * avg(x);

  // Parse last month to generate future months
  const lastMonth = data[data.length - 1].month;
  const [lastY, lastM] = lastMonth.split("-").map(Number);

  const predictions: Array<{ month: string; predictedGross: number; predictedNet: number }> = [];
  for (let i = 1; i <= months; i++) {
    let m = lastM + i;
    let y = lastY;
    while (m > 12) { m -= 12; y++; }

    predictions.push({
      month: `${y}-${String(m).padStart(2, "0")}`,
      predictedGross: round(Math.max(0, grossIntercept + grossSlope * (n - 1 + i))),
      predictedNet: round(Math.max(0, netIntercept + netSlope * (n - 1 + i))),
    });
  }

  return predictions;
}

function linearSlope(x: number[], y: number[]): number {
  const n = x.length;
  const xMean = avg(x);
  const yMean = avg(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - xMean) * (y[i] - yMean);
    den += (x[i] - xMean) ** 2;
  }
  return den !== 0 ? num / den : 0;
}
