import { formatCurrency } from "../../lib/format";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}

export function ChartTooltip({ active, payload, label, valueFormatter = formatCurrency }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm border border-surface-700">
      <p className="font-semibold text-surface-300 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-surface-400 min-w-[80px]">{entry.name}:</span>
          <span className="font-mono font-semibold">{valueFormatter(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}
