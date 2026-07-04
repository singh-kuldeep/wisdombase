# WisdomBase

Capture your thoughts, then ask questions and get your own thinking back.
React Native (Expo) app + FastAPI backend + Supabase (Postgres + pgvector).

## Tech Stack

- **Frontend**: React Native, Expo, Expo Router, Zustand
- **Backend**: FastAPI, Python 3.11+
- **Database**: Supabase (Postgres + pgvector)
- **Embeddings**: sentence-transformers (local, no API cost)
- **LLM**: Claude / OpenAI / Gemini via user's own API key (BYOK)

## Project Structure

```
wisdombase/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── auth.py          # JWT validation
│   ├── db.py            # Supabase client
│   ├── chunker.py       # Text chunking
│   ├── embedder.py      # Sentence-transformer embeddings
│   ├── rag.py           # Retrieval-augmented generation
│   ├── llm.py           # LLM provider adapters
│   ├── email_service.py # Transactional email
│   ├── config.py        # Env var settings
│   ├── schema.sql       # DB schema + pgvector setup
│   ├── migrations/      # SQL migrations
│   └── requirements.txt
└── frontend/
    ├── app/             # Expo Router screens
    ├── components/
    ├── lib/
    ├── stores/          # Zustand state
    ├── theme.ts
    └── eas.json         # EAS Build config
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/) (for builds): `npm install -g eas-cli`
- A [Supabase](https://supabase.com) project (free tier works)

### Step 1 — Supabase setup (one time)

1. Create a free project at https://supabase.com
2. In the **SQL Editor**, run `backend/schema.sql` — this enables pgvector, creates tables, RLS policies, and the `match_chunks` function.
3. Run any pending migrations from `backend/migrations/` in order (e.g. `001_add_soft_delete.sql`).
4. From **Project Settings → API**, copy:
   - `Project URL`
   - `anon` public key
   - `service_role` secret key

### Step 2 — Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create env file
cp .env.example .env              # then fill in values (see below)

# Start the dev server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# With detailed logs (debug level + access log)
uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug --access-log
```

Backend runs at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive API docs.

> **Logging levels:** `--log-level` accepts `critical`, `error`, `warning`, `info` (default), `debug`, or `trace`. Use `debug` to see full request/response details and startup diagnostics.

**Backend environment variables** (`backend/.env`):

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role secret key from Supabase Project Settings → API |
| `ANTHROPIC_API_KEY` | No | Shared Anthropic key for the free-tier question allowance |
| `FREE_QUESTION_LIMIT` | No | Number of free questions per user (default: `20`) |
| `SENDGRID_API_KEY` | No | SendGrid key for transactional emails (e.g. account deletion) |
| `AWS_REGION` | No | AWS region if using SES instead of SendGrid for email |
| `FROM_EMAIL` | No | Sender address for transactional emails (default: `noreply@wisdombase.com`) |

Example `backend/.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
ANTHROPIC_API_KEY=sk-ant-...          # optional
FREE_QUESTION_LIMIT=20                # optional
```

### Step 3 — Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create env file
cp .env.example .env              # then fill in values (see below)

# Start Expo dev server
npx expo start

# With detailed logs (clears Metro cache + verbose output)
EXPO_DEBUG=true npx expo start --clear
```

To run on a physical device, use tunnel mode so your phone can reach the backend:

```bash
npx expo start --tunnel            # scan the QR code with Expo Go
```

For web:

```bash
npm run web                        # opens at http://localhost:8081
```

**Frontend environment variables** (`frontend/.env`):

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Same Supabase project URL as backend |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase `anon` (public) key |
| `EXPO_PUBLIC_API_URL` | Yes | URL of the running backend |

Example `frontend/.env` for local development:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=http://192.168.1.20:8000   # use your LAN IP, not localhost
```

> **Note:** When testing on a physical device, `localhost` won't resolve to your machine. Use your LAN IP address (find it with `ifconfig | grep "inet "` on Mac/Linux or `ipconfig` on Windows).

---

## Production Deployment

### Backend — Railway (recommended)

1. Push the `backend/` folder to a GitHub repo (or use a monorepo).
2. Create a new project on [Railway](https://railway.app) and connect your repo.
3. Set the **start command** to:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the following environment variables in Railway's dashboard:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role secret key |
| `ANTHROPIC_API_KEY` | Shared key for free-tier questions |
| `FREE_QUESTION_LIMIT` | `20` (or your preferred limit) |
| `SENDGRID_API_KEY` | SendGrid key (for emails) |
| `FROM_EMAIL` | `noreply@yourdomain.com` |

5. Deploy. Railway will give you a public URL like `https://your-app.up.railway.app`.

### Backend — any platform (Render, Fly.io, VPS)

The app is a standard ASGI app. Any platform that can run:

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

…will work. Set the same environment variables listed above.

### Frontend — Mobile app via EAS Build

Update `frontend/eas.json` with your production env vars before building:

```json
"production": {
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key",
    "EXPO_PUBLIC_API_URL": "https://your-backend.up.railway.app"
  }
}
```

Then build and submit:

```bash
cd frontend

# Login to EAS
eas login

# Build for iOS App Store
npx eas build --platform ios --profile production

# Build for Android Play Store
npx eas build --platform android --profile production

# Build for both simultaneously
npx eas build --platform all --profile production

# Submit to Apple App Store (after build completes)
npx eas submit --platform ios

# Submit to Google Play Store
npx eas submit --platform android
```

### Frontend — Web (Vercel)

```bash
cd frontend

# Export static web build
npm run build:web

# Deploy with Vercel CLI
npx vercel --prod
```

Set these environment variables in your Vercel project settings:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `EXPO_PUBLIC_API_URL` | Your production backend URL |

### Preview / Development Builds

```bash
# iOS simulator build (for internal testing)
npx eas build --platform ios --profile preview

# Android internal testing track
npx eas build --platform android --profile preview
```

---

## Database Migrations

Run migrations manually in the Supabase SQL Editor, in order:

```
backend/schema.sql                        # initial setup (run first, one time)
backend/migrations/001_add_soft_delete.sql
```

To verify a migration ran correctly, check for the expected columns/tables using:

```sql
-- Example: verify soft-delete migration
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'deleted_at';
```

---

## App Flow

Sign up → brain-dump onboarding (5 prompts) → Capture / Ask / Browse / Settings.

- Free tier: 20 questions answered using the shared backend Anthropic key.
- Beyond free tier: users add their own API key (Anthropic, OpenAI, or Gemini) in Settings.
- Email confirmation links redirect to `/(auth)/email-verified`.
