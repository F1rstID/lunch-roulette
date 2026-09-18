-- 0005 컷오버: 메뉴(이름) 모델을 매장(uuid) 모델로 바꾸고 동작 설정을 DB 단일행으로 옮긴다.
-- 동작 불변 원칙: 이 파일을 적용한 직후의 동작은 지금과 똑같다(11:55 추첨, 쿨다운 없음). 동작 변경은 settings UPDATE 로만 한다.
-- 적용은 Phase 8 에 사용자가 대시보드 SQL Editor 에서 1회 실행한다 — 로컬 스택이 없어 리허설을 못 하므로
-- 모든 문을 재실행 안전형(if not exists / if exists / unschedule→schedule)으로만 쓴다. 중간에 끊겨도 다시 돌릴 수 있어야 한다.
-- 여기까지가 추첨 시각의 단일 출처(settings.spin_time)를 만드는 일이고, 코드 쪽 시각 하드코딩 제거는 Phase 3·6 소관이다.

-- 1. restaurants — 영구 매장 카탈로그. 자정 리셋에 지워지지 않는 쪽이 여기다.
-- 24자 상한은 lib/constants.ts 의 MENU_NAME_MAX_LEN 과 같은 값이다. 늘릴 때는 두 곳을 함께 고친다.
-- 제약을 컬럼 인라인으로 두는 이유: alter table … add constraint 에는 if not exists 가 없어 재실행이 거기서 끊긴다.
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 24),
  menus text[] not null default '{}',
  location text,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- 인덱스에 이름을 주는 이유: 무명 형태(0001 선례)는 재실행마다 _idx1 을 새로 만든다. 이름이 있어야 if not exists 도 쓸 수 있다.
create index if not exists restaurants_pinned_idx on public.restaurants (pinned);

-- 2. candidates — 오늘 후보. restaurant_id 가 PK 라서 같은 매장을 두 번 담을 수 없고,
-- Realtime DELETE 이벤트의 payload.old 에 실려 오는 키도 이 컬럼이다(기본 replica identity = PK).
-- cascade 는 매장 삭제가 후보까지 자동 정리하게 한다 — 참조 무결성은 RLS 를 우회한다는 점을 기억할 것.
create table if not exists public.candidates (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 담은 순서대로 보여 주는 목록 쿼리용. 이름을 명시하는 이유는 위와 같다.
create index if not exists candidates_created_at_idx on public.candidates (created_at);

-- 3. settings — 동작 설정 단일행. check (id = 1) 이 2번 행을 막는다: 정본이 둘이면 앱의 .single() 이 깨진다.
-- updated_at 을 두지 않는 이유: 트리거 없이 손으로 갱신하는 시각 컬럼은 금세 거짓말이 된다.
create table if not exists public.settings (
  id int primary key check (id = 1),
  spin_time time not null default '11:55',
  cooldown_days int not null default 0 check (cooldown_days >= 0),
  history_since date not null default ((now() at time zone 'Asia/Seoul')::date)
);

-- on conflict do nothing 인 이유: 재실행이 대시보드에서 바꾼 값을 되돌리면 안 된다.
-- 기본값은 최초 insert 가 성공한 시점에 한 번만 평가되므로 전환일(history_since)이 재실행 때마다 오늘로 밀리지도 않는다.
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 대시보드 테이블 편집기에서 컬럼 설명으로 보인다. 설정을 손으로 고치는 사람이 의미를 되묻지 않게 하려는 것.
comment on column public.settings.spin_time is '추첨 시각(KST). 앱·Edge Function 이 함께 읽는 단일 출처';
comment on column public.settings.cooldown_days is '최근 N일 당첨 매장 제외. 0 = 끔';
comment on column public.settings.history_since is '매장 전환일. 이 날짜 이후 results 만 기록·랭킹에 집계한다';

-- 4. results — 기존 행은 삭제도 변환도 하지 않는다. menu 컬럼은 이름을 유지한 채 의미만 매장명 스냅샷으로 바뀐다:
-- 매장이 지워져도 그 문자열이 남아 있는 것이 기록·랭킹의 전제다.
-- on delete set null 주의: 매장 삭제가 여기에 UPDATE 를 내보내고, 그 Realtime 이벤트를 app/page.tsx 의 결과 구독이
-- 새 결과로 오인하면 휠이 재회전한다. 가드는 Phase 6 소관이고 이 파일은 사실만 남긴다.
alter table public.results add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;

-- 5. RLS 와 정책. Supabase 는 public 스키마의 새 테이블에 anon DML 권한을 기본으로 주므로 RLS 활성이 유일한 게이트다.
alter table public.restaurants enable row level security;
alter table public.candidates enable row level security;
alter table public.settings enable row level security;

-- 정책은 항상 drop → create 쌍으로 쓴다. 조건부 생성 문법이 없어서 그냥 만들면 2회차에 이미 존재한다며 끊긴다.
-- restaurants·candidates 전면 개방은 0001 의 menus 와 같은 수준이다(로그인 없는 서비스라 누구나 담고 지운다).
drop policy if exists restaurants_read on public.restaurants;
create policy restaurants_read on public.restaurants for select using (true);
drop policy if exists restaurants_insert on public.restaurants;
create policy restaurants_insert on public.restaurants for insert with check (true);
drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants for update using (true) with check (true);
drop policy if exists restaurants_delete on public.restaurants;
create policy restaurants_delete on public.restaurants for delete using (true);

drop policy if exists candidates_read on public.candidates;
create policy candidates_read on public.candidates for select using (true);
drop policy if exists candidates_insert on public.candidates;
create policy candidates_insert on public.candidates for insert with check (true);
drop policy if exists candidates_update on public.candidates;
create policy candidates_update on public.candidates for update using (true) with check (true);
drop policy if exists candidates_delete on public.candidates;
create policy candidates_delete on public.candidates for delete using (true);

-- settings 는 읽기 정책 하나뿐이다. 쓰기 정책을 "만들지 않는 것" 자체가 잠금 장치다(정책 부재 = 기본 거부, 0001 의 results 선례).
-- 여기에 쓰기 정책을 하나 더하는 것이 이 파일에서 가장 위험한 변경이다 — 누구나 추첨 시각을 바꿀 수 있게 된다.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);

-- 6. Realtime publication. 맨 add table 문은 2회차에 "already member" 로 스크립트를 끊으므로 존재 검사로 감싼다.
-- format(%I) 에 들어가는 인자는 아래 상수 배열뿐이라 주입 경로가 없다.
do $$
declare t text;
begin
  foreach t in array array['restaurants', 'candidates', 'settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- 7. cron 교체. 잡 이름을 인자로 넘기는 형태는 잡이 없을 때 ERROR 를 던져 재실행을 끊으므로 jobid 루프로만 걷어낸다.
-- 구 이름 reset-menus 도 같은 목록에 넣어 이번에 함께 사라지게 한다.
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

select cron.schedule(
  'spin-lunch-roulette',
  '* * * * *',  -- 매분 폴링. 시각 판정은 Edge Function 이 settings.spin_time 으로 한다
  $cmd$
  select net.http_post(
    -- URL 의 프로젝트 ref swxiqytyxjlcgubqlozk 는 하드코딩이다(0002 선례). 다른 프로젝트로 옮기면 치환할 것.
    url := 'https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 5000  -- pg_net 기본값 2000ms 는 Edge Function 콜드스타트에 짧다
  );
  $cmd$
);

-- 자정 리셋. 0004 방식의 전체 삭제문을 쓰지 않는 이유: 그 방식은 행 단위 DELETE 이벤트를 내보내지 않아
-- 열려 있는 탭의 후보 목록이 자정에도 그대로 남는다(CAND-04).
select cron.schedule(
  'reset-candidates',
  '0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일)
  $cmd$
  delete from public.candidates;
  insert into public.candidates (restaurant_id)
  select id from public.restaurants where pinned order by created_at;
  $cmd$
);

-- 매분 폴링은 cron.job_run_details 에 하루 1,440행을 쌓는데 pg_cron 은 이 표를 스스로 정리하지 않는다.
select cron.schedule(
  'purge-cron-history',
  '30 15 * * *',  -- KST 00:30 = UTC 15:30 (전일)
  $cmd$
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  $cmd$
);

-- 8. 구 테이블 제거. menus·pinned_menus 는 지금 0행이라 이관할 데이터가 없다.
-- 여기서 테이블을 떨구면 publication 멤버십도 함께 정리되므로 사전에 따로 뺄 필요가 없다.
-- 이 두 줄이 파일의 마지막 문이다 — 뒤에 다른 문을 두지 않는다(설명은 전부 이 위에 둔다).
drop table if exists public.pinned_menus;
drop table if exists public.menus;
