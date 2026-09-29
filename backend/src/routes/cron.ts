import { Router } from "express";
import { env } from "../config.js";
import { logger } from "../logger.js";
import { evaluateAllRules } from "../services/alerts.service.js";

export const cronRouter = Router();

// Vercel Cron siempre invoca por GET y sin sesión de usuario, así que esta
// ruta va montada antes de authMiddleware — se protege comprobando el
// propio secreto en vez de un JWT de Supabase. Vercel añade automáticamente
// `Authorization: Bearer $CRON_SECRET` a estas llamadas cuando esa variable
// de entorno existe en el proyecto (ver vercel.json → crons). La evaluación
// es idempotente (ON CONFLICT DO NOTHING sobre rule_id+dedupe_key), así que
// una entrega duplicada del cron —posible según la propia documentación de
// Vercel— no genera alertas repetidas.
cronRouter.get("/evaluate-alerts", async (req, res, next) => {
  try {
    if (!env.CRON_SECRET) {
      return res.status(503).json({ error: "CRON_SECRET no configurado" });
    }
    if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const result = await evaluateAllRules();
    logger.info(result, "Evaluación diaria de alertas completada");
    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
});
