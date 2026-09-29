---
phase: 02-data-model
reviewed: 2026-09-21T00:32:52Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - supabase/migrations/0005_restaurants_settings.sql
  - supabase/migrations/0005_restaurants_settings.test.ts
  - lib/supabase/client.ts
  - vitest.config.mts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-21T00:32:52Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

컷오버 마이그레이션 `0005_restaurants_settings.sql`, 그 계약 스펙 `0005_restaurants_settings.test.ts`, 행 타입 `lib/supabase/client.ts`, 러너 설정 `vitest.config.mts` 를 DBA 관점에서 읽었고, 정적 낭독만으로는 문법·재실행성을 증명할 수 없어 **일회용 PostgreSQL 17.11 컨테이너에 `cron`·`net` 스키마 스텁, `supabase_realtime` publication, Supabase 기본 grant 를 가진 `anon` 롤을 재현한 뒤 0001→0004 베이스라인 위에서 0005 를 세 번 실행**했다 (1회차, 2회차 재실행, `begin … commit` 으로 감싼 대시보드식 단일 트랜잭션). 세 번 모두 ERROR 0건, 2회차는 NOTICE(skip)만 남겼다. 사후 상태도 설계와 일치한다: cron 잡 정확히 3개(`spin-lunch-roulette * * * * *`, `reset-candidates 0 15`, `purge-cron-history 30 15`), 정책 9+1건, publication 에 `candidates·restaurants·results·settings`, 인덱스 중복 없음, `settings` 1행(`11:55:00 / 0 / KST 오늘`), `results_restaurant_id_fkey … ON DELETE SET NULL`, 새 테이블 3개 RLS 활성, `menus`·`pinned_menus` 소멸. `anon` 으로 `settings` UPDATE/DELETE 는 0행, INSERT 는 RLS 위반 ERROR — SETT-01 이 실제로 성립한다. 저장된 cron command 세 건을 그대로 `execute` 해도 파싱·실행된다(`$cmd$` 안 `--` 주석·세미콜론 포함). `npx vitest run` 83/83, `npx tsc --noEmit`·eslint 는 출력 없음(통과). 마이그레이션 스펙은 tsconfig(`**/*.ts`)·eslint 범위 안에 있어 CLAUDE.md 가 말하는 `supabase/functions/` 사각지대에 해당하지 않는다.

Critical 은 없다. 그러나 드라이런이 드러낸 실질 결함이 두 건 있다: (1) 자정 재시드가 핀 매장 전부에 **동일한 `created_at`** 을 부여해 "담은 순서" 정렬이 무의미해진다(WR-02, 실측 ties=3), (2) `restaurants.location`·`menus` 에 **아무 상한이 없고** `name` 은 공백만으로도 통과한다(WR-03, 실측 100,000자 location·1,000원소 menus 삽입 성공). 그리고 파일 머리의 "적용 직후 동작은 지금과 똑같다" 는 **코드 배포가 끝난 뒤에만** 참이다 — Phase 8 체크리스트는 SQL 을 먼저 돌리므로 그 사이 라이브(`menus` 를 읽는 현재 앱·Edge Function 2종)가 깨진다(WR-01). 스펙 쪽은 "이 페이즈 최대 보안 리스크" 회귀 가드(#13)에 `for all` 구멍이 있다(WR-04, 뮤테이션으로 확인).

## Narrative Findings (AI reviewer)

아래는 직접 낭독·드라이런·뮤테이션 검사로 얻은 소견이다. 구조적(fallow) 사전 분석은 제공되지 않았다.

## Warnings

### WR-01: "동작 불변" 헤더 주장은 코드 배포를 전제로만 참이다 — Phase 8 순서대로면 SQL 직후 라이브가 깨진다

**File:** `supabase/migrations/0005_restaurants_settings.sql:2-3`, `:117`, `:153-154`
**Issue:** 2행은 "이 파일을 적용한 직후의 동작은 지금과 똑같다" 고 단언하지만, 154행이 `menus` 를 떨구는 순간 현재 배포된 코드는 전부 그 테이블을 읽는다 — `app/page.tsx:48,50,169,180,192,198`(`menus`·`pinned_menus`), `supabase/functions/spin-roulette/index.ts:79`, `supabase/functions/respin-roulette/index.ts:78`. 게다가 117행이 `spin-lunch-roulette` 를 매분 폴링으로 바꾸는데, **현재** 함수의 가드는 `isAfterSpinTime` 즉 `>= 11:55` 이고 `settings.spin_time` 을 읽지 않는다(117행 주석 "시각 판정은 Edge Function 이 settings.spin_time 으로 한다" 는 Phase 4 이후에만 사실). ROADMAP Phase 8 체크리스트 3번은 "마이그레이션 → Edge Function deploy → PR 머지(Vercel)" 순서라 SQL 과 코드 사이에 필연적 공백이 있고, 그동안 (a) 페이지 초기 로드가 `menus` 42P01 로 실패하고, (b) 11:55 이후 결과가 아직 없으면 매분 `spin-roulette` 가 500 을 내며 `net._http_response` 를 채우고, (c) 그날 추첨이 통째로 빠질 수 있다. SQL 자체의 결함은 아니지만, 이 파일이 Phase 8 에서 사용자가 읽는 유일한 실행 문서이므로 잘못된 안심을 준다.
**Fix:** 헤더 주장을 조건부로 고치고 창을 최소화하는 시점을 명시한다.
```sql
-- 동작 불변 원칙: Phase 4·6·7 코드(candidates·settings 를 읽는 앱·Edge Function 2종)가 배포된 상태에서
-- 이 파일을 적용하면 기본값(11:55, 쿨다운 0) 덕에 동작이 지금과 같다. 동작 변경은 settings UPDATE 로만 한다.
-- 전제 경고: 154행이 menus 를 떨구므로 SQL 적용 ~ 새 코드 배포 사이에는 라이브가 깨진다(구 앱·구 함수 전부 menus 를 읽는다).
-- 권장 적용 시각: 그날 results 행이 이미 확정된 뒤(11:55 이후) — 매분 폴링이 멱등 skip 으로 떨어져 추첨을 잃지 않는다.
```
Phase 8 체크리스트에도 같은 창(SQL→deploy→merge 를 한 세션에 연속 수행, 11:55 전후 회피)을 항목으로 넣을 것.

### WR-02: 자정 재시드가 핀 매장 전부에 같은 `created_at` 을 부여해 "담은 순서" 정렬이 무너진다

**File:** `supabase/migrations/0005_restaurants_settings.sql:135-137` (관련 주석 `:30-31`)
**Issue:** `insert into public.candidates (restaurant_id) select id from public.restaurants where pinned order by created_at` 에서 `order by` 는 삽입 순서만 정할 뿐, `candidates.created_at` 은 컬럼 기본값 `now()` — **트랜잭션 시작 시각** — 으로 채워져 한 문에서 들어간 행 전부가 동일 값을 갖는다. 드라이런 실측: 핀 매장 3개(그중 하나는 1초 뒤 등록) 재시드 후 `count(*) over (partition by created_at)` = 3. 30행 주석이 약속한 "담은 순서대로 보여 주는 목록" 은 자정 직후 핀 매장 사이에서 성립하지 않고, `order by created_at` 만 쓰는 목록 쿼리는 힙 물리 순서에 의존해 새로고침·VACUUM 뒤 순서가 바뀔 수 있다. `restaurants.created_at` 이 동률이면 `restaurants` 쪽 정렬도 같은 문제를 갖는다. 0004 의 `menus` 재시드도 같은 결함이 있었으나 그때는 이름 PK 로 tie-break 가 가능했고, 지금 `candidates` 의 유일한 다른 컬럼은 무작위 uuid 다.
**Fix:** 재시드 시 순번을 시각에 실어 결정적 순서를 만든다(D-02 원문에서 문면이 달라지므로 사용자 확인 필요; 스펙 #20 정규식도 함께 갱신).
```sql
  delete from public.candidates;
  insert into public.candidates (restaurant_id, created_at)
  select id, now() + (row_number() over (order by created_at, id)) * interval '1 microsecond'
  from public.restaurants where pinned;
```
`clock_timestamp()` 로 대체하는 것은 답이 아니다 — 휘발성 함수는 Sort 노드 아래에서 스캔 순서로 평가돼 정렬 순서를 보장하지 않는다.

### WR-03: `restaurants` 의 자유 텍스트 컬럼에 상한이 없고 `name` 은 공백만으로 통과한다

**File:** `supabase/migrations/0005_restaurants_settings.sql:12-14`
**Issue:** 이 페이즈의 보안 원칙(RESEARCH §Security V5: "DB check 제약이 정본, 클라이언트 검증은 보조")에 따르면 anon 이 PostgREST 로 직접 쓸 수 있는 모든 컬럼은 DB 가 경계를 잡아야 한다. 실측(anon 롤): `name = '   '` 삽입 성공, `location` 100,000자 삽입 성공, `menus` 1,000원소×1,000자 삽입 성공. 세 테이블이 모두 Realtime publication 에 있으므로 이런 행 하나가 열린 탭 전부에 브로드캐스트되고 목록 쿼리마다 실려 온다. 구 모델이 `name` 을 24자로 묶은 이유가 정확히 이것이었는데 새로 생긴 두 자유 텍스트 컬럼은 무제한이다. `location` 은 D-01 이 "한 줄" 이라고 정의하지만 개행도 막지 않는다.
**Fix:** D-01 컬럼 정의에 인라인 check 를 추가한다(사용자 승인 항목이므로 변경 전 확인; 재실행 안전을 위해 반드시 `create table` 안에 둔다). check 제약은 서브쿼리를 허용하지 않으므로 원소 길이 검사는 immutable 함수로 뺀다 — `create or replace` 라 재실행 안전하다.
```sql
-- restaurants 보다 앞에 둔다
create or replace function public.text_array_max_len(arr text[]) returns int
language sql immutable strict as $$ select coalesce(max(char_length(m)), 0) from unnest(arr) m $$;

  name text not null unique check (char_length(name) between 1 and 24 and name = btrim(name)),
  menus text[] not null default '{}'
    check (cardinality(menus) <= 30 and array_position(menus, '') is null and public.text_array_max_len(menus) <= 24),
  location text check (location is null or (char_length(location) between 1 and 60 and position(E'\n' in location) = 0)),
```
상한 숫자(30·24·60)는 제안값이다. 스펙 #14(`name text not null unique\b` 는 그대로 매치)·#46(`menus text\[\] not null default '\{\}'` 는 그대로 매치)은 영향이 없고, `tableColumns` 파서는 첫 토큰만 보므로 다중 행 check 도 컬럼 목록을 깨지 않는다 — 단 `create or replace function` 행이 `create table` 카운트(#2)에 잡히지 않는지만 확인할 것(잡히지 않는다).

### WR-04: settings 쓰기 정책 회귀 가드(#13)가 `for all`·`for` 절 생략을 놓친다

**File:** `supabase/migrations/0005_restaurants_settings.test.ts:165-168`
**Issue:** 정규식 `/on public\.settings for (insert|update|delete)/g` 는 명시적 세 동사만 잡는다. 뮤테이션 검사 결과: `create policy settings_write on public.settings for all using (true) with check (true)` 와 `create policy settings_write on public.settings using (true) with check (true)`(생략 시 기본 ALL) 둘 다 **#13 카운트 0 으로 통과**한다. 지금은 #4 의 `[9, 9]` 가 우연히 막아 주지만, 정책을 추가한 사람이 #4 를 `[10, 10]` 으로 "고치면" 이 페이즈 최대 보안 리스크가 초록불로 지나간다. 166행 주석이 이 테스트를 회귀 가드라고 부르는 만큼 자기 완결적이어야 한다.
**Fix:**
```ts
it("settings 에 쓰기 정책이 0건이다 (#13)", () => {
  // for 절 생략 = ALL, for all 도 쓰기다. 정책 총수를 1로 못 박아야 #4 와 무관하게 성립한다.
  expect(count(sql, /create policy [a-z_]+ on public\.settings\b/g)).toBe(1);
  expect(count(sql, /on public\.settings for (insert|update|delete|all)\b/g)).toBe(0);
  expect(count(sql, /on public\.settings\s+(using|with check)/g)).toBe(0);
});
```

## Info

### IN-01: cron 본문 안의 한글 주석이 `cron.job.command` 와 매분 `job_run_details` 행에 그대로 저장된다

**File:** `supabase/migrations/0005_restaurants_settings.sql:120`, `:124`
**Issue:** `$cmd$ … $cmd$` 내부의 `-- URL 의 프로젝트 ref …`, `-- pg_net 기본값 …` 는 SQL 문자열의 일부라 잡 command 에 남고, `cron.job_run_details.command` 에 하루 1,440번 복제된다(RESEARCH Pitfall 8 의 용량 추정에 약 +120바이트/행). 실행에는 지장 없음(드라이런 확인).
**Fix:** 두 주석을 `select cron.schedule(` 위 줄로 옮기고 본문은 순수 SQL 만 남긴다.

### IN-02: 스펙 #6 의 `^alter publication` 은 들여쓴 맨 alter 문을 놓친다

**File:** `supabase/migrations/0005_restaurants_settings.test.ts:116`
**Issue:** 뮤테이션 검사: 가드를 지우고 `  alter publication supabase_realtime add table public.restaurants;` 를 들여써 넣어도 `/^alter publication/gm` 카운트는 0 이다(#43 이 `array[` 부재로 대신 잡아 주긴 한다).
**Fix:** `/^\s*alter publication/gm` 으로 바꾸고, 가드 블록 안의 `execute format(` 문자열은 `'alter publication` 으로 시작해 여전히 매치되지 않음을 주석으로 남긴다.

### IN-03: 스펙이 unschedule 목록에 새 잡 이름 두 개가 있는지, 그리고 unschedule 블록이 drop 보다 앞인지 못 박지 않는다

**File:** `supabase/migrations/0005_restaurants_settings.test.ts:109` (SQL), `:145-153`, `:203-205`
**Issue:** #21 은 `'reset-menus'` 만 검사한다. `'reset-candidates'`·`'purge-cron-history'` 가 109행 목록에서 빠지면 2회차 실행이 같은 이름의 잡을 하나 더 만드는데 어떤 테스트도 실패하지 않는다. #10 의 `lastSetup` 도 `cron.unschedule` 블록·`alter table`·`insert into`·publication 가드를 포함하지 않아 "drop 이 마지막" 을 부분적으로만 증명한다.
**Fix:** `expect(/jobname in \(([^)]*)\)/.exec(sql)?.[1]).toContain(…)` 형태로 네 이름 전부를 단언하고, #10 의 `Math.max(...)` 에 `sql.lastIndexOf("perform cron.unschedule")`, `sql.lastIndexOf("alter table")`, `sql.lastIndexOf("insert into")`, `sql.lastIndexOf("pg_publication_tables")` 를 추가한다.

### IN-04: `clientSrc` 로드 실패가 "필드 불일치" 로 위장되고, `typeFields` 가 TS 필드명을 SQL 제약 키워드로 거른다

**File:** `supabase/migrations/0005_restaurants_settings.test.ts:79`, `:67`
**Issue:** `readOrEmpty` 는 `lib/supabase/client.ts` 경로가 틀려도 `""` 를 돌려주고, 그러면 #36·#38·#40·#41 이 `[]` 대 기대 배열로 실패해 원인을 감춘다(SQL 쪽은 #1 이 있지만 TS 쪽은 없다). 67행의 `!CONSTRAINT_KEYWORDS.includes(name)` 은 `tableColumns` 에서 복사된 흔적으로, TS 타입에 `check`·`unique` 같은 필드가 생기면 소리 없이 누락된다.
**Fix:** `it("client.ts 를 읽었다", () => expect(clientSrc.length).toBeGreaterThan(0))` 를 추가하고, 67행의 키워드 필터는 제거한다.

### IN-05: `history_since` 는 적용 시각이 11:55 이후면 그날의 구 모델 결과를 "매장 기록" 에 포함한다

**File:** `supabase/migrations/0005_restaurants_settings.sql:39`
**Issue:** 기본값이 KST 오늘이므로 적용일 D 에 이미 확정된 `results(date = D, restaurant_id = null)` 가 `date >= history_since` 필터를 통과한다. WR-01 의 "결과 확정 후 적용" 권고와 정면으로 겹치는 지점이다.
**Fix:** Phase 6·7 의 기록·랭킹 쿼리가 `restaurant_id is null` 행을 어떻게 다룰지 결정하거나, Phase 8 절차에 "적용 직후 `update settings set history_since = history_since + 1 where id = 1`(당일 결과 제외)" 을 선택 항목으로 적는다.

### IN-06: 대시보드 SQL Editor 는 스크립트 전체를 한 트랜잭션으로 보낸다 — 4행 주석·RESEARCH Pitfall 1 의 "앞부분은 이미 커밋" 전제가 어긋난다

**File:** `supabase/migrations/0005_restaurants_settings.sql:4`
**Issue:** pg-meta 의 `/query` 는 스크립트를 단순 쿼리 프로토콜 한 메시지로 보내고, PostgreSQL 은 명시적 `begin/commit` 이 없는 다중 문 메시지를 단일 트랜잭션으로 실행한다. 드라이런에서 `begin; <파일>; commit;` 도 무오류였다. 재실행 안전 설계는 그대로 유효하지만(오히려 유리), Phase 8 롤백 문서가 "중간까지 적용된 상태" 를 가정하면 실제와 다르다.
**Fix:** 4행을 "대시보드는 전체를 한 트랜잭션으로 돌리므로 중간 실패 시 전부 롤백된다. 그래도 모든 문을 재실행 안전형으로 쓴다(수동 부분 실행 대비)" 로 고친다.

---

_Reviewed: 2026-09-21T00:32:52Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
