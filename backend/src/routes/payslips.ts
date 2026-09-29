import { Router } from "express";
import { db } from "../db/index.js";
import { payslips, payslipConcepts, profiles } from "../db/schema.js";
import { eq, and, asc, desc, ilike, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { upload, validatePdfMagicBytes, fixFilenameEncoding } from "../middleware/upload.js";
import { parsePayslip } from "../parsers/parser-engine.js";
import { matchConcepts } from "../parsers/concept-matcher.js";
import { z } from "zod";
import { validateIdParam } from "../middleware/params.js";
import { logger } from "../logger.js";

export const payslipsRouter = Router();
payslipsRouter.param("id", validateIdParam);

/** Returns the IDs of profiles owned by the authenticated user */
async function getUserProfileIds(userId: number): Promise<number[]> {
  const rows = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return rows.map((r) => r.id);
}

// Upload one or more PDFs — se procesan en la propia petición (sin OCR el
// parseo es rápido, y así no se depende de que la función siga viva después
// de responder, algo que un entorno serverless no garantiza).
payslipsRouter.post(
  "/upload",
  upload.array("files", 20),
  fixFilenameEncoding,
  validatePdfMagicBytes,
  async (req, res, next) => {
    try {
      const { userId } = req.user!;
      const profileId = Number(req.body.profileId);
      if (!profileId)
        return res.status(400).json({ error: "profileId requerido" });

      const bodyType = req.body.payslipType;
      const manualType: "ordinal" | "extra" =
        bodyType === "extra" ? "extra" : "ordinal";

      // Verify the profile belongs to this user
      const [profile] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
      if (!profile)
        return res.status(403).json({ error: "Perfil no pertenece al usuario" });

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
            payslipType: manualType,
            parsingStatus: "pending",
          })
          .returning();

        await processPayslip(payslip.id, file.buffer);

        const [updated] = await db.select().from(payslips).where(eq(payslips.id, payslip.id));
        const concepts = await db
          .select()
          .from(payslipConcepts)
          .where(eq(payslipConcepts.payslipId, payslip.id));

        results.push({ ...updated, concepts });
      }

      res.status(201).json(results);
    } catch (err) {
      next(err);
    }
  }
);

const payslipListQuerySchema = z.object({
  profileId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(["pending", "parsed", "error", "review"]).optional(),
  type: z.enum(["ordinal", "extra"]).optional(),
  sortBy: z.enum(["period", "fileName", "grossSalary", "netSalary", "parsingStatus"]).default("period"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// List payslips with pagination and search
payslipsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = payslipListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Parámetros de consulta inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    if (userProfileIds.length === 0)
      return res.json({ data: [], total: 0, page: 1, limit: 50 });

    const { profileId, year, search, status, type, sortBy, sortDir, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [
      sql`${payslips.profileId} IN (${sql.join(userProfileIds.map((id) => sql`${id}`), sql`, `)})`
    ];
    if (profileId) {
      if (!userProfileIds.includes(profileId))
        return res.json({ data: [], total: 0, page, limit });
      conditions.push(eq(payslips.profileId, profileId));
    }
    if (year) conditions.push(eq(payslips.periodYear, year));
    if (status) conditions.push(eq(payslips.parsingStatus, status));
    if (type) conditions.push(eq(payslips.payslipType, type));
    if (search) {
      conditions.push(
        or(ilike(payslips.fileName, `%${search}%`), ilike(payslips.company, `%${search}%`))!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const sortOrder = sortDir === "asc" ? asc : desc;
    const orderByClauses = sortBy === "period"
      ? [sortOrder(payslips.periodYear), sortOrder(payslips.periodMonth), desc(payslips.id)]
      : sortBy === "fileName"
      ? [sortOrder(payslips.fileName), desc(payslips.periodYear), desc(payslips.periodMonth), desc(payslips.id)]
      : sortBy === "grossSalary"
      ? [sortOrder(payslips.grossSalary), desc(payslips.periodYear), desc(payslips.periodMonth), desc(payslips.id)]
      : sortBy === "netSalary"
      ? [sortOrder(payslips.netSalary), desc(payslips.periodYear), desc(payslips.periodMonth), desc(payslips.id)]
      : [sortOrder(payslips.parsingStatus), desc(payslips.periodYear), desc(payslips.periodMonth), desc(payslips.id)];

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payslips)
      .where(where);

    const result = await db
      .select()
      .from(payslips)
      .where(where)
      .orderBy(...orderByClauses)
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
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip || !userProfileIds.includes(payslip.profileId))
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
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    const id = Number(req.params.id);

    // Verify ownership
    const [existing] = await db.select().from(payslips).where(eq(payslips.id, id));
    if (!existing || !userProfileIds.includes(existing.profileId))
      return res.status(404).json({ error: "Nómina no encontrada" });

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

// Reprocess a payslip — re-ejecuta el matcher sobre el texto ya guardado
// (útil tras mejoras del parser), no re-extrae de ningún archivo porque no
// se guarda ninguno.
payslipsRouter.post("/:id/reprocess", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip || !userProfileIds.includes(payslip.profileId))
      return res.status(404).json({ error: "Nómina no encontrada" });

    if (!payslip.rawText) {
      return res.status(400).json({ error: "Esta nómina no tiene texto guardado para reprocesar" });
    }

    await applyParsedResult(id, matchConcepts(payslip.rawText));

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
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    const id = Number(req.params.id);
    const [payslip] = await db
      .select()
      .from(payslips)
      .where(eq(payslips.id, id));

    if (!payslip || !userProfileIds.includes(payslip.profileId))
      return res.status(404).json({ error: "Nómina no encontrada" });

    await db.delete(payslips).where(eq(payslips.id, id));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Update payslip type
const payslipTypeSchema = z.object({
  type: z.enum(["ordinal", "extra"]),
});

payslipsRouter.patch("/:id/type", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    const id = Number(req.params.id);

    const parsed = payslipTypeSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: "Tipo inválido", details: parsed.error.flatten().fieldErrors });

    const [payslip] = await db.select().from(payslips).where(eq(payslips.id, id));
    if (!payslip || !userProfileIds.includes(payslip.profileId))
      return res.status(404).json({ error: "Nómina no encontrada" });

    const [updated] = await db
      .update(payslips)
      .set({ payslipType: parsed.data.type })
      .where(eq(payslips.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Reparse all payslips (useful after parser improvements) — igual que
// reprocess, sobre el rawText ya guardado de cada una.
payslipsRouter.post("/reparse", async (req, res, next) => {
  try {
    const { userId } = req.user!;
    const userProfileIds = await getUserProfileIds(userId);
    if (userProfileIds.length === 0)
      return res.json({ ok: true, reparsed: 0, errors: 0 });

    const allPayslips = await db
      .select()
      .from(payslips)
      .where(sql`${payslips.profileId} IN (${sql.join(userProfileIds.map((id) => sql`${id}`), sql`, `)})`);
    let success = 0;
    let errors = 0;

    const BATCH_SIZE = 5;
    for (let i = 0; i < allPayslips.length; i += BATCH_SIZE) {
      const batch = allPayslips.filter((p) => p.rawText).slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((p) => applyParsedResult(p.id, matchConcepts(p.rawText!))),
      );
      for (const r of results) {
        if (r.status === "fulfilled") success++;
        else errors++;
      }
    }

    res.json({ ok: true, reparsed: success, errors });
  } catch (err) {
    next(err);
  }
});

// Persiste el resultado de un parseo/reparseo: metadatos + conceptos.
async function applyParsedResult(payslipId: number, result: ReturnType<typeof matchConcepts>) {
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

  await db.delete(payslipConcepts).where(eq(payslipConcepts.payslipId, payslipId));

  if (result.concepts.length > 0) {
    await db.insert(payslipConcepts).values(
      result.concepts.map((c) => ({ ...c, payslipId }))
    );
  }
}

// Procesa un PDF recién subido: extrae texto + conceptos y los persiste.
async function processPayslip(payslipId: number, fileBuffer: Buffer) {
  try {
    const result = await parsePayslip(fileBuffer);
    await applyParsedResult(payslipId, result);
  } catch (err) {
    logger.error({ payslipId, err }, "Parse error");
    await db
      .update(payslips)
      .set({ parsingStatus: "error" })
      .where(eq(payslips.id, payslipId));
  }
}
