# WisdomBase

Capture your thoughts, then ask questions and get your own thinking back.
React Native (Expo) app + FastAPI backend + Supabase (Postgres + pgvector).

## 📱 Expo Mobile App

This is a mobile-first React Native app built with Expo. Deploy as:
- **iOS App**: Build and publish via EAS (Expo Application Services)
- **Android App**: Build and publish via EAS
- **Local Development**: Run on your phone via Expo Go

## Local Development Setup

### 1. Supabase (one time)
1. Create a free project at https://supabase.com
2. In the SQL Editor, run `backend/schema.sql` (enables pgvector, creates tables, RLS, and the `match_chunks` function).
3. From Project Settings → API, copy: `Project URL`, `anon` key, `service_role` key.

### 2. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Embeddings run in-process (all-MiniLM-L6-v2, 384-dim) — no API cost. The LLM is
Claude Haiku via each user's own key (BYOK), entered in the app's Settings.

### 3. Frontend (Mobile)
```bash
cd frontend
npm install
cp .env.example .env          # fill EXPO_PUBLIC_SUPABASE_URL / ANON_KEY / API_URL
npx expo start --tunnel       # scan the QR code with Expo Go on your iPhone
```
Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP (e.g. `http://192.168.1.20:8000`)
so the phone can reach the backend — `localhost` won't work from the device.

## 🚀 Deploy Backend

The backend can be deployed to any Python hosting platform. You'll need to:
1. Deploy the FastAPI app (port 8000)
2. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY` (optional, for shared free questions)
3. Update `EXPO_PUBLIC_API_URL` in frontend to point to your backend URL

## 📦 Build Mobile Apps with EAS

### iOS & Android Production Builds

```bash
cd frontend

# Build for iOS App Store
npx eas build --platform ios --profile production

# Build for Android Play Store
npx eas build --platform android --profile production

# Build for both
npx eas build --platform all --profile production
```

### Submit to App Stores

```bash
# Submit to Apple App Store
npx eas submit --platform ios

# Submit to Google Play Store
npx eas submit --platform android
```

### Preview/Development Builds

```bash
# iOS simulator build (for testing)
npx eas build --platform ios --profile preview

# Android internal testing
npx eas build --platform android --profile preview
```

## Flow
Sign up → brain-dump onboarding (5 prompts) → Capture / Ask / Browse / Settings.

## Structure
- `backend/` — `main.py` (routes), `chunker.py`, `embedder.py`, `rag.py`, `llm.py`, `auth.py`, `db.py`, `schema.sql`
- `frontend/` — `app/` (expo-router screens), `components/`, `lib/`, `stores/`, `theme.ts`, `eas.json`

## Environment Variables

### Backend (.env)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-key-optional
FREE_QUESTION_LIMIT=20
```

### Frontend (.env)
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://your-backend-url.com
```

## Tech Stack

- **Frontend**: React Native, Expo, Expo Router, Zustand
- **Backend**: FastAPI, Python
- **Database**: Supabase (Postgres + pgvector)
- **Embeddings**: sentence-transformers (local, no API cost)
- **LLM**: Claude via Anthropic API (user brings their own key)

## Development Notes

- The app uses Supabase Auth for authentication
- Email confirmation links redirect to `/(auth)/email-verified` route
- Users can add multiple LLM provider keys (Anthropic, OpenAI, etc.)
- Free tier: 20 questions per user using shared backend key
- Beyond free tier: users add their own API keys
