import type { ElementType } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionIcon?: ElementType;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, actionIcon: ActionIcon }: EmptyStateProps) {
  return (
    <div className="text-center py-20 animate-fade-in">
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
        <Icon className="w-10 h-10 text-muted-foreground/60" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">{description}</p>
      {actionLabel && actionHref && (
        <a href={actionHref} className={cn(buttonVariants({ variant: "default" }))}>
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          {actionLabel}
        </a>
      )}
    </div>
  );
}
