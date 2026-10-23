"""AI provider status + live Jev verification (staff only).

- GET /api/ai/status — which provider is active, whether a Jev key is
  configured (never leaks the key), host + model. Used by the dashboard
  security card and the paper's calibration experiment.
- POST /api/ai/verify — runs ONE live Jev call on a supplied narrative
  (or the canonical demo narrative) and returns score/level/meta WITHOUT
  touching the DB. Proves the live key works on Replit.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from ..auth import require_roles
from ..models import User
from ..audit import audit
from ..database import get_db
from sqlalchemy.orm import Session
from ..config import AI_PROVIDER, JEV_MODEL, jev_credentials

router = APIRouter(prefix="/api/ai", tags=["ai-status"])

DEMO_NARRATIVE = (
    "He hit me yesterday and threatened to kill me. "
    "He keeps checking my phone and follows me."
)


class VerifyIn(BaseModel):
    narrative: Optional[str] = None


@router.get("/status", response_model=dict)
def ai_status(staff: User = Depends(require_roles("admin", "case_handler"))):
    """Provider wiring for staff.

    Never returns any part of an API key: the previous implementation exposed
    the first 7 characters of the secret to every authenticated user. The
    endpoint is also limited to roles that actually operate the AI layer.
    """
    key, host = jev_credentials()
    return {
        "provider": AI_PROVIDER,
        "model": JEV_MODEL,
        "jev_configured": bool(key),
        "jev_host": host,
        "offline_safe": True,
        "note": "Set JEV_API_KEY (TypeSafe) or JEV_AGENT_KEY (free, jev-agent.com/api-access) in Replit Secrets for live triage. Without a key the demo runs the offline-safe path.",
    }


@router.post("/verify", response_model=dict)
def ai_verify(body: VerifyIn, request: Request, staff: User = Depends(require_roles("admin", "case_handler")),
              db: Session = Depends(get_db)):
    from ..ai.jev_provider import verify_live

    narrative = (body.narrative or DEMO_NARRATIVE).strip()
    if len(narrative) < 10:
        raise HTTPException(status_code=400, detail="Narrative too short")
    try:
        result = verify_live(narrative)
    except RuntimeError as e:
        # Never echo the narrative back beyond its length.
        audit(db, "ai_verify_failed", actor_id=staff.id, actor_role=staff.role,
              details={"error": str(e)[:200], "narrative_chars": len(narrative)})
        raise HTTPException(status_code=502, detail=str(e))
    # NEVER echo the narrative back beyond its length.
    audit(db, "ai_verify", actor_id=staff.id, actor_role=staff.role,
          details={"score": result["score"], "level": result["level"],
                   "live": bool(result.get("meta", {}).get("live")),
                   "narrative_chars": len(narrative)})
    return {
        "score": result["score"],
        "level": result["level"],
        "reasons": result["reasons"],
        "indicators": result["indicators"],
        "meta": result["meta"],
        "narrative_chars": len(narrative),
    }
