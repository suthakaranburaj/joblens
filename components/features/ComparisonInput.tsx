"use client";

import { Loader2, Sparkles } from "lucide-react";
import { ScoreCard } from "@/components/features/ScoreCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { JobSlotState } from "@/types";

export type ComparisonInputProps = {
  jobA: JobSlotState;
  jobB: JobSlotState;
  onJobAUrlChange: (url: string) => void;
  onJobBUrlChange: (url: string) => void;
  onAnalyzeA: () => void;
  onAnalyzeB: () => void;
  onCompare: () => void;
  isComparing: boolean;
  className?: string;
};

function JobColumn({
  label,
  slot,
  onUrlChange,
  onAnalyze,
  disabled,
}: {
  label: string;
  slot: JobSlotState;
  onUrlChange: (url: string) => void;
  onAnalyze: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>Paste a direct job posting URL</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="url"
          value={slot.url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://boards.greenhouse.io/..."
          disabled={slot.loading || disabled}
          className="h-11"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!slot.url.trim() || slot.loading || disabled}
          onClick={onAnalyze}
        >
          {slot.loading ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Analyzing {label}…
            </>
          ) : (
            <>Analyze {label}</>
          )}
        </Button>

        {slot.error ? (
          <p className="text-sm text-destructive" role="alert">
            {slot.error.message}
          </p>
        ) : null}

        {slot.analysis ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="font-medium text-foreground">
              {slot.analysis.role_title}
            </p>
            <p className="text-sm text-muted-foreground">
              {slot.analysis.company ?? "Company unknown"}
            </p>
            <div className="mt-3 flex justify-center">
              <ScoreCard score={slot.analysis.overall_score} className="scale-90 p-3" />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Dual URL inputs for compare mode with per-job analyze actions.
 */
export function ComparisonInput({
  jobA,
  jobB,
  onJobAUrlChange,
  onJobBUrlChange,
  onAnalyzeA,
  onAnalyzeB,
  onCompare,
  isComparing,
  className,
}: ComparisonInputProps) {
  const bothReady = Boolean(jobA.analysis && jobB.analysis);
  const anyLoading = jobA.loading || jobB.loading;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <JobColumn
          label="Job A"
          slot={jobA}
          onUrlChange={onJobAUrlChange}
          onAnalyze={onAnalyzeA}
          disabled={isComparing}
        />
        <JobColumn
          label="Job B"
          slot={jobB}
          onUrlChange={onJobBUrlChange}
          onAnalyze={onAnalyzeB}
          disabled={isComparing}
        />
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <Button
          type="button"
          size="lg"
          disabled={!bothReady || anyLoading || isComparing}
          onClick={onCompare}
          className="w-full sm:w-auto"
        >
          {isComparing ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Comparing…
            </>
          ) : (
            <>
              <Sparkles data-icon="inline-start" />
              Compare Jobs
            </>
          )}
        </Button>
        {!bothReady ? (
          <p className="text-center text-xs text-muted-foreground sm:text-left">
            Analyze both jobs to enable comparison
          </p>
        ) : null}
      </div>
    </div>
  );
}
