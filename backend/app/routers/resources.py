"""Support resources (existing concept) + audit viewer (admin)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuditLog, User
from ..auth import require_roles
from ..audit import audit

router = APIRouter(tags=["resources"])

RESOURCES = [
    {"name": "Emergency", "detail": "If you are in immediate danger, call your local emergency number (e.g. 911 / 112)."},
    {"name": "National DV Hotline (US)", "detail": "1-800-799-7233 (SAFE) — confidential, 24/7."},
    {"name": "Safety planning", "detail": "Keep copies of documents with a trusted person; plan a safe exit route."},
    {"name": "Digital safety", "detail": "Use a safe device; clear browsing history if monitored."},
]


@router.get("/api/resources")
def resources():
    return RESOURCES


@router.get("/api/audit", response_model=list)
def list_audit(admin: User = Depends(require_roles("admin")), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(200).all()
    return [
        {"id": x.id, "actor_id": x.actor_id, "actor_role": x.actor_role, "action": x.action,
         "report_id": x.report_id, "details": x.details or {},
         "timestamp": x.timestamp.isoformat() if x.timestamp else ""}
        for x in rows
    ]
