"""Deterministic risk engine. The AI extracts indicators; THE BACKEND scores.

Death threat = +30 | Weapon = +25 | Immediate danger = +25
Repeated violence = +15 | Stalking = +10 | Tech monitoring = +5 | Max 100.
Levels: 0-29 LOW, 30-59 MEDIUM, 60-100 HIGH.
"""
from .schemas import AIAnalysisResult

TECH_LABELS = {"technology monitoring", "phone monitoring", "tech monitoring"}


def calculate_risk(ai: AIAnalysisResult) -> tuple[int, str, list[str]]:
    score = 0
    reasons: list[str] = []

    indicators_lower = [k.lower() for k in ai.key_indicators]
    has_death_threat = ai.threat_detected and any(
        kw in " ".join(indicators_lower) for kw in ("death threat", "kill", "threat")
    )

    if has_death_threat:
        score += 30
        reasons.append("Explicit death threat")
    if ai.weapon_mentioned:
        score += 25
        reasons.append("Weapon mentioned")
    if ai.immediate_danger:
        score += 25
        reasons.append("Immediate danger")
    if ai.recurring_incident:
        score += 15
        reasons.append("Repeated pattern of behavior")
    if ai.stalking_detected:
        score += 10
        reasons.append("Stalking")
    if any(a.lower() in TECH_LABELS for a in ai.abuse_types) or any(
        "monitor" in k or "phone" in k for k in indicators_lower
    ):
        score += 5
        reasons.append("Technology monitoring")
    if "physical violence" in [a.lower() for a in ai.abuse_types] and not ai.immediate_danger:
        reasons.append("Physical violence")

    score = min(score, 100)
    level = "LOW" if score <= 29 else ("MEDIUM" if score <= 59 else "HIGH")
    return score, level, reasons
