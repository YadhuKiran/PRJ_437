# SafeReport — production container.
#
# One image serves the API and the built frontend (same as the Replit
# single-service deployment). Multi-stage: Node builds the UI, Python runs it.
#
#   docker build -t safereport .
#   docker run --rm -p 8000:8000 \
#     -e APP_ENV=production \
#     -e JWT_SECRET="$(python -c 'import secrets;print(secrets.token_hex(32))')" \
#     -e DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dv_reports" \
#     -e CORS_ORIGINS="https://safereport.example.org" \
#     safereport
#
# The container NEVER seeds demo accounts unless SEED_STAFF=1 is passed
# explicitly, and APP_ENV=production refuses the well-known demo passwords.

# ---------- stage 1: build the frontend ----------
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Same-origin API: the bundle must not hardcode a backend URL.
ENV VITE_API_URL=""
RUN npm run build

# ---------- stage 2: runtime ----------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt backend/requirements-dev.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend /build/dist ./frontend/dist

# Run as an unprivileged user.
RUN useradd --create-home --uid 10001 safereport \
 && chown -R safereport:safereport /app
USER safereport

WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# Apply migrations before serving. Use `alembic stamp head` instead for a
# database that was created before migrations existed.
CMD ["sh", "-c", "python -m alembic upgrade head && exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
