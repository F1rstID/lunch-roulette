-- 오늘 룰렛에 들어 있는 메뉴 (매일 00:00 KST에 비움)
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

create index on public.menus (created_at);

-- 확정된 추첨 결과 (영구 보존)
create table public.results (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  menu text not null,
  candidates jsonb not null,
  spun_at timestamptz not null default now()
);

create index on public.results (date desc);

-- RLS
alter table public.menus enable row level security;
alter table public.results enable row level security;

-- 익명 read/insert/delete (디자인: no auth라서 누구나 삭제 가능)
create policy menus_read   on public.menus for select using (true);
create policy menus_insert on public.menus for insert with check (true);
create policy menus_delete on public.menus for delete using (true);

-- results: 누구나 읽기, INSERT는 service_role(또는 verify_jwt=false 함수)만
create policy results_read on public.results for select using (true);

-- Realtime publication
alter publication supabase_realtime add table public.menus;
alter publication supabase_realtime add table public.results;
