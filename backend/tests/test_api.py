"""API tests: AI endpoints RBAC, status workflow, pagination, password change.

Run: python -m unittest discover -s tests -v  (from backend/)
Uses a temp SQLite file so the real dev DB is untouched. AI_PROVIDER is
forced to mock-equivalent offline path (no network, no key needed).
"""
import os
import tempfile
import unittest
import json

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
from app import ratelimit  # noqa: E402
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

    def setUp(self):
        # The API throttles logins and public submissions per client. The
        # test suite performs many of both, so the limiter state is reset
        # between tests (the throttling itself is covered in test_security).
        ratelimit.reset_state()

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
        # Staff that operate the AI layer can read the wiring status.
        r = self.client.get("/api/ai/status", headers=self._h("admin"))
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("jev_configured", body)
        # A read-only role cannot read the provider configuration.
        v = self.client.get("/api/ai/status", headers=self._h("viewer"))
        self.assertEqual(v.status_code, 403)
        # No fragment of the API key is ever returned.
        self.assertNotIn("key_hint", body)
        self.assertNotIn("sk-", json.dumps(body))

    # ---- additional coverage for previously untested behaviour ----

    def test_09_report_validation_rejects_short_description(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "victim", "description": "too short"})
        self.assertEqual(r.status_code, 422)
        # FastAPI returns a LIST of validation problems; the client must be
        # able to render them (this shape caused the "[object Object]" bug).
        self.assertIsInstance(r.json()["detail"], list)
        self.assertIn("msg", r.json()["detail"][0])

    def test_10_report_validation_rejects_unknown_reporter_type(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "not-a-type",
            "description": "A sufficiently long synthetic description for the test."})
        self.assertEqual(r.status_code, 400)

    def test_11_anonymous_report_drops_contact(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "anonymous", "contact": "should-be-dropped@example.test",
            "description": "A sufficiently long synthetic description for the test."})
        self.assertEqual(r.status_code, 200)
        rid = r.json()["id"]
        detail = self.client.get(f"/api/reports/{rid}", headers=self._h("admin"))
        self.assertEqual(detail.json()["contact"], "")

    def test_12_pagination_returns_distinct_slices(self):
        ids = []
        for i in range(5):
            r = self.client.post("/api/reports", json={
                "reporter_type": "anonymous",
                "description": f"Synthetic pagination case number {i} with enough characters."})
            ids.append(r.json()["id"])
        p1 = self.client.get("/api/reports?page=1&page_size=2", headers=self._h("handler")).json()
        p2 = self.client.get("/api/reports?page=2&page_size=2", headers=self._h("handler")).json()
        self.assertEqual(len(p1["items"]), 2)
        self.assertEqual(len(p2["items"]), 2)
        self.assertNotEqual(
            {i["id"] for i in p1["items"]}, {i["id"] for i in p2["items"]})
        self.assertGreaterEqual(p1["total"], 5)
        # An out-of-range page is clamped rather than returning a 500.
        p99 = self.client.get("/api/reports?page=99&page_size=2", headers=self._h("handler"))
        self.assertEqual(p99.status_code, 200)

    def test_13_password_change_success_path(self):
        # Create a throwaway user so the shared fixtures keep their passwords.
        from app.database import SessionLocal
        from app.auth import create_user
        db = SessionLocal()
        try:
            create_user(db, "pwtester", "OldPass123!", "viewer")
        finally:
            db.close()
        r = self.client.post("/api/auth/login",
                             json={"username": "pwtester", "password": "OldPass123!"})
        token = r.json()["access_token"]
        hdr = {"Authorization": f"Bearer {token}"}
        ch = self.client.post("/api/auth/change-password", headers=hdr,
                              json={"old_password": "OldPass123!", "new_password": "NewPass456!"})
        self.assertEqual(ch.status_code, 200, ch.text)
        # The old password no longer works, the new one does.
        self.assertEqual(self.client.post("/api/auth/login",
                         json={"username": "pwtester", "password": "OldPass123!"}).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login",
                         json={"username": "pwtester", "password": "NewPass456!"}).status_code, 200)

    def test_14_regenerating_analysis_clears_a_previous_override(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "anonymous",
            "description": DEMO + " Regeneration case for the override reset test."})
        rid = r.json()["id"]
        gen = self.client.post(f"/api/reports/{rid}/ai-analysis", headers=self._h("handler"))
        self.assertEqual(gen.status_code, 200)
        ov = self.client.post(f"/api/reports/{rid}/override-risk", headers=self._h("handler"),
                              json={"human_override": "LOW", "reason": "Synthetic override reason"})
        self.assertEqual(ov.status_code, 200)
        self.assertEqual(ov.json()["human_override"], "LOW")
        # Regenerating resets the human decision — it must not silently keep
        # an override that was made against a different assessment.
        again = self.client.post(f"/api/reports/{rid}/ai-analysis", headers=self._h("handler"))
        self.assertEqual(again.status_code, 200)
        self.assertIsNone(again.json()["human_override"])

    def test_15_override_requires_an_existing_assessment(self):
        r = self.client.post("/api/reports", json={
            "reporter_type": "anonymous",
            "description": "Synthetic case with no assessment generated yet."})
        rid = r.json()["id"]
        ov = self.client.post(f"/api/reports/{rid}/override-risk", headers=self._h("handler"),
                              json={"human_override": "LOW", "reason": "Synthetic override reason"})
        self.assertEqual(ov.status_code, 404)

    def test_16_override_validates_level_and_reason(self):
        bad_level = self.client.post(f"/api/reports/{self.report_id}/override-risk",
                                     headers=self._h("handler"),
                                     json={"human_override": "CRITICAL", "reason": "Valid reason here"})
        self.assertEqual(bad_level.status_code, 400)
        short = self.client.post(f"/api/reports/{self.report_id}/override-risk",
                                 headers=self._h("handler"),
                                 json={"human_override": "LOW", "reason": "no"})
        self.assertEqual(short.status_code, 422)

    def test_17_ai_verify_is_staff_only_and_never_echoes_the_narrative(self):
        anon = self.client.post("/api/ai/verify", json={})
        self.assertIn(anon.status_code, (401, 403))
        viewer = self.client.post("/api/ai/verify", json={}, headers=self._h("viewer"))
        self.assertEqual(viewer.status_code, 403)
        # Without a Jev key the endpoint reports a gateway error rather than
        # pretending the check succeeded.
        handler = self.client.post("/api/ai/verify", json={}, headers=self._h("handler"))
        self.assertIn(handler.status_code, (200, 502))
        if handler.status_code == 200:
            self.assertNotIn("threatened", handler.text)

    def test_18_health_reports_database_state(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("db_ok", body)
        self.assertIn("app_env", body)
        self.assertTrue(body["db_ok"])

    def test_19_me_returns_the_authoritative_role(self):
        r = self.client.get("/api/auth/me", headers=self._h("viewer"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["role"], "viewer")
        self.assertEqual(r.json()["username"], "viewer")

    def test_20_create_staff_is_admin_only(self):
        payload = {"username": "newcaseworker", "password": "ValidPass123!", "role": "case_handler"}
        denied = self.client.post("/api/auth/create-staff", json=payload, headers=self._h("handler"))
        self.assertEqual(denied.status_code, 403)
        ok = self.client.post("/api/auth/create-staff", json=payload, headers=self._h("admin"))
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual(ok.json()["role"], "case_handler")


if __name__ == "__main__":
    unittest.main()
