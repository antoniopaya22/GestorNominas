import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./AuthProvider";
import { Toaster } from "./ui/sonner";
import LoginPage from "./LoginPage";
import { createAppQueryClient } from "../lib/query-client";

// AuthProvider usa useQuery(["me"], getMe) internamente (se comparte con
// cualquier página que use Providers) — aunque esta pantalla no necesite
// React Query para nada más, sin un QueryClientProvider por encima ese
// useQuery lanza en cuanto se renderiza.
const queryClient = createAppQueryClient();

export default function LoginWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LoginPage />
        <Toaster position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
