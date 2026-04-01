---
name: 'security-audit'
description: 'Auditoría de seguridad OWASP del código actual, enfocada en el stack del proyecto'
agent: 'security-reviewer'
tools:
  - file_search
  - grep_search
  - read_file
  - semantic_search
  - get_errors
---

# /security-audit — Auditoría de Seguridad

Realiza una auditoría de seguridad completa de GestorNominas basada en OWASP Top 10, adaptada al stack del proyecto.

## Alcance

Analizar sistemáticamente:

### Backend (`backend/src/`)
1. **Autenticación y sesiones** (`routes/auth.ts`, `middleware/auth.ts`)
   - ¿JWT_SECRET suficientemente fuerte?
   - ¿Token expiry razonable?
   - ¿Bcrypt cost ≥ 12?
   - ¿Rate limiting en login/register?

2. **Autorización** (`middleware/auth.ts`, todas las rutas)
   - ¿Todas las rutas protegidas requieren auth?
   - ¿Se verifica ownership de recursos?
   - ¿Hay escalación de privilegios posible?

3. **Validación de inputs** (todos los archivos en `routes/`)
   - ¿Todos los endpoints validan inputs con Zod?
   - ¿Queries usan parámetros de Drizzle (no SQL concatenado)?
   - ¿Se sanitizan strings que se almacenan?

4. **Uploads y archivos** (`middleware/upload.ts`, `parsers/`)
   - ¿Se verifican magic bytes (no solo extensión)?
   - ¿Límite de tamaño de archivo?
   - ¿Se sanitizan nombres de archivo?
   - ¿Los archivos se almacenan fuera del directorio público?

5. **Configuración** (`config.ts`, `index.ts`)
   - ¿Helmet configurado?
   - ¿CORS restringido?
   - ¿Variables de entorno validadas?
   - ¿Stack traces ocultados en producción?

6. **Dependencias**
   - Ejecutar `npm audit` para vulnerabilidades conocidas

### Frontend (`frontend/src/`)
7. **Auth client** (`lib/api.ts`, `components/AuthProvider.tsx`)
   - ¿Token almacenado de forma segura?
   - ¿Se limpia auth en 401?
   - ¿Se protegen rutas en el cliente?

8. **XSS potencial** (todos los componentes)
   - ¿Se usa `dangerouslySetInnerHTML`?
   - ¿Se renderizan datos del usuario sin sanitizar?

## Formato del Reporte

```markdown
# 🔒 Auditoría de Seguridad — GestorNominas

**Fecha**: [fecha]
**Alcance**: [archivos analizados]

## Resumen Ejecutivo
- 🔴 Críticos: [N]
- 🟡 Medios: [N]
- 🟢 Bajos: [N]
- ✅ Buenas prácticas detectadas: [N]

## Hallazgos

### 🔴 [CRÍTICO] Título
**Archivo**: ruta:línea
**Descripción**: ...
**Impacto**: ...
**Remediación**: ...

## Buenas Prácticas Detectadas
- ✅ [práctica positiva encontrada]

## Recomendaciones Generales
- [mejoras sugeridas no urgentes]
```
