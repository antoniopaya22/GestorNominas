const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const currencyFmt = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // es-ES no agrupa miles en cifras de 4 dígitos por defecto ("1798,75 €").
  useGrouping: "always",
} as unknown as Intl.NumberFormatOptions);

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return currencyFmt.format(n);
}

export function formatCompact(n: number): string {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}${(abs / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })}k €`;
  return `${sign}${abs.toFixed(0)} €`;
}

const pctFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Porcentaje a la española: "77,7 %". */
export function formatPct(n: number): string {
  return `${pctFmt.format(n)} %`;
}

export function formatMonthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[Number(mo) - 1]} ${y?.slice(2)}`;
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}
