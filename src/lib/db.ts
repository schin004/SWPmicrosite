import { supabase } from './supabase';

// ─── Submit idea (Imagine step) ───────────────────────────────────────────────
export async function submitIdea(params: {
  sessionId: string;
  ideaText: string;
  category: string;
}) {
  if (!supabase) return;
  await supabase.from('idea_submissions').insert({
    session_id: params.sessionId,
    idea_text: params.ideaText,
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
  if (!supabase) return;
  await supabase.from('explore_reactions').upsert({
    session_id: params.sessionId,
    workgroup_id: params.workgroupId,
    idea_id: params.ideaId,
    idea_label: params.ideaLabel,
    reaction: params.reaction || null,
    comment: params.comment || null,
  }, { onConflict: 'session_id,idea_id' });
}

// ─── Save workgroup contribution (Explore card text area) ────────────────────
export async function saveWorkgroupContribution(params: {
  sessionId: string;
  workgroupId: string;
  workgroupTitle: string;
  contribution: string;
}) {
  if (!supabase || !params.contribution.trim()) return;
  await supabase.from('workgroup_contributions').upsert({
    session_id: params.sessionId,
    workgroup_id: params.workgroupId,
    workgroup_title: params.workgroupTitle,
    contribution: params.contribution,
  }, { onConflict: 'session_id,workgroup_id' });
}

// ─── Record pledge (Pledge step) ─────────────────────────────────────────────
export async function recordPledge(sessionId: string) {
  if (!supabase) return;
  await supabase.from('pledges').upsert(
    { session_id: sessionId },
    { onConflict: 'session_id' }
  );
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

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','may','might',
  'that','this','these','those','i','we','you','they','it','my','our',
  'your','their','its','more','can','how','what','when','where','who',
  'also','just','very','so','if','as','up','out','not','all','about',
  'into','than','then','there','which','after','before','between',
]);

function extractWords(texts: string[]): { word: string; count: number }[] {
  const freq: Record<string, number> = {};
  texts.forEach(text => {
    text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([word, count]) => ({ word, count }));
}

const REACTION_META: Record<string, string> = {
  love: '❤️', useful: '👍', 'needs-thought': '🤔', interesting: '💡',
};

export async function fetchPulseData(): Promise<PulseData | null> {
  if (!supabase) return null;

  const today = new Date().toISOString().split('T')[0];

  const [
    { count: ideasCount },
    { count: pledgesCount },
    { data: todayRows },
    { data: allIdeas },
    { data: reactions },
  ] = await Promise.all([
    supabase.from('idea_submissions').select('*', { count: 'exact', head: true }),
    supabase.from('pledges').select('*', { count: 'exact', head: true }),
    supabase.from('idea_submissions').select('session_id').gte('created_at', `${today}T00:00:00`),
    supabase.from('idea_submissions').select('idea_text, category, created_at').order('created_at', { ascending: false }),
    supabase.from('explore_reactions').select('reaction'),
  ]);

  const visitorsToday = new Set((todayRows ?? []).map(r => r.session_id)).size;
  const topWords = extractWords((allIdeas ?? []).map(r => r.idea_text));

  // Category breakdown
  const catFreq: Record<string, number> = {};
  (allIdeas ?? []).forEach(r => {
    const cat = r.category || 'Uncategorised';
    catFreq[cat] = (catFreq[cat] || 0) + 1;
  });
  const categoryBreakdown = Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  // Reaction breakdown
  const rxFreq: Record<string, number> = {};
  (reactions ?? []).forEach(r => {
    if (r.reaction) rxFreq[r.reaction] = (rxFreq[r.reaction] || 0) + 1;
  });
  const reactionBreakdown = Object.entries(rxFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([reaction, count]) => ({ reaction, emoji: REACTION_META[reaction] ?? '💬', count }));

  return {
    ideasCount: ideasCount ?? 0,
    pledgesCount: pledgesCount ?? 0,
    visitorsToday,
    journeysCompleted: pledgesCount ?? 0,
    topWords,
    categoryBreakdown,
    reactionBreakdown,
    recentIdeas: (allIdeas ?? []).slice(0, 5),
  };
}
