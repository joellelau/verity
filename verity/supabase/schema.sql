-- Verity database setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then press Run.
-- It is safe to run more than once.

-- Articles you've saved
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null,
  title text not null,
  site text,
  read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, url)
);

-- Everything in the chat: saved-article cards, replies (quotes, notes, #tags) and reflections
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('article', 'reply', 'reflection')),
  article_id uuid references public.articles (id) on delete cascade,
  quote text not null default '',
  note text not null default '',
  tags text[] not null default '{}',
  text text not null default '',
  links uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists articles_user_created_idx on public.articles (user_id, created_at);
create index if not exists items_user_created_idx on public.items (user_id, created_at);
create index if not exists items_article_idx on public.items (article_id);

-- Only you can see and change your own log
alter table public.articles enable row level security;
alter table public.items enable row level security;

drop policy if exists "Own articles" on public.articles;
create policy "Own articles" on public.articles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Own items" on public.items;
create policy "Own items" on public.items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
