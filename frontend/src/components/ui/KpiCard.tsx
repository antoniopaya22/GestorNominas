import type { ElementType } from "react";
import { StatCard } from "@/components/app/StatCard";

// Compatibilidad: API antigua (trend/trendValue/color) sobre la nueva
// StatCard. Para código nuevo, usar StatCard directamente.
interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "primary" | "success" | "danger" | "accent";
}

export function KpiCard({ label, value, subValue, icon, trend, trendValue }: KpiCardProps) {
  return (
    <StatCard
      label={label}
      value={value}
      icon={icon}
      hint={subValue}
      delta={trend && trendValue ? { value: trendValue, trend: trend === "neutral" ? "flat" : trend } : undefined}
    />
  );
}
