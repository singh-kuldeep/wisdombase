-- Migration: Upgrade vector index from IVFFlat to HNSW for improved search performance
-- Run this in Supabase SQL Editor to speed up RAG vector search on note chunks.

-- Drop the old IVFFlat index if it exists
DROP INDEX IF EXISTS public.chunks_embedding_idx;

-- Create an HNSW index on chunk embeddings using cosine similarity
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON public.chunks
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- Comment for documentation
COMMENT ON INDEX public.chunks_embedding_hnsw_idx IS 'HNSW vector index for 384-dim note chunk embeddings with cosine distance.';
