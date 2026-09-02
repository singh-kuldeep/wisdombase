"""Retrieval + prompt construction.

Embeds the question, pulls a candidate pool of similar chunks via the
`match_chunks` Postgres function, then re-ranks them in Python with recency and a
small "prefer the user's own thinking over generic wisdom" boost, caps how many
chunks any single entry can contribute, and assembles the prompt. Also builds
the memory-aware system prompt and the prompt used to refresh a user's long-term
memory profile.
"""

from datetime import datetime, timezone
from typing import Optional

from embedder import embed_one

SYSTEM_PROMPT = """You are the user's personal knowledge assistant. You have access to
their past journal entries, ideas, and notes. Your role is to help
them retrieve and synthesize their own thinking.

Rules:
- Only reference information from the provided context
- If the context doesn't contain relevant information, say so honestly
- Quote their own words when relevant (they wrote this, remind them)
- Note the dates of relevant entries so they have temporal context
- Be conversational, warm, and concise
- If you see patterns across entries, point them out
- Entries from the "Generic" group are built-in wisdom, not the user's own
  words; lean on the user's personal entries first and use generic ones only to
  fill gaps."""

# Retrieve a wide candidate pool, then re-rank and trim.
CANDIDATE_COUNT = 24
FINAL_COUNT = 8
MAX_PER_ENTRY = 2
MATCH_THRESHOLD = 0.25

# Re-ranking weights. Similarity stays dominant; recency and a personal-vs-generic
# preference nudge the ordering.
RECENCY_WEIGHT = 0.15
RECENCY_HALFLIFE_DAYS = 180.0
PERSONAL_BOOST = 0.08
GENERIC_GROUP = "Generic"


def _recency_score(created_at: str) -> float:
    """Map an ISO timestamp to (0, 1]; newer is closer to 1, with a slow decay."""
    if not created_at:
        return 0.0
    try:
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return 0.0
    days_old = max(0.0, (datetime.now(timezone.utc) - dt).total_seconds() / 86400.0)
    return 1.0 / (1.0 + days_old / RECENCY_HALFLIFE_DAYS)


def retrieve(supabase, user_id: str, question: str) -> list[dict]:
    """Return re-ranked, de-duplicated chunks enriched with entry title/date/group.

    Each item: {entry_id, title, snippet, date, group, similarity, score}.
    """
    query_embedding = embed_one(question)

    matches = supabase.rpc(
        "match_chunks",
        {
            "query_embedding": query_embedding,
            "match_user_id": user_id,
            "match_count": CANDIDATE_COUNT,
            "match_threshold": MATCH_THRESHOLD,
        },
    ).execute()

    rows = matches.data or []
    if not rows:
        return []

    # Fetch parent entries in one query for titles, dates, and groups.
    entry_ids = list({r["entry_id"] for r in rows})
    entries_resp = (
        supabase.table("entries")
        .select("id, title, created_at, group_name")
        .in_("id", entry_ids)
        .execute()
    )
    entries = {e["id"]: e for e in (entries_resp.data or [])}

    # Score each candidate: similarity + recency + personal preference.
    scored = []
    for r in rows:
        entry = entries.get(r["entry_id"], {})
        created_at = entry.get("created_at") or ""
        group = entry.get("group_name") or ""
        similarity = r.get("similarity") or 0.0
        score = similarity + RECENCY_WEIGHT * _recency_score(created_at)
        if group != GENERIC_GROUP:
            score += PERSONAL_BOOST
        scored.append(
            {
                "entry_id": r["entry_id"],
                "title": entry.get("title") or "Untitled",
                "snippet": r["content"],
                "date": created_at[:10],
                "group": group,
                "similarity": similarity,
                "score": score,
            }
        )

    scored.sort(key=lambda s: s["score"], reverse=True)

    # Cap per-entry contribution and de-duplicate identical snippets.
    per_entry: dict[str, int] = {}
    seen_snippets: set[str] = set()
    final: list[dict] = []
    for s in scored:
        key = s["snippet"].strip()[:160]
        if key in seen_snippets:
            continue
        if per_entry.get(s["entry_id"], 0) >= MAX_PER_ENTRY:
            continue
        per_entry[s["entry_id"]] = per_entry.get(s["entry_id"], 0) + 1
        seen_snippets.add(key)
        final.append(s)
        if len(final) >= FINAL_COUNT:
            break

    return final


def build_context(sources: list[dict]) -> str:
    """Format retrieved chunks into a context block for the prompt."""
    blocks = []
    for s in sources:
        tag = " · Generic" if s.get("group") == GENERIC_GROUP else ""
        header = f"[{s['title']} — {s['date']}{tag}]" if s["date"] else f"[{s['title']}{tag}]"
        blocks.append(f"{header}\n{s['snippet']}")
    return "\n---\n".join(blocks)


def build_system_prompt(memory_profile: Optional[str]) -> str:
    """Inject the user's long-term memory profile into the base system prompt."""
    base = SYSTEM_PROMPT
    if memory_profile and memory_profile.strip():
        return (
            base
            + "\n\nLong-term memory — what you already know about this user:\n"
            + memory_profile.strip()
            + "\n\nUse this for continuity and personalization, but still ground "
            "specific claims in the provided context."
        )
    return base


def build_messages(question: str, context: str, history: list[dict]) -> list[dict]:
    """Assemble the messages array: prior turns + the contextualized question."""
    messages: list[dict] = []
    for turn in history[-5:]:  # last 5 turns only
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    if context:
        user_content = (
            "Context from my knowledge base:\n---\n"
            f"{context}\n---\n\n"
            f"My question: {question}"
        )
    else:
        user_content = (
            "My knowledge base returned no relevant entries for this question.\n\n"
            f"My question: {question}"
        )

    messages.append({"role": "user", "content": user_content})
    return messages


# ----- Long-term memory profile -------------------------------------------------

MEMORY_SYSTEM_PROMPT = """You build a concise long-term memory profile of a person from
their personal notes and journal entries. Capture what is durable and useful for
future conversations:
- recurring themes, interests, and questions they return to
- stated goals, values, and priorities
- important decisions, projects, or relationships they mention
- their communication style and what matters to them

Write 6-12 short bullet points in the second person ("You ..."). Be specific and
grounded in the notes; do not invent. Ignore generic/built-in wisdom — focus on
what is distinctly theirs. Output only the bullets, no preamble."""


def build_memory_messages(entries: list[dict]) -> list[dict]:
    """Assemble the user message that asks the LLM to summarize entries into a profile."""
    blocks = []
    for e in entries:
        title = (e.get("title") or "Untitled").strip()
        content = (e.get("content") or "").strip()
        date = (e.get("created_at") or "")[:10]
        blocks.append(f"[{title} — {date}]\n{content}")
    digest = "\n\n---\n\n".join(blocks)
    return [
        {
            "role": "user",
            "content": "Here are my notes. Build my memory profile.\n\n" + digest,
        }
    ]
