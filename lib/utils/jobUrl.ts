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
      if (jk && /^[a-f0-9]{16}$/i.test(jk)) {
        const indeedHost = host.endsWith("indeed.com") ? host : "www.indeed.com";
        return `https://${indeedHost}/viewjob?jk=${jk}`;
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

/**
 * Heuristics for Indeed challenge pages where no job description is returned.
 */
export function isLikelyIndeedBlockedContent(text: string): boolean {
  const sample = text.slice(0, 2000).toLowerCase();
  return (
    sample.includes("security check") ||
    sample.includes("blocked - indeed") ||
    (sample.includes("sign in") && sample.includes("indeed") && text.length < 500)
  );
}

/**
 * User-facing hint when an Indeed URL cannot be scraped server-side.
 */
export function indeedAnalysisHint(): string {
  return (
    "Indeed often shows a bot check to automated requests, so JobLens cannot read the listing from that link alone. " +
    "Try the same role on the company careers page, Greenhouse, or Lever, or paste a board URL that serves the full description in HTML."
  );
}
