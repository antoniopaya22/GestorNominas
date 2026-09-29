import { useId } from "react";
import { cn } from "cn";

interface SparklineProps {
  values: number[];
  color?: string;
  className?: string;
  /** Relleno degradado bajo la línea. */
  area?: boolean;
}

// SVG puro (sin Recharts): barato para usar dentro de tarjetas y listas.
export function Sparkline({ values, color = "var(--chart-1)", className, area = true }: SparklineProps) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 100;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const fill = `${line} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("overflow-visible", className)} aria-hidden="true">
      {area && (
        <>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#spark-${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
