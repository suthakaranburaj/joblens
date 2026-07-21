"use client";

import {
  AlertCircle,
  FileQuestion,
  Ghost,
  Timer,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Supported application error categories for the analyze flow. */
export type JobLensErrorType =
  | "invalid_url"
  | "not_job_listing"
  | "fetch_failed"
  | "analysis_failed"
  | "rate_limited";

export type ErrorStateProps = {
  /** Error category key (known types get tailored copy and actions). */
  errorType: JobLensErrorType | string;
  /** Primary error message (from API or validation). */
  message: string;
  /** Retry or recovery action handler. */
  onRetry: () => void;
  className?: string;
};

type ErrorConfig = {
  title: string;
  icon: LucideIcon;
  actionLabel: string;
  suggestion: string;
  iconClassName: string;
};

const ERROR_CONFIG: Record<JobLensErrorType, ErrorConfig> = {
  invalid_url: {
    title: "Invalid or unsupported URL",
    icon: AlertCircle,
    actionLabel: "Use Different URL",
    suggestion:
      "Paste a direct link to a job posting from LinkedIn, Indeed, Greenhouse, Lever, or Workday.",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  not_job_listing: {
    title: "This doesn't look like a job listing",
    icon: Ghost,
    actionLabel: "Use Different URL",
    suggestion:
      "Open the full job description page (not search results or a company homepage) and copy that URL.",
    iconClassName: "text-violet-600 dark:text-violet-400",
  },
  fetch_failed: {
    title: "Couldn't fetch page content",
    icon: WifiOff,
    actionLabel: "Try Again",
    suggestion:
      "The site may be blocking automated access. Wait a moment, then retry or try another job board.",
    iconClassName: "text-red-600 dark:text-red-400",
  },
  analysis_failed: {
    title: "Analysis failed",
    icon: FileQuestion,
    actionLabel: "Try Again",
    suggestion:
      "Our AI couldn't parse this listing. Shorten very long pages or try a different posting.",
    iconClassName: "text-orange-600 dark:text-orange-400",
  },
  rate_limited: {
    title: "Too many requests",
    icon: Timer,
    actionLabel: "Try Again",
    suggestion:
      "You've hit the temporary rate limit. Please wait about a minute before analyzing again.",
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
};

function isKnownErrorType(type: string): type is JobLensErrorType {
  return type in ERROR_CONFIG;
}

/**
 * Friendly error panel for analyze flow failures with contextual actions.
 */
export function ErrorState({
  errorType,
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  const config = isKnownErrorType(errorType)
    ? ERROR_CONFIG[errorType]
    : ERROR_CONFIG.analysis_failed;
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        "border-border shadow-sm",
        className,
      )}
      role="alert"
    >
      <CardHeader className="items-center text-center sm:items-start sm:text-left">
        <div
          className={cn(
            "mb-2 flex size-12 items-center justify-center rounded-full bg-muted",
            config.iconClassName,
          )}
        >
          <Icon className="size-6" aria-hidden />
        </div>
        <CardTitle className="text-lg">{config.title}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
          {config.suggestion}
        </p>
      </CardContent>
      <CardFooter className="justify-center sm:justify-start">
        <Button type="button" onClick={onRetry}>
          {config.actionLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
