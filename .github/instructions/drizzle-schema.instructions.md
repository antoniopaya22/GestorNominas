---
name: 'Drizzle Schema'
description: 'Convenciones para schema de base de datos Drizzle ORM y migraciones'
applyTo: 'backend/src/db/**'
---

# Schema Drizzle ORM — Base de Datos

## Convenciones de Naming SQL

- **Tablas**: `snake_case`, plural (`payslip_concepts`, `alert_rules`)
- **Columnas**: `snake_case` (`created_at`, `password_hash`, `period_month`)
- **Foreign keys**: `nombre_referencia_id` (`profile_id`, `payslip_id`, `rule_id`)

## Definición de Tablas

Usar helpers de `drizzle-orm/sqlite-core`:

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tableName = sqliteTable('table_name', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isActive: integer('is_active').default(1),  // boolean como integer 0/1
  type: text('type').notNull(),                // enum como text
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
```

## Patrones de Columnas

| Tipo lógico | Tipo SQLite | Ejemplo |
|---|---|---|
| String | `text('col').notNull()` | name, email, company |
| Número | `integer('col')` | salary amounts, counts |
| Boolean | `integer('col').default(0)` | is_active, enabled, read |
| Enum | `text('col').notNull()` | status, category, severity |
| Timestamp | `text('col').default(sql\`(CURRENT_TIMESTAMP)\`)` | created_at |
| JSON | `text('col').default('{}')` | config objects |

## Foreign Keys

Siempre definir ON DELETE para integridad referencial:

```typescript
profileId: integer('profile_id').references(() => profiles.id, {
  onDelete: 'cascade',  // eliminar hijos cuando se elimina padre
}),

ruleId: integer('rule_id').references(() => alertRules.id, {
  onDelete: 'set null',  // mantener registro pero limpiar referencia
}),
```

## Workflow de Migraciones

1. Modificar `backend/src/db/schema.ts` con los cambios
2. Generar migration SQL:
   ```bash
   npm run db:generate
   ```
3. Revisar el SQL generado en `backend/src/db/migrations/`
4. Aplicar migración:
   ```bash
   npm run db:migrate
   ```

## Conexión a Base de Datos

Singleton en `backend/src/db/index.ts`:
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const sqlite = new Database(config.DATABASE_PATH);
export const db = drizzle(sqlite);
```

## Queries Comunes

```typescript
import { eq, and, like, desc, count, sql } from 'drizzle-orm';

// Select con filtro
db.select().from(table).where(eq(table.column, value)).all();

// Select con join implícito
db.select().from(payslips).leftJoin(profiles, eq(payslips.profileId, profiles.id));

// Agregaciones
db.select({ total: count() }).from(payslips).get();

// Raw SQL en select
db.select({ avg: sql<number>`avg(${payslips.netSalary})` }).from(payslips);
```
