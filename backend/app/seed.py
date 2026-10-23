"""Seed staff accounts and the canonical demo case.

Safety model (see PROGRESS.md / README.md):
  * Staff accounts are created with a password that is EITHER supplied by
    SEED_STAFF_PASSWORD or generated randomly and printed exactly once to
    the console. Hardcoded default passwords ("Admin123!") are NEVER used
    automatically.
  * The known demo passwords are only used when the operator explicitly asks
    for them with `--demo-passwords`, which is refused in production.
  * Creating accounts is idempotent: an existing account keeps its password.

Usage:
  python -m app.seed                     # staff accounts (generated password) + demo case if SEED_DEMO=1
  python -m app.seed --demo-passwords    # use the documented demo passwords (never in production)

Automatic (boot-time) seeding is opt-in via the SEED_STAFF env flag.
"""
import argparse
import datetime
import os
import secrets
import sys

from .config import is_production, SEED_STAFF_PASSWORD
from .database import Base, engine, SessionLocal
from .models import User, Report, RiskAssessment
from .auth import create_user

DEMO_CASE_ID = "SR-45012"
DEMO_NARRATIVE = (
    "He hit me yesterday and threatened to kill me. "
    "He keeps checking my phone and follows me."
)

# Well-known demo credentials. Only used with an explicit operator opt-in.
DEMO_ACCOUNTS = [
    ("admin", "Admin123!", "admin"),
    ("handler", "Handler123!", "case_handler"),
    ("viewer", "Viewer123!", "viewer"),
]


def _seed_staff(db, use_demo_passwords: bool) -> None:
    """Create the three staff accounts if missing.

    Returns the password that new accounts were created with, or None when
    every account already existed.
    """
    if use_demo_passwords:
        if is_production():
            print("REFUSING to seed well-known demo passwords when APP_ENV=production.")
            return
        password = DEMO_ACCOUNTS[0][1]
        plan = [(u, p, r) for u, p, r in DEMO_ACCOUNTS]
    else:
        password = SEED_STAFF_PASSWORD or secrets.token_urlsafe(12)
        plan = [(u, password, r) for u, _p, r in DEMO_ACCOUNTS]

    created = []
    for username, pw, role in plan:
        if db.query(User).filter(User.username == username).first():
            print(f"exists {username}")
        else:
            create_user(db, username, pw, role)
            created.append((username, role))
            print(f"created {username} ({role})")

    if created:
        if use_demo_passwords:
            print("\n--- demo staff accounts (well-known demo passwords) ---")
            for username, role in created:
                print(f"  {username:<8} role={role}")
        else:
            print("\n--- staff accounts created (password shown once) ---")
            for username, role in created:
                print(f"  {username:<8} role={role:<12} password={password}")
            print("Store this password securely; it is not recoverable from the database.")
    db.close()


def _seed_demo_case(db) -> None:
    """Create the canonical demo case (SR-45012, 85/100 HIGH)."""
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed SafeReport demo/staff data.")
    parser.add_argument(
        "--demo-passwords",
        action="store_true",
        help="use the well-known demo passwords instead of a generated one (never allowed in production)",
    )
    args = parser.parse_args(argv)

    # The env var lets a boot script opt in (see run_replit.sh).
    use_demo_passwords = args.demo_passwords or os.getenv("SEED_DEMO_PASSWORDS") == "1"

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        _seed_staff(db, use_demo_passwords)
    finally:
        try:
            db.close()
        except Exception:
            pass

    if os.getenv("SEED_DEMO") == "1":
        db = SessionLocal()
        try:
            _seed_demo_case(db)
        finally:
            try:
                db.close()
            except Exception:
                pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
