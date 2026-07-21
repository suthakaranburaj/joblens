import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type LoadingSkeletonProps = {
  /** Optional className for the root container. */
  className?: string;
};

/**
 * Shimmer placeholders that mirror the analysis results layout
 * while a job listing is being analyzed.
 */
export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn("w-full space-y-4 sm:space-y-5", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Analyzing job listing"
    >
      {/* Header / score card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-7 w-3/4 max-w-md" />
            <Skeleton className="h-4 w-1/2 max-w-xs" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <Skeleton className="mt-4 h-16 w-full" />
      </div>

      {/* Requirements card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="mb-4 h-5 w-40" />
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>

      {/* Nice-to-have + culture row */}
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <Skeleton className="mb-4 h-5 w-32" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <Skeleton className="mb-4 h-5 w-36" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>

      {/* Red flags card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="mb-4 h-5 w-28" />
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="flex gap-3 rounded-lg border border-border/70 bg-muted/30 p-3"
            >
              <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading analysis results…</span>
    </div>
  );
}
