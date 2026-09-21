"""Existing domain models + ONE new table: risk_assessments."""
import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON

from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    salt = Column(String(64), nullable=False)
    # Roles: admin | case_handler | viewer
    role = Column(String(20), nullable=False, default="viewer")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    case_id = Column(String(20), unique=True, nullable=False)  # e.g. SR-48291
    reporter_type = Column(String(20), nullable=False, default="victim")  # victim|anonymous|third_party
    contact = Column(String(255), nullable=True)  # optional, empty for anonymous
    location = Column(String(255), nullable=True)
    incident_date = Column(String(50), nullable=True)
    description = Column(Text, nullable=False)  # victim narrative — NEVER write to app logs
    status = Column(String(20), nullable=False, default="new")  # new|under_review|closed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RiskAssessment(Base):
    """New AI table. JSON/JSONB where appropriate (JSON works on both PG and SQLite)."""
    __tablename__ = "risk_assessments"
    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), unique=True, nullable=False)
    risk_score = Column(Integer, nullable=True)
    risk_level = Column(String(10), nullable=True)  # LOW|MEDIUM|HIGH|UNAVAILABLE
    abuse_types = Column(JSON, nullable=True)
    threat_indicators = Column(JSON, nullable=True)
    ai_summary = Column(Text, nullable=True)
    ai_available = Column(Boolean, default=True)
    ai_generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    # Human override (decision support only — AI never decides finally)
    human_override = Column(String(10), nullable=True)
    override_reason = Column(Text, nullable=True)
    override_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    override_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, nullable=True)
    actor_role = Column(String(20), nullable=True)
    action = Column(String(80), nullable=False)
    report_id = Column(Integer, nullable=True)
    # Details must NEVER contain the victim narrative.
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
