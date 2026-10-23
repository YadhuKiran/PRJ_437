# SafeReport — AI-Assisted Domestic Violence Reporting Platform

A reporting, case-management and AI risk-assessment platform for domestic
violence. The AI has **one** purpose: read an unstructured report and help
authorised staff **prioritise** cases with an explainable risk assessment.
No chatbot, no autonomous decisions, no automated disclosure.

> **Safety design rules enforced in code**
> 1. The AI never decides. Every assessment is decision support; a human
>    case handler always makes the final call and every override is recorded.
> 2. There is no code path that contacts authorities, discloses a report, or
>    takes an irreversible action.
> 3. Survivor narratives never enter application logs or the audit trail.
> 4. Only synthetic data is used in tests and demonstrations.

---

## Status — updated 21 Oct 2026

Two work streams were completed and verified today. Open items are listed in
[Known issues](#known-issues--open-items) — nothing below is aspirational;
every claim was executed and observed.

### Hardening pass — security, privacy and broken workflows

A full audit of the backend, frontend, data model, tests and deployment found
11 critical/high defects plus a long tail of broken workflows, accessibility
problems and test-coverage gaps. **All critical and high findings are fixed**
and each has a regression test. The backend suite grew from 14 → **59** tests,
the frontend from 0 → **34**.

| Was | Now |
|---|---|
| Every boot seeded `admin/Admin123!` into any deployment | Seeding is opt-in (`SEED_STAFF`); the password comes from `SEED_STAFF_PASSWORD` or is generated and printed **once**. Well-known demo passwords need an explicit opt-in and are refused in production. |
| A public endpoint handed any caller an **admin** token on an empty database (and the seed failure was explicitly tolerated) | Disabled by default; requires `ALLOW_BOOTSTRAP_ADMIN=1` **and** a matching `BOOTSTRAP_ADMIN_TOKEN`. |
| CORS `allow_origins=["*"]` + `allow_credentials=True` reflected **any** origin | Same-origin by default; explicit `CORS_ORIGINS` allowlist otherwise. |
| `/api/ai/status` returned the **first 7 characters of the API key** to every authenticated user | No key material is returned at all; the endpoint is limited to `admin`/`case_handler`. |
| `viewer` could read the **full victim narrative and contact PII** | Narrative and contact are returned only to `admin`/`case_handler`; other roles receive an explicit `restricted` notice. |
| Public case lookup was unthrottled, 404-vs-200 revealed existence, Case IDs were 5 predictable digits | Lookup is rate-limited; Case IDs are 6 cryptographically random digits. |
| Sign-in was not throttled | Throttled per client **and** per username (`app/ratelimit.py`). |
| A dev-default `JWT_SECRET` booted silently | `APP_ENV=production` **refuses to boot** (verified: exit code 3, port never opened). |
| The victim page loaded Google Fonts, disclosing the visitor's IP to a third party | **Zero** third-party requests; system font stack. |
| FastAPI 422 errors rendered as `"[object Object]"`; a 401 left the staff shell in place; a stale token was never validated | Normalised error text, session invalidation on 401, and `GET /api/auth/me` validates the stored token on boot. |
| No admin UI to create staff accounts; errors masqueraded as empty states; the analysis endpoint was fetched twice per case | Staff-management UI added to **Security & AI**; error and empty states separated; one request per case. |

Also added: **Alembic migrations** (schema was previously unversioned — `create_all`
can create tables but never alters them), pinned dependencies, GitHub Actions
CI, a multi-stage non-root **Dockerfile**, security headers, and an
`ErrorBoundary` that keeps the Quick Exit control alive.

### Deployment-readiness audit

Executed against a **disposable** PostgreSQL 17.10 cluster (own data directory,
own port, dropped afterwards; the existing server on :5432 was never touched).

| # | Check | Result |
|---|---|---|
| 1 | Fresh PostgreSQL database initialised and migrated | **PASS** — all 4 tables + 37 columns, correct types, unique constraints enforced, app serves on PG. *(with defect D1)* |
| 2 | Existing database upgraded without losing data | **PASS** — a real additive revision applied to a populated DB; all rows, risk assessments, audit JSON and users byte-identical afterwards |
| 3 | Documented baseline-stamping procedure for pre-migration schemas | **PASS** — legacy `create_all` schema stamped to `0001_baseline` with data intact; `alembic check` then reports "No new upgrade operations detected" |
| 4 | Production frontend build generated from current source | **PASS** — the documented `npm run build` reproduces the committed `frontend/dist` **byte-identically**; the build is deterministic |
| 5 | Deployment configuration serves the correct frontend build | **PASS** — simulated the image layout; the server served the current bundle, SPA fallback worked, unknown `/api` returned 404 |
| 6 | No development credentials or default admin accounts created automatically | **PASS** — production boot creates 0 users, public registration 403, demo passwords work on no account *(see the `SEED_STAFF` note under [Replit](#replit-demo))* |
| 7 | Production startup fails safely on missing secrets/configuration | **PASS** — all six invalid configurations exited with code 3 and never opened the port |
| 8 | Database backups and recovery documented | **FAIL** — see D2 |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 (no UI framework, no router dependency) |
| Backend | Python 3.11 + FastAPI + SQLAlchemy 2 + Alembic |
| Database | PostgreSQL (production) with a SQLite fallback for local/offline work |
| AI | `jev` (hosted decision model, offline-safe without a key) \| `llm` (OpenAI-compatible) \| `mock` (deterministic rules) |
| Auth | JWT (HS256) + PBKDF2-HMAC-SHA256 password hashing (stdlib only) |
| Tests | `unittest` (backend) + Vitest (frontend) + GitHub Actions CI |
| Deploy | Docker, or the Replit single-service script |

---

## Quick start (local development)

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
copy .env.example .env          # edit as needed — see "Configuration"
python -m alembic upgrade head   # create/upgrade the database schema
python -m app.seed              # create the staff accounts (password printed once)
python -m uvicorn app.main:app --reload
```

The API is then on <http://localhost:8000> and the health check on
<http://localhost:8000/api/health>.

`python -m app.seed` creates `admin`, `handler` and `viewer` and **prints the
generated password once** — store it. To use the well-known demo passwords
instead (development only, refused when `APP_ENV=production`):

```powershell
python -m app.seed --demo-passwords     # admin/Admin123!, handler/Handler123!, viewer/Viewer123!
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev        # http://localhost:5173 — /api is proxied to :8000
```

### 3. Tests and build

```powershell
cd backend  && python -m unittest discover -s tests -v   # 59 tests
cd frontend && npm test                                  # 34 tests
cd frontend && npm run build                             # tsc --noEmit && vite build
```

---

## Configuration

All configuration is environment-driven; `backend/.env.example` documents every
variable. The important ones:

| Variable | Default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | `development` \| `demo` \| `production`. In `production` the app **refuses to boot** with a dev JWT secret, demo seeding, bootstrap registration, or an empty CORS allowlist. |
| `DATABASE_URL` | `sqlite:///./dv_reports.db` | `postgresql+psycopg2://user:pass@host:5432/dv_reports` for PostgreSQL. |
| `JWT_SECRET` | dev default | **Must** be a strong random value (≥32 bytes) in production. Generate with `python -c "import secrets;print(secrets.token_hex(32))"`. |
| `JWT_EXPIRES_MINUTES` | `480` | Staff session lifetime. |
| `CORS_ORIGINS` | *(empty)* | Comma-separated browser origins allowed to call the API. Empty = same-origin only. |
| `TRUST_PROXY` | `0` | Honour `X-Forwarded-For` for rate limiting. Enable **only** behind a trusted reverse proxy. |
| `RATE_LIMIT_REPORTS` / `RATE_LIMIT_LOGIN` / `RATE_LIMIT_TRACK` | `10` / `10` / `20` | Public submission, sign-in and case-tracking limits per client per `RATE_LIMIT_WINDOW_S`. |
| `SEED_STAFF` | `0` | Create the staff accounts on boot. |
| `SEED_STAFF_PASSWORD` | *(generated)* | Password for seeded staff accounts. Printed once when unset. |
| `SEED_DEMO` | `0` | Also create the canonical demo case `SR-45012` (85/100 HIGH). |
| `SEED_DEMO_PASSWORDS` | `0` | Use the well-known demo passwords (refused in production). |
| `ALLOW_BOOTSTRAP_ADMIN` / `BOOTSTRAP_ADMIN_TOKEN` | `0` / *(unset)* | Enable `POST /api/auth/register` for the very first administrator. The token must be supplied with the request. |
| `AI_PROVIDER` | `jev` | `jev` \| `llm` \| `mock`. |
| `JEV_API_KEY` / `JEV_AGENT_KEY` | *(empty)* | Hosted decision-model credentials. Never committed. |
| `JEV_API_URL` / `JEV_MODEL` | auto / `jev-latest` | Host override / model pin. |

Frontend variables are **build-time** (Vite `VITE_` prefix), set when `npm run
build` runs or as environment variables in CI:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SUPPORT_REGION` | `generic` | Emergency/helpline contacts shown on public pages. `us` (911 + US hotline), `uk` (999 + UK helpline), `in` (112 + Women Helpline 181). **Unset/unknown never guesses a number** — the strip shows clear text without a `tel:` link. See `frontend/src/config/support.ts`. |
| `VITE_QUICK_EXIT_URL` | `https://www.google.com` | Destination the Quick Exit control navigates to (via `location.replace`, so SafeReport leaves the history stack). |

---

## Database

Schema is managed by **Alembic** (`backend/migrations/`).

```powershell
cd backend
python -m alembic upgrade head      # apply migrations
python -m alembic revision --autogenerate -m "describe the change"
python -m alembic downgrade -1      # roll back one revision
python -m alembic check             # detect schema drift vs. the models
```

* **New database** → `python -m alembic upgrade head` creates everything.
* **Database created before migrations existed** → stamp it instead of
  recreating it: `python -m alembic stamp 0001_baseline`. Verified on
  PostgreSQL: the legacy schema keeps its data and the revision is recorded.
* The app logs a warning at startup when it finds tables without an
  `alembic_version` row, because schema changes will then not be applied
  automatically.
* `Base.metadata.create_all()` is still called at startup as a safety net so a
  fresh demo never crashes, but migrations are the source of truth.

> ⚠️ **Known schema drift (D1).** The current baseline revision creates two
> explicit unique indexes (`ix_reports_case_id`, `ix_risk_assessments_report_id`)
> that the models do not declare — `unique=True` on the columns already
> produces the `reports_case_id_key` / `risk_assessments_report_id_key`
> constraints. A freshly migrated database therefore carries a redundant second
> unique index per table, and `alembic check` **fails** on it, while a
> *stamped* legacy database passes. The two provisioning paths therefore
> produce different schemas. Fix: drop the two `op.create_index(...)` calls
> (and the matching `op.drop_index` calls in `downgrade`) from
> `backend/migrations/versions/0001_baseline.py`; for a database already
> migrated with the current baseline, add a follow-up revision that drops the
> two redundant indexes rather than editing an applied revision. Until this is
> done, do **not** run `alembic revision --autogenerate` — it will emit a
> spurious `remove_index` operation.

---

## API

All routes are under `/api`. Public routes are unauthenticated; staff routes
require `Authorization: Bearer <token>`.

| Method & path | Access | Purpose |
|---|---|---|
| `GET /api/health` | public | Liveness + DB/provider status (never returns key material). |
| `POST /api/reports` | public, rate-limited | Submit a report. Returns the Case ID. |
| `GET /api/reports/by-case/{case_id}` | public, rate-limited | Status only — never case details. |
| `GET /api/reports?page=&page_size=` | staff | Paginated case list, highest AI risk first. |
| `GET /api/reports/{id}` | staff | Case detail. **Narrative and contact are returned only to `admin` and `case_handler`.** |
| `PATCH /api/reports/{id}/status` | `admin`, `case_handler` | `new → under_review → closed`; only admins may reopen. |
| `POST /api/auth/login` | public, rate-limited | Staff sign-in. |
| `GET /api/auth/me` | staff | The authoritative username/role of the current token. |
| `POST /api/auth/change-password` | staff | Change your own password. |
| `POST /api/auth/create-staff` | `admin` | Create a staff account. |
| `POST /api/auth/register` | disabled by default | Bootstrap the first administrator (requires `ALLOW_BOOTSTRAP_ADMIN` **and** `BOOTSTRAP_ADMIN_TOKEN`). |
| `POST /api/reports/{id}/ai-analysis` | `admin`, `case_handler` | Generate the AI assessment. Never blocks report submission. |
| `GET /api/reports/{id}/ai-analysis` | staff | Read the assessment and any human override. |
| `POST /api/reports/{id}/override-risk` | `admin`, `case_handler` | Record the human risk decision + reason. |
| `GET /api/ai/status` | `admin`, `case_handler` | Provider wiring. **No key material is ever returned.** |
| `POST /api/ai/verify` | `admin`, `case_handler` | One live provider call on a synthetic narrative; never touches the database. |
| `GET /api/audit` | `admin` | Audit trail (ids, roles, actions — never narratives). |
| `GET /api/resources` | public | Support directory. |

Unknown `/api/...` paths return **404**, not 200.

---

## Roles and data access

| Role | List cases | Read narrative / contact | Generate AI | Override risk | Audit log | Provider status | Manage staff |
|---|---|---|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `case_handler` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

A `viewer` receives case metadata and status only; the response contains an
explicit `restricted` notice instead of the narrative and contact details.

---

## AI risk assessment

The provider extracts indicators; **the backend scores them** with a
deterministic engine, so the score is reproducible and explainable.

| Indicator | Points |
|---|---|
| Explicit death threat | +30 |
| Weapon mentioned | +25 |
| Immediate danger | +25 |
| Repeated pattern of behaviour | +15 |
| Stalking | +10 |
| Technology monitoring | +5 |

Capped at 100. **LOW** 0–29 · **MEDIUM** 30–59 · **HIGH** 60–100.

* `AI_PROVIDER=jev` — one hosted call with four bounded questions
  (`immediate_danger`, `urgency`, `support_pathway`, `needs_review`). No key
  or no network → the provider falls back to local extraction, so the demo
  never breaks. The hosted model only shapes the recommendation and review
  routing; it never triggers an action.
* `AI_PROVIDER=llm` — any OpenAI-compatible endpoint. Failure raises, the
  caller engages the rule-based fallback, and if that also fails the case is
  marked `UNAVAILABLE`. **Report submission is never blocked by the AI.**
* `AI_PROVIDER=mock` — deterministic keyword analysis (fully offline).

All provider output is validated with Pydantic (`app/ai/validator.py`):
unknown categories are dropped, indicators are capped, and nothing is
invented. Calibration scaffold for the paper: `cd backend && python -m scripts.calibrate`.

---

## Frontend design system

* Tokens: `frontend/src/tokens.css` (colour, spacing, radius, shadow, type scale, transitions).
* Components: `frontend/src/components/` — `ui.tsx` (BentoGrid/Card, StatCard,
  Risk/Status badges, ScoreBar, Empty/Error/Skeleton states), `TopNavigation`,
  `QuickExit`, `StepIndicator`, `CaseCard`, `AiRiskCard`, `ErrorBoundary`.
* Pages: `frontend/src/pages/` — Landing, ReportWizard, TrackReport, Resources
  (public) + StaffLogin, Dashboard, Cases, CaseDetails, AuditLog, Security (staff).
* Palette: deep navy + neutral grey + white cards; muted green/amber/red for
  risk only. 12-column grid → 6 → stacked. Reduced-motion, `forced-colors`
  and `:focus-visible` are supported.
* **No third-party requests.** The page loads no external font, analytics or
  CDN asset, so a survivor's browser never contacts a third party. Typography
  uses a system stack (Inter/Manrope are used when locally installed).
* The **Quick Exit** control is always present — including in the staff
  workspace, which can also display survivor content. It activates on click,
  **Enter** or **Escape** (guarding form fields, open menus and modal dialogs),
  removes only SafeReport's own storage keys, and navigates with
  `location.replace()` so no SafeReport step state survives. It does **not**
  and cannot erase browser history or server logs — the tooltip says so.
* Public pages show a region-configured urgent-help strip
  (`frontend/src/components/SupportStrip.tsx`).
* The report wizard never hides progress behind a disabled button: too-short
  input produces an announced, visible validation message (`role="alert"`,
  `aria-invalid`), and Continue stays clickable. Back/Forward move between
  wizard steps through history entries whose state contains **only the step
  number** — report content never enters history state, URLs or browser
  history, and refresh cannot re-expose prior steps from history.

---

## Deployment

### Docker (recommended)

```bash
docker build -t safereport .
docker run --rm -p 8000:8000 \
  -e APP_ENV=production \
  -e JWT_SECRET="$(python -c 'import secrets;print(secrets.token_hex(32))')" \
  -e DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dv_reports" \
  -e CORS_ORIGINS="https://safereport.example.org" \
  safereport
```

The container applies migrations before serving and runs as an unprivileged
user. Terminate TLS in front of it and keep the database off the public
network.

> The image has **not** been built end-to-end (no Docker daemon was available
> during the audit). The Dockerfile was verified by static review plus a
> faithful simulation of its directory layout, in which the running service
> served the current frontend build. Build and run it once before relying on it.

### Replit (demo)

`run_replit.sh` boots the API and the committed `frontend/dist` from a single
service. Configure secrets in Replit:

| Secret | Default | Purpose |
|---|---|---|
| `APP_ENV` | `demo` | Set to `production` for a real deployment (then `SEED_STAFF` must be off). |
| `SEED_STAFF_PASSWORD` | *(generated and logged)* | Known demo password for `admin`/`handler`/`viewer`. |
| `SEED_DEMO` | `1` | Also seed the demo case `SR-45012`. |
| `JWT_SECRET` | ephemeral per boot | Set a stable value to keep sessions across restarts. |
| `DATABASE_URL` | SQLite file | Point at PostgreSQL for a persistent database. |
| `AI_PROVIDER` | `jev` | `jev` \| `llm` \| `mock`. |
| `JEV_API_KEY` / `JEV_AGENT_KEY` | *(empty)* | Live hosted triage (offline-safe without a key). |

> **`SEED_STAFF` defaults to `1` in `run_replit.sh`.** The Replit demo path
> therefore creates the three staff accounts automatically — but with a
> **random** password printed once to the boot log, never a well-known one.
> Set `SEED_STAFF=0` for any non-demo deployment, and set
> `SEED_STAFF_PASSWORD` in Replit Secrets if a known demo password is wanted.
> `APP_ENV=production` refuses to start with `SEED_STAFF` enabled.

Because `frontend/dist` is committed, **rebuild and commit it** after any
frontend change (`cd frontend && npm run build`) — otherwise the deployed UI
is the old build. `REBUILD_FRONTEND=1` rebuilds at boot instead (slow, and it
may exceed the platform's health-check window). Use the documented command
exactly: a build with an overridden `--outDir` produces a different (still
deterministic) bundle, because Vite derives the asset base from the output
location.

### Production checklist

- [ ] `APP_ENV=production`
- [ ] Strong `JWT_SECRET` (≥32 random bytes) — the app refuses to boot otherwise
- [ ] `DATABASE_URL` pointing at PostgreSQL
- [ ] `python -m alembic upgrade head` applied
- [ ] `CORS_ORIGINS` set to the exact front-end origin
- [ ] `SEED_STAFF` / `ALLOW_BOOTSTRAP_ADMIN` off
- [ ] `TRUST_PROXY=1` only behind a proxy that sets `X-Forwarded-For`
- [ ] TLS terminated in front of the service
- [ ] **Backups and a restore drill — NOT YET DOCUMENTED (D2).** This is the one
      outstanding deployment-readiness gap: the database holds survivor
      reports, and no backup schedule, retention policy or restore procedure is
      written down yet. Until it is, treat the deployment as un-backed-up.
- [ ] D1 (redundant indexes) resolved if the schema will be migrated further

---

## Deliberate omissions (no fake functionality)

* **Tracking PIN** — the spec sketch shows one; the backend authenticates the
  tracking lookup by Case ID alone, so Track uses the Case ID only. The
  endpoint is rate-limited and Case IDs are 6 unguessable digits.
* **Evidence upload** — the backend accepts narrative text only, so the wizard
  has 4 steps, not 5.
* **Notifications** — the bell shows the real count of open HIGH-risk cases;
  there is no fabricated feed.
* **Dark mode** — the light theme was prioritised; tokens are centralised so a
  dark theme can be added without touching components.

---

## Known issues & open items

Open after the 21 Oct 2026 audit and hardening pass. `PROGRESS.md` tracks the
same list from the development side.

| ID | Severity | Issue | Fix |
|---|---|---|---|
| **D1** | medium | The baseline migration creates two redundant unique indexes that the models do not declare, so a freshly migrated schema drifts from the model metadata and `alembic check` fails on it (a *stamped* legacy database passes). | Remove the two `op.create_index(...)` calls from `backend/migrations/versions/0001_baseline.py`; add a follow-up revision to drop the redundant indexes on databases already migrated. Until then, do not run `--autogenerate`. |
| **D2** | medium | **No backup or recovery procedure is documented.** No `pg_dump`/`pg_restore` steps, no retention or encryption policy, no restore drill, no RTO/RPO, and nothing for the SQLite fallback — on a database holding survivor reports. | Write a "Backups and recovery" section: `pg_dump`/`pg_restore` commands, a restore drill, retention and encryption-at-rest policy, where backups may and may not be stored, and a SQLite-fallback procedure. |
| **D3** | low | CI runs `alembic upgrade head` → `downgrade base` but never `alembic check`, so schema drift like D1 is not caught automatically. | Add an `alembic check` step to `.github/workflows/ci.yml`. |
| **D4** | info | A frontend build with an overridden `--outDir` produces a different bundle than the documented `npm run build` (Vite derives the asset base from the output location). Deployments are unaffected because the Dockerfile and `run_replit.sh` both use the documented command. | Documented under [Replit](#replit-demo); no code change needed. |

### Deliberately not changed

* **A weapon mentioned on its own scores 25 (LOW).** That is the documented
  scoring table; changing it would change every documented score, so it is
  left as a product decision to confirm.
* **No client-side router.** Navigation is state-based, so there are no deep
  links and no browser back/forward. Adding `react-router` was judged a larger
  change than the problem warrants right now.
* **Rate limiting is per process.** A multi-worker deployment needs a shared
  store; the current limiter is deliberately dependency-free.
* **No server-side session revocation.** JWTs are stateless until they expire.

### Not verified (evidence gaps, not defects)

* The **Docker image was never built** — no Docker daemon was available. The
  Dockerfile was verified by static review and a layout simulation only.
* The **Replit deployment** was reviewed statically; it was not run on the
  platform.
* The **live Jev hosted provider** was not exercised (no key available); its
  contract is covered by parser unit tests and the offline fallback path.
* **PostgreSQL 17.10 on Windows only** — Linux and managed-PostgreSQL
  behaviour was not tested.
* **Backup and restore** could not be tested, because no procedure exists yet
  (D2).

---

## Repository layout

```
backend/
  app/
    main.py            FastAPI app, CORS, security headers, static hosting
    config.py          All environment configuration + production safety checks
    database.py        Engine/session, SQLite fallback, migration status
    models.py          users, reports, risk_assessments, audit_logs
    schemas.py         Pydantic request/response contracts
    auth.py            JWT + PBKDF2 password hashing + RBAC
    audit.py           Audit helper (never stores narratives)
    ratelimit.py       Shared, bounded, thread-safe rate limiter
    risk_engine.py     Deterministic scoring
    seed.py            Staff/demo seeding
    ai/                base, validator, mock, llm, jev providers
    routers/           auth, reports, ai_analysis, ai_status, resources
  migrations/          Alembic revisions
  scripts/calibrate.py Calibration experiment scaffold
  tests/               Backend test suite
frontend/
  src/                 React + TypeScript source
  src/test/            Vitest suites
  dist/                Committed production build (see deployment notes)
.github/workflows/     CI: backend tests + frontend type-check/tests/build
Dockerfile             Production multi-stage image
run_replit.sh          Replit single-service boot
```
