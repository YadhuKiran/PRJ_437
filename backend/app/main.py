"""FastAPI entrypoint. Existing API + additive AI routes.

Replit demo: serves the built frontend (frontend/dist) from the same port
so one Repl = full demo. API stays under /api/*; all other GETs fall back
to index.html (SPA). Local dev (vite on :5173 + uvicorn on :8000) unaffected.
"""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
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
    try:
        from .config import is_dev_secret
        if is_dev_secret():
            print("WARN: JWT_SECRET is a dev default — set a strong secret in env/Replit Secrets")
    except Exception:
        pass


_init_db()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(reports_router.router)
app.include_router(ai_router.router)
app.include_router(ai_status_router.router)
app.include_router(resources_router.router)


@app.get("/api/health")
def health():
    from .config import AI_PROVIDER, JEV_MODEL, jev_credentials, is_dev_secret
    key, host = jev_credentials()
    return {"status": "ok", "ai_provider": AI_PROVIDER, "ai_model": JEV_MODEL,
            "jev_configured": bool(key), "jev_host": host,
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
        # Never shadow the API.
        if path.startswith("api/"):
            return {"detail": "Not found"}
        candidate = _DIST / path
        if path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
