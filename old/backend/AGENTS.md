# Backend — Instrucciones para Agentes

## Stack

Express 4 + TypeScript ESM + Drizzle ORM + better-sqlite3 + Zod + JWT + Pino

## Patrón de Rutas Express

Cada dominio tiene su propio archivo en `src/routes/`. Estructura obligatoria:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { tableName } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const domainRouter = Router();

// Schema de validación
const createSchema = z.object({
  name: z.string().min(1).max(255),
});

// Handler async con try/catch + next(err)
domainRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos inválidos',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = db.insert(tableName).values(parsed.data).returning().get();
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
```

## Reglas Críticas

- **Imports**: usar extensión `.js` en todos los imports relativos (`'../db/index.js'`, no `'../db/index'`)
- **Validación**: siempre `zod.safeParse()` → respuesta 400 con `error.flatten().fieldErrors`
- **Auth**: las rutas protegidas se montan detrás de `authMiddleware` en `src/index.ts`
- **User ID**: acceder al usuario autenticado con `(req as any).user.userId`
- **Status codes**: 200 (OK), 201 (Created), 400 (Validation), 401 (Unauth), 404 (Not Found), 500 (Server Error)
- **Error handling**: `next(err)` propaga al error handler centralizado en `middleware/error-handler.ts`
- **AppError**: usar `new AppError(message, statusCode)` para errores operacionales tipados
- **Respuestas**: siempre JSON, mensajes en español

## Middleware Chain (orden en index.ts)

1. `helmet()` — headers de seguridad
2. `cors()` — Cross-Origin
3. `express.json()` — body parsing
4. `pinoHttp({ logger })` — request logging
5. Rate limiter global en `/api`
6. Rate limiter estricto en `/api/auth`
7. Rutas públicas: `/api/health`, `/api/auth`
8. `authMiddleware` — verificación JWT
9. Rutas protegidas: profiles, payslips, dashboard, analytics, export, alerts, notes, tags
10. Servir frontend estático en producción
11. Error handler centralizado

## Parser Pipeline

El sistema de parsing de nóminas tiene 4 componentes en `src/parsers/`:

1. **`parser-engine.ts`** — Orquestador. Llama a text extractor → si falla, OCR → concept matcher
2. **`pdf-text-extractor.ts`** — Extrae texto directo de PDFs con `pdf-parse`
3. **`ocr-extractor.ts`** — Fallback OCR con Tesseract.js, idioma español (`spa`)
4. **`concept-matcher.ts`** — Regex patterns para extraer: periodo (mes/año), empresa, salario bruto/neto, y conceptos individuales (devengos/deducciones)

El parsing es **asíncrono y no bloqueante** — se lanza después de crear el registro de payslip y actualiza el status cuando termina.

## Schema de Base de Datos

Definido en `src/db/schema.ts`. Tablas principales:

- `users` — Cuentas (email unique, password_hash, name)
- `profiles` — Perfiles con color identificativo
- `payslips` — Nóminas con FK a profiles (ON DELETE CASCADE)
- `payslip_concepts` — Conceptos con categoría: `devengo | deduccion | otros`
- `payslip_notes`, `tags`, `payslip_tags` — Notas y etiquetas
- `alert_rules`, `alert_history` — Sistema de alertas

Convenciones: snake_case para tablas/columnas, `integer` para booleans (0/1), `text` para enums, `created_at` con default `sql\`(CURRENT_TIMESTAMP)\``

## Configuración

Variables de entorno validadas con Zod en `src/config.ts`:
- `PORT` (default 3001)
- `JWT_SECRET` (requerido)
- `JWT_EXPIRES_IN` (default "7d")
- `DATABASE_PATH` (default "./data/nominas.db")
- `UPLOAD_DIR` (default "./data/uploads")
- `NODE_ENV` (default "development")
- `CORS_ORIGIN` (default "http://localhost:4321")
