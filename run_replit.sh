#!/bin/bash
# SafeReport — Replit boot (single service: API + prebuilt frontend).
# Health checks hit / and must get 200 fast, so NO build at boot:
# frontend/dist is committed to git. Only escape hatch:
# REBUILD_FRONTEND=1 rebuilds the UI (slow, may time out health checks).

# NOTE: no `set -e` — we log every failure explicitly so Replit logs
# show the real cause instead of just "No open port was detected".
PORT="${PORT:-5000}"

echo "--- SafeReport boot (AI_PROVIDER=${AI_PROVIDER:-mock}) ---"
echo "--- PWD=$(pwd) PORT=$PORT ---"

# --- Pick a python (Replit Nix images often only have `python3`) ---
if command -v python3 >/dev/null 2>&1; then
  PYBIN=python3
elif command -v python >/dev/null 2>&1; then
  PYBIN=python
else
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
fi
# Seed staff accounts + canonical demo case (SR-45012, 85/100 HIGH).
export SEED_DEMO=1

# Install deps only if imports are missing (Replit caches site-packages).
if ! $PYBIN -c "import fastapi, uvicorn, sqlalchemy, pydantic, dotenv, jwt" 2>/dev/null; then
  echo "--- installing backend deps ---"
  if command -v pip3 >/dev/null 2>&1; then
    PIPBIN=pip3
  elif command -v pip >/dev/null 2>&1; then
    PIPBIN=pip
  elif $PYBIN -m pip --version >/dev/null 2>&1; then
    PIPBIN="$PYBIN -m pip"
  else
    echo "FATAL: no pip found (tried pip3, pip, python -m pip). Cannot install requirements.txt"
    exit 1
  fi
  # shellcheck disable=SC2086
  $PIPBIN install -q -r requirements.txt || {
    echo "FATAL: pip install failed — see output above"
    exit 1
  }
else
  echo "--- backend deps already present, skipping pip install ---"
fi

echo "--- seeding demo data ---"
$PYBIN -m app.seed || echo "WARN: seed step failed (continuing — API can still boot)"

echo "--- serving on 0.0.0.0:$PORT (public victim flow: / ) ---"
exec $PYBIN -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
