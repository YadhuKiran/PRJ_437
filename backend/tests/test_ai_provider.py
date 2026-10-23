"""Tests for the AI provider layer.

The Jev answer parser was completely untested: a change in the upstream
response shape would have silently degraded every risk assessment without
any test failing. These tests pin the parsing contract.

Run: python -m unittest discover -s tests -v  (from backend/)
"""
import os
import unittest

os.environ.setdefault("AI_PROVIDER", "mock")

from app.ai.jev_provider import _choice, _confidence, _noul, QUESTIONS  # noqa: E402
from app.ai.mock_provider import MockProvider  # noqa: E402
from app.ai.validator import ALLOWED_ABUSE, validate_ai_output  # noqa: E402
from app.risk_engine import calculate_risk  # noqa: E402

DEMO = ("He hit me yesterday and threatened to kill me. "
        "He keeps checking my phone and follows me.")


class TestJevAnswerParsing(unittest.TestCase):
    def test_noul_reads_probability(self):
        self.assertEqual(_noul({"noul": 0.8}), 0.8)
        self.assertEqual(_noul({"probability": 0.25}), 0.25)
        self.assertEqual(_noul({"p": 1}), 1.0)

    def test_noul_clamps_and_defaults(self):
        self.assertEqual(_noul({"noul": 5.0}), 1.0)
        self.assertEqual(_noul({"noul": -2.0}), 0.0)
        self.assertEqual(_noul({}), 0.0)
        self.assertEqual(_noul("not a dict"), 0.0)

    def test_choice_reads_label(self):
        self.assertEqual(_choice({"choice": "Critical"}), "critical")
        self.assertEqual(_choice({"label": "Shelter"}), "shelter")

    def test_choice_falls_back_to_probabilities(self):
        answer = {"probabilities": {"low": 0.1, "high": 0.9}}
        self.assertEqual(_choice(answer), "high")

    def test_choice_handles_missing_answers(self):
        self.assertEqual(_choice({}), "")
        self.assertEqual(_choice(None), "")

    def test_confidence_is_optional(self):
        self.assertEqual(_confidence({"confidence": 0.7}), 0.7)
        self.assertIsNone(_confidence({}))
        self.assertIsNone(_confidence({"confidence": "high"}))

    def test_question_set_is_bounded_and_typed(self):
        self.assertEqual(len(QUESTIONS), 4)
        self.assertEqual(QUESTIONS["immediate_danger"]["type"], "noul")
        self.assertEqual(QUESTIONS["urgency"]["type"], "choice")
        self.assertEqual(QUESTIONS["support_pathway"]["type"], "choice")
        self.assertEqual(QUESTIONS["needs_review"]["type"], "noul")
        for q in QUESTIONS.values():
            self.assertIn("instructions", q)
            self.assertIn("criteria", q)


class TestValidator(unittest.TestCase):
    def test_unknown_abuse_types_are_dropped(self):
        result = validate_ai_output({"abuse_types": ["physical violence", "invented category"]})
        self.assertEqual(result.abuse_types, ["physical violence"])
        self.assertNotIn("invented category", ALLOWED_ABUSE)

    def test_phone_monitoring_is_normalised(self):
        result = validate_ai_output({"abuse_types": ["phone monitoring"]})
        self.assertEqual(result.abuse_types, ["technology monitoring"])

    def test_non_dict_output_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_ai_output(["not", "a", "dict"])

    def test_missing_fields_default_to_false(self):
        result = validate_ai_output({})
        self.assertFalse(result.threat_detected)
        self.assertFalse(result.weapon_mentioned)
        self.assertEqual(result.key_indicators, [])

    def test_key_indicators_are_capped(self):
        result = validate_ai_output({"key_indicators": [f"k{i}" for i in range(50)]})
        self.assertEqual(len(result.key_indicators), 10)


class TestMockProviderContracts(unittest.TestCase):
    """The rule-based fallback must never invent facts."""

    def setUp(self):
        self.provider = MockProvider()

    def test_demo_narrative_scores_85_high(self):
        ai = self.provider.analyze(DEMO)
        score, level, reasons = calculate_risk(ai)
        self.assertEqual(score, 85)
        self.assertEqual(level, "HIGH")
        self.assertIn("Explicit death threat", reasons)
        self.assertIn("Stalking", reasons)
        self.assertIn("Technology monitoring", reasons)

    def test_weapon_is_detected_and_weighted(self):
        # A weapon on its own contributes +25 (documented scoring table).
        ai = self.provider.analyze("He pointed a knife at me and I am afraid.")
        self.assertTrue(ai.weapon_mentioned)
        score, level, reasons = calculate_risk(ai)
        self.assertEqual(score, 25)
        self.assertIn("Weapon mentioned", reasons)
        self.assertEqual(level, "LOW")

    def test_weapon_with_immediate_danger_is_higher(self):
        ai = self.provider.analyze(
            "He pointed a knife at me and threatened to kill me, I am afraid he will hurt me.")
        score, level, _ = calculate_risk(ai)
        self.assertGreaterEqual(score, 50)
        self.assertIn(level, ("MEDIUM", "HIGH"))

    def test_information_request_scores_low(self):
        ai = self.provider.analyze("I would like general information about support services.")
        score, level, _ = calculate_risk(ai)
        self.assertLess(score, 30)
        self.assertEqual(level, "LOW")

    def test_no_indicators_yields_low(self):
        ai = self.provider.analyze("We argued about money last week.")
        score, level, _ = calculate_risk(ai)
        self.assertEqual(level, "LOW")

    def test_empty_text_does_not_crash(self):
        ai = self.provider.analyze("")
        score, level, _ = calculate_risk(ai)
        self.assertEqual(score, 0)
        self.assertEqual(level, "LOW")


if __name__ == "__main__":
    unittest.main()
