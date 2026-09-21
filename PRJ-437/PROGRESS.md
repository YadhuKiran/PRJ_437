# PRJ-437 — Progress Tracker
Domestic Violence Reporting Platform + AI Risk Assessment enhancement.

> `README.md` = how to run the demo. This file = where the project stands and what remains.

## 1. Current status: working demo (verified end-to-end)

The full demo flow passes offline in mock mode (`AI_PROVIDER=mock`, no API key needed):

| Step | Result |
|---|---|
| Victim submits demo narrative | Case ID issued (e.g. `SR-45012`) |
| `POST /api/reports/{id}/ai-analysis` as handler | `85/100 HIGH` — physical violence, threat, stalking, tech monitoring detected; weapon not mentioned |
| Dashboard `GET /api/reports` | Case sorted first by risk score |
| `POST /api/reports/{id}/override-risk` → MEDIUM + reason | Stored with staff ID + timestamp, audit-logged |
| Unauthorized `GET ai-analysis` (no token) | `401` |
| Frontend `tsc --noEmit` | Passes |

## 2. What is built

**Backend** (`backend/app/`, FastAPI) — unchanged by the redesign:
- Existing concepts: victim/anonymous/third-party reporting, case management, JWT auth, RBAC (`admin` / `case_handler` / `viewer`), audit logging, support resources.
- New AI layer (additive only): `ai/` provider abstraction (`mock` | `llm`), Pydantic validation of all AI output, rule-based fallback, `risk_engine.py` (deterministic 30/25/25/15/10/5 scoring, max 100).
- Only 3 new endpoints: `POST` + `GET /api/reports/{id}/ai-analysis`, `POST /api/reports/{id}/override-risk`.
- Only 1 new table: `risk_assessments`.
- Safety: AI detail is staff-only; victim narratives never enter logs; AI failure never blocks submission.

**Frontend** (`frontend/src/`, React + TS + Vite + Lucide) — redesigned as premium Bento UI:
- Tokens in `tokens.css`; components in `components/` (BentoGrid/Card, StatCard, badges, ScoreBar, CaseCard, AiRiskCard, TopNavigation, QuickExit, StepIndicator, states).
- Public side (calm, separate from staff): Landing hero ("You're in control."), 4-step ReportWizard, TrackReport (Case ID → status timeline), Resources, persistent QuickExit.
- Staff side: Dashboard bento (stats, priority cases, CSS risk-distribution chart, recent activity from real audit data for admins, security card), Cases (risk filters + clickable cards), CaseDetails (AI risk card + incident overview + grouped analysis), AuditLog timeline (admin-only, graceful restricted view otherwise), redesigned StaffLogin.
- Verified: `tsc` clean, `vite build` succeeds, dev server serves, all API contracts re-tested live (submit → 85/100 HIGH → override → track → resources → list).

**Seed accounts** (via `python -m app.seed`): `admin/Admin123!`, `handler/Handler123!`, `viewer/Viewer123!`.

## 3. What is to be done next

### Must-have (demo readiness)
- [ ] Run the live demo once via UI (backend `uvicorn app.main:app --reload` + frontend `npm run dev`) and screenshot each of the 12 demo steps for the presentation.
- [ ] Set a strong `JWT_SECRET` in `backend/.env` (current default is dev-only; PyJWT already warns the key is short).
- [ ] Decide the database for the review: keep SQLite file (`dv_reports.db`, currently contains test data — delete/reseed before presenting) or point `DATABASE_URL` at PostgreSQL and re-run seed.

### Should-have (robustness)
- [ ] Automated tests: risk-engine unit tests (score boundaries 29/30, 59/60, cap 100) + API tests for the 3 AI endpoints (RBAC: viewer blocked from generate/override).
- [ ] Verify `AI_PROVIDER=llm` path with a real key once (env vars only, never commit) and confirm fallback engages when the key is absent.
- [ ] Add `.gitignore` (`__pycache__/`, `*.db`, `.env`, `node_modules/`, `dist/`) and make the first git commit.
- [ ] Case status workflow: allow handler to move `new` → `under_review` → `closed` (status field exists but has no update endpoint yet).

### Nice-to-have (only if time permits)
- [ ] Victim status lookup UI (API `GET /api/reports/by-case/{case_id}` exists; no frontend screen yet).
- [ ] Audit-log viewer UI for admins (API exists; no frontend screen yet).
- [ ] Pagination on report list; password-change endpoint; rate-limiting on public report submission.

### Explicitly out of scope (do not add)
AI chatbot, facial recognition, voice cloning, blockchain, automatic police notification, automatic legal decisions, automatic case rejection, recommendation systems.
