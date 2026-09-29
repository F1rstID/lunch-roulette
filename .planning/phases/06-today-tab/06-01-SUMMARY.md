---
phase: 06-today-tab
plan: 01
subsystem: pure-logic
tags: [vitest, tdd, reducer, generic, realtime, join, filter, spin-time, postgrest-error]

# Dependency graph
requires:
  - phase: 05-restaurants-tab
    provides: "lib/restaurants.ts 의 Realtime 병합 리듀서(pending 버퍼 포함) — lib/rowset.ts 가 일반화한 원본. 05-REVIEW CR-01·IN-02 의 결론도 여기서 온다"
  - phase: 03-pure-logic
    provides: "lib/settings.ts / lib/useSettings.ts 의 순수 모듈 + I/O 훅 가름과 loaded 가드 논증 — D-04 가 같은 형태로 다시 쓴 자리"
  - phase: 02-data-model
    provides: "0005 의 candidates(PK restaurant_id · cascade) · results.restaurant_id(set null) · 자정 재시드 한 문장 insert — 3단 정렬과 isNewSpin 의 근거"
  - phase: 01-safety-net
    provides: "lib/constants.ts · lib/errors.ts · parseMenuInput 회귀 spec 13건"
provides:
  - "lib/rowset.ts — 목록 병합 규칙 한 벌(103줄). createRowSetReducer(keyOf) · initialRowSetState · RowChange/RowSetState/RowSetAction. React·supabase 값 import 0"
  - "lib/candidates.ts — 오늘 후보 도메인(116줄). joinCandidates · filterRestaurantsByName · listTodayRows · findWinnerIndex · isNewSpin + candidatesReducer/INITIAL_CANDIDATES_STATE · TodayCandidate/TodayRow/CandidatesState/CandidatesAction"
  - "lib/menus.ts — parseMenuInput · truncateToCodePoints 의 새 정의처(30줄). lib/ → components/ 단방향 예외가 코드에서 사라졌다"
  - "lib/phase.ts displayPhase — 설정 로드 전 stalled 라벨 가림"
  - "lib/time.ts formatSpinTime · addMinutesToSpinTime — 화면 추첨 시각 문구의 조립처"
  - "lib/errors.ts formatCandidateWriteError + CandidateWriteAction — 담기 23505 는 null"
  - "lib/settings.ts · lib/restaurants.ts 의 fetched/changed 2액션 — 06-02 의 useCandidates 가 그대로 복제할 형태"
affects: [06-02-today-ui, 07-history-rank]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "목록 병합 규칙을 제네릭 한 벌로 두고 키 함수만 주입한다 — 도메인이 정하는 것은 '무엇이 같은 행인가' 뿐"
    - "리듀서 액션이 조회 응답을 그대로 받는다(fetched: rows + error) — 성공·실패의 가름이 훅이 아니라 spec 을 지난다"
    - "훅의 취소 플래그를 분기가 아니라 '보낼 곳 교체'로 처리해 훅 본문의 if 를 0개로 유지한다"
    - "Realtime UPDATE 는 upsert — payload.new 가 전체 행이므로 모르는 키는 추가가 안전하다"
    - "정렬 키를 3단까지 내려 완전 순서를 만든다 — 동률 구간의 물리 순서 의존을 없앤다"

key-files:
  created:
    - lib/rowset.ts
    - lib/rowset.test.ts
    - lib/candidates.ts
    - lib/candidates.test.ts
    - lib/menus.ts
  modified:
    - lib/menus.test.ts
    - lib/restaurants.ts
    - lib/restaurants.test.ts
    - lib/settings.ts
    - lib/settings.test.ts
    - lib/useSettings.ts
    - lib/useRestaurants.ts
    - lib/phase.ts
    - lib/phase.test.ts
    - lib/time.ts
    - lib/time.test.ts
    - lib/errors.ts
    - lib/errors.test.ts
    - components/MenuList.tsx
    - app/page.tsx

key-decisions:
  - "목록 병합 규칙의 구현을 lib/rowset.ts 한 벌로 뽑고 키만 주입한다 — restaurants 는 id, candidates 는 restaurant_id. 두 벌로 두면 CR-01 급 버그가 한쪽에만 고쳐지는 날이 온다 (D-03)"
  - "리듀서 액션을 fetched/changed 둘로 합쳤다 — fetched 가 rows 와 error 를 함께 받아 '에러가 있으면 행이 와도 실패' 판정이 리듀서 spec 을 지난다. 그 결과 훅 두 개에 if 가 0개다 (D-04, todo in-03 닫음)"
  - "제네릭 리듀서의 UPDATE 는 모르는 키의 행을 추가한다(upsert) — payload.new 가 전체 행이라 안전하고 재연결 틈에 놓친 INSERT 를 복구한다. 변경 스트림이 순서를 보장해 DELETE 뒤 같은 키의 UPDATE 로 되살아나는 일은 없다 (D-05 · 05-REVIEW IN-02)"
  - "후보 정렬은 candidates.created_at → restaurants.created_at → 매장 id 3단이고 SQL 은 바꾸지 않았다 — 자정 재시드가 한 문장 insert 라 첫 키가 전부 동률이고 두 번째 키가 핀을 꽂은 순서를 복원한다 (D-06, todo wr-02 닫음)"
  - "당첨은 restaurant_id 로만 찾고 이름 폴백을 두지 않는다 — 이름으로 되찾으면 동명 매장이 오인되고 컷오버 전 구 결과는 메뉴명이라 매장과 맞을 수 없다. null 이면 -1 로 떨어져 휠 하이라이트만 사라진다 (D-07 · T-06-05)"
  - "담기 중 23505 는 문장이 아니라 null 이다 — 두 사람이 같은 매장을 동시에 담은 것이고 원하던 상태가 이미 됐다. 빼기에는 같은 논증이 서지 않아 일반 실패 문장으로 떨어진다 (D-17)"
  - "parseMenuInput·truncateToCodePoints 를 lib/menus.ts 로 옮기고 components/MenuList.tsx 에 재수출을 두지 않았다 — 정의처가 둘로 보이면 어느 쪽을 고쳐야 하는지 알 수 없다 (D-24)"
  - "훅의 취소 플래그를 if 가 아니라 '보낼 곳 교체'(let send = dispatch → cleanup 에서 빈 함수)로 바꿨다 — D-04 가 요구한 '훅에 if 0개' 를 문면 그대로 만족시키면서 언마운트 후 갱신 방지는 그대로다 (플래너 미명시 구간의 판단)"

patterns-established:
  - "제네릭 계약 spec(lib/rowset.test.ts)과 인스턴스 배선 spec(lib/restaurants.test.ts)을 의도적으로 겹쳐 둔다 — 두 파일 머리 주석에 역할 분담을 적어 한쪽이 '중복' 으로 지워지지 않게 한다"
  - "게이트 토큰을 한글 표현으로 바꿔 주석에 쓴다 — '목록 리듀서'·'표시용 보정'·'코드포인트 배열로 펼친'(Phase 2·3·4·5 의 같은 결정 재적용)"

requirements-completed: []  # 06-02 의 마지막 태스크가 CAND·SPIN 을 한 번에 찍는다 (Phase 2·4·5 선례)

# Metrics
duration: 23min
completed: 2026-09-29
---

# Phase 6 Plan 01: 오늘 후보 도메인 순수 로직 Summary

**목록 병합 규칙을 제네릭 한 벌(`lib/rowset.ts`)로 뽑아 매장·후보 두 도메인이 키만 주입해 쓰게 하고, 오늘 후보의 조인·정렬·필터·당첨 판정·에러 번역·시각 포맷터를 렌더 하네스 없이 검증되는 순수 함수로 세웠다 — `npm test` 296 → 354건, 훅 두 개에 `if` 0개, 게이트 5종 전부 exit 0**

## Performance

- **Duration:** 23min (2026-09-29T03:00Z → 03:23Z)
- **Tasks:** 2/2 (RED → GREEN)
- **Files modified:** 21 (신규 5 + 수정 15 + 삭제 1 — 삭제는 `components/MenuList.test.ts` 의 이동분이다)

## Accomplishments

- **병합 규칙의 구현이 레포에 한 벌이 됐다.** `lib/rowset.ts` 103줄이 `fetched`/`changed` 2액션 · `pending` 버퍼 재적용 · 중복 INSERT 멱등 · DELETE 키 없음 · UPDATE upsert 를 전부 들고, `lib/restaurants.ts` 와 `lib/candidates.ts` 는 각각 `(row) => row.id` · `(row) => row.restaurant_id` 를 주입한 4줄짜리 인스턴스만 남겼다. `lib/restaurants.ts` 는 186줄 → **103줄**로 줄었고 `const exhaustive: never = action;` 도 `lib/rowset.ts` 로 넘어갔다(grep 0/1).
- **훅에 판정이 한 줄도 남지 않았다.** `lib/useSettings.ts`·`lib/useRestaurants.ts` 의 `grep -cE '^[[:space:]]*(if|\} else)'` 가 **둘 다 0**이다. `if (error) … else …` 는 `fetched` 액션 한 줄로 내려갔고, `useSettings` 의 `payload.eventType === "DELETE" ? null : …` 삼항도 사라졌다(DELETE 에서 `payload.new` 가 빈 객체로 와도 리듀서가 보지 않는다). CLAUDE.md 의 "훅에는 I/O 만 두고 판단은 순수 모듈로" 가 비로소 문면 그대로 참이다.
- **휠 순서·목록 배지·당첨 인덱스의 정의처가 하나가 됐다.** `joinCandidates` 가 3단 정렬(후보 시각 → 매장 시각 → 매장 id)로 완전 순서를 만들고, `listTodayRows` 의 `slice` 는 필터와 무관한 휠 인덱스이며, `findWinnerIndex` 는 `restaurant_id` 로만 찾는다. 26건이 그 경계를 든다.
- **화면에 보일 추첨 시각 문구의 조립처가 생겼다.** `formatSpinTime`(0 패딩) · `addMinutesToSpinTime`(24시간 순환, 음수 보정 포함)이 `lib/time.ts` 에 들어갔고 `SpinTime` 은 `import type` 으로만 만난다. 06-02 가 이 둘로 `11:55` 리터럴을 지운다.
- **접은 todo 셋이 코드로 닫혔다.** in-02 → `displayPhase` · in-03 → 훅 분기 0개 · wr-02 → 3단 정렬. 파일 `git rm` 은 06-02 소관이다(D-26).
- **`lib/` → `components/` 단방향 예외가 코드에서 사라졌다.** `grep -rn '@/components/' lib` → **0줄**.

## Task Commits

1. **Task 1 (RED): spec 9파일 — 354건 계약을 먼저 못 박음** — `8788126` (test)
   - 신규 `lib/rowset.test.ts`(14) · `lib/candidates.test.ts`(26) / 이동 `components/MenuList.test.ts` → `lib/menus.test.ts`(13, 기대값 불변) / 수정 `lib/restaurants.test.ts`·`lib/settings.test.ts`·`lib/phase.test.ts`·`lib/time.test.ts`·`lib/errors.test.ts`
2. **Task 2 (GREEN): 순수 모듈 3개 신규 + 리듀서 일반화 + 훅 액션 이관** — `6b4c8d1` (feat)
   - 신규 `lib/rowset.ts`·`lib/candidates.ts`·`lib/menus.ts` / 수정 `lib/restaurants.ts`·`lib/settings.ts`·`lib/useSettings.ts`·`lib/useRestaurants.ts`·`lib/phase.ts`·`lib/time.ts`·`lib/errors.ts`·`components/MenuList.tsx`·`app/page.tsx`

두 커밋 모두 `git log -1 --format=%B | grep -viE 'CLAUDE\.md' | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**, `git show --name-only --format= HEAD | grep -cE '\.serena/|config\.json'` → **0**. GREEN 커밋의 파일 삭제는 **0건**(`git diff --diff-filter=D HEAD~1 HEAD` 빈 출력).

## RED 두 형태의 차이 (명령 출력 원문)

`npx vitest run` → **exit 1** · `Test Files  8 failed | 5 passed (13)` · `Tests  39 failed | 262 passed (301)`.

**모듈 부재 3파일은 수집 자체가 실패해 어서션이 집계되지 않는다** — `lib/rowset.test.ts`(14) · `lib/candidates.test.ts`(26) · `lib/menus.test.ts`(13) 가 `(0 test)` 로 뜬다:

```
 ❯ lib/menus.test.ts (0 test)
 ❯ lib/rowset.test.ts (0 test)
 ❯ lib/candidates.test.ts (0 test)
 FAIL  lib/candidates.test.ts [ lib/candidates.test.ts ]
```

**나머지 5파일은 단언 실패**다 — vitest 가 없는 named export 를 `undefined` 로 바인딩하므로 spec 이 수집되고 호출에서 터지거나(`TypeError: addMinutesToSpinTime is not a function`), 바뀐 액션 형태가 리듀서의 `default` 절로 떨어져 값이 어긋난다:

```
 ❯ lib/errors.test.ts (28 tests | 5 failed)
 ❯ lib/settings.test.ts (30 tests | 9 failed)
 ❯ lib/time.test.ts (20 tests | 7 failed)
 ❯ lib/phase.test.ts (20 tests | 4 failed)
 ❯ lib/restaurants.test.ts (53 tests | 14 failed)
```

RED 시점 `npx tsc --noEmit` → exit 2, 총 59줄:

| 코드 | 건수 | 뜻 |
|---|---|---|
| `TS2307` | **3** | `@/lib/rowset`·`@/lib/candidates`·`@/lib/menus` 부재 (인수 조건 = 3 ✓) |
| `TS2305` | 4 | `displayPhase`·`formatSpinTime`·`addMinutesToSpinTime`·`formatCandidateWriteError` 미존재 |
| `TS2322`·`TS2353` | 37·3 | `fetched` 액션이 아직 옛 유니온에 없음 |
| `TS7006` | 12 | 위 부재의 파생 — 모듈이 없어 `.map((c) => …)` 파라미터가 암시적 any |

## 검증 수치 (명령 출력 기준, 추정 없음)

### 게이트 5종

| 명령 | 기준선(165d8da) | RED(8788126) | GREEN(6b4c8d1) |
|---|---|---|---|
| `npm test` | exit 0 · `Test Files  11 passed (11)` / `Tests  296 passed (296)` | exit 1 · `8 failed \| 5 passed (13)` / `39 failed \| 262 passed (301)` | exit 0 · **`Test Files  13 passed (13)`** / **`Tests  354 passed (354)`** |
| `npx tsc --noEmit` | exit 0 | exit 2 (59줄) | exit **0** |
| `npm run lint` | exit 0 | exit **0** | exit **0** |
| `npm run build` | exit 0 | exit **1** (아래 Deviation 1) | exit **0** |
| `npm run check:edge` | exit 0 | exit **0** | exit **0** (무영향 확인 — `supabase/functions/**` 무변경) |

### 테스트 증분 (296 → 354, +58)

| 파일 | 전 | 후 | 증분 | `describe` |
|---|---|---|---|---|
| `lib/rowset.test.ts` | — | 14 | **+14** | 3 |
| `lib/candidates.test.ts` | — | 26 | **+26** | 6 |
| `lib/menus.test.ts` | 13(구 `components/MenuList.test.ts`) | 13 | **0** (이동) | 1 |
| `lib/phase.test.ts` | 16 | 20 | **+4** | 4 → 5 |
| `lib/time.test.ts` | 13 | 20 | **+7** | 5 → 7 |
| `lib/errors.test.ts` | 23 | 28 | **+5** | 4 → 5 |
| `lib/settings.test.ts` | 28 | 30 | **+2** | 5 |
| `lib/restaurants.test.ts` | 53 | 53 | **0** (액션 이관 + D-05 반전) | 6 |
| `_shared`·`migrations` 4파일 | 150 | 150 | 0 | — |

`lib/restaurants.test.ts` 의 `it(` 은 48이고 `it.each` 1건이 6케이스로 펼쳐져 어서션이 53이다(플랜 기대와 일치).

### 토큰 카운트 (인수 조건, `grep -c`)

| 대상 | 토큰 | 기준 | 실측 |
|---|---|---|---|
| `lib/rowset.ts` | `^export function createRowSetReducer` / `^export function initialRowSetState` | 1 / 1 | **1 / 1** |
| `lib/rowset.ts`·`candidates.ts`·`menus.ts` | `from "react"\|useState\|useEffect\|createClient` | 0 | **0 / 0 / 0** |
| `lib/candidates.ts` | `import type` / `^import \{ .*\} from "@/lib/supabase/client"` | ≥1 / 0 | **2 / 0** |
| `lib/candidates.ts` | `^export function (joinCandidates\|filterRestaurantsByName\|listTodayRows\|findWinnerIndex\|isNewSpin)` | 5 | **5** |
| `lib/candidates.ts` | `normalize("NFC")` / `restaurant_id` | 2 / ≥1 | **2 / 5** |
| `lib/menus.ts` | `^export function (parseMenuInput\|truncateToCodePoints)` / `Array.from(` | 2 / 1 | **2 / 1** |
| `components/MenuList.tsx` | `Array.from(` / `export function parseMenuInput` / `export function truncateToCodePoints` / `from "@/lib/menus"` | 0 / 0 / 0 / 1 | **0 / 0 / 0 / 1** |
| `lib/restaurants.ts` | `from "@/lib/menus"` / `@/components/MenuList` / `from "@/lib/rowset"` / `const exhaustive: never = action;` | 1 / 0 / 1 / 0 | **1 / 0 / 1 / 0** |
| `lib/rowset.ts` | `const exhaustive: never = action;` | 1 | **1** |
| `lib/useSettings.ts`·`lib/useRestaurants.ts` | `type: "loaded"` / `type: "failed"` / `type: "fetched"` | 0 / 0 / 1 | **0 / 0 / 1** (두 파일 모두) |
| `lib/useSettings.ts`·`lib/useRestaurants.ts` | `^[[:space:]]*(if\|\} else)` | 0 | **0 / 0** |
| `lib/useRestaurants.ts` | `table: "restaurants"` / `event: "*"` | 3 / 0 | **3 / 0** |
| `lib/phase.ts`·`lib/time.ts` | `export function displayPhase` / `formatSpinTime` / `addMinutesToSpinTime` / `import type { SpinTime }` | 1 / 1 / 1 / 1 | **1 / 1 / 1 / 1** |
| `lib/errors.ts` | `export function formatCandidateWriteError` / `23503` / `error\.(details\|hint)` | 1 / 1 / 0 | **1 / 1 / 0** |
| `app/page.tsx` | `truncateToCodePoints`(import+호출) / `"no_candidates"` | 2 / 1 | **2 / 1** |
| `lib` 전체 | `@/components/` | 0줄 | **0줄** |
| spec | `supabase/client` / `lib/constants` / `testing-library\|jsdom` (rowset·candidates) | 0 | **0 / 0 / 0** (두 파일 모두) |

게이트 토큰(`createRowSetReducer`·`formatCandidateWriteError`·`displayPhase`·`Array.from(`·`normalize("NFC")`)은 주석 문안에 리터럴로 쓰지 않았다 — "목록 병합 규칙"·"후보 쓰기 실패 번역"·"표시용 보정"·"코드포인트 배열로 펼친"·"완성형과 같은 모양으로 맞춘" 으로 대체했다.

### 무변경·범위 확인

| 항목 | 결과 |
|---|---|
| `git diff --stat -- package.json package-lock.json` | **0줄** (신규 npm 패키지 0개 — 이 페이즈의 불변식) |
| `git diff --numstat -- app/page.tsx` 줄합 | **3** (기준 4 이하). import 한 줄이 둘로 갈렸을 뿐이고 realtime 핸들러·`winnerIndex`·쓰기 핸들러·문구 함수·렌더 무접촉 |
| `git status --porcelain -- supabase/` | **0줄** — `supabase/functions/**`·`supabase/migrations/**` 무변경 |
| `test -f deno.lock` | exit **1** (루트 lock 미생성) · `supabase/functions/deno.lock` diff 0줄 |
| 미추적 파일 | `git status --short \| grep '^??'` → **0건** |
| 소스 줄수 | `lib/rowset.ts` 103(기준 80↑) · `lib/candidates.ts` 116(110↑) · `lib/menus.ts` 30(20↑) · `lib/restaurants.ts` 186 → **103** |
| 라이브 | 배포·원격 SQL·`git push`·`npm install`·`npm run dev` **0회** |

## Deviations from Plan

### 1. `npm run build` 는 RED 커밋에서 exit 0 이 될 수 없다 (플랜 인수 조건의 내부 모순 — 05-01 과 같은 항목)

- **플랜 원문:** Task 1 인수 조건이 `npx tsc --noEmit 2>&1 | grep -c 'TS2307'` → `3` 과 `npm run build` → exit 0 을 **동시에** 요구한다.
- **실측:** RED 시점 `npm run build` → **exit 1**. 다만 컴파일 단계는 성공했다 — `✓ Compiled successfully in 461ms` → `Running TypeScript ...` 에서 멈춘다.
- **더 강한 동등 검사:** 빌드가 나열한 타입 에러 59줄을 `npx tsc --noEmit` 출력 59줄과 정렬 비교해 **바이트 단위로 동일**함을 확인했다(`diff` 무출력). 즉 빌드 실패는 코드가 깨진 것이 아니라 같은 TypeScript 프로그램(`tsconfig.json` 의 `include: ["**/*.ts"]` 가 spec 을 포함한다)의 tsc 실패가 그대로 비친 것이다.
- **처리:** 실행자 규칙이 RED 에 허용한 예외(`tsc` 적색 정상)의 파생으로 보고 진행. GREEN 에서 `npm run build` exit **0**.

### 2. RED 의 실패 건수가 플랜 예고(40)보다 하나 적은 39다 — `lib/settings.test.ts` 9 vs 10

- **플랜 원문:** "예상 집계는 `Test Files  8 failed | 5 passed (13)` · `Tests  40 failed | 261 passed (301)` 이고(내역: phase 4 · time 7 · errors 5 · restaurants 14 · settings 10)".
- **실측:** 파일 수는 **정확히 일치**(8 failed | 5 passed). 건수는 phase **4** · time **7** · errors **5** · restaurants **14** · settings **9** = **39**.
- **원인:** `lib/settings.test.ts` 의 `it("리듀서는 넘겨받은 state 를 변형하지 않는다")` 는 액션을 `fetched` 로 바꿔도 초록으로 남는다. 유일한 단언이 `expect(INITIAL_SETTINGS_STATE.loaded).toBe(false)` 이고, 리듀서가 그 액션을 모르면 `default` 절로 떨어져 액션 객체를 돌려줄 뿐 **초기 상수를 건드리지 않기 때문**이다. 즉 이 spec 은 액션 이름과 무관하게 불변성만 본다 — 플랜이 "loaded/failed 를 쓰는 8건 + 신규 2건 = 10건이 적색" 으로 셀 때 이 한 건이 신규 2건 중 하나가 아니라 기존 8건 밖의 setup-만-바뀐 건이라는 점을 놓쳤다.
- **판정:** 게이트는 exit code(1)와 파일 수(8/5)로 통과. GREEN 에서 30건 전부 초록.

### 3. 훅의 취소 플래그를 `if` 없이 다시 썼다 (플랜 미명시 구간의 판단)

- **충돌:** 인수 조건 `grep -cE '^[[:space:]]*(if|\} else)' lib/useSettings.ts` → `0` 은 판정 분기뿐 아니라 기존 `if (cancelled) return;`(언마운트 가드)까지 센다. 플랜의 `<action>` 은 그 줄을 언급하지 않았고, D-04 원문은 "세 훅에 `if` 가 0개가 된다" 로 못 박는다.
- **판단:** 가드를 지우지 않고 형태만 바꿨다 — `let send: typeof dispatch = dispatch;` 를 effect 안에 두고 cleanup 에서 `send = () => {};` 로 교체한다. 언마운트 후 상태 갱신 방지는 그대로이고 훅 본문에는 분기문이 남지 않는다. `cancelled || dispatch(...)` 형태를 쓰지 않은 이유는 `no-unused-expressions` 계열 lint 위험이다.
- **영향:** 두 훅 모두 `if` 0개 (실측). `useRestaurants` 의 INSERT/UPDATE/DELETE **3분기 구독은 그대로 3건**이다(`table: "restaurants"` → 3).

### 4. `git show --name-only --format= HEAD` 가 RED 커밋에서 9줄이 아니라 8줄로 보인다

- **원인:** git 의 기본 rename 검출이 `components/MenuList.test.ts → lib/menus.test.ts`(유사도 87%)를 한 줄로 접는다.
- **더 강한 동등 검사:** `git show --name-only --format= --no-renames HEAD` → **정확히 9줄**이고 구 경로의 삭제가 커밋에 들어 있다. 목록도 플랜이 나열한 아홉 경로와 일치.

### 5. gsd-sdk 문자열 버그 수동 정규화

- `state.record-metric` 이 위치 인자를 거부(`{"error":"phase, plan, and duration required"}`) → `--phase/--plan/--duration/--tasks/--files` 플래그로 재호출해 성공.
- `state.add-decision` 이 `--summary` 를 요구하고, 본문이 아니라 **요약만** 기록하며 `- [Phase ?]:` 접두를 붙였다(7줄) → 접두를 `[Phase 6]` 으로 고치고 첫 줄의 잘린 문장을 전문으로 복원.
- `state.advance-plan`·`state.record-session` 이 `stopped_at`·`last_activity`(frontmatter)와 `Status:`·`Last activity:`(본문)·`Session Continuity` 를 옛 값("Phase 6 context gathered — ready to plan")으로 되돌림 → 현재 사실로 직접 수정.
- `roadmap.update-plan-progress 6` 은 SUMMARY 파일을 만들기 전에 부르면 `summary_count: 0` 을 돌려준다 → SUMMARY 작성 후 재호출.

## 06-02 가 읽을 계약

| 이름 | 위치 | 모양 |
|---|---|---|
| `createRowSetReducer` · `initialRowSetState` | `lib/rowset.ts` | `<Row>(keyOf: (row: Row) => string)` → 리듀서 / `<Row>(): RowSetState<Row>` |
| `RowSetState<Row>` · `RowSetAction<Row>` · `RowChange<Row>` | 〃 | `{ rows; loaded; error; pending }` / `fetched(rows,error)` · `changed(INSERT\|UPDATE, row)` · `changed(DELETE, key)` |
| `CandidatesState` · `CandidatesAction` · `INITIAL_CANDIDATES_STATE` · `candidatesReducer` | `lib/candidates.ts` | `useCandidates` 가 그대로 `useReducer` 에 넣는다. 키는 `restaurant_id` |
| `TodayCandidate` | 〃 | `{ id; name; menus; location; pinned; addedAt }` |
| `TodayRow` | 〃 | `{ restaurant: RestaurantRow; slice: number \| null }` — `slice`=null 이면 미담김 |
| `joinCandidates` | 〃 | `(CandidateRow[], RestaurantRow[]) => TodayCandidate[]` (3단 정렬, 입력 불변) |
| `filterRestaurantsByName` | 〃 | `(RestaurantRow[], query) => RestaurantRow[]` (이름만, NFC+소문자) |
| `listTodayRows` | 〃 | `(TodayCandidate[], RestaurantRow[], query) => TodayRow[]` — 컴포넌트가 직접 부른다(D-15) |
| `findWinnerIndex` | 〃 | `({ id }[], ResultRow \| null) => number` — `restaurant_id` 로만, 없으면 -1 |
| `isNewSpin` | 〃 | `(ResultRow \| null, ResultRow) => boolean` — `applyResult` 의 회전 가드(D-08) |
| `displayPhase` | `lib/phase.ts` | `(Phase, settingsLoaded) => Phase` — 4개 페이지가 `currentPhase(...)` 를 감싼다(D-23) |
| `formatSpinTime` · `addMinutesToSpinTime` | `lib/time.ts` | `(SpinTime) => "HH:mm"` / `(SpinTime, number) => SpinTime` (24시간 순환) |
| `formatCandidateWriteError` · `CandidateWriteAction` | `lib/errors.ts` | `(action, name, { code?, message }) => string \| null` · `"담기" \| "빼기"`. **null 은 성공으로 처리한다** |

### 후속 조건 (전부 06-02)

1. **문서의 단방향 예외 문단은 아직 남아 있다.** 코드에서는 사라졌지만 `CLAUDE.md:44`("**예외 1곳**: `lib/restaurants.ts` 가 `components/MenuList.tsx` 의 `parseMenuInput` 을…")과 `.planning/codebase/STRUCTURE.md:79`(같은 취지) · `:125`(`components/MenuList.tsx:31: parseMenuInput`) · `:182`(컴포넌트 안 순수 함수 예시)가 그대로다. D-28 이 지운다.
2. **`formatHhMm` 은 06-02 이후 소비처가 0이 되지만 삭제하지 않았다.** 현재 유일한 호출부가 `components/MenuList.tsx:129`(06-02 가 파일째 지운다)다. 남기는 이유: `lib/time.test.ts` 가 계약 3건을 들고 있고 Phase 7(기록·랭킹)이 쓸 가능성이 있다. 플랜 `<execution_notes>` 의 명시 지시이기도 하다.
3. `lib/constants.ts` 의 `MENU_NAME_MAX_LEN` 주석은 아직 `menus.name / pinned_menus.name` 을 가리킨다 — 06-02 Task 3 이 `MenuRow`·`PinnedMenuRow` 를 지울 때 함께 고친다(D-24, 같은 사실을 두 번 고치지 않는다).
4. 접은 todo 4건의 `git rm` 은 06-02 다(D-26). 이 플랜은 코드로만 닫았다.

## `lib/rowset.test.ts` 와 `lib/restaurants.test.ts` 의 의도적 중복

두 파일의 리듀서 spec 은 겹쳐 보이지만 고정하는 대상이 다르다.

- `lib/rowset.test.ts`(14건) — **병합 규칙 자체**. 어떤 `keyOf` 로도 성립해야 하는 계약이고, 픽스처는 `{ id, label }`·`{ restaurant_id, created_at }` 두 벌을 써서 키 주입이 실제로 쓰이는지 본다.
- `lib/restaurants.test.ts`(리듀서 14건) — **인스턴스 배선**. 이 목록의 키가 `id` 라는 사실과, 실제 매장 행으로 그 규칙이 도는지를 본다.

한쪽을 "중복" 으로 지우면 남은 쪽이 다른 쪽의 회귀를 잡지 못한다(제네릭만 남기면 배선 실수를, 인스턴스만 남기면 `candidates` 쪽 파생을 놓친다). 두 파일 머리 주석에 이 분담을 한 줄씩 적어 뒀다.

## Known Stubs

**없음.** 이 플랜은 순수 함수만 만들었고, 만든 함수는 전부 354건의 spec 이 실제 값으로 호출한다. 하드코딩된 빈 값·플레이스홀더 문구·미배선 컴포넌트 0건. `components/MenuList.tsx`·`app/page.tsx` 는 import 경로만 바뀌어 동작이 같다.

## Manual-Only 항목

**0건.** 이 플랜은 UI·라우트·supabase 호출을 만들지 않으므로 화면 렌더 확인 대상이 없다. `npm run dev` 는 실행하지 않았다(규칙).

**컷오버 전 라이브 증상은 이 플랜에서 바뀌지 않는다.** 오늘 탭은 아직 `menus`/`pinned_menus` 를 읽는 구 형태이고, 바뀐 것은 `truncateToCodePoints` 의 import 경로 한 줄뿐이다(동작 동일). 매장 탭의 배너 3개 증상도 그대로다 — `useRestaurants` 는 액션 이름만 바뀌었고 조회·구독·에러 표면화 경로가 동일하다. **코드 경로 무영향.** `main` 은 이 플랜에서도 불변이므로 실사용자 영향 0.

## Threat Flags

**없음.** 새로 연 네트워크·인증·파일 접근 경로가 0개다(파일만 쓰는 플랜, supabase 호출 추가 0건). 플랜 `<threat_model>` 이 `mitigate` 로 배정한 6건은 전부 구현에 반영됐다:

| Threat ID | 반영 지점 | 자동 단언 |
|---|---|---|
| T-06-01 | `filterRestaurantsByName` 이 메모리 배열만 좁히고 `RegExp` 를 만들지 않는다 | 필터 spec 6건 · `normalize("NFC")` grep = 2 |
| T-06-02 | `formatCandidateWriteError` 가 `message` 만 200자 절단해 싣는다 | `grep -cE 'error\.(details\|hint)' lib/errors.ts` → **0** · errors spec 5건 |
| T-06-03 | DELETE 액션이 `key: string \| null` 만 받고 null 이면 아무 행도 안 지운다 | rowset spec #11·#14 · restaurants spec 1건 |
| T-06-04 (accept) | UPDATE upsert — 변경 스트림 순서 보장에 기댄다 | rowset spec #9 · restaurants spec 1건(반전 완료) |
| T-06-05 | `findWinnerIndex` 가 `restaurant_id` 로만 찾는다(이름 폴백 0) | candidates spec 4건 |
| T-06-06 | `joinCandidates` 가 카탈로그에 없는 후보를 버린다 | candidates spec 1건 |
| T-06-07 | `isNewSpin` 이 `spun_at` 비교로 set-null UPDATE 를 거른다 | candidates spec 3건 |
| T-06-SC | 설치 0건 | `git diff --stat -- package.json package-lock.json` **0줄** |
| T-06-LIVE | 라이브 무접촉 | 배포·원격 SQL·`git push` **0회** · `git status --porcelain -- supabase/` 0줄 |

## Self-Check: PASSED

**파일 존재(5/5 신규):** `lib/rowset.ts` · `lib/rowset.test.ts` · `lib/candidates.ts` · `lib/candidates.test.ts` · `lib/menus.ts` 전부 FOUND.
**이동 확인:** `test -f lib/menus.test.ts` → exit 0 · `test -f components/MenuList.test.ts` → exit **1** (MOVED).
**커밋 존재(2/2):** `8788126` FOUND · `6b4c8d1` FOUND.
**TDD 게이트 순서:** `test(06-01)` `8788126` (2026-09-29 12:13:39 +0900) → `feat(06-01)` `6b4c8d1` (12:21:27 +0900). RED 가 GREEN 을 앞선다. REFACTOR 커밋은 없다(정리할 중복이 없었고, 중복으로 보이는 두 spec 파일은 위에 적은 대로 의도적이다).
