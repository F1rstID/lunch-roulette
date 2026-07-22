-- reset-menus cron 교체: 자정에 메뉴를 비우되, 어제 후보 전체를 오늘 메뉴로 재시드.
-- 0002_cron.sql의 단순 truncate 잡을 제거하고 새 잡으로 재등록한다 (재실행 가능).

-- 기존 reset-menus 잡 제거
do $$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'reset-menus'
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- KST 00:00 = UTC 15:00 (전일): 메뉴 초기화 + 어제 후보 재시드
select cron.schedule(
  'reset-menus',
  '0 15 * * *',
  $cmd$
  truncate table public.menus;
  insert into public.menus (name)
  select c->>'name'
  from public.results r
  cross join lateral jsonb_array_elements(r.candidates) c
  where r.date = (select max(date) from public.results);
  $cmd$
);
