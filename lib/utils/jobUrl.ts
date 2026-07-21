/**
 * Normalizes job board URLs to direct posting links when possible.
 *
 * @param url - Raw URL from the user (may be search results, tracking links, etc.)
 * @returns Canonical job posting URL for scraping
 */
export function normalizeJobUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("linkedin.com")) {
      const currentJobId = parsed.searchParams.get("currentJobId");
      if (currentJobId && /^\d+$/.test(currentJobId)) {
        return `https://www.linkedin.com/jobs/view/${currentJobId}`;
      }

      const viewMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/);
      if (viewMatch?.[1]) {
        return `https://www.linkedin.com/jobs/view/${viewMatch[1]}`;
      }
    }

    if (host.includes("indeed.com")) {
      const jk = parsed.searchParams.get("jk");
      if (jk) {
        return `https://www.indeed.com/viewjob?jk=${jk}`;
      }
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * Heuristics for LinkedIn pages that are login walls or search shells (not job descriptions).
 *
 * @param text - Extracted page text
 */
export function isLikelyLinkedInBlockedContent(text: string): boolean {
  const sample = text.slice(0, 4000).toLowerCase();
  const signInHints =
    sample.includes("sign in") ||
    sample.includes("sign up") ||
    sample.includes("join linkedin") ||
    sample.includes("agree & join linkedin");

  const jobHints =
    sample.includes("job description") ||
    sample.includes("about the job") ||
    sample.includes("qualifications") ||
    sample.includes("responsibilities") ||
    sample.includes("apply");

  if (signInHints && !jobHints) {
    return true;
  }

  if (
    sample.includes("search results") &&
    sample.includes("linkedin") &&
    !jobHints
  ) {
    return true;
  }

  return false;
}

/**
 * User-facing hint when a LinkedIn URL cannot be analyzed reliably.
 */
export function linkedInAnalysisHint(): string {
  return (
    "LinkedIn often blocks automated reads. Use the direct job link " +
    "(Share → Copy link) in the form https://www.linkedin.com/jobs/view/1234567890, " +
    "or try the same role on Greenhouse/Lever if available."
  );
}
