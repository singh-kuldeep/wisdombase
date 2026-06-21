-- Run this once in the Supabase SQL Editor before using the app.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  llm_provider TEXT DEFAULT 'anthropic',
  memory_profile TEXT,
  memory_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent migration for databases created before long-term memory existed.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS memory_profile TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS memory_updated_at TIMESTAMPTZ;

-- Per-user count of free questions answered with the shared backend key.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_questions_used INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  group_name TEXT DEFAULT 'Personal',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent migration for databases created before groups/tags existed.
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT 'Personal';
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384),
  chunk_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON public.chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_chunks_user_id ON public.chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_group ON public.entries(user_id, group_name);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users see own entries" ON public.entries;
CREATE POLICY "Users see own entries" ON public.entries FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users see own chunks" ON public.chunks;
CREATE POLICY "Users see own chunks" ON public.chunks FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(384),
  match_user_id UUID,
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (id UUID, entry_id UUID, content TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT chunks.id, chunks.entry_id, chunks.content,
         1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM public.chunks
  WHERE chunks.user_id = match_user_id
    AND 1 - (chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
