-- 0005 롤백: 매장 모델(0005_restaurants_settings.sql)에서 메뉴 모델(0001~0004)로 **동작**을 되돌린다.
-- 언제 쓰는가·앞뒤 순서(구 Edge Function 재배포·앱 롤백)는 README 의 "롤백" 절이 정본이다. 이 파일만 실행하면
-- DB 는 구 스키마를 다시 갖지만 함수·앱이 구 코드가 아니면 여전히 깨진다 — 순서: 이 SQL → 구 함수 배포 → 앱 롤백.
-- supabase/migrations/ 밖에 두는 이유: CLI 의 db push 가 그 디렉터리를 마이그레이션으로 읽는다.
-- 원칙 1 — 동작 복원이지 데이터 파기가 아니다. restaurants·candidates·settings·results.restaurant_id 는 남긴다.
--   구 코드는 모르는 테이블·컬럼을 읽지 않으므로 무해하고, 재컷오버 때 사용자가 등록한 매장이 그대로 산다.
--   파기가 정말 필요하면 맨 아래 주석 블록을 풀어 **따로** 실행한다.
-- 원칙 2 — 전부 재실행 안전형(if not exists / drop policy if exists / jobid 루프 / publication 존재 검사).
--   한 번도 리허설되지 않은 채 장애 순간에 처음 실행되는 파일이라 중간에 끊겨도 다시 돌릴 수 있어야 한다.
-- 원칙 3 — 0005 의 역순이다: cron 제거 → 구 테이블 복원 → 구 cron 재등록. 구 함수와 reset-menus 가 menus 를 읽으므로
--   테이블이 잡보다 먼저 있어야 한다.

-- 1. 새 cron 3종 제거 (0005 절 7 의 역). 이름 인자 형태는 잡이 없을 때 ERROR 로 끊기므로 jobid 루프만 쓴다.
-- 구 이름 reset-menus 도 목록에 넣어 아래 재등록이 중복 잡을 만들지 않게 한다.
do $$
declare jid bigint;
begin
  for jid in
    select jobid from cron.job
    where jobname in ('spin-lunch-roulette', 'reset-menus', 'reset-candidates', 'purge-cron-history')
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- 2. 구 테이블 복원. 스키마는 0001(menus)·0004(pinned_menus) 그대로 — 구 코드가 기대하는 컬럼 집합을 바꾸지 않는다.
-- 인덱스 이름은 0001 의 무명 create index 가 Postgres 에서 자동으로 받은 menus_created_at_idx 와 같게 둔다 — 0005 가 절 8 앞에서
-- 끊겨 menus 가 살아 있는 상태(롤백 기준 a)에서 실행해도 if not exists 가 no-op 이 되어 중복 인덱스가 생기지 않는다.
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);
create index if not exists menus_created_at_idx on public.menus (created_at);

create table if not exists public.pinned_menus (
  name text primary key check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);

-- RLS 는 0001·0004 와 같은 익명 개방. 정책은 조건부 생성 문법이 없어 drop → create 쌍으로만 쓴다(0005 와 같은 이유).
alter table public.menus enable row level security;
alter table public.pinned_menus enable row level security;

drop policy if exists menus_read on public.menus;
create policy menus_read on public.menus for select using (true);
drop policy if exists menus_insert on public.menus;
create policy menus_insert on public.menus for insert with check (true);
drop policy if exists menus_delete on public.menus;
create policy menus_delete on public.menus for delete using (true);

drop policy if exists pinned_read on public.pinned_menus;
create policy pinned_read on public.pinned_menus for select using (true);
drop policy if exists pinned_insert on public.pinned_menus;
create policy pinned_insert on public.pinned_menus for insert with check (true);
drop policy if exists pinned_delete on public.pinned_menus;
create policy pinned_delete on public.pinned_menus for delete using (true);

-- Realtime publication. 0005 가 drop table 로 멤버십을 함께 지웠으므로 다시 넣는다. 맨 add table 은 2회차에
-- "already member" 로 끊기므로 존재 검사로 감싼다. format(%I) 인자는 아래 상수 배열뿐이라 주입 경로가 없다.
do $$
declare t text;
begin
  foreach t in array array['menus', 'pinned_menus'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 3. 구 cron 2종 재등록. 시각은 0002 의 11:55 KST 고정(구 함수가 settings 를 읽지 않으므로 settings.spin_time 은 무시된다).
-- timeout 5000ms 는 0002 에 없던 인자다 — 하루 한 번 부르는 잡은 콜드스타트에 더 노출되고(0005 절 7 과 같은 이유), 구 함수의 동작은 바뀌지 않는다.
-- $cmd$ 안에는 주석을 두지 않는다 — 본문이 cron.job.command 에 그대로 저장된다.
select cron.schedule(
  'spin-lunch-roulette',
  '55 2 * * *',
  $cmd$
  select net.http_post(
    url := 'https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $cmd$
);

-- 자정 리셋은 0004 형태(truncate + 고정 메뉴 재시드). 0005 의 reset-candidates 는 1번에서 이미 걷어냈다.
select cron.schedule(
  'reset-menus',
  '0 15 * * *',
  $cmd$
  truncate table public.menus;
  insert into public.menus (name)
  select name from public.pinned_menus order by created_at;
  $cmd$
);

-- 4. (선택 — 기본은 실행하지 않는다) 새 모델 데이터 파기. 재컷오버 계획이 없고 매장 데이터를 버려도 된다고
-- 결정했을 때만 주석을 풀어 따로 실행한다. 순서가 중요하다: results.restaurant_id 의 FK 가 restaurants 를 가리키므로
-- 컬럼을 먼저 떨군다. 실행 전 select count(*) from public.restaurants 로 버릴 행 수를 눈으로 본다.
-- drop table if exists public.candidates;
-- drop table if exists public.settings;
-- alter table public.results drop column if exists restaurant_id;
-- drop table if exists public.restaurants;
-- drop function if exists public.text_array_max_len(text[]);
