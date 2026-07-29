# 🌿 GreenPass — NParks New-Hire Welcome Portal

A warm, park-noticeboard-style welcome app for the **National Parks Board (NParks), Singapore**.
GreenPass has two sides with a clear two-stage handoff:

1. **New Hire Submission Portal (`/submit`)** — new joiners share their own details, photo and introduction.
2. **HR Admin Dashboard (`/admin`)** — HR reviews each submission (assisted by AI content moderation),
   adds the **Job Title** and **Division**, approves it, and generates a polished welcome **eDM**.

> Job Title and Division are **added by HR** — new joiners never fill those in. This handoff is
> reflected in the data model, the status labels (`awaiting-hr-review` → `approved` / `rejected`)
> and throughout the UI.

---

## ✨ Features

- **Submission portal** — full name, start date, profile photo (JPG/PNG ≤ 5MB with live preview),
  personal introduction (character count + 300-word soft limit warning) and an optional fun fact.
  A warm, illustrated confirmation screen on submit.
- **AI content moderation** — each introduction is checked by the Claude API
  (`claude-3-5-haiku-20241022`) and shown as a colour-coded badge (`✅ Clear`, `⚠️ Review Needed`,
  `🚫 Flagged`) with a one-sentence explanation. Photos get basic client- and server-side checks
  (valid image, < 5MB, ≥ 100×100px) and are always flagged for a quick manual HR eyeball.
- **Admin dashboard** with three tabs:
  - **Review Submissions** — cards grouped by status, with HR-only Job Title / Division fields
    (clearly tagged **“Added by HR”**). Approve is disabled until both are filled in. Reject and
    full Edit are available too.
  - **Generate eDM** — pick approved joiners, set an occasion label and date, and generate an
    Outlook-ready HTML email with a **Copy to Clipboard** button.
  - **Archive** — a read-only log of every eDM generated, with dates and included staff.
- **Outlook-safe eDM** — table-based layout, **all CSS inlined** (no `<style>` blocks), circular
  photos embedded as base64 data URIs, alternating white / light-sage rows, green header & footer.
- **Green & nature theme** — deep forest green, light sage, warm cream and earthy-brown accents,
  Nunito/Lato typography, and subtle botanical SVG motifs throughout.

---

## 🧰 Tech Stack

- **Frontend:** React 19 + Vite + Tailwind CSS (React Router for `/submit` and `/admin`)
- **Backend:** Node.js + Express — serves the built `dist/` **and** the `/api` endpoints on one port
- **Database:** PostgreSQL (Neon on Rabbit Deploy) via `DATABASE_URL`, `pg` connection pool
- **Photo storage:** uploaded photos are stored **in the database** (`bytea`) and served from
  `/api/photo/:id` — nothing is written to the container filesystem, so redeploys never lose data
- **AI:** Claude API for introduction moderation

> Works on Node.js 18+ (uses the built-in global `fetch`). The container image uses Node 20.

---

## 🚀 Getting Started (local development)

You need a PostgreSQL database. On Rabbit this is attached automatically; locally, point
`DATABASE_URL` at any Postgres instance (or a free Neon database).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   set DATABASE_URL (required), and optionally ANTHROPIC_API_KEY / ADMIN_PASSWORD.
#   For a local Postgres without SSL, also set PGSSL=disable.

# 3. Seed the three demo submissions (optional, but handy)
npm run seed

# 4. Run the API + frontend together (Vite proxies /api to the API server)
npm run dev
```

Then open **http://localhost:5173** — new-hire portal at `/submit`, HR dashboard at `/admin`.

`npm run dev` runs two processes together via `concurrently`:

| Process | Port | Role |
| --- | --- | --- |
| Express API (`server.js`) | `3000` | Database, photos, moderation, eDM generation |
| Vite dev server | `5173` | React frontend (proxies `/api` to the API) |

### Production-style single-port run

```bash
npm run serve   # builds the frontend, then serves everything from Express on :3000
```

`npm start` (used by the container) is just `node server.js`: it serves the prebuilt `dist/` and the
API together on `PORT` (default `3000`), exactly as on Rabbit.

---

## 🔐 Configuration (`.env`)

Copy `.env.example` to `.env` and set:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | _(unset)_ | PostgreSQL connection string. **Set automatically by Rabbit** when you attach a database. |
| `PGSSL` | _(SSL on)_ | Set to `disable` only for a local Postgres without SSL. Leave unset for Neon. |
| `ANTHROPIC_API_KEY` | _(unset)_ | Claude API key — powers AI moderation. Get one at [console.anthropic.com](https://console.anthropic.com/). |
| `ADMIN_PASSWORD` | `nparks-admin` | Shared HR password for the `/admin` dashboard. |
| `SEED_DEMO` | _(off)_ | Set to `1` to seed the 3 demo submissions on startup when the database is empty. |
| `PORT` | `3000` | Port the server listens on. **Provided automatically by Rabbit.** |

**About the Claude API key:** if `ANTHROPIC_API_KEY` is not set, GreenPass still works — submissions
are accepted and simply marked **⚠️ Review Needed** so HR reviews them manually. Add a key to enable
automatic first-pass moderation.

**Admin password:** the default is `nparks-admin`. Change it via `ADMIN_PASSWORD`.

---

## 🐇 Deploying to Rabbit Deploy

GreenPass follows the same conventions as the Future of Work Hub, so deployment is the same flow:

1. **Push this repo** and point a Rabbit service at it. Rabbit builds the included `Dockerfile`
   (`npm install` → `npm run build` → `node server.js`).
2. **Create / attach a database.** Rabbit injects `DATABASE_URL` automatically; the server creates
   its schema (`submissions`, `edm_archive`) on startup — no migration step needed.
3. **Set the service environment variables** in Rabbit:
   - `ANTHROPIC_API_KEY` — your Claude key (for AI moderation).
   - `ADMIN_PASSWORD` — the HR dashboard password (change it from the default!).
   - `SEED_DEMO=1` — *optional*, only if you want the 3 demo submissions inserted on first boot.
     Leave it unset for a clean production database.
4. Rabbit provides `PORT` and routes traffic to it — the server already reads `process.env.PORT`.

Everything (frontend, API, photos, generated eDMs) runs from the single Node service backed by the
attached Postgres database. Because photos live in the database rather than on disk, redeploys and
restarts never lose uploaded content.

> **Note:** the `/admin` dashboard and the submission API require the Node server. The
> `.github/workflows/deploy.yml` GitHub Pages workflow only publishes the static frontend, which
> has no backend — use **Rabbit** (or any Docker/Node host) for the full app.

---

## 🌱 Seed Data

Three example submissions are available so the dashboard is never empty on first run:

1. **Amara Tan** — `awaiting-hr-review`, **✅ Clear** AI result
2. **Wei Jie Lim** — `awaiting-hr-review`, **🚫 Flagged** AI result (contains sensitive info)
3. **Priya Nair** — fully **approved**, with Job Title & Division already filled in by HR

Seed them with `npm run seed` (it skips if the database already has rows), or set `SEED_DEMO=1` in
the environment to seed automatically on startup when the database is empty. Their avatar photos are
generated at seed time and stored in the database — no binary assets are committed.

---

## 📜 npm Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run the API and Vite frontend together — the main local dev command |
| `npm start` | `node server.js` — serve prebuilt `dist/` + API on one port (used by the container) |
| `npm run serve` | Build the frontend, then serve everything from Express on one port |
| `npm run server` | Express API only |
| `npm run vite` | Vite frontend only |
| `npm run seed` | Seed the database with the example submissions |
| `npm run build` | Build the frontend into `dist/` |

---

## 📁 Project Structure

```
server.js              Express API: Postgres, photos, moderation, eDM generation; serves dist/
seed.js                Seeds example submissions (+ generated avatar photos) into the database
Dockerfile             Builds the frontend and runs the Node server (used by Rabbit Deploy)
src/
  App.tsx              Router + landing page
  api.ts               Typed backend client
  components/          Header, botanical SVG motifs, moderation badge
  pages/
    Submit.tsx         New-hire submission portal + confirmation screen
    Admin.tsx          Admin shell: login gate + tab navigation
    admin/
      ReviewTab.tsx    Review / approve / reject submissions
      EdmTab.tsx       Select joiners → generate & copy eDM HTML
      ArchiveTab.tsx   Read-only log of generated eDMs
```

---

## 📨 Using the generated eDM

In the **Generate eDM** tab, select approved joiners, set an occasion label (e.g. *“July 2025 New
Joiners”*), and click **Generate eDM**. Preview it, then click **Copy HTML to clipboard** and paste
directly into Outlook (or any email client). All styles are inlined and photos are embedded, so the
email is fully self-contained.

---

_Growing together, one green space at a time._ 🌳
