# GestorNominas — Instrucciones para Agentes de IA

## Visión General

Aplicación web monorepo de gestión y análisis de nóminas españolas. Backend API REST + Frontend SPA con OCR para extracción automática de datos de PDFs de nóminas.

## Arquitectura

```
[Browser] → [Astro/React SPA :4321] → proxy /api → [Express API :3001] → [SQLite DB]
                                                          ↓
                                                    [PDF Parser]
                                                    [Tesseract OCR]
```

- **Frontend** (puerto 4321): Astro SSG + React islands con `client:load`. Vite proxy redirige `/api` y `/uploads` al backend.
- **Backend** (puerto 3001): Express REST API. Sirve el frontend estático en producción.
- **Base de datos**: SQLite en `./data/nominas.db`. Drizzle ORM para schema y queries.
- **Uploads**: PDFs almacenados en `./data/uploads/`.

## Tablas de Base de Datos

| Tabla | Propósito |
|---|---|
| `users` | Cuentas de usuario (email, password_hash, name) |
| `profiles` | Perfiles/personas cuyas nóminas se gestionan |
| `payslips` | Nóminas subidas (metadata, salarios, status de parsing) |
| `payslip_concepts` | Conceptos extraídos (devengos, deducciones) |
| `payslip_notes` | Notas libres por nómina |
| `tags` | Etiquetas reutilizables |
| `payslip_tags` | Relación M:N nóminas ↔ tags |
| `alert_rules` | Reglas de alerta configurables |
| `alert_history` | Historial de alertas emitidas |

## Flujo de Parsing de Nóminas

1. Usuario sube PDF(s) → Multer guarda en disco → se crea registro con status `pending`
2. **Async** (no bloqueante): `parserEngine.parsePayslip(payslip)`
3. Intenta extracción de texto directo con `pdf-parse`
4. Si el texto tiene menos de 50 caracteres → fallback a OCR con Tesseract.js (español)
5. `conceptMatcher` aplica reglas regex para extraer: periodo, empresa, salario bruto/neto, conceptos individuales
6. Actualiza registro con datos extraídos y status `parsed` o `error`

## Convenciones de Commits

Usar formato Conventional Commits:
```
tipo(scope): descripción breve en español

[cuerpo opcional con más detalle]
```

Tipos válidos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
Scopes válidos: `backend`, `frontend`, `db`, `parsers`, `auth`, `api`, `ui`, `docker`, `deps`

## Reglas para Agentes

1. **No romper funcionalidad existente** — verificar que los cambios no afecten código que ya funciona
2. **Seguir patrones existentes** — mirar cómo están implementadas features similares antes de crear nuevas
3. **Validar siempre inputs** — usar Zod en backend, tipos TypeScript en frontend
4. **No instalar dependencias** sin justificación clara — el proyecto ya tiene un stack definido
5. **Respetar la estructura de carpetas** — cada dominio tiene su lugar asignado
6. **Mensajes al usuario en español** — todo texto visible para el usuario final debe estar en español
7. **Tests y linting** — si se añade funcionalidad nueva, verificar que compila (`npm run build`)
8. **Variables de entorno** — nunca hardcodear, usar `config.ts` que valida con Zod
