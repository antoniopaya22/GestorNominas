import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { Providers } from "./Providers";
import { toast } from "sonner";
import { ConfirmModal } from "./ui/ConfirmModal";
import {
  getCategories,
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryGroup,
} from "../lib/api";

function CategoriesView() {
  const queryClient = useQueryClient();
  const { data: groups = [], isLoading } = useQuery({ queryKey: ["categories"], queryFn: getCategories });

  // Expanded groups
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // Group form state
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryGroup | null>(null);
  const [groupName, setGroupName] = useState("");

  // Category form state
  const [addingToGroupId, setAddingToGroupId] = useState<number | null>(null);
  const [editingCat, setEditingCat] = useState<{ id: number; groupId: number; name: string } | null>(null);
  const [catName, setCatName] = useState("");

  // Confirm modal
  const [confirm, setConfirm] = useState<{ type: "group" | "category"; id: number; name: string } | null>(null);

  // Mutations
  const createGroupMut = useMutation({
    mutationFn: () => createCategoryGroup({ name: groupName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Grupo creado");
      setShowGroupForm(false);
      setGroupName("");
    },
    onError: () => toast.error("Error al crear grupo"),
  });

  const updateGroupMut = useMutation({
    mutationFn: () => updateCategoryGroup(editingGroup!.id, { name: groupName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Grupo actualizado");
      setEditingGroup(null);
      setGroupName("");
    },
    onError: () => toast.error("Error al actualizar grupo"),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: number) => deleteCategoryGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Grupo eliminado");
    },
    onError: () => toast.error("Error al eliminar grupo (puede tener categorías con transacciones)"),
  });

  const createCatMut = useMutation({
    mutationFn: () => createCategory({ groupId: addingToGroupId!, name: catName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría creada");
      setAddingToGroupId(null);
      setCatName("");
    },
    onError: () => toast.error("Error al crear categoría"),
  });

  const updateCatMut = useMutation({
    mutationFn: () => updateCategory(editingCat!.id, { name: catName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría actualizada");
      setEditingCat(null);
      setCatName("");
    },
    onError: () => toast.error("Error al actualizar categoría"),
  });

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría eliminada");
    },
    onError: () => toast.error("Error al eliminar categoría (puede tener transacciones asignadas)"),
  });

  const handleConfirmDelete = () => {
    if (!confirm) return;
    if (confirm.type === "group") deleteGroupMut.mutate(confirm.id);
    else deleteCatMut.mutate(confirm.id);
    setConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-surface-100 rounded-xl animate-pulse w-48" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Categorías</h1>
          <p className="text-sm text-surface-500 mt-1">Gestiona los grupos y categorías de transacciones</p>
        </div>
        <button
          onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupName(""); }}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
        >
          <FolderPlus className="w-4 h-4" /> Nuevo grupo
        </button>
      </div>

      {/* New / Edit Group Form */}
      {(showGroupForm || editingGroup) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            editingGroup ? updateGroupMut.mutate() : createGroupMut.mutate();
          }}
          className="card p-4 flex items-center gap-3"
        >
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nombre del grupo"
            required
            autoFocus
            className="flex-1 rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button type="submit" className="btn-primary text-sm px-4 py-2">
            {editingGroup ? "Guardar" : "Crear"}
          </button>
          <button
            type="button"
            onClick={() => { setShowGroupForm(false); setEditingGroup(null); setGroupName(""); }}
            className="text-sm text-surface-500 hover:text-surface-700"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-surface-500">No hay grupos de categorías. Crea uno para empezar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expanded.has(group.id);
            return (
              <div key={group.id} className="card overflow-hidden">
                {/* Group Header */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-50 cursor-pointer" onClick={() => toggleExpand(group.id)}>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                  <span className="font-medium text-surface-900 flex-1">{group.name}</span>
                  <span className="text-xs text-surface-400">{group.categories.length} categorías</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingGroup(group); setGroupName(group.name); setShowGroupForm(false); }}
                      className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600"
                      title="Editar grupo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirm({ type: "group", id: group.id, name: group.name })}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600"
                      title="Eliminar grupo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setAddingToGroupId(group.id); setCatName(""); setExpanded((p) => new Set(p).add(group.id)); }}
                      className="p-1.5 rounded-lg hover:bg-primary-50 text-surface-400 hover:text-primary-600"
                      title="Añadir categoría"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Categories */}
                {isExpanded && (
                  <div className="border-t border-surface-100">
                    {/* Add category form */}
                    {addingToGroupId === group.id && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); createCatMut.mutate(); }}
                        className="flex items-center gap-3 px-4 py-2 bg-surface-50"
                      >
                        <input
                          type="text"
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="Nombre de categoría"
                          required
                          autoFocus
                          className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button type="submit" className="btn-primary text-xs px-3 py-1.5">Crear</button>
                        <button type="button" onClick={() => setAddingToGroupId(null)} className="text-xs text-surface-500 hover:text-surface-700">Cancelar</button>
                      </form>
                    )}

                    {group.categories.length === 0 && addingToGroupId !== group.id ? (
                      <p className="px-4 py-3 text-sm text-surface-400 italic">Sin categorías</p>
                    ) : (
                      group.categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-3 px-4 py-2 pl-10 hover:bg-surface-50">
                          {editingCat?.id === cat.id ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); updateCatMut.mutate(); }}
                              className="flex items-center gap-3 flex-1"
                            >
                              <input
                                type="text"
                                value={catName}
                                onChange={(e) => setCatName(e.target.value)}
                                required
                                autoFocus
                                className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <button type="submit" className="btn-primary text-xs px-3 py-1.5">Guardar</button>
                              <button type="button" onClick={() => setEditingCat(null)} className="text-xs text-surface-500 hover:text-surface-700">Cancelar</button>
                            </form>
                          ) : (
                            <>
                              <span className="text-sm text-surface-700 flex-1">{cat.name}</span>
                              <button
                                onClick={() => { setEditingCat({ id: cat.id, groupId: cat.groupId, name: cat.name }); setCatName(cat.name); }}
                                className="p-1 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setConfirm({ type: "category", id: cat.id, name: cat.name })}
                                className="p-1 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        title={`Eliminar ${confirm?.type === "group" ? "grupo" : "categoría"}`}
        message={`¿Estás seguro de eliminar "${confirm?.name ?? ""}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Providers>
      <CategoriesView />
    </Providers>
  );
}
