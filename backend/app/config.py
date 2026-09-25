"""Central configuration. Reads env, never hardcodes secrets."""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dv_reports.db")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "480"))
AI_PROVIDER = os.getenv("AI_PROVIDER", "mock").lower()  # mock | llm | jev

LLM_API_URL = os.getenv("LLM_API_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o-mini")

# Jev decision layer (TypeSafe System One, hosted — NOT open source).
# Leave JEV_API_KEY empty on Replit for the offline-safe mock path;
# set it in Replit Secrets to enable live Jev triage.
JEV_API_KEY = os.getenv("JEV_API_KEY", "") or os.getenv("TYPESAFE_API_KEY", "") or os.getenv("OPENROUTER_API_KEY", "")
JEV_API_URL = os.getenv("JEV_API_URL", "https://api.typesafe.ai/v1/systemone")
JEV_MODEL = os.getenv("JEV_MODEL", "jev-latest")
