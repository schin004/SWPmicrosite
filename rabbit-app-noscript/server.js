// ─────────────────────────────────────────────────────────────────────────────
// NParks Future of Work Hub — NO-JAVASCRIPT server-rendered version.
//
// Every page is built as plain HTML on the server; forms submit normally
// (page reload). Works in any browser, including locked-down/isolated ones
// that block client-side JavaScript. Data is read from / written to the Neon
// PostgreSQL database via DATABASE_URL (set by Rabbit Deploy). No credentials
// are ever sent to the browser.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import pg from 'pg';
import crypto from 'node:crypto';

const app = express();
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const useSsl = process.env.PGSSL !== 'disable';
const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 5 })
  : null;

if (!pool) console.warn('[server] DATABASE_URL not set — data will not persist.');

// ─── Access gate (shared passcode + captured NParks email) ──────────────────────
// One shared code for the whole conference. Set ACCESS_CODE (and optionally
// ALLOWED_EMAIL_DOMAIN) in the Rabbit service env. Passing the gate sets a
// cookie; the email is recorded server-side (never shown on the public Pulse).
const ACCESS_CODE = (process.env.ACCESS_CODE || 'NPARKS2026').trim();
const EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'gov.sg').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasGate = req => /(?:^|;\s*)swp_gate=1(?:;|$)/.test(req.headers.cookie || '');

// Require sign-in before anything else (health check + the gate itself are open).
app.use((req, res, next) => {
  if (req.path === '/gate' || req.path === '/api/health') return next();
  if (hasGate(req)) return next();
  return res.redirect('/gate');
});

// Record every unique visitor (anyone who opens any page), once per session.
app.use((req, res, next) => {
  const sid = getSession(req, res);
  if (pool && !req.path.startsWith('/api')) {
    pool.query('insert into visitors (session_id) values ($1) on conflict (session_id) do nothing', [sid]).catch(() => {});
  }
  next();
});

// ─── Schema ───────────────────────────────────────────────────────────────────
async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create extension if not exists pgcrypto;
    create table if not exists idea_submissions (
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      updated_at timestamptz default now(), session_id text not null, idea_text text, category text);
    -- Allow multiple ideas per user: drop the old one-idea-per-session constraint if present.
    alter table idea_submissions drop constraint if exists idea_submissions_session_id_key;
    create table if not exists explore_reactions (
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      updated_at timestamptz default now(), session_id text not null, workgroup_id text, idea_id text not null,
      idea_label text, reaction text, comment text, unique (session_id, idea_id));
    create table if not exists workgroup_contributions (
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      updated_at timestamptz default now(), session_id text not null, workgroup_id text not null,
      workgroup_title text, contribution text, unique (session_id, workgroup_id));
    create table if not exists pledges (
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      updated_at timestamptz default now(), session_id text unique not null);
    -- Every unique visitor (anyone who opens any page), recorded once.
    create table if not exists visitors (
      session_id text primary key, first_seen timestamptz default now());
    -- Staff who signed in through the access gate (email captured once per session).
    create table if not exists gate_entries (
      session_id text primary key, email text, entered_at timestamptz default now());
  `);
  console.log('[server] schema ready');
}

// ─── Content ──────────────────────────────────────────────────────────────────
const WORKGROUPS = [
  { id: 'urban-greenery', color: '#14B8A6', title: 'Urban Greenery and Parks Management', ideas: [
    { id: 'ugpm_operator_to_orchestrator', label: 'From Operator to Orchestrator', description: `NParks could work more deliberately with industry, IHLs and community partners on clearly defined areas where they can contribute more effectively, redesigning how we partner so that their interests are genuinely aligned with the outcomes we want. NParks will continue to lead strategically, set standards and remain accountable for outcomes, public safety and public trust.` },
    { id: 'ugpm_neighbourhood_stewards', label: 'Empowering Communities as Neighbourhood Stewards', description: `NParks will explore how community groups can take on more meaningful stewardship of their neighbourhood green spaces, including making decisions about how spaces are used and cared for. This could be tested through pilots like Bishan-Ang Mo Kio Park, with NParks remaining accountable for public safety and maintenance standards.` },
    { id: 'ugpm_organising_teams', label: 'Organising Teams Around the Work', description: `Some work may be best done by area-based teams who know their patch deeply. Other work - like policy, standards and systems - may be best done by project-based teams that cut across the organisation. We could consider how to re-organise ourselves so that we have the right people and the right focus for each team, and test these models through pilots or paper exercises before considering broader structural changes.` },
    { id: 'ugpm_specialist_expertise', label: 'Deepening Specialist Expertise', description: `Greater complexity in our work calls for greater depth in our people.\n\nNParks will clarify future competencies and career pathways so that officers can deepen expertise in areas such as arboriculture, horticulture, plant health, ecology and operations technology, building specialist depth alongside generalist breadth.` },
  ]},
  { id: 'animal-health', color: '#8B5CF6', title: 'Animal Health and Management', ideas: [
    { id: 'ahm_data_decisions', label: 'Strengthening Data for Better Decisions', description: `NParks will start by reviewing the data we collect and use today, then identify 2 to 3 priority use cases where better-integrated data can improve day-to-day decisions. This will also inform how cross-functional teams, bringing together domain officers, data analysts, engagement staff and IT support, can work together more effectively on biosurveillance priorities.` },
    { id: 'ahm_ai_disease_detection', label: 'Use AI to Detect Disease Threats Earlier', description: `We could build an AI-enabled early warning system that monitors multiple data streams (outbreak databases, environmental signals, animal movement patterns) and generates risk alerts before threats escalate. We could start with 2 to 3 priority disease scenarios as proof of concept, then expand to a broader predictive biosurveillance system over time. This will include building staff capability to work effectively with AI tools and interpret outputs.` },
    { id: 'ahm_data_ai_specialists', label: 'Develop Animal Health Specialists with Data and AI Skills', description: `We envision that the future animal health officer is not just trained in biosecurity and risk assessment, but also equipped to work with data, use AI tools and communicate findings to the public. We could build these horizontal capabilities into the specialist role, so officers can act on intelligence directly rather than waiting for IT or data teams to interpret it for them.` },
    { id: 'ahm_high_value_work', label: 'Freeing Specialists to Focus on High-Value Work', description: `NParks officers currently spend significant time on administrative tasks that take them away from core scientific and operational work. We will review which of these tasks can be automated, reassigned or shared with dedicated support functions—including understanding how functions like inspections and permit processing will continue to be handled—so specialists can focus on high-value work.` },
  ]},
  { id: 'wildlife-forensics', color: '#F59418', title: 'Wildlife Management and Forensics', ideas: [
    { id: 'wmf_conservation_outcomes', label: 'Strengthening Conservation Outcomes', description: `We envision a shift reflecting a stronger focus on conservation outcomes while continuing to manage public safety, feedback and operational realities. This includes strengthening ecological literacy and public coexistence through schools, communities and public education partners, and exploring how land owners can play a clearer role in mitigating wildlife-related issues on their premises. This reframing will have to be supported by practical changes to roles, processes and ways of working.` },
    { id: 'wmf_proactive_wildlife_management', label: 'Using Data and Research for Proactive Wildlife Management', description: `We will use data, dashboards and long-term population research to support proactive, evidence-based wildlife management. This includes better triaging of cases so that officers can focus on complex, high-judgement situations while routine cases are supported by trained partners under NParks' guidance.` },
    { id: 'wmf_wildlife_veterinary_capability', label: 'Exploring a Stronger Wildlife Veterinary Capability', description: `We will study the feasibility of strengthening CWR's specialist wildlife veterinary capability, including the manpower, funding, training, research and public trust benefits required to support a stronger long-term model for wildlife care.` },
    { id: 'wmf_regional_wildlife_forensics', label: 'Building Singapore as a Trusted Regional Partner for Wildlife Forensics', description: `The long-term ambition is for Singapore to be a trusted regional partner for wildlife forensics, intelligence-sharing and scientific collaboration. To achieve this, we will work with IHL partners, regional counterparts and international networks to strengthen capability, share research direction and build the partnerships that underpin Singapore's role as a trade and travel hub committed to tackling wildlife trafficking.` },
    { id: 'wmf_intelligence_led_enforcement', label: 'Moving Toward Intelligence-Led Enforcement', description: `We could identify AI-enabled horizon scanning use cases to understand emerging wildlife trade signals, high-risk routes and trafficking networks. This will have to be supported by digitising the chain of custody end-to-end, and building a well-curated reference database and sample archive so that test development and species identification can be done faster and with greater confidence. This includes clarifying how NParks connects to transboundary crime intelligence networks and regional enforcement partners.` },
    { id: 'wmf_science_technology_bridges', label: 'Develop Staff as Operational Bridges Between Science and Technology', description: `As AI and digital tools become central to forensic work, we envision that the role of the wildlife trade specialist evolves from manual monitoring and report-reading to validating AI outputs, contextualising data for criminal intelligence and translating insights into policy. Building this capability requires deliberate investment in how staff understand and work with technology, not just technical training.` },
  ]},
];
const IDEA_BY_ID = Object.fromEntries(WORKGROUPS.flatMap(w => w.ideas.map(i => [i.id, { ...i, workgroupId: w.id, workgroupTitle: w.title }])));
const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love it' },
  { id: 'useful', emoji: '👍', label: 'Useful' },
  { id: 'needs-thought', emoji: '🤔', label: 'Needs more thought' },
  { id: 'interesting', emoji: '💡', label: 'Tell me more' },
];
const CATEGORIES = ['Work Priorities & Processes', 'Technology & AI', 'Skills & Careers', 'Collaboration & Culture', 'Leadership & Support', 'Others'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function getSession(req, res) {
  if (req._sid) return req._sid;               // consistent within a single request
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/swp_session=([^;]+)/);
  let id;
  if (m) { id = decodeURIComponent(m[1]); }
  else {
    id = crypto.randomUUID();
    res.setHeader('Set-Cookie', `swp_session=${id}; Path=/; Max-Age=2592000; SameSite=Lax`);
  }
  req._sid = id;
  return id;
}

const LOGO = `<span style="display:inline-flex;gap:3px;vertical-align:middle">
  <span style="background:#A7D3F3;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">C</span>
  <span style="background:#F0726E;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">A</span>
  <span style="background:#B7DE8F;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">D</span>
</span>`;

const STEPS = [ ['learn','Learn'], ['explore','Explore'], ['imagine','Imagine'], ['pledge','Pledge'] ];

function layout({ title, body, active = '', hideNav = false }) {
  const nav = hideNav ? '' : [['/', 'Home'], ['/learn', 'Journey'], ['/pulse', 'Pulse'], ['/about', 'About SWP']]
    .map(([href, label]) => `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`).join('');
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1E2A44"><title>${esc(title)} — NParks Future of Work</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;background:#f8f9fc;color:#1e293b;line-height:1.55}
  a{color:#3b82f6;text-decoration:none}
  header{position:sticky;top:0;background:rgba(255,255,255,.95);border-bottom:1px solid #eef2f7;z-index:10}
  .bar{max-width:960px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;gap:18px;flex-wrap:wrap}
  .brand{font-weight:800;color:#1E2A44;display:flex;align-items:center;gap:8px}
  nav{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
  nav a{padding:7px 12px;border-radius:9px;color:#475569;font-weight:600;font-size:14px}
  nav a:hover{background:#f1f5f9}
  nav a.on{color:#3b82f6}
  main{max-width:960px;margin:0 auto;padding:28px 20px 64px}
  .card{background:#fff;border:1px solid #eef2f7;border-radius:18px;padding:24px;margin:0 0 18px;box-shadow:0 4px 20px rgba(0,0,0,.05)}
  h1{font-size:32px;font-weight:800;letter-spacing:-.02em;margin:.2em 0 .4em}
  h2{font-size:22px;font-weight:800;margin:0 0 12px}
  h3{font-size:17px;font-weight:700;margin:0 0 6px}
  .muted{color:#64748b}
  .btn{display:inline-block;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;font-weight:700;padding:12px 22px;border-radius:12px;border:0;cursor:pointer;font-size:15px}
  .btn.alt{background:#fff;color:#1E2A44;border:1px solid #e2e8f0}
  .btn:hover{opacity:.94}
  .steps{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 22px}
  .steps a{flex:1;min-width:70px;text-align:center;padding:9px 6px;border-radius:10px;font-weight:700;font-size:13px;background:#eef2f7;color:#64748b}
  .steps a.on{background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff}
  .steps a.done{background:#dcfce7;color:#16a34a}
  label{font-weight:600;font-size:14px}
  textarea,select,input[type=text]{width:100%;padding:11px;border:1px solid #d7dee8;border-radius:11px;font:inherit;margin-top:6px}
  .rx{display:inline-flex;align-items:center;gap:7px;border:1px solid #d7dee8;border-radius:11px;padding:9px 13px;margin:4px 6px 4px 0;cursor:pointer;font-size:14px}
  .rx input{margin:0}
  .saved{color:#16a34a;font-weight:700}
  .pill{display:inline-block;background:#eef2f7;border-radius:999px;padding:3px 11px;font-size:13px;font-weight:600;margin:3px}
  footer{background:#1E2A44;color:#cbd5e1;text-align:center;padding:22px;font-size:13px}
  .grid{display:grid;gap:14px}
  @media(min-width:640px){.grid.two{grid-template-columns:1fr 1fr}}
  .big{font-size:40px;font-weight:800;color:#1E2A44;line-height:1.05}
  .accent{background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent}
  .stat{background:#fff;border:1px solid #eef2f7;border-radius:16px;padding:18px;text-align:center}
  .stat .n{font-size:30px;font-weight:800;color:#1E2A44}
  .word{display:inline-block;margin:4px 8px;font-weight:700}
</style></head>
<body>
<header><div class="bar"><span class="brand">${LOGO} NParks · Future of Work</span><nav>${nav}</nav></div></header>
<main>${body}</main>
<footer>${LOGO}<div style="margin-top:8px">© ${new Date().getFullYear()} National Parks Board · Ctrl • Alt • Del — shaping the future of work together</div></footer>
</body></html>`;
}

function stepbar(current, done = []) {
  return `<div class="steps">${STEPS.map(([id, label]) =>
    `<a class="${current===id?'on':done.includes(id)?'done':''}" href="/${id}">${done.includes(id)&&current!==id?'✓ ':''}${label}</a>`).join('')}</div>`;
}

// ─── Data helpers ─────────────────────────────────────────────────────────────
async function loadProgress(sid) {
  if (!pool) return { idea: null, reactions: {}, contributions: {}, hasPledge: false };
  const [idea, rx, cb, pl] = await Promise.all([
    pool.query('select idea_text, category from idea_submissions where session_id=$1', [sid]),
    pool.query('select idea_id, reaction, comment from explore_reactions where session_id=$1', [sid]),
    pool.query('select workgroup_id, contribution from workgroup_contributions where session_id=$1', [sid]),
    pool.query('select 1 from pledges where session_id=$1', [sid]),
  ]);
  const reactions = {}; rx.rows.forEach(r => reactions[r.idea_id] = { reaction: r.reaction || '', comment: r.comment || '' });
  const contributions = {}; cb.rows.forEach(c => contributions[c.workgroup_id] = c.contribution || '');
  return { idea: idea.rows[0] || null, reactions, contributions, hasPledge: pl.rows.length > 0 };
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, db: Boolean(pool) }));

function gatePage({ error = '', email = '' } = {}) {
  return layout({ title: 'Staff Sign In', hideNav: true, body: `
    <div class="card" style="max-width:440px;margin:30px auto">
      <div style="text-align:center;transform:scale(1.3);margin:6px 0 18px">${LOGO}</div>
      <h1 style="font-size:24px;text-align:center;margin-top:0">Staff Access</h1>
      <p class="muted" style="text-align:center">This site is for NParks staff. Enter your NParks email and the access code shared at the conference to continue.</p>
      ${error ? `<p style="color:#dc2626;font-weight:700;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 12px">${esc(error)}</p>` : ''}
      <form method="post" action="/gate">
        <label>NParks email</label>
        <input type="text" name="email" value="${esc(email)}" placeholder="you@nparks.gov.sg" autocomplete="email" required>
        <label style="display:block;margin-top:14px">Access code</label>
        <input type="text" name="code" placeholder="Enter the conference access code" required>
        <p style="margin-top:18px"><button class="btn" type="submit" style="width:100%">Enter →</button></p>
      </form>
    </div>` });
}

app.get('/gate', (req, res) => {
  if (hasGate(req)) return res.redirect('/');
  res.send(gatePage());
});

app.post('/gate', (req, res) => {
  const email = (req.body.email || '').trim();
  const code = (req.body.code || '').trim();
  if (code !== ACCESS_CODE) {
    return res.send(gatePage({ error: 'Incorrect access code. Please check the code shared at the conference.', email }));
  }
  const domain = (email.split('@')[1] || '').toLowerCase();
  const okDomain = domain === EMAIL_DOMAIN || domain.endsWith('.' + EMAIL_DOMAIN);
  if (!EMAIL_RE.test(email) || !okDomain) {
    return res.send(gatePage({ error: `Please enter a valid NParks email address (ending in @${EMAIL_DOMAIN}).`, email }));
  }
  const sid = getSession(req, res);
  res.append('Set-Cookie', 'swp_gate=1; Path=/; Max-Age=2592000; SameSite=Lax');
  if (pool) pool.query(
    'insert into gate_entries (session_id, email) values ($1,$2) on conflict (session_id) do update set email=excluded.email',
    [sid, email.slice(0, 200)]).catch(() => {});
  res.redirect('/');
});

app.get('/', (req, res) => {
  getSession(req, res);
  res.send(layout({ title: 'Home', active: '/', body: `
    <div style="text-align:center;padding:20px 0 8px">
      <span class="pill" style="background:#eff6ff;color:#3b82f6">● NParks Staff Conference 2026</span>
      <div class="big" style="margin:22px 0">Ctrl.<br><span class="accent">Alt.</span><br>Delete.</div>
      <p class="muted" style="font-size:18px;max-width:520px;margin:0 auto 26px">Reimagine the future of work at NParks. Your voice shapes what comes next.</p>
      <a class="btn" href="/learn">Start My Journey →</a>
      <a class="btn alt" href="/pulse" style="margin-left:8px">View Live Pulse</a>
    </div>
    <h2 style="margin-top:8px">Your Journey</h2>
    <p class="muted">Four simple steps to shape the future of NParks.</p>
    <div class="grid two">
      <div class="card">${iconBox(JICON.book, '#2563eb', '#dbeafe')}<h3>1 · Learn</h3><p class="muted">Discover how SWP benefits you and your team.</p></div>
      <div class="card">${iconBox(JICON.compass, '#7c3aed', '#ede9fe')}<h3>2 · Explore</h3><p class="muted">Explore ideas from NParks workgroups and share your perspective.</p></div>
      <div class="card">${iconBox(JICON.bulb, '#0d9488', '#ccfbf1')}<h3>3 · Imagine</h3><p class="muted">Share your ideas to improve the future of work at NParks.</p></div>
      <div class="card">${iconBox(JICON.flag, '#d97706', '#fef3c7')}<h3>4 · Pledge</h3><p class="muted">Visit the Future of Work Booth and make your commitment.</p></div>
    </div>
    <p style="text-align:center;margin-top:8px"><a class="btn" href="/learn">Begin Now →</a></p>` }));
});

app.get('/about', (req, res) => {
  getSession(req, res);
  res.send(layout({ title: 'About SWP', active: '/about', body: `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#1E2A44,#16213E);color:#fff">
      <div style="transform:scale(1.6);margin:18px 0 26px">${LOGO}</div>
      <h1 style="color:#fff"><span class="accent">Ctrl • Alt • Del</span></h1>
      <p style="font-size:18px;color:#cbd5e1">Shaping the Future of Work Together</p></div>
    <div class="card">
      <p>The way we work is changing. Technology is advancing rapidly, our operating environment is becoming more complex, expectations continue to evolve, and resources will remain tight.</p>
      <p>To continue delivering our mission, we need to work differently.</p>
      <p>Strategic Workforce Planning (SWP) is how NParks is preparing for the future by redesigning work, building capabilities, improving how we organise ourselves and using technology better, so we can continue delivering our mission.</p>
      <p>Through SWP, officers across NParks are working together to rethink how work is done, identify better ways of working, and build a future-ready workforce where everyone can contribute at their best.</p>
    </div>
    <div class="card"><h2>Why Ctrl • Alt • Del?</h2>
      <p class="muted">The familiar keyboard shortcut inspired our Staff Conference theme—but instead of restarting a computer, we're using it to rethink how work gets done at NParks.</p>
      <div class="grid two" style="margin-top:14px">
        <div class="stat"><div class="n" style="color:#3b82f6">CTRL</div>Decide and focus on what matters most</div>
        <div class="stat"><div class="n" style="color:#ef4444">ALT</div>Redesign how the work is done</div>
        <div class="stat"><div class="n" style="color:#14b8a6">DEL</div>Free up capacity for higher-impact work</div>
      </div></div>
    <div class="card"><h2>SWP in One Minute</h2><ul>
      <li>Redesign how work gets done for better outcomes before redefining roles.</li><li>Bring people, processes and technology together.</li>
      <li>Build future-ready skills and careers.</li><li>Solve real operational challenges with the business.</li>
      <li>Shape the future of NParks together.</li></ul></div>
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff">
      <h2 style="color:#fff">Every officer has a role in shaping the future of work.</h2>
      <p style="color:#e0e7ff">Explore the ideas developed by our workgroups, share your own, and help shape how we work at NParks.</p>
      <a class="btn alt" href="/explore">Explore the Ideas →</a></div>` }));
});

const LICON = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  sprout: '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  messages: '<path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/>',
};
// Home journey-step icons (line style, inline SVG — no external assets)
const JICON = {
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
};
function iconBox(paths, color, tint) {
  return `<span aria-hidden="true" style="display:inline-flex;width:44px;height:44px;border-radius:12px;background:${tint};color:${color};align-items:center;justify-content:center;margin-bottom:12px">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
}

app.get('/learn', async (req, res) => {
  getSession(req, res);
  const cards = [
    ['Spend More Time on What Matters', 'Identify what matters most, review and simplify work, and use better processes, automation and AI to free up time for meaningful, impactful work.', LICON.target, '#0d9488', '#ccfbf1'],
    ['Stay Ahead of Change', 'Build confidence to adapt as work, technology and roles evolve — by learning continuously and using tools, data and AI to work better.', LICON.compass, '#2563eb', '#dbeafe'],
    ['Grow with the Future', 'See future career pathways more clearly, build critical capabilities, and access learning that helps you grow with NParks’ evolving needs.', LICON.sprout, '#16a34a', '#dcfce7'],
    ['Help Shape the Future', 'Your ideas matter. SWP is co-created with officers to develop practical solutions that improve the way we work.', LICON.messages, '#d97706', '#fef3c7'],
  ];
  res.send(layout({ title: 'Learn', active: '/learn', body: stepbar('learn') + `
    <h1>What's In It <span class="accent">For Me?</span></h1>
    <p class="muted">How Strategic Workforce Planning shapes your future at NParks.</p>
    <div class="grid two">${cards.map(([t, d, ic, col, tint]) => `<div class="card">${iconBox(ic, col, tint)}<h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</div>
    <p><a class="btn" href="/explore">Continue to Explore →</a></p>` }));
});

app.get('/explore', async (req, res) => {
  const sid = getSession(req, res);
  const prog = await loadProgress(sid);
  const savedId = req.query.saved;
  const wgHtml = WORKGROUPS.map(wg => {
    const ideas = wg.ideas.map(idea => {
      const cur = prog.reactions[idea.id] || { reaction: '', comment: '' };
      const done = Boolean(prog.reactions[idea.id]);
      const rxHtml = REACTIONS.map(r =>
        `<label class="rx"><input type="radio" name="reaction" value="${r.id}" ${cur.reaction===r.id?'checked':''}> ${r.emoji} ${r.label}</label>`).join('');
      return `<details style="margin:10px 0;border:1px solid #eef2f7;border-radius:12px;padding:6px 14px" ${savedId===idea.id?'open':''}>
        <summary style="cursor:pointer;font-weight:700;padding:8px 0">${done?'✓ ':''}${esc(idea.label)}</summary>
        <form method="post" action="/explore" style="padding:6px 0 12px">
          <input type="hidden" name="ideaId" value="${idea.id}">
          <p class="muted" style="white-space:pre-line">${esc(idea.description)}</p>
          <p style="font-weight:700;margin:12px 0 4px">What do you think about this idea?</p>
          <div>${rxHtml}</div>
          <p style="font-weight:700;margin:14px 0 2px">How would you Ctrl. Alt. Delete. this idea?</p>
          <p class="muted" style="font-size:13px;margin:0">Share how you would improve, rethink or reset this idea for the future of work.</p>
          <textarea name="comment" maxlength="300" rows="3" placeholder="For example, what would you keep (Ctrl), improve (Alt), or stop doing (Delete)?">${esc(cur.comment)}</textarea>
          <p style="margin-top:10px"><button class="btn" type="submit">Save My Thoughts</button>
          ${savedId===idea.id?'<span class="saved" style="margin-left:10px">✓ Saved!</span>':''}</p>
        </form></details>`;
    }).join('');
    const wgc = prog.contributions[wg.id] || '';
    return `<div class="card"><h2 style="color:${wg.color}">${esc(wg.title)}</h2>
      <p class="muted" style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Ideas from this workgroup — tap to open</p>
      ${ideas}
      <form method="post" action="/explore-contribution" style="margin-top:16px;border-top:1px solid #eef2f7;padding-top:14px">
        <input type="hidden" name="workgroupId" value="${wg.id}">
        <label>How would you Ctrl. Alt. Delete. the way this workgroup works?</label>
        <p class="muted" style="font-size:13px;margin:2px 0">Share one suggestion for this workgroup</p>
        <textarea name="contribution" maxlength="300" rows="3" placeholder="Share your thoughts here...">${esc(wgc)}</textarea>
        <p style="margin-top:10px"><button class="btn" type="submit">Save contribution</button>
        ${savedId===('wg-'+wg.id)?'<span class="saved" style="margin-left:10px">✓ Saved!</span>':''}</p>
      </form></div>`;
  }).join('');
  const done = (Object.keys(prog.reactions).length || Object.keys(prog.contributions).length) ? ['learn'] : ['learn'];
  res.send(layout({ title: 'Explore', active: '/learn', body: stepbar('explore', done) + `
    <h1>Explore the <span class="accent">Ideas</span></h1>
    <p class="muted">These are early-stage ideas being explored by different NParks workgroups — starting points for discussion, not final decisions. Open any idea to learn more and share your perspective.</p>
    ${wgHtml}
    <p><a class="btn" href="/imagine">Continue to Imagine →</a></p>` }));
});

app.post('/explore', async (req, res) => {
  const sid = getSession(req, res);
  const { ideaId, reaction, comment } = req.body;
  const idea = IDEA_BY_ID[ideaId];
  if (pool && idea) {
    await pool.query(
      `insert into explore_reactions (session_id, workgroup_id, idea_id, idea_label, reaction, comment, updated_at)
       values ($1,$2,$3,$4,$5,$6,now())
       on conflict (session_id, idea_id) do update set reaction=excluded.reaction, comment=excluded.comment, updated_at=now()`,
      [sid, idea.workgroupId, ideaId, idea.label, reaction || null, (comment || '').slice(0,300) || null]);
  }
  res.redirect('/explore?saved=' + encodeURIComponent(ideaId) + '#' );
});

app.post('/explore-contribution', async (req, res) => {
  const sid = getSession(req, res);
  const { workgroupId, contribution } = req.body;
  const wg = WORKGROUPS.find(w => w.id === workgroupId);
  if (pool && wg && (contribution || '').trim()) {
    await pool.query(
      `insert into workgroup_contributions (session_id, workgroup_id, workgroup_title, contribution, updated_at)
       values ($1,$2,$3,$4,now())
       on conflict (session_id, workgroup_id) do update set contribution=excluded.contribution, updated_at=now()`,
      [sid, workgroupId, wg.title, contribution.slice(0,300)]);
  }
  res.redirect('/explore?saved=wg-' + encodeURIComponent(workgroupId));
});

app.get('/imagine', async (req, res) => {
  const sid = getSession(req, res);
  let myCount = 0;
  if (pool) {
    const c = await pool.query('select count(*)::int n from idea_submissions where session_id=$1', [sid]);
    myCount = c.rows[0].n;
  }
  const submitted = req.query.submitted === '1';
  // Blank form every time — each submission adds a new idea.
  const opts = CATEGORIES.map(c => `<label class="rx"><input type="radio" name="category" value="${esc(c)}"> ${esc(c)}</label>`).join('');
  const banner = submitted
    ? `<div class="card" style="background:#dcfce7;border-color:#bbf7d0"><b class="saved">✓ Idea submitted!</b> Add another idea below, or continue to your pledge.</div>` : '';
  const countLine = myCount > 0
    ? `<p class="muted">You've shared <b>${myCount}</b> idea${myCount===1?'':'s'} so far. You can submit as many as you like.</p>` : '';
  res.send(layout({ title: 'Imagine', active: '/learn', body: stepbar('imagine', ['learn','explore']) + `
    <h1><span class="accent">Imagine</span></h1>
    <p class="muted">If you could improve one thing about the future of work at NParks, what would it be?</p>
    ${banner}${countLine}
    <div class="card"><form method="post" action="/imagine">
      <label>Choose a category</label><div style="margin:6px 0 14px">${opts}</div>
      <label>Your idea</label>
      <textarea name="ideaText" rows="5" maxlength="500" required placeholder="What would you improve, rethink, or reset about the future of work at NParks?"></textarea>
      <p style="margin-top:14px"><button class="btn" type="submit">Submit My Idea →</button></p>
    </form></div>
    <p style="text-align:center"><a class="btn alt" href="/pledge">Continue to Pledge →</a></p>` }));
});

app.post('/imagine', async (req, res) => {
  const sid = getSession(req, res);
  const { ideaText, category } = req.body;
  if (pool && (ideaText || '').trim()) {
    // Plain insert — a user can submit multiple ideas, each a separate row.
    await pool.query(
      `insert into idea_submissions (session_id, idea_text, category) values ($1,$2,$3)`,
      [sid, ideaText.slice(0,500), category || null]);
  }
  res.redirect('/imagine?submitted=1');
});

app.get('/pledge', async (req, res) => {
  const sid = getSession(req, res);
  const prog = await loadProgress(sid);
  if (prog.hasPledge) return res.redirect('/congrats');
  res.send(layout({ title: 'Pledge', active: '/learn', body: stepbar('pledge', ['learn','explore','imagine']) + `
    <h1 style="text-align:center">One Last Step…</h1>
    <p class="muted" style="text-align:center;font-size:18px">Head over to the <b>Future of Work Booth</b> and take a photo of your pledge.</p>
    <div class="card"><h3>How to make your pledge</h3><ol>
      <li>📍 Find the Future of Work Booth at the conference venue.</li>
      <li>✍️ Write your personal pledge for the future of work at NParks on the pledge card provided.</li>
      <li>📸 Take a photo of yourself holding your pledge card at the booth.</li>
      <li>✅ Come back here and click the button below once you've made your pledge.</li>
    </ol></div>
    <form method="post" action="/pledge" style="text-align:center"><button class="btn" type="submit">📸 I've made my pledge</button></form>` }));
});

app.post('/pledge', async (req, res) => {
  const sid = getSession(req, res);
  if (pool) await pool.query(
    `insert into pledges (session_id, updated_at) values ($1,now()) on conflict (session_id) do update set updated_at=now()`, [sid]);
  res.redirect('/congrats');
});

app.get('/congrats', (req, res) => {
  getSession(req, res);
  res.send(layout({ title: 'Congratulations', active: '/learn', body: `
    <div class="card" style="text-align:center">
      <div style="font-size:64px">🏆</div>
      <span class="pill" style="background:#dcfce7;color:#16a34a">✓ Journey Complete</span>
      <h1>Congratulations! 🎉</h1>
      <p style="font-size:18px">You've completed the Future of Work Journey.</p>
      <p class="muted">By sharing your views and ideas, you've made a real contribution to shaping the future of work in NParks. Every voice matters — and yours has been heard.</p>
      <div class="card" style="background:linear-gradient(135deg,#fef9c3,#fed7aa);text-align:center">
        <h3>🎁 Claim Your Freebie!</h3>
        <p>Head back to the <b>Future of Work Booth</b> and show this screen to claim your complimentary gift.</p>
        <p style="color:#ea580c;font-weight:700">While stocks last — don't miss out!</p></div>
      <p><a class="btn" href="/pulse">View Live Pulse</a> <a class="btn alt" href="/">Back to Home</a></p></div>` }));
});

const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','that','this','these','those','i','we','you','they','it','my','our','your','their','its','more','can','how','what','when','where','who','also','just','very','so','if','as','up','out','not','all','about','into','than','then','there','which','after','before','between']);
const RX_EMOJI = { love:'❤️', useful:'👍', 'needs-thought':'🤔', interesting:'💡' };

app.get('/pulse', async (req, res) => {
  getSession(req, res);
  let ideas = 0, pledges = 0, visitors = 0, allIdeas = [], reactions = [];
  if (pool) {
    const [i, p, t, a, r] = await Promise.all([
      pool.query('select count(*)::int n from idea_submissions'),
      pool.query('select count(*)::int n from pledges'),
      pool.query('select count(*)::int n from visitors'),
      pool.query('select idea_text, category, created_at from idea_submissions order by created_at desc'),
      pool.query('select reaction from explore_reactions'),
    ]);
    ideas = i.rows[0].n; pledges = p.rows[0].n; visitors = t.rows[0].n; allIdeas = a.rows; reactions = r.rows;
  }
  const freq = {};
  allIdeas.forEach(r => (r.idea_text||'').toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w)).forEach(w=>freq[w]=(freq[w]||0)+1));
  const words = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,24);
  const maxw = words[0]?.[1] || 1;
  const cat = {}; allIdeas.forEach(r=>{const c=r.category||'Uncategorised';cat[c]=(cat[c]||0)+1;});
  const rx = {}; reactions.forEach(r=>{if(r.reaction)rx[r.reaction]=(rx[r.reaction]||0)+1;});
  const reactionsCount = reactions.filter(r=>r.reaction).length;
  const colors = ['#3b82f6','#8b5cf6','#14b8a6','#f59418','#ef4444','#22c55e'];
  res.send(layout({ title: 'Pulse', active: '/pulse', body: `
    <div class="pill" style="background:#dcfce7;color:#16a34a">● LIVE — refresh this page to update</div>
    <h1>Future of Work <span class="accent">Pulse</span></h1>
    <p class="muted">Live insights from NParks Staff Conference 2026 participants.</p>
    <div class="grid two" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="n">${visitors}</div>Visitors</div>
      <div class="stat"><div class="n">${reactionsCount}</div>Reactions Shared</div>
      <div class="stat"><div class="n">${ideas}</div>Ideas Shared</div>
      <div class="stat"><div class="n">${pledges}</div>Pledges Made</div></div>
    <div class="card"><h2>Idea Word Cloud</h2>${words.length?words.map(([w,c],i)=>`<span class="word" style="font-size:${13+Math.round(c/maxw*22)}px;color:${colors[i%colors.length]}">${esc(w)}</span>`).join(''):'<p class="muted">Word cloud will appear once ideas are submitted.</p>'}</div>
    <div class="card"><h2>Reactions to Ideas</h2>${Object.keys(rx).length?Object.entries(rx).sort((a,b)=>b[1]-a[1]).map(([k,c])=>`<span class="pill">${RX_EMOJI[k]||'💬'} ${c} ${esc(k)}</span>`).join(''):'<p class="muted">No reactions yet.</p>'}</div>
    <div class="card"><h2>Ideas by Category</h2>${Object.keys(cat).length?Object.entries(cat).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<div style="margin:6px 0"><b>${esc(c)}</b> — ${n}</div>`).join(''):'<p class="muted">No ideas yet.</p>'}</div>
    <div class="card"><h2>Recent Ideas</h2>${allIdeas.length?allIdeas.slice(0,6).map(r=>`<div style="padding:8px 0;border-bottom:1px solid #eef2f7">"${esc(r.idea_text)}"${r.category?` <span class="pill">${esc(r.category)}</span>`:''}</div>`).join(''):'<p class="muted">No ideas submitted yet — be the first!</p>'}</div>` }));
});

// ─── Start ────────────────────────────────────────────────────────────────────
ensureSchema().catch(e => console.error('[server] schema init failed:', e.message))
  .finally(() => app.listen(PORT, () => console.log(`[server] listening on :${PORT}`)));
