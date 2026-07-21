/**
 * Manual integration checks for POST /api/analyze.
 * Run: node scripts/smoke-analyze.mjs (server must be on PORT, default 3000)
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const SAMPLE_RESUME = `
Jane Doe — Senior Software Engineer
Skills: TypeScript, React, Next.js, Node.js, PostgreSQL, AWS
Experience: 6 years building SaaS dashboards and design systems.
Education: B.S. Computer Science
`.trim();

const JOB_URLS = [
  {
    name: "Greenhouse (Stripe)",
    url: "https://boards.greenhouse.io/stripe/jobs/6755547",
  },
  {
    name: "Greenhouse (Reddit)",
    url: "https://boards.greenhouse.io/reddit/jobs/6543210",
  },
  {
    name: "Lever (demo posting)",
    url: "https://jobs.lever.co/leverdemo/5ac21346-8e0c-4494-8e7a-3eb92ff77902",
  },
  {
    name: "Stripe careers listing",
    url: "https://stripe.com/jobs/listing/software-engineer/6080300",
  },
  {
    name: "LinkedIn (anti-bot expected)",
    url: "https://www.linkedin.com/jobs/view/1234567890",
  },
  {
    name: "Indeed (anti-bot expected)",
    url: "https://www.indeed.com/viewjob?jk=1234567890123456",
  },
];

async function postAnalyze(body) {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function summarizeAnalysis(json) {
  const a = json?.data?.analysis;
  if (!a) return null;
  return {
    role_title: a.role_title,
    overall_score: a.overall_score,
    requirements: a.key_requirements?.length ?? 0,
    red_flags: a.red_flags?.length ?? 0,
    match_score: json?.data?.match?.match_score,
  };
}

async function main() {
  console.log(`Smoke tests → ${BASE}/api/analyze\n`);

  const errorCases = [
    {
      label: "invalid URL",
      body: { url: "not-a-valid-url" },
      expectStatus: 400,
    },
    {
      label: "unsupported host (non-job)",
      body: { url: "https://example.com/careers" },
      expectStatus: 400,
    },
    {
      label: "empty url field",
      body: { url: "" },
      expectStatus: 400,
    },
  ];

  for (const test of errorCases) {
    const { status, json } = await postAnalyze(test.body);
    const ok = status === test.expectStatus;
    console.log(
      `${ok ? "PASS" : "FAIL"} error: ${test.label} → ${status} ${json.error ?? ""}`,
    );
  }

  console.log("\n--- Job URL probes (scrape + optional LLM) ---\n");

  let successCount = 0;
  for (const job of JOB_URLS) {
    const { status, json } = await postAnalyze({
      url: job.url,
      resume_text: SAMPLE_RESUME,
    });
    const summary = summarizeAnalysis(json);
    const pass = status === 200 && json.success && summary?.role_title;
    if (pass) successCount += 1;
    console.log(
      `${pass ? "PASS" : "WARN"} ${job.name}\n  status=${status} success=${json.success}\n  ${summary ? JSON.stringify(summary) : json.error ?? "no analysis"}\n`,
    );
  }

  console.log(
    `\nCompleted: ${successCount}/${JOB_URLS.length} full analyses returned structured data.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
