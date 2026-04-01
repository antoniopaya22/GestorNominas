import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Bell, Download, FileText,
  ArrowUpRight, ArrowDownRight, Activity, Target,
} from "lucide-react";
import {
  getProfiles, getAnalytics, exportData,
  type AnalyticsData, type Profile,
} from "../lib/api";
import { Providers } from "./Providers";
import { formatCurrency, formatMonthLabel } from "../lib/format";
import { ChartTooltip } from "./ui/ChartTooltip";
import { ProfileSelector } from "./ui/ProfileSelector";
import { EmptyState } from "./ui/EmptyState";

const SEVERITY_STYLES = {
  info: "bg-primary-50 border-primary-200 text-primary-700",
  warning: "bg-accent-50 border-accent-200 text-accent-700",
  critical: "bg-danger-50 border-danger-200 text-danger-700",
} as const;

const SEVERITY_ICONS = {
  info: Bell,
  warning: AlertTriangle,
  critical: AlertTriangle,
} as const;

type SalaryEvolutionDatum = {
  month: string;
  Bruto: number;
  Neto: number;
};

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

function buildSalaryEvolutionData(trends: AnalyticsData["trends"]): SalaryEvolutionDatum[] {
  const grossByMonth = new Map(trends.gross.map((point) => [point.month, point.value]));
  const netByMonth = new Map(trends.net.map((point) => [point.month, point.value]));

  const monthIndices = Array.from(
    new Set(
      [...grossByMonth.keys(), ...netByMonth.keys()]
        .map(toMonthIndex)
        .filter((value): value is number => value !== null),
    ),
  ).sort((left, right) => left - right);

  if (monthIndices.length === 0) {
    return [];
  }

  const salaryEvolution: SalaryEvolutionDatum[] = [];
  const firstMonth = monthIndices[0];
  const lastMonth = monthIndices[monthIndices.length - 1];

  for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
    const monthKey = fromMonthIndex(monthIndex);
    salaryEvolution.push({
      month: formatMonthLabel(monthKey),
      Bruto: grossByMonth.get(monthKey) ?? 0,
      Neto: netByMonth.get(monthKey) ?? 0,
    });
  }

  return salaryEvolution;
}

function AnalyticsView() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles,
  });

  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [exportYear, setExportYear] = useState<string>("");

  useEffect(() => {
    if (!selectedProfile && profiles.length > 0) {
      setSelectedProfile(profiles[0].id);
    }
  }, [profiles, selectedProfile]);

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ["analytics", selectedProfile],
    queryFn: () => getAnalytics(selectedProfile!),
    enabled: !!selectedProfile,
  });

  const salaryEvolutionData = analytics ? buildSalaryEvolutionData(analytics.trends) : [];

  const handleExport = async (format: "csv" | "json") => {
    if (!selectedProfile) return;
    try {
      await exportData(selectedProfile, exportYear ? Number(exportYear) : undefined, format);
    } catch {
      // silent fail - user sees no file download
    }
  };

  if (profiles.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Sin datos"
        description="Crea un perfil y sube nóminas para ver la analítica avanzada."
        actionLabel="Subir nóminas"
        actionHref="/upload"
        actionIcon={FileText}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-surface-900">Analítica Avanzada</h2>
          <p className="text-sm text-surface-500 mt-0.5">
            Tendencias, predicciones y anomalías de tus nóminas
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport("csv")} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button onClick={() => handleExport("json")} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Profile selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <ProfileSelector
          profiles={profiles}
          value={selectedProfile ?? profiles[0]?.id ?? 0}
          onChange={(v) => setSelectedProfile(v as number)}
        />
      </div>

      {isLoading && (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-5 w-40 mb-4" />
              <div className="skeleton h-[250px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card border-danger-200 bg-danger-50/50 p-5">
          <p className="text-sm text-danger-700">Error cargando analítica: {(error as Error).message}</p>
        </div>
      )}

      {analytics && (
        <div className="space-y-6">
          {/* Trends Chart */}
          <div className="card p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-surface-900 text-sm">Evolución Salarial</h3>
                <p className="text-xs text-surface-400">Tendencia de bruto y neto mensual</p>
              </div>
            </div>

            {salaryEvolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={salaryEvolutionData}>
                  <defs>
                    <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e40af" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="month"
                    interval={0}
                    minTickGap={0}
                    height={56}
                    angle={-35}
                    textAnchor="end"
                    tickMargin={12}
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Bruto" stroke="#1e40af" strokeWidth={2} fill="url(#gradBruto)" />
                  <Area type="monotone" dataKey="Neto" stroke="#10b981" strokeWidth={2} fill="url(#gradNeto)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-surface-400 py-8 text-center">No hay datos de tendencia suficientes</p>
            )}
          </div>

          {/* Predictions */}
          {analytics.predictions.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center">
                  <Target className="w-4 h-4 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Predicciones</h3>
                  <p className="text-xs text-surface-400">Estimación de los próximos 3 meses basada en regresión lineal</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {analytics.predictions.map((p) => (
                  <div key={p.month} className="bg-accent-50/50 border border-accent-200 rounded-xl p-4">
                    <p className="text-xs font-medium text-accent-600 uppercase tracking-wider">{formatMonthLabel(p.month)}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-surface-500">Bruto est.</span>
                        <span className="text-sm font-semibold font-mono text-surface-900">{formatCurrency(p.predictedGross)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-surface-500">Neto est.</span>
                        <span className="text-sm font-semibold font-mono text-success-700">{formatCurrency(p.predictedNet)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Combined chart: actual + predicted */}
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={[
                  ...analytics.trends.gross.slice(-6).map((g, i) => ({
                    month: formatMonthLabel(g.month),
                    Bruto: g.value,
                    Neto: analytics.trends.net[analytics.trends.gross.length - 6 + i]?.value ?? 0,
                    BrutoEst: null as number | null,
                    NetoEst: null as number | null,
                  })),
                  ...analytics.predictions.map((p) => ({
                    month: formatMonthLabel(p.month),
                    Bruto: null as number | null,
                    Neto: null as number | null,
                    BrutoEst: p.predictedGross,
                    NetoEst: p.predictedNet,
                  })),
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Bruto" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Neto" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="BrutoEst" stroke="#1e40af" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Bruto (est.)" />
                  <Line type="monotone" dataKey="NetoEst" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Neto (est.)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Year-over-Year */}
          {analytics.trends.yoyGross.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-success-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Comparación Interanual</h3>
                  <p className="text-xs text-surface-400">Este año vs. año anterior</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.trends.yoyGross.map((d) => ({
                  month: formatMonthLabel(d.month),
                  "Año actual": d.current,
                  "Año anterior": d.previous,
                  Cambio: d.change,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Año actual" fill="#1e40af" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Año anterior" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Anomalies */}
          {analytics.anomalies.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-danger-50 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-danger-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Anomalías Detectadas</h3>
                  <p className="text-xs text-surface-400">Desviaciones significativas en tus nóminas</p>
                </div>
              </div>

              <div className="space-y-2">
                {analytics.anomalies.map((a, i) => {
                  const Icon = SEVERITY_ICONS[a.severity] ?? AlertTriangle;
                  return (
                    <div key={i} className={`border rounded-xl p-4 ${SEVERITY_STYLES[a.severity]}`}>
                      <div className="flex items-start gap-3">
                        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{a.message}</p>
                          <div className="flex gap-4 mt-1 text-xs opacity-80">
                            <span>Período: {formatMonthLabel(a.month)}</span>
                            <span>Valor: {formatCurrency(a.value)}</span>
                            <span>Esperado: {formatCurrency(a.expected)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alerts */}
          {analytics.alerts.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Alertas</h3>
                  <p className="text-xs text-surface-400">Recomendaciones y avisos automáticos</p>
                </div>
              </div>

              <div className="space-y-2">
                {analytics.alerts.map((a, i) => {
                  const Icon = SEVERITY_ICONS[a.severity as keyof typeof SEVERITY_ICONS] ?? Bell;
                  const styles = SEVERITY_STYLES[a.severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.info;
                  return (
                    <div key={i} className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${styles}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm">{a.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No anomalies/alerts message */}
          {analytics.anomalies.length === 0 && analytics.alerts.length === 0 && (
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center mx-auto mb-3">
                <ArrowUpRight className="w-6 h-6 text-success-600" />
              </div>
              <h3 className="font-semibold text-surface-900 text-sm">Todo en orden</h3>
              <p className="text-xs text-surface-400 mt-1">No se han detectado anomalías ni alertas en tus nóminas</p>
            </div>
          )}

          {/* Extras Summary */}
          {analytics.extras && analytics.extras.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 flex items-center justify-center">
                  <Target className="w-4 h-4 text-accent-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-surface-900 text-sm">Pagas Extra</h3>
                  <p className="text-xs text-surface-400">Resumen de pagas extra por año</p>
                </div>
              </div>
              <div className="space-y-3">
                {analytics.extras.map((e) => (
                  <div key={e.year} className="flex items-center justify-between border border-accent-100 rounded-xl p-4 bg-accent-50/20">
                    <div>
                      <span className="text-sm font-bold text-surface-900">{e.year}</span>
                      <span className="text-xs text-surface-400 ml-2">{e.count} paga{e.count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-surface-400 uppercase">Bruto</p>
                        <p className="text-sm font-mono font-semibold text-surface-900">{formatCurrency(e.totalGross)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-surface-400 uppercase">Neto</p>
                        <p className="text-sm font-mono font-semibold text-success-700">{formatCurrency(e.totalNet)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Providers>
      <AnalyticsView />
    </Providers>
  );
}
