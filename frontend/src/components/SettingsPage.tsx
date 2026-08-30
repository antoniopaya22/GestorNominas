import { useState, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User, Lock, Moon, Sun, Monitor, LogOut, AlertTriangle, Wallet } from "lucide-react";
import { Providers } from "./Providers";
import { TabBar } from "./ui/TabBar";
import { ImportView } from "./ImportPage";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";
import { changePassword, updateUserProfile, resetAllData } from "../lib/api";

type SettingsTab = "finanzas" | "nominas" | "generales";

function getInitialTab(): SettingsTab {
  if (typeof window === "undefined") return "generales";
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return tab === "finanzas" || tab === "nominas" ? tab : "generales";
}

function FinanceSettingsView() {
  return (
    <div className="max-w-2xl">
      <ImportView />
    </div>
  );
}

function PayrollSettingsView() {
  return (
    <div className="card p-8 text-center max-w-2xl">
      <Wallet className="w-8 h-8 text-surface-300 mx-auto mb-3" />
      <p className="text-sm text-surface-500">Próximamente: ajustes específicos de nóminas.</p>
    </div>
  );
}

function GeneralSettingsView() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

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

  // Theme (system / light / dark)
  type Theme = "system" | "light" | "dark";
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof localStorage === "undefined") return "system";
    const stored = localStorage.getItem("theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  const applyTheme = (value: Theme) => {
    const isDark =
      value === "dark" ||
      (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  };

  const setTheme = (value: Theme) => {
    setThemeState(value);
    localStorage.setItem("theme", value);
    applyTheme(value);
  };

  // Keep in sync with OS changes while "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    changePasswordMut.mutate();
  };

  // Reset all data
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const RESET_CONFIRM_WORD = "BORRAR";

  const resetAllMut = useMutation({
    mutationFn: () => resetAllData(resetPassword),
    onSuccess: () => {
      toast.success("Todos los datos se han eliminado");
      setShowResetForm(false);
      setResetPassword("");
      setResetConfirmText("");
      queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Error al restablecer los datos"),
  });

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetConfirmText !== RESET_CONFIRM_WORD) {
      toast.error(`Escribe «${RESET_CONFIRM_WORD}» para confirmar`);
      return;
    }
    resetAllMut.mutate();
  };

  return (
    <div className="space-y-8 max-w-2xl">
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
        <div>
          <p className="text-sm font-medium text-surface-900 mb-1">Tema</p>
          <p className="text-xs text-surface-500 mb-3">
            &laquo;Sistema&raquo; sigue el modo claro/oscuro de tu dispositivo automáticamente
          </p>
          <div className="inline-flex rounded-xl border border-surface-200 p-1 gap-1" role="radiogroup" aria-label="Tema">
            {([
              { value: "system", label: "Sistema", icon: Monitor },
              { value: "light", label: "Claro", icon: Sun },
              { value: "dark", label: "Oscuro", icon: Moon },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  theme === value
                    ? "bg-primary-600 text-white"
                    : "text-surface-600 hover:bg-surface-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="card p-6 space-y-4 border-danger-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-danger-600" />
          <h2 className="text-lg font-semibold text-danger-700">Zona de peligro</h2>
        </div>

        {!showResetForm ? (
          <div>
            <p className="text-sm text-surface-600 mb-3">
              Elimina permanentemente todas tus cuentas, transacciones, categorías, nóminas, perfiles,
              etiquetas y alertas. Tu cuenta de acceso (email y contraseña) no se borra.
            </p>
            <button
              type="button"
              onClick={() => setShowResetForm(true)}
              className="btn-secondary border-danger-300 text-danger-700 hover:bg-danger-50 text-sm"
            >
              Restablecer todos los datos
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetSubmit} className="space-y-4 p-4 rounded-xl bg-danger-50 border border-danger-200">
            <p className="text-sm font-semibold text-danger-800">
              Esta acción no se puede deshacer. Se borrarán todos tus datos.
            </p>
            <div>
              <label htmlFor="reset-password" className="block text-sm font-medium text-surface-700 mb-1">
                Confirma tu contraseña
              </label>
              <input
                id="reset-password"
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm" className="block text-sm font-medium text-surface-700 mb-1">
                Escribe <strong>{RESET_CONFIRM_WORD}</strong> para confirmar
              </label>
              <input
                id="reset-confirm"
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                required
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={resetAllMut.isPending}
                className="bg-danger-600 hover:bg-danger-700 text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {resetAllMut.isPending ? "Borrando..." : "Borrar todo definitivamente"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetForm(false);
                  setResetPassword("");
                  setResetConfirmText("");
                }}
                className="btn-secondary text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
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

function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>(getInitialTab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Ajustes</h1>
        <p className="text-sm text-surface-500 mt-1">Configura tu cuenta y preferencias</p>
      </div>

      <TabBar
        tabs={[
          { key: "finanzas", label: "Finanzas" },
          { key: "nominas", label: "Nóminas" },
          { key: "generales", label: "Generales" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "finanzas" && <FinanceSettingsView />}
      {tab === "nominas" && <PayrollSettingsView />}
      {tab === "generales" && <GeneralSettingsView />}
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
