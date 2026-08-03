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

## Sweeping live Careers@Gov data

To pull **real** NParks vacancies you must:

1. **Set `CAREERS_SEARCH_URL`** to the real Careers@Gov listings endpoint. The
   portal's applicant system ("HRP") exposes an **OData JSON API**; the exact
   base URL is not publicly published (the reference project
   [`opengovsg/careersgovsg-jobs-data`](https://github.com/opengovsg/careersgovsg-jobs-data)
   keeps it as a private repository secret), so it must be supplied via this
   env var. `server.js` already understands the real HRP field names
   (`Jobtitle`, `Agncy`, `Endda`, `Jobdesc`) and OData response envelopes
   (`{ d: { results: [] } }` / `{ value: [] }`), so no code changes are needed
   once the URL is provided.
2. **Run where the network allows `careers.gov.sg`.** Rabbit Deploy can reach it;
   sandboxed/dev environments may not.

What the scraper does with a live endpoint:

- filters to the configured agency (`CAREERS_AGENCY`, default *National Parks
  Board*) using the record's agency field,
- drops expired/closed roles (by `Endda` / closing date),
- de-duplicates, caps at `MAX_VACANCIES`, and normalises OData dates.

If `CAREERS_SEARCH_URL` is blank, the endpoint is unreachable, or it returns
nothing usable, the app falls back to the **bundled sample dataset** (unless
`USE_SAMPLE_FALLBACK=false`). The admin UI's refresh banner shows whether data
came from the **live** source or the **sample** fallback, and all retrieval
steps are logged.

> Some agencies also post via Workday
> (`sggovterp…myworkdayjobs.com/PublicServiceCareers`), Greenhouse or Workable.
> If NParks roles live on one of those instead, point `CAREERS_SEARCH_URL` at
> that board's JSON API — the parser already recognises common fields
> (`title`, `content`, `application_deadline`, `absolute_url`, `externalPath`).
