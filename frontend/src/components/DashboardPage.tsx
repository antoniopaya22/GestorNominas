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
  Activity, Filter, Wallet, Shield, ChevronDown,
} from "lucide-react";
import { getDashboard, getProfiles, type DashboardData } from "../lib/api";
import { Providers } from "./Providers";
import { formatCurrency, formatCompact, formatMonthLabel } from "../lib/format";
import { ChartTooltip } from "./ui/ChartTooltip";
import { ProfileSelector } from "./ui/ProfileSelector";
import { EmptyState } from "./ui/EmptyState";
import { KpiCard } from "./ui/KpiCard";
import { SectionHeader } from "./ui/SectionHeader";

// ─── Design tokens ──────────────────────────────────────────────
const CHART_COLORS = [
  "#1e40af", "#3b82f6", "#60a5fa", "#93c5fd",
  "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6",
];

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
    <div className="animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="skeleton w-10 h-10 rounded-xl mb-3" />
            <div className="skeleton h-7 w-28 mb-2" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="card p-6 mb-8">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-[300px] w-full rounded-xl" />
      </div>
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
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

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

  if (profiles.length === 0 && !profilesLoading) return <EmptyState icon={BarChart3} title="Sin datos todavía" description="Sube tus primeras nóminas para ver estadísticas, evolución salarial y desglose de conceptos." actionLabel="Subir nóminas" actionHref="/upload" actionIcon={FileText} />;
  if (isLoading || !data) return <DashboardSkeleton />;
  if (data.kpis.totalPayslips === 0) {
    if (hasDateFilter) {
      return (
        <div className="card p-10 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-5">
            <Calendar className="w-10 h-10 text-surface-300" />
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mb-1.5">No hay nóminas en el rango seleccionado</h3>
          <p className="text-surface-500 text-sm max-w-sm mx-auto mb-6">
            Prueba con otro periodo o limpia el rango para volver a ver todo el histórico disponible.
          </p>
          <div className="flex justify-center">
            <button onClick={clearDateRange} className="btn-secondary text-sm">
              Ver todo el histórico
            </button>
          </div>
        </div>
      );
    }

    return <EmptyState icon={BarChart3} title="Sin datos todavía" description="Sube tus primeras nóminas para ver estadísticas, evolución salarial y desglose de conceptos." actionLabel="Subir nóminas" actionHref="/upload" actionIcon={FileText} />;
  }

  const lastTwo = monthlyNetData.slice(-2);
  const netTrend = lastTwo.length === 2
    ? ((lastTwo[1].net - lastTwo[0].net) / (lastTwo[0].net || 1)) * 100
    : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-surface-900">Dashboard</h2>
          <p className="text-sm text-surface-500 mt-0.5">
            {data.kpis.totalPayslips} nómina{data.kpis.totalPayslips !== 1 ? "s" : ""} procesada{data.kpis.totalPayslips !== 1 ? "s" : ""}
          </p>
        </div>
        {profiles.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-surface-400" />
            <ProfileSelector
              profiles={profiles}
              value={profileIds}
              onChange={(v) => setSelectedProfiles(v as number[])}
              multi
            />
          </div>
        )}
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={DollarSign}
          label="Salario Bruto Medio"
          value={formatCurrency(data.kpis.avgGross)}
          color="primary"
        />
        <KpiCard
          icon={TrendingUp}
          label="Salario Neto Medio"
          value={formatCurrency(data.kpis.avgNet)}
          color="success"
          trend={netTrend > 0 ? "up" : netTrend < 0 ? "down" : "neutral"}
          trendValue={`${Math.abs(netTrend).toFixed(1)}%`}
        />
        <KpiCard
          icon={Calendar}
          label="Total Neto Acumulado"
          value={formatCurrency(data.kpis.totalNetYear)}
          subValue={`${data.kpis.totalPayslips} nóminas mensuales`}
          color="accent"
        />
        {data.kpis.extrasCount > 0 && (
          <KpiCard
            icon={DollarSign}
            label="Pagas Extra"
            value={formatCurrency(data.kpis.extrasTotalNet)}
            subValue={`${data.kpis.extrasCount} paga${data.kpis.extrasCount > 1 ? "s" : ""}`}
            color="accent"
          />
        )}
        {data.kpis.extrasCount === 0 && (
        <KpiCard
          icon={Percent}
          label="Retención Neta"
          value={`${retentionRate.toFixed(1)}%`}
          subValue={`IRPF medio: ${formatCurrency(data.kpis.avgIrpf)}`}
          color={retentionRate >= 70 ? "success" : "danger"}
        />
        )}
      </div>

      {data.kpis.extrasCount > 0 && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          icon={Percent}
          label="Retención Neta"
          value={`${retentionRate.toFixed(1)}%`}
          subValue={`IRPF medio: ${formatCurrency(data.kpis.avgIrpf)}`}
          color={retentionRate >= 70 ? "success" : "danger"}
        />
      </div>
      )}

      {/* Main Chart: Evolution */}
      <div className="card p-6 mb-6">
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
                  <button onClick={clearDateRange} className="btn-secondary h-10 px-3 text-xs">
                    Ver todo
                  </button>
                )}
              </div>
            )}

            <div className="flex self-start sm:self-end bg-surface-100 rounded-lg p-0.5">
              <button
                onClick={() => setChartType("area")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  chartType === "area" ? "bg-white shadow-sm text-surface-900" : "text-surface-500 hover:text-surface-700"
                }`}
              >
                Área
              </button>
              <button
                onClick={() => setChartType("line")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  chartType === "line" ? "bg-white shadow-sm text-surface-900" : "text-surface-500 hover:text-surface-700"
                }`}
              >
                Línea
              </button>
            </div>

            <p className="text-[11px] text-surface-400 sm:text-right">
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                interval={0}
                minTickGap={0}
                height={56}
                angle={-35}
                textAnchor="end"
                tickMargin={12}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="monthLabel"
                interval={0}
                minTickGap={0}
                height={56}
                angle={-35}
                textAnchor="end"
                tickMargin={12}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
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

      {/* Second row: Bruto vs Neto bar + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-6 lg:col-span-2">
          <SectionHeader
            icon={BarChart3}
            title="Bruto vs Deducciones"
            subtitle="Desglose mensual"
          />
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolutionData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
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

        <div className="card p-6">
          <SectionHeader
            icon={FileText}
            title="Resumen"
            subtitle="Métricas clave"
          />
          <div className="space-y-3">
            <SummaryRow label="Bruto medio" value={formatCurrency(data.kpis.avgGross)} color="text-surface-900" />
            <SummaryRow label="Neto medio" value={formatCurrency(data.kpis.avgNet)} color="text-success-700" />
            <SummaryRow label="IRPF medio" value={formatCurrency(data.kpis.avgIrpf)} color="text-danger-600" />
            <div className="border-t border-surface-100 pt-3">
              <SummaryRow label="Total bruto" value={formatCurrency(data.kpis.totalGrossYear)} color="text-surface-900" bold />
              <SummaryRow label="Total neto" value={formatCurrency(data.kpis.totalNetYear)} color="text-success-700" bold />
            </div>
            <div className="border-t border-surface-100 pt-3">
              <SummaryRow label="Nóminas" value={String(data.kpis.totalPayslips)} color="text-surface-700" />
              <SummaryRow label="Retención" value={`${retentionRate.toFixed(1)}%`} color="text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Third row: Devengos pie + Deducciones radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {topDevengos.length > 0 && (
          <div className="card p-6">
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
                  contentStyle={{
                    background: "#0f172a", color: "#fff", border: "none",
                    borderRadius: "12px", fontSize: "12px", padding: "8px 12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {topDevengos.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-surface-600 truncate">{c.name}</span>
                  <span className="ml-auto font-mono text-surface-900 font-medium">{formatCurrency(c.average)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topDeducciones.length > 0 && (
          <div className="card p-6">
            <SectionHeader
              icon={TrendingDown}
              title="Deducciones"
              subtitle="Promedio mensual"
            />
            {radarData.length >= 3 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="concept" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <PolarRadiusAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={formatCompact} />
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
                      contentStyle={{
                        background: "#0f172a", color: "#fff", border: "none",
                        borderRadius: "12px", fontSize: "12px", padding: "8px 12px",
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                  {topDeducciones.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-danger-500 flex-shrink-0" />
                      <span className="text-surface-600 truncate">{c.name}</span>
                      <span className="ml-auto font-mono text-danger-600 font-medium">{formatCurrency(c.average)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDeducciones} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatCompact} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      background: "#0f172a", color: "#fff", border: "none",
                      borderRadius: "12px", fontSize: "12px", padding: "8px 12px",
                    }}
                  />
                  <Bar dataKey="average" fill="#ef4444" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}
      </div>

      {/* Concept detail table */}
      {data.conceptBreakdown.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="p-6 pb-3">
            <SectionHeader
              icon={FileText}
              title="Todos los Conceptos"
              subtitle="Detalle completo por categoría"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-surface-100 bg-surface-50/50">
                  <th className="text-left px-6 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Concepto</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Promedio</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Total</th>
                  <th className="text-right px-6 py-2.5 text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Apariciones</th>
                </tr>
              </thead>
              <tbody>
                {data.conceptBreakdown
                  .sort((a, b) => b.total - a.total)
                  .map((c) => (
                    <tr key={c.name} className="border-b border-surface-50 hover:bg-surface-50/80 transition-colors">
                      <td className="px-6 py-3 text-sm font-medium text-surface-900">{c.name}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          c.category === "devengo"
                            ? "bg-success-50 text-success-700"
                            : c.category === "deduccion"
                            ? "bg-danger-50 text-danger-700"
                            : "bg-surface-100 text-surface-600"
                        }`}>
                          {c.category === "devengo" ? "Devengo" : c.category === "deduccion" ? "Deducción" : "Otros"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-medium text-surface-700">{formatCurrency(c.average)}</td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-medium text-surface-900">{formatCurrency(c.total)}</td>
                      <td className="px-6 py-3 text-sm text-right text-surface-500">{c.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
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
              <div className="relative">
                <select
                  value={selectedYear ?? ""}
                  onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
                  className="input text-xs pr-8 appearance-none cursor-pointer w-auto"
                >
                  <option value="">Todos los años</option>
                  {data.annualSummaries.map((s) => (
                    <option key={s.year} value={s.year}>{s.year}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {(selectedYear ? data.annualSummaries.filter((s) => s.year === selectedYear) : data.annualSummaries).map((s) => (
              <div key={s.year} className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-surface-900">{s.year}</h4>
                    <p className="text-xs text-surface-400">{s.months} nóminas · {s.pagasExtra > 0 ? `${s.pagasExtra} paga${s.pagasExtra > 1 ? "s" : ""} extra` : "Sin pagas extra"}</p>
                  </div>
                  <div className="ml-auto">
                    <span className={`badge ${s.retentionRate >= 70 ? "bg-success-50 text-success-700" : "bg-accent-50 text-accent-700"}`}>
                      Retención neta {s.retentionRate}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  <div className="bg-surface-50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider">Bruto Total</p>
                    <p className="text-lg font-bold text-surface-900 font-mono mt-1">{formatCurrency(s.totalGross)}</p>
                  </div>
                  <div className="bg-success-50/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-success-600 uppercase tracking-wider">Neto Total</p>
                    <p className="text-lg font-bold text-success-700 font-mono mt-1">{formatCurrency(s.totalNet)}</p>
                  </div>
                  <div className="bg-danger-50/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-danger-600 uppercase tracking-wider">Total Deducciones</p>
                    <p className="text-lg font-bold text-danger-700 font-mono mt-1">{formatCurrency(s.totalDeductions)}</p>
                  </div>
                  <div className="bg-accent-50/50 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">IRPF Total</p>
                    <p className="text-lg font-bold text-accent-700 font-mono mt-1">{formatCurrency(s.totalIrpf)}</p>
                  </div>
                </div>

                {s.pagasExtra > 0 && (
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-accent-50/30 border border-accent-100 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">Pagas Extra — Bruto</p>
                      <p className="text-lg font-bold text-accent-700 font-mono mt-1">{formatCurrency(s.extraGross)}</p>
                    </div>
                    <div className="bg-accent-50/30 border border-accent-100 rounded-xl p-4">
                      <p className="text-[11px] font-semibold text-accent-600 uppercase tracking-wider">Pagas Extra — Neto</p>
                      <p className="text-lg font-bold text-accent-700 font-mono mt-1">{formatCurrency(s.extraNet)}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-surface-400">Media Bruto/mes</span>
                    <span className="text-sm font-mono font-semibold text-surface-900">{formatCurrency(s.avgMonthlyGross)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-surface-400">Media Neto/mes</span>
                    <span className="text-sm font-mono font-semibold text-success-700">{formatCurrency(s.avgMonthlyNet)}</span>
                  </div>
                  {s.months < 12 && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-surface-400">Proyección Bruto Anual</span>
                        <span className="text-sm font-mono font-semibold text-surface-700">{formatCurrency(s.projectedAnnualGross)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-surface-400">Proyección Neto Anual</span>
                        <span className="text-sm font-mono font-semibold text-success-600">{formatCurrency(s.projectedAnnualNet)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── IRPF & Retention Rate Evolution ─────────────────── */}
      {data.irpfEvolution && data.irpfEvolution.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card p-6">
            <SectionHeader
              icon={Shield}
              title="Evolución IRPF"
              subtitle="Tipo efectivo y cuantía mensual"
            />
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.irpfEvolution.map((d) => ({ ...d, monthLabel: formatMonthLabel(d.month) }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={45} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar yAxisId="left" dataKey="amount" name="IRPF (€)" fill="#ef4444" opacity={0.7} radius={[4, 4, 0, 0]} barSize={24} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="Tipo (%)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(value: number, name: string) => [name === "Retención (%)" ? `${value}%` : formatCurrency(value), name]} contentStyle={{ background: "#0f172a", color: "#fff", border: "none", borderRadius: "12px", fontSize: "12px", padding: "8px 12px" }} />
                <Area type="monotone" dataKey="retentionRate" name="Retención (%)" stroke="#10b981" strokeWidth={2.5} fill="url(#gradRetention)" dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2, fill: "#fff" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-surface-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input h-10 min-w-[9rem] appearance-none pr-9 text-xs cursor-pointer"
          disabled={options.length === 0}
        >
          <option value="">{placeholder}</option>
          {options.map((month) => (
            <option key={month} value={month}>
              {formatMonthLabel(month)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
      </div>
    </label>
  );
}

function SummaryRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-surface-500">{label}</span>
      <span className={`text-sm font-mono ${bold ? "font-bold" : "font-medium"} ${color}`}>{value}</span>
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
