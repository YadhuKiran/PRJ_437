# SafeReport — AI-Assisted Domestic Violence Reporting Platform

Premium Bento-style interface around the existing reporting + case-management +
AI risk-assessment workflow. The AI has ONE purpose: understand an unstructured
report and help authorized staff prioritize cases with an explainable risk
assessment. No chatbot, no auto-decisions.

## Stack
- Backend: Python + FastAPI (`backend/`) — unchanged by this redesign
- Frontend: React + TypeScript + Vite + Lucide icons (`frontend/`)
- DB: PostgreSQL via `DATABASE_URL`, SQLite fallback for offline demo
- AI: provider abstraction — `AI_PROVIDER=mock` (offline, default) or `llm`

## Run backend (offline demo)
```powershell
cd backend
pip install -r requirements.txt
copy .env.example .env   # keep AI_PROVIDER=mock
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

## Demo flow
1. Public home → **Report an Incident** → 4-step wizard (Incident → Details → Contact → Review) → note the Case ID.
2. **Track Existing Report** → enter the Case ID → status timeline (status only, no case details).
3. **Staff sign in** → `handler` / `Handler123!` → Dashboard (stats, priority cases, risk distribution, activity, security).
4. Open the demo case ("He hit me yesterday and threatened to kill me…") → **Generate AI Analysis** → **85/100 HIGH** with detected indicators and reasons.
5. Save a human override (e.g. MEDIUM + reason) → stored with staff ID + timestamp, audit-logged; view it under **Audit logs** as `admin`.

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

## API (unchanged contracts)
- `POST /api/reports` (public) · `GET /api/reports` (staff) · `GET /api/reports/{id}` (staff) · `GET /api/reports/by-case/{case_id}` (public, status only)
- `POST /api/auth/login` · `GET /api/audit` (admin)
- `POST /api/reports/{id}/ai-analysis` (case_handler, admin) · `GET` same (viewer included) · `POST /api/reports/{id}/override-risk` (case_handler, admin)

## Risk engine (deterministic, backend-calculated)
Death threat +30 · Weapon +25 · Immediate danger +25 · Repeated pattern +15 · Stalking +10 · Tech monitoring +5 (max 100). LOW 0–29, MEDIUM 30–59, HIGH 60–100.

## Security notes
- AI detail visible to authorized staff roles only; viewers cannot generate or override.
- Victim narratives are never written to app/audit logs (only ids + lengths).
- All AI output validated with Pydantic; AI failure never blocks report submission (fallback rule-based analysis, else `UNAVAILABLE`).
- No API key hardcoded; `LLM_API_KEY` comes from env only.
- Login/track errors use single calm messages that never reveal whether a username or Case ID exists.


## Jev-first triage (Review-2 revision)
- Optional Jev integration: TypeSafe System One decision layer for typed Choice/Score/Noul questions.
- Staff endpoint: POST /api/reports/{id}/jev-triage.
- Jev output is used to classify the primary abuse type, estimate severity, detect focused safety indicators, and route the case.
- Low-confidence, elevated-severity, or multi-indicator cases can enter the secondary AI path; otherwise the deterministic risk engine is used directly.
- Jev credentials are server-side environment variables only. Live Jev validation requires API access and is not assumed in offline demo mode.
