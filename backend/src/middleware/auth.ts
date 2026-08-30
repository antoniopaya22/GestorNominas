import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { env } from "../config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export interface AuthPayload {
  userId: number;
  email: string;
}

// Augment Express Request so req.user is available after authMiddleware
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const LOCAL_AUTH_EMAIL = "antonioalfa22@gmail.com";

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Auth deshabilitada para despliegue local — auto-login con usuario local
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, LOCAL_AUTH_EMAIL));

    if (!user) {
      return res.status(500).json({ error: `Usuario local no encontrado: ${LOCAL_AUTH_EMAIL}` });
    }

    req.user = { userId: user.id, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function generateToken(payload: AuthPayload): string {
  const expiresInSeconds = parseExpiry(env.JWT_EXPIRES_IN);
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: expiresInSeconds });
}

function parseExpiry(val: string): number {
  const match = val.match(/^(\d+)([smhd])$/);
  if (!match) return 604800; // default 7 days
  const num = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case "s": return num;
    case "m": return num * 60;
    case "h": return num * 3600;
    case "d": return num * 86400;
    default: return 604800;
  }
}
