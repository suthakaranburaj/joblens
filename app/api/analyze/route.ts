import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GroqServiceError } from "@/lib/services/groqService";
import {
  analyzeJobFromUrl,
  compareRequestSchema,
  createAnalyzeJsonResponse,
  runComparePipeline,
  singleRequestSchema,
} from "@/lib/api/analyzeHandlers";
import {
  linkedInAnalysisHint,
  normalizeJobUrl,
} from "@/lib/utils/jobUrl";
import { logError, logInfo } from "@/lib/utils/logger";
import type { AnalyzeApiResponse } from "@/types";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "body";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

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

function pruneRateLimitStore(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}

function mapGroqError(
  error: GroqServiceError,
  context?: { url?: string },
): { status: number; message: string } {
  const isLinkedIn = context?.url?.includes("linkedin.com") ?? false;
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
      return {
        status: isLinkedIn ? 400 : 500,
        message: isLinkedIn
          ? `${error.message} ${linkedInAnalysisHint()}`
          : error.message,
      };
    default:
      return {
        status: 500,
        message: error.message || "Failed to analyze job listing.",
      };
  }
}

function isCompareBody(
  body: unknown,
): body is { mode: "compare" } & Record<string, unknown> {
  return (
    typeof body === "object" &&
    body !== null &&
    "mode" in body &&
    (body as { mode: string }).mode === "compare"
  );
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalyzeApiResponse>> {
  const startedAt = Date.now();
  const ip = getClientIp(request);
  let requestUrl = "unknown";
  let resumeProvided = false;

  pruneRateLimitStore();

  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    const response = createAnalyzeJsonResponse(
      {
        success: false,
        error: "Too many requests. Please wait a minute and try again.",
      },
      429,
    );
    response.headers.set("Retry-After", String(rate.retryAfterSec));
    return response;
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return createAnalyzeJsonResponse(
        { success: false, error: "body: Invalid JSON payload" },
        400,
      );
    }

    if (isCompareBody(rawBody)) {
      const parsed = compareRequestSchema.safeParse(rawBody);
      if (!parsed.success) {
        return createAnalyzeJsonResponse(
          { success: false, error: formatZodError(parsed.error) },
          400,
        );
      }

      const jobAUrl = normalizeJobUrl(parsed.data.jobA_url);
      const jobBUrl = normalizeJobUrl(parsed.data.jobB_url);
      const resume = parsed.data.resume_text?.trim() || undefined;
      resumeProvided = Boolean(resume);
      requestUrl = `${jobAUrl} | ${jobBUrl}`;

      logInfo("Compare request received", {
        ip,
        jobA_url: jobAUrl,
        jobB_url: jobBUrl,
        resumeProvided,
        hasCachedA: Boolean(parsed.data.jobA_analysis),
        hasCachedB: Boolean(parsed.data.jobB_analysis),
      });

      const data = await runComparePipeline({
        jobA_url: jobAUrl,
        jobB_url: jobBUrl,
        resume_text: resume,
        jobA_analysis: parsed.data.jobA_analysis,
        jobB_analysis: parsed.data.jobB_analysis,
      });

      const elapsedMs = Date.now() - startedAt;
      const response = createAnalyzeJsonResponse({ success: true, data }, 200);
      response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
      response.headers.set("X-Response-Time", `${elapsedMs}ms`);
      return response;
    }

    const parsed = singleRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return createAnalyzeJsonResponse(
        { success: false, error: formatZodError(parsed.error) },
        400,
      );
    }

    const url = normalizeJobUrl(parsed.data.url);
    const resume = parsed.data.resume_text?.trim() || undefined;
    requestUrl = url;
    resumeProvided = Boolean(resume);

    logInfo("Analyze request received", {
      ip,
      url: requestUrl,
      resumeProvided,
    });

    const { analysis, match } = await analyzeJobFromUrl(url, resume);
    const data = match ? { analysis, match } : { analysis };
    const elapsedMs = Date.now() - startedAt;

    const response = createAnalyzeJsonResponse({ success: true, data }, 200);
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
    response.headers.set("X-Response-Time", `${elapsedMs}ms`);
    return response;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (error instanceof GroqServiceError) {
      const mapped = mapGroqError(error, { url: requestUrl });
      logError("Analyze request failed (Groq)", {
        ip,
        url: requestUrl,
        elapsedMs,
        code: error.code,
        message: error.message,
      });
      const response = createAnalyzeJsonResponse(
        { success: false, error: mapped.message },
        mapped.status,
      );
      response.headers.set("X-Response-Time", `${elapsedMs}ms`);
      return response;
    }

    logError("Analyze request failed", {
      ip,
      url: requestUrl,
      elapsedMs,
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return createAnalyzeJsonResponse(
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
