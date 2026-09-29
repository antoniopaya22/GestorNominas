import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { Providers } from "./Providers";
import { toast } from "sonner";
import { ConfirmModal } from "./ui/ConfirmModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categorías</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los grupos y categorías de transacciones</p>
        </div>
        <Button onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupName(""); }} className="gap-2">
          <FolderPlus className="w-4 h-4" /> Nuevo grupo
        </Button>
      </div>

      {/* New / Edit Group Form */}
      {(showGroupForm || editingGroup) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            editingGroup ? updateGroupMut.mutate() : createGroupMut.mutate();
          }}
        >
          <Card className="p-4 flex-row items-center gap-3">
            <Input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nombre del grupo"
              required
              autoFocus
              className="flex-1"
            />
            <Button type="submit" size="sm">
              {editingGroup ? "Guardar" : "Crear"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowGroupForm(false); setEditingGroup(null); setGroupName(""); }}
            >
              Cancelar
            </Button>
          </Card>
        </form>
      )}

      {/* Groups List */}
      {groups.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay grupos de categorías. Crea uno para empezar.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expanded.has(group.id);
            return (
              <Card key={group.id} className="p-0 overflow-hidden">
                {/* Group Header */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted cursor-pointer" onClick={() => toggleExpand(group.id)}>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-medium text-foreground flex-1">{group.name}</span>
                  <span className="text-xs text-muted-foreground">{group.categories.length} categorías</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setEditingGroup(group); setGroupName(group.name); setShowGroupForm(false); }}
                      title="Editar grupo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirm({ type: "group", id: group.id, name: group.name })}
                      title="Eliminar grupo"
                      className="hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { setAddingToGroupId(group.id); setCatName(""); setExpanded((p) => new Set(p).add(group.id)); }}
                      title="Añadir categoría"
                      className="hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-500/10 dark:hover:text-primary-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Categories */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Add category form */}
                    {addingToGroupId === group.id && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); createCatMut.mutate(); }}
                        className="flex items-center gap-3 px-4 py-2 bg-muted"
                      >
                        <Input
                          type="text"
                          value={catName}
                          onChange={(e) => setCatName(e.target.value)}
                          placeholder="Nombre de categoría"
                          required
                          autoFocus
                          className="flex-1"
                        />
                        <Button type="submit" size="sm">Crear</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAddingToGroupId(null)}>Cancelar</Button>
                      </form>
                    )}

                    {group.categories.length === 0 && addingToGroupId !== group.id ? (
                      <p className="px-4 py-3 text-sm text-muted-foreground italic">Sin categorías</p>
                    ) : (
                      group.categories.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-3 px-4 py-2 pl-10 hover:bg-muted">
                          {editingCat?.id === cat.id ? (
                            <form
                              onSubmit={(e) => { e.preventDefault(); updateCatMut.mutate(); }}
                              className="flex items-center gap-3 flex-1"
                            >
                              <Input
                                type="text"
                                value={catName}
                                onChange={(e) => setCatName(e.target.value)}
                                required
                                autoFocus
                                className="flex-1"
                              />
                              <Button type="submit" size="sm">Guardar</Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCat(null)}>Cancelar</Button>
                            </form>
                          ) : (
                            <>
                              <span className="text-sm text-foreground flex-1">{cat.name}</span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => { setEditingCat({ id: cat.id, groupId: cat.groupId, name: cat.name }); setCatName(cat.name); }}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setConfirm({ type: "category", id: cat.id, name: cat.name })}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
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
