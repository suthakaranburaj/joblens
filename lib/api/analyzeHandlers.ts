import { NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeJobListing,
  compareTwoJobs,
  generateMatchScore,
  GroqServiceError,
  jobAnalysisSchema,
} from "@/lib/services/groqService";
import { fetchPageContent } from "@/lib/utils/scraper";
import {
  isLikelyLinkedInBlockedContent,
  linkedInAnalysisHint,
  normalizeJobUrl,
} from "@/lib/utils/jobUrl";
import {
  validateJobUrl,
  validateResumeText,
  validateUrl,
} from "@/lib/utils/validators";
import type {
  AnalyzeApiResponse,
  CompareResult,
  JobAnalysis,
  MatchResult,
} from "@/types";

export const MIN_CONTENT_LENGTH = 100;

function assertValidJobUrl(url: string, field: string): void {
  if (!validateUrl(url)) {
    throw new GroqServiceError("EMPTY_CONTENT", `${field}: Invalid HTTP/HTTPS URL`);
  }
  if (!validateJobUrl(url)) {
    throw new GroqServiceError(
      "EMPTY_CONTENT",
      `${field}: URL must be from a known job site (LinkedIn, Indeed, Greenhouse, Lever, etc.)`,
    );
  }
}

/**
 * Scrapes and analyzes a single job URL.
 */
export async function analyzeJobFromUrl(
  rawUrl: string,
  resumeText?: string,
): Promise<{ analysis: JobAnalysis; match?: MatchResult }> {
  const url = normalizeJobUrl(rawUrl.trim());
  assertValidJobUrl(url, "url");

  const pageContent = await fetchPageContent(url);

  if (url.includes("linkedin.com") && isLikelyLinkedInBlockedContent(pageContent)) {
    throw new GroqServiceError(
      "EMPTY_CONTENT",
      `Could not read the LinkedIn job description. ${linkedInAnalysisHint()}`,
    );
  }

  if (pageContent.trim().length < MIN_CONTENT_LENGTH) {
    throw new GroqServiceError(
      "EMPTY_CONTENT",
      url.includes("linkedin.com")
        ? `Could not extract job content. ${linkedInAnalysisHint()}`
        : "Could not extract job content",
    );
  }

  const analysis = await analyzeJobListing(pageContent, resumeText);
  let match: MatchResult | undefined;
  if (resumeText?.trim()) {
    match = await generateMatchScore(analysis, resumeText);
  }
  return match ? { analysis, match } : { analysis };
}

export function createAnalyzeJsonResponse(
  body: AnalyzeApiResponse,
  status: number,
): NextResponse<AnalyzeApiResponse> {
  return NextResponse.json(body, { status });
}

export const singleRequestSchema = z
  .object({
    mode: z.literal("single").optional(),
    url: z.string().trim().min(1, { message: "URL is required" }),
    resume_text: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const normalized = normalizeJobUrl(data.url);
    if (!validateUrl(normalized)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Invalid HTTP/HTTPS URL",
      });
    } else if (!validateJobUrl(normalized)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "URL must be from a known job site (LinkedIn, Indeed, Greenhouse, Lever, etc.)",
      });
    }
    if (data.resume_text?.trim()) {
      const resumeCheck = validateResumeText(data.resume_text);
      if (!resumeCheck.valid) {
        ctx.addIssue({
          code: "custom",
          path: ["resume_text"],
          message: resumeCheck.error ?? "Invalid resume text",
        });
      }
    }
  });

export const compareRequestSchema = z
  .object({
    mode: z.literal("compare"),
    jobA_url: z.string().trim().min(1),
    jobB_url: z.string().trim().min(1),
    resume_text: z.string().optional(),
    jobA_analysis: jobAnalysisSchema.optional(),
    jobB_analysis: jobAnalysisSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const jobA = normalizeJobUrl(data.jobA_url);
    const jobB = normalizeJobUrl(data.jobB_url);
    if (!validateUrl(jobA)) {
      ctx.addIssue({
        code: "custom",
        path: ["jobA_url"],
        message: "Invalid HTTP/HTTPS URL",
      });
    } else if (!validateJobUrl(jobA)) {
      ctx.addIssue({
        code: "custom",
        path: ["jobA_url"],
        message: "URL must be from a known job site",
      });
    }
    if (!validateUrl(jobB)) {
      ctx.addIssue({
        code: "custom",
        path: ["jobB_url"],
        message: "Invalid HTTP/HTTPS URL",
      });
    } else if (!validateJobUrl(jobB)) {
      ctx.addIssue({
        code: "custom",
        path: ["jobB_url"],
        message: "URL must be from a known job site",
      });
    }
    if (data.resume_text?.trim()) {
      const resumeCheck = validateResumeText(data.resume_text);
      if (!resumeCheck.valid) {
        ctx.addIssue({
          code: "custom",
          path: ["resume_text"],
          message: resumeCheck.error ?? "Invalid resume text",
        });
      }
    }
  });

/**
 * Runs full compare pipeline (optional cached analyses).
 */
export async function runComparePipeline(options: {
  jobA_url: string;
  jobB_url: string;
  resume_text?: string;
  jobA_analysis?: JobAnalysis;
  jobB_analysis?: JobAnalysis;
}): Promise<CompareResult> {
  const resume = options.resume_text?.trim() || undefined;

  const [jobAResult, jobBResult] = await Promise.all([
    options.jobA_analysis
      ? Promise.resolve({ analysis: options.jobA_analysis })
      : analyzeJobFromUrl(options.jobA_url, resume),
    options.jobB_analysis
      ? Promise.resolve({ analysis: options.jobB_analysis })
      : analyzeJobFromUrl(options.jobB_url, resume),
  ]);

  const comparison = await compareTwoJobs(
    jobAResult.analysis,
    jobBResult.analysis,
    resume,
  );

  return {
    jobA: jobAResult.analysis,
    jobB: jobBResult.analysis,
    comparison,
  };
}
