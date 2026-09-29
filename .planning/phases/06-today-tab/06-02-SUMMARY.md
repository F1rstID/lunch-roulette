---
phase: 06-today-tab
plan: 02
subsystem: today-tab-ui
tags: [realtime, hook, candidates, toggle-list, spin-time, prop-drilling, cleanup, docs]

# Dependency graph
requires:
  - phase: 06-today-tab
    plan: 01
    provides: "lib/rowset.ts · lib/candidates.ts · lib/menus.ts · displayPhase · formatSpinTime/addMinutesToSpinTime · formatCandidateWriteError — 이 플랜이 화면에 붙인 판단 전부"
  - phase: 05-restaurants-tab
    provides: "useRestaurants(무변경 재사용) · sortRestaurants · parseLocationLink/joinMenus · RestaurantList 의 status 3상태·pinBusyId 전례"
  - phase: 04-server-spin
    provides: "results.menu = 매장명 스냅샷 + restaurant_id 계약, respin 이 항상 새 spun_at 을 쓴다는 사실(D-08 가드의 근거)"
  - phase: 02-data-model
    provides: "0005 의 candidates(PK restaurant_id · cascade) · results.restaurant_id(on delete set null) · RLS 전면 개방"
provides:
  - "lib/useCandidates.ts — 오늘 후보 SELECT 1회 + candidates-<n> 토픽 INSERT/DELETE 2분기 구독(87줄). 읽기 전용, 본문 if 0개"
  - "components/CandidateList.tsx — 단일 목록 행 토글 카드(340줄). 이름 필터·배지·잠금·빈 상태 3종·행 단위 진행 가드. supabase 호출 0"
  - "components/MenuChips.tsx · components/LocationLink.tsx — 결과 화면과 매장 탭이 공유하는 표시 조각(65·31줄). MENU_CHIP_LIMIT 의 새 집"
  - "app/page.tsx — 훅 2개 + results 2분기 구독(results-<n> · isNewSpin 가드) + 후보 쓰기 2종 + 배너 5조각 합성"
  - "화면 추첨 시각 문구의 prop 화 — Wheel·ResultBlock·PhaseTimeline·phaseSubhead 전부 기본값 없음"
  - "displayPhase 배선 4페이지 — 설정 로드 전 stalled 라벨 깜빡임 제거"
affects: [07-history-rank, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "화면에 보이는 설정값은 기본값 없는 필수 prop 으로 내린다 — 기본값이 있으면 배선을 잊은 호출부가 조용히 옛 값을 그린다"
    - "상태 거울(ref)로 Realtime 페이로드에 없는 '이전 값' 을 복원한다 — DELETE 계열 페이로드에는 PK 만 온다"
    - "표시 조각을 컴포넌트로 뽑아 두 화면이 같은 구현을 쓰게 한다 — 보안 속성(target/rel)도 한 곳에서 걸린다"
    - "목록 3상태(loading·failed·ready)를 페이지가 훅에서 좁혀 넘긴다 — 실패에 등록 권유 문구가 뜨지 않게 하는 최소 경로"
    - "임시 계약 spec(‘아직 남아 있다’)은 그 일을 하는 페이즈에서 반대 기대로 뒤집는다 — 지우면 건수가 줄고 회귀 가드도 사라진다"

key-files:
  created:
    - lib/useCandidates.ts
    - components/CandidateList.tsx
    - components/MenuChips.tsx
    - components/LocationLink.tsx
  modified:
    - app/page.tsx
    - app/layout.tsx
    - app/restaurants/page.tsx
    - app/log/page.tsx
    - app/rank/page.tsx
    - components/Wheel.tsx
    - components/ResultBlock.tsx
    - components/PhaseTimeline.tsx
    - components/RestaurantList.tsx
    - lib/supabase/client.ts
    - lib/constants.ts
    - lib/restaurants.test.ts
    - supabase/migrations/0005_restaurants_settings.test.ts
    - supabase/functions/_shared/spinTime.ts
    - CLAUDE.md
    - .planning/codebase/STRUCTURE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/CONCERNS.md
    - .planning/REQUIREMENTS.md
  deleted:
    - components/MenuList.tsx
    - .planning/todos/pending/in-02-settings-loaded-first-paint.md
    - .planning/todos/pending/in-03-usesettings-branches-to-reducer.md
    - .planning/todos/pending/in-06-results-update-on-delete-set-null.md
    - .planning/todos/pending/wr-02-pinned-reseed-order.md

key-decisions:
  - "오늘 탭이 훅 2개(useRestaurants 무변경 + useCandidates 신규)로 읽고 조인은 클라이언트 순수 함수가 한다 — candidates 행은 키와 시각뿐이라 Realtime 페이로드만으로 매장명을 알 수 없고, 카탈로그는 토글 목록 때문에 어차피 전부 필요하다 (D-01)"
  - "useCandidates 는 INSERT·DELETE 2분기만 구독한다 — 이 테이블은 PK 와 created_at 뿐이라 앱 경로에 UPDATE 가 없고, 분기를 늘리면 아무도 밟지 않는 실패 경로가 는다 (D-02)"
  - "applyResult 가 todayResultRef(상태 거울) + isNewSpin 으로 판정해 추첨 시각이 같은 UPDATE 를 걸러 낸다 — 매장 삭제가 내보내는 set-null 갱신으로 휠이 5초씩 돌던 경로가 닫혔다. INSERT → UPDATE 순서와 initialLoadedRef 의 의미는 그대로 (D-08, todo in-06 닫음)"
  - "결과 채널 토픽을 고정 문자열에서 results-<n> 로 바꿨다 — 라우트 전환에서 새 구독이 leave 중인 옛 인스턴스에 붙어 에러 없이 죽는 문제가 오늘 탭에도 있었다 (D-09)"
  - "후보 목록을 두 섹션이 아니라 단일 목록 + 행 토글로 그린다 — 담기·빼기가 한 동작이고, 목록이 둘이면 같은 매장이 두 곳에 있는 것처럼 읽힌다. 낙관적 업데이트 없음: 행이 위아래로 옮겨가는 것 자체가 피드백이다 (D-10)"
  - "결과의 이름은 항상 results.menu 스냅샷이고 메뉴·위치만 현재 카탈로그에서 채운다 — 두 출처가 다른 것이 의도다. 매장을 지우면 상세만 비고 이름은 남는다 (D-18 · CATL-03)"
  - "stalled 에 수동 '지금 돌리기' 버튼을 두지 않았다 — pg_cron 이 추첨 시각 이후 매분 spin-roulette 를 부르므로 후보를 담으면 1분 안에 서버가 뽑는다. 문구가 그 사실을 알린다 (D-19)"
  - "화면 추첨 시각 문구를 전부 기본값 없는 필수 prop 으로 바꿨다 — ResultBlock 의 spinTime = \"11:55\" 기본값이 정확히 그 함정이었다 (D-21 · SPIN-06)"
  - "PhaseTimeline 의 prop 을 문자열이 아니라 SpinTime 값으로 받는다 — 결과 단계가 추첨 시각 + 5분이라 더하기가 필요하다 (플래너 판단)"
  - "마이그레이션 spec 의 계약 #42('MenuRow·PinnedMenuRow 가 아직 남아 있다')를 삭제가 아니라 반대 기대로 뒤집었다 — 테스트 건수 354 를 유지하면서 '되돌아오면 걸린다' 는 가드로 바뀐다 (플랜 미명시 구간의 판단)"

patterns-established:
  - "게이트 토큰(maxLength·target/rel·11:55)을 주석 문안에 리터럴로 쓰지 않는다 — 한글 표현으로 바꿔 적는다(Phase 2~5 의 같은 결정 재적용). 이번에 세 곳이 인수 조건을 깨뜨렸다가 고쳐졌다"
  - "문서의 낡은 인용은 파일 경로째 지우지 말고 '구 X(Phase N 에서 삭제)' 로 바꿔 이력을 남긴다 — CONCERNS 의 감사 항목은 당시 사실의 기록이다"

requirements-completed: [CAND-01, CAND-02, CAND-03, CAND-05, SPIN-05, SPIN-06]

# Metrics
duration: 23min
completed: 2026-09-29
---

# Phase 6 Plan 02: 오늘 탭 매장 전환·배선 Summary

**06-01 이 세운 순수 로직 위에 화면과 I/O 를 붙여 오늘 탭의 후보 소스를 `menus` 자유 입력에서 카탈로그 토글 `candidates` 로 바꾸고, 결과 화면에 매장 상세를 붙이고, 화면에 보이는 `11:55` 리터럴을 0곳으로 만들었다 — 게이트 5종 exit 0, 테스트 354/13 유지(새 테스트 0건), 커밋 4개**

## Performance

- **Duration:** 23min (2026-09-29T03:30Z → 03:53Z)
- **Tasks:** 4/4
- **Files:** 신규 4 · 수정 20 · 삭제 5 (`git diff --shortstat 449a764~1 HEAD` → **28 files changed, 908 insertions(+), 716 deletions(-)**)

## Accomplishments

- **오늘 탭이 매장을 돌린다.** `app/page.tsx` 가 `useRestaurants()` + `useCandidates()` 두 훅으로 읽고, 조인·정렬·당첨 인덱스는 전부 `lib/candidates.ts` 의 순수 함수가 정한다. `menus`·`pinned_menus` 참조가 0이 됐다(`grep -cE 'from\("(menus|pinned_menus)"\)'` → 0, `table: "(menus|pinned_menus)"` → 0).
- **휠 이중 회전 경로가 닫혔다(todo in-06).** `applyResult` 가 `todayResultRef`(상태 거울)를 **읽고 나서 쓰고**, `initialLoadedRef.current && isNewSpin(prev, row)` 일 때만 회전을 켠다. `on delete set null` 이 내보내는 UPDATE 는 `spun_at` 이 같아 걸러진다. **INSERT(154행) → UPDATE(159행) 순서와 `initialLoadedRef` 의 의미는 그대로**이고, 바뀐 것은 구독 테이블·토픽·가드 한 덩어리뿐이다.
- **화면에 보이는 추첨 시각 리터럴이 0곳이다(SPIN-06).** `Wheel`·`ResultBlock`·`CandidateList`·`PhaseTimeline`·`phaseSubhead` 가 전부 prop 으로 받고 **기본값이 없다**. `ResultBlock` 의 `spinTime = "11:55"` 기본값이 삭제됐고 `app/layout.tsx` 의 정적 description 은 시각을 뺐다.
- **결과 화면이 매장이 됐다(SPIN-05).** 이름은 `todayResult.menu` 스냅샷, 메뉴·위치는 `restaurant_id` 로 찾은 **현재 카탈로그 행**에서 온다. 둘 다 비면 상세 줄 자체를 그리지 않는다. 렌더는 `MenuChips`·`LocationLink` 한 벌을 매장 탭과 공유한다 — `rel="noopener noreferrer"` 보호가 전에는 매장 탭에만 있었다.
- **네 페이지가 첫 페인트 라벨을 가린다(D-23).** `app/page.tsx`·`restaurants`·`log`·`rank` 모두 `displayPhase(currentPhase(...), settingsLoaded)` 이고 각 파일에서 `grep -cF 'displayPhase'` → **2**(import + 호출).
- **삭제가 끝났다.** `components/MenuList.tsx` 부재, `MenuRow`·`PinnedMenuRow` 레포 전역 0건, 접은 todo 4건 제거 → `.planning/todos/pending/` 에 `in-05`·`wr-01` 2개만 남았다.
- **문서 4파일이 현행이 됐다.** `CLAUDE.md` 에서 `Phase 6` 예고 문구가 0건이고 단방향 예외 문단이 사라졌다. `CONCERNS.md` 의 감사 항목 5건에 해소 표기가 붙었고 원 항목은 이력으로 남았다.

## Task Commits

| # | Task | Commit | Type | 경로 |
|---|---|---|---|---|
| 1 | 읽기 전용 후보 훅 + 표시 조각 2개 추출 (D-02·D-18·D-25) | `449a764` | feat | `lib/useCandidates.ts`·`components/MenuChips.tsx`·`components/LocationLink.tsx`·`components/RestaurantList.tsx` (4) |
| 2 | 후보 토글 카드 (D-10~D-15) | `c15ade7` | feat | `components/CandidateList.tsx` (1) |
| 3 | 오늘 탭 전환 + 시각 prop 화 + 삭제·정리 (D-08·D-09·D-16·D-18~D-24·D-26) | `f5d6031` | feat | 17 (삭제 5 포함) |
| 4 | 낭독 검증 + 문서 정정 (D-28) + 요구사항 6건 | `c759060` | docs | 6 |

네 커밋 모두 `git log -1 --format=%B \| grep -viE 'CLAUDE\.md' \| grep -ciE 'co-authored-by\|generated with\|claude\|anthropic'` → **0**, `git show --name-only --format= HEAD \| grep -cE '\.serena/\|config\.json'` → **0**.
페이즈 전체(06-01 의 2 + 06-02 의 4 = 6커밋) 같은 검사 → **0**.
의도치 않은 파일 삭제 0건 — Task 3 의 삭제 5건은 전부 계획된 것이다(`components/MenuList.tsx` + todo 4건).

## 게이트 5종 (최종, 명령 출력 기준)

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | exit **0** (무출력) |
| `npm run lint` | exit **0** (무출력 — eslint 에러 0·경고 0) |
| `npm test` | exit **0** · `Test Files  13 passed (13)` / `Tests  354 passed (354)` |
| `npm run build` | exit **0** · `✓ Compiled successfully` · `Finished TypeScript` · `✓ Generating static pages (7/7)` |
| `npm run check:edge` | exit **0** (`deno check --config supabase/functions/deno.json` 두 `index.ts`) |

**네 태스크 커밋 각각에서도 5종 전부 exit 0** 이었다. `check:edge` 는 어느 커밋에서도 적색이 아니었다.

**테스트 354/13 유지 — 새 테스트 0건.** 훅·컴포넌트·페이지는 렌더 하네스가 없어 테스트할 수 없고(`vitest.config.mts` 의 `environment: "node"` 단일 구성), 그래서 06-01 이 판단을 전부 순수 모듈로 가져갔다. 이 플랜의 검증은 낭독 + 정적 게이트 + 토큰 단언이다.

### `npm run build` 라우트 목록 (원문)

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /log
├ ○ /rank
└ ○ /restaurants


○  (Static)  prerendered as static content
```

네 라우트가 모두 남아 있다.

## D-22 — 화면 `11:55` 리터럴 0곳

명령 원문과 출력:

```
$ grep -rn '11:55' app components lib --include='*.ts' --include='*.tsx' | grep -v '//' | grep -vF '.test.ts' | wc -l
0
```

파일 단위 확인도 전부 0이다: `grep -c '11:55'` → `app/layout.tsx` 0 · `components/Wheel.tsx` 0 · `components/PhaseTimeline.tsx` 0 · `components/ResultBlock.tsx` 0.

**의도적으로 남긴 것:**

| 남긴 자리 | 왜 |
|---|---|
| `app/page.tsx`·`restaurants`·`log`·`rank` 의 `// 추첨 시각은 settings 가 정한다… 기본값(11:55)…` | 근거 주석. 화면에 닿지 않는다 |
| `lib/phase.ts:1,5,6` · `lib/useSettings.ts:18` · `lib/supabase/client.ts:54` | 같은 성격의 `//` 주석 |
| `lib/time.test.ts`·`lib/phase.test.ts`·`lib/settings.test.ts` 의 기대값 | 상수를 import 하면 "11:55 가 기본" 이라는 계약이 테스트에서 사라진다(Phase 1 이 정한 규칙) |
| `supabase/functions/_shared/spinTime.ts:10,12` `DEFAULT_SPIN_TIME_TEXT`/`DEFAULT_SPIN_TIME` | 값의 유일한 정의처. `settings.spin_time` 이 없거나 안 읽힐 때의 착지점 |
| `supabase/migrations/0002_cron.sql` `'55 2 * * *'` · `0005` 의 `spin_time` 기본값 | DB 쪽 기본값. 남은 유일한 중복 갈래이고 의도적으로 남긴다 |

`components/PhaseTimeline.tsx` 의 `RESULT_STEP_OFFSET_MIN` 근거 주석에 처음엔 `11:55 → 12:00` 을 적었다가 인수 조건(해당 파일 0건)에 걸려 "추첨 → 결과 간격(5분)" 으로 바꿨다.

## 계약 #56 확인

```
$ npx vitest run supabase/functions/_shared/edgeImports.test.ts
 Test Files  1 passed (1)
      Tests  58 passed (58)
```

`app/page.tsx` 의 `"no_candidates"` 리터럴은 **정확히 1개**다(`grep -oF '"no_candidates"' app/page.tsx | wc -l` → 1). `respin()` 은 한 줄도 바뀌지 않았다 — 아래 낭독 항목 참조.

## 낭독 검증 10항목 (파일:줄 인용 + 판정)

**1. `results` 구독 순서와 `initialLoadedRef` 의 뜻 — ✅**
`app/page.tsx:152-162`. INSERT 핸들러가 `:154`(`event: "INSERT"`), UPDATE 가 `:159`(`event: "UPDATE"`) — **INSERT 가 먼저**다(`grep -n` 으로 154 < 159 확인). 둘 다 같은 `applyResult` 를 부르고, 그 안의 가드가 `initialLoadedRef.current && …`(`:145`)다. `initialLoadedRef` 의 출현은 정확히 4회: 선언(`:53`) · 조회 시작 시 false(`:107`) · 조회 끝에 true(`:124`) · 가드(`:145`). 의미는 그대로 — "초기 조회가 끝난 뒤 도착한 이벤트만 휠을 돌린다".

**2. `applyResult` 의 읽기-쓰기 순서와 set-null 시나리오 — ✅**
`app/page.tsx:139-149`:
```
const prev = todayResultRef.current;   // :141  먼저 읽고
todayResultRef.current = row;          // :142  그다음 쓴다
setTodayResult(row);                   // :143
if (initialLoadedRef.current && isNewSpin(prev, row)) {   // :145
```
`setForceSpin`(`:146`)은 setState 업데이터 **바깥**에서 불린다(`setTodayResult(row)` 는 값 인자이고 업데이터 콜백이 아니다).

*시나리오 추적 — 당첨 매장을 매장 탭에서 삭제:* `restaurants` DELETE → `0005:69` 의 `on delete set null` 이 `results.restaurant_id` 를 null 로 UPDATE → Realtime UPDATE 도착 → `applyResult(row)` → `row.date === todayKey` 통과 → `prev` = 직전 결과 행, `row.spun_at` 은 **서버가 건드리지 않았으므로 prev 와 같다** → `isNewSpin(prev, row)`(`lib/candidates.ts:107-109`, `prev.spun_at !== next.spun_at`)가 **false** → 회전 안 켜짐. 행만 갱신되고 `winnerIndex`(`findWinnerIndex`, `lib/candidates.ts:98` `result.restaurant_id === null → -1`)가 -1 이 되어 **휠 하이라이트만 사라진다.** 이름은 `winner.name = todayResult.menu` 라 그대로 남는다. 반대로 다시 돌리기는 `respin-roulette` 가 `spun_at` 을 항상 새로 쓰므로 `isNewSpin` 이 true → 정상 재회전.

**3. `components/Wheel.tsx` 무변경 범위 — ✅**
`git diff main -- components/Wheel.tsx` → `--numstat` **4 삽입 / 1 삭제**, 세 덩어리뿐이다: (a) `Props` 에 `spinTimeText: string` + 근거 주석 1줄(`:15-16`), (b) 시그니처 분해에 `spinTimeText,` 한 줄(`:48`), (c) 허브 텍스트 `11:55` → `{spinTimeText}`(`:261`). `SPIN_TURNS`/`SPIN_MS`/`SPIN_EASING`(`:21-23`)·`spinJitter`·`restRotation`·`isSpinning`·`rotation` 파생(`:52-63`)·`Pointer`·스타일은 diff 에 나타나지 않는다. `:249` 의 `SPIN AT` 도 그대로다.

**4. `lib/useCandidates.ts` 구독 형태 — ✅**
`:63-65` INSERT 분기, `:70-72` DELETE 분기 — 두 분기의 `table` 이 **둘 다 `"candidates"`**(`grep -cF 'table: "candidates"'` → 2)이고 이벤트가 서로 다르다. `event: "UPDATE"` 0건, `event: "*"` 0건. DELETE 는 `payload.old as Partial<CandidateRow>`(`:78`)에서 `restaurant_id` 를 키로 넘긴다(`:79`) — 이 테이블의 PK 가 그 컬럼이라 페이로드에 그것만 온다. cleanup 은 `supabase.removeChannel(ch)`(`:84`, 1건). 조회는 SELECT 1회(`from("candidates")` 1건)이고 쓰기 0건. **훅 본문의 `if`/`} else` 0개** (`grep -cE '^[[:space:]]*(if|\} else)'` → 0).

**5. 담기 중 `23505` 가 성공 경로인가 — ✅**
`app/page.tsx:189-192`:
```
function reportCandidateWrite(message: string | null): boolean {
  setActionError(message);
  return message === null;
}
```
`formatCandidateWriteError`(`lib/errors.ts:100`)가 `code === "23505" && action === "담기"` 에 `null` 을 주면 `setActionError(null)` 로 배너를 지우고 `true`(성공)를 돌려준다. 그 판정은 페이지에 **딱 한 곳**(`reportCandidateWrite`)이고 두 핸들러가 함께 쓴다 — 담기·빼기 어느 쪽도 자기 판정을 따로 갖지 않는다.

**6. 잠금이 한 곳에서 오는가, `stalled` 에서 토글이 사는가 — ✅**
`components/CandidateList.tsx:60` `const readOnly = isCandidateListLocked(phase);` 한 줄이 유일한 판정이고, `:209` 의 `disabled={disabled}`(= `readOnly || busy`)가 그 값을 쓴다. `grep -cF 'isCandidateListLocked'` → 2(import + 호출) — 컴포넌트가 페이즈를 직접 비교하는 자리가 없다. `stalled` 가 잠기지 않는다는 사실은 `lib/phase.ts:41-44` 와 spec 이 든다: `lib/phase.test.ts:67` `describe("isCandidateListLocked — stalled 에서는 후보 목록이 잠기지 않는다 (SPIN-03)")`, `:80-81` `it("stalled 는 잠기지 않는다 …") → expect(isCandidateListLocked("stalled")).toBe(false)`.

**7. 결과의 이름 출처와 상세 출처가 다른가 — ✅**
`app/page.tsx:96-100`:
```
const store = restaurantRows.find((row) => row.id === todayResult.restaurant_id);
return { name: todayResult.menu, menus: store?.menus ?? [], location: store?.location ?? null };
```
이름은 **결과 행에서만** 온다(카탈로그를 다시 읽지 않는다). 상세는 `restaurant_id` 로 찾은 현재 행이고, 못 찾으면 `[]`·`null`. `components/ResultBlock.tsx:96` 의 조건 `(winner.menus.length > 0 || winner.location !== null)` 이 false 가 되어 **상세 줄 자체가 렌더되지 않는다** — 이름과 "n개 후보 중 당첨" 줄만 남는다.

**8. 타임라인이 설정 시각으로 조립되는가 — ✅**
`components/PhaseTimeline.tsx:25-33`. `STEPS`(`:17-22`)에는 `id`·`label` 만 남았고 `time` 필드가 사라졌다. 문구는 `times` 맵(`:28-33`)이 만든다: 모집 `` `—${spinText}` `` · 룰렛 `spinText` · 결과 `` `${resultText}—` `` · 리셋 `"00:00"`(고정). `activeIdx`/`idx` 계산(`:36-37`)과 렌더 구조는 무변경.

*23:58 손 계산:* `addMinutesToSpinTime({hh:23,mm:58}, 5)` → `(23*60+58+5) mod 1440` = `1443 mod 1440` = **3** → `{hh:0, mm:3}` → `formatSpinTime` → `"00:03"`. 따라서 네 단계는 `—23:58` · `23:58` · **`00:03—`** · `00:00`. `lib/time.ts:63-67` 의 구현으로 실제 계산해 같은 값을 확인했다.

**9. 컷오버 전 라이브 증상 — ✅ (근거 확인)**
라이브 DB 에는 `restaurants`·`candidates`·`settings` 세 테이블이 **아직 없다**(마이그레이션 미적용, Phase 8). 세 훅의 최초 SELECT 가 PostgREST 의 `PGRST205`(404)로 실패하고, 그 응답이 `dispatch({ type: "fetched", rows: null, error })` 로 리듀서에 들어가 `{ rows: [], loaded: true, error: message }` 가 된다(`lib/rowset.ts:71-76`, 설정은 `lib/settings.ts` 의 같은 경로). 페이지는 그 `error` 셋을 `loadBanner`(`app/page.tsx:277-283`)에서 `formatLoadError("매장 카탈로그"…)` · `formatLoadError("오늘 후보"…)` · `formatLoadError("설정"…)` 로 합친다. 근거 주석은 `lib/useRestaurants.ts:12-13`·`lib/useCandidates.ts:14-15`·`lib/useSettings.ts:17-19` 에 같은 문장으로 있다.
**→ 컷오버 전 오늘 탭의 정상 상태는 배너 3개(매장 카탈로그·오늘 후보·설정) + 빈 휠 + 빈 목록이고, 결과 조회만 성공한다.** 오히려 배너가 안 뜨면 에러를 삼키고 있다는 신호다. `main` 은 이 페이즈에서도 불변이므로 실사용자 영향은 0이다.

**10. 계약 #56 — ✅**
`npx vitest run supabase/functions/_shared/edgeImports.test.ts` → `Tests  58 passed (58)`. 단언은 `supabase/functions/_shared/edgeImports.test.ts:389-395`: `expect([rawPage.length > 0, count(page, /"no_candidates"/g)]).toEqual([true, 1])`. `app/page.tsx` 의 실측 출현 1회.

## 토큰 단언 (인수 조건 실측)

| 대상 | 토큰 | 기준 | 실측 |
|---|---|---|---|
| `lib/useCandidates.ts` | `export function useCandidates` / `table: "candidates"` / `from("candidates")` | 1 / 2 / 1 | **1 / 2 / 1** |
| 〃 | `event: "UPDATE"` / `event: "*"` / 쓰기 4종 / `^\s*(if\|} else)` | 0 | **0 / 0 / 0 / 0** |
| 〃 | `candidates-${++topicSeq}` / `removeChannel` / `payload.old as Partial<CandidateRow>` | 1 / 1 / 1 | **1 / 1 / 1** |
| `components/MenuChips.tsx` | `export function MenuChips` / `MENU_CHIP_LIMIT` / `supabase.` / hex | 1 / ≥2 / 0 / 0 | **1 / 2 / 0 / 0** |
| `components/LocationLink.tsx` | `export function LocationLink` / `target="_blank"` / `rel="noopener noreferrer"` / `supabase.` | 1 / 1 / 1 / 0 | **1 / 1 / 1 / 0** |
| `components/RestaurantList.tsx` | `MENU_CHIP_LIMIT` / `MENUS_INPUT_MAX_LEN` / `rel="noopener noreferrer"` / `<MenuChips` / `<LocationLink` | 0 / 0 / 0 / 1 / 1 | **0 / 0 / 0 / 1 / 1** |
| `components/CandidateList.tsx` | `supabase.` / `from("…")` / `aria-pressed` / `maxLength` / `onTogglePinAction` / `window.confirm\|alert\|prompt` / `useCallback` / hex | 0 | **전부 0** |
| 〃 | `listTodayRows` / `isCandidateListLocked` / `SLICE_COLORS` / `href="/restaurants"` / `satisfies Record<…>` / 최상위 export | 2 / 2 / ≥2 / 2 / 1 / 1 | **2 / 2 / 2 / 2 / 1 / 1** |
| 〃 | 문구 6종(`오늘의 후보`·`매장 이름으로 찾기`·`등록된 매장이 없어요.`·`매장 탭에서 먼저 등록해 주세요.`·`메뉴 미등록`·`마감됨`·`고정 매장 — 매일 자정 자동으로 담겨요`) | 각 1 | **전부 1** |
| `app/page.tsx` | `useCandidates()` / `useRestaurants()` / `useSettings()` / `from("candidates")` | 1 / 1 / 1 / 2 | **1 / 1 / 1 / 2** |
| 〃 | `table: "results"` / `table: "(menus\|pinned_menus)"` / `from("(menus\|pinned_menus)")` | 2 / 0 / 0 | **2 / 0 / 0** |
| 〃 | `.channel("lunch-realtime")` / `results-${++topicSeq}` | 0 / 1 | **0 / 1** |
| 〃 | `isNewSpin` / `todayResultRef` / `initialLoadedRef` / `formatCandidateWriteError`(출현) | 2 / ≥3 / 4 / 5 | **2 / 4 / 4 / 5** |
| 〃 | `error.(details\|hint)` / `"no_candidates"` / hex / `<ErrorBanner` | 0 / 1 / 0 / 2 | **0 / 1 / 0 / 2** |
| 〃 | `spinTimeText` | ≥5 | **8** |
| 4개 페이지 | `displayPhase` | 각 2 | **2 / 2 / 2 / 2** |
| `components/Wheel.tsx` | `spinTimeText` | 3 | **3** |
| `components/ResultBlock.tsx` | `spinTime = "11:55"` / `후보 메뉴` / `<MenuChips` / `<LocationLink` / `후보를 담으면 1분 안에 자동으로 뽑아요` | 0 / 0 / 1 / 1 / 1 | **0 / 0 / 1 / 1 / 1** |
| `components/ResultBlock.tsx`·`app/page.tsx` | `지금 돌리기` | 0 | **0 / 0** |
| `components/PhaseTimeline.tsx` | `RESULT_STEP_OFFSET_MIN` / `addMinutesToSpinTime` | 2 / 2 | **2 / 2** |
| `app/layout.tsx` | `익명 점심 매장 룰렛` | 1 | **1** |

## 삭제 — 참조 0 확인 후

| 대상 | 삭제 전 확인 | 삭제 후 |
|---|---|---|
| `components/MenuList.tsx` | `grep -rn 'MenuList' app components lib --include='*.ts' --include='*.tsx'`(자기 자신 제외) → **1줄**(`lib/restaurants.test.ts:3` 의 낡은 주석 인용, 아래 Deviation 2) | `test -f` exit **1** · `grep -rl 'MenuList' app components lib` → **0파일** |
| `MenuRow`·`PinnedMenuRow` (`lib/supabase/client.ts`) | `grep -rn 'MenuRow\|PinnedMenuRow' app components lib`(client.ts·MenuList.tsx 제외) → **0줄** | `grep -cE 'MenuRow\|PinnedMenuRow' lib/supabase/client.ts` → **0** · 레포 `app`·`components`·`lib` 전역 **0파일** |
| 접은 todo 4건 (`in-02`·`in-03`·`in-06`·`wr-02`) | 각 결정이 코드로 닫힌 것을 확인(D-23·D-04·D-08·D-06) | `ls .planning/todos/pending/` → **2줄**: `in-05-history-since-same-day.md` · `wr-01-cutover-window.md` |

## 무변경·범위 확인

| 항목 | 결과 |
|---|---|
| `git diff --stat -- package.json package-lock.json` | **0줄** (npm 패키지 추가 0 — `npm install` 0회) |
| `supabase/functions/spin-roulette/**`·`respin-roulette/**`·`deno.json`·`deno.lock` | **무변경** (`git status --porcelain` 0줄) |
| `supabase/migrations/*.sql` | **무변경** (SQL 파일 0건 수정) |
| `supabase/functions/_shared/spinTime.ts` | Task 4 에서 **주석 한 줄만** 과거형으로. 계약 58건·`check:edge` 초록 유지 |
| 루트 `deno.lock` | `test -f deno.lock` exit **1** (미생성) |
| `respin()` (`app/page.tsx`) | **바이트 단위 무변경** — 직전 커밋의 같은 함수와 `diff` 무출력(30줄) |
| `.serena/project.yml`·`.planning/config.json` | 네 커밋 모두 미스테이징 (`grep -cE '\.serena/\|config\.json'` → 0) |
| 미추적 파일 | `git status --short \| grep '^??'` → **0건** |
| 라이브 | 배포·원격 SQL·`git push`·`npm run dev`·`rm -rf .next` **0회**. 라이브 DB 에 매장·후보 등록 **0건** |

## Deviations from Plan

### 1. `setActionError(` 직접 조립 0건 단언이 "`respin()` 무변경" 과 충돌한다 (플랜 인수 조건의 내부 모순)

- **플랜 원문:** Task 3 인수 조건 — `` grep -cE 'setActionError\(`|setActionError\("' app/page.tsx `` → `0`. 같은 태스크가 `<action>` 14항과 금지 사항에서 **`respin()` 은 한 줄도 바꾸지 않는다** 를 못 박는다(계약 #56 때문이다).
- **실측:** **3건**. 전부 `respin()` 안이다 — `app/page.tsx:233`·`:238`·`:247`. 셋 다 백틱 템플릿(`` `다시 돌리기 실패: ${formatRespinError(...)}` `` 등)이라 정규식에 걸린다. 두 요구를 동시에 만족시키는 것은 불가능하다.
- **더 강한 동등 검사:** 이 단언의 목적은 위협 T-06-10 — **후보 쓰기** 실패 문장이 순수 번역 함수를 거치지 않고 조립되는 것을 막는 것이다. 그래서 범위를 후보 핸들러로 좁혀 다시 쟀다: `reportCandidateWrite` 선언부터 `respin()` 직전까지(`app/page.tsx:189-218`)에서 같은 정규식 → **0건**. 후보 경로의 모든 문장이 `formatCandidateWriteError` 를 지나고(출현 5회 = import 1 + 담기 2 + 빼기 2), `error.details|hint` 참조는 파일 전역 **0**이다. 남은 3건도 raw 조립이 아니라 `formatRespinError`(`lib/errors.ts:49`)라는 같은 성격의 순수 번역 함수를 지난다.
- **`respin()` 무변경 증명:** `git show HEAD~1:app/page.tsx` 와 현재 파일에서 각각 `async function respin` ~ 함수 끝을 추출해 `diff` → **무출력**(30줄 동일). `"no_candidates"` 1건 유지, 계약 58건 통과.
- **판정:** 후보 경로 0건 + `respin()` 바이트 동일 + 계약 초록으로 **통과 처리**. 플랜의 파일 전역 0건은 달성 불가능한 기대였다.

### 2. `lib/restaurants.test.ts` 의 낡은 인용 한 줄을 고쳤다 (플랜 `<files>` 밖)

- **발견:** `components/MenuList.tsx` 삭제 전 참조 확인에서 `lib/restaurants.test.ts:3` 이 `components/MenuList.test.ts:3-4` 를 인용하고 있었다. 그 파일은 06-01 이 `lib/menus.test.ts` 로 옮기며 이미 사라진 경로다.
- **왜 고쳐야 했나:** Task 3 인수 조건 `grep -rl 'MenuList' app components lib --include='*.ts' --include='*.tsx' | wc -l` → `0` 을 이 한 줄이 막는다. 또한 존재하지 않는 파일을 가리키는 인용은 그 자체로 오류다.
- **처리:** 같은 논증이 실제로 사는 자리를 확인해 `lib/menus.test.ts:5-6`(절단 상한을 리터럴로 쓰는 이유)으로 바꿨다. **주석 한 줄만** 바뀌었고 `it` 개수·기대값은 무변경 — `lib/restaurants.test.ts` 53건 그대로다.
- **커밋:** `f5d6031` (Task 3).

### 3. 마이그레이션 계약 #42 를 반대 기대로 뒤집었다 (플랜 미예견 — 테스트 파일 수정 금지와 충돌)

- **충돌:** 플랜은 "새 vitest 케이스 추가 금지 · 354/13 유지" 와 `git status --porcelain -- supabase/` → 0줄을 요구하면서, 동시에 `lib/supabase/client.ts` 에서 `MenuRow`·`PinnedMenuRow` 를 **지우라**(D-24)고 한다.
- **실측:** 타입을 지우자 `npm test` 가 **1 failed | 353 passed**. 깨진 것은 `supabase/migrations/0005_restaurants_settings.test.ts:369` 의 계약 #42 `it("MenuRow 와 PinnedMenuRow 가 아직 남아 있다 (#42)")` 이고, 그 spec 의 본문 주석이 **`// 페이지가 아직 참조하므로 이 페이즈에서 지우면 tsc 가 깨진다. 제거는 Phase 6.`** — 즉 이 페이즈가 오면 수명이 끝나도록 설계된 임시 가드다. 플랜이 그 존재를 예견하지 못했다.
- **판단:** 삭제하면 353/13 이 되어 건수 유지 단언을 깨고 회귀 가드도 사라진다. 그래서 **기대를 뒤집었다** — `toEqual([1, 1])` → `toEqual([0, 0])`, 제목은 `"MenuRow 와 PinnedMenuRow 가 사라졌다 (#42)"`, 주석은 "지워진 사실 자체가 계약이다 — 구 테이블을 다시 읽는 코드가 들어오면 여기서 먼저 걸린다". 06-01 이 D-05 에서 쓴 방법(반대 기대로 뒤집기)과 같은 형태다. **계약 번호 #42 와 테스트 건수 354/13 이 둘 다 유지된다.**
- **부수 수정:** 같은 파일 `:4` 의 머리 주석도 사라진 `components/MenuList.test.ts:3-4` 를 인용하고 있어 `lib/menus.test.ts:5-6` 으로 고쳤다.
- **`git status --porcelain -- supabase/` 관련:** Task 3 인수 조건이 이 명령의 0줄을 요구하지만, 위 수정 때문에 `supabase/migrations/0005_restaurants_settings.test.ts` 한 줄이 떴다. **더 강한 동등 검사** — 그 단언의 목적(Edge Function·SQL·lock 무변경)을 범위를 나눠 확인했다: `git status --porcelain -- supabase/functions/ supabase/migrations/0005_restaurants_settings.sql supabase/migrations/0002_cron.sql` → **0줄**, 루트 `deno.lock` 부재, `npm run check:edge` exit 0, 계약 58건 통과. 바뀐 것은 **마이그레이션 spec 파일 한 개의 `it` 하나와 주석 한 줄**뿐이고 SQL·함수·lock 은 손대지 않았다. Task 4 의 인수 조건은 같은 검사를 이미 이 형태(`supabase/functions/spin-roulette/`·`respin-roulette/`·`deno.lock`·`migrations/`)로 좁혀 두었고 그쪽은 **0줄**이다.
- **커밋:** `f5d6031` (Task 3 — 타입 삭제와 그 계약이 같은 커밋에 있어야 어느 커밋에서도 적색이 아니다).

### 4. 게이트 토큰이 주석 문안에 섞여 인수 조건을 세 번 깨뜨렸다

06-01 `<execution_notes>` 의 상시 규칙("게이트 토큰을 주석 문안에 쓰지 않기")을 세 번 어겼다가 각각 고쳤다. 전부 발견 즉시 한글 표현으로 대체했고 동작 영향은 0이다.

| 파일 | 토큰 | 기준 | 어긴 실측 | 고친 뒤 |
|---|---|---|---|---|
| `components/LocationLink.tsx` | `target="_blank"` · `rel="noopener noreferrer"` | 각 1 | 각 **2**(머리 주석에 리터럴로 적음) | 각 **1** ("새 탭으로 여는 속성과 opener 차단 속성" 으로 대체) |
| `components/CandidateList.tsx` | `maxLength` | 0 | **1**(필터 입력 근거 주석) | **0** ("길이 상한" 으로 대체) |
| `components/PhaseTimeline.tsx` | `11:55` | 0 | **1**(`RESULT_STEP_OFFSET_MIN` 근거 주석) | **0** ("추첨 → 결과 간격(5분)" 으로 대체) |

### 5. gsd-sdk 문자열 버그 수동 정규화

06-01 Deviation 5 와 같은 항목이 재현됐다.

- `roadmap.update-plan-progress 6` 이 진행 행을 `| 6. 오늘 탭 | 1/2 | In Progress|  |` 로 써서 **상태 셀의 오른쪽 파이프 앞 공백이 사라지고 날짜 셀이 빈 칸**이 됐다(표 정렬이 깨진다). → SUMMARY 작성 후 재호출해 `2/2 | Complete` 를 받은 뒤 손으로 `| 6. 오늘 탭 | 2/2 | Complete    | 2026-09-29 |` 로 정규화했다.
- `state.advance-plan`·`state.record-session` 이 frontmatter `stopped_at`·`status`·`last_activity` 와 본문 `Status:`·`Last activity:`·Session Continuity 를 옛 값으로 되돌렸다 → 현재 사실("Phase 6 executed - all 2 plans complete, review next")로 직접 수정.
- `state.record-metric` 는 위치 인자를 거부해 `--phase/--plan/--duration/--tasks/--files` 플래그 형식으로 호출.
- `state.add-decision` 은 `--summary` 를 요구하고 `- [Phase ?]:` 접두를 붙여, `[Phase 6]` 으로 고치고 잘린 문장을 복원.
- 한글·특수문자 치환은 전부 `Edit` 도구로 했다(`perl`/`sed -i` 미사용).

### 6. BSD `sed` 가 인수 조건 한 줄을 오탐한다 (환경 차이)

- **플랜 원문:** `sed -n '/^| \(CAND-0[1235]\|SPIN-0[56]\) /p' .planning/REQUIREMENTS.md | grep -c 'Complete'` → `6`.
- **실측:** **0**. macOS 의 BSD `sed` 는 BRE 에서 `\|` 교대를 지원하지 않아 패턴이 아무 줄도 고르지 못한다(파일 내용과 무관한 도구 차이다).
- **더 강한 동등 검사:** `grep -cE '^\| (CAND-0[1235]|SPIN-0[56]) \|.*\| Complete \|$' .planning/REQUIREMENTS.md` → **6**, `sed -nE '/^\| (CAND-0[1235]|SPIN-0[56]) /p' … | grep -c 'Complete'` → **6**. 표의 여섯 행을 눈으로도 확인했다(아래 참조).
- **판정:** 통과. 플랜의 명령 형태만 GNU sed 전제였다.

### 7. 플랜 `<files>` 밖의 파일 2개가 커밋에 들어갔다

Task 3 의 커밋 대상이 플랜이 나열한 15경로가 아니라 **17경로**다. 추가된 둘은 Deviation 2·3 의 `lib/restaurants.test.ts` 와 `supabase/migrations/0005_restaurants_settings.test.ts` 이고, 둘 다 **인수 조건을 만족시키기 위해 반드시 필요한** 수정이었다(각각 `MenuList` 참조 0건, 354/13 유지). 두 파일 모두 주석·기대값만 바뀌었고 새 `it` 은 0건이다.

## 📋 Manual-Only 검증 (사용자, 초록 아님)

`npm run dev` 는 규칙상 실행하지 않았다(가드런처로만, 과거 커널 패닉). 아래는 사용자가 **가드런처로 띄운 뒤** 직접 확인할 항목이다.

| # | 어디서 | 무엇을 | 무엇을 봐야 하나 |
|---|---|---|---|
| 1 | `http://localhost:3000/` | 첫 로드 | 카드 제목 "오늘의 후보", 부제 `N개 매장 · HH:mm까지 담기`, 우측 mono 카운터가 **담긴 수** |
| 2 | 〃 필터 입력 | "매장 이름으로 찾기" 에 몇 글자 | 목록이 좁혀지고, 0건이면 `"질의" 에 맞는 매장이 없어요` |
| 3 | 〃 행 끝 버튼 | 안 담긴 행의 "담기" | 행이 **목록 위쪽으로 올라가고** 배지 번호가 붙는다(낙관적 갱신이 아니라 구독 반영이라 한 박자 뒤다) |
| 4 | 〃 | 담긴 행의 "빼기" | 행이 아래로 내려가고 배지가 사라진다. 뒤 번호들이 당겨진다 |
| 5 | 〃 배지 색 | 목록 배지 ↔ 휠 조각 | 같은 매장의 두 색이 **같아야** 한다(같은 `SLICE_COLORS` 매핑) |
| 6 | 〃 잠금 | 결과 확정 뒤(또는 `spinning`) | 토글 버튼이 전부 비활성·흐림, 부제가 `N개 매장 · 마감됨`. **필터 입력은 계속 눌린다** |
| 7 | 〃 결과 상세 | 결과가 있는 날 | 매장명 아래 메뉴 칩 + 위치. 메뉴·위치가 둘 다 없는 매장이면 **상세 줄이 아예 없어야** 한다 |
| 8 | 〃 타임라인 | 우상단 4단계 | `—HH:mm` · `HH:mm` · `HH:mm+5—` · `00:00`. 대시보드에서 `spin_time` 을 바꾸면 앞 3개가 따라 움직인다 |
| 9 | 〃 `/restaurants` 링크 | 빈 상태·푸터의 링크 | 매장 탭으로 이동. 매장 탭의 메뉴 칩·위치 링크 모양이 결과 화면과 **같아야** 한다 |

**컷오버 전 라이브 증상(정상):** 위 1~9 중 실제로 보이는 것은 **배너 3개(매장 카탈로그·오늘 후보·설정 불러오기 실패) + 빈 휠 + 빈 목록**뿐이다. 라이브에 세 테이블이 없어 최초 SELECT 가 `PGRST205` 로 실패하기 때문이고, 이것이 기대 상태다 — **배너가 안 뜨면 에러를 삼키고 있다는 신호다.** 결과 조회만 성공한다. 전체 화면을 보려면 Phase 8 컷오버(마이그레이션 적용 + 함수 배포)가 먼저다.

## Known Stubs

**없음.** 하드코딩된 빈 값·플레이스홀더 문구·미배선 컴포넌트 0건.

확인한 것: `CandidateList` 의 빈 배열 경로 3개는 전부 **의미 있는 상태**다 — `status === "failed"` 는 배너가 이유를 말하므로 목록을 그리지 않는 것이 설계(05 WR-03)이고, `loading` 은 빈 `<ul>`(스켈레톤 없음), `ready && catalog.length === 0` 은 등록 권유 + `/restaurants` 링크다. `winner.menus = []` / `location = null` 도 스텁이 아니라 "매장이 삭제됐거나 상세가 없다" 는 **사실의 표현**이고, 그때 상세 줄을 그리지 않는 것이 D-18 이 정한 동작이다. `TODO`/`FIXME`/`coming soon` 류 문자열은 신규 4파일에 0건이다.

## Threat Flags

**없음.** 새로 연 네트워크·인증·파일 접근 경로는 `candidates` 테이블 쓰기 2종뿐이고, 그것은 플랜 `<threat_model>` 이 이미 T-06-08 로 다뤘다(RLS 전면 개방은 익명 서비스의 설계상 수용). 플랜이 `mitigate` 로 배정한 6건은 전부 구현에 반영됐다.

| Threat ID | 반영 지점 | 자동 단언 |
|---|---|---|
| T-06-09 (LocationLink) | `parseLocationLink` 통과분만 앵커, 새 탭 + opener 차단 속성을 함께 단다. 렌더가 한 벌로 합쳐져 **결과 화면도 같은 보호를 받는다**(전에는 매장 탭에만 있었다) | `target="_blank"` 1 · `rel="noopener noreferrer"` 1 · `RestaurantList` 쪽 0(옮겨 감) |
| T-06-10 (actionError) | 후보 쓰기 실패 문장이 전부 `formatCandidateWriteError` 를 지난다. 직접 조립 0건(핸들러 범위) | `formatCandidateWriteError` 5회 · `error.(details\|hint)` **0** · 핸들러 범위 직접 조립 **0** |
| T-06-11 (결과 UPDATE 오인) | `todayResultRef` + `isNewSpin` 가드 | `isNewSpin` 2 · `todayResultRef` 4 · `initialLoadedRef` 4 |
| T-06-12 (채널 토픽) | `results-<n>`·`candidates-<n>` 인스턴스별 유일 | `.channel("lunch-realtime")` **0** · `results-${++topicSeq}` 1 · `candidates-${++topicSeq}` 1 |
| T-06-13 (페이로드 신뢰) | INSERT 는 `payload.new` 전체 행, DELETE 는 `payload.old` 에서 PK 하나만 | `payload.old as Partial<CandidateRow>` 1 · 키 없으면 리듀서가 아무 행도 안 지움(06-01 spec #11) |
| T-06-SC (패키지) | 설치 0건 | `git diff --stat -- package.json package-lock.json` **0줄** |
| T-06-LIVE (라이브) | 파일만 씀 | 배포·원격 SQL·`git push` **0회** · Edge Function·SQL·lock 무변경 |

## 다음 페이즈로 넘기는 것

### Phase 7 (기록·랭킹)이 이어받는 경계

- **`results` 행의 형태는 이 플랜이 확정한 그대로다:** `menu`(매장명 **스냅샷** — 매장을 지워도 남는다) · `restaurant_id`(`string | null`, `on delete set null`) · `spun_at`(다시 돌리기마다 새로 쓰인다) · `date`(KST `"yyyy-mm-dd"`) · `candidates[]`. 기록·랭킹은 이 형태를 **읽기만** 한다.
- **기록·랭킹은 아직 구 형태다.** `components/RankingView.tsx:14-22`(`tally` 키)와 `components/CalendarLog.tsx:60,251` 이 여전히 **이름**을 키로 집계한다. 두 페이지는 `displayPhase` 한 줄 외에는 이 플랜에서 손대지 않았다. legacy 행(이름만)과 신규 행(id 있음)을 동시에 다뤄야 한다는 사실은 `CONCERNS.md` 에 그대로 남겨 뒀다.
- **`settings.historySince` 는 아직 아무도 읽지 않는다.** `lib/settings.ts` 가 값을 들고 있고(`SettingsRow.history_since`, `"yyyy-mm-dd"` — `results.date` 와 문자열 그대로 비교), Phase 7 의 `history_since` 필터(todo `in-05`, 전환일 당일 처리 포함)가 첫 소비처가 된다.
- **`formatHhMm`(`lib/time.ts:29`)의 소비처가 0이 됐다.** `components/MenuList.tsx:129` 가 유일한 호출부였고 이 플랜이 파일째 지웠다. **삭제하지 않았다** — 06-01 `<execution_notes>` 의 명시 지시이고, `lib/time.test.ts` 가 계약 3건을 들고 있으며 기록 페이지가 쓸 가능성이 있다. Phase 7 이 쓰지 않으면 그때 정리를 판단한다.

### Phase 8 (컷오버)이 받는 것

- **마이그레이션 미적용·Edge Function 미배포.** `0005_restaurants_settings.sql` 은 파일로만 있고 라이브에 `restaurants`·`candidates`·`settings` 가 없다. `spin-roulette`·`respin-roulette` 도 라이브에는 구 코드(메뉴 기반)가 돌고 있다. 이 플랜은 **파일만 썼다.**
- **`README.md` 는 손대지 않았다**(SHIP-03). `README.md:3,8,51,53,54,55` 는 여전히 `menus`/`pinned_menus`/`11:55` 기준이고, 컷오버와 함께 고치는 것이 맞다 — 지금 고치면 "적용됐다" 는 거짓이 된다.
- **남은 todo 2건:** `in-05-history-since-same-day.md`(Phase 7) · `wr-01-cutover-window.md`(Phase 8).
- **추첨 시각 중복의 마지막 갈래는 DB 기본값**(`0002_cron.sql` 의 `'55 2 * * *'`, `0005` 의 `spin_time`)이고 의도적으로 남는다.

## Self-Check: PASSED

**신규 파일 존재(4/4):** `lib/useCandidates.ts`(87줄) · `components/CandidateList.tsx`(340줄) · `components/MenuChips.tsx`(65줄) · `components/LocationLink.tsx`(31줄) — 전부 FOUND, 전부 `min_lines` 기준(55·200·30·25) 초과.

**삭제 확인(5/5):** `test -f components/MenuList.tsx` → exit **1** · `.planning/todos/pending/` 4건 부재(남은 2건만 존재).

**커밋 존재(5/5):** `449a764` FOUND · `c15ade7` FOUND · `f5d6031` FOUND · `c759060` FOUND · `d32850a` FOUND(SUMMARY + STATE + ROADMAP).

**요구사항(6/6):** `grep -cE '^- \[x\] \*\*(CAND-0[1235]|SPIN-0[56])\*\*' .planning/REQUIREMENTS.md` → **6** · Traceability 표 6행 전부 `Complete`(`grep -cE '^\| (CAND-0[1235]|SPIN-0[56]) \|.*\| Complete \|$'` → **6**) · `| In Progress|` 빈 셀 `.planning/REQUIREMENTS.md`·`.planning/ROADMAP.md` 양쪽 **0**.

**게이트(5/5):** 최종 재실행에서 `npx tsc --noEmit`·`npm run lint`·`npm test`(354/13)·`npm run build`·`npm run check:edge` 전부 exit **0**. D-22 grep 재확인 → **0**.

**작업 트리:** 미추적 파일 0건. 남은 dirty 는 `.planning/config.json`·`.serena/project.yml` 둘뿐이고 **의도적으로 스테이징하지 않았다**(레포 규칙).

**AI 표기:** 이 페이즈의 커밋 7개 전부 `grep -viE 'CLAUDE\.md' | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**.
