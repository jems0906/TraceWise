# TraceWise

TraceWise is a requirement intelligence platform for business analysts to collect stakeholder input, structure requirements, and preserve end-to-end traceability.

The Cloudflare-native target is now Cloudflare Pages for the frontend, Cloudflare Workers for the API, and Cloudflare D1 for persistence. The legacy FastAPI + PostgreSQL stack still exists in the repo for local comparison and rollback.

## Implemented Features

- Stakeholder requirement intake form
- AI-assisted transformation to:
  - Business requirement
  - Functional requirement
  - Non-functional requirement
  - User story
- AI-assisted requirement clarification
- Traceability matrix:
  - Requirement -> User Story -> Task -> Test Case
- Priority and impact analysis fields
- Requirement version history
- BRD and FRD export endpoints
- Duplicate requirement detection
- Ambiguity and risk cues from requirement text
- Dashboard with requirement count and trace coverage charting

## Tech Stack

- Frontend: React + Vite + Chart.js, deployable to Cloudflare Pages
- Backend: Cloudflare Worker API
- Database: Cloudflare D1
- Legacy backend: FastAPI + SQLAlchemy for local/runtime comparison
- AI: OpenAI API with safe fallback parser when key is absent

## Project Structure

- frontend: React UI for Pages deployment
- worker: Cloudflare Worker API + D1 schema
- backend: Legacy FastAPI API service
- docker-compose.yml: PostgreSQL + backend + React frontend proxy

## Primary Run

Use Docker Compose for the full supported stack:

```powershell
docker compose up --build
```

- React app: http://localhost:8011
- FastAPI API: http://localhost:8001
- Health endpoint: http://localhost:8001/health

The frontend container proxies `/api`, `/auth`, and `/health` to FastAPI, so OAuth and session cookies work as a same-origin app at http://localhost:8011.

## Local Development

### 1. Backend API

1. Open terminal in backend folder
2. Install dependencies

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. Configure environment

```powershell
copy .env.example .env
```

4. Start API

```powershell
python -m uvicorn app.main:app --app-dir d:\project\TraceWise\backend --port 8000
```

Alternative from workspace root (avoids module-name collisions with other local projects):

```powershell
$env:DATABASE_URL='sqlite:///./tracewise_local.db'
$env:AUTH_REQUIRED='true'
$env:DEMO_LOGIN_ENABLED='true'
python -m uvicorn app.main:app --app-dir d:\project\TraceWise\backend --port 8000
```

### 2. React frontend

For direct React development:

```powershell
Set-Location d:\project\TraceWise\frontend
npm install
npm run dev
```

Vite runs on http://localhost:5173 and proxies API/auth requests to http://localhost:8000.
If you are running backend via Docker Compose, the direct host API is http://localhost:8001.

### 3. Fallback UI

If npm is unstable on Windows, the backend still serves the fallback UI at http://localhost:8000.

Health endpoint: http://localhost:8000/health (local uvicorn) or http://localhost:8001/health (Docker Compose)

## Key API Endpoints

- POST /api/requirements/intake
- GET /api/requirements
- PUT /api/requirements/{id}
- GET /api/requirements/{id}/versions
- POST /api/requirements/{id}/clarify
- POST /api/requirements/{id}/trace-links
- GET /api/traceability/matrix
- GET /api/dashboard/summary
- GET /api/audit/events
- GET /api/audit/events/export.csv
- GET /api/requirements/{id}/activity
- GET /api/export/brd
- GET /api/export/frd
- GET /health
- GET /auth/me
- GET /auth/login
- GET /auth/callback
- POST /auth/demo-login
- POST /auth/logout

## Notes

- If OPENAI_API_KEY is missing, the backend uses deterministic fallback logic for requirement parsing and clarification.
- For production, set DATABASE_URL to PostgreSQL and configure CORS to known frontend origins.
- Actor attribution is tracked across requirements (`created_by`, `updated_by`), requirement versions (`created_by`), and trace links (`created_by`).
- Audit feed supports optional filters: `actor`, `action`, `from_date`, `to_date`, and `q`.

### Optional OAuth Login

Set these in `.env` to make OAuth the primary sign-in flow:

```env
AUTH_REQUIRED=true
SESSION_SECRET=replace-with-long-random-secret
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
DEMO_LOGIN_ENABLED=true
```

- When `AUTH_REQUIRED=true`, write actions require a logged-in session.
- The React UI presents OAuth first. Demo login remains available only as a local fallback when `DEMO_LOGIN_ENABLED=true`.

## Troubleshooting

- If backend startup fails with `sqlite3.OperationalError: database is locked`, switch to the primary PostgreSQL path with Docker Compose or set `DATABASE_URL` to a different local SQLite file.
- If npm install fails with `ENOTEMPTY` under `node_modules`, run:

```powershell
Set-Location d:\project\TraceWise\frontend
cmd /c rmdir /s /q node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install --no-audit --no-fund
```

- If you want to avoid local npm entirely, use `docker compose up --build` and work through the React app on http://localhost:8011.

## Smoke Validation

Use the scripted smoke test for repeatable verification:

```powershell
Set-Location d:\project\TraceWise
powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
```

Detailed runbook: `SMOKE_TEST.md`.

## Cloudflare Migration

The Cloudflare-native target is:

- Frontend: Cloudflare Pages
- Backend: Cloudflare Worker
- Database: Cloudflare D1

Migration notes:

1. The Worker API under [worker/src/main.js](worker/src/main.js) preserves the same endpoint shape the React app already uses.
2. The D1 schema is in [worker/migrations/0001_init.sql](worker/migrations/0001_init.sql).
3. The Pages build should set `VITE_API_BASE` to the Worker URL or custom API hostname.
4. Demo login is supported in the Worker runtime; OAuth can be added later without changing the frontend contract.

Deployment guide:

1. Create a D1 database in Cloudflare and copy the database ID into [worker/wrangler.toml](worker/wrangler.toml).
2. Deploy the Worker from the `worker` folder.
3. Deploy the React app from the `frontend` folder to Cloudflare Pages.
4. Set the Pages environment variable `VITE_API_BASE` to the Worker URL.
5. Set Worker vars for `CORS_ORIGINS`, `FRONTEND_URL`, `SESSION_SECRET`, and optional Google OAuth.

Detailed setup is documented in [cloudflare/README.md](cloudflare/README.md).
