"""Validate/normalize ALL AI output with Pydantic. Never invent info."""
from ..schemas import AIAnalysisResult

ALLOWED_ABUSE = {
    "physical violence",
    "threat",
    "stalking",
    "technology monitoring",
    "phone monitoring",
    "sexual violence",
    "emotional abuse",
    "financial abuse",
}


def validate_ai_output(raw: dict) -> AIAnalysisResult:
    if not isinstance(raw, dict):
        raise ValueError("AI output must be an object")
    abuse = [a for a in (raw.get("abuse_types") or []) if isinstance(a, str) and a.lower() in ALLOWED_ABUSE]
    # Normalize "phone monitoring" -> canonical label used by risk engine
    abuse = ["technology monitoring" if a.lower() == "phone monitoring" else a for a in abuse]
    result = AIAnalysisResult(
        abuse_types=abuse,
        threat_detected=bool(raw.get("threat_detected", False)),
        weapon_mentioned=bool(raw.get("weapon_mentioned", False)),
        recurring_incident=bool(raw.get("recurring_incident", False)),
        stalking_detected=bool(raw.get("stalking_detected", False)),
        immediate_danger=bool(raw.get("immediate_danger", False)),
        key_indicators=[k for k in (raw.get("key_indicators") or []) if isinstance(k, str)][:10],
        summary=raw.get("summary") or "not mentioned",
    )
    if not result.key_indicators and not result.abuse_types:
        result.summary = result.summary or "not mentioned"
    return result
