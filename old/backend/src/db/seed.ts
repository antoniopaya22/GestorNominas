import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "./index.js";
import { users } from "./schema.js";
import { LOCAL_AUTH_EMAIL } from "../middleware/auth.js";

// El middleware de auth siempre resuelve al usuario LOCAL_AUTH_EMAIL — sin esto,
// una base de datos nueva (instalador de escritorio, primer arranque) responde 500.
export async function ensureLocalUser(): Promise<void> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  await db.insert(users).values({
    email: LOCAL_AUTH_EMAIL,
    name: "Usuario",
    passwordHash,
  });
}
