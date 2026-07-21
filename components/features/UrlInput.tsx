"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validateJobUrl, validateUrl } from "@/lib/utils/validators";

const SUPPORTED_SITES = [
  "LinkedIn",
  "Indeed",
  "Greenhouse",
  "Lever",
  "Workday",
] as const;

export type UrlInputProps = {
  /** Called with the trimmed URL when the form is submitted. */
  onSubmit: (url: string) => void;
  /** Disables input and shows a loading spinner on the submit button. */
  isLoading?: boolean;
  /** Optional error message shown below the input. */
  error?: string | null;
  /** Optional className for the root container. */
  className?: string;
};

/**
 * Prominent job URL input with validation indicator, supported-site badges,
 * and an Analyze action button.
 */
export function UrlInput({
  onSubmit,
  isLoading = false,
  error = null,
  className,
}: UrlInputProps) {
  const [url, setUrl] = useState("");

  const trimmed = url.trim();
  const validationState = useMemo(() => {
    if (!trimmed) return "idle" as const;
    if (validateJobUrl(trimmed)) return "valid" as const;
    if (validateUrl(trimmed)) return "unsupported" as const;
    return "invalid" as const;
  }, [trimmed]);

  const canSubmit = validationState === "valid" && !isLoading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  return (
    <div className={cn("w-full space-y-3", className)}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch"
      >
        <div className="relative min-w-0 flex-1">
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste job listing URL (LinkedIn, Indeed, company careers...)"
            disabled={isLoading}
            aria-invalid={
              validationState === "invalid" || validationState === "unsupported"
                ? true
                : undefined
            }
            aria-describedby={
              error
                ? "url-input-error"
                : validationState === "unsupported"
                  ? "url-input-hint"
                  : undefined
            }
            className={cn(
              "h-12 pr-11 text-base md:h-14 md:text-base",
              validationState === "valid" &&
                "border-emerald-500/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30",
              (validationState === "invalid" ||
                validationState === "unsupported") &&
                "border-destructive/60",
            )}
          />

          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
            aria-hidden
          >
            {validationState === "valid" ? (
              <Check className="size-5 text-emerald-500" />
            ) : null}
            {validationState === "invalid" ||
            validationState === "unsupported" ? (
              <X className="size-5 text-destructive" />
            ) : null}
          </span>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="h-12 shrink-0 px-5 text-base md:h-14 md:px-6"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles data-icon="inline-start" />
              Analyze Job
            </>
          )}
        </Button>
      </form>

      {validationState === "unsupported" ? (
        <p id="url-input-hint" className="text-sm text-amber-600 dark:text-amber-400">
          URL is valid but not from a supported job site. Try LinkedIn, Indeed,
          Greenhouse, Lever, or Workday.
        </p>
      ) : null}

      {error ? (
        <p
          id="url-input-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Supported:</span>
        {SUPPORTED_SITES.map((site) => (
          <Badge key={site} variant="secondary" className="font-normal">
            {site}
          </Badge>
        ))}
      </div>
    </div>
  );
}
