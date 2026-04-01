import { Router } from "express";
import { z } from "zod";
import { db } from "../db/index.js";
import { payslips, payslipConcepts, profiles } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export const exportRouter = Router();

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
