# GestorNominas — Instrucciones Globales para Copilot

## Descripción del Proyecto

GestorNominas es una aplicación web de gestión y análisis de nóminas con OCR. Permite a los usuarios subir PDFs de nóminas, extraer datos automáticamente (texto directo o OCR con Tesseract), y proporciona dashboards analíticos, alertas y exportación de datos.

## Stack Tecnológico

### Backend (`backend/`)
- **Runtime**: Node.js con TypeScript (ESM)
- **Framework**: Express 4
- **ORM**: Drizzle ORM con better-sqlite3 (SQLite)
- **Validación**: Zod para esquemas de entrada
- **Auth**: JWT (jsonwebtoken) + bcryptjs (cost 12)
- **Logging**: Pino + pino-http
- **Seguridad**: Helmet, CORS, express-rate-limit
- **Parsing**: pdf-parse (texto) + Tesseract.js (OCR fallback en español)
- **Uploads**: Multer (disk storage)

### Frontend (`frontend/`)
- **Framework**: Astro 5 con integración React
- **UI**: React 19 con TanStack React Query 5
- **Estilos**: Tailwind CSS 3 con design tokens personalizados
- **Iconos**: Lucide React
- **Gráficos**: Recharts
- **Upload UX**: react-dropzone

### Infraestructura
- **Monorepo**: npm workspaces (`backend/` + `frontend/`)
- **Dev**: `concurrently` para correr ambos en paralelo
- **Docker**: Multi-stage build con Node 20 Alpine
- **DB**: SQLite en filesystem (`./data/nominas.db`)

## Convenciones de Código

### General
- Módulos ESM en todo el proyecto (`"type": "module"` en package.json)
- TypeScript strict mode habilitado
- camelCase para variables y funciones
- PascalCase para componentes React, interfaces y tipos
- snake_case para tablas y columnas SQL en Drizzle schema
- UPPER_SNAKE_CASE para constantes
- Named exports preferidos sobre default exports (excepto componentes de página React)
- Mensajes user-facing siempre en **español**
- Código y nombres de variables en **inglés**

### Backend
- Imports ESM deben usar extensión `.js` en paths (para compatibilidad con build)
- Cada dominio tiene su propio Router en `backend/src/routes/`
- Routers se exportan como named exports con sufijo `Router` (ej: `payslipsRouter`)
- Handlers async con patrón `try/catch` + `next(err)` para error propagation
- Validación de inputs con `zod.safeParse()` y respuesta 400 inmediata con errores aplanados
- Respuestas JSON con status codes explícitos
- `AppError` para errores operacionales tipados
- Rutas protegidas detrás de `authMiddleware` montado en `index.ts`

### Frontend
- Páginas Astro en `frontend/src/pages/` como entry points de rutas
- Cada página Astro monta un componente React con `client:load`
- Componentes React de página: default export envuelve inner view con `<Providers>`
- Data fetching con React Query (useQuery/useMutation) — nunca fetch directo en componentes
- API client centralizado en `frontend/src/lib/api.ts`
- Auth state en React Context (`AuthProvider`)
- Toast notifications via React Context (`ToastProvider`)
- Tailwind utility-first con clases de componentes reutilizables (`.card`, `.btn-primary`, etc.)
- Dark mode con estrategia `class` y localStorage

## Seguridad — Reglas Críticas

- **Nunca** hardcodear secretos, tokens o credenciales en código
- **Siempre** validar inputs del usuario con Zod antes de procesarlos
- **Siempre** usar parámetros preparados de Drizzle ORM (nunca concatenar SQL)
- **Siempre** sanitizar nombres de archivo en uploads
- **Nunca** exponer stack traces o errores internos al cliente en producción
- **Siempre** verificar autenticación JWT en rutas protegidas
- Passwords hasheados con bcrypt cost 12 — nunca almacenar en texto plano
- Rate limiting en endpoints sensibles (auth, uploads)
- Verificar magic bytes de archivos PDF en uploads

## Estructura del Proyecto

```
GestorNominas/
├── .github/                    # Configuración Copilot/agentes
├── backend/
│   ├── src/
│   │   ├── index.ts            # Bootstrap app, middleware chain, mount rutas
│   │   ├── config.ts           # Variables de entorno con Zod validation
│   │   ├── logger.ts           # Pino logger configuration
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema (todas las tablas)
│   │   │   ├── index.ts        # DB connection singleton
│   │   │   ├── migrate.ts      # Script de migración
│   │   │   └── migrations/     # SQL migrations generadas por drizzle-kit
│   │   ├── middleware/
│   │   │   ├── auth.ts         # JWT verification middleware
│   │   │   ├── error-handler.ts # Centralized error handler
│   │   │   └── upload.ts       # Multer config + PDF validation
│   │   ├── parsers/
│   │   │   ├── parser-engine.ts      # Orquestador: text → OCR fallback → concepts
│   │   │   ├── pdf-text-extractor.ts # Extracción de texto directo de PDF
│   │   │   ├── ocr-extractor.ts      # OCR con Tesseract.js en español
│   │   │   └── concept-matcher.ts    # Regex matching de conceptos de nómina
│   │   └── routes/
│   │       ├── auth.ts         # Registro, login, /me
│   │       ├── payslips.ts     # CRUD nóminas + upload + reparse
│   │       ├── profiles.ts     # CRUD perfiles
│   │       ├── dashboard.ts    # KPIs y resúmenes
│   │       ├── analytics.ts    # Tendencias, comparaciones, predicciones
│   │       ├── export.ts       # Exportar CSV/JSON
│   │       ├── alerts.ts       # Reglas y historial de alertas
│   │       ├── notes.ts        # Notas por nómina
│   │       └── tags.ts         # Tags y asignación
│   └── drizzle.config.ts
├── frontend/
│   ├── src/
│   │   ├── components/         # Componentes React de página y utilidad
│   │   ├── layouts/Layout.astro # Shell compartido con navegación
│   │   ├── lib/api.ts          # API client centralizado
│   │   ├── pages/              # Rutas Astro (file-based routing)
│   │   └── styles/global.css   # Tailwind + design tokens + component classes
│   ├── astro.config.mjs
│   └── tailwind.config.mjs
├── Dockerfile
└── package.json                # Workspace root
```

## Comandos del Proyecto

```bash
# Desarrollo (ambos servicios en paralelo)
npm run dev

# Solo backend
npm run dev --workspace=backend

# Solo frontend
npm run dev --workspace=frontend

# Build
npm run build

# Migraciones de base de datos
npm run db:generate    # Genera migration SQL desde schema changes
npm run db:migrate     # Aplica migraciones pendientes

# Producción
npm start
```
