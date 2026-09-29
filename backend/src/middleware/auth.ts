import type { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { eq } from "drizzle-orm";
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

// Claves públicas de Supabase para verificar sus JWT sin llamar a su API en
// cada petición — requiere que el proyecto tenga firmado asimétrico activado
// (Settings → API → JWT Keys).
const JWKS = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

// Evita el SELECT/INSERT a `users` en cada petición autenticada — el par
// (id, email) de un supabase_user_id no cambia entre peticiones, así que
// basta con refrescarlo cada pocos minutos por si acaso.
const USER_CACHE_TTL_MS = 5 * 60_000;
const userCache = new Map<string, { user: AuthPayload; expires: number }>();

interface SupabasePayload {
  sub: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const token = header.slice(7);
    const { payload } = await jwtVerify<SupabasePayload>(token, JWKS, {
      issuer: `${env.SUPABASE_URL}/auth/v1`,
    });

    if (!payload.sub || !payload.email) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const cached = userCache.get(payload.sub);
    if (cached && cached.expires > Date.now()) {
      req.user = cached.user;
      return next();
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, payload.sub));

    const user =
      existing ??
      (
        await db
          .insert(users)
          .values({
            supabaseUserId: payload.sub,
            email: payload.email,
            name: payload.user_metadata?.full_name ?? payload.user_metadata?.name ?? payload.email,
          })
          .returning()
      )[0];

    req.user = { userId: user.id, email: user.email };
    userCache.set(payload.sub, { user: req.user, expires: Date.now() + USER_CACHE_TTL_MS });
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}
