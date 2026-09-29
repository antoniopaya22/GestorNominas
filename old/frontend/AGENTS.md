# Frontend — Instrucciones para Agentes

## Stack

Astro 5 + React 19 + TanStack React Query 5 + Tailwind CSS 3 + Lucide React + Recharts

## Patrón de Páginas

Cada ruta usa un archivo Astro que monta un componente React:

### 1. Página Astro (`src/pages/nombre.astro`)
```astro
---
import Layout from '../layouts/Layout.astro';
import NombreComponent from '../components/NombrePage.tsx';
---
<Layout title="Título de Página">
  <NombreComponent client:load />
</Layout>
```

### 2. Componente React de Página (`src/components/NombrePage.tsx`)
```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatos, crearDato } from '../lib/api';
import { Providers } from './Providers';

function NombreView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['datos'],
    queryFn: getDatos,
  });

  if (isLoading) return <div className="skeleton h-32 w-full" />;
  if (error) return <p className="text-danger-400">Error al cargar datos</p>;

  return (
    <div className="space-y-6">
      {/* UI con Tailwind utility classes */}
    </div>
  );
}

export default function NombrePage() {
  return (
    <Providers>
      <NombreView />
    </Providers>
  );
}
```

## Providers

Todos los componentes de página envuelven su contenido con `<Providers>`:
```tsx
// src/components/Providers.tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <ToastProvider>
      {children}
    </ToastProvider>
  </AuthProvider>
</QueryClientProvider>
```

Configuración de QueryClient: `staleTime: 30_000`, `retry: 1`

## API Client

Centralizado en `src/lib/api.ts`. Patrón:

```typescript
// Función genérica de request
async function request<T>(endpoint: string, options?: RequestInit): Promise<T>

// Funciones domain-grouped con named exports
export async function getPayslips(params): Promise<PayslipsResponse>
export async function uploadPayslips(formData: FormData): Promise<UploadResult>
```

Reglas:
- **Nunca** hacer `fetch()` directo en componentes — siempre a través de `api.ts`
- Auth token en localStorage (`auth_token`) — se inyecta automáticamente en headers
- Error 401 → `clearAuth()` + redirect a `/login`
- Funciones de upload y export usan `fetch` directo (no JSON body)

## Auth Flow

1. `AuthProvider` lee token de localStorage al montar
2. Si existe token → llama `getMe()` → setea user en context
3. Login/Register → guarda token → setea user → redirect a `/`
4. Logout → limpia token y user → redirect a `/login`
5. Cualquier 401 en API → limpia auth + redirect `/login`

## Estilos y Design Tokens

Tailwind con tokens extendidos en `tailwind.config.mjs`:

- **Colores**: `primary-{50..950}`, `accent-{50..950}`, `success-{50..950}`, `danger-{50..950}`, `surface-{50..950}`
- **Fuentes**: `font-sans` (Fira Sans), `font-mono` (Fira Code)
- **Dark mode**: estrategia `class`, toggle con localStorage `theme`

Clases de componente reutilizables (definidas en `global.css`):
- `.card` — contenedor con bg, border, rounded, shadow
- `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost` — botones
- `.input` — campos de formulario
- `.badge` — etiquetas/badges
- `.skeleton` — placeholder de carga

## Layout

`src/layouts/Layout.astro` provee:
- **Desktop**: sidebar fijo a la izquierda con navegación
- **Mobile**: header superior + bottom navigation bar
- Toggle de dark mode con localStorage
- Slot para contenido de página

## Reglas Críticas

- **No usar default exports** excepto en componentes de página (el export default envuelve con Providers)
- **React Query para todo data fetching** — nunca `useEffect` + `fetch`
- **Invalidar queries** después de mutaciones exitosas: `queryClient.invalidateQueries()`
- **Loading/Error states** obligatorios en toda vista que cargue datos
- **Mensajes en español** — todo texto visible al usuario
- **Responsive**: mobile-first con breakpoints de Tailwind (`sm:`, `md:`, `lg:`)
- **Iconos**: usar `lucide-react` — importar componentes individuales (`import { Upload } from 'lucide-react'`)
