"""Text splitting logic.

Strategy (from the build plan):
- Split on paragraph boundaries first (double newline).
- If a paragraph exceeds ~300 words, split it on sentence boundaries.
- Overlap: carry the last sentence of the previous chunk into the next chunk
  so continuity is preserved.
"""

import re

MAX_WORDS = 300
OVERLAP_SENTENCES = 1

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    sentences = [s.strip() for s in _SENTENCE_RE.split(text.strip()) if s.strip()]
    return sentences


def _word_count(text: str) -> int:
    return len(text.split())


def chunk_text(content: str, max_words: int = MAX_WORDS) -> list[str]:
    """Split content into overlapping chunks of roughly `max_words` words."""
    content = (content or "").strip()
    if not content:
        return []

    # 1. Break into paragraphs on blank lines.
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", content) if p.strip()]

    # 2. Build sentence-level units, splitting oversized paragraphs.
    units: list[str] = []
    for para in paragraphs:
        if _word_count(para) <= max_words:
            units.append(para)
        else:
            units.extend(_split_sentences(para))

    # 3. Greedily pack units into chunks, carrying sentence overlap forward.
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for unit in units:
        unit_words = _word_count(unit)
        if current and current_words + unit_words > max_words:
            chunks.append(" ".join(current).strip())
            # Seed the next chunk with the trailing sentence(s) for continuity,
            # but skip overlap if the tail alone is oversized (avoids runaway growth).
            tail = _split_sentences(" ".join(current))[-OVERLAP_SENTENCES:]
            tail_words = sum(_word_count(s) for s in tail)
            if tail_words > max_words // 2:
                tail = []
                tail_words = 0
            current = list(tail)
            current_words = tail_words
        current.append(unit)
        current_words += unit_words

    if current:
        chunks.append(" ".join(current).strip())

    return [c for c in chunks if c]
