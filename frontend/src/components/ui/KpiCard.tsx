import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

// Nota: accent/success/danger no tienen escala completa 50-950 en
// tailwind.config.mjs (p.ej. success solo define 50,100,500,600,700) — se usa
// el matiz 500 con opacidad para el modo oscuro porque es el único que
// existe en las cuatro paletas.
const COLOR_MAP = {
  primary: { bg: "bg-primary-50 dark:bg-primary-500/10", icon: "text-primary-600 dark:text-primary-400", ring: "ring-primary-100 dark:ring-primary-500/20" },
  success: { bg: "bg-success-50 dark:bg-success-500/10", icon: "text-success-600 dark:text-success-500", ring: "ring-success-100 dark:ring-success-500/20" },
  danger: { bg: "bg-danger-50 dark:bg-danger-500/10", icon: "text-danger-600 dark:text-danger-400", ring: "ring-danger-100 dark:ring-danger-500/20" },
  accent: { bg: "bg-accent-50 dark:bg-accent-500/10", icon: "text-accent-600 dark:text-accent-400", ring: "ring-accent-100 dark:ring-accent-500/20" },
} as const;

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: keyof typeof COLOR_MAP;
}

export function KpiCard({ label, value, subValue, icon: Icon, trend, trendValue, color = "primary" }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <Card className="p-5 animate-fade-in">
      <CardContent className="p-0">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-xl ring-1 flex items-center justify-center", c.bg, c.ring)}>
          <Icon className={cn("w-5 h-5", c.icon)} aria-hidden="true" />
        </div>
        {trend && trendValue && (
          <Badge
            variant="secondary"
            className={cn(
              "gap-0.5",
              trend === "up" && "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500",
              trend === "down" && "bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-400"
            )}
          >
            {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
            {trend === "down" && <ArrowDownRight className="w-3 h-3" />}
            {trend === "neutral" && <Minus className="w-3 h-3" />}
            {trendValue}
          </Badge>
        )}
      </div>
      <p className="text-[22px] font-bold text-foreground font-mono tracking-tight leading-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
      {subValue && <p className="text-[11px] text-muted-foreground mt-0.5">{subValue}</p>}
      </CardContent>
    </Card>
  );
}
