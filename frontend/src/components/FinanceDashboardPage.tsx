import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Landmark,
  PiggyBank,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import {
  getAccounts,
  getFinanceAnalytics,
  type FinanceAnalyticsFilters,
} from "../lib/api";
import { formatCompact, formatCurrency, formatMonthLabel, formatPercent } from "../lib/format";
import { EmptyState } from "./ui/EmptyState";
import { KpiCard } from "./ui/KpiCard";
import { SectionHeader } from "./ui/SectionHeader";
import { ChartTooltip } from "./ui/ChartTooltip";

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#dc2626";
const NET_COLOR = "#2563eb";
const ACCENT_COLORS = [
  "#2563eb",
  "#0891b2",
  "#7c3aed",
  "#f59e0b",
  "#10b981",
  "#e11d48",
  "#0f766e",
  "#9333ea",
];

type PeriodPreset = "3m" | "6m" | "12m" | "all";

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPresetRange(preset: Exclude<PeriodPreset, "all">): { from: string; to: string } {
  const today = new Date();
  const end = formatDateInput(today);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  if (preset === "3m") start.setMonth(start.getMonth() - 2);
  if (preset === "6m") start.setMonth(start.getMonth() - 5);
  if (preset === "12m") start.setMonth(start.getMonth() - 11);

  return { from: formatDateInput(start), to: end };
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];

  return (
    <ChartTooltip
      active={active}
      label={String(entry.name ?? "")}
      payload={[
        {
          name: "Total",
          value: Number(entry.value ?? 0),
          color: String(entry.color ?? NET_COLOR),
        },
      ]}
    />
  );
}

export function FinanceDashboardView({ onOpenDetailed }: { onOpenDetailed?: () => void } = {}) {
  const defaultRange = useMemo(() => getPresetRange("6m"), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("6m");
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [accountId, setAccountId] = useState<number | undefined>();

  const filters = useMemo<FinanceAnalyticsFilters>(() => ({
    from: periodPreset === "all" ? undefined : from,
    to: periodPreset === "all" ? undefined : to,
    accountId,
  }), [accountId, from, periodPreset, to]);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });

  const {
    data: analytics,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["finance-dashboard", filters],
    queryFn: () => getFinanceAnalytics(filters),
  });

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );

  const monthlyData = useMemo(
    () => (analytics?.monthly ?? []).map((item) => ({ ...item, label: formatMonthLabel(item.month) })),
    [analytics],
  );

  const categoryData = useMemo(
    () => (analytics?.categories ?? [])
      .filter((item) => item.type === "expense")
      .slice(0, 6)
      .map((item, index) => ({
        ...item,
        label: item.categoryName,
        value: item.total,
        color: ACCENT_COLORS[index % ACCENT_COLORS.length],
      })),
    [analytics],
  );

  const payeeData = useMemo(
    () => (analytics?.payees ?? [])
      .filter((item) => item.type === "expense")
      .slice(0, 8)
      .map((item, index) => ({
        ...item,
        shortLabel: item.payee.length > 18 ? `${item.payee.slice(0, 17)}…` : item.payee,
        color: ACCENT_COLORS[index % ACCENT_COLORS.length],
      })),
    [analytics],
  );

  const accountSnapshot = useMemo(
    () => (analytics?.accounts ?? []).slice(0, 5),
    [analytics],
  );

  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);

    if (preset === "all") {
      return;
    }

    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="skeleton h-4 w-36 mb-1" />
            <div className="skeleton h-10 w-72 mb-4" />
            <div className="skeleton h-4 w-full max-w-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card p-5">
              <div className="skeleton h-10 w-10 rounded-xl mb-3" />
              <div className="skeleton h-8 w-40 mb-2" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card p-6"><div className="skeleton h-[320px] w-full" /></div>
          <div className="card p-6"><div className="skeleton h-[320px] w-full" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-surface-900">No se pudo cargar el dashboard financiero</p>
        <p className="mt-2 text-sm text-surface-500">Vuelve a intentarlo o revisa la conexión con la API.</p>
        <button type="button" onClick={() => refetch()} className="btn-primary mt-5">
          <RefreshCcw className="w-4 h-4" /> Reintentar
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin datos financieros"
        description="Crea cuentas o importa movimientos para activar el resumen financiero."
        actionLabel="Importar datos"
        actionHref="/settings?tab=finanzas"
      />
    );
  }

  if (!analytics) {
    return null;
  }

  const hasTransactions = analytics.summary.transactionCount > 0;
  const activeScope = selectedAccount ? selectedAccount.name : "Todas las cuentas";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="card p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary-500 via-primary-400 to-accent-400" />
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-surface-400 text-xs uppercase tracking-wider mb-1">Dashboard financiero</p>
              <h1 className="text-3xl font-bold tracking-tight text-surface-900 sm:text-4xl">Resumen rápido de saldo, flujo y focos de gasto</h1>
              <p className="mt-3 text-sm leading-6 text-surface-600 sm:text-base">
                Esta vista recupera el resumen que tenías antes: menos configuración, más lectura rápida. La analítica detallada sigue disponible aparte.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="badge bg-primary-50 text-primary-700">{activeScope}</span>
                <span className="badge bg-surface-100 text-surface-700">
                  {periodPreset === "all" ? "Todo el histórico" : `${from} - ${to}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-surface-50 p-4 ring-1 ring-surface-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">Estado</p>
                <p className="mt-1 text-sm text-surface-600">
                  {isFetching ? "Actualizando resumen..." : `${analytics.summary.transactionCount} movimientos procesados`}
                </p>
              </div>
              <button type="button" onClick={onOpenDetailed} className="btn-primary text-sm">
                Ver analítica avanzada <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-surface-200 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "3m", label: "3M" },
                  { value: "6m", label: "6M" },
                  { value: "12m", label: "12M" },
                  { value: "all", label: "Todo" },
                ].map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applyPreset(preset.value as PeriodPreset)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                      periodPreset === preset.value
                        ? "bg-surface-900 text-white"
                        : "bg-surface-100 text-surface-600 hover:bg-surface-200 hover:text-surface-900"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div>
                  <label htmlFor="finance-dashboard-account" className="block text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                    Cuenta
                  </label>
                  <select
                    id="finance-dashboard-account"
                    className="input min-w-[240px] text-sm"
                    value={accountId ?? ""}
                    onChange={(event) => setAccountId(event.target.value ? Number(event.target.value) : undefined)}
                  >
                    <option value="">Todas las cuentas</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Saldo actual"
          value={formatCurrency(analytics.summary.totalBalance)}
          subValue={selectedAccount ? selectedAccount.name : "Todas las cuentas"}
          color="primary"
        />
        <KpiCard
          icon={ArrowUpRight}
          label="Ingresos del periodo"
          value={formatCurrency(analytics.summary.incomeTotal)}
          subValue={`Media ${formatCurrency(analytics.summary.monthlyAverageIncome)}`}
          color="success"
        />
        <KpiCard
          icon={ArrowDownRight}
          label="Gastos del periodo"
          value={formatCurrency(analytics.summary.expenseTotal)}
          subValue={analytics.summary.topExpenseMonth ? `Pico en ${formatMonthLabel(analytics.summary.topExpenseMonth.month)}` : "Sin pico detectado"}
          color="danger"
        />
        <KpiCard
          icon={PiggyBank}
          label="Tasa de ahorro"
          value={analytics.summary.incomeTotal > 0 ? formatPercent(analytics.summary.savingsRate) : "—"}
          subValue={`Flujo neto ${formatCurrency(analytics.summary.netTotal)}`}
          color="accent"
          trend={analytics.summary.netTotal > 0 ? "up" : analytics.summary.netTotal < 0 ? "down" : "neutral"}
          trendValue={formatCurrency(Math.abs(analytics.summary.netTotal))}
        />
      </div>

      {!hasTransactions ? (
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold text-surface-900">No hay movimientos conciliados para este resumen</p>
          <p className="mt-2 text-sm text-surface-500">Prueba con otro periodo o cambia la cuenta seleccionada.</p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
            <div className="p-6">
              <SectionHeader
                icon={BarChart3}
                title="Evolución mensual"
                subtitle="Ingresos, gastos y flujo neto en una vista compacta"
              />
              <ResponsiveContainer width="100%" height={340}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-surface-400)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--color-surface-400)" tickFormatter={formatCompact} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="income" name="Ingresos" fill={INCOME_COLOR} radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expenses" name="Gastos" fill={EXPENSE_COLOR} radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="Flujo neto" stroke={NET_COLOR} strokeWidth={3} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="card p-0 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
              <div className="p-6">
                <SectionHeader
                  icon={PiggyBank}
                  title="Gasto por categoría"
                  subtitle="Top de categorías que más pesan en el periodo"
                />
                {categoryData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-6 py-16 text-center text-sm text-surface-400">
                    No hay gasto categorizado para este periodo.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="label" innerRadius={68} outerRadius={108} paddingAngle={3}>
                          {categoryData.map((item) => (
                            <Cell key={item.bucketKey} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {categoryData.map((item) => (
                        <div key={item.bucketKey} className="flex items-start gap-3">
                          <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-surface-900">{item.label}</p>
                            <p className="text-xs text-surface-400">{item.groupName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold text-surface-900">{formatCurrency(item.value)}</p>
                            <p className="text-xs text-surface-400">{formatPercent(item.percentage)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card p-0 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-danger-500 to-danger-400" />
              <div className="p-6">
                <SectionHeader
                  icon={ArrowDownRight}
                  title="Beneficiarios principales"
                  subtitle="Quién concentra más salida de dinero"
                />
                {payeeData.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-6 py-16 text-center text-sm text-surface-400">
                    No hay beneficiarios con gasto en el periodo.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={payeeData} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                      <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-surface-400)" tickFormatter={formatCompact} />
                      <YAxis type="category" dataKey="shortLabel" width={120} tick={{ fontSize: 12 }} stroke="var(--color-surface-400)" />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="total" name="Gasto" radius={[0, 8, 8, 0]}>
                        {payeeData.map((item) => (
                          <Cell key={item.bucketKey} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-surface-700 to-surface-500" />
            <div className="p-6">
              <SectionHeader
                icon={Landmark}
                title="Estado de cuentas"
                subtitle="Saldo y flujo neto de las cuentas con mayor peso"
              />
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-5">
                {accountSnapshot.map((account) => (
                  <div key={account.accountId} className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <p className="truncate text-sm font-semibold text-surface-900">{account.accountName}</p>
                    <p className={`mt-2 font-mono text-lg font-bold ${account.balance >= 0 ? "text-surface-900" : "text-danger-600"}`}>
                      {formatCurrency(account.balance)}
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-surface-500">
                      <p>Ingresos: <span className="font-semibold text-success-600">{formatCurrency(account.income)}</span></p>
                      <p>Gastos: <span className="font-semibold text-danger-600">{formatCurrency(account.expenses)}</span></p>
                      <p>Neto: <span className="font-semibold text-primary-600">{formatCurrency(account.net)}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

