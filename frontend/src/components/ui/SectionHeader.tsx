import type { ElementType, ReactNode } from "react";

interface SectionHeaderProps {
  icon?: ElementType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

// Cabecera de bloque dentro de una página. Para bloques en card, preferir
// SectionCard/ChartCard (components/app), que ya incluyen su cabecera.
export function SectionHeader({ icon: Icon, title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
