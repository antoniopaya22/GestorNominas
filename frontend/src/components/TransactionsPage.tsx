import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt, Plus, Trash2, Search, CheckCircle2,
  Circle, ArrowUpRight, ArrowDownRight, ArrowLeftRight, X, Edit3,
  Wallet, Landmark, CreditCard, Banknote, TrendingUp,
  ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight,
  Repeat, Pause, Play, Calendar, Download,
} from "lucide-react";
import {
  createCategory,
  createCategoryGroup,
  createRecurringTransaction,
  createTransaction,
  deleteRecurringTransaction,
  deleteTransaction,
  exportTransactions,
  getAccounts,
  getCategories,
  getRecurringTransactions,
  getTransactions,
  setRecurringTransactionActive,
  toggleCleared,
  updateRecurringTransaction,
  updateTransaction,
  type RecurringCadence,
  type RecurringTransaction,
  type Transaction,
  type TransactionFilters,
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
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

const TYPE_CONFIG = {
  expense: { label: "Gasto", icon: ArrowDownRight, color: "text-danger-600", bg: "bg-danger-50 dark:bg-danger-500/10" },
  income: { label: "Ingreso", icon: ArrowUpRight, color: "text-success-600", bg: "bg-success-50 dark:bg-success-500/10" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, color: "text-primary-600", bg: "bg-primary-50 dark:bg-primary-500/10" },
} as const;

const ACCOUNT_ICONS: Record<string, typeof Wallet> = {
  bank: Landmark,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  other: Wallet,
};

const NONE = "__none__";

type SortField = "date" | "payee" | "category" | "amount" | "type";
type SortDir = "asc" | "desc";

function getTodayIsoDate(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseIsoDate(isoDate: string): { year: number; month: number; day: number } {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsFromBase(isoDate: string, monthsToAdd: number): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const absoluteMonth = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = (absoluteMonth % 12) + 1;
  const targetDay = Math.min(day, getDaysInMonth(targetYear, targetMonth));
  return formatIsoDate(targetYear, targetMonth, targetDay);
}

function getNextMonthlyOccurrence(isoDate: string, fromDate = getTodayIsoDate()): string {
  for (let monthIndex = 0; monthIndex < 120; monthIndex += 1) {
    const candidate = addMonthsFromBase(isoDate, monthIndex);
    if (candidate >= fromDate) {
      return candidate;
    }
  }

  return fromDate;
}

function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function formatCadence(cadence: RecurringCadence, intervalCount: number): string {
  if (cadence === "weekly") {
    return intervalCount === 1 ? "Cada semana" : `Cada ${intervalCount} semanas`;
  }

  if (cadence === "yearly") {
    return intervalCount === 1 ? "Cada año" : `Cada ${intervalCount} años`;
  }

  return intervalCount === 1 ? "Cada mes" : `Cada ${intervalCount} meses`;
}

function SortIcon({ field, currentSort, currentDir }: { field: SortField; currentSort: SortField; currentDir: SortDir }) {
  if (currentSort !== field) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />;
  return currentDir === "asc"
    ? <ChevronUp className="w-3 h-3 text-primary-500" />
    : <ChevronDown className="w-3 h-3 text-primary-500" />;
}

function TransactionsView() {
  const queryClient = useQueryClient();
  const today = getTodayIsoDate();
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterType, setFilterType] = useState<"" | "expense" | "income" | "transfer">("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCleared, setFilterCleared] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [deleteTxTarget, setDeleteTxTarget] = useState<Transaction | null>(null);
  const [deleteRecurringTarget, setDeleteRecurringTarget] = useState<RecurringTransaction | null>(null);
  const PAGE_SIZE = 50;

  const filters: TransactionFilters = useMemo(() => ({
    accountId: selectedAccountId ?? undefined,
    search: searchQuery || undefined,
    type: filterType || undefined,
    categoryId: filterCategoryId ? Number(filterCategoryId) : undefined,
    from: filterFrom || undefined,
    to: filterTo || undefined,
    cleared: filterCleared || undefined,
    sortBy,
    sortDir,
    page,
    limit: PAGE_SIZE,
  }), [selectedAccountId, searchQuery, filterType, filterCategoryId, filterFrom, filterTo, filterCleared, sortBy, sortDir, page]);

  // Form state
  const [formType, setFormType] = useState<"expense" | "income" | "transfer">("expense");
  const [formAccountId, setFormAccountId] = useState<number | "">("");
  const [formTargetAccountId, setFormTargetAccountId] = useState<number | "">("");
  const [formCategoryId, setFormCategoryId] = useState<number | "">("");
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(today);
  const [formPayee, setFormPayee] = useState("");
  const [formMemo, setFormMemo] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newCategoryGroupId, setNewCategoryGroupId] = useState<number | "">("");
  const [newCategoryName, setNewCategoryName] = useState("");

  // Recurring form state
  const [editingRecurringId, setEditingRecurringId] = useState<number | null>(null);
  const [recurringType, setRecurringType] = useState<"expense" | "income">("expense");
  const [recurringAccountId, setRecurringAccountId] = useState<number | "">("");
  const [recurringCategoryId, setRecurringCategoryId] = useState<number | "">("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringCadence, setRecurringCadence] = useState<RecurringCadence>("monthly");
  const [recurringIntervalCount, setRecurringIntervalCount] = useState(1);
  const [recurringStartDate, setRecurringStartDate] = useState(today);
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [recurringPayee, setRecurringPayee] = useState("");
  const [recurringMemo, setRecurringMemo] = useState("");
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });
  const { data: categoryGroups = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: recurringRules = [] } = useQuery({
    queryKey: ["recurring-transactions"],
    queryFn: getRecurringTransactions,
  });
  const { data: txData, isLoading } = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => getTransactions(filters),
  });

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
  const selectedAccount = useMemo(
    () => activeAccounts.find((a) => a.id === selectedAccountId) ?? null,
    [activeAccounts, selectedAccountId],
  );
  const flatCategories = useMemo(
    () => categoryGroups.flatMap((group) => group.categories.map((category) => ({ ...category, groupName: group.name }))),
    [categoryGroups],
  );

  const isCreditCard = selectedAccount?.type === "credit_card";
  const canCreateTransfers = activeAccounts.length > 1;

  const createMut = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      resetForm();
      toast.success("Transacción creada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateTransaction>[1] }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      resetForm();
      toast.success("Transacción actualizada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transacción eliminada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const clearMut = useMutation({
    mutationFn: toggleCleared,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createRecurringMut = useMutation({
    mutationFn: createRecurringTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      resetRecurringForm();
      toast.success("Pago recurrente programado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateRecurringMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateRecurringTransaction>[1] }) =>
      updateRecurringTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      resetRecurringForm();
      toast.success("Pago recurrente actualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleRecurringActiveMut = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      setRecurringTransactionActive(id, active),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success(
        variables.active ? "Pago recurrente reactivado" : "Pago recurrente pausado",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteRecurringMut = useMutation({
    mutationFn: deleteRecurringTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Pago recurrente eliminado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createGroupMut = useMutation({
    mutationFn: createCategoryGroup,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewGroupName("");
      setNewCategoryGroupId(group.id);
      toast.success("Grupo creado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createCategoryMut = useMutation({
    mutationFn: createCategory,
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewCategoryName("");
      setNewCategoryGroupId(category.groupId);
      if (formType !== "transfer") {
        setFormCategoryId(category.id);
      }
      toast.success("Categoría creada");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingTransactionId(null);
    setFormType("expense");
    setFormAccountId("");
    setFormTargetAccountId("");
    setFormCategoryId("");
    setFormAmount("");
    setFormDate(today);
    setFormPayee("");
    setFormMemo("");
  };

  const resetRecurringForm = (nextAccountId: number | null = selectedAccountId) => {
    setShowRecurringForm(false);
    setEditingRecurringId(null);
    setRecurringType("expense");
    setRecurringAccountId(nextAccountId ?? "");
    setRecurringCategoryId("");
    setRecurringAmount("");
    setRecurringCadence("monthly");
    setRecurringIntervalCount(1);
    setRecurringStartDate(today);
    setRecurringEndDate("");
    setRecurringPayee("");
    setRecurringMemo("");
  };

  const openCreateForm = (nextType: "expense" | "income" | "transfer" = "expense") => {
    setShowRecurringForm(false);
    setEditingTransactionId(null);
    setShowForm(true);
    setFormType(nextType);
    setFormAccountId(selectedAccountId ?? "");
    setFormTargetAccountId("");
    setFormCategoryId("");
    setFormAmount("");
    setFormDate(today);
    setFormPayee("");
    setFormMemo("");
  };

  const openEditForm = (transaction: Transaction) => {
    if (transaction.type === "transfer" && transaction.transferDirection === "inflow") {
      toast.info("Edita la transferencia desde el movimiento de salida");
      return;
    }

    setShowRecurringForm(false);
    setEditingTransactionId(transaction.id);
    setShowForm(true);
    setFormType(transaction.type);
    setFormAccountId(transaction.accountId);
    setFormTargetAccountId(transaction.type === "transfer" ? transaction.targetAccountId ?? "" : "");
    setFormCategoryId(transaction.type === "transfer" ? "" : transaction.categoryId ?? "");
    setFormAmount(transaction.amount.toFixed(2));
    setFormDate(transaction.date);
    setFormPayee(transaction.payee ?? "");
    setFormMemo(transaction.memo ?? "");
  };

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const acctId = formAccountId || selectedAccountId;
    if (!acctId || !formAmount) {
      toast.error("Selecciona una cuenta e importe");
      return;
    }

    if (formType === "transfer" && !formTargetAccountId) {
      toast.error("Selecciona una cuenta destino");
      return;
    }

    if (formType === "transfer" && Number(acctId) === Number(formTargetAccountId)) {
      toast.error("La cuenta destino debe ser distinta de la cuenta origen");
      return;
    }

    const payload = {
      accountId: Number(acctId),
      type: formType,
      amount: parseFloat(formAmount),
      date: formDate,
      payee: formPayee || null,
      memo: formMemo || null,
      categoryId: formType === "transfer" ? null : formCategoryId ? Number(formCategoryId) : null,
      targetAccountId: formType === "transfer" && formTargetAccountId ? Number(formTargetAccountId) : undefined,
    };

    if (editingTransactionId) {
      updateMut.mutate({ id: editingTransactionId, data: payload });
      return;
    }

    createMut.mutate(payload);
  };

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Escribe un nombre de grupo");
      return;
    }

    createGroupMut.mutate({ name: newGroupName.trim() });
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryGroupId || !newCategoryName.trim()) {
      toast.error("Selecciona un grupo y escribe un nombre");
      return;
    }

    createCategoryMut.mutate({ groupId: Number(newCategoryGroupId), name: newCategoryName.trim() });
  };

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const accountId = recurringAccountId || selectedAccountId;
    if (!accountId || !recurringAmount) {
      toast.error("Selecciona una cuenta e importe");
      return;
    }

    const payload = {
      accountId: Number(accountId),
      categoryId: recurringCategoryId ? Number(recurringCategoryId) : null,
      type: recurringType,
      amount: Number(recurringAmount),
      cadence: recurringCadence,
      intervalCount: recurringIntervalCount,
      startDate: recurringStartDate,
      endDate: recurringEndDate || null,
      payee: recurringPayee || null,
      memo: recurringMemo || null,
    };

    if (editingRecurringId) {
      updateRecurringMut.mutate({ id: editingRecurringId, data: payload });
    } else {
      createRecurringMut.mutate(payload);
    }
  };

  const openEditRecurring = (rule: RecurringTransaction) => {
    setShowForm(false);
    setShowRecurringForm(true);
    setEditingRecurringId(rule.id);
    setRecurringType(rule.type);
    setRecurringAccountId(rule.accountId);
    setRecurringCategoryId(rule.categoryId ?? "");
    setRecurringAmount(rule.amount.toFixed(2));
    setRecurringCadence(rule.cadence);
    setRecurringIntervalCount(rule.intervalCount);
    setRecurringStartDate(rule.startDate);
    setRecurringEndDate(rule.endDate ?? "");
    setRecurringPayee(rule.payee ?? "");
    setRecurringMemo(rule.memo ?? "");
  };

  const openRecurringFromTransaction = (transaction: Transaction) => {
    if (transaction.type === "transfer" || transaction.recurringTransactionId) {
      return;
    }

    setShowForm(false);
    setShowRecurringForm(true);
    setRecurringType(transaction.type === "income" ? "income" : "expense");
    setRecurringAccountId(transaction.accountId);
    setRecurringCategoryId(transaction.categoryId ?? "");
    setRecurringAmount(transaction.amount.toFixed(2));
    setRecurringCadence("monthly");
    setRecurringStartDate(getNextMonthlyOccurrence(transaction.date, today));
    setRecurringEndDate("");
    setRecurringPayee(transaction.payee ?? "");
    setRecurringMemo(transaction.memo ?? "");
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
    setPage(1);
  };

  const clearFilters = () => {
    setFilterType("");
    setFilterCategoryId("");
    setFilterFrom("");
    setFilterTo("");
    setFilterCleared("");
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = filterType || filterCategoryId || filterFrom || filterTo || filterCleared || searchQuery;

  const transactions = txData?.data ?? [];
  const totalCount = txData?.total ?? 0;
  const visibleRecurringRules = useMemo(
    () => recurringRules.filter((rule) => !selectedAccountId || rule.accountId === selectedAccountId),
    [recurringRules, selectedAccountId],
  );

  if (isLoading && accounts.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-5 sm:px-6 sm:py-5">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-9 w-48 mb-3" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </Card>
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
      </div>
    );
  }

  const AccountIcon = selectedAccount ? (ACCOUNT_ICONS[selectedAccount.type] ?? Wallet) : Wallet;

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Hero / Account Selector ── */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-50 dark:bg-primary-500/10"
              >
                <AccountIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="tx-account-select">Seleccionar cuenta</label>
                <Select
                  value={selectedAccountId ? String(selectedAccountId) : "all"}
                  onValueChange={(v) => setSelectedAccountId(v === "all" ? null : Number(v))}
                >
                  <SelectTrigger
                    id="tx-account-select"
                    className="border-none bg-transparent p-0 h-auto shadow-none text-foreground font-bold text-base w-full dark:bg-transparent"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las cuentas</SelectItem>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccount && (
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedAccount.type === "credit_card" ? "Tarjeta de crédito" : selectedAccount.type === "bank" ? "Cuenta bancaria" : selectedAccount.type === "cash" ? "Efectivo" : selectedAccount.type === "investment" ? "Inversión" : "Otra"}</p>
                )}
              </div>
            </div>
            {selectedAccount && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo</p>
                <p className={cn("text-lg font-bold font-mono tabular-nums", selectedAccount.balance >= 0 ? "text-primary-700 dark:text-primary-400" : "text-danger-600")}>
                  {formatCurrency(selectedAccount.balance)}
                </p>
              </div>
            )}
            <Badge variant="secondary" className="bg-primary-50 text-primary-800 dark:bg-primary-500/10 dark:text-primary-300 gap-1.5">
              <Receipt className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono">{totalCount}</span>
              transacciones
            </Badge>
          </div>
        </div>
      </Card>

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={() => openCreateForm("expense")} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Añadir transacción
        </Button>
        <Button
          variant="secondary"
          onClick={() => openCreateForm("transfer")}
          className="gap-1.5"
          disabled={!canCreateTransfers}
          title={canCreateTransfers ? "Registrar movimiento entre cuentas" : "Necesitas al menos dos cuentas para mover dinero entre cuentas"}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Mover entre cuentas
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setShowForm(false);
            setShowRecurringForm(true);
            setShowRecurringPanel(true);
            setRecurringAccountId(selectedAccountId ?? "");
          }}
          className="gap-1.5"
        >
          <Repeat className="w-3.5 h-3.5" /> Programar recurrente
        </Button>
        <Button variant="secondary" onClick={() => setShowCategoryManager((current) => !current)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {showCategoryManager ? "Ocultar grupos" : "Grupos y categorías"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => exportTransactions({
            accountId: selectedAccountId ?? undefined,
            search: searchQuery || undefined,
            type: filterType || undefined,
            categoryId: filterCategoryId ? Number(filterCategoryId) : undefined,
            from: filterFrom || undefined,
            to: filterTo || undefined,
            cleared: filterCleared || undefined,
          })}
          className="gap-1.5"
          title="Exportar transacciones a CSV"
        >
          <Download className="w-3.5 h-3.5" /> Exportar
        </Button>
      </div>

      {/* ── Filters ── */}
      <Card className="px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="sr-only" htmlFor="tx-filter-type">Filtrar por tipo</label>
            <Select value={filterType || NONE} onValueChange={(v) => { setFilterType(v === NONE ? "" : v as typeof filterType); setPage(1); }}>
              <SelectTrigger id="tx-filter-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tipo: Todos</SelectItem>
                <SelectItem value="expense">Gastos</SelectItem>
                <SelectItem value="income">Ingresos</SelectItem>
                <SelectItem value="transfer">Transferencias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-cleared">Filtrar por estado</label>
            <Select value={filterCleared || NONE} onValueChange={(v) => { setFilterCleared(v === NONE ? "" : v as typeof filterCleared); setPage(1); }}>
              <SelectTrigger id="tx-filter-cleared" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Estado: Todos</SelectItem>
                <SelectItem value="true">Liquidadas</SelectItem>
                <SelectItem value="false">Pendientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-category">Filtrar por categoría</label>
            <Select
              value={filterCategoryId ? String(filterCategoryId) : NONE}
              onValueChange={(v) => { setFilterCategoryId(v === NONE ? "" : Number(v)); setPage(1); }}
            >
              <SelectTrigger id="tx-filter-category" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Categoría: Todas</SelectItem>
                {categoryGroups.map((g) => (
                  <SelectGroup key={g.id}>
                    <SelectLabel>{g.name}</SelectLabel>
                    {g.categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-from">Desde fecha</label>
            <Input
              id="tx-filter-from"
              type="date"
              className="w-full"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              title="Desde"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-to">Hasta fecha</label>
            <Input
              id="tx-filter-to"
              type="date"
              className="w-full"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              title="Hasta"
            />
          </div>
          <div className="relative">
            <label className="sr-only" htmlFor="tx-search">Buscar transacciones</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              id="tx-search"
              type="text"
              className="pl-9 w-full"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <Button variant="link" size="sm" onClick={clearFilters} className="whitespace-nowrap self-center px-0 h-auto">
              Limpiar
            </Button>
          ) : <div />}
        </div>
      </Card>

      {showCategoryManager && (
        <Card className="p-0 overflow-hidden mb-3">
          <div className="px-4 py-4 sm:px-5 sm:py-4 border-b border-border">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Alta rápida de grupos y categorías</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Crea nuevas categorías sin salir de transacciones y selecciónalas después en el movimiento.
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary-50 text-primary-800 dark:bg-primary-500/10 dark:text-primary-300">
                <span className="font-mono">{categoryGroups.length}</span>
                grupos · {flatCategories.length} categorías
              </Badge>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <form onSubmit={handleCreateGroup} className="rounded-2xl border border-border bg-muted/70 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Nuevo grupo</h4>
                  <p className="text-xs text-muted-foreground mt-1">Agrupa categorías como vivienda, ahorro o transporte.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  type="text"
                  className="flex-1 min-w-[220px]"
                  placeholder="Ej: Hogar"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <Button type="submit" disabled={createGroupMut.isPending}>
                  {createGroupMut.isPending ? "Creando..." : "Crear grupo"}
                </Button>
              </div>
            </form>

            <form onSubmit={handleCreateCategory} className="rounded-2xl border border-border bg-muted/70 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Nueva categoría</h4>
                  <p className="text-xs text-muted-foreground mt-1">La categoría nueva queda disponible al instante en el formulario.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] gap-2 items-start">
                <Select
                  value={newCategoryGroupId ? String(newCategoryGroupId) : NONE}
                  onValueChange={(v) => setNewCategoryGroupId(v === NONE ? "" : Number(v))}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona grupo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Selecciona grupo</SelectItem>
                    {categoryGroups.map((group) => (
                      <SelectItem key={group.id} value={String(group.id)}>{group.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  placeholder="Ej: Supermercado"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button type="submit" disabled={createCategoryMut.isPending || categoryGroups.length === 0}>
                  {createCategoryMut.isPending ? "Creando..." : "Crear categoría"}
                </Button>
              </div>
              {categoryGroups.length === 0 && (
                <p className="text-xs text-muted-foreground mt-3">Primero crea un grupo para poder añadir categorías.</p>
              )}
            </form>
          </div>

          {categoryGroups.length > 0 && (
            <div className="border-t border-border px-5 py-4">
              <div className="flex flex-wrap gap-3">
                {categoryGroups.map((group) => (
                  <div key={group.id} className="rounded-2xl border border-border bg-card px-3 py-2 min-w-[180px]">
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.categories.length > 0 ? group.categories.map((category) => (
                        <span key={category.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {category.name}
                        </span>
                      )) : (
                        <span className="text-[11px] text-muted-foreground">Sin categorías</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Recurring Rules (collapsible) ── */}
      <Card className="p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRecurringPanel((v) => !v)}
          className="w-full px-4 py-3 sm:px-5 flex items-center justify-between gap-3 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            <h3 className="font-semibold text-foreground text-sm">Pagos recurrentes</h3>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Las instancias se crean como pendientes y no afectan al saldo hasta que las marques como validadas.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="bg-primary-50 text-primary-800 dark:bg-primary-500/10 dark:text-primary-300 gap-1.5">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono">{visibleRecurringRules.length}</span>
              activos o pausados
            </Badge>
            {showRecurringPanel ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {showRecurringPanel && <div className="border-t border-border">

        {showRecurringForm && (
          <form onSubmit={handleCreateRecurring} className="p-5 border-b border-border">
            <div className="flex gap-2 mb-4">
              {(["expense", "income"] as const).map((type) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecurringType(type)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                      recurringType === type
                        ? cn(cfg.bg, cfg.color, "border-current")
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-4">
              <div className="space-y-1.5">
                <Label>Cuenta</Label>
                <Select value={recurringAccountId ? String(recurringAccountId) : NONE} onValueChange={(v) => setRecurringAccountId(v === NONE ? "" : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Seleccionar...</SelectItem>
                    {activeAccounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Select value={recurringCategoryId ? String(recurringCategoryId) : NONE} onValueChange={(v) => setRecurringCategoryId(v === NONE ? "" : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin categoría</SelectItem>
                    {categoryGroups.map((group) => (
                      <SelectGroup key={group.id}>
                        <SelectLabel>{group.name}</SelectLabel>
                        {group.categories.map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Frecuencia</Label>
                <Select value={recurringCadence} onValueChange={(v) => setRecurringCadence(v as RecurringCadence)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cada N</Label>
                <Input type="number" min="1" max="12" step="1" value={recurringIntervalCount} onChange={(e) => setRecurringIntervalCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} title={`Repetir cada ${recurringIntervalCount} ${recurringCadence === "weekly" ? "semana(s)" : recurringCadence === "yearly" ? "año(s)" : "mes(es)"}`} />
              </div>
              <div className="space-y-1.5">
                <Label>Inicio</Label>
                <Input type="date" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Importe</Label>
                <Input type="number" min="0.01" step="0.01" value={recurringAmount} onChange={(e) => setRecurringAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
                <Label>Beneficiario</Label>
                <Input type="text" value={recurringPayee} onChange={(e) => setRecurringPayee(e.target.value)} placeholder="Ej: Spotify o Nómina" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4 space-y-1.5">
                <Label>Nota</Label>
                <Input type="text" value={recurringMemo} onChange={(e) => setRecurringMemo(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {editingRecurringId
                  ? "Al guardar los cambios, se regenerarán las instancias pendientes de esta regla."
                  : "Si partes de una transacción ya existente, usa el botón de recurrencia de esa fila para arrancar desde el siguiente vencimiento."}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => resetRecurringForm()}>Cancelar</Button>
                <Button type="submit" disabled={createRecurringMut.isPending || updateRecurringMut.isPending}>
                  {createRecurringMut.isPending || updateRecurringMut.isPending
                    ? "Guardando..."
                    : editingRecurringId
                      ? "Guardar cambios"
                      : "Guardar programación"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {visibleRecurringRules.length > 0 ? (
          <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {visibleRecurringRules.map((rule) => (
              <div key={rule.id} className={cn("rounded-2xl border p-4", rule.active ? "border-border bg-card" : "border-border bg-muted/80")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground">
                        {rule.payee || (rule.type === "expense" ? "Pago recurrente" : "Ingreso recurrente")}
                      </p>
                      <Badge
                        variant="secondary"
                        className={rule.active ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500" : ""}
                      >
                        {rule.active ? "Activa" : "Pausada"}
                      </Badge>
                      {rule.pendingCount > 0 && (
                        <Badge variant="secondary" className="bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
                          {rule.pendingCount} pendiente{rule.pendingCount !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule.accountName}
                      {rule.categoryName ? ` · ${rule.groupName}: ${rule.categoryName}` : ""}
                    </p>
                  </div>
                  <p className={cn("text-sm font-bold font-mono tabular-nums", rule.type === "expense" ? "text-danger-600" : "text-success-600")}>
                    {formatCurrency(rule.amount)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                    {formatCadence(rule.cadence, rule.intervalCount)}
                  </span>
                  <span className="rounded-full bg-primary-50 dark:bg-primary-500/10 px-2.5 py-1 font-medium text-primary-700 dark:text-primary-400">
                    {rule.nextOccurrence ? `Próximo ${formatDateLong(rule.nextOccurrence)}` : "Sin próximos vencimientos"}
                  </span>
                </div>

                {rule.memo && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {rule.memo}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditRecurring(rule)} className="gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" /> Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRecurringActiveMut.mutate({ id: rule.id, active: !rule.active })}
                    className="gap-1.5"
                  >
                    {rule.active ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
                    {rule.active ? "Pausar" : "Reactivar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteRecurringTarget(rule)}
                    className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : !showRecurringForm ? (
          <div className="px-4 py-5 text-sm text-muted-foreground">
            {selectedAccount
              ? `No hay pagos recurrentes programados en ${selectedAccount.name}.`
              : "No hay pagos recurrentes programados todavía."}
          </div>
        ) : null}
        </div>}
      </Card>

      {/* ── Create Form ── */}
      {showForm && (
        <Card className="p-5 mb-3">
        <form onSubmit={handleTransactionSubmit}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                {editingTransactionId
                  ? "Editar transacción"
                  : formType === "transfer"
                    ? "Nuevo movimiento entre cuentas"
                    : "Nueva transacción"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {editingTransactionId
                  ? "Actualiza importe, cuenta, categoría o notas y guarda los cambios."
                  : formType === "transfer"
                    ? "Registra un traspaso entre dos cuentas y se crearán ambos lados del movimiento."
                    : "Añade un gasto, ingreso o cambia el tipo a transferencia si mueves saldo entre cuentas."}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={resetForm} aria-label="Cerrar formulario">
              <X className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex gap-2 mb-4">
            {(["expense", "income", "transfer"] as const).map((t) => {
              const cfg = TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setFormType(t);
                    if (t !== "transfer") {
                      setFormTargetAccountId("");
                    }
                  }}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                    formType === t
                      ? cn(cfg.bg, cfg.color, "border-current")
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {!selectedAccountId && (
              <div className="space-y-1.5">
                <Label>Cuenta</Label>
                <Select value={formAccountId ? String(formAccountId) : NONE} onValueChange={(v) => setFormAccountId(v === NONE ? "" : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Seleccionar...</SelectItem>
                    {activeAccounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formType === "transfer" && (
              <div className="space-y-1.5">
                <Label>Destino</Label>
                <Select value={formTargetAccountId ? String(formTargetAccountId) : NONE} onValueChange={(v) => setFormTargetAccountId(v === NONE ? "" : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Seleccionar...</SelectItem>
                    {activeAccounts.filter((a) => a.id !== (formAccountId || selectedAccountId)).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formType !== "transfer" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Categoría</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setShowCategoryManager(true)}
                    className="text-[11px] px-0 h-auto"
                  >
                    Nueva categoría
                  </Button>
                </div>
                <Select value={formCategoryId ? String(formCategoryId) : NONE} onValueChange={(v) => setFormCategoryId(v === NONE ? "" : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin categoría</SelectItem>
                    {categoryGroups.map((g) => (
                      <SelectGroup key={g.id}>
                        <SelectLabel>{g.name}</SelectLabel>
                        {g.categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Beneficiario</Label>
              <Input type="text" value={formPayee} onChange={(e) => setFormPayee(e.target.value)} placeholder={formType === "transfer" ? "Opcional" : "Ej: Mercadona"} />
            </div>
            <div className="space-y-1.5">
              <Label>Importe</Label>
              <Input type="number" min="0.01" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Nota</Label>
              <Input type="text" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted-foreground">
              {formType === "transfer"
                ? "El sistema refleja el cargo en la cuenta origen y el abono en la cuenta destino."
                : "Puedes crear grupos y categorías desde el bloque superior sin perder lo que ya has escrito."}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={resetForm}>Cancelar</Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                {createMut.isPending || updateMut.isPending
                  ? "Guardando..."
                  : editingTransactionId
                    ? "Guardar cambios"
                    : formType === "transfer"
                      ? "Crear movimiento"
                      : "Crear transacción"}
              </Button>
            </div>
          </div>
        </form>
        </Card>
      )}

      {/* ── Transactions Table ── */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin transacciones"
          description={selectedAccount ? `No hay transacciones en ${selectedAccount.name}.` : "Añade tu primera transacción o importa datos."}
          actionLabel="Importar"
          actionHref="/import"
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted [&_tr]:hover:bg-muted">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <span className="inline-flex items-center gap-1">Fecha <SortIcon field="date" currentSort={sortBy} currentDir={sortDir} /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("payee")}
                  >
                    <span className="inline-flex items-center gap-1">Beneficiario <SortIcon field="payee" currentSort={sortBy} currentDir={sortDir} /></span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("category")}
                  >
                    <span className="inline-flex items-center gap-1">Categoría <SortIcon field="category" currentSort={sortBy} currentDir={sortDir} /></span>
                  </TableHead>
                  {!selectedAccountId && (
                    <TableHead>Cuenta</TableHead>
                  )}
                  <TableHead>Nota</TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => toggleSort("amount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">{isCreditCard ? "Importe" : "Salida"} <SortIcon field="amount" currentSort={sortBy} currentDir={sortDir} /></span>
                  </TableHead>
                  {!isCreditCard && (
                    <TableHead className="text-right">Entrada</TableHead>
                  )}
                  <TableHead className="text-center w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.type];
                  const outflow = tx.type === "expense" || tx.type === "transfer" ? tx.amount : null;
                  const inflow = tx.type === "income" ? tx.amount : null;
                  const canScheduleFromTransaction = tx.type !== "transfer" && !tx.recurringTransactionId;
                  const canEditTransaction = tx.type !== "transfer" || tx.transferDirection !== "inflow";
                  const isFutureRecurring = !!tx.recurringTransactionId && !!tx.scheduledFor && tx.scheduledFor > today && !tx.cleared;
                  return (
                    <TableRow key={tx.id} className="group">
                      <TableCell>
                        <span className={cn("inline-flex w-3 h-3 rounded-sm", cfg.bg)} />
                      </TableCell>
                      <TableCell className="text-foreground font-mono tabular-nums whitespace-nowrap">
                        {formatDateShort(tx.date)}
                      </TableCell>
                      <TableCell className="text-foreground font-medium">
                        <div className="flex items-center gap-1.5">
                          {tx.type === "transfer" && (
                            <ArrowLeftRight className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">
                            {tx.payee || (tx.type === "transfer" ? "Transferencia" : "—")}
                          </span>
                        </div>
                        {(tx.recurringTransactionId || isFutureRecurring) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {tx.recurringTransactionId && (
                              <Badge variant="secondary" className="bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400">
                                Recurrente
                              </Badge>
                            )}
                            {isFutureRecurring && (
                              <Badge variant="secondary" className="bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
                                Programada
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="truncate max-w-[200px] block">
                          {tx.type === "transfer"
                            ? tx.targetAccountName
                              ? `${tx.transferDirection === "inflow" ? "Desde" : "Hacia"}: ${tx.targetAccountName}`
                              : "Entre cuentas"
                            : tx.categoryName
                              ? `${tx.groupName}: ${tx.categoryName}`
                              : ""}
                        </span>
                      </TableCell>
                      {!selectedAccountId && (
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {tx.accountName}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">
                        <div className="space-y-1">
                          <span className="truncate max-w-[150px] block">{tx.memo || ""}</span>
                          {tx.recurringTransactionId && tx.scheduledFor && (
                            <span className="block text-[11px] text-primary-600 dark:text-primary-400">
                              Vencimiento {formatDateShort(tx.scheduledFor)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {isCreditCard ? (
                        <TableCell className="text-right font-mono tabular-nums text-danger-600 font-medium whitespace-nowrap">
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="text-right font-mono tabular-nums text-danger-600 font-medium whitespace-nowrap">
                            {outflow != null ? formatCurrency(outflow) : ""}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-success-600 font-medium whitespace-nowrap">
                            {inflow != null ? formatCurrency(inflow) : ""}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1 justify-center">
                          {canEditTransaction && (
                            <button
                              onClick={() => openEditForm(tx)}
                              className="p-0.5 rounded hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Editar transacción"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            onClick={() => clearMut.mutate(tx.id)}
                            className="p-0.5 rounded hover:bg-muted"
                            aria-label={tx.cleared ? "Marcar como pendiente" : "Marcar como liquidado"}
                          >
                            {tx.cleared
                              ? <CheckCircle2 className="w-4 h-4 text-success-500" aria-hidden="true" />
                              : <Circle className="w-4 h-4 text-muted-foreground" aria-hidden="true" />}
                          </button>
                          {canScheduleFromTransaction && (
                            <button
                              onClick={() => openRecurringFromTransaction(tx)}
                              className="p-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Programar movimiento recurrente"
                            >
                              <Repeat className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
                            </button>
                          )}
                          {!tx.recurringTransactionId && (
                            <button
                              onClick={() => setDeleteTxTarget(tx)}
                              className="p-0.5 rounded hover:bg-destructive/10 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Eliminar transacción"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger-400" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Footer with pagination */}
          <div className="border-t border-border bg-muted px-4 py-2 flex-shrink-0 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-mono tabular-nums">{totalCount} transacciones</span>
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {page} / {Math.ceil(totalCount / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      <ConfirmModal
        open={!!deleteTxTarget}
        title="Eliminar transacción"
        message="¿Eliminar esta transacción? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (deleteTxTarget) deleteMut.mutate(deleteTxTarget.id); setDeleteTxTarget(null); }}
        onCancel={() => setDeleteTxTarget(null)}
      />
      <ConfirmModal
        open={!!deleteRecurringTarget}
        title="Eliminar programación recurrente"
        message={`¿Eliminar la programación recurrente de ${deleteRecurringTarget?.payee || "este movimiento"}?`}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => { if (deleteRecurringTarget) deleteRecurringMut.mutate(deleteRecurringTarget.id); setDeleteRecurringTarget(null); }}
        onCancel={() => setDeleteRecurringTarget(null)}
      />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Providers>
      <TransactionsView />
    </Providers>
  );
}
