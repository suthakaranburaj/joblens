import { z } from "zod";
import type { JobAnalysis, MatchResult } from "@/types";
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
    const validated = jobAnalysisSchema.parse(parsed);
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
        "Model returned JSON that did not match the JobAnalysis schema.",
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
