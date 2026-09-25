"""Central configuration. Reads env, never hardcodes secrets."""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dv_reports.db")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "480"))
# Default to Jev (cloud decision model). Offline-safe: without a key the
# provider returns local extraction so the Replit demo never breaks.
AI_PROVIDER = os.getenv("AI_PROVIDER", "jev").lower()  # jev | mock | llm

LLM_API_URL = os.getenv("LLM_API_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Jev decision layer (TypeSafe System One, hosted — NOT open source).
# Two hosts, same contract (verified Sept 2026):
#   TypeSafe (early-access key): POST https://api.typesafe.ai/v1/systemone
#       key from tokenra.io -> TYPESAFE_API_KEY / JEV_API_KEY, "sk-..." prefix
#   Jev-agent mirror (free key): POST https://jev-agent.com/api/v1/systemone
#       free key from https://jev-agent.com/api-access -> JEV_AGENT_KEY, "jv_live_..." prefix
# Leave all keys empty on Replit for the offline-safe demo path.
# If JEV_API_URL is set explicitly it always wins; otherwise the host is
# auto-selected from the key prefix.
JEV_API_KEY = os.getenv("JEV_API_KEY", "") or os.getenv("TYPESAFE_API_KEY", "")
JEV_AGENT_KEY = os.getenv("JEV_AGENT_KEY", "")
JEV_API_URL = os.getenv("JEV_API_URL", "") or os.getenv("JEV_AGENT_URL", "")
JEV_MODEL = os.getenv("JEV_MODEL", "jev-latest")

TYPESAFE_HOST = "https://api.typesafe.ai/v1/systemone"
JEV_AGENT_HOST = "https://jev-agent.com/api/v1/systemone"


def jev_credentials() -> tuple[str, str]:
    """Return (effective_key, effective_host). Never logs the key."""
    key = JEV_API_KEY or JEV_AGENT_KEY or os.getenv("OPENROUTER_API_KEY", "")
    url = JEV_API_URL
    if not url:
        if (JEV_AGENT_KEY or key.startswith("jv_live_")) and not JEV_API_KEY:
            url = JEV_AGENT_HOST
        else:
            url = TYPESAFE_HOST
    return key, url


def is_dev_secret() -> bool:
    return JWT_SECRET in ("dev-only-secret-change-me", "change-me-to-a-long-random-secret", "")
