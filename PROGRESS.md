# PRJ-437 — Progress Tracker
Domestic Violence Reporting Platform + AI Risk Assessment enhancement.

> `README.md` = how to run the demo. This file = where the project stands and what remains.

## 1. Current status: working demo (verified end-to-end)

The full demo flow passes with `AI_PROVIDER=jev` (default; offline-safe without a key, no local model needed):

| Step | Result |
|---|---|
| Victim submits demo narrative | Case ID issued (e.g. `SR-45012`) |
| `POST /api/reports/{id}/ai-analysis` as handler | `85/100 HIGH` — physical violence, threat, stalking, tech monitoring detected; weapon not mentioned |
| Dashboard `GET /api/reports` | Case sorted first by risk score |
| `POST /api/reports/{id}/override-risk` → MEDIUM + reason | Stored with staff ID + timestamp, audit-logged |
| Unauthorized `GET ai-analysis` (no token) | `401` |
| Frontend `tsc --noEmit` | Passes |
| `AI_PROVIDER=jev` without key (offline-safe) | `JevProvider` → demo narrative → `85/100 HIGH` (offline path; live key escalates via urgency/pathway + confidence) |
| Single-service boot (`app.main` serves `frontend/dist`) | `GET /api/health` → `ok/jev`, `/` serves SPA, bundle has no `localhost` hardcode |
| Replit deploy hardening | `dist` committed (no build at boot), minimal `.replit`, pip skip when cached, ephemeral `JWT_SECRET`, `/` → 200 in ~5s |
| Demo seeding (`SEED_DEMO=1` in `run_replit.sh`) | Fresh deploy auto-creates staff logins + `SR-45012` → `85/100 HIGH` (idempotent, verified) |

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

## 3. Completion: 100% (all items below are done)

### Must-have (demo readiness — 50% = public victim flow on Replit)
- [x] Replit demo runs via UI (Report → Track with Case ID → Resources); single-service boot serves SPA + API together.
- [x] Live Jev triage via `JEV_API_KEY` (TypeSafe) or `JEV_AGENT_KEY` (free, `jev-agent.com/api-access`); without a key the demo runs the offline-safe path (same 85/100 HIGH). Wiring is visible at **Security & AI** + `GET /api/ai/status`; live key provable via **Verify live Jev** (`POST /api/ai/verify`).
- [x] Strong `JWT_SECRET`: `run_replit.sh` generates an ephemeral secret per boot when unset; backend warns on dev defaults (`/api/health` reports `dev_secret`).
- [x] Clean seed: `python -m app.seed` (+ `SEED_DEMO=1`) idempotently creates staff logins + `SR-45012` → `85/100 HIGH`; works on SQLite or PostgreSQL via `DATABASE_URL`.

### Should-have (robustness)
- [x] Automated tests (`backend/tests/`, `python -m unittest discover -s tests -v`, 14 tests): risk-engine boundaries 29/30, 59/60, cap 100, demo 85/HIGH + API tests for AI endpoints (RBAC: viewer blocked from generate/override), status workflow, pagination, password change, AI status.
- [x] `AI_PROVIDER=llm` fallback verified: missing key raises → caller engages rule-based fallback, else `UNAVAILABLE` — report submission never blocked.
- [x] `.gitignore` present (archive `__pycache__/`, `*.db`, `.env`, `node_modules/`; `dist/` intentionally tracked for fast Replit boot).
- [x] Case status workflow: `PATCH /api/reports/{id}/status` — handler forward-only `new` → `under_review` → `closed`, admin can reopen; audit-logged; UI chips on CaseDetails.

### Nice-to-have
- [x] Victim status lookup UI — built (`TrackReport` → Case ID status timeline).
- [x] Audit-log viewer UI for admins — built (`AuditLog` page, admin-only).
- [x] Pagination on report list (`GET /api/reports?page=&page_size=`, UI pager in Cases); password-change endpoint + UI (`POST /api/auth/change-password`, Security page); rate-limiting on public report submission (10/min/IP, stdlib-only, 429 with calm message).
- [x] `AI_PROVIDER=jev` live-key verification on Replit (`POST /api/ai/verify` + Security page button) + confidence-calibration scaffold (`backend/scripts/calibrate.py`: rule-based vs Jev-live table for the paper).

### Explicitly out of scope (do not add)
AI chatbot, facial recognition, voice cloning, blockchain, automatic police notification, automatic legal decisions, automatic case rejection, recommendation systems.
