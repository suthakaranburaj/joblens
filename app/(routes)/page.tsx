"use client";

import { useCallback, useRef } from "react";
import { AnalysisResult } from "@/components/features/AnalysisResult";
import { EmptyState } from "@/components/features/EmptyState";
import { ErrorState } from "@/components/features/ErrorState";
import { LoadingSkeleton } from "@/components/features/LoadingSkeleton";
import { ResumeInput } from "@/components/features/ResumeInput";
import { UrlInput } from "@/components/features/UrlInput";
import {
  FadePresence,
  useAnalysisPageEffects,
} from "@/hooks/useAnalysisPageEffects";
import { useAnalysis } from "@/hooks/useAnalysis";
import { validateJobUrl } from "@/lib/utils/validators";

function getViewKey(options: {
  isLoading: boolean;
  error: unknown;
  analysis: unknown;
}): string {
  if (options.isLoading) return "loading";
  if (options.error) return "error";
  if (options.analysis) return "results";
  return "empty";
}

export default function HomePage() {
  const {
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
  } = useAnalysis();

  const urlInputRef = useRef<HTMLInputElement>(null);

  const submitFromShortcut = useCallback(() => {
    if (!validateJobUrl(url.trim()) || isLoading) return;
    handleSubmit(url);
  }, [url, isLoading, handleSubmit]);

  const { resultsRef } = useAnalysisPageEffects({
    isLoading,
    analysis,
    onSubmitShortcut: submitFromShortcut,
    urlInputRef,
  });

  const viewKey = getViewKey({ isLoading, error, analysis });

  return (
    <div className="flex w-full flex-1 flex-col gap-8 sm:gap-10">
      <section className="space-y-3 text-center sm:text-left">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          AI job intelligence
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          JobLens
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Paste a job posting URL to uncover requirements, culture signals, and
          red flags — then optionally match your resume in seconds.
        </p>
        <p className="text-xs text-muted-foreground">
          Tip: press{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
            Ctrl
          </kbd>{" "}
          +{" "}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
            Enter
          </kbd>{" "}
          to analyze
        </p>
      </section>

      <section className="space-y-4">
        <UrlInput
          value={url}
          onChange={setUrl}
          onSubmit={handleSubmit}
          inputRef={urlInputRef}
          isLoading={isLoading}
          error={urlFieldError}
        />
        <ResumeInput
          value={resumeText}
          onChange={setResumeText}
          isExpanded={resumeExpanded}
          onExpandedChange={setResumeExpanded}
        />
      </section>

      <section ref={resultsRef} className="min-h-[12rem] scroll-mt-24">
        <FadePresence presenceKey={viewKey}>
          {isLoading ? <LoadingSkeleton /> : null}
          {!isLoading && error ? (
            <ErrorState
              errorType={error.type}
              message={error.message}
              onRetry={handleRetry}
            />
          ) : null}
          {!isLoading && !error && analysis ? (
            <AnalysisResult
              analysis={analysis}
              matchResult={matchResult ?? undefined}
              onAnalyzeAnother={reset}
            />
          ) : null}
          {!isLoading && !error && !analysis ? (
            <EmptyState onExampleClick={setExampleUrl} />
          ) : null}
        </FadePresence>
      </section>
    </div>
  );
}
