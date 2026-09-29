---
phase: 02-data-model
verified: 2026-09-21T00:27:52Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "매장 삭제 → results UPDATE(set null) Realtime 이벤트가 휠을 재회전시키지 않는다"
    addressed_in: "Phase 6"
    evidence: "0005 SQL :53-54 주석 '가드는 Phase 6 소관' — 이 페이즈는 사실만 남기기로 D-04 에서 결정"
  - truth: "코드 쪽 추첨 시각 하드코딩(lib/phase.ts · spin-roulette)이 settings.spin_time 단일 출처로 대체된다"
    addressed_in: "Phase 3 · Phase 4 · Phase 6"
    evidence: "0005 SQL :5 주석, D-08 '시각 판정은 함수가 settings.spin_time 으로(Phase 4)'"
  - truth: "0005 마이그레이션이 실제 DB 에 적용되고 menus·pinned_menus 0행이 적용 직전 재확인된다"
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 2 Goal '적용은 Phase 8', D-12·D-15, 사용자 승인 조건 '적용 직전 0행 재확인 전제'"
---

# Phase 2: 데이터 모델 Verification Report

**Phase Goal:** 매장·후보·설정 스키마를 재실행 가능한 마이그레이션 한 파일과 수동 유지 TS 타입으로 확정한다. 파일만 쓰고 적용은 하지 않는다(적용은 Phase 8).
**Verified:** 2026-09-21T00:27:52Z
**Status:** passed
**Re-verification:** No — initial verification

검증 원칙: SUMMARY 서술은 증거로 쓰지 않았다. SQL·스펙·타입 파일을 직접 읽고, 모든 게이트 명령을 이 프로세스에서 다시 실행했으며, RED 상태는 `c2e8ad1` 을 별도 워크트리로 체크아웃해 재현했다. SC 카운트는 주석 제거 사본(`sed 's/--.*//'`)에서, `truncate` 0건과 필수 주석은 원본에서 셌다. Docker 드라이런은 D-15 에 따라 하지 않았다(텍스트 수준 검증만).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 5 + PLAN 세부 truths 병합)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1 — 한 파일에 `restaurants`·`candidates`·`settings` 생성 + RLS + publication 3건 | ✓ VERIFIED | `create table if not exists` 3/3 (`:10,:25,:35`); `enable row level security` 3건 (`:58-60`); 정책 9 drop / 9 create, `settings` 는 `settings_read` select 1건·insert/update/delete/`for all` 0건 (`:84-85`); `results` 정책 무접촉 0건; publication 가드 대상 `array['restaurants', 'candidates', 'settings']` (`:92`), 맨 `alter publication` 0건. `settings` 기본값 `'11:55'`·`0`·`((now() at time zone 'Asia/Seoul')::date)`, `check (id = 1)` (`:36-39`). `restaurants.name` unique + `char_length(name) between 1 and 24` (`:12`) |
| 2 | SC2 — cron 3잡 unschedule→reschedule, `truncate` 0회 | ✓ VERIFIED | jobid 루프 unschedule 1건, 이름 인자 unschedule 0건 (`:104-113`, 목록에 구 이름 `reset-menus` 포함); `cron.schedule` 3건 `spin-lunch-roulette`(`* * * * *`, `timeout_milliseconds := 5000`) · `reset-candidates`(`0 15 * * *`, `delete from public.candidates` + `insert … select id from public.restaurants where pinned order by created_at`) · `purge-cron-history`(`30 15 * * *`, `job_run_details` 7일); 원본 `grep -ci truncate` = 0 |
| 3 | SC3 — `results` 기존 행 삭제·변환 없음, 구 테이블 drop 이 마지막 | ✓ VERIFIED | 주석 제거 사본에서 `public.results` 정확히 1건 = `:55 alter table public.results add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null`; `delete from public.results`·`update public.results`·`drop table … results` 0건; 마지막 두 비공백 문이 `drop table if exists public.pinned_menus;` / `drop table if exists public.menus;` (`:153-154`) |
| 4 | SC4 — `client.ts` 타입 반영 + `tsc` 통과 | ✓ VERIFIED | `RestaurantRow`(`:34-41`)·`CandidateRow`(`:45-48`)·`SettingsRow`(`:52-57`, `id: 1`) 존재; `ResultRow.restaurant_id: string \| null` (`:24`); `menu: string` 유지 + 스냅샷 주석 (`:21`); `MenuRow`·`PinnedMenuRow` 보존. 스펙 #35-#41 이 SQL 컬럼 목록과 TS 필드 목록을 리터럴 기대 배열 양쪽에 대조. `npx tsc --noEmit` exit 0 |
| 5 | SC5 — 두 번 실행해도 안전 | ✓ VERIFIED | 최상위 문 전수 점검: `create table`/`create index` 전부 `if not exists`(무명 인덱스 0, 이름 있는 `_idx` 2/2); `add column if not exists`; `add constraint` 0건(제약은 전부 인라인, `:9` 주석에 이유); `create extension` 0건; seed `on conflict (id) do nothing`; `create policy` 9건 전부 직전 줄에 `drop policy if exists` 짝(테이블·이름 1:1, 스펙 #4 가 집합 동등성으로 강제); publication `pg_publication_tables` 가드; cron jobid 루프 unschedule 후 schedule; `comment on`·`enable row level security` 는 본래 멱등 |

**Score:** 5/5 truths verified

PLAN 세부 truths(02-01 2건, 02-02 10건, 02-03 5건)는 전부 위 5개 SC 의 하위 항목이거나 게이트·증거 항목이며 아래 표들에서 개별 확인했다. 축소된 항목 없음.

### Deferred Items

이 페이즈에서 충족되지 않았으나 로드맵 후속 페이즈가 명시적으로 맡는 항목. 갭이 아니다.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 매장 삭제 → `results` UPDATE 이벤트로 인한 휠 재회전 가드 | Phase 6 | SQL `:53-54` 주석, D-04 |
| 2 | 코드 쪽 11:55 하드코딩 제거(`settings.spin_time` 단일 출처화) | Phase 3·4·6 | SQL `:5` 주석, D-08 |
| 3 | 실제 적용 + Docker 드라이런 + 적용 직전 `menus`·`pinned_menus` 0행 재확인 | Phase 8 | ROADMAP Goal, D-12·D-15, 승인 조건(02-03-SUMMARY `:143`) |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `vitest.config.mts` | include 글롭 4개, `supabase/migrations/**/*.test.ts` 포함 | ✓ VERIFIED | 45줄, `:19-26` 글롭 4개, exclude 5항목 무변경. `npx vitest list` = 정확히 5파일(기존 4 + 0005 스펙), `design/**`·`.planning/**`·`functions/!(_shared)` 신규 매치 0 |
| `supabase/migrations/0005_restaurants_settings.test.ts` | 계약 테스트 ≥150줄, 리터럴 기대값 | ✓ VERIFIED | 329줄, 47 it, `readOrEmpty(new URL("./0005_restaurants_settings.sql", …))` 로 SQL 을, `../../lib/supabase/client.ts` 를 텍스트로 읽음(import 없음). 기대 배열 4개 리터럴(`:81-84`) |
| `supabase/migrations/0005_restaurants_settings.sql` | 컷오버 마이그레이션 ≥100줄, `create table if not exists public.settings` 포함 | ✓ VERIFIED | 154줄, 8단 구조(D-10 순서 그대로). 필수 주석 원본 존재: `동작 불변` 1 · `치환` 1 · `재회전` 1 · `KST 00:00 = UTC 15:00` 1 · `MENU_NAME_MAX_LEN` 1 |
| `lib/supabase/client.ts` | `export type SettingsRow` 등 3타입 + `ResultRow.restaurant_id` | ✓ VERIFIED | 57줄. 이 페이즈 변경은 `5542453` +29/-1 한 커밋뿐. `lib app components` 범위 diff 가 이 파일 1개 |
| `.planning/phases/02-data-model/02-VALIDATION.md` | 낭독 리뷰 11항목 + 검증 맵 + 게이트 + `wave_0_complete: true` | ✓ VERIFIED | `wave_0_complete: true` (`:6`); 11항목 전부 `통과` + SQL 라인 인용(`:80-90`); 게이트 표(`:143-147`); 사용자 승인 기록은 02-03-SUMMARY `:138-145` ("승인", 2026-09-21) |

Wiring: 스펙은 러너 설정 → 수집 → SQL/TS 텍스트 파싱으로 이어지며 실제로 47건이 실행된다(ORPHANED 아님). 데이터 흐름(Level 4)은 런타임 렌더가 없는 스키마·타입 페이즈라 해당 없음.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `vitest.config.mts` | `0005_restaurants_settings.test.ts` | `test.include` 글롭 | ✓ WIRED | `npx vitest list` 에 스펙 파일 등장, `npx vitest run supabase/migrations` 47/47 |
| `0005_….test.ts` | `0005_….sql` | `readOrEmpty(new URL("./0005_restaurants_settings.sql", import.meta.url))` | ✓ WIRED | `:77`. RED 재현에서 SQL 부재 시 폴백 "" 로 단언 실패(모듈 로드 실패 아님) 확인 |
| `0005_….test.ts` | `lib/supabase/client.ts` | 텍스트 파싱 | ✓ WIRED | `:79`, import 0건 |
| `0005_….sql` | `public.results` | `add column if not exists restaurant_id … on delete set null` | ✓ WIRED | `:55`, 유일한 `public.results` 실행문 |
| cron `reset-candidates` | `public.candidates` | `delete from` + 핀 재시드 | ✓ WIRED | `:135-137` |
| `02-VALIDATION.md` | 스펙 / SQL | 검증 맵 Automated Command 열 · 낭독 리뷰 인용 | ✓ WIRED | `npx vitest run supabase/migrations` (`:22,:30`), `0005_restaurants_settings.sql` 라인 인용 11건 |

### Behavioral Spot-Checks (이 프로세스에서 직접 실행)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 스위트 | `npm test` | `Test Files 5 passed (5)` · `Tests 83 passed (83)` · exit 0 | ✓ PASS |
| 계약 테스트 | `npx vitest run supabase/migrations` | `1 passed` · `47 passed (47)` · exit 0 | ✓ PASS |
| 수집 경계 | `npx vitest list \| cut -d'>' -f1 \| sort -u` | 정확히 5줄 | ✓ PASS |
| 타입 | `npx tsc --noEmit` | 출력 없음 · exit 0 | ✓ PASS |
| lint | `npm run lint` | 출력 없음 · exit 0 (CLAUDE.md 의 `Wheel.tsx` 1건 재현 안 됨 — 02-03 이 이미 Phase 6 로 넘김) | ✓ PASS |
| 취약점 | `npm audit --audit-level=high` | `found 0 vulnerabilities` · exit 0 | ✓ PASS |
| 프로덕션 빌드 (1회) | `npm run build` | `✓ Compiled successfully` · 정적 4라우트 · exit 0 | ✓ PASS |
| 라이브 무접촉 | `git diff --name-only main...HEAD -- supabase` | 정확히 `0005_restaurants_settings.sql`, `0005_restaurants_settings.test.ts` 2줄 | ✓ PASS |
| 코드 범위 | `git diff --name-only 9251b3c..HEAD -- lib app components` | `lib/supabase/client.ts` 1줄 | ✓ PASS |
| 커밋 위생 | `git log … --format=%B \| grep -icE 'co-authored\|generated with\|claude-session'` | 0 | ✓ PASS |
| CLI 부재 | `command -v supabase` | ABSENT (db push·deploy 불가능했음) | ✓ PASS |
| TDD 순서 | `git merge-base --is-ancestor c2e8ad1 718e8a4` / `718e8a4 5542453` | test → feat(SQL) → feat(types) 조상 관계 성립; 각 커밋 파일 1개씩 | ✓ PASS |
| RED 진위 | 스크래치 워크트리 `c2e8ad1` 체크아웃(SQL 부재, `SettingsRow` 부재) 후 `npx vitest run supabase/migrations` | `42 failed \| 5 passed (47)`; `Failed to load`·`No test files` 0건; 공허 통과 5건 = #8·#13·#16·#25·#42 — SUMMARY 기록과 정확히 일치. 워크트리 제거·prune 완료, 메인 트리 무변경 | ✓ PASS |

### Probe Execution

`scripts/*/tests/probe-*.sh` 없음, PLAN·SUMMARY 에 probe 선언 없음 — 해당 없음. 이 페이즈의 실행 가능한 검증은 위 계약 테스트가 담당한다.

### Adversarial Probes (스펙이 헐겁게 통과할 수 있는지)

| 시나리오 | 잡히는가 | 근거 |
| -------- | -------- | ---- |
| `settings` 에 insert/update/delete 정책 추가 | 잡힘 | #13 (`for (insert\|update\|delete)` 0건) |
| `settings` 에 `for all` 정책 추가 | 잡힘(간접) | #13 은 `for all` 을 못 보지만 #4 가 drop/create 쌍을 정확히 9/9 로 고정해 정책 추가 자체가 실패한다. 실제 SQL 의 `for all` 은 0건 |
| `on delete cascade`/`set null` 방향 뒤바뀜 | 잡힘 | #47 은 candidates 줄에 `cascade`, #24 는 results 줄에 `set null` 을 줄 단위 리터럴로 요구 — 둘이 함께 뒤바뀜을 판정한다(02-03-SUMMARY `:103` 의 "자동 검사 없음" 은 과소평가) |
| publication 배열에서 테이블 1개 누락 | 잡힘 | #43 배열 완전 일치 |
| 무명 `create index` 혼입 | 잡힘 | #3 이 총 개수와 이름 있는 `_idx` 개수를 둘 다 2 로 고정 |
| 주석에 `create policy`·`truncate` 등 토큰 혼입으로 카운트 왜곡 | 잡힘 | 카운트는 주석 제거 사본, 필수 주석은 원본 — 이중 소스 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SHIP-01 | 02-01, 02-02, 02-03 | 컷오버 마이그레이션 1개(3테이블·RLS·Realtime·cron 교체·구 테이블 제거·재실행 가능) | ✓ SATISFIED | Truth 1·2·3·5 |
| SETT-01 | 02-02, 02-03 | `settings` 단일행, anon 읽기만 | ✓ SATISFIED | `check (id = 1)`, `settings_read` select 1건·쓰기 0건, `SettingsRow.id: 1` |
| CATL-07 | 02-02, 02-03 | 매장 이름 DB unique | ✓ SATISFIED | `:12 name text not null unique check (char_length(name) between 1 and 24)` |
| CAND-04 | 02-02, 02-03 | 자정 리셋 `delete from` + 핀 재시드, 열린 탭 반영 | ✓ SATISFIED | `reset-candidates` 본문 `:135-137`, `truncate` 0, `candidates` publication 등록 |
| HIST-03 | 02-02, 02-03 | 전환 이전 `results` 60행 보존 | ✓ SATISFIED | `public.results` 실행문 1건(add column), delete/update/drop 0 |

REQUIREMENTS.md 추적표에서 Phase 2 로 매핑된 ID 는 위 5개뿐 — ORPHANED 없음. QUAL-01 은 Phase 3 소관으로 이 페이즈 범위 밖.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (4개 변경 파일 전수) | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/`not yet implemented` 0건 | — | 없음 |

정보성 관찰(갭 아님):
- ℹ️ 스펙 #13 은 `for all` 변형을 단독으로 못 잡는다. 지금은 #4 의 정확 개수(9/9)가 막지만, 후속 페이즈에서 정책이 추가되면 #13 정규식에 `all` 을 더하는 편이 견고하다.
- ℹ️ 02-03-SUMMARY 가 "cascade/set null 방향 자동 검사 없음" 이라 적었으나 #47+#24 조합이 실제로 잡는다 — 문서의 자기평가가 보수적일 뿐.
- ℹ️ `CLAUDE.md` 의 `Wheel.tsx` lint 에러 1건 기록은 현재 사실과 다르다(02-03 이 Phase 6 로 이관 기록).
- ℹ️ 워킹트리의 `.planning/config.json`·`.serena/project.yml` 수정은 페이즈 소스가 아니다(후자는 CLAUDE.md 가 커밋 대상 아님으로 명시).

### Human Verification Required

없음. 이 페이즈의 사람 검증(0005 SQL 낭독·8단계 확인·"승인", 2026-09-21)은 02-03 Task 3 `checkpoint:human-verify` 로 이미 완료·기록되어 있어(02-03-SUMMARY `:138-145`, 02-VALIDATION.md `:73-90`) 재요청하지 않는다. 승인 이후 SQL·스펙·타입에 변경 커밋이 없음을 `git log` 로 확인했다(`718e8a4`·`5542453` 이후 `supabase/`·`lib/` 변경 0).

### Gaps Summary

갭 없음. 페이즈 목표 — "재실행 가능한 마이그레이션 한 파일 + 수동 유지 TS 타입 확정, 적용은 하지 않음" — 이 코드베이스에서 그대로 성립한다. 5개 SC 전부 파일 텍스트에서 직접 확인했고, 47건 계약 테스트는 진짜 RED(42 실패)에서 출발해 GREEN 이 됐으며, 라이브 접촉 흔적(supabase CLI·추가 파일)이 없다. Phase 8 적용 시 사용자 승인 조건 "적용 직전 `menus`·`pinned_menus` 0행 재확인" 을 지켜야 한다.

---

_Verified: 2026-09-21T00:27:52Z_
_Verifier: Claude (gsd-verifier)_

## 검증 후 변경 (2026-09-21)

검증 통과 후 코드 리뷰(02-REVIEW.md) 반영 커밋 `02b3c89`·`cfbe8c7`: restaurants DB 상한(D-19, 함수 `text_array_max_len` + check 3줄), 헤더 주석 조건부화(WR-01), cron 본문 밖으로 주석 이동(IN-01), 스펙 #13·#6 강화 + 신규 #48~#53. 게이트 재실행: `npm test` 89/89, `npx tsc --noEmit` 0. 5개 성공 기준 판정에 영향 없음(테이블·정책·cron·순서·멱등 모두 불변, 리뷰어 Docker 3회 실행은 변경 전 기준이므로 Phase 8 드라이런(D-15) 권고 유지).
