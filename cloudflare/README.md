# Cloudflare Deployment

This repository supports Cloudflare Tunnel in front of the TraceWise frontend container.

Recommended production shape:

- Frontend: container `frontend` on port `80`
- Backend: private container `backend` on port `8000`
- Database: private PostgreSQL container `db`
- Public ingress: `cloudflared` container using a named tunnel token

## Quick Start

1. Copy `.env.cloudflare.example` to `.env.cloudflare`.
2. Create a tunnel in Cloudflare Zero Trust and get a named-tunnel token.
3. Put the token in `.env.cloudflare` as `CLOUDFLARED_TUNNEL_TOKEN`.
4. Start the stack:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-cloudflare.ps1
```

## Named Tunnel Steps

On a machine that can reach Cloudflare, run:

```powershell
cloudflared tunnel login
cloudflared tunnel create tracewise
cloudflared tunnel route dns tracewise tracewise.example.com
cloudflared tunnel token tracewise
```

Copy the token output into `.env.cloudflare`.

If you prefer Cloudflare Zero Trust in the browser, go to Zero Trust > Networks > Tunnels > Create a tunnel, then copy the connector token from the install instructions.

## Notes

- The tunnel points to the frontend container.
- The frontend already proxies `/api`, `/auth`, and `/health` to the backend container.
- Do not expose the backend port publicly unless you explicitly want direct API access.
- If you use a host machine instead of Docker for `cloudflared`, the same tunnel token works with `scripts/start-cloudflare-tunnel.ps1`.

## Local Helper

If you want to verify the tunnel command separately, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-cloudflare-tunnel.ps1
```
