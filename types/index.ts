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

/** Payload for the analyze API endpoint. */
export interface AnalysisRequest {
  url: string;
  resume_text?: string;
}

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

/** Typed analyze endpoint response. */
export type AnalysisApiResponse = ApiResponse<AnalysisResult>;
