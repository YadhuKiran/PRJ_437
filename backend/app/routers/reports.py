"""Existing case-management: victim/anonymous reporting + staff case views."""
import random
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Report, RiskAssessment, User
from ..schemas import ReportCreate, ReportOut, ReportDetail
from ..auth import require_roles
from ..audit import audit

router = APIRouter(prefix="/api/reports", tags=["reports"])

STATUS_FLOW = ["new", "under_review", "closed"]


class StatusIn(BaseModel):
    status: str


# ---- Simple in-memory rate limiter (stdlib only, Replit-safe) ----
# 10 public submissions per IP per 60s sliding window. Resets on reboot,
# which is fine for abuse-throttling (not billing).
_RATE: dict[str, list[float]] = {}
RATE_LIMIT = 10
RATE_WINDOW_S = 60.0


def _check_rate(ip: str):
    now = time.monotonic()
    hits = _RATE.get(ip, [])
    hits = [t for t in hits if now - t < RATE_WINDOW_S]
    if len(hits) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Too many reports right now. Please wait a minute and try again.",
        )
    hits.append(now)
    _RATE[ip] = hits


def _gen_case_id(db: Session) -> str:
    for _ in range(20):
        cid = f"SR-{random.randint(10000, 99999)}"
        if not db.query(Report).filter(Report.case_id == cid).first():
            return cid
    raise HTTPException(status_code=500, detail="Could not generate case id")


def _out(r: Report) -> dict:
    return {
        "id": r.id,
        "case_id": r.case_id,
        "reporter_type": r.reporter_type,
        "location": r.location or "",
        "incident_date": r.incident_date or "",
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else "",
    }


@router.post("", response_model=dict)
def submit_report(body: ReportCreate, request: Request, db: Session = Depends(get_db)):
    """Public endpoint. AI failure must NEVER block submission (AI runs separately)."""
    ip = (request.client.host if request.client else "unknown")
    _check_rate(ip)
    if body.reporter_type not in ("victim", "anonymous", "third_party"):
        raise HTTPException(status_code=400, detail="Invalid reporter type")
    contact = "" if body.reporter_type == "anonymous" else (body.contact or "")
    report = Report(
        case_id=_gen_case_id(db),
        reporter_type=body.reporter_type,
        contact=contact,
        location=body.location or "",
        incident_date=body.incident_date or "",
        description=body.description.strip(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    # Audit WITHOUT narrative: only ids and lengths.
    audit(db, "report_submitted", report_id=report.id,
          details={"case_id": report.case_id, "reporter_type": report.reporter_type,
                   "desc_chars": len(body.description)})
    return {"id": report.id, "case_id": report.case_id, "status": report.status}


@router.get("", response_model=dict)
def list_reports(staff: User = Depends(require_roles("admin", "case_handler", "viewer")),
                 db: Session = Depends(get_db),
                 page: int = Query(1, ge=1),
                 page_size: int = Query(20, ge=1, le=100)):
    """Staff list, sorted with highest AI risk first (dashboard prioritization).

    Paginated: {items, total, page, page_size, pages}. Page 1 default keeps
    small deployments simple; large ones pass ?page=2&page_size=50.
    """
    reports = db.query(Report).order_by(Report.id.desc()).all()
    scores = {a.report_id: (a.risk_score or -1, a.risk_level) for a in db.query(RiskAssessment).all()}
    items = [{**_out(r), "risk_score": scores.get(r.id, (-1, None))[0],
              "risk_level": scores.get(r.id, (-1, None))[1]} for r in reports]
    items.sort(key=lambda x: x["risk_score"], reverse=True)
    total = len(items)
    pages = max(1, (total + page_size - 1) // page_size)
    page = min(page, pages)
    start = (page - 1) * page_size
    sliced = items[start:start + page_size]
    audit(db, "reports_listed", actor_id=staff.id, actor_role=staff.role,
          details={"count": len(sliced), "total": total, "page": page})
    return {"items": sliced, "total": total, "page": page,
            "page_size": page_size, "pages": pages}


@router.get("/by-case/{case_id}", response_model=dict)
def victim_status(case_id: str, db: Session = Depends(get_db)):
    """Public: victim checks status by Case ID. No narrative, no AI detail."""
    r = db.query(Report).filter(Report.case_id == case_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"case_id": r.case_id, "status": r.status}


@router.get("/{report_id}", response_model=dict)
def get_report(report_id: int, staff: User = Depends(require_roles("admin", "case_handler", "viewer")),
               db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    audit(db, "report_viewed", actor_id=staff.id, actor_role=staff.role, report_id=r.id,
          details={"case_id": r.case_id})
    return {**_out(r), "contact": r.contact or "", "description": r.description}


@router.patch("/{report_id}/status", response_model=dict)
def update_status(report_id: int, body: StatusIn,
                  staff: User = Depends(require_roles("admin", "case_handler")),
                  db: Session = Depends(get_db)):
    """Case status workflow: new -> under_review -> closed.

    Handlers may only move forward; admins may move any direction (reopen).
    Every transition is audit-logged.
    """
    target = (body.status or "").strip().lower()
    if target not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="status must be new, under_review or closed")
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    cur_idx = STATUS_FLOW.index(r.status) if r.status in STATUS_FLOW else 0
    new_idx = STATUS_FLOW.index(target)
    if staff.role != "admin" and new_idx < cur_idx:
        raise HTTPException(status_code=403, detail="Only admins can reopen cases")
    if r.status == target:
        return _out(r)
    old = r.status
    r.status = target
    db.commit()
    db.refresh(r)
    audit(db, "status_changed", actor_id=staff.id, actor_role=staff.role, report_id=r.id,
          details={"case_id": r.case_id, "from": old, "to": target})
    return _out(r)
