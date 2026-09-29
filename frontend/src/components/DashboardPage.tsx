import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, Calendar, FileText,
  BarChart3, PieChart as PieIcon,
  Activity, Filter, Wallet, Shield, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { getDashboard, getProfiles, type DashboardData } from "../lib/api";
import { Providers } from "./Providers";
import { formatCurrency, formatCompact, formatMonthLabel } from "../lib/format";
import { ChartTooltip } from "./ui/ChartTooltip";
import { ProfileSelector } from "./ui/ProfileSelector";
import { EmptyState } from "./ui/EmptyState";
import { KpiCard } from "./ui/KpiCard";
import { SectionHeader } from "./ui/SectionHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

// ─── Design tokens ──────────────────────────────────────────────
const CHART_COLORS = [
  "#1e40af", "#3b82f6", "#60a5fa", "#93c5fd",
  "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6",
];

const DEFAULT_RANGE_FROM = "2021-11";

// Tooltip siempre oscuro a propósito (como ChartTooltip.tsx) — contraste
// garantizado contra cualquier color de serie, en ambos temas de la app.
const DASHBOARD_TOOLTIP_CONTENT_STYLE = {
  background: "#0f172a",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  fontSize: "12px",
  padding: "8px 12px",
};

const DASHBOARD_TOOLTIP_ITEM_STYLE = {
  color: "#fff",
};

const DASHBOARD_TOOLTIP_LABEL_STYLE = {
  color: "#cbd5e1",
};

// Colores de ejes/rejilla leídos de las custom properties de Tailwind en
// tiempo de ejecución (ver global.css) para que los charts de Recharts
// (SVG, fuera del alcance de `dark:`) seiguen el tema activo.
const CHART_GRID = "var(--color-border)";
const CHART_AXIS = "var(--color-muted-foreground)";

type ConceptBreakdownItem = DashboardData["conceptBreakdown"][number];
type ConceptSortColumn = "name" | "category" | "average" | "total" | "count";
type SortDirection = "asc" | "desc";

const CONCEPT_CATEGORY_LABELS: Record<string, string> = {
  devengo: "Devengo",
  deduccion: "Deducción",
};

function getConceptCategoryLabel(category: string): string {
  return CONCEPT_CATEGORY_LABELS[category] ?? "Otros";
}

function getConceptSortDirection(column: ConceptSortColumn): SortDirection {
  return column === "name" || column === "category" ? "asc" : "desc";
}

function compareConceptRows(left: ConceptBreakdownItem, right: ConceptBreakdownItem, column: ConceptSortColumn): number {
  switch (column) {
    case "name":
      return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    case "category":
      return getConceptCategoryLabel(left.category).localeCompare(getConceptCategoryLabel(right.category), "es", { sensitivity: "base" });
    case "average":
      return left.average - right.average;
    case "total":
      return left.total - right.total;
    case "count":
      return left.count - right.count;
    default:
      return 0;
  }
}

interface SortIndicatorProps {
  active: boolean;
  direction: SortDirection;
}

function SortIndicator({ active, direction }: SortIndicatorProps) {
  if (!active) {
    return <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />;
  }

  return direction === "asc"
    ? <ArrowUp className="w-3.5 h-3.5" />
    : <ArrowDown className="w-3.5 h-3.5" />;
}

function toMonthIndex(month: string): number | null {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return year * 12 + (monthNumber - 1);
}

function fromMonthIndex(monthIndex: number): string {
  const year = Math.floor(monthIndex / 12);
  const monthNumber = (monthIndex % 12) + 1;
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

function buildContinuousMonths(months: string[]): string[] {
  const monthIndices = months
    .map(toMonthIndex)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  if (monthIndices.length === 0) {
    return [];
  }

  const uniqueMonthIndices = Array.from(new Set(monthIndices));
  const firstMonth = uniqueMonthIndices[0];
  const lastMonth = uniqueMonthIndices[uniqueMonthIndices.length - 1];
  const continuousMonths: string[] = [];

  for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
    continuousMonths.push(fromMonthIndex(monthIndex));
  }

  return continuousMonths;
}

function buildAvailableMonths(evolution: DashboardData["evolution"] | undefined): string[] {
  if (!evolution) {
    return [];
  }

  const months = new Set<string>();

  Object.values(evolution).forEach((entries) => {
    entries.forEach((entry) => {
      months.add(entry.month);
    });
  });

  return Array.from(months).sort((left, right) => {
    const leftIndex = toMonthIndex(left) ?? 0;
    const rightIndex = toMonthIndex(right) ?? 0;
    return leftIndex - rightIndex;
  });
}

// ─── Skeleton ───────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="animate-fade-in space-y-8">
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-10 w-56 mb-4" />
          <div className="flex gap-2.5">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </Card>
      <Card className="p-6">
        <Skeleton className="h-5 w-40 mb-4" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </Card>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────
function DashboardView() {
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const [selectedProfiles, setSelectedProfiles] = useState<number[]>([]);
  const [chartType, setChartType] = useState<"area" | "line">("area");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState(DEFAULT_RANGE_FROM);
  const [rangeTo, setRangeTo] = useState("");
  const [conceptSort, setConceptSort] = useState<{ column: ConceptSortColumn; direction: SortDirection }>({
    column: "total",
    direction: "desc",
  });

  const profileIds = selectedProfiles.length > 0 ? selectedProfiles : profiles.map((p) => p.id);

  const { data: fullDashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ["dashboard", profileIds],
    queryFn: () => getDashboard(profileIds),
    enabled: profiles.length > 0,
  });

  const availableMonths = useMemo(
    () => buildAvailableMonths(fullDashboardData?.evolution),
    [fullDashboardData],
  );

  const selectedRangeFrom = rangeFrom && availableMonths.includes(rangeFrom) ? rangeFrom : "";
  const selectedRangeTo = rangeTo && availableMonths.includes(rangeTo) ? rangeTo : "";
  const hasDateFilter = Boolean(selectedRangeFrom || selectedRangeTo);

  const { data: filteredDashboardData, isLoading: isFilteredDashboardLoading, isFetching: isFilteredDashboardFetching } = useQuery({
    queryKey: ["dashboard", profileIds, selectedRangeFrom || null, selectedRangeTo || null],
    queryFn: () => getDashboard(profileIds, selectedRangeFrom || undefined, selectedRangeTo || undefined),
    enabled: profiles.length > 0 && hasDateFilter,
  });

  const data = hasDateFilter ? filteredDashboardData ?? fullDashboardData : fullDashboardData;
  const isLoading = !data && (isDashboardLoading || isFilteredDashboardLoading);

  const handleRangeFromChange = (value: string) => {
    setRangeFrom(value);
    setRangeTo((current) => {
      if (!current || !value || current >= value) {
        return current;
      }

      return value;
    });
  };

  const handleRangeToChange = (value: string) => {
    setRangeTo(value);
    setRangeFrom((current) => {
      if (!current || !value || current <= value) {
        return current;
      }

      return value;
    });
  };

  const clearDateRange = () => {
    setRangeFrom("");
    setRangeTo("");
  };

  const activeRangeLabel = availableMonths.length > 0
    ? `${formatMonthLabel(selectedRangeFrom || availableMonths[0])} - ${formatMonthLabel(selectedRangeTo || availableMonths[availableMonths.length - 1])}`
    : "Todo el histórico";

  // ─── Derived data ───────────────────────────────────────────
  const {
    evolutionData, profileNames, profileColors,
    topDevengos, topDeducciones, radarData,
    monthlyNetData, retentionRate,
  } = useMemo(() => {
    if (!data) return {
      evolutionData: [], profileNames: [], profileColors: {} as Record<string, string>,
      topDevengos: [] as DashboardData["conceptBreakdown"],
      topDeducciones: [] as DashboardData["conceptBreakdown"],
      radarData: [] as Array<{ concept: string; fullName: string; amount: number }>,
      monthlyNetData: [] as Array<{ month: string; monthLabel: string; net: number }>,
      retentionRate: 0,
    };

    // Evolution
    const allMonths = new Set<string>();
    Object.values(data.evolution).forEach((entries) =>
      entries.forEach((e) => allMonths.add(e.month))
    );
    const sorted = buildContinuousMonths(Array.from(allMonths));

    const evoData = sorted.map((month) => {
      const point: Record<string, string | number | null> = {
        month,
        monthLabel: formatMonthLabel(month),
      };
      Object.entries(data.evolution).forEach(([profileName, entries]) => {
        const entry = entries.find((e) => e.month === month);
        const gross = entry?.gross ?? 0;
        const net = entry?.net ?? 0;
        point[`${profileName}_bruto`] = gross;
        point[`${profileName}_neto`] = net;
        point[`${profileName}_diff`] = gross - net;
      });
      return point;
    });

    const names = Object.keys(data.evolution);
    const colors: Record<string, string> = {};
    data.profiles.forEach((p) => { colors[p.name] = p.color; });

    const devengos = data.conceptBreakdown
      .filter((c) => c.category === "devengo")
      .sort((a, b) => b.average - a.average)
      .slice(0, 8);

    const deducciones = data.conceptBreakdown
      .filter((c) => c.category === "deduccion")
      .sort((a, b) => b.average - a.average)
      .slice(0, 8);

    const radar = deducciones.map((c) => ({
      concept: c.name.length > 12 ? c.name.substring(0, 12) + "…" : c.name,
      fullName: c.name,
      amount: c.average,
    }));

    const monthlyNet = sorted.map((month) => {
      let total = 0;
      Object.values(data.evolution).forEach((entries) => {
        const entry = entries.find((e) => e.month === month);
        total += entry?.net ?? 0;
      });
      return { month, monthLabel: formatMonthLabel(month), net: total };
    });

    const retention = data.kpis.avgGross > 0
      ? ((data.kpis.avgNet / data.kpis.avgGross) * 100)
      : 0;

    return {
      evolutionData: evoData,
      profileNames: names,
      profileColors: colors,
      topDevengos: devengos,
      topDeducciones: deducciones,
      radarData: radar,
      monthlyNetData: monthlyNet,
      retentionRate: retention,
    };
  }, [data]);

  const sortedConceptBreakdown = useMemo(() => {
    if (!data) {
      return [] as DashboardData["conceptBreakdown"];
    }

    const directionMultiplier = conceptSort.direction === "asc" ? 1 : -1;

    return [...data.conceptBreakdown].sort((left, right) => {
      const primaryResult = compareConceptRows(left, right, conceptSort.column) * directionMultiplier;

      if (primaryResult !== 0) {
        return primaryResult;
      }

      return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    });
  }, [conceptSort, data]);

  const handleConceptSort = (column: ConceptSortColumn) => {
    setConceptSort((current) => {
      if (current.column === column) {
        return {
          column,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        column,
        direction: getConceptSortDirection(column),
      };
    });
  };

  if (profiles.length === 0 && !profilesLoading) return <EmptyState icon={BarChart3} title="Sin datos todavía" description="Sube tus primeras nóminas para ver estadísticas, evolución salarial y desglose de conceptos." actionLabel="Subir nóminas" actionHref="/upload" actionIcon={FileText} />;
  if (isLoading || !data) return <DashboardSkeleton />;
  if (data.kpis.totalPayslips === 0) {
    if (hasDateFilter) {
      return (
        <Card className="p-10 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
            <Calendar className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1.5">No hay nóminas en el rango seleccionado</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
            Prueba con otro periodo o limpia el rango para volver a ver todo el histórico disponible.
          </p>
          <div className="flex justify-center">
            <Button variant="secondary" onClick={clearDateRange}>
              Ver todo el histórico
            </Button>
          </div>
        </Card>
      );
    }

    return <EmptyState icon={BarChart3} title="Sin datos todavía" description="Sube tus primeras nóminas para ver estadísticas, evolución salarial y desglose de conceptos." actionLabel="Subir nóminas" actionHref="/upload" actionIcon={FileText} />;
  }

  const lastTwo = monthlyNetData.slice(-2);
  const netTrend = lastTwo.length === 2
    ? ((lastTwo[1].net - lastTwo[0].net) / (lastTwo[0].net || 1)) * 100
    : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Salario neto medio</p>
              <p className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-accent-700 dark:text-accent-400">
                {formatCurrency(data.kpis.avgNet)}
              </p>
            </div>
            {profiles.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <ProfileSelector
                  profiles={profiles}
                  value={profileIds}
                  onChange={(v) => setSelectedProfiles(v as number[])}
                  multi
                />
              </div>
            )}
          </div>

          {/* Pills */}
          <div className="flex flex-wrap gap-2.5 mt-5">
            <Badge variant="secondary" className="bg-accent-50 text-accent-800 dark:bg-accent-500/10 dark:text-accent-300 gap-1.5">
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono">{data.kpis.totalPayslips}</span>
              nóminas
            </Badge>
            <Badge variant="secondary" className="bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400 gap-1.5">
              <DollarSign className="w-3.5 h-3.5" aria-hidden="true" />
              Bruto
              <span className="font-mono">{formatCurrency(data.kpis.avgGross)}</span>
            </Badge>
            <Badge variant="secondary" className="bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400 gap-1.5">
              <Percent className="w-3.5 h-3.5" aria-hidden="true" />
              IRPF
              <span className="font-mono">{formatCurrency(data.kpis.avgIrpf)}</span>
            </Badge>
            {data.kpis.extrasCount > 0 && (
              <Badge variant="secondary" className="bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400 gap-1.5">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-mono">{data.kpis.extrasCount}</span>
                paga{data.kpis.extrasCount > 1 ? "s" : ""} extra
              </Badge>
            )}
            <Badge variant="secondary" className="bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500 gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              Retención
              <span className="font-mono">{retentionRate.toFixed(1)}%</span>
            </Badge>
          </div>
        </div>
      </Card>

      {/* Main Chart: Evolution */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between mb-4">
          <SectionHeader
            icon={Activity}
            title="Evolución Salarial"
            subtitle="Bruto vs Neto mensual"
          />
          <div className="flex flex-col gap-3 sm:items-end">
            {availableMonths.length > 1 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <MonthRangeSelect
                  label="Desde"
                  value={selectedRangeFrom}
                  placeholder="Inicio"
                  options={availableMonths}
                  onChange={handleRangeFromChange}
                />
                <MonthRangeSelect
                  label="Hasta"
                  value={selectedRangeTo}
                  placeholder="Fin"
                  options={availableMonths}
                  onChange={handleRangeToChange}
                />
                {(selectedRangeFrom || selectedRangeTo) && (
                  <Button variant="secondary" size="sm" onClick={clearDateRange} className="h-10">
                    Ver todo
                  </Button>
                )}
              </div>
            )}

            <div className="flex self-start sm:self-end bg-muted rounded-lg p-0.5" role="group" aria-label="Tipo de gráfico">
              <button
                onClick={() => setChartType("area")}
                aria-pressed={chartType === "area"}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                  chartType === "area" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Área
              </button>
              <button
                onClick={() => setChartType("line")}
                aria-pressed={chartType === "line"}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                  chartType === "line" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Línea
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground sm:text-right">
              {hasDateFilter && isFilteredDashboardFetching ? "Actualizando rango..." : `Rango: ${activeRangeLabel}`}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          {chartType === "area" ? (
            <AreaChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1e40af" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="monthLabel"
                interval={0}
                minTickGap={0}
                height={56}
                angle={-35}
                textAnchor="end"
                tickMargin={12}
                tick={{ fontSize: 11, fill: CHART_AXIS }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {profileNames.map((name) => (
                <Area
                  key={`${name}_bruto`}
                  type="monotone"
                  dataKey={`${name}_bruto`}
                  name={`${name} Bruto`}
                  stroke="#1e40af"
                  fill="url(#gradBlue)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                  connectNulls
                />
              ))}
              {profileNames.map((name) => (
                <Area
                  key={`${name}_neto`}
                  type="monotone"
                  dataKey={`${name}_neto`}
                  name={`${name} Neto`}
                  stroke="#22c55e"
                  fill="url(#gradGreen)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
                  connectNulls
                />
              ))}
            </AreaChart>
          ) : (
            <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis
                dataKey="monthLabel"
                interval={0}
                minTickGap={0}
                height={56}
                angle={-35}
                textAnchor="end"
                tickMargin={12}
                tick={{ fontSize: 11, fill: CHART_AXIS }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {profileNames.map((name, idx) => (
                <Line
                  key={`${name}_bruto`}
                  type="monotone"
                  dataKey={`${name}_bruto`}
                  name={`${name} Bruto`}
                  stroke={profileColors[name] ?? CHART_COLORS[idx * 2]}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2, fill: "#fff" }}
                  connectNulls
                />
              ))}
              {profileNames.map((name, idx) => (
                <Line
                  key={`${name}_neto`}
                  type="monotone"
                  dataKey={`${name}_neto`}
                  name={`${name} Neto`}
                  stroke={profileColors[name] ?? CHART_COLORS[idx * 2 + 1]}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, strokeWidth: 2, fill: "#fff" }}
                  connectNulls
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
        </div>
      </Card>

      {/* Second row: Bruto vs Neto bar + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-0 overflow-hidden lg:col-span-2">
          <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
          <div className="p-6">
          <SectionHeader
            icon={BarChart3}
            title="Bruto vs Deducciones"
            subtitle="Desglose mensual"
          />
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: CHART_AXIS }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {profileNames.map((name) => (
                <Bar
                  key={`${name}_neto_bar`}
                  dataKey={`${name}_neto`}
                  name={`${name} Neto`}
                  stackId={name}
                  fill="#22c55e"
                  radius={[0, 0, 0, 0]}
                  barSize={32}
                />
              ))}
              {profileNames.map((name) => (
                <Bar
                  key={`${name}_diff`}
                  dataKey={`${name}_diff`}
                  name={`${name} Deducciones`}
                  stackId={name}
                  fill="#ef4444"
                  opacity={0.7}
                  radius={[4, 4, 0, 0]}
                  barSize={32}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-accent-400 to-accent-300" />
          <div className="p-6">
          <SectionHeader
            icon={FileText}
            title="Resumen"
            subtitle="Métricas clave"
          />
          <div className="space-y-3">
            <SummaryRow label="Bruto medio" value={formatCurrency(data.kpis.avgGross)} color="text-foreground" />
            <SummaryRow label="Neto medio" value={formatCurrency(data.kpis.avgNet)} color="text-success-700 dark:text-success-500" />
            <SummaryRow label="IRPF medio" value={formatCurrency(data.kpis.avgIrpf)} color="text-danger-600" />
            <div className="border-t border-border pt-3">
              <SummaryRow label="Total bruto" value={formatCurrency(data.kpis.totalGrossYear)} color="text-foreground" bold />
              <SummaryRow label="Total neto" value={formatCurrency(data.kpis.totalNetYear)} color="text-success-700 dark:text-success-500" bold />
            </div>
            <div className="border-t border-border pt-3">
              <SummaryRow label="Nóminas" value={String(data.kpis.totalPayslips)} color="text-foreground" />
              <SummaryRow label="Retención" value={`${retentionRate.toFixed(1)}%`} color="text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          </div>
        </Card>
      </div>

      {/* Third row: Devengos pie + Deducciones radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topDevengos.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-success-500 to-success-400" />
            <div className="p-6">
            <SectionHeader
              icon={PieIcon}
              title="Devengos"
              subtitle="Distribución promedio"
            />
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topDevengos}
                  dataKey="average"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {topDevengos.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={DASHBOARD_TOOLTIP_CONTENT_STYLE}
                  itemStyle={DASHBOARD_TOOLTIP_ITEM_STYLE}
                  labelStyle={DASHBOARD_TOOLTIP_LABEL_STYLE}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {topDevengos.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-foreground font-medium">{formatCurrency(c.average)}</span>
                </div>
              ))}
            </div>
            </div>
          </Card>
        )}

        {topDeducciones.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-danger-500 to-danger-400" />
            <div className="p-6">
            <SectionHeader
              icon={TrendingDown}
              title="Deducciones"
              subtitle="Promedio mensual"
            />
            {radarData.length >= 3 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke={CHART_GRID} />
                    <PolarAngleAxis dataKey="concept" tick={{ fontSize: 10, fill: CHART_AXIS }} />
                    <PolarRadiusAxis tick={{ fontSize: 10, fill: CHART_AXIS }} tickFormatter={formatCompact} />
                    <Radar
                      name="Promedio"
                      dataKey="amount"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={DASHBOARD_TOOLTIP_CONTENT_STYLE}
                      itemStyle={DASHBOARD_TOOLTIP_ITEM_STYLE}
                      labelStyle={DASHBOARD_TOOLTIP_LABEL_STYLE}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                  {topDeducciones.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-danger-500 flex-shrink-0" />
                      <span className="text-muted-foreground truncate">{c.name}</span>
                      <span className="ml-auto font-mono text-danger-600 font-medium">{formatCurrency(c.average)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDeducciones} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={formatCompact} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: CHART_AXIS }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={DASHBOARD_TOOLTIP_CONTENT_STYLE}
                    itemStyle={DASHBOARD_TOOLTIP_ITEM_STYLE}
                    labelStyle={DASHBOARD_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar dataKey="average" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
            </div>
          </Card>
        )}
      </div>

      {/* Concept detail table */}
      {data.conceptBreakdown.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
          <div className="p-6 pb-3">
            <SectionHeader
              icon={FileText}
              title="Todos los Conceptos"
              subtitle="Detalle completo por categoría"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-6" aria-sort={conceptSort.column === "name" ? (conceptSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleConceptSort("name")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Concepto</span>
                    <SortIndicator active={conceptSort.column === "name"} direction={conceptSort.direction} />
                  </button>
                </TableHead>
                <TableHead aria-sort={conceptSort.column === "category" ? (conceptSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleConceptSort("category")}
                    className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Tipo</span>
                    <SortIndicator active={conceptSort.column === "category"} direction={conceptSort.direction} />
                  </button>
                </TableHead>
                <TableHead className="text-right" aria-sort={conceptSort.column === "average" ? (conceptSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleConceptSort("average")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Promedio</span>
                    <SortIndicator active={conceptSort.column === "average"} direction={conceptSort.direction} />
                  </button>
                </TableHead>
                <TableHead className="text-right" aria-sort={conceptSort.column === "total" ? (conceptSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleConceptSort("total")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Total</span>
                    <SortIndicator active={conceptSort.column === "total"} direction={conceptSort.direction} />
                  </button>
                </TableHead>
                <TableHead className="text-right px-6" aria-sort={conceptSort.column === "count" ? (conceptSort.direction === "asc" ? "ascending" : "descending") : "none"}>
                  <button
                    type="button"
                    onClick={() => handleConceptSort("count")}
                    className="inline-flex w-full items-center justify-end gap-1 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:text-foreground"
                  >
                    <span>Apariciones</span>
                    <SortIndicator active={conceptSort.column === "count"} direction={conceptSort.direction} />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedConceptBreakdown.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="px-6 py-3 font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          c.category === "devengo"
                            ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500"
                            : c.category === "deduccion"
                            ? "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400"
                            : ""
                        )}
                      >
                        {getConceptCategoryLabel(c.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-right font-mono font-medium text-foreground">{formatCurrency(c.average)}</TableCell>
                    <TableCell className="py-3 text-right font-mono font-medium text-foreground">{formatCurrency(c.total)}</TableCell>
                    <TableCell className="px-6 py-3 text-right text-muted-foreground">{c.count}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ─── Annual Summary ──────────────────────────────────── */}
      {data.annualSummaries && data.annualSummaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader
              icon={Wallet}
              title="Resumen Anual"
              subtitle="Totales y proyección por año"
            />
            {data.annualSummaries.length > 1 && (
              <Select
                value={selectedYear ? String(selectedYear) : "all"}
                onValueChange={(v) => setSelectedYear(v === "all" ? null : Number(v))}
              >
                <SelectTrigger size="sm" className="w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los años</SelectItem>
                  {data.annualSummaries.map((s) => (
                    <SelectItem key={s.year} value={String(s.year)}>{s.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-4">
            {(selectedYear ? data.annualSummaries.filter((s) => s.year === selectedYear) : data.annualSummaries).map((s) => (
              <Card key={s.year} className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-100 dark:ring-primary-500/20 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">{s.year}</h4>
                    <p className="text-xs text-muted-foreground">{s.months} nóminas · {s.pagasExtra > 0 ? `${s.pagasExtra} paga${s.pagasExtra > 1 ? "s" : ""} extra` : "Sin pagas extra"}</p>
                  </div>
                  <div className="ml-auto">
                    <Badge
                      variant="secondary"
                      className={s.retentionRate >= 70
                        ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500"
                        : "bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-400"}
                    >
                      Retención neta {s.retentionRate}%
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  <div className="bg-muted rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bruto Total</p>
                    <p className="text-lg font-bold text-foreground font-mono mt-1">{formatCurrency(s.totalGross)}</p>
                  </div>
                  <div className="bg-success-50/50 dark:bg-success-500/10 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-success-600 uppercase tracking-wider">Neto Total</p>
                    <p className="text-lg font-bold text-success-700 dark:text-success-500 font-mono mt-1">{formatCurrency(s.totalNet)}</p>
                  </div>
                  <div className="bg-danger-50/50 dark:bg-danger-500/10 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-danger-600 uppercase tracking-wider">Total Deducciones</p>
                    <p className="text-lg font-bold text-danger-700 dark:text-danger-400 font-mono mt-1">{formatCurrency(s.totalDeductions)}</p>
                  </div>
                  <div className="bg-accent-50/50 dark:bg-accent-500/10 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">IRPF Total</p>
                    <p className="text-lg font-bold text-accent-700 dark:text-accent-400 font-mono mt-1">{formatCurrency(s.totalIrpf)}</p>
                  </div>
                </div>

                {s.pagasExtra > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-accent-50/30 dark:bg-accent-500/5 border border-accent-100 dark:border-accent-500/20 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">Desglose pagas extra — Bruto</p>
                      <p className="text-lg font-bold text-accent-700 dark:text-accent-400 font-mono mt-1">{formatCurrency(s.extraGross)}</p>
                    </div>
                    <div className="bg-accent-50/30 dark:bg-accent-500/5 border border-accent-100 dark:border-accent-500/20 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">Desglose pagas extra — Neto</p>
                      <p className="text-lg font-bold text-accent-700 dark:text-accent-400 font-mono mt-1">{formatCurrency(s.extraNet)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Media Bruto/mes</span>
                    <span className="text-sm font-mono font-semibold text-foreground">{formatCurrency(s.avgMonthlyGross)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">Media Neto/mes</span>
                    <span className="text-sm font-mono font-semibold text-success-700 dark:text-success-500">{formatCurrency(s.avgMonthlyNet)}</span>
                  </div>
                  {s.months < 12 && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Proyección Bruto Anual</span>
                        <span className="text-sm font-mono font-semibold text-foreground">{formatCurrency(s.projectedAnnualGross)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Proyección Neto Anual</span>
                        <span className="text-sm font-mono font-semibold text-success-600">{formatCurrency(s.projectedAnnualNet)}</span>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── IRPF & Retention Rate Evolution ─────────────────── */}
      {data.irpfEvolution && data.irpfEvolution.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-danger-500 to-danger-400" />
            <div className="p-6">
            <SectionHeader
              icon={Shield}
              title="Evolución IRPF"
              subtitle="Tipo efectivo y cuantía mensual"
            />
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.irpfEvolution.map((d) => ({ ...d, monthLabel: formatMonthLabel(d.month) }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: CHART_AXIS }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="amount" name="IRPF (€)" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} barSize={24} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="Tipo (%)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-success-500 to-success-400" />
            <div className="p-6">
            <SectionHeader
              icon={Percent}
              title="Tasa de Retención Neta"
              subtitle="% del salario bruto que cobras"
            />
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={(data.monthlySavings ?? []).map((d) => ({ ...d, monthLabel: formatMonthLabel(d.month) }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRetention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: CHART_AXIS }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: CHART_AXIS }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  formatter={(value: number, name: string) => [name === "Retención (%)" ? `${value}%` : formatCurrency(value), name]}
                  contentStyle={DASHBOARD_TOOLTIP_CONTENT_STYLE}
                  itemStyle={DASHBOARD_TOOLTIP_ITEM_STYLE}
                  labelStyle={DASHBOARD_TOOLTIP_LABEL_STYLE}
                />
                <Area type="monotone" dataKey="retentionRate" name="Retención (%)" stroke="#10b981" strokeWidth={2.5} fill="url(#gradRetention)" dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, fill: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function MonthRangeSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-[9rem]">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)} disabled={options.length === 0}>
        <SelectTrigger className="min-w-[9rem]"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{placeholder}</SelectItem>
          {options.map((month) => (
            <SelectItem key={month} value={month}>
              {formatMonthLabel(month)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-mono", bold ? "font-bold" : "font-medium", color)}>{value}</span>
    </div>
  );
}

// ─── Export ─────────────────────────────────────────────────────
export default function DashboardPage() {
  return (
    <Providers>
      <DashboardView />
    </Providers>
  );
}
