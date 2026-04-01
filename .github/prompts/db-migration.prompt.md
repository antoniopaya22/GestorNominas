---
name: 'db-migration'
description: 'Guía paso a paso para crear una nueva migración Drizzle ORM'
agent: 'db-admin'
tools:
  - run_in_terminal
  - file_search
  - grep_search
  - read_file
  - create_file
  - replace_string_in_file
  - get_errors
---

# /db-migration — Nueva Migración de Base de Datos

Guía interactiva para crear cambios en la base de datos de GestorNominas usando Drizzle ORM.

## Input del Usuario

El usuario debe describir qué cambio necesita en la base de datos:
- **Nueva tabla**: nombre, columnas, relaciones
- **Modificar tabla**: qué columnas añadir/cambiar
- **Nuevo índice**: qué columnas indexar
- **Nueva relación**: entre qué tablas

Si el input es vago, preguntar detalles específicos.

## Proceso

### Paso 1: Revisar Estado Actual

Leer `backend/src/db/schema.ts` para entender las tablas existentes y sus relaciones.

### Paso 2: Modificar Schema

Editar `backend/src/db/schema.ts` siguiendo las convenciones:

- Tablas y columnas en `snake_case`
- PKs con autoIncrement
- Booleans como `integer` (0/1)
- Enums como `text`
- Timestamps como `text` con `default(sql\`(CURRENT_TIMESTAMP)\`)`
- Foreign keys con `onDelete` explícito

### Paso 3: Generar Migración

```bash
npm run db:generate
```

Esto genera un archivo SQL en `backend/src/db/migrations/`.

### Paso 4: Revisar Migración Generada

Leer el archivo SQL generado para verificar que:
- Las sentencias SQL son correctas
- No hay cambios destructivos inesperados (DROP TABLE, DROP COLUMN)
- Los defaults y constraints son correctos

### Paso 5: Aplicar Migración

```bash
npm run db:migrate
```

### Paso 6: Verificar

Confirmar que:
- La migración se aplicó sin errores
- El schema refleja los cambios esperados
- Las rutas existentes siguen funcionando

## Consideraciones SQLite

- No soporta `DROP COLUMN` en versiones antiguas de SQLite
- No hay tipo `BOOLEAN` ni `DATETIME` nativo
- `ALTER TABLE` solo soporta `ADD COLUMN` y `RENAME TABLE`
- Para cambios complejos, puede necesitar crear tabla nueva → copiar datos → eliminar vieja → renombrar
