#!/bin/bash
# SafeReport — Replit boot (single service: API + prebuilt frontend).
# Health checks hit / and must get 200 fast, so NO build at boot:
# frontend/dist is committed to git. Only escape hatch:
# REBUILD_FRONTEND=1 rebuilds the UI (slow, may time out health checks).

# NOTE: no `set -e` — we log every failure explicitly so Replit logs
# show the real cause instead of just "No open port was detected".
PORT="${PORT:-5000}"
# Jev is the default AI provider (cloud decision model, offline-safe without a key).
export AI_PROVIDER="${AI_PROVIDER:-jev}"
# The Replit deployment is a DEMO deployment. Set APP_ENV=production on a real
# deployment; the app then refuses demo seeding and unsafe defaults.
export APP_ENV="${APP_ENV:-demo}"

echo "--- SafeReport boot (APP_ENV=$APP_ENV AI_PROVIDER=${AI_PROVIDER:-mock}) ---"
echo "--- PWD=$(pwd) PORT=$PORT ---"

# --- Pick a python (Replit Nix images often only have `python3`) ---
PYBIN=""
for _c in python3 python3.11 python3.12 python; do
  if command -v "$_c" >/dev/null 2>&1; then PYBIN="$_c"; break; fi
done
if [ -z "$PYBIN" ]; then
  echo "FATAL: neither python3 nor python found on PATH. PATH=$PATH"
  echo "TIP: add python to replit.nix, e.g. { pkgs }: { deps = [ pkgs.python311 ]; }"
  exit 1
fi
echo "--- using $PYBIN ($($PYBIN --version 2>&1)) ---"

if [ "${REBUILD_FRONTEND:-}" = "1" ]; then
  echo "--- rebuilding frontend (slow) ---"
  cd frontend
  npm install
  VITE_API_URL="" npm run build
  cd ..
fi

cd backend || { echo "FATAL: backend/ directory not found from $(pwd)"; exit 1; }

# Ephemeral demo secret per boot (takes precedence over backend/.env defaults).
if [ -z "${JWT_SECRET:-}" ]; then
  export JWT_SECRET="$($PYBIN -c 'import secrets;print(secrets.token_hex(32))')"
  echo "--- generated an ephemeral JWT_SECRET for this boot ---"
fi

# Seed the canonical demo case (SR-45012, 85/100 HIGH).
export SEED_DEMO=1
# Staff accounts are only seeded when explicitly requested, and NEVER with the
# well-known demo passwords unless SEED_DEMO_PASSWORDS=1 is set explicitly.
# Set SEED_STAFF_PASSWORD in Replit Secrets for a known demo password.
if [ "${SEED_STAFF:-1}" = "1" ]; then
  export SEED_STAFF=1
  if [ "${SEED_DEMO_PASSWORDS:-0}" = "1" ]; then
    echo "--- WARNING: seeding well-known demo passwords (demo only) ---"
    export SEED_DEMO_PASSWORDS=1
  fi
fi

# Install deps only if imports are missing (Replit caches site-packages).
if ! $PYBIN -c "import fastapi, uvicorn, sqlalchemy, pydantic, dotenv, jwt" 2>/dev/null; then
  echo "--- installing backend deps ---"
  # Replit blocks direct pypi.org egress (DNS fails); package downloads must
  # go through its internal mirror. Honor the env when present (workspace
  # shell sets it), otherwise fall back to the well-known mirror address
  # (deployments often lack these vars).
  export PIP_INDEX_URL="${PIP_INDEX_URL:-http://package-firewall.replit.internal/pypi/simple/}"
  export PIP_TRUSTED_HOST="${PIP_TRUSTED_HOST:-package-firewall.replit.internal package-firewall.replit.local}"
  echo "--- pip index: $PIP_INDEX_URL ---"
  if $PYBIN -m pip --version >/dev/null 2>&1; then
    PIPBIN="$PYBIN -m pip"
  elif command -v pip3 >/dev/null 2>&1; then
    PIPBIN=pip3
  elif command -v pip >/dev/null 2>&1; then
    PIPBIN=pip
  else
    echo "FATAL: no pip found (tried python -m pip, pip3, pip). Cannot install requirements.txt"
    exit 1
  fi
  # shellcheck disable=SC2086
  $PIPBIN install -q -r requirements.txt || {
    echo "FATAL: pip install failed — see output above"
    exit 1
  }
  $PYBIN -c "import fastapi, uvicorn, sqlalchemy, pydantic, dotenv, jwt" || {
    echo "FATAL: deps still missing after pip install (see import error above)"
    exit 1
  }
else
  echo "--- backend deps already present, skipping pip install ---"
fi

echo "--- seeding demo data ---"
# The staff password is printed once to this log. Set SEED_STAFF_PASSWORD in
# Replit Secrets to use a known value instead.
$PYBIN -m app.seed || echo "WARN: seed step failed (continuing — API can still boot)"

echo "--- serving on 0.0.0.0:$PORT (public victim flow: / ) ---"
exec $PYBIN -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
