import { Fragment, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { SectionCard } from "../app";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatCompact, formatCurrency } from "../../lib/format";
import { ChartEmpty, tint } from "./finance-ui";
import { cn } from "cn";

export interface PanelConfig {
  title: string;
  description: string;
  controls?: ReactNode;
  render: (expanded: boolean) => ReactNode;
}

// En pantallas estrechas un Segmented de muchas opciones no cabe: que haga
// scroll horizontal en vez de desbordar la card o partir las etiquetas.
const CONTROLS_CLASS =
  "flex flex-wrap items-center gap-2 [&_[role=radiogroup]]:max-w-full [&_[role=radiogroup]]:overflow-x-auto [&_[role=radio]]:shrink-0 [&_[role=radio]]:whitespace-nowrap";

/** Card de la analítica: cabecera, fila de controles y botón para ampliar. */
export function AnalyticsPanel({ panel, onExpand, className }: { panel: PanelConfig; onExpand: () => void; className?: string }) {
  return (
    <SectionCard
      className={className}
      title={panel.title}
      description={panel.description}
      action={
        <Button variant="ghost" size="icon-sm" onClick={onExpand} aria-label={`Ampliar «${panel.title}»`} title="Ampliar">
          <Maximize2 className="size-4 text-muted-foreground" />
        </Button>
      }
    >
      {panel.controls && <div className={cn("mb-5", CONTROLS_CLASS)}>{panel.controls}</div>}
      {panel.render(false)}
    </SectionCard>
  );
}

/** Vista ampliada de un panel, con los mismos controles. */
export function ExpandedPanelDialog({ panel, onClose }: { panel: PanelConfig | null; onClose: () => void }) {
  return (
    <Dialog open={panel !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {panel && (
          <>
            <div className="border-b border-border px-6 py-5 pr-14">
              <DialogTitle className="text-lg font-semibold">{panel.title}</DialogTitle>
              <DialogDescription className="mt-1">{panel.description}</DialogDescription>
              {panel.controls && <div className={cn("mt-4", CONTROLS_CLASS)}>{panel.controls}</div>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-6 py-5">{panel.render(true)}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Título de bloque dentro de la página de analítica. */
export function AnalyticsSection({ title, description, children, className }: { title: string; description: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export interface MatrixRow {
  key: string;
  label: string;
  total: number;
  values: Array<{ month: string; label: string; value: number }>;
}

/** Mapa de calor serie × mes. La intensidad se mezcla con color-mix para seguir el tema. */
export function MatrixHeatmap({ months, rows, color, expanded }: {
  months: Array<{ month: string; label: string }>;
  rows: MatrixRow[];
  color: string;
  expanded: boolean;
}) {
  if (!rows.length) {
    return <ChartEmpty message="No hay datos suficientes para construir la matriz temporal." height={expanded ? 480 : 300} />;
  }

  const maxValue = Math.max(...rows.flatMap((row) => row.values.map((v) => v.value)), 0);
  const cell = expanded ? 76 : 60;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `minmax(150px, 190px) repeat(${months.length}, minmax(${cell}px, 1fr))`,
          minWidth: `${190 + months.length * (cell + 4)}px`,
        }}
      >
        <div />
        {months.map((m) => (
          <div key={m.month} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">{m.label}</div>
        ))}
        {rows.map((row) => (
          <Fragment key={row.key}>
            <div className="flex flex-col justify-center pr-3">
              <p className="truncate text-sm font-medium text-foreground" title={row.label}>{row.label}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{formatCurrency(row.total)}</p>
            </div>
            {row.values.map((v) => {
              const intensity = maxValue > 0 ? v.value / maxValue : 0;
              return (
                <div
                  key={v.month}
                  title={`${row.label} · ${v.label}: ${formatCurrency(v.value)}`}
                  className={cn(
                    "flex items-center justify-center rounded-md text-[11px] tabular-nums",
                    expanded ? "h-14" : "h-11",
                    v.value > 0 ? "font-medium text-foreground" : "border border-dashed border-border text-muted-foreground/50",
                  )}
                  style={v.value > 0 ? { backgroundColor: tint(color, 12 + intensity * 60) } : undefined}
                >
                  {v.value > 0 ? formatCompact(v.value) : "—"}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
