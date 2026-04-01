import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { ElementType } from "react";

const COLOR_MAP = {
  primary: { bg: "bg-primary-50", icon: "text-primary-600", ring: "ring-primary-100" },
  success: { bg: "bg-success-50", icon: "text-success-600", ring: "ring-success-100" },
  danger: { bg: "bg-danger-50", icon: "text-danger-600", ring: "ring-danger-100" },
  accent: { bg: "bg-accent-50", icon: "text-accent-600", ring: "ring-accent-100" },
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
    <div className="card p-5 animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} ring-1 ${c.ring} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full ${
            trend === "up" ? "bg-success-50 text-success-700" :
            trend === "down" ? "bg-danger-50 text-danger-700" :
            "bg-surface-100 text-surface-600"
          }`}>
            {trend === "up" && <ArrowUpRight className="w-3 h-3" />}
            {trend === "down" && <ArrowDownRight className="w-3 h-3" />}
            {trend === "neutral" && <Minus className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-[22px] font-bold text-surface-900 font-mono tracking-tight leading-tight">{value}</p>
      <p className="text-xs font-medium text-surface-500 mt-1 uppercase tracking-wider">{label}</p>
      {subValue && <p className="text-[11px] text-surface-400 mt-0.5">{subValue}</p>}
    </div>
  );
}
