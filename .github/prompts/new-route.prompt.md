---
name: 'new-route'
description: 'Scaffolding completo de una nueva ruta Express con validación Zod, CRUD handlers y registro'
agent: 'backend-dev'
tools:
  - run_in_terminal
  - file_search
  - grep_search
  - read_file
  - create_file
  - replace_string_in_file
  - get_errors
---

# /new-route — Scaffolding de Ruta Express

Crea una nueva ruta Express completa siguiendo los patrones exactos de GestorNominas.

## Input del Usuario

El usuario debe especificar:
- **Nombre del recurso** (ej: "categories", "reports", "templates")
- **Campos** del recurso (ej: "name: string, description: string optional, priority: number")
- **Si es protegida** (por defecto: sí)

Si el usuario no proporciona suficiente detalle, preguntar lo necesario.

## Proceso de Generación

### 1. Crear tabla en schema (si no existe)

Añadir la tabla en `backend/src/db/schema.ts` siguiendo el patrón existente:

```typescript
export const resourceName = sqliteTable('resource_name', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // campos del recurso en snake_case
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
```

### 2. Crear archivo de ruta

Crear `backend/src/routes/resource.ts` con:

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { resourceName } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const resourceRouter = Router();

// Schema de validación
const createSchema = z.object({ /* campos */ });
const updateSchema = createSchema.partial();

// GET / — Listar con paginación
// GET /:id — Obtener uno
// POST / — Crear
// PUT /:id — Actualizar
// DELETE /:id — Eliminar
```

### 3. Registrar en index.ts

Añadir en `backend/src/index.ts`:
```typescript
import { resourceRouter } from './routes/resource.js';
// En la sección de rutas protegidas:
app.use('/api/resource', resourceRouter);
```

### 4. Generar migración

```bash
npm run db:generate
```

### 5. Crear funciones API en frontend

Añadir en `frontend/src/lib/api.ts`:
```typescript
export interface Resource { /* campos tipados */ }
export async function getResources(): Promise<Resource[]> { }
export async function createResource(data: CreateData): Promise<Resource> { }
// etc.
```

## Verificación Final

1. Compilar backend: `npm run build --workspace=backend`
2. Verificar que la migración se generó correctamente
3. Confirmar que la ruta está registrada en index.ts
