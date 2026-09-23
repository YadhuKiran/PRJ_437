import json

from app.ai.jev_provider import JevProvider


def test_jev_response_mapping_and_escalation(monkeypatch):
    provider = object.__new__(JevProvider)

    payload = {
        "model": "jev-1.13.0",
        "answers": {
            "primary_type": {
                "type": "choice",
                "choice": "threat",
                "confidence": 0.68,
                "probabilities": {"threat": 0.68, "physical_violence": 0.20, "other": 0.12},
            },
            "severity": {
                "type": "score",
                "score": 2.4,
                "confidence": 0.91,
            },
            "immediate_danger": {"type": "noul", "noul": 0.94},
            "death_threat": {"type": "noul", "noul": 0.91},
            "weapon_mentioned": {"type": "noul", "noul": 0.82},
            "recurring_incident": {"type": "noul", "noul": 0.21},
            "stalking_detected": {"type": "noul", "noul": 0.10},
            "technology_monitoring": {"type": "noul", "noul": 0.06},
            "physical_violence": {"type": "noul", "noul": 0.75},
            "sexual_violence": {"type": "noul", "noul": 0.03},
            "emotional_abuse": {"type": "noul", "noul": 0.04},
            "financial_abuse": {"type": "noul", "noul": 0.02},
        },
        "usage": {"input_tokens": 50},
    }

    monkeypatch.setattr(provider, "_post", lambda state: payload)
    result = provider.triage("He threatened to kill me and showed a weapon.")

    assert result.primary_abuse_type == "threat"
    assert result.route == "llm_review"
    assert result.ai_analysis.threat_detected is True
    assert result.ai_analysis.weapon_mentioned is True
    assert result.ai_analysis.immediate_danger is True
    assert "death threat" in result.ai_analysis.key_indicators
