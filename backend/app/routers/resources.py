"""Support resources (existing concept) + audit viewer (admin)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AuditLog, User
from ..auth import require_roles
from ..audit import audit

router = APIRouter(tags=["resources"])

# Region-agnostic fallback copy: no single emergency number is correct
# worldwide, so no number is hardcoded here. Region-specific entries belong in
# the database seed (opt-in) or the frontend VITE_SUPPORT_REGION config.
RESOURCES = [
    {"name": "Emergency", "detail": "If you are in immediate danger, call your local emergency-services number now."},
    {"name": "Confidential support", "detail": "Contact a trusted national domestic-abuse helpline in your region — deployment-specific details are configured separately."},
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
