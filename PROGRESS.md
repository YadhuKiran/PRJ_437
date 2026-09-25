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
| `AI_PROVIDER=jev` without key (offline-safe) | `JevProvider` → demo narrative → `85/100 HIGH` (same as mock) |
| Single-service boot (`app.main` serves `frontend/dist`) | `GET /api/health` → `ok/jev`, `/` serves SPA, bundle has no `localhost` hardcode |

## 2. What is built

**Backend** (`backend/app/`, FastAPI) — unchanged by the redesign:
- Existing concepts: victim/anonymous/third-party reporting, case management, JWT auth, RBAC (`admin` / `case_handler` / `viewer`), audit logging, support resources.
- New AI layer (additive only): `ai/` provider abstraction (`mock` | `llm` | `jev`), Pydantic validation of all AI output, rule-based fallback, `risk_engine.py` (deterministic 30/25/25/15/10/5 scoring, max 100).
- Jev decision layer (`ai/jev_provider.py`, stdlib only): local extraction → one Jev SystemOne call (immediate_danger noul, urgency choice, support_pathway choice, needs_review noul) → merged result. No key/network → local extraction; Jev never triggers irreversible action.
- Replit single-service: `app/main.py` serves `frontend/dist` + SPA fallback on `$PORT`; `frontend/src/api.ts` uses same-origin API (`VITE_API_URL=""` at build); `run_replit.sh` + `.replit` boot API + UI together. API contracts unchanged.
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

### Must-have (demo readiness — 50% = public victim flow on Replit)
- [ ] Run the Replit demo once via UI (press Run → Report → Track with Case ID → Resources) and screenshot each step for the presentation.
- [ ] Optionally set `JEV_API_KEY` in Replit Secrets to show live Jev triage; without it the demo runs the offline-safe path (same 85/100 HIGH).
- [ ] Set a strong `JWT_SECRET` in Replit Secrets / `backend/.env` (current default is dev-only).
- [ ] Delete/reseed SQLite (`dv_reports.db` contains test data) before presenting, or point `DATABASE_URL` at PostgreSQL and re-run seed.

### Should-have (robustness)
- [ ] Automated tests: risk-engine unit tests (score boundaries 29/30, 59/60, cap 100) + API tests for the 3 AI endpoints (RBAC: viewer blocked from generate/override).
- [ ] Verify `AI_PROVIDER=llm` path with a real key once (env vars only, never commit) and confirm fallback engages when the key is absent.
- [ ] Add `.gitignore` (`__pycache__/`, `*.db`, `.env`, `node_modules/`, `dist/`) and make the first git commit.
- [ ] Case status workflow: allow handler to move `new` → `under_review` → `closed` (status field exists but has no update endpoint yet).

### Nice-to-have (only if time permits)
- [x] Victim status lookup UI — built (`TrackReport` → Case ID status timeline).
- [x] Audit-log viewer UI for admins — built (`AuditLog` page, admin-only).
- [ ] Pagination on report list; password-change endpoint; rate-limiting on public report submission.
- [ ] `AI_PROVIDER=jev` live-key verification on Replit + confidence-calibration experiment (rule-based vs LLM vs Jev vs LLM+Jev) for the paper.

### Explicitly out of scope (do not add)
AI chatbot, facial recognition, voice cloning, blockchain, automatic police notification, automatic legal decisions, automatic case rejection, recommendation systems.
