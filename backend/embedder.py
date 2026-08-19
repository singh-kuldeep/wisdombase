"""Sentence-transformers wrapper with fallback.

Loads all-MiniLM-L6-v2 lazily and runs in-process — producing 384-dimensional vectors
matching the pgvector column. Includes a fallback token-hashing implementation for
environments where sentence-transformers is omitted.
"""

from functools import lru_cache
import hashlib
import math
from typing import Iterable, Optional

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _model():
    """Lazily load the SentenceTransformer model if available."""
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME)
    except (ImportError, Exception):
        return None


def _tokenize(text: str) -> list[str]:
    return [t.lower() for t in text.replace("\n", " ").split() if t]


def _hash_vector(tokens: Iterable[str], dim: int = EMBEDDING_DIM) -> list[float]:
    vec = [0.0] * dim
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % dim
        sign = 1.0 if digest[2] % 2 == 0 else -1.0
        vec[idx] += sign * (1.0 / (1.0 + len(token)))
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def embed_one(text: str) -> list[float]:
    """Embed a single string into a 384-dim vector."""
    model = _model()
    if model is not None:
        vec = model.encode(text, normalize_embeddings=True)
        return vec.tolist()
    return _hash_vector(_tokenize(text))


def embed_many(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings."""
    if not texts:
        return []
    model = _model()
    if model is not None:
        vecs = model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vecs]
    return [embed_one(text) for text in texts]
