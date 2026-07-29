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
- **Backend:** Node.js + Express
- **Database:** SQLite via Node’s built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html)
  (no native compilation, no external DB server)
- **File storage:** uploaded photos are saved to `/uploads` and served statically
- **AI:** Claude API for introduction moderation

> **Requires Node.js 22+** (for the built-in `node:sqlite` module). Check with `node --version`.

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see below) — optional but recommended
cp .env.example .env
#   then edit .env and add your ANTHROPIC_API_KEY

# 3. Start the app (seeds the database on first run, then launches
#    the Express API and the Vite dev server together)
npm start
```

Then open **http://localhost:5173** in your browser:

- New-hire portal → http://localhost:5173/submit
- HR admin dashboard → http://localhost:5173/admin  (password below)

`npm start` runs two processes together via `concurrently`:

| Process | Port | Role |
| --- | --- | --- |
| Express API (`server.js`) | `3001` | Database, uploads, moderation, eDM generation |
| Vite dev server | `5173` | React frontend (proxies `/api` and `/uploads` to the API) |

### Production-style single-port run (optional)

```bash
npm run serve   # builds the frontend, then serves everything from Express on :3001
```

When a `dist/` build exists, `server.js` serves the built app itself, so the whole thing runs on
`http://localhost:3001`.

---

## 🔐 Configuration (`.env`)

Copy `.env.example` to `.env` and set:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | _(unset)_ | Your Claude API key — powers AI moderation of introductions. Get one at [console.anthropic.com](https://console.anthropic.com/). |
| `ADMIN_PASSWORD` | `nparks-admin` | Shared HR password for the `/admin` dashboard. |
| `PORT` | `3001` | Port for the Express API/backend. |

**About the Claude API key:** if `ANTHROPIC_API_KEY` is not set, GreenPass still works — submissions
are accepted and simply marked **⚠️ Review Needed** so HR reviews them manually. Add a key to enable
automatic first-pass moderation.

**Admin password:** the default is `nparks-admin`. Change it via `ADMIN_PASSWORD` in `.env`.

---

## 🌱 Seed Data

On first run the database is seeded with three example submissions so the dashboard is never empty:

1. **Amara Tan** — `awaiting-hr-review`, **✅ Clear** AI result
2. **Wei Jie Lim** — `awaiting-hr-review`, **🚫 Flagged** AI result (contains sensitive info)
3. **Priya Nair** — fully **approved**, with Job Title & Division already filled in by HR

Re-seed manually any time with `npm run seed` (it skips if data already exists). To start completely
fresh, delete `greenpass.db` and the seed avatars in `uploads/`, then run `npm run seed` again.

---

## 📜 npm Scripts

| Script | Description |
| --- | --- |
| `npm start` | Seed (if needed) + run API and frontend together — the main dev command |
| `npm run dev` | Vite frontend only |
| `npm run server` | Express API only |
| `npm run seed` | Seed the SQLite database with example submissions |
| `npm run build` | Build the frontend into `dist/` |
| `npm run serve` | Build, then serve everything from Express on one port |

---

## 📁 Project Structure

```
server.js              Express API: SQLite, uploads, moderation, eDM generation
seed.js                Seeds example submissions (+ generated avatar photos)
uploads/               Uploaded profile photos (served statically; git-ignored)
greenpass.db           Local SQLite database (created at runtime; git-ignored)
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
