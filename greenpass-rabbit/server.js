// ─────────────────────────────────────────────────────────────────────────────
// GreenPass — single-file, server-rendered edition (for Rabbit Deploy)
//
// This is the whole app in ONE Node/Express file — no build step, no separate
// front-end bundle. Every page is rendered as HTML on the server; forms submit
// normally (page reload), so it works even in locked-down browsers. A little
// inline JavaScript adds nice-to-haves (photo preview, word counter, copy
// button) but nothing depends on it.
//
// Data — including profile photos (stored as bytea) — lives in the PostgreSQL
// database read from process.env.DATABASE_URL, which Rabbit Deploy sets
// automatically when you create/attach a database. Uploaded photos are NOT
// written to disk, so redeploys never lose anything.
//
// Deploy on Rabbit: upload this file plus package.json. Set these service env
// vars: ANTHROPIC_API_KEY (Claude moderation), ADMIN_PASSWORD (HR login),
// and optionally SEED_DEMO=1 to load three example submissions on first boot.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import multer from 'multer';
import pg from 'pg';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = express();
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || 'nparks-admin').trim();
const DATABASE_URL = process.env.DATABASE_URL;
const useSsl = process.env.PGSSL !== 'disable';
const pool = DATABASE_URL
  ? new pg.Pool({ connectionString: DATABASE_URL, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 5 })
  : null;

if (!pool) console.warn('[server] DATABASE_URL not set — data will not persist.');

// ── Colour palette (green & nature theme) ────────────────────────────────────
const C = { green: '#2D6A4F', greenDark: '#1B4332', sage: '#95D5B2', sageLight: '#E8F5E9', cream: '#F8F4E3', earth: '#6B4226' };

// ── Helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hasAdmin = (req) => {
  const m = /(?:^|;\s*)gp_admin=([^;]+)/.exec(req.headers.cookie || '');
  return m && decodeURIComponent(m[1]) === ADMIN_PASSWORD;
};

// ── Schema ─────────────────────────────────────────────────────────────────
async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create extension if not exists pgcrypto;
    create table if not exists submissions (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      full_name text not null, email text, start_date text, intro text not null,
      fun_fact text, status text not null default 'awaiting-hr-review',
      job_title text, division text,
      ai_status text, ai_confidence int, ai_reason text,
      photo_status text, photo_reason text, photo_mime text, photo_data bytea
    );
    create table if not exists edm_archive (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      occasion text not null, send_date text,
      hire_names jsonb not null, html text not null
    );
    -- Migrations so databases created by an earlier version of this app pick up
    -- new columns / relaxed constraints.
    alter table submissions alter column start_date drop not null;
    alter table submissions add column if not exists email text;
  `);
}

// ── AI content moderation (Claude) ───────────────────────────────────────────
const MODERATION_SYSTEM_PROMPT =
  "You are a content moderation assistant for NParks, a Singapore government agency. " +
  "Review the following new hire introduction text and check for: (1) inappropriate, " +
  "offensive, or unprofessional language, (2) personally sensitive information that " +
  "should not be shared in a mass email (e.g. medical conditions, home addresses, " +
  "personal phone numbers), (3) content that is off-topic or irrelevant to a " +
  "professional self-introduction. Return a JSON object with three fields: `status` " +
  "(one of: 'clear', 'review', 'flagged'), `confidence` (a number from 0-100), and " +
  "`reason` (a one-sentence plain-English explanation of your decision). Be lenient " +
  "— flag only genuine concerns, not minor stylistic issues.";

async function moderateText(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { status: 'review', confidence: 0, reason: 'AI moderation is unavailable (no ANTHROPIC_API_KEY configured) — please review this introduction manually.' };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-3-5-haiku-20241022', max_tokens: 300, system: MODERATION_SYSTEM_PROMPT, messages: [{ role: 'user', content: text }] }),
    });
    if (!res.ok) throw new Error(`Claude API returned ${res.status}`);
    const data = await res.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const status = ['clear', 'review', 'flagged'].includes(parsed.status) ? parsed.status : 'review';
    return { status, confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)), reason: String(parsed.reason || 'No explanation provided.') };
  } catch (err) {
    console.warn('[moderation] fallback:', err.message);
    return { status: 'review', confidence: 0, reason: 'AI moderation could not be completed automatically — please review this introduction manually.' };
  }
}

// ── Photo dimension check (PNG + JPEG, no dependencies) ───────────────────────
function readImageDimensions(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let o = 2;
    while (o < buffer.length) {
      if (buffer[o] !== 0xff) { o++; continue; }
      const marker = buffer[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buffer.readUInt16BE(o + 5), width: buffer.readUInt16BE(o + 7) };
      o += 2 + buffer.readUInt16BE(o + 2);
    }
  }
  return null;
}
function checkPhoto(buffer) {
  try {
    if (buffer.length > 5 * 1024 * 1024) return { status: 'manual-review', reason: 'Photo exceeds the 5MB limit — please verify.' };
    const dim = readImageDimensions(buffer);
    if (!dim) return { status: 'manual-review', reason: 'Could not read image dimensions — please visually verify the photo before approving.' };
    if (dim.width < 100 || dim.height < 100) return { status: 'manual-review', reason: `Photo is only ${dim.width}x${dim.height}px (below 100x100) — please verify quality.` };
    return { status: 'manual-review', reason: `Photo is a valid ${dim.width}x${dim.height}px image. Please visually verify it is appropriate before approving.` };
  } catch { return { status: 'manual-review', reason: 'Photo could not be inspected — please visually verify before approving.' }; }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (['image/jpeg', 'image/png'].includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG and PNG images are accepted.'))),
});

// ── Page layout (inline CSS theme + botanical motif) ─────────────────────────
function layout({ title, body, adminNav = false }) {
  const leaf = `<svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true"><path d="M56 8C24 8 8 26 8 52c0 2 1 4 4 4 26 0 44-16 44-48z" fill="${C.sage}"/><path d="M14 50C26 38 40 24 52 12" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  const nav = adminNav
    ? `<nav class="nav"><a href="/admin">Review</a><a href="/admin/edm">Generate eDM</a><a href="/admin/archive">Archive</a><a href="/admin/logout">Log out</a></nav>`
    : `<nav class="nav"><a href="/">Home</a><a href="/submit">New joiner</a><a href="/admin">HR admin</a></nav>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · GreenPass</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%232D6A4F'/%3E%3Cpath d='M50 12C24 12 12 26 12 48c0 2 1 3 3 3 22 0 36-13 36-39z' fill='%2395D5B2'/%3E%3C/svg%3E">
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:'Nunito','Lato',system-ui,Segoe UI,Roboto,sans-serif;color:${C.greenDark};background:${C.cream};
    background-image:radial-gradient(circle at 12% 12%,rgba(149,213,178,.25) 0,transparent 30%),radial-gradient(circle at 88% 6%,rgba(45,106,79,.08) 0,transparent 32%),radial-gradient(circle at 80% 88%,rgba(149,213,178,.18) 0,transparent 34%);min-height:100vh}
  a{color:${C.green}}
  header.hero{position:relative;overflow:hidden;background:${C.green};color:${C.cream};padding:28px 20px 0}
  header.hero .inner{max-width:960px;margin:0 auto}
  header.hero .brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;font-size:12px;color:${C.sage}}
  header.hero h1{margin:10px 0 4px;font-size:30px}
  header.hero p{margin:0 0 20px;color:#d8f3dc;max-width:620px}
  header.hero .foliage{display:block;width:100%;height:26px;color:${C.cream}}
  .nav{max-width:960px;margin:14px auto 0;display:flex;flex-wrap:wrap;gap:14px}
  .nav a{color:#eafff2;text-decoration:none;font-weight:700;font-size:14px;opacity:.9}
  .nav a:hover{opacity:1;text-decoration:underline}
  main{max-width:960px;margin:0 auto;padding:26px 20px 60px}
  .card{background:#fff;border:1px solid rgba(149,213,178,.6);border-radius:18px;box-shadow:0 6px 22px -8px rgba(45,106,79,.25);padding:22px;margin-bottom:20px}
  label{display:block;font-weight:700;color:${C.green};margin:0 0 6px;font-size:14px}
  input[type=text],input[type=date],input[type=password],textarea,select{width:100%;padding:11px 13px;border:1px solid ${C.sage};border-radius:12px;font:inherit;color:${C.greenDark};background:#fff}
  textarea{min-height:130px;resize:vertical}
  .field{margin-bottom:18px}
  .req{color:#c1121f}
  .btn{display:inline-block;border:0;border-radius:12px;padding:11px 18px;font:inherit;font-weight:800;cursor:pointer;background:${C.green};color:${C.cream};text-decoration:none}
  .btn:hover{background:${C.greenDark}}
  .btn.sec{background:#fff;color:${C.green};border:1px solid rgba(45,106,79,.35)}
  .btn.danger{background:#fff;color:#b02a2a;border:1px solid #e6b3b3}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .grid{display:grid;gap:18px}
  @media(min-width:720px){.grid.two{grid-template-columns:1fr 1fr}}
  .muted{color:rgba(27,67,50,.6);font-size:13px}
  .tag{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
  .tag.hr{background:${C.earth};color:${C.cream}}
  .tag.clear{background:${C.sageLight};color:${C.greenDark};border:1px solid rgba(45,106,79,.25)}
  .tag.review{background:#fff4d6;color:#8a6d1a;border:1px solid #e7cf86}
  .tag.flagged{background:#fbe0e0;color:#a02020;border:1px solid #eab3b3}
  .avatar{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid ${C.sage};background:${C.sageLight}}
  .thumb{width:100px;height:auto;border-radius:8px;border:2px solid ${C.sage};background:${C.sageLight};display:block}
  .banner{display:flex;gap:10px;align-items:flex-start;background:#fff8e1;border:1px solid #ecd58a;border-radius:14px;padding:12px 14px;color:#7a5c12;font-size:14px;margin-bottom:20px}
  .section-h{display:flex;align-items:center;gap:10px;margin:26px 0 10px}
  .section-h h2{margin:0;color:${C.green};font-size:22px}
  .count{background:${C.sageLight};color:${C.green};font-weight:800;border-radius:999px;padding:2px 10px;font-size:14px}
  .modbox{background:rgba(248,244,227,.6);border:1px solid rgba(149,213,178,.6);border-radius:12px;padding:11px;margin:12px 0}
  .hrbox{background:rgba(232,245,233,.55);border:1px solid rgba(45,106,79,.18);border-radius:12px;padding:12px;margin:12px 0}
  .err{background:#fbe0e0;border:1px solid #eab3b3;color:#a02020;border-radius:12px;padding:11px 14px;font-weight:700;margin-bottom:16px}
  .actions{display:flex;flex-wrap:wrap;gap:8px;border-top:1px solid rgba(149,213,178,.5);padding-top:14px;margin-top:6px}
  footer{text-align:center;color:rgba(27,67,50,.5);font-size:13px;padding:0 0 40px}
  iframe.preview{width:100%;height:520px;border:1px solid ${C.sage};border-radius:12px;background:#fff}
  .row{display:flex;gap:14px;align-items:flex-start}
  details summary{cursor:pointer;font-weight:800;color:${C.green};margin-top:8px}
</style></head><body>
<header class="hero"><div class="inner"><div class="brand">${leaf}<span>National Parks Board · Singapore</span></div>
<h1>${esc(title)}</h1>${adminNav ? '' : ''}${nav}</div>
<svg class="foliage" viewBox="0 0 1200 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 V22 Q60 6 120 22 Q180 4 240 22 Q300 8 360 22 Q420 3 480 22 Q540 9 600 22 Q660 4 720 22 Q780 8 840 22 Q900 5 960 22 Q1020 9 1080 22 Q1140 6 1200 22 V40 Z" fill="currentColor"/></svg>
</header>
<main>${body}</main>
<footer>GreenPass · Growing together, one green space at a time. 🌳</footer>
</body></html>`;
}

function moderationTag(status) {
  const s = status || 'review';
  const label = s === 'clear' ? '✅ Clear' : s === 'flagged' ? '🚫 Flagged' : '⚠️ Review Needed';
  return `<span class="tag ${s}">${label}</span>`;
}

// ── Public: landing ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send(layout({ title: 'Welcome to GreenPass 🌿', body: `
    <p class="muted" style="font-size:16px;max-width:640px">Our warm welcome for every new member of the NParks family. New joiners share a short introduction; HR reviews it, adds job details, and sends a welcome email.</p>
    <div class="grid two" style="margin-top:18px">
      <div class="card"><h2 style="color:${C.green};margin-top:0">I'm a new joiner 🌱</h2><p class="muted">Share a little about yourself so we can introduce you to your new colleagues. It only takes a couple of minutes.</p><a class="btn" href="/submit">Start my introduction →</a></div>
      <div class="card"><h2 style="color:${C.green};margin-top:0">HR admin dashboard</h2><p class="muted">Review submissions, verify content with AI assistance, add job details, and generate the welcome eDM.</p><a class="btn sec" href="/admin">Open dashboard →</a></div>
    </div>` }));
});

// ── Public: submission form ──────────────────────────────────────────────────
function submitPage({ error = '', values = {} } = {}) {
  return layout({ title: "We're so glad you're here 🌱", body: `
    ${error ? `<div class="err">${esc(error)}</div>` : ''}
    <div class="card">
      <p class="muted">Tell your new NParks colleagues a little about yourself. Your introduction will be shared in a warm welcome email once HR has had a quick look. <b>Job title, division and start date are added by HR</b> — you don't need to fill those in.</p>
      <p class="muted" style="background:${C.sageLight};border-radius:10px;padding:10px 12px"><b>Already submitted before?</b> Enter the <b>same email address</b> you used before and send the form again — as long as HR hasn't approved your entry yet, your new submission replaces the old one.</p>
      <form method="post" action="/submit" enctype="multipart/form-data">
        <div class="field"><label>Full name <span class="req">*</span></label><input type="text" name="full_name" required value="${esc(values.full_name)}" placeholder="e.g. Amara Tan"></div>
        <div class="field"><label>Email address <span class="req">*</span></label><input type="email" name="email" required value="${esc(values.email)}" placeholder="e.g. yourname@gmail.com">
          <p class="muted" style="margin-top:4px">We use this only to find your submission if you need to edit it later — it won't be shared in the welcome email or shown to your colleagues.</p></div>
        <div class="field"><label>Profile photo (JPG/PNG, max 5MB) <span class="req">*</span></label>
          <div class="row"><img id="pv" alt="" style="display:none;width:120px;height:auto;border-radius:8px;border:2px solid ${C.sage}">
          <input type="file" name="photo" accept="image/jpeg,image/png" required onchange="var f=this.files[0];if(f){var i=document.getElementById('pv');i.src=URL.createObjectURL(f);i.style.display='block'}"></div>
          <p class="muted">Your whole photo is shown as a rectangle — a clear, upright photo works best.</p></div>
        <div class="field"><label>Personal introduction <span class="req">*</span></label>
          <textarea name="intro" required oninput="var w=this.value.trim()?this.value.trim().split(/\\s+/).length:0;var c=document.getElementById('wc');c.textContent=w+' / 300 words';c.style.color=w>300?'#b45309':'';" placeholder="Share a short paragraph introducing yourself to your NParks colleagues.">${esc(values.intro)}</textarea>
          <p class="muted" id="wc">0 / 300 words</p></div>
        <div class="field"><label>Fun fact (optional)</label><input type="text" name="fun_fact" value="${esc(values.fun_fact)}" placeholder="One fun fact about yourself 🌼"></div>
        <button class="btn" type="submit">Send my introduction 🌿</button>
      </form>
    </div>` });
}
app.get('/submit', (_req, res) => res.send(submitPage()));

app.post('/submit', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).send(submitPage({ error: err.message, values: req.body }));
    if (!pool) return res.status(503).send(submitPage({ error: 'Database is not configured yet. Please try again shortly.', values: req.body }));
    const { full_name, email, intro, fun_fact } = req.body;
    if (!full_name || !email || !intro || !req.file) return res.status(400).send(submitPage({ error: 'Full name, email address, introduction and a profile photo are all required.', values: req.body }));
    const mail = (email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return res.status(400).send(submitPage({ error: 'Please enter a valid email address.', values: req.body }));
    try {
      const name = full_name.trim();
      const ai = await moderateText(intro);
      const photo = checkPhoto(req.file.buffer);

      // Resubmission: if this person already has an entry that HR has NOT yet
      // approved, overwrite it (their new submission replaces the old one and
      // goes back to the front of the review queue). Approved entries are left
      // untouched — a fresh submission is created instead. Matched by email.
      const existing = await pool.query(
        `select id from submissions where lower(email) = lower($1) and status <> 'approved'
         order by created_at desc limit 1`, [mail]);
      if (existing.rows.length) {
        await pool.query(
          `update submissions set full_name=$1, email=$2, intro=$3, fun_fact=$4, status='awaiting-hr-review',
             ai_status=$5, ai_confidence=$6, ai_reason=$7, photo_status=$8, photo_reason=$9,
             photo_mime=$10, photo_data=$11, updated_at=now() where id=$12`,
          [name, mail, intro.trim(), (fun_fact || '').trim() || null, ai.status, ai.confidence, ai.reason,
           photo.status, photo.reason, req.file.mimetype, req.file.buffer, existing.rows[0].id],
        );
        return res.redirect(`/submit/thanks?name=${encodeURIComponent(name)}&updated=1`);
      }

      const { rows } = await pool.query(
        `insert into submissions (full_name,email,intro,fun_fact,status,ai_status,ai_confidence,ai_reason,photo_status,photo_reason,photo_mime,photo_data)
         values ($1,$2,$3,$4,'awaiting-hr-review',$5,$6,$7,$8,$9,$10,$11) returning full_name`,
        [name, mail, intro.trim(), (fun_fact || '').trim() || null, ai.status, ai.confidence, ai.reason, photo.status, photo.reason, req.file.mimetype, req.file.buffer],
      );
      res.redirect(`/submit/thanks?name=${encodeURIComponent(rows[0].full_name)}`);
    } catch (e) {
      console.error(e);
      res.status(500).send(submitPage({ error: 'Something went wrong saving your submission. Please try again.', values: req.body }));
    }
  });
});

app.get('/submit/thanks', (req, res) => {
  const name = esc(req.query.name || 'friend');
  const updated = req.query.updated === '1';
  res.send(layout({ title: `Thanks for sharing, ${name}! 🌱`, body: `
    <div class="card" style="text-align:center;max-width:560px;margin:20px auto">
      <div style="font-size:44px">🌿</div>
      <h2 style="color:${C.green}">Welcome to NParks — we're so glad you're here.</h2>
      <p class="muted">${updated ? 'Your entry has been updated and sent back to the team for review.' : 'Your introduction has been sent to the team.'} Keep an eye on your inbox for a warm welcome from your new colleagues.</p>
      <p style="color:${C.green};font-weight:800">Growing together, one green space at a time. 🌳</p>
      <a class="btn" href="/">Back to home</a>
    </div>` }));
});

// ── Public: serve a stored photo ─────────────────────────────────────────────
app.get('/api/photo/:id', async (req, res) => {
  if (!pool) return res.status(503).send('No database');
  try {
    const { rows } = await pool.query('select photo_mime, photo_data from submissions where id=$1', [req.params.id]);
    if (!rows.length || !rows[0].photo_data) return res.status(404).send('Not found');
    res.set('Content-Type', rows[0].photo_mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(rows[0].photo_data);
  } catch { res.status(400).send('Bad request'); }
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, db: Boolean(pool) }));

// ── Serve the html2canvas library (installed via npm) so the eDM preview can
//    export a PNG. Same-origin script — no external CDN required. ─────────────
app.get('/vendor/html2canvas.js', (_req, res) => {
  try {
    const dir = path.dirname(require.resolve('html2canvas/package.json'));
    res.type('application/javascript').sendFile(path.join(dir, 'dist', 'html2canvas.min.js'));
  } catch {
    res.status(404).type('application/javascript').send('/* html2canvas not installed */');
  }
});

// ── Admin auth ───────────────────────────────────────────────────────────────
function adminLoginPage(error = '') {
  return layout({ title: 'HR Admin Login', body: `
    ${error ? `<div class="err">${esc(error)}</div>` : ''}
    <div class="card" style="max-width:420px;margin:10px auto">
      <p class="muted">Enter the shared HR password to continue.</p>
      <form method="post" action="/admin/login">
        <div class="field"><label>Admin password</label><input type="password" name="password" autofocus required></div>
        <button class="btn" type="submit">Log in 🌿</button>
      </form>
    </div>` });
}
app.post('/admin/login', (req, res) => {
  if ((req.body.password || '') !== ADMIN_PASSWORD) return res.send(adminLoginPage('Incorrect password. Please try again.'));
  res.set('Set-Cookie', `gp_admin=${encodeURIComponent(ADMIN_PASSWORD)}; HttpOnly; Path=/; Max-Age=43200; SameSite=Lax`);
  res.redirect('/admin');
});
app.get('/admin/logout', (_req, res) => {
  res.set('Set-Cookie', 'gp_admin=; HttpOnly; Path=/; Max-Age=0');
  res.redirect('/admin');
});

const AI_DISCLAIMER = `<div class="banner"><span>🤝</span><div><b>AI moderation is a first-pass check only.</b> Please review all content — including each photo — before approving. The final decision always rests with you.</div></div>`;

// ── Admin: review submissions ────────────────────────────────────────────────
app.get('/admin', async (req, res) => {
  if (!hasAdmin(req)) return res.send(adminLoginPage());
  if (!pool) return res.send(layout({ title: 'GreenPass HR Console', adminNav: true, body: `${AI_DISCLAIMER}<div class="card">No database connected.</div>` }));
  const { rows } = await pool.query(`select id,full_name,email,start_date,intro,fun_fact,status,job_title,division,ai_status,ai_confidence,ai_reason,photo_status,photo_reason from submissions order by created_at desc`);
  const groups = [
    ['awaiting-hr-review', 'Awaiting HR Review', 'Add job details and approve, or reject.'],
    ['approved', 'Approved', 'Ready to include in an eDM.'],
    ['rejected', 'Rejected', 'Not included in any eDM.'],
  ];
  const notice = req.query.msg ? `<div class="banner" style="background:${C.sageLight};border-color:${C.sage};color:${C.greenDark}"><span>✓</span><div>${esc(req.query.msg)}</div></div>` : '';
  const err = req.query.err ? `<div class="err">${esc(req.query.err)}</div>` : '';
  let body = AI_DISCLAIMER + notice + err;
  for (const [key, label, hint] of groups) {
    const items = rows.filter((r) => r.status === key);
    body += `<div class="section-h"><h2>${label}</h2><span class="count">${items.length}</span><span class="muted">${hint}</span></div>`;
    if (!items.length) { body += `<p class="muted card" style="text-align:center">Nothing here yet.</p>`; continue; }
    body += `<div class="grid two">` + items.map(cardHtml).join('') + `</div>`;
  }
  res.send(layout({ title: 'GreenPass HR Console 🌿', adminNav: true, body }));
});

function cardHtml(s) {
  const photoNote = s.photo_status === 'manual-review' ? `<p class="muted" style="margin:8px 0 0">📷 ${esc(s.photo_reason)}</p>` : '';
  const conf = s.ai_confidence ? ` · ${s.ai_confidence}% confidence` : '';
  const jt = esc(s.job_title), dv = esc(s.division);

  let hrFields, actions;
  if (s.status === 'rejected') {
    hrFields = `<div class="hrbox"><span class="tag hr">✎ Added by HR</span> <span class="muted">Not submitted by the new joiner</span><p class="muted" style="margin:8px 0 0">${jt || dv ? `${jt || '—'} · ${dv || '—'}` : 'No job details added.'}</p></div>`;
    actions = `<form method="post" action="/admin/update" class="actions"><input type="hidden" name="id" value="${s.id}">
      <button class="btn sec" name="action" value="restore">↩ Restore to review</button></form>`;
  } else {
    // Shared form: job title + division inputs, with save / approve / reject buttons.
    const approveDisabledNote = `<span class="muted" id="hint-${s.id}"></span>`;
    hrFields = `
      <form method="post" action="/admin/update">
        <input type="hidden" name="id" value="${s.id}">
        <div class="hrbox">
          <div style="margin-bottom:8px"><span class="tag hr">✎ Added by HR</span> <span class="muted">Not submitted by the new joiner</span></div>
          <div class="grid two">
            <div><label>Job Title</label><input type="text" name="job_title" value="${jt}" placeholder="e.g. Park Manager"></div>
            <div><label>Division / Branch</label><input type="text" name="division" value="${dv}" placeholder="e.g. Parks Division"></div>
          </div>
          <div class="field" style="margin:12px 0 0"><label>Start Date</label><input type="date" name="start_date" value="${esc(s.start_date)}"></div>
        </div>
        <div class="actions">
          ${s.status === 'awaiting-hr-review' ? `<button class="btn" name="action" value="approve">✓ Approve</button>` : ''}
          <button class="btn sec" name="action" value="save">Save HR details</button>
          <button class="btn danger" name="action" value="reject">Reject</button>
        </div>
      </form>`;
    actions = '';
  }

  // Edit form (all new-hire fields) inside a collapsible section.
  const editForm = `<details><summary>Edit new-joiner details</summary>
    <form method="post" action="/admin/update" style="margin-top:10px">
      <input type="hidden" name="id" value="${s.id}"><input type="hidden" name="action" value="edit">
      <div class="field"><label>Full name</label><input type="text" name="full_name" value="${esc(s.full_name)}"></div>
      <div class="field"><label>Email</label><input type="email" name="email" value="${esc(s.email)}"></div>
      <div class="field"><label>Introduction</label><textarea name="intro">${esc(s.intro)}</textarea></div>
      <div class="field"><label>Fun fact</label><input type="text" name="fun_fact" value="${esc(s.fun_fact)}"></div>
      <button class="btn sec" type="submit">Save changes</button>
    </form></details>`;

  return `<div class="card">
    <div class="row"><img class="thumb" src="/api/photo/${s.id}" alt="${esc(s.full_name)}">
      <div><h3 style="margin:0;color:${C.green}">${esc(s.full_name)}</h3><p class="muted" style="margin:2px 0 0">${s.start_date ? 'Starts ' + esc(s.start_date) : '📅 Start date — to be added by HR'}</p>${s.email ? `<p class="muted" style="margin:2px 0 0">📧 ${esc(s.email)}</p>` : ''}</div></div>
    <p style="margin:12px 0 0">${esc(s.intro)}</p>
    ${s.fun_fact ? `<p style="color:${C.earth};font-style:italic;margin:8px 0 0">🌼 Fun fact: ${esc(s.fun_fact)}</p>` : ''}
    <div class="modbox">${moderationTag(s.ai_status)} <span class="muted">AI moderation${conf}</span><p style="margin:6px 0 0">${esc(s.ai_reason)}</p>${photoNote}</div>
    ${hrFields}${actions}${editForm}
  </div>`;
}

// ── Admin: update (save / approve / reject / restore / edit) ─────────────────
app.post('/admin/update', async (req, res) => {
  if (!hasAdmin(req)) return res.send(adminLoginPage());
  if (!pool) return res.redirect('/admin?err=' + encodeURIComponent('No database connected.'));
  const { id, action } = req.body;
  try {
    const { rows } = await pool.query('select job_title,division from submissions where id=$1', [id]);
    if (!rows.length) return res.redirect('/admin?err=' + encodeURIComponent('Submission not found.'));
    const cur = rows[0];

    if (action === 'reject') {
      await pool.query('update submissions set status=$1,updated_at=now() where id=$2', ['rejected', id]);
      return res.redirect('/admin?msg=' + encodeURIComponent('Entry rejected.'));
    }
    if (action === 'restore') {
      await pool.query('update submissions set status=$1,updated_at=now() where id=$2', ['awaiting-hr-review', id]);
      return res.redirect('/admin?msg=' + encodeURIComponent('Entry restored to review.'));
    }
    if (action === 'edit') {
      await pool.query('update submissions set full_name=$1,email=$2,intro=$3,fun_fact=$4,updated_at=now() where id=$5',
        [(req.body.full_name || '').trim(), (req.body.email || '').trim() || null, (req.body.intro || '').trim(), (req.body.fun_fact || '').trim() || null, id]);
      return res.redirect('/admin?msg=' + encodeURIComponent('Details updated.'));
    }
    // save or approve → persist HR fields (job title, division, start date)
    const jobTitle = (req.body.job_title || '').trim();
    const division = (req.body.division || '').trim();
    const startDate = (req.body.start_date || '').trim();
    if (action === 'approve' && (!jobTitle || !division || !startDate)) {
      return res.redirect('/admin?err=' + encodeURIComponent('Job Title, Division and Start Date must all be filled in before approving.'));
    }
    const status = action === 'approve' ? 'approved' : undefined;
    if (status) await pool.query('update submissions set job_title=$1,division=$2,start_date=$3,status=$4,updated_at=now() where id=$5', [jobTitle, division, startDate || null, status, id]);
    else await pool.query('update submissions set job_title=$1,division=$2,start_date=$3,updated_at=now() where id=$4', [jobTitle, division, startDate || null, id]);
    res.redirect('/admin?msg=' + encodeURIComponent(action === 'approve' ? `Approved — ${jobTitle}, ${division}.` : 'HR details saved.'));
  } catch (e) {
    console.error(e);
    res.redirect('/admin?err=' + encodeURIComponent('Update failed. Please try again.'));
  }
});

// ── Admin: generate eDM ──────────────────────────────────────────────────────
app.get('/admin/edm', async (req, res) => {
  if (!hasAdmin(req)) return res.send(adminLoginPage());
  if (!pool) return res.send(layout({ title: 'Generate eDM', adminNav: true, body: '<div class="card">No database connected.</div>' }));
  const { rows: approved } = await pool.query(`select id,full_name,job_title,division from submissions where status='approved' order by created_at desc`);
  res.send(renderEdmPage(approved));
});

function renderEdmPage(approved, generated = null, error = '') {
  let body = AI_DISCLAIMER + (error ? `<div class="err">${esc(error)}</div>` : '');
  if (!approved.length) {
    body += `<div class="card"><p class="muted">No approved entries yet. Approve some submissions in the <a href="/admin">Review</a> tab first.</p></div>`;
    return layout({ title: 'Generate eDM 🌿', adminNav: true, body });
  }
  const checks = approved.map((a) => `<label style="display:flex;gap:10px;align-items:center;border:1px solid ${C.sage};border-radius:12px;padding:8px 12px;margin-bottom:8px;font-weight:400">
    <input type="checkbox" name="ids" value="${a.id}" checked> <img class="avatar" style="width:36px;height:36px" src="/api/photo/${a.id}"> <span><b>${esc(a.full_name)}</b><br><span class="muted">${esc(a.job_title)} · ${esc(a.division)}</span></span></label>`).join('');
  body += `<div class="grid two"><div class="card"><h2 style="margin-top:0;color:${C.green}">1 · Choose &amp; label</h2>
    <form method="post" action="/admin/edm">
      ${checks}
      <div class="field" style="margin-top:12px"><label>Occasion label</label><input type="text" name="occasion" value="July 2025 New Joiners" required></div>
      <div class="field"><label>Send date / label (optional)</label><input type="text" name="send_date" placeholder="e.g. 1 August 2025"></div>
      <button class="btn" type="submit">Generate eDM 🌿</button>
    </form></div>
    <div class="card"><h2 style="margin-top:0;color:${C.green}">Preview</h2>`;
  if (generated) {
    body += `<iframe class="preview" srcdoc="${esc(generated.html)}"></iframe>
      <div style="margin:12px 0 2px 0"><button class="btn" type="button" onclick="gpSavePng(this)">⬇ Save as PNG image</button>
        <span class="muted" id="pngmsg"></span></div>
      <p class="muted" style="margin-top:2px">Downloads the eDM as an image you can insert into Outlook (Insert → Picture), or just paste in.</p>
      <details><summary>Or copy the raw HTML</summary>
      <textarea id="raw" readonly style="height:150px;font-family:monospace;font-size:12px;margin-top:8px" onfocus="this.select()">${esc(generated.html)}</textarea>
      <button class="btn sec" type="button" onclick="navigator.clipboard.writeText(document.getElementById('raw').value);this.textContent='✓ Copied!'">Copy HTML to clipboard</button>
      <p class="muted">Paste straight into Outlook — all styles are inlined and images embedded.</p></details>
      <script src="/vendor/html2canvas.js"></script>
      <script>
        function gpSavePng(btn){
          var msg=document.getElementById('pngmsg');
          if(!window.html2canvas){ msg.textContent=' — image library did not load; try the screenshot method instead.'; return; }
          var html=document.getElementById('raw').value;
          var holder=document.createElement('div');
          holder.style.cssText='position:fixed;left:-10000px;top:0;width:640px;background:#F8F4E3';
          holder.innerHTML=html;
          document.body.appendChild(holder);
          btn.disabled=true; msg.textContent=' — generating image…';
          window.html2canvas(holder,{backgroundColor:'#F8F4E3',scale:2,width:640,windowWidth:640,useCORS:true}).then(function(canvas){
            canvas.toBlob(function(blob){
              var a=document.createElement('a');
              a.href=URL.createObjectURL(blob);
              a.download='nparks-welcome-edm.png';
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
              msg.textContent=' — done! Check your Downloads folder.';
            },'image/png');
          }).catch(function(e){ msg.textContent=' — could not create image: '+e.message; })
          .then(function(){ holder.remove(); btn.disabled=false; });
        }
      </script>`;
  } else {
    body += `<p class="muted">Select joiners and click <b>Generate eDM</b> — the formatted email will appear here.</p>`;
  }
  body += `</div></div>`;
  return layout({ title: 'Generate eDM 🌿', adminNav: true, body });
}

app.post('/admin/edm', async (req, res) => {
  if (!hasAdmin(req)) return res.send(adminLoginPage());
  if (!pool) return res.redirect('/admin/edm');
  let ids = req.body.ids || [];
  if (!Array.isArray(ids)) ids = [ids];
  const { rows: approved } = await pool.query(`select id,full_name,job_title,division from submissions where status='approved' order by created_at desc`);
  const occasion = (req.body.occasion || '').trim();
  if (!ids.length) return res.send(renderEdmPage(approved, null, 'Select at least one approved entry.'));
  if (!occasion) return res.send(renderEdmPage(approved, null, 'Please provide an occasion label.'));
  const { rows: hires } = await pool.query(
    `select full_name,start_date,intro,fun_fact,job_title,division,photo_mime,photo_data from submissions where id = any($1::uuid[]) and status='approved'`, [ids]);
  if (!hires.length) return res.send(renderEdmPage(approved, null, 'None of the selected entries are approved.'));
  const html = buildEdmHtml(hires, occasion, (req.body.send_date || '').trim());
  await pool.query('insert into edm_archive (occasion,send_date,hire_names,html) values ($1,$2,$3,$4)',
    [occasion, (req.body.send_date || '').trim() || null, JSON.stringify(hires.map((h) => h.full_name)), html]);
  res.send(renderEdmPage(approved, { html }));
});

// ── Admin: archive ───────────────────────────────────────────────────────────
app.get('/admin/archive', async (req, res) => {
  if (!hasAdmin(req)) return res.send(adminLoginPage());
  if (!pool) return res.send(layout({ title: 'Archive', adminNav: true, body: '<div class="card">No database connected.</div>' }));
  const { rows } = await pool.query('select id,occasion,send_date,hire_names,html,created_at from edm_archive order by created_at desc');
  let body = `<p class="muted">A read-only log of every eDM you've generated.</p>`;
  if (!rows.length) body += `<div class="card"><p class="muted">No eDMs generated yet. Create one in the <a href="/admin/edm">Generate eDM</a> tab.</p></div>`;
  else body += rows.map((e) => {
    const names = Array.isArray(e.hire_names) ? e.hire_names : [];
    return `<div class="card"><h3 style="margin:0;color:${C.green}">${esc(e.occasion)}</h3>
      <p class="muted">Generated ${new Date(e.created_at).toLocaleString()}${e.send_date ? ' · ' + esc(e.send_date) : ''}</p>
      <p><b>${names.length}</b> staff: ${esc(names.join(', '))}</p>
      <details><summary>View eDM</summary><iframe class="preview" srcdoc="${esc(e.html)}"></iframe></details></div>`;
  }).join('');
  res.send(layout({ title: 'eDM Archive', adminNav: true, body }));
});

// ── eDM HTML builder (Outlook-safe, table layout, all-inline CSS) ────────────
function photoDataUri(row) {
  try { if (!row.photo_data) return null; return `data:${row.photo_mime || 'image/jpeg'};base64,${Buffer.from(row.photo_data).toString('base64')}`; } catch { return null; }
}
// Engaging, park-noticeboard-style eDM: two-tone header with a nature emoji
// band, a warm intro callout, and each new hire as a "spotlight" card with a
// cycling accent colour (accent top bar + photo ring + role pill), a
// highlighted fun-fact callout, leafy dividers, and a playful footer.
// Still 100% table-based with all-inline CSS for Outlook compatibility.
function buildEdmHtml(hires, occasion, sendDate) {
  const GREEN = '#2D6A4F', DARK = '#1B4332', SAGE = '#95D5B2', SAGE_BG = '#E8F5E9', CREAM = '#F8F4E3';
  const ACCENTS = ['#2D6A4F', '#6B4226', '#40916C', '#1B4332'];
  const FONT = 'Arial,Helvetica,sans-serif';

  const cards = hires.map((h, i) => {
    const accent = ACCENTS[i % ACCENTS.length];
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F3FAF4';
    const img = photoDataUri(h);
    // Whole photo shown as a left-hand rectangle (no circular crop). Both max
    // dimensions are capped with width/height auto, so the image always keeps
    // its true proportions — it can never be stretched, squashed, or run
    // overly long, whatever aspect ratio the new hire uploads.
    const photoCell = img
      ? `<img src="${img}" alt="${esc(h.full_name)}" style="max-width:120px;max-height:150px;width:auto;height:auto;display:block;border:3px solid ${accent};border-radius:8px;" />`
      : `<div style="width:120px;height:120px;background-color:${accent};border-radius:8px;"></div>`;
    const funFact = h.fun_fact
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0 0;background-color:${SAGE_BG};border-radius:10px;">
           <tr><td width="6" style="background-color:${accent};font-size:0;line-height:0;border-radius:10px 0 0 10px;">&nbsp;</td>
           <td style="padding:9px 13px;font-family:${FONT};font-size:13px;font-style:italic;color:#33553f;">🌟 <b>Fun fact:</b> ${esc(h.fun_fact)}</td></tr>
         </table>`
      : '';
    const card = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bg};border:1px solid #dcece2;border-radius:16px;">
        <tr><td colspan="2" style="background-color:${accent};height:8px;line-height:8px;font-size:0;border-radius:16px 16px 0 0;">&nbsp;</td></tr>
        <tr>
          <td valign="top" width="150" style="padding:18px 8px 18px 18px;">${photoCell}</td>
          <td valign="top" style="padding:18px 18px 18px 6px;">
            <p style="margin:0;font-family:${FONT};font-size:20px;font-weight:bold;color:${GREEN};">${esc(h.full_name)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:7px 0 0 0;"><tr><td style="background-color:${accent};color:#ffffff;padding:4px 13px;border-radius:14px;font-family:${FONT};font-size:13px;font-weight:bold;">${esc(h.job_title)}</td></tr></table>
            <p style="margin:8px 0 0 0;font-family:${FONT};font-size:13px;color:#5b6b60;">🌳 ${esc(h.division)}&nbsp;&nbsp;·&nbsp;&nbsp;📅 Started ${esc(h.start_date)}</p>
            <p style="margin:11px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.55;color:#333333;">${esc(h.intro)}</p>
            ${funFact}
          </td>
        </tr>
      </table>`;
    const divider = i < hires.length - 1
      ? `<tr><td style="padding:4px 0;text-align:center;font-size:14px;letter-spacing:8px;color:${SAGE};">🍃 🍃 🍃</td></tr>`
      : '';
    return `<tr><td style="padding:8px 22px;">${card}</td></tr>${divider}`;
  }).join('\n');

  const dateLine = sendDate ? `<p style="margin:8px 0 0 0;font-family:${FONT};font-size:13px;color:#d8f3dc;">📅 ${esc(sendDate)}</p>` : '';

  return `<!-- GreenPass eDM -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};padding:24px 0;"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;">
    <tr><td style="background-color:${DARK};padding:10px 24px;text-align:center;font-size:17px;letter-spacing:7px;">🌿🌸🦋🌳☀️🍃</td></tr>
    <tr><td style="background-color:${GREEN};padding:28px 24px 30px 24px;text-align:center;">
      <p style="margin:0;font-family:${FONT};font-size:13px;letter-spacing:2px;color:#95d5b2;text-transform:uppercase;">National Parks Board</p>
      <h1 style="margin:8px 0 0 0;font-family:${FONT};font-size:30px;color:#ffffff;">Welcome to the NParks Family 🌿</h1>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0 auto;"><tr><td style="background-color:${SAGE};color:${DARK};padding:7px 20px;border-radius:20px;font-family:${FONT};font-size:15px;font-weight:bold;">🌱 ${esc(occasion)}</td></tr></table>
      ${dateLine}</td></tr>
    <tr><td style="background-color:${SAGE};height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:24px 22px 4px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};border:1px solid #ece3c3;border-radius:14px;">
        <tr><td valign="middle" width="58" style="padding:14px 0 14px 16px;font-size:30px;">🌳</td>
        <td style="padding:14px 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:#3a4a40;">We're delighted to welcome our newest colleagues to the NParks family! Take a moment to say hello and get to know them below — let's give them a warm, leafy welcome. 🌿</td></tr>
      </table></td></tr>
    <tr><td style="padding:18px 24px 2px 24px;text-align:center;"><p style="margin:0;font-family:${FONT};font-size:21px;font-weight:bold;color:${GREEN};">🌱 Meet our newest colleagues 🌱</p></td></tr>
    ${cards}
    <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="background-color:${SAGE};height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="background-color:${GREEN};padding:26px 24px;text-align:center;">
      <p style="margin:0 0 12px 0;font-size:18px;letter-spacing:5px;">🌻🌿🦋🌳🍃🌷</p>
      <p style="margin:0;font-family:${FONT};font-size:16px;font-style:italic;color:#ffffff;">Growing together, one green space at a time. 🌳</p>
      <p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:#95d5b2;">National Parks Board (NParks), Singapore &middot; Making Singapore our City in Nature</p></td></tr>
  </table></td></tr></table>`;
}

// ── Demo seed (solid-colour avatar PNGs, no dependencies) ────────────────────
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; }
function makeSeedPng(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const rs = y * (w * 3 + 1); raw[rs] = 0; for (let x = 0; x < w; x++) { const p = rs + 1 + x * 3; raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; } }
  const idat = zlib.deflateSync(raw);
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const tb = Buffer.from(t, 'ascii'); const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([tb, d])), 0); return Buffer.concat([l, tb, d, cb]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
async function seedIfEmpty() {
  if (!pool) return;
  const { rows } = await pool.query('select count(*)::int n from submissions');
  if (rows[0].n > 0) { console.log(`[seed] skipped (already has ${rows[0].n} rows)`); return; }
  const demo = [
    { full_name: 'Amara Tan', start_date: null, rgb: [45, 106, 79], intro: "Hello everyone! I'm Amara, joining NParks after five years in urban landscape design. I'm passionate about pollinator gardens and can't wait to help make our parks even more welcoming for people and wildlife alike. Looking forward to meeting you all on the trails!", fun_fact: 'I once cycled the entire Round Island Route in a single day.', status: 'awaiting-hr-review', job_title: null, division: null, ai_status: 'clear', ai_confidence: 96, ai_reason: 'The introduction is warm, professional, and free of sensitive personal information.' },
    { full_name: 'Wei Jie Lim', start_date: null, rgb: [107, 66, 38], intro: "Hi team! I'm Wei Jie. I live at 42 Sunbird Avenue and you can always reach me on my mobile at 9123 4567. I'm currently managing a chronic back condition so I may need to sit during long outdoor events, but I'm thrilled to be here and love birdwatching at Sungei Buloh!", fun_fact: 'I have spotted over 200 bird species across Singapore.', status: 'awaiting-hr-review', job_title: null, division: null, ai_status: 'flagged', ai_confidence: 92, ai_reason: 'The text discloses a home address, a personal mobile number, and a medical condition that should not appear in a mass email.' },
    { full_name: 'Priya Nair', start_date: '2025-06-30', rgb: [149, 213, 178], intro: "Hello NParks family! I'm Priya, and I'm delighted to be joining the conservation team. My background is in freshwater ecology, and I'm especially excited about our habitat restoration work. I believe every small green space makes a difference — see you out in the field!", fun_fact: 'I keep a balcony full of native ferns at home.', status: 'approved', job_title: 'Senior Conservation Officer', division: 'National Biodiversity Centre', ai_status: 'clear', ai_confidence: 98, ai_reason: 'A professional, enthusiastic introduction with no sensitive or off-topic content.' },
  ];
  for (const d of demo) {
    await pool.query(`insert into submissions (full_name,start_date,intro,fun_fact,status,job_title,division,ai_status,ai_confidence,ai_reason,photo_status,photo_reason,photo_mime,photo_data)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual-review','Photo is a valid 240x240px image. Please visually verify it is appropriate before approving.','image/png',$11)`,
      [d.full_name, d.start_date, d.intro, d.fun_fact, d.status, d.job_title, d.division, d.ai_status, d.ai_confidence, d.ai_reason, makeSeedPng(240, 240, d.rgb)]);
  }
  console.log('[seed] inserted 3 demo submissions');
}

// ── Boot ─────────────────────────────────────────────────────────────────────
ensureSchema()
  .then(() => (process.env.SEED_DEMO === '1' ? seedIfEmpty() : null))
  .catch((err) => console.error('[server] startup error:', err.message))
  .finally(() => app.listen(PORT, () => {
    console.log(`🌿 GreenPass (single-file) running on http://localhost:${PORT}`);
    if (!DATABASE_URL) console.log('   ⚠  DATABASE_URL not set — attach a database to persist data.');
    if (!process.env.ANTHROPIC_API_KEY) console.log('   ⚠  ANTHROPIC_API_KEY not set — AI moderation marks entries for manual review.');
  }));
