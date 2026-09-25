"""Confidence-calibration experiment scaffold (for the paper).

Compares, on a small labelled set of synthetic narratives:
  rule-based (MockProvider) vs Jev-live (if a key is set) —
  plus the deterministic risk_engine score/level for each.

No victim data, no network unless a Jev key is configured. Run:
  python -m scripts.calibrate  (from backend/)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.mock_provider import MockProvider
from app.risk_engine import calculate_risk
from app.config import jev_credentials

CASES = [
    ("He hit me yesterday and threatened to kill me. He keeps checking my phone and follows me.",
     "HIGH"),
    ("She pushed me once last month, no threats since. I want counselling information.",
     "LOW"),
    ("He waits outside my work every day and sends threatening messages. I am afraid.",
     "HIGH"),
    ("I would like general information about support services.",
     "LOW"),
    ("He took my money and controls the bank account. No physical violence.",
     "LOW"),  # rule-based: financial abuse flagged, no physical-threat weight; Jev routes via support_pathway
]

print(f"{'expected':<8} {'rule_score':<10} {'rule_level':<8} {'jev_score':<9} {'jev_level':<8} narrative")
print("-" * 110)
rule = MockProvider()
key, _ = jev_credentials()
jev = None
if key:
    from app.ai.jev_provider import JevProvider
    jev = JevProvider()

for text, expected in CASES:
    ai = rule.analyze(text)
    s, lvl, _ = calculate_risk(ai)
    js, jlvl = "-", "-"
    if jev:
        try:
            jai = jev.analyze(text)
            js, jlvl, _ = calculate_risk(jai)
        except Exception as e:
            jlvl = f"ERR:{e}"
    print(f"{expected:<8} {s:<10} {lvl:<8} {js!s:<9} {jlvl!s:<8} {text[:70]}")

print()
if not key:
    print("Jev key not set — showing rule-based only. Set JEV_API_KEY or JEV_AGENT_KEY for the live column.")
else:
    print("Live Jev column populated. Low-confidence cases should default to human review (see needs_review_p in audit details).")
