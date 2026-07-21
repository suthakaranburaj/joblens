"use client";

import { Briefcase, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EXAMPLE_JOBS = [
  {
    label: "LinkedIn — Software Engineer",
    url: "https://www.linkedin.com/jobs/view/1234567890",
  },
  {
    label: "Greenhouse — Backend Developer",
    url: "https://boards.greenhouse.io/example/jobs/1234567",
  },
  {
    label: "Lever — Product Designer",
    url: "https://jobs.lever.co/example/abcdef12-3456-7890-abcd-ef1234567890",
  },
] as const;

export type EmptyStateProps = {
  /** Called when the user selects an example job URL chip. */
  onExampleClick: (url: string) => void;
  className?: string;
};

/**
 * Initial empty state before the user runs their first analysis.
 */
export function EmptyState({ onExampleClick, className }: EmptyStateProps) {
  return (
    <Card
      className={cn(
        "border-dashed border-border bg-muted/20 shadow-none",
        className,
      )}
    >
      <CardHeader className="items-center text-center">
        <div className="relative mb-2 flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
          <Briefcase
            className="size-7 text-foreground"
            aria-hidden
          />
          <Search
            className="absolute -right-1 -bottom-1 size-5 rounded-full border border-border bg-background p-0.5 text-muted-foreground"
            aria-hidden
          />
        </div>
        <CardTitle className="text-xl sm:text-2xl">
          Paste a job URL to get started
        </CardTitle>
        <CardDescription className="max-w-md text-sm sm:text-base">
          JobLens extracts requirements, culture signals, and red flags — and
          optionally matches your resume to the role.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase sm:text-left">
          Try an example
        </p>
        <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
          {EXAMPLE_JOBS.map((example) => (
            <button
              key={example.url}
              type="button"
              onClick={() => onExampleClick(example.url)}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Badge
                variant="secondary"
                className="cursor-pointer px-3 py-1.5 text-xs font-normal transition-colors hover:bg-secondary/80 sm:text-sm"
              >
                {example.label}
              </Badge>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
