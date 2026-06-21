"""JWT validation.

Validates the Supabase access token sent in the Authorization header by asking
Supabase Auth to resolve the token to a user. Returns the user id, which scopes
all database access.
"""

from fastapi import Depends, Header, HTTPException, status

from db import get_supabase


def get_current_user_id(authorization: str = Header(default="")) -> str:
    """FastAPI dependency: extract + validate the bearer token, return user id."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
        )

    token = authorization.split(" ", 1)[1].strip()
    supabase = get_supabase()
    try:
        result = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )

    user = getattr(result, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not resolve user from token.",
        )

    user_id = user.id

    # Check if user is soft-deleted
    try:
        profile_resp = (
            supabase.table("profiles")
            .select("deleted_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if profile_resp.data and profile_resp.data[0].get("deleted_at") is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This account has been deleted.",
            )
    except HTTPException:
        raise
    except Exception:
        # If the check fails (e.g., deleted_at column doesn't exist yet), allow access
        pass

    return user_id


CurrentUser = Depends(get_current_user_id)
