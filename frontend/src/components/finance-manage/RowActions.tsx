import { Fragment, type ElementType } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

export interface RowAction {
  label: string;
  icon?: ElementType;
  onSelect: () => void;
  destructive?: boolean;
  /** Separador antes de este item. */
  separated?: boolean;
  disabled?: boolean;
}

interface RowActionsProps {
  actions: RowAction[];
  /** Nombre del elemento, para el aria-label del botón. */
  itemLabel: string;
  className?: string;
}

// Menú "···" de acciones por fila/tarjeta.
export function RowActions({ actions, itemLabel, className }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Acciones de ${itemLabel}`}
            className={cn("text-muted-foreground data-popup-open:bg-muted data-popup-open:text-foreground", className)}
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {actions.map((a) => (
          <Fragment key={a.label}>
            {a.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={a.onSelect}
              disabled={a.disabled}
              variant={a.destructive ? "destructive" : "default"}
              className="gap-2"
            >
              {a.icon && <a.icon className="size-4" />}
              {a.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
