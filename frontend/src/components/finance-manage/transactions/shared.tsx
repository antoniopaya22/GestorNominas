import {
  ArrowDownRight, ArrowUpRight, ArrowLeftRight, Wallet, Landmark, CreditCard, Banknote, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Account, CategoryGroup, RecurringCadence } from "../../../lib/api";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "cn";
import { darkBoost } from "../../../lib/color";

export type TxType = "expense" | "income" | "transfer";

export const NONE = "__none__";

export const TYPE_META: Record<TxType, { label: string; plural: string; icon: LucideIcon; tile: string; text: string; selected: string }> = {
  expense: {
    label: "Gasto",
    plural: "Gastos",
    icon: ArrowDownRight,
    tile: "bg-red-500/10 text-red-600 dark:text-red-400",
    text: "text-foreground",
    selected: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  },
  income: {
    label: "Ingreso",
    plural: "Ingresos",
    icon: ArrowUpRight,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    selected: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  transfer: {
    label: "Transferencia",
    plural: "Traspasos",
    icon: ArrowLeftRight,
    tile: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    selected: "border-(--chart-2)/40 bg-(--chart-2)/10 text-foreground",
  },
};

export const ACCOUNT_ICONS: Record<Account["type"], LucideIcon> = {
  bank: Landmark,
  credit_card: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
  other: Wallet,
};

export const CADENCE_LABELS: Record<RecurringCadence, string> = { weekly: "Semanal", monthly: "Mensual", yearly: "Anual" };

// ─── Fechas ─────────────────────────────────────────────────────
export function getTodayIsoDate(): string {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return { year, month, day };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsFromBase(isoDate: string, monthsToAdd: number): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const absoluteMonth = year * 12 + (month - 1) + monthsToAdd;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = (absoluteMonth % 12) + 1;
  return formatIsoDate(targetYear, targetMonth, Math.min(day, getDaysInMonth(targetYear, targetMonth)));
}

export function getNextMonthlyOccurrence(isoDate: string, fromDate = getTodayIsoDate()): string {
  for (let monthIndex = 0; monthIndex < 120; monthIndex += 1) {
    const candidate = addMonthsFromBase(isoDate, monthIndex);
    if (candidate >= fromDate) return candidate;
  }
  return fromDate;
}

export function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateLong(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** "Hoy", "Ayer" o "Jueves, 25 sept" (con año si no es el actual). */
export function formatDayHeading(d: string, today = getTodayIsoDate()) {
  if (d === today) return "Hoy";
  const y = new Date(today + "T00:00:00");
  y.setDate(y.getDate() - 1);
  if (d === formatIsoDate(y.getFullYear(), y.getMonth() + 1, y.getDate())) return "Ayer";
  const sameYear = d.slice(0, 4) === today.slice(0, 4);
  const s = new Date(d + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }),
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatCadence(cadence: RecurringCadence, intervalCount: number): string {
  if (cadence === "weekly") return intervalCount === 1 ? "Cada semana" : `Cada ${intervalCount} semanas`;
  if (cadence === "yearly") return intervalCount === 1 ? "Cada año" : `Cada ${intervalCount} años`;
  return intervalCount === 1 ? "Cada mes" : `Cada ${intervalCount} meses`;
}

// ─── Selects reutilizados en filtros y formularios ─────────────
export function AccountSelect({
  id, value, onChange, accounts, placeholder = "Selecciona una cuenta", allowNone = true, excludeId,
}: {
  id?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  accounts: Account[];
  placeholder?: string;
  allowNone?: boolean;
  excludeId?: number | "";
}) {
  const options = accounts.filter((a) => a.id !== excludeId);
  return (
    <Select value={value ? String(value) : NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : Number(v))}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {(v: string) => {
            const a = accounts.find((acc) => String(acc.id) === v);
            if (!a) return <span className="text-muted-foreground">{placeholder}</span>;
            return (
              <span className="flex items-center gap-2">
                <span className={cn("size-2 rounded-full", darkBoost(a.color))} style={{ backgroundColor: a.color }} aria-hidden="true" />
                {a.name}
              </span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>{placeholder}</SelectItem>}
        {options.map((a) => (
          <SelectItem key={a.id} value={String(a.id)}>
            <span className={cn("size-2 rounded-full", darkBoost(a.color))} style={{ backgroundColor: a.color }} aria-hidden="true" />
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function CategorySelect({
  id, value, onChange, groups, noneLabel = "Sin categoría", className,
}: {
  id?: string;
  value: number | "";
  onChange: (v: number | "") => void;
  groups: CategoryGroup[];
  noneLabel?: string;
  className?: string;
}) {
  const flat = groups.flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })));
  return (
    <Select value={value ? String(value) : NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : Number(v))}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={noneLabel}>
          {(v: string) => {
            const c = flat.find((cat) => String(cat.id) === v);
            return c ? (
              <span className="truncate">
                <span className="text-muted-foreground">{c.groupName} · </span>{c.name}
              </span>
            ) : (
              <span className="text-muted-foreground">{noneLabel}</span>
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{noneLabel}</SelectItem>
        {groups.map((g) => (
          <SelectGroup key={g.id}>
            <SelectLabel>{g.name}</SelectLabel>
            {g.categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Selector segmentado de tipo con color semántico (formularios). */
export function TypeToggle<T extends TxType>({
  value, onChange, types, disabled = [],
}: {
  value: T;
  onChange: (t: T) => void;
  types: readonly T[];
  disabled?: T[];
}) {
  return (
    <div role="radiogroup" aria-label="Tipo de movimiento" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0, 1fr))` }}>
      {types.map((t) => {
        const meta = TYPE_META[t];
        const selected = value === t;
        const isDisabled = disabled.includes(t);
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={isDisabled}
            onClick={() => onChange(t)}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40",
              selected ? meta.selected : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <meta.icon className="size-4" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/** Input de importe con símbolo € y sin flechas. */
export const amountInputClass =
  "pr-8 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
