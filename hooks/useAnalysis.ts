"use client";

import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import type { JobLensErrorType } from "@/components/features/ErrorState";
import { jobAnalysisSchema, matchResultSchema } from "@/lib/services/groqService";
import {
  validateJobUrl,
  validateResumeText,
  validateUrl,
} from "@/lib/utils/validators";
import { normalizeJobUrl } from "@/lib/utils/jobUrl";
import { logError } from "@/lib/utils/logger";
import type {
  AnalysisApiResponse,
  JobAnalysis,
  MatchResult,
} from "@/types";

export type AnalysisError = {
  type: JobLensErrorType | string;
  message: string;
};

const analysisResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      analysis: jobAnalysisSchema,
      match: matchResultSchema.optional(),
    })
    .optional(),
  error: z.string().optional(),
});

/**
 * Maps HTTP status and API error text to a UI error type.
 */
function mapApiError(status: number, message: string): AnalysisError {
  const lowered = message.toLowerCase();

  if (status === 429 || lowered.includes("rate limit")) {
    return { type: "rate_limited", message };
  }

  if (
    lowered.includes("could not extract job content") ||
    lowered.includes("no job listing content")
  ) {
    return {
      type: "fetch_failed",
      message,
    };
  }

  if (
    lowered.includes("job site") ||
    lowered.includes("invalid http") ||
    lowered.includes("url:")
  ) {
    return { type: "invalid_url", message };
  }

  if (lowered.includes("content policy")) {
    return { type: "not_job_listing", message };
  }

  if (
    lowered.includes("could not structure") ||
    lowered.includes("linkedin") ||
    lowered.includes("job description")
  ) {
    return { type: "not_job_listing", message };
  }

  if (status === 400) {
    if (lowered.includes("job content") || lowered.includes("linkedin")) {
      return { type: "fetch_failed", message };
    }
    return { type: "invalid_url", message };
  }

  if (status >= 500) {
    return { type: "analysis_failed", message };
  }

  return { type: "analysis_failed", message };
}

/**
 * Manages job analysis form state, API calls, and recovery actions.
 */
export function useAnalysis() {
  const [url, setUrl] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeExpanded, setResumeExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [urlFieldError, setUrlFieldError] = useState<string | null>(null);

  const lastSubmittedUrl = useRef<string>("");
  const submitInFlight = useRef(false);

  const runAnalysis = useCallback(
    async (targetUrl: string, targetResume: string) => {
      if (submitInFlight.current) return;

      const trimmedUrl = normalizeJobUrl(targetUrl.trim());
      const trimmedResume = targetResume.trim();

      if (!validateJobUrl(trimmedUrl)) {
        const message = validateUrl(trimmedUrl)
          ? "URL must be from a supported job site (LinkedIn, Indeed, Greenhouse, Lever, etc.)."
          : "Please enter a valid HTTP or HTTPS job listing URL.";
        setError({ type: "invalid_url", message });
        setUrlFieldError(message);
        return;
      }

      if (trimmedResume.length > 0) {
        const resumeCheck = validateResumeText(trimmedResume);
        if (!resumeCheck.valid) {
          setResumeExpanded(true);
          setUrlFieldError(null);
          setError({
            type: "analysis_failed",
            message: resumeCheck.error ?? "Invalid resume text.",
          });
          return;
        }
      }

      submitInFlight.current = true;
      setIsLoading(true);
      setError(null);
      setUrlFieldError(null);
      setAnalysis(null);
      setMatchResult(null);
      lastSubmittedUrl.current = trimmedUrl;

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: trimmedUrl,
            ...(trimmedResume ? { resume_text: trimmedResume } : {}),
          }),
        });

        let json: unknown;
        try {
          json = await response.json();
        } catch {
          throw new Error("Invalid response from server.");
        }

        const parsed = analysisResponseSchema.safeParse(json);
        if (!parsed.success) {
          logError("Analyze API returned unexpected shape", {
            issues: parsed.error.issues,
          });
          setError({
            type: "analysis_failed",
            message: "Received an unexpected response from the server.",
          });
          return;
        }

        const body: AnalysisApiResponse = parsed.data;

        if (!response.ok || !body.success || !body.data?.analysis) {
          const message =
            body.error ??
            `Request failed${response.status ? ` (${response.status})` : ""}.`;
          setError(mapApiError(response.status, message));
          return;
        }

        setAnalysis(body.data.analysis);
        setMatchResult(body.data.match ?? null);
      } catch (err) {
        logError("Analyze request failed", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
        setError({
          type: "fetch_failed",
          message:
            err instanceof Error
              ? err.message
              : "Network error while analyzing the job listing.",
        });
      } finally {
        setIsLoading(false);
        submitInFlight.current = false;
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    (submittedUrl?: string) => {
      const target = normalizeJobUrl((submittedUrl ?? url).trim());
      if (!target || isLoading) return;
      setUrl(target);
      void runAnalysis(target, resumeText);
    },
    [url, resumeText, isLoading, runAnalysis],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setUrlFieldError(null);
    const retryUrl = lastSubmittedUrl.current || url;
    if (!retryUrl.trim()) return;
    void runAnalysis(retryUrl, resumeText);
  }, [url, resumeText, runAnalysis]);

  const reset = useCallback(() => {
    setUrl("");
    setResumeText("");
    setResumeExpanded(false);
    setIsLoading(false);
    setAnalysis(null);
    setMatchResult(null);
    setError(null);
    setUrlFieldError(null);
    lastSubmittedUrl.current = "";
    submitInFlight.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setExampleUrl = useCallback((exampleUrl: string) => {
    setUrl(exampleUrl);
    setError(null);
    setUrlFieldError(null);
  }, []);

  return {
    url,
    setUrl,
    resumeText,
    setResumeText,
    resumeExpanded,
    setResumeExpanded,
    isLoading,
    analysis,
    matchResult,
    error,
    urlFieldError,
    handleSubmit,
    handleRetry,
    reset,
    setExampleUrl,
  };
}
