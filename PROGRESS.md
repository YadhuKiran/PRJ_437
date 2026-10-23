# PRJ-437 — Progress Tracker

Domestic Violence Reporting Platform + AI risk assessment.

> `README.md` = how to run it. This file = what state the project is in.

## 1. Current state

The full demo flow is verified end-to-end in a real browser (Chromium, via
REA) against the current build:

| Step | Verified result |
|---|---|
| Victim submits the synthetic narrative | Case ID issued (`SR-` + 6 digits) |
| `POST /api/reports/{id}/ai-analysis` as handler | **85/100 HIGH** — violence, death threat, stalking, tech monitoring; no weapon mentioned |
| Dashboard `GET /api/reports` | Highest risk first, unassessed cases last |
| `POST /api/reports/{id}/override-risk` → MEDIUM + reason | Stored with staff ID + timestamp, audit-logged, shown in the UI |
| `GET /api/reports/{id}` as `viewer` | Metadata only — no narrative, no contact, explicit `restricted` notice |
| Unauthorised `GET ai-analysis` | `401` / `403` |
| Backend test suite | **59 tests, all passing** |
| Frontend test suite | **34 tests, all passing** |
| `tsc --noEmit` | Passes (`noUnusedLocals`/`noUnusedParameters` enabled) |
| `vite build` | Passes; `frontend/dist` is committed and in sync with source |
| Migrations | `alembic upgrade head` applies cleanly and rolls back cleanly |
| Third-party requests from the victim page | **none** (no font CDN, no analytics) |

## 2. What changed in the audit + hardening pass

### Critical security and privacy defects (all fixed, all covered by tests)

| Was | Now |
|---|---|
| Every boot seeded `admin/Admin123!` into any deployment | Seeding is opt-in (`SEED_STAFF`); the password comes from `SEED_STAFF_PASSWORD` or is generated and printed **once**. The well-known demo passwords require an explicit `--demo-passwords` / `SEED_DEMO_PASSWORDS=1` and are refused in production. |
| `POST /api/auth/register` handed a public caller an **admin** token on an empty database (and the seed failure was explicitly tolerated) | Disabled by default. Requires `ALLOW_BOOTSTRAP_ADMIN=1` **and** a matching `BOOTSTRAP_ADMIN_TOKEN`. |
| CORS `allow_origins=["*"]` + `allow_credentials=True` reflected **any** origin | Same-origin by default; explicit `CORS_ORIGINS` allowlist otherwise. |
| `/api/ai/status` returned the **first 7 characters of the API key** to every authenticated user | No key material is returned at all; the endpoint is limited to `admin`/`case_handler`. |
| `viewer` could read the **full victim narrative and contact PII** | Narrative and contact are returned only to `admin`/`case_handler`; other roles get an explicit `restricted` notice. |
| Public case lookup was unthrottled and 404-vs-200 revealed existence; Case IDs were 5 predictable digits | Lookup is rate-limited; Case IDs are 6 cryptographically random digits (`secrets`). |
| Sign-in was not throttled | Throttled per client **and** per username. |
| A dev-default `JWT_SECRET` booted silently | `APP_ENV=production` refuses to boot with a dev secret, demo seeding, bootstrap registration, or an empty CORS allowlist. |
| The victim page loaded Google Fonts, disclosing the visitor's IP to a third party | No third-party requests at all; system font stack. |
| `localStorage.clear()` on logout wiped the whole origin | Only the app's own keys are removed. |

### Broken workflows (all fixed)

- FastAPI 422 validation errors rendered as `"[object Object]"` → normalised to readable text.
- No 401 handling → any 401 now clears the session and returns to sign-in.
- The stored token was trusted without validation → `GET /api/auth/me` is called on boot.
- `AiRiskCard` reported *any* failure as "no analysis yet" → 404 vs. real errors are distinguished.
- No admin UI to create staff accounts → added to **Security & AI**.
- The case list stayed broken after a failed load → errors clear on success and retry is state-driven.
- The support directory silently looked empty on failure → it now shows an error with retry.
- A failed audit request rendered as "No recent activity." → errors are now distinct from empty.
- The UI offered status transitions a handler cannot perform → only permitted transitions are shown.
- The analysis endpoint was requested twice per case → single request.

### Data, API and database reliability

- Alembic migrations added (`backend/migrations/`), with a baseline revision and a
  startup warning when a database is not under migration control.
- `risk_score` returns `null` instead of a `-1` sentinel (no more misleading 0-length bars).
- Dependencies pinned (`requirements.txt`) and split into runtime/dev.
- `/api/health` now reports the app environment, database reachability, driver and schema revision.
- Unknown `/api/...` paths return **404** instead of 200.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cache-Control: no-store` on API responses).
- The rate limiter is now shared, thread-safe and evicts expired buckets.

### UI, accessibility and design quality

- Contrast: `--ink-faint` darkened to 4.7:1 (WCAG AA) and `--fs-meta` raised to 13px.
- Focus: the invisible `outline: none` on form fields was removed; every
  interactive element has a visible focus indicator.
- Heading order: every page has exactly one `<h1>`.
- The priority-case card is a real `<button>` (Space and Enter both activate it).
- Step changes and tracking results are announced through live regions.
- `ErrorCard` is announced (`role="alert"`); `ErrorBoundary` keeps the Quick Exit alive.
- Distinct status badges (new / under review / closed) and a real `UNAVAILABLE` badge.
- Disabled controls are styled; long narratives no longer overflow narrow screens.
- The submitted Case ID is persisted in `sessionStorage` so a refresh cannot lose it.
- Staff now also get the Quick Exit control.
- The audit-log link is only shown to administrators.

### Tests, CI and deployment

- Backend: 14 → **59** tests, including a dedicated `test_security.py`
  (one test per fixed defect) and `test_ai_provider.py` (the previously
  untested provider answer parser).
- Frontend: 0 → **34** Vitest tests covering the API client's error
  normalisation, 401 handling, token scoping, the error boundary, Quick Exit
  (click, Enter and Escape paths, sensitive-key-only storage clearing,
  menu/dialog/form-field Escape guards), the report wizard
  (accessible validation for the 10-character minimum, history-state safety,
  Back/Forward step restoration) and the region-configurable support strip.

### UI redesign verification (23 Oct, second pass)

The spruce/ivory "warm public service" design identity (see
`frontend/src/tokens.css`) is live on every page and was verified in a real
headless Chromium via REA scenarios (desktop 1280×720 and mobile 390×844):

| Page / flow | Result |
|---|---|
| Landing (hero, task cards, process, trust, support band) | desktop + mobile PASS |
| Report wizard steps 1–4 with synthetic narrative | PASS — no submission clicked |
| Track page — wrong-Id error state + SR-653993 success timeline | PASS |
| Staff sign-in → Dashboard → Cases (filters, cards) → case details | PASS (read-only) |
| Security & AI + Audit logs (admin, read-only) | PASS |
| Resources page | PASS |
| Hamburger menu + Quick Exit on mobile viewport | PASS |
| Skip link focus ring (first Tab press) | PASS |
| Console / page errors | none beyond Vite dev messages |
| Failed / non-2xx network requests during a staffer session | 0 observed |

New screenshots: `verification/screenshots/after/`, `after-staff/`,
`after-mobile/`, `after-detail*/` (PNG artifacts extracted by
`verification/extract_pngs.mjs` from the REA scenario outputs).

Fixes made during this pass:

- Skeleton loading cards used a cool slate-blue gradient that clashed with the
  warm palette — now a warm beige shimmer (`.skeleton`).
- Staff sign-in always said "Invalid credentials" even when the account was
  rate-limited; it now surfaces the server's own safe hint ("Too many sign-in
  attempts. Please wait a minute and try again.") and keeps 401 uniform.
  Covered by new unit tests in `frontend/src/test/StaffLogin.test.tsx` (37
  frontend tests total).

Important regression fixed — **test isolation**: the backend test files set
`DATABASE_URL` to a temp file at import time, but `app.config` (and therefore
the default dev SQLite path) was cached by whichever module pytest imported
first, so running `pytest` wiped `dv_reports.db` and replaced the dev users and
reports with test fixtures. `backend/tests/conftest.py` now sets the isolated
environment before any app import (verified: 59 backend tests pass while
`dv_reports.db` is untouched, and the demo staff credentials were restored
along with the canonical `SR-45012` demo case).

### Safe-reporting flow hardening (23 Oct)

- Quick Exit: Escape activation added with guards (form fields keep Escape,
  the navigation menu may own Escape, modal dialogs first), storage cleanup
  limited to SafeReport's own four keys, and a tooltip that states plainly
  what Quick Exit cannot erase (history, server records).
- Emergency contacts: region-configurable via `VITE_SUPPORT_REGION`
  (`us`/`uk`/`in`, default `generic` shows no number — never guessed).
- Wizard: the 10-character minimum now announces an accessible error instead
  of only disabling Continue; `aria-invalid`/`aria-describedby` wired.
- Wizard Back/Forward: steps traverse browser history entries whose state
  carries only the step number; the narrative stays memory-only.
- Favicon: `frontend/public/favicon.svg` ships in the build (was 404).
- GitHub Actions CI: backend tests + migration up/down check, frontend
  type-check, unit tests and production build.
- `Dockerfile`: multi-stage, non-root, migrations applied at start-up, health check.
- README rewritten with reproducible setup, configuration reference, API
  reference, role matrix and a production checklist.

## 3. Deployment-readiness audit (21 Oct 2026)

Executed against a **disposable** PostgreSQL 17.10 cluster (separate data
directory and port, dropped afterwards; the existing server on :5432 was never
touched). No repository file was modified during the audit.

| # | Check | Result |
|---|---|---|
| 1 | Fresh PostgreSQL database initialised and migrated | **PASS** — 4 tables, 37 columns, correct types, unique constraints enforced, app serves on PG *(with D1)* |
| 2 | Existing database upgraded without losing data | **PASS** — a real additive revision applied to a populated DB; all rows, risk assessments, audit JSON and users unchanged |
| 3 | Documented baseline-stamping procedure | **PASS** — legacy `create_all` schema stamped to `0001_baseline` with data intact; `alembic check` then reports no drift |
| 4 | Production frontend build from current source | **PASS** — `npm run build` reproduces the committed `frontend/dist` byte-identically; the build is deterministic |
| 5 | Deployment configuration serves the correct build | **PASS** — simulated image layout; the server served the current bundle, SPA fallback worked, unknown `/api` returned 404 |
| 6 | No default credentials or admin accounts created automatically | **PASS** — production boot creates 0 users, public registration 403, demo passwords work on no account |
| 7 | Production startup fails safely on missing configuration | **PASS** — all six invalid configurations exited 3 and never opened the port |
| 8 | Backups and recovery documented | **FAIL** — see D2 |

### Open defects

- **D1 (medium)** — the baseline migration creates two redundant unique indexes
  (`ix_reports_case_id`, `ix_risk_assessments_report_id`) that the models do
  not declare, so a freshly migrated schema drifts from the model metadata and
  `alembic check` fails on it; a *stamped* legacy database passes. Fix by
  removing the two `op.create_index(...)` calls from the baseline and adding a
  follow-up revision for databases already migrated. Do not run
  `--autogenerate` until this is done.
- **D2 (medium)** — no backup or recovery procedure is documented (no
  `pg_dump`/`pg_restore` steps, retention or encryption policy, restore drill,
  or SQLite-fallback guidance) on a database holding survivor reports.
- **D3 (low)** — CI does not run `alembic check`, so drift like D1 is not
  caught automatically.
- **D4 (info)** — a frontend build with an overridden `--outDir` differs from
  the documented `npm run build`; deployments are unaffected.

## 4. Known limitations / follow-ups (not defects, deliberate scope)

- No client-side router: navigation is state-based, so there are no deep links
  and no browser back/forward. A lightweight hash router is the next step.
- The rate limiter is per process; a multi-worker deployment needs a shared store.
- No server-side session revocation (JWTs are stateless until they expire).
- The risk engine scores a mentioned weapon as +25, which is still `LOW` on its
  own. That is the documented scoring table; changing it would change every
  documented score, so it is left as a product decision to confirm.
- The Jev hosted provider could not be exercised against the live API from this
  environment (no key); its request/response contract is covered by unit tests
  of the parser and by the offline fallback path.

### Evidence gaps (not defects)

- The Docker image was never built (no Docker daemon available); the Dockerfile
  was verified by static review and a layout simulation only.
- The Replit deployment was reviewed statically, not run on the platform.
- PostgreSQL 17.10 on Windows only; Linux and managed-PostgreSQL behaviour was
  not tested.
- Backup/restore could not be tested because no procedure exists yet (D2).

## 5. Out of scope (do not add)

AI chatbot, facial recognition, voice cloning, blockchain, automatic police
notification, automatic legal decisions, automatic case rejection,
recommendation systems.
