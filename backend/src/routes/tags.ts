import { Router } from "express";
import { db } from "../db/index.js";
import { tags, payslipTags } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const tagsRouter = Router();

const tagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// List all tags
tagsRouter.get("/", async (_req, res, next) => {
  try {
    const allTags = await db.select().from(tags).orderBy(tags.name);
    res.json(allTags);
  } catch (err) {
    next(err);
  }
});

// Create tag
tagsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = tagSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const [tag] = await db.insert(tags).values(parsed.data).returning();
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

// Delete tag
tagsRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(tags).where(eq(tags.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Etiqueta no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Assign tag to payslip
tagsRouter.post("/assign", async (req, res, next) => {
  try {
    const schema = z.object({ payslipId: z.number(), tagId: z.number() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const [entry] = await db.insert(payslipTags).values(parsed.data).returning();
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

// Remove tag from payslip
tagsRouter.delete("/assign/:payslipId/:tagId", async (req, res, next) => {
  try {
    const payslipId = Number(req.params.payslipId);
    const tagId = Number(req.params.tagId);
    await db
      .delete(payslipTags)
      .where(and(eq(payslipTags.payslipId, payslipId), eq(payslipTags.tagId, tagId)));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Get tags for a payslip
tagsRouter.get("/payslip/:payslipId", async (req, res, next) => {
  try {
    const payslipId = Number(req.params.payslipId);
    const entries = await db
      .select({ tag: tags })
      .from(payslipTags)
      .innerJoin(tags, eq(payslipTags.tagId, tags.id))
      .where(eq(payslipTags.payslipId, payslipId));
    res.json(entries.map((e) => e.tag));
  } catch (err) {
    next(err);
  }
});
