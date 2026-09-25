# SafeReport — AI-Assisted Domestic Violence Reporting Platform

Premium Bento-style interface around the existing reporting + case-management +
AI risk-assessment workflow. The AI has ONE purpose: understand an unstructured
report and help authorized staff prioritize cases with an explainable risk
assessment. No chatbot, no auto-decisions.

## Stack
- Backend: Python + FastAPI (`backend/`) — also serves the built frontend on Replit (single service)
- Frontend: React + TypeScript + Vite + Lucide icons (`frontend/`)
- DB: PostgreSQL via `DATABASE_URL`, SQLite fallback for offline demo
- AI: Jev cloud decision model (`AI_PROVIDER=jev`, default, offline-safe without a key) | `mock` (keyword demo) | `llm` (OpenAI-compatible)

## Run backend (offline demo)
```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env   # AI_PROVIDER=jev (offline-safe without a key)
python -m app.seed       # creates admin/Admin123!, handler/Handler123!, viewer/Viewer123!
python -m uvicorn app.main:app --reload   # http://localhost:8000
```

PostgreSQL instead: set `DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/dv_reports` in `.env`.

## Run frontend
```powersshell
cd frontend
npm install
npm run dev   # http://localhost:5173 (API at http://localhost:8000)
```

## Demo flow (50% target = public victim flow, steps 1–2)
1. Public home → **Report an Incident** → 4-step wizard (Incident → Details → Contact → Review) → note the Case ID.
2. **Track Existing Report** → enter the Case ID → status timeline (status only, no case details).
3. **Staff sign in** → `handler` / `Handler123!` → Dashboard (stats, priority cases, risk distribution, activity, security).
4. Open the demo case ("He hit me yesterday and threatened to kill me…") → **Generate AI Analysis** → **85/100 HIGH** with detected indicators and reasons.
5. Save a human override (e.g. MEDIUM + reason) → stored with staff ID + timestamp, audit-logged; view it under **Audit logs** as `admin`.

## Deploy on Replit (demo)
One service serves API + built frontend (`run_replit.sh`, `.replit`). Boot takes seconds: no build at startup (`frontend/dist` is committed), pip install is skipped when cached, `/` returns 200 immediately for health checks.

1. Push to GitHub → Replit → Create Repl → Import from GitHub.
2. Secrets (all optional — defaults give the full offline-safe demo):

   | Secret | Default | Purpose |
   |---|---|---|
   | `AI_PROVIDER` | `jev` | `jev` (live Jev triage, offline-safe without key) \| `mock` \| `llm` |
   | `JEV_API_KEY` | empty | Live TypeSafe triage (early-access key, `sk-...`) |
   | `JEV_AGENT_KEY` | empty | Free mirror key from `jev-agent.com/api-access` (`jv_live_...`) — same contract |
   | `JEV_API_URL` | auto | Explicit host override (else auto-selected from key prefix) |
   | `JEV_MODEL` | `jev-latest` | Pin e.g. `jev-1.13.0` in production |
   | `JWT_SECRET` | ephemeral per boot | Auto-generated if unset; set your own for stable logins |
   | `DATABASE_URL` | SQLite file | Point at Postgres for a persistent review DB |

3. Press **Run** → public flow at `/`, health at `/api/health` (reports `ai_provider`).

Every boot seeds (idempotent): staff logins `admin/Admin123!`, `handler/Handler123!`, `viewer/Viewer123!` + canonical demo case **`SR-45012` (85/100 HIGH)** — open it as handler and press **Generate AI Analysis**, or track `SR-45012` from the public side. Note: the SQLite DB resets on redeploy; demo data is re-seeded automatically.

Local single-service check: `cd frontend && VITE_API_URL="" npm run build`, then `cd backend && python -m uvicorn app.main:app`.

## Jev decision layer (`AI_PROVIDER=jev`, default)
Jev (TypeSafe System One, launched Sept 2026) is a **hosted proprietary** decision model — not open source. Pipeline: narrative → local extraction (no invented facts) → one Jev call with 4 bounded questions (`immediate_danger` noul, `urgency` choice, `support_pathway` choice, `needs_review` noul) → merged result → existing deterministic risk engine scores. No key/network → falls back to local extraction (same `85/100 HIGH` on the demo narrative), so the Replit demo never breaks. Jev only shapes recommendation + review routing; it never triggers police contact, disclosure, or any irreversible action (no such code path exists).

Two hosts, same contract (`POST /v1/systemone`, verified Sept 2026): `https://api.typesafe.ai/v1/systemone` (TypeSafe key) and `https://jev-agent.com/api/v1/systemone` (free `jv_live_...` key from `jev-agent.com/api-access`). The host auto-selects from the key prefix unless `JEV_API_URL` is set.

Staff can check wiring at **Security & AI** (GET `/api/ai/status`) and prove the live key with **Verify live Jev** (POST `/api/ai/verify` — scores the demo narrative without touching the DB). Calibration scaffold for the paper: `cd backend && python -m scripts.calibrate`.

## Frontend design system (Bento UI)
- Design tokens: `frontend/src/tokens.css` (colors, spacing, radius, shadows, typography, transitions).
- Components: `frontend/src/components/` — `ui.tsx` (BentoGrid/Card, StatCard, Risk/Status badges, ScoreBar, Empty/Error/Skeleton states), `TopNavigation`, `QuickExit`, `StepIndicator`, `CaseCard`, `AiRiskCard`.
- Pages: `frontend/src/pages/` — Landing, ReportWizard, TrackReport, Resources (public) + StaffLogin, Dashboard, Cases, CaseDetails, AuditLog (staff).
- Palette: deep navy + neutral gray + white cards; muted green/amber/red risk colors only. Inter/Manrope, 16–24px card radius, hairline borders + soft shadows.
- Responsive: 12-col grid → 2-col tablet → stacked mobile; victim flow is mobile-first. Reduced-motion supported, skip link, focus-visible states, ARIA labels.

## Deliberate omissions (no fake functionality)
- **Tracking PIN**: the spec sketch shows one, but the backend (`GET /api/reports/by-case/{case_id}`) authenticates by Case ID only — so Track uses Case ID alone.
- **Evidence-upload step**: the backend accepts narrative text only, so the wizard is 4 steps (no evidence step) instead of 5.
- **Notifications**: the bell shows the real count of open HIGH-risk cases (no fabricated notification feed).
- **Dark mode**: light theme prioritized per spec; tokens are centralized so a dark theme can be added later.

## API (unchanged contracts, plus additive endpoints)
- `POST /api/reports` (public, 10/min/IP rate-limited) · `GET /api/reports?page=&page_size=` (staff, paginated) · `GET /api/reports/{id}` (staff) · `GET /api/reports/by-case/{case_id}` (public, status only)
- `PATCH /api/reports/{id}/status` (handler forward `new` → `under_review` → `closed`; admin can reopen)
- `POST /api/auth/login` · `POST /api/auth/change-password` (authenticated) · `GET /api/audit` (admin)
- `POST /api/reports/{id}/ai-analysis` (case_handler, admin) · `GET` same (viewer included) · `POST /api/reports/{id}/override-risk` (case_handler, admin)
- `GET /api/ai/status` (staff — provider wiring, never leaks keys) · `POST /api/ai/verify` (handler/admin — live Jev check, no DB writes)

## Risk engine (deterministic, backend-calculated)
Death threat +30 · Weapon +25 · Immediate danger +25 · Repeated pattern +15 · Stalking +10 · Tech monitoring +5 (max 100). LOW 0–29, MEDIUM 30–59, HIGH 60–100.

## Security notes
- AI detail visible to authorized staff roles only; viewers cannot generate or override.
- Victim narratives are never written to app/audit logs (only ids + lengths).
- All AI output validated with Pydantic; AI failure never blocks report submission (fallback rule-based analysis, else `UNAVAILABLE`).
- No API key hardcoded; `LLM_API_KEY` / `JEV_API_KEY` come from env (Replit Secrets) only.
- Login/track errors use single calm messages that never reveal whether a username or Case ID exists.
