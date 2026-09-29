import type { ElementType, ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: ElementType;
  /** Acciones personalizadas (botones con onClick, varios enlaces...). */
  children?: ReactNode;
  /** Versión compacta para dentro de una card. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, actionIcon: ActionIcon, children, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center animate-in fade-in duration-300",
        compact ? "px-4 py-10" : "rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 sm:py-20",
        className,
      )}
    >
      <div className={cn("relative mb-5 flex items-center justify-center rounded-2xl border border-border bg-card shadow-sm", compact ? "size-11" : "size-14")}>
        <div className="absolute inset-0 rounded-2xl bg-primary/5" />
        <Icon className={cn("relative text-primary-600 dark:text-primary", compact ? "size-5" : "size-6")} aria-hidden="true" />
      </div>
      <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {(children || (actionLabel && actionHref)) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && actionHref && (
            <a href={actionHref} className={cn(buttonVariants({ variant: "default" }), "gap-1.5")}>
              {ActionIcon && <ActionIcon className="size-4" />}
              {actionLabel}
            </a>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
