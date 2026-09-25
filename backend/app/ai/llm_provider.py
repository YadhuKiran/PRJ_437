"""LLM provider (OpenAI-compatible). Uses stdlib only. Raises on any failure
so the caller can fall back to rule-based analysis. Never logs the narrative."""
import json
import urllib.request
from .base import BaseAIProvider
from .validator import validate_ai_output
from ..config import LLM_API_URL, LLM_API_KEY, LLM_MODEL

SYSTEM = (
    "You extract structured domestic-violence indicators from an incident description. "
    "NEVER invent information. If something is not mentioned, set the boolean to false "
    "and omit it from lists. Return ONLY this JSON object: "
    '{"abuse_types":[...],"threat_detected":bool,"weapon_mentioned":bool,'
    '"recurring_incident":bool,"stalking_detected":bool,"immediate_danger":bool,'
    '"key_indicators":[...],"summary":str}. '
    'Allowed abuse_types: physical violence, threat, stalking, technology monitoring, '
    "sexual violence, emotional abuse, financial abuse."
)


class LLMProvider(BaseAIProvider):
    def analyze(self, text: str):
        if not LLM_API_URL or not LLM_API_KEY:
            raise RuntimeError("LLM not configured (set LLM_API_URL and LLM_API_KEY)")
        body = json.dumps(
            {
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": text[:4000]},
                ],
                "temperature": 0,
                "response_format": {"type": "json_object"},
            }
        ).encode()
        req = urllib.request.Request(
            LLM_API_URL,
            data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {LLM_API_KEY}"},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode())
        content = payload["choices"][0]["message"]["content"]
        return validate_ai_output(json.loads(content))
