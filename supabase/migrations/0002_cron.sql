-- pg_cron + pg_net 활성화
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 기존 잡이 있으면 제거 (재실행 가능)
do $$
declare
  jid bigint;
begin
  for jid in
    select jobid from cron.job where jobname in ('spin-lunch-roulette', 'reset-menus')
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- KST 11:55 = UTC 02:55: Edge Function 호출
select cron.schedule(
  'spin-lunch-roulette',
  '55 2 * * *',
  $cmd$
  select net.http_post(
    url := 'https://dtuwddiepnxygtotwglv.supabase.co/functions/v1/spin-roulette',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cmd$
);

-- KST 00:00 = UTC 15:00 (전일): 메뉴 초기화
select cron.schedule(
  'reset-menus',
  '0 15 * * *',
  $cmd$ truncate table public.menus; $cmd$
);
