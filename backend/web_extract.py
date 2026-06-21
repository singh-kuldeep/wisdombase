"""Fetch a web page and extract its readable content as plain text.

Used by POST /ingest-urls to turn a list of links into wisdom entries. Network
and parsing failures raise ExtractError with a short, user-facing message so the
caller can skip the bad link and keep going.
"""

import ipaddress
import re
import socket
from datetime import datetime
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = "Mozilla/5.0 (compatible; WisdomBaseBot/1.0; +https://wisdombase.expo.app)"
TIMEOUT = 15.0
MAX_BYTES = 5_000_000  # cap downloads at ~5 MB

# Tags that never carry article content; dropped before extracting text.
_NOISE_TAGS = ["script", "style", "noscript", "nav", "header", "footer",
               "aside", "form", "iframe", "svg", "button", "template"]


class ExtractError(Exception):
    """Raised with a short, user-facing message when a link can't be read."""


def fetch_and_extract(url: str) -> dict:
    """Return {title, content, published_at} for a URL, or raise ExtractError."""
    url = _normalize(url)
    host = urlparse(url).hostname or ""
    if _is_blocked_host(host):
        raise ExtractError("Refusing to fetch a private or unresolved address.")

    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=TIMEOUT,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,*/*"},
        ) as client:
            resp = client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ExtractError(f"Page returned HTTP {exc.response.status_code}.")
    except httpx.HTTPError:
        raise ExtractError("Couldn't reach the page.")

    raw = resp.content[:MAX_BYTES]
    ctype = resp.headers.get("content-type", "").lower()
    text = raw.decode(resp.encoding or "utf-8", errors="replace")

    is_html = "html" in ctype or "<html" in text[:2000].lower() or "<body" in text[:2000].lower()
    if not is_html:
        # Plain text / markdown — store as-is.
        return {"title": _title_from_url(url), "content": text.strip(), "published_at": None}

    soup = BeautifulSoup(text, "html.parser")
    return {
        "title": _extract_title(soup) or _title_from_url(url),
        "content": _extract_content(soup),
        "published_at": _extract_published(soup),
    }


# ----- helpers --------------------------------------------------------------


def _normalize(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise ExtractError("Empty link.")
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


def _is_blocked_host(host: str) -> bool:
    """Block localhost / private / link-local targets (basic SSRF guard)."""
    if not host:
        return True
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return True  # unresolvable — don't fetch
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
            return True
    return False


def extract_from_html(html: str) -> dict:
    """Parse a raw HTML string into {title, content, published_at}.

    Shared by the URL importer and the file importer (for .html uploads)."""
    soup = BeautifulSoup(html, "html.parser")
    return {
        "title": _extract_title(soup),
        "content": _extract_content(soup),
        "published_at": _extract_published(soup),
    }


def _extract_title(soup: BeautifulSoup):
    og = soup.find("meta", attrs={"property": "og:title"})
    if og and og.get("content"):
        return og["content"].strip()
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        t = h1.get_text(strip=True)
        if t:
            return t
    return None


def _extract_published(soup: BeautifulSoup):
    meta = soup.find("meta", attrs={"property": "article:published_time"})
    if meta and meta.get("content"):
        iso = _to_iso(meta["content"])
        if iso:
            return iso
    t = soup.find("time")
    if t and t.get("datetime"):
        return _to_iso(t["datetime"])
    return None


def _extract_content(soup: BeautifulSoup) -> str:
    for tag in soup(_NOISE_TAGS):
        tag.decompose()
    main = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.body
        or soup
    )
    return _clean(main.get_text(separator="\n"))


def _clean(text: str) -> str:
    lines = [
        re.sub(r"[^\S\n]+", " ", line).strip()
        for line in text.replace("\r", "\n").split("\n")
    ]
    out = "\n".join(line for line in lines if line)
    return re.sub(r"\n{3,}", "\n\n", out).strip()


def _to_iso(value: str):
    value = (value or "").strip()
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").isoformat()
        except ValueError:
            return None


def _title_from_url(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    slug = path.split("/")[-1] if path else parsed.netloc
    slug = re.sub(r"\.[a-z0-9]+$", "", slug, flags=re.I)
    words = [w for w in re.split(r"[-_]+", slug) if w and not re.fullmatch(r"\d+", w)]
    if not words:
        return parsed.netloc or url
    return " ".join(w[:1].upper() + w[1:] for w in words)
