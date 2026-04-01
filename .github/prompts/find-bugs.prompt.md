---
name: 'find-bugs'
description: 'Escanea el código en busca de bugs potenciales, errores lógicos y problemas de robustez'
agent: 'agent'
tools:
  - file_search
  - grep_search
  - read_file
  - semantic_search
  - get_errors
---

# /find-bugs — Detector de Bugs

Escanea el codebase de GestorNominas buscando bugs potenciales, errores lógicos y problemas de robustez.

## Proceso

### 1. Errores de Compilación
Primero, verificar si hay errores de TypeScript usando la herramienta de diagnóstico.

### 2. Backend — Bugs Comunes
Buscar en `backend/src/`:

- **Async/Await**: handlers sin `try/catch` o sin `await` en llamadas async
- **Error propagation**: handlers que no llaman `next(err)` en el catch
- **Null/undefined**: acceso a propiedades sin verificar existencia (`.get()` puede retornar undefined)
- **Validación faltante**: endpoints que aceptan input sin validar con Zod
- **SQL queries**: uso de `sql` template con interpolación insegura de variables
- **Race conditions**: operaciones async que asumen estado no cambia entre reads
- **File operations**: acceso a archivos sin verificar existencia o sin manejo de errores
- **Type coercion**: comparaciones y operaciones con tipos mixtos (string vs number)
- **Missing status codes**: respuestas sin código de estado explícito
- **Memory leaks**: event listeners o workers no limpiados

### 3. Frontend — Bugs Comunes
Buscar en `frontend/src/`:

- **Missing loading/error states**: queries sin manejar `isLoading` o `error`
- **Stale closures**: callbacks en useEffect que capturan state obsoleto
- **Missing dependencies**: useEffect/useMemo/useCallback con deps incompletas
- **Uncontrolled inputs**: forms sin estado controlado
- **Memory leaks**: subscriptions o timers sin cleanup en useEffect
- **Key props**: listas renderizadas sin `key` o con index como key
- **Auth token**: operaciones que deberían verificar auth pero no lo hacen
- **Type mismatches**: datos de API usados sin verificar el tipo

### 4. Cross-cutting
- **Inconsistencias API**: frontend espera un shape diferente al que devuelve el backend
- **Environment leaks**: variables de entorno o secretos hardcodeados
- **Import paths**: imports incorrectos (falta extensión `.js` en backend)

## Formato del Reporte

Para cada bug encontrado:

```markdown
### 🔴 CRÍTICO / 🟡 MEDIO / 🟢 BAJO — [Descripción breve]

**Archivo**: [ruta:línea]
**Tipo**: [categoría del bug]
**Problema**: [descripción detallada]
**Ejemplo**: [código problemático]
**Fix sugerido**: [cómo corregirlo]
```

Ordenar por severidad (críticos primero). Incluir conteo total al final.
