"""API tests: AI endpoints RBAC, status workflow, pagination, password change.

Run: python -m unittest discover -s tests -v  (from backend/)
Uses a temp SQLite file so the real dev DB is untouched. AI_PROVIDER is
forced to mock-equivalent offline path (no network, no key needed).
"""
import os
import tempfile
import unittest

_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["AI_PROVIDER"] = "mock"
os.environ["JWT_SECRET"] = "test-secret-for-unit-tests-only"

from fastapi.testclient import TestClient  # noqa: E402
from app import config  # noqa: E402
config.AI_PROVIDER = "mock"

from app.database import Base, engine, SessionLocal  # noqa: E402
from app.auth import create_user  # noqa: E402
import app.main as main_module  # noqa: E402

DEMO = ("He hit me yesterday and threatened to kill me. "
        "He keeps checking my phone and follows me.")


def _auth(username, password):
    c = TestClient(main_module.app)
    r = c.post("/api/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        for u, p, role in [("admin", "Admin123!", "admin"),
                           ("handler", "Handler123!", "case_handler"),
                           ("viewer", "Viewer123!", "viewer")]:
            if not db.query(__import__("app.models", fromlist=["User"]).User).filter_by(username=u).first():
                create_user(db, u, p, role)
        db.close()
        cls.client = TestClient(main_module.app)
        # One case to exercise AI + status + override flows.
        r = cls.client.post("/api/reports", json={
            "reporter_type": "victim", "contact": "", "location": "Test City",
            "incident_date": "yesterday",
            "description": DEMO + " Extra context to keep this report unique for tests."})
        assert r.status_code == 200, r.text
        cls.report_id = r.json()["id"]
        cls.case_id = r.json()["case_id"]

    @classmethod
    def tearDownClass(cls):
        try:
            os.unlink(_tmp.name)
        except OSError:
            pass

    def _h(self, role):
        pw = {"admin": "Admin123!", "handler": "Handler123!", "viewer": "Viewer123!"}[role]
        user = {"admin": "admin", "handler": "handler", "viewer": "viewer"}[role]
        return {"Authorization": f"Bearer {_auth(user, pw)}"}

    def test_01_health_reports_jev_defaults(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("ai_provider", body)

    def test_02_submit_and_track(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "anonymous", "description": "Need general info about support options please."})
        self.assertEqual(r.status_code, 200)
        cid = r.json()["case_id"]
        t = self.client.get(f"/api/reports/by-case/{cid}")
        self.assertEqual(t.status_code, 200)
        self.assertEqual(t.json()["status"], "new")

    def test_03_ai_generate_rbac(self):
        # handler can generate
        r = self.client.post(f"/api/reports/{self.report_id}/ai-analysis",
                             headers=self._h("handler"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["risk_level"], "HIGH")
        # viewer is blocked from generating
        v = self.client.post(f"/api/reports/{self.report_id}/ai-analysis",
                             headers=self._h("viewer"))
        self.assertEqual(v.status_code, 403)
        # no token -> 401/403
        anon = self.client.post(f"/api/reports/{self.report_id}/ai-analysis")
        self.assertIn(anon.status_code, (401, 403))
        # viewer CAN read
        g = self.client.get(f"/api/reports/{self.report_id}/ai-analysis",
                            headers=self._h("viewer"))
        self.assertEqual(g.status_code, 200)

    def test_04_override_rbac(self):
        r = self.client.post(f"/api/reports/{self.report_id}/override-risk",
                             headers=self._h("handler"),
                             json={"human_override": "MEDIUM",
                                   "reason": "Verified test override reason"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["human_override"], "MEDIUM")
        v = self.client.post(f"/api/reports/{self.report_id}/override-risk",
                             headers=self._h("viewer"),
                             json={"human_override": "LOW", "reason": "viewer attempt reason"})
        self.assertEqual(v.status_code, 403)

    def test_05_status_workflow(self):
        # handler moves forward new -> under_review
        r = self.client.patch(f"/api/reports/{self.report_id}/status",
                              headers=self._h("handler"),
                              json={"status": "under_review"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "under_review")
        # handler cannot move backward
        b = self.client.patch(f"/api/reports/{self.report_id}/status",
                              headers=self._h("handler"),
                              json={"status": "new"})
        self.assertEqual(b.status_code, 403)
        # admin can reopen / close any direction
        a = self.client.patch(f"/api/reports/{self.report_id}/status",
                              headers=self._h("admin"),
                              json={"status": "closed"})
        self.assertEqual(a.status_code, 200)
        self.assertEqual(a.json()["status"], "closed")
        # invalid status rejected
        bad = self.client.patch(f"/api/reports/{self.report_id}/status",
                                headers=self._h("admin"),
                                json={"status": "archived"})
        self.assertEqual(bad.status_code, 400)

    def test_06_pagination_shape(self):
        r = self.client.get("/api/reports?page=1&page_size=5", headers=self._h("handler"))
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("items", body)
        self.assertIn("total", body)
        self.assertIn("pages", body)
        self.assertLessEqual(len(body["items"]), 5)

    def test_07_password_change(self):
        # wrong current password fails
        bad = self.client.post("/api/auth/change-password", headers=self._h("viewer"),
                               json={"old_password": "wrong!", "new_password": "NewPass123!"})
        self.assertEqual(bad.status_code, 400)
        # too-short new password fails
        short = self.client.post("/api/auth/change-password", headers=self._h("viewer"),
                                 json={"old_password": "Viewer123!", "new_password": "short"})
        self.assertEqual(short.status_code, 400)

    def test_08_ai_status_endpoint(self):
        r = self.client.get("/api/ai/status", headers=self._h("viewer"))
        self.assertEqual(r.status_code, 200)
        self.assertIn("jev_configured", r.json())


if __name__ == "__main__":
    unittest.main()
