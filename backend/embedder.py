"""Lightweight 384-dimensional vector embedding wrapper utilizing Google Gemini API.

Avoids giant PyTorch / sentence-transformers dependencies (~330MB) so Vercel Serverless Function
bundle remains lightweight (~15MB). Generates 384-dimensional dense semantic vectors using Google's
`models/gemini-embedding-001` with `output_dimensionality=384`.

Includes a fallback token-hashing implementation for offline / local testing without API keys.
"""

import hashlib
import math
import os
from collections import OrderedDict
from typing import Iterable, Optional

EMBEDDING_DIM = 384
MODEL_NAME = "models/gemini-embedding-001"

_CACHE_MAX_SIZE = 2048
_EMBEDDING_CACHE: OrderedDict[str, list[float]] = OrderedDict()
_CACHE_STATS = {"hits": 0, "misses": 0}


def clear_embedding_cache() -> None:
    """Clear the in-memory embedding cache and reset statistics."""
    _EMBEDDING_CACHE.clear()
    _CACHE_STATS["hits"] = 0
    _CACHE_STATS["misses"] = 0


def get_cache_stats() -> dict[str, int]:
    """Return stats on embedding cache hits, misses, and current size."""
    return {
        "hits": _CACHE_STATS["hits"],
        "misses": _CACHE_STATS["misses"],
        "size": len(_EMBEDDING_CACHE),
    }


def _get_from_cache(cleaned_text: str) -> Optional[list[float]]:
    if cleaned_text in _EMBEDDING_CACHE:
        _EMBEDDING_CACHE.move_to_end(cleaned_text)
        _CACHE_STATS["hits"] += 1
        return list(_EMBEDDING_CACHE[cleaned_text])
    return None


def _put_to_cache(cleaned_text: str, vec: list[float]) -> None:
    _EMBEDDING_CACHE[cleaned_text] = list(vec)
    _EMBEDDING_CACHE.move_to_end(cleaned_text)
    if len(_EMBEDDING_CACHE) > _CACHE_MAX_SIZE:
        _EMBEDDING_CACHE.popitem(last=False)


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in text.replace("\n", " ").split() if t]


def _hash_vector(tokens: Iterable[str], dim: int = EMBEDDING_DIM) -> list[float]:
    vec = [0.0] * dim
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % dim
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vec[idx] += sign * (1.0 / (1.0 + len(token)))
    return _normalize(vec)


def _get_gemini_api_key() -> Optional[str]:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
    )


def embed_one(text: str) -> list[float]:
    """Embed a single string into a 384-dim normalized vector (cached)."""
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM

    cleaned = text.strip()
    cached = _get_from_cache(cleaned)
    if cached is not None:
        return cached

    _CACHE_STATS["misses"] += 1

    api_key = _get_gemini_api_key()
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            res = genai.embed_content(
                model=MODEL_NAME,
                content=cleaned,
                output_dimensionality=EMBEDDING_DIM,
            )
            raw_embedding = res.get("embedding")
            if raw_embedding and isinstance(raw_embedding, list):
                norm_vec = _normalize(raw_embedding)
                _put_to_cache(cleaned, norm_vec)
                return norm_vec
        except Exception:
            pass

    fallback_vec = _hash_vector(_tokenize(cleaned))
    _put_to_cache(cleaned, fallback_vec)
    return fallback_vec


def embed_many(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings into 384-dim normalized vectors with caching."""
    if not texts:
        return []

    results: list[Optional[list[float]]] = [None] * len(texts)
    missing_text_indices: dict[str, list[int]] = {}

    for i, raw_text in enumerate(texts):
        cleaned = (raw_text or "").strip()
        if not cleaned:
            results[i] = [0.0] * EMBEDDING_DIM
            continue

        cached = _get_from_cache(cleaned)
        if cached is not None:
            results[i] = cached
        else:
            if cleaned not in missing_text_indices:
                missing_text_indices[cleaned] = [i]
            else:
                _CACHE_STATS["hits"] += 1
                missing_text_indices[cleaned].append(i)

    if not missing_text_indices:
        return [res for res in results if res is not None]

    unique_miss_texts = list(missing_text_indices.keys())
    _CACHE_STATS["misses"] += len(unique_miss_texts)

    api_key = _get_gemini_api_key()
    fetched_vecs: Optional[list[list[float]]] = None

    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            res = genai.embed_content(
                model=MODEL_NAME,
                content=unique_miss_texts,
                output_dimensionality=EMBEDDING_DIM,
            )
            raw_embeddings = res.get("embedding")
            if (
                raw_embeddings
                and isinstance(raw_embeddings, list)
                and len(raw_embeddings) == len(unique_miss_texts)
                and isinstance(raw_embeddings[0], list)
            ):
                fetched_vecs = [_normalize(vec) for vec in raw_embeddings]
        except Exception:
            pass

    if fetched_vecs is None:
        fetched_vecs = [_hash_vector(_tokenize(txt)) for txt in unique_miss_texts]

    for txt, vec in zip(unique_miss_texts, fetched_vecs):
        _put_to_cache(txt, vec)
        for orig_idx in missing_text_indices[txt]:
            results[orig_idx] = vec

    return [res for res in results if res is not None]


