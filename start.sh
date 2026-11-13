#!/usr/bin/env bash
# Group Travel Matcher: one-command local start.
#   ./start.sh              start Postgres + MinIO (Docker), apply pending migrations, run API + web app
#   ./start.sh --no-install skip the dependency check
# Ctrl+C stops the API and the web app (the database keeps its data; `npm run db:down --prefix backend` stops Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
API_PORT=4000
WEB_PORT=5173

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# 1. Requirements
step "Checking requirements"
command -v node >/dev/null || fail "Node.js is not installed (need 22+; .nvmrc pins $(cat "$ROOT/.nvmrc" 2>/dev/null || echo 24))."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node.js $(node -v) is too old: need 22 or newer (try: nvm install && nvm use)."
command -v docker >/dev/null || fail "Docker is not installed (needed for PostgreSQL and MinIO)."
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker and run ./start.sh again."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is missing (docker compose …)."
for port in $API_PORT $WEB_PORT; do
  port_busy "$port" && fail "Port $port is already in use. Stop whatever runs there (maybe an earlier ./start.sh) and retry."
done
echo "node $(node -v) · $(docker --version | cut -d, -f1)"

# 2. Config
if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "created backend/.env from .env.example"
fi

# 3. Dependencies (only when missing or out of date)
if [ "${1:-}" != "--no-install" ]; then
  for dir in "$BACKEND" "$FRONTEND"; do
    name="$(basename "$dir")"
    if [ ! -d "$dir/node_modules" ] || [ "$dir/package-lock.json" -nt "$dir/node_modules/.package-lock.json" ]; then
      step "Installing $name dependencies"
      npm ci --prefix "$dir" --no-audit --no-fund
    else
      echo "$name dependencies up to date"
    fi
  done
fi

# 4. Database + object storage
step "Starting PostgreSQL (pgvector) and MinIO"
(cd "$BACKEND" && docker compose up -d --wait)

# 5. Migrations (knex only runs the ones not applied yet)
step "Applying pending migrations"
(cd "$BACKEND" && npx knex migrate:latest)

# 6. Run both servers; Ctrl+C stops both
step "Starting the API (:$API_PORT) and the web app (:$WEB_PORT)"
cleanup() {
  trap - INT TERM EXIT
  printf '\nStopping the API and the web app…\n'
  kill 0 2>/dev/null || true # everything started by this script (npm, node, vite)
}
trap cleanup INT TERM EXIT

(cd "$BACKEND" && npm run dev 2>&1 | sed -u 's/^/[api] /') &
(cd "$FRONTEND" && npm run dev -- --host 127.0.0.1 --port "$WEB_PORT" --strictPort 2>&1 | sed -u 's/^/[web] /') &

ready=0
for _ in $(seq 1 60); do
  if curl -fs "http://localhost:$API_PORT/api/health" >/dev/null 2>&1 && curl -fs -o /dev/null "http://127.0.0.1:$WEB_PORT/"; then
    printf '\n'
    bold "✔ Group Travel Matcher is running"
    echo "  Web app:  http://127.0.0.1:$WEB_PORT"
    echo "  API:      http://localhost:$API_PORT/api/health"
    echo "  Sign in with a Traveller ID, e.g. T-001 (Sarah) or T-002 (Priya), or register a new traveller."
    echo "  Press Ctrl+C to stop."
    ready=1; break
  fi
  sleep 1
done
[ "$ready" = 1 ] || echo "⚠ Not ready after 60 s: check the [api] / [web] log lines above."

wait
