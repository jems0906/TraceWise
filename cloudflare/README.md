# Cloudflare Deployment

This repository supports Cloudflare Tunnel in front of the TraceWise frontend container.

Recommended production shape:

- Frontend: container `frontend` on port `80`
- Backend: private container `backend` on port `8000`
- Database: private PostgreSQL container `db`
- Public ingress: `cloudflared` container using a named tunnel token

## Quick Start

1. Create a tunnel in Cloudflare Zero Trust.
2. Generate a tunnel token for the hostname you want to use.
3. Put the token in `.env.cloudflare`.
4. Start the stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-cloudflare.ps1
```

## Notes

- The tunnel points to the frontend container.
- The frontend already proxies `/api`, `/auth`, and `/health` to the backend container.
- Do not expose the backend port publicly unless you explicitly want direct API access.

## Local Helper

If you want to verify the tunnel command separately, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare-tunnel.ps1
```
