-- Scope ingested documents and chunks to a specific workspace root.
-- This lets the firm switch between multiple workspaces without
-- cross-contaminating semantic search results.

alter table public.documents
  add column if not exists workspace_root text;
alter table public.chunks
  add column if not exists workspace_root text;

update public.documents set workspace_root = 'legacy' where workspace_root is null;
update public.chunks set workspace_root = 'legacy' where workspace_root is null;

alter table public.documents alter column workspace_root set not null;
alter table public.chunks alter column workspace_root set not null;

-- Replace the bare unique-on-source_path constraint with a composite key.
alter table public.documents drop constraint if exists documents_source_path_key;
alter table public.documents
  add constraint documents_workspace_source_unique unique (workspace_root, source_path);

create index if not exists chunks_workspace_root_idx
  on public.chunks(workspace_root);

drop function if exists public.match_chunks(vector(768), integer);

create or replace function public.match_chunks(
  query_embedding vector(768),
  match_count integer default 5,
  filter_workspace text default null
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
  where filter_workspace is null or c.workspace_root = filter_workspace
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
