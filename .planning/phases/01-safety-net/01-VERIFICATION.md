---
phase: 01-safety-net
verified: 2026-09-18T06:55:00Z
status: human_needed
score: 19/19 must-haves verified
overrides_applied: 0
human_verification:
  - test: "브라우저에서 초기 SELECT 실패를 유발한 뒤 오늘(/)·기록(/log)·랭킹(/rank) 세 페이지를 연다. 유발 방법 예: `.env.local` 의 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를 일시적으로 틀린 값으로 바꾸거나, 개발자도구 Network 에서 `*.supabase.co` 요청을 차단한다. 검증자는 `npm run dev` 를 띄우지 않는다(커널 패닉 전례) — `npm run build && npm start` 또는 가드런처를 쓴다."
    expected: "세 페이지 모두 빈 화면이 아니라 `role=alert` 빨간 테두리 배너가 뜬다. 문구는 오늘 탭 `메뉴 목록 불러오기 실패: …`(여러 쿼리 실패 시 ` · ` 로 이어진 한 줄), 기록 탭 `기록 불러오기 실패: …`, 랭킹 탭 `랭킹 불러오기 실패: …`. × 버튼으로 닫힌다. 오늘 탭에서는 배너 아래에 휠·메뉴 목록 골격이 그대로 렌더된다. 원시 에러 객체·SQL 조각·환경변수 값이 화면에 보이지 않는다."
    why_human: "시각적 렌더링 + 외부 서비스(Supabase) 실패 주입이 필요하다. 코드 배선(3 페이지 `<ErrorBanner message={loadError}>`)과 `ErrorBanner` 의 SSR 렌더 출력은 기계 검증했지만, 실제 브라우저에서 실패 응답을 받아 배너가 보이는지는 grep·SSR 로 대체할 수 없다."
deferred:
  - truth: "QUAL-01 의 spin_time 파싱·쿨다운 필터 단위 테스트"
    addressed_in: "Phase 3"
    evidence: "Phase 3 goal: '추첨 시각 판정·쿨다운 필터·KST 변환을 주입 가능한 순수 함수 한 곳으로 모으고, 테스트로 계약을 고정한다'. REQUIREMENTS.md traceability 가 QUAL-01 을 Phase 1 → Phase 3 로 명시 분할. 해당 코드는 아직 존재하지 않는다."
  - truth: "CLAUDE.md 26행의 '2026-09-15 기준 lint 에러 1건 존재 (components/Wheel.tsx)' 문장이 현행과 다르다 (현재 `npm run lint` 에러 0)"
    addressed_in: "Phase 8"
    evidence: "SHIP-03: 'CLAUDE.md·README.md가 현행화된다 (낡은 항목 4건 수정 …)'. 01-03 SUMMARY 가 이 문장을 Phase 8 소관으로 명시 이관."
---

# Phase 1: 안전망 Verification Report

**Phase Goal:** 앞으로의 모든 변경을 로컬에서 되돌아볼 수 있는 검증 장치를 먼저 깐다. 새 데이터 모델에 전혀 의존하지 않는 작업만 담는다.
**Verified:** 2026-09-18T06:55:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

검증 원칙: SUMMARY.md 의 주장은 증거로 쓰지 않았다. 모든 게이트 명령을 검증자가 직접 재실행했고, SUMMARY 가 "실행했다"고 적은 변이 점검·RED 실패·수집 제외는 프로젝트 트리를 건드리지 않는 **스크래치 git worktree** 에서 재현했다(검증 후 worktree 제거, `git status --porcelain` 이 페이즈 시작 전과 동일함을 확인). 소스 파일 수정 0건, 커밋 0건.

## Goal Achievement

### Observable Truths

ROADMAP Success Criteria 4개 + "로컬 검증" 줄 1개 + PLAN frontmatter truths 23개를 병합·중복 제거한 19개.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | **[SC1]** `npm test` 가 vitest 를 실행하고 `lib/time.ts`·`lib/phase.ts`·`parseMenuInput` 단위 테스트가 전부 통과한다 — `MENU_NAME_MAX_LEN` 이 `lib/supabase/client.ts` 밖으로 분리돼 환경변수 없이 import 된다 | ✓ VERIFIED | `npm test` exit 0 → `Test Files 4 passed (4) / Tests 36 passed (36)`. `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm test` exit 0 (동일 36건). `npx vitest list \| cut -d'>' -f1 \| sort -u` = 정확히 4줄 (`components/MenuList.test.ts`, `lib/errors.test.ts`, `lib/phase.test.ts`, `lib/time.test.ts`). `lib/constants.ts:8` 이 `MENU_NAME_MAX_LEN = 24` 의 유일한 정의처, `lib/supabase/client.ts` 실코드 참조 0건 |
| 2 | **[SC2]** `next`·`eslint-config-next` 가 16.3.5 이고 `npm audit` 에 critical·high 가 0 이다 | ✓ VERIFIED | `package.json` `dependencies.next = "16.3.5"`, `devDependencies["eslint-config-next"] = "16.3.5"` (캐럿 없음). `npm ls` → `next@16.3.5`, `eslint-config-next@16.3.5`. `package-lock.json` 에 `next-16.3.5.tgz` 3회. `npm audit --audit-level=high` exit 0; `npm audit --json` metadata = `{info:0, low:0, moderate:0, high:0, critical:0, total:0}` |
| 3 | **[SC3]** 오늘·기록·랭킹 3개 페이지에서 초기 SELECT 가 실패하면 빈 화면 대신 한국어 에러 배너가 뜬다 | ✓ VERIFIED (브라우저 확인은 human) | 배선: `app/page.tsx:56-62` `setLoadError(joinLoadErrors([formatLoadError("메뉴 목록", menuRes.error), …("오늘 결과", todayRes.error), …("고정 메뉴", pinRes.error)]))` → `:252 <ErrorBanner message={loadError}>`; `app/log/page.tsx:42,50,99` `{ data, error }` → `formatLoadError("기록", error)` → `<ErrorBanner>`; `app/rank/page.tsx:28,33,71` 동일 패턴 라벨 `"랭킹"`. `const { data } =` 단독 구조분해 3파일 0건. 렌더: worktree 에서 `react-dom/server` 로 `ErrorBanner` SSR → null 이면 `""`, 메시지 있으면 `role="alert"` + `메뉴 목록 불러오기 실패: permission denied` + `aria-label="닫기"` 출력 확인 (2/2 pass). 데이터 흐름: postgrest-js `index.mjs:126` `shouldThrowOnError = false` 기본, `:291` fetch 거부를 `.catch` 로 잡아 `{ error }` 로 돌려주므로 네트워크 실패도 `Promise.all` 을 거부시키지 않고 배너 경로에 도달한다 |
| 4 | **[SC4]** 라이브 DB·Edge Function·`main` 브랜치가 이 페이즈 동안 전혀 바뀌지 않는다 | ✓ VERIFIED (git 증거 기준) | `git diff --name-only main...HEAD -- supabase` 빈 출력, `git status --porcelain supabase` 빈 출력. `git rev-parse main` = `origin/main` = merge-base = `49d0643`; `main` reflog 최신 항목이 페이즈 이전 `pull` 이라 이 페이즈 중 `main` 커밋 0건. 페이즈 전체 변경 파일 목록에 `supabase/**` 없음. SUMMARY 4개 모두에서 deploy/db push 실행 언급 0건 (부정문만). 한계: 라이브 Supabase 상태 자체는 로컬에서 조회하지 않았다 — 레포에 마이그레이션·함수 변경이 0건이므로 배포할 대상이 없었다는 것이 근거다 |
| 5 | **[SC-로컬검증]** vitest 설정이 `design/**`·`supabase/functions/**`(Deno) 를 수집하지 않아 인덱서 OOM 전례를 재발시키지 않는다 | ✓ VERIFIED | `vitest.config.mts:25-36` exclude = `**/node_modules/**`, `.next/**`, `design/**`, `.planning/**`, `supabase/functions/!(_shared)/**`; include 는 `lib/**`, `components/**`, `supabase/functions/_shared/**` 의 `*.test.ts` 뿐. **실효 검증(worktree):** `design/probe.test.ts`, `.planning/phases/01-safety-net/probe.test.ts`, `supabase/functions/spin-roulette/probe.test.ts` 를 심고 `vitest list` → 수집 여전히 4개, 프로브 히트 0. 양성 대조: `supabase/functions/_shared/probe.test.ts` 는 히트 1 (extglob 이 의도대로 `_shared` 만 통과시킨다) |
| 6 | **[01-01]** `package.json` 선언 변경은 `next`·`eslint-config-next` 두 줄뿐 (audit fix 가 선언 범위를 건드리지 않음) | ✓ VERIFIED | `git diff --unified=0 49d0643..1d8ddf4 -- package.json` 의 `+/-` 줄에서 `next`·`eslint-config-next` 를 제외하면 0줄. (HEAD 기준 추가분 `"test"`, `"test:watch"`, `"vitest"` 는 01-03 커밋 `873cafe` 소속) |
| 7 | **[01-01]** `npm audit fix` 가 lock 에 새 패키지 이름을 들이지 않았다 (버전 이동만) | ✓ VERIFIED (플랜이 정의한 범위) | audit-fix 커밋 `d1f1ec6 → 1d8ddf4` 의 lock `"node_modules/…"` 이름 집합 diff: **added 0 / removed 0** — 플랜 가드 (c) 의 기준선("audit fix 직전")과 일치. **주의(Info):** 범프 커밋 `49d0643 → d1f1ec6` 자체는 added 3 / removed 1 (`@img/sharp-freebsd-wasm32`, `@img/sharp-webcontainers-wasm32`, `@img/sharp-wasm32/node_modules/@emnapi/runtime` — 전부 `optional: true` 플랫폼 변형; 제거는 중첩 `next/node_modules/postcss` dedupe). 01-01 SUMMARY 의 "패키지 이름 집합 불변" 은 audit-fix 단계에만 참이다 → Anti-Patterns 표 참조 |
| 8 | **[01-01]** 범프 후에도 `npx tsc --noEmit`·`npm run lint`·`npm run build` 가 통과한다 | ✓ VERIFIED | HEAD 에서 재실행: `tsc` exit 0 (출력 0줄), `lint` exit 0 (출력 0줄), `rm -rf .next && NEXT_DISABLE_MEM_OVERRIDE=1 npm run build` exit 0 — `Next.js 16.3.5 (Turbopack)`, `Compiled successfully in 1215ms`, 정적 6/6, 라우트 `/`·`/_not-found`·`/log`·`/rank` |
| 9 | **[01-02]** 배너 문구는 고정 한국어 라벨 + `error.message` 만으로 조립된다 — 원시 에러·details·hint·환경변수 미노출 | ✓ VERIFIED | `lib/errors.ts:10-13` `\`${label} 불러오기 실패: ${error.message}\``. `lib/errors.ts` 에 `import` 문 0건, `supabase\|process\.env\|react` 비주석 매치 0건. `grep -En "JSON\.stringify\([^)]*[Ee]rror\|[Ee]rror\.details\|[Ee]rror\.hint\|dangerouslySetInnerHTML"` 4파일 0건. `ErrorBanner` Props 는 `message: string \| null` 만 받아 원시 객체 도달 경로 없음 |
| 10 | **[01-02]** 읽기 에러(`loadError`)와 쓰기 에러(`actionError`)가 별도 state 로 같은 `ErrorBanner` 를 쓰고 중복 스타일 객체가 없다 | ✓ VERIFIED | `app/page.tsx:35` `actionError`, `:38` `loadError` 별도 `useState` + 분리 이유 주석(:36-37). `:252-253` `<ErrorBanner>` 2회 (loadError 먼저). `grep -c alertStyles app/page.tsx` = 0. 스타일은 `components/ErrorBanner.tsx:27-51` 한 곳(`var(--red)`·`var(--panel)`·`var(--radius)` 토큰) |
| 11 | **[01-03]** `lib/time.ts` 의 KST 경계(자정 롤오버·연 경계)와 포맷이 테스트로 고정돼 있다 | ✓ VERIFIED | `lib/time.test.ts` 13건: UTC 14:59:59→`2026-09-18`, 15:00:00→`2026-09-19`, 2025-12-31T15:00Z→`2026-01-01`, 자정 `00:00`/`00:00:00`, `kstParts` 7필드 `toEqual`, 한글 긴 날짜 2건. **변이 점검(worktree):** `KST_TZ` 를 `"UTC"` 로 바꾸면 15건 실패 (`Tests 15 failed \| 21 passed`) |
| 12 | **[01-03]** `lib/phase.ts` 의 `currentPhase` 경계 3개(11:54:59·11:55:00·11:55:05)가 테스트로 고정돼 있다 | ✓ VERIFIED | `lib/phase.test.ts` 6건 (자정 직후·11:54:59·11:55:00·11:55:04·11:55:05·23:59:59). **변이 점검(worktree):** `SPIN_MM` 55→56 시 정확히 3건 실패 — `11:55:00 정각부터 spinning 으로 넘어간다`, `애니메이션 5초 이내(11:55:04)는 여전히 spinning 이다`, `애니메이션이 끝나는 11:55:05 부터 decided 다` (SUMMARY 기록과 일치). 비주석 `msToNextPhase` 참조 0 |
| 13 | **[01-03]** `lib/errors.ts` 의 메시지 조립(에러 없음·빈 문자열·1건·여러 건)이 테스트로 고정돼 있다 | ✓ VERIFIED | `lib/errors.test.ts` 7건 (`formatLoadError` 2 + `joinLoadErrors` 5, 빈 문자열 분기 2건 포함). **변이 점검(worktree):** 필터를 `part !== null` 로 바꿔 빈 문자열 필터를 제거하면 2건 실패 |
| 14 | **[01-03]** 소스를 고의로 깨면 테스트가 실제로 실패한다 (변이 점검 통과) | ✓ VERIFIED | 검증자가 worktree 에서 4종 변이 직접 실행: `SPIN_MM` (3 fail), `KST_TZ` (15 fail), `joinLoadErrors` 필터 (2 fail), `parseMenuInput` 절단 제거 (2 fail). 전부 exit 1. 각 변이 후 `git checkout` 원복 → 36/36 |
| 15 | **[01-03]** `lib/phase.ts`·`lib/time.ts` 의 동작 코드는 한 줄도 바뀌지 않았다 | ✓ VERIFIED | `git diff 49d0643..HEAD -- lib/phase.ts` 0줄, `-- lib/time.ts` 0줄. 01-03 커밋 범위(`13f0b1b^..873cafe`)에서 `lib/phase.ts` 를 건드린 커밋 0건 (변이가 커밋되지 않음) |
| 16 | **[01-04]** 스크래치 테스트의 10개 케이스가 하나도 빠짐없이 vitest spec 으로 옮겨져 통과한다 | ✓ VERIFIED | `components/MenuList.test.ts` `it(` 10개, 이름 10개 모두 존재(`기본 쉼표 3개`…`잘린 뒤 중복도 제거`), `repeat(30)` 2회. `vitest list` 에 10건 등재, 전부 pass. 스크래치 `.planning/phases/01-safety-net/ref-parse.test.ts` 부재 확인 (`git log --all` 에도 0건 — 한 번도 추적된 적 없음, SUMMARY 의 "커밋 불가" 설명과 일치) |
| 17 | **[01-04]** `MENU_NAME_MAX_LEN` 의 정의처가 `lib/constants.ts` 한 곳이다 | ✓ VERIFIED | `grep -rn MENU_NAME_MAX_LEN app components lib` → 정의는 `lib/constants.ts:8` 뿐, 나머지는 `@/lib/constants` import(`app/page.tsx:6`, `components/MenuList.tsx:5`) 와 사용처(`:165`, `:38`) 및 주석. `lib/supabase/client.ts` 비주석 참조 0. `lib/constants.ts` 비주석 줄 = `export const MENU_NAME_MAX_LEN = 24;` 1줄, `process\.env\|@supabase\|from "react"` 0건 |
| 18 | **[01-04]** `parseMenuInput` 의 동작(쉼표 분리·trim·24자 절단·중복 제거·기존 제외)이 바뀌지 않았다 | ✓ VERIFIED | `git diff 49d0643..HEAD -- components/MenuList.tsx` 는 5~8행 import 3줄 교체뿐; `parseMenuInput` 본문(:34-44) 무변경. 변이 E (절단 제거) 가 2건을 잡으므로 spec 이 실제 동작을 붙잡고 있다 |
| 19 | **[01-04]** 환경변수 없이 `parseMenuInput` 을 import 하는 테스트가 통과한다 — supabase 클라이언트가 테스트 시점에 생성되지 않는다 | ✓ VERIFIED | HEAD: `env -u … npm test` exit 0. `components/MenuList.tsx:8` 의 supabase import 가 `import type { MenuRow }` 최상위 문 1줄뿐(`isolatedModules: true` 하에서 통째로 지워진다). **RED 재현(worktree @ `f0daba0`):** `env -u … npx vitest run` → `components/MenuList.test.ts (0 test)`, `Error: supabaseUrl is required.`, exit 1 — 분리 전에는 실제로 클라이언트 생성이 터졌다 (`supabase-js/dist/index.mjs:1487` 의 throw) |

**Score:** 19/19 truths verified

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | QUAL-01 의 spin_time 파싱·쿨다운 필터 단위 테스트 (코드 자체가 아직 없음) | Phase 3 | Phase 3 goal "추첨 시각 판정·쿨다운 필터·KST 변환을 … 테스트로 계약을 고정한다"; REQUIREMENTS.md traceability 가 QUAL-01 을 Phase 1 → Phase 3 로 분할 |
| 2 | CLAUDE.md:26 의 낡은 "lint 에러 1건 존재" 문장 (현재 lint 에러 0) | Phase 8 | SHIP-03 "CLAUDE.md·README.md가 현행화된다 (낡은 항목 4건 수정)" |

### Required Artifacts

`gsd-sdk query verify.artifacts` 4개 플랜 전부 `all_passed: true` (11/11). 아래는 검증자의 L2(실질)·L3(배선) 추가 확인.

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | next/eslint-config-next 16.3.5, `"test": "vitest run"` | ✓ VERIFIED | 두 버전 정확 고정, `test`·`test:watch` 스크립트, `vitest: "4.1.11"` devDependency |
| `package-lock.json` | `next-16.3.5.tgz` | ✓ VERIFIED | 3회 매치; `npm ls` 해석 버전 일치 |
| `lib/errors.ts` | `formatLoadError`, `joinLoadErrors` 순수 함수 | ✓ VERIFIED | 20줄, export 2개, import 0개, 순수성 grep 0건. 3 페이지에서 import·호출 (WIRED) |
| `components/ErrorBanner.tsx` | `role=alert` 공용 배너 | ✓ VERIFIED | 51줄, `"use client"` 첫 줄, `role="alert"` 1, `aria-label="닫기"` 1, `onCloseAction` 3, `satisfies Record<string, CSSProperties>` 1. 3 페이지 4회 사용 (WIRED). SSR 렌더 확인 |
| `vitest.config.mts` | include/exclude + `@` alias, `design/**` | ✓ VERIFIED | 42줄, `design/**` 1, `.planning` 2, `_shared` 3, `resolve.alias = [{ find: /^@\//, replacement: repoRoot }]`. 수집 실효 4개 |
| `lib/time.test.ts` | ≥30줄 | ✓ VERIFIED | 85줄, 13건, `@/lib/time` alias, 명시 `from "vitest"` |
| `lib/phase.test.ts` | ≥20줄 | ✓ VERIFIED | 33줄, 6건 |
| `lib/errors.test.ts` | ≥15줄 | ✓ VERIFIED | 40줄, 7건 |
| `lib/constants.ts` | `MENU_NAME_MAX_LEN` 순수 상수 | ✓ VERIFIED | 8줄, export 1개, import 0개. 2곳에서 import (WIRED) |
| `components/MenuList.test.ts` | ≥40줄, 10케이스 | ✓ VERIFIED | 50줄, `it(` 10 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `package.json` | `package-lock.json` | `npm install --save-exact` (`16.3.5`) | ✓ WIRED | `gsd-sdk verify.key-links` 는 `verified: false` (패턴 `16\\.3\\.5` 를 이스케이프 문자 포함 리터럴로 검색한 도구 오탐). 수동: `package.json` `"16.3.5"` 2회, lock `next-16.3.5.tgz` 3회 |
| `app/page.tsx` | `lib/errors.ts` | `joinLoadErrors` 로 3쿼리 합침 | ✓ WIRED | sdk verified + `:9` import, `:57` 호출, `formatLoadError` 3호출 |
| `app/log/page.tsx` | `components/ErrorBanner.tsx` | `loadError` 렌더 | ✓ WIRED | sdk verified + `:10` import, `:99` `<ErrorBanner message={loadError}>` |
| `app/rank/page.tsx` | `components/ErrorBanner.tsx` | `loadError` 렌더 | ✓ WIRED | sdk verified + `:10` import, `:71` 사용 |
| `lib/time.test.ts` | `lib/time.ts` | `@/lib/time` alias | ✓ WIRED | sdk verified; 실행 시 13건 통과 (alias 해석 실증) |
| `vitest.config.mts` | tsconfig paths | `resolve.alias` `replacement` | ✓ WIRED | sdk verified; `tsconfig.json:21-22` `"@/*": ["./*"]` 와 동치 |
| `components/MenuList.tsx` | `lib/constants.ts` | `@/lib/constants` 값 import | ✓ WIRED | sdk verified + `:5` |
| `components/MenuList.test.ts` | `components/MenuList.tsx` | `parseMenuInput` import | ✓ WIRED | sdk verified + `:7`, 10건 실행 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `app/page.tsx` `<ErrorBanner>` #1 | `loadError` | `joinLoadErrors([formatLoadError(…, menuRes.error), …todayRes.error, …pinRes.error])` ← `supabase.from(...).select()` 응답 `.error` | Yes — PostgREST 에러와 fetch 거부 모두 `{ error }` 로 도착 (postgrest-js `shouldThrowOnError=false` 기본, `.catch` 변환) | ✓ FLOWING |
| `app/page.tsx` `<ErrorBanner>` #2 | `actionError` | 쓰기 핸들러 4개의 `error.message` / `respin` 응답 | Yes (기존 경로, 무변경) | ✓ FLOWING |
| `app/log/page.tsx` `<ErrorBanner>` | `loadError` | `formatLoadError("기록", error)` ← `results` 3개월 윈도우 SELECT | Yes | ✓ FLOWING |
| `app/rank/page.tsx` `<ErrorBanner>` | `loadError` | `formatLoadError("랭킹", error)` ← `results` 전체 SELECT | Yes | ✓ FLOWING |

호출부에서 `message={null}`·`""` 하드코딩 0건. `initialLoadedRef.current = true` 가 여전히 초기 로드 IIFE 마지막 줄(`app/page.tsx:66`) — 휠 이중 회전 가드 보존.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 전체 스위트 통과 | `npm test` | exit 0, 4 files / 36 tests | ✓ PASS |
| 환경변수 없이 통과 | `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm test` | exit 0, 36/36 | ✓ PASS |
| 수집 범위 | `npx vitest list \| cut -d'>' -f1 \| sort -u` | 정확히 4줄 | ✓ PASS |
| 타입 | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| 린트 | `npm run lint` | exit 0, 출력 0 | ✓ PASS |
| 감사 | `npm audit --audit-level=high` / `--json` | exit 0 / total 0 | ✓ PASS |
| 빌드 | `rm -rf .next && NEXT_DISABLE_MEM_OVERRIDE=1 npm run build` | exit 0, 4 라우트 static | ✓ PASS |
| 변이: `SPIN_MM` 56 (worktree) | `npx vitest run` | 3 failed (경계 3건) | ✓ PASS (테스트가 문다) |
| 변이: `KST_TZ` UTC (worktree) | `npx vitest run` | 15 failed | ✓ PASS |
| 변이: `joinLoadErrors` 빈 문자열 필터 제거 (worktree) | `npx vitest run` | 2 failed | ✓ PASS |
| 변이: `parseMenuInput` 절단 제거 (worktree) | `npx vitest run` | 2 failed | ✓ PASS |
| 수집 제외 실효 (worktree) | `design/`·`.planning/`·`supabase/functions/spin-roulette/` 에 프로브 spec 심고 `vitest list` | 프로브 히트 0, 여전히 4 파일; `_shared` 양성 대조 히트 1 | ✓ PASS |
| `ErrorBanner` 렌더 (worktree) | `renderToStaticMarkup` 스팟 spec | null→`""`; 메시지→`role="alert"`+한국어 문구+닫기 버튼 | ✓ PASS |
| RED 01-03 재현 (worktree @ `13f0b1b`) | `npm test` | `npm error Missing script: "test"`, exit 1 | ✓ PASS (RED 진짜) |
| RED 01-04 재현 (worktree @ `f0daba0`) | `env -u … npx vitest run` | `MenuList.test.ts (0 test)`, `Error: supabaseUrl is required.`, exit 1 | ✓ PASS (RED 진짜) |
| TDD 커밋 순서 | `git log --reverse` | `13f0b1b test(01-03)` 15:32 → `873cafe feat(01-03)` 15:34; `f0daba0 test(01-04)` 15:42 → `fb1ca16 feat(01-04)` 15:43 | ✓ PASS |
| AI 표기 0건 | `git log $(git merge-base main HEAD)..HEAD --format=%B \| grep -icE 'co-authored\|generated with\|claude-session'` | 0 (커밋 20개) | ✓ PASS |
| 브랜치 | `git rev-parse --abbrev-ref HEAD` | `feat/restaurant-roulette` | ✓ PASS |
| lock 이름 집합 (01-03 vitest 설치) | `comm` on `"node_modules/…"` sets `1d8ddf4→873cafe` | added 60 / removed 0, `vitest`·`vite`·`rolldown` 포함 (SUMMARY 수치 일치) | ✓ PASS |
| lock 이름 집합 (01-04) | `873cafe→HEAD` | added 0 / removed 0 | ✓ PASS |

### Probe Execution

SKIPPED — `scripts/*/tests/probe-*.sh` 없음, PLAN/SUMMARY 에 probe 선언 없음. 위 Behavioral Spot-Checks 가 이 페이즈의 실행 검증이다.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| QUAL-01 | 01-03, 01-04 | `npm test`(vitest) 가 있고 순수 로직(`lib/phase.ts`, `lib/time.ts`, spin_time 파싱, 쿨다운 필터, `parseMenuInput`)에 단위 테스트가 있다 | ✓ SATISFIED (Phase 1 몫) | 러너 + time 13·phase 6·errors 7·parseMenuInput 10 = 36건 통과. spin_time 파싱·쿨다운 필터는 REQUIREMENTS traceability 대로 Phase 3 (Deferred #1) |
| QUAL-03 | 01-01 | `next` 16.3.5 범프, `npm audit` critical·high 0 | ✓ SATISFIED | Truth #2 |
| QUAL-04 | 01-02 | 3개 페이지 초기 SELECT 에러가 배너로 표면화 | ✓ SATISFIED (브라우저 확인 human) | Truth #3, #9, #10 |

**Orphaned requirements:** 없음 — REQUIREMENTS.md 의 Phase 1 행은 정확히 QUAL-01, QUAL-03, QUAL-04 이고 세 개 모두 PLAN frontmatter 에 선언돼 있다. 01-03 의 `checkpoint:human-verify`(vitest 정당성) 는 SUMMARY 에 `approved, vitest@4` 승인 기록이 있는 **과거** 게이트이며 미결 항목이 아니다. PLAN 4개에 `<human-check>` 지연 블록은 없다.

### Anti-Patterns Found

페이즈가 수정·생성한 13개 파일 스캔. `TBD|FIXME|XXX` 0건 (블로커 게이트 통과), `TODO|HACK|PLACEHOLDER` 0건.

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `.planning/phases/01-safety-net/01-01-SUMMARY.md` | "Files Created/Modified" · "가드 (c)" | "패키지 이름 집합 불변" / "신규·제거 lock 경로 0개" 를 플랜 전체에 대한 사실처럼 서술 | ℹ️ Info | audit-fix 커밋(`d1f1ec6→1d8ddf4`)은 실제로 0/0 이지만, 범프 커밋(`49d0643→d1f1ec6`) 은 `@img/sharp-freebsd-wasm32`, `@img/sharp-webcontainers-wasm32`, `@img/sharp-wasm32/node_modules/@emnapi/runtime` 3개 추가(전부 `optional: true`, 이 머신 미설치) + 중첩 `next/node_modules/postcss` 1개 제거. 플랜의 가드 (c) 는 "audit fix 직전" 을 기준선으로 명시했으므로 **수용 조건 위반은 아니다**. 공급망 노출 실질 증가 없음(기존 `sharp` 의 플랫폼 변형). Phase 8 PR 설명에 이 4개 항목을 적어 두길 권고 |
| `CLAUDE.md` | 26 | "2026-09-15 기준 lint 에러 1건 존재" — 현재 lint 에러 0 | ℹ️ Info | 낡은 문서 문장. 01-03 이 명시적으로 Phase 8(SHIP-03) 로 이관 (Deferred #2) |
| `components/MenuList.tsx` | 86 | `placeholder=` | — (오탐) | HTML `<input placeholder>` 속성, 기존 코드. 스텁 아님 |
| `app/page.tsx` | 277 | `respinStyles.hint` | — (오탐) | 스타일 키. 에러 `.hint` 노출 아님(기준선에도 존재) |

### 반증 점검 (Confirmation Bias Counter)

1. **부분 충족 요구사항:** QUAL-01 — spin_time 파싱·쿨다운 필터 테스트는 없다. 코드가 아직 없고 REQUIREMENTS 가 Phase 3 로 분할했으므로 Deferred 로 분류(지시 사항과 일치).
2. **통과하지만 동작을 검증하지 않는 테스트:** 4종 변이가 모두 대응 spec 을 실패시켰으므로 발견하지 못했다. 가장 약한 지점은 `kstParts` 자정 케이스가 7필드 중 3필드만 검사하는 것인데, 첫 케이스가 `toEqual` 로 전체를 잡으므로 실질 공백은 아니다.
3. **테스트 없는 에러 경로:** (a) 페이지 수준 `setLoadError` 배선은 grep 으로만 확인됐다 — 페이지는 supabase 클라이언트를 값으로 import 하므로 환경변수 없이 로드할 수 없고 jsdom 도 없다. `ErrorBanner` 단독 렌더는 SSR 스팟 체크로 대체했고, 실제 화면은 Human Verification 으로 넘긴다. (b) Realtime `subscribe` 실패·재연결 실패는 여전히 조용하다 — 01-02 SUMMARY 가 범위 밖으로 명시했고 이 페이즈 SC 에 없다.

Inversion 3건 점검 결과: (a) "fetch 거부 시 `Promise.all` 이 reject 되어 배너를 우회" → postgrest-js 가 기본 설정에서 `.catch` 로 `{ error }` 변환함을 소스로 확인, 우회 없음. (b) "`env -u` 통과가 vitest 의 `.env.local` 자동 로드 덕분" → `f0daba0` 에서 같은 명령이 `supabaseUrl is required` 로 실패하므로 환경변수는 실제로 비어 있었다. (c) "`import type` 이 런타임에 남아 클라이언트가 로드됨" → HEAD 에서 `env -u` 통과가 직접 반증.

### Human Verification Required

#### 1. 3개 페이지 초기 SELECT 실패 배너 브라우저 확인

**Test:** 초기 SELECT 실패를 유발한다 — `.env.local` 의 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 를 일시적으로 틀린 값으로 바꾸거나 개발자도구 Network 에서 `*.supabase.co` 를 차단한다. 검증자 규칙상 `npm run dev` 는 띄우지 않았으므로(커널 패닉 전례) `npm run build && npm start` 또는 가드런처로 `/`, `/log`, `/rank` 를 연다. 확인 후 `.env.local` 을 원복한다.
**Expected:** 세 페이지 모두 빈 화면이 아니라 빨간 테두리 `role=alert` 배너. 오늘 탭 `메뉴 목록 불러오기 실패: …`(복수 실패 시 ` · ` 로 이어진 한 줄, "오늘 결과 없음" 정상 상태에서는 배너 없음), 기록 탭 `기록 불러오기 실패: …`, 랭킹 탭 `랭킹 불러오기 실패: …`. × 로 닫힘. 오늘 탭 배너 아래에 휠·메뉴 목록 골격 유지. SQL 조각·환경변수 값 미노출.
**Why human:** 시각 렌더링과 외부 서비스 실패 주입이 필요하다. 배선(3 페이지)과 `ErrorBanner` SSR 출력은 기계 검증했지만 실제 브라우저·실제 실패 응답 조합은 grep·SSR 로 대체할 수 없다.

### Gaps Summary

차단 gap 없음. ROADMAP Success Criteria 4개와 "로컬 검증" 요구, PLAN truths 전부가 코드베이스에서 확인됐고, SUMMARY 가 서술한 변이 점검·RED 실패·수집 제외는 검증자가 별도 worktree 에서 재현해 사실임을 확인했다. TDD 게이트(`test(...)` → `feat(...)`)와 AI 표기 0건, `main`·`supabase/**` 무변경도 git 으로 확인했다.

상태가 `passed` 가 아니라 `human_needed` 인 이유는 단 하나 — SC3 "한국어 에러 배너가 뜬다" 는 시각적·외부 서비스 의존 결과라 최종 확인은 브라우저에서 사람이 해야 한다. 그 외 발견 사항은 Info 2건(01-01 SUMMARY 의 lock 이름 집합 서술이 audit-fix 단계에만 참, CLAUDE.md 낡은 lint 문장 — 후자는 Phase 8 소관)이며 페이즈 목표 달성에 영향이 없다.

---

_Verified: 2026-09-18T06:55:00Z_
_Verifier: Claude (gsd-verifier)_
