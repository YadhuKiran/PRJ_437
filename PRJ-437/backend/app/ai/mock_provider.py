"""Mock provider: deterministic keyword analysis. Works fully offline.

Must return realistic analysis for the demo narrative without inventing facts:
only flags what the text actually evidences.
"""
import re
from .base import BaseAIProvider
from .validator import validate_ai_output

WEAPON_RE = re.compile(r"\b(gun|knife|pistol|rifle|weapon|blade|bat|machete)\b", re.I)
KILL_RE = re.compile(r"\b(kill|murder|dead|death threat|die)\b", re.I)
THREAT_RE = re.compile(r"\b(threat|threaten|warned|told anyone|or else)\b", re.I)
HIT_RE = re.compile(r"\b(hit|hits|hitting|beat|beating|slap|slapped|punch|punched|kick|kicked|assault|attack)\b", re.I)
STALK_RE = re.compile(r"\b(follow|follows|following|stalk|watching me|waiting outside|shows up)\b", re.I)
PHONE_RE = re.compile(r"\b(phone|check.*phone|monitoring|tracking|spyware|messages|location)\b", re.I)
REPEAT_RE = re.compile(r"\b(keeps|keep|again|every day|repeatedly|always|often|yesterday.*keeps|keeps.*check)\b", re.I)
DANGER_RE = re.compile(r"\b(kill|threat|afraid|fear|danger|hurt|harm|yesterday)\b", re.I)


class MockProvider(BaseAIProvider):
    def analyze(self, text: str):
        t = text or ""
        weapon = bool(WEAPON_RE.search(t))
        kill = bool(KILL_RE.search(t))
        threat = bool(THREAT_RE.search(t)) or kill
        hit = bool(HIT_RE.search(t))
        stalk = bool(STALK_RE.search(t))
        phone = bool(PHONE_RE.search(t))
        repeat = bool(REPEAT_RE.search(t))
        danger = bool(DANGER_RE.search(t)) and (kill or hit or threat)

        abuse = []
        if hit:
            abuse.append("physical violence")
        if threat or kill:
            abuse.append("threat")
        if stalk:
            abuse.append("stalking")
        if phone:
            abuse.append("technology monitoring")

        indicators = []
        if kill:
            indicators.append("death threat")
        if hit:
            indicators.append("physical violence")
        if phone:
            indicators.append("phone monitoring")
        if stalk:
            indicators.append("stalking")
        if threat and not kill:
            indicators.append("threat")

        parts = []
        if hit:
            parts.append("physical violence")
        if kill:
            parts.append("an explicit threat of serious harm")
        elif threat:
            parts.append("a threat")
        if stalk:
            parts.append("stalking")
        if phone:
            parts.append("phone monitoring")
        summary = (
            "The report describes " + ", ".join(parts) + "." if parts else "not mentioned"
        )

        return validate_ai_output(
            {
                "abuse_types": abuse,
                "threat_detected": threat,
                "weapon_mentioned": weapon,
                "recurring_incident": repeat,
                "stalking_detected": stalk,
                "immediate_danger": danger,
                "key_indicators": indicators,
                "summary": summary,
            }
        )
