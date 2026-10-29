-- 0007 롤백: lunch_days 표와 restaurants.paused_week 컬럼을 지우고 cooldown_days 의 comment 를 0005 문구로 되돌린다.
-- 이번 주 점심 기록(목적지·방문 확인)과 "이번 주 쉬기" 상태는 사라진다. 추첨 결과 자체는 results 에 있으므로 당첨·순위와
-- 기록 탭의 날짜별 당첨은 무사하다 — 잃는 것은 "그날 실제로 어디 갔나" 와 "이번 주 누가 쉬나" 다.
-- 순서는 적용의 역순이다: PR 되돌림 → 0007 이전 함수 2종 재배포 → 이 SQL. 새 함수가 살아 있는 채로 표·컬럼을 지우면
-- 다음 추첨이 실패한다 — 주간 창 조회 실패는 weekly_skipped 로 폴백하지만, 후보 조회의 임베드 컬럼(paused_week) 부재는
-- 42703 이고 폴백이 없어 그날 추첨을 잃는다.
-- 재실행 안전형(if exists). lunch_days 의 FK·정책·publication 멤버십은 표와 함께 떨어진다.
-- 컬럼 cooldown_days 는 0007 이 건드리지 않았으므로 여기서도 comment 만 되돌린다.

drop table if exists public.lunch_days;

alter table public.restaurants
  drop column if exists paused_week;

comment on column public.settings.cooldown_days is '최근 N일 당첨 매장 제외. 0 = 끔';
