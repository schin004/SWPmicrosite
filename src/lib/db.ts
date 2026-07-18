// Front-end data layer. Talks to our own backend API (/api/*), which reads and
// writes to the Neon PostgreSQL database on the server. No database credentials
// ever reach the browser — the page only calls same-origin /api endpoints.

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.error('[api GET]', path, err);
    return null;
  }
}

async function apiPost(path: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('[api POST]', path, 'status', res.status);
  } catch (err) {
    console.error('[api POST]', path, err);
  }
}

// ─── User progress (load on mount) ───────────────────────────────────────────
export interface UserProgress {
  idea: { idea_text: string; category: string | null } | null;
  reactions: Record<string, { reaction: string; comment: string }>;
  contributions: Record<string, string>;
  hasPledge: boolean;
}

export async function loadUserProgress(sessionId: string): Promise<UserProgress> {
  const data = await apiGet<UserProgress>(`/api/progress?sessionId=${encodeURIComponent(sessionId)}`);
  return data ?? { idea: null, reactions: {}, contributions: {}, hasPledge: false };
}

// ─── Submit idea (Imagine step) — one per session ─────────────────────────────
export async function submitIdea(params: {
  sessionId: string;
  ideaText: string;
  category: string;
}) {
  await apiPost('/api/idea', {
    sessionId: params.sessionId,
    ideaText: params.ideaText,
    category: params.category || null,
  });
}

// ─── Save idea reaction + comment (Explore modal) ────────────────────────────
export async function saveIdeaReaction(params: {
  sessionId: string;
  workgroupId: string;
  ideaId: string;
  ideaLabel: string;
  reaction: string;
  comment: string;
}) {
  await apiPost('/api/reaction', params);
}

// ─── Save workgroup contribution (Explore card text area) ────────────────────
export async function saveWorkgroupContribution(params: {
  sessionId: string;
  workgroupId: string;
  workgroupTitle: string;
  contribution: string;
}) {
  if (!params.contribution.trim()) return;
  await apiPost('/api/contribution', params);
}

// ─── Record pledge (Pledge step) ─────────────────────────────────────────────
export async function recordPledge(sessionId: string) {
  await apiPost('/api/pledge', { sessionId });
}

// ─── Home page stats (lightweight) ────────────────────────────────────────────
export interface HomeStats {
  ideasCount: number;
  pledgesCount: number;
  visitorsToday: number;
  journeysCompleted: number;
}

export async function fetchHomeStats(): Promise<HomeStats | null> {
  return apiGet<HomeStats>('/api/home-stats');
}

// ─── Pulse page data ──────────────────────────────────────────────────────────
export interface PulseData {
  ideasCount: number;
  pledgesCount: number;
  visitorsToday: number;
  journeysCompleted: number;
  topWords: { word: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  reactionBreakdown: { reaction: string; emoji: string; count: number }[];
  recentIdeas: { idea_text: string; category: string | null; created_at: string }[];
}

export async function fetchPulseData(): Promise<PulseData | null> {
  return apiGet<PulseData>('/api/pulse');
}
