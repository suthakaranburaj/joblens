# DECISIONS.md (PingAura)

Documenting product and engineering tradeoffs for **JobLens**.

---

## 1. What I built (and for whom)

**JobLens** is a web app for **job seekers and career switchers** who want a fast, structured read on a posting before they invest time applying.

**Core flow:**

- Paste a job URL from major boards / ATS sites (LinkedIn, Greenhouse, Lever, Workday, etc.).
- Server scrapes and cleans page text, then calls **Groq** to produce structured JSON: role metadata, requirements, red flags, culture signals, score, and verdict.
- Optional resume text triggers a second LLM pass for **match score**, matching/missing skills, and gap analysis.
- UI includes dark/light theme, loading skeletons, typed errors, and responsive layouts.

**Stack:** Next.js App Router, TypeScript, Tailwind + shadcn/ui, Zod validation, Cheerio scraping, Groq chat completions.

---

## 2. What I cut (and why)

| Cut | Why |
|-----|-----|
| **User accounts / DB** | Assignment scope focused on analyze-once flow; auth would add storage, GDPR, and session complexity without proving core value. |
| **PDF resume upload** | Text paste is enough for MVP; PDF parsing adds dependencies, OCR edge cases, and PII handling. |
| **Global distributed rate limit** | Implemented simple in-memory IP limit (10/min) to ship quickly; Redis/KV deferred until multi-instance deploy. |
| **Static export (`output: 'export'`)** | API route + Cheerio require a Node server; static hosting cannot run `/api/analyze`. |
| **Framer Motion** | Used Tailwind `animate-in` + keyed `FadePresence` wrapper to avoid another dependency and keep bundle lean. |
| **Broad “any URL” scraping** | Restricted to known job hosts to reduce abuse, irrelevant pages, and prompt noise. |
| **shadcn Button in initial scaffold** | Removed auto-generated button during setup to keep feature components intentional. |

---

## 3. Hardest decision

**Trusting LLM output for production-shaped UX while keeping the pipeline reliable.**

Job pages are messy HTML; models can hallucinate requirements or miss salary info. I chose:

1. **Low temperature (0.3)** and **`response_format: json_object`** on Groq.
2. **Zod schemas** mirroring `JobAnalysis` / `MatchResult` so bad JSON fails loudly.
3. **Scrape cleanup + length caps** before the model sees content.
4. **Separate match call** only when resume text exists, so base analysis stays comparable across users.

The tradeoff: stricter validation means occasional “analysis failed” errors instead of showing wrong structured data—a better failure mode for a decision-support tool.

---

## 4. How I used AI

- **Cursor / LLM assistants** accelerated boilerplate: project scaffold, shadcn setup, component stubs, Groq service, API route, and documentation.
- **Human direction:** architecture folders, type definitions, validator rules, error taxonomy, UX requirements (theme, keyboard shortcut, scroll behavior), and PingAura deliverables (`DECISIONS.md`, env/deploy docs).
- **Review & iteration:** types, Zod alignment, rate limiting, and build verification were checked in-repo; AI-generated code was edited to match conventions (path aliases, no `any`, server-only secrets).

AI was treated as a **pair programmer**, not the source of truth—especially for scraping legality, API error mapping, and schema design.

---

## 5. What I'd do next

1. **Persistence:** save analyses (Supabase/Postgres) with share links and history.
2. **Rate limiting:** Vercel KV or Upstash Redis for global limits + optional API keys.
3. **Scraper hardening:** per-site extractors (LinkedIn vs Greenhouse), caching, and robots.txt respect.
4. **Testing:** contract tests for Groq JSON, API route integration tests with mocked fetch.
5. **Observability:** structured logs, latency metrics, and Groq cost tracking per request.
6. **Accessibility pass:** live regions for analysis completion, focus management after errors.
7. **Screenshot & E2E:** Playwright flow from URL paste → results for CI.

---

_Last updated: July 2026_
