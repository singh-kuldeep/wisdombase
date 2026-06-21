"""Sentence-transformers wrapper.

Loads all-MiniLM-L6-v2 once (lazily) and runs in-process — no API cost.
Produces 384-dimensional vectors, matching the pgvector column.
"""

from functools import lru_cache

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _model():
    # Imported lazily so the (heavy) import only happens when embedding is needed.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(MODEL_NAME)


def embed_one(text: str) -> list[float]:
    """Embed a single string into a 384-dim vector."""
    vec = _model().encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_many(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings."""
    if not texts:
        return []
    vecs = _model().encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vecs]
