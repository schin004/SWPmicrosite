// ─────────────────────────────────────────────────────────────────────────────
// NParks Future of Work Hub — backend server
//
// Serves the built front-end (dist/) AND provides the /api endpoints that read
// and write to the Neon PostgreSQL database. The database connection string is
// read from process.env.DATABASE_URL (set automatically by Rabbit Deploy when
// you create/attach a Neon database). The connection string never reaches the
// browser — all DB access happens here on the server.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// ── Database pool ────────────────────────────────────────────────────────────
// Neon requires SSL (default). Set PGSSL=disable only for a local test database.
const useSsl = process.env.PGSSL !== 'disable';
const pool = DATABASE_URL
  ? new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 5,
    })
  : null;

if (!pool) {
  console.warn('[server] DATABASE_URL is not set — /api endpoints will return empty data until a database is attached.');
}

// ── Schema: create tables on startup (idempotent) ────────────────────────────
async function ensureSchema() {
  if (!pool) return;
  const sql = `
    create extension if not exists pgcrypto;

    create table if not exists idea_submissions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      session_id text unique not null,
      idea_text  text,
      category   text
    );

    create table if not exists explore_reactions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      session_id  text not null,
      workgroup_id text,
      idea_id     text not null,
      idea_label  text,
      reaction    text,
      comment     text,
      unique (session_id, idea_id)
    );

    create table if not exists workgroup_contributions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      session_id     text not null,
      workgroup_id   text not null,
      workgroup_title text,
      contribution   text,
      unique (session_id, workgroup_id)
    );

    create table if not exists pledges (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      session_id text unique not null
    );
  `;
  await pool.query(sql);
  console.log('[server] schema ready');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','may','might',
  'that','this','these','those','i','we','you','they','it','my','our',
  'your','their','its','more','can','how','what','when','where','who',
  'also','just','very','so','if','as','up','out','not','all','about',
  'into','than','then','there','which','after','before','between',
]);
const REACTION_META = { love: '❤️', useful: '👍', 'needs-thought': '🤔', interesting: '💡' };

function extractWords(texts) {
  const freq = {};
  for (const text of texts) {
    (text || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))
      .forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 24)
    .map(([word, count]) => ({ word, count }));
}

// Wrap async route handlers so DB errors return 500 instead of crashing.
const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error('[api error]', req.path, err.message);
  res.status(500).json({ error: 'server_error' });
});

const noDb = res => res.status(503).json({ error: 'no_database' });

// ── Write endpoints ──────────────────────────────────────────────────────────
app.post('/api/idea', wrap(async (req, res) => {
  if (!pool) return noDb(res);
  const { sessionId, ideaText, category } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing_session' });
  await pool.query(
    `insert into idea_submissions (session_id, idea_text, category, updated_at)
     values ($1, $2, $3, now())
     on conflict (session_id) do update
       set idea_text = excluded.idea_text, category = excluded.category, updated_at = now()`,
    [sessionId, ideaText || null, category || null]
  );
  res.json({ ok: true });
}));

app.post('/api/reaction', wrap(async (req, res) => {
  if (!pool) return noDb(res);
  const { sessionId, workgroupId, ideaId, ideaLabel, reaction, comment } = req.body || {};
  if (!sessionId || !ideaId) return res.status(400).json({ error: 'missing_fields' });
  await pool.query(
    `insert into explore_reactions
       (session_id, workgroup_id, idea_id, idea_label, reaction, comment, updated_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (session_id, idea_id) do update
       set reaction = excluded.reaction, comment = excluded.comment,
           idea_label = excluded.idea_label, workgroup_id = excluded.workgroup_id,
           updated_at = now()`,
    [sessionId, workgroupId || null, ideaId, ideaLabel || null, reaction || null, comment || null]
  );
  res.json({ ok: true });
}));

app.post('/api/contribution', wrap(async (req, res) => {
  if (!pool) return noDb(res);
  const { sessionId, workgroupId, workgroupTitle, contribution } = req.body || {};
  if (!sessionId || !workgroupId) return res.status(400).json({ error: 'missing_fields' });
  if (!contribution || !contribution.trim()) return res.json({ ok: true }); // nothing to save
  await pool.query(
    `insert into workgroup_contributions
       (session_id, workgroup_id, workgroup_title, contribution, updated_at)
     values ($1,$2,$3,$4, now())
     on conflict (session_id, workgroup_id) do update
       set workgroup_title = excluded.workgroup_title,
           contribution = excluded.contribution, updated_at = now()`,
    [sessionId, workgroupId, workgroupTitle || null, contribution]
  );
  res.json({ ok: true });
}));

app.post('/api/pledge', wrap(async (req, res) => {
  if (!pool) return noDb(res);
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'missing_session' });
  await pool.query(
    `insert into pledges (session_id, updated_at) values ($1, now())
     on conflict (session_id) do update set updated_at = now()`,
    [sessionId]
  );
  res.json({ ok: true });
}));

// ── Read endpoints ───────────────────────────────────────────────────────────
app.get('/api/progress', wrap(async (req, res) => {
  if (!pool) return res.json({ idea: null, reactions: {}, contributions: {}, hasPledge: false });
  const sessionId = req.query.sessionId;
  if (!sessionId) return res.json({ idea: null, reactions: {}, contributions: {}, hasPledge: false });

  const [idea, reactions, contribs, pledge] = await Promise.all([
    pool.query('select idea_text, category from idea_submissions where session_id = $1', [sessionId]),
    pool.query('select idea_id, reaction, comment from explore_reactions where session_id = $1', [sessionId]),
    pool.query('select workgroup_id, contribution from workgroup_contributions where session_id = $1', [sessionId]),
    pool.query('select 1 from pledges where session_id = $1', [sessionId]),
  ]);

  const reactionMap = {};
  reactions.rows.forEach(r => { reactionMap[r.idea_id] = { reaction: r.reaction || '', comment: r.comment || '' }; });
  const contribMap = {};
  contribs.rows.forEach(c => { contribMap[c.workgroup_id] = c.contribution || ''; });

  res.json({
    idea: idea.rows[0] ? { idea_text: idea.rows[0].idea_text, category: idea.rows[0].category } : null,
    reactions: reactionMap,
    contributions: contribMap,
    hasPledge: pledge.rows.length > 0,
  });
}));

app.get('/api/home-stats', wrap(async (req, res) => {
  if (!pool) return res.json({ ideasCount: 0, pledgesCount: 0, visitorsToday: 0, journeysCompleted: 0 });
  const [ideas, pledges, today] = await Promise.all([
    pool.query('select count(*)::int as n from idea_submissions'),
    pool.query('select count(*)::int as n from pledges'),
    pool.query("select distinct session_id from idea_submissions where created_at >= date_trunc('day', now())"),
  ]);
  res.json({
    ideasCount: ideas.rows[0].n,
    pledgesCount: pledges.rows[0].n,
    visitorsToday: today.rows.length,
    journeysCompleted: pledges.rows[0].n,
  });
}));

app.get('/api/pulse', wrap(async (req, res) => {
  if (!pool) return res.json(null);
  const [ideas, pledges, today, allIdeas, reactions] = await Promise.all([
    pool.query('select count(*)::int as n from idea_submissions'),
    pool.query('select count(*)::int as n from pledges'),
    pool.query("select distinct session_id from idea_submissions where created_at >= date_trunc('day', now())"),
    pool.query('select idea_text, category, created_at from idea_submissions order by created_at desc'),
    pool.query('select reaction from explore_reactions'),
  ]);

  const topWords = extractWords(allIdeas.rows.map(r => r.idea_text));

  const catFreq = {};
  allIdeas.rows.forEach(r => { const c = r.category || 'Uncategorised'; catFreq[c] = (catFreq[c] || 0) + 1; });
  const categoryBreakdown = Object.entries(catFreq).sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  const rxFreq = {};
  reactions.rows.forEach(r => { if (r.reaction) rxFreq[r.reaction] = (rxFreq[r.reaction] || 0) + 1; });
  const reactionBreakdown = Object.entries(rxFreq).sort((a, b) => b[1] - a[1])
    .map(([reaction, count]) => ({ reaction, emoji: REACTION_META[reaction] || '💬', count }));

  res.json({
    ideasCount: ideas.rows[0].n,
    pledgesCount: pledges.rows[0].n,
    visitorsToday: today.rows.length,
    journeysCompleted: pledges.rows[0].n,
    topWords,
    categoryBreakdown,
    reactionBreakdown,
    recentIdeas: allIdeas.rows.slice(0, 5),
  });
}));

app.get('/api/health', (req, res) => res.json({ ok: true, db: Boolean(pool) }));

// ── Static front-end + SPA fallback ──────────────────────────────────────────
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir));
app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));

// ── Start ────────────────────────────────────────────────────────────────────
ensureSchema()
  .catch(err => console.error('[server] schema init failed:', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
  });
