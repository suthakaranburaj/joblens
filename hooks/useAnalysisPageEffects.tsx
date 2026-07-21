"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type FadePresenceProps = {
  /** Unique key per visible state (drives enter/exit animation). */
  presenceKey: string;
  children: ReactNode;
  className?: string;
};

/**
 * Lightweight AnimatePresence-style wrapper (fade + slide) using Tailwind animate-in.
 */
export function FadePresence({
  presenceKey,
  children,
  className,
}: FadePresenceProps) {
  return (
    <div
      key={presenceKey}
      className={cn(
        "animate-in fade-in slide-in-from-bottom-3 fill-mode-both duration-300",
        className,
      )}
    >
      {children}
    </div>
  );
}

type UseAnalysisPageEffectsOptions = {
  isLoading: boolean;
  analysis: unknown;
  onSubmitShortcut: () => void;
  urlInputRef: React.RefObject<HTMLInputElement | null>;
};

/**
 * Page-level UX: autofocus, keyboard shortcut, scroll-to-results.
 */
export function useAnalysisPageEffects({
  isLoading,
  analysis,
  onSubmitShortcut,
  urlInputRef,
}: UseAnalysisPageEffectsOptions) {
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevAnalysis = useRef<unknown>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, [urlInputRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
      event.preventDefault();
      if (!isLoading) onSubmitShortcut();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLoading, onSubmitShortcut]);

  useEffect(() => {
    if (analysis && analysis !== prevAnalysis.current) {
      prevAnalysis.current = analysis;
      requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [analysis]);

  return { resultsRef };
}
