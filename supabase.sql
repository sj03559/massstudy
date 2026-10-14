-- MassStudy 클라우드 저장용 테이블 (Supabase > SQL Editor에 붙여넣고 Run)
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

-- 내 프로젝트는 읽고 쓰고, 공유를 켠 프로젝트는 누구나 읽기만
create policy "read own or public" on public.projects for select using (auth.uid() = user_id or is_public);
create policy "insert own" on public.projects for insert with check (auth.uid() = user_id);
create policy "update own" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.projects for delete using (auth.uid() = user_id);
