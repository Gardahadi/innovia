export type ScoreDimension =
  | "market_size"
  | "revenue_quality"
  | "go_to_market"
  | "product_differentiation"
  | "team"
  | "financials"
  | "competitive_moat";

export interface Score {
  dimension: ScoreDimension;
  value: number; // 1–10
  rationale: string;
}

export interface Observation {
  id: string;
  deal_id: string;
  slide_index: number;
  content: string;
  category: "strength" | "concern" | "question" | "neutral";
  created_at: string;
}

export interface Slide {
  id: string;
  deal_id: string;
  index: number;
  label: string | null; // classified section name, e.g. "Team", "Market Size"
  text_content: string | null;
  image_path: string | null; // storage path in Supabase
  created_at: string;
}

export interface Deal {
  id: string;
  name: string;
  company_name: string;
  stage: "Series A" | "Series B" | string;
  status: "pending" | "analyzing" | "complete" | "error";
  scores: Score[];
  overall_score: number | null;
  summary: string | null;
  pdf_path: string | null; // storage path in Supabase
  created_at: string;
  updated_at: string;
}
