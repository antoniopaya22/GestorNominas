import type { ElementType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "cn";
import { Sparkline } from "./Sparkline";

export type DeltaTrend = "up" | "down" | "flat";
export type DeltaTone = "positive" | "negative" | "neutral";

export interface StatDelta {
  value: string;
  trend: DeltaTrend;
  /** Por defecto: subir = positivo, bajar = negativo. Invertir para gastos/impuestos. */
  tone?: DeltaTone;
  /** Texto tras el delta, p.ej. "vs. mes anterior". */
  label?: string;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ElementType;
  delta?: StatDelta;
  /** Línea secundaria bajo el valor. */
  hint?: ReactNode;
  /** Serie para el minigráfico (solo valores). */
  sparkline?: number[];
  sparklineColor?: string;
  /** Tarjeta destacada (valor más grande). */
  emphasis?: boolean;
  className?: string;
}

const TONE_CLASSES: Record<DeltaTone, string> = {
  positive: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400",
  negative: "text-red-700 bg-red-500/10 dark:text-red-400",
  neutral: "text-muted-foreground bg-muted",
};

export function DeltaBadge({ delta }: { delta: StatDelta }) {
  const tone = delta.tone ?? (delta.trend === "up" ? "positive" : delta.trend === "down" ? "negative" : "neutral");
  const Icon = delta.trend === "up" ? ArrowUpRight : delta.trend === "down" ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 py-0.5 font-medium tabular-nums", TONE_CLASSES[tone])}>
        <Icon className="size-3" aria-hidden="true" />
        {delta.value}
      </span>
      {delta.label && <span className="whitespace-nowrap text-muted-foreground">{delta.label}</span>}
    </span>
  );
}

export function StatCard({ label, value, icon: Icon, delta, hint, sparkline, sparklineColor, emphasis, className }: StatCardProps) {
  return (
    <div className={cn("relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="size-4 text-muted-foreground/70" aria-hidden="true" />}
      </div>
      <p className={cn("mt-2 font-semibold tracking-tight text-foreground tabular-nums", emphasis ? "text-3xl" : "text-2xl")}>{value}</p>
      <div className="mt-auto flex items-end justify-between gap-3 pt-3">
        <div className="min-w-0 space-y-1">
          {delta && <DeltaBadge delta={delta} />}
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} color={sparklineColor} className="h-9 w-20 shrink-0" />
        )}
      </div>
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
