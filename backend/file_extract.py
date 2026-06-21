"""Extract plain text from an uploaded file.

Designed to grow: to support a new media type, add a branch in extract_file that
turns its bytes into text. Everything downstream (chunking, embedding, storage)
is type-agnostic, so new formats need no other changes.

Currently handled: PDF, HTML, and plain text / Markdown. Unknown types are read
as text when possible and skipped otherwise.
"""

import io
import re
from datetime import datetime, timezone

import web_extract


class FileError(Exception):
    """Raised with a short, user-facing message when a file can't be read."""


def extract_file(filename: str, content_type: str, data: bytes) -> dict:
    """Return {title, content, created_at} for an uploaded file."""
    name = (filename or "file").strip()
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    ctype = (content_type or "").lower()

    if ext == "pdf" or "pdf" in ctype:
        content = _from_pdf(data)
    elif ext in ("html", "htm", "xhtml") or "html" in ctype:
        content = web_extract.extract_from_html(_decode(data))["content"]
    else:
        text = _decode(data)
        # Some text files are actually HTML (saved pages); detect and clean those.
        content = (
            web_extract.extract_from_html(text)["content"]
            if _looks_like_html(text)
            else web_extract._clean(text)
        )

    return {
        "title": _title_from_name(name),
        "content": (content or "").strip(),
        "created_at": _date_from_name(name),
    }


# ----- per-type extractors --------------------------------------------------


def _from_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except Exception:
        raise FileError("PDF support is not available on the server.")
    try:
        reader = PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n\n".join(p for p in parts if p.strip())
    except Exception:
        raise FileError("Couldn't read the PDF (it may be corrupted).")
    cleaned = web_extract._clean(text)
    if not cleaned:
        raise FileError("No selectable text found (the PDF may be scanned images).")
    return cleaned


def _decode(data: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


# ----- filename helpers (title + date) --------------------------------------

_MINOR_WORDS = {
    "a", "an", "the", "and", "but", "or", "nor", "for", "of", "on", "in", "to",
    "at", "by", "up", "as", "is", "with", "from", "into", "over", "vs", "via",
}


def _looks_like_html(text: str) -> bool:
    return bool(
        re.search(
            r"</?(?:html|head|body|p|div|span|br|h[1-6]|ul|ol|li|table|tr|td|a|b|i|strong|em)\b[^>]*>",
            text,
            re.I,
        )
    )


def _is_date_like(segment: str) -> bool:
    if re.fullmatch(r"\d{4}[-./]\d{2}[-./]\d{2}", segment):
        return True
    return bool(re.fullmatch(r"\d{1,4}", segment))


def _title_from_name(name: str) -> str:
    base = re.sub(r"\.[^.]+$", "", name)
    words = []
    for seg in base.split("_"):
        if not seg or _is_date_like(seg):
            continue
        for w in re.split(r"[\s-]+", seg):
            w = re.sub(r"[^a-zA-Z0-9]", "", w)
            if w:
                words.append(w)
    if not words:
        return base or name
    out = []
    for i, w in enumerate(words):
        lw = w.lower()
        is_edge = i == 0 or i == len(words) - 1
        out.append(lw if (not is_edge and lw in _MINOR_WORDS) else lw[:1].upper() + lw[1:])
    return " ".join(out)


def _date_from_name(name: str):
    """A date embedded in the filename becomes the entry's date (else None -> now)."""
    base = re.sub(r"\.[^.]+$", "", name)
    m = re.search(r"(\d{4})[-_./]?(\d{2})[-_./]?(\d{2})", base)
    if not m:
        return None
    year, month, day = (int(g) for g in m.groups())
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    try:
        # Noon UTC so the calendar date never shifts across time zones.
        return datetime(year, month, day, 12, 0, 0, tzinfo=timezone.utc).isoformat()
    except ValueError:
        return None
