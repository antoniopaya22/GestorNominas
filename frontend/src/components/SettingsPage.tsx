import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { User, Lock, Moon, Sun, LogOut } from "lucide-react";
import { Providers } from "./Providers";
import { useAuth } from "./AuthProvider";
import { toast } from "sonner";
import { changePassword, updateUserProfile } from "../lib/api";

function SettingsView() {
  const { user, logout } = useAuth();

  // Profile form
  const [name, setName] = useState(user?.name ?? "");
  const updateProfileMut = useMutation({
    mutationFn: () => updateUserProfile({ name }),
    onSuccess: () => toast.success("Perfil actualizado correctamente"),
    onError: () => toast.error("Error al actualizar el perfil"),
  });

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePasswordMut = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al cambiar contraseña"),
  });

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });
  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    changePasswordMut.mutate();
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Ajustes</h1>
        <p className="text-sm text-surface-500 mt-1">Configura tu cuenta y preferencias</p>
      </div>

      {/* Profile Section */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-surface-900">Perfil</h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); updateProfileMut.mutate(); }} className="space-y-4">
          <div>
            <label htmlFor="settings-email" className="block text-sm font-medium text-surface-700 mb-1">Email</label>
            <input
              id="settings-email"
              type="email"
              value={user?.email ?? ""}
              disabled
              className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-500"
            />
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-sm font-medium text-surface-700 mb-1">Nombre</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={updateProfileMut.isPending}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {updateProfileMut.isPending ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </section>

      {/* Password Section */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-surface-900">Cambiar contraseña</h2>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-pw" className="block text-sm font-medium text-surface-700 mb-1">Contraseña actual</label>
            <input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="new-pw" className="block text-sm font-medium text-surface-700 mb-1">Nueva contraseña</label>
            <input
              id="new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <label htmlFor="confirm-pw" className="block text-sm font-medium text-surface-700 mb-1">Confirmar nueva contraseña</label>
            <input
              id="confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={changePasswordMut.isPending}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
          >
            {changePasswordMut.isPending ? "Cambiando..." : "Cambiar contraseña"}
          </button>
        </form>
      </section>

      {/* Appearance Section */}
      <section className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">Apariencia</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-primary-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
            <div>
              <p className="text-sm font-medium text-surface-900">Modo oscuro</p>
              <p className="text-xs text-surface-500">Cambia entre tema claro y oscuro</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? "bg-primary-600" : "bg-surface-300"}`}
            role="switch"
            aria-checked={darkMode}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </section>

      {/* Logout */}
      <section className="card p-6">
        <button onClick={logout} className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium">
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </section>
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
