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
import { toast } from "sonner";
import { formatCurrency } from "../lib/format";
import { EmptyState } from "./ui/EmptyState";
import { ConfirmModal } from "./ui/ConfirmModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";

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
        <Card className="p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-5 sm:px-8 sm:py-6">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-9 w-48 mb-3" />
            <div className="flex gap-2.5">
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
          </div>
        </Card>
        <Card className="p-5"><Skeleton className="h-10 w-full mb-4" /><Skeleton className="h-10 w-40" /></Card>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Balance total</p>
          <p className={cn("text-3xl font-bold font-mono tracking-tight", totalBalance >= 0 ? "text-primary-700 dark:text-primary-400" : "text-danger-600")}>
            {formatCurrency(totalBalance)}
          </p>
          <div className="flex flex-wrap gap-2.5 mt-4">
            <Badge variant="secondary" className="bg-primary-50 text-primary-800 dark:bg-primary-500/10 dark:text-primary-400 gap-1.5">
              <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono">{accounts.length}</span>
              cuentas
            </Badge>
            {archivedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={cn("gap-1.5", showArchived && "bg-accent-100 text-accent-800 dark:bg-accent-500/15 dark:text-accent-300 hover:bg-accent-100")}
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? "Ocultar archivadas" : `${archivedCount} archivadas`}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Form */}
      <Card className="p-5">
        <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground text-sm">
            {editingId ? "Editar cuenta" : "Nueva cuenta"}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Nombre</Label>
            <Input
              id="account-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banco Santander"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-type">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="account-type" className="w-full">
                <SelectValue>{(v: string) => ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? v}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-initial-balance">Saldo inicial</Label>
            <Input
              id="account-initial-balance"
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
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
                  {color === c && <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            {editingId ? "Guardar" : "Crear cuenta"}
          </Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
          )}
        </div>
        </form>
      </Card>

      {/* List */}
      {filteredAccounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sin cuentas"
          description="Crea tu primera cuenta o importa datos desde YNAB para empezar."
          actionLabel="Importar YNAB"
          actionHref="/import"
        />
      ) : (
        <div className="space-y-3">
          {filteredAccounts.map((a) => (
            <Card
              key={a.id}
              className={cn("p-4 flex-row items-center justify-between transition-shadow hover:shadow-card-hover", a.archived && "opacity-60")}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: a.color }}
                >
                  <TypeIcon type={a.type} />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {a.name}
                    {a.archived && <span className="ml-2 text-xs text-accent-600 dark:text-accent-400 font-normal">(archivada)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{typeLabel(a.type)} · {a.currency}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <p className={cn("font-bold text-base font-mono tabular-nums", a.balance >= 0 ? "text-success-600" : "text-danger-600")}>
                  {formatCurrency(a.balance)}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => startEdit(a)} aria-label={`Editar ${a.name}`}>
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => archiveMut.mutate(a.id)}
                    className="hover:bg-accent-50 dark:hover:bg-accent-500/10"
                    aria-label={a.archived ? `Restaurar ${a.name}` : `Archivar ${a.name}`}
                  >
                    {a.archived
                      ? <ArchiveRestore className="w-3.5 h-3.5 text-accent-500" aria-hidden="true" />
                      : <Archive className="w-3.5 h-3.5" aria-hidden="true" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(a)}
                    className="hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Eliminar ${a.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
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
