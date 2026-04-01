import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { env } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { authMiddleware } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { profilesRouter } from "./routes/profiles.js";
import { payslipsRouter } from "./routes/payslips.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { analyticsRouter } from "./routes/analytics.js";
import { exportRouter } from "./routes/export.js";
import { alertsRouter } from "./routes/alerts.js";
import { notesRouter } from "./routes/notes.js";
import { tagsRouter } from "./routes/tags.js";
import { resolve, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";
import { sqlite } from "./db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directories exist
const uploadsDir = resolve(__dirname, "../", env.UPLOAD_DIR);
mkdirSync(uploadsDir, { recursive: true });

const app = express();

// ─── Global middleware ──────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);
app.use(cors({ origin: env.NODE_ENV === "production" ? true : env.CORS_ORIGIN }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => (req as express.Request).url === "/api/health" } }));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones, intenta más tarde" },
});
app.use("/api", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de login, intenta más tarde" },
});

// ─── Public routes ──────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  try {
    sqlite.prepare("SELECT 1").get();
    res.json({ status: "ok", version: "2.0.0" });
  } catch {
    res.status(503).json({ status: "error", message: "Base de datos no disponible" });
  }
});

app.use("/api/auth", authLimiter, authRouter);

// ─── Authenticated file serving ─────────────────────────────────
app.get("/uploads/:filename", authMiddleware, async (req, res, next) => {
  try {
    const { db } = await import("./db/index.js");
    const { payslips, profiles } = await import("./db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const filename = basename(String(req.params.filename)); // sanitize path traversal
    const userId = req.user!.userId;

    // Verify this file belongs to a payslip owned by the user
    const [payslip] = await db
      .select({ id: payslips.id })
      .from(payslips)
      .innerJoin(profiles, eq(payslips.profileId, profiles.id))
      .where(and(eq(payslips.filePath, filename), eq(profiles.userId, userId)));

    if (!payslip) return res.status(404).json({ error: "Archivo no encontrado" });

    const filePath = resolve(uploadsDir, filename);
    if (!existsSync(filePath)) return res.status(404).json({ error: "Archivo no encontrado" });

    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// ─── Protected routes ───────────────────────────────────────────
app.use("/api/profiles", authMiddleware, profilesRouter);
app.use("/api/payslips", authMiddleware, payslipsRouter);
app.use("/api/dashboard", authMiddleware, dashboardRouter);
app.use("/api/analytics", authMiddleware, analyticsRouter);
app.use("/api/export", authMiddleware, exportRouter);
app.use("/api/alerts", authMiddleware, alertsRouter);
app.use("/api/notes", authMiddleware, notesRouter);
app.use("/api/tags", authMiddleware, tagsRouter);

// ─── Error handler (must be last) ──────────────────────────────
app.use(errorHandler);

// ─── Serve frontend static build (when dist exists) ────────────
const frontendDist = resolve(__dirname, "../../frontend/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Astro generates /page/index.html for each route
  app.get("*", (req, res) => {
    const tryPath = resolve(frontendDist, req.path.replace(/^\//, ""), "index.html");
    if (existsSync(tryPath)) {
      res.sendFile(tryPath);
    } else {
      res.sendFile(resolve(frontendDist, "index.html"));
    }
  });
  logger.info(`Serving frontend from ${frontendDist}`);
}

app.listen(env.PORT, () => {
  logger.info(`🚀 Backend running on http://localhost:${env.PORT}`);
});

// ─── Graceful shutdown ──────────────────────────────────────────
function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  sqlite.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception (non-fatal)");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection (non-fatal)");
});
