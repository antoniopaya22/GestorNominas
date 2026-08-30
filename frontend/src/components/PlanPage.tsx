import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Pencil,
  Trash2,
  Plus,
  FolderPlus,
  ArrowLeftRight,
  Wallet,
  Search,
  Target,
  Undo2,
  Redo2,
  History,
  X,
} from "lucide-react";
import { Providers } from "./Providers";
import { useToast } from "./Toast";
import { ConfirmModal } from "./ui/ConfirmModal";
import { formatCurrency, formatMonthLabel } from "../lib/format";
import { evalAssignedExpression } from "../lib/calculator";
import {
  getPlan,
  assignToCategory,
  moveMoney,
  setTarget,
  undoPlan,
  redoPlan,
  getRecentMoves,
  getTransactions,
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
  createCategory,
  updateCategory,
  deleteCategory,
  type PlanGroup,
  type PlanCategory,
} from "../lib/api";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

const READY_TO_ASSIGN = "rta";

type StatusFilter = "all" | "underfunded" | "overfunded" | "overspent";

function availableClasses(amount: number): string {
  if (amount < 0) return "text-danger-600 bg-danger-50";
  if (amount === 0) return "text-surface-500 bg-surface-100";
  return "text-success-700 bg-success-50";
}

function categoryBadge(cat: PlanCategory): { label: string; classes: string } | null {
  if (cat.available < 0) return { label: "Sobregastado", classes: "bg-danger-50 text-danger-700" };
  if (cat.fullySpent) return { label: "Gastado", classes: "bg-surface-100 text-surface-500" };
  if (cat.status === "funded") return { label: "Cubierto", classes: "bg-success-50 text-success-700" };
  if (cat.status === "overfunded") return { label: "Sobrecubierto", classes: "bg-primary-50 text-primary-700" };
  if (cat.status === "underfunded") return { label: "Sin cubrir", classes: "bg-accent-50 text-accent-700" };
  return null;
}

function matchesStatusFilter(cat: PlanCategory, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "overspent") return cat.available < 0;
  return cat.status === filter;
}

function PlanView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const { data: plan, isLoading } = useQuery({ queryKey: ["plan", month], queryFn: () => getPlan(month) });

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (plan) setExpanded((prev) => (prev.size === 0 ? new Set(plan.groups.map((g) => g.id)) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.groups.map((g) => g.id).join(",")]);
  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const isExpanded = (id: number) => expanded.has(id);

  // ── Search & status filter ──────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const hasActiveFilter = search.trim() !== "" || statusFilter !== "all";

  const filteredGroups = useMemo(() => {
    if (!plan) return [];
    if (!hasActiveFilter) return plan.groups;
    const query = search.trim().toLowerCase();
    return plan.groups
      .map((g) => ({
        ...g,
        categories: g.categories.filter(
          (c) => (query === "" || c.name.toLowerCase().includes(query)) && matchesStatusFilter(c, statusFilter),
        ),
      }))
      .filter((g) => g.categories.length > 0);
  }, [plan, search, statusFilter, hasActiveFilter]);

  // ── Assigned inline edit (supports +50 / -20 / *2 / /2 calculator syntax) ──
  const [editingAssigned, setEditingAssigned] = useState<{ categoryId: number; value: string } | null>(null);

  const assignMut = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: number; amount: number }) =>
      assignToCategory(categoryId, month, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", month] });
      queryClient.invalidateQueries({ queryKey: ["plan-recent-moves"] });
    },
    onError: () => toast.error("Error al asignar dinero"),
  });

  const commitAssigned = (current: number) => {
    if (!editingAssigned) return;
    const amount = evalAssignedExpression(current, editingAssigned.value);
    setEditingAssigned(null);
    if (amount == null) {
      if (editingAssigned.value.trim() !== "") toast.error("Expresión inválida");
      return;
    }
    assignMut.mutate({ categoryId: editingAssigned.categoryId, amount });
  };

  // ── Move money ─────────────────────────────────────────────────
  const [moveModal, setMoveModal] = useState<{ from: string; to: string; amount: string } | null>(null);

  const moveMut = useMutation({
    mutationFn: (data: { fromCategoryId: number | null; toCategoryId: number | null; amount: number }) =>
      moveMoney(month, data.fromCategoryId, data.toCategoryId, data.amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", month] });
      queryClient.invalidateQueries({ queryKey: ["plan-recent-moves"] });
      toast.success("Dinero movido");
      setMoveModal(null);
    },
    onError: () => toast.error("Error al mover dinero"),
  });

  const submitMove = () => {
    if (!moveModal) return;
    const amount = Number(moveModal.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Importe inválido");
      return;
    }
    if (moveModal.from === moveModal.to) {
      toast.error("Origen y destino deben ser distintos");
      return;
    }
    moveMut.mutate({
      fromCategoryId: moveModal.from === READY_TO_ASSIGN ? null : Number(moveModal.from),
      toCategoryId: moveModal.to === READY_TO_ASSIGN ? null : Number(moveModal.to),
      amount,
    });
  };

  const allCategories = useMemo(
    () => (plan?.groups ?? []).flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name }))),
    [plan],
  );

  // ── Target (goal) popover ────────────────────────────────────────
  const [targetPopover, setTargetPopover] = useState<{ categoryId: number; value: string } | null>(null);

  const targetMut = useMutation({
    mutationFn: ({ categoryId, amount }: { categoryId: number; amount: number | null }) => setTarget(categoryId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan", month] });
      setTargetPopover(null);
    },
    onError: () => toast.error("Error al guardar el objetivo"),
  });

  // ── Activity popover (transactions for category/month) ──────────
  const [activityPopover, setActivityPopover] = useState<{ categoryId: number; name: string } | null>(null);
  const { from: monthFrom, to: monthTo } = monthRange(month);
  const { data: activityTx, isLoading: activityLoading } = useQuery({
    queryKey: ["plan-activity", activityPopover?.categoryId, month],
    queryFn: () => getTransactions({ categoryId: activityPopover!.categoryId, from: monthFrom, to: monthTo, limit: 100 }),
    enabled: !!activityPopover,
  });

  // ── Available breakdown popover ──────────────────────────────────
  const [availablePopover, setAvailablePopover] = useState<{ categoryId: number; to: string; amount: string } | null>(null);

  const submitAvailableMove = () => {
    if (!availablePopover) return;
    const amount = Number(availablePopover.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Importe inválido");
      return;
    }
    moveMut.mutate({
      fromCategoryId: availablePopover.categoryId,
      toCategoryId: availablePopover.to === READY_TO_ASSIGN ? null : Number(availablePopover.to),
      amount,
    });
    setAvailablePopover(null);
  };

  // ── Undo / Redo / Recent moves ────────────────────────────────────
  const undoMut = useMutation({
    mutationFn: () => undoPlan(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["plan-recent-moves"] });
      toast.success("Deshecho");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const redoMut = useMutation({
    mutationFn: () => redoPlan(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plan"] });
      queryClient.invalidateQueries({ queryKey: ["plan-recent-moves"] });
      toast.success("Rehecho");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [recentMovesOpen, setRecentMovesOpen] = useState(false);
  const { data: recentMoves } = useQuery({
    queryKey: ["plan-recent-moves"],
    queryFn: () => getRecentMoves(20),
    enabled: recentMovesOpen,
  });

  // ── Group / category CRUD (same behaviour as the old Categories page) ──
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PlanGroup | null>(null);
  const [groupName, setGroupName] = useState("");

  const [addingToGroupId, setAddingToGroupId] = useState<number | null>(null);
  const [editingCat, setEditingCat] = useState<PlanCategory | null>(null);
  const [catName, setCatName] = useState("");

  const [confirm, setConfirm] = useState<{ type: "group" | "category"; id: number; name: string } | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["plan"] });
  };

  const createGroupMut = useMutation({
    mutationFn: () => createCategoryGroup({ name: groupName }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Grupo creado");
      setShowGroupForm(false);
      setGroupName("");
    },
    onError: () => toast.error("Error al crear grupo"),
  });

  const updateGroupMut = useMutation({
    mutationFn: () => updateCategoryGroup(editingGroup!.id, { name: groupName }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Grupo actualizado");
      setEditingGroup(null);
      setGroupName("");
    },
    onError: () => toast.error("Error al actualizar grupo"),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: number) => deleteCategoryGroup(id),
    onSuccess: () => {
      invalidateAll();
      toast.success("Grupo eliminado");
    },
    onError: () => toast.error("Error al eliminar grupo (puede tener categorías con transacciones)"),
  });

  const createCatMut = useMutation({
    mutationFn: () => createCategory({ groupId: addingToGroupId!, name: catName }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Categoría creada");
      setAddingToGroupId(null);
      setCatName("");
    },
    onError: () => toast.error("Error al crear categoría"),
  });

  const updateCatMut = useMutation({
    mutationFn: () => updateCategory(editingCat!.id, { name: catName }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Categoría actualizada");
      setEditingCat(null);
      setCatName("");
    },
    onError: () => toast.error("Error al actualizar categoría"),
  });

  const deleteCatMut = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      invalidateAll();
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

  if (isLoading || !plan) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-surface-100 rounded-xl animate-pulse w-48" />
        <div className="h-24 bg-surface-100 rounded-xl animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const rta = plan.readyToAssign;
  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "underfunded", label: "Sin cubrir" },
    { key: "overfunded", label: "Sobrecubiertas" },
    { key: "overspent", label: "Sobregastadas" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Plan</h1>
          <p className="text-sm text-surface-500 mt-1">Asigna tu dinero a cada categoría, mes a mes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-500"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-surface-900 w-24 text-center capitalize">
            {formatMonthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-500"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {month !== currentMonth() && (
            <button onClick={() => setMonth(currentMonth())} className="btn-secondary text-xs px-3 py-1.5">
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Ready to assign card */}
      <div className={`card p-5 flex items-center justify-between ${rta < 0 ? "ring-1 ring-danger-200" : ""}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${rta >= 0 ? "bg-success-50" : "bg-danger-50"}`}>
            <Wallet className={`w-5 h-5 ${rta >= 0 ? "text-success-600" : "text-danger-600"}`} />
          </div>
          <div>
            <p className="text-xs text-surface-500">Listo para asignar</p>
            <p className={`text-2xl font-bold ${rta > 0 ? "text-success-600" : rta < 0 ? "text-danger-600" : "text-surface-700"}`}>
              {formatCurrency(rta)}
            </p>
          </div>
        </div>
        <button
          onClick={() => setMoveModal({ from: READY_TO_ASSIGN, to: allCategories[0] ? String(allCategories[0].id) : READY_TO_ASSIGN, amount: "" })}
          className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
        >
          <ArrowLeftRight className="w-4 h-4" /> Mover dinero
        </button>
      </div>

      {/* Toolbar: search, filters, undo/redo, recent moves */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar categorías..."
            className="w-full rounded-xl border border-surface-200 bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                statusFilter === f.key ? "bg-primary-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => undoMut.mutate()}
            disabled={undoMut.isPending}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-500 disabled:opacity-40"
            title="Deshacer"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => redoMut.mutate()}
            disabled={redoMut.isPending}
            className="p-2 rounded-xl hover:bg-surface-100 text-surface-500 disabled:opacity-40"
            title="Rehacer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setRecentMovesOpen((v) => !v)}
              className="p-2 rounded-xl hover:bg-surface-100 text-surface-500 flex items-center gap-1.5 text-xs font-medium"
              title="Movimientos recientes"
            >
              <History className="w-4 h-4" /> Recientes
            </button>
            {recentMovesOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRecentMovesOpen(false)} />
                <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-auto card p-2 z-50 shadow-xl">
                  <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide px-2 py-1">Movimientos recientes</p>
                  {!recentMoves || recentMoves.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-surface-400 italic">Sin movimientos</p>
                  ) : (
                    recentMoves.map((m) => (
                      <div key={m.id} className="px-2 py-2 text-xs border-b border-surface-100 last:border-b-0">
                        {m.type === "assign" ? (
                          <p className="text-surface-700">
                            <span className="font-medium">{m.categoryName ?? "?"}</span>: {formatCurrency(m.previousAssigned)} → {formatCurrency(m.newAssigned)}
                          </p>
                        ) : (
                          <p className="text-surface-700">
                            {formatCurrency(m.amount)} de <span className="font-medium">{m.fromCategoryName ?? "Listo para asignar"}</span> a{" "}
                            <span className="font-medium">{m.toCategoryName ?? "Listo para asignar"}</span>
                          </p>
                        )}
                        <p className="text-surface-400">{m.month} · {new Date(m.createdAt).toLocaleString("es-ES")}</p>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          onClick={() => { setShowGroupForm(true); setEditingGroup(null); setGroupName(""); }}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
        >
          <FolderPlus className="w-4 h-4" /> Nuevo grupo
        </button>
      </div>

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

      {/* Plan table */}
      {filteredGroups.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-surface-500">
            {hasActiveFilter ? "Ninguna categoría coincide con el filtro." : "No hay grupos de categorías. Crea uno para empezar."}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px_130px_88px] gap-2 px-4 py-2 border-b border-surface-100 text-[11px] font-semibold uppercase tracking-wide text-surface-400">
            <span>Categoría</span>
            <span className="text-right">Asignado</span>
            <span className="text-right">Actividad</span>
            <span className="text-right">Disponible</span>
            <span />
          </div>

          {filteredGroups.map((group) => {
            const open = isExpanded(group.id) || hasActiveFilter;
            const totals = group.categories.reduce(
              (acc, c) => ({
                assigned: acc.assigned + c.assigned,
                activity: acc.activity + c.activity,
                available: acc.available + c.available,
              }),
              { assigned: 0, activity: 0, available: 0 },
            );

            return (
              <div key={group.id} className="border-b border-surface-100 last:border-b-0">
                {/* Group header row */}
                <div
                  className="grid grid-cols-[1fr_120px_120px_130px_88px] gap-2 items-center px-4 py-2.5 bg-surface-50 hover:bg-surface-100 cursor-pointer"
                  onClick={() => toggleExpand(group.id)}
                >
                  <span className="flex items-center gap-2 font-medium text-surface-900">
                    {open ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                    {group.name}
                  </span>
                  <span className="text-right text-sm text-surface-600">{formatCurrency(totals.assigned)}</span>
                  <span className="text-right text-sm text-surface-600">{formatCurrency(totals.activity)}</span>
                  <span className="text-right text-sm font-semibold text-surface-700">{formatCurrency(totals.available)}</span>
                  <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => { setAddingToGroupId(group.id); setCatName(""); setExpanded((p) => { const n = new Set(p); n.delete(group.id); return n; }); }}
                      className="p-1.5 rounded-lg hover:bg-primary-50 text-surface-400 hover:text-primary-600"
                      title="Añadir categoría"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </span>
                </div>

                {open && (
                  <div className="border-t border-surface-100 bg-white">
                    {addingToGroupId === group.id && (
                      <form
                        onSubmit={(e) => { e.preventDefault(); createCatMut.mutate(); }}
                        className="flex items-center gap-3 px-4 py-2 pl-10 bg-surface-50"
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
                      <p className="px-4 py-3 pl-10 text-sm text-surface-400 italic">Sin categorías</p>
                    ) : (
                      group.categories.map((cat) => {
                        const badge = categoryBadge(cat);
                        const progressPct = cat.target ? Math.min(Math.max(cat.assigned / cat.target, 0), 1) * 100 : 0;
                        return (
                          <div
                            key={cat.id}
                            className="grid grid-cols-[1fr_120px_120px_130px_88px] gap-2 items-center px-4 py-2 pl-10 hover:bg-surface-50"
                          >
                            {editingCat?.id === cat.id ? (
                              <form
                                onSubmit={(e) => { e.preventDefault(); updateCatMut.mutate(); }}
                                className="col-span-5 flex items-center gap-3"
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
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-surface-700 truncate">{cat.name}</span>
                                    {badge && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${badge.classes}`}>
                                        {badge.label}
                                      </span>
                                    )}
                                  </div>
                                  {cat.target != null && (
                                    <div className="mt-1 h-1.5 w-full max-w-[160px] rounded-full bg-surface-100 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${cat.status === "overfunded" ? "bg-primary-500" : "bg-success-500"}`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  )}
                                </div>

                                {editingAssigned?.categoryId === cat.id ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    autoFocus
                                    value={editingAssigned.value}
                                    onChange={(e) => setEditingAssigned({ categoryId: cat.id, value: e.target.value })}
                                    onBlur={() => commitAssigned(cat.assigned)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitAssigned(cat.assigned);
                                      if (e.key === "Escape") setEditingAssigned(null);
                                    }}
                                    placeholder="ej: +50, *2"
                                    className="text-right rounded-lg border border-primary-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                  />
                                ) : (
                                  <button
                                    onClick={() => setEditingAssigned({ categoryId: cat.id, value: String(cat.assigned) })}
                                    className="text-right text-sm text-surface-700 rounded-lg px-2 py-1 hover:bg-primary-50 hover:text-primary-700"
                                    title="Editar asignación (admite +50, -20, *2, /2)"
                                  >
                                    {formatCurrency(cat.assigned)}
                                  </button>
                                )}

                                <button
                                  onClick={() => setActivityPopover({ categoryId: cat.id, name: cat.name })}
                                  className="text-right text-sm text-surface-500 rounded-lg px-2 py-1 hover:bg-surface-100 hover:text-surface-700"
                                  title="Ver transacciones del mes"
                                >
                                  {formatCurrency(cat.activity)}
                                </button>

                                <button
                                  onClick={() => setAvailablePopover({ categoryId: cat.id, to: READY_TO_ASSIGN, amount: String(cat.available) })}
                                  className={`text-right text-sm font-semibold rounded-lg px-2 py-1 ${availableClasses(cat.available)}`}
                                  title="Ver desglose y mover dinero"
                                >
                                  {formatCurrency(cat.available)}
                                </button>

                                <span className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => setTargetPopover({ categoryId: cat.id, value: cat.target != null ? String(cat.target) : "" })}
                                    className={`p-1 rounded-lg hover:bg-surface-100 ${cat.target != null ? "text-primary-500" : "text-surface-400 hover:text-primary-600"}`}
                                    title="Objetivo mensual"
                                  >
                                    <Target className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => { setEditingCat(cat); setCatName(cat.name); }}
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
                                </span>
                              </>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Target popover */}
      {targetPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setTargetPopover(null)} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const amount = Number(targetPopover.value.replace(",", "."));
              if (!Number.isFinite(amount) || amount <= 0) {
                toast.error("Importe inválido");
                return;
              }
              targetMut.mutate({ categoryId: targetPopover.categoryId, amount });
            }}
            className="relative bg-white rounded-2xl shadow-xl max-w-xs w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-surface-900">Objetivo mensual</h3>
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              value={targetPopover.value}
              onChange={(e) => setTargetPopover({ ...targetPopover, value: e.target.value })}
              placeholder="0,00"
              className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3 justify-between">
              <button
                type="button"
                onClick={() => targetMut.mutate({ categoryId: targetPopover.categoryId, amount: null })}
                className="px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50 rounded-xl"
              >
                Quitar objetivo
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTargetPopover(null)} className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 rounded-xl hover:bg-surface-200">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary text-sm px-4 py-2">Guardar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Activity popover */}
      {activityPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setActivityPopover(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-surface-900">Actividad</h3>
                <p className="text-sm text-surface-500">{activityPopover.name}</p>
              </div>
              <button onClick={() => setActivityPopover(null)} className="text-surface-400 hover:text-surface-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {activityLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-surface-100 rounded-lg animate-pulse" />)}
              </div>
            ) : !activityTx || activityTx.data.length === 0 ? (
              <p className="text-sm text-surface-400 italic">Sin transacciones este mes</p>
            ) : (
              <div className="divide-y divide-surface-100">
                {activityTx.data.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-surface-800 truncate">{tx.payee || "(sin beneficiario)"}</p>
                      <p className="text-xs text-surface-400">{tx.accountName} · {tx.date}{tx.memo ? ` · ${tx.memo}` : ""}</p>
                    </div>
                    <span className={`font-semibold whitespace-nowrap ${tx.type === "income" ? "text-success-600" : "text-surface-700"}`}>
                      {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Available breakdown + move popover */}
      {availablePopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAvailablePopover(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            {(() => {
              const cat = allCategories.find((c) => c.id === availablePopover.categoryId);
              if (!cat) return null;
              return (
                <>
                  <h3 className="text-base font-semibold text-surface-900">Saldo disponible</h3>
                  <div className="text-sm space-y-1.5">
                    <div className="flex justify-between"><span className="text-surface-500">Sobrante mes anterior</span><span>{formatCurrency(cat.carryover)}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Asignado este mes</span><span>{formatCurrency(cat.assigned)}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Actividad</span><span>{formatCurrency(cat.activity)}</span></div>
                    <div className="flex justify-between font-semibold border-t border-surface-100 pt-1.5"><span>Disponible</span><span>{formatCurrency(cat.available)}</span></div>
                  </div>
                  <form
                    onSubmit={(e) => { e.preventDefault(); submitAvailableMove(); }}
                    className="space-y-3 border-t border-surface-100 pt-4"
                  >
                    <p className="text-xs font-medium text-surface-500">Mover a</p>
                    <select
                      value={availablePopover.to}
                      onChange={(e) => setAvailablePopover({ ...availablePopover, to: e.target.value })}
                      className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value={READY_TO_ASSIGN}>Listo para asignar</option>
                      {allCategories.filter((c) => c.id !== availablePopover.categoryId).map((c) => (
                        <option key={c.id} value={c.id}>{c.groupName} · {c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={availablePopover.amount}
                      onChange={(e) => setAvailablePopover({ ...availablePopover, amount: e.target.value })}
                      className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="flex gap-3 justify-end">
                      <button type="button" onClick={() => setAvailablePopover(null)} className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 rounded-xl hover:bg-surface-200">
                        Cerrar
                      </button>
                      <button type="submit" className="btn-primary text-sm px-4 py-2">Mover</button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Move money modal (toolbar / Ready to assign) */}
      {moveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMoveModal(null)} />
          <form
            onSubmit={(e) => { e.preventDefault(); submitMove(); }}
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-surface-900">Mover dinero</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-surface-500">Desde</label>
                <select
                  value={moveModal.from}
                  onChange={(e) => setMoveModal({ ...moveModal, from: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={READY_TO_ASSIGN}>Listo para asignar</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.groupName} · {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500">Hacia</label>
                <select
                  value={moveModal.to}
                  onChange={(e) => setMoveModal({ ...moveModal, to: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={READY_TO_ASSIGN}>Listo para asignar</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.groupName} · {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-surface-500">Importe</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={moveModal.amount}
                  onChange={(e) => setMoveModal({ ...moveModal, amount: e.target.value })}
                  placeholder="0,00"
                  className="mt-1 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setMoveModal(null)} className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 rounded-xl hover:bg-surface-200">
                Cancelar
              </button>
              <button type="submit" className="btn-primary text-sm px-4 py-2">Mover</button>
            </div>
          </form>
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

export default function PlanPage() {
  return (
    <Providers>
      <PlanView />
    </Providers>
  );
}
