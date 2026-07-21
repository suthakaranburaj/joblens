import * as cheerio from "cheerio";
import { logDebug, logError, logWarn } from "@/lib/utils/logger";

const MAX_CONTENT_LENGTH = 15_000;
const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

/**
 * Delays execution for the given number of milliseconds.
 *
 * @param ms - Delay duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches raw HTML for a URL with timeout and browser-like headers.
 *
 * @param url - Absolute page URL
 * @returns Response HTML as text
 * @throws When the network request fails or returns a non-OK status
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Removes non-content DOM nodes and extracts readable text from the page.
 * Prefers `main`, `[role="main"]`, `article`, then falls back to `body`.
 *
 * @param html - Raw HTML document string
 * @returns Cleaned, whitespace-normalized text truncated to the content limit
 */
function extractCleanText(html: string): string {
  const $ = cheerio.load(html);

  $(
    "script, style, noscript, svg, iframe, nav, footer, header, aside, form, [role='navigation'], [role='banner'], [role='contentinfo'], .ad, .ads, .advertisement, .cookie-banner, #cookie-banner",
  ).remove();

  const mainCandidates = [
    $(".posting-page, .posting, .content, .section.page").first(),
    $("[data-qa='job-description'], .JobListing, .job-listing, .job__description").first(),
    $("main").first(),
    $('[role="main"]').first(),
    $("article").first(),
    $(".job-description, .jobDescription, #job-description").first(),
    $("body").first(),
  ];

  let text = "";
  for (const candidate of mainCandidates) {
    if (candidate.length > 0) {
      text = candidate.text();
      if (text.trim().length > 0) break;
    }
  }

  const bodyText = $("body").text().trim();
  if (text.trim().length < 100 && bodyText.length > text.trim().length) {
    text = bodyText;
  }

  const cleaned = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (cleaned.length <= MAX_CONTENT_LENGTH) {
    return cleaned;
  }

  return cleaned.slice(0, MAX_CONTENT_LENGTH);
}

/**
 * Fetches a web page and returns cleaned textual content suitable for LLM analysis.
 *
 * Uses a browser-like User-Agent, strips scripts/styles/chrome, extracts main content
 * via Cheerio, and truncates to 15,000 characters. Retries failed requests up to twice.
 * On unrecoverable failure, logs the error and returns an empty string.
 *
 * @param url - Absolute HTTP(S) URL to scrape
 * @returns Clean page text, or an empty string if scraping fails
 */
export async function fetchPageContent(url: string): Promise<string> {
  const attempts = MAX_RETRIES + 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      logDebug("Fetching page content", { url, attempt, attempts });
      const html = await fetchHtml(url);
      const text = extractCleanText(html);

      if (!text) {
        logWarn("Page fetched but no usable text extracted", { url, attempt });
      } else {
        logDebug("Page content extracted", {
          url,
          length: text.length,
          attempt,
        });
      }

      return text;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown scrape error";

      if (attempt < attempts) {
        logWarn("Page fetch failed; retrying", { url, attempt, message });
        await sleep(300 * attempt);
        continue;
      }

      logError("Failed to fetch page content after retries", {
        url,
        attempts,
        message,
      });
      return "";
    }
  }

  return "";
}
