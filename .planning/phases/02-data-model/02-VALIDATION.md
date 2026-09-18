---
phase: 2
slug: data-model
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `02-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (Phase 1 산출물, 정확 고정) |
| **Config file** | `vitest.config.mts` — Wave 0에서 `include`에 `"supabase/migrations/**/*.test.ts"` 한 줄 추가 (`exclude` 무변경) |
| **Quick run command** | `npx vitest run supabase/migrations` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1초 (계약 테스트는 파일 파싱만) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/migrations` (+ 타입을 건드렸으면 `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit && npm run lint && npm test && npm run build` 전부 green
- **Max feedback latency:** 10 seconds (페이즈 게이트의 `npm run build` 는 지연 예산 예외)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-02 T2 | 02-02 | 2 | SHIP-01 | — | 모든 문 멱등: 무명 `create index` 0, 맨 `alter publication add table` 0, `create policy` 앞 `drop policy if exists`, `cron.unschedule('문자열')` 0 | contract | `npx vitest run supabase/migrations` | ✓ | ✅ green |
| 02-02 T2 | 02-02 | 2 | SHIP-01 | — | 구 테이블 `drop table`이 파일 마지막 | contract | 〃 | ✓ | ✅ green |
| 02-02 T2 | 02-02 | 2 | SETT-01 | T-02-03 · T-02-04 | `settings` RLS enable + select 정책 1 · 쓰기 정책 0 (정책 0건 = 기본 거부) | contract | 〃 | ✓ | ✅ green |
| 02-02 T3 | 02-02 | 2 | SETT-01 | — | `SettingsRow` 필드 == SQL 컬럼 목록 | contract + static | 〃 + `npx tsc --noEmit` | ✓ | ✅ green |
| 02-02 T2 | 02-02 | 2 | CATL-07 | — | `restaurants.name` unique + `char_length between 1 and 24` | contract | 〃 | ✓ | ✅ green |
| 02-02 T2 | 02-02 | 2 | CAND-04 | — | `truncate` 0건, `reset-candidates` 본문에 `delete from public.candidates` + 핀 재시드 | contract | 〃 | ✓ | ✅ green |
| 02-02 T2 | 02-02 | 2 | HIST-03 | T-02-06 | `results` 등장은 `add column if not exists`·정책·주석뿐; delete/update/drop 0건 | contract | 〃 | ✓ | ✅ green |
| 02-02 T3 | 02-02 | 2 | D-13 | — | 4개 행 타입 필드 집합 == SQL 컬럼 목록 (이름 대조) | contract | 〃 | ✓ | ✅ green |

*Status 범례: ⬜ = pending · ✅ = green · ❌ = red · ⚠️ = flaky*

**Task ID 열 읽는 법:** 각 행을 실제로 초록으로 만든 태스크를 적었다 — `02-02 T2`(SQL GREEN, 커밋 `718e8a4`) · `02-02 T3`(행 타입 GREEN, 커밋 `5542453`). 모든 행의 **단언 자체**는 `02-02 T1`(RED 스펙, 커밋 `c2e8ad1`)이 먼저 빨갛게 세웠고(42 failed / 5 passed), Automated Command 가 스펙을 **수집**할 수 있는 것은 `02-01 T1`(`vitest.config.mts` include 한 줄, 커밋 `bf930f2`, Wave 1) 덕분이다. 즉 8행 전부의 전제 웨이브는 1, 초록 전환 웨이브는 2다.

---

## Wave 0 Requirements

- [x] `supabase/migrations/0005_restaurants_settings.test.ts` — SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03·D-13 계약 테스트 (SQL 파일 텍스트 파싱, `--` 주석 제거 사본과 원본 둘 다 보유, 기대값은 리터럴, `lib/supabase/client.ts`는 import 하지 않고 소스 텍스트 파싱) — 02-02 T1, 커밋 `c2e8ad1`, it #1~#47
- [x] `vitest.config.mts` `include`에 `"supabase/migrations/**/*.test.ts"` 추가 — 02-01 T1, 커밋 `bf930f2` (`exclude` 무변경)
- 프레임워크 설치: 불필요 / 공용 픽스처: 불필요

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 마이그레이션 낭독 리뷰 11항목 | SHIP-01 | 로컬 Supabase 스택 없음, SQL 실행 불가 | RESEARCH §Validation Architecture 체크리스트 1~8 + 02-03 PLAN 추가 9~11 (publication 대상 3개·D-01/D-02 컬럼 문자 대조·drop/create policy 쌍 1:1) |
| 실제 적용 후 동작 | SHIP-01 | 라이브 적용은 Phase 8(사용자, 대시보드) | Phase 8 체크리스트. 선택: Docker `postgres:17-alpine` 드라이런(D-15) |

---

## 낭독 리뷰 기록 (11항목)

> 수행: 2026-09-18, 02-03 Task 1. 대상: `supabase/migrations/0005_restaurants_settings.sql` (154줄) 전문을 처음부터 끝까지 읽음(부분 grep 대체 아님).
> 줄 번호는 모두 그 파일 기준이다.

| # | 항목 | 확인 결과 | 근거(파일:줄 또는 인용 문구) |
|---|------|-----------|------------------------------|
| 1 | 파일 머리 블록 주석에 "동작 불변 원칙"이 있는가 | 통과 | `:2` — "동작 불변 원칙: 이 파일을 적용한 직후의 동작은 지금과 똑같다(11:55 추첨, 쿨다운 없음). 동작 변경은 settings UPDATE 로만 한다." |
| 2 | 프로젝트 ref 가 URL 에 있고 "다른 프로젝트면 치환" 주석이 붙어 있는가 | 통과 | `:120` 주석 — "URL 의 프로젝트 ref swxiqytyxjlcgubqlozk 는 하드코딩이다(0002 선례). 다른 프로젝트로 옮기면 치환할 것." / `:121` `url := 'https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette'` |
| 3 | 자정계 cron 2잡 옆에 KST↔UTC 계산식 인라인 주석이 있는가 | 통과 | `:133` `'0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일)` · `:144` `'30 15 * * *',  -- KST 00:30 = UTC 15:30 (전일)` — 두 잡 모두 같은 형태의 계산식을 갖는다 |
| 4 | `spin_time`·`cooldown_days`·`history_since` 기본값이 D-03 과 문자 단위로 일치하는가 | 통과 | `:37` `spin_time time not null default '11:55'` · `:38` `cooldown_days int not null default 0 check (cooldown_days >= 0)` · `:39` `history_since date not null default ((now() at time zone 'Asia/Seoul')::date)` — 3건 모두 D-03 원문과 문자 단위 동일. 대조 상세는 아래 §항목 4 |
| 5 | `on delete cascade`(candidates) 와 `on delete set null`(results) 의 방향이 뒤바뀌지 않았는가 | 통과 | `:26` `restaurant_id uuid primary key references public.restaurants(id) on delete cascade` (candidates → restaurants) · `:55` `alter table public.results add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null` (results → restaurants). 방향 정상 — 매장 삭제는 오늘 후보만 지우고 과거 `results` 행은 `restaurant_id` 만 null 로 남긴다(HIST-03 보존). 대조 상세는 아래 §항목 5 |
| 6 | `results` 관련 문이 `add column if not exists` 하나뿐인가 | 통과 | 직접 읽어 확인 + 교차 확인 `grep -n 'results' …` 4건 → **실행문 1건**: `:55` `alter table public.results add column if not exists restaurant_id …`. 나머지 3건은 테이블 참조가 아니다 — `:49` 는 `comment on column public.settings.history_since is '… results 만 기록·랭킹에 집계한다'` 의 **문자열 리터럴 안 단어**, `:51`·`:82` 는 `--` 주석 줄 |
| 7 | `drop table` 두 줄이 파일 맨 끝인가 | 통과 | `tail -5` → `-- 8. 구 테이블 제거 …` / `-- 여기서 테이블을 떨구면 …` / `-- 이 두 줄이 파일의 마지막 문이다 …` / `drop table if exists public.pinned_menus;` (`:153`) / `drop table if exists public.menus;` (`:154`). 뒤에 오는 실행문 없음 |
| 8 | Pitfall 6(매장 삭제 → `results` UPDATE → 휠 재회전, 가드는 Phase 6)이 주석으로 남았는가 | 통과 | `:53-54` — "on delete set null 주의: 매장 삭제가 여기에 UPDATE 를 내보내고, 그 Realtime 이벤트를 app/page.tsx 의 결과 구독이 새 결과로 오인하면 휠이 재회전한다. 가드는 Phase 6 소관이고 이 파일은 사실만 남긴다." |
| 9 | publication 가드의 대상 배열에 세 이름이 전부 있는가 | 통과 | `:92` `foreach t in array array['restaurants', 'candidates', 'settings'] loop` — 육안으로 하나씩: `restaurants` ✓ · `candidates` ✓ · `settings` ✓ (3/3). 가드는 `:93-96` `pg_publication_tables` 존재 검사, 추가는 `:97` `execute format('alter publication supabase_realtime add table public.%I', t)`. D-07 대로 `results` 는 이미 등록돼 있어 목록에 없다 |
| 10 | `restaurants`·`candidates` 컬럼 정의가 D-01·D-02 원문과 문자 단위로 같은가 | 통과 | `restaurants` 6컬럼 `:11-16`(`id uuid primary key default gen_random_uuid()` 포함) + `candidates` 2컬럼 `:26-27` = 8/8 일치. 표기 차이 2건은 CONTEXT 쪽 약칭이라 의미 동일(D-01 "pk" → SQL `primary key`, D-02 `restaurants(id)` → SQL `public.restaurants(id)`). 대조 상세는 아래 §항목 10 |
| 11 | `drop policy if exists` 와 `create policy` 의 (테이블, 이름) 쌍이 1:1 인가 | 통과 | `drop policy if exists` 9건(`:64,66,68,70,73,75,77,79,84`) · `create policy` 9건(`:65,67,69,71,74,76,78,80,85`) — 매 drop 바로 다음 줄이 같은 (테이블, 이름) 의 create 다. 이름별 확인: `restaurants_read/insert/update/delete`(4) · `candidates_read/insert/update/delete`(4) · `settings_read`(1). 중복 이름 0건, 짝 없는 drop·create 0건 → 2회차 실행도 `policy already exists` 없이 통과한다 |

### 항목 4 — settings 기본값 3건 문자 단위 대조

| 컬럼 | CONTEXT D-03 원문 | `0005…sql` | 판정 |
|------|-------------------|------------|------|
| `spin_time` | `spin_time time not null default '11:55'` | `:37` `spin_time time not null default '11:55'` | 문자 동일 |
| `cooldown_days` | `cooldown_days int not null default 0 check (cooldown_days >= 0)` | `:38` `cooldown_days int not null default 0 check (cooldown_days >= 0)` | 문자 동일 |
| `history_since` | `history_since date not null default ((now() at time zone 'Asia/Seoul')::date)` | `:39` `history_since date not null default ((now() at time zone 'Asia/Seoul')::date)` | 문자 동일 |
| `id` (단일행 강제) | `id int primary key check (id = 1)` | `:36` `id int primary key check (id = 1)` | 문자 동일 |

D-05(적용 직후 동작 = 현재와 동일) 성립: `'11:55'` 추첨 · 쿨다운 0(끔) · 전환일 = 적용일(KST). 시드는 `:44` `insert into public.settings (id) values (1) on conflict (id) do nothing;` 이므로 재실행이 대시보드 수정값을 덮지 않고, `history_since` 도 최초 insert 시점에 한 번만 평가된다.

### 항목 5 — 참조 동작 방향 대조

| 관계 | 인용 | 매장 삭제 시 결과 |
|------|------|-------------------|
| `candidates.restaurant_id` → `restaurants.id` | `:26` `restaurant_id uuid primary key references public.restaurants(id) on delete cascade` | 오늘 후보 행이 함께 지워진다(의도 — D-02) |
| `results.restaurant_id` → `restaurants.id` | `:55` `alter table public.results add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;` | 과거 결과 행은 남고 `restaurant_id` 만 null 이 된다. `menu` 문자열 스냅샷이 남아 기록·랭킹이 유지된다(D-04 / HIST-03) |

두 방향이 뒤바뀌면 매장 삭제가 과거 `results` 행을 통째로 지워 HIST-03 이 파괴된다. 계약 테스트는 두 문장의 **형태**만 보므로(각 정규식이 자기 문장 1건씩), "두 절이 서로 반대 테이블에 붙었는지"를 판정하는 것은 이 항목이다.

### 항목 10 — D-01·D-02 컬럼 8건 문자 단위 대조

| # | CONTEXT 원문 | `0005…sql` | 판정 |
|---|--------------|------------|------|
| 1 | D-01 `id uuid pk default gen_random_uuid()` | `:11` `id uuid primary key default gen_random_uuid()` | 일치(CONTEXT 의 "pk" 는 약칭) |
| 2 | D-01 `name text not null unique check (char_length(name) between 1 and 24)` | `:12` 동일 | 문자 동일 |
| 3 | D-01 `menus text[] not null default '{}'` | `:13` 동일 | 문자 동일 |
| 4 | D-01 `location text` (null 허용) | `:14` `location text` | 문자 동일 (not null·기본값 없음 = null 허용) |
| 5 | D-01 `pinned boolean not null default false` | `:15` 동일 | 문자 동일 |
| 6 | D-01 `created_at timestamptz not null default now()` | `:16` 동일 | 문자 동일 |
| 7 | D-02 `restaurant_id uuid primary key references restaurants(id) on delete cascade` | `:26` `… references public.restaurants(id) on delete cascade` | 일치(SQL 이 스키마를 명시) |
| 8 | D-02 `created_at timestamptz not null default now()` | `:27` 동일 | 문자 동일 |

계약 테스트가 리터럴로 덮는 것은 이 8줄 중 3줄뿐이다(#45 `id`, #46 `menus`, #47 `candidates.restaurant_id`). 따라서 **`location text`(null 허용) · `pinned boolean not null default false` · `created_at timestamptz not null default now()` ×2 는 이 항목이 유일한 검증 지점**이다.

### 자동 검사와 사람 검사의 경계

이 11항목 중 **1·2·3·6·7·8·9·10·11 은 계약 테스트가 형태 수준에서 이미 검사하고 있다**(항목 순서대로 it #33 · #32 · #34 · #23 · #10 · #26 · #43 · #45~#47 · #4). **4·5 는 사람만 잡을 수 있는 의미 항목**이고, 10번은 자동 검사가 8줄 중 3줄만 덮는 **부분 항목**이다.

정직성 보충(T-02-11): 항목 4 와 인접한 자동 검사가 아예 없는 것은 아니다 — it #27·#28·#29·#44 가 같은 네 줄을 **스펙 안에 적힌 리터럴 정규식**으로 검사한다. 다만 그 기대값은 스펙 작성자가 옮겨 적은 것이라 CONTEXT D-03 원문과의 대조는 자동화돼 있지 않다(스펙과 SQL 이 같은 오타를 공유하면 둘 다 초록이다). 항목 5 도 it #47(cascade 절)·#24(`add column` 문)가 각 문장의 형태를 따로 보지만, **두 절이 올바른 쪽 테이블에 붙었는지**를 판정하는 단언은 없다. 그 판정이 이 낭독 리뷰의 존재 이유다.

**불통과 항목: 0건.** 11/11 통과. SQL·스펙·타입 파일은 이 리뷰 과정에서 한 줄도 수정하지 않았다.

---

## Phase Gate 기록

> 실행: 2026-09-18, 02-03 Task 2. 커밋 `1a22ef3`(낭독 리뷰 기록) 직후의 워킹트리 상태에서 측정했다.

| # | 명령 | Exit | 출력 요약 |
|---|------|------|-----------|
| 1 | `npx vitest run supabase/migrations` | 0 | `Test Files 1 passed (1)` · `Tests 47 passed (47)` · Duration 76ms |
| 2 | `npm test` | 0 | `Test Files 5 passed (5)` · `Tests 83 passed (83)` · Duration 121ms |
| 3 | `npx tsc --noEmit` | 0 | 출력 0바이트 |
| 4 | `npm run lint` | 0 | eslint 출력 0줄 — **신규 에러 0건**. (CLAUDE.md 가 2026-09-15 기준으로 적어 둔 `components/Wheel.tsx` `react-hooks/set-state-in-effect` 1건도 현재 출력에 없다. 이 페이즈는 `components/**` 를 건드리지 않았으므로 Phase 1 이후 이미 해소된 상태를 그대로 확인한 것이다.) |
| 5 | `npm run build` | 0 | Next.js 16.3.5 (Turbopack) · `- Environments: .env.local` · `✓ Compiled successfully in 333ms` · `Finished TypeScript in 489ms` · `✓ Generating static pages using 7 workers (6/6)` · 라우트 4개(`/` · `/_not-found` · `/log` · `/rank`) 전부 `○ (Static)` |
| 6 | `npm audit` | 0 | `found 0 vulnerabilities` — `{"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}`. Phase 1 이 만든 "critical·high 0" 상태가 유지됐다. 이 페이즈는 패키지를 설치하지 않았고 `package.json`·`package-lock.json` 은 무변경이다(T-02-SC) |

**`npm run build` 는 `02-VALIDATION.md` 의 10초 지연 예산을 넘는다 — 페이즈 게이트는 지연 예산의 예외다**(태스크 단위 피드백 루프가 아니라 페이즈를 닫는 최종 관문이라 페이즈당 한 번만 돈다). 다음 페이즈는 이 실행을 "예산 위반"으로 읽지 않는다. 태스크 단위 루프는 여전히 #1(76ms)·#3 으로 돈다.

### 라이브 무접촉 증거

| # | 명령 | 출력 | 의미 |
|---|------|------|------|
| 1 | `git diff --name-only main...HEAD -- supabase` | `supabase/migrations/0005_restaurants_settings.sql`<br>`supabase/migrations/0005_restaurants_settings.test.ts` | **두 줄뿐.** Edge Function(`supabase/functions/**`)·기존 마이그레이션 0001~0004 는 한 글자도 바뀌지 않았다 |
| 2 | `command -v supabase \|\| echo NOT INSTALLED` | `NOT INSTALLED` | supabase CLI 가 없어 `supabase db push` · `supabase functions deploy` 가 **실행될 수 없었다**. RESEARCH §Environment Availability 실측과 일치 |
| 3 | `git log $(git merge-base main HEAD)..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | `0` | 브랜치 전체 커밋 메시지에 AI 표기 0건 |

마이그레이션 **적용**과 **롤백 SQL 문서화**는 Phase 8 소관이며(D-12 / SHIP-02), 이 페이즈는 파일만 썼다 — 라이브 Supabase DB·Edge Function·`main` 브랜치는 무접촉이다(T-02-10 · T-02-LIVE).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
