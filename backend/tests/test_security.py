"""Security regression tests for the Stage 0 hardening.

Every test here corresponds to a verified audit finding:
  C1/C2  seeded default credentials + public admin bootstrap
  C3     CORS origin reflection with credentials
  C4     API key fragment exposure
  C5     viewer role reading the victim narrative / contact PII
  C6/C7  throttling of the public tracking + login endpoints
  B1     unknown API routes must be 404, not 200

Run: python -m unittest discover -s tests -v  (from backend/)
"""
import os
import tempfile
import unittest

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["AI_PROVIDER"] = "mock"
os.environ["JWT_SECRET"] = "test-secret-for-unit-tests-only-0123456789"
# Never leak a real key into a test run.
os.environ.pop("JEV_API_KEY", None)
os.environ.pop("JEV_AGENT_KEY", None)
os.environ.pop("TYPESAFE_API_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

import app.main as main_module  # noqa: E402
from app.database import Base, engine, SessionLocal  # noqa: E402
from app.auth import create_user  # noqa: E402
from app.models import User  # noqa: E402
from app import ratelimit  # noqa: E402

DEMO = ("He hit me yesterday and threatened to kill me. "
        "He keeps checking my phone and follows me.")


class TestSecurityBaseline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        for u, p, role in [("admin", "Admin123!", "admin"),
                           ("handler", "Handler123!", "case_handler"),
                           ("viewer", "Viewer123!", "viewer")]:
            if not db.query(User).filter_by(username=u).first():
                create_user(db, u, p, role)
        db.close()
        cls.client = TestClient(main_module.app)

    @classmethod
    def tearDownClass(cls):
        try:
            os.unlink(_tmp.name)
        except OSError:
            pass

    def setUp(self):
        ratelimit.reset_state()

    def _token(self, username, password):
        r = self.client.post("/api/auth/login",
                             json={"username": username, "password": password})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["access_token"]

    def _hdr(self, username, password):
        return {"Authorization": f"Bearer {self._token(username, password)}"}

    def _mk_case(self, contact="synthetic.contact@example.test"):
        r = self.client.post("/api/reports", json={
            "reporter_type": "victim", "contact": contact, "location": "Test City",
            "incident_date": "yesterday", "description": DEMO})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["id"], r.json()["case_id"]

    # ---- C2: bootstrap registration is not a public admin endpoint ----
    def test_01_public_register_disabled_by_default(self):
        r = self.client.post("/api/auth/register",
                             json={"username": "attacker", "password": "attacker123",
                                   "role": "admin"})
        self.assertEqual(r.status_code, 403, r.text)
        self.assertNotIn("access_token", r.text)

    def test_02_register_requires_bootstrap_token(self):
        from app import config
        original = config.ALLOW_BOOTSTRAP_ADMIN
        config.ALLOW_BOOTSTRAP_ADMIN = True
        try:
            # Wrong / missing token is refused.
            r = self.client.post("/api/auth/register",
                                 json={"username": "attacker2", "password": "attacker123",
                                       "role": "admin", "bootstrap_token": "wrong"})
            self.assertIn(r.status_code, (403, 503), r.text)
        finally:
            config.ALLOW_BOOTSTRAP_ADMIN = original

    # ---- C3: no CORS origin reflection ----
    def test_03_cors_does_not_reflect_foreign_origin(self):
        r = self.client.options("/api/reports", headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        })
        allow_origin = r.headers.get("access-control-allow-origin", "")
        self.assertNotEqual(allow_origin, "*")
        self.assertNotEqual(allow_origin, "https://evil.example")
        self.assertNotIn("https://evil.example", allow_origin)

    # ---- C4: no API key material in any staff-visible payload ----
    def test_04_ai_status_never_exposes_key_material(self):
        from app import config
        original = config.JEV_API_KEY
        config.JEV_API_KEY = "sk-SECRET-VALUE-1234567890"
        try:
            r = self.client.get("/api/ai/status", headers=self._hdr("admin", "Admin123!"))
            self.assertEqual(r.status_code, 200, r.text)
            body = r.text
            self.assertNotIn("sk-SECRET", body)
            self.assertNotIn("SECRET-VALUE", body)
            self.assertNotIn("key_hint", body)
        finally:
            config.JEV_API_KEY = original

    # ---- C5: viewer must not receive narrative or contact ----
    def test_05_viewer_cannot_read_narrative_or_contact(self):
        rid, _cid = self._mk_case()
        r = self.client.get(f"/api/reports/{rid}", headers=self._hdr("viewer", "Viewer123!"))
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body.get("description"), "")
        self.assertEqual(body.get("contact"), "")
        self.assertNotIn("threatened to kill", r.text)
        self.assertNotIn("synthetic.contact@example.test", r.text)
        # ...but the case metadata is still available to a read-only role.
        self.assertIn("status", body)
        self.assertIn("case_id", body)

    def test_06_case_handler_can_read_narrative(self):
        rid, _cid = self._mk_case()
        r = self.client.get(f"/api/reports/{rid}", headers=self._hdr("handler", "Handler123!"))
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertIn("threatened to kill", body["description"])
        self.assertEqual(body["contact"], "synthetic.contact@example.test")

    # ---- C7: login throttling ----
    def test_07_login_is_throttled(self):
        codes = []
        for i in range(15):
            r = self.client.post("/api/auth/login",
                                 json={"username": "admin", "password": f"guess-{i}"})
            codes.append(r.status_code)
            if r.status_code == 429:
                break
        self.assertIn(429, codes, f"login was never throttled: {codes}")

    def test_08_throttle_is_scoped_per_username(self):
        # Exhaust the admin bucket; a different account must still be usable.
        for i in range(15):
            r = self.client.post("/api/auth/login",
                                 json={"username": "admin", "password": f"guess-{i}"})
            if r.status_code == 429:
                break
        other = self.client.post("/api/auth/login",
                                 json={"username": "viewer", "password": "Viewer123!"})
        self.assertEqual(other.status_code, 200, other.text)

    # ---- C6: tracking is throttled ----
    def test_09_tracking_is_throttled(self):
        _rid, cid = self._mk_case()
        codes = []
        for _ in range(40):
            r = self.client.get(f"/api/reports/by-case/{cid}")
            codes.append(r.status_code)
            if r.status_code == 429:
                break
        self.assertIn(429, codes, f"tracking was never throttled: {codes}")

    def test_10_case_ids_are_six_digits(self):
        _rid, cid = self._mk_case()
        self.assertRegex(cid, r"^SR-\d{6}$")

    # ---- B1: unknown API routes are 404 ----
    def test_11_unknown_api_route_is_404(self):
        r = self.client.get("/api/definitely-not-a-route")
        self.assertEqual(r.status_code, 404, r.text)

    # ---- C8: production refuses unsafe configuration ----
    def test_12_production_startup_rejects_dev_secret(self):
        from app import config
        from app.config import startup_security_errors
        original_env = config.APP_ENV
        original_secret = config.JWT_SECRET
        config.APP_ENV = "production"
        config.JWT_SECRET = "dev-only-secret-change-me"
        try:
            problems = startup_security_errors()
            self.assertTrue(problems, "dev secret must be rejected in production")
            self.assertTrue(any("JWT_SECRET" in p for p in problems))
        finally:
            config.APP_ENV = original_env
            config.JWT_SECRET = original_secret

    def test_13_production_startup_rejects_demo_seeding(self):
        from app import config
        from app.config import startup_security_errors
        original_env = config.APP_ENV
        original_secret = config.JWT_SECRET
        original_seed = config.SEED_STAFF
        original_pwd = config.SEED_STAFF_PASSWORD
        config.APP_ENV = "production"
        config.JWT_SECRET = "x" * 48
        config.SEED_STAFF = True
        config.SEED_STAFF_PASSWORD = ""
        try:
            problems = startup_security_errors()
            self.assertTrue(any("SEED_STAFF" in p for p in problems))
        finally:
            config.APP_ENV = original_env
            config.JWT_SECRET = original_secret
            config.SEED_STAFF = original_seed
            config.SEED_STAFF_PASSWORD = original_pwd

    # ---- audit log must never contain the narrative ----
    def test_14_audit_log_excludes_narrative_and_contact(self):
        rid, _cid = self._mk_case()
        self.client.get(f"/api/reports/{rid}", headers=self._hdr("admin", "Admin123!"))
        r = self.client.get("/api/audit", headers=self._hdr("admin", "Admin123!"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("threatened to kill", r.text)
        self.assertNotIn("synthetic.contact@example.test", r.text)


class TestSeedBehaviour(unittest.TestCase):
    """C1: seeding must never create well-known default passwords implicitly."""

    def test_seed_uses_generated_password_not_defaults(self):
        import importlib
        from app import config
        original = config.SEED_STAFF_PASSWORD
        config.SEED_STAFF_PASSWORD = ""
        try:
            mod = importlib.reload(importlib.import_module("app.seed"))
            db = SessionLocal()
            try:
                from app.models import User as U
                for u in ("admin", "handler", "viewer"):
                    if db.query(U).filter_by(username=u).first():
                        db.query(U).filter_by(username=u).delete()
                db.commit()
                mod._seed_staff(db, use_demo_passwords=False)
                for u, role in (("admin", "admin"), ("handler", "case_handler"),
                                ("viewer", "viewer")):
                    user = db.query(U).filter_by(username=u).first()
                    self.assertIsNotNone(user, f"{u} was not seeded")
                    # The stored hash must not match the well-known demo password.
                    from app.auth import verify_password
                    self.assertFalse(verify_password("Admin123!", user))
                    self.assertFalse(verify_password("Handler123!", user))
                    self.assertFalse(verify_password("Viewer123!", user))
            finally:
                db.close()
        finally:
            config.SEED_STAFF_PASSWORD = original


if __name__ == "__main__":
    unittest.main()
