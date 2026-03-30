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
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directories exist
const uploadsDir = resolve(__dirname, "../../", env.UPLOAD_DIR);
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
  res.json({ status: "ok", version: "2.0.0" });
});

app.use("/api/auth", authLimiter, authRouter);

// ─── Static files ───────────────────────────────────────────────
app.use("/uploads", express.static(uploadsDir));

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
