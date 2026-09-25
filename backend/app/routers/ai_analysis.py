"""NEW AI endpoints (additive only):
POST /api/reports/{id}/ai-analysis  — generate AI analysis (case_handler, admin)
GET  /api/reports/{id}/ai-analysis  — retrieve analysis (admin, case_handler, viewer)
POST /api/reports/{id}/override-risk — human override (case_handler, admin)
"""
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Report, RiskAssessment, User
from ..schemas import RiskAssessmentOut, OverrideIn
from ..auth import require_roles
from ..audit import audit
from ..ai.base import get_provider
from ..ai.fallback import fallback_analysis
from ..risk_engine import calculate_risk

router = APIRouter(prefix="/api/reports", tags=["ai-analysis"])


def _to_out(a: RiskAssessment, case_id: str) -> dict:
    ti = a.threat_indicators or {}
    return {
        "report_id": a.report_id,
        "case_id": case_id,
        "risk_score": a.risk_score,
        "risk_level": a.risk_level,
        "abuse_types": a.abuse_types or [],
        "threat_detected": ti.get("threat_detected"),
        "weapon_mentioned": ti.get("weapon_mentioned"),
        "stalking_detected": ti.get("stalking_detected"),
        "immediate_danger": ti.get("immediate_danger"),
        "recurring_incident": ti.get("recurring_incident"),
        "key_indicators": ti.get("key_indicators", []),
        "ai_summary": a.ai_summary,
        "ai_available": bool(a.ai_available),
        "reasons": ti.get("reasons", []),
        "ai_generated_at": a.ai_generated_at.isoformat() if a.ai_generated_at else None,
        "human_override": a.human_override,
        "override_reason": a.override_reason,
        "override_by": a.override_by,
        "override_at": a.override_at.isoformat() if a.override_at else None,
    }


@router.post("/{report_id}/ai-analysis", response_model=dict)
def generate_analysis(report_id: int, staff: User = Depends(require_roles("admin", "case_handler")),
                      db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    # Analyze WITHOUT logging the narrative.
    ai_available = True
    try:
        ai = get_provider().analyze(r.description)
    except Exception:
        try:
            ai = fallback_analysis(r.description)
        except Exception:
            ai = None
        if ai is None:
            # AI unavailable: mark row, do not fail the case workflow.
            row = db.query(RiskAssessment).filter(RiskAssessment.report_id == r.id).first()
            if not row:
                row = RiskAssessment(report_id=r.id, risk_score=None, risk_level="UNAVAILABLE",
                                     ai_available=False, ai_summary="AI analysis unavailable")
                db.add(row)
            else:
                row.ai_available = False
                row.risk_level = "UNAVAILABLE"
            db.commit()
            audit(db, "ai_analysis_unavailable", actor_id=staff.id, actor_role=staff.role,
                  report_id=r.id, details={"case_id": r.case_id})
            return _to_out(row, r.case_id)

    score, level, reasons = calculate_risk(ai)
    row = db.query(RiskAssessment).filter(RiskAssessment.report_id == r.id).first()
    payload = {
        "risk_score": score,
        "risk_level": level,
        "abuse_types": ai.abuse_types,
        "threat_indicators": {
            "threat_detected": ai.threat_detected,
            "weapon_mentioned": ai.weapon_mentioned,
            "recurring_incident": ai.recurring_incident,
            "stalking_detected": ai.stalking_detected,
            "immediate_danger": ai.immediate_danger,
            "key_indicators": ai.key_indicators,
            "reasons": reasons,
        },
        "ai_summary": ai.summary,
        "ai_available": ai_available,
        "ai_generated_at": datetime.datetime.utcnow(),
    }
    if not row:
        row = RiskAssessment(report_id=r.id, **payload)
        db.add(row)
    else:
        for k, v in payload.items():
            setattr(row, k, v)
        # regenerating clears a prior human override? No — keep override history; reset it.
        row.human_override = None
        row.override_reason = None
        row.override_by = None
        row.override_at = None
    db.commit()
    db.refresh(row)
    audit(db, "ai_analysis_generated", actor_id=staff.id, actor_role=staff.role, report_id=r.id,
          details={"case_id": r.case_id, "risk_score": score, "risk_level": level})
    return _to_out(row, r.case_id)


@router.get("/{report_id}/ai-analysis", response_model=dict)
def get_analysis(report_id: int, staff: User = Depends(require_roles("admin", "case_handler", "viewer")),
                 db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    row = db.query(RiskAssessment).filter(RiskAssessment.report_id == report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="No AI analysis yet")
    audit(db, "ai_analysis_viewed", actor_id=staff.id, actor_role=staff.role, report_id=r.id,
          details={"case_id": r.case_id})
    return _to_out(row, r.case_id)


@router.post("/{report_id}/override-risk", response_model=dict)
def override_risk(report_id: int, body: OverrideIn,
                  staff: User = Depends(require_roles("admin", "case_handler")),
                  db: Session = Depends(get_db)):
    level = body.human_override.upper()
    if level not in ("LOW", "MEDIUM", "HIGH"):
        raise HTTPException(status_code=400, detail="human_override must be LOW, MEDIUM or HIGH")
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    row = db.query(RiskAssessment).filter(RiskAssessment.report_id == report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="No AI analysis to override yet")
    row.human_override = level
    row.override_reason = body.reason.strip()
    row.override_by = staff.id
    row.override_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(row)
    audit(db, "risk_override", actor_id=staff.id, actor_role=staff.role, report_id=r.id,
          details={"case_id": r.case_id, "ai_score": row.risk_score, "ai_level": row.risk_level,
                   "human_override": level, "reason": body.reason.strip()})
    return _to_out(row, r.case_id)
