"use client";

import { useState } from "react";
import { Copy, Trophy } from "lucide-react";
import { ScoreCard } from "@/components/features/ScoreCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  ComparisonCategoryScore,
  ComparisonWinner,
  JobAnalysis,
  JobComparison,
} from "@/types";

export type ComparisonResultProps = {
  jobA: JobAnalysis;
  jobB: JobAnalysis;
  comparison: JobComparison;
  className?: string;
};

const CATEGORY_LABELS: Record<
  keyof JobComparison["category_scores"],
  string
> = {
  salary: "Salary",
  growth: "Growth Potential",
  culture: "Culture",
  requirements_match: "Requirements Match",
  red_flags: "Red Flags",
};

function winnerLabel(winner: ComparisonWinner): string {
  if (winner === "A") return "Job A";
  if (winner === "B") return "Job B";
  return "Tie";
}

function winnerEmoji(winner: ComparisonWinner): string {
  if (winner === "A") return "🏆 A";
  if (winner === "B") return "🏆 B";
  return "🤝 Tie";
}

function winnerBannerText(winner: ComparisonWinner): string {
  if (winner === "A") return "Job A is the better overall choice";
  if (winner === "B") return "Job B is the better overall choice";
  return "It's a tie — both roles have trade-offs";
}

function slotAccent(
  side: "A" | "B",
  winner: ComparisonWinner,
): string {
  if (winner === "tie") {
    return "border-amber-500/40 bg-amber-500/5";
  }
  if (winner === side) {
    return "border-emerald-500/40 bg-emerald-500/5";
  }
  return "border-border bg-muted/20";
}

function CategoryCard({
  title,
  score,
  jobASummary,
  jobBSummary,
  index,
}: {
  title: string;
  score: ComparisonCategoryScore;
  jobASummary: string;
  jobBSummary: string;
  index: number;
}) {
  return (
    <Card
      className={cn(
        "border-border shadow-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
      )}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">{winnerEmoji(score.winner)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div
            className={cn(
              "rounded-lg border p-3",
              slotAccent("A", score.winner),
            )}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Job A
            </p>
            <p className="text-foreground">{jobASummary}</p>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3",
              slotAccent("B", score.winner),
            )}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Job B
            </p>
            <p className="text-foreground">{jobBSummary}</p>
          </div>
        </div>
        <p className="text-muted-foreground">{score.explanation}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Side-by-side comparison dashboard for two analyzed jobs.
 */
export function ComparisonResult({
  jobA,
  jobB,
  comparison,
  className,
}: ComparisonResultProps) {
  const [copied, setCopied] = useState(false);

  async function copySummary() {
    const text = [
      winnerBannerText(comparison.winner),
      comparison.summary,
      comparison.recommendation,
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const categories = Object.entries(comparison.category_scores) as Array<
    [keyof JobComparison["category_scores"], ComparisonCategoryScore]
  >;

  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500 fill-mode-both",
        className,
      )}
    >
      <Card className="border-border bg-gradient-to-br from-muted/40 to-card shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Trophy
                  className="size-5 text-amber-500 dark:text-amber-400"
                  aria-hidden
                />
                Comparison Result
              </CardTitle>
              <CardDescription className="mt-2 text-base text-foreground">
                {winnerBannerText(comparison.winner)}
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={copySummary}>
              <Copy data-icon="inline-start" />
              {copied ? "Copied" : "Copy summary"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {comparison.summary}
          </p>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">Job A</th>
              <th className="p-3 font-medium">Job B</th>
              <th className="p-3 font-medium">Winner</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/80">
              <td className="p-3 font-medium">Role</td>
              <td className="p-3">{jobA.role_title}</td>
              <td className="p-3">{jobB.role_title}</td>
              <td className="p-3 text-muted-foreground">—</td>
            </tr>
            <tr className="border-b border-border/80">
              <td className="p-3 font-medium">Company</td>
              <td className="p-3">{jobA.company ?? "—"}</td>
              <td className="p-3">{jobB.company ?? "—"}</td>
              <td className="p-3 text-muted-foreground">—</td>
            </tr>
            <tr className="border-b border-border/80">
              <td className="p-3 font-medium">Salary</td>
              <td className="p-3">{jobA.salary_range ?? "Not listed"}</td>
              <td className="p-3">{jobB.salary_range ?? "Not listed"}</td>
              <td className="p-3">
                {winnerEmoji(comparison.category_scores.salary.winner)}
              </td>
            </tr>
            <tr className="border-b border-border/80">
              <td className="p-3 font-medium align-top">Score</td>
              <td className="p-3">
                <ScoreCard score={jobA.overall_score} className="scale-90 p-2" />
              </td>
              <td className="p-3">
                <ScoreCard score={jobB.overall_score} className="scale-90 p-2" />
              </td>
              <td className="p-3 align-top">
                {jobA.overall_score === jobB.overall_score
                  ? "🤝 Tie"
                  : jobA.overall_score > jobB.overall_score
                    ? "🏆 A"
                    : "🏆 B"}
              </td>
            </tr>
            <tr className="border-b border-border/80">
              <td className="p-3 font-medium">Growth</td>
              <td className="p-3">{jobA.growth_potential}</td>
              <td className="p-3">{jobB.growth_potential}</td>
              <td className="p-3">
                {winnerEmoji(comparison.category_scores.growth.winner)}
              </td>
            </tr>
            <tr>
              <td className="p-3 font-medium">Red Flags</td>
              <td className="p-3">{jobA.red_flags.length}</td>
              <td className="p-3">{jobB.red_flags.length}</td>
              <td className="p-3">
                {winnerEmoji(comparison.category_scores.red_flags.winner)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {categories.map(([key, score], index) => (
          <CategoryCard
            key={key}
            title={CATEGORY_LABELS[key]}
            score={score}
            index={index}
            jobASummary={
              key === "salary"
                ? jobA.salary_range ?? "Not disclosed"
                : key === "growth"
                  ? jobA.growth_potential
                  : key === "culture"
                    ? jobA.culture_signals.slice(0, 160)
                    : key === "requirements_match"
                      ? `${jobA.key_requirements.length} key requirements`
                      : `${jobA.red_flags.length} flagged`
            }
            jobBSummary={
              key === "salary"
                ? jobB.salary_range ?? "Not disclosed"
                : key === "growth"
                  ? jobB.growth_potential
                  : key === "culture"
                    ? jobB.culture_signals.slice(0, 160)
                    : key === "requirements_match"
                      ? `${jobB.key_requirements.length} key requirements`
                      : `${jobB.red_flags.length} flagged`
            }
          />
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          <blockquote className="border-l-2 border-primary/40 pl-4 text-sm leading-relaxed text-foreground italic sm:text-base">
            {comparison.recommendation}
          </blockquote>
          <p className="mt-3 text-xs text-muted-foreground">
            Overall winner: {winnerLabel(comparison.winner)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
