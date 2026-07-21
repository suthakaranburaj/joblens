/** Severity levels for job posting red flags. */
export type RedFlagSeverity = "low" | "medium" | "high";

/** Work arrangement described in a job posting. */
export type WorkModel = "Remote" | "Hybrid" | "On-site" | "Not specified";

/** Employment classification for a role. */
export type EmploymentType =
  | "Full-time"
  | "Part-time"
  | "Contract"
  | "Internship"
  | "Not specified";

/** Assessed growth outlook for a role. */
export type GrowthPotential = "High" | "Medium" | "Low" | "Unclear";

/** A single concern flagged during job analysis. */
export interface RedFlag {
  flag: string;
  severity: RedFlagSeverity;
  explanation: string;
}

/** Structured analysis of a job posting. */
export interface JobAnalysis {
  role_title: string;
  company: string | null;
  location: string | null;
  work_model: WorkModel;
  salary_range: string | null;
  employment_type: EmploymentType;
  key_requirements: string[];
  nice_to_have: string[];
  red_flags: RedFlag[];
  culture_signals: string;
  growth_potential: GrowthPotential;
  overall_score: number;
  verdict: string;
}

/** Resume-to-job matching outcome. */
export interface MatchResult {
  match_score: number;
  matching_skills: string[];
  missing_skills: string[];
  gap_analysis: string;
}

/** Winner label for comparison categories. */
export type ComparisonWinner = "A" | "B" | "tie";

/** Per-category comparison outcome. */
export interface ComparisonCategoryScore {
  winner: ComparisonWinner;
  explanation: string;
}

/** LLM-generated comparison of two job analyses. */
export interface JobComparison {
  winner: ComparisonWinner;
  summary: string;
  category_scores: {
    salary: ComparisonCategoryScore;
    growth: ComparisonCategoryScore;
    culture: ComparisonCategoryScore;
    requirements_match: ComparisonCategoryScore;
    red_flags: ComparisonCategoryScore;
  };
  recommendation: string;
}

/** Single-job analyze request. */
export interface SingleAnalysisRequest {
  mode?: "single";
  url: string;
  resume_text?: string;
}

/** Two-job compare request. */
export interface CompareAnalysisRequest {
  mode: "compare";
  jobA_url: string;
  jobB_url: string;
  resume_text?: string;
  /** When provided, skips re-scraping Job A. */
  jobA_analysis?: JobAnalysis;
  /** When provided, skips re-scraping Job B. */
  jobB_analysis?: JobAnalysis;
}

/** Payload for the analyze API endpoint. */
export type AnalysisRequest = SingleAnalysisRequest | CompareAnalysisRequest;

/** Standard API envelope for success and error responses. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Full analyze response when both job and optional resume match are returned. */
export interface AnalysisResult {
  analysis: JobAnalysis;
  match?: MatchResult;
}

/** Compare mode API payload. */
export interface CompareResult {
  jobA: JobAnalysis;
  jobB: JobAnalysis;
  comparison: JobComparison;
}

/** Typed analyze endpoint response (single mode). */
export type AnalysisApiResponse = ApiResponse<AnalysisResult>;

/** Typed analyze endpoint response (compare mode). */
export type CompareApiResponse = ApiResponse<CompareResult>;

/** Union of analyze API success payloads. */
export type AnalyzeApiResponse = AnalysisApiResponse | CompareApiResponse;

/** App UI mode. */
export type AnalysisMode = "single" | "compare";

/** State for one job slot in compare mode. */
export interface JobSlotState {
  url: string;
  analysis: JobAnalysis | null;
  loading: boolean;
  error: { type: string; message: string } | null;
}
