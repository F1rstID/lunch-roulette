---
phase: 05-restaurants-tab
plan: 01
subsystem: pure-logic
tags: [vitest, tdd, reducer, realtime, validation, code-point, postgrest-error]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "0005 의 restaurants check 제약(이름 1~24·메뉴 30개/원소 24·위치 200) — 이 모듈이 코드포인트 단위로 비추는 정본"
  - phase: 03-pure-logic
    provides: "lib/settings.ts 의 훅·리듀서 분리와 loaded 가드 논증 — restaurantsReducer 가 그대로 복제한 원형"
  - phase: 01-safety-net
    provides: "lib/constants.ts · lib/errors.ts · components/MenuList.tsx parseMenuInput 과 그 회귀 spec 10건"
provides:
  - "lib/restaurants.ts — 매장 폼 검증 · 위치 링크 판정 · 표시 정렬 · Realtime 병합 리듀서(161줄, supabase·React 값 import 0)"
  - "RestaurantInput · RestaurantFormResult · LocationLink · RestaurantsState · RestaurantsAction — 05-02 의 훅·컴포넌트가 읽을 계약 타입"
  - "lib/errors.ts formatRestaurantWriteError + RestaurantWriteAction — 매장 쓰기 실패 3분기 번역"
  - "components/MenuList.tsx truncateToCodePoints — 레포 전체에서 유일한 절단 구현(오늘 탭도 이것을 부른다)"
  - "lib/constants.ts RESTAURANT_MENUS_MAX · RESTAURANT_LOCATION_MAX_LEN"
affects: [05-02-restaurants-ui, 06-today-tab, 07-history-rank]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "길이 판정·절단을 코드포인트 단위로 통일 — DB char_length 와 같은 단위여야 클라이언트 통과값이 DB 에서 튕기지 않는다"
    - "상한 초과는 절단이 아니라 거부(이름·위치·메뉴 개수) / 절단은 메뉴 원소 하나뿐"
    - "Realtime DELETE 의 비대칭(id 만 온다)을 액션 타입에 박아 훅·컴포넌트가 그 사실을 모르게 한다"
    - "lib/ → components/ 단방향 규칙의 문서화된 예외 — 파일 머리 주석에 후속 조건을 남긴다"

key-files:
  created:
    - lib/restaurants.ts
    - lib/restaurants.test.ts
  modified:
    - lib/constants.ts
    - lib/errors.ts
    - lib/errors.test.ts
    - components/MenuList.tsx
    - components/MenuList.test.ts
    - app/page.tsx

key-decisions:
  - "lib/restaurants.ts 가 components/MenuList.tsx 의 parseMenuInput 을 import 한다 — lib/ 단방향 규칙(STRUCTURE.md)의 의도적 예외. CATL-06 이 재활용을 요구하고 D-13 이 그 import 를 명시했다. Phase 6 이 MenuList 를 지울 때 파싱 함수를 lib/ 로 옮겨야 예외가 사라진다(파일 머리 주석에 기록)"
  - "restaurantsReducer 의 changed 는 error 를 지우지 않는다 — settings 리듀서와 갈리는 유일한 지점. 단일행은 새 행 하나가 곧 전체 진실이지만 목록은 이벤트 하나가 '전체를 읽을 수 있다' 는 증거가 아니라서, 조회 실패 배너를 여기서 걷으면 반쪽짜리 목록이 정상처럼 보인다"
  - "정렬을 리듀서에 넣지 않는다 — rows 는 조회 순서(created_at)를 유지하고 표시 순서는 sortRestaurants 가 화면 쪽에서 정한다(D-09). 넣으면 같은 규칙의 정의처가 둘이 된다"
  - "24 를 위한 새 상수를 만들지 않고 MENU_NAME_MAX_LEN 을 매장명·메뉴 원소가 공용한다 — 같은 숫자에 정의처를 둘로 만들지 않는 기존 원칙(Phase 1)"
  - "위치 링크는 URL 파싱 성공 + http:/https: 화이트리스트를 둘 다 통과해야 한다 — javascript:·data: 는 URL 생성자를 통과하므로 '파싱되면 링크' 로 두면 앵커가 스크립트를 실행한다(T-05-03)"

patterns-established:
  - "총 함수 폼 검증: 예외를 던지지 않고 { ok, input } | { ok, message } 로 판정을 값으로 돌려준다 — 호출부가 배너에 싣고 입력을 보존한다"
  - "spec 이 기대 숫자를 상수가 아니라 리터럴(24·30·200)로 쓴다 — 상수를 import 하면 'DB check 의 거울' 이라는 계약이 사라진다"

requirements-completed: []  # 05-02 의 마지막 태스크가 CATL-01~06 을 한 번에 찍는다 (Phase 2·4 선례)

# Metrics
duration: 17min
completed: 2026-09-29
---

# Phase 5 Plan 01: 매장 도메인 순수 로직 Summary

**매장 폼 검증·위치 링크 판정·정렬·Realtime 병합·쓰기 에러 번역을 렌더 하네스 없이 검증되는 순수 모듈로 세우고, 접은 todo wr-01 의 UTF-16 절단을 코드포인트 절단 한 벌로 바꿨다 — `npm test` 234 → 279건, 게이트 5종 전부 exit 0**

## Performance

- **Duration:** 17min (2026-09-29T00:33Z → 00:50Z)
- **Tasks:** 2/2 (RED → GREEN)
- **Files modified:** 8 (신규 2 + 수정 5 + 삭제 1)

## Accomplishments

- **판단이 전부 테스트되는 자리로 내려왔다.** `lib/restaurants.ts` 161줄에 폼 검증·링크 판정·정렬·리듀서가 모였고 `supabase`·React 값 import 는 0개다(`import type` 문장 1개뿐). 05-02 의 훅·컴포넌트에는 분기가 남지 않는다 — 레포에 렌더 하네스가 없어 거기 남는 분기는 영원히 검증되지 않는다는 Phase 3 의 논증을 매장 도메인에 그대로 적용했다.
- **길이의 단위가 DB 와 맞춰졌다.** 판정(`codePointLength`)과 절단(`truncateToCodePoints`) 둘 다 코드포인트다. `"가".repeat(23) + "🍕"`(24 코드포인트)가 온전히 통과하고, 이모지 30개는 12개가 아니라 24개로 잘린다. 절단 구현은 레포에 **한 벌**(`components/MenuList.tsx`)이고 오늘 탭의 `addMenus` 가 같은 함수를 부른다.
- **상한 초과의 처리가 갈렸다.** 이름·위치·메뉴 **개수**는 거부(`ok: false` + 한국어 메시지), 메뉴 **원소**만 절단이다. 말없이 짧아진 매장명은 다른 가게가 되고 31번째 메뉴를 버리면 사용자는 전부 등록된 줄 안다.
- **Realtime DELETE 의 비대칭이 타입에 박혔다.** `{ type: "changed"; event: "DELETE"; id: string | null }` — 행이 아니라 id 를 받는다. 컴포넌트·훅은 "DELETE 페이로드에는 PK 밖에 오지 않는다" 를 몰라도 된다.
- **todo wr-01 이 닫혔다.** 코드 수정 + 경계 spec 3건 + 파일 `git rm` 까지 한 커밋에서 끝냈다.

## Task Commits

1. **Task 1 (RED): spec 3파일 45건** — `894345f` (test)
   - `lib/restaurants.test.ts`(신규 322줄) · `lib/errors.test.ts` · `components/MenuList.test.ts`
2. **Task 2 (GREEN): 순수 모듈 3개 + 코드포인트 절단** — `bc421a3` (feat)
   - `lib/restaurants.ts`(신규 161줄) · `lib/constants.ts` · `lib/errors.ts` · `components/MenuList.tsx` · `app/page.tsx` · `.planning/todos/pending/wr-01-char-length-truncation.md`(삭제)

두 커밋 모두 `git log -1 --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic|🤖'` → **0**, `git show --name-only | grep -cE '\.serena/|config\.json'` → **0**. 삭제는 1건이고 의도된 것이다(접은 todo).

## RED 두 형태의 차이 (명령 출력 원문)

`npx vitest run lib/restaurants.test.ts lib/errors.test.ts components/MenuList.test.ts` → **exit 1** · `Test Files  3 failed (3)` · `Tests  7 failed | 27 passed (34)`.

`lib/restaurants.test.ts` 의 38건은 목록에 **세어지지도 않는다** — 모듈 자체가 없어 수집 단계에서 죽는다:

```
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  lib/restaurants.test.ts [ lib/restaurants.test.ts ]
Error: Cannot find package '@/lib/restaurants' imported from /…/lib/restaurants.test.ts
```

`lib/errors.test.ts` 의 4건은 **단언 실패**다 — vitest 는 없는 named export 를 `undefined` 로 바인딩하므로 spec 이 수집되고 호출에서 터진다(Phase 3 이 규명한 거동):

```
TypeError: formatRestaurantWriteError is not a function
```

`components/MenuList.test.ts` 의 3건은 **값 불일치**다 — 함수는 있고 단위만 틀렸다:

```
AssertionError: expected [ '가가…가�' ] to deeply equal [ '가가…가🍕' ]
AssertionError: expected [ '🍕×12' ] to deeply equal [ '🍕×24' ]
```

세 형태가 다르다는 것이 요점이다: **모듈 부재 = 수집 실패 / export 부재 = 호출 TypeError / 구현 오류 = 값 불일치.** RED 판정을 `Failed Suites` 개수로만 하면 두 번째·세 번째를 놓친다.

RED 시점 `npx tsc --noEmit` → exit 2:

```
lib/errors.test.ts(8,46): error TS2305: Module '"@/lib/errors"' has no exported member 'formatRestaurantWriteError'.
lib/restaurants.test.ts(18,8): error TS2307: Cannot find module '@/lib/restaurants' or its corresponding type declarations.
lib/restaurants.test.ts(243,54): error TS7006: Parameter 'r' implicitly has an 'any' type.
lib/restaurants.test.ts(247,59): error TS7006: Parameter 'r' implicitly has an 'any' type.
lib/restaurants.test.ts(290,97): error TS7006: Parameter 'r' implicitly has an 'any' type.
lib/restaurants.test.ts(313,95): error TS7006: Parameter 'r' implicitly has an 'any' type.
```

`grep -c TS2307` → **1**, `grep -c TS2305` → **1** (인수 조건 충족). 플랜이 예고하지 않은 `TS7006` 4건은 **같은 부재의 파생**이다 — 모듈이 없어 `sortRestaurants(...)`·리듀서 반환이 `any` 로 떨어지면서 `.map((r) => …)` 의 파라미터가 암시적 any 가 된다. GREEN 에서 0건이 됐다(아래 표).

## 검증 수치 (명령 출력 기준, 추정 없음)

### 게이트 5종

| 명령 | 기준선(1f05c81) | RED(894345f) | GREEN(bc421a3) |
|---|---|---|---|
| `npm test` | exit 0 · `Test Files  10 passed (10)` / `Tests  234 passed (234)` | exit 1 · `3 failed (3)` / `7 failed \| 27 passed (34)` | exit 0 · **`Test Files  11 passed (11)`** / **`Tests  279 passed (279)`** |
| `npx tsc --noEmit` | exit 0 | exit 2 (TS2305 1 · TS2307 1 · TS7006 4) | exit **0** |
| `npm run lint` | exit 0 | exit **0** | exit **0** |
| `npm run check:edge` | exit 0 | exit **0** | exit **0** (무영향 확인 — `supabase/functions/**` 무변경) |
| `npm run build` | exit 0 | exit **1**(아래 설명) | exit **0** |

### 테스트 증분 (234 → 279, +45)

| 파일 | 전 | 후 | 증분 |
|---|---|---|---|
| `lib/restaurants.test.ts` | — | 38 | **+38** (폼 16 · 링크 5 · joinMenus 3 · 정렬 4 · 리듀서 10) |
| `lib/errors.test.ts` | 17 | 21 | **+4** (23505 · 23514 · 코드 없음 · 공백 원문) |
| `components/MenuList.test.ts` | 10 | 13 | **+3** (24 코드포인트 통과 · 이모지 30→24 · 반 토막 없음) |
| 나머지 8파일 | 207 | 207 | 0 |

`describe` 수: `lib/restaurants.test.ts` **5** · `lib/errors.test.ts` 3 → **4** · `components/MenuList.test.ts` **1**(기존 describe 안에 추가). 기존 `it` 은 한 건도 수정·삭제하지 않았다.

### 토큰 카운트 (인수 조건, `grep -c`)

| 대상 | 토큰 | 기준 | 실측 |
|---|---|---|---|
| `lib/constants.ts` | `RESTAURANT_MENUS_MAX = 30` / `RESTAURANT_LOCATION_MAX_LEN = 200` / `export const MENU_NAME_MAX_LEN = 24;` | 1 / 1 / 1 | **1 / 1 / 1** |
| `lib/restaurants.ts` | `import type { RestaurantRow } from "@/lib/supabase/client";` / `import { parseMenuInput } from "@/components/MenuList";` | 1 / 1 | **1 / 1** |
| `lib/restaurants.ts` | `from "react"\|useState\|useEffect\|createClient` | 0 | **0** |
| `lib/restaurants.ts` | `^export function (parseRestaurantForm\|joinMenus\|parseLocationLink\|sortRestaurants\|restaurantsReducer)` | 5 | **5** |
| `lib/restaurants.ts` | `"http:"` / `"https:"` / `localeCompare` / `"ko"` / `const exhaustive: never = action;` | 1 / 1 / 1 / 1 / 1 | **1 / 1 / 1 / 1 / 1** |
| `lib/errors.ts` | `error\.(details\|hint)` / `export function formatRestaurantWriteError` / `23505` / `23514` | 0 / 1 / 1 / 1 | **0 / 1 / 1 / 1** |
| `components/MenuList.tsx` | `export function truncateToCodePoints` / `Array.from(` / `trim().slice(0, MENU_NAME_MAX_LEN)` | 1 / 1 / 0 | **1 / 1 / 0** |
| `app/page.tsx` | `truncateToCodePoints` / `Array.from(` / `slice(0, MENU_NAME_MAX_LEN)` | 2 / 0 / 0 | **2 / 0 / 0** |
| `lib/restaurants.test.ts` | `supabase/client` / `lib/constants` / `testing-library\|jsdom` | 0 / 0 / 0 | **0 / 0 / 0** |

게이트 토큰(`Array.from(`·`truncateToCodePoints`·`formatRestaurantWriteError`·`23505`·`23514`·`"http:"`)은 주석 문안에 리터럴로 쓰지 않았다 — 한글 표현("코드포인트 배열로 펼쳐"·"절단"·"쓰기 실패 번역"·"프로토콜 화이트리스트")으로 대체해 grep 이 자기 자신을 세지 않는다.

### 무변경·범위 확인

| 항목 | 결과 |
|---|---|
| `git diff --stat -- package.json package-lock.json` | **0줄** (신규 패키지 0개 — 이 페이즈의 불변식) |
| `git diff HEAD~1 --stat -- app/page.tsx` | `1 file changed, 2 insertions(+), 2 deletions(-)` — **4줄** (기준 6줄 이하). realtime 핸들러·`winnerIndex`·다른 쓰기 핸들러 무접촉 |
| `git diff --stat -- lib/supabase/client.ts` | **0줄** (`RestaurantRow` 가 이미 있었다) |
| `supabase/**` | 무변경 — 라이브 DB·Edge Function·`main` 무접촉. `git push` 0회 |
| 미추적 파일 | `git status --short \| grep '^??'` → **0건** |
| `.planning/todos/pending/` | 7건 → **6건** (`wr-01-char-length-truncation.md` 만 제거) |

## Deviations from Plan

### 1. `npm run build` 는 RED 커밋에서 exit 0 이 될 수 없다 (플랜 인수 조건의 내부 모순)

- **발견 시점:** Task 1 게이트 실행 중
- **내용:** 플랜은 Task 1 인수 조건에 `npx tsc --noEmit 2>&1 | grep -c 'TS2307' → 1` 과 `npm run build → exit 0` 을 **동시에** 요구한다. 그런데 `next build` 는 컴파일 후 같은 TypeScript 프로그램으로 타입 검사를 돌린다(`tsconfig.json` 의 `include: ["**/*.ts"]` 가 spec 파일을 포함한다). 타입 에러가 있는데 빌드가 초록일 수는 없다.
- **실측:** RED 시점 `npm run build` → exit 1. 다만 **컴파일 단계는 성공**했다 — `✓ Compiled successfully in 420ms` → `Running TypeScript ...` → `Failed to type check.` 이고 나열된 에러는 위 tsc 6건과 **동일**하다. 즉 코드가 깨진 것이 아니라 tsc 실패가 그대로 비친 것이다.
- **처리:** 실행자 규칙이 RED 커밋에 대해 허용한 유일한 예외("`tsc` 는 새 export 미존재로 실패해도 된다")의 파생으로 보고 진행했다. GREEN 커밋에서 `npm run build` exit **0** 으로 닫혔다.

### 2. RED 의 tsc 에러가 플랜 예고(2건)보다 많은 6건이었다

- **내용:** 플랜은 `TS2307` 1건 + `TS2305` 1건을 예고했고 `TS7006` 4건은 예고하지 않았다.
- **원인:** `@/lib/restaurants` 가 없어 `sortRestaurants(...)`·리듀서 반환이 암시적 `any` 가 되고, spec 의 `.map((r) => r.id)` 네 곳에서 파라미터 타입이 유실된다. 모듈 부재의 순수한 파생이다.
- **처리:** 인수 조건은 `grep -c 'TS2307'`·`grep -c 'TS2305'` 의 **개수**만 요구하고 둘 다 정확히 1이므로 충족. GREEN 에서 `TS7006` 0건. spec 을 고쳐 회피하지 않았다 — 파라미터에 타입을 달려면 행 타입을 import 해야 하는데 플랜이 금지한다.

### 3. `restaurantsReducer` 의 `changed` 가 `error` 를 유지한다 (플랜 미명시 구간의 판단)

- **내용:** 플랜은 `changed` 가 `loaded` 를 참으로 올린다고만 정하고 `error` 처리를 명시하지 않았다. 원형인 `settingsReducer` 는 `changed` 에서 `error: null` 로 지운다.
- **판단:** 목록에서는 지우지 않는다(`error: state.error`). 단일행 설정은 새 행 하나가 곧 전체 진실이지만, 목록은 이벤트 하나가 도착했다는 사실이 "목록 전체를 읽을 수 있다" 는 증거가 아니다. 지우면 조회 실패 뒤 INSERT 하나가 도착했을 때 반쪽짜리 목록이 배너 없이 정상처럼 보인다.
- **영향:** spec 10건은 전부 성공한 `loaded` 에서 출발하므로 어느 쪽이든 초록이다. 파일 주석에 근거를 남겼다. 05-02 의 배너 배선이 이 선택 위에 선다.

### 4. `.planning/todos/pending/` 잔여 건수가 플랜 기재(5건)와 다르다 — 실측 6건

- **원인:** 플랜의 `<verification>` 은 "나머지 5건" 이라고 적었지만 실행 직전 실측은 **7건**이었다. STATE.md 의 "6건" 집계가 `in-06-results-update-on-delete-set-null.md` 를 목록에서 빠뜨린 것이 원인이고(Phase 4 기재 오류), 플랜은 그 수를 그대로 받아 적었다.
- **처리:** 파일은 계획대로 정확히 1건(`wr-01-char-length-truncation.md`)만 지웠다. STATE.md 의 Pending Todos 절을 실측 6건으로 고치고 누락돼 있던 `in-06` 을 목록에 넣었다.

### 5. gsd-sdk 문자열 버그 수동 정규화

- `state.add-decision` 이 `[Phase ?]:` 접두를 붙여(5줄) → `[Phase 5]:` 로 교정.
- `state.record-session`·`advance-plan` 이 `last_activity` 본문을 날짜만 남기고 지움 · `Status: Ready to execute` 로 되돌림 · `Resume file: None` → 셋 다 손으로 복원.
- `roadmap.update-plan-progress 5` 가 날짜 셀을 빈 칸으로 남김(`| … | In Progress |  |`) → `-` 로 채움.
- `state.add-decision` 은 `--summary` 를 별도로 요구했다(첫 호출이 `{"error":"summary required"}`).

## Known Stubs

없음. 이 플랜은 순수 함수만 만들었고, 만든 함수는 전부 45건의 spec 이 실제 값으로 호출한다. 하드코딩된 빈 값·플레이스홀더 문구·미배선 컴포넌트 0건.

## Manual-Only 항목

**0건.** 이 플랜은 UI·라우트·supabase 호출을 만들지 않으므로 화면 렌더 확인 대상이 없다. `npm run dev` 는 실행하지 않았다(규칙). 화면 확인은 05-02 의 몫이다.

## 05-02 가 읽을 계약

| 이름 | 위치 | 모양 |
|---|---|---|
| `parseRestaurantForm` | `lib/restaurants.ts` | `({ name, menusText, location }) => { ok: true; input } \| { ok: false; message }` |
| `RestaurantInput` | 〃 | `{ name: string; menus: string[]; location: string \| null }` — 그대로 PostgREST 에 넘긴다 |
| `joinMenus` | 〃 | `string[] => string` (`", "` 결합) — 편집 폼이 배열을 한 줄로 되돌리는 창구 |
| `parseLocationLink` | 〃 | `string \| null => { href, host } \| null` — `null` 이면 링크가 아니라 텍스트로 렌더 |
| `sortRestaurants` | 〃 | `RestaurantRow[] => RestaurantRow[]` (원본 불변) — 호출부가 `useMemo` 로 감싼다 |
| `INITIAL_RESTAURANTS_STATE` · `restaurantsReducer` | 〃 | `useReducer` 초기값 + `loaded`/`failed`/`changed` 3액션(DELETE 만 `id`) |
| `formatRestaurantWriteError` · `RestaurantWriteAction` | `lib/errors.ts` | `(action, name, { code?, message }) => string` · `"등록"\|"수정"\|"삭제"\|"고정"\|"고정 해제"` |
| `RESTAURANT_MENUS_MAX` · `RESTAURANT_LOCATION_MAX_LEN` | `lib/constants.ts` | 30 · 200 (폼의 `maxLength` 힌트로도 쓸 수 있다) |

**후속 조건 1건 (Phase 6):** `lib/restaurants.ts` 의 `import { parseMenuInput } from "@/components/MenuList"` 는 `lib/` 단방향 규칙의 예외다. Phase 6 이 `MenuList` 를 지울 때 `parseMenuInput`·`truncateToCodePoints` 를 `lib/` 로 옮겨야 한다. 문서 반영(D-19)은 05-02 의 몫이다.

## Threat Flags

없음. 새로 연 네트워크·인증·파일 접근 경로가 0개다(파일만 쓰는 플랜). 플랜의 `<threat_model>` 이 `mitigate` 로 배정한 5건은 전부 구현에 반영됐다:

| Threat ID | 반영 지점 | 자동 단언 |
|---|---|---|
| T-05-01 | `parseRestaurantForm` 의 코드포인트 판정 3곳 | 폼 spec 16건 |
| T-05-02 | `formatRestaurantWriteError` 가 `message` 만 읽음 | `grep -cE 'error\.(details\|hint)' lib/errors.ts` → 0 |
| T-05-03 | `parseLocationLink` 의 `http:`/`https:` 화이트리스트 | 링크 spec 5건(`javascript:` 포함) |
| T-05-04 | 30개·200자 상한을 클라이언트도 든다 | 경계 spec 4건(30/31 · 200/201) |
| T-05-05 | `truncateToCodePoints` | MenuList spec 3건 |
| T-05-SC | 설치 0건 | `git diff --stat -- package.json package-lock.json` 0줄 |
| T-05-LIVE | 라이브 무접촉 | 배포·원격 SQL·`git push` 0회 |

## Self-Check: PASSED

**파일 존재(8/8):** `lib/restaurants.ts` · `lib/restaurants.test.ts` · `lib/constants.ts` · `lib/errors.ts` · `lib/errors.test.ts` · `components/MenuList.tsx` · `components/MenuList.test.ts` · `app/page.tsx` 전부 FOUND.
**삭제 확인:** `test -f .planning/todos/pending/wr-01-char-length-truncation.md` → exit **1** (REMOVED).
**커밋 존재(2/2):** `894345f` FOUND · `bc421a3` FOUND.
**TDD 게이트 순서:** `test(05-01)` `894345f` (09:39:24+09:00) → `feat(05-01)` `bc421a3` (09:44:31+09:00). RED 가 GREEN 을 앞선다. REFACTOR 커밋은 없다(정리할 중복이 없었다).
