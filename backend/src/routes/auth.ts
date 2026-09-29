import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";

export const authRouter = Router();

// El login/registro lo gestiona Supabase Auth (Google) directamente desde el
// frontend — authMiddleware ya crea la fila en `users` la primera vez que
// llega un token válido, así que aquí solo queda leer/actualizar el perfil.

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
