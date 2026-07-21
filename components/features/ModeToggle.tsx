"use client";

import { GitCompare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalysisMode } from "@/types";

export type ModeToggleProps = {
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  className?: string;
};

/**
 * Switches between single-job analysis and two-job comparison.
 */
export function ModeToggle({
  mode,
  onModeChange,
  className,
}: ModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex w-full max-w-md rounded-lg border border-border bg-muted/40 p-1",
        className,
      )}
      role="tablist"
      aria-label="Analysis mode"
    >
      <Button
        type="button"
        role="tab"
        aria-selected={mode === "single"}
        variant={mode === "single" ? "default" : "ghost"}
        className="h-9 flex-1 gap-2 text-sm"
        onClick={() => onModeChange("single")}
      >
        <Search className="size-4" aria-hidden />
        Analyze Single Job
      </Button>
      <Button
        type="button"
        role="tab"
        aria-selected={mode === "compare"}
        variant={mode === "compare" ? "default" : "ghost"}
        className="h-9 flex-1 gap-2 text-sm"
        onClick={() => onModeChange("compare")}
      >
        <GitCompare className="size-4" aria-hidden />
        Compare Two Jobs
      </Button>
    </div>
  );
}
