# TraceWise Frontend for Cloudflare Pages

This directory contains the React app that should be deployed to Cloudflare Pages.

## Build Settings

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

## Required Environment Variable

Set this in Cloudflare Pages:

- `VITE_API_BASE` = the public URL of the Cloudflare Worker API

Example:

```env
VITE_API_BASE=https://tracewise-api.your-domain.workers.dev
```

## Local Development

```powershell
Set-Location d:\project\TraceWise\frontend
npm install
npm run dev
```

## Notes

- The frontend uses `VITE_API_BASE` for all API calls.
- Session cookies are sent with `credentials: include`, so the Worker must allow the Pages origin in `CORS_ORIGINS`.
