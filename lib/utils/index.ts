/**
 * Shared utility barrel exports for JobLens.
 * Keeps `@/lib/utils` compatible with shadcn and app imports.
 */
export { cn } from "@/lib/utils/cn";
export {
  validateUrl,
  validateJobUrl,
  validateResumeText,
  type ResumeValidationResult,
} from "@/lib/utils/validators";
export { logDebug, logInfo, logWarn, logError } from "@/lib/utils/logger";
export { fetchPageContent, fetchJobListingContent } from "@/lib/utils/scraper";
export {
  normalizeJobUrl,
  isLikelyLinkedInBlockedContent,
  linkedInAnalysisHint,
  isLikelyIndeedBlockedContent,
  indeedAnalysisHint,
} from "@/lib/utils/jobUrl";
