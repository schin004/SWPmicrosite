# GreenPass — single-file edition (for Rabbit Deploy)

This folder is the **whole GreenPass app in one Node file** — no build step, no
separate front-end bundle. It follows the same shape as the Future of Work Hub's
`rabbit-app-noscript` server: every page is rendered as HTML on the server,
forms submit normally, and all data (including profile photos) lives in the
PostgreSQL database from `DATABASE_URL`.

Use this version when your host wants individual code files rather than a React
build. (The repo root also contains the richer React + Vite version; both talk
to the same kind of Postgres database.)

## Files

| File | What it is |
| --- | --- |
| `server.js` | The entire app: submit portal, HR admin dashboard, AI moderation, eDM generator, and photo storage/serving. |
| `package.json` | Declares the three dependencies (`express`, `pg`, `multer`) and `start`. |

## Deploy on Rabbit

1. Create a Rabbit service and add these two files (`server.js` + `package.json`).
2. **Create / attach a database** — Rabbit sets `DATABASE_URL` automatically. The
   server creates its tables (`submissions`, `edm_archive`) on startup.
3. Set the service **environment variables**:
   - `ANTHROPIC_API_KEY` — Claude API key for AI moderation (optional; without it,
     submissions are simply marked “⚠️ Review Needed” for manual HR review).
   - `ADMIN_PASSWORD` — HR dashboard password (default `nparks-admin` — change it).
   - `SEED_DEMO=1` — optional; loads 3 example submissions on first boot when the
     database is empty. Leave unset for a clean production database.
4. Rabbit provides `PORT`; the server already reads `process.env.PORT`.

Rabbit runs `npm install` then `node server.js` (the `start` script).

## Run locally

```bash
cd greenpass-rabbit
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/greenpass PGSSL=disable \
  ADMIN_PASSWORD=nparks-admin SEED_DEMO=1 npm start
# open http://localhost:3000  (portal /submit · admin /admin)
```

## Routes

- `/` landing · `/submit` new-joiner form · `/submit/thanks` confirmation
- `/admin` review (login-gated) · `/admin/edm` generate eDM · `/admin/archive` log
- `/api/photo/:id` serves a stored photo · `/api/health` health check
