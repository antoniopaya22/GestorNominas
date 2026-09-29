import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.warn({ statusCode: err.statusCode, message: err.message }, "Operational error");
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Multer errors
  if (err.name === "MulterError" || err.message === "Solo se permiten archivos PDF") {
    logger.warn({ message: err.message }, "Upload error");
    return res.status(400).json({ error: err.message });
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Error interno del servidor" });
}
