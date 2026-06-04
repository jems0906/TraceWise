# TraceWise

TraceWise is a requirement intelligence platform for business analysts to collect stakeholder input, structure requirements, and preserve end-to-end traceability.

The primary runtime path is now React on the frontend, FastAPI on the backend, and PostgreSQL through Docker Compose. A no-build FastAPI-served fallback UI still exists for constrained Windows environments.

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

- Frontend: React + Vite + Chart.js
- Backend: FastAPI + SQLAlchemy
- Database: PostgreSQL (primary) or SQLite (local fallback)
- AI: OpenAI API with safe fallback parser when key is absent

## Project Structure

- frontend: React UI
- backend: FastAPI API service
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

## Cloudflare-Only Deployment

This repository currently supports Cloudflare ingress through Cloudflare Tunnel.

Architecture:

- Public edge: Cloudflare Tunnel
- App runtime: local or server Docker stack in this repository
- Frontend entry: container `frontend` on port `80`
- Backend API: container `backend` on port `8000` (private)
- Database: container `db` (private)

Quick start:

1. Copy `.env.cloudflare.example` to `.env.cloudflare`.
2. Create a named tunnel in Cloudflare Zero Trust and get a connector token.
3. Set `CLOUDFLARED_TUNNEL_TOKEN` in `.env.cloudflare`.
4. Start the app stack and tunnel:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-cloudflare.ps1
```

Detailed setup is documented in [cloudflare/README.md](cloudflare/README.md).

Important:

- Backend and database stay private and are not directly exposed.
- Frontend proxies `/api`, `/auth`, and `/health` to backend.
- If your network blocks Cloudflare DNS endpoints, tunnel creation may fail in that network.
