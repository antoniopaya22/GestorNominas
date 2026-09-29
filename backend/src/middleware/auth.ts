import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config.js";

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

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
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
