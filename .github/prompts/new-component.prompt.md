---
name: 'new-component'
description: 'Scaffolding de nuevo componente React + página Astro + funciones API'
agent: 'frontend-dev'
tools:
  - run_in_terminal
  - file_search
  - grep_search
  - read_file
  - create_file
  - replace_string_in_file
  - get_errors
---

# /new-component — Scaffolding de Componente React + Página Astro

Crea una nueva página completa en el frontend de GestorNominas siguiendo los patrones exactos del proyecto.

## Input del Usuario

El usuario debe especificar:
- **Nombre de la página** (ej: "Categories", "Reports", "Settings")
- **Funcionalidad** (ej: "CRUD de categorías", "gráficos de reportes")
- **Datos que muestra** (ej: "lista de categorías con nombre y color")

Si el usuario no proporciona suficiente detalle, preguntar lo necesario.

## Proceso de Generación

### 1. Verificar funciones API

Revisar `frontend/src/lib/api.ts` para confirmar que existen las funciones API necesarias.
Si faltan, crearlas siguiendo el patrón existente.

### 2. Crear componente React

Crear `frontend/src/components/NombrePage.tsx`:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { /* funciones API */ } from '../lib/api';
import { Providers } from './Providers';
import { useToast } from './Toast';
import { /* iconos */ } from 'lucide-react';

function NombreView() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Queries
  const { data, isLoading, error } = useQuery({
    queryKey: ['nombre'],
    queryFn: getNombres,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createNombre,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nombre'] });
      toast.success('Elemento creado correctamente');
    },
    onError: () => toast.error('Error al crear elemento'),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-danger-400">Error al cargar los datos</p>
      </div>
    );
  }

  // Empty state
  if (!data?.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-surface-400">No hay elementos todavía</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Título</h1>
      {/* Contenido */}
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

### 3. Crear página Astro

Crear `frontend/src/pages/nombre.astro`:

```astro
---
import Layout from '../layouts/Layout.astro';
import NombrePage from '../components/NombrePage.tsx';
---
<Layout title="Título de Página">
  <NombrePage client:load />
</Layout>
```

### 4. Actualizar navegación (si aplica)

Si la nueva página necesita aparecer en el menú, actualizar la lista de links en `frontend/src/layouts/Layout.astro`.

## Verificación Final

1. Compilar frontend: `npm run build --workspace=frontend`
2. Verificar que la página carga correctamente en dev
