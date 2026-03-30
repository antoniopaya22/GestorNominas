import { Router } from "express";
import { db } from "../db/index.js";
import { payslips, payslipConcepts, profiles } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (req, res, next) => {
  try {
  const profileIds = req.query.profileId
    ? String(req.query.profileId)
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n))
    : [];
  const from = req.query.from as string | undefined; // "YYYY-MM"
  const to = req.query.to as string | undefined;

  // Build conditions
  const conditions = [eq(payslips.parsingStatus, "parsed")];

  if (profileIds.length === 1) {
    conditions.push(eq(payslips.profileId, profileIds[0]));
  }

  if (from) {
    const [y, m] = from.split("-").map(Number);
    conditions.push(
      sql`(${payslips.periodYear} > ${y} OR (${payslips.periodYear} = ${y} AND ${payslips.periodMonth} >= ${m}))`
    );
  }
  if (to) {
    const [y, m] = to.split("-").map(Number);
    conditions.push(
      sql`(${payslips.periodYear} < ${y} OR (${payslips.periodYear} = ${y} AND ${payslips.periodMonth} <= ${m}))`
    );
  }

  const where = and(...conditions);

  // Get all matching payslips
  const allPayslips = await db
    .select()
    .from(payslips)
    .where(where)
    .orderBy(payslips.periodYear, payslips.periodMonth);

  // Filter by profileIds if multiple
  const filtered =
    profileIds.length > 1
      ? allPayslips.filter((p) => profileIds.includes(p.profileId))
      : allPayslips;

  // Get concepts for those payslips
  const payslipIds = filtered.map((p) => p.id);
  let allConcepts: Array<{
    id: number;
    payslipId: number;
    category: string;
    name: string;
    amount: number;
    isPercentage: boolean;
  }> = [];

  if (payslipIds.length > 0) {
    allConcepts = await db
      .select()
      .from(payslipConcepts)
      .where(
        sql`${payslipConcepts.payslipId} IN (${sql.join(
          payslipIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
  }

  // Get profiles
  const allProfiles = await db.select().from(profiles);
  const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

  // Build evolution data (monthly series per profile)
  const evolution: Record<
    string,
    Array<{
      month: string;
      gross: number | null;
      net: number | null;
    }>
  > = {};

  for (const p of filtered) {
    const profile = profileMap.get(p.profileId);
    const key = profile?.name ?? `Perfil ${p.profileId}`;
    if (!evolution[key]) evolution[key] = [];
    evolution[key].push({
      month: `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`,
      gross: p.grossSalary,
      net: p.netSalary,
    });
  }

  // Build concept breakdown (aggregate by concept name)
  const conceptBreakdown: Record<
    string,
    { total: number; count: number; category: string }
  > = {};
  for (const c of allConcepts) {
    if (!conceptBreakdown[c.name]) {
      conceptBreakdown[c.name] = { total: 0, count: 0, category: c.category };
    }
    conceptBreakdown[c.name].total += c.amount;
    conceptBreakdown[c.name].count += 1;
  }

  // KPIs
  const totalPayslips = filtered.length;
  const avgGross =
    totalPayslips > 0
      ? filtered.reduce((s, p) => s + (p.grossSalary ?? 0), 0) / totalPayslips
      : 0;
  const avgNet =
    totalPayslips > 0
      ? filtered.reduce((s, p) => s + (p.netSalary ?? 0), 0) / totalPayslips
      : 0;
  const totalGrossYear = filtered.reduce(
    (s, p) => s + (p.grossSalary ?? 0),
    0
  );
  const totalNetYear = filtered.reduce((s, p) => s + (p.netSalary ?? 0), 0);

  // IRPF average
  const irpfConcepts = allConcepts.filter((c) =>
    c.name.toLowerCase().includes("irpf")
  );
  const avgIrpf =
    irpfConcepts.length > 0
      ? irpfConcepts.reduce((s, c) => s + c.amount, 0) / irpfConcepts.length
      : 0;

  // ─── Annual Summaries (per year) ──────────────────────────────
  const byYear = new Map<number, typeof filtered>();
  for (const p of filtered) {
    const y = p.periodYear ?? 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(p);
  }

  const rd = (n: number) => Math.round(n * 100) / 100;

  const annualSummaries = Array.from(byYear.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, ps]) => {
      const totalGross = ps.reduce((s, p) => s + (p.grossSalary ?? 0), 0);
      const totalNet = ps.reduce((s, p) => s + (p.netSalary ?? 0), 0);
      const totalDeductions = totalGross - totalNet;
      const months = ps.length;
      const currentMonth = new Date().getMonth() + 1;
      const currentFullYear = new Date().getFullYear();
      const isCurrentYear = year === currentFullYear;
      const projectedMonths = isCurrentYear ? Math.max(months, currentMonth) : 12;
      const monthlyAvgGross = months > 0 ? totalGross / months : 0;
      const monthlyAvgNet = months > 0 ? totalNet / months : 0;

      // Get IRPF for this year's payslips
      const yearPayslipIds = new Set(ps.map((p) => p.id));
      const yearIrpf = allConcepts
        .filter((c) => yearPayslipIds.has(c.payslipId) && c.name.toLowerCase().includes("irpf"))
        .reduce((s, c) => s + c.amount, 0);

      // Count pagas extra
      const pagasExtra = ps.filter(
        (p) => allConcepts.some((c) => c.payslipId === p.id && c.name.toLowerCase().includes("paga extra"))
      ).length;

      return {
        year,
        months,
        totalGross: rd(totalGross),
        totalNet: rd(totalNet),
        totalDeductions: rd(totalDeductions),
        totalIrpf: rd(yearIrpf),
        avgMonthlyGross: rd(monthlyAvgGross),
        avgMonthlyNet: rd(monthlyAvgNet),
        projectedAnnualGross: rd(monthlyAvgGross * projectedMonths),
        projectedAnnualNet: rd(monthlyAvgNet * projectedMonths),
        pagasExtra,
        retentionRate: totalGross > 0 ? rd((totalNet / totalGross) * 100) : 0,
      };
    });

  // ─── IRPF Evolution (monthly) ─────────────────────────────────
  const irpfByPayslip = new Map<number, number>();
  for (const c of irpfConcepts) {
    irpfByPayslip.set(c.payslipId, (irpfByPayslip.get(c.payslipId) ?? 0) + c.amount);
  }

  const irpfEvolution = filtered
    .filter((p) => p.grossSalary && p.grossSalary > 0)
    .map((p) => ({
      month: `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`,
      amount: rd(irpfByPayslip.get(p.id) ?? 0),
      rate: rd(((irpfByPayslip.get(p.id) ?? 0) / p.grossSalary!) * 100),
    }));

  // ─── Monthly Savings Rate ─────────────────────────────────────
  const monthlySavings = filtered
    .filter((p) => p.grossSalary && p.grossSalary > 0)
    .map((p) => ({
      month: `${p.periodYear}-${String(p.periodMonth).padStart(2, "0")}`,
      gross: rd(p.grossSalary!),
      net: rd(p.netSalary ?? 0),
      deductions: rd((p.grossSalary ?? 0) - (p.netSalary ?? 0)),
      retentionRate: rd(((p.netSalary ?? 0) / p.grossSalary!) * 100),
    }));

  res.json({
    kpis: {
      totalPayslips,
      avgGross: rd(avgGross),
      avgNet: rd(avgNet),
      totalGrossYear: rd(totalGrossYear),
      totalNetYear: rd(totalNetYear),
      avgIrpf: rd(avgIrpf),
    },
    evolution,
    conceptBreakdown: Object.entries(conceptBreakdown).map(
      ([name, data]) => ({
        name,
        category: data.category,
        total: rd(data.total),
        average: rd(data.total / data.count),
        count: data.count,
      })
    ),
    annualSummaries,
    irpfEvolution,
    monthlySavings,
    profiles: allProfiles.map((p) => ({ id: p.id, name: p.name, color: p.color })),
  });
  } catch (err) {
    next(err);
  }
});
