/**
 * Result of validating resume text input.
 */
export interface ResumeValidationResult {
  valid: boolean;
  error?: string;
}

const MIN_RESUME_LENGTH = 50;
const MAX_RESUME_LENGTH = 5000;

/** Hostnames (and suffixes) treated as known job boards / ATS platforms. */
const KNOWN_JOB_HOSTS: readonly string[] = [
  "linkedin.com",
  "glassdoor.com",
  "greenhouse.io",
  "boards.greenhouse.io",
  "lever.co",
  "jobs.lever.co",
  "jobs.eu.lever.co",
  "wellfound.com",
  "angel.co",
  "monster.com",
  "ziprecruiter.com",
  "dice.com",
  "simplyhired.com",
  "workday.com",
  "myworkdayjobs.com",
  "smartrecruiters.com",
  "jobvite.com",
  "icims.com",
  "bamboohr.com",
  "ashbyhq.com",
  "jobs.ashbyhq.com",
  "recruitee.com",
  "teamtailor.com",
  "workable.com",
  "applytojob.com",
  "remoteok.com",
  "weworkremotely.com",
  "flexjobs.com",
  "careerbuilder.com",
  "stripe.com",
] as const;

/**
 * Checks whether a string is a valid HTTP or HTTPS URL.
 *
 * @param url - Candidate URL string
 * @returns `true` if the URL parses and uses http/https; otherwise `false`
 */
export function validateUrl(url: string): boolean {
  if (typeof url !== "string" || url.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns `true` when `hostname` matches or is a subdomain of `host`.
 *
 * @param hostname - Hostname from a parsed URL
 * @param host - Allowed host or domain suffix
 */
function hostnameMatches(hostname: string, host: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const allowed = host.toLowerCase();
  return normalizedHost === allowed || normalizedHost.endsWith(`.${allowed}`);
}

/**
 * Checks whether a URL points at a known job board or ATS domain
 * (LinkedIn, Greenhouse, Lever, etc.).
 *
 * @param url - Candidate job posting URL
 * @returns `true` if the URL is valid HTTP(S) and from a known job site
 */
export function validateJobUrl(url: string): boolean {
  if (!validateUrl(url)) {
    return false;
  }

  try {
    const { hostname } = new URL(url.trim());
    return KNOWN_JOB_HOSTS.some((host) => hostnameMatches(hostname, host));
  } catch {
    return false;
  }
}

/**
 * Validates resume text length for analysis requests.
 * Requires between 50 and 5000 characters (inclusive) after trimming.
 *
 * @param text - Raw resume text
 * @returns Object with `valid` flag and optional `error` message
 */
export function validateResumeText(text: string): ResumeValidationResult {
  if (typeof text !== "string") {
    return { valid: false, error: "Resume text must be a string." };
  }

  const trimmed = text.trim();

  if (trimmed.length < MIN_RESUME_LENGTH) {
    return {
      valid: false,
      error: `Resume text must be at least ${MIN_RESUME_LENGTH} characters.`,
    };
  }

  if (trimmed.length > MAX_RESUME_LENGTH) {
    return {
      valid: false,
      error: `Resume text must be at most ${MAX_RESUME_LENGTH} characters.`,
    };
  }

  return { valid: true };
}
