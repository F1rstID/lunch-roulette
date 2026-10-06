-- 0006 결과 순위: 추첨이 정한 후보 전체의 순서를 결과 행에 남긴다.
-- 왜: 당첨 매장에 웨이팅이 걸리면 팀은 다른 곳으로 간다. 그때 갈 곳(2·3순위)이 추첨 시각에 이미 정해져 있어야
-- "마음에 들 때까지 다시 뽑기" 가 되지 않는다. 다시 돌리기는 순서 전체를 새로 뽑는다.
-- 추가만 한다. nullable 이고 기본값이 null 이라 이 파일을 적용한 순간에도 구 함수(ranking 을 모른다)와
-- 구 행(ranking 이 null)은 그대로 동작한다. 그래서 적용 순서는 SQL → 함수 2종 배포 → PR 머지다.
-- 함수를 먼저 배포하면 안 된다: 새 함수는 ranking 을 쓰므로 컬럼이 없으면 PGRST204 로 그날 추첨을 잃는다.
-- 적용은 사용자가 대시보드 SQL Editor 에서 1회 실행한다. 모든 문은 재실행 안전형이다(0005 와 같은 규율).

alter table public.results
  add column if not exists ranking jsonb;

-- 화면은 배열만 읽는다. 배열이 아닌 값은 DB 가 거부해야 "손으로 고친 행 하나가 페이지를 깨뜨리는" 경로가 닫힌다.
-- null 은 허용한다 — 구 행과, 컬럼은 있는데 아직 구 함수가 쓴 행이 그 상태다.
-- add constraint 에는 if not exists 가 없어 카탈로그 존재 검사로 감싼다. 2회차 실행에도 끊기지 않는다.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'results_ranking_is_array' and conrelid = 'public.results'::regclass
  ) then
    alter table public.results
      add constraint results_ranking_is_array
      check (ranking is null or jsonb_typeof(ranking) = 'array');
  end if;
end $$;

comment on column public.results.ranking is
  '추첨이 정한 후보 순서. [{"restaurant_id": uuid, "name": 매장명 스냅샷}, …]. 1번째가 당첨이며 menu·restaurant_id 와 같다. '
  '쿨다운을 거친 후보가 들어간다(쿨다운으로 후보가 전멸한 날은 전체 후보로 되돌아가 최근 당첨 매장도 들어간다). '
  '0006 이전 행과 구 함수가 쓴 행은 null. 안의 restaurant_id 는 외래키가 아니라 매장을 지워도 그대로 남는다.';
