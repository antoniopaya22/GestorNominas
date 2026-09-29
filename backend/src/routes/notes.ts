import { Router } from "express";
import { db } from "../db/index.js";
import { payslipNotes } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const notesRouter = Router();

const noteSchema = z.object({
  payslipId: z.number(),
  content: z.string().min(1).max(2000),
});

// Get notes for a payslip
notesRouter.get("/:payslipId", async (req, res, next) => {
  try {
    const payslipId = Number(req.params.payslipId);
    const notes = await db
      .select()
      .from(payslipNotes)
      .where(eq(payslipNotes.payslipId, payslipId))
      .orderBy(desc(payslipNotes.createdAt));
    res.json(notes);
  } catch (err) {
    next(err);
  }
});

// Add note
notesRouter.post("/", async (req, res, next) => {
  try {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const [note] = await db.insert(payslipNotes).values(parsed.data).returning();
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// Delete note
notesRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(payslipNotes).where(eq(payslipNotes.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Nota no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
