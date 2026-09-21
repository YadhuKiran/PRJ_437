"""Audit helper. NEVER store victim narratives here."""
from sqlalchemy.orm import Session
from .models import AuditLog


def audit(db: Session, action: str, actor_id=None, actor_role=None, report_id=None, details=None):
    db.add(
        AuditLog(
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            report_id=report_id,
            details=details or {},
        )
    )
    db.commit()
