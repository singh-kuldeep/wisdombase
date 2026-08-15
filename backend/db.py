"""Supabase client.

Uses the service-role key so the backend can write chunks/embeddings and run the
match function. Access is always scoped by the authenticated user's id, which is
derived from the validated JWT (see auth.py) — never from client input.
"""

import os
from functools import lru_cache

import config
from supabase import Client, create_client

config.init_environment()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "") or os.environ.get("SUPABASE_SECRET_KEY", "")


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL", SUPABASE_URL)
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.environ.get("SUPABASE_SECRET_KEY", "")
        or SUPABASE_SERVICE_ROLE_KEY
    )
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) must be set in the environment."
        )
    return create_client(url, key)
