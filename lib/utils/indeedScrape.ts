import * as cheerio from "cheerio";
import { logDebug, logWarn } from "@/lib/utils/logger";

const MIN_USEFUL_LENGTH = 100;

/**
 * Parses a JSON object starting at `{` in `source`, using brace depth (handles nested objects).
 */
function parseLeadingJsonObject(source: string, startIndex: number): unknown | null {
  if (source[startIndex] !== "{") return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(startIndex, i + 1)) as unknown;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * Indeed embeds full job payloads in `_initialData` on some viewjob variants.
 */
function extractIndeedInitialData(html: string): unknown | null {
  const marker = "_initialData=";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  let cursor = idx + marker.length;
  while (cursor < html.length && /\s/.test(html[cursor]!)) cursor++;
  return parseLeadingJsonObject(html, cursor);
}

function htmlToPlainText(fragment: string): string {
  return cheerio.load(fragment).root().text().replace(/\s+/g, " ").trim();
}

function jobPostingFromJsonLd(html: string): string | null {
  const $ = cheerio.load(html);
  let combined = "";

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html()?.trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const type = record["@type"];
        const isJob =
          type === "JobPosting" ||
          (Array.isArray(type) && type.includes("JobPosting"));
        if (!isJob) continue;

        const parts: string[] = [];
        if (typeof record.title === "string") parts.push(record.title);
        if (typeof record.description === "string") {
          parts.push(htmlToPlainText(record.description));
        }
        if (typeof record.hiringOrganization === "object" && record.hiringOrganization) {
          const org = record.hiringOrganization as Record<string, unknown>;
          if (typeof org.name === "string") parts.push(org.name);
        }
        if (typeof record.jobLocation === "object" && record.jobLocation) {
          const loc = record.jobLocation as Record<string, unknown>;
          if (typeof loc.address === "object" && loc.address) {
            const addr = loc.address as Record<string, unknown>;
            const line = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
              .filter((v) => typeof v === "string")
              .join(", ");
            if (line) parts.push(line);
          }
        }

        const block = parts.filter(Boolean).join("\n\n").trim();
        if (block.length > combined.length) combined = block;
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  return combined.length >= MIN_USEFUL_LENGTH ? combined : null;
}

/**
 * Builds plain text from Indeed `_initialData` job model when present.
 */
function textFromIndeedInitialData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const root = data as Record<string, unknown>;
  const wrapper = root.jobInfoWrapperModel;
  if (!wrapper || typeof wrapper !== "object") return null;

  const jobInfo = (wrapper as Record<string, unknown>).jobInfoModel;
  if (!jobInfo || typeof jobInfo !== "object") return null;

  const job = jobInfo as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof job.title === "string") parts.push(job.title);
  if (typeof job.companyName === "string") parts.push(job.companyName);
  if (typeof job.formattedLocation === "string") parts.push(job.formattedLocation);

  const descWrapper = job.sanitizedJobDescription;
  if (descWrapper && typeof descWrapper === "object") {
    const content = (descWrapper as Record<string, unknown>).content;
    if (typeof content === "string" && content.trim()) {
      parts.push(htmlToPlainText(content));
    }
  }

  const text = parts.filter(Boolean).join("\n\n").trim();
  return text.length >= MIN_USEFUL_LENGTH ? text : null;
}

/**
 * Parses job description from raw Indeed HTML (JSON-LD, embedded data, or DOM).
 */
export function parseIndeedJobHtml(html: string): string | null {
  const fromInitial = textFromIndeedInitialData(extractIndeedInitialData(html));
  if (fromInitial) return fromInitial;

  const fromLd = jobPostingFromJsonLd(html);
  if (fromLd) return fromLd;

  const $ = cheerio.load(html);
  const descEl =
    $("#jobDescriptionText").first().length > 0
      ? $("#jobDescriptionText").first()
      : $('[data-testid="jobDescriptionText"]').first();

  if (descEl.length > 0) {
    const text = descEl.text().replace(/\s+/g, " ").trim();
    if (text.length >= MIN_USEFUL_LENGTH) return text;
  }

  return null;
}

/**
 * Heuristic for Indeed bot / challenge pages (no job payload in HTML).
 */
export function isIndeedBotWallHtml(html: string): boolean {
  const sample = html.slice(0, 12_000).toLowerCase();
  if (sample.includes("security check - indeed.com")) return true;
  if (sample.includes("blocked - indeed.com")) return true;
  if (sample.includes("just a moment") && sample.includes("indeed")) return true;
  if (sample.includes("challenge") && sample.includes("indeed.com")) return true;
  return false;
}

export function parseIndeedHostAndJk(url: string): { host: string; jk: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("indeed.com")) return null;
    const jk = parsed.searchParams.get("jk");
    if (!jk || !/^[a-f0-9]{16}$/i.test(jk)) return null;
    return { host, jk };
  } catch {
    return null;
  }
}

/**
 * Ordered Indeed URLs to try for a given regional host and job key.
 */
export function buildIndeedFetchUrls(host: string, jk: string): string[] {
  const base = `https://${host}`;
  return [
    `${base}/viewjob?jk=${jk}`,
    `${base}/m/basecamp/viewjob?viewtype=embedded&jk=${jk}`,
    `${base}/m/viewjob?jk=${jk}`,
  ];
}

export type IndeedFetchOutcome = {
  text: string;
  blocked: boolean;
};

/**
 * Fetches an Indeed posting using regional URLs and Indeed-specific extractors.
 */
export async function fetchIndeedJobContent(
  normalizedUrl: string,
  fetchHtml: (url: string) => Promise<string>,
): Promise<IndeedFetchOutcome> {
  const ids = parseIndeedHostAndJk(normalizedUrl);
  if (!ids) {
    const html = await fetchHtml(normalizedUrl);
    const blocked = isIndeedBotWallHtml(html);
    const text = parseIndeedJobHtml(html) ?? "";
    return { text, blocked: blocked && text.length < MIN_USEFUL_LENGTH };
  }

  const urls = buildIndeedFetchUrls(ids.host, ids.jk);
  let sawBotWall = false;

  for (const url of urls) {
    logDebug("Fetching Indeed job URL variant", { url });
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "fetch failed";
      logWarn("Indeed URL fetch failed", { url, message });
      continue;
    }

    if (isIndeedBotWallHtml(html)) {
      sawBotWall = true;
      continue;
    }

    const parsed = parseIndeedJobHtml(html);
    if (parsed && parsed.length >= MIN_USEFUL_LENGTH) {
      return { text: parsed, blocked: false };
    }
  }

  return { text: "", blocked: sawBotWall };
}
