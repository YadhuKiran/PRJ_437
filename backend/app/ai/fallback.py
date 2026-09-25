"""Fallback rule-based analysis used ONLY if the AI provider fails.
Report submission must never be blocked by AI failure."""
from .mock_provider import MockProvider

_fallback = MockProvider()


def fallback_analysis(text: str):
    return _fallback.analyze(text)
