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

// ─── Demo data ────────────────────────────────────────────────────────────────
// The static GitHub Pages build has no /api backend, so read calls return null.
// In that case we fall back to illustrative dummy data so the prototype still
// looks alive. The live Rabbit deployment runs server.js (real data) and never
// uses this file, so it is unaffected.
const DEMO_HOME_STATS: HomeStats = {
  ideasCount: 128,
  pledgesCount: 86,
  visitorsToday: 342,
  journeysCompleted: 74,
};

const DEMO_PULSE: PulseData = {
  ideasCount: 128,
  pledgesCount: 86,
  visitorsToday: 342,
  journeysCompleted: 74,
  topWords: [
    { word: 'automation', count: 18 }, { word: 'collaboration', count: 15 },
    { word: 'training', count: 13 }, { word: 'data', count: 12 },
    { word: 'wellbeing', count: 10 }, { word: 'flexibility', count: 9 },
    { word: 'technology', count: 9 }, { word: 'careers', count: 8 },
    { word: 'processes', count: 7 }, { word: 'mentorship', count: 6 },
    { word: 'feedback', count: 5 }, { word: 'innovation', count: 5 },
  ],
  categoryBreakdown: [
    { category: 'Technology & AI', count: 42 },
    { category: 'Work Priorities & Processes', count: 31 },
    { category: 'Skills & Careers', count: 24 },
    { category: 'Collaboration & Culture', count: 19 },
    { category: 'Leadership & Support', count: 12 },
  ],
  reactionBreakdown: [
    { reaction: 'Love it', emoji: '❤️', count: 54 },
    { reaction: 'Useful', emoji: '👍', count: 41 },
    { reaction: 'Tell me more', emoji: '💡', count: 33 },
    { reaction: 'Needs more thought', emoji: '🤔', count: 22 },
  ],
  recentIdeas: [
    { idea_text: 'Use AI to draft routine reports so officers can focus on fieldwork.', category: 'Technology & AI', created_at: new Date().toISOString() },
    { idea_text: 'Cross-team rotations to build broader capabilities.', category: 'Skills & Careers', created_at: new Date().toISOString() },
    { idea_text: 'Shared dashboards so everyone sees the same live data.', category: 'Collaboration & Culture', created_at: new Date().toISOString() },
    { idea_text: 'Simplify approval steps for low-risk decisions.', category: 'Work Priorities & Processes', created_at: new Date().toISOString() },
  ],
};

// ─── Home page stats (lightweight) ────────────────────────────────────────────
export interface HomeStats {
  ideasCount: number;
  pledgesCount: number;
  visitorsToday: number;
  journeysCompleted: number;
}

export async function fetchHomeStats(): Promise<HomeStats | null> {
  return (await apiGet<HomeStats>('/api/home-stats')) ?? DEMO_HOME_STATS;
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
  return (await apiGet<PulseData>('/api/pulse')) ?? DEMO_PULSE;
}
