import os
from dotenv import load_dotenv

load_dotenv()

# Official TypeSafe System One endpoint.
JEV_API_URL = os.getenv("JEV_API_URL", "https://api.typesafe.ai/v1/systemone")
JEV_API_KEY = os.getenv("JEV_API_KEY") or os.getenv("TYPESAFE_API_KEY", "")
JEV_MODEL = os.getenv("JEV_MODEL", "jev-latest")
JEV_CONFIDENCE_THRESHOLD = float(os.getenv("JEV_CONFIDENCE_THRESHOLD", "0.70"))
JEV_SEVERITY_THRESHOLD = float(os.getenv("JEV_SEVERITY_THRESHOLD", "2.00"))
JEV_FLAG_PROB_THRESHOLD = float(os.getenv("JEV_FLAG_PROB_THRESHOLD", "0.70"))
