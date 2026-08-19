"""Lightweight 384-dimensional vector embedding wrapper utilizing Google Gemini API.

Avoids giant PyTorch / sentence-transformers dependencies (~330MB) so Vercel Serverless Function
bundle remains lightweight (~15MB). Generates 384-dimensional dense semantic vectors using Google's
`models/gemini-embedding-001` with `output_dimensionality=384`.

Includes a fallback token-hashing implementation for offline / local testing without API keys.
"""

import hashlib
import math
import os
import re
from typing import Iterable, Optional

EMBEDDING_DIM = 384
MODEL_NAME = "models/gemini-embedding-001"

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
    "in", "is", "it", "its", "my", "of", "on", "or", "she", "that", "the", "to",
    "was", "were", "will", "with", "i", "you", "your", "we", "they", "this", "have",
    "had", "been", "do", "does", "did", "but", "not", "so", "if", "out", "up",
    "about", "into", "than", "then", "more", "some", "such", "no", "only", "other",
    "too", "very", "can", "just", "should", "now"
}


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _tokenize(text: str) -> list[str]:
    words = re.findall(r"\b\w+\b", text.lower())
    filtered = [w for w in words if w not in STOPWORDS]
    return filtered or words


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
    """Embed a single string into a 384-dim normalized vector."""
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM

    api_key = _get_gemini_api_key()
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            res = genai.embed_content(
                model=MODEL_NAME,
                content=text,
                output_dimensionality=EMBEDDING_DIM,
            )
            raw_embedding = res.get("embedding")
            if raw_embedding and isinstance(raw_embedding, list):
                return _normalize(raw_embedding)
        except Exception:
            pass

    return _hash_vector(_tokenize(text))


def embed_many(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings into 384-dim normalized vectors."""
    if not texts:
        return []

    api_key = _get_gemini_api_key()
    if api_key:
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            res = genai.embed_content(
                model=MODEL_NAME,
                content=texts,
                output_dimensionality=EMBEDDING_DIM,
            )
            raw_embeddings = res.get("embedding")
            if (
                raw_embeddings
                and isinstance(raw_embeddings, list)
                and len(raw_embeddings) == len(texts)
                and isinstance(raw_embeddings[0], list)
            ):
                return [_normalize(vec) for vec in raw_embeddings]
        except Exception:
            pass

    return [embed_one(text) for text in texts]
