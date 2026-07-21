"use client";

import { useCallback, useRef } from "react";
import { AnalysisResult } from "@/components/features/AnalysisResult";
import { ComparisonInput } from "@/components/features/ComparisonInput";
import { ComparisonLoadingSkeleton } from "@/components/features/ComparisonLoadingSkeleton";
import { ComparisonResult } from "@/components/features/ComparisonResult";
import { EmptyState } from "@/components/features/EmptyState";
import { ErrorState } from "@/components/features/ErrorState";
import { LoadingSkeleton } from "@/components/features/LoadingSkeleton";
import { ModeToggle } from "@/components/features/ModeToggle";
import { ResumeInput } from "@/components/features/ResumeInput";
import { UrlInput } from "@/components/features/UrlInput";
import {
  FadePresence,
  useAnalysisPageEffects,
} from "@/hooks/useAnalysisPageEffects";
import { useAnalysis } from "@/hooks/useAnalysis";
import { validateJobUrl } from "@/lib/utils/validators";

function getSingleViewKey(options: {
  isLoading: boolean;
  error: unknown;
  analysis: unknown;
}): string {
  if (options.isLoading) return "loading";
  if (options.error) return "error";
  if (options.analysis) return "results";
  return "empty";
}

function getCompareViewKey(options: {
  isComparing: boolean;
  compareResult: unknown;
  compareError: unknown;
  jobALoading: boolean;
  jobBLoading: boolean;
}): string {
  if (options.isComparing) return "comparing";
  if (options.compareResult) return "compare-results";
  if (options.compareError) return "compare-error";
  if (options.jobALoading || options.jobBLoading) return "job-loading";
  return "compare-idle";
}

export default function HomePage() {
  const {
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
  } = useAnalysis();

  const urlInputRef = useRef<HTMLInputElement>(null);

  const submitFromShortcut = useCallback(() => {
    if (mode !== "single") return;
    if (!validateJobUrl(url.trim()) || isLoading) return;
    handleSubmit(url);
  }, [mode, url, isLoading, handleSubmit]);

  const { resultsRef } = useAnalysisPageEffects({
    isLoading: mode === "single" ? isLoading : isComparing,
    analysis: mode === "single" ? analysis : compareResult,
    onSubmitShortcut: submitFromShortcut,
    urlInputRef,
  });

  const singleViewKey = getSingleViewKey({ isLoading, error, analysis });
  const compareViewKey = getCompareViewKey({
    isComparing,
    compareResult,
    compareError,
    jobALoading: jobA.loading,
    jobBLoading: jobB.loading,
  });

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
          Analyze a single posting or compare two offers side-by-side — with
          optional resume matching.
        </p>
      </section>

      <ModeToggle mode={mode} onModeChange={setMode} className="mx-auto sm:mx-0" />

      {mode === "single" ? (
        <>
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
            <FadePresence presenceKey={singleViewKey}>
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
        </>
      ) : (
        <>
          <section className="space-y-4">
            <ComparisonInput
              jobA={jobA}
              jobB={jobB}
              onJobAUrlChange={setJobAUrl}
              onJobBUrlChange={setJobBUrl}
              onAnalyzeA={() => void analyzeJobA()}
              onAnalyzeB={() => void analyzeJobB()}
              onCompare={() => void compareJobs()}
              isComparing={isComparing}
            />
            <ResumeInput
              value={resumeText}
              onChange={setResumeText}
              isExpanded={resumeExpanded}
              onExpandedChange={setResumeExpanded}
            />
          </section>

          <section ref={resultsRef} className="min-h-[12rem] scroll-mt-24">
            <FadePresence presenceKey={compareViewKey}>
              {isComparing ? <ComparisonLoadingSkeleton /> : null}
              {!isComparing && compareError ? (
                <ErrorState
                  errorType={compareError.type}
                  message={compareError.message}
                  onRetry={() => void compareJobs()}
                />
              ) : null}
              {!isComparing &&
              !compareError &&
              compareResult &&
              jobA.analysis &&
              jobB.analysis ? (
                <ComparisonResult
                  jobA={jobA.analysis}
                  jobB={jobB.analysis}
                  comparison={compareResult}
                />
              ) : null}
              {!isComparing &&
              !compareError &&
              !compareResult &&
              (jobA.loading || jobB.loading) ? (
                <ComparisonLoadingSkeleton />
              ) : null}
            </FadePresence>
          </section>
        </>
      )}
    </div>
  );
}
