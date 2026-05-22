-- Enable pgvector for semantic search
create extension if not exists vector;

-- Documents = one row per source file ingested into the system
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  source_path text not null unique,
  title text,
  bytes integer,
  ingested_at timestamptz not null default now(),
  content_hash text
);

-- Chunks = text passages with embeddings (768 dims for nomic-embed-text)
create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  source_path text not null,
  chunk_index integer not null,
  content text not null,
  embedding vector(768) not null
);

create index if not exists chunks_document_id_idx on public.chunks(document_id);
create index if not exists chunks_embedding_idx
  on public.chunks
  using hnsw (embedding vector_cosine_ops);

-- Similarity search function used by the search_documents tool
create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count integer default 5
)
returns table (
  id uuid,
  source_path text,
  chunk_index integer,
  content text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.source_path,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
