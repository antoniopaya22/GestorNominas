import { formatCurrency } from "../../lib/format";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; payload?: Record<string, unknown> }>;
  label?: string;
  valueFormatter?: (v: number) => string;
  labelFormatter?: (label: string) => string;
}

// Sigue el tema (bg-popover, border) — los colores de serie se muestran como
// punto, así el contraste del texto no depende del color de la serie.
export function ChartTooltip({ active, payload, label, valueFormatter = formatCurrency, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-lg shadow-black/10">
      {label != null && (
        <p className="mb-1.5 font-medium text-muted-foreground">{labelFormatter ? labelFormatter(label) : label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{valueFormatter(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
