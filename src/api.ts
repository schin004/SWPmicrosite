// Thin client for the GreenPass backend. All admin requests carry the shared
// HR password in the `x-admin-password` header (stored in sessionStorage after
// a successful login).

export type AiStatus = 'clear' | 'review' | 'flagged';
export type SubmissionStatus = 'awaiting-hr-review' | 'approved' | 'rejected';

export interface Submission {
  id: number;
  full_name: string;
  email: string | null;
  start_date: string;
  photo_path: string | null;
  intro: string;
  fun_fact: string | null;
  status: SubmissionStatus;
  job_title: string | null;
  division: string | null;
  ai_status: AiStatus | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  photo_status: string | null;
  photo_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EdmArchiveEntry {
  id: number;
  occasion: string;
  send_date: string | null;
  hire_names: string[];
  html: string;
  created_at: string;
}

const PW_KEY = 'greenpass-admin-pw';

export const getAdminPassword = () => sessionStorage.getItem(PW_KEY) || '';
export const setAdminPassword = (pw: string) => sessionStorage.setItem(PW_KEY, pw);
export const clearAdminPassword = () => sessionStorage.removeItem(PW_KEY);

async function parse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function adminHeaders(extra: Record<string, string> = {}) {
  return { 'x-admin-password': getAdminPassword(), ...extra };
}

export async function adminLogin(password: string): Promise<void> {
  await parse(
    await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  );
  setAdminPassword(password);
}

export async function submitEntry(form: FormData): Promise<{ id: number; name: string }> {
  return parse(await fetch('/api/submissions', { method: 'POST', body: form }));
}

export async function fetchSubmissions(): Promise<Submission[]> {
  return parse(await fetch('/api/submissions', { headers: adminHeaders() }));
}

export async function updateSubmission(id: number, patch: Partial<Submission>): Promise<Submission> {
  return parse(
    await fetch(`/api/submissions/${id}`, {
      method: 'PATCH',
      headers: adminHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(patch),
    }),
  );
}

export async function generateEdm(
  ids: number[],
  occasion: string,
  send_date: string,
): Promise<{ id: number; html: string; names: string[]; occasion: string }> {
  return parse(
    await fetch('/api/edm', {
      method: 'POST',
      headers: adminHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ ids, occasion, send_date }),
    }),
  );
}

export async function fetchArchive(): Promise<EdmArchiveEntry[]> {
  return parse(await fetch('/api/edm', { headers: adminHeaders() }));
}
