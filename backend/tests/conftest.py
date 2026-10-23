"""Shared pytest fixtures: point every app import at a disposable database.

These environment variables MUST be set before anything imports `app.config`
or `app.database` — pytest imports conftest.py before collecting test modules
in this directory, so putting the setup here (not in the test files) is what
actually isolates the run. Import order inside a test module cannot.
"""
import os
import tempfile

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["AI_PROVIDER"] = "mock"
# Isolated, non-production test secret; never the deployed dev secret.
os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests-only")
os.environ.pop("JEV_API_KEY", None)
os.environ.pop("JEV_AGENT_KEY", None)
os.environ.pop("TYPESAFE_API_KEY", None)
