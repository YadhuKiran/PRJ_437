"""FastAPI entrypoint. Existing API + additive AI routes.

Replit demo: serves the built frontend (frontend/dist) from the same port
so one Repl = full demo. API stays under /api/*; all other GETs fall back
to index.html (SPA). Local dev (vite on :5173 + uvicorn on :8000) unaffected.
"""
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from .database import Base, engine
from .routers import auth as auth_router
from .routers import reports as reports_router
from .routers import ai_analysis as ai_router
from .routers import ai_status as ai_status_router
from .routers import resources as resources_router


def _init_db():
    """Create tables best-effort. Never crash boot: a 500 on first request
    beats a crash loop (Replit restarts an exited process forever)."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"WARN: create_all failed ({e!r}); API will boot anyway")


app = FastAPI(title="Domestic Violence Reporting Platform (+ AI risk assessment)")


@app.on_event("startup")
def _startup_init_db():
    _init_db()
    _warn_about_migrations()
    try:
        from .config import is_dev_secret, startup_security_errors, APP_ENV
        if is_dev_secret():
            print("WARN: JWT_SECRET is a dev default — set a strong secret in env/Replit Secrets")
        problems = startup_security_errors()
        if problems:
            print(f"FATAL: unsafe configuration for APP_ENV={APP_ENV}:")
            for p in problems:
                print(f"  - {p}")
            raise RuntimeError(
                "Refusing to start: unsafe configuration. See the messages above."
            )
    except RuntimeError:
        raise
    except Exception:
        pass


def _warn_about_migrations() -> None:
    """Tell the operator when the schema is not under Alembic control."""
    try:
        from .database import migration_status
        st = migration_status()
        tables = [t for t in st.get("tables", []) if t != "alembic_version"]
        if tables and not st.get("tracked"):
            print(
                "WARN: this database has tables but no Alembic revision. Schema changes "
                "will NOT be applied automatically. Run: python -m alembic upgrade head "
                "(or `alembic stamp 0001_baseline` for a database created before migrations)."
            )
        elif st.get("tracked"):
            print(f"DB schema revision: {st.get('alembic_revision')}")
    except Exception:
        pass


_init_db()

# ---- CORS ----------------------------------------------------------------
# Same-origin by default: no cross-origin browser access is granted unless
# CORS_ORIGINS names the allowed front-end origins explicitly. The previous
# `allow_origins=["*"] + allow_credentials=True` combination reflected ANY
# requesting origin back with credentials allowed.
from .config import CORS_ORIGINS  # noqa: E402

if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


# ---- Security headers ----------------------------------------------------
@app.middleware("http")
async def _security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("X-XSS-Protection", "0")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()"
    )
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


app.include_router(auth_router.router)
app.include_router(reports_router.router)
app.include_router(ai_router.router)
app.include_router(ai_status_router.router)
app.include_router(resources_router.router)


@app.get("/api/health")
def health():
    from .config import AI_PROVIDER, JEV_MODEL, jev_credentials, is_dev_secret, APP_ENV
    key, host = jev_credentials()
    db_ok = True
    db_driver = "unknown"
    try:
        from sqlalchemy import text
        from .database import engine as _engine
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_driver = _engine.url.get_backend_name()
    except Exception:
        db_ok = False
    from .database import migration_status
    return {"status": "ok", "ai_provider": AI_PROVIDER, "ai_model": JEV_MODEL,
            "jev_configured": bool(key), "jev_host": host,
            "app_env": APP_ENV, "db_ok": db_ok, "db_driver": db_driver,
            "schema_revision": migration_status().get("alembic_revision"),
            "dev_secret": is_dev_secret()}


# ---- Single-service static hosting for Replit (no-op locally if dist missing) ----
# Guard BOTH dist/ and dist/assets: StaticFiles raises at import time if the
# directory is missing, which would exit uvicorn instantly -> Replit crash loop.
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
_ASSETS = _DIST / "assets"
if _DIST.is_dir() and (_DIST / "index.html").is_file():
    if _ASSETS.is_dir():
        app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")
    else:
        print(f"WARN: {_ASSETS} missing; serving index.html without /assets")

    @app.get("/", include_in_schema=False)
    def _root():
        return FileResponse(_DIST / "index.html")

    @app.get("/{path:path}", include_in_schema=False)
    def _spa(path: str):
        # Never shadow the API. Unknown API routes are a 404, not a 200 —
        # returning 200 for a missing endpoint breaks client error handling.
        if path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = _DIST / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
