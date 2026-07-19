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

// ─── Schema ───────────────────────────────────────────────────────────────────
async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create extension if not exists pgcrypto;
    create table if not exists idea_submissions (
      id uuid primary key default gen_random_uuid(), created_at timestamptz default now(),
      updated_at timestamptz default now(), session_id text unique not null, idea_text text, category text);
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
  `);
  console.log('[server] schema ready');
}

// ─── Content ──────────────────────────────────────────────────────────────────
const WORKGROUPS = [
  { id: 'urban-greenery', color: '#14B8A6', title: 'Urban Greenery and Parks Management', ideas: [
    { id: 'ugpm_operator_to_orchestrator', label: 'From Operator to Orchestrator', description: `NParks will work more deliberately with industry, IHLs and community partners on clearly defined areas where they can contribute more effectively, redesigning how we partner so that their interests are genuinely aligned with the outcomes we want. NParks will continue to lead strategically, set standards and remain accountable for outcomes, public safety and public trust.` },
    { id: 'ugpm_neighbourhood_stewards', label: 'Empowering Communities as Neighbourhood Stewards', description: `NParks will explore how community groups can take on more meaningful stewardship of their neighbourhood green spaces, including real decision-making roles in how spaces are used and cared for. This will be tested through pilots like Bishan-Ang Mo Kio Park, with NParks remaining accountable for public safety and maintenance standards.` },
    { id: 'ugpm_organising_teams', label: 'Organising Teams Around the Work', description: `Some work is best done by area-based teams who know their patch deeply. Other work - like policy, standards and systems - is best done by project-based teams that cut across the organisation. The idea is to have both, so that each have the right people and the right focus. NParks will test these models through pilots or paper exercises before considering broader structural changes.` },
    { id: 'ugpm_specialist_expertise', label: 'Deepening Specialist Expertise', description: `Greater complexity in our work calls for greater depth in our people.\n\nNParks will clarify future competencies and career pathways so that officers can deepen expertise in areas such as arboriculture, horticulture, plant health, ecology and operations technology, building specialist depth alongside generalist breadth.` },
  ]},
  { id: 'animal-health', color: '#8B5CF6', title: 'Animal Health and Management', ideas: [
    { id: 'ahm_data_decisions', label: 'Strengthening Data for Better Decisions', description: `NParks will start by conducting a data audit and identifying 2 to 3 priority use cases where better-integrated data can improve day-to-day decisions. This will also inform how cross-functional teams—bringing together domain officers, data analysts, engagement staff and IT support—can work together more effectively on biosurveillance priorities.` },
    { id: 'ahm_ai_disease_detection', label: 'Use AI to Detect Disease Threats Earlier', description: `Build an AI-enabled early warning system that monitors multiple data streams (outbreak databases, environmental signals, animal movement patterns) and generates risk alerts before threats escalate. We can start with 2 to 3 priority disease scenarios as proof of concept, then expand to a broader predictive biosurveillance system over time. This will include building staff capability to work effectively with AI tools and interpret outputs.` },
    { id: 'ahm_data_ai_specialists', label: 'Develop Animal Health Specialists with Data and AI Skills', description: `The future animal health officer is not just trained in biosecurity and risk assessment - they are also equipped to work with data, use AI tools and communicate findings to the public. The proposal is to build these horizontal capabilities into the specialist role, so officers can act on intelligence directly rather than waiting for IT or data teams to interpret it for them.` },
    { id: 'ahm_high_value_work', label: 'Freeing Specialists to Focus on High-Value Work', description: `Specialists are currently spending significant time on procurement, IT, HR and finance tasks that take them away from core scientific and operational work. NParks will review which of these tasks can be automated, reassigned or shared with dedicated support functions—including understanding how functions like inspections and permit processing will continue to be handled—so specialists can focus on high-value work.` },
  ]},
  { id: 'wildlife-forensics', color: '#F59418', title: 'Wildlife Management and Forensics', ideas: [
    { id: 'wmf_conservation_outcomes', label: 'Strengthening Conservation Outcomes', description: `The shift reflects a stronger focus on conservation outcomes while continuing to manage public safety, feedback and operational realities. This includes strengthening ecological literacy and public coexistence through schools, communities and public education partners, and exploring how land owners can play a clearer role in mitigating wildlife-related issues on their premises. This reframing will be supported by practical changes to roles, processes and ways of working.` },
    { id: 'wmf_proactive_wildlife_management', label: 'Using Data and Research for Proactive Wildlife Management', description: `NParks will use data, dashboards and long-term population research to support proactive, evidence-based wildlife management. This includes better triaging of cases so that officers can focus on complex, high-judgement situations while routine cases are supported by trained partners under NParks' guidance.` },
    { id: 'wmf_wildlife_veterinary_capability', label: 'Exploring a Stronger Wildlife Veterinary Capability', description: `NParks will study the feasibility of strengthening CWR's specialist wildlife veterinary capability, including the manpower, funding, training, research and public trust benefits required to support a stronger long-term model for wildlife care.` },
    { id: 'wmf_regional_wildlife_forensics', label: 'Building Singapore as a Trusted Regional Partner for Wildlife Forensics', description: `The long-term ambition is for Singapore to be a trusted regional partner for wildlife forensics, intelligence-sharing and scientific collaboration. NParks will work with IHL partners, regional counterparts and international networks to strengthen capability, share research direction and build the partnerships that underpin Singapore's role as a trade and travel hub committed to tackling wildlife trafficking.` },
    { id: 'wmf_intelligence_led_enforcement', label: 'Moving Toward Intelligence-Led Enforcement', description: `NParks will scope AI-enabled horizon scanning use cases to understand emerging wildlife trade signals, high-risk routes and trafficking networks. This will be supported by digitising the chain of custody end-to-end, and building a well-curated reference database and sample archive so that test development and species identification can be done faster and with greater confidence. This includes clarifying how NParks connects to transboundary crime intelligence networks and regional enforcement partners.` },
    { id: 'wmf_science_technology_bridges', label: 'Develop Staff as Operational Bridges Between Science and Technology', description: `As AI and digital tools become central to forensic work, the role of the wildlife trade specialist evolves - from manual monitoring and report-reading to validating AI outputs, contextualising data for criminal intelligence and translating insights into policy. Building this capability requires deliberate investment in how staff understand and work with technology, not just technical training.` },
  ]},
];
const IDEA_BY_ID = Object.fromEntries(WORKGROUPS.flatMap(w => w.ideas.map(i => [i.id, { ...i, workgroupId: w.id, workgroupTitle: w.title }])));
const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love it' },
  { id: 'useful', emoji: '👍', label: 'Useful' },
  { id: 'needs-thought', emoji: '🤔', label: 'Needs more thought' },
  { id: 'interesting', emoji: '💡', label: 'Interesting' },
];
const CATEGORIES = ['Skills', 'Technology', 'Ways of Working', 'Workplace Culture'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function getSession(req, res) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/swp_session=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const id = crypto.randomUUID();
  res.setHeader('Set-Cookie', `swp_session=${id}; Path=/; Max-Age=2592000; SameSite=Lax`);
  return id;
}

const LOGO = `<span style="display:inline-flex;gap:3px;vertical-align:middle">
  <span style="background:#A7D3F3;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">C</span>
  <span style="background:#F0726E;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">A</span>
  <span style="background:#B7DE8F;color:#1E2A44;font-weight:800;border-radius:5px;padding:2px 6px;font-size:13px">D</span>
</span>`;

const STEPS = [ ['learn','Learn'], ['explore','Explore'], ['imagine','Imagine'], ['pledge','Pledge'] ];

function layout({ title, body, active = '' }) {
  const nav = [['/', 'Home'], ['/learn', 'Journey'], ['/pulse', 'Pulse'], ['/about', 'About SWP']]
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
    <div class="card"><h2>Your Journey</h2><div class="grid two">
      <div><h3>1 · Learn</h3><p class="muted">Discover how SWP benefits you and your team.</p></div>
      <div><h3>2 · Explore</h3><p class="muted">Explore ideas from NParks workgroups and share your perspective.</p></div>
      <div><h3>3 · Imagine</h3><p class="muted">Share one idea to improve the future of work at NParks.</p></div>
      <div><h3>4 · Pledge</h3><p class="muted">Visit the Future of Work Booth and make your commitment.</p></div>
    </div><p style="margin-top:18px"><a class="btn" href="/learn">Begin Now →</a></p></div>` }));
});

app.get('/about', (req, res) => {
  getSession(req, res);
  res.send(layout({ title: 'About SWP', active: '/about', body: `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#1E2A44,#16213E);color:#fff">
      <div style="transform:scale(1.6);margin:18px 0 26px">${LOGO}</div>
      <h1 style="color:#fff"><span class="accent">Ctrl • Alt • Del</span></h1>
      <p style="font-size:18px;color:#cbd5e1">Shaping the Future of Work Together</p></div>
    <div class="card">
      <p>The way we work is changing. Technology is advancing rapidly, our operating environment is becoming more complex, expectations continue to evolve, and manpower will remain tight.</p>
      <p>To continue delivering our mission, we need to work differently—not simply work harder.</p>
      <p>Strategic Workforce Planning (SWP) is how NParks is preparing for this future—not by simply adding more people, but by redesigning work, strengthening capabilities and making better use of technology so we can continue delivering our mission.</p>
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
      <li>Redesign work before redesigning jobs.</li><li>Bring people, processes and technology together.</li>
      <li>Build future-ready skills and careers.</li><li>Solve real operational challenges with the business.</li>
      <li>Shape the future of NParks together.</li></ul></div>
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff">
      <h2 style="color:#fff">Every officer has a role in shaping the future of work.</h2>
      <p style="color:#e0e7ff">Explore the ideas developed by our workgroups, share your own, and help shape how we work at NParks.</p>
      <a class="btn alt" href="/explore">Explore the Ideas →</a></div>` }));
});

app.get('/learn', async (req, res) => {
  getSession(req, res);
  const cards = [
    ['Grow with the Future', 'Discover future career opportunities, build critical capabilities and access learning aligned to NParks\' future needs.'],
    ['Stay Ahead of Change', 'Build confidence to adapt to AI, technology and changing job requirements through continuous learning.'],
    ['Spend More Time on What Matters', 'Simplify work through better processes, automation and AI so you can focus on meaningful, impactful work.'],
    ['Help Shape the Future', 'Your ideas matter. SWP is co-created with officers to develop practical solutions that improve the way we work.'],
  ];
  res.send(layout({ title: 'Learn', active: '/learn', body: stepbar('learn') + `
    <h1>What's In It <span class="accent">For Me?</span></h1>
    <p class="muted">How Strategic Workforce Planning shapes your future at NParks.</p>
    <div class="grid two">${cards.map(([t, d]) => `<div class="card"><h3>${t}</h3><p class="muted">${d}</p></div>`).join('')}</div>
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
        <p class="muted" style="font-size:13px;margin:2px 0">Share one suggestion that could help this workgroup prepare for the future.</p>
        <textarea name="contribution" maxlength="300" rows="3" placeholder="Share your thoughts here...">${esc(wgc)}</textarea>
        <p style="margin-top:10px"><button class="btn" type="submit">Save contribution</button>
        ${savedId===('wg-'+wg.id)?'<span class="saved" style="margin-left:10px">✓ Saved!</span>':''}</p>
      </form></div>`;
  }).join('');
  const done = (Object.keys(prog.reactions).length || Object.keys(prog.contributions).length) ? ['learn'] : ['learn'];
  res.send(layout({ title: 'Explore', active: '/learn', body: stepbar('explore', done) + `
    <h1>Explore the <span class="accent">Ideas</span></h1>
    <p class="muted">Explore ideas developed by different NParks workgroups. Open any idea to learn more and share your perspective.</p>
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
  const prog = await loadProgress(sid);
  const cur = prog.idea || { idea_text: '', category: '' };
  const opts = CATEGORIES.map(c => `<label class="rx"><input type="radio" name="category" value="${c}" ${cur.category===c?'checked':''}> ${c}</label>`).join('');
  res.send(layout({ title: 'Imagine', active: '/learn', body: stepbar('imagine', ['learn','explore']) + `
    <h1><span class="accent">Imagine</span></h1>
    <p class="muted">If you could improve one thing about the future of work at NParks, what would it be?</p>
    <div class="card"><form method="post" action="/imagine">
      <label>Choose a category</label><div style="margin:6px 0 14px">${opts}</div>
      <label>Your idea</label>
      <textarea name="ideaText" rows="5" maxlength="500" required placeholder="What would you improve, rethink, or reset about the future of work at NParks?">${esc(cur.idea_text)}</textarea>
      <p style="margin-top:14px"><button class="btn" type="submit">Submit My Idea →</button></p>
    </form></div>` }));
});

app.post('/imagine', async (req, res) => {
  const sid = getSession(req, res);
  const { ideaText, category } = req.body;
  if (pool && (ideaText || '').trim()) {
    await pool.query(
      `insert into idea_submissions (session_id, idea_text, category, updated_at) values ($1,$2,$3,now())
       on conflict (session_id) do update set idea_text=excluded.idea_text, category=excluded.category, updated_at=now()`,
      [sid, ideaText.slice(0,500), category || null]);
  }
  res.redirect('/pledge');
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
      pool.query("select distinct session_id from idea_submissions where created_at>=date_trunc('day',now())"),
      pool.query('select idea_text, category, created_at from idea_submissions order by created_at desc'),
      pool.query('select reaction from explore_reactions'),
    ]);
    ideas = i.rows[0].n; pledges = p.rows[0].n; visitors = t.rows.length; allIdeas = a.rows; reactions = r.rows;
  }
  const freq = {};
  allIdeas.forEach(r => (r.idea_text||'').toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w)).forEach(w=>freq[w]=(freq[w]||0)+1));
  const words = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,24);
  const maxw = words[0]?.[1] || 1;
  const cat = {}; allIdeas.forEach(r=>{const c=r.category||'Uncategorised';cat[c]=(cat[c]||0)+1;});
  const rx = {}; reactions.forEach(r=>{if(r.reaction)rx[r.reaction]=(rx[r.reaction]||0)+1;});
  const colors = ['#3b82f6','#8b5cf6','#14b8a6','#f59418','#ef4444','#22c55e'];
  res.send(layout({ title: 'Pulse', active: '/pulse', body: `
    <div class="pill" style="background:#dcfce7;color:#16a34a">● LIVE — refresh this page to update</div>
    <h1>Future of Work <span class="accent">Pulse</span></h1>
    <p class="muted">Live insights from NParks Staff Conference 2026 participants.</p>
    <div class="grid two" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="n">${visitors}</div>Visitors Today</div>
      <div class="stat"><div class="n">${pledges}</div>Journeys Completed</div>
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
