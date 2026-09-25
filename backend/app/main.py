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
from .routers import resources as resources_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Domestic Violence Reporting Platform (+ AI risk assessment)")
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
app.include_router(resources_router.router)


@app.get("/api/health")
def health():
    from .config import AI_PROVIDER
    return {"status": "ok", "ai_provider": AI_PROVIDER}


# ---- Single-service static hosting for Replit (no-op locally if dist missing) ----
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

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
