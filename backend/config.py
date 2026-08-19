"""Backend settings.

Project-wide configuration knobs live here. Edit the defaults below to change
behaviour, or override any of them with an environment variable of the same name
(handy for per-deployment tweaks on Railway without a code change).
"""

import os
import json
from pathlib import Path

from dotenv import load_dotenv

# Base directory of the backend
BASE_DIR = Path(__file__).resolve().parent


def init_environment():
    """Load environment variables based on APP_ENV and available .env files.

    Priority order:
      1. Existing system environment variables (always take precedence)
      2. .env.local (gitignored local overrides)
      3. Environment-specific file: .env.development / .env.dev / .env.production
      4. Standard .env file
    """
    app_env = os.environ.get("APP_ENV", "").strip().lower()

    # 1. .env.local
    load_dotenv(dotenv_path=BASE_DIR / ".env.local", override=False)

    # 2. Environment specific file
    if app_env in ("production", "prod"):
        load_dotenv(dotenv_path=BASE_DIR / ".env.production", override=False)
    elif app_env in ("development", "dev", "local"):
        load_dotenv(dotenv_path=BASE_DIR / ".env.development", override=False)
        load_dotenv(dotenv_path=BASE_DIR / ".env.dev", override=False)
    else:
        # Default fallback attempt for development environments
        load_dotenv(dotenv_path=BASE_DIR / ".env.development", override=False)
        load_dotenv(dotenv_path=BASE_DIR / ".env.dev", override=False)

    # 3. Standard .env file and env file as fallback
    load_dotenv(dotenv_path=BASE_DIR / ".env", override=False)
    load_dotenv(dotenv_path=BASE_DIR / "env", override=False)



init_environment()


# Which environment this instance is running as: "development" (local / dev
# deploy) or "production". Drives environment-specific behaviour like CORS. Set
# APP_ENV in the environment; local .env or .env.development should use "development",
# the prod service should set "production".
APP_ENV = os.environ.get("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV in ("production", "prod")
IS_DEV = not IS_PRODUCTION

# Allowed CORS origins. In development we allow everything so the Expo dev
# server / LAN device / localhost web can all reach the API. In production we
# restrict to an explicit comma-separated allow-list from CORS_ORIGINS (e.g.
# "https://www.wisdombase.in,https://wisdombase.vercel.app"). Native mobile
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
# users. Stored in the backend .env / .env.development as ANTHROPIC_API_KEY.
SHARED_ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()

_to_email_raw = (
    os.environ.get("FEEDBACK_TO_EMAIL", "").strip()
    or os.environ.get("TO_EMAIL", "").strip()
)
if _to_email_raw.startswith("["):
    try:
        _to_email_json = json.loads(_to_email_raw)
        if isinstance(_to_email_json, list):
            TO_EMAIL = [str(e).strip() for e in _to_email_json if str(e).strip()]
        else:
            TO_EMAIL = []
    except Exception:
        TO_EMAIL = []
else:
    TO_EMAIL = [e.strip() for e in _to_email_raw.split(",") if e.strip()]

FROM_EMAIL = os.environ.get("FROM_EMAIL", "").strip()