// ─────────────────────────────────────────────────────────────────────────────
// NParks Internal Opportunities — eDM Generator (self-contained server)
//
// A single Node/Express server that:
//   • retrieves currently open NParks vacancies from Careers@Gov
//     (best-effort, with a bundled sample fallback),
//   • generates a concise, faithful one-line summary per role
//     (via Claude if ANTHROPIC_API_KEY is set, else a local extractive fallback),
//   • serves a lightweight admin page (no build step required), and
//   • builds an Outlook-ready HTML eDM that HR can copy and paste into Outlook.
//
// Persistence is Neon PostgreSQL. The connection string is read from
// process.env.DATABASE_URL (set automatically by Rabbit Deploy when you attach
// a Neon database) and never reaches the browser.
//
// Deploy on Rabbit: upload server.js + package.json. Rabbit runs `npm start`.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import pg from 'pg';

// ── Configuration (all via environment variables) ────────────────────────────
const CONFIG = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  useSsl: process.env.PGSSL !== 'disable', // Neon requires SSL (default on)
  careersAgency: process.env.CAREERS_AGENCY || 'National Parks Board',
  careersBaseUrl: process.env.CAREERS_BASE_URL || 'https://www.careers.gov.sg',
  // The real Careers@Gov listings endpoint (an OData JSON service on the "HRP"
  // platform) is not publicly published, so this MUST be supplied via the
  // CAREERS_SEARCH_URL env var to sweep live data. The parser understands the
  // real HRP fields (Jobtitle/Agncy/Endda/Jobdesc) and OData envelopes. Without
  // a working endpoint the app falls back to the bundled sample dataset.
  careersSearchUrl: process.env.CAREERS_SEARCH_URL || '',
  useSampleFallback: process.env.USE_SAMPLE_FALLBACK !== 'false',
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 20000),
  maxVacancies: Number(process.env.MAX_VACANCIES || 60),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
  anthropicVersion: '2023-06-01',
  summaryMinWords: Number(process.env.SUMMARY_MIN_WORDS || 25),
  summaryMaxWords: Number(process.env.SUMMARY_MAX_WORDS || 40),
};

const AI_ENABLED = Boolean(CONFIG.anthropicApiKey);

// ── Database pool ────────────────────────────────────────────────────────────
const pool = CONFIG.databaseUrl
  ? new pg.Pool({
      connectionString: CONFIG.databaseUrl,
      ssl: CONFIG.useSsl ? { rejectUnauthorized: false } : false,
      max: 5,
    })
  : null;

if (!pool) {
  console.warn(
    '[server] DATABASE_URL is not set — attach a Neon database. The app will ' +
      'start but data cannot be stored until a database is connected.',
  );
}

async function ensureSchema() {
  if (!pool) return;
  await pool.query(`
    create table if not exists vacancies (
      id             serial primary key,
      external_id    text unique not null,
      title          text not null,
      division       text default '',
      closing_date   text default '',
      description    text default '',
      apply_url      text default '',
      summary        text default '',
      summary_edited boolean default false,
      hidden         boolean default false,
      display_order  integer default 0,
      is_open        boolean default true,
      created_at     timestamptz default now(),
      updated_at     timestamptz default now(),
      last_seen_at   timestamptz default now()
    );
  `);
  console.log('[server] schema ready');
}

// ── Bundled sample data (used when Careers@Gov is unreachable) ────────────────
const SAMPLE_VACANCIES = [
  {
    title: 'Senior Executive, Community Partnerships',
    division: 'Community Engagement Division',
    closing_date: '2026-08-22',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      "Partner with community stakeholders to deliver engagement programmes that strengthen public participation across NParks' initiatives. You will build and maintain relationships with grassroots organisations, schools and interest groups, plan and execute community events, and support volunteer management. The role requires strong interpersonal and project management skills and a passion for nature and community building.",
  },
  {
    title: 'Manager, Urban Ecology',
    division: 'National Biodiversity Centre',
    closing_date: '2026-08-15',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      "Join the National Biodiversity Centre to advance Singapore's City in Nature vision. You will design and implement urban ecology studies, analyse biodiversity data, and translate research findings into practical greening and habitat enhancement recommendations. Responsibilities include managing field surveys, collaborating with landscape and planning teams, and preparing technical reports.",
  },
  {
    title: 'Executive, Arboriculture',
    division: 'Streetscape Division',
    closing_date: '2026-08-30',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      "Support the management of Singapore's roadside greenery and tree population. You will conduct tree inspections, coordinate maintenance and pruning works with contractors, maintain the tree management system, and respond to feedback on tree-related matters. The role suits someone with knowledge of arboriculture practices and a keen eye for public safety and greenery health.",
  },
  {
    title: 'Lead, Digital Products',
    division: 'Digital & Data Division',
    closing_date: '2026-09-05',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      "Lead the design and delivery of citizen-facing digital products that make it easier for the public to enjoy Singapore's parks and nature. You will own the product roadmap, work with designers and engineers in an agile team, gather user insights, and prioritise features that improve accessibility and engagement.",
  },
  {
    title: 'Executive, Nature Education',
    division: 'Learning & Outreach Division',
    closing_date: '2026-08-18',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      'Develop and deliver nature education programmes for schools and the public that inspire appreciation for biodiversity and the environment. You will create learning resources, conduct guided walks and workshops, train volunteer guides, and evaluate programme outcomes.',
  },
  {
    title: 'Senior Executive, HR Business Partner',
    division: 'Human Resource Division',
    closing_date: '2026-09-12',
    apply_url: 'https://www.careers.gov.sg/',
    description:
      'Partner with line divisions to deliver people strategies covering manpower planning, talent management, employee engagement and organisational development. You will advise managers on HR policies, support recruitment and onboarding, and drive initiatives that strengthen NParks as an employer of choice.',
  },
];

// ── Small utilities ───────────────────────────────────────────────────────────
function clean(text) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim();
}

function makeExternalId(title, applyUrl) {
  // Stable id for de-duplication. Combining title + application URL means a
  // genuinely repeated posting (same title AND link) collapses to one record,
  // while distinct roles that happen to share a generic link stay separate.
  const basis = ((title || '') + '::' + (applyUrl || '')).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = (hash * 31 + basis.charCodeAt(i)) >>> 0;
  }
  return 'v_' + hash.toString(16);
}

function parseDate(value) {
  const v = clean(value);
  if (!v) return null;
  // OData/HRP dates look like "/Date(1699999999000)/" (epoch milliseconds).
  const odata = /\/Date\((\d+)/.exec(v);
  if (odata) return new Date(Number(odata[1]));
  // Accept ISO and a few common formats.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(v);
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const parsed = new Date(v);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Format a parsed date back to a clean YYYY-MM-DD for display.
function formatDate(value) {
  const d = parseDate(value);
  if (!d) return clean(value);
  return d.toISOString().slice(0, 10);
}

function isOpen(closingDate) {
  // Unknown/empty dates are treated as open so valid postings are not dropped.
  if (!closingDate) return true;
  const d = parseDate(closingDate);
  if (!d) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Careers@Gov retrieval ─────────────────────────────────────────────────────
//
// Careers@Gov is a dynamic app whose search endpoint/markup are not a stable
// public API and may change. We attempt a best-effort JSON request; on any
// failure we fall back to the bundled sample dataset (if enabled) so the tool
// stays usable. Only OPEN, de-duplicated vacancies are returned.
async function fetchLiveVacancies() {
  if (!CONFIG.careersSearchUrl) {
    throw new Error('CAREERS_SEARCH_URL is not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    const url = new URL(CONFIG.careersSearchUrl);
    url.searchParams.set('agency', CONFIG.careersAgency);
    url.searchParams.set('status', 'open');
    url.searchParams.set('limit', String(CONFIG.maxVacancies));
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NParks-eDM-Generator/1.0 (internal-mobility-tool)',
      },
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    return normaliseJson(data);
  } finally {
    clearTimeout(timer);
  }
}

function firstOf(rec, keys, fallback = '') {
  for (const k of keys) {
    if (rec[k]) return rec[k];
  }
  return fallback;
}

// Locate the array of job records inside a variety of response envelopes.
// Handles plain arrays, common REST keys, OData v4 ({ value: [] }) and
// OData v2 ({ d: { results: [] } } or { d: [] }) — the last two are what the
// Careers@Gov "HRP" platform uses.
function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return null;
  if (data.d && Array.isArray(data.d.results)) return data.d.results; // OData v2
  if (Array.isArray(data.d)) return data.d;
  for (const key of ['value', 'results', 'jobs', 'jobPostings', 'data', 'items', 'hits']) {
    if (Array.isArray(data[key])) return data[key];
  }
  return null;
}

// Field-name candidates cover our generic shape AND the real Careers@Gov (HRP)
// OData fields (Jobtitle, Agncy, Endda, Jobdesc) as used by opengovsg's
// careersgovsg-jobs-data project.
function normaliseJson(data) {
  const records = extractRecords(data);
  if (!records) return [];

  const agencyNeedle = (CONFIG.careersAgency || '').toLowerCase().trim();
  const out = [];
  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;
    const title = clean(firstOf(rec, ['Jobtitle', 'title', 'jobTitle', 'positionTitle', 'name']));
    if (!title) continue;

    // If the record carries an agency and we have a filter, keep NParks only.
    const agency = clean(firstOf(rec, ['Agncy', 'agency', 'agencyName', 'agencydesc', 'company_name']));
    if (agencyNeedle && agency) {
      const a = agency.toLowerCase();
      if (!a.includes(agencyNeedle) && !a.includes('nparks') && !a.includes('national parks')) {
        continue;
      }
    }

    let applyUrl = firstOf(rec, ['applyUrl', 'url', 'link', 'jobUrl', 'externalPath', 'absolute_url']);
    if (applyUrl && applyUrl.startsWith('/')) applyUrl = CONFIG.careersBaseUrl + applyUrl;

    out.push({
      title,
      division: clean(firstOf(rec, ['Dept', 'department', 'division', 'businessUnit', 'team'])) || agency,
      closing_date: formatDate(firstOf(rec, ['Endda', 'closingDate', 'closing_date', 'expiryDate', 'endDate', 'application_deadline'])),
      description: clean(firstOf(rec, ['Jobdesc', 'description', 'jobDescription', 'content', 'summary', 'details'])),
      apply_url: applyUrl || CONFIG.careersBaseUrl,
    });
  }
  return out;
}

function postProcess(raw) {
  const seen = new Set();
  const result = [];
  for (const rec of raw) {
    if (!isOpen(rec.closing_date)) continue; // ignore expired/closed jobs
    const extId = makeExternalId(rec.title, rec.apply_url);
    if (seen.has(extId)) continue; // avoid duplicates
    seen.add(extId);
    result.push({ ...rec, external_id: extId });
    if (result.length >= CONFIG.maxVacancies) break;
  }
  return result;
}

async function retrieveVacancies() {
  // Returns { source: 'live' | 'sample', vacancies: [...] }
  try {
    const live = await fetchLiveVacancies();
    const processed = postProcess(live);
    if (processed.length > 0) return { source: 'live', vacancies: processed };
    throw new Error('No usable vacancies returned from live source');
  } catch (err) {
    console.warn('[scraper] live retrieval failed:', err.message);
    if (!CONFIG.useSampleFallback) throw err;
    const sample = SAMPLE_VACANCIES.map((v) => ({
      ...v,
      external_id: makeExternalId(v.title, v.apply_url),
    }));
    return { source: 'sample', vacancies: sample };
  }
}

// ── Summaries ──────────────────────────────────────────────────────────────────
function tidyOneLine(text) {
  return clean(text)
    .replace(/^summary\s*[:\-]\s*/i, '')
    .replace(/^["']|["']$/g, '')
    .trim();
}

function fallbackSummary(description) {
  const desc = clean(description);
  if (!desc) {
    return "An opportunity to contribute to NParks' mission across the organisation.";
  }
  const sentences = desc.split(/(?<=[.!?])\s+/);
  let summary = sentences[0] || desc;
  let words = summary.split(/\s+/);
  let idx = 1;
  while (words.length < CONFIG.summaryMinWords && idx < sentences.length) {
    summary = summary + ' ' + sentences[idx];
    words = summary.split(/\s+/);
    idx++;
  }
  if (words.length > CONFIG.summaryMaxWords) {
    summary = words.slice(0, CONFIG.summaryMaxWords).join(' ').replace(/[,;:]$/, '') + '…';
  }
  return tidyOneLine(summary);
}

async function aiSummary(title, division, description) {
  const prompt =
    'You are helping an HR team write an internal jobs newsletter for the ' +
    'National Parks Board (NParks).\n\n' +
    'Write ONE concise, engaging sentence (' +
    CONFIG.summaryMinWords +
    '-' +
    CONFIG.summaryMaxWords +
    ' words) summarising the role below for staff considering an internal move.\n\n' +
    'Rules:\n- Be factual and faithful to the job description.\n' +
    '- Do NOT invent responsibilities, requirements or details.\n' +
    '- No lists, no headings — one sentence.\n- Do not repeat the job title.\n\n' +
    'Job title: ' + title + '\nDivision: ' + (division || 'Not specified') +
    '\nJob description:\n' + description.slice(0, 4000) + '\n\nSummary:';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': CONFIG.anthropicApiKey,
        'anthropic-version': CONFIG.anthropicVersion,
      },
      body: JSON.stringify({
        model: CONFIG.anthropicModel,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error('Anthropic HTTP ' + resp.status);
    const data = await resp.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return tidyOneLine(text) || fallbackSummary(description);
  } finally {
    clearTimeout(timer);
  }
}

async function summarize(title, division, description) {
  if (AI_ENABLED) {
    try {
      return await aiSummary(title, division, description);
    } catch (err) {
      console.warn('[summary] Claude failed, using fallback:', err.message);
    }
  }
  return fallbackSummary(description);
}

// ── Refresh: retrieve + summarise + upsert ────────────────────────────────────
async function refreshVacancies() {
  if (!pool) throw new Error('no_database');
  const { source, vacancies } = await retrieveVacancies();

  const orderRes = await pool.query('select coalesce(max(display_order), -1) as m from vacancies');
  let nextOrder = orderRes.rows[0].m + 1;

  let created = 0;
  let updated = 0;
  const currentIds = [];

  for (const v of vacancies) {
    currentIds.push(v.external_id);
    const existing = await pool.query(
      'select id, summary_edited from vacancies where external_id = $1',
      [v.external_id],
    );

    if (existing.rows.length === 0) {
      const summary = await summarize(v.title, v.division, v.description);
      await pool.query(
        `insert into vacancies
           (external_id, title, division, closing_date, description, apply_url,
            summary, display_order, is_open, last_seen_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,true, now())`,
        [
          v.external_id, v.title, v.division || '', v.closing_date || '',
          v.description || '', v.apply_url || '', summary, nextOrder,
        ],
      );
      nextOrder++;
      created++;
    } else {
      // Preserve an HR-edited summary across refreshes.
      const keepSummary = existing.rows[0].summary_edited;
      const summary = keepSummary
        ? null
        : await summarize(v.title, v.division, v.description);
      await pool.query(
        `update vacancies set
           title = $2, division = $3, closing_date = $4, description = $5,
           apply_url = $6, is_open = true, last_seen_at = now(),
           updated_at = now(),
           summary = case when $7::boolean then summary else $8 end
         where external_id = $1`,
        [
          v.external_id, v.title, v.division || '', v.closing_date || '',
          v.description || '', v.apply_url || '', keepSummary, summary || '',
        ],
      );
      updated++;
    }
  }

  // Mark vacancies no longer present as closed + hidden (excluded from eDM).
  let closed = 0;
  if (currentIds.length > 0) {
    const res = await pool.query(
      `update vacancies set is_open = false, hidden = true, updated_at = now()
       where is_open = true and not (external_id = any($1::text[]))`,
      [currentIds],
    );
    closed = res.rowCount;
  }

  const message =
    source === 'sample'
      ? 'Loaded sample data (Careers@Gov was unreachable).'
      : 'Vacancies refreshed from Careers@Gov.';
  return { ok: true, source, total_found: vacancies.length, created, updated, closed, message };
}

// ── Outlook-compatible eDM builder ────────────────────────────────────────────
const EDM = {
  greenDark: '#1f5c3a', green: '#2e7d32', greenAccent: '#43a047',
  greenSoft: '#eef6ee', ink: '#2b2b2b', muted: '#5f6b62',
  border: '#dfe8e0', white: '#ffffff',
  font: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
};

function edmCard(v) {
  const title = escapeHtml(v.title);
  const summary = escapeHtml(v.summary);
  const meta = [];
  if (v.division) {
    meta.push(
      `<span style="color:${EDM.greenDark};font-weight:bold;">Division:</span> ` +
        `<span style="color:${EDM.muted};">${escapeHtml(v.division)}</span>`,
    );
  }
  if (v.closing_date) {
    meta.push(
      `<span style="color:${EDM.greenDark};font-weight:bold;">Closing date:</span> ` +
        `<span style="color:${EDM.muted};">${escapeHtml(v.closing_date)}</span>`,
    );
  }
  const metaHtml = meta.join('&nbsp;&nbsp;•&nbsp;&nbsp;');

  return `
    <tr>
      <td style="padding:0 0 20px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background-color:${EDM.white};border:1px solid ${EDM.border};border-radius:12px;border-collapse:separate;">
          <tr>
            <td style="padding:22px 24px;border-left:4px solid ${EDM.greenAccent};border-radius:12px;">
              <p style="margin:0 0 6px 0;font-family:${EDM.font};font-size:18px;line-height:24px;font-weight:bold;color:${EDM.greenDark};">${title}</p>
              <p style="margin:0 0 12px 0;font-family:${EDM.font};font-size:13px;line-height:18px;">${metaHtml}</p>
              <p style="margin:0;font-family:${EDM.font};font-size:15px;line-height:22px;color:${EDM.ink};">${summary}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildEdmHtml(vacancies) {
  let cards = vacancies.map(edmCard).join('');
  if (!cards) {
    cards = `<tr><td style="padding:0 0 20px 0;font-family:${EDM.font};font-size:15px;color:${EDM.muted};">
      There are no open vacancies to display at the moment. Please check back soon.</td></tr>`;
  }
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Explore Career Opportunities Within NParks</title>
  <!--[if mso]><style type="text/css">body,table,td,a{font-family:Arial,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${EDM.greenSoft};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EDM.greenSoft};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:600px;max-width:600px;background-color:${EDM.white};border-radius:16px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td style="background-color:${EDM.greenDark};padding:32px 28px;border-top-left-radius:16px;border-top-right-radius:16px;">
              <p style="margin:0;font-family:${EDM.font};font-size:24px;line-height:30px;font-weight:bold;color:${EDM.white};">🌿 Explore Career Opportunities Within NParks</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px 8px 28px;font-family:${EDM.font};font-size:15px;line-height:23px;color:${EDM.ink};">
              Looking for your next opportunity within NParks?<br><br>
              Explore our latest internal openings across the organisation. If a role interests you, simply have a conversation with your HR Business Partner to find out more.
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cards}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:${EDM.greenSoft};border-radius:12px;padding:20px 22px;font-family:${EDM.font};font-size:14px;line-height:21px;color:${EDM.greenDark};">
                    Interested in exploring a different career pathway within NParks?<br>
                    Have a chat with your HR Business Partner — they can tell you more and guide you on your next steps.
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0 0;font-family:${EDM.font};font-size:11px;line-height:16px;color:${EDM.muted};text-align:center;">This is an internal communication from the NParks HR team to support internal mobility.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Express app + API ─────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '512kb' }));

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error('[api error]', req.path, err.message);
    const code = err.message === 'no_database' ? 503 : 500;
    res.status(code).json({ error: err.message || 'server_error' });
  });

app.get('/api/health', (req, res) => res.json({ ok: true, db: Boolean(pool) }));

app.get(
  '/api/config',
  wrap(async (req, res) => {
    let total = 0;
    let visible = 0;
    if (pool) {
      const r = await pool.query(
        'select count(*)::int as total, count(*) filter (where hidden = false)::int as visible from vacancies',
      );
      total = r.rows[0].total;
      visible = r.rows[0].visible;
    }
    res.json({
      app_name: 'NParks Internal Opportunities eDM Generator',
      careers_agency: CONFIG.careersAgency,
      ai_summaries_enabled: AI_ENABLED,
      total_vacancies: total,
      visible_vacancies: visible,
    });
  }),
);

app.get(
  '/api/vacancies',
  wrap(async (req, res) => {
    if (!pool) return res.json([]);
    const r = await pool.query(
      'select * from vacancies order by display_order asc, id asc',
    );
    res.json(r.rows);
  }),
);

app.post(
  '/api/vacancies/refresh',
  wrap(async (req, res) => {
    const result = await refreshVacancies();
    res.json(result);
  }),
);

app.patch(
  '/api/vacancies/:id',
  wrap(async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'no_database' });
    const id = Number(req.params.id);
    const { summary, hidden, title, division, closing_date } = req.body || {};

    const sets = [];
    const params = [];
    let i = 1;
    if (summary !== undefined && summary !== null) {
      sets.push(`summary = $${i++}`, `summary_edited = true`);
      params.push(summary);
    }
    if (hidden !== undefined && hidden !== null) {
      sets.push(`hidden = $${i++}`);
      params.push(hidden);
    }
    if (title !== undefined && title !== null) {
      sets.push(`title = $${i++}`);
      params.push(title);
    }
    if (division !== undefined && division !== null) {
      sets.push(`division = $${i++}`);
      params.push(division);
    }
    if (closing_date !== undefined && closing_date !== null) {
      sets.push(`closing_date = $${i++}`);
      params.push(closing_date);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });
    sets.push('updated_at = now()');
    params.push(id);

    const r = await pool.query(
      `update vacancies set ${sets.join(', ')} where id = $${i} returning *`,
      params,
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(r.rows[0]);
  }),
);

app.post(
  '/api/vacancies/reorder',
  wrap(async (req, res) => {
    if (!pool) return res.status(503).json({ error: 'no_database' });
    const ids = (req.body && req.body.ordered_ids) || [];
    for (let idx = 0; idx < ids.length; idx++) {
      await pool.query('update vacancies set display_order = $1 where id = $2', [idx, ids[idx]]);
    }
    const r = await pool.query('select * from vacancies order by display_order asc, id asc');
    res.json(r.rows);
  }),
);

app.get(
  '/api/edm',
  wrap(async (req, res) => {
    let rows = [];
    if (pool) {
      const r = await pool.query(
        'select * from vacancies where hidden = false order by display_order asc, id asc',
      );
      rows = r.rows;
    }
    res.json({ html: buildEdmHtml(rows), vacancy_count: rows.length });
  }),
);

// ── Admin UI (served inline; no build step) ───────────────────────────────────
app.get('/', (req, res) => {
  res.type('html').send(ADMIN_HTML);
});

// ── Start ──────────────────────────────────────────────────────────────────────
ensureSchema()
  .catch((err) => console.error('[server] schema init failed:', err.message))
  .finally(() => {
    app.listen(CONFIG.port, () =>
      console.log(`[server] NParks eDM Generator listening on :${CONFIG.port}`),
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
// The admin page. Plain HTML + vanilla JS (string concatenation only — no
// template literals — so it coexists with this file's template strings).
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NParks eDM Generator — Admin</title>
<style>
  :root { --green:#2e7d32; --dark:#1f5c3a; --accent:#43a047; --soft:#eef6ee; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:'Segoe UI',system-ui,Arial,sans-serif; background:#f6f8f6; color:#243026; }
  .wrap { max-width:820px; margin:0 auto; padding:24px 16px 60px; }
  h1 { font-size:20px; color:var(--dark); margin:0 0 4px; display:flex; align-items:center; gap:8px; }
  .sub { color:#5f6b62; font-size:14px; margin:0 0 20px; }
  .bar { position:sticky; top:0; z-index:5; background:rgba(246,248,246,.94); backdrop-filter:blur(6px);
         padding:12px 0; margin-bottom:14px; border-bottom:1px solid #dfe8e0; display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  button { font:inherit; cursor:pointer; border-radius:9px; padding:9px 16px; border:1px solid transparent; }
  .btn-primary { background:var(--green); color:#fff; }
  .btn-primary:hover { background:var(--dark); }
  .btn-outline { background:#fff; color:var(--dark); border-color:var(--green); }
  .btn-ghost { background:#fff; color:#3a4a3d; border-color:#dfe8e0; }
  button:disabled { opacity:.5; cursor:default; }
  .meta { margin-left:auto; font-size:12px; color:#5f6b62; }
  .banner { padding:10px 14px; border-radius:9px; font-size:14px; margin-bottom:14px; }
  .banner.ok { background:var(--soft); color:var(--dark); }
  .banner.error { background:#fdecec; color:#b00000; }
  .banner.info { background:#fff6e5; color:#8a5a00; }
  .count { font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:#93a396; margin-bottom:10px; }
  .card { background:#fff; border:1px solid #e5efe6; border-radius:12px; padding:16px; margin-bottom:12px; }
  .card.hidden { opacity:.55; }
  .card-top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .title { font-weight:600; color:var(--dark); font-size:16px; margin:0; }
  .sub2 { font-size:12px; color:#6b776d; margin:2px 0 0; }
  .tag { display:inline-block; border-radius:5px; padding:1px 6px; font-size:10px; font-weight:600; margin-left:6px; }
  .tag.edited { background:#fdefc9; color:#8a6d00; }
  .tag.closed { background:#fbe0e0; color:#a11; }
  .controls { display:flex; gap:6px; flex-shrink:0; }
  .icon-btn { border:1px solid #e0e0e0; background:#fff; color:#556; padding:5px 9px; border-radius:7px; }
  .icon-btn:hover:not(:disabled){ background:#f4f4f4; }
  .toggle { border-radius:7px; padding:5px 12px; font-size:12px; font-weight:600; border:none; }
  .toggle.on { background:var(--soft); color:var(--dark); }
  .toggle.off { background:#eee; color:#556; }
  textarea { width:100%; margin-top:10px; border:1px solid #dcdcdc; border-radius:9px; padding:8px; font:inherit; font-size:14px; resize:vertical; }
  textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 2px rgba(67,160,71,.15); }
  .row-actions { display:flex; justify-content:space-between; align-items:center; margin-top:6px; }
  .wc { font-size:12px; color:#93a396; }
  .wc.warn { color:#c07800; }
  .save { background:var(--green); color:#fff; border:none; padding:5px 12px; font-size:12px; border-radius:7px; }
  .empty { border:1px dashed #cdd6ce; border-radius:12px; padding:40px; text-align:center; color:#6b776d; font-size:14px; }
  /* Preview modal */
  .modal { position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; padding:20px; z-index:20; }
  .modal.show { display:flex; }
  .modal-inner { background:#fff; border-radius:16px; max-width:760px; width:100%; margin:auto; display:flex; flex-direction:column; max-height:92vh; overflow:hidden; }
  .modal-head { display:flex; justify-content:space-between; align-items:center; padding:12px 18px; border-bottom:1px solid #eee; }
  iframe { border:0; flex:1; width:100%; min-height:420px; background:var(--soft); }
  .modal-foot { padding:8px 18px; border-top:1px solid #eee; font-size:12px; color:#6b776d; text-align:center; background:#fafafa; }
</style>
</head>
<body>
<div class="wrap">
  <h1><span>🌿</span> NParks Internal Opportunities — eDM Generator</h1>
  <p class="sub">Retrieve open NParks vacancies, tidy the summaries, then generate an Outlook-ready email to encourage internal mobility.</p>

  <div class="bar">
    <button id="btnRefresh" class="btn-outline">↻ Refresh Vacancies</button>
    <button id="btnPreview" class="btn-primary">Generate &amp; Preview eDM</button>
    <button id="btnCopy" class="btn-ghost">Copy HTML</button>
    <span id="meta" class="meta"></span>
  </div>

  <div id="banner"></div>
  <div id="count" class="count"></div>
  <div id="list"></div>
</div>

<div id="modal" class="modal">
  <div class="modal-inner">
    <div class="modal-head">
      <div>
        <strong style="color:var(--dark);font-size:14px;">eDM Preview</strong>
        <div id="previewCount" style="font-size:12px;color:#6b776d;"></div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btnCopyModal" class="btn-primary">Copy HTML</button>
        <button id="btnClose" class="btn-ghost">Close</button>
      </div>
    </div>
    <iframe id="frame" title="eDM preview" sandbox="allow-same-origin"></iframe>
    <div class="modal-foot">Tip: Click <strong>Copy HTML</strong>, open a new Outlook email, and paste (Ctrl/Cmd + V) into the body.</div>
  </div>
</div>

<script>
(function () {
  var api = {
    config: function(){ return fetch('/api/config').then(r=>r.json()); },
    list: function(){ return fetch('/api/vacancies').then(r=>r.json()); },
    refresh: function(){ return fetch('/api/vacancies/refresh',{method:'POST'}).then(handle); },
    patch: function(id,body){ return fetch('/api/vacancies/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(handle); },
    reorder: function(ids){ return fetch('/api/vacancies/reorder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ordered_ids:ids})}).then(handle); },
    edm: function(){ return fetch('/api/edm').then(handle); }
  };
  function handle(r){ if(!r.ok){ return r.json().catch(function(){return {};}).then(function(b){ throw new Error((b && b.error) || ('HTTP '+r.status)); }); } return r.json(); }

  var state = { vacancies: [], config: null, busy:false };
  var el = function(id){ return document.getElementById(id); };

  function banner(kind, text){
    var b = el('banner');
    b.className = 'banner ' + kind;
    b.textContent = text;
    setTimeout(function(){ if(b.textContent===text){ b.className=''; b.textContent=''; } }, 6000);
  }

  function wordCount(s){ s=(s||'').trim(); return s ? s.split(/\\s+/).length : 0; }

  function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }

  function render(){
    el('meta').textContent = state.config
      ? (state.config.ai_summaries_enabled ? 'AI summaries: on' : 'AI summaries: fallback')
      : '';
    var visible = state.vacancies.filter(function(v){ return !v.hidden; }).length;
    el('count').textContent = state.vacancies.length + ' vacancies · ' + visible + ' shown in eDM';

    var list = el('list');
    if (state.vacancies.length === 0){
      list.innerHTML = '<div class="empty">No vacancies yet. Click <strong>Refresh Vacancies</strong> to load the latest openings.</div>';
      return;
    }
    list.innerHTML = '';
    state.vacancies.forEach(function(v, i){
      var wc = wordCount(v.summary);
      var wcWarn = (wc < 25 || wc > 40);
      var card = document.createElement('div');
      card.className = 'card' + (v.hidden ? ' hidden' : '');
      card.innerHTML =
        '<div class="card-top">' +
          '<div style="min-width:0;">' +
            '<p class="title">' + esc(v.title) +
              (v.summary_edited ? '<span class="tag edited">edited</span>' : '') +
              (!v.is_open ? '<span class="tag closed">closed at source</span>' : '') +
            '</p>' +
            '<p class="sub2">' + esc(v.division || 'Division not specified') +
              (v.closing_date ? ' · Closes ' + esc(v.closing_date) : '') + '</p>' +
          '</div>' +
          '<div class="controls">' +
            '<button class="icon-btn" data-act="up" ' + (i===0?'disabled':'') + '>↑</button>' +
            '<button class="icon-btn" data-act="down" ' + (i===state.vacancies.length-1?'disabled':'') + '>↓</button>' +
            '<button class="toggle ' + (v.hidden?'off':'on') + '" data-act="toggle">' + (v.hidden?'Hidden':'Visible') + '</button>' +
          '</div>' +
        '</div>' +
        '<textarea rows="2" data-role="summary">' + esc(v.summary) + '</textarea>' +
        '<div class="row-actions">' +
          '<span class="wc ' + (wcWarn?'warn':'') + '" data-role="wc">' + wc + ' words ' + (wcWarn?'(aim 25–40)':'✓') + '</span>' +
          '<button class="save" data-act="save">Save summary</button>' +
        '</div>';

      var ta = card.querySelector('[data-role="summary"]');
      ta.addEventListener('input', function(){
        var n = wordCount(ta.value);
        var w = card.querySelector('[data-role="wc"]');
        var warn = (n<25||n>40);
        w.className = 'wc ' + (warn?'warn':'');
        w.textContent = n + ' words ' + (warn?'(aim 25–40)':'✓');
      });
      card.querySelector('[data-act="save"]').addEventListener('click', function(){ saveSummary(v.id, ta.value); });
      card.querySelector('[data-act="toggle"]').addEventListener('click', function(){ toggleHidden(v.id, !v.hidden); });
      card.querySelector('[data-act="up"]').addEventListener('click', function(){ move(i,-1); });
      card.querySelector('[data-act="down"]').addEventListener('click', function(){ move(i,1); });
      list.appendChild(card);
    });
  }

  function setBusy(b){ state.busy=b; ['btnRefresh','btnPreview','btnCopy'].forEach(function(id){ el(id).disabled=b; }); }

  function load(){
    return Promise.all([api.list(), api.config()]).then(function(res){
      state.vacancies = res[0]; state.config = res[1]; render();
    }).catch(function(e){ banner('error','Could not load data: '+e.message); });
  }

  function refresh(){
    setBusy(true); el('btnRefresh').textContent='Refreshing…';
    api.refresh().then(function(r){
      return load().then(function(){
        var s = r.total_found+' found · '+r.created+' new · '+r.updated+' updated · '+r.closed+' closed';
        banner(r.source==='sample'?'info':'ok', r.message+' ('+s+')');
      });
    }).catch(function(e){ banner('error','Refresh failed: '+e.message); })
      .then(function(){ setBusy(false); el('btnRefresh').textContent='↻ Refresh Vacancies'; });
  }

  function saveSummary(id, summary){
    api.patch(id,{summary:summary}).then(function(u){
      state.vacancies = state.vacancies.map(function(v){ return v.id===id?u:v; });
      render(); banner('ok','Summary saved.');
    }).catch(function(e){ banner('error','Save failed: '+e.message); });
  }

  function toggleHidden(id, hidden){
    api.patch(id,{hidden:hidden}).then(function(u){
      state.vacancies = state.vacancies.map(function(v){ return v.id===id?u:v; });
      render();
    }).catch(function(e){ banner('error','Update failed: '+e.message); });
  }

  function move(index, dir){
    var t=index+dir; if(t<0||t>=state.vacancies.length) return;
    var arr=state.vacancies.slice(); var tmp=arr[index]; arr[index]=arr[t]; arr[t]=tmp;
    state.vacancies=arr; render();
    api.reorder(arr.map(function(v){return v.id;})).catch(function(e){ banner('error','Reorder failed: '+e.message); load(); });
  }

  function copyHtml(html){
    if (navigator.clipboard && typeof navigator.clipboard.write==='function' && window.ClipboardItem){
      var item = new ClipboardItem({
        'text/html': new Blob([html],{type:'text/html'}),
        'text/plain': new Blob([html],{type:'text/plain'})
      });
      return navigator.clipboard.write([item]);
    }
    return navigator.clipboard.writeText(html);
  }

  function generate(){
    setBusy(true); el('btnPreview').textContent='Generating…';
    return api.edm().then(function(r){ return r; })
      .catch(function(e){ banner('error','Generate failed: '+e.message); return null; })
      .then(function(r){ setBusy(false); el('btnPreview').textContent='Generate & Preview eDM'; return r; });
  }

  var lastHtml = '';
  function preview(){
    generate().then(function(r){
      if(!r) return;
      lastHtml = r.html;
      el('previewCount').textContent = r.vacancy_count + (r.vacancy_count===1?' vacancy':' vacancies') + ' included';
      var doc = el('frame').contentDocument;
      doc.open(); doc.write(r.html); doc.close();
      el('modal').classList.add('show');
    });
  }

  function copyFromToolbar(){
    generate().then(function(r){
      if(!r) return;
      copyHtml(r.html).then(function(){ banner('ok','eDM copied — paste into a new Outlook email.'); })
        .catch(function(){ lastHtml=r.html; el('modal').classList.add('show');
          var doc=el('frame').contentDocument; doc.open(); doc.write(r.html); doc.close();
          banner('info','Clipboard blocked — use Copy HTML in the preview.'); });
    });
  }

  el('btnRefresh').addEventListener('click', refresh);
  el('btnPreview').addEventListener('click', preview);
  el('btnCopy').addEventListener('click', copyFromToolbar);
  el('btnClose').addEventListener('click', function(){ el('modal').classList.remove('show'); });
  el('btnCopyModal').addEventListener('click', function(){
    copyHtml(lastHtml).then(function(){ banner('ok','eDM copied — paste into a new Outlook email.'); el('modal').classList.remove('show'); })
      .catch(function(){ banner('error','Copy failed — select the preview and copy manually.'); });
  });

  load();
})();
</script>
</body>
</html>`;
