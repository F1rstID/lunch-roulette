-- 0007 주간 점심 기록: 하루 한 행의 lunch_days 표와 매장 "이번 주 쉬기" 컬럼을 더한다.
-- 왜: 룰렛이 정한 순서(0006 ranking)를 팀이 실제로 어떻게 썼는지 — 오늘 갈 곳(웨이팅이면 다음 식당)·실제 방문 —
-- 를 남기고, 그 기록으로 "이번 주(월~어제) 간 매장" 과 "이번 주 쉬기" 매장을 추첨 pool 과 휠에서 뺀다.
-- 월요일 00:00 KST 에 전부 해제된다 — 해제는 코드의 창 계산(_shared/cooldown.ts weeklyWindowStart)이 하고 cron 은 없다.
-- 이 규칙이 settings.cooldown_days(최근 N일 당첨 제외)를 대체한다. 컬럼은 남긴다 — 추가 → 코드 전환 → 제거 중 "제거" 는 0008 이다.
-- 추가만 한다. 새 표는 아무도 읽지 않고 새 컬럼은 null 기본이라 이 파일을 적용한 순간에도 구 함수·구 화면은 그대로 동작한다.
-- 그래서 적용 순서는 SQL → 함수 2종 배포 → PR 머지다. 함수를 먼저 배포하면 안 된다: 새 함수는 paused_week 를 임베드로 읽고
-- lunch_days 를 조회하므로 표·컬럼이 없으면 42703·42P01 로 그날 추첨을 잃는다.
-- 적용은 사용자가 대시보드 SQL Editor 에서 1회 실행한다. 모든 문은 재실행 안전형이다(0005·0006 과 같은 규율).

-- 이름 스냅샷 둘은 매장명과 같은 24자(코드포인트) 상한이다(0005 restaurants.name 과 같은 규율) — 카탈로그에서 온 이름이거나
-- 클라이언트가 같은 상한으로 거른 "다른 매장" 이름이라 DB 가 한 번 더 막는다. 빈 문자열은 null 로 쓴다.
-- 1. lunch_days — 날짜당 한 행. 행은 누군가 행동할 때(목적지 변경·방문 확인) upsert 로 생긴다.
-- 아무도 안 누른 날은 행이 없고, 그날 목적지는 코드가 결과 행의 1순위로 파생한다(_shared/cooldown.ts effectiveDestinationId).
-- 이름 스냅샷을 함께 두는 이유는 results.menu 와 같다 — 매장이 지워져도(FK set null) 그날 기록은 남는다.
-- destination_set_at 은 다시 돌리기 판정에 쓴다: results.spun_at 보다 앞이면 옛 순서에서 고른 목적지라 코드가 무시한다.
-- 그래서 respin 함수는 이 표를 건드리지 않는다.
create table if not exists public.lunch_days (
  date date primary key,
  destination_id uuid references public.restaurants(id) on delete set null,
  destination_name text check (destination_name is null or char_length(destination_name) between 1 and 24),
  destination_set_at timestamptz,
  visit_status text not null default 'unknown' check (visit_status in ('unknown', 'visited', 'skipped')),
  visited_id uuid references public.restaurants(id) on delete set null,
  visited_name text check (visited_name is null or char_length(visited_name) between 1 and 24),
  visited_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.lunch_days is
  '날짜당 한 행의 점심 기록. destination_id 가 비면 그날 추첨 1순위(results.ranking[0])가 목적지다. '
  'visit_status 가 unknown 이면 확인 안 됨 — 기록·랭킹·주간 제외는 목적지에 간 것으로 친다. skipped 는 단체 점심을 안 한 날.';
comment on column public.lunch_days.destination_set_at is
  '목적지를 고른 시각(DB 시각 — 아래 트리거가 찍는다). results.spun_at 보다 앞이면 다시 돌리기 전의 선택이라 코드가 무시한다(쓰기 없이 stale 처리).';
comment on column public.lunch_days.visited_id is
  '실제로 간 매장. visited 인데 null 이면 카탈로그 밖 "다른 매장"(visited_name 만 있다).';

-- 2. RLS — anon 이 읽고·만들고·고친다. delete 정책은 만들지 않는다(정책 부재 = 기본 거부, 0001 results·0005 settings 선례):
-- 되돌리기(목적지 해제·방문 수정)는 전부 null/다른 값으로 update 라 지울 일이 없고, 하루 기록 행이 통째로 사라지는 경로를 닫는다.
alter table public.lunch_days enable row level security;

drop policy if exists lunch_days_read on public.lunch_days;
create policy lunch_days_read on public.lunch_days for select using (true);
drop policy if exists lunch_days_insert on public.lunch_days;
create policy lunch_days_insert on public.lunch_days for insert with check (true);
drop policy if exists lunch_days_update on public.lunch_days;
create policy lunch_days_update on public.lunch_days for update using (true) with check (true);

-- 3. restaurants.paused_week — "이번 주 쉬기". 그 주 월요일 날짜를 저장한다. 활성 판정은 코드가 "이번 주 월요일과 같은가" 로
-- 하므로 만료가 자동이고 해제 cron 이 없다. null = 쉬지 않음. 핀(pinned)과 독립이다 — 핀은 "매일 후보에 올린다",
-- 쉬기는 "이번 주는 뽑지 않는다" 로 뜻이 다르다. restaurants 는 이미 publication 에 있어 화면은 기존 구독으로 받는다.
alter table public.restaurants
  add column if not exists paused_week date;

comment on column public.restaurants.paused_week is
  '이번 주 쉬기. 그 주 월요일 날짜. 이번 주 월요일과 같을 때만 활성(추첨·휠에서 제외), 다른 주 값은 만료된 것. null = 쉬지 않음.';

-- 4. cooldown_days 는 더 읽지 않는다. 컬럼은 남긴다 — 구 함수가 아직 살아 있는 창(SQL 적용 ↔ 함수 배포 사이)에서 읽기 때문이다.
comment on column public.settings.cooldown_days is
  '0007 이후 미사용 — 주간 제외(lunch_days·restaurants.paused_week)로 대체. 제거는 다음 마이그레이션.';

-- 5. 시각 세 컬럼은 DB 시각으로 찍는다. 클라이언트 시계로 적으면 results.spun_at(서버 시각)과의 비교(stale 판정)가 기기 시계
-- 오차에 흔들린다 — 시계가 몇 초 늦은 휴대폰이 고른 목적지가 "다시 돌리기 전 선택" 으로 읽혀 조용히 무시된다.
-- 클라이언트는 그 컬럼에 아무 시각이든 보내 "이번 쓰기가 그 사실을 건드렸다" 고 알리고, 값은 여기서 now() 로 바뀐다.
-- 같은 목적지를 다시 고른 경우(destination_id 는 그대로, set_at 만 새 값)도 재각인돼 다시 돌리기 뒤의 재선택이 살아난다.
-- create or replace + drop trigger if exists 라 재실행 안전형이다. search_path 를 비우는 이유: 트리거 함수는 호출자의 검색 경로로 돌아
-- 같은 이름의 함수를 다른 스키마에 심는 경로가 열린다 — 본문은 now() 뿐이라 pg_catalog 만으로 충분하다.
create or replace function public.lunch_days_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.destination_set_at is not null
     and (tg_op = 'INSERT' or new.destination_set_at is distinct from old.destination_set_at) then
    new.destination_set_at := now();
  end if;
  if new.visited_at is not null
     and (tg_op = 'INSERT' or new.visited_at is distinct from old.visited_at) then
    new.visited_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists lunch_days_stamp on public.lunch_days;
create trigger lunch_days_stamp
  before insert or update on public.lunch_days
  for each row execute function public.lunch_days_stamp();

-- 6. Realtime publication. 맨 add table 문은 2회차에 "already member" 로 스크립트를 끊으므로 존재 검사로 감싼다(0005 와 같다).
-- format(%I) 에 들어가는 인자는 아래 상수 배열뿐이라 주입 경로가 없다.
do $$
declare t text;
begin
  foreach t in array array['lunch_days'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
