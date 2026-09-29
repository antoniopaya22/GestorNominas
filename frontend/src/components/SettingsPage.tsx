import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { User, Moon, Sun, Monitor, LogOut } from "lucide-react";
import { Providers } from "./Providers";
import { useAuth } from "./AuthProvider";
import { toast } from "sonner";
import { updateUserProfile } from "../lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/app/Segmented";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";

function SettingsView() {
  const { user, logout } = useAuth();

  // Profile form
  const [name, setName] = useState(user?.name ?? "");
  const updateProfileMut = useMutation({
    mutationFn: () => updateUserProfile({ name }),
    onSuccess: () => toast.success("Perfil actualizado correctamente"),
    onError: () => toast.error("Error al actualizar el perfil"),
  });

  const { preference, resolved, setPreference } = useTheme();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ajustes</h1>
        <p className="text-sm text-muted-foreground mt-1">Configura tu cuenta y preferencias</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <User className="w-5 h-5 text-primary-600" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); updateProfileMut.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" type="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-name">Nombre</Label>
              <Input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={updateProfileMut.isPending}>
              {updateProfileMut.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Apariencia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {resolved === "dark" ? <Moon className="w-5 h-5 text-primary-600 dark:text-primary" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-sm font-medium text-foreground">Tema</p>
                <p className="text-xs text-muted-foreground">Claro, oscuro o el mismo que tu sistema</p>
              </div>
            </div>
            <Segmented<ThemePreference>
              aria-label="Tema"
              value={preference}
              onChange={setPreference}
              options={[
                { value: "light", label: "Claro", icon: Sun },
                { value: "dark", label: "Oscuro", icon: Moon },
                { value: "system", label: "Sistema", icon: Monitor },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent>
          <Button variant="destructive" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Providers>
      <SettingsView />
    </Providers>
  );
}
