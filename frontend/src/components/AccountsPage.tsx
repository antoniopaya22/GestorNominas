import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wallet, Plus, Edit3, Trash2, Check, CreditCard,
  Landmark, Banknote, TrendingUp, Archive, ArchiveRestore,
} from "lucide-react";
import {
  getAccounts, createAccount, updateAccount, deleteAccount, toggleAccountArchive,
  type Account,
} from "../lib/api";
import { Providers } from "./Providers";
import { useToast } from "./Toast";
import { formatCurrency } from "../lib/format";
import { EmptyState } from "./ui/EmptyState";
import { ConfirmModal } from "./ui/ConfirmModal";

const ACCOUNT_TYPES = [
  { value: "bank", label: "Banco", icon: Landmark },
  { value: "credit_card", label: "Tarjeta", icon: CreditCard },
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "investment", label: "Inversión", icon: TrendingUp },
  { value: "other", label: "Otro", icon: Wallet },
] as const;

const COLORS = [
  "#1e40af", "#3b82f6", "#6366f1", "#8b5cf6",
  "#ec4899", "#ef4444", "#f59e0b", "#10b981",
  "#14b8a6", "#06b6d4",
];

function typeLabel(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function TypeIcon({ type }: { type: string }) {
  const entry = ACCOUNT_TYPES.find((t) => t.value === type);
  const Icon = entry?.icon ?? Wallet;
  return <Icon className="w-5 h-5" />;
}

function AccountsView() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("bank");
  const [color, setColor] = useState(COLORS[0]);
  const [initialBalance, setInitialBalance] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null);

  const createMut = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Cuenta creada correctamente");
      resetForm();
    },
    onError: () => toast.error("Error al crear la cuenta"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateAccount>[1] }) =>
      updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Cuenta actualizada");
      resetForm();
    },
    onError: () => toast.error("Error al actualizar la cuenta"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Cuenta eliminada");
    },
    onError: () => toast.error("Error al eliminar la cuenta"),
  });

  const archiveMut = useMutation({
    mutationFn: toggleAccountArchive,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(result.archived ? "Cuenta archivada" : "Cuenta restaurada");
    },
    onError: () => toast.error("Error al cambiar estado de archivo"),
  });

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setType("bank");
    setColor(COLORS[0]);
    setInitialBalance("");
  };

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setName(a.name);
    setType(a.type);
    setColor(a.color);
    setInitialBalance(String(a.initialBalance));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const data = {
      name,
      type,
      color,
      initialBalance: initialBalance ? parseFloat(initialBalance) : 0,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, data });
    } else {
      createMut.mutate(data);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const filteredAccounts = showArchived ? accounts : accounts.filter((a) => !a.archived);
  const archivedCount = accounts.filter((a) => a.archived).length;

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6 animate-fade-in">
        <div className="card p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <div className="skeleton h-4 w-32 mb-1" />
            <div className="skeleton h-9 w-48 mb-3" />
            <div className="flex gap-2.5">
              <div className="skeleton h-7 w-24 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="card p-5"><div className="skeleton h-10 w-full mb-4" /><div className="skeleton h-10 w-40" /></div>
        <div className="skeleton h-20 w-full rounded-xl" />
        <div className="skeleton h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      {/* Hero */}
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-surface-400 text-xs uppercase tracking-wider mb-0.5">Balance total</p>
          <p className={`text-3xl font-bold font-mono tracking-tight ${totalBalance >= 0 ? "text-primary-700" : "text-danger-600"}`}>
            {formatCurrency(totalBalance)}
          </p>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <div className="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
              <Wallet className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span className="text-xs font-bold text-primary-800 font-mono">{accounts.length}</span>
              <span className="text-xs font-medium text-primary-700">cuentas</span>
            </div>
            {archivedCount > 0 && (
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${showArchived ? "bg-amber-100 text-amber-800" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? "Ocultar archivadas" : `${archivedCount} archivadas`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-surface-500" />
          <h3 className="font-semibold text-surface-900 text-sm">
            {editingId ? "Editar cuenta" : "Nueva cuenta"}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="account-name" className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
              Nombre
            </label>
            <input
              id="account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banco Santander"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="account-type" className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
              Tipo
            </label>
            <select id="account-type" value={type} onChange={(e) => setType(e.target.value)} className="input">
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account-initial-balance" className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
              Saldo inicial
            </label>
            <input
              id="account-initial-balance"
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="input font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Color</label>
            <div className="flex gap-1.5 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={color === c}
                  className={`w-7 h-7 rounded-lg border-2 transition-all duration-150 cursor-pointer flex items-center justify-center ${
                    color === c ? "border-surface-900 scale-110 shadow-sm" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm">
            {editingId ? "Guardar" : "Crear cuenta"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancelar</button>
          )}
        </div>
      </form>

      {/* List */}
      {filteredAccounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuentas"
          description="Crea tu primera cuenta o importa datos desde YNAB para empezar."
          actionLabel="Importar YNAB"
          actionHref="/settings?tab=finanzas"
        />
      ) : (
        <div className="space-y-3">
          {filteredAccounts.map((a) => (
            <div
              key={a.id}
              className={`card p-4 flex items-center justify-between transition-shadow hover:shadow-card-hover ${a.archived ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: a.color }}
                >
                  <TypeIcon type={a.type} />
                </div>
                <div>
                  <p className="font-semibold text-surface-900">
                    {a.name}
                    {a.archived && <span className="ml-2 text-xs text-amber-600 font-normal">(archivada)</span>}
                  </p>
                  <p className="text-xs text-surface-500">{typeLabel(a.type)} · {a.currency}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={`font-bold text-base font-mono tabular-nums ${a.balance >= 0 ? "text-success-600" : "text-danger-600"}`}>
                  {formatCurrency(a.balance)}
                </p>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(a)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={`Editar ${a.name}`}>
                    <Edit3 className="w-3.5 h-3.5 text-surface-400" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => archiveMut.mutate(a.id)}
                    className="p-1.5 rounded-lg hover:bg-amber-50"
                    aria-label={a.archived ? `Restaurar ${a.name}` : `Archivar ${a.name}`}
                  >
                    {a.archived
                      ? <ArchiveRestore className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                      : <Archive className="w-3.5 h-3.5 text-surface-400" aria-hidden="true" />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(a)}
                    className="p-1.5 rounded-lg hover:bg-danger-50"
                    aria-label={`Eliminar ${a.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-danger-400" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Eliminar cuenta"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name ?? ""}"? Todas las transacciones asociadas se perderán.`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (deleteTarget) { deleteMut.mutate(deleteTarget.id); setDeleteTarget(null); } }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Providers>
      <AccountsView />
    </Providers>
  );
}
