# TraceWise Smoke Test

This checklist validates the primary runtime path:

- React frontend at `http://localhost:8011`
- FastAPI backend at `http://localhost:8001`
- PostgreSQL via Docker Compose

## 1. Start Services

```powershell
Set-Location d:\project\TraceWise
docker compose up --build -d
```

## 2. Run Scripted Smoke Test

```powershell
Set-Location d:\project\TraceWise
powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1
```

Expected outcomes include:

- Home and health endpoints return success.
- Analyst can log in, create requirement, clarify, add trace link, and read dashboard/matrix.
- Analyst is blocked from audit CSV export (`403`).
- Admin can export audit CSV (`200`).

## 3. Optional Alternate Base URL

If needed, run against another frontend URL:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke.ps1 -BaseUrl http://127.0.0.1:8011
```
