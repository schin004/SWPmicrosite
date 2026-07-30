// ─────────────────────────────────────────────────────────────────────────────
// GreenPass — backend server (NParks new-hire welcome portal)
//
// Serves the built front-end (dist/) AND the /api endpoints. All data — including
// uploaded profile photos — is stored in a Neon PostgreSQL database read from
// process.env.DATABASE_URL (set automatically by Rabbit Deploy when you
// create/attach a database). The connection string never reaches the browser.
//
// Photos live in the database (bytea) rather than on disk, because Rabbit
// containers have an ephemeral filesystem — anything written to /uploads would
// be lost on every redeploy. Storing them in Postgres keeps them durable and is
// consistent with how the rest of the app persists data.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import pg from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nparks-admin';
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
  console.warn('[server] DATABASE_URL is not set — /api endpoints will error until a database is attached.');
}

// ── Schema: create tables on startup (idempotent) ────────────────────────────
async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists submissions (
      id            uuid primary key default gen_random_uuid(),
      created_at    timestamptz not null default now(),
      updated_at    timestamptz not null default now(),
      full_name     text not null,
      start_date    text,
      intro         text not null,
      fun_fact      text,
      status        text not null default 'awaiting-hr-review',
      job_title     text,
      division      text,
      ai_status     text,
      ai_confidence int,
      ai_reason     text,
      photo_status  text,
      photo_reason  text,
      photo_mime    text,
      photo_data    bytea
    );

    create table if not exists edm_archive (
      id          uuid primary key default gen_random_uuid(),
      created_at  timestamptz not null default now(),
      occasion    text not null,
      send_date   text,
      hire_ids    jsonb not null,
      hire_names  jsonb not null,
      html        text not null
    );
  `);
  // Start date is filled in by HR, not the new hire — ensure the column is
  // nullable even on databases created by an earlier version of this app.
  await pool.query('alter table submissions alter column start_date drop not null');
}

// Columns returned to the client — everything EXCEPT the raw photo bytes, plus a
// computed photo_path pointing at the /api/photo/:id endpoint.
const PUBLIC_COLUMNS = `
  id, full_name, start_date, intro, fun_fact, status, job_title, division,
  ai_status, ai_confidence, ai_reason, photo_status, photo_reason,
  ('/api/photo/' || id) as photo_path,
  created_at, updated_at
`;

// ── Claude content-moderation system prompt (per spec) ───────────────────────
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

// Call the Claude API to moderate the introduction text. Falls back to a safe
// "manual review" result whenever the key is missing or the API errors — the AI
// result is only ever a first-pass aid, never the final decision.
async function moderateText(text) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      status: 'review',
      confidence: 0,
      reason: 'AI moderation is unavailable (no ANTHROPIC_API_KEY configured) — please review this introduction manually.',
    };
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        system: MODERATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) throw new Error(`Claude API returned ${res.status}`);
    const data = await res.json();
    const raw = (data.content || []).map((b) => b.text || '').join('').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    const status = ['clear', 'review', 'flagged'].includes(parsed.status) ? parsed.status : 'review';
    return {
      status,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      reason: String(parsed.reason || 'No explanation provided.'),
    };
  } catch (err) {
    console.warn('[moderation] falling back to manual review:', err.message);
    return {
      status: 'review',
      confidence: 0,
      reason: 'AI moderation could not be completed automatically — please review this introduction manually.',
    };
  }
}

// ── Lightweight image dimension reader (PNG + JPEG, no dependencies) ──────────
function readImageDimensions(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      const len = buffer.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }
  return null;
}

// Basic photo checks on the uploaded buffer: valid image, under 5MB, at least
// 100x100px. Anything that passes still gets a "please eyeball it" note because
// no automated check can judge whether a photo is appropriate.
function checkPhoto(buffer) {
  try {
    if (buffer.length > 5 * 1024 * 1024) {
      return { status: 'manual-review', reason: 'Photo exceeds the 5MB limit — please verify.' };
    }
    const dim = readImageDimensions(buffer);
    if (!dim) {
      return { status: 'manual-review', reason: 'Could not read image dimensions — please visually verify the photo before approving.' };
    }
    if (dim.width < 100 || dim.height < 100) {
      return { status: 'manual-review', reason: `Photo is only ${dim.width}x${dim.height}px (below 100x100) — please verify quality.` };
    }
    return { status: 'manual-review', reason: `Photo is a valid ${dim.width}x${dim.height}px image. Please visually verify it is appropriate before approving.` };
  } catch {
    return { status: 'manual-review', reason: 'Photo could not be inspected — please visually verify before approving.' };
  }
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));

// Small async wrapper so route handlers can throw and still return a clean 500.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error('[api]', err.message);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  });

function requireDb(res) {
  if (!pool) {
    res.status(503).json({ error: 'Database is not configured (DATABASE_URL is not set).' });
    return false;
  }
  return true;
}

// Simple admin gate: the client sends the password in the `x-admin-password`
// header on every admin request. Not fit for the public internet — this is an
// internal tool with a single shared HR password, exactly as specified.
function requireAdmin(req, res, next) {
  if (req.get('x-admin-password') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin password.' });
  }
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG and PNG images are accepted.'));
  },
});

// ── Public: new-hire submission ──────────────────────────────────────────────
app.post('/api/submissions', (req, res) => {
  upload.single('photo')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!requireDb(res)) return;
    try {
      const { full_name, intro, fun_fact } = req.body;
      if (!full_name || !intro || !req.file) {
        return res.status(400).json({ error: 'Full name, introduction and a profile photo are all required.' });
      }

      const name = full_name.trim();
      const ai = await moderateText(intro);
      const photo = checkPhoto(req.file.buffer);

      // Resubmission: if this person already has an entry HR hasn't approved,
      // overwrite it (back to the review queue). Approved entries stay put and a
      // fresh submission is created instead. Matched by full name.
      const existing = await pool.query(
        `select id from submissions where lower(full_name) = lower($1) and status <> 'approved'
         order by created_at desc limit 1`, [name],
      );
      if (existing.rows.length) {
        await pool.query(
          `update submissions set intro=$1, fun_fact=$2, status='awaiting-hr-review',
             ai_status=$3, ai_confidence=$4, ai_reason=$5, photo_status=$6, photo_reason=$7,
             photo_mime=$8, photo_data=$9, updated_at=now() where id=$10`,
          [intro.trim(), (fun_fact || '').trim() || null, ai.status, ai.confidence, ai.reason,
           photo.status, photo.reason, req.file.mimetype, req.file.buffer, existing.rows[0].id],
        );
        return res.status(200).json({ id: existing.rows[0].id, name, updated: true });
      }

      const { rows } = await pool.query(
        `insert into submissions
           (full_name, intro, fun_fact, status,
            ai_status, ai_confidence, ai_reason, photo_status, photo_reason,
            photo_mime, photo_data)
         values ($1,$2,$3,'awaiting-hr-review',$4,$5,$6,$7,$8,$9,$10)
         returning id, full_name`,
        [
          name, intro.trim(), (fun_fact || '').trim() || null,
          ai.status, ai.confidence, ai.reason, photo.status, photo.reason,
          req.file.mimetype, req.file.buffer,
        ],
      );
      res.status(201).json({ id: rows[0].id, name: rows[0].full_name });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Something went wrong saving your submission. Please try again.' });
    }
  });
});

// ── Public: serve a stored profile photo ─────────────────────────────────────
app.get('/api/photo/:id', wrap(async (req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query('select photo_mime, photo_data from submissions where id = $1', [req.params.id]);
  if (!rows.length || !rows[0].photo_data) return res.status(404).send('Not found');
  res.set('Content-Type', rows[0].photo_mime || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(rows[0].photo_data);
}));

// ── Admin: auth check ────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  if (req.body?.password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Incorrect password. Please try again.' });
});

// ── Admin: list all submissions ──────────────────────────────────────────────
app.get('/api/submissions', requireAdmin, wrap(async (_req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query(`select ${PUBLIC_COLUMNS} from submissions order by created_at desc`);
  res.json(rows);
}));

// ── Admin: update a submission (HR fields, edits, status changes) ────────────
app.patch('/api/submissions/:id', requireAdmin, wrap(async (req, res) => {
  if (!requireDb(res)) return;
  const { rows: existingRows } = await pool.query('select job_title, division, start_date from submissions where id = $1', [req.params.id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Submission not found.' });
  const existing = existingRows[0];

  const allowed = ['full_name', 'start_date', 'intro', 'fun_fact', 'job_title', 'division', 'status'];
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) { values.push(req.body[key]); sets.push(`${key} = $${values.length}`); }
  }
  if (!sets.length) return res.status(400).json({ error: 'No valid fields to update.' });

  // Guard: cannot approve until HR has filled in job title, division AND start date.
  if (req.body.status === 'approved') {
    const jobTitle = 'job_title' in req.body ? req.body.job_title : existing.job_title;
    const division = 'division' in req.body ? req.body.division : existing.division;
    const startDate = 'start_date' in req.body ? req.body.start_date : existing.start_date;
    if (!jobTitle?.trim() || !division?.trim() || !startDate?.trim()) {
      return res.status(400).json({ error: 'Job Title, Division and Start Date must all be filled in before approving.' });
    }
  }

  sets.push('updated_at = now()');
  values.push(req.params.id);
  const { rows } = await pool.query(
    `update submissions set ${sets.join(', ')} where id = $${values.length} returning ${PUBLIC_COLUMNS}`,
    values,
  );
  res.json(rows[0]);
}));

// ── Admin: generate an eDM from selected approved entries ────────────────────
app.post('/api/edm', requireAdmin, wrap(async (req, res) => {
  if (!requireDb(res)) return;
  const { ids, occasion, send_date } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Select at least one approved entry.' });
  if (!occasion?.trim()) return res.status(400).json({ error: 'Please provide an occasion label.' });

  const { rows: hires } = await pool.query(
    `select id, full_name, start_date, intro, fun_fact, job_title, division, photo_mime, photo_data
       from submissions where id = any($1::uuid[]) and status = 'approved'`,
    [ids],
  );
  if (!hires.length) return res.status(400).json({ error: 'None of the selected entries are approved.' });

  const html = buildEdmHtml(hires, occasion.trim(), send_date);
  const names = hires.map((h) => h.full_name);
  const { rows } = await pool.query(
    `insert into edm_archive (occasion, send_date, hire_ids, hire_names, html)
     values ($1,$2,$3,$4,$5) returning id`,
    [occasion.trim(), send_date || null, JSON.stringify(hires.map((h) => h.id)), JSON.stringify(names), html],
  );
  res.status(201).json({ id: rows[0].id, html, names, occasion: occasion.trim() });
}));

// ── Admin: archive of generated eDMs ─────────────────────────────────────────
app.get('/api/edm', requireAdmin, wrap(async (_req, res) => {
  if (!requireDb(res)) return;
  const { rows } = await pool.query(
    'select id, occasion, send_date, hire_names, html, created_at from edm_archive order by created_at desc',
  );
  res.json(rows);
}));

// ── Health check (used by Rabbit / uptime probes) ────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true, db: Boolean(pool) }));

// ── eDM HTML builder (Outlook-safe, table layout, all-inline CSS) ────────────
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline a stored photo (Buffer from Postgres bytea) as a base64 data URI so the
// eDM is fully self-contained and images survive being pasted into Outlook.
function photoDataUri(row) {
  try {
    if (!row.photo_data) return null;
    const mime = row.photo_mime || 'image/jpeg';
    return `data:${mime};base64,${Buffer.from(row.photo_data).toString('base64')}`;
  } catch {
    return null;
  }
}

function buildEdmHtml(hires, occasion, sendDate) {
  return renderEdm(hires, occasion, sendDate, escapeHtml, photoDataUri);
}

// Engaging, park-noticeboard-style eDM: two-tone header with a nature emoji
// band, a warm intro callout, and each new hire as a "spotlight" card with a
// cycling accent colour (accent top bar + photo ring + role pill), a
// highlighted fun-fact callout, leafy dividers, and a playful footer.
// Still 100% table-based with all-inline CSS for Outlook compatibility.
function renderEdm(hires, occasion, sendDate, esc, photoUri) {
  const GREEN = '#2D6A4F';
  const DARK = '#1B4332';
  const SAGE = '#95D5B2';
  const SAGE_BG = '#E8F5E9';
  const CREAM = '#F8F4E3';
  const ACCENTS = ['#2D6A4F', '#6B4226', '#40916C', '#1B4332'];
  const FONT = "Arial,Helvetica,sans-serif";

  const cards = hires.map((h, i) => {
    const accent = ACCENTS[i % ACCENTS.length];
    const bg = i % 2 === 0 ? '#FFFFFF' : '#F3FAF4';
    const img = photoUri(h);
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:18px;overflow:hidden;">
        <tr><td style="background-color:${DARK};padding:10px 24px;text-align:center;font-size:17px;letter-spacing:7px;">🌿🌸🦋🌳☀️🍃</td></tr>
        <tr>
          <td style="background-color:${GREEN};padding:28px 24px 30px 24px;text-align:center;">
            <p style="margin:0;font-family:${FONT};font-size:13px;letter-spacing:2px;color:#95d5b2;text-transform:uppercase;">National Parks Board</p>
            <h1 style="margin:8px 0 0 0;font-family:${FONT};font-size:30px;color:#ffffff;">Welcome to the NParks Family 🌿</h1>
            <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:14px auto 0 auto;"><tr><td style="background-color:${SAGE};color:${DARK};padding:7px 20px;border-radius:20px;font-family:${FONT};font-size:15px;font-weight:bold;">🌱 ${esc(occasion)}</td></tr></table>
            ${dateLine}
          </td>
        </tr>
        <tr><td style="background-color:${SAGE};height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="padding:24px 22px 4px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};border:1px solid #ece3c3;border-radius:14px;">
              <tr>
                <td valign="middle" width="58" style="padding:14px 0 14px 16px;font-size:30px;">🌳</td>
                <td style="padding:14px 18px;font-family:${FONT};font-size:15px;line-height:1.6;color:#3a4a40;">We're delighted to welcome our newest colleagues to the NParks family! Take a moment to say hello and get to know them below — let's give them a warm, leafy welcome. 🌿</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:18px 24px 2px 24px;text-align:center;"><p style="margin:0;font-family:${FONT};font-size:21px;font-weight:bold;color:${GREEN};">🌱 Meet our newest colleagues 🌱</p></td></tr>
        ${cards}
        <tr><td style="height:12px;line-height:12px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="background-color:${SAGE};height:10px;line-height:10px;font-size:0;">&nbsp;</td></tr>
        <tr>
          <td style="background-color:${GREEN};padding:26px 24px;text-align:center;">
            <p style="margin:0 0 12px 0;font-size:18px;letter-spacing:5px;">🌻🌿🦋🌳🍃🌷</p>
            <p style="margin:0;font-family:${FONT};font-size:16px;font-style:italic;color:#ffffff;">Growing together, one green space at a time. 🌳</p>
            <p style="margin:10px 0 0 0;font-family:${FONT};font-size:12px;color:#95d5b2;">National Parks Board (NParks), Singapore &middot; Making Singapore our City in Nature</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// ── Seed helper: generate a valid solid-colour PNG with no dependencies ──────
function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function makeSeedPng(width, height, [r, g, b]) {
  const bpp = 3;
  const raw = Buffer.alloc((width * bpp + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * bpp + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const p = rowStart + 1 + x * bpp;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Insert the three demo submissions if the table is empty. Shared by seed.js and
// the optional SEED_DEMO=1 startup path so a fresh Rabbit deploy isn't empty.
async function seedIfEmpty() {
  if (!pool) return { seeded: false, reason: 'no database' };
  const { rows } = await pool.query('select count(*)::int as n from submissions');
  if (rows[0].n > 0) return { seeded: false, reason: `already has ${rows[0].n} row(s)` };

  const demo = [
    {
      full_name: 'Amara Tan', start_date: null, rgb: [45, 106, 79],
      intro: "Hello everyone! I'm Amara, joining NParks after five years in urban landscape design. I'm passionate about pollinator gardens and can't wait to help make our parks even more welcoming for people and wildlife alike. Looking forward to meeting you all on the trails!",
      fun_fact: 'I once cycled the entire Round Island Route in a single day.',
      status: 'awaiting-hr-review', job_title: null, division: null,
      ai_status: 'clear', ai_confidence: 96,
      ai_reason: 'The introduction is warm, professional, and free of sensitive personal information.',
    },
    {
      full_name: 'Wei Jie Lim', start_date: null, rgb: [107, 66, 38],
      intro: "Hi team! I'm Wei Jie. I live at 42 Sunbird Avenue and you can always reach me on my mobile at 9123 4567. I'm currently managing a chronic back condition so I may need to sit during long outdoor events, but I'm thrilled to be here and love birdwatching at Sungei Buloh!",
      fun_fact: 'I have spotted over 200 bird species across Singapore.',
      status: 'awaiting-hr-review', job_title: null, division: null,
      ai_status: 'flagged', ai_confidence: 92,
      ai_reason: 'The text discloses a home address, a personal mobile number, and a medical condition that should not appear in a mass email.',
    },
    {
      full_name: 'Priya Nair', start_date: '2025-06-30', rgb: [149, 213, 178],
      intro: "Hello NParks family! I'm Priya, and I'm delighted to be joining the conservation team. My background is in freshwater ecology, and I'm especially excited about our habitat restoration work. I believe every small green space makes a difference — see you out in the field!",
      fun_fact: 'I keep a balcony full of native ferns at home.',
      status: 'approved', job_title: 'Senior Conservation Officer', division: 'National Biodiversity Centre',
      ai_status: 'clear', ai_confidence: 98,
      ai_reason: 'A professional, enthusiastic introduction with no sensitive or off-topic content.',
    },
  ];

  for (const d of demo) {
    await pool.query(
      `insert into submissions
         (full_name, start_date, intro, fun_fact, status, job_title, division,
          ai_status, ai_confidence, ai_reason, photo_status, photo_reason,
          photo_mime, photo_data)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'image/png',$13)`,
      [
        d.full_name, d.start_date, d.intro, d.fun_fact, d.status, d.job_title, d.division,
        d.ai_status, d.ai_confidence, d.ai_reason, 'manual-review',
        'Photo is a valid 240x240px image. Please visually verify it is appropriate before approving.',
        makeSeedPng(240, 240, d.rgb),
      ],
    );
  }
  return { seeded: true, count: demo.length };
}

// ── Serve the built front-end (dist/) ────────────────────────────────────────
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureSchema()
    .then(async () => {
      if (process.env.SEED_DEMO === '1') {
        const r = await seedIfEmpty();
        console.log('[seed]', r.seeded ? `inserted ${r.count} demo submissions` : `skipped (${r.reason})`);
      }
    })
    .catch((err) => console.error('[server] schema init failed:', err.message))
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`\n🌿 GreenPass running on http://localhost:${PORT}`);
        if (!DATABASE_URL) console.log('   ⚠  DATABASE_URL not set — attach a database to persist data.');
        if (!process.env.ANTHROPIC_API_KEY) console.log('   ⚠  ANTHROPIC_API_KEY not set — AI moderation will mark entries for manual review.');
      });
    });
}

export { buildEdmHtml, makeSeedPng, ensureSchema, seedIfEmpty, pool };
