import { Router } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db/index.js";
import {
  users,
  profiles,
  accounts,
  categoryGroups,
  tags,
  alertRules,
  alertHistory,
} from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateToken, authMiddleware } from "../middleware/auth.js";

export const authRouter = Router();

// Only login/register are brute-force targets — other auth routes require an
// already-issued token or the current password, so they don't need this limit.
const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos, inténtalo más tarde" },
});

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Register
authRouter.post("/register", credentialsLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email));
    if (existing.length > 0)
      return res.status(409).json({ error: "El email ya está registrado" });

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const [user] = await db
      .insert(users)
      .values({
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
      })
      .returning();

    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

// Login
authRouter.post("/login", credentialsLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email));

    if (!user) return res.status(401).json({ error: "Credenciales incorrectas" });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciales incorrectas" });

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    next(err);
  }
});

// Get current user
authRouter.get("/me", authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, req.user.userId));

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
});

// Change password
authRouter.post("/change-password", authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.userId));
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Contraseña actual incorrecta" });

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, req.user.userId));

    res.json({ ok: true, message: "Contraseña actualizada correctamente" });
  } catch (err) {
    next(err);
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

// Update user profile (name)
authRouter.put("/me", authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const [updated] = await db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, req.user.userId))
      .returning({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt });

    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const resetAllSchema = z.object({
  password: z.string().min(1),
});

// Reset all data for the current user (payslips, accounts, transactions, categories, alerts, tags...)
// Keeps the user account itself intact.
authRouter.post("/reset-all", authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ error: "No autenticado" });

    const parsed = resetAllSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user.userId));
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Contraseña incorrecta" });

    const userId = req.user.userId;

    db.transaction((tx) => {
      // Payslips (+ concepts, notes, payslip-tags) cascade from profiles
      tx.delete(profiles).where(eq(profiles.userId, userId)).run();

      // Transactions and recurring transactions cascade from accounts
      tx.delete(accounts).where(eq(accounts.userId, userId)).run();

      // Categories cascade from category groups
      tx.delete(categoryGroups).where(eq(categoryGroups.userId, userId)).run();

      // Alert history has no direct userId, so clear it via the user's own rules first
      const ruleIds = tx
        .select({ id: alertRules.id })
        .from(alertRules)
        .where(eq(alertRules.userId, userId))
        .all()
        .map((r) => r.id);
      if (ruleIds.length > 0) {
        tx.delete(alertHistory).where(inArray(alertHistory.ruleId, ruleIds)).run();
      }
      tx.delete(alertRules).where(eq(alertRules.userId, userId)).run();

      // Tags (+ payslip-tag links) cascade from tags
      tx.delete(tags).where(eq(tags.userId, userId)).run();
    });

    res.json({ ok: true, message: "Todos los datos se han eliminado correctamente" });
  } catch (err) {
    next(err);
  }
});
