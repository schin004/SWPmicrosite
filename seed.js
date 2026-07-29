// ─────────────────────────────────────────────────────────────────────────────
// GreenPass — database seed
//
// Ensures the schema exists, then inserts three example submissions (if the
// table is empty) so the admin dashboard is never empty on first run:
//   1. awaiting-hr-review with a CLEAR AI result
//   2. awaiting-hr-review with a FLAGGED AI result
//   3. fully APPROVED, with job title & division already filled in by HR
//
// Reads DATABASE_URL (and PGSSL) exactly like the server. Run with:
//   npm run seed
// On Rabbit, either run this as a one-off command against the attached database,
// or set SEED_DEMO=1 in the service env to seed automatically on first boot.
// ─────────────────────────────────────────────────────────────────────────────

import { ensureSchema, seedIfEmpty, pool } from './server.js';

if (!pool) {
  console.error('[seed] DATABASE_URL is not set — nothing to seed. Set it in your .env or Rabbit env.');
  process.exit(1);
}

await ensureSchema();
const result = await seedIfEmpty();
if (result.seeded) {
  console.log(`[seed] Inserted ${result.count} example submissions (with avatar photos). 🌱`);
} else {
  console.log(`[seed] Skipped — ${result.reason}.`);
}
await pool.end();
process.exit(0);
