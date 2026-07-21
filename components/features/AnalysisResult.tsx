"use client";

import {
  Building2,
  Lightbulb,
  MapPin,
  Quote,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { MatchScore } from "@/components/features/MatchScore";
import { RedFlagList } from "@/components/features/RedFlagList";
import { RequirementList } from "@/components/features/RequirementList";
import { ScoreCard } from "@/components/features/ScoreCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GrowthPotential, JobAnalysis, MatchResult } from "@/types";

export type AnalysisResultProps = {
  analysis: JobAnalysis;
  matchResult?: MatchResult;
  /** Called when the user chooses to analyze another job. */
  onAnalyzeAnother?: () => void;
  className?: string;
};

/**
 * Growth potential badge styling.
 */
function growthBadgeClass(potential: GrowthPotential): string {
  switch (potential) {
    case "High":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "Medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "Low":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "Unclear":
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

/**
 * Composes the full job analysis results UI.
 */
export function AnalysisResult({
  analysis,
  matchResult,
  onAnalyzeAnother,
  className,
}: AnalysisResultProps) {
  const {
    role_title,
    company,
    location,
    work_model,
    salary_range,
    employment_type,
    key_requirements,
    nice_to_have,
    red_flags,
    culture_signals,
    growth_potential,
    overall_score,
    verdict,
  } = analysis;

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500",
        "w-full space-y-5 sm:space-y-6",
        className,
      )}
    >
      <Card className="border-border shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <CardTitle className="text-xl leading-tight sm:text-2xl">
                {role_title}
              </CardTitle>
              <div className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                {company ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    {company}
                  </span>
                ) : null}
                {location ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    {location}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{work_model}</Badge>
              {salary_range ? (
                <Badge variant="outline">{salary_range}</Badge>
              ) : null}
              <Badge variant="outline">{employment_type}</Badge>
              <Badge
                variant="outline"
                className={cn("gap-1", growthBadgeClass(growth_potential))}
              >
                <TrendingUp className="size-3.5" aria-hidden />
                Growth: {growth_potential}
              </Badge>
            </div>
          </div>

          <ScoreCard score={overall_score} className="w-full shrink-0 sm:w-auto sm:min-w-[10rem]" />
        </CardHeader>
      </Card>

      {matchResult ? <MatchScore matchResult={matchResult} /> : null}

      <RequirementList
        requirements={key_requirements}
        niceToHave={nice_to_have}
      />

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Quote
              className="size-4 text-muted-foreground"
              aria-hidden
            />
            Culture Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="border-l-2 border-primary/30 pl-4 text-sm leading-relaxed text-muted-foreground italic sm:text-base">
            {culture_signals}
          </blockquote>
        </CardContent>
      </Card>

      <RedFlagList redFlags={red_flags} />

      <Card className="border-border bg-muted/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Lightbulb
              className="size-5 text-amber-500 dark:text-amber-400"
              aria-hidden
            />
            Verdict
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground sm:text-base">
            {verdict}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2 pb-1">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onAnalyzeAnother}
          className="w-full sm:w-auto"
        >
          <RotateCcw data-icon="inline-start" />
          Analyze Another Job
        </Button>
      </div>
    </div>
  );
}
