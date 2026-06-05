# TraceWise Worker

This directory contains the Cloudflare Worker API and the D1 schema used by TraceWise.

## Files

- [src/main.js](src/main.js): Worker request handler and endpoint implementation
- [migrations/0001_init.sql](migrations/0001_init.sql): D1 schema
- [wrangler.toml](wrangler.toml): Worker and D1 binding configuration

## Deploy

1. Create a D1 database in Cloudflare.
2. Replace the placeholder `database_id` in [wrangler.toml](wrangler.toml).
3. Run the migration against the D1 database.
4. Deploy the Worker with Wrangler.

## Environment

Set these values in the Worker environment:

- `SESSION_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_URL`
- `AUTH_REQUIRED`
- `DEMO_LOGIN_ENABLED`
- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`