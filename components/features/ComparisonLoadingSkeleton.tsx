import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ComparisonLoadingSkeletonProps = {
  className?: string;
};

/**
 * Side-by-side loading placeholders for compare mode.
 */
export function ComparisonLoadingSkeleton({
  className,
}: ComparisonLoadingSkeletonProps) {
  return (
    <div
      className={cn("grid gap-4 md:grid-cols-2 md:gap-5", className)}
      role="status"
      aria-label="Loading comparison"
    >
      {[0, 1].map((col) => (
        <div
          key={col}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="mx-auto h-28 w-28 rounded-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}
