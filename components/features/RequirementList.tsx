import { Check, Star } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type RequirementListProps = {
  requirements: string[];
  niceToHave: string[];
  className?: string;
};

function EmptySection({ message }: { message: string }) {
  return (
    <p className="text-sm text-muted-foreground italic">{message}</p>
  );
}

/**
 * Displays key requirements and nice-to-have skills in a responsive grid.
 */
export function RequirementList({
  requirements,
  niceToHave,
  className,
}: RequirementListProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 sm:gap-5",
        className,
      )}
    >
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Key Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <EmptySection message="No key requirements listed." />
          ) : (
            <ul className="space-y-2.5">
              {requirements.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2.5 text-sm">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nice-to-Have</CardTitle>
        </CardHeader>
        <CardContent>
          {niceToHave.length === 0 ? (
            <EmptySection message="No nice-to-have skills listed." />
          ) : (
            <ul className="space-y-2.5">
              {niceToHave.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2.5 text-sm">
                  <Star
                    className="mt-0.5 size-4 shrink-0 text-amber-500 dark:text-amber-400"
                    aria-hidden
                  />
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
