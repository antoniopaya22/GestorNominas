import type { Request, Response, NextFunction } from "express";

// Rechaza con 400 cualquier parámetro de ruta que no sea un id entero positivo,
// en vez de dejar que `Number("abc")` (NaN) llegue a Postgres y acabe en 500.
// Se registra con `router.param("id", validateIdParam)` en cada router.
export function validateIdParam(_req: Request, res: Response, next: NextFunction, value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2_147_483_647) {
    return res.status(400).json({ error: "Identificador inválido" });
  }
  next();
}
