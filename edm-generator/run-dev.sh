#!/usr/bin/env bash
# Convenience script to run the backend and frontend together for local dev.
# Usage: ./run-dev.sh   (Ctrl+C stops both)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Backend ---------------------------------------------------------------
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install -q -r requirements.txt
fi
[ -f .env ] || cp .env.example .env
./.venv/bin/uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# --- Frontend --------------------------------------------------------------
cd "$ROOT/frontend"
[ -d node_modules ] || npm install
[ -f .env ] || cp .env.example .env
npm run dev &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT INT TERM
echo "Backend:  http://localhost:8000/docs"
echo "Frontend: http://localhost:5173"
wait
