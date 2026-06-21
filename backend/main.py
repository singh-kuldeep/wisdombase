"""WisdomBase backend — FastAPI app, all routes.

Endpoints:
  GET  /            health check
  POST /ingest      save an entry, chunk + embed it, store vectors
  POST /query       retrieve relevant chunks and synthesize an answer with Claude
  GET  /entries     list the current user's entries (chronological)
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import file_extract
import llm
import rag
import seed_data
import web_extract
from auth import CurrentUser
from chunker import chunk_text
from db import get_supabase
from embedder import embed_many

app = FastAPI(title="WisdomBase API")

# Mobile app talks to this over HTTPS; allow all origins for the MVP.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Request models -------------------------------------------------------


class IngestRequest(BaseModel):
    title: Optional[str] = None
    content: str
    source: str = "manual"
    group: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: Optional[str] = None


class IngestUrlsRequest(BaseModel):
    urls: List[str]
    group: Optional[str] = None
    tags: Optional[List[str]] = None


class DeleteEntriesRequest(BaseModel):
    entry_ids: List[str]


class Turn(BaseModel):
    role: str
    content: str


class ProviderCred(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None


class QueryRequest(BaseModel):
    question: str
    api_key: Optional[str] = None  # legacy: a single Anthropic key
    providers: List[ProviderCred] = []  # priority-ordered, tried with fallback
    history: List[Turn] = []


class MemoryRefreshRequest(BaseModel):
    api_key: Optional[str] = None
    providers: List[ProviderCred] = []


# ----- Routes ---------------------------------------------------------------


@app.get("/")
def root():
    return {"status": "ok", "service": "wisdombase"}


def _store_entry(
    supabase,
    user_id: str,
    *,
    content: str,
    title: Optional[str] = None,
    source: str = "manual",
    group: Optional[str] = None,
    tags: Optional[List[str]] = None,
    created_at: Optional[str] = None,
) -> dict:
    """Save an entry, then chunk + embed + store its vectors. Returns ids."""
    insert_data = {
        "user_id": user_id,
        "title": title,
        "content": content,
        "source": source,
    }
    if group:
        insert_data["group_name"] = group
    if tags is not None:
        insert_data["tags"] = tags
    if created_at:
        insert_data["created_at"] = created_at

    entry_resp = supabase.table("entries").insert(insert_data).execute()
    if not entry_resp.data:
        raise HTTPException(status_code=500, detail="Failed to save entry.")
    entry_id = entry_resp.data[0]["id"]

    chunks = chunk_text(content)
    if chunks:
        embeddings = embed_many(chunks)
        rows = [
            {
                "entry_id": entry_id,
                "user_id": user_id,
                "content": chunk,
                "embedding": embedding,
                "chunk_index": i,
            }
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
        ]
        supabase.table("chunks").insert(rows).execute()

    return {"entry_id": entry_id, "chunk_count": len(chunks)}


@app.post("/ingest")
def ingest(req: IngestRequest, user_id: str = CurrentUser):
    content = (req.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content cannot be empty.")

    supabase = get_supabase()
    return _store_entry(
        supabase,
        user_id,
        content=content,
        title=req.title,
        source=req.source,
        group=req.group,
        tags=req.tags,
        created_at=req.created_at,
    )


MAX_URLS_PER_REQUEST = 25


@app.post("/ingest-urls")
def ingest_urls(req: IngestUrlsRequest, user_id: str = CurrentUser):
    """Fetch each link, extract its readable content, and save a wisdom entry.

    Every link is handled independently — a link that can't be fetched or has no
    readable content is reported as failed and skipped, never aborting the rest.
    """
    # De-duplicate while preserving order; ignore blanks.
    seen: set = set()
    urls: List[str] = []
    for raw in req.urls:
        u = (raw or "").strip()
        if u and u not in seen:
            seen.add(u)
            urls.append(u)

    if not urls:
        raise HTTPException(status_code=400, detail="Provide at least one link.")
    if len(urls) > MAX_URLS_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"Too many links at once — please send {MAX_URLS_PER_REQUEST} or fewer.",
        )

    supabase = get_supabase()
    results = []
    for url in urls:
        try:
            extracted = web_extract.fetch_and_extract(url)
            content = (extracted.get("content") or "").strip()
            if not content:
                results.append({"url": url, "ok": False, "error": "No readable content found."})
                continue
            # Keep the source link (and original publish date, if any) with the
            # entry. Note: we deliberately do NOT use the article's publish date
            # as the entry's created_at — a just-imported link should appear at
            # the top of the user's entries, not buried under its original date.
            footer = f"Source: {url}"
            published = extracted.get("published_at")
            if published:
                footer += f"\nPublished: {published[:10]}"
            body = f"{content}\n\n{footer}"
            stored = _store_entry(
                supabase,
                user_id,
                content=body,
                title=extracted.get("title"),
                source="link",
                group=req.group,
                tags=req.tags,
            )
            results.append(
                {
                    "url": url,
                    "ok": True,
                    "entry_id": stored["entry_id"],
                    "title": extracted.get("title"),
                }
            )
        except web_extract.ExtractError as exc:
            results.append({"url": url, "ok": False, "error": str(exc)})
        except Exception as exc:  # never let one bad link abort the batch
            results.append({"url": url, "ok": False, "error": f"Couldn't import: {exc}"})

    succeeded = sum(1 for r in results if r["ok"])
    return {"results": results, "succeeded": succeeded, "failed": len(results) - succeeded}


MAX_FILES_PER_REQUEST = 25
MAX_FILE_BYTES = 12_000_000  # 12 MB per file


@app.post("/ingest-files")
async def ingest_files(
    files: List[UploadFile] = File(...),
    group: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    user_id: str = CurrentUser,
):
    """Extract text from each uploaded file and save a wisdom entry.

    Each file is handled independently — an unreadable or empty file is reported
    as failed and skipped, never aborting the rest of the batch. Supports PDF,
    HTML, and plain text / Markdown today; new types only need a branch in
    file_extract.extract_file.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Attach at least one file.")
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files at once — please send {MAX_FILES_PER_REQUEST} or fewer.",
        )

    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()]
    supabase = get_supabase()
    results = []
    for f in files:
        fname = f.filename or "file"
        try:
            data = await f.read()
            if not data:
                results.append({"filename": fname, "ok": False, "error": "Empty file."})
                continue
            if len(data) > MAX_FILE_BYTES:
                results.append({"filename": fname, "ok": False, "error": "File is too large (max 12 MB)."})
                continue
            extracted = file_extract.extract_file(fname, f.content_type, data)
            content = (extracted.get("content") or "").strip()
            if not content:
                results.append({"filename": fname, "ok": False, "error": "No readable text found."})
                continue
            stored = _store_entry(
                supabase,
                user_id,
                content=content,
                title=extracted.get("title"),
                source="upload",
                group=group,
                tags=tag_list,
                created_at=extracted.get("created_at"),
            )
            results.append(
                {"filename": fname, "ok": True, "entry_id": stored["entry_id"], "title": extracted.get("title")}
            )
        except file_extract.FileError as exc:
            results.append({"filename": fname, "ok": False, "error": str(exc)})
        except Exception as exc:  # never let one bad file abort the batch
            results.append({"filename": fname, "ok": False, "error": f"Couldn't import: {exc}"})

    succeeded = sum(1 for r in results if r["ok"])
    return {"results": results, "succeeded": succeeded, "failed": len(results) - succeeded}


@app.post("/seed-generic")
def seed_generic(user_id: str = CurrentUser):
    """Seed curated generic wisdom entries for the user, once (idempotent)."""
    supabase = get_supabase()

    existing = (
        supabase.table("entries")
        .select("id")
        .eq("user_id", user_id)
        .eq("group_name", seed_data.GENERIC_GROUP)
        .limit(1)
        .execute()
    )
    if existing.data:
        return {"seeded": 0, "already_seeded": True}

    seeded = 0
    for item in seed_data.GENERIC_ENTRIES:
        _store_entry(
            supabase,
            user_id,
            content=item["content"],
            title=item["title"],
            source="seed",
            group=seed_data.GENERIC_GROUP,
            tags=item.get("tags", []),
        )
        seeded += 1

    return {"seeded": seeded, "already_seeded": False}


def _get_free_used(supabase, user_id: str) -> int:
    """How many free (shared-key) questions this user has consumed."""
    try:
        resp = (
            supabase.table("profiles")
            .select("free_questions_used")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        # The free_questions_used column may not exist yet (schema.sql migration
        # not run). Treat as zero so the app keeps working; the per-user cap
        # starts being enforced once the column is added.
        return 0
    if resp.data:
        return resp.data[0].get("free_questions_used") or 0
    return 0


def _increment_free_used(supabase, user_id: str) -> int:
    """Record one more consumed free question; returns the new total."""
    new_used = _get_free_used(supabase, user_id) + 1
    try:
        supabase.table("profiles").upsert(
            {"id": user_id, "free_questions_used": new_used}
        ).execute()
    except Exception:
        # Pre-migration: don't block answering if we can't persist the count.
        return new_used - 1
    return new_used


@app.get("/usage")
def get_usage(user_id: str = CurrentUser):
    """The user's free-question allowance and how much remains."""
    supabase = get_supabase()
    used = _get_free_used(supabase, user_id)
    return {
        "free_limit": config.FREE_QUESTION_LIMIT,
        "free_used": used,
        "free_remaining": max(config.FREE_QUESTION_LIMIT - used, 0),
    }


@app.post("/query")
def query(req: QueryRequest, user_id: str = CurrentUser):
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(
            status_code=400, detail="Ask a specific question to search your knowledge."
        )

    supabase = get_supabase()

    # A user with their own provider key is unlimited (their own cost). A user
    # without one is answered with the shared backend key, capped per user.
    own_providers = [p.model_dump() for p in req.providers if (p.api_key or "").strip()]
    has_own_key = bool(own_providers) or bool((req.api_key or "").strip())

    free_used = _get_free_used(supabase, user_id)
    use_free_key = False
    if not has_own_key:
        if free_used >= config.FREE_QUESTION_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=(
                    f"You've used all {config.FREE_QUESTION_LIMIT} free questions. "
                    "Add your own API key in Settings to keep asking."
                ),
            )
        if not config.SHARED_ANTHROPIC_KEY:
            raise HTTPException(
                status_code=400,
                detail="No API key provided. Add a provider key in Settings to ask questions.",
            )
        use_free_key = True

    sources = rag.retrieve(supabase, user_id, question)
    context = rag.build_context(sources)
    messages = rag.build_messages(
        question, context, [t.model_dump() for t in req.history]
    )
    system_prompt = rag.build_system_prompt(_get_memory_profile(supabase, user_id))

    if use_free_key:
        providers = [{"provider": "anthropic", "api_key": config.SHARED_ANTHROPIC_KEY}]
        fallback_key = None
    else:
        providers = own_providers
        fallback_key = req.api_key

    try:
        answer = llm.answer(
            system_prompt,
            messages,
            providers,
            fallback_api_key=fallback_key,
        )
    except llm.LLMError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Only a successful answer that actually used the shared key counts against
    # the free allowance.
    if use_free_key:
        free_used = _increment_free_used(supabase, user_id)

    return {
        "answer": answer,
        "sources": sources,
        "usage": {
            "free_limit": config.FREE_QUESTION_LIMIT,
            "free_used": free_used,
            "free_remaining": max(config.FREE_QUESTION_LIMIT - free_used, 0),
            "used_free_key": use_free_key,
            "has_own_key": has_own_key,
        },
    }


def _get_memory_profile(supabase, user_id: str) -> Optional[str]:
    resp = (
        supabase.table("profiles")
        .select("memory_profile")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if resp.data:
        return resp.data[0].get("memory_profile")
    return None


MEMORY_MAX_ENTRIES = 40


@app.get("/memory")
def get_memory(user_id: str = CurrentUser):
    supabase = get_supabase()
    return {"profile": _get_memory_profile(supabase, user_id) or ""}


@app.post("/memory/refresh")
def refresh_memory(req: MemoryRefreshRequest, user_id: str = CurrentUser):
    """Summarize the user's personal entries into a long-term memory profile (BYOK)."""
    supabase = get_supabase()
    resp = (
        supabase.table("entries")
        .select("title, content, created_at, group_name")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(MEMORY_MAX_ENTRIES * 2)
        .execute()
    )
    # Exclude the seeded generic wisdom; the profile is about the user's own thinking.
    entries = [e for e in (resp.data or []) if (e.get("group_name") or "") != "Generic"][
        :MEMORY_MAX_ENTRIES
    ]
    if not entries:
        return {
            "profile": "",
            "updated": False,
            "detail": "No personal entries yet — capture some thoughts first.",
        }

    messages = rag.build_memory_messages(entries)
    try:
        profile = llm.answer(
            rag.MEMORY_SYSTEM_PROMPT,
            messages,
            [p.model_dump() for p in req.providers],
            fallback_api_key=req.api_key,
        )
    except llm.LLMError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    supabase.table("profiles").upsert(
        {
            "id": user_id,
            "memory_profile": profile,
            "memory_updated_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return {"profile": profile, "updated": True}


@app.get("/entries")
def list_entries(group: Optional[str] = None, user_id: str = CurrentUser):
    supabase = get_supabase()
    q = (
        supabase.table("entries")
        .select("id, title, content, source, group_name, tags, created_at")
        .eq("user_id", user_id)
    )
    if group:
        q = q.eq("group_name", group)
    resp = q.order("created_at", desc=True).execute()
    return {"entries": resp.data or []}


@app.get("/entries/{entry_id}")
def get_entry(entry_id: str, user_id: str = CurrentUser):
    supabase = get_supabase()
    resp = (
        supabase.table("entries")
        .select("id, title, content, source, group_name, tags, created_at")
        .eq("user_id", user_id)
        .eq("id", entry_id)
        .single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Entry not found.")
    return resp.data


@app.post("/entries/delete")
def delete_entries(req: DeleteEntriesRequest, user_id: str = CurrentUser):
    if not req.entry_ids:
        raise HTTPException(status_code=400, detail="No entry IDs provided.")

    supabase = get_supabase()
    resp = (
        supabase.table("entries")
        .delete()
        .in_("id", req.entry_ids)
        .eq("user_id", user_id)
        .execute()
    )
    return {"deleted": len(req.entry_ids)}


@app.post("/account/delete")
def delete_account(user_id: str = CurrentUser):
    """Delete user account and all associated data.

    This will:
    1. Hard delete all user entries and chunks (via CASCADE)
    2. Soft delete user in profiles table (set deleted_at timestamp)
    3. Send confirmation email to the user

    The user remains in Supabase Auth but is marked as deleted in our system.
    All their data (entries, chunks, memory) is permanently removed.
    """
    supabase = get_supabase()

    # Get user email before deletion for confirmation email
    try:
        user_resp = supabase.auth.admin.get_user_by_id(user_id)
        user_email = user_resp.user.email if user_resp and user_resp.user else None
    except Exception:
        user_email = None

    try:
        # Hard delete all entries (chunks will cascade due to ON DELETE CASCADE)
        supabase.table("entries").delete().eq("user_id", user_id).execute()

        # Soft delete the profile by setting deleted_at timestamp
        supabase.table("profiles").upsert({
            "id": user_id,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "memory_profile": None,  # Clear sensitive data
            "display_name": None,
        }).execute()

        # Send confirmation email if we have the email address
        if user_email:
            try:
                _send_account_deletion_email(user_email)
            except Exception as e:
                # Don't fail the deletion if email fails
                print(f"Failed to send deletion confirmation email: {e}")

        return {
            "deleted": True,
            "message": "Your account will be deleted and you will receive a confirmation email. All your data has been permanently removed.",
            "email_sent": bool(user_email)
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete account: {str(e)}"
        )


def _send_account_deletion_email(email: str):
    """Send account deletion confirmation email."""
    from email_service import send_account_deletion_email
    return send_account_deletion_email(email)
