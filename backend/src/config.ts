import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:4321"),
  DATABASE_PATH: z.string().default("../data/nominas.db"),
  UPLOAD_DIR: z.string().default("../data/uploads"),
  JWT_SECRET: isProd
    ? z.string().min(32, "JWT_SECRET must be at least 32 characters in production")
    : z.string().min(16).default("gestor-nominas-dev-secret-change-me"),
  JWT_EXPIRES_IN: z.string().default("7d"),
});

export const env = envSchema.parse(process.env);
