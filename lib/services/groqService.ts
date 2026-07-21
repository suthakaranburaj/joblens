import { z } from "zod";
import type { JobAnalysis, JobComparison, MatchResult } from "@/types";
import { logDebug, logError, logInfo, logWarn } from "@/lib/utils/logger";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "mixtral-8x7b-32768";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 2000;
const REQUEST_TIMEOUT_MS = 60_000;

/** Zod schema for a single red flag. */
export const redFlagSchema = z.object({
  flag: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  explanation: z.string().min(1),
});

/** Zod schema matching the `JobAnalysis` TypeScript interface. */
export const jobAnalysisSchema = z.object({
  role_title: z.string().min(1),
  company: z.string().nullable(),
  location: z.string().nullable(),
  work_model: z.enum(["Remote", "Hybrid", "On-site", "Not specified"]),
  salary_range: z.string().nullable(),
  employment_type: z.enum([
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
    "Not specified",
  ]),
  key_requirements: z.array(z.string()),
  nice_to_have: z.array(z.string()),
  red_flags: z.array(redFlagSchema),
  culture_signals: z.string(),
  growth_potential: z.enum(["High", "Medium", "Low", "Unclear"]),
  overall_score: z.number().min(0).max(100),
  verdict: z.string().min(1),
});

/** Zod schema matching the `MatchResult` TypeScript interface. */
export const matchResultSchema = z.object({
  match_score: z.number().min(0).max(100),
  matching_skills: z.array(z.string()),
  missing_skills: z.array(z.string()),
  gap_analysis: z.string().min(1),
});

const WORK_MODEL_VALUES = [
  "Remote",
  "Hybrid",
  "On-site",
  "Not specified",
] as const;

const EMPLOYMENT_TYPE_VALUES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
  "Not specified",
] as const;

const GROWTH_POTENTIAL_VALUES = ["High", "Medium", "Low", "Unclear"] as const;

/**
 * Maps loose LLM enum strings onto allowed literal values.
 */
function normalizeEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  const exact = allowed.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) {
    return exact;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("remote")) return "Remote" as T;
  if (lower.includes("hybrid")) return "Hybrid" as T;
  if (lower.includes("on-site") || lower.includes("onsite")) {
    return "On-site" as T;
  }
  if (lower.includes("full")) return "Full-time" as T;
  if (lower.includes("part")) return "Part-time" as T;
  if (lower.includes("contract")) return "Contract" as T;
  if (lower.includes("intern")) return "Internship" as T;
  if (lower.includes("high")) return "High" as T;
  if (lower.includes("medium") || lower.includes("med")) return "Medium" as T;
  if (lower.includes("low")) return "Low" as T;

  return fallback;
}

/**
 * Coerces common LLM JSON mistakes before Zod validation.
 */
function coerceJobAnalysisRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const source = raw as Record<string, unknown>;

  let overallScore: number = 50;
  if (typeof source.overall_score === "number") {
    overallScore = source.overall_score;
  } else if (typeof source.overall_score === "string") {
    overallScore = Number.parseFloat(source.overall_score);
  }
  if (Number.isFinite(overallScore)) {
    if (overallScore > 0 && overallScore <= 10) {
      overallScore *= 10;
    }
    overallScore = Math.min(100, Math.max(0, overallScore));
  } else {
    overallScore = 50;
  }

  const redFlagsRaw = Array.isArray(source.red_flags) ? source.red_flags : [];
  const red_flags = redFlagsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const flag = item as Record<string, unknown>;
      const title =
        typeof flag.flag === "string"
          ? flag.flag
          : typeof flag.title === "string"
            ? flag.title
            : "";
      const explanation =
        typeof flag.explanation === "string" ? flag.explanation : "";
      if (!title.trim() || !explanation.trim()) return null;
      const severity = normalizeEnumValue(
        typeof flag.severity === "string"
          ? flag.severity.toLowerCase()
          : flag.severity,
        ["low", "medium", "high"] as const,
        "medium",
      );
      return {
        flag: title.trim(),
        severity,
        explanation: explanation.trim(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    role_title:
      typeof source.role_title === "string" && source.role_title.trim()
        ? source.role_title.trim()
        : "Unknown role",
    company:
      source.company === null || typeof source.company === "string"
        ? source.company
        : null,
    location:
      source.location === null || typeof source.location === "string"
        ? source.location
        : null,
    work_model: normalizeEnumValue(
      source.work_model,
      WORK_MODEL_VALUES,
      "Not specified",
    ),
    salary_range:
      source.salary_range === null || typeof source.salary_range === "string"
        ? source.salary_range
        : null,
    employment_type: normalizeEnumValue(
      source.employment_type,
      EMPLOYMENT_TYPE_VALUES,
      "Not specified",
    ),
    key_requirements: Array.isArray(source.key_requirements)
      ? source.key_requirements.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [],
    nice_to_have: Array.isArray(source.nice_to_have)
      ? source.nice_to_have.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [],
    red_flags,
    culture_signals:
      typeof source.culture_signals === "string"
        ? source.culture_signals
        : "No culture signals extracted.",
    growth_potential: normalizeEnumValue(
      source.growth_potential,
      GROWTH_POTENTIAL_VALUES,
      "Unclear",
    ),
    overall_score: overallScore,
    verdict:
      typeof source.verdict === "string" && source.verdict.trim()
        ? source.verdict.trim()
        : "Analysis completed with limited page context.",
  };
}

/**
 * Parses and validates model output into a `JobAnalysis` object.
 */
export function parseJobAnalysis(raw: unknown): JobAnalysis {
  const coerced = coerceJobAnalysisRaw(raw);
  return jobAnalysisSchema.parse(coerced);
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

/**
 * Domain error thrown by the Groq service with a stable machine-readable code.
 */
export class GroqServiceError extends Error {
  readonly code:
    | "MISSING_API_KEY"
    | "NETWORK"
    | "RATE_LIMIT"
    | "UNAUTHORIZED"
    | "CONTENT_POLICY"
    | "PARSE"
    | "VALIDATION"
    | "EMPTY_CONTENT"
    | "API";

  readonly status?: number;

  constructor(
    code: GroqServiceError["code"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "GroqServiceError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Masks an API key for safe logging (keeps only the last 4 characters).
 *
 * @param apiKey - Raw API key
 * @returns Masked key string
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 4) return "****";
  return `****${apiKey.slice(-4)}`;
}

/**
 * Reads and validates the Groq API key from the environment.
 *
 * @returns Non-empty API key
 * @throws {GroqServiceError} When `GROQ_API_KEY` is missing
 */
function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new GroqServiceError(
      "MISSING_API_KEY",
      "GROQ_API_KEY is not configured. Add it to your environment variables.",
    );
  }
  return apiKey;
}

/**
 * Extracts a JSON object string from LLM output, including fenced code blocks.
 *
 * @param content - Raw assistant message content
 * @returns JSON object substring
 * @throws {GroqServiceError} When no JSON object can be located
 */
function extractJsonPayload(content: string): string {
  const trimmed = content.trim();

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new GroqServiceError(
      "PARSE",
      "Model response did not contain a JSON object.",
    );
  }

  return trimmed.slice(start, end + 1);
}

/**
 * Safely parses JSON text into an unknown value.
 *
 * @param raw - JSON string
 * @returns Parsed value
 * @throws {GroqServiceError} On malformed JSON
 */
function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new GroqServiceError(
      "PARSE",
      "Failed to parse model response as JSON. The model may have returned malformed output.",
    );
  }
}

/**
 * Maps HTTP / API failures to typed `GroqServiceError` instances.
 *
 * @param status - HTTP status code
 * @param body - Parsed or raw error body
 */
function mapHttpError(status: number, body: unknown): GroqServiceError {
  const messageFromBody =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as GroqChatCompletionResponse).error?.message === "string"
      ? (body as GroqChatCompletionResponse).error!.message!
      : typeof body === "string"
        ? body
        : `Groq API request failed with status ${status}.`;

  const lowered = messageFromBody.toLowerCase();

  if (status === 401 || status === 403) {
    return new GroqServiceError(
      "UNAUTHORIZED",
      "Invalid or unauthorized Groq API key. Check GROQ_API_KEY.",
      status,
    );
  }

  if (status === 429) {
    return new GroqServiceError(
      "RATE_LIMIT",
      "Groq rate limit exceeded. Please wait and try again.",
      status,
    );
  }

  if (
    status === 400 &&
    (lowered.includes("content") ||
      lowered.includes("policy") ||
      lowered.includes("safety") ||
      lowered.includes("refuse"))
  ) {
    return new GroqServiceError(
      "CONTENT_POLICY",
      "The request was blocked by content policy. Try a different job posting or resume text.",
      status,
    );
  }

  return new GroqServiceError("API", messageFromBody, status);
}

/**
 * System prompt that forces strict JSON job analysis output.
 *
 * @param includeResumeContext - Whether resume matching context is present
 */
function buildJobAnalysisSystemPrompt(includeResumeContext: boolean): string {
  return [
    "You are JobLens, an expert technical recruiter and career analyst.",
    "Analyze the job listing text and return ONLY a valid JSON object (no markdown, no commentary).",
    "The JSON MUST match this exact shape and field names:",
    JSON.stringify(
      {
        role_title: "string",
        company: "string | null",
        location: "string | null",
        work_model: "Remote | Hybrid | On-site | Not specified",
        salary_range: "string | null",
        employment_type:
          "Full-time | Part-time | Contract | Internship | Not specified",
        key_requirements: ["string"],
        nice_to_have: ["string"],
        red_flags: [
          {
            flag: "string",
            severity: "low | medium | high",
            explanation: "string",
          },
        ],
        culture_signals: "string",
        growth_potential: "High | Medium | Low | Unclear",
        overall_score: "number 0-100",
        verdict: "string",
      },
      null,
      2,
    ),
    "Rules:",
    "- Infer carefully from the posting; use null or 'Not specified' when unknown.",
    "- key_requirements: must-have skills/experience; nice_to_have: optional skills.",
    "- red_flags: vague compensation, unrealistic expectations, unpaid overtime signals, bait-and-switch language, toxic culture cues, etc. Empty array if none.",
    "- culture_signals: concise summary of culture / team / values signals.",
    "- growth_potential: based on learning, scope, seniority ladder, and company signals.",
    "- overall_score: 0-100 quality/attractiveness of the role for a typical qualified candidate.",
    "- verdict: 1-3 sentence recommendation.",
    includeResumeContext
      ? "- A candidate resume is provided. Slightly calibrate overall_score and verdict for fit, but still analyze the job itself. Do NOT include match_score fields in this JSON."
      : "- No resume is provided; score the role objectively for a typical qualified candidate.",
  ].join("\n");
}

/**
 * Builds the user message containing job content and optional resume text.
 *
 * @param pageContent - Cleaned job posting text
 * @param resumeText - Optional resume text for fit calibration
 */
function buildJobAnalysisUserPrompt(
  pageContent: string,
  resumeText?: string,
): string {
  const sections = [
    "JOB LISTING CONTENT:",
    pageContent.trim(),
  ];

  if (resumeText?.trim()) {
    sections.push(
      "",
      "CANDIDATE RESUME (for fit-aware scoring only):",
      resumeText.trim(),
    );
  }

  sections.push("", "Return the JSON object now.");
  return sections.join("\n");
}

/**
 * System prompt for resume-to-job match scoring.
 */
function buildMatchSystemPrompt(): string {
  return [
    "You are JobLens, an expert career coach specializing in skills gap analysis.",
    "Compare the candidate resume against the structured job analysis.",
    "Return ONLY a valid JSON object (no markdown, no commentary) with this exact shape:",
    JSON.stringify(
      {
        match_score: "number 0-100",
        matching_skills: ["string"],
        missing_skills: ["string"],
        gap_analysis: "string",
      },
      null,
      2,
    ),
    "Rules:",
    "- matching_skills: skills/requirements clearly evidenced in the resume.",
    "- missing_skills: important requirements not evidenced in the resume.",
    "- match_score: 0-100 overall fit based on key requirements weight.",
    "- gap_analysis: concise paragraph on strengths, gaps, and how to improve fit.",
  ].join("\n");
}

/**
 * Calls the Groq OpenAI-compatible chat completions API.
 * Retries once with the fallback model when the primary model fails with a
 * non-auth, non-rate-limit client/server error.
 *
 * @param messages - Chat messages
 * @param purpose - Short label for logging
 * @returns Assistant message content
 */
async function callGroqChatCompletion(
  messages: ChatMessage[],
  purpose: string,
): Promise<string> {
  const apiKey = getApiKey();
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: GroqServiceError | undefined;

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    const startedAt = Date.now();

    logInfo("Groq API call starting", {
      purpose,
      model,
      endpoint: GROQ_API_URL,
      apiKey: maskApiKey(apiKey),
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      attempt: i + 1,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: TEMPERATURE,
          max_tokens: MAX_TOKENS,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: controller.signal,
      });

      const elapsedMs = Date.now() - startedAt;
      const rawText = await response.text();
      let parsedBody: unknown = rawText;

      try {
        parsedBody = rawText ? (JSON.parse(rawText) as unknown) : {};
      } catch {
        parsedBody = rawText;
      }

      if (!response.ok) {
        const mapped = mapHttpError(response.status, parsedBody);
        logWarn("Groq API call failed", {
          purpose,
          model,
          status: response.status,
          code: mapped.code,
          elapsedMs,
          message: mapped.message,
        });

        // Do not fall back for auth / rate-limit / policy errors.
        if (
          mapped.code === "UNAUTHORIZED" ||
          mapped.code === "RATE_LIMIT" ||
          mapped.code === "CONTENT_POLICY" ||
          mapped.code === "MISSING_API_KEY"
        ) {
          throw mapped;
        }

        lastError = mapped;
        continue;
      }

      const data = parsedBody as GroqChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        lastError = new GroqServiceError(
          "EMPTY_CONTENT",
          "Groq returned an empty response. Please try again.",
        );
        logWarn("Groq API returned empty content", {
          purpose,
          model,
          elapsedMs,
        });
        continue;
      }

      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "content_filter") {
        throw new GroqServiceError(
          "CONTENT_POLICY",
          "The request was blocked by content policy. Try a different job posting or resume text.",
        );
      }

      logInfo("Groq API call succeeded", {
        purpose,
        model,
        elapsedMs,
        responseChars: content.length,
      });

      return content;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;

      if (error instanceof GroqServiceError) {
        throw error;
      }

      const isAbort =
        error instanceof Error &&
        (error.name === "AbortError" || error.message.includes("abort"));

      lastError = new GroqServiceError(
        "NETWORK",
        isAbort
          ? "Groq API request timed out. Please try again."
          : "Network error while contacting Groq API. Check your connection and try again.",
      );

      logError("Groq API network failure", {
        purpose,
        model,
        elapsedMs,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw (
    lastError ??
    new GroqServiceError("API", "Groq API request failed after model fallback.")
  );
}

/**
 * Analyzes cleaned job listing text with Groq and returns a typed `JobAnalysis`.
 * When `resumeText` is provided, overall score/verdict are lightly fit-aware.
 *
 * @param pageContent - Cleaned job posting page text
 * @param resumeText - Optional resume text for fit-aware scoring
 * @returns Validated `JobAnalysis` object
 * @throws {GroqServiceError} On API, parse, validation, or policy failures
 */
export async function analyzeJobListing(
  pageContent: string,
  resumeText?: string,
): Promise<JobAnalysis> {
  const content = pageContent.trim();
  if (!content) {
    throw new GroqServiceError(
      "EMPTY_CONTENT",
      "No job listing content was provided for analysis.",
    );
  }

  const includeResume = Boolean(resumeText?.trim());
  logDebug("analyzeJobListing started", {
    contentLength: content.length,
    hasResume: includeResume,
  });

  const raw = await callGroqChatCompletion(
    [
      {
        role: "system",
        content: buildJobAnalysisSystemPrompt(includeResume),
      },
      {
        role: "user",
        content: buildJobAnalysisUserPrompt(content, resumeText),
      },
    ],
    "analyzeJobListing",
  );

  try {
    const jsonText = extractJsonPayload(raw);
    const parsed = parseJsonSafe(jsonText);
    const validated = parseJobAnalysis(parsed);
    logDebug("analyzeJobListing validated", {
      role_title: validated.role_title,
      overall_score: validated.overall_score,
    });
    return validated;
  } catch (error) {
    if (error instanceof GroqServiceError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      logError("JobAnalysis schema validation failed", {
        issues: error.issues,
      });
      throw new GroqServiceError(
        "VALIDATION",
        "We could not structure the analysis from this page. The listing may be incomplete or blocked (common on LinkedIn search/login pages). Use a direct job URL such as https://www.linkedin.com/jobs/view/1234567890, or try Greenhouse/Lever.",
      );
    }

    logError("analyzeJobListing unexpected failure", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new GroqServiceError(
      "API",
      "Unexpected error while analyzing the job listing.",
    );
  }
}

/**
 * Generates a resume-to-job match score using Groq.
 * Call only when resume text is available.
 *
 * @param jobAnalysis - Structured job analysis
 * @param resumeText - Candidate resume text
 * @returns Validated `MatchResult`
 * @throws {GroqServiceError} On empty resume, API, parse, or validation failures
 */
export async function generateMatchScore(
  jobAnalysis: JobAnalysis,
  resumeText: string,
): Promise<MatchResult> {
  const resume = resumeText.trim();
  if (!resume) {
    throw new GroqServiceError(
      "EMPTY_CONTENT",
      "Resume text is required to generate a match score.",
    );
  }

  logDebug("generateMatchScore started", {
    role_title: jobAnalysis.role_title,
    resumeLength: resume.length,
  });

  const raw = await callGroqChatCompletion(
    [
      { role: "system", content: buildMatchSystemPrompt() },
      {
        role: "user",
        content: [
          "STRUCTURED JOB ANALYSIS:",
          JSON.stringify(jobAnalysis, null, 2),
          "",
          "CANDIDATE RESUME:",
          resume,
          "",
          "Return the JSON object now.",
        ].join("\n"),
      },
    ],
    "generateMatchScore",
  );

  try {
    const jsonText = extractJsonPayload(raw);
    const parsed = parseJsonSafe(jsonText);
    const validated = matchResultSchema.parse(parsed);
    logDebug("generateMatchScore validated", {
      match_score: validated.match_score,
      matchingCount: validated.matching_skills.length,
      missingCount: validated.missing_skills.length,
    });
    return validated;
  } catch (error) {
    if (error instanceof GroqServiceError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      logError("MatchResult schema validation failed", {
        issues: error.issues,
      });
      throw new GroqServiceError(
        "VALIDATION",
        "Model returned JSON that did not match the MatchResult schema.",
      );
    }

    logError("generateMatchScore unexpected failure", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new GroqServiceError(
      "API",
      "Unexpected error while generating the match score.",
    );
  }
}

const comparisonWinnerSchema = z.enum(["A", "B", "tie"]);

const comparisonCategorySchema = z.object({
  winner: comparisonWinnerSchema,
  explanation: z.string().min(1),
});

/** Zod schema for `JobComparison`. */
export const jobComparisonSchema = z.object({
  winner: comparisonWinnerSchema,
  summary: z.string().min(1),
  category_scores: z.object({
    salary: comparisonCategorySchema,
    growth: comparisonCategorySchema,
    culture: comparisonCategorySchema,
    requirements_match: comparisonCategorySchema,
    red_flags: comparisonCategorySchema,
  }),
  recommendation: z.string().min(1),
});

function coerceComparisonWinner(value: unknown): "A" | "B" | "tie" {
  if (typeof value !== "string") return "tie";
  const v = value.trim().toUpperCase();
  if (v === "A" || v === "JOB A" || v === "JOBA") return "A";
  if (v === "B" || v === "JOB B" || v === "JOBB") return "B";
  if (v === "TIE" || v === "DRAW") return "tie";
  return "tie";
}

function coerceCategoryScore(raw: unknown): {
  winner: "A" | "B" | "tie";
  explanation: string;
} {
  if (!raw || typeof raw !== "object") {
    return { winner: "tie", explanation: "Insufficient comparison data." };
  }
  const item = raw as Record<string, unknown>;
  return {
    winner: coerceComparisonWinner(item.winner),
    explanation:
      typeof item.explanation === "string" && item.explanation.trim()
        ? item.explanation.trim()
        : "No explanation provided.",
  };
}

function parseJobComparison(raw: unknown): JobComparison {
  if (!raw || typeof raw !== "object") {
    throw new GroqServiceError("VALIDATION", "Invalid comparison JSON.");
  }
  const source = raw as Record<string, unknown>;
  const categories =
    source.category_scores && typeof source.category_scores === "object"
      ? (source.category_scores as Record<string, unknown>)
      : {};

  const coerced = {
    winner: coerceComparisonWinner(source.winner),
    summary:
      typeof source.summary === "string" && source.summary.trim()
        ? source.summary.trim()
        : "Comparison summary unavailable.",
    category_scores: {
      salary: coerceCategoryScore(categories.salary),
      growth: coerceCategoryScore(categories.growth),
      culture: coerceCategoryScore(categories.culture),
      requirements_match: coerceCategoryScore(categories.requirements_match),
      red_flags: coerceCategoryScore(categories.red_flags),
    },
    recommendation:
      typeof source.recommendation === "string" && source.recommendation.trim()
        ? source.recommendation.trim()
        : "Review both offers against your priorities.",
  };

  return jobComparisonSchema.parse(coerced);
}

function buildCompareSystemPrompt(): string {
  return [
    "You are JobLens, an expert career advisor comparing two job offers objectively.",
    "Return ONLY valid JSON (no markdown) matching this shape:",
    JSON.stringify(
      {
        winner: "A | B | tie",
        summary: "string",
        category_scores: {
          salary: { winner: "A | B | tie", explanation: "string" },
          growth: { winner: "A | B | tie", explanation: "string" },
          culture: { winner: "A | B | tie", explanation: "string" },
          requirements_match: { winner: "A | B | tie", explanation: "string" },
          red_flags: { winner: "A | B | tie", explanation: "string" },
        },
        recommendation:
          "Choose Job A if you value X; choose Job B if you value Y.",
      },
      null,
      2,
    ),
    "Use only facts from the provided analyses. For red_flags, fewer/severe flags lose.",
    "For requirements_match, consider resume fit when resume text is provided.",
  ].join("\n");
}

/**
 * Compares two structured job analyses with Groq.
 */
export async function compareTwoJobs(
  jobA: JobAnalysis,
  jobB: JobAnalysis,
  resumeText?: string,
): Promise<JobComparison> {
  const resume = resumeText?.trim();
  logDebug("compareTwoJobs started", {
    jobA: jobA.role_title,
    jobB: jobB.role_title,
    hasResume: Boolean(resume),
  });

  const raw = await callGroqChatCompletion(
    [
      { role: "system", content: buildCompareSystemPrompt() },
      {
        role: "user",
        content: [
          "Compare these two job listings.",
          "",
          "Job A analysis JSON:",
          JSON.stringify(jobA, null, 2),
          "",
          "Job B analysis JSON:",
          JSON.stringify(jobB, null, 2),
          resume
            ? `\nThe user's resume highlights:\n${resume}\n`
            : "",
          "",
          "Return the comparison JSON now.",
        ].join("\n"),
      },
    ],
    "compareTwoJobs",
  );

  try {
    const jsonText = extractJsonPayload(raw);
    const parsed = parseJsonSafe(jsonText);
    const validated = parseJobComparison(parsed);
    return validated;
  } catch (error) {
    if (error instanceof GroqServiceError) throw error;
    if (error instanceof z.ZodError) {
      logError("JobComparison schema validation failed", {
        issues: error.issues,
      });
      throw new GroqServiceError(
        "VALIDATION",
        "Could not structure the job comparison. Please try again.",
      );
    }
    throw new GroqServiceError("API", "Unexpected error while comparing jobs.");
  }
}
