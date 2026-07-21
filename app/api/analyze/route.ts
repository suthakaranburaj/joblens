import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  analyzeJobListing,
  generateMatchScore,
  GroqServiceError,
} from "@/lib/services/groqService";
import { fetchPageContent } from "@/lib/utils/scraper";
import {
  validateJobUrl,
  validateResumeText,
  validateUrl,
} from "@/lib/utils/validators";
import { logError, logInfo } from "@/lib/utils/logger";
import type {
  AnalysisApiResponse,
  AnalysisRequest,
  AnalysisResult,
  MatchResult,
} from "@/types";

export const runtime = "nodejs";

const MIN_CONTENT_LENGTH = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

/** In-memory rate limiter: max 10 requests per IP per minute. */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Zod schema for the analyze request body, including custom URL/resume checks.
 */
const analysisRequestSchema = z
  .object({
    url: z
      .string({ error: "URL is required" })
      .trim()
      .min(1, { message: "URL is required" }),
    resume_text: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!validateUrl(data.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Invalid HTTP/HTTPS URL",
      });
      return;
    }

    if (!validateJobUrl(data.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "URL must be from a known job site (LinkedIn, Indeed, Greenhouse, Lever, etc.)",
      });
    }

    if (data.resume_text !== undefined && data.resume_text.trim().length > 0) {
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
 * Formats Zod issues into a compact, Zod-style error string.
 *
 * @param error - Zod validation error
 * @returns Human-readable validation message
 */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

/**
 * Builds a typed JSON API response.
 *
 * @param body - ApiResponse payload
 * @param status - HTTP status code
 */
function jsonResponse(
  body: AnalysisApiResponse,
  status: number,
): NextResponse<AnalysisApiResponse> {
  return NextResponse.json(body, { status });
}

/**
 * Resolves the client IP from common proxy headers, falling back to "unknown".
 *
 * @param request - Incoming Next.js request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Applies a simple sliding-window-ish fixed window rate limit per IP.
 *
 * @param ip - Client IP address
 * @returns Whether the request is allowed, plus remaining quota metadata
 */
function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || now >= existing.resetAt) {
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      retryAfterSec: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
    };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(ip, existing);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - existing.count,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Periodically prunes expired rate-limit entries to avoid unbounded Map growth.
 */
function pruneRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}

/**
 * Maps Groq service failures to HTTP status + client-safe messages.
 *
 * @param error - Groq service error
 */
function mapGroqError(error: GroqServiceError): {
  status: number;
  message: string;
} {
  switch (error.code) {
    case "RATE_LIMIT":
      return { status: 429, message: error.message };
    case "MISSING_API_KEY":
    case "UNAUTHORIZED":
      return {
        status: 500,
        message: "Job analysis service is temporarily unavailable.",
      };
    case "CONTENT_POLICY":
      return { status: 400, message: error.message };
    case "EMPTY_CONTENT":
    case "PARSE":
    case "VALIDATION":
      return { status: 500, message: error.message };
    case "NETWORK":
    case "API":
    default:
      return {
        status: 500,
        message: error.message || "Failed to analyze job listing.",
      };
  }
}

/**
 * POST /api/analyze
 *
 * Accepts a job posting URL (and optional resume text), scrapes the page,
 * runs Groq analysis, and optionally generates a resume match score.
 */
export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalysisApiResponse>> {
  const startedAt = Date.now();
  const ip = getClientIp(request);
  let requestUrl = "unknown";
  let resumeProvided = false;

  pruneRateLimitStore();

  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    logInfo("Analyze request rate limited", {
      ip,
      timestamp: new Date().toISOString(),
      retryAfterSec: rate.retryAfterSec,
    });

    const response = jsonResponse(
      {
        success: false,
        error: "Too many requests. Please wait a minute and try again.",
      },
      429,
    );
    response.headers.set("Retry-After", String(rate.retryAfterSec));
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", "0");
    return response;
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "body: Invalid JSON payload",
        },
        400,
      );
    }

    const parsed = analysisRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return jsonResponse(
        {
          success: false,
          error: formatZodError(parsed.error),
        },
        400,
      );
    }

    const body: AnalysisRequest = {
      url: parsed.data.url.trim(),
      resume_text: parsed.data.resume_text?.trim()
        ? parsed.data.resume_text.trim()
        : undefined,
    };

    requestUrl = body.url;
    resumeProvided = Boolean(body.resume_text);

    logInfo("Analyze request received", {
      ip,
      url: requestUrl,
      resumeProvided,
      timestamp: new Date().toISOString(),
    });

    const pageContent = await fetchPageContent(body.url);
    if (pageContent.trim().length < MIN_CONTENT_LENGTH) {
      const elapsedMs = Date.now() - startedAt;
      logInfo("Analyze request rejected: content too short", {
        ip,
        url: requestUrl,
        contentLength: pageContent.trim().length,
        elapsedMs,
      });

      return jsonResponse(
        {
          success: false,
          error: "Could not extract job content",
        },
        400,
      );
    }

    const analysis = await analyzeJobListing(pageContent, body.resume_text);

    let match: MatchResult | undefined;
    if (body.resume_text) {
      match = await generateMatchScore(analysis, body.resume_text);
    }

    const data: AnalysisResult = match ? { analysis, match } : { analysis };
    const elapsedMs = Date.now() - startedAt;

    logInfo("Analyze request succeeded", {
      ip,
      url: requestUrl,
      resumeProvided,
      elapsedMs,
      overallScore: analysis.overall_score,
      matchScore: match?.match_score,
    });

    const response = jsonResponse(
      {
        success: true,
        data,
      },
      200,
    );
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
    response.headers.set("X-Response-Time", `${elapsedMs}ms`);
    return response;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (error instanceof GroqServiceError) {
      const mapped = mapGroqError(error);
      logError("Analyze request failed (Groq)", {
        ip,
        url: requestUrl,
        resumeProvided,
        elapsedMs,
        code: error.code,
        message: error.message,
        status: mapped.status,
      });

      const response = jsonResponse(
        {
          success: false,
          error: mapped.message,
        },
        mapped.status,
      );
      response.headers.set("X-Response-Time", `${elapsedMs}ms`);
      return response;
    }

    logError("Analyze request failed", {
      ip,
      url: requestUrl,
      resumeProvided,
      elapsedMs,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while analyzing the job listing.",
      },
      500,
    );
  }
}
