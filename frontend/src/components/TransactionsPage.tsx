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

const TYPE_CONFIG = {
  expense: { label: "Gasto", icon: ArrowDownRight, color: "text-danger-600", bg: "bg-danger-50" },
  income: { label: "Ingreso", icon: ArrowUpRight, color: "text-success-600", bg: "bg-success-50" },
  transfer: { label: "Transferencia", icon: ArrowLeftRight, color: "text-primary-600", bg: "bg-primary-50" },
} as const;

const ACCOUNT_ICONS: Record<string, typeof Wallet> = {
  bank: Landmark,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  other: Wallet,
};

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
  if (currentSort !== field) return <ChevronsUpDown className="w-3 h-3 text-surface-300" />;
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
        <div className="card p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-5 sm:px-6 sm:py-5">
            <div className="skeleton h-4 w-32 mb-1" />
            <div className="skeleton h-9 w-48 mb-3" />
            <div className="skeleton h-7 w-24 rounded-lg" />
          </div>
        </div>
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-xl" />)}
      </div>
    );
  }

  const AccountIcon = selectedAccount ? (ACCOUNT_ICONS[selectedAccount.type] ?? Wallet) : Wallet;

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── Hero / Account Selector ── */}
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-50"
              >
                <AccountIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="tx-account-select">Seleccionar cuenta</label>
                <select
                  id="tx-account-select"
                  className="bg-transparent text-surface-900 font-bold text-base cursor-pointer border-none p-0 pr-6 focus:outline-none focus:ring-0 appearance-none w-full"
                  value={selectedAccountId ?? ""}
                  onChange={(e) => setSelectedAccountId(e.target.value ? Number(e.target.value) : null)}
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 0 center" }}
                >
                  <option value="">Todas las cuentas</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {selectedAccount && (
                  <p className="text-xs text-surface-400 mt-0.5">{selectedAccount.type === "credit_card" ? "Tarjeta de crédito" : selectedAccount.type === "bank" ? "Cuenta bancaria" : selectedAccount.type === "cash" ? "Efectivo" : selectedAccount.type === "investment" ? "Inversión" : "Otra"}</p>
                )}
              </div>
            </div>
            {selectedAccount && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-surface-400 uppercase tracking-wider">Saldo</p>
                <p className={`text-lg font-bold font-mono tabular-nums ${selectedAccount.balance >= 0 ? "text-primary-700" : "text-danger-600"}`}>
                  {formatCurrency(selectedAccount.balance)}
                </p>
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
              <Receipt className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span className="text-xs font-bold text-primary-800 font-mono">{totalCount}</span>
              <span className="text-xs font-medium text-primary-700">transacciones</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => openCreateForm("expense")}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Añadir transacción
        </button>
        <button
          onClick={() => openCreateForm("transfer")}
          className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
          disabled={!canCreateTransfers}
          title={canCreateTransfers ? "Registrar movimiento entre cuentas" : "Necesitas al menos dos cuentas para mover dinero entre cuentas"}
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> Mover entre cuentas
        </button>
        <button
          onClick={() => {
            setShowForm(false);
            setShowRecurringForm(true);
            setShowRecurringPanel(true);
            setRecurringAccountId(selectedAccountId ?? "");
          }}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <Repeat className="w-3.5 h-3.5" /> Programar recurrente
        </button>
        <button
          onClick={() => setShowCategoryManager((current) => !current)}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> {showCategoryManager ? "Ocultar grupos" : "Grupos y categorías"}
        </button>
        <button
          onClick={() => exportTransactions({
            accountId: selectedAccountId ?? undefined,
            search: searchQuery || undefined,
            type: filterType || undefined,
            categoryId: filterCategoryId ? Number(filterCategoryId) : undefined,
            from: filterFrom || undefined,
            to: filterTo || undefined,
            cleared: filterCleared || undefined,
          })}
          className="btn-secondary text-sm flex items-center gap-1.5"
          title="Exportar transacciones a CSV"
        >
          <Download className="w-3.5 h-3.5" /> Exportar
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="card px-4 py-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1.5fr_auto_auto_auto_auto] gap-3 items-end">
          <div>
            <label className="sr-only" htmlFor="tx-filter-type">Filtrar por tipo</label>
            <select
              id="tx-filter-type"
              className="input text-sm w-full"
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value as typeof filterType); setPage(1); }}
            >
              <option value="">Tipo: Todos</option>
              <option value="expense">Gastos</option>
              <option value="income">Ingresos</option>
              <option value="transfer">Transferencias</option>
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-cleared">Filtrar por estado</label>
            <select
              id="tx-filter-cleared"
              className="input text-sm w-full"
              value={filterCleared}
              onChange={(e) => { setFilterCleared(e.target.value as typeof filterCleared); setPage(1); }}
            >
              <option value="">Estado: Todos</option>
              <option value="true">Liquidadas</option>
              <option value="false">Pendientes</option>
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-category">Filtrar por categoría</label>
            <select
              id="tx-filter-category"
              className="input text-sm w-full"
              value={filterCategoryId}
              onChange={(e) => { setFilterCategoryId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}
            >
              <option value="">Categoría: Todas</option>
              {categoryGroups.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-from">Desde fecha</label>
            <input
              id="tx-filter-from"
              type="date"
              className="input text-sm w-full"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              title="Desde"
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="tx-filter-to">Hasta fecha</label>
            <input
              id="tx-filter-to"
              type="date"
              className="input text-sm w-full"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              title="Hasta"
            />
          </div>
          <div className="relative">
            <label className="sr-only" htmlFor="tx-search">Buscar transacciones</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" aria-hidden="true" />
            <input
              id="tx-search"
              type="text"
              className="input pl-9 text-sm w-full"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="text-xs text-primary-600 hover:text-primary-800 transition-colors whitespace-nowrap self-center">
              Limpiar
            </button>
          ) : <div />}
        </div>
      </div>

      {showCategoryManager && (
        <div className="card p-0 overflow-hidden mb-3">
          <div className="px-4 py-4 sm:px-5 sm:py-4 border-b border-surface-100">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-surface-900 text-sm">Alta rápida de grupos y categorías</h3>
                <p className="text-xs text-surface-500 mt-1">
                  Crea nuevas categorías sin salir de transacciones y selecciónalas después en el movimiento.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-bold text-primary-800 font-mono">{categoryGroups.length}</span>
                <span className="text-xs font-medium text-primary-700">grupos · {flatCategories.length} categorías</span>
              </div>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <form onSubmit={handleCreateGroup} className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-surface-900">Nuevo grupo</h4>
                  <p className="text-xs text-surface-500 mt-1">Agrupa categorías como vivienda, ahorro o transporte.</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  className="input text-sm flex-1 min-w-[220px]"
                  placeholder="Ej: Hogar"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <button type="submit" className="btn-primary text-sm" disabled={createGroupMut.isPending}>
                  {createGroupMut.isPending ? "Creando..." : "Crear grupo"}
                </button>
              </div>
            </form>

            <form onSubmit={handleCreateCategory} className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-surface-900">Nueva categoría</h4>
                  <p className="text-xs text-surface-500 mt-1">La categoría nueva queda disponible al instante en el formulario.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] gap-2 items-start">
                <select
                  className="input text-sm"
                  value={newCategoryGroupId}
                  onChange={(e) => setNewCategoryGroupId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Selecciona grupo</option>
                  {categoryGroups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Ej: Supermercado"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button type="submit" className="btn-primary text-sm" disabled={createCategoryMut.isPending || categoryGroups.length === 0}>
                  {createCategoryMut.isPending ? "Creando..." : "Crear categoría"}
                </button>
              </div>
              {categoryGroups.length === 0 && (
                <p className="text-xs text-surface-500 mt-3">Primero crea un grupo para poder añadir categorías.</p>
              )}
            </form>
          </div>

          {categoryGroups.length > 0 && (
            <div className="border-t border-surface-100 px-5 py-4">
              <div className="flex flex-wrap gap-3">
                {categoryGroups.map((group) => (
                  <div key={group.id} className="rounded-2xl border border-surface-200 bg-white px-3 py-2 min-w-[180px]">
                    <p className="text-sm font-semibold text-surface-900">{group.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {group.categories.length > 0 ? group.categories.map((category) => (
                        <span key={category.id} className="rounded-full bg-surface-100 px-2 py-0.5 text-[11px] font-medium text-surface-600">
                          {category.name}
                        </span>
                      )) : (
                        <span className="text-[11px] text-surface-400">Sin categorías</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recurring Rules (collapsible) ── */}
      <div className="card p-0 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowRecurringPanel((v) => !v)}
          className="w-full px-4 py-3 sm:px-5 flex items-center justify-between gap-3 hover:bg-surface-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <h3 className="font-semibold text-surface-900 text-sm">Pagos recurrentes</h3>
            <span className="text-xs text-surface-400 hidden sm:inline">
              Las instancias se crean como pendientes y no afectan al saldo hasta que las marques como validadas.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 bg-primary-50 rounded-lg px-3 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-600" aria-hidden="true" />
              <span className="text-xs font-bold text-primary-800 font-mono">{visibleRecurringRules.length}</span>
              <span className="text-xs font-medium text-primary-700">activos o pausados</span>
            </div>
            {showRecurringPanel ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
          </div>
        </button>

        {showRecurringPanel && <div className="border-t border-surface-100">

        {showRecurringForm && (
          <form onSubmit={handleCreateRecurring} className="p-5 border-b border-surface-100">
            <div className="flex gap-2 mb-4">
              {(["expense", "income"] as const).map((type) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecurringType(type)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      recurringType === type
                        ? `${cfg.bg} ${cfg.color} border-current`
                        : "border-surface-200 text-surface-500 hover:bg-surface-50"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Cuenta</label>
                <select className="input text-sm" value={recurringAccountId} onChange={(e) => setRecurringAccountId(e.target.value ? Number(e.target.value) : "")}> 
                  <option value="">Seleccionar...</option>
                  {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Categoría</label>
                <select className="input text-sm" value={recurringCategoryId} onChange={(e) => setRecurringCategoryId(e.target.value ? Number(e.target.value) : "")}> 
                  <option value="">Sin categoría</option>
                  {categoryGroups.map((group) => (
                    <optgroup key={group.id} label={group.name}>
                      {group.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Frecuencia</label>
                <select className="input text-sm" value={recurringCadence} onChange={(e) => setRecurringCadence(e.target.value as RecurringCadence)}>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Cada N</label>
                <input type="number" min="1" max="12" step="1" className="input text-sm" value={recurringIntervalCount} onChange={(e) => setRecurringIntervalCount(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} title={`Repetir cada ${recurringIntervalCount} ${recurringCadence === "weekly" ? "semana(s)" : recurringCadence === "yearly" ? "año(s)" : "mes(es)"}`} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Inicio</label>
                <input type="date" className="input text-sm" value={recurringStartDate} onChange={(e) => setRecurringStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Fin</label>
                <input type="date" className="input text-sm" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Importe</label>
                <input type="number" min="0.01" step="0.01" className="input text-sm" value={recurringAmount} onChange={(e) => setRecurringAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Beneficiario</label>
                <input type="text" className="input text-sm" value={recurringPayee} onChange={(e) => setRecurringPayee(e.target.value)} placeholder="Ej: Spotify o Nómina" />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Nota</label>
                <input type="text" className="input text-sm" value={recurringMemo} onChange={(e) => setRecurringMemo(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-surface-500">
                {editingRecurringId
                  ? "Al guardar los cambios, se regenerarán las instancias pendientes de esta regla."
                  : "Si partes de una transacción ya existente, usa el botón de recurrencia de esa fila para arrancar desde el siguiente vencimiento."}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => resetRecurringForm()} className="btn-secondary text-sm">Cancelar</button>
                <button type="submit" disabled={createRecurringMut.isPending || updateRecurringMut.isPending} className="btn-primary text-sm">
                  {createRecurringMut.isPending || updateRecurringMut.isPending
                    ? "Guardando..."
                    : editingRecurringId
                      ? "Guardar cambios"
                      : "Guardar programación"}
                </button>
              </div>
            </div>
          </form>
        )}

        {visibleRecurringRules.length > 0 ? (
          <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {visibleRecurringRules.map((rule) => (
              <div key={rule.id} className={`rounded-2xl border p-4 ${rule.active ? "border-surface-200 bg-white" : "border-surface-100 bg-surface-50/80"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-surface-900">
                        {rule.payee || (rule.type === "expense" ? "Pago recurrente" : "Ingreso recurrente")}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rule.active ? "bg-success-50 text-success-700" : "bg-surface-100 text-surface-500"}`}>
                        {rule.active ? "Activa" : "Pausada"}
                      </span>
                      {rule.pendingCount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          {rule.pendingCount} pendiente{rule.pendingCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-1">
                      {rule.accountName}
                      {rule.categoryName ? ` · ${rule.groupName}: ${rule.categoryName}` : ""}
                    </p>
                  </div>
                  <p className={`text-sm font-bold font-mono tabular-nums ${rule.type === "expense" ? "text-danger-600" : "text-success-600"}`}>
                    {formatCurrency(rule.amount)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-surface-100 px-2.5 py-1 font-medium text-surface-600">
                    {formatCadence(rule.cadence, rule.intervalCount)}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700">
                    {rule.nextOccurrence ? `Próximo ${formatDateLong(rule.nextOccurrence)}` : "Sin próximos vencimientos"}
                  </span>
                </div>

                {rule.memo && (
                  <p className="mt-3 text-xs text-surface-500">
                    {rule.memo}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEditRecurring(rule)}
                    className="btn-ghost text-xs"
                  >
                    <Edit3 className="w-3.5 h-3.5" aria-hidden="true" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleRecurringActiveMut.mutate({ id: rule.id, active: !rule.active })}
                    className="btn-ghost text-xs"
                  >
                    {rule.active ? <Pause className="w-3.5 h-3.5" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
                    {rule.active ? "Pausar" : "Reactivar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Eliminar la programación recurrente de ${rule.payee || "este movimiento"}?`)) {
                        deleteRecurringMut.mutate(rule.id);
                      }
                    }}
                    className="btn-ghost text-xs text-danger-600 hover:bg-danger-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !showRecurringForm ? (
          <div className="px-4 py-5 text-sm text-surface-500">
            {selectedAccount
              ? `No hay pagos recurrentes programados en ${selectedAccount.name}.`
              : "No hay pagos recurrentes programados todavía."}
          </div>
        ) : null}
        </div>}
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <form onSubmit={handleTransactionSubmit} className="card p-5 mb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-surface-900 text-sm">
                {editingTransactionId
                  ? "Editar transacción"
                  : formType === "transfer"
                    ? "Nuevo movimiento entre cuentas"
                    : "Nueva transacción"}
              </h3>
              <p className="text-xs text-surface-500 mt-1">
                {editingTransactionId
                  ? "Actualiza importe, cuenta, categoría o notas y guarda los cambios."
                  : formType === "transfer"
                    ? "Registra un traspaso entre dos cuentas y se crearán ambos lados del movimiento."
                    : "Añade un gasto, ingreso o cambia el tipo a transferencia si mueves saldo entre cuentas."}
              </p>
            </div>
            <button type="button" onClick={resetForm} className="p-1 hover:bg-surface-100 rounded-lg" aria-label="Cerrar formulario">
              <X className="w-4 h-4 text-surface-400" aria-hidden="true" />
            </button>
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
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    formType === t
                      ? `${cfg.bg} ${cfg.color} border-current`
                      : "border-surface-200 text-surface-500 hover:bg-surface-50"
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {!selectedAccountId && (
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Cuenta</label>
                <select className="input text-sm" value={formAccountId} onChange={(e) => setFormAccountId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Seleccionar...</option>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {formType === "transfer" && (
              <div>
                <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Destino</label>
                <select className="input text-sm" value={formTargetAccountId} onChange={(e) => setFormTargetAccountId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Seleccionar...</option>
                  {activeAccounts.filter((a) => a.id !== (formAccountId || selectedAccountId)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {formType !== "transfer" && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Categoría</label>
                  <button
                    type="button"
                    onClick={() => setShowCategoryManager(true)}
                    className="text-[11px] font-semibold text-primary-600 hover:text-primary-800"
                  >
                    Nueva categoría
                  </button>
                </div>
                <select className="input text-sm" value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Sin categoría</option>
                  {categoryGroups.map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Fecha</label>
              <input type="date" className="input text-sm" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Beneficiario</label>
              <input type="text" className="input text-sm" value={formPayee} onChange={(e) => setFormPayee(e.target.value)} placeholder={formType === "transfer" ? "Opcional" : "Ej: Mercadona"} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Importe</label>
              <input type="number" min="0.01" step="0.01" className="input text-sm" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5">Nota</label>
              <input type="text" className="input text-sm" value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-surface-500">
              {formType === "transfer"
                ? "El sistema refleja el cargo en la cuenta origen y el abono en la cuenta destino."
                : "Puedes crear grupos y categorías desde el bloque superior sin perder lo que ya has escrito."}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancelar</button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="btn-primary text-sm">
                {createMut.isPending || updateMut.isPending
                  ? "Guardando..."
                  : editingTransactionId
                    ? "Guardar cambios"
                    : formType === "transfer"
                      ? "Crear movimiento"
                      : "Crear transacción"}
              </button>
            </div>
          </div>
        </form>
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
        <div className="card overflow-hidden">
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-50">
                <tr className="border-b border-surface-200 text-surface-500 text-xs uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-left font-semibold w-10"></th>
                  <th
                    className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:text-surface-700 transition-colors"
                    onClick={() => toggleSort("date")}
                  >
                    <span className="inline-flex items-center gap-1">Fecha <SortIcon field="date" currentSort={sortBy} currentDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:text-surface-700 transition-colors"
                    onClick={() => toggleSort("payee")}
                  >
                    <span className="inline-flex items-center gap-1">Beneficiario <SortIcon field="payee" currentSort={sortBy} currentDir={sortDir} /></span>
                  </th>
                  <th
                    className="px-3 py-2.5 text-left font-semibold cursor-pointer select-none hover:text-surface-700 transition-colors"
                    onClick={() => toggleSort("category")}
                  >
                    <span className="inline-flex items-center gap-1">Categoría <SortIcon field="category" currentSort={sortBy} currentDir={sortDir} /></span>
                  </th>
                  {!selectedAccountId && (
                    <th className="px-3 py-2.5 text-left font-semibold">Cuenta</th>
                  )}
                  <th className="px-3 py-2.5 text-left font-semibold">Nota</th>
                  <th
                    className="px-3 py-2.5 text-right font-semibold cursor-pointer select-none hover:text-surface-700 transition-colors"
                    onClick={() => toggleSort("amount")}
                  >
                    <span className="inline-flex items-center gap-1 justify-end">{isCreditCard ? "Importe" : "Salida"} <SortIcon field="amount" currentSort={sortBy} currentDir={sortDir} /></span>
                  </th>
                  {!isCreditCard && (
                    <th className="px-3 py-2.5 text-right font-semibold">Entrada</th>
                  )}
                  <th className="px-3 py-2.5 text-center font-semibold w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {transactions.map((tx) => {
                  const cfg = TYPE_CONFIG[tx.type];
                  const outflow = tx.type === "expense" || tx.type === "transfer" ? tx.amount : null;
                  const inflow = tx.type === "income" ? tx.amount : null;
                  const canScheduleFromTransaction = tx.type !== "transfer" && !tx.recurringTransactionId;
                  const canEditTransaction = tx.type !== "transfer" || tx.transferDirection !== "inflow";
                  const isFutureRecurring = !!tx.recurringTransactionId && !!tx.scheduledFor && tx.scheduledFor > today && !tx.cleared;
                  return (
                    <tr
                      key={tx.id}
                      className="group hover:bg-surface-50 transition-colors"
                    >
                      <td className="px-3 py-2">
                        <span className={`inline-flex w-3 h-3 rounded-sm ${cfg.bg}`} />
                      </td>
                      <td className="px-3 py-2 text-surface-700 font-mono tabular-nums whitespace-nowrap">
                        {formatDateShort(tx.date)}
                      </td>
                      <td className="px-3 py-2 text-surface-900 font-medium">
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
                              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                                Recurrente
                              </span>
                            )}
                            {isFutureRecurring && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Programada
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-surface-500">
                        <span className="truncate max-w-[200px] block">
                          {tx.type === "transfer"
                            ? tx.targetAccountName
                              ? `${tx.transferDirection === "inflow" ? "Desde" : "Hacia"}: ${tx.targetAccountName}`
                              : "Entre cuentas"
                            : tx.categoryName
                              ? `${tx.groupName}: ${tx.categoryName}`
                              : ""}
                        </span>
                      </td>
                      {!selectedAccountId && (
                        <td className="px-3 py-2 text-surface-500 whitespace-nowrap">
                          {tx.accountName}
                        </td>
                      )}
                      <td className="px-3 py-2 text-surface-400">
                        <div className="space-y-1">
                          <span className="truncate max-w-[150px] block">{tx.memo || ""}</span>
                          {tx.recurringTransactionId && tx.scheduledFor && (
                            <span className="block text-[11px] text-primary-600">
                              Vencimiento {formatDateShort(tx.scheduledFor)}
                            </span>
                          )}
                        </div>
                      </td>
                      {isCreditCard ? (
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-danger-600 font-medium whitespace-nowrap">
                          {formatCurrency(tx.amount)}
                        </td>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-danger-600 font-medium whitespace-nowrap">
                            {outflow != null ? formatCurrency(outflow) : ""}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-success-600 font-medium whitespace-nowrap">
                            {inflow != null ? formatCurrency(inflow) : ""}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 justify-center">
                          {canEditTransaction && (
                            <button
                              onClick={() => openEditForm(tx)}
                              className="p-0.5 rounded hover:bg-surface-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Editar transacción"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-surface-400" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            onClick={() => clearMut.mutate(tx.id)}
                            className="p-0.5 rounded hover:bg-surface-100"
                            aria-label={tx.cleared ? "Marcar como pendiente" : "Marcar como liquidado"}
                          >
                            {tx.cleared
                              ? <CheckCircle2 className="w-4 h-4 text-success-500" aria-hidden="true" />
                              : <Circle className="w-4 h-4 text-surface-300" aria-hidden="true" />}
                          </button>
                          {canScheduleFromTransaction && (
                            <button
                              onClick={() => openRecurringFromTransaction(tx)}
                              className="p-0.5 rounded hover:bg-primary-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Programar movimiento recurrente"
                            >
                              <Repeat className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
                            </button>
                          )}
                          {!tx.recurringTransactionId && (
                            <button
                              onClick={() => { if (confirm("¿Eliminar esta transacción?")) deleteMut.mutate(tx.id); }}
                              className="p-0.5 rounded hover:bg-danger-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              aria-label="Eliminar transacción"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger-400" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer with pagination */}
          <div className="border-t border-surface-200 bg-surface-50 px-4 py-2 flex-shrink-0 flex items-center justify-between gap-3">
            <span className="text-xs text-surface-500 font-mono tabular-nums">{totalCount} transacciones</span>
            {totalCount > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4 text-surface-600" />
                </button>
                <span className="text-xs text-surface-600 font-mono tabular-nums">
                  {page} / {Math.ceil(totalCount / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / PAGE_SIZE), p + 1))}
                  disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
                  className="p-1 rounded hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4 text-surface-600" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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
