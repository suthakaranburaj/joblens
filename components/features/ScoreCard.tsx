"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type ScoreCardProps = {
  /** Overall job quality score on a 0–100 scale (displayed out of 10). */
  score: number;
  className?: string;
};

/**
 * Maps a 0–10 display score to ring/text color classes.
 */
function getScoreColorClasses(displayScore: number): {
  ring: string;
  text: string;
  bg: string;
} {
  if (displayScore >= 8) {
    return {
      ring: "stroke-emerald-500/80",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "from-emerald-500/10 to-emerald-500/5",
    };
  }
  if (displayScore >= 5) {
    return {
      ring: "stroke-amber-500/80",
      text: "text-amber-600 dark:text-amber-400",
      bg: "from-amber-500/10 to-amber-500/5",
    };
  }
  return {
    ring: "stroke-red-500/80",
    text: "text-red-600 dark:text-red-400",
    bg: "from-red-500/10 to-red-500/5",
  };
}

/**
 * Easing function for count-up animation.
 */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Large circular job quality score (0–10) with animated count-up.
 */
export function ScoreCard({ score, className }: ScoreCardProps) {
  const target = Math.min(10, Math.max(0, score / 10));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      setDisplay(target * easeOutCubic(progress));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const colors = getScoreColorClasses(target);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (display / 10) * circumference;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border bg-gradient-to-b p-5 shadow-sm",
        colors.bg,
        className,
      )}
    >
      <div className="relative flex size-32 items-center justify-center sm:size-36">
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
            strokeDashoffset={circumference - progress}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl",
              colors.text,
            )}
          >
            {display.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/ 10</span>
        </div>
      </div>
      <p className="mt-3 text-center text-sm font-medium text-foreground">
        Job Quality Score
      </p>
    </div>
  );
}
