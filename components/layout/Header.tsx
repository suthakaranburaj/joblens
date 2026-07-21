import Link from "next/link";
import { Briefcase } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

/**
 * Fixed top application header with brand mark and theme toggle.
 */
export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-md text-foreground outline-none transition-colors hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="JobLens home"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors group-hover:bg-accent sm:h-9 sm:w-9">
            <Briefcase className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            JobLens
          </span>
        </Link>

        <ThemeToggle />
      </div>
    </header>
  );
}
