"""Seed demo users: admin / handler / viewer. Run: python -m app.seed (from backend/).

Set SEED_DEMO=1 (run_replit.sh does this) to also create the canonical demo
case (SR-45012, 85/100 HIGH) so a fresh deployment is instantly demoable.
Idempotent: reruns only print 'exists'.
"""
import datetime
import os
from .database import Base, engine, SessionLocal
from .models import User, Report, RiskAssessment
from .auth import create_user

DEMO_CASE_ID = "SR-45012"
DEMO_NARRATIVE = (
    "He hit me yesterday and threatened to kill me. "
    "He keeps checking my phone and follows me."
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for username, password, role in [
    ("admin", "Admin123!", "admin"),
    ("handler", "Handler123!", "case_handler"),
    ("viewer", "Viewer123!", "viewer"),
]:
    if not db.query(User).filter(User.username == username).first():
        create_user(db, username, password, role)
        print(f"created {username} ({role})")
    else:
        print(f"exists {username}")

if os.getenv("SEED_DEMO") == "1":
    r = db.query(Report).filter(Report.case_id == DEMO_CASE_ID).first()
    if not r:
        r = Report(
            case_id=DEMO_CASE_ID,
            reporter_type="victim",
            contact="",
            location="Demo City",
            incident_date="yesterday",
            description=DEMO_NARRATIVE,
            status="new",
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        print(f"created demo case {DEMO_CASE_ID} (id={r.id})")
    else:
        print(f"exists demo case {DEMO_CASE_ID} (id={r.id})")
    if not db.query(RiskAssessment).filter(RiskAssessment.report_id == r.id).first():
        from .ai.mock_provider import MockProvider
        from .risk_engine import calculate_risk

        ai = MockProvider().analyze(r.description)
        score, level, reasons = calculate_risk(ai)
        db.add(
            RiskAssessment(
                report_id=r.id,
                risk_score=score,
                risk_level=level,
                abuse_types=ai.abuse_types,
                threat_indicators={
                    "threat_detected": ai.threat_detected,
                    "weapon_mentioned": ai.weapon_mentioned,
                    "recurring_incident": ai.recurring_incident,
                    "stalking_detected": ai.stalking_detected,
                    "immediate_danger": ai.immediate_danger,
                    "key_indicators": ai.key_indicators,
                    "reasons": reasons,
                },
                ai_summary=ai.summary,
                ai_available=True,
                ai_generated_at=datetime.datetime.utcnow(),
            )
        )
        db.commit()
        print(f"created demo analysis {score}/100 {level}")
    else:
        print("exists demo analysis")
db.close()
