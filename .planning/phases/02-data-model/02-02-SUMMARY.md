---
phase: 02-data-model
plan: 02
subsystem: data
tags: [migration, sql, rls, realtime, pg_cron, contract-test, vitest, supabase, types]

# Dependency graph
requires:
  - phase: 02-01
    provides: "vitest.config.mts include 에 supabase/migrations/**/*.test.ts — 계약 스펙이 러너에 수집되는 전제"
  - phase: 01-03
    provides: "vitest 4.1.11 + globals:false 명시 import 규약, 리터럴 기대값 컨벤션"
provides:
  - "supabase/migrations/0005_restaurants_settings.sql — restaurants·candidates·settings 생성, RLS 9정책, publication 3건 가드, cron 3잡 교체, results.restaurant_id 추가, 구 테이블 제거까지 담은 재실행 가능 컷오버 1파일 (미적용 — Phase 8 에서 사용자가 대시보드로 1회 실행)"
  - "supabase/migrations/0005_restaurants_settings.test.ts — SQL·TS 를 텍스트로 파싱하는 계약 테스트 47건(#1~#47 고정 번호). 02-03 낭독 리뷰 항목 1·2·3·8·11 의 자동화판"
  - "lib/supabase/client.ts RestaurantRow·CandidateRow·SettingsRow + ResultRow.restaurant_id — Phase 3·5·6 이 import 할 행 타입"
affects: [02-03, 03-settings-phase, 04-edge-function, 05-restaurant-ui, 06-page-cutover, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "실행할 수 없는 산출물(로컬 스택 없는 마이그레이션 SQL)의 grep 체크리스트를 사람 기억이 아니라 vitest 계약 테스트로 굳힌다 — 기대값은 리터럴, 검사 대상은 파일 텍스트"
    - "SQL 문 개수를 세는 단언은 반드시 주석 제거 사본에서 센다. 한글 Why 주석에 'create policy' 같은 토큰이 섞이면 원본 grep 은 자기 자신을 세어 게이트가 무력화된다"
    - "정책 멱등성은 개수가 아니라 (테이블, 정책이름) 쌍 집합 동치로 검사한다 — 개수만 맞고 이름이 어긋난 파일은 2회차 실행에서 policy already exists 로 끊긴다"
    - "재실행 안전형 SQL 3종 세트: 이름 있는 create index if not exists · pg_publication_tables 가드 안의 execute format(%I) · jobid 루프 unschedule → schedule"

key-files:
  created:
    - supabase/migrations/0005_restaurants_settings.sql
    - supabase/migrations/0005_restaurants_settings.test.ts
    - .planning/phases/02-data-model/02-02-SUMMARY.md
  modified:
    - lib/supabase/client.ts

key-decisions:
  - "정책 줄의 이름 정렬 패딩(0001·0004 의 습관)을 버리고 단일 공백으로 썼다 — 인수 조건의 이름 쌍 1:1 검사가 'drop policy if exists <이름> on public.<테이블>' 단일 공백 정규식이라, 정렬 공백을 넣으면 9개 중 하나도 매치되지 않는다. 가독성보다 멱등성 게이트가 우선이다"
  - "publication 가드를 테이블별 do 블록 3개가 아니라 배열 루프 1개로 썼다 — 대상 목록이 한 줄 리터럴 배열이어야 계약 테스트 #43 이 '세 이름이 전부 있는가'를 집합 비교로 검사할 수 있다"
  - "cron 본문 안의 URL 위에 치환 주석을 한 줄 넣었다(프로젝트 ref 하드코딩은 0002 선례 유지). ref 는 시크릿이 아니라 이식 사고 방지용 표식이다"
  - "REFACTOR 커밋을 만들지 않았다 — RED 스펙과 GREEN SQL 이 첫 작성에서 인수 조건을 모두 통과했고 정리할 중복이 없었다 (빈 커밋 금지)"

# SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03 을 완료로 올리지 않는다.
# 파일은 이 플랜이 만들었지만 이 페이즈의 검증 정본은 02-03 의 낭독 리뷰 11항목 + 사용자 승인이다.
# 02-01 이 같은 이유로 SHIP-01 마킹을 되돌렸고(02-01-SUMMARY Deviations 1), 마킹 주체는 02-03 하나로 유지한다.
requirements-completed: []

# Metrics
duration: 8min
completed: 2026-09-18
---

# Phase 2 Plan 02: 0005 컷오버 마이그레이션 + 행 타입 Summary

**계약 테스트 47건을 먼저 빨갛게 세운 뒤(42 failed / 5 passed) `0005_restaurants_settings.sql` 과 `lib/supabase/client.ts` 행 타입으로 전부 초록으로 만들었다 — 로컬에서 실행할 수 없는 SQL 의 재실행 안전성·RLS·`results` 무접촉을 사람 기억이 아니라 러너가 지키게 했다.**

## Performance

- **Duration:** 8min
- **Started:** 2026-09-18T09:46Z
- **Completed:** 2026-09-18T09:54Z
- **Tasks:** 3 (RED 1 · GREEN 2)
- **Files created:** 2 · **modified:** 1

## Accomplishments

- **계약 테스트 47건**(`describe` 9개 = `SQL/` 8 + `TS/` 1)이 `.sql` 과 `client.ts` 를 텍스트로 파싱해 검사한다. 번호 #1~#47 은 `<behavior>` 가 고정한 식별자 그대로이며 `it` 이름 끝에 `(#N)` 으로 박아 02-03 낭독 리뷰가 항목별로 인용할 수 있다.
- **컷오버 SQL 154줄**이 D-10 순서(restaurants → candidates → settings+seed+comment → results 컬럼 → RLS/정책 → publication 가드 → cron 교체 → 구 테이블 제거)를 그대로 따르고, 모든 문이 `if not exists` / `if exists` / unschedule→schedule 중 하나다.
- **`settings` 쓰기 정책 0건**(T-02-03 완화)과 **`public.results` 등장 1건**(T-02-06 완화)이 회귀 테스트로 고정됐다. 앞으로 누가 파일을 고쳐도 이 두 줄이 깨지면 `npm test` 가 빨개진다.
- **행 타입 3개 추가 + `ResultRow.restaurant_id`**, `MenuRow`·`PinnedMenuRow` 보존. `npm test` 83건, `tsc`, `lint`, `npm run build` 전부 통과.
- **라이브 리소스 무접촉:** `supabase` CLI 미실행, 원격 SQL 0건, Edge Function 미배포, `main` 불변, 신규 패키지 0개.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): 마이그레이션 계약 스펙 작성** — `c2e8ad1` (test)
2. **Task 2 (GREEN 1/2): 0005 컷오버 마이그레이션 작성** — `718e8a4` (feat)
3. **Task 3 (GREEN 2/2): 행 타입 추가** — `5542453` (feat)

REFACTOR 커밋 없음 (정리할 것이 없어 빈 커밋을 만들지 않았다).

**Plan metadata:** 아래 docs 커밋 — SUMMARY·STATE·ROADMAP.

## Files Created/Modified

- `supabase/migrations/0005_restaurants_settings.test.ts` (신규, 329줄) — `readOrEmpty` 폴백 + 주석 제거/원본 두 사본 + 헬퍼 5개(`count`·`stripAfter`·`blockLines`·`tableColumns`·`typeFields`·`policyPairs`) + `it` 47건
- `supabase/migrations/0005_restaurants_settings.sql` (신규, 154줄) — 테이블 3 · 이름 있는 인덱스 2 · seed 1 · `comment on column` 3 · `results` 컬럼 1 · RLS 3 · 정책 9쌍 · publication 가드 1 · cron 잡 3 · `drop table` 2
- `lib/supabase/client.ts` (수정, +28 −1) — 타입 3개 추가 + `ResultRow` 2줄 변경. 1-10행 `"use client"`/`createClient` 블록 무변경(diff 로 확인)

## RED 증거 (Task 1)

`npx vitest run supabase/migrations` → **exit 1**, 출력 원문:

```
 Test Files  1 failed (1)
      Tests  42 failed | 5 passed (47)
```

- `Failed to load` 0건 · `No test files found` 0건 → **모듈 로드 실패가 아니라 단언 실패**다(`readOrEmpty` 폴백이 동작했다는 증거). 플랜의 하한선 ≥35 를 넘고, 예측치 "약 42건"과 정확히 일치한다.
- 빈 SQL 에서도 공허하게 통과한 5건은 플랜이 미리 지목한 그대로다: #8(`create extension` 0건) · #13(settings 쓰기 정책 0건) · #16(전체 삭제문 키워드 0건) · #25(results delete/update/drop 0건) · #42(`MenuRow`·`PinnedMenuRow` 존재).
- 이 시점에 `supabase/migrations/0005_restaurants_settings.sql` 은 존재하지 않았다(`test -f` → exit 1). 구현 없이 빨간불이 떴다.

## GREEN 결과

| 단계 | 명령 | 결과 |
|---|---|---|
| Task 2 | `npx vitest run supabase/migrations -t 'SQL/'` | exit 0 — `Tests 39 passed \| 8 skipped (47)` ✅ |
| Task 2 | `npx vitest run supabase/migrations` (필터 없이) | `Tests 4 failed \| 43 passed (47)` — 실패가 **정확히 #36·#38·#40·#41** ✅ (타입 미존재분만) |
| Task 3 | `npx vitest run supabase/migrations` | exit 0 — `Tests 47 passed (47)` ✅ |
| Task 3 | `npm test` | exit 0 — `Test Files 5 passed (5)` / `Tests 83 passed (83)` ✅ |
| Task 3 | `npx tsc --noEmit` | exit 0 ✅ |
| Task 3 | `npm run lint` | exit 0, 출력 0줄 ✅ |
| Task 3 | `npm run build` | exit 0 — `✓ Compiled successfully`, 4 라우트 정적 생성 ✅ |

`-t 'SQL/'` 필터는 정상 동작했다(러너가 8건을 skipped 로 표시). 대체 판정이 필요하지 않았다.

## SQL grep 게이트 (Task 2 인수 조건 전량)

`STRIP` = `sed 's/--.*//' 0005_restaurants_settings.sql`, `RAW` = 원본.

| 검사 | 기대 | 실측 |
|---|---|---|
| `grep -ci truncate RAW` (전체 삭제문 키워드) | 0 | `0` ✅ |
| `create table` / `create table if not exists` | 3 / 3 | `3 / 3` ✅ |
| `create index` / `create index if not exists` | 2 / 2 | `2 / 2` ✅ |
| `create policy` / `drop policy if exists` | 9 / 9 | `9 / 9` ✅ |
| 정책 이름 쌍 `diff` (테이블.이름 정렬 비교) | 0줄 | 차이 없음 ✅ |
| `enable row level security` | 3 | `3` ✅ |
| settings 쓰기 정책 / select 정책 | 0 / 1 | `0 / 1` ✅ |
| `cron.unschedule('` / `perform cron.unschedule(jid)` / `cron.schedule(` | 0 / 1 / 3 | `0 / 1 / 3` ✅ |
| `^alter publication` / `pg_publication_tables` | 0 / 1 | `0 / 1` ✅ |
| `array['restaurants', 'candidates', 'settings']` | 1 | `1` ✅ |
| `create extension` | 0 | `0` ✅ |
| `check (id = 1)` / `check (cooldown_days >= 0)` | 1 / 1 | `1 / 1` ✅ |
| `comment on column` | 3 | `3` ✅ |
| `id uuid primary key default gen_random_uuid()` | 1 | `1` ✅ |
| `menus text[] not null default '{}'` (`grep -F`) | 1 | `1` ✅ |
| `restaurant_id uuid primary key references public.restaurants(id) on delete cascade` | 1 | `1` ✅ |
| `public.results` | 1 | `1` ✅ |
| `drop table if exists` / 파일 마지막 두 줄 | 2 / 두 drop | `2` · `pinned_menus;` → `menus;` ✅ |
| `timeout_milliseconds := 5000` / `'* * * * *'` / `'0 15 * * *'` / `'30 15 * * *'` | 1 / 1 / 1 / 1 | `1 / 1 / 1 / 1` ✅ |
| RAW 주석: `동작 불변` · `swxiqytyxjlcgubqlozk` · `치환` · `KST 00:00 = UTC 15:00` · `재회전` | ≥1 각각 | `1 / 2 / 1 / 1 / 1` ✅ |

## TS 게이트 (Task 3 인수 조건)

| 검사 | 기대 | 실측 |
|---|---|---|
| `export type RestaurantRow` / `CandidateRow` / `SettingsRow` | 1 / 1 / 1 | `1 / 1 / 1` ✅ |
| `export type MenuRow` / `PinnedMenuRow` (삭제 금지) | 1 / 1 | `1 / 1` ✅ |
| `restaurant_id: string \| null` | 1 | `1` ✅ |
| `id: 1;` (리터럴 타입) | 1 | `1` ✅ |
| `0005_restaurants_settings.sql` 출처 주석 | ≥1 | `4` ✅ |
| `npx vitest list` 수집 파일 | 5줄 | 5줄 (신규 1 추가) ✅ |

## Decisions Made

- **정책 줄 정렬 패딩을 버렸다.** 0001·0004 는 `create policy pinned_read   on …` 처럼 이름 뒤를 공백으로 정렬한다. 그러나 인수 조건의 이름 쌍 1:1 검사(`grep -oE 'drop policy if exists [a-z_]+ on public\.[a-z_]+'`)와 계약 테스트 #4 의 정규식이 **단일 공백**을 전제한다. 정렬을 유지하면 9개 정책 중 어느 것도 매치되지 않아 게이트가 조용히 0 대 0 으로 통과한다. 재실행 안전성 검사가 살아 있는 쪽을 골랐다.
- **publication 가드를 배열 루프 한 블록으로.** RESEARCH 가 테이블별 `do $$` 3개와 배열 루프 1개를 모두 제시했는데, 후자를 골랐다 — 대상이 한 줄 리터럴 배열이어야 #43("세 이름이 전부 있는가")이 집합 비교로 성립한다. 블록 3개면 하나가 빠져도 "가드 2건"이라는 숫자만 남아 늦게(Phase 5~7 의 무음 Realtime) 드러난다.
- **`it` 이름 끝에 `(#N)` 을 붙였다.** 레포 spec 은 순수 한글 서술문이지만, 이 47건은 02-03 낭독 리뷰와 `<threat_model>` 이 번호로 인용하는 고정 식별자다. 이름에 번호가 없으면 리뷰어가 항목과 테스트를 눈으로 맞춰야 한다.
- **`cron.job_run_details` 언급을 본문 1회로 제한.** 계약 테스트 #22 가 개수 1을 검사하므로 설명은 `--` 주석에 두고 실행문에서는 한 번만 쓴다(주석은 STRIP 에서 사라진다).
- **REFACTOR 없음.** 스펙·SQL 모두 첫 작성에서 인수 조건을 통과했고 중복이 없었다. 빈 커밋을 만들지 않았다.

## Deviations from Plan

**세 태스크 모두 플랜 문구대로 실행됐다.** 플랜이 "재량"으로 남긴 지점에서 내린 선택 1건만 기록한다.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 정책 줄 정렬 공백 제거 (아날로그 습관 vs 인수 조건 충돌)**

- **Found during:** Task 2 작성 중
- **Issue:** `02-PATTERNS.md` 4번이 "정책 이름 컬럼 정렬(`pinned_read  ` 뒤 공백 2칸)"을 [그대로] 복사 항목으로 지시한다. 그런데 같은 플랜의 인수 조건과 계약 테스트 #4 는 `drop policy if exists [a-z_]+ on public\.[a-z_]+` / `create policy [a-z_]+ on public\.[a-z_]+` **단일 공백** 정규식으로 이름 쌍을 뽑는다. 정렬 패딩을 넣으면 매치가 0건이 되고 `[0, 0]` vs `[9, 9]` 로 테스트가 빨개지거나(다행), 정규식을 `\s+` 로 느슨하게 고치면 인수 조건 `diff` 와 어긋난다(위험).
- **Fix:** 정책 18줄 전부 단일 공백으로 썼다. 계약 테스트 정규식은 플랜 원문 그대로 유지했다.
- **Files modified:** `supabase/migrations/0005_restaurants_settings.sql`
- **Verification:** `diff <(STRIP | grep -oE 'drop policy …' | sort) <(STRIP | grep -oE 'create policy …' | sort)` → 출력 0줄, #4 초록
- **Committed in:** `718e8a4`

**2. [Rule 1 - Bug] SDK 가 생성한 문자열 3건의 형식 교정 (02-01 과 동일 재발)**

- **Found during:** 상태 갱신 단계
- **Issue:** (a) `state.add-decision` 이 `- [Phase ?]: [Phase 02]: …` 로 접두사를 이중 출력 — 기존 16줄은 전부 `- [Phase 0N]: …` 형식. (b) `roadmap.update-plan-progress` 가 표 셀을 `| In Progress|  |` 로 써 파이프 앞 공백 누락 + Completed 열 공백. (c) `state.record-session` 이 `last_activity` 의 서술 접미사를 날려 날짜만 남김.
- **Fix:** (a) 이중 접두사 3줄을 `- [Phase 02]:` 로 정규화. (b) `| In Progress | - |` 로 교정. (c) `2026-09-18 -- Phase 2 executing (02-02 complete)` 로 복원(frontmatter·본문 2곳).
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** `git diff` 육안 확인 — 의미 변경 없음, 형식만 기존 관례에 정렬
- **Committed in:** docs 커밋
- **참고:** 02-01-SUMMARY 가 같은 3건을 기록했다. **SDK 쪽 버그가 재현된 것**이므로 매 플랜마다 손으로 고치는 대신 02-03 또는 페이즈 게이트에서 한 번 보고할 항목이다.

---

**Total deviations:** 2 auto-fixed (1 blocking · 1 bug)
**Impact on plan:** 1번은 형식(가독성)을 인수 조건 쪽에 맞춘 것이라 SQL 의미에 영향이 없고, 2번은 계획 문서 형식 문제라 코드에 영향이 없다. 범위 확대 없음 — 코드 커밋 3개가 각각 파일 1개다.

## Issues Encountered

없음. 관측 1건만 기록한다: `npm run lint` 는 이번에도 exit 0 · 출력 0줄이었다. `CLAUDE.md` 가 적어 둔 "`components/Wheel.tsx` `react-hooks/set-state-in-effect` lint 에러 1건"은 재현되지 않는다(02-01 에서도 같은 관측). 이 플랜 범위 밖이라 `CLAUDE.md` 를 고치지 않았다 — 02-03 페이즈 게이트에서 재확인할 항목.

## Threat Model Compliance

| Threat ID | 상태 | 근거 |
|---|---|---|
| T-02-03 (anon 이 settings 쓰기) | mitigated | `settings` RLS 활성 + `settings_read`(select) 1건, 쓰기 정책 0건. 계약 테스트 #12·#13 이 회귀 가드 |
| T-02-04 (신규 public 테이블 PostgREST 노출) | mitigated | 3개 전부 `enable row level security` (#11) |
| T-02-05 (익명 삭제 → cascade) | accept | 익명 설계 유지. 주석에 "참조 무결성은 RLS 를 우회한다"를 남김 |
| T-02-06 (results 이력 무결성) | mitigated | STRIP 기준 `public.results` 1건이 `add column if not exists` 하나뿐 (#23·#24), delete/update/drop 0건 (#25) |
| T-02-07 (cron 잡 본문 권한 상승) | mitigated | 잡 본문은 전부 리터럴 SQL. `format(%I)` 인자는 코드 안 상수 배열 `array['restaurants', 'candidates', 'settings']` 뿐 |
| T-02-08 (프로젝트 ref 노출) | accept | ref 는 시크릿이 아님(브라우저에 이미 노출). "다른 프로젝트로 옮기면 치환할 것" 주석 추가 (#32) |
| T-02-09 (Edge Function 무인증) | transfer | Phase 4 소관. 이 플랜은 cron 주기만 `* * * * *` 로 바꿈 |
| T-02-SC (npm 공급망) | mitigated | 신규 패키지 0개. `package.json`·`package-lock.json` 미변경 (커밋 3개가 각각 파일 1개) |
| T-02-LIVE (라이브 DB·함수·main) | mitigated | 파일만 작성. `supabase` CLI 미실행, 원격 SQL 0건, 브랜치 `feat/restaurant-roulette` 유지, `git diff --name-only main...HEAD -- supabase` = 0005 두 파일뿐 |

## Known Stubs

없음. 이 플랜의 산출물은 파일 텍스트가 전부이고 UI 로 흘러가는 빈 값·플레이스홀더가 없다.

다만 **의도적으로 미완인 상태**가 둘 있고 둘 다 후속 페이즈가 소관이다:

- `0005_restaurants_settings.sql` 은 **적용되지 않았다.** 적용은 Phase 8 에서 사용자가 대시보드 SQL Editor 로 1회 수행한다(PROJECT.md Key Decisions · D-12).
- 매장 삭제 → `results` UPDATE → 휠 **재회전** 부작용에 대한 코드 가드가 없다. 파일 주석에 사실만 남겼고 가드는 **Phase 6** 소관이다(D-18 / Pitfall 6).

## Verification Results

`<verification>` 6항목 전량:

| 검증 | 명령 | 결과 |
|---|---|---|
| 계약 테스트 | `npx vitest run supabase/migrations` | exit 0 — `Tests 47 passed (47)` ✅ |
| 전체 스위트 | `npm test` | exit 0 — `Test Files 5 passed (5)` / `Tests 83 passed (83)` ✅ |
| 타입 | `npx tsc --noEmit` | exit 0 ✅ |
| lint | `npm run lint` | exit 0, 신규 에러 0 ✅ |
| 전체 삭제문 키워드 | `grep -ci truncate …0005….sql` | `0` ✅ |
| TDD 순서 | `git log --oneline --grep='^test(02-02)'` · `--grep='^feat(02-02)'` | `c2e8ad1`(test) → `718e8a4`·`5542453`(feat) — test 가 먼저 ✅ |
| supabase 변경 범위 | `git diff --name-only main...HEAD -- supabase` | `0005_restaurants_settings.sql` · `0005_restaurants_settings.test.ts` 2줄뿐 ✅ |
| 커밋 위생 | `git show --name-only --format= HEAD` ×3 | 각 커밋 파일 1개. `.serena/project.yml` 0 · `.planning/config.json` 0 ✅ |
| AI 표기 | `git log $(git merge-base main HEAD)..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | `0` ✅ |
| 순수 로직 무접촉 | `git diff --name-only main...HEAD -- lib/phase.ts lib/time.ts` | 출력 0줄 ✅ |

## User Setup Required

None — 이 플랜은 파일만 만든다. 마이그레이션 적용·Edge Function 배포·패키지 설치가 어떤 태스크에도 없었다.

## Next Phase Readiness

- **02-03 이 바로 착수 가능하다.** 낭독 리뷰 11항목 중 1(동작 불변) · 2(ref 치환) · 3(KST↔UTC 계산식) · 8(재회전 부작용) · 11(정책 쌍 1:1)은 이미 `it` #33·#32·#34·#26·#4 로 자동화돼 있어, 리뷰는 나머지 항목과 "테스트가 못 보는 것"(문법 오류·의미 오류·순서의 위생)에 집중하면 된다.
- **요구사항 마킹은 02-03 이 한다.** SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03 전부 Pending 유지. 파일은 존재하지만 이 페이즈의 검증 정본은 낭독 리뷰 + 사용자 승인이고, 02-01 이 같은 이유로 조기 마킹을 되돌린 선례가 있다.
- **Phase 3 이 쓸 계약이 고정됐다.** `SettingsRow.spin_time` 은 `"11:55"` 가 아니라 `"11:55:00"` 이다(PostgREST time 직렬화). `history_since` 는 `"yyyy-mm-dd"` 라 `results.date` 와 문자열 그대로 비교된다.
- **Phase 6 이 받을 부채 2건:** `MenuRow`·`PinnedMenuRow` 타입 제거, 매장 삭제 → `results` UPDATE 재회전 가드.

---
*Phase: 02-data-model*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `supabase/migrations/0005_restaurants_settings.sql` — FOUND
- `supabase/migrations/0005_restaurants_settings.test.ts` — FOUND
- `lib/supabase/client.ts` — FOUND
- `.planning/phases/02-data-model/02-02-SUMMARY.md` — FOUND
- commit `c2e8ad1` (test) — FOUND
- commit `718e8a4` (feat, SQL) — FOUND
- commit `5542453` (feat, types) — FOUND
