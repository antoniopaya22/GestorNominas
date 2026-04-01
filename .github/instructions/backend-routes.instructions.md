---
name: 'Backend Routes'
description: 'Patrones y convenciones para rutas Express en el backend'
applyTo: 'backend/src/routes/**'
---

# Patrones de Rutas Express — Backend

## Estructura de cada archivo de ruta

Cada archivo en `backend/src/routes/` sigue este orden:

1. Imports (express, zod, db, schema, operadores drizzle)
2. Inicialización del Router: `export const domainRouter = Router();`
3. Schemas de validación Zod (junto a la ruta que los usa)
4. Handlers de ruta (GET list, GET :id, POST, PUT :id, DELETE :id)

## Patrón de Handler

```typescript
domainRouter.method('/path', async (req, res, next) => {
  try {
    // 1. Validar input (si aplica)
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Mensaje descriptivo en español',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // 2. Lógica de negocio (queries Drizzle)
    const result = db.select().from(table).where(eq(table.id, id)).get();

    // 3. Verificar existencia (si aplica)
    if (!result) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }

    // 4. Respuesta con status code explícito
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

## Validación con Zod

- Siempre usar `.safeParse()` (no `.parse()` que lanza excepciones)
- Responder 400 inmediatamente con `error.flatten().fieldErrors`
- Schemas inline cuando son específicos de una ruta
- Mensajes de error en español

## Status Codes

| Code | Uso |
|------|-----|
| 200 | Lectura exitosa, actualización exitosa |
| 201 | Recurso creado |
| 400 | Input inválido (validación Zod) |
| 401 | No autenticado |
| 404 | Recurso no encontrado |
| 500 | Error interno (manejado por error-handler) |

## Convenciones Drizzle en Rutas

```typescript
// SELECT con filtros
db.select().from(payslips).where(eq(payslips.profileId, id)).all();

// INSERT con returning
db.insert(profiles).values({ name }).returning().get();

// UPDATE con returning
db.update(profiles).set({ name }).where(eq(profiles.id, id)).returning().get();

// DELETE
db.delete(profiles).where(eq(profiles.id, id)).run();
```

## Paginación

Para endpoints de lista, usar query params `page` y `limit`:
```typescript
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
const offset = (page - 1) * limit;
```

## Acceso al Usuario Autenticado

Las rutas protegidas tienen acceso al usuario vía middleware:
```typescript
const userId = (req as any).user.userId;
```

## Registro de Nuevas Rutas

Después de crear un nuevo archivo de ruta, registrarlo en `backend/src/index.ts`:
```typescript
import { newRouter } from './routes/new.js';
// ... en la sección de rutas protegidas:
app.use('/api/new', newRouter);
```
