#!/bin/bash
# SafeReport — fast-boot Replit demo (single service: API + prebuilt frontend).
# Health checks hit / and must get a 200 immediately, so this script does
# NO build at boot: frontend/dist is committed to git. Only escape hatch:
# REBUILD_FRONTEND=1 rebuilds the UI (slow, health checks may time out).
set -e
PORT="${PORT:-8000}"

echo "--- SafeReport boot (AI_PROVIDER=${AI_PROVIDER:-mock}) ---"

if [ "$REBUILD_FRONTEND" = "1" ]; then
  echo "--- rebuilding frontend (slow) ---"
  cd frontend
  npm install
  VITE_API_URL="" npm run build
  cd ..
fi

cd backend
# Install deps only if imports are missing (Replit caches site-packages).
python -c "import fastapi, uvicorn, sqlalchemy, pydantic, dotenv, jwt" 2>/dev/null \
  || pip install -q -r requirements.txt
python -m app.seed || true

echo "--- serving on 0.0.0.0:$PORT (public victim flow: / ) ---"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
