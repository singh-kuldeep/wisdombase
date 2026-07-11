"""Backend settings.

Project-wide configuration knobs live here. Edit the defaults below to change
behaviour, or override any of them with an environment variable of the same name
(handy for per-deployment tweaks on Railway without a code change).
"""

import os

from dotenv import load_dotenv

load_dotenv()


# Which environment this instance is running as: "development" (local / dev
# deploy) or "production". Drives environment-specific behaviour like CORS. Set
# APP_ENV in the environment; local .env should use "development", the Railway
# prod service should set "production".
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

# Allowed CORS origins. In development we allow everything so the Expo dev
# server / LAN device / localhost web can all reach the API. In production we
# restrict to an explicit comma-separated allow-list from CORS_ORIGINS (e.g.
# "https://wisdombase.expo.app,https://wisdombase.vercel.app"). Native mobile
# apps don't send an Origin header, so this only affects the web build.
_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if IS_PRODUCTION and _cors_env:
    CORS_ORIGINS = [o.strip() for o in _cors_env.split(",") if o.strip()]
else:
    CORS_ORIGINS = ["*"]


# How many questions each user may ask for FREE, answered with the shared backend
# Anthropic key, before they must add their own provider key in Settings. This is
# the "X" free questions per user. Change it here (or set FREE_QUESTION_LIMIT in
# the environment) to raise or lower the allowance.
FREE_QUESTION_LIMIT = int(os.environ.get("FREE_QUESTION_LIMIT", "20"))

# The shared Anthropic key used to answer those free questions, common to all
# users. Stored in the backend .env as ANTHROPIC_API_KEY (never sent to clients).
SHARED_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
