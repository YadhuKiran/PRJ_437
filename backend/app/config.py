"""Central configuration. Reads env, never hardcodes secrets."""
import os
from dotenv import load_dotenv

load_dotenv()

# ---- Runtime environment -------------------------------------------------
# development | demo | production
#   development  local work: verbose, dev defaults tolerated
#   demo         public demo deployment: seeded demo accounts allowed
#   production  real deployment: dev-default secrets are a startup error and
#                demo/default credentials are refused
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"
IS_DEMO = APP_ENV == "demo"


def is_production() -> bool:
    """True when running as a production deployment.

    Read at call time (not frozen at import) so the value always matches the
    current APP_ENV.
    """
    return APP_ENV == "production"


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


# ---- Storage -------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dv_reports.db")

# ---- Auth ----------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "480"))

# Demo/seeded staff accounts are NEVER created unless explicitly requested.
# The Replit demo sets SEED_STAFF=1 (see run_replit.sh); production must not.
SEED_STAFF = _bool_env("SEED_STAFF", False)
# Password for seeded staff accounts. When unset, a strong random password is
# generated and printed ONCE to the server console (never stored in the DB,
# never logged, never returned by an API).
SEED_STAFF_PASSWORD = os.getenv("SEED_STAFF_PASSWORD", "")
# Bootstrap-admin registration on an empty database is off unless explicitly
# enabled, so a failed seed can never turn /api/auth/register into a public
# admin-creation endpoint.
ALLOW_BOOTSTRAP_ADMIN = _bool_env("ALLOW_BOOTSTRAP_ADMIN", False)
# Shared secret that must be presented to bootstrap the first admin.
BOOTSTRAP_ADMIN_TOKEN = os.getenv("BOOTSTRAP_ADMIN_TOKEN", "")

# ---- HTTP / CORS ---------------------------------------------------------
# Comma-separated allowlist of browser origins allowed to call the API.
# Empty (default) = same-origin only: no cross-origin browser access at all.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Honour X-Forwarded-For for client identification. Only enable when the app
# runs behind a trusted reverse proxy that sets the header; otherwise a client
# can spoof it and evade rate limits.
TRUST_PROXY = _bool_env("TRUST_PROXY", False)

# ---- Rate limits (per client IP unless noted) ----------------------------
RATE_LIMIT_REPORTS = int(os.getenv("RATE_LIMIT_REPORTS", "10"))
RATE_LIMIT_LOGIN = int(os.getenv("RATE_LIMIT_LOGIN", "10"))
RATE_LIMIT_TRACK = int(os.getenv("RATE_LIMIT_TRACK", "20"))
RATE_LIMIT_WINDOW_S = float(os.getenv("RATE_LIMIT_WINDOW_S", "60"))


# ---- AI provider ---------------------------------------------------------
# Default to Jev (cloud decision model). Offline-safe: without a key the
# provider returns local extraction so the demo never breaks.
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


def startup_security_errors() -> list[str]:
    """Fatal misconfigurations for the current APP_ENV.

    Returned as a list of human-readable problems so the caller can fail the
    boot loudly instead of serving a publicly-writable deployment.
    """
    errors: list[str] = []
    if is_production():
        if is_dev_secret():
            errors.append(
                "JWT_SECRET is a development default. Set a strong JWT_SECRET "
                "before starting with APP_ENV=production."
            )
        if len(JWT_SECRET.encode()) < 32:
            errors.append("JWT_SECRET must be at least 32 bytes for HS256.")
        if SEED_STAFF and not SEED_STAFF_PASSWORD:
            errors.append(
                "SEED_STAFF is enabled with APP_ENV=production. Demo accounts "
                "must not be created in production."
            )
        if ALLOW_BOOTSTRAP_ADMIN:
            errors.append(
                "ALLOW_BOOTSTRAP_ADMIN must be disabled when APP_ENV=production."
            )
        if not CORS_ORIGINS:
            errors.append(
                "CORS_ORIGINS is empty. Set the explicit front-end origin(s) "
                "when APP_ENV=production."
            )
    return errors
