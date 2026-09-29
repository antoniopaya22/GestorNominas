import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Edit3, Trash2, Users, Check,
} from "lucide-react";
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  type Profile,
} from "../lib/api";
import { Providers } from "./Providers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmModal } from "./ui/ConfirmModal";
import { cn } from "cn";

const COLORS = [
  "#1e40af", "#3b82f6", "#6366f1", "#8b5cf6",
  "#ec4899", "#ef4444", "#f59e0b", "#10b981",
  "#14b8a6", "#06b6d4",
];

function ProfilesManager() {
  const queryClient = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [toDelete, setToDelete] = useState<Profile | null>(null);

  const createMut = useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setName("");
      setColor(COLORS[0]);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; color: string } }) =>
      updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setEditingId(null);
      setName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profiles"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      updateMut.mutate({ id: editingId, data: { name, color } });
    } else {
      createMut.mutate({ name, color });
    }
  };

  const startEdit = (p: Profile) => {
    setEditingId(p.id);
    setName(p.name);
    setColor(p.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName("");
    setColor(COLORS[0]);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4 animate-fade-in">
        <Card className="p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-5 w-56" />
          </div>
        </Card>
        <Card className="p-6">
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-10 w-40" />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Perfiles</p>
              <p className="text-base font-semibold text-foreground">Gestiona los perfiles de empleados</p>
            </div>
            {profiles.length > 0 && (
              <Badge variant="secondary" className="bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
                {profiles.length} perfil{profiles.length !== 1 ? "es" : ""}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-5">
        <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-semibold text-foreground text-sm">
            {editingId ? "Editar perfil" : "Nuevo perfil"}
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="profile-name">Nombre</Label>
            <Input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Antonio, Mi pareja..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5" role="group" aria-label="Seleccionar color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={cn(
                    "w-7 h-7 rounded-lg border-2 transition-all duration-150 cursor-pointer flex items-center justify-center",
                    color === c ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="whitespace-nowrap">
              {editingId ? "Guardar" : "Crear perfil"}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={cancelEdit}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
        </form>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {profiles.map((p) => (
          <Card
            key={p.id}
            className="p-4 flex-row items-center justify-between group hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm"
                style={{ backgroundColor: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Creado: {new Date(p.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit(p)}
                aria-label={`Editar perfil ${p.name}`}
                className="gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setToDelete(p)}
                aria-label={`Eliminar perfil ${p.name}`}
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </Button>
            </div>
          </Card>
        ))}
        {profiles.length === 0 && (
          <Card className="text-center py-14">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">Sin perfiles</h3>
            <p className="text-xs text-muted-foreground">Crea tu primer perfil con el formulario de arriba.</p>
          </Card>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar perfil"
        message={`¿Eliminar el perfil "${toDelete?.name ?? ""}" y todas sus nóminas? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (toDelete) deleteMut.mutate(toDelete.id); setToDelete(null); }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

export default function ProfilesPage() {
  return (
    <Providers>
      <ProfilesManager />
    </Providers>
  );
}
