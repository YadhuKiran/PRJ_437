"""TypeSafe Jev decision layer.

Jev performs bounded, typed decisions before any optional free-form LLM step.
No incident narrative is stored in logs or persistence by this module.
"""
import json
import time
import urllib.request
from dataclasses import dataclass
from typing import Dict

from .validator import validate_ai_output
from .jev_config import (
    JEV_API_KEY,
    JEV_API_URL,
    JEV_MODEL,
    JEV_CONFIDENCE_THRESHOLD,
    JEV_SEVERITY_THRESHOLD,
    JEV_FLAG_PROB_THRESHOLD,
)
from ..schemas import AIAnalysisResult


ABUSE_CRITERIA = {
    "physical_violence": "physical assault, hitting, beating, kicking, or other physical violence",
    "threat": "threats of harm, intimidation, or threats to kill",
    "stalking": "following, repeated unwanted monitoring, waiting outside, or stalking",
    "technology_monitoring": "phone, location, account, spyware, message, or technology-based monitoring",
    "sexual_violence": "sexual assault, coercion, or unwanted sexual activity",
    "emotional_abuse": "humiliation, coercive control, intimidation, or persistent emotional abuse",
    "financial_abuse": "controlling money, income, accounts, property, or financial access",
}


@dataclass
class JevTriage:
    model: str
    primary_abuse_type: str
    primary_confidence: float
    probabilities: Dict[str, float]
    severity_score: float
    severity_confidence: float
    indicators: Dict[str, float]
    route: str
    escalation_reason: str
    latency_ms: int
    input_tokens: int | None
    ai_analysis: AIAnalysisResult


class JevProvider:
    def __init__(self):
        if not JEV_API_KEY:
            raise RuntimeError("JEV_API_KEY is not configured")
        if not JEV_API_URL:
            raise RuntimeError("JEV_API_URL is not configured")

    def _post(self, state: dict) -> dict:
        payload = {
            "model": JEV_MODEL,
            "state": state,
            "questions": {
                "primary_type": {
                    "type": "choice",
                    "instructions": "What is the primary type of domestic-violence incident described?",
                    "criteria": {
                        **ABUSE_CRITERIA,
                        "other": "the narrative does not fit the listed abuse categories or is too ambiguous",
                    },
                },
                "severity": {
                    "type": "score",
                    "instructions": "How severe are the safety-related indicators described in the report?",
                    "criteria": [
                        "No clear safety risk or only contextual information",
                        "Limited concern without a clear immediate safety signal",
                        "Significant safety concern or serious harm indicators",
                        "Explicit severe or immediate danger indicators",
                    ],
                },
                "immediate_danger": {
                    "type": "noul",
                    "instructions": "Does the report indicate that the person may be in immediate danger?",
                },
                "death_threat": {
                    "type": "noul",
                    "instructions": "Does the report contain an explicit threat to kill, murder, or cause death?",
                },
                "weapon_mentioned": {
                    "type": "noul",
                    "instructions": "Does the report mention a weapon in connection with the incident?",
                },
                "recurring_incident": {
                    "type": "noul",
                    "instructions": "Does the report describe repeated, ongoing, or recurring abusive behavior?",
                },
                "stalking_detected": {
                    "type": "noul",
                    "instructions": "Does the report describe stalking, following, repeated unwanted monitoring, or waiting outside?",
                },
                "technology_monitoring": {
                    "type": "noul",
                    "instructions": "Does the report describe phone, account, location, spyware, message, or other technology monitoring?",
                },
                "physical_violence": {
                    "type": "noul",
                    "instructions": "Does the report describe physical violence or assault?",
                },
                "sexual_violence": {
                    "type": "noul",
                    "instructions": "Does the report describe sexual violence, assault, or coercion?",
                },
                "emotional_abuse": {
                    "type": "noul",
                    "instructions": "Does the report describe emotional abuse, intimidation, humiliation, or coercive control?",
                },
                "financial_abuse": {
                    "type": "noul",
                    "instructions": "Does the report describe financial abuse or control of money, accounts, or property?",
                },
            },
        }
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            JEV_API_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {JEV_API_KEY}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            if response.status >= 300:
                raise RuntimeError(f"Jev request failed with HTTP {response.status}")
            return json.loads(response.read().decode("utf-8"))

    @staticmethod
    def _noul(answers: dict, key: str) -> float:
        value = answers.get(key) or {}
        return float(value.get("noul", 0.0) or 0.0)

    def triage(self, text: str) -> JevTriage:
        started = time.perf_counter()
        response = self._post({"report": (text or "")[:4000]})
        answers = response.get("answers") or {}

        primary = answers.get("primary_type") or {}
        primary_choice = str(primary.get("choice") or "other")
        primary_confidence = float(primary.get("confidence", 0.0) or 0.0)
        probabilities = {
            str(k): float(v)
            for k, v in (primary.get("probabilities") or {}).items()
        }

        severity = answers.get("severity") or {}
        severity_score = float(severity.get("score", 0.0) or 0.0)
        severity_confidence = float(severity.get("confidence", 0.0) or 0.0)

        indicators = {
            key: self._noul(answers, key)
            for key in (
                "immediate_danger",
                "death_threat",
                "weapon_mentioned",
                "recurring_incident",
                "stalking_detected",
                "technology_monitoring",
                "physical_violence",
                "sexual_violence",
                "emotional_abuse",
                "financial_abuse",
            )
        }

        high_flags = [
            key for key, value in indicators.items()
            if value >= JEV_FLAG_PROB_THRESHOLD
        ]
        reasons = []
        if primary_confidence < JEV_CONFIDENCE_THRESHOLD:
            reasons.append("low Jev classification confidence")
        if severity_score >= JEV_SEVERITY_THRESHOLD:
            reasons.append("elevated Jev severity score")
        if len(high_flags) >= 2:
            reasons.append("multiple high-probability risk indicators")

        route = "llm_review" if reasons else "deterministic"
        escalation_reason = "; ".join(reasons) if reasons else "Jev output is sufficiently specific for deterministic processing"

        abuse_types = []
        label_map = {
            "physical_violence": "physical violence",
            "threat": "threat",
            "stalking": "stalking",
            "technology_monitoring": "technology monitoring",
            "sexual_violence": "sexual violence",
            "emotional_abuse": "emotional abuse",
            "financial_abuse": "financial abuse",
        }
        for key, label in label_map.items():
            if self._noul(answers, key) >= 0.5:
                abuse_types.append(label)
        if not abuse_types and primary_choice in label_map:
            abuse_types = [label_map[primary_choice]]

        key_indicators = []
        if indicators["death_threat"] >= 0.5:
            key_indicators.append("death threat")
        if indicators["weapon_mentioned"] >= 0.5:
            key_indicators.append("weapon mentioned")
        if indicators["immediate_danger"] >= 0.5:
            key_indicators.append("immediate danger")
        if indicators["recurring_incident"] >= 0.5:
            key_indicators.append("repeated pattern")
        if indicators["stalking_detected"] >= 0.5:
            key_indicators.append("stalking")
        if indicators["technology_monitoring"] >= 0.5:
            key_indicators.append("technology monitoring")
        if indicators["physical_violence"] >= 0.5:
            key_indicators.append("physical violence")

        summary = (
            f"Jev classified the primary incident type as {primary_choice.replace('_', ' ')} "
            f"with {primary_confidence:.0%} confidence and assigned a severity estimate of "
            f"{severity_score:.2f}/3.00."
        )

        ai = validate_ai_output(
            {
                "abuse_types": abuse_types,
                "threat_detected": indicators["death_threat"] >= 0.5 or indicators.get("immediate_danger", 0) >= 0.8,
                "weapon_mentioned": indicators["weapon_mentioned"] >= 0.5,
                "recurring_incident": indicators["recurring_incident"] >= 0.5,
                "stalking_detected": indicators["stalking_detected"] >= 0.5,
                "immediate_danger": indicators["immediate_danger"] >= 0.5,
                "key_indicators": key_indicators,
                "summary": summary,
            }
        )

        elapsed = int(round((time.perf_counter() - started) * 1000))
        usage = response.get("usage") or {}
        model = str(response.get("model") or JEV_MODEL)
        return JevTriage(
            model=model,
            primary_abuse_type=primary_choice,
            primary_confidence=primary_confidence,
            probabilities=probabilities,
            severity_score=severity_score,
            severity_confidence=severity_confidence,
            indicators=indicators,
            route=route,
            escalation_reason=escalation_reason,
            latency_ms=elapsed,
            input_tokens=usage.get("input_tokens"),
            ai_analysis=ai,
        )
