---
phase: 05-restaurants-tab
plan: 02
subsystem: ui
tags: [next-app-router, realtime, hooks, inline-edit, error-banner, accessibility]

# Dependency graph
requires:
  - phase: 05-restaurants-tab
    provides: "05-01 의 lib/restaurants.ts(폼 검증·링크 판정·정렬·리듀서)와 lib/errors.ts 의 formatRestaurantWriteError — 이 플랜의 훅·컴포넌트·페이지가 그 위에만 선다"
  - phase: 03-pure-logic
    provides: "lib/useSettings.ts 의 훅 골격(인스턴스별 토픽·cancelled 플래그·cleanup)과 currentPhase(now, spinTime, hasResult) 시그니처"
  - phase: 02-data-model
    provides: "0005 의 restaurants 테이블·RLS 전면 개방·unique(name)·cascade/set null — 쓰기 4종이 가정하는 계약(미적용)"
  - phase: 01-safety-net
    provides: "lib/errors.ts formatLoadError·joinLoadErrors + components/ErrorBanner.tsx, 읽기/쓰기 배너 분리 원칙"
provides:
  - "lib/useRestaurants.ts — 매장 목록 SELECT 1회 + INSERT/UPDATE/DELETE 3분기 구독(읽기 전용, 판단 0, 91줄)"
  - "components/RestaurantList.tsx — 카드·등록 폼·인라인 편집·📌 토글·2단계 삭제 확인·메뉴 칩·위치 링크(supabase 미호출, 534줄)"
  - "app/restaurants/page.tsx — /restaurants 라우트. tick·설정·오늘 결과 1회 조회·정렬 메모·쓰기 4종·배너 2개(168줄)"
  - "components/TopBar.tsx Tab 유니온 4원소 + 매장 탭(오늘 · 매장 · 기록 · 랭킹)"
  - "CLAUDE.md·STRUCTURE.md·CONVENTIONS.md 현행화 — 매장 탭·새 훅 2개·lib/ 단방향 예외·상수 위치 오기·낡은 테스트 진술"
affects: [06-today-tab, 07-history-rank, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "읽기 훅(I/O만) + 순수 리듀서 + 쓰기는 페이지 핸들러 — 갱신 경로를 Realtime 하나로 묶는 3단 분리"
    - "Realtime 3분기를 이벤트별로 갈라 구독 — event 와일드카드 한 분기로 합치면 eventType 단언이 테스트 불가능한 자리로 되돌아온다"
    - "인라인 편집 폼의 key = 행 id — props 가 갱신돼도 편집 초안이 살아남는 유일한 장치"
    - "폼 검증 실패는 폼 안 role=alert, 쓰기 실패는 페이지 actionError 배너 — 실패의 성격에 따라 표시 위치를 가른다"

key-files:
  created:
    - lib/useRestaurants.ts
    - components/RestaurantList.tsx
    - app/restaurants/page.tsx
  modified:
    - components/TopBar.tsx
    - CLAUDE.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "훅에 판단을 한 줄도 남기지 않았다 — SELECT 1회 + 3분기 + cleanup 뿐이고 분기 판정은 전부 restaurantsReducer 에 있다. 3분기를 합치지 않은 이유는 합치면 eventType 단언이 렌더 하네스가 없는 자리로 되돌아오기 때문이다"
  - "편집 폼의 key 를 행 id 로 줬다 — Realtime UPDATE 로 props 가 바뀌어도 remount 되지 않아 편집 초안이 살아남고 저장이 마지막 쓰기로 덮는다(익명 서비스라 충돌 UI 없음)"
  - "폼 검증 실패는 페이지 배너가 아니라 폼 안 role=alert 다 — 쓰기 실패가 아니고, 고쳐야 할 입력 칸 옆에 있어야 사용자가 어디를 손볼지 안다. actionError 에는 PostgREST 실패만 모인다"
  - "매장 탭은 results 를 구독하지 않는다 — 잠금이 없어(D-12) 페이즈 필은 표시용이고, 구독을 하나 더 늘리면 얻는 것(필 갱신)보다 실패 경로가 느는 비용이 크다"
  - "게이트 토큰(useCallback)을 근거 주석 문안에서 뺐다 — 인수 조건이 파일 전체 grep 으로 0건을 요구하는데 주석이 자기 자신을 세면 게이트가 무력화된다(Phase 3 의 같은 결정 재적용)"

patterns-established:
  - "새 라우트 보일러플레이트의 두 원본: 표시 전용은 app/rank/page.tsx(90줄), 쓰기 핸들러 + 배너 2개까지 필요하면 app/restaurants/page.tsx"
  - "파괴적 조작(삭제)만 행 안 2단계 확인 — 확인 문구가 DB 외래키 규칙의 파급을 사람 말로 옮긴다. window.confirm 은 0건"

requirements-completed: [CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06]

# Metrics
duration: 10min
completed: 2026-09-29
---

# Phase 5 Plan 02: 매장 탭 UI 배선 Summary

**05-01 의 순수 로직 위에 읽기 전용 훅 · 카드 컴포넌트 · `/restaurants` 라우트를 올려 매장 카탈로그 CRUD 를 닫았다 — 빌드 라우트가 4개에서 5개가 됐고 게이트 5종 전부 exit 0, `npm test` 는 새 테스트 0건으로 279 유지**

## Performance

- **Duration:** 10min (2026-09-29T00:53:35Z → 01:04:12Z)
- **Tasks:** 3/3
- **Files modified:** 8 (신규 3 + 수정 5)

## Accomplishments

- **매장 카탈로그가 화면에서 돌아간다.** 등록(3필드) · 인라인 수정 · 2단계 확인 삭제 · 📌 토글이 전부 붙었고, 네 쓰기가 페이지의 async 핸들러 4개에서 PostgREST 를 직접 부른다. 낙관적 업데이트는 0건이라 화면은 Realtime 이벤트로만 바뀐다.
- **판단이 한 줄도 새 파일로 새지 않았다.** `lib/useRestaurants.ts`(91줄)에는 조회 1회 · 구독 3분기 · cleanup 만 있고 분기 판정은 전부 05-01 의 리듀서다. `components/RestaurantList.tsx`(534줄)는 데이터 클라이언트를 **한 번도** 부르지 않는다(`grep -cF 'supabase.'` → 0).
- **위험한 값 두 가지가 순수 함수 뒤에 갇혔다.** 위치 문자열은 `parseLocationLink` 가 `http:`/`https:` 를 통과시킨 것만 `<a target="_blank" rel="noopener noreferrer">` 가 되고(그 외는 텍스트), PostgREST 실패 문장은 **전부** `formatRestaurantWriteError` 를 지난다(출현 5회 = import 1 + 호출 4, `error.details`·`error.hint` 참조 0건).
- **탭이 오늘 · 매장 · 기록 · 랭킹 순으로 섰다.** `TopBar` 변경은 4줄 추가 · 1줄 수정이 전부이고 `candidateCount` 관련 4줄은 그대로다(매장 탭에는 뱃지를 달지 않았다 — 뱃지는 "오늘 후보 수" 의미다).
- **문서가 현행이 됐다.** 라우트 5개 · 훅 2개 · `lib/` 단방향 예외 + Phase 6 후속 조건 · `MENU_NAME_MAX_LEN` 위치 오기 · "테스트 인프라가 없다"는 낡은 진술을 고쳤고, **이 페이즈가 하지 않은 일**(마이그레이션 적용 · 함수 배포 · 오늘 탭 전환)은 미완으로 그대로 뒀다.

## Task Commits

1. **Task 1: 읽기 전용 훅 + 카드 컴포넌트** — `962d41b` (feat)
   - `lib/useRestaurants.ts`(신규 91줄) · `components/RestaurantList.tsx`(신규 534줄)
2. **Task 2: `/restaurants` 라우트 + 쓰기 4종 + 탭** — `833a3f9` (feat)
   - `app/restaurants/page.tsx`(신규 168줄) · `components/TopBar.tsx`(+4/−1)
3. **Task 3: 문서 정정 + CATL 마킹** — `6b0aa48` (docs)
   - `CLAUDE.md`(+7/−3) · `.planning/codebase/STRUCTURE.md`(+21/−5) · `.planning/codebase/CONVENTIONS.md`(+7/−7) · `.planning/REQUIREMENTS.md`(+12/−12)

세 커밋 모두 `git log -1 --format=%B | grep -cE 'Co-Authored-By|Generated with|Claude|Anthropic|🤖'` → **0**. `.serena/project.yml`·`.planning/config.json` 은 세 커밋 어디에도 없다(작업 내내 unstaged 로 남아 있다). 삭제·미추적 파일 0건.

## 검증 수치 (명령 출력 기준, 추정 없음)

### 게이트 5종 — 세 커밋 시점 모두 exit 0

| 명령 | Task 1(962d41b) | Task 2(833a3f9) | Task 3(6b0aa48) |
|---|---|---|---|
| `npx tsc --noEmit` | 0 | 0 | 0 |
| `npm run lint` | 0 | 0 | 0 |
| `npm test` | 0 · `Test Files  11 passed (11)` / `Tests  279 passed (279)` | 0 · 동일 | 0 · 동일 |
| `npm run build` | 0 (라우트 4개) | 0 (**라우트 5개**) | 0 |
| `npm run check:edge` | 0 | 0 | 0 |

**새 테스트 0건**이 이 플랜의 의도다 — 레포에 React 렌더 하네스가 없어 훅·컴포넌트·페이지의 분기는 테스트할 수 없고, 그래서 05-01 이 판단 45건을 전부 가져갔다. 검증은 낭독 + 정적 게이트 + grep 계약이다.

### `npm run build` 라우트 목록 (원문, Task 2 이후)

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /log
├ ○ /rank
└ ○ /restaurants
```

Task 1 시점에는 `/restaurants` 가 없는 4줄이었다(컴포넌트만 있고 라우트가 없었다). 기존 라우트는 하나도 사라지지 않았다.

### 토큰 카운트 (인수 조건, `grep -c` = 매치된 줄 수)

| 대상 | 토큰 | 기준 | 실측 |
|---|---|---|---|
| `lib/useRestaurants.ts` | `export function useRestaurants` / `table: "restaurants"` / `event: "*"` | 1 / 3 / 0 | **1 / 3 / 0** |
| 〃 | `from("restaurants")` / 쓰기(`insert\|update\|delete\|upsert`) | 1 / 0 | **1 / 0** |
| 〃 | `restaurants-${++topicSeq}` / `removeChannel` / `payload.old as Partial<RestaurantRow>` | 1 / 1 / 1 | **1 / 1 / 1** |
| `components/RestaurantList.tsx` | `supabase.` / `export function RestaurantList` | 0 / 1 | **0 / 1** |
| 〃 | 하위 컴포넌트 `^export` / `function (RestaurantForm\|RestaurantRowView\|PinButton\|DeleteConfirm)` | 0 / 4 | **0 / 4** |
| 〃 | `rel="noopener noreferrer"` / `target="_blank"` / `parseLocationLink` | 1 / 1 / ≥2 | **1 / 1 / 2** |
| 〃 | `window.confirm\|alert\|prompt` / `isCandidateListLocked\|SLICE_COLORS` / `candidates` | 0 / 0 / 0 | **0 / 0 / 0** |
| 〃 | `aria-pressed` / `satisfies Record<string, CSSProperties>` / 하드코딩 색(`#hex`) | 1 / 1 / 0 | **1 / 1 / 0** |
| `components/TopBar.tsx` | `href` 출현 순서 | `/` → `/restaurants` → `/log` → `/rank` | **일치** |
| 〃 | `type Tab = "today" \| "restaurants" \| "log" \| "rank";` / `candidateCount` | 1 / 4 | **1 / 4** |
| `app/restaurants/page.tsx` | `"use client";` / `^export default function` / `from("restaurants")` | 1 / 1 / 4 | **1 / 1 / 4** |
| 〃 | `formatRestaurantWriteError`(출현 횟수) / `setActionError(백틱\|따옴표` / `error.(details\|hint)` | 5 / 0 / 0 | **5 / 0 / 0** |
| 〃 | `from("candidates\|menus\|pinned_menus")` / `isCandidateListLocked` / `useCallback` | 0 / 0 / 0 | **0 / 0 / 0** |
| 〃 | `useMemo(() => sortRestaurants(rows), [rows])` / `useRestaurants()` / `useSettings()` / `<ErrorBanner` | 1 / 1 / 1 / 2 | **1 / 1 / 1 / 2** |
| 〃 | `table: "results"` / 하드코딩 색 | 0 / 0 | **0 / 0** |
| 문서 | `CLAUDE.md` 의 `app/restaurants/page.tsx`·`lib/useRestaurants.ts`·`components/RestaurantList.tsx`·`RESTAURANT_LOCATION_MAX_LEN` | ≥1 각 | **2 / 3 / 1 / 1** |
| 〃 | `STRUCTURE.md` 의 `restaurants/page.tsx`·`useRestaurants.ts`·`Tab` 유니온·`인프라가 없다` | ≥1 / ≥1 / 1 / 0 | **3 / 3 / 1 / 0** |
| 〃 | `CONVENTIONS.md` 의 `Tab` 유니온·`lib/supabase/client.ts:13`·`useRestaurants.ts`·`restaurants-<n>` | 1 / 0 / ≥2 / ≥1 | **1 / 0 / 2 / 1** |
| 요구사항 | `^- \[x\] \*\*CATL-0[1-6]\*\*` / Traceability `Complete` 행 / `\| In Progress\|` 잔재 | 6 / 6 / 0 | **6 / 6 / 0** |

### 무변경·범위 확인

| 항목 | 결과 |
|---|---|
| `git status --porcelain -- app/page.tsx app/log/page.tsx app/rank/page.tsx components/MenuList.tsx lib/supabase/client.ts` | **0줄** (세 커밋 전부) |
| `git diff e6ad2a9 --stat -- app/page.tsx components/MenuList.tsx lib/supabase/client.ts` | **0줄** — 이 플랜은 오늘 탭을 건드리지 않았다 |
| `git diff 1f05c81 --stat -- app/page.tsx components/MenuList.tsx` | `app/page.tsx 4줄 · MenuList.tsx 11줄` — Phase 5 전체에서 오늘 탭에 남은 변경은 05-01 의 코드포인트 절단뿐이다 |
| `git diff --stat -- package.json package-lock.json` | **0줄** (신규 패키지 0개 — 페이즈 불변식) |
| `supabase/**` | 무변경. 마이그레이션 미적용 · 함수 미배포 · `git push` 0회 · 라이브 DB 매장 등록 0건 |
| 미추적 파일 | `git status --short \| grep '^??'` → **0건** |

## 낭독 검증 8항목 (자동 단언이 닿지 않는 것)

1. **세 분기가 서로 다르고 테이블이 셋 다 같은가 · cleanup 이 채널 해제인가** — `lib/useRestaurants.ts:62`(INSERT) · `:69`(UPDATE) · `:76`(DELETE), 세 줄 모두 `table: "restaurants"`. 채널은 `:59` 에서 `topic` 으로 열리고 `:84` 에서 `.subscribe()`, cleanup 은 `:86` `supabase.removeChannel(ch)` 한 줄. **판정: 통과.**
2. **DELETE 가 부분 행을 받고 식별자 없으면 null 을 보내는가 · 리듀서가 그 null 에서 아무 행도 지우지 않는가** — `lib/useRestaurants.ts:80-81` 이 `payload.old as Partial<RestaurantRow>` 로 받아 `oldRow.id ?? null` 을 dispatch. 리듀서 `lib/restaurants.ts:136` 이 `action.id === null ? state.rows : …filter(…)` 로 목록을 그대로 둔다. spec 은 `lib/restaurants.test.ts:320`(id null 에서 길이 2 유지). **판정: 통과.**
3. **삭제가 2단계인가 · 문구가 파급을 사람 말로 설명하는가** — ✕ 버튼(`components/RestaurantList.tsx:291`)은 `onAskRemove` 만 부르고, 그 핸들러(`:113-116`)는 `confirmingId` 를 세울 뿐이다. 실제 `onRemoveAction` 은 `DeleteConfirm` 의 확인 버튼(`:98-104`)을 지나야 불린다. 문구는 `:322` "삭제할까요? 오늘 후보에서도 빠져요 · 과거 기록의 이름은 남아요" — cascade·set null 이라는 말을 쓰지 않고 결과만 말한다. **판정: 통과.**
4. **핀 토글이 컬럼 하나 update 한 번인가** — `app/restaurants/page.tsx:106-109` 가 `.update({ pinned: !currentlyPinned }).eq("id", id)` 하나뿐이다. 같은 파일에서 `candidates`·`menus`·`pinned_menus` 접근은 0건이고 컴포넌트 쪽에도 `candidates` 문자열이 없다. **판정: 통과.**
5. **잠금이 없는가** — 페이지에서 `phase` 가 쓰이는 곳은 `app/restaurants/page.tsx:36`(계산)과 `:132`(`TopBar` 에 전달) 둘뿐이다. `RestaurantList` 에는 `phase` prop 이 없고 `disabled` 는 `components/RestaurantList.tsx:215` 한 곳(이름이 비었거나 전송 중)뿐이라 페이즈와 무관하다. `isCandidateListLocked` 참조는 두 파일 모두 0건. **판정: 통과.**
6. **링크가 화이트리스트 통과분만 앵커인가 · 두 속성이 함께 붙는가** — `components/RestaurantList.tsx:252` 가 `parseLocationLink(row.location)` 의 결과를 받고, `:277-283` 이 `link ? <a … target="_blank" rel="noopener noreferrer"> : <span>{row.location}</span>` 로 갈린다. 앵커는 파일 전체에서 그 하나다(두 속성 각 1건). **판정: 통과.**
7. **컷오버 전 라이브에서 배너 + 빈 목록이 정상인가** — 라이브에는 아직 `restaurants` 테이블이 없다(0005 미적용). 훅의 최초 조회가 PGRST205 로 실패하면 `dispatch({ type: "failed" … })`(`lib/useRestaurants.ts:48`) → 리듀서가 `rows: []` + `error` 를 세우고(`lib/restaurants.ts:128`), 페이지가 그 값을 `formatLoadError("매장 목록", …)` 로 감싸 `loadBanner` 에 싣는다(`app/restaurants/page.tsx:123-128`). **따라서 "매장 목록 불러오기 실패: …" 배너 + 빈 목록이 컷오버 전의 기대 상태다 — 배너가 안 뜨면 에러를 삼키고 있다는 신호다**(`lib/useSettings.ts:16-18` 의 설정 배너와 같은 논증). **판정: 통과(사실로 기록).**
8. **오늘 탭이 무변경인가** — `git diff e6ad2a9 --stat -- app/page.tsx components/MenuList.tsx` 출력 0줄. Phase 5 전체(`1f05c81..HEAD`)로 넓혀도 두 파일의 변경은 05-01 의 코드포인트 절단(`app/page.tsx` 4줄 · `components/MenuList.tsx` 11줄)뿐이다. **판정: 통과.**

## 📋 Manual-Only (초록 아님 — 사용자 확인 대기)

**1항목: `/restaurants` 렌더·상호작용 확인.** `npm run dev` 는 실행하지 않았다(규칙: 가드런처로만, 사용자 몫). 절차:

1. 가드런처로 dev 서버를 띄우고 `http://localhost:3000/restaurants` 를 연다.
2. 상단 탭이 **오늘 · 매장 · 기록 · 랭킹** 순이고 "매장" 이 활성 표시인지 본다. 매장 탭에는 숫자 뱃지가 없어야 한다.
3. **컷오버 전이라면 여기서 "매장 목록 불러오기 실패: …" 배너 + 빈 목록이 정상이다**(위 낭독 7). 아래 3~6 은 0005 가 적용된 DB 에서만 의미가 있다.
4. 이름만 넣고 "등록" → 행이 `fade-up` 으로 나타나고 세 입력이 비며 커서가 이름 칸으로 돌아오는지. 이름을 비우면 버튼이 흐려지는지.
5. 행의 "수정" → 같은 자리가 3필드 폼(저장·취소)으로 바뀌고 메뉴가 `"a, b, c"` 한 줄로 채워지는지. 다른 행의 "수정" 을 누르면 편집 대상이 옮겨 가는지.
6. ✕ → 같은 자리에 "삭제할까요? …" 와 [삭제]·[취소] 가 뜨는지(브라우저 확인창이 **뜨지 않아야** 한다). 📌 → 확인 없이 즉시 토글되고 핀 매장이 목록 위로 올라오는지. 메뉴가 5개 이상인 행에 `+n` 칩이 보이고 마우스를 올리면 전체 목록이 뜨는지. 위치에 `https://…` 를 넣으면 호스트명이 링크로, 일반 텍스트면 그대로 보이는지.

판정은 **manual-only** 로 남긴다 — 초록으로 칠하지 않는다(04-VALIDATION 선례: 거짓 초록은 재검증 비용을 숨긴다).

## 알려진 한계 (사실로 기록, 고치지 않았다)

- **이 탭은 `results` 를 구독하지 않는다.** 오늘 결과는 마운트 시 1회 조회뿐이라, 탭을 열어 둔 채 추첨 시각이 지나면 상단 페이즈 필이 새로고침 전까지 "추첨 대기" 에 머문다. **잠금이 없으므로(D-12) 등록·수정·삭제·핀에는 영향이 0이다.** 구독을 몰래 늘리지 않았다(근거 주석: `app/restaurants/page.tsx:55-57`).
- **컷오버 전 라이브에서는 배너 + 빈 목록이 정상 상태다**(낭독 7). 마이그레이션은 이 페이즈에서 적용하지 않았다.
- **오늘 탭은 아직 구 형태다.** `menus`/`pinned_menus` 기반이고 후보 담기·이름 필터·결과의 메뉴/위치 표시는 전부 Phase 6 이다. 매장을 등록해도 오늘 탭에는 아직 나타나지 않는다.
- **Realtime 구독 실패(`CHANNEL_ERROR`)는 여전히 조용하다** — 전 페이지 공통 과제이고 이 페이즈의 범위 밖이다(CONCERNS 기록 유지).
- **페이지네이션·가상화 없음**(D-11). 카탈로그가 수백 개가 되면 목록 높이(`maxHeight: 520`)와 매초 리렌더가 부담이 될 수 있다 — 수십 개 규모 전제의 수용(T-05-12).

## Deviations from Plan

### 1. `loaded` 를 구조분해하지 않았다 (lint 회피)

- **플랜 지시:** `const { rows, loaded, error: restaurantsError } = useRestaurants();`
- **실제:** `const { rows, error: catalogError } = useRestaurants();`
- **이유:** 같은 플랜 항목 10이 "`loaded` 가 거짓인 동안 목록이 비어 보이는 것이 정상(스켈레톤을 만들지 않는다)" 이라고 정했으므로 `loaded` 는 쓰이지 않는다. 구조분해만 해 두면 `@typescript-eslint/no-unused-vars` 가 `npm run lint` 를 깨뜨린다. 훅의 반환 타입에는 `loaded` 가 그대로 있어 Phase 6 이 쓸 수 있다.
- **영향:** 인수 조건에 `loaded` 관련 항목이 없어 게이트에 영향 0.

### 2. 근거 주석에서 게이트 토큰(`useCallback`)을 뺐다 (플랜 내부 모순)

- **내용:** 플랜 Task 2 항목 8은 `app/page.tsx:167-169` 의 "useCallback 으로 감싸지 않는다" 주석을 옮기라고 했는데, 같은 태스크의 인수 조건은 `grep -cF 'useCallback' app/restaurants/page.tsx` → `0` 을 요구한다. 주석을 그대로 옮기면 주석이 자기 자신을 세어 게이트가 실패한다(첫 실측 1건).
- **처리:** 문장을 "수동 memo 로 감싸지 않는다 … (app/page.tsx:167-169 와 같은 논증)" 로 바꿔 근거와 출처를 모두 남기고 토큰만 제거했다. 페이즈 상시 규칙("게이트 토큰을 주석 문안에 쓰지 않기")이 이 충돌의 처리 방향을 이미 정해 두고 있었다.

### 3. D-19 목록 밖 문장 3줄을 함께 고쳤다 (이 플랜이 거짓으로 만든 진술)

- **내용:** `CLAUDE.md` "3개 페이지 모두 1초 `setInterval`", `CONVENTIONS.md` "페이지 3개와 컴포넌트 7개", "3개 페이지 전부 1초 `setInterval`"(+ 페이지 목록 한 줄) — 라우트가 5개, 컴포넌트가 9개가 되면서 **이 플랜 때문에** 거짓이 된 문장들이다.
- **처리:** 4개 페이지·9개 컴포넌트로 고치고, 같은 줄의 줄 번호 인용(`app/page.tsx:19-22` 등)도 실측으로 갱신했다(`app/page.tsx:27`·`:152`, `app/log/page.tsx:17`·`:93`, `app/rank/page.tsx:17`, `app/restaurants/page.tsx:18`). "낡은 진술을 새 거짓으로 바꾸지 않는다" 는 플랜 지시의 연장으로 판단했다.

### 4. gsd-sdk 문자열 버그 수동 정규화

- `state.record-metric` 이 위치 인자를 거부했다(`{"error":"phase, plan, and duration required"}`) → `--phase 05 --plan 02 --duration 10min --tasks 3 --files 8` 플래그 형태로 재호출.
- `state.add-decision` 이 `[Phase ?]:` 접두를 붙였다(5줄) → `[Phase 5]:` 로 교정(`grep -c '\[Phase ?\]'` → 0 확인).
- `state.advance-plan` 이 `status: executing` → `verifying`, `Status: Executing Phase 05` → `Phase complete — ready for verification` 로 바꾸고 `last_activity` 본문을 날짜만 남기고 지웠다 → 셋 다 복원(페이즈 완료 선언은 오케스트레이터 몫이라 `phase.complete` 는 부르지 않았다).
- `state.record-session` 이 `Stopped at:` 본문·frontmatter `stopped_at` 을 갱신하지 않았다 → 손으로 `Phase 5 executed — all 2 plans complete, review next` 로 고쳤다.

## 고치지 않고 남긴 낡은 진술 (확인했으나 범위 밖)

| 위치 | 내용 | 남긴 이유 |
|---|---|---|
| `STRUCTURE.md` §Directory Layout | `migrations/ # 0001~0004` · `supabase/ # 서버 측 (tsconfig/eslint에서 제외됨)` | 0005 추가(Phase 2)·제외 좁히기(Phase 3)에서 생긴 낡음이고 D-19 목록 밖이다. 같은 문서의 §Configuration `exclude` 서술도 같은 계열 |
| `STRUCTURE.md` §Directory Purposes `supabase/functions/` | "제외돼 있어 타입체크·lint가 돌지 않는다" | Phase 3 이 `_shared/**` 를 검사 대상으로 되돌린 뒤의 낡음. `CLAUDE.md`·`CONVENTIONS.md` 에는 이미 정확한 서술이 있다 |
| `CONVENTIONS.md` §Error Handling "클라이언트 읽기 — 에러를 확인하지 않는다(현재 상태)" | Phase 1 이 `loadError` 로 고친 뒤의 낡음 | 같은 절이 "새 읽기 코드는 `actionError` 패턴을 따르라" 로 끝나 결론은 현행과 일치한다. 본문 교체는 D-19 범위 밖 |
| `CLAUDE.md` 화면 하드코딩 "11:55" | Phase 6 소관으로 이미 명시돼 있다 | 매장 탭에는 하드코딩 시각을 새로 만들지 않았다(푸터 문구는 "매일 자정") |

`README.md` 는 손대지 않았다(SHIP-03, Phase 8 소관).

## Known Stubs

없음. 하드코딩된 빈 배열·플레이스홀더 문구·미배선 컴포넌트가 0건이다. 목록이 비어 보이는 두 경우(초기 로드 중 · 조회 실패)는 stub 이 아니라 상태이고, 후자는 배너가 함께 뜬다. `RestaurantList` 의 다섯 콜백은 전부 페이지의 실제 PostgREST 호출에 연결돼 있다.

## Phase 6 이 이어받을 경계

| 이름 | 위치 | 계약 |
|---|---|---|
| `useRestaurants()` | `lib/useRestaurants.ts` | `{ rows, loaded, error }` — 오늘 탭도 같은 훅을 그대로 마운트하면 된다(토픽이 인스턴스별이라 두 탭이 동시에 떠도 안전) |
| `sortRestaurants` | `lib/restaurants.ts` | 표시 순서(핀 먼저·이름순). 후보 목록 정렬은 별개 결정(todo `wr-02`) |
| `RestaurantRow` | `lib/supabase/client.ts` | 무변경. `MenuRow`/`PinnedMenuRow` 삭제는 Phase 6 |
| `RestaurantList` 의 props 모양 | `components/RestaurantList.tsx` | 후보 토글을 붙인다면 `~Action` 콜백 하나를 더하는 형태가 된다(컴포넌트는 계속 supabase 를 부르지 않는다) |

**후속 조건 2건:**
1. **(Phase 6)** `lib/restaurants.ts` 의 `import { parseMenuInput } from "@/components/MenuList"` 는 `lib/` 단방향 규칙의 예외다. `MenuList` 를 지울 때 `parseMenuInput`·`truncateToCodePoints` 를 `lib/` 로 옮겨야 예외가 사라진다 — `CLAUDE.md` §코드 컨벤션과 `STRUCTURE.md` §Directory Purposes `lib/` 양쪽에 기록했다.
2. **(Phase 6)** 매장 삭제 UI 가 생겼으므로 todo `in-06`(오늘 탭 realtime UPDATE 가드 — `results.restaurant_id` on delete set null)의 경로를 사용자가 실제로 밟을 수 있다. Phase 6 에서 닫는다.

## Threat Flags

없음 — 새로 연 표면은 전부 플랜 `<threat_model>` 이 이미 배정한 것이고 `mitigate` 6건이 코드에 반영됐다.

| Threat ID | 반영 지점 | 자동 단언 |
|---|---|---|
| T-05-06 | `parseLocationLink` 통과분만 앵커 + `target`·`rel` 동반 | `rel="noopener noreferrer"` 1 · `target="_blank"` 1 |
| T-05-07 | 쓰기 실패 문장이 전부 번역 함수를 지남 | 출현 5회 · `error.(details\|hint)` 0 · 직접 조립 0 |
| T-05-08 | DELETE 를 부분 행으로 받고 식별자만 전달 | `payload.old as Partial<RestaurantRow>` 1 · spec `lib/restaurants.test.ts:320` |
| T-05-09 | 행 안 2단계 확인 + 파급 안내 문구 | `window.confirm\|alert\|prompt` 0 |
| T-05-10 | 토픽이 구독 인스턴스마다 유일 | `restaurants-${++topicSeq}` 1 · 고정 문자열 0 |
| T-05-SC | 설치 0건 | `git diff --stat -- package.json package-lock.json` 0줄 |
| T-05-LIVE | 라이브 무접촉 | 배포·원격 SQL·`git push`·매장 등록 0회 |

`accept` 2건(T-05-11 anon 쓰기 권한 · T-05-12 카탈로그 무한 증가)은 설계상 수용 그대로다 — 앱 계층에 인증·레이트리밋·페이지네이션을 넣지 않았다.

## Self-Check: PASSED

**파일 존재(8/8):** `lib/useRestaurants.ts` · `components/RestaurantList.tsx` · `app/restaurants/page.tsx` · `components/TopBar.tsx` · `CLAUDE.md` · `.planning/codebase/STRUCTURE.md` · `.planning/codebase/CONVENTIONS.md` · `.planning/REQUIREMENTS.md` 전부 FOUND.
**커밋 존재(3/3):** `962d41b` FOUND · `833a3f9` FOUND · `6b0aa48` FOUND. 각 커밋의 `--name-only` 가 플랜이 지정한 파일 집합과 정확히 일치한다(2 / 2 / 4개).
**빌드 산출:** `npm run build` 라우트 목록에 `/restaurants` 포함, 기존 4개 유지.
**요구사항:** CATL-01~06 이 체크박스 6줄·Traceability 6행 양쪽에서 Complete.
