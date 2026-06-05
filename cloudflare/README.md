# Cloudflare Native Deployment

This repository now targets a Cloudflare-native split deployment:

- Frontend: Cloudflare Pages
- Backend: Cloudflare Worker
- Database: Cloudflare D1

## Quick Start

1. Create a D1 database in Cloudflare.
2. Update [worker/wrangler.toml](worker/wrangler.toml) with the D1 database ID.
3. Apply the schema in [worker/migrations/0001_init.sql](worker/migrations/0001_init.sql).
4. Deploy the Worker from the `worker` folder.
5. Deploy the frontend from the `frontend` folder to Cloudflare Pages.
6. Set `VITE_API_BASE` in Cloudflare Pages to the Worker URL.
7. Set `CORS_ORIGINS` and `FRONTEND_URL` in the Worker environment.

## Required Worker Variables

- `SESSION_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_URL`
- `AUTH_REQUIRED`
- `DEMO_LOGIN_ENABLED`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` if you want OAuth
- `OPENAI_API_KEY` if you want live AI responses instead of fallback logic

## Notes

- The Worker exposes the same API shape the React app already uses.
- D1 stores requirements, versions, trace links, and audit events.
- The legacy Docker/Cloudflare Tunnel flow has been retained in the repo history but is no longer the target path.
