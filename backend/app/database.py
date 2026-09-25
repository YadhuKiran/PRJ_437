"""SQLAlchemy engine/session. Works with PostgreSQL or SQLite fallback.

Crash-loop safe: engine creation never raises at import time. If DATABASE_URL
is unset/invalid (e.g. Replit injects an unreachable Postgres URL), fall back
to a local SQLite file so `import app.main` + uvicorn boot still succeed.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import DATABASE_URL


def _make_engine(url: str):
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    # Short timeouts so an unreachable Postgres fails fast instead of
    # hanging the boot until Replit's health check times out.
    if url.startswith("sqlite"):
        return create_engine(url, connect_args=connect_args)
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


try:
    engine = _make_engine(DATABASE_URL)
    # Validate the URL parses / driver exists; do NOT connect here.
    _ = engine.url
except Exception as e:  # e.g. bad scheme, missing driver
    print(f"WARN: DATABASE_URL unusable ({e!r}); falling back to local SQLite")
    os.environ["DATABASE_URL"] = "sqlite:///./dv_reports.db"
    engine = _make_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
