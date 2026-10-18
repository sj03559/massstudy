create table if not exists public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '새 프로젝트',
  data jsonb not null,
  summary jsonb,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);
alter table public.projects enable row level security;
drop policy if exists "read own or public" on public.projects;
drop policy if exists "insert own" on public.projects;
drop policy if exists "update own" on public.projects;
drop policy if exists "delete own" on public.projects;
create policy "read own or public" on public.projects for select using (auth.uid() = user_id or is_public);
create policy "insert own" on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy "update own" on public.projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.projects for delete to authenticated using (auth.uid() = user_id);
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
