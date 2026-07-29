// Thin, typed API client for the FastAPI backend.
// Uses relative URLs; the Vite dev server proxies /api to the backend.

import type { AppConfig, EdmResponse, RefreshResult, Vacancy } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getConfig: () => request<AppConfig>("/api/config"),

  listVacancies: () => request<Vacancy[]>("/api/vacancies"),

  refresh: () =>
    request<RefreshResult>("/api/vacancies/refresh", { method: "POST" }),

  updateVacancy: (id: number, patch: Partial<Vacancy>) =>
    request<Vacancy>(`/api/vacancies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  reorder: (orderedIds: number[]) =>
    request<Vacancy[]>("/api/vacancies/reorder", {
      method: "POST",
      body: JSON.stringify({ ordered_ids: orderedIds }),
    }),

  generateEdm: () => request<EdmResponse>("/api/edm"),
};
