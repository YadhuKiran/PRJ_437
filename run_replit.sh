#!/bin/bash
# SafeReport — one-command Replit demo (single service: API + built frontend).
# Replit sets $PORT; default 8000 for local runs.
set -e
PORT="${PORT:-8000}"

echo "--- SafeReport boot (AI_PROVIDER=${AI_PROVIDER:-mock}) ---"

cd backend
pip install -q -r requirements.txt
python -m app.seed || true
cd ..

# Rebuild frontend only if dist is missing or explicitly requested.
if [ ! -d "frontend/dist" ] || [ "$REBUILD_FRONTEND" = "1" ]; then
  echo "--- building frontend (VITE_API_URL='' for same-origin API) ---"
  cd frontend
  npm install
  VITE_API_URL="" npm run build
  cd ..
else
  echo "--- using prebuilt frontend/dist ---"
fi

echo "--- serving on 0.0.0.0:$PORT (public victim flow: / ) ---"
cd backend
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
