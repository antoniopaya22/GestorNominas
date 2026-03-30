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
        <div className="skeleton h-8 w-32" />
        <div className="card p-6">
          <div className="skeleton h-10 w-full mb-4" />
          <div className="skeleton h-10 w-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-surface-900">Perfiles</h2>
        <p className="text-sm text-surface-500 mt-0.5">
          Gestiona los perfiles de empleados para organizar las nóminas
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-surface-500" />
          <h3 className="font-semibold text-surface-900 text-sm">
            {editingId ? "Editar perfil" : "Nuevo perfil"}
          </h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Antonio, Mi pareja..."
              className="input"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg border-2 transition-all duration-150 cursor-pointer flex items-center justify-center ${
                    color === c
                      ? "border-surface-900 scale-110 shadow-sm"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm whitespace-nowrap">
              {editingId ? "Guardar" : "Crear perfil"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="btn-secondary text-sm">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

      {/* List */}
      <div className="space-y-3">
        {profiles.map((p) => (
          <div
            key={p.id}
            className="card p-4 flex items-center justify-between group hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm"
                style={{ backgroundColor: p.color }}
              >
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-surface-900 text-sm">{p.name}</div>
                <div className="text-[11px] text-surface-400 mt-0.5">
                  Creado: {new Date(p.createdAt).toLocaleDateString("es-ES", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEdit(p)}
                className="btn-ghost text-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar el perfil "${p.name}" y todas sus nóminas?`))
                    deleteMut.mutate(p.id);
                }}
                className="btn-ghost text-xs text-danger-600 hover:bg-danger-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && (
          <div className="card text-center py-14">
            <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-surface-300" />
            </div>
            <h3 className="font-semibold text-surface-900 text-sm mb-1">Sin perfiles</h3>
            <p className="text-xs text-surface-500">Crea tu primer perfil con el formulario de arriba.</p>
          </div>
        )}
      </div>
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
