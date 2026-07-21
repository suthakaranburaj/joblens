"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/types";

export type MatchScoreProps = {
  matchResult: MatchResult;
  className?: string;
};

function getMatchColorClasses(score: number): {
  ring: string;
  text: string;
  indicator: string;
} {
  if (score >= 70) {
    return {
      ring: "stroke-emerald-500/80",
      text: "text-emerald-600 dark:text-emerald-400",
      indicator: "bg-emerald-500",
    };
  }
  if (score >= 40) {
    return {
      ring: "stroke-amber-500/80",
      text: "text-amber-600 dark:text-amber-400",
      indicator: "bg-amber-500",
    };
  }
  return {
    ring: "stroke-red-500/80",
    text: "text-red-600 dark:text-red-400",
    indicator: "bg-red-500",
  };
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Resume match visualization with circular progress and skill columns.
 */
export function MatchScore({ matchResult, className }: MatchScoreProps) {
  const { match_score, matching_skills, missing_skills, gap_analysis } =
    matchResult;
  const clampedScore = Math.min(100, Math.max(0, match_score));
  const colors = getMatchColorClasses(clampedScore);

  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setAnimatedScore(clampedScore * easeOutCubic(progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clampedScore]);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset =
    circumference - (animatedScore / 100) * circumference;

  return (
    <Card className={cn("border-border shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Resume Match</CardTitle>
        <CardDescription>
          How well your resume aligns with this role
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative flex size-28 items-center justify-center sm:size-32">
            <svg
              className="size-full -rotate-90"
              viewBox="0 0 120 120"
              aria-hidden
            >
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className="stroke-muted"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className={cn(colors.ring, "transition-[stroke-dashoffset] duration-300")}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  "text-2xl font-semibold tabular-nums sm:text-3xl",
                  colors.text,
                )}
              >
                {Math.round(animatedScore)}
              </span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>

          <div className="w-full flex-1 sm:max-w-xs">
            <Progress
              value={animatedScore}
              className={cn(
                "w-full flex-col gap-2",
                colors.indicator === "bg-emerald-500" &&
                  "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                colors.indicator === "bg-amber-500" &&
                  "[&_[data-slot=progress-indicator]]:bg-amber-500",
                colors.indicator === "bg-red-500" &&
                  "[&_[data-slot=progress-indicator]]:bg-red-500",
                "[&_[data-slot=progress-track]]:h-2",
              )}
            />
            <p className="mt-2 text-center text-sm text-muted-foreground sm:text-left">
              Match score
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">
              Matching Skills
            </h4>
            {matching_skills.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No clear matches found.
              </p>
            ) : (
              <ul className="space-y-2">
                {matching_skills.map((skill, index) => (
                  <li
                    key={`${skill}-${index}`}
                    className="flex gap-2 text-sm text-foreground"
                  >
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    {skill}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <h4 className="mb-3 text-sm font-medium text-foreground">
              Missing Skills
            </h4>
            {missing_skills.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No major gaps identified.
              </p>
            ) : (
              <ul className="space-y-2">
                {missing_skills.map((skill, index) => (
                  <li
                    key={`${skill}-${index}`}
                    className="flex gap-2 text-sm text-foreground"
                  >
                    <X
                      className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
                      aria-hidden
                    />
                    {skill}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-2 text-sm font-medium text-foreground">
            Gap Analysis
          </h4>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {gap_analysis}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
