-- 0006 롤백: results.ranking 컬럼을 지운다.
-- 순위 데이터는 사라진다. 당첨 자체는 menu·restaurant_id 에 있으므로 기록·랭킹·휠 하이라이트는 무사하다.
-- 순서: 이 파일보다 먼저 0006 이전의 함수 2종을 다시 배포하거나 PR 을 되돌려야 한다 — 새 함수가 살아 있는 채로
-- 컬럼을 지우면 다음 추첨이 PGRST204(없는 컬럼에 쓰기)로 실패한다. 즉 적용의 역순이다: PR 되돌림 → 함수 재배포 → 이 SQL.
-- 컬럼을 그대로 두는 것도 선택지다: 구 함수는 이 컬럼을 모르고 구 UI 는 읽지 않으므로, 지우지 않아도 동작에는 영향이 없다.
-- 재실행 안전형(if exists). check 제약은 컬럼과 함께 떨어진다.

alter table public.results
  drop column if exists ranking;
