import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:4321"),
  // En producción (Vercel) siempre se define explícitamente (Supabase). El
  // valor por defecto es solo para desarrollo local/tests contra un Postgres
  // local — el cliente de postgres-js es perezoso, no conecta hasta la
  // primera query, así que no rompe tests que no tocan la BBDD.
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/gestornominas"),
  JWT_SECRET: isProd
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters in production")
    : z.string().min(16).default("gestor-nominas-dev-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

export const env = envSchema.parse(process.env);
