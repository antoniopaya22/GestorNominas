import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

// Skeletons con la misma geometría que las primitivas reales, para que la
// carga no provoque saltos de layout.

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8 space-y-2.5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <div className="mt-4 flex items-end justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export function ChartCardSkeleton({ height = 280, className }: { height?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <Skeleton className="mt-5 w-full rounded-lg" style={{ height }} />
    </div>
  );
}

export function ListCardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <Skeleton className="h-4 w-32" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
