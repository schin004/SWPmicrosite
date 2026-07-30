# NParks eDM Generator — Rabbit Deploy build (Node + Neon)

This folder is a **self-contained Node/Express app** for Rabbit Deploy. It is
functionally identical to the FastAPI version in `../backend`, but packaged the
way your other microsite is deployed: a single `server.js` that serves the admin
UI **and** the `/api` endpoints, backed by **Neon PostgreSQL**.

> Only two files are needed to deploy: **`server.js`** and **`package.json`**.
> The admin UI is served inline — there is **no separate frontend build step**.

## Deploy on Rabbit

1. Upload this folder's `server.js` and `package.json` (the `.env.example` is
   just reference).
2. Create/attach a **Neon** database — Rabbit sets `DATABASE_URL` automatically.
3. Rabbit runs `npm install` then `npm start` (`node server.js`).
4. Open the app URL → click **Refresh Vacancies** → tidy summaries → hide /
   reorder as needed → **Generate & Preview eDM** → **Copy HTML** → paste into a
   new Outlook email.

The database schema (`vacancies` table) is created automatically on startup and
is safe to run repeatedly (idempotent).

## Run locally

```bash
npm install
DATABASE_URL="postgres://user:pass@host/db?sslmode=require" npm start
# open http://localhost:3000
```

For a local Postgres without SSL, add `PGSSL=disable`.

## Endpoints

| Method | Path                     | Description                                   |
| ------ | ------------------------ | --------------------------------------------- |
| GET    | `/`                      | Admin UI (served inline).                     |
| GET    | `/api/health`            | Liveness + DB-connected flag.                 |
| GET    | `/api/config`            | Config + vacancy counts.                      |
| GET    | `/api/vacancies`         | All vacancies (admin, includes hidden).       |
| POST   | `/api/vacancies/refresh` | Retrieve + upsert current open vacancies.     |
| PATCH  | `/api/vacancies/:id`     | Edit summary / visibility / core fields.      |
| POST   | `/api/vacancies/reorder` | Set display order from an ordered id list.    |
| GET    | `/api/edm`               | Generate the Outlook-ready eDM HTML.          |

## Configuration

All via environment variables — see `.env.example`. Highlights:

- `DATABASE_URL` — Neon connection string (auto-set by Rabbit).
- `PGSSL=disable` — only for a local non-SSL Postgres.
- `ANTHROPIC_API_KEY` — enables Claude-written summaries; without it, a local
  extractive fallback is used (faithful to the source, never invents content).
- `USE_SAMPLE_FALLBACK=true` — serve bundled sample vacancies when Careers@Gov
  is unreachable (e.g. restricted network), so the tool is always demonstrable.

## Note on the Careers@Gov source

Careers@Gov is a dynamic app whose search endpoint/markup are **not a
documented, stable public API** and can change without notice. `server.js` makes
a best-effort JSON request to `CAREERS_SEARCH_URL`, filters to open vacancies and
de-duplicates; if that fails it falls back to the bundled sample dataset. When
deploying with real network access to Careers@Gov, verify/adjust
`CAREERS_SEARCH_URL` (and the `normaliseJson` mapping in `server.js`) against the
live portal. Retrieval steps are logged, and the admin UI shows whether data came
from the **live** source or the **sample** fallback.
