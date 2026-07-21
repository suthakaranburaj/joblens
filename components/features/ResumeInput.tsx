"use client";

import { Check, FileText, X } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { validateResumeText } from "@/lib/utils/validators";

const MIN_RESUME_LENGTH = 50;
const MAX_RESUME_LENGTH = 5000;
const RESUME_ITEM_VALUE = "resume";

const RESUME_PLACEHOLDER = `Paste your resume text here…

Example:
Jane Doe — Senior Frontend Engineer
Skills: TypeScript, React, Next.js, Node.js, Tailwind CSS
Experience:
- Built design systems and dashboard UIs at Acme Corp (2021–Present)
- Led migration to Next.js App Router; improved LCP by 35%
Education: B.S. Computer Science`;

export type ResumeInputProps = {
  /** Current resume text value. */
  value: string;
  /** Called whenever the textarea value changes. */
  onChange: (value: string) => void;
  /** Controlled expanded state for the accordion section. */
  isExpanded: boolean;
  /**
   * Called when the accordion open state changes.
   * Required for controlled expand/collapse behavior.
   */
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional className for the root container. */
  className?: string;
};

/**
 * Optional collapsible resume paste area with length validation and counter.
 */
export function ResumeInput({
  value,
  onChange,
  isExpanded,
  onExpandedChange,
  className,
}: ResumeInputProps) {
  const length = value.length;
  const trimmedLength = value.trim().length;
  const hasContent = trimmedLength > 0;
  const validation = hasContent
    ? validateResumeText(value)
    : { valid: false as const };
  const isValid = hasContent && validation.valid;
  const isInvalid = hasContent && !validation.valid;
  const isOverLimit = length > MAX_RESUME_LENGTH;

  return (
    <div className={cn("w-full", className)}>
      <Accordion
        value={isExpanded ? [RESUME_ITEM_VALUE] : []}
        onValueChange={(next) => {
          onExpandedChange?.(next.includes(RESUME_ITEM_VALUE));
        }}
        className="rounded-xl border border-border bg-card px-3 sm:px-4"
      >
        <AccordionItem value={RESUME_ITEM_VALUE} className="border-none">
          <AccordionTrigger className="py-3.5 hover:no-underline sm:py-4">
            <span className="flex items-start gap-2.5 pr-3 text-left">
              <FileText
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="text-sm font-medium text-foreground sm:text-[0.9375rem]">
                Add your resume for personalized matching (optional)
              </span>
            </span>
          </AccordionTrigger>

          <AccordionContent className="pb-4">
            <div className="space-y-2.5">
              <div className="relative">
                <Textarea
                  value={value}
                  onChange={(event) => {
                    const next = event.target.value.slice(0, MAX_RESUME_LENGTH);
                    onChange(next);
                  }}
                  placeholder={RESUME_PLACEHOLDER}
                  rows={10}
                  maxLength={MAX_RESUME_LENGTH}
                  aria-invalid={isInvalid || isOverLimit ? true : undefined}
                  aria-describedby="resume-input-meta"
                  className={cn(
                    "min-h-40 resize-y pr-10 text-sm leading-relaxed sm:min-h-48",
                    isValid &&
                      "border-emerald-500/60 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30",
                    isInvalid && "border-destructive/60",
                  )}
                />

                <span
                  className="pointer-events-none absolute top-3 right-3"
                  aria-hidden
                >
                  {isValid ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : null}
                  {isInvalid ? (
                    <X className="size-4 text-destructive" />
                  ) : null}
                </span>
              </div>

              <div
                id="resume-input-meta"
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <p
                  className={cn(
                    "text-xs",
                    isInvalid ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {hasContent
                    ? validation.valid
                      ? "Resume looks ready for matching."
                      : (validation.error ?? "Invalid resume text.")
                    : `Paste at least ${MIN_RESUME_LENGTH} characters for matching.`}
                </p>

                <p
                  className={cn(
                    "text-xs tabular-nums",
                    length < MIN_RESUME_LENGTH && hasContent
                      ? "text-amber-600 dark:text-amber-400"
                      : isOverLimit
                        ? "text-destructive"
                        : "text-muted-foreground",
                  )}
                >
                  {length.toLocaleString()} / {MAX_RESUME_LENGTH.toLocaleString()}
                  {length > 0 && length < MIN_RESUME_LENGTH
                    ? ` (min ${MIN_RESUME_LENGTH})`
                    : ""}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
