"""Risk-engine unit tests: score boundaries 29/30, 59/60, cap 100 + demo case.

Run: python -m unittest discover -s tests -v  (from backend/)
"""
import unittest

from app.schemas import AIAnalysisResult
from app.risk_engine import calculate_risk
from app.ai.mock_provider import MockProvider


def _ai(**kw) -> AIAnalysisResult:
    base = dict(abuse_types=[], threat_detected=False, weapon_mentioned=False,
                recurring_incident=False, stalking_detected=False,
                immediate_danger=False, key_indicators=[], summary="t")
    base.update(kw)
    return AIAnalysisResult(**base)


class TestRiskEngine(unittest.TestCase):
    def test_low_boundary_29(self):
        # 25 (weapon) is LOW; 30 (death threat) flips to MEDIUM.
        ai = _ai(weapon_mentioned=True, key_indicators=["weapon"])
        score, level, _ = calculate_risk(ai)
        self.assertEqual(score, 25)
        self.assertEqual(level, "LOW")

    def test_medium_boundary_30(self):
        ai = _ai(threat_detected=True, key_indicators=["death threat"])
        score, level, _ = calculate_risk(ai)
        self.assertEqual(score, 30)
        self.assertEqual(level, "MEDIUM")

    def test_medium_high_boundary_59_60(self):
        # 55 = 30 (death threat) + 25 (weapon) -> MEDIUM
        ai = _ai(threat_detected=True, weapon_mentioned=True,
                 key_indicators=["death threat", "weapon"])
        score, level, _ = calculate_risk(ai)
        self.assertEqual(score, 55)
        self.assertEqual(level, "MEDIUM")
        # 60 = + tech monitoring (5) -> HIGH
        ai2 = _ai(threat_detected=True, weapon_mentioned=True,
                  abuse_types=["technology monitoring"],
                  key_indicators=["death threat", "weapon", "phone monitoring"])
        score2, level2, _ = calculate_risk(ai2)
        self.assertEqual(score2, 60)
        self.assertEqual(level2, "HIGH")

    def test_cap_100(self):
        ai = _ai(threat_detected=True, weapon_mentioned=True, immediate_danger=True,
                 recurring_incident=True, stalking_detected=True,
                 abuse_types=["technology monitoring"],
                 key_indicators=["death threat", "kill", "phone monitoring"])
        score, level, _ = calculate_risk(ai)
        self.assertEqual(score, 100)  # 110 raw -> capped
        self.assertEqual(level, "HIGH")

    def test_demo_narrative_85_high(self):
        text = ("He hit me yesterday and threatened to kill me. "
                "He keeps checking my phone and follows me.")
        ai = MockProvider().analyze(text)
        score, level, reasons = calculate_risk(ai)
        self.assertEqual(score, 85)
        self.assertEqual(level, "HIGH")
        self.assertIn("Explicit death threat", reasons)

    def test_empty_narrative_low(self):
        ai = MockProvider().analyze("I would like general information about support services.")
        score, level, _ = calculate_risk(ai)
        self.assertLessEqual(score, 29)
        self.assertEqual(level, "LOW")


if __name__ == "__main__":
    unittest.main()
