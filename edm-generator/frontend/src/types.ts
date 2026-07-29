// Shared types mirroring the backend API schemas.

export interface Vacancy {
  id: number;
  external_id: string;
  title: string;
  division: string;
  closing_date: string;
  description: string;
  apply_url: string;
  summary: string;
  summary_edited: boolean;
  hidden: boolean;
  display_order: number;
  is_open: boolean;
  updated_at?: string | null;
}

export interface RefreshResult {
  ok: boolean;
  source: "live" | "sample";
  total_found: number;
  created: number;
  updated: number;
  closed: number;
  message: string;
}

export interface AppConfig {
  app_name: string;
  careers_agency: string;
  auto_refresh_enabled: boolean;
  auto_refresh_interval: string;
  ai_summaries_enabled: boolean;
  total_vacancies: number;
  visible_vacancies: number;
}

export interface EdmResponse {
  html: string;
  vacancy_count: number;
}
