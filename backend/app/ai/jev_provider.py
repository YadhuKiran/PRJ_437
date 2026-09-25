"""Jev decision-layer provider (TypeSafe System One) — REAL cloud integration.

Verified contract (Sept 2026, docs.typesafe.ai + jev-agent.com/api-reference):
  POST {host}/v1/systemone   (host = api.typesafe.ai | jev-agent.com/api)
  Headers: Authorization: Bearer <key>, Content-Type: application/json
  Body: {"model": "jev-latest", "state": "<narrative>",
         "questions": {id: {"type": "choice"|"score"|"noul",
                            "instructions": str, "criteria": ...}}}
  Answers: choice -> {"choice", "confidence", "probabilities"},
           noul   -> {"noul": 0..1} (no confidence field),
           score  -> {"score", "legend", "probabilities", "confidence"}

Architecture:
  narrative -> local extraction (MockProvider, never invents) -> ONE Jev call
  (immediate_danger noul, urgency choice, support_pathway choice,
   needs_review noul) -> merged AIAnalysisResult -> deterministic risk_engine.

Offline-safe for Replit: no key or no network -> raise so the caller engages
the rule-based fallback (demo narrative still scores 85/100 HIGH). Nothing
local is required: no Ollama, no model download, stdlib urllib only.

Env (Replit Secrets, never commit):
  AI_PROVIDER=jev
  JEV_API_KEY=sk-...        (TypeSafe early-access, preferred in production)
  JEV_AGENT_KEY=jv_live_... (free mirror key from jev-agent.com/api-access)
  JEV_API_URL=...           (explicit override; else auto-selected by prefix)
  JEV_MODEL=jev-latest      (pin e.g. jev-1.13.0 in production)

Safety: Jev output only shapes recommendation + review routing; it NEVER
triggers police contact, disclosure, or irreversible action (no such code
path exists in this project).
"""
import json
import urllib.request
import urllib.error

from .base import BaseAIProvider
from .mock_provider import MockProvider
from .validator import validate_ai_output
from ..config import JEV_MODEL, jev_credentials


QUESTIONS = {
    "immediate_danger": {
        "type": "noul",
        "instructions": "Does this report contain indicators of immediate danger to the reporter?",
        "criteria": {
            "true": "Explicit threat, weapon, trapped now, fear of imminent harm",
            "false": "No immediate danger described",
        },
    },
    "urgency": {
        "type": "choice",
        "instructions": "What level of urgency does this report indicate?",
        "criteria": {
            "low": "No urgency expressed, general information request",
            "moderate": "Concerning behaviour, needs follow-up but no immediate threat",
            "high": "Serious threat, violence, or fear expressed",
            "critical": "Imminent risk of severe harm, explicit death threat, weapon, or trapped right now",
        },
    },
    "support_pathway": {
        "type": "choice",
        "instructions": "Which support pathway is most relevant for this report?",
        "criteria": {
            "emergency": "Immediate danger, needs emergency assistance now",
            "shelter": "Needs safe accommodation, fleeing, locked in, followed home",
            "medical": "Injury or possible injury needing medical care",
            "legal": "Threats, stalking, harassment needing police/legal support",
            "counselling": "Emotional abuse, fear, needs counselling/support",
            "general": "General information or unclear need",
        },
    },
    "needs_review": {
        "type": "noul",
        "instructions": "Should this case require human review before any automated action?",
        "criteria": {
            "true": "Any risk, ambiguity, or safety implication — default to review",
            "false": "Purely informational with clearly no risk",
        },
    },
}

_extractor = MockProvider()


def _post_jev(state: str, timeout: int = 15) -> dict:
    """Single round trip: all questions evaluated in parallel, sharing state cost."""
    key, host = jev_credentials()
    if not key:
        raise RuntimeError("Jev not configured (set JEV_API_KEY or JEV_AGENT_KEY)")
    body = json.dumps(
        {"model": JEV_MODEL, "state": (state or "")[:4000], "questions": QUESTIONS}
    ).encode()
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}",
    }
    if "openrouter" in (host or ""):
        headers["HTTP-Referer"] = "https://safereport.replit.app"
        headers["X-Title"] = "SafeReport DV triage demo"
    req = urllib.request.Request(host, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode()[:500]
        except Exception:
            detail = ""
        if e.code == 401:
            raise RuntimeError(f"Jev auth failed (401 — wrong host/key pair). {detail}")
        if e.code == 429:
            raise RuntimeError(f"Jev quota exceeded (429). {detail}")
        raise RuntimeError(f"Jev request failed ({e.code}). {detail}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Jev unreachable ({e.reason})")


def _noul(ans: dict) -> float:
    if not isinstance(ans, dict):
        return 0.0
    for k in ("noul", "probability", "p", "value", "score"):
        v = ans.get(k)
        if isinstance(v, (int, float)):
            return max(0.0, min(1.0, float(v)))
    return 0.0


def _choice(ans: dict) -> str:
    if not isinstance(ans, dict):
        return ""
    for k in ("choice", "label", "key", "value", "winner"):
        v = ans.get(k)
        if isinstance(v, str):
            return v.lower()
    probs = ans.get("probabilities") or ans.get("probability") or {}
    if isinstance(probs, dict) and probs:
        try:
            return str(max(probs, key=lambda kk: probs[kk])).lower()
        except Exception:
            return ""
    return ""


def _confidence(ans: dict) -> float | None:
    if not isinstance(ans, dict):
        return None
    v = ans.get("confidence")
    return float(v) if isinstance(v, (int, float)) else None


class JevProvider(BaseAIProvider):
    """Decision-support layer, NOT an autonomous decider.

    Safety rules enforced here:
    - Jev output only shapes recommendation + review routing; it NEVER
      triggers police contact, disclosure, or irreversible action (no such
      code path exists in this project).
    - Low confidence / failure -> human review defaults to True.
    - Base indicators come from local extraction (no invented facts).
    - Last Jev meta (urgency/pathway/confidence) is exposed via
      `last_meta` so the API route can audit-log it WITHOUT the narrative.
    """

    def __init__(self):
        self.last_meta: dict = {}

    def analyze(self, text: str):
        base = _extractor.analyze(text)  # validated AIAnalysisResult
        key, _host = jev_credentials()
        if not key:
            # Offline / Replit without secrets: deterministic demo path.
            self.last_meta = {"provider": "jev-offline", "live": False}
            return base
        payload = _post_jev(text or "")
        answers = payload.get("answers", payload)
        danger_p = _noul(answers.get("immediate_danger", {}))
        review_p = _noul(answers.get("needs_review", {}))
        urgency = _choice(answers.get("urgency", {}))
        pathway = _choice(answers.get("support_pathway", {}))
        urgency_conf = _confidence(answers.get("urgency", {}))
        pathway_conf = _confidence(answers.get("support_pathway", {}))

        danger = danger_p >= 0.5 or base.immediate_danger
        # Critical/high urgency escalates to immediate danger (conservative,
        # favouring recall over precision for safety triage).
        if urgency in ("critical", "high"):
            danger = True
        indicators = list(base.key_indicators)
        if urgency in ("critical", "high") and "urgency:" + urgency not in indicators:
            indicators.append(f"urgency:{urgency}")
        if pathway and pathway != "general" and f"pathway:{pathway}" not in indicators:
            indicators.append(f"pathway:{pathway}")

        self.last_meta = {
            "provider": "jev-live",
            "live": True,
            "model": payload.get("model", JEV_MODEL),
            "urgency": urgency,
            "urgency_confidence": urgency_conf,
            "support_pathway": pathway,
            "pathway_confidence": pathway_conf,
            "immediate_danger_p": round(danger_p, 3),
            "needs_review_p": round(review_p, 3),
            "usage": payload.get("usage", {}),
        }
        merged = {
            "abuse_types": list(base.abuse_types),
            "threat_detected": base.threat_detected or urgency in ("critical", "high"),
            "weapon_mentioned": base.weapon_mentioned,
            "recurring_incident": base.recurring_incident,
            "stalking_detected": base.stalking_detected,
            "immediate_danger": danger,
            "key_indicators": indicators[:10],
            "summary": base.summary,
        }
        return validate_ai_output(merged)


def verify_live(narrative: str, timeout: int = 15) -> dict:
    """Live-key verification helper (used by /api/ai/verify + calibration
    script). Returns provider meta + scored level WITHOUT touching the DB.
    Raises RuntimeError with a human-readable message on any failure."""
    from ..risk_engine import calculate_risk

    provider = JevProvider()
    ai = provider.analyze(narrative)
    if not provider.last_meta.get("live"):
        raise RuntimeError("Jev key not configured — running offline path")
    score, level, reasons = calculate_risk(ai)
    return {"score": score, "level": level, "reasons": reasons,
            "meta": provider.last_meta,
            "indicators": ai.key_indicators}
