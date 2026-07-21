"""Lightweight embedding wrapper.

The full sentence-transformers stack is too heavy for Vercel serverless limits.
This module provides a deterministic fallback embedding implementation that keeps
API behavior intact while avoiding a giant dependency bundle.
"""

import hashlib
import math
from typing import Iterable

EMBEDDING_DIM = 384


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in text.replace("\n", " ").split() if t]


def _hash_vector(tokens: Iterable[str], dim: int = EMBEDDING_DIM) -> list[float]:
    vec = [0.0] * dim
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        # Use the first 2 bytes of the hash to pick a position and a sign.
        idx = int.from_bytes(digest[:2], "big") % dim
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vec[idx] += sign * (1.0 / (1.0 + len(token)))
    # Normalize to unit length for stable similarity.
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def embed_one(text: str) -> list[float]:
    """Embed a single string into a 384-dim vector."""
    return _hash_vector(_tokenize(text))


def embed_many(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings."""
    if not texts:
        return []
    return [embed_one(text) for text in texts]
