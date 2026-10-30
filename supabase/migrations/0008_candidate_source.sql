-- 0008: candidates.source — 후보가 자정 cron 의 자동 시드(seed)인지 사람이 오늘 담은 것(manual)인지 기록한다.
-- 이번 주 제외(간 매장·이번 주 쉬기, 0007)는 seed 행에만 적용된다. 담기는 "오늘 룰렛에 올린다" 는 뜻이라 사람이 담은
-- 행은 쉬기여도 방문이어도 휠·추첨 pool 에 항상 오른다 — 판정은 supabase/functions/_shared/cooldown.ts 의
-- applyWeeklyExclusions 한 곳이고 Edge Function 2종과 오늘 탭이 같은 함수를 쓴다.
--
-- 기본값이 'seed' 인 이유: 적용 순서(이 SQL → 함수 2종 배포 → PR 머지) 사이에 구 클라이언트가 source 없이 넣는 행과
-- 적용 시점에 이미 있는 오늘 행이 전부 seed 로 읽혀, 적용 순간 동작이 바뀌지 않는다(0007 과 같은 제외). manual 을 쓰는
-- 것은 머지된 새 클라이언트의 담기 하나뿐이다. 'manual' 을 기본으로 두면 적용 당일 모든 후보의 제외가 꺼진다.
--
-- 재실행 안전형. 추가만 한다 — 다른 표·정책·publication 은 건드리지 않고, 자정 재시드 잡(reset-candidates)만 source 를
-- 명시하도록 재등록한다. 적용 순서는 README "0008 적용".

-- check 를 컬럼에 인라인으로 두는 이유: add column if not exists 가 컬럼과 함께 제약도 한 번만 만들어 재실행에 안전하다
-- (이름을 따로 주고 do 블록으로 감싼 0006 의 형태는 "컬럼은 있는데 제약만 없는" 중간 상태가 있을 때 필요했다 — 여기는 없다).
alter table public.candidates
  add column if not exists source text not null default 'seed' check (source in ('seed', 'manual'));

comment on column public.candidates.source is '누가 담았나. seed = 자정 cron 의 📌 자동 시드, manual = 사람이 오늘 탭에서 담기. 이번 주 제외(0007)는 seed 행에만 적용된다 — 사람이 담은 매장은 항상 룰렛에 오른다';

-- reset-candidates 재등록(0005 의 unschedule → schedule 패턴, 이 잡 하나만). 기본값이 seed 라 생략해도 같은 값이지만,
-- 잡 본문이 뜻을 말해야 다음 사람이 기본값을 바꿔도 자정 시드가 조용히 manual 이 되지 않는다.
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'reset-candidates' loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- $cmd$ 안에는 주석을 두지 않는다: 본문은 cron.job.command 에 그대로 저장되고 매일 job_run_details 로 복제된다(0005 와 같다).
select cron.schedule(
  'reset-candidates',
  '0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일). 0005 와 같은 시각
  $cmd$
  delete from public.candidates;
  insert into public.candidates (restaurant_id, source)
  select id, 'seed' from public.restaurants where pinned order by created_at;
  $cmd$
);
