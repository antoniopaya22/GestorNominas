import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

export default function LoginPage() {
  const { loginWithGoogle, user, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión (p.ej. al volver del redirect de Google), entra directo.
  useEffect(() => {
    if (!loading && user) window.location.href = "/app";
  }, [loading, user]);

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-mark.svg" alt="" className="size-14 mb-3" />
          <h1 className="text-xl font-bold text-foreground">
            Sueld<span className="text-primary-500 dark:text-primary">IA</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Inicia sesión para continuar</p>
        </div>

        <Card>
          <CardHeader className="sr-only">Iniciar sesión</CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={submitting || loading}
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.48a5.55 5.55 0 0 1-2.4 3.64v3h3.88c2.27-2.09 3.56-5.17 3.56-8.83z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A11.99 11.99 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.6H1.27A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.27 5.4z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.6l4 3.11C6.22 6.86 8.87 4.75 12 4.75z" />
              </svg>
              {submitting ? "Conectando..." : "Continuar con Google"}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Al continuar, se crea tu cuenta automáticamente si es la primera vez.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
