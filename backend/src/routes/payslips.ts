import { Router } from "express";
import { db } from "../db/index.js";
import { payslips, payslipConcepts } from "../db/schema.js";
import { eq, and, desc, like, gte, lte, sql } from "drizzle-orm";
import { upload, validatePdfMagicBytes } from "../middleware/upload.js";
import { parsePayslip } from "../parsers/parser-engine.js";
import { z } from "zod";
import { unlinkSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { logger } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const payslipsRouter = Router();

// Upload one or more PDFs
payslipsRouter.post(
  "/upload",
  upload.array("files", 20),
  validatePdfMagicBytes,
  async (req, res, next) => {
    try {
      const profileId = Number(req.body.profileId);
      if (!profileId)
        return res.status(400).json({ error: "profileId requerido" });

      const files = req.files as Express.Multer.File[];
      if (!files?.length)
        return res.status(400).json({ error: "No se han subido archivos" });

      const results = [];

      for (const file of files) {
        const [payslip] = await db
          .insert(payslips)
          .values({
            profileId,
            fileName: file.originalname,
            filePath: file.filename,
            parsingStatus: "pending",
          })
          .returning();

        processPayslip(payslip.id, file.path).catch((err) =>
          logger.error({ payslipId: payslip.id, err }, "Error parsing payslip")
        );

        results.push(payslip);
      }

      res.status(201).json(results);
    } catch (err) {
      next(err);
    }
  }
);

// List payslips with pagination and search
payslipsRouter.get("/", async (req, res, next) => {
  try {
    const profileId = Number(req.query.profileId) || undefined;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const search = (req.query.search as string) || undefined;
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (profileId) conditions.push(eq(payslips.profileId, profileId));
    if (year) conditions.push(eq(payslips.periodYear, year));
    if (status) conditions.push(eq(payslips.parsingStatus, status as "pending" | "parsed" | "error" | "review"));
    if (search) {
      conditions.push(
        sql`(${payslips.fileName} LIKE ${'%' + search + '%'} OR ${payslips.company} LIKE ${'%' + search + '%'})`
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(payslips)
      .where(where);

    const result = await db
      .select()
      .from(payslips)
      .where(where)
      .orderBy(desc(payslips.periodYear), desc(payslips.periodMonth))
      .limit(limit)
      .offset(offset);

    res.json({ data: result, total: count, page, limit });
  } catch (err) {
    next(err);
  }
});

// Get single payslip with concepts
payslipsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip)
      return res.status(404).json({ error: "Nómina no encontrada" });

    const concepts = await db
      .select()
      .from(payslipConcepts)
      .where(eq(payslipConcepts.payslipId, id));

    res.json({ ...payslip, concepts });
  } catch (err) {
    next(err);
  }
});

// Update concepts manually
const conceptSchema = z.object({
  concepts: z.array(
    z.object({
      category: z.enum(["devengo", "deduccion", "otros"]),
      name: z.string().min(1),
      amount: z.number(),
      isPercentage: z.boolean().optional(),
    })
  ),
  grossSalary: z.number().optional(),
  netSalary: z.number().optional(),
  periodMonth: z.number().min(1).max(12).optional(),
  periodYear: z.number().min(1900).max(2100).optional(),
  company: z.string().optional(),
});

payslipsRouter.put("/:id/concepts", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const parsed = conceptSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const { concepts, ...meta } = parsed.data;

    await db
      .update(payslips)
      .set({ ...meta, parsingStatus: "parsed" })
      .where(eq(payslips.id, id));

    await db.delete(payslipConcepts).where(eq(payslipConcepts.payslipId, id));
    if (concepts.length > 0) {
      await db.insert(payslipConcepts).values(
        concepts.map((c) => ({ ...c, payslipId: id }))
      );
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Reprocess a payslip
payslipsRouter.post("/:id/reprocess", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip)
      return res.status(404).json({ error: "Nómina no encontrada" });

  const filePath = resolve(
    __dirname,
    "../../../data/uploads",
    payslip.filePath
  );

  await processPayslip(id, filePath);

  const [updated] = await db
    .select()
    .from(payslips)
    .where(eq(payslips.id, id));
  const concepts = await db
    .select()
    .from(payslipConcepts)
    .where(eq(payslipConcepts.payslipId, id));

    res.json({ ...updated, concepts });
  } catch (err) {
    next(err);
  }
});

// Delete payslip
payslipsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip)
      return res.status(404).json({ error: "Nómina no encontrada" });

    try {
      const filePath = resolve(
        __dirname,
        "../../../data/uploads",
        payslip.filePath
      );
      unlinkSync(filePath);
    } catch {
      // File may already be deleted
    }

    await db.delete(payslips).where(eq(payslips.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Reparse all payslips (useful after parser improvements)
payslipsRouter.post("/reparse", async (req, res, next) => {
  try {
    const allPayslips = await db.select().from(payslips);
    let success = 0;
    let errors = 0;

    for (const p of allPayslips) {
      try {
        const filePath = resolve(__dirname, "../../../data/uploads", p.filePath);
        await processPayslip(p.id, filePath);
        success++;
      } catch {
        errors++;
      }
    }

    res.json({ ok: true, reparsed: success, errors });
  } catch (err) {
    next(err);
  }
});

// Internal function to process a payslip
async function processPayslip(payslipId: number, filePath: string) {
  try {
    const result = await parsePayslip(filePath);

    // Update payslip with parsed data
    await db
      .update(payslips)
      .set({
        rawText: result.rawText,
        grossSalary: result.grossSalary,
        netSalary: result.netSalary,
        periodMonth: result.periodMonth,
        periodYear: result.periodYear,
        company: result.company,
        parsingStatus: result.concepts.length > 0 ? "parsed" : "review",
      })
      .where(eq(payslips.id, payslipId));

    // Delete old concepts and insert new ones
    await db
      .delete(payslipConcepts)
      .where(eq(payslipConcepts.payslipId, payslipId));

    if (result.concepts.length > 0) {
      await db.insert(payslipConcepts).values(
        result.concepts.map((c) => ({ ...c, payslipId }))
      );
    }
  } catch (err) {
    logger.error({ payslipId, err }, "Parse error");
    await db
      .update(payslips)
      .set({ parsingStatus: "error" })
      .where(eq(payslips.id, payslipId));
  }
}
