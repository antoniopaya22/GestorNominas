import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import {
  TrendingUp, AlertTriangle, Bell, Download, FileText,
  ArrowUpRight, Activity, Target,
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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

const SEVERITY_STYLES = {
  info: "bg-primary-50 border-primary-200 text-primary-700 dark:bg-primary-500/10 dark:border-primary-500/20 dark:text-primary-400",
  warning: "bg-accent-50 border-accent-200 text-accent-700 dark:bg-accent-500/10 dark:border-accent-500/20 dark:text-accent-400",
  critical: "bg-danger-50 border-danger-100 text-danger-700 dark:bg-danger-500/10 dark:border-danger-500/20 dark:text-danger-400",
} as const;

const SEVERITY_ICONS = {
  info: Bell,
  warning: AlertTriangle,
  critical: AlertTriangle,
} as const;

// Colores de gráfico que se leen en tiempo de ejecución desde las custom
// properties de Tailwind (ver global.css) — así los charts de Recharts (que
// pintan en SVG, fuera del alcance de las clases `dark:`) siguen el tema.
const CHART_GRID = "var(--color-border)";
const CHART_AXIS = "var(--color-muted-foreground)";

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

function SectionCard({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className={cn("h-1.5 bg-gradient-to-r", gradient)} />
      <div className="p-6">{children}</div>
    </Card>
  );
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

  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: "csv" | "json") => {
    if (!selectedProfile) return;
    setExportError(null);
    try {
      await exportData(selectedProfile, exportYear ? Number(exportYear) : undefined, format);
    } catch {
      setExportError("Error al exportar. Inténtalo de nuevo.");
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
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <Card className="p-0 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-accent-500 to-accent-400" />
        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-0.5">Analítica Avanzada</p>
              <p className="text-lg font-semibold text-foreground">Tendencias, predicciones y anomalías</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => handleExport("csv")} className="gap-1.5" aria-label="Exportar CSV">
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleExport("json")} className="gap-1.5" aria-label="Exportar JSON">
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                JSON
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {exportError && (
        <Card className="border-destructive/20 bg-destructive/5 p-4 flex-row items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-destructive">{exportError}</p>
        </Card>
      )}

      {/* Profile selector */}
      <div className="flex gap-2 flex-wrap">
        <ProfileSelector
          profiles={profiles}
          value={selectedProfile ?? profiles[0]?.id ?? 0}
          onChange={(v) => setSelectedProfile(v as number)}
        />
      </div>

      {isLoading && (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SectionCard key={i} gradient="from-accent-500 to-accent-400">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-[250px] w-full rounded-xl" />
            </SectionCard>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">Error cargando analítica: {(error as Error).message}</p>
        </Card>
      )}

      {analytics && (
        <div className="space-y-6">
          {/* Trends Chart */}
          <SectionCard gradient="from-accent-500 to-accent-400">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">Evolución Salarial</h3>
                <p className="text-xs text-muted-foreground">Tendencia de bruto y neto mensual</p>
              </div>
            </div>

            {salaryEvolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={salaryEvolutionData}>
                  <defs>
                    <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="month"
                    interval={0}
                    minTickGap={0}
                    height={56}
                    angle={-35}
                    textAnchor="end"
                    tickMargin={12}
                    tick={{ fontSize: 11 }}
                    stroke={CHART_AXIS}
                  />
                  <YAxis tick={{ fontSize: 11 }} stroke={CHART_AXIS} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Bruto" stroke="var(--chart-2)" strokeWidth={2} fill="url(#gradBruto)" />
                  <Area type="monotone" dataKey="Neto" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gradNeto)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No hay datos de tendencia suficientes</p>
            )}
          </SectionCard>

          {/* Predictions */}
          {analytics.predictions.length > 0 && (
            <SectionCard gradient="from-accent-500 to-accent-400">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Predicciones</h3>
                  <p className="text-xs text-muted-foreground">Estimación de los próximos 3 meses basada en regresión lineal</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {analytics.predictions.map((p) => (
                  <div key={p.month} className="bg-accent-50/50 dark:bg-accent-500/10 border border-accent-200 dark:border-accent-500/20 rounded-xl p-4">
                    <p className="text-xs font-medium text-accent-600 dark:text-accent-400 uppercase tracking-wider">{formatMonthLabel(p.month)}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Bruto est.</span>
                        <span className="text-sm font-semibold font-mono text-foreground">{formatCurrency(p.predictedGross)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-muted-foreground">Neto est.</span>
                        <span className="text-sm font-semibold font-mono text-success-700 dark:text-success-500">{formatCurrency(p.predictedNet)}</span>
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
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={CHART_AXIS} />
                  <YAxis tick={{ fontSize: 11 }} stroke={CHART_AXIS} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Bruto" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Neto" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="BrutoEst" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Bruto (est.)" />
                  <Line type="monotone" dataKey="NetoEst" stroke="var(--chart-1)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Neto (est.)" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Year-over-Year */}
          {analytics.trends.yoyGross.length > 0 && (
            <SectionCard gradient="from-success-500 to-success-400">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-success-50 dark:bg-success-500/10 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-success-600" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Comparación Interanual</h3>
                  <p className="text-xs text-muted-foreground">Este año vs. año anterior</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.trends.yoyGross.map((d) => ({
                  month: formatMonthLabel(d.month),
                  "Año actual": d.current,
                  "Año anterior": d.previous,
                  Cambio: d.change,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={CHART_AXIS} />
                  <YAxis tick={{ fontSize: 11 }} stroke={CHART_AXIS} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Año actual" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Año anterior" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {/* Anomalies */}
          {analytics.anomalies.length > 0 && (
            <SectionCard gradient="from-danger-500 to-danger-400">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-danger-50 dark:bg-danger-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-danger-600 dark:text-danger-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Anomalías Detectadas</h3>
                  <p className="text-xs text-muted-foreground">Desviaciones significativas en tus nóminas</p>
                </div>
              </div>

              <div className="space-y-2">
                {analytics.anomalies.map((a, i) => {
                  const Icon = SEVERITY_ICONS[a.severity] ?? AlertTriangle;
                  return (
                    <div key={i} className={cn("border rounded-xl p-4", SEVERITY_STYLES[a.severity])}>
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
            </SectionCard>
          )}

          {/* Alerts */}
          {analytics.alerts.length > 0 && (
            <SectionCard gradient="from-accent-500 to-accent-400">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Alertas</h3>
                  <p className="text-xs text-muted-foreground">Recomendaciones y avisos automáticos</p>
                </div>
              </div>

              <div className="space-y-2">
                {analytics.alerts.map((a, i) => {
                  const Icon = SEVERITY_ICONS[a.severity as keyof typeof SEVERITY_ICONS] ?? Bell;
                  const styles = SEVERITY_STYLES[a.severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.info;
                  return (
                    <div key={i} className={cn("border rounded-xl px-4 py-3 flex items-center gap-3", styles)}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <p className="text-sm">{a.message}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* No anomalies/alerts message */}
          {analytics.anomalies.length === 0 && analytics.alerts.length === 0 && (
            <Card className="p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-success-50 dark:bg-success-500/10 flex items-center justify-center mx-auto mb-3">
                <ArrowUpRight className="w-6 h-6 text-success-600" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">Todo en orden</h3>
              <p className="text-xs text-muted-foreground mt-1">No se han detectado anomalías ni alertas en tus nóminas</p>
            </Card>
          )}

          {/* Extras Summary */}
          {analytics.extras && analytics.extras.length > 0 && (
            <SectionCard gradient="from-accent-500 to-accent-400">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-accent-50 dark:bg-accent-500/10 flex items-center justify-center">
                  <Target className="w-4 h-4 text-accent-600 dark:text-accent-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-sm">Pagas Extra</h3>
                  <p className="text-xs text-muted-foreground">Resumen de pagas extra por año</p>
                </div>
              </div>
              <div className="space-y-3">
                {analytics.extras.map((e) => (
                  <div key={e.year} className="flex items-center justify-between border border-accent-100 dark:border-accent-500/20 rounded-xl p-4 bg-accent-50/20 dark:bg-accent-500/5">
                    <div>
                      <span className="text-sm font-bold text-foreground">{e.year}</span>
                      <span className="text-xs text-muted-foreground ml-2">{e.count} paga{e.count > 1 ? "s" : ""}</span>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">Bruto</p>
                        <p className="text-sm font-mono font-semibold text-foreground">{formatCurrency(e.totalGross)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">Neto</p>
                        <p className="text-sm font-mono font-semibold text-success-700 dark:text-success-500">{formatCurrency(e.totalNet)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
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
