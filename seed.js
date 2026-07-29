// ─────────────────────────────────────────────────────────────────────────────
// GreenPass — database seed
//
// Populates the SQLite database with three example submissions so the admin
// dashboard is never empty on first run:
//   1. awaiting-hr-review with a CLEAR AI result
//   2. awaiting-hr-review with a FLAGGED AI result
//   3. fully APPROVED, with job title & division already filled in by HR
//
// Run with:  npm run seed   (or automatically on first `npm start`)
// ─────────────────────────────────────────────────────────────────────────────

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { makeSeedPng, DB_PATH, UPLOAD_DIR } from './server.js';

const db = new DatabaseSync(DB_PATH);
const now = () => new Date().toISOString();

const count = db.prepare('select count(*) as n from submissions').get().n;
if (count > 0) {
  console.log(`[seed] Database already has ${count} submission(s) — skipping seed.`);
  process.exit(0);
}

// Generate three simple solid-colour avatar PNGs so the seed rows have real,
// self-contained photos (no binary assets committed to the repo).
function writeAvatar(name, rgb) {
  const file = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(file, makeSeedPng(240, 240, rgb));
  return `/uploads/${name}`;
}

const photoAmara = writeAvatar('seed-amara.png', [45, 106, 79]);   // forest green
const photoWei = writeAvatar('seed-weijie.png', [107, 66, 38]);    // earthy brown
const photoPriya = writeAvatar('seed-priya.png', [149, 213, 178]); // light sage

const insert = db.prepare(`
  insert into submissions
    (full_name, start_date, photo_path, intro, fun_fact, status,
     job_title, division, ai_status, ai_confidence, ai_reason,
     photo_status, photo_reason, created_at, updated_at)
  values (@full_name, @start_date, @photo_path, @intro, @fun_fact, @status,
     @job_title, @division, @ai_status, @ai_confidence, @ai_reason,
     @photo_status, @photo_reason, @created_at, @updated_at)
`);

const ts = now();

// 1 — awaiting HR review, clear AI result
insert.run({
  full_name: 'Amara Tan',
  start_date: '2025-07-14',
  photo_path: photoAmara,
  intro: "Hello everyone! I'm Amara, joining NParks after five years in urban landscape design. I'm passionate about pollinator gardens and can't wait to help make our parks even more welcoming for people and wildlife alike. Looking forward to meeting you all on the trails!",
  fun_fact: 'I once cycled the entire Round Island Route in a single day.',
  status: 'awaiting-hr-review',
  job_title: null,
  division: null,
  ai_status: 'clear',
  ai_confidence: 96,
  ai_reason: 'The introduction is warm, professional, and free of sensitive personal information.',
  photo_status: 'manual-review',
  photo_reason: 'Photo is a valid 240x240px image. Please visually verify it is appropriate before approving.',
  created_at: ts,
  updated_at: ts,
});

// 2 — awaiting HR review, flagged AI result (contains sensitive info)
insert.run({
  full_name: 'Wei Jie Lim',
  start_date: '2025-07-21',
  photo_path: photoWei,
  intro: "Hi team! I'm Wei Jie. I live at 42 Sunbird Avenue and you can always reach me on my mobile at 9123 4567. I'm currently managing a chronic back condition so I may need to sit during long outdoor events, but I'm thrilled to be here and love birdwatching at Sungei Buloh!",
  fun_fact: 'I have spotted over 200 bird species across Singapore.',
  status: 'awaiting-hr-review',
  job_title: null,
  division: null,
  ai_status: 'flagged',
  ai_confidence: 92,
  ai_reason: 'The text discloses a home address, a personal mobile number, and a medical condition that should not appear in a mass email.',
  photo_status: 'manual-review',
  photo_reason: 'Photo is a valid 240x240px image. Please visually verify it is appropriate before approving.',
  created_at: ts,
  updated_at: ts,
});

// 3 — fully approved, HR fields filled in
insert.run({
  full_name: 'Priya Nair',
  start_date: '2025-06-30',
  photo_path: photoPriya,
  intro: "Hello NParks family! I'm Priya, and I'm delighted to be joining the conservation team. My background is in freshwater ecology, and I'm especially excited about our habitat restoration work. I believe every small green space makes a difference — see you out in the field!",
  fun_fact: 'I keep a balcony full of native ferns at home.',
  status: 'approved',
  job_title: 'Senior Conservation Officer',
  division: 'National Biodiversity Centre',
  ai_status: 'clear',
  ai_confidence: 98,
  ai_reason: 'A professional, enthusiastic introduction with no sensitive or off-topic content.',
  photo_status: 'manual-review',
  photo_reason: 'Photo is a valid 240x240px image. Please visually verify it is appropriate before approving.',
  created_at: ts,
  updated_at: ts,
});

console.log('[seed] Inserted 3 example submissions and 3 avatar photos. 🌱');
process.exit(0);
