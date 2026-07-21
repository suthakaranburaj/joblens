"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RedFlag, RedFlagSeverity } from "@/types";

export type RedFlagListProps = {
  redFlags: RedFlag[];
  className?: string;
};

const VISIBLE_COUNT = 3;
const MORE_FLAGS_ITEM = "more-red-flags";

/**
 * Severity badge styling for red flag items.
 */
function severityBadgeClass(severity: RedFlagSeverity): string {
  switch (severity) {
    case "low":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "medium":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "high":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "";
  }
}

function RedFlagItem({ flag }: { flag: RedFlag }) {
  return (
    <li className="rounded-lg border border-border/80 bg-muted/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">{flag.flag}</h4>
        <Badge
          variant="outline"
          className={cn("capitalize", severityBadgeClass(flag.severity))}
        >
          {flag.severity}
        </Badge>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {flag.explanation}
      </p>
    </li>
  );
}

/**
 * Lists job posting red flags with severity badges; collapses extras when &gt; 3.
 */
export function RedFlagList({ redFlags, className }: RedFlagListProps) {
  const hasFlags = redFlags.length > 0;
  const visible = redFlags.slice(0, VISIBLE_COUNT);
  const hidden = redFlags.slice(VISIBLE_COUNT);
  const showCollapsible = hidden.length > 0;

  return (
    <Card className={cn("border-border shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <AlertTriangle
            className="size-5 text-amber-500 dark:text-amber-400"
            aria-hidden
          />
          Red Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasFlags ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <CheckCircle2
              className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              No major red flags detected!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((flag, index) => (
              <RedFlagItem key={`${flag.flag}-${index}`} flag={flag} />
            ))}
          </ul>
        )}

        {showCollapsible ? (
          <Accordion className="mt-3">
            <AccordionItem value={MORE_FLAGS_ITEM} className="border-none">
              <AccordionTrigger className="py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                Show {hidden.length} more red flag
                {hidden.length === 1 ? "" : "s"}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3 pt-1">
                  {hidden.map((flag, index) => (
                    <RedFlagItem
                      key={`${flag.flag}-hidden-${index}`}
                      flag={flag}
                    />
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </CardContent>
    </Card>
  );
}
