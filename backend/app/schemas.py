"""Pydantic schemas — also used to VALIDATE all AI output."""
from typing import List, Optional
from pydantic import BaseModel, Field


# ---- Auth ----
class RegisterIn(BaseModel):
    username: str
    password: str
    role: str = "viewer"


class LoginIn(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    role: str
    username: str


# ---- Reports (existing concepts) ----
class ReportCreate(BaseModel):
    reporter_type: str = "victim"
    contact: Optional[str] = ""
    location: Optional[str] = ""
    incident_date: Optional[str] = ""
    description: str = Field(min_length=10)


class ReportOut(BaseModel):
    id: int
    case_id: str
    reporter_type: str
    location: Optional[str] = ""
    incident_date: Optional[str] = ""
    status: str
    created_at: str


class ReportDetail(ReportOut):
    contact: Optional[str] = ""
    description: str  # staff-only; never log this


# ---- AI analysis (validated, never invented) ----
class AIAnalysisResult(BaseModel):
    abuse_types: List[str] = []
    threat_detected: bool = False
    weapon_mentioned: bool = False
    recurring_incident: bool = False
    stalking_detected: bool = False
    immediate_danger: bool = False
    key_indicators: List[str] = []
    summary: str = "not mentioned"


class RiskAssessmentOut(BaseModel):
    report_id: int
    case_id: str
    risk_score: Optional[int] = None
    risk_level: Optional[str] = None  # LOW|MEDIUM|HIGH|UNAVAILABLE
    abuse_types: List[str] = []
    threat_detected: Optional[bool] = None
    weapon_mentioned: Optional[bool] = None
    stalking_detected: Optional[bool] = None
    immediate_danger: Optional[bool] = None
    recurring_incident: Optional[bool] = None
    key_indicators: List[str] = []
    ai_summary: Optional[str] = None
    ai_available: bool = True
    reasons: List[str] = []
    ai_generated_at: Optional[str] = None
    human_override: Optional[str] = None
    override_reason: Optional[str] = None
    override_by: Optional[int] = None
    override_at: Optional[str] = None


class OverrideIn(BaseModel):
    human_override: str  # LOW|MEDIUM|HIGH
    reason: str = Field(min_length=5)
