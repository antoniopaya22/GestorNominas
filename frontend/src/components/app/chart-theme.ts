// Tema compartido de Recharts. Todo va por variables CSS (definidas en
// global.css para claro/oscuro), así los SVG siguen el tema activo sin JS.
// Uso típico:
//   <CartesianGrid {...chartGrid} />
//   <XAxis dataKey="label" {...chartAxis} />
//   <YAxis {...chartAxis} tickFormatter={formatCompact} width={56} />
//   <Tooltip content={<ChartTooltip />} cursor={chartCursor} />

export const chartColors = {
  /** Serie principal: verde de marca (neto, ahorro, "lo bueno"). */
  primary: "var(--chart-1)",
  /** Serie secundaria: navy/pizarra (bruto, referencia). */
  secondary: "var(--chart-2)",
  tertiary: "var(--chart-3)",
  quaternary: "var(--chart-4)",
  quinary: "var(--chart-5)",
  /** Semánticos de datos: solo para ingresos/gastos/impuestos. */
  income: "#16a34a",
  expense: "#ef4444",
  tax: "#f59e0b",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
} as const;

/** Paleta categórica ordenada (tartas, series múltiples). */
export const chartPalette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#ec4899",
] as const;

export const chartGrid = {
  stroke: chartColors.grid,
  strokeDasharray: "3 4",
  vertical: false,
} as const;

export const chartAxis = {
  tick: { fontSize: 11, fill: chartColors.axis },
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
} as const;

export const chartCursor = { stroke: "var(--border)", strokeWidth: 1 } as const;
export const chartBarCursor = { fill: "var(--muted)", opacity: 0.6 } as const;

export const chartLegend = {
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: { fontSize: 12, paddingTop: 12, color: "var(--muted-foreground)" },
};

/** Estilos para el <Tooltip> nativo de Recharts cuando no se usa ChartTooltip. */
export const chartTooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    fontSize: 12,
    padding: "8px 12px",
    boxShadow: "0 8px 24px -12px rgb(0 0 0 / 0.25)",
  },
  itemStyle: { color: "var(--popover-foreground)" },
  labelStyle: { color: "var(--muted-foreground)", marginBottom: 4 },
} as const;

/** Punto activo coherente en ambos temas (relleno = fondo de card). */
export const chartActiveDot = { r: 4, strokeWidth: 2, fill: "var(--card)" } as const;
