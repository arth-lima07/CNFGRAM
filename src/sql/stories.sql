-- =========================================================
-- CNFGRAM — Stories
-- Roda isso no SQL Editor do Supabase (Dashboard > SQL Editor)
-- =========================================================

-- 1) Tabela de stories
create table if not exists public.stories (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  image_url   text not null,
  caption     text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create index if not exists stories_user_id_idx on public.stories(user_id);
create index if not exists stories_expires_at_idx on public.stories(expires_at);
create index if not exists stories_created_at_idx on public.stories(created_at desc);

-- 2) Tabela de "visto" (quem já viu qual story)
create table if not exists public.story_views (
  id          bigint generated always as identity primary key,
  story_id    bigint not null references public.stories(id) on delete cascade,
  viewer_id   uuid not null references public.profiles(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  unique (story_id, viewer_id)
);

create index if not exists story_views_story_id_idx on public.story_views(story_id);
create index if not exists story_views_viewer_id_idx on public.story_views(viewer_id);

-- 3) RLS
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Qualquer usuário autenticado pode ver stories não expirados
drop policy if exists "stories_select_not_expired" on public.stories;
create policy "stories_select_not_expired"
  on public.stories for select
  to authenticated
  using (expires_at > now());

-- Só o dono pode inserir story em seu próprio nome
drop policy if exists "stories_insert_own" on public.stories;
create policy "stories_insert_own"
  on public.stories for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Só o dono pode apagar o próprio story
drop policy if exists "stories_delete_own" on public.stories;
create policy "stories_delete_own"
  on public.stories for delete
  to authenticated
  using (auth.uid() = user_id);

-- Views: usuário autenticado pode marcar que viu
drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own"
  on public.story_views for insert
  to authenticated
  with check (auth.uid() = viewer_id);

-- Views: usuário pode ver quem viu seus próprios stories, e ver seus próprios "vistos"
drop policy if exists "story_views_select" on public.story_views;
create policy "story_views_select"
  on public.story_views for select
  to authenticated
  using (
    auth.uid() = viewer_id
    or auth.uid() in (select user_id from public.stories where stories.id = story_views.story_id)
  );

-- 4) Função utilitária para limpar stories expirados (opcional, rodar via cron/Edge Function)
create or replace function public.delete_expired_stories()
returns void
language sql
security definer
as $$
  delete from public.stories where expires_at <= now();
$$;

-- =========================================================
-- 5) Storage bucket para imagens de stories
-- =========================================================
insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do nothing;

-- Qualquer pessoa autenticada pode subir um arquivo na própria pasta (userId/arquivo.jpg)
drop policy if exists "stories_storage_insert" on storage.objects;
create policy "stories_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Leitura pública (bucket público, mas a policy de select também precisa existir)
drop policy if exists "stories_storage_select" on storage.objects;
create policy "stories_storage_select"
  on storage.objects for select
  to public
  using (bucket_id = 'stories');

-- Só o dono pode apagar seu próprio arquivo
drop policy if exists "stories_storage_delete" on storage.objects;
create policy "stories_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
