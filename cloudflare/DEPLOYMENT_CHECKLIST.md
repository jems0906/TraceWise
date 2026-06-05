# Cloudflare Deployment Checklist

Use these exact values as the starting point for a free Cloudflare-native deployment.

## 1. Create D1

In Cloudflare D1, create a database named:

```text
tracewise-db
```

Copy the database ID into [worker/wrangler.toml](../worker/wrangler.toml) at `database_id`.

## 2. Apply schema

From the `worker` folder, run:

```powershell
npx wrangler d1 migrations apply tracewise-db
```

## 3. Deploy Worker

Set these Worker values:

```env
AUTH_REQUIRED=true
DEMO_LOGIN_ENABLED=true
SESSION_COOKIE_SAMESITE=none
SESSION_COOKIE_SECURE=true
ALLOW_FALLBACK_AI=true
SESSION_SECRET=<generate-a-long-random-secret>
CORS_ORIGINS=https://<your-pages-project>.pages.dev,https://<your-custom-domain>
FRONTEND_URL=https://<your-pages-project>.pages.dev
OPENAI_MODEL=gpt-4o-mini
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

If you do not want OAuth yet, leave the Google values blank.

## 4. Deploy Pages

In Cloudflare Pages, set:

```env
VITE_API_BASE=https://<your-worker-name>.<your-account>.workers.dev
```

Build settings:

- Framework preset: Vite
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

## 5. Verify

Open these URLs:

- `https://<your-pages-project>.pages.dev`
- `https://<your-worker-name>.<your-account>.workers.dev/health`

Then confirm:

- Login loads
- Requirement intake creates a record
- Dashboard summary loads
- Export buttons work