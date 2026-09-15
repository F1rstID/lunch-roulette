-- 고정(핀) 메뉴: 여기 등록된 이름은 매일 자정 재시드 때 menus 에 자동으로 다시 들어간다.
-- menus 는 매일 truncate 되므로 핀 상태를 그 테이블에 담을 수 없어 별도 영구 테이블로 둔다.
-- name 을 PK 로 — 이름 단위 고정/해제, 중복 핀 자연 방지.
create table public.pinned_menus (
  name text primary key check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

-- RLS: menus 와 동일하게 익명 개방 (로그인 없는 서비스라 누구나 토글)
alter table public.pinned_menus enable row level security;
create policy pinned_read   on public.pinned_menus for select using (true);
create policy pinned_insert on public.pinned_menus for insert with check (true);
create policy pinned_delete on public.pinned_menus for delete using (true);

-- Realtime: 핀 토글을 다중 접속에 동기화
alter publication supabase_realtime add table public.pinned_menus;

-- 자정 재시드 교체: 0003 의 "어제 후보 전체" → "고정 메뉴만".
-- 결과: 고정 안 한 메뉴는 자정에 사라지고, 고정한 메뉴만 매일 자동 등록된다.
-- (menus truncate 자체는 기존과 동일, 재시드 소스만 pinned_menus 로 바뀜)
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'reset-menus'
  loop perform cron.unschedule(jid); end loop;
end $$;

select cron.schedule(
  'reset-menus',
  '0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일)
  $cmd$
  truncate table public.menus;
  insert into public.menus (name)
  select name from public.pinned_menus order by created_at;
  $cmd$
);
