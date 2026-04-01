---
name: 'React Components'
description: 'Patrones y convenciones para componentes React en el frontend'
applyTo: 'frontend/src/components/**'
---

# Patrones React — Frontend

## Estructura de Componente de Página

Cada componente de página tiene dos partes:

### 1. Inner View (named function)
Contiene toda la lógica, data fetching y UI:
```tsx
function NombreView() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['key'], queryFn: apiFn });

  const mutation = useMutation({
    mutationFn: apiMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key'] });
      toast.success('Operación exitosa');
    },
    onError: () => toast.error('Error en la operación'),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message="Error al cargar datos" />;

  return (/* JSX */);
}
```

### 2. Default Export (wrapper con Providers)
```tsx
export default function NombrePage() {
  return (
    <Providers>
      <NombreView />
    </Providers>
  );
}
```

## Data Fetching

- **Siempre** usar React Query (`useQuery` / `useMutation`)
- **Nunca** hacer `fetch()` directo en componentes
- **Nunca** usar `useEffect` + `useState` para data fetching
- Importar funciones API desde `../lib/api`
- `queryKey` debe ser un array descriptivo: `['payslips', { profileId, year }]`
- Después de mutaciones exitosas: `queryClient.invalidateQueries()`

## Estados Obligatorios

Toda vista que carga datos DEBE manejar estos 3 estados:

1. **Loading**: skeleton o spinner (usar clase `.skeleton`)
2. **Error**: mensaje claro en español con opción de reintentar si aplica
3. **Empty**: mensaje cuando no hay datos ("No hay nóminas subidas")

## Toast Notifications

```tsx
const toast = useToast();
// Éxito
toast.success('Nómina subida correctamente');
// Error
toast.error('Error al procesar la nómina');
// Info
toast.info('Procesando archivos...');
```

## Estilado

- Tailwind utility-first: no crear CSS custom para layouts simples
- Usar clases de componente cuando existan: `.card`, `.btn-primary`, `.input`, `.badge`
- Responsive: mobile-first (`sm:`, `md:`, `lg:`)
- Espaciado consistente: `space-y-4`, `space-y-6`, `gap-4`, `gap-6`
- Dark mode: usar clases `dark:` para colores que cambien en modo oscuro

## Iconos

Importar individualmente desde `lucide-react`:
```tsx
import { Upload, Trash2, Edit, Plus, Search, Filter } from 'lucide-react';
// Uso: <Upload className="h-5 w-5" />
```

## Auth

Acceder al estado de autenticación:
```tsx
const { user, logout } = useAuth();
```

No implementar guardias de ruta en componentes — la protección es a nivel API (401 → redirect automático).
