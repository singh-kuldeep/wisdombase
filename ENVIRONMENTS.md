# Environments: Dev vs Prod

This project separates a **development** environment (local / LAN / Dev cloud backend) from
**production** (Vercel/Railway production backend + Vercel web + store apps). The difference is
driven entirely by environment variables and build profiles — never by editing
code before a deploy.

| Component    | Local / Hosted Dev                             | Production                                         |
| ------------ | ---------------------------------------------- | -------------------------------------------------- |
| Backend      | `uvicorn` / Dev Vercel (`APP_ENV=development`) | Production Vercel / Railway (`APP_ENV=production`) |
| Web frontend | `expo start` (loads `.env.development`)        | Vercel (`expo export` loads `.env.production`)     |
| Mobile       | `development` EAS profile / Expo Go            | `production` EAS profile → App/Play Store          |
| CORS         | All origins allowed (`*`)                      | Restricted to `CORS_ORIGINS`                       |
| Database     | Isolated Dev Supabase Project                  | Production Supabase Project                        |

***

## Daily workflow: test on dev, then ship to prod

### 1. Run everything locally (development)

```Shell
# Terminal 1 — backend (reads backend/.env, APP_ENV=development)
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — frontend (auto-loads frontend/.env.development)
cd frontend
npm start
```

Confirm which environment the backend is: `curl http://localhost:8000/` →
`{"status":"ok","service":"wisdombase","env":"development"}`.

Testing on a **physical device**? `localhost` won't resolve from the phone.
Put your LAN IP in `frontend/.env.local` (gitignored, overrides
`.env.development`):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.3:8000   # your machine's LAN IP
```

Find it with `ifconfig | grep "inet "` (Mac/Linux).

### 2. Deploy backend to prod (Railway)

Railway holds the prod env vars (`APP_ENV=production`, `CORS_ORIGINS`, Supabase,
Anthropic — see `backend/.env.production.example`). Deploy:

```Shell
cd backend
railway up            # deploys current code to the linked prod service
```

Verify: `curl https://wisdombase-production.up.railway.app/` should report
`"env":"production"`.

### 3. Deploy web frontend to prod (Vercel)

```Shell
cd frontend
npm run deploy:web    # expo export (uses .env.production) + vercel --prod
```

### 4. Ship mobile apps to prod (EAS)

```Shell
cd frontend
npx eas build --platform all --profile production
npx eas submit --platform ios
npx eas submit --platform android
```

For internal testing against the prod backend first, use `--profile preview`.

***

## How environment selection works

**Backend** — `config.py` reads `APP_ENV` from the environment. Locally it comes
from `backend/.env` (`development`); on Railway you set it to `production` in the
dashboard. `python-dotenv` does not override real env vars, so Railway's value
always wins. `CORS_ORIGINS` is only enforced when `APP_ENV=production`.

**Frontend** — Expo auto-loads env files by mode:

* `expo start` → `.env.development`
* `expo export` (i.e. `build:web`) → `.env.production`
* `.env.local` overrides either and is gitignored — use it for personal values
  like your LAN IP.

All `EXPO_PUBLIC_*` values (Supabase URL, anon key, API URL) are baked into the
client bundle and are public by design, so `.env.development` / `.env.production`
are committed for reproducible builds. Never put a service-role key or other
secret in an `EXPO_PUBLIC_*` var.

**EAS builds** run in the cloud, so their env vars live in `eas.json` per
profile (not in the `.env` files). The `development` profile points at a LAN IP;
`preview`/`production` point at Railway.

***

## Database migrations

Migrations are applied by hand in the Supabase SQL Editor (see `README.md`).
Until dev has its own database, **test a migration against a throwaway
Supabase project or a copied table first** — running it in the SQL Editor hits
prod immediately. Order:

```
backend/schema.sql                        # one-time initial setup
backend/migrations/001_add_soft_delete.sql
```

***

## Isolating the dev database

Recommended best practice — gives you a safe place for destructive tests and
migrations. One-time setup:

1. Create a second **free** Supabase project (e.g. "wisdombase-dev").
2. In its SQL Editor, run `backend/schema.sql` then every file in
   `backend/migrations/` in order.
3. From the dev project's **Settings → API**, copy its URL, `anon` key, and
   `service_role` key.
4. Point dev at it — the only changes needed:
   * `backend/.env`: set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to the
     **dev** project.
   * `frontend/.env.development`: set `EXPO_PUBLIC_SUPABASE_URL` +
     `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the **dev** project.
   * `frontend/eas.json` `development` profile: same two values.

Prod config (Railway vars, `.env.production`, `eas.json` prod/preview) stays on
the original project. Now local dev is fully isolated from prod data.
