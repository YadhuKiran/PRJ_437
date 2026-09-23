"""FastAPI entrypoint. Existing API + additive AI routes."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import auth as auth_router
from .routers import reports as reports_router
from .routers import ai_analysis as ai_router
from .routers import jev_analysis as jev_router
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
app.include_router(jev_router.router)
app.include_router(resources_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
