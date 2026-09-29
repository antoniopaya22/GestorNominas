# Frontend — Instrucciones para Agentes

## Stack

Astro 5 + React 19 + TanStack React Query 5 + Tailwind CSS 4 + shadcn/ui (Base UI) + Lucide React + Recharts. Salida estática, desplegada en Vercel.

## Rutas

- `/`, `/caracteristicas`, `/precios` — páginas de marketing, públicas, con `MarketingLayout.astro` (sin `Providers`, sin llamadas a la API).
- `/login` — login/registro, con `AuthProvider` pero sin el `Layout` de la app.
- `/app/*` — la aplicación real (dashboard, nóminas, finanzas), con `Layout.astro` (sidebar/nav) detrás del login. Cualquier página nueva de la app va aquí, nunca en la raíz.

## Patrón de Páginas (dentro de `/app`)

### 1. Página Astro (`src/pages/app/nombre.astro`)
```astro
---
import Layout from '../../layouts/Layout.astro';
import NombreComponent from '../../components/NombrePage.tsx';
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
      {/* UI con Tailwind utility classes o componentes de shadcn (@/components/ui/*) */}
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

Las páginas de marketing (`.astro` en la raíz de `src/pages/`) no usan `Providers` ni `client:load` — son estáticas, sin datos ni auth.

## Providers

```tsx
// src/components/Providers.tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {children}
    <Toaster position="bottom-right" />
  </AuthProvider>
</QueryClientProvider>
```

Toasts con `sonner` (`import { toast } from "sonner"`, luego `toast.success(...)`/`toast.error(...)`) — no hay un `ToastProvider`/`useToast` propio.

Configuración de QueryClient: `staleTime: 30_000`, `retry: 1`

## API Client

Centralizado en `src/lib/api.ts`. Patrón:

```typescript
async function request<T>(endpoint: string, options?: RequestInit): Promise<T>
export async function getPayslips(params): Promise<PayslipsResponse>
export async function uploadPayslips(profileId, files): Promise<Payslip[]>
```

Reglas:
- **Nunca** hacer `fetch()` directo en componentes — siempre a través de `api.ts`
- Auth token en localStorage (`auth_token`) — se inyecta automáticamente en headers
- Error 401 → `clearAuth()` + `window.location.href = "/login"`
- Funciones de upload y export usan `fetch` directo (no JSON body)

## Auth Flow

1. `AuthProvider` lee token de localStorage al montar → si existe, llama `getMe()` y setea el user
2. Login/Register → guarda token real (JWT) → redirect a `/app`
3. Logout → limpia token → redirect a `/login`
4. Cualquier 401 en API → limpia auth + redirect `/login` (cubre toda página bajo `/app`, no hace falta un guard por página)

## Estilos y Design Tokens

Tailwind v4 (config vía `@theme`/`@config` en `src/styles/global.css`, no solo `tailwind.config.mjs`) + componentes de shadcn/ui (`@/components/ui/*`, base **Base UI**, no Radix).

- **Tokens semánticos de shadcn** (se adaptan solos a dark mode): `bg-background`, `text-foreground`, `bg-card`/`text-card-foreground`, `bg-primary`/`text-primary-foreground`, `bg-muted`/`text-muted-foreground`, `bg-destructive`/`text-destructive`, `border-border`, `border-input`, `bg-accent`/`text-accent-foreground`.
- **Paleta de marca heredada** (`primary-{50..950}`, `accent-{50..950}`, `success-{50..950}`, `danger-{50..950}`, `surface-{50..950}` en `tailwind.config.mjs`, cargada vía `@config`): se mantiene para semántica de datos (verde=ingreso, rojo=gasto, etc.) en páginas ya existentes — no se ha sustituido por tokens de shadcn.
- Componentes reutilizables en `@/components/ui/`: `Button`, `Card`, `Input`, `Label`, `Badge`, `Select`, `Table`, `Tabs`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Avatar`, `Separator`, `Tooltip`, `Popover`, `Checkbox`, `Switch`, `Textarea`, `Sonner` (toasts). Base UI usa la prop `render` para polimorfismo (no `asChild` de Radix); para un link con pinta de botón, usar `buttonVariants({...})` sobre una `<a>` en vez de envolver `<Button>`.
- Clases de componente heredadas en `global.css` (`.card`, `.btn-primary/secondary/danger/ghost`, `.input`, `.badge`, `.skeleton`) siguen existiendo para las páginas de la app ya construidas — están redefinidas sobre los tokens de shadcn, no reescribir cada página para usar los componentes de `ui/` salvo que se toque esa página de todos modos.
- **Fuentes**: `font-sans` (Fira Sans, texto general), `Geist Variable` (marca/shadcn), `font-mono` (Fira Code)
- **Dark mode**: estrategia `class`, toggle con localStorage `theme`

## Layout

- `src/layouts/Layout.astro` — la app (`/app/*`): sidebar fijo desktop / bottom nav mobile, iconos `lucide-react`, enlaces siempre bajo `/app/...`.
- `src/layouts/MarketingLayout.astro` — páginas públicas: header con nav a Características/Precios + CTA a `/login`, footer simple.

## Reglas Críticas

- **No usar default exports** excepto en componentes de página (el export default envuelve con Providers)
- **React Query para todo data fetching** — nunca `useEffect` + `fetch`
- **Invalidar queries** después de mutaciones exitosas: `queryClient.invalidateQueries()`
- **Loading/Error states** obligatorios en toda vista que cargue datos
- **Mensajes en español** — todo texto visible al usuario
- **Responsive**: mobile-first con breakpoints de Tailwind (`sm:`, `md:`, `lg:`)
- **Iconos**: usar `lucide-react` — importar componentes individuales (`import { Upload } from 'lucide-react'`)
- **Enlaces internos de la app**: siempre `/app/...`, nunca la ruta pelada (`/profiles` ya no existe, es `/app/profiles`)
