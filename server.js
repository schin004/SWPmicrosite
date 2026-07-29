// ─────────────────────────────────────────────────────────────────────────────
// GreenPass — backend server (NParks new-hire welcome portal)
//
// A single self-contained Express server that:
//   • stores submissions in a local SQLite database (Node's built-in node:sqlite)
//   • accepts photo uploads (stored under /uploads, served statically)
//   • runs AI content moderation via the Claude API on submitted introductions
//   • powers the HR admin dashboard (review → approve → generate eDM → archive)
//
// No external database or auth service required. The admin password and the
// Claude API key are read from environment variables (.env).
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nparks-admin';
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_PATH = path.join(__dirname, 'greenpass.db');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Database ─────────────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);
db.exec(`
  create table if not exists submissions (
    id            integer primary key autoincrement,
    full_name     text not null,
    start_date    text not null,
    photo_path    text,
    intro         text not null,
    fun_fact      text,
    status        text not null default 'awaiting-hr-review',
    job_title     text,
    division      text,
    ai_status     text,
    ai_confidence integer,
    ai_reason     text,
    photo_status  text,
    photo_reason  text,
    created_at    text not null,
    updated_at    text not null
  );

  create table if not exists edm_archive (
    id          integer primary key autoincrement,
    occasion    text not null,
    send_date   text,
    hire_ids    text not null,
    hire_names  text not null,
    html        text not null,
    created_at  text not null
  );
`);

const now = () => new Date().toISOString();

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
  // PNG: 8-byte signature, then IHDR chunk with width/height at bytes 16..24
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  // JPEG: scan for a Start-Of-Frame marker (0xFFC0-0xFFCF, excluding a few)
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

// Basic photo checks: valid image, under 5MB, at least 100x100px. Anything that
// passes still gets a "please eyeball it" note because no automated check can
// judge whether a photo is appropriate.
function checkPhoto(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length > 5 * 1024 * 1024) {
      return { status: 'manual-review', reason: 'Photo exceeds the 5MB limit — please verify.' };
    }
    const dim = readImageDimensions(buf);
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
app.use('/uploads', express.static(UPLOAD_DIR));

// Simple admin gate: the client sends the password in the `x-admin-password`
// header on every admin request. Not fit for the public internet — this is an
// internal tool with a single shared HR password, exactly as specified.
function requireAdmin(req, res, next) {
  const pw = req.get('x-admin-password');
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin password.' });
  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.img').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
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
    try {
      const { full_name, start_date, intro, fun_fact } = req.body;
      if (!full_name || !start_date || !intro || !req.file) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Full name, start date, introduction and a profile photo are all required.' });
      }

      const photoPath = `/uploads/${req.file.filename}`;
      const ai = await moderateText(intro);
      const photo = checkPhoto(req.file.path);
      const ts = now();

      const info = db.prepare(`
        insert into submissions
          (full_name, start_date, photo_path, intro, fun_fact, status,
           ai_status, ai_confidence, ai_reason, photo_status, photo_reason,
           created_at, updated_at)
        values (?, ?, ?, ?, ?, 'awaiting-hr-review', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        full_name.trim(), start_date, photoPath, intro.trim(),
        (fun_fact || '').trim() || null,
        ai.status, ai.confidence, ai.reason, photo.status, photo.reason, ts, ts,
      );

      res.status(201).json({ id: info.lastInsertRowid, name: full_name.trim() });
    } catch (e) {
      console.error(e);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'Something went wrong saving your submission. Please try again.' });
    }
  });
});

// ── Admin: auth check ────────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  if (req.body?.password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ error: 'Incorrect password. Please try again.' });
});

// ── Admin: list all submissions ──────────────────────────────────────────────
app.get('/api/submissions', requireAdmin, (_req, res) => {
  const rows = db.prepare('select * from submissions order by datetime(created_at) desc').all();
  res.json(rows);
});

// ── Admin: update a submission (HR fields, edits, status changes) ────────────
app.patch('/api/submissions/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('select * from submissions where id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Submission not found.' });

  const allowed = ['full_name', 'start_date', 'intro', 'fun_fact', 'job_title', 'division', 'status'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) { fields.push(`${key} = ?`); values.push(req.body[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'No valid fields to update.' });

  // Guard: cannot approve until HR has filled in both job title and division.
  if (req.body.status === 'approved') {
    const jobTitle = 'job_title' in req.body ? req.body.job_title : existing.job_title;
    const division = 'division' in req.body ? req.body.division : existing.division;
    if (!jobTitle?.trim() || !division?.trim()) {
      return res.status(400).json({ error: 'Job Title and Division must both be filled in before approving.' });
    }
  }

  fields.push('updated_at = ?');
  values.push(now(), id);
  db.prepare(`update submissions set ${fields.join(', ')} where id = ?`).run(...values);
  res.json(db.prepare('select * from submissions where id = ?').get(id));
});

// ── Admin: generate an eDM from selected approved entries ────────────────────
app.post('/api/edm', requireAdmin, (req, res) => {
  const { ids, occasion, send_date } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Select at least one approved entry.' });
  if (!occasion?.trim()) return res.status(400).json({ error: 'Please provide an occasion label.' });

  const placeholders = ids.map(() => '?').join(',');
  const hires = db.prepare(
    `select * from submissions where id in (${placeholders}) and status = 'approved'`,
  ).all(...ids);
  if (!hires.length) return res.status(400).json({ error: 'None of the selected entries are approved.' });

  const html = buildEdmHtml(hires, occasion.trim(), send_date);
  const names = hires.map((h) => h.full_name);
  const ts = now();
  const info = db.prepare(`
    insert into edm_archive (occasion, send_date, hire_ids, hire_names, html, created_at)
    values (?, ?, ?, ?, ?, ?)
  `).run(occasion.trim(), send_date || null, JSON.stringify(hires.map((h) => h.id)), JSON.stringify(names), html, ts);

  res.status(201).json({ id: info.lastInsertRowid, html, names, occasion: occasion.trim() });
});

// ── Admin: archive of generated eDMs ─────────────────────────────────────────
app.get('/api/edm', requireAdmin, (_req, res) => {
  const rows = db.prepare('select id, occasion, send_date, hire_names, html, created_at from edm_archive order by datetime(created_at) desc').all();
  res.json(rows.map((r) => ({ ...r, hire_names: JSON.parse(r.hire_names) })));
});

// ── eDM HTML builder (Outlook-safe, table layout, all-inline CSS) ────────────
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Read an uploaded photo off disk and inline it as a base64 data URI so the eDM
// is fully self-contained and images survive being pasted into Outlook.
function photoDataUri(photoPath) {
  try {
    if (!photoPath) return null;
    const file = path.join(__dirname, photoPath.replace(/^\//, ''));
    const buf = fs.readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function buildEdmHtml(hires, occasion, sendDate) {
  const GREEN = '#2D6A4F';
  const SAGE_BG = '#E8F5E9';
  const CREAM = '#F8F4E3';
  const BROWN = '#6B4226';

  const rows = hires.map((h, i) => {
    const bg = i % 2 === 0 ? '#FFFFFF' : SAGE_BG;
    const img = photoDataUri(h.photo_path);
    const photoCell = img
      ? `<img src="${img}" width="100" height="100" alt="${escapeHtml(h.full_name)}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;display:block;border:3px solid ${GREEN};" />`
      : `<div style="width:100px;height:100px;border-radius:50%;background-color:${GREEN};"></div>`;
    const funFact = h.fun_fact
      ? `<p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BROWN};font-style:italic;">🌱 Fun fact: ${escapeHtml(h.fun_fact)}</p>`
      : '';
    return `
      <tr style="background-color:${bg};">
        <td valign="top" width="130" style="padding:20px 16px 20px 24px;">${photoCell}</td>
        <td valign="top" style="padding:20px 24px 20px 0;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:bold;color:${GREEN};">${escapeHtml(h.full_name)}</p>
          <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:${BROWN};">${escapeHtml(h.job_title)} &middot; ${escapeHtml(h.division)}</p>
          <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6c757d;">Started ${escapeHtml(h.start_date)}</p>
          <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#333333;">${escapeHtml(h.intro)}</p>
          ${funFact}
        </td>
      </tr>`;
  }).join('\n');

  const dateLine = sendDate ? `<p style="margin:6px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#d8f3dc;">${escapeHtml(sendDate)}</p>` : '';

  return `<!-- GreenPass eDM -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background-color:${GREEN};padding:32px 24px;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:2px;color:#95d5b2;text-transform:uppercase;">National Parks Board</p>
            <h1 style="margin:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:28px;color:#ffffff;">Welcome to the NParks Family 🌿</h1>
            <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#d8f3dc;">${escapeHtml(occasion)}</p>
            ${dateLine}
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#333333;">We're delighted to welcome our newest colleagues to the NParks family! Please take a moment to get to know them below — we hope you'll give them a warm welcome as we keep growing together.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 8px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;">
              ${rows}
            </table>
          </td>
        </tr>
        <tr>
          <td style="background-color:${GREEN};padding:24px;text-align:center;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-style:italic;color:#ffffff;">Growing together, one green space at a time. 🌳</p>
            <p style="margin:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#95d5b2;">National Parks Board (NParks), Singapore &middot; Making Singapore our City in Nature</p>
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
  const bpp = 3; // RGB
  const raw = Buffer.alloc((width * bpp + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * bpp + 1);
    raw[rowStart] = 0; // filter type 0
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Serve the built front-end in production (dist/) ──────────────────────────
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Only start listening when run directly (not when imported by the seed script).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`\n🌿 GreenPass API running on http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('   ⚠  ANTHROPIC_API_KEY not set — AI moderation will mark entries for manual review.');
    }
  });
}

export { buildEdmHtml, makeSeedPng, DB_PATH, UPLOAD_DIR };
