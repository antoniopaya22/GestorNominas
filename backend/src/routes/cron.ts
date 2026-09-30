import { Router } from "express";
import { env } from "../config.js";
import { logger } from "../logger.js";
import { evaluateAllRules } from "../services/alerts.service.js";
import { syncAllUsersRecurringTransactions } from "../services/recurring-transactions.service.js";

export const cronRouter = Router();

// Vercel Cron siempre invoca por GET y sin sesión de usuario, así que esta
// ruta va montada antes de authMiddleware — se protege comprobando el
// propio secreto en vez de un JWT de Supabase. Vercel añade automáticamente
// `Authorization: Bearer $CRON_SECRET` a estas llamadas cuando esa variable
// de entorno existe en el proyecto (ver vercel.json → crons).
//
// Tareas diarias de mantenimiento — ambas idempotentes (ON CONFLICT DO
// NOTHING con una clave única de por medio), así que una entrega duplicada
// del cron —posible según la propia documentación de Vercel— no duplica
// nada:
//  1. Generar las ocurrencias pendientes de los recurrentes (antes vivía en
//     GET /transactions y GET /recurring-transactions — un GET no debería
//     escribir; crear/editar/activar una regla lo sigue haciendo al momento).
//  2. Evaluar las reglas de alerta configurables.
cronRouter.get("/daily", async (req, res, next) => {
  try {
    if (!env.CRON_SECRET) {
      return res.status(503).json({ error: "CRON_SECRET no configurado" });
    }
    if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const recurring = await syncAllUsersRecurringTransactions();
    logger.info(recurring, "Sincronización diaria de recurrentes completada");

    const alerts = await evaluateAllRules();
    logger.info(alerts, "Evaluación diaria de alertas completada");

    res.json({ ok: true, recurring, alerts });
  } catch (err) {
    next(err);
  }
});
