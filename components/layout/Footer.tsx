import Link from "next/link";
import { ExternalLink } from "lucide-react";

const GITHUB_REPO_URL = "https://github.com/your-username/joblens";

/**
 * Site footer with copyright, stack badge, and GitHub link.
 */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-8">
        <div className="flex flex-col gap-2 sm:gap-1">
          <p className="text-sm text-muted-foreground">
            © {year} JobLens. All rights reserved.
          </p>
          <span className="inline-flex w-fit items-center rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Built with Next.js + Groq
          </span>
        </div>

        <Link
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:self-auto"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          <span>GitHub</span>
        </Link>
      </div>
    </footer>
  );
}
