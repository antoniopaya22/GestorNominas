import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import { Toaster } from "./ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

// Listas de catálogo que casi nunca cambian y ya se invalidan explícitamente
// tras cada mutación (crear/editar/borrar) — no hace falta refetchearlas por
// cada navegación dentro del staleTime global de 30s.
for (const key of ["profiles", "categories", "accounts"]) {
  queryClient.setQueryDefaults([key], { staleTime: 5 * 60_000 });
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
