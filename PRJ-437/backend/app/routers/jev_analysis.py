"""Jev-first triage endpoint. Never logs or persists the victim narrative."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import require_roles
from ..database import get_db
from ..models import Report, RiskAssessment, User
from ..audit import audit
from ..ai.jev_provider import JevProvider
from ..ai.base import get_provider
from ..risk_engine import calculate_risk

router = APIRouter(prefix="/api/reports", tags=["jev-triage"])

def _jev_payload(t):
    return {
        "jev_model": t.model,
        "primary_abuse_type": t.primary_abuse_type,
        "primary_confidence": t.primary_confidence,
        "probabilities": t.probabilities,
        "severity_score": t.severity_score,
        "severity_confidence": t.severity_confidence,
        "indicators": t.indicators,
        "route": t.route,
        "escalation_reason": t.escalation_reason,
        "latency_ms": t.latency_ms,
        "input_tokens": t.input_tokens,
    }

@router.post("/{report_id}/jev-triage", response_model=dict)
def generate_jev_triage(report_id: int, staff: User = Depends(require_roles("admin", "case_handler")), db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        triage = JevProvider().triage(report.description)
    except Exception as exc:
        audit(db, "jev_analysis_unavailable", actor_id=staff.id, actor_role=staff.role,
              report_id=report.id, details={"case_id": report.case_id, "error_type": type(exc).__name__})
        raise HTTPException(status_code=503, detail="Jev triage is unavailable. Use the configured fallback AI workflow.")
    # Jev decides whether the expensive/secondary AI stage is needed.
    downstream_source = "jev"
    final_analysis = triage.ai_analysis
    if triage.route == "llm_review":
        try:
            final_analysis = get_provider().analyze(report.description)
            downstream_source = "jev_then_ai"
        except Exception:
            # Jev remains a valid typed baseline when the secondary provider fails.
            downstream_source = "jev_fallback"
    score, level, reasons = calculate_risk(final_analysis)
    row = db.query(RiskAssessment).filter(RiskAssessment.report_id == report.id).first()
    if not row:
        row = RiskAssessment(report_id=report.id)
        db.add(row)
    row.risk_score = score
    row.risk_level = level
    row.abuse_types = final_analysis.abuse_types
    row.threat_indicators = {
        "threat_detected": final_analysis.threat_detected,
        "weapon_mentioned": final_analysis.weapon_mentioned,
        "recurring_incident": final_analysis.recurring_incident,
        "stalking_detected": final_analysis.stalking_detected,
        immediate_danger": final_analysis.immediate_danger,
        "key_indicators": final_analysis.key_indicators,
        "reasons": reasons,
        "source": downstream_source,
        "jev": _jev_payload(triage),
    }
    row.ai_summary = final_analysis.summary
    row.ai_available = True
    db.commit()
    db.refresh(row)
    audit(db, "jev_triage_generated", actor_id=staff.id, actor_role=staff.role, report_id=report.id,
          details={"case_id": report.case_id, "primary_type": triage.primary_abuse_type,
                   "confidence": triage.primary_confidence, "route": triage.route, "downstream_source": downstream_source,
                   "risk_score": score, "risk_level": level})
    return {"case_id": report.case_id, "source": "jev", "jev": _jev_payload(triage),
            "risk_score": score, "risk_level": level, "reasons": reasons,
            "ai_summary": final_analysis.summary}
