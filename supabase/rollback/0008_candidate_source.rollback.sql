-- 0008 롤백: reset-candidates 잡을 0005 문장(source 없는 insert)으로 먼저 되돌리고, 그 다음 candidates.source 컬럼을 지운다.
-- 이 순서인 이유: 컬럼을 먼저 지우면 그 사이 자정 cron 이 source 를 써서 실패해 그날 📌 시드가 빠진다. 잡을 먼저 되돌리면
-- 어느 순간 자정이 와도 시드가 산다.
-- 적용의 역순이다: PR 되돌림 → 0008 이전 함수 2종 재배포 → 이 SQL. 새 함수는 후보 조회에 source 를 명시해 컬럼이 없으면
-- 42703 으로 그날 추첨을 잃고, 새 클라이언트의 담기는 source: 'manual' 을 넣어 컬럼이 없으면 PGRST204 로 실패한다 —
-- 둘 다 이 SQL 보다 먼저 물러나야 한다.
-- 잃는 것: "누가 담았나" 의 구분. 되돌린 뒤에는 사람이 담은 매장도 이번 주 제외를 받는다(0007 동작). 후보 자체는 남는다.
-- 재실행 안전형(unschedule 루프 · if exists).

do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'reset-candidates' loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'reset-candidates',
  '0 15 * * *',
  $cmd$
  delete from public.candidates;
  insert into public.candidates (restaurant_id)
  select id from public.restaurants where pinned order by created_at;
  $cmd$
);

alter table public.candidates
  drop column if exists source;
