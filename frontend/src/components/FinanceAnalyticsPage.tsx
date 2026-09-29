import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
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
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Filter,
  Landmark,
  Layers3,
  Maximize2,
  PiggyBank,
  RefreshCcw,
  Scale,
  Table2,
  Target,
  Wallet,
  X,
} from "lucide-react";
import {
  getAccounts,
  getCategories,
  getFinanceAnalytics,
  type FinanceAnalyticsAccountItem,
  type FinanceAnalyticsCategoryItem,
  type FinanceAnalyticsFilters,
  type FinanceAnalyticsGroupItem,
  type FinanceAnalyticsMonthBucket,
  type FinanceAnalyticsPayeeItem,
  type FinanceAnalyticsWeekdayItem,
} from "../lib/api";
import { Providers } from "./Providers";
import { formatCompact, formatCurrency, formatMonthLabel, formatPercent } from "../lib/format";
import { EmptyState } from "./ui/EmptyState";
import { ChartTooltip } from "./ui/ChartTooltip";
import { KpiCard } from "./ui/KpiCard";

const INCOME_COLOR = "#059669";
const EXPENSE_COLOR = "#dc2626";
const NET_COLOR = "#2563eb";
const CUMULATIVE_COLOR = "#0f766e";
const WEEKDAY_COLOR = "#c2410c";
const DEFAULT_PERIOD_PRESET = "12m";
const SERIES_COLORS = [
  "#0f766e",
  "#c2410c",
  "#2563eb",
  "#be123c",
  "#0891b2",
  "#a16207",
  "#15803d",
  "#7c3aed",
  "#475569",
  "#db2777",
  "#0284c7",
  "#ca8a04",
];

type PeriodPreset = "3m" | "6m" | "12m" | "ytd" | "all" | "custom";
type PanelKey =
  | "trend"
  | "cumulative"
  | "distribution"
  | "payees"
  | "weekday"
  | "stack"
  | "accounts"
  | "efficiency"
  | "compare"
  | "matrix";
type TrendMetric = "all" | "income" | "expenses" | "net" | "count" | "savingsRate";
type TrendView = "bars" | "area" | "line";
type DistributionMetric = "expense" | "income";
type DistributionScope = "category" | "group";
type DistributionView = "donut" | "bars";
type DistributionValue = "total" | "count" | "average";
type PayeeValue = "total" | "count" | "average";
type StackGrouping = "category" | "group";
type StackView = "bars" | "area";
type WeekdayMetric = "expense" | "income" | "net" | "count";
type WeekdayView = "radar" | "bars";
type AccountMetric = "balance" | "income" | "expenses" | "net" | "count";
type AccountView = "bars" | "donut";
type CumulativeMetric = "net" | "income" | "expenses" | "count";
type CumulativeView = "area" | "line";
type EfficiencyMetric = "savingsRate" | "avgMovement" | "netPerMovement" | "count";
type CompareScope = "group" | "category";
type CompareValue = "total" | "count" | "average";
type MatrixScope = "category" | "group";

interface PanelDefinition {
  title: string;
  subtitle: string;
  accent: string;
  controls?: ReactNode;
  renderContent: (expanded: boolean) => ReactNode;
}

interface DistributionDatum {
  key: string;
  label: string;
  shortLabel: string;
  parentLabel: string | null;
  total: number;
  count: number;
  percentage: number;
  value: number;
  share: number;
  color: string;
}

interface PayeeDatum {
  key: string;
  label: string;
  shortLabel: string;
  total: number;
  count: number;
  percentage: number;
  value: number;
  color: string;
}

interface CompareDatum {
  key: string;
  label: string;
  shortLabel: string;
  parentLabel: string | null;
  incomeTotal: number;
  expenseTotal: number;
  incomeCount: number;
  expenseCount: number;
  avgIncome: number;
  avgExpense: number;
  incomeValue: number;
  expenseValue: number;
  net: number;
}

interface MatrixRow {
  key: string;
  label: string;
  total: number;
  values: Array<{
    month: string;
    label: string;
    value: number;
  }>;
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function shortenLabel(value: string, maxLength = 18): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function formatCompactCount(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace("#", "");
  const normalized = sanitized.length === 3
    ? sanitized.split("").map((character) => character + character).join("")
    : sanitized;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getPresetRange(preset: Exclude<PeriodPreset, "custom">): { from?: string; to?: string } {
  const today = new Date();
  const end = formatDateInput(today);

  if (preset === "all") {
    return {};
  }

  if (preset === "ytd") {
    return { from: `${today.getFullYear()}-01-01`, to: end };
  }

  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  if (preset === "3m") start.setMonth(start.getMonth() - 2);
  if (preset === "6m") start.setMonth(start.getMonth() - 5);
  if (preset === "12m") start.setMonth(start.getMonth() - 11);

  return { from: formatDateInput(start), to: end };
}

function formatPeriodSummary(from: string, to: string): string {
  if (from && to) return `${formatDateLabel(from)} - ${formatDateLabel(to)}`;
  if (from) return `Desde ${formatDateLabel(from)}`;
  if (to) return `Hasta ${formatDateLabel(to)}`;
  return "Todo el histórico";
}

function getValueFormatter(mode: "currency" | "count" | "percent") {
  if (mode === "count") {
    return (value: number) => `${Math.round(value)} mov.`;
  }

  if (mode === "percent") {
    return (value: number) => formatPercent(value);
  }

  return (value: number) => formatCurrency(value);
}

function getTickFormatter(mode: "currency" | "count" | "percent") {
  if (mode === "count") {
    return (value: number) => formatCompactCount(value);
  }

  if (mode === "percent") {
    return (value: number) => `${Math.round(value)}%`;
  }

  return (value: number) => formatCompact(value);
}

function MetricPieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }> }) {
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

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AnalyticsPanel({
  title,
  subtitle,
  accent,
  controls,
  onExpand,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  controls?: ReactNode;
  onExpand?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      <div className={`h-1.5 bg-gradient-to-r ${accent}`} />
      <div className="p-5">
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {controls}
            {onExpand ? (
              <button
                type="button"
                onClick={onExpand}
                className="btn-secondary px-3 py-2 text-sm"
                aria-label={`Abrir grande ${title}`}
              >
                <Maximize2 className="h-4 w-4" /> Abrir grande
              </button>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExpandedChartDialog({
  title,
  subtitle,
  controls,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  controls?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="card max-h-[92vh] w-full max-w-[1400px] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost px-3 py-2 text-sm" aria-label="Cerrar gráfico ampliado">
            <X className="h-4 w-4" /> Cerrar
          </button>
        </div>
        {controls ? (
          <div className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">{controls}</div>
          </div>
        ) : null}
        <div className="max-h-[72vh] overflow-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function ChartPlaceholder({ message, height = 280 }: { message: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-muted px-6 text-center text-sm text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}

function MatrixHeatmap({
  months,
  rows,
  color,
  expanded,
}: {
  months: Array<{ month: string; label: string }>;
  rows: MatrixRow[];
  color: string;
  expanded: boolean;
}) {
  if (!rows.length) {
    return <ChartPlaceholder message="No hay datos suficientes para construir la matriz temporal." height={expanded ? 520 : 320} />;
  }

  const maxValue = Math.max(...rows.flatMap((row) => row.values.map((value) => value.value)), 0);
  const cellMinWidth = expanded ? 92 : 72;

  return (
    <div className="overflow-auto">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `minmax(180px, 220px) repeat(${months.length}, minmax(${cellMinWidth}px, 1fr))`,
          minWidth: `${220 + months.length * cellMinWidth}px`,
        }}
      >
        <div className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Serie</div>
        {months.map((month) => (
          <div key={month.month} className="px-1 py-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {month.label}
          </div>
        ))}

        {rows.map((row) => (
          <Fragment key={row.key}>
            <div key={`${row.key}-label`} className="rounded-2xl border border-border bg-muted px-3 py-3">
              <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(row.total)}</p>
            </div>
            {row.values.map((value) => {
              const intensity = maxValue > 0 ? value.value / maxValue : 0;
              return (
                <div
                  key={`${row.key}-${value.month}`}
                  title={`${row.label} · ${value.label}: ${formatCurrency(value.value)}`}
                  className="flex min-h-[74px] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center"
                  style={{
                    backgroundColor: hexToRgba(color, 0.08 + intensity * 0.82),
                    borderColor: hexToRgba(color, 0.16 + intensity * 0.24),
                  }}
                >
                  <span className="text-[11px] font-semibold text-muted-foreground">{value.value > 0 ? formatCompact(value.value) : "—"}</span>
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function FinanceAnalyticsView() {
  const defaultRange = useMemo(() => getPresetRange(DEFAULT_PERIOD_PRESET), []);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>(DEFAULT_PERIOD_PRESET);
  const [from, setFrom] = useState(defaultRange.from ?? "");
  const [to, setTo] = useState(defaultRange.to ?? "");
  const [accountId, setAccountId] = useState<number | undefined>();
  const [groupId, setGroupId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [expandedPanel, setExpandedPanel] = useState<PanelKey | null>(null);

  const [trendMetric, setTrendMetric] = useState<TrendMetric>("all");
  const [trendView, setTrendView] = useState<TrendView>("bars");
  const [distributionMetric, setDistributionMetric] = useState<DistributionMetric>("expense");
  const [distributionScope, setDistributionScope] = useState<DistributionScope>("category");
  const [distributionView, setDistributionView] = useState<DistributionView>("donut");
  const [distributionValue, setDistributionValue] = useState<DistributionValue>("total");
  const [distributionLimit, setDistributionLimit] = useState(8);
  const [payeeMetric, setPayeeMetric] = useState<DistributionMetric>("expense");
  const [payeeValue, setPayeeValue] = useState<PayeeValue>("total");
  const [payeeLimit, setPayeeLimit] = useState(8);
  const [stackGrouping, setStackGrouping] = useState<StackGrouping>("category");
  const [stackMetric, setStackMetric] = useState<DistributionMetric>("expense");
  const [stackView, setStackView] = useState<StackView>("bars");
  const [stackLimit, setStackLimit] = useState(5);
  const [weekdayMetric, setWeekdayMetric] = useState<WeekdayMetric>("expense");
  const [weekdayView, setWeekdayView] = useState<WeekdayView>("radar");
  const [accountMetric, setAccountMetric] = useState<AccountMetric>("balance");
  const [accountView, setAccountView] = useState<AccountView>("bars");
  const [accountLimit, setAccountLimit] = useState(6);
  const [cumulativeMetric, setCumulativeMetric] = useState<CumulativeMetric>("net");
  const [cumulativeView, setCumulativeView] = useState<CumulativeView>("area");
  const [efficiencyMetric, setEfficiencyMetric] = useState<EfficiencyMetric>("savingsRate");
  const [compareScope, setCompareScope] = useState<CompareScope>("group");
  const [compareValue, setCompareValue] = useState<CompareValue>("total");
  const [compareLimit, setCompareLimit] = useState(6);
  const [matrixScope, setMatrixScope] = useState<MatrixScope>("category");
  const [matrixMetric, setMatrixMetric] = useState<DistributionMetric>("expense");
  const [matrixLimit, setMatrixLimit] = useState(6);

  const { data: accounts = [], isLoading: loadingAccounts, error: accountsError } = useQuery({
    queryKey: ["accounts"],
    queryFn: getAccounts,
  });
  const { data: categoryGroups = [], isLoading: loadingCategories, error: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const analyticsFilters = useMemo<FinanceAnalyticsFilters>(() => ({
    from: from || undefined,
    to: to || undefined,
    accountId,
    groupId,
    categoryId,
  }), [from, to, accountId, groupId, categoryId]);

  const {
    data: analytics,
    isLoading: loadingAnalytics,
    isFetching,
    error: analyticsError,
    refetch,
  } = useQuery({
    queryKey: ["finance-analytics", analyticsFilters],
    queryFn: () => getFinanceAnalytics(analyticsFilters),
  });

  const flatCategories = useMemo(
    () => categoryGroups.flatMap((group) => group.categories.map((category) => ({ ...category, groupName: group.name }))),
    [categoryGroups],
  );

  useEffect(() => {
    if (!categoryId) return;
    const categoryStillVisible = flatCategories.some(
      (category) => category.id === categoryId && (!groupId || category.groupId === groupId),
    );
    if (!categoryStillVisible) {
      setCategoryId(undefined);
    }
  }, [categoryId, flatCategories, groupId]);

  useEffect(() => {
    if (weekdayMetric === "net" && weekdayView === "radar") {
      setWeekdayView("bars");
    }
  }, [weekdayMetric, weekdayView]);

  useEffect(() => {
    if (accountMetric === "net" && accountView === "donut") {
      setAccountView("bars");
    }
  }, [accountMetric, accountView]);

  useEffect(() => {
    if (!expandedPanel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpandedPanel(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expandedPanel]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );
  const selectedGroup = useMemo(
    () => categoryGroups.find((group) => group.id === groupId),
    [categoryGroups, groupId],
  );
  const selectedCategory = useMemo(
    () => flatCategories.find((category) => category.id === categoryId),
    [flatCategories, categoryId],
  );

  const periodDescription = formatPeriodSummary(from, to);
  const hasCustomDateRange = from !== (defaultRange.from ?? "") || to !== (defaultRange.to ?? "");
  const hasFiltersApplied = hasCustomDateRange || Boolean(accountId) || Boolean(groupId) || Boolean(categoryId);

  const monthlyChartData = useMemo(() => {
    return (analytics?.monthly ?? []).map((item) => {
      const savingsRate = item.income > 0 ? (item.net / item.income) * 100 : 0;
      const avgMovement = item.transactionCount > 0 ? (item.income + item.expenses) / item.transactionCount : 0;
      const netPerMovement = item.transactionCount > 0 ? item.net / item.transactionCount : 0;

      return {
        ...item,
        label: formatMonthLabel(item.month),
        count: item.transactionCount,
        savingsRate,
        avgMovement,
        netPerMovement,
      };
    });
  }, [analytics]);

  const cumulativeChartData = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let net = 0;
    let count = 0;

    return monthlyChartData.map((item) => {
      income += item.income;
      expenses += item.expenses;
      net += item.net;
      count += item.transactionCount;
      return {
        ...item,
        cumulativeIncome: income,
        cumulativeExpenses: expenses,
        cumulativeNet: net,
        cumulativeCount: count,
      };
    });
  }, [monthlyChartData]);

  const distributionData = useMemo(() => {
    const source = distributionScope === "category"
      ? analytics?.categories ?? []
      : analytics?.groups ?? [];

    const ranked = source
      .filter((item) => item.type === distributionMetric)
      .map((item) => {
        const label = distributionScope === "category"
          ? (item as FinanceAnalyticsCategoryItem).categoryName
          : (item as FinanceAnalyticsGroupItem).groupName;
        const parentLabel = distributionScope === "category"
          ? (item as FinanceAnalyticsCategoryItem).groupName
          : null;
        const value = distributionValue === "count"
          ? item.count
          : distributionValue === "average"
            ? item.total / Math.max(item.count, 1)
            : item.total;

        return {
          key: item.bucketKey,
          label,
          shortLabel: shortenLabel(label, 18),
          parentLabel,
          total: item.total,
          count: item.count,
          percentage: item.percentage,
          value,
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, distributionLimit);

    const totalValue = ranked.reduce((sum, item) => sum + item.value, 0);

    return ranked.map((item, index) => ({
      ...item,
      share: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    })) as DistributionDatum[];
  }, [analytics, distributionLimit, distributionMetric, distributionScope, distributionValue]);

  const payeeData = useMemo(() => {
    const ranked = (analytics?.payees ?? [])
      .filter((item) => item.type === payeeMetric)
      .map((item) => ({
        key: item.bucketKey,
        label: item.payee,
        shortLabel: shortenLabel(item.payee, 20),
        total: item.total,
        count: item.count,
        percentage: item.percentage,
        value: payeeValue === "count"
          ? item.count
          : payeeValue === "average"
            ? item.total / Math.max(item.count, 1)
            : item.total,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, payeeLimit);

    return ranked.map((item, index) => ({
      ...item,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    })) as PayeeDatum[];
  }, [analytics, payeeLimit, payeeMetric, payeeValue]);

  const stackTrend = useMemo(() => {
    const source = stackGrouping === "category"
      ? analytics?.categories ?? []
      : analytics?.groups ?? [];

    const rankedSeries = source
      .filter((item) => item.type === stackMetric)
      .slice(0, stackLimit)
      .map((item, index) => ({
        key: item.bucketKey,
        label: stackGrouping === "category"
          ? (item as FinanceAnalyticsCategoryItem).categoryName
          : (item as FinanceAnalyticsGroupItem).groupName,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      }));

    const sourceBuckets = stackGrouping === "category"
      ? analytics?.monthlyCategories ?? []
      : analytics?.monthlyGroups ?? [];
    const bucketKeys = new Set(rankedSeries.map((item) => item.key));
    const rowMap = new Map<string, Record<string, number | string>>();

    for (const month of analytics?.monthly ?? []) {
      const row: Record<string, number | string> = { month: month.month, label: formatMonthLabel(month.month) };
      for (const series of rankedSeries) {
        row[series.key] = 0;
      }
      rowMap.set(month.month, row);
    }

    for (const item of sourceBuckets) {
      if (item.type !== stackMetric || !bucketKeys.has(item.bucketKey)) continue;
      const row = rowMap.get(item.month);
      if (!row) continue;
      row[item.bucketKey] = item.total;
    }

    return {
      data: (analytics?.monthly ?? []).map((item) => rowMap.get(item.month) ?? { month: item.month, label: formatMonthLabel(item.month) }),
      series: rankedSeries,
    };
  }, [analytics, stackGrouping, stackLimit, stackMetric]);

  const weekdayChartData = useMemo(() => {
    return (analytics?.weekdays ?? []).map((item) => ({
      ...item,
      label: item.weekdayLabel,
      value: weekdayMetric === "expense"
        ? item.expenses
        : weekdayMetric === "income"
          ? item.income
          : weekdayMetric === "count"
            ? item.transactionCount
            : item.net,
    }));
  }, [analytics, weekdayMetric]);

  const accountChartData = useMemo(() => {
    const ordered = [...(analytics?.accounts ?? [])]
      .sort((left, right) => {
        const leftValue = accountMetric === "balance"
          ? Math.abs(left.balance)
          : accountMetric === "income"
            ? left.income
            : accountMetric === "expenses"
              ? left.expenses
              : accountMetric === "count"
                ? left.transactionCount
                : Math.abs(left.net);
        const rightValue = accountMetric === "balance"
          ? Math.abs(right.balance)
          : accountMetric === "income"
            ? right.income
            : accountMetric === "expenses"
              ? right.expenses
              : accountMetric === "count"
                ? right.transactionCount
                : Math.abs(right.net);

        return rightValue - leftValue;
      })
      .slice(0, accountLimit);

    return ordered.map((item, index) => ({
      ...item,
      label: item.accountName,
      shortLabel: shortenLabel(item.accountName, 18),
      value: accountMetric === "balance"
        ? item.balance
        : accountMetric === "income"
          ? item.income
          : accountMetric === "expenses"
            ? item.expenses
            : accountMetric === "count"
              ? item.transactionCount
              : item.net,
      color: item.color || SERIES_COLORS[index % SERIES_COLORS.length],
    }));
  }, [accountLimit, accountMetric, analytics]);

  const efficiencyChartData = useMemo(() => {
    return monthlyChartData.map((item) => ({
      ...item,
      displayMetric: efficiencyMetric === "savingsRate"
        ? item.savingsRate
        : efficiencyMetric === "avgMovement"
          ? item.avgMovement
          : efficiencyMetric === "netPerMovement"
            ? item.netPerMovement
            : item.count,
    }));
  }, [efficiencyMetric, monthlyChartData]);

  const compareData = useMemo(() => {
    const source = compareScope === "category"
      ? analytics?.categories ?? []
      : analytics?.groups ?? [];
    const compareMap = new Map<string, CompareDatum>();

    for (const item of source) {
      const key = compareScope === "category"
        ? `category:${(item as FinanceAnalyticsCategoryItem).categoryId ?? (item as FinanceAnalyticsCategoryItem).categoryName}`
        : `group:${(item as FinanceAnalyticsGroupItem).groupId ?? (item as FinanceAnalyticsGroupItem).groupName}`;
      const label = compareScope === "category"
        ? (item as FinanceAnalyticsCategoryItem).categoryName
        : (item as FinanceAnalyticsGroupItem).groupName;
      const parentLabel = compareScope === "category"
        ? (item as FinanceAnalyticsCategoryItem).groupName
        : null;

      const current = compareMap.get(key) ?? {
        key,
        label,
        shortLabel: shortenLabel(label, 18),
        parentLabel,
        incomeTotal: 0,
        expenseTotal: 0,
        incomeCount: 0,
        expenseCount: 0,
        avgIncome: 0,
        avgExpense: 0,
        incomeValue: 0,
        expenseValue: 0,
        net: 0,
      };

      if (item.type === "income") {
        current.incomeTotal += item.total;
        current.incomeCount += item.count;
      } else {
        current.expenseTotal += item.total;
        current.expenseCount += item.count;
      }

      compareMap.set(key, current);
    }

    const rows = Array.from(compareMap.values()).map((item) => {
      const avgIncome = item.incomeCount > 0 ? item.incomeTotal / item.incomeCount : 0;
      const avgExpense = item.expenseCount > 0 ? item.expenseTotal / item.expenseCount : 0;
      const incomeValue = compareValue === "count"
        ? item.incomeCount
        : compareValue === "average"
          ? avgIncome
          : item.incomeTotal;
      const expenseValue = compareValue === "count"
        ? item.expenseCount
        : compareValue === "average"
          ? avgExpense
          : item.expenseTotal;

      return {
        ...item,
        avgIncome,
        avgExpense,
        incomeValue,
        expenseValue,
        net: item.incomeTotal - item.expenseTotal,
      };
    });

    return rows
      .sort((left, right) => (right.incomeValue + right.expenseValue) - (left.incomeValue + left.expenseValue))
      .slice(0, compareLimit);
  }, [analytics, compareLimit, compareScope, compareValue]);

  const matrixData = useMemo(() => {
    const rankingSource = matrixScope === "category"
      ? analytics?.categories ?? []
      : analytics?.groups ?? [];
    const monthlySource = matrixScope === "category"
      ? analytics?.monthlyCategories ?? []
      : analytics?.monthlyGroups ?? [];

    const series = rankingSource
      .filter((item) => item.type === matrixMetric)
      .slice(0, matrixLimit)
      .map((item) => ({
        key: item.bucketKey,
        label: matrixScope === "category"
          ? (item as FinanceAnalyticsCategoryItem).categoryName
          : (item as FinanceAnalyticsGroupItem).groupName,
      }));

    const months = (analytics?.monthly ?? []).map((item) => ({ month: item.month, label: formatMonthLabel(item.month) }));
    const rows = series.map((seriesItem) => {
      const values = months.map((month) => {
        const match = monthlySource.find((item) => item.type === matrixMetric && item.month === month.month && item.bucketKey === seriesItem.key);
        return {
          month: month.month,
          label: month.label,
          value: match?.total ?? 0,
        };
      });

      return {
        key: seriesItem.key,
        label: seriesItem.label,
        total: values.reduce((sum, item) => sum + item.value, 0),
        values,
      };
    });

    return { months, rows };
  }, [analytics, matrixLimit, matrixMetric, matrixScope]);

  const topWeekday = useMemo(() => {
    const ordered = [...weekdayChartData].sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
    return ordered[0];
  }, [weekdayChartData]);

  const cumulativeDataKey = useMemo(() => {
    if (cumulativeMetric === "income") return "cumulativeIncome";
    if (cumulativeMetric === "expenses") return "cumulativeExpenses";
    if (cumulativeMetric === "count") return "cumulativeCount";
    return "cumulativeNet";
  }, [cumulativeMetric]);

  const loading = loadingAccounts || loadingCategories || loadingAnalytics;
  const error = accountsError || categoriesError || analyticsError;

  const applyPreset = (preset: Exclude<PeriodPreset, "custom">) => {
    const range = getPresetRange(preset);
    setPeriodPreset(preset);
    setFrom(range.from ?? "");
    setTo(range.to ?? "");
  };

  const resetFilters = () => {
    setAccountId(undefined);
    setGroupId(undefined);
    setCategoryId(undefined);
    applyPreset(DEFAULT_PERIOD_PRESET);
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="card p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-primary-500 to-primary-400" />
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="skeleton mb-2 h-4 w-28" />
            <div className="skeleton mb-3 h-10 w-72" />
            <div className="skeleton h-4 w-full max-w-2xl" />
            <div className="mt-6 flex flex-wrap gap-2">
              <div className="skeleton h-9 w-20 rounded-xl" />
              <div className="skeleton h-9 w-20 rounded-xl" />
              <div className="skeleton h-9 w-20 rounded-xl" />
              <div className="skeleton h-9 w-20 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card p-5">
              <div className="skeleton mb-3 h-10 w-10 rounded-xl" />
              <div className="skeleton mb-2 h-8 w-40" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="card p-5"><div className="skeleton h-[320px] w-full" /></div>
          <div className="card p-5"><div className="skeleton h-[320px] w-full" /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-8 text-center">
        <p className="text-lg font-semibold text-foreground">No se pudo cargar la analítica financiera</p>
        <p className="mt-2 text-sm text-muted-foreground">Revisa la conexión con la API o vuelve a intentarlo.</p>
        <button type="button" onClick={() => refetch()} className="btn-primary mt-5">
          <RefreshCcw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Sin datos financieros"
        description="Importa tus datos desde YNAB o crea cuentas y movimientos para activar la analítica."
        actionLabel="Importar datos"
        actionHref="/import"
      />
    );
  }

  if (!analytics) {
    return null;
  }

  const scopePills = [
    selectedAccount ? `Cuenta: ${selectedAccount.name}` : "Todas las cuentas",
    selectedGroup ? `Grupo: ${selectedGroup.name}` : null,
    selectedCategory ? `Categoría: ${selectedCategory.name}` : null,
    periodDescription,
  ].filter(Boolean) as string[];

  const hasTransactions = analytics.summary.transactionCount > 0;
  const positiveNet = analytics.summary.netTotal >= 0;
  const savingsTrend = analytics.summary.savingsRate > 0 ? "up" : analytics.summary.savingsRate < 0 ? "down" : "neutral";

  const trendValueMode = trendMetric === "count"
    ? "count"
    : trendMetric === "savingsRate"
      ? "percent"
      : "currency";
  const cumulativeValueMode = cumulativeMetric === "count" ? "count" : "currency";
  const distributionValueMode = distributionValue === "count" ? "count" : "currency";
  const payeeValueMode = payeeValue === "count" ? "count" : "currency";
  const weekdayValueMode = weekdayMetric === "count" ? "count" : "currency";
  const accountValueMode = accountMetric === "count" ? "count" : "currency";
  const efficiencyValueMode = efficiencyMetric === "savingsRate"
    ? "percent"
    : efficiencyMetric === "count"
      ? "count"
      : "currency";
  const compareValueMode = compareValue === "count" ? "count" : "currency";

  const renderTrendChart = (expanded: boolean) => {
    const height = expanded ? 520 : 340;
    const tickFormatter = getTickFormatter(trendValueMode);
    const valueFormatter = getValueFormatter(trendValueMode);
    const singleDataKey = trendMetric === "income"
      ? "income"
      : trendMetric === "expenses"
        ? "expenses"
        : trendMetric === "net"
          ? "net"
          : trendMetric === "count"
            ? "count"
            : trendMetric === "savingsRate"
              ? "savingsRate"
              : null;
    const singleColor = trendMetric === "income"
      ? INCOME_COLOR
      : trendMetric === "expenses"
        ? EXPENSE_COLOR
        : trendMetric === "net"
          ? NET_COLOR
          : trendMetric === "count"
            ? "#7c3aed"
            : "#0f766e";
    const singleLabel = trendMetric === "income"
      ? "Ingresos"
      : trendMetric === "expenses"
        ? "Gastos"
        : trendMetric === "net"
          ? "Flujo neto"
          : trendMetric === "count"
            ? "Movimientos"
            : "% ahorro";

    if (trendView === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Legend />
            {trendMetric === "all" ? (
              <>
                <Line type="monotone" dataKey="income" name="Ingresos" stroke={INCOME_COLOR} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="expenses" name="Gastos" stroke={EXPENSE_COLOR} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="net" name="Flujo neto" stroke={NET_COLOR} strokeWidth={3} dot={false} />
              </>
            ) : singleDataKey ? (
              <Line type="monotone" dataKey={singleDataKey} name={singleLabel} stroke={singleColor} strokeWidth={3} dot={false} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (trendView === "area") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={monthlyChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Legend />
            {trendMetric === "all" ? (
              <>
                <Area type="monotone" dataKey="income" name="Ingresos" stroke={INCOME_COLOR} fill={`${INCOME_COLOR}22`} strokeWidth={2.5} />
                <Area type="monotone" dataKey="expenses" name="Gastos" stroke={EXPENSE_COLOR} fill={`${EXPENSE_COLOR}20`} strokeWidth={2.5} />
                <Area type="monotone" dataKey="net" name="Flujo neto" stroke={NET_COLOR} fill={`${NET_COLOR}20`} strokeWidth={2.5} />
              </>
            ) : singleDataKey ? (
              <Area type="monotone" dataKey={singleDataKey} name={singleLabel} stroke={singleColor} fill={`${singleColor}22`} strokeWidth={2.5} />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={monthlyChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Legend />
          {trendMetric === "all" ? (
            <>
              <Bar dataKey="income" name="Ingresos" fill={INCOME_COLOR} radius={[8, 8, 0, 0]} />
              <Bar dataKey="expenses" name="Gastos" fill={EXPENSE_COLOR} radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="net" name="Flujo neto" stroke={NET_COLOR} strokeWidth={3} dot={false} />
            </>
          ) : singleDataKey ? (
            <Bar dataKey={singleDataKey} name={singleLabel} fill={singleColor} radius={[8, 8, 0, 0]} />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderCumulativeChart = (expanded: boolean) => {
    const height = expanded ? 500 : 320;
    const tickFormatter = getTickFormatter(cumulativeValueMode);
    const valueFormatter = getValueFormatter(cumulativeValueMode);

    if (cumulativeView === "line") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={cumulativeChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Line type="monotone" dataKey={cumulativeDataKey} name="Acumulado" stroke={CUMULATIVE_COLOR} strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={cumulativeChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Area type="monotone" dataKey={cumulativeDataKey} name="Acumulado" stroke={CUMULATIVE_COLOR} fill={`${CUMULATIVE_COLOR}22`} strokeWidth={2.5} />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const renderDistributionChart = (expanded: boolean) => {
    const height = expanded ? 500 : 320;
    const valueFormatter = getValueFormatter(distributionValueMode);
    const tickFormatter = getTickFormatter(distributionValueMode);

    if (distributionData.length === 0) {
      return <ChartPlaceholder message="No hay datos suficientes para esta combinación de variables." height={height} />;
    }

    if (distributionView === "donut") {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={distributionData} dataKey="value" nameKey="label" innerRadius={expanded ? 94 : 68} outerRadius={expanded ? 148 : 108} paddingAngle={3}>
                {distributionData.map((item) => (
                  <Cell key={item.key} fill={item.color} />
                ))}
              </Pie>
              <Tooltip content={<MetricPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {distributionData.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                  {item.parentLabel ? <p className="text-xs text-muted-foreground">{item.parentLabel}</p> : null}
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-foreground">{valueFormatter(item.value)}</p>
                  <p className="text-xs text-muted-foreground">{formatPercent(item.share)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={distributionData} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <YAxis type="category" dataKey="shortLabel" width={120} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Bar dataKey="value" name="Valor" radius={[0, 8, 8, 0]}>
            {distributionData.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderPayeesChart = (expanded: boolean) => {
    const height = expanded ? 500 : 320;
    const valueFormatter = getValueFormatter(payeeValueMode);
    const tickFormatter = getTickFormatter(payeeValueMode);

    if (payeeData.length === 0) {
      return <ChartPlaceholder message="No hay beneficiarios suficientes para esta combinación de variables." height={height} />;
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={payeeData} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <YAxis type="category" dataKey="shortLabel" width={120} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Bar dataKey="value" name="Valor" radius={[0, 8, 8, 0]}>
            {payeeData.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderWeekdayChart = (expanded: boolean) => {
    const height = expanded ? 500 : 320;
    const valueFormatter = getValueFormatter(weekdayValueMode);
    const tickFormatter = getTickFormatter(weekdayValueMode);

    if (weekdayChartData.every((item) => item.value === 0)) {
      return <ChartPlaceholder message="No hay patrón semanal para esta métrica con los filtros actuales." height={height} />;
    }

    if (weekdayView === "radar") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={weekdayChartData} outerRadius="72%">
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickFormatter={tickFormatter} />
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
            <Radar dataKey="value" name="Valor" stroke={WEEKDAY_COLOR} fill={`${WEEKDAY_COLOR}33`} fillOpacity={0.7} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={weekdayChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Bar dataKey="value" name="Valor" fill={WEEKDAY_COLOR} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderStackChart = (expanded: boolean) => {
    const height = expanded ? 520 : 340;

    if (stackTrend.series.length === 0) {
      return <ChartPlaceholder message="No hay suficientes series para apilar con esta configuración." height={height} />;
    }

    if (stackView === "area") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={stackTrend.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
            <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            <Legend />
            {stackTrend.series.map((series) => (
              <Area key={series.key} type="monotone" dataKey={series.key} stackId="stack" name={series.label} stroke={series.color} fill={`${series.color}44`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={stackTrend.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={formatCompact} />
          <Tooltip content={<ChartTooltip />} />
          <Legend />
          {stackTrend.series.map((series) => (
            <Bar key={series.key} dataKey={series.key} stackId="stack" name={series.label} fill={series.color} radius={[6, 6, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderAccountsChart = (expanded: boolean) => {
    const height = expanded ? 500 : 320;
    const valueFormatter = getValueFormatter(accountValueMode);
    const tickFormatter = getTickFormatter(accountValueMode);

    if (accountChartData.length === 0) {
      return <ChartPlaceholder message="No hay cuentas con datos para esta vista." height={height} />;
    }

    if (accountView === "donut" && accountMetric !== "net") {
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie data={accountChartData} dataKey="value" nameKey="label" innerRadius={expanded ? 92 : 68} outerRadius={expanded ? 146 : 110} paddingAngle={3}>
                {accountChartData.map((item, index) => (
                  <Cell key={`${item.accountId}-${index}`} fill={item.color || SERIES_COLORS[index % SERIES_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<MetricPieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-3">
            {accountChartData.map((item) => (
              <div key={item.accountId} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.transactionCount} movimientos</p>
                </div>
                <p className="font-mono text-sm font-semibold text-foreground">{valueFormatter(item.value)}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={accountChartData} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <YAxis type="category" dataKey="shortLabel" width={120} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          <Bar dataKey="value" name="Valor" radius={[0, 8, 8, 0]}>
            {accountChartData.map((item, index) => (
              <Cell key={`${item.accountId}-${index}`} fill={item.color || SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderEfficiencyChart = (expanded: boolean) => {
    const height = expanded ? 500 : 340;
    const valueFormatter = getValueFormatter(efficiencyValueMode);
    const tickFormatter = getTickFormatter(efficiencyValueMode);
    const secondaryFormatter = efficiencyMetric === "count"
      ? getValueFormatter("percent")
      : getValueFormatter("count");
    const secondaryTickFormatter = efficiencyMetric === "count"
      ? getTickFormatter("percent")
      : getTickFormatter("count");
    const secondaryDataKey = efficiencyMetric === "count" ? "savingsRate" : "count";
    const secondaryName = efficiencyMetric === "count" ? "% ahorro" : "Movimientos";

    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={efficiencyChartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={secondaryTickFormatter} />
          <Tooltip
            content={<ChartTooltip />}
            formatter={(value: number, name: string) => {
              if (name === secondaryName) {
                return secondaryFormatter(value);
              }
              return valueFormatter(value);
            }}
          />
          <Legend />
          <Bar yAxisId="left" dataKey="displayMetric" name="Métrica" fill="#7c3aed" radius={[8, 8, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey={secondaryDataKey} name={secondaryName} stroke="#f59e0b" strokeWidth={3} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderCompareChart = (expanded: boolean) => {
    const height = expanded ? 520 : 340;
    const valueFormatter = getValueFormatter(compareValueMode);
    const tickFormatter = getTickFormatter(compareValueMode);

    if (compareData.length === 0) {
      return <ChartPlaceholder message="No hay datos suficientes para esta comparativa." height={height} />;
    }

    const chartData = compareData.map((item) => ({
      ...item,
      incomeDisplay: item.incomeValue,
      expenseDisplay: item.expenseValue * -1,
    }));

    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <ReferenceLine x={0} stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" tickFormatter={tickFormatter} />
          <YAxis type="category" dataKey="shortLabel" width={130} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
          <Tooltip content={<ChartTooltip valueFormatter={(value) => valueFormatter(Math.abs(value))} />} />
          <Legend />
          <Bar dataKey="incomeDisplay" name="Ingresos" fill={INCOME_COLOR} radius={[0, 8, 8, 0]} />
          <Bar dataKey="expenseDisplay" name="Gastos" fill={EXPENSE_COLOR} radius={[8, 0, 0, 8]} />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderMatrixChart = (expanded: boolean) => {
    return (
      <MatrixHeatmap
        months={matrixData.months}
        rows={matrixData.rows}
        color={matrixMetric === "expense" ? EXPENSE_COLOR : INCOME_COLOR}
        expanded={expanded}
      />
    );
  };

  const trendControls = (
    <>
      <SegmentedControl
        value={trendMetric}
        onChange={(value) => setTrendMetric(value as TrendMetric)}
        options={[
          { value: "all", label: "Todo" },
          { value: "income", label: "Ingresos" },
          { value: "expenses", label: "Gastos" },
          { value: "net", label: "Neto" },
          { value: "count", label: "Mov." },
          { value: "savingsRate", label: "% ahorro" },
        ]}
      />
      <SegmentedControl
        value={trendView}
        onChange={(value) => setTrendView(value as TrendView)}
        options={[
          { value: "bars", label: "Barras" },
          { value: "area", label: "Área" },
          { value: "line", label: "Líneas" },
        ]}
      />
    </>
  );

  const cumulativeControls = (
    <>
      <SegmentedControl
        value={cumulativeMetric}
        onChange={(value) => setCumulativeMetric(value as CumulativeMetric)}
        options={[
          { value: "net", label: "Neto" },
          { value: "income", label: "Ingresos" },
          { value: "expenses", label: "Gastos" },
          { value: "count", label: "Mov." },
        ]}
      />
      <SegmentedControl
        value={cumulativeView}
        onChange={(value) => setCumulativeView(value as CumulativeView)}
        options={[
          { value: "area", label: "Área" },
          { value: "line", label: "Línea" },
        ]}
      />
    </>
  );

  const distributionControls = (
    <>
      <SegmentedControl
        value={distributionMetric}
        onChange={(value) => setDistributionMetric(value as DistributionMetric)}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
        ]}
      />
      <SegmentedControl
        value={distributionScope}
        onChange={(value) => setDistributionScope(value as DistributionScope)}
        options={[
          { value: "category", label: "Categoría" },
          { value: "group", label: "Grupo" },
        ]}
      />
      <SegmentedControl
        value={distributionValue}
        onChange={(value) => setDistributionValue(value as DistributionValue)}
        options={[
          { value: "total", label: "Importe" },
          { value: "count", label: "Frecuencia" },
          { value: "average", label: "Media" },
        ]}
      />
      <SegmentedControl
        value={distributionView}
        onChange={(value) => setDistributionView(value as DistributionView)}
        options={[
          { value: "donut", label: "Donut" },
          { value: "bars", label: "Barras" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de series de distribución" value={distributionLimit} onChange={(event) => setDistributionLimit(Number(event.target.value))}>
        <option value={5}>Top 5</option>
        <option value={8}>Top 8</option>
        <option value={12}>Top 12</option>
      </select>
    </>
  );

  const payeeControls = (
    <>
      <SegmentedControl
        value={payeeMetric}
        onChange={(value) => setPayeeMetric(value as DistributionMetric)}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
        ]}
      />
      <SegmentedControl
        value={payeeValue}
        onChange={(value) => setPayeeValue(value as PayeeValue)}
        options={[
          { value: "total", label: "Importe" },
          { value: "count", label: "Frecuencia" },
          { value: "average", label: "Media" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de beneficiarios" value={payeeLimit} onChange={(event) => setPayeeLimit(Number(event.target.value))}>
        <option value={5}>Top 5</option>
        <option value={8}>Top 8</option>
        <option value={12}>Top 12</option>
      </select>
    </>
  );

  const weekdayControls = (
    <>
      <SegmentedControl
        value={weekdayMetric}
        onChange={(value) => setWeekdayMetric(value as WeekdayMetric)}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
          { value: "net", label: "Neto" },
          { value: "count", label: "Mov." },
        ]}
      />
      <SegmentedControl
        value={weekdayView}
        onChange={(value) => setWeekdayView(value as WeekdayView)}
        options={[
          { value: "radar", label: "Radar" },
          { value: "bars", label: "Barras" },
        ]}
      />
    </>
  );

  const stackControls = (
    <>
      <SegmentedControl
        value={stackGrouping}
        onChange={(value) => setStackGrouping(value as StackGrouping)}
        options={[
          { value: "category", label: "Categoría" },
          { value: "group", label: "Grupo" },
        ]}
      />
      <SegmentedControl
        value={stackMetric}
        onChange={(value) => setStackMetric(value as DistributionMetric)}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
        ]}
      />
      <SegmentedControl
        value={stackView}
        onChange={(value) => setStackView(value as StackView)}
        options={[
          { value: "bars", label: "Barras" },
          { value: "area", label: "Área" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de series apiladas" value={stackLimit} onChange={(event) => setStackLimit(Number(event.target.value))}>
        <option value={3}>Top 3</option>
        <option value={5}>Top 5</option>
        <option value={8}>Top 8</option>
      </select>
    </>
  );

  const accountControls = (
    <>
      <SegmentedControl
        value={accountMetric}
        onChange={(value) => {
          const nextMetric = value as AccountMetric;
          setAccountMetric(nextMetric);
          if (nextMetric === "net" && accountView === "donut") {
            setAccountView("bars");
          }
        }}
        options={[
          { value: "balance", label: "Saldo" },
          { value: "income", label: "Ingresos" },
          { value: "expenses", label: "Gastos" },
          { value: "net", label: "Neto" },
          { value: "count", label: "Mov." },
        ]}
      />
      <SegmentedControl
        value={accountView}
        onChange={(value) => {
          if (accountMetric === "net" && value === "donut") return;
          setAccountView(value as AccountView);
        }}
        options={[
          { value: "bars", label: "Barras" },
          { value: "donut", label: "Donut" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de cuentas visibles" value={accountLimit} onChange={(event) => setAccountLimit(Number(event.target.value))}>
        <option value={4}>Top 4</option>
        <option value={6}>Top 6</option>
        <option value={8}>Top 8</option>
      </select>
    </>
  );

  const efficiencyControls = (
    <SegmentedControl
      value={efficiencyMetric}
      onChange={(value) => setEfficiencyMetric(value as EfficiencyMetric)}
      options={[
        { value: "savingsRate", label: "% ahorro" },
        { value: "avgMovement", label: "Media mov." },
        { value: "netPerMovement", label: "Neto/mov." },
        { value: "count", label: "Movimientos" },
      ]}
    />
  );

  const compareControls = (
    <>
      <SegmentedControl
        value={compareScope}
        onChange={(value) => setCompareScope(value as CompareScope)}
        options={[
          { value: "group", label: "Grupo" },
          { value: "category", label: "Categoría" },
        ]}
      />
      <SegmentedControl
        value={compareValue}
        onChange={(value) => setCompareValue(value as CompareValue)}
        options={[
          { value: "total", label: "Importe" },
          { value: "count", label: "Frecuencia" },
          { value: "average", label: "Media" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de filas comparativas" value={compareLimit} onChange={(event) => setCompareLimit(Number(event.target.value))}>
        <option value={4}>Top 4</option>
        <option value={6}>Top 6</option>
        <option value={8}>Top 8</option>
      </select>
    </>
  );

  const matrixControls = (
    <>
      <SegmentedControl
        value={matrixScope}
        onChange={(value) => setMatrixScope(value as MatrixScope)}
        options={[
          { value: "category", label: "Categoría" },
          { value: "group", label: "Grupo" },
        ]}
      />
      <SegmentedControl
        value={matrixMetric}
        onChange={(value) => setMatrixMetric(value as DistributionMetric)}
        options={[
          { value: "expense", label: "Gasto" },
          { value: "income", label: "Ingreso" },
        ]}
      />
      <select className="input w-auto min-w-[92px] py-2 text-sm" aria-label="Cantidad de series en la matriz" value={matrixLimit} onChange={(event) => setMatrixLimit(Number(event.target.value))}>
        <option value={4}>Top 4</option>
        <option value={6}>Top 6</option>
        <option value={8}>Top 8</option>
      </select>
    </>
  );

  const panelDefinitions: Record<PanelKey, PanelDefinition> = {
    trend: {
      title: "Pulso mensual",
      subtitle: "Compara ingresos, gastos, flujo neto, volumen y porcentaje de ahorro.",
      accent: "from-sky-500 to-cyan-400",
      controls: trendControls,
      renderContent: renderTrendChart,
    },
    cumulative: {
      title: "Acumulado",
      subtitle: "Mide la pendiente real del periodo y la progresión del volumen de actividad.",
      accent: "from-emerald-500 to-teal-400",
      controls: cumulativeControls,
      renderContent: renderCumulativeChart,
    },
    distribution: {
      title: "Distribución",
      subtitle: "Alterna entre categorías o grupos y cambia la variable que define el ranking.",
      accent: "from-amber-500 to-orange-400",
      controls: distributionControls,
      renderContent: renderDistributionChart,
    },
    payees: {
      title: payeeMetric === "expense" ? "Beneficiarios principales" : "Orígenes principales",
      subtitle: "Ya no sólo por importe: también por frecuencia o ticket medio.",
      accent: "from-rose-500 to-pink-400",
      controls: payeeControls,
      renderContent: renderPayeesChart,
    },
    weekday: {
      title: "Ritmo semanal",
      subtitle: "Lee la concentración por día con gasto, ingreso, neto o volumen de movimientos.",
      accent: "from-violet-500 to-indigo-400",
      controls: weekdayControls,
      renderContent: renderWeekdayChart,
    },
    stack: {
      title: stackGrouping === "category" ? "Tendencia mensual por categoría" : "Tendencia mensual por grupo",
      subtitle: "Apila focos y cambia entre lectura en barras o áreas para ver el peso temporal.",
      accent: "from-cyan-500 to-sky-400",
      controls: stackControls,
      renderContent: renderStackChart,
    },
    accounts: {
      title: "Peso por cuenta",
      subtitle: "Abre el mapa financiero por saldo, ingresos, gastos, neto o volumen.",
      accent: "from-slate-700 to-slate-500",
      controls: accountControls,
      renderContent: renderAccountsChart,
    },
    efficiency: {
      title: "Eficiencia mensual",
      subtitle: "Sigue la calidad del periodo con ahorro, media por movimiento y densidad de actividad.",
      accent: "from-emerald-600 to-lime-500",
      controls: efficiencyControls,
      renderContent: renderEfficiencyChart,
    },
    compare: {
      title: "Comparativa ingreso/gasto",
      subtitle: "Enfrenta ambas direcciones de flujo por grupo o categoría en una sola lectura.",
      accent: "from-fuchsia-500 to-rose-400",
      controls: compareControls,
      renderContent: renderCompareChart,
    },
    matrix: {
      title: "Matriz temporal",
      subtitle: "Detecta de un vistazo qué series empujan cada mes y dónde aparecen picos.",
      accent: "from-slate-600 to-slate-400",
      controls: matrixControls,
      renderContent: renderMatrixChart,
    },
  };

  const expandedDefinition = expandedPanel ? panelDefinitions[expandedPanel] : null;

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        <div className="card overflow-hidden p-0">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
          <div className="bg-gradient-to-br from-primary-50 via-background to-accent-50 dark:from-primary-500/10 dark:via-background dark:to-accent-500/10 px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary-700 dark:text-primary-400 shadow-sm ring-1 ring-primary-100 dark:ring-primary-500/20">
                  <BarChart3 className="h-3.5 w-3.5" /> Analítica financiera
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Lectura completa, ampliable y mucho más configurable</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Cada panel puede abrirse en grande, casi todos admiten más variables y el tablero añade comparativas, métricas de eficiencia y matriz temporal para explorar patrones que antes no se veían.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {scopePills.map((pill) => (
                    <span key={pill} className="badge bg-background text-foreground shadow-sm ring-1 ring-border">
                      {pill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl bg-background/85 p-4 shadow-sm ring-1 ring-border">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Estado</p>
                  {isFetching ? (
                    <span className="badge bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">Actualizando</span>
                  ) : (
                    <span className="badge bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500">Sincronizado</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-foreground">{analytics.summary.visibleMonths}</span>
                  <span className="text-sm text-muted-foreground">meses visibles</span>
                </div>
                <p className="text-sm text-muted-foreground">{analytics.summary.transactionCount} movimientos analizados.</p>
                <button type="button" onClick={() => refetch()} className="btn-secondary mt-1 text-sm" disabled={isFetching}>
                  <RefreshCcw className="h-4 w-4" /> Actualizar
                </button>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { value: "3m", label: "3M" },
                    { value: "6m", label: "6M" },
                    { value: "12m", label: "12M" },
                    { value: "ytd", label: "YTD" },
                    { value: "all", label: "Todo" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => applyPreset(preset.value as Exclude<PeriodPreset, "custom">)}
                      className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        periodPreset === preset.value
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="finance-account-filter">Cuenta</label>
                    <select
                      id="finance-account-filter"
                      className="input text-sm"
                      value={accountId ?? ""}
                      onChange={(event) => setAccountId(event.target.value ? Number(event.target.value) : undefined)}
                    >
                      <option value="">Todas las cuentas</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="finance-group-filter">Grupo</label>
                    <select
                      id="finance-group-filter"
                      className="input text-sm"
                      value={groupId ?? ""}
                      onChange={(event) => {
                        const nextGroupId = event.target.value ? Number(event.target.value) : undefined;
                        setGroupId(nextGroupId);
                        if (!nextGroupId) return;
                        if (!flatCategories.some((category) => category.id === categoryId && category.groupId === nextGroupId)) {
                          setCategoryId(undefined);
                        }
                      }}
                    >
                      <option value="">Todos los grupos</option>
                      {categoryGroups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="finance-category-filter">Categoría</label>
                    <select
                      id="finance-category-filter"
                      className="input text-sm"
                      value={categoryId ?? ""}
                      onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : undefined)}
                    >
                      <option value="">Todas las categorías</option>
                      {(groupId ? categoryGroups.filter((group) => group.id === groupId) : categoryGroups).map((group) => (
                        <optgroup key={group.id} label={group.name}>
                          {group.categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="finance-date-from">Desde</label>
                    <input
                      id="finance-date-from"
                      type="date"
                      className="input text-sm"
                      value={from}
                      onChange={(event) => {
                        setPeriodPreset("custom");
                        setFrom(event.target.value);
                      }}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground" htmlFor="finance-date-to">Hasta</label>
                    <input
                      id="finance-date-to"
                      type="date"
                      className="input text-sm"
                      value={to}
                      onChange={(event) => {
                        setPeriodPreset("custom");
                        setTo(event.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>Los filtros globales recalculan todo el tablero y los gráficos ampliados.</span>
                  </div>
                  {hasFiltersApplied ? (
                    <button type="button" onClick={resetFilters} className="font-semibold text-primary-600 hover:text-primary-800">
                      Limpiar filtros
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="Saldo actual"
            value={formatCurrency(analytics.summary.totalBalance)}
            subValue={selectedAccount ? selectedAccount.name : "Cuentas activas"}
            icon={Wallet}
            color="primary"
          />
          <KpiCard
            label="Ingresos del periodo"
            value={formatCurrency(analytics.summary.incomeTotal)}
            subValue={`Media ${formatCurrency(analytics.summary.monthlyAverageIncome)} por mes`}
            icon={ArrowUpRight}
            color="success"
          />
          <KpiCard
            label="Gastos del periodo"
            value={formatCurrency(analytics.summary.expenseTotal)}
            subValue={`Media ${formatCurrency(analytics.summary.monthlyAverageExpenses)} por mes`}
            icon={ArrowDownRight}
            color="danger"
          />
          <KpiCard
            label="Flujo neto"
            value={formatCurrency(analytics.summary.netTotal)}
            subValue={`${analytics.summary.transactionCount} movimientos`}
            icon={Scale}
            color={positiveNet ? "success" : "danger"}
            trend={positiveNet ? "up" : analytics.summary.netTotal < 0 ? "down" : "neutral"}
            trendValue={formatCurrency(Math.abs(analytics.summary.netTotal))}
          />
          <KpiCard
            label="Mes más gastador"
            value={analytics.summary.topExpenseMonth ? formatCurrency(analytics.summary.topExpenseMonth.total) : "—"}
            subValue={analytics.summary.topExpenseMonth ? formatMonthLabel(analytics.summary.topExpenseMonth.month) : "Sin gasto en el rango"}
            icon={CalendarRange}
            color="danger"
          />
          <KpiCard
            label="Tasa de ahorro"
            value={analytics.summary.incomeTotal > 0 ? formatPercent(analytics.summary.savingsRate) : "—"}
            subValue={analytics.summary.topIncomeMonth ? `Pico de ingresos: ${formatMonthLabel(analytics.summary.topIncomeMonth.month)}` : "Sin ingresos en el rango"}
            icon={PiggyBank}
            color="accent"
            trend={savingsTrend}
            trendValue={analytics.summary.incomeTotal > 0 ? formatPercent(Math.abs(analytics.summary.savingsRate)) : undefined}
          />
        </div>

        {!hasTransactions ? (
          <div className="card p-8 text-center">
            <p className="text-lg font-semibold text-foreground">No hay movimientos conciliados para esta selección</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajusta el rango, cambia la categoría o revisa los movimientos pendientes si esperabas ver actividad aquí.
            </p>
            {hasFiltersApplied ? (
              <button type="button" onClick={resetFilters} className="btn-primary mt-5">
                Ver últimos 12 meses
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <AnalyticsPanel {...panelDefinitions.trend} onExpand={() => setExpandedPanel("trend")}>
              {panelDefinitions.trend.renderContent(false)}
            </AnalyticsPanel>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AnalyticsPanel {...panelDefinitions.cumulative} onExpand={() => setExpandedPanel("cumulative")}>
                {panelDefinitions.cumulative.renderContent(false)}
              </AnalyticsPanel>
              <AnalyticsPanel {...panelDefinitions.distribution} onExpand={() => setExpandedPanel("distribution")}>
                {panelDefinitions.distribution.renderContent(false)}
              </AnalyticsPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AnalyticsPanel {...panelDefinitions.payees} onExpand={() => setExpandedPanel("payees")}>
                {panelDefinitions.payees.renderContent(false)}
              </AnalyticsPanel>
              <AnalyticsPanel {...panelDefinitions.weekday} onExpand={() => setExpandedPanel("weekday")}>
                {panelDefinitions.weekday.renderContent(false)}
              </AnalyticsPanel>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AnalyticsPanel {...panelDefinitions.efficiency} onExpand={() => setExpandedPanel("efficiency")}>
                {panelDefinitions.efficiency.renderContent(false)}
              </AnalyticsPanel>
              <AnalyticsPanel {...panelDefinitions.compare} onExpand={() => setExpandedPanel("compare")}>
                {panelDefinitions.compare.renderContent(false)}
              </AnalyticsPanel>
            </div>

            <AnalyticsPanel {...panelDefinitions.stack} onExpand={() => setExpandedPanel("stack")}>
              {panelDefinitions.stack.renderContent(false)}
            </AnalyticsPanel>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AnalyticsPanel {...panelDefinitions.accounts} onExpand={() => setExpandedPanel("accounts")}>
                {panelDefinitions.accounts.renderContent(false)}
              </AnalyticsPanel>
              <AnalyticsPanel {...panelDefinitions.matrix} onExpand={() => setExpandedPanel("matrix")}>
                {panelDefinitions.matrix.renderContent(false)}
              </AnalyticsPanel>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Foco</p>
                    <p className="text-sm font-semibold text-foreground">Serie dominante</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">{distributionData[0]?.label ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {distributionData[0]
                    ? `${getValueFormatter(distributionValueMode)(distributionData[0].value)} · ${formatPercent(distributionData[0].share)}`
                    : "Sin serie dominante"}
                </p>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cadencia</p>
                    <p className="text-sm font-semibold text-foreground">Día dominante</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">{topWeekday?.label ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {topWeekday ? getValueFormatter(weekdayValueMode)(Math.abs(topWeekday.value)) : "Sin patrón semanal"}
                </p>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-400">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Mix</p>
                    <p className="text-sm font-semibold text-foreground">Series activas</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">{stackTrend.series.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stackGrouping === "category" ? "Categorías" : "Grupos"} visibles en el apilado.</p>
              </div>

              <div className="card p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Cuenta líder</p>
                    <p className="text-sm font-semibold text-foreground">Mayor peso</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-foreground">{accountChartData[0]?.label ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {accountChartData[0] ? getValueFormatter(accountValueMode)(accountChartData[0].value) : "Sin datos de cuenta"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {expandedDefinition ? (
        <ExpandedChartDialog
          title={expandedDefinition.title}
          subtitle={expandedDefinition.subtitle}
          controls={expandedDefinition.controls}
          onClose={() => setExpandedPanel(null)}
        >
          {expandedDefinition.renderContent(true)}
        </ExpandedChartDialog>
      ) : null}
    </>
  );
}

export default function FinanceAnalyticsPage() {
  return (
    <Providers>
      <FinanceAnalyticsView />
    </Providers>
  );
}