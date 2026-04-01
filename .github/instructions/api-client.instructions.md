---
name: 'API Client'
description: 'Patrones para el cliente API centralizado del frontend'
applyTo: 'frontend/src/lib/**'
---

# API Client — Frontend

## Arquitectura

Todo acceso a la API del backend pasa por `frontend/src/lib/api.ts`. Los componentes NUNCA hacen `fetch()` directo.

## Función Base `request()`

```typescript
const BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Error del servidor');
  }

  return res.json();
}
```

## Patrón para Nuevas Funciones API

Agrupar por dominio con named exports:

```typescript
// --- Profiles ---
export interface Profile {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export async function getProfiles(): Promise<Profile[]> {
  return request('/profiles');
}

export async function createProfile(data: { name: string; color?: string }): Promise<Profile> {
  return request('/profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

## Casos Especiales

### Uploads (FormData)
No usar `request()` — usar `fetch()` directo sin `Content-Type` header (el browser lo establece con boundary):

```typescript
export async function uploadPayslips(profileId: number, files: File[]): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('profileId', String(profileId));
  files.forEach((f) => formData.append('payslips', f));

  const token = getAuthToken();
  const res = await fetch(`${BASE}/payslips/upload`, {
    method: 'POST',
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: formData,
  });
  // ... error handling
}
```

### Descargas (Blob)
Para exportar archivos (CSV/JSON), usar `fetch()` directo y crear link de descarga:

```typescript
export async function exportData(params: ExportParams): Promise<void> {
  const res = await fetch(`${BASE}/export?${queryString}`, { headers: authHeaders });
  const blob = await res.blob();
  // ... crear <a> element con URL.createObjectURL(blob) y trigger click
}
```

## Gestión de Auth Token

```typescript
const TOKEN_KEY = 'auth_token';

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('auth_user');
}
```

## Reglas

- Siempre tipar la respuesta con generics: `request<T>(endpoint)`
- Definir interfaces para payloads de request y response junto a las funciones
- Mensajes de error en español
- Todo nuevo endpoint del backend necesita su función correspondiente aquí
