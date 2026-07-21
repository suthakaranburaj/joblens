"use client";

import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import type { JobLensErrorType } from "@/components/features/ErrorState";
import {
  jobAnalysisSchema,
  jobComparisonSchema,
  matchResultSchema,
} from "@/lib/services/groqService";
import { normalizeJobUrl } from "@/lib/utils/jobUrl";
import { logError } from "@/lib/utils/logger";
import {
  validateJobUrl,
  validateResumeText,
  validateUrl,
} from "@/lib/utils/validators";
import type {
  AnalysisApiResponse,
  AnalysisMode,
  JobAnalysis,
  JobComparison,
  JobSlotState,
  MatchResult,
} from "@/types";

export type AnalysisError = {
  type: JobLensErrorType | string;
  message: string;
};

const emptyJobSlot = (): JobSlotState => ({
  url: "",
  analysis: null,
  loading: false,
  error: null,
});

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

const compareResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      jobA: jobAnalysisSchema,
      jobB: jobAnalysisSchema,
      comparison: jobComparisonSchema,
    })
    .optional(),
  error: z.string().optional(),
});

function mapApiError(status: number, message: string): AnalysisError {
  const lowered = message.toLowerCase();

  if (status === 429 || lowered.includes("rate limit")) {
    return { type: "rate_limited", message };
  }
  if (
    lowered.includes("could not extract job content") ||
    lowered.includes("no job listing content") ||
    lowered.includes("linkedin")
  ) {
    return { type: "fetch_failed", message };
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
  if (lowered.includes("could not structure") || lowered.includes("comparison")) {
    return { type: "analysis_failed", message };
  }
  if (status === 400) {
    return { type: "fetch_failed", message };
  }
  if (status >= 500) {
    return { type: "analysis_failed", message };
  }
  return { type: "analysis_failed", message };
}

async function postSingleAnalyze(
  url: string,
  resumeText?: string,
): Promise<{ status: number; body: AnalysisApiResponse }> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "single",
      url,
      ...(resumeText ? { resume_text: resumeText } : {}),
    }),
  });

  const json: unknown = await response.json();
  const parsed = analysisResponseSchema.safeParse(json);
  if (!parsed.success) {
    return {
      status: response.status,
      body: { success: false, error: "Unexpected server response." },
    };
  }
  if (!response.ok || !parsed.data.success) {
    return {
      status: response.status,
      body: {
        success: false,
        error:
          parsed.data.error ??
          `Request failed${response.status ? ` (${response.status})` : ""}.`,
      },
    };
  }
  return { status: response.status, body: parsed.data };
}

/**
 * Manages single and compare analysis flows.
 */
export function useAnalysis() {
  const [mode, setModeState] = useState<AnalysisMode>("single");

  const [url, setUrl] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeExpanded, setResumeExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [urlFieldError, setUrlFieldError] = useState<string | null>(null);

  const [jobA, setJobA] = useState<JobSlotState>(emptyJobSlot);
  const [jobB, setJobB] = useState<JobSlotState>(emptyJobSlot);
  const [compareResult, setCompareResult] = useState<JobComparison | null>(
    null,
  );
  const [compareError, setCompareError] = useState<AnalysisError | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const lastSubmittedUrl = useRef("");
  const submitInFlight = useRef(false);

  const resetComparison = useCallback(() => {
    setJobA(emptyJobSlot());
    setJobB(emptyJobSlot());
    setCompareResult(null);
    setCompareError(null);
    setIsComparing(false);
  }, []);

  const setMode = useCallback(
    (next: AnalysisMode) => {
      if (next === mode) return;

      if (next === "single") {
        resetComparison();
        if (jobA.url.trim()) {
          setUrl(jobA.url);
        }
        setError(null);
        setIsLoading(false);
        setAnalysis(null);
        setMatchResult(null);
      } else {
        setError(null);
        setUrlFieldError(null);
        setAnalysis(null);
        setMatchResult(null);
        setIsLoading(false);
        if (url.trim()) {
          setJobA((prev) => ({ ...prev, url }));
        }
      }

      setModeState(next);
    },
    [mode, jobA.url, url, resetComparison],
  );

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
        const { status, body } = await postSingleAnalyze(
          trimmedUrl,
          trimmedResume || undefined,
        );
        if (!body.success || !body.data?.analysis) {
          setError(mapApiError(status, body.error ?? "Analysis failed."));
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

  const analyzeJobSlot = useCallback(
    async (slot: "A" | "B", targetUrl: string) => {
      const trimmedUrl = normalizeJobUrl(targetUrl.trim());
      const setter = slot === "A" ? setJobA : setJobB;

      if (!validateJobUrl(trimmedUrl)) {
        const message = validateUrl(trimmedUrl)
          ? "URL must be from a supported job site."
          : "Please enter a valid job listing URL.";
        setter({
          url: targetUrl,
          analysis: null,
          loading: false,
          error: { type: "invalid_url", message },
        });
        return;
      }

      setter({
        url: trimmedUrl,
        analysis: null,
        loading: true,
        error: null,
      });
      setCompareResult(null);

      try {
        const { status, body } = await postSingleAnalyze(trimmedUrl);
        if (!body.success || !body.data?.analysis) {
          setter({
            url: trimmedUrl,
            analysis: null,
            loading: false,
            error: mapApiError(status, body.error ?? "Analysis failed."),
          });
          return;
        }
        setter({
          url: trimmedUrl,
          analysis: body.data.analysis,
          loading: false,
          error: null,
        });
      } catch (err) {
        setter({
          url: trimmedUrl,
          analysis: null,
          loading: false,
          error: {
            type: "fetch_failed",
            message:
              err instanceof Error ? err.message : "Network error.",
          },
        });
      }
    },
    [],
  );

  const analyzeJobA = useCallback(
    async (targetUrl?: string) => {
      await analyzeJobSlot("A", targetUrl ?? jobA.url);
    },
    [analyzeJobSlot, jobA.url],
  );

  const analyzeJobB = useCallback(
    async (targetUrl?: string) => {
      await analyzeJobSlot("B", targetUrl ?? jobB.url);
    },
    [analyzeJobSlot, jobB.url],
  );

  const compareJobs = useCallback(async () => {
    if (!jobA.analysis || !jobB.analysis || isComparing) return;

    const trimmedResume = resumeText.trim();
    if (trimmedResume.length > 0) {
      const resumeCheck = validateResumeText(trimmedResume);
      if (!resumeCheck.valid) {
        setResumeExpanded(true);
        return;
      }
    }

    setIsComparing(true);
    setCompareResult(null);
    setCompareError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "compare",
          jobA_url: jobA.url,
          jobB_url: jobB.url,
          jobA_analysis: jobA.analysis,
          jobB_analysis: jobB.analysis,
          ...(trimmedResume ? { resume_text: trimmedResume } : {}),
        }),
      });

      const json: unknown = await response.json();
      const parsed = compareResponseSchema.safeParse(json);
      if (!parsed.success || !response.ok || !parsed.data.success) {
        const message =
          parsed.success && parsed.data.error
            ? parsed.data.error
            : "Comparison failed. Please try again.";
        setCompareError(mapApiError(response.status, message));
        return;
      }

      const data = parsed.data.data;
      if (!data) return;

      setJobA((prev) => ({ ...prev, analysis: data.jobA }));
      setJobB((prev) => ({ ...prev, analysis: data.jobB }));
      setCompareResult(data.comparison);
    } catch (err) {
      logError("Compare request failed", {
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsComparing(false);
    }
  }, [
    jobA.analysis,
    jobA.url,
    jobB.analysis,
    jobB.url,
    isComparing,
    resumeText,
  ]);

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
    resetComparison();
    lastSubmittedUrl.current = "";
    submitInFlight.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [resetComparison]);

  const setExampleUrl = useCallback((exampleUrl: string) => {
    setUrl(exampleUrl);
    setError(null);
    setUrlFieldError(null);
  }, []);

  const setJobAUrl = useCallback((value: string) => {
    setJobA((prev) => ({ ...prev, url: value, error: null }));
    setCompareResult(null);
  }, []);

  const setJobBUrl = useCallback((value: string) => {
    setJobB((prev) => ({ ...prev, url: value, error: null }));
    setCompareResult(null);
  }, []);

  return {
    mode,
    setMode,
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
    jobA,
    jobB,
    setJobAUrl,
    setJobBUrl,
    compareResult,
    compareError,
    isComparing,
    handleSubmit,
    handleRetry,
    reset,
    setExampleUrl,
    analyzeJobA,
    analyzeJobB,
    compareJobs,
    resetComparison,
  };
}
