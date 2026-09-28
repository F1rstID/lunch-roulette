---
phase: 04-server-spin
plan: 03
subsystem: edge-functions
tags: [supabase, edge-functions, deno, postgrest, cooldown, settings, cors, error-surfacing, contract-test, tdd]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "0005 마이그레이션의 candidates·restaurants·settings 스키마와 results.restaurant_id — 이 함수가 읽고 덮어쓰는 테이블"
  - phase: 03-pure-logic
    provides: "_shared/{kst,cooldown}.ts — KST 변환·난수 선택·쿨다운 창/필터의 유일한 구현처"
  - phase: 04-server-spin
    plan: 01
    provides: "npm run check:edge 정적 게이트 · 계약 #35~#47 RED"
  - phase: 04-server-spin
    plan: 02
    provides: "spin-roulette/index.ts — 형제 아날로그(normalizeCandidates·json()·설정 조회·쿨다운 배선의 원본)"
provides:
  - "respin-roulette/index.ts — candidates ⋈ restaurants · settings · 쿨다운 위에서 덮어쓰는 재추첨 함수(89줄 → 188줄)"
  - "formatRespinError(fallbackMessage, body) — Edge Function 이 보낸 { error } 본문을 배너 문장으로 고르는 순수 헬퍼(값 import 0)"
  - "app/page.tsx respin() — invoke 반환의 Response 로 500 본문을 정확히 한 번 읽는 경로(FunctionsHttpError 값 import 0 · any 0)"
  - "Phase 8 SHIP-04 의 검증 수단 — 시간 가드가 없어 사람이 직접 invoke 해 새 스키마 경로를 볼 수 있는 유일한 함수"
affects: [04-04-docs, 06-today-tab, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "네트워크 본문의 형태 판정을 순수 모듈에서 끝낸다 — 페이지에는 instanceof·json() 같은 I/O 만 남는다"
    - "실패 본문을 사용자에게 보이는 채널로 만들 때 message 만 싣는다(details·hint 는 콘솔 전용)"
    - "형제 함수와의 차이를 '의도된 비대칭 N개' 로 고정하고 주석 제거 사본 diff 로 검증한다"

key-files:
  created: []
  modified:
    - lib/errors.test.ts
    - lib/errors.ts
    - app/page.tsx
    - supabase/functions/respin-roulette/index.ts
  deleted:
    - .planning/todos/pending/wr-02-respin-error-body.md

key-decisions:
  - "respin 의 설정 폴백 플래그는 조회 실패에서만 오른다 — 추첨 시각 값은 읽어 오되 파싱하지 않는다(시간 가드가 없어 파서를 끌어올 자리가 없다). 형제 함수는 파싱 실패에서도 오르므로 같은 이름의 플래그가 두 파일에서 다른 개수의 경로를 덮는다"
  - "jsr 핀 교체가 deno.lock 을 바꾸지 않았다 — deno check 는 명세자를 추가만 하고 쓰이지 않게 된 항목을 지우지 않는다. 04-02 가 예고한 재갱신이 일어나지 않아 커밋 대상은 함수 1파일뿐이다. lock 을 손으로 고치지 않았다(생성물)"
  - "CORS 논증 보존을 인수 조건의 grep 문자열이 아니라 HEAD 대조 diff 로 검증했다 — 인수 조건의 문자열이 파일 원문의 축약본이라 원본에서도 0건이 나온다"

patterns-established:
  - "판단(순수 모듈) / I/O(페이지) 분리를 훅 밖 페이지 함수에도 적용한다 — lib/useX.ts 컨벤션의 확장"
  - "형제 함수 쌍은 주석 제거 사본 diff 로 비대칭 목록을 검증한다(낭독 6번 항목의 자동 보조 수단)"

requirements-completed: []

# Metrics
duration: 11min
completed: 2026-09-28
---

# Phase 4 Plan 03: `respin-roulette` 재작성 + 500 본문 표면화 Summary

**"다시 돌리기" 경로를 끝까지 새 모델 위로 올렸다 — `respin-roulette` 가 매장 조인·설정·쿨다운 위에서 덮어쓰고(89줄 → 188줄), 지금까지 버려지던 500 본문이 `formatRespinError` 를 거쳐 배너에 실린다. 페이즈의 마지막 적색 13건이 닫혀 `219 passed (219)` · `50 passed (50)`**

## Performance

- **Duration:** 11min (07:17:51Z 시작)
- **Tasks:** 3/3
- **Files modified:** 4 (신규 0 + 수정 4) + 삭제 1(todo)

## Accomplishments

- **재추첨이 매장 모델 위로 옮겨졌다.** 후보 소스가 `menus` 에서 `candidates` ⋈ `restaurants` 로, 쿨다운이 `settings.cooldown_days` 배선으로, 기록 본문이 `restaurant_id` + 이름 스냅샷으로 바뀌었다. 보존 구간(CORS 논증 7줄 · `corsHeaders` · `json()` · `OPTIONS` 단락 · `spun_at` · `onConflict: "date"`)은 **바이트 단위로 동일**하다.
- **익명 사용자가 실패 이유를 읽을 수 있게 됐다.** 지금까지 배너에는 supabase-js 의 고정 영어 문구만 떴다. 이제 함수가 보낸 문장이 그 자리를 이긴다 — 그리고 그 채널이 열렸기 때문에 "응답에 `details`·`hint` 를 싣지 않는다"(T-04-04)가 이 플랜에서 **처음으로 실효 통제**가 됐다.
- **페이즈의 RED 가 전부 닫혔다.** 04-01 이 세운 적색 22건 중 04-02 가 12건, 이 플랜이 **10건(#35~#41·#43·#44·#47)** 을 닫았다. 신규 3건(`formatRespinError`)까지 포함해 `npm test` 가 `219 passed (219)` · `Test Files 10 passed (10)`.
- **클라이언트 번들 표면이 늘지 않았다.** `FunctionsHttpError` 값 import 0 · `app/page.tsx` 의 `import` 문 개수 **14 → 14**(중괄호 안에 이름 하나만 추가). `lib/errors.ts` 의 값 import 는 여전히 **0**.
- **캐리포워드 todo 가 하나 줄었다.** `wr-02-respin-error-body.md` 삭제(7건 → 6건), `done/` 디렉터리 없음.

## Task Commits

1. **Task 1 (RED): `formatRespinError` 3케이스** — `69ef0e4` (test)
   - `lib/errors.test.ts` (+23 −1)
2. **Task 2 (GREEN 1/2): 순수 헬퍼 + `respin()` 배선 + todo 삭제** — `ccb58c4` (feat)
   - `lib/errors.ts` · `app/page.tsx` · `D .planning/todos/pending/wr-02-respin-error-body.md` (3 files, +21 −12)
3. **Task 3 (GREEN 2/2): `respin-roulette/index.ts` 재작성** — `ebbd7d1` (feat)
   - `supabase/functions/respin-roulette/index.ts` (+116 −17)

세 커밋 모두 `git log -1 --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**. `.serena/project.yml`·`.planning/config.json` 은 세 커밋 어디에도 없다(끝까지 dirty 로 남겨 뒀다). 파일 삭제는 `ccb58c4` 의 todo 1건뿐이고 `git rm` 으로 기록됐다(`git show --name-status --format= ccb58c4 | grep -c '^D'` → 1).

## RED: 무엇이 왜 실패했는가 (Task 1)

`npx vitest run lib/errors.test.ts` → **exit 1**, `Tests  3 failed | 7 passed (10)`.
세 건 모두 같은 원문으로 실패했다 — 수집 실패가 아니라 **호출 실패**다(`grep -c 'No test files found'` → 0):

```
FAIL  lib/errors.test.ts > formatRespinError > error 가 빈 문자열이면 fallback 을 쓴다 (접두만 남은 배너를 막는다)
TypeError: formatRespinError is not a function
 ❯ lib/errors.test.ts:58:12
```

vitest 는 없는 named export 를 `undefined` 로 바인딩하므로(Phase 3 결정) RED 의 타입 증거는 따로 필요하다:

```
lib/errors.test.ts(8,27): error TS2305: Module '"@/lib/errors"' has no exported member 'formatRespinError'.
```

`npx tsc --noEmit 2>&1 | grep -c 'TS2305'` → **1**. 같은 커밋에서 `npm run lint` · `npm run check:edge` 는 **exit 0**(D-16 — 빨간 것은 vitest 뿐).
`npm test` → exit 1, `Tests  13 failed | 206 passed (219)` (기존 respin 적색 10 + 신규 3) — 플랜 예고와 **차이 0건**.

## GREEN 에서 닫은 계약 (10건)

`npx vitest run supabase/functions/_shared/edgeImports.test.ts` → exit 0, **`Tests  50 passed (50)`**.

| # | 단언 | `respin-roulette/index.ts` 의 근거 |
|---|---|---|
| #35 | `[from("menus") 0, from("candidates") 1]` | `:76` (`menus` 는 원본 주석에도 0건) |
| #36 | 매장 임베드 정규식 1회 | `:77` `.select("restaurant_id, created_at, restaurants ( id, name )")` |
| #37 | `from("settings")` 1회 | `:60` |
| #38 | `from("results")` **2**회 | `:100`(쿨다운 창) · `:161`(덮어쓰기) — 멱등 조회가 없다는 사실까지 이 숫자가 고정한다 |
| #39 | `restaurant_id: winner.restaurant_id` 2회 | `:165`(쓰기 본문) · `:181`(ok 응답) |
| #40 | 쿨다운 3원소 `[import, 창, 필터]` | `:27` import · `:96` `cooldownWindowStart` · `:148` `applyCooldown` |
| #41 | jsr 핀 양방향 `[2.117.2 → 1, 비핀 @2" → 0]` | `:23` |
| #43 | `console.error(` > 3 | **5건** (아래 표) |
| #44 | 폴백 플래그 3키 각 1 | `:184` · `:185` · `:186` |
| #47 | `function normalizeCandidates(` **양쪽 [1, 1]** | respin `:40` · spin `:32` — 04-02 가 닫을 수 없던 대칭 단언 |

`#42`(시간 가드 부재)와 `#45`(맨 응답 2회)·`#46`(덮어쓰기 1회)은 04-02 시점에 이미 초록이었고 재작성 후에도 유지됐다: `parseSpinTime(` **0** · `DEFAULT_SPIN_TIME` **0** · `new Response(` **2** · `function json(` **1** · `.upsert(` **1** · `onConflict: "date"` **1**.

기존 계약 유지 확인: `Deno.serve(` 1 · `../_shared/kst.ts` import 1 · `../_shared/spinTime.ts` import **0** · `function kstNow`/`function pickRandom` 각 0 · **`type KstParts` 0**(로컬 타입 이름은 `Candidate`) · `hour12` 0 · `req.method === "OPTIONS"` 1 · `corsHeaders` 3.

## 검증 수치 (명령 출력 기준, 추정 없음)

### 게이트 5종

| 명령 | Task 1 (RED) | Task 2 | Task 3 |
|---|---|---|---|
| `npm run check:edge` | exit **0** | exit **0** | exit **0** (`Check …/spin-roulette/index.ts` · `Check …/respin-roulette/index.ts`) |
| `npx tsc --noEmit` | exit 1 (`TS2305` 1건 — 의도된 RED) | exit **0** | exit **0** |
| `npm run lint` | exit **0** | exit **0** | exit **0** |
| `npm run build` | — | exit **0** (`/`, `/_not-found`, `/log`, `/rank` 4개 라우트 정적 생성) | — |
| `npm test` | exit 1 · `13 failed \| 206 passed (219)` | exit 1 · `10 failed \| 209 passed (219)` | exit **0** · `Test Files  10 passed (10)` · `Tests  219 passed (219)` |

**D-16 준수:** 세 커밋 모두에서 `check:edge` exit 0. `npm run build` 는 페이즈 유일의 `app/**` 변경(Task 2)에서 한 번 돌렸고 `.env.local` 이 있어 통과했다.

### `deno.lock` — **갱신되지 않았다** (04-02 의 예고와 다름)

| 항목 | 값 |
|---|---|
| 줄 수 | **277 → 277** (변화 없음) |
| `git status --porcelain -- supabase/functions/deno.lock` | 1·2회차 `check:edge` 후 모두 **0줄** |
| `shasum` | 1회차 `b2b9163…` = 2회차 `b2b9163…` (동일) |
| 남아 있는 줄 | `"jsr:@supabase/supabase-js@2": "2.117.2",` (`:5`) — 이제 **아무도 쓰지 않는 명세자**인데 그대로 있다 |
| 루트 `deno.lock` | `test -f deno.lock` → exit **1** (ABSENT) |

04-02 는 "핀하면 비핀 `@2` 줄이 빠지면서 lock 이 다시 갱신된다" 고 인계했지만 **실제로는 빠지지 않았다.** `deno check` 는 lock 에 명세자를 **추가만** 하고 참조가 사라진 항목을 정리하지 않는다(04-01 이 `--frozen` 을 넣지 않은 덕에 실패로 드러나지도 않는다). 남은 줄은 같은 버전(`2.117.2`)을 가리켜 해석 결과에 영향이 없다. **손으로 지우지 않았다** — lock 은 생성물이고, 플랜의 인수 조건("두 번째 실행 후 `git status` 0줄")은 그대로 만족한다. 정리가 필요하면 `deno install`/`deno cache` 계열 명령이 필요하므로 Phase 8 배포 준비에서 판단할 일이다.

### 토큰 카운트 (원본 `respin-roulette/index.ts`, `grep -c`)

| 토큰 | 기준 | 실측 |
|---|---|---|
| `from("menus")` | 0 | **0** |
| `from("candidates")` / `from("settings")` / `from("results")` | 1 / 1 / 2 | **1 / 1 / 2** |
| `restaurants ( id, name )` (공백 허용 정규식) | 1 | **1** |
| `restaurant_id: winner.restaurant_id` | 2 | **2** |
| `from "../_shared/cooldown.ts"` / `cooldownWindowStart(` / `applyCooldown(` | 1 / 1 / 1 | **1 / 1 / 1** |
| `from "../_shared/spinTime.ts"` / `parseSpinTime(` / `DEFAULT_SPIN_TIME` | 0 / 0 / 0 | **0 / 0 / 0** |
| `jsr:@supabase/supabase-js@2.117.2` / `jsr:@supabase/supabase-js@2"` | 1 / 0 | **1 / 0** |
| `new Response(` / `function json(` | 2 / 1 | **2 / 1** |
| `upsert(` / `onConflict` | 1 / 1 | **1 / 1** (머리 주석의 토큰을 한글 문안으로 바꿔 원본도 1이 됐다) |
| `console.error(` | 5 | **5** |
| `settings_fallback` / `cooldown_fallback` / `cooldown_skipped` / `picked_count` | 1 / 1 / 1 / 1 | **1 / 1 / 1 / 1** |
| `req.method === "OPTIONS"` / `corsHeaders` / `spun_at` / `Deno.serve(` | 1 / ≥3 / 1 / 1 | **1 / 3 / 1 / 1** |
| `type KstParts` / `hour12` / `function kstNow` / `function pickRandom` | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** |
| `\bas [A-Z]` / `: any\b\|<any>` / `restaurants[0]` | 0 / 0 / 0 | **0 / 0 / 0** |
| `function normalizeCandidates(` (respin / spin) | 1 / 1 | **1 / 1** |

### 토큰 카운트 (`lib/errors.ts` · `app/page.tsx`)

| 토큰 | 기준 | 실측 |
|---|---|---|
| `lib/errors.ts` `^import ` | 0 | **0** (값 import 0 유지) |
| `lib/errors.ts` `formatRespinError` / `Edge Function` | ≥1 / ≥1 | **1 / 1** |
| `app/page.tsx` `formatRespinError` | 2 | **2** (import + 호출) |
| `app/page.tsx` `FunctionsHttpError` / `error.context` | 0 / 0 | **0 / 0** |
| `app/page.tsx` `response.json()` / `catch(() => null)` / `error instanceof Error` | 1 / 1 / 1 | **1 / 1 / 1** |
| `app/page.tsx` `const { data, error, response }` | 1 | **1** |
| `app/page.tsx` `from("menus")` | 3 | **3** (Phase 6 범위 — 이 플랜이 건드리지 않았다는 증거) |
| `app/page.tsx` `^import ` | 14 | **14** (import 문 개수 무변경) |
| `app/page.tsx` `: any\|<any>` | 0 | **0** |
| `lib/errors.test.ts` `it(` / `describe(` / `toMatch\|describe.each` | 10 / 3 / 0 | **10 / 3 / 0** |

### 무변경·경계 확인

| 항목 | 결과 |
|---|---|
| `git diff --stat -- lib/errors.ts app supabase` (Task 1 시점) | **0줄** |
| `git diff --stat -- supabase` (Task 2 시점) | **0줄** |
| `git diff --stat -- supabase/functions/spin-roulette/index.ts supabase/functions/_shared lib app` (Task 3 시점) | **0줄** |
| `app/page.tsx` diff 범위 | `:9` import 한 줄 + `respin()` 안쪽 8줄. **함수 밖 0줄** |
| `test -f .planning/todos/pending/wr-02-respin-error-body.md` | exit **1** (삭제됨) · `ls … \| wc -l` → **6** |
| `test -d .planning/todos/done` | exit **1** (만들지 않았다) |
| `REQUIREMENTS.md` | **무변경** — 04-03 플랜은 `requirements.mark-complete` 를 **지시하지 않았다**(`grep -ci 'requirements.mark-complete\|REQUIREMENTS.md' 04-03-PLAN.md` → 0). 04-01 의 결정대로 SPIN-01·SPIN-02·SPIN-04·SETT-04 마킹은 **04-04 소관**이다 |
| 신규 패키지 / 배포 / 원격 SQL / `npm run dev` / `git add -A` / `git push` | **각 0회** |

## `respin-roulette` 낭독 리뷰 6항목 (Manual-Only — 파일:줄 인용)

> 대상: `supabase/functions/respin-roulette/index.ts` (188줄, `ebbd7d1` 시점).

**1. 임베드를 `Array.isArray` 로 접는가** — ✅

`:48-49`
```ts
const embed: unknown = row.restaurants;
const one: unknown = Array.isArray(embed) ? embed[0] : embed;
```
형제 함수 `:40-41` 과 **같은 두 줄**이다. `:50-51` 이 `typeof`·`in` 으로 `name`·`restaurant_id` 를 좁히고, 어긋난 행은 `:52` 에 도달하지 못하고 `skipped` 로 센다. `row.restaurants[0]` 직접 접근 **0건**, `as`·`any` **0건**.

**2. 모든 반환이 `json()` 을 거치는가 (OPTIONS 만 예외)** — ✅

맨 `new Response(` 는 `:65`(헬퍼 본문, `function json(` 은 `:64`)와 `:74`(프리플라이트 단락) **두 곳뿐**이다. `Deno.serve` 안의 반환 지점 5개 중 4개가 헬퍼를 지난다:

| 줄 | 반환 | 상태 |
|---|---|---|
| `:74` | `new Response("ok", { headers: corsHeaders })` | 프리플라이트 — **유일한 예외**, CORS 헤더를 직접 실어 보낸다 |
| `:117` | `json({ error: candErr.message }, 500)` | 후보 조회 실패 |
| `:126` | `json({ skipped: "no_candidates", date: now.date })` | 후보 0개 |
| `:174` | `json({ error: upErr.message }, 500)` | 덮어쓰기 실패 |
| `:177` | `json({ ok: true, … })` | 성공 |

`json()`(`:63-70`)이 `...corsHeaders` 를 스프레드하므로 **두 500 응답에도 CORS 헤더가 있다.** 이것이 D-12 의 전제다 — 하나라도 헬퍼를 건너뛰면 브라우저가 본문을 차단하고 supabase-js 가 `FunctionsFetchError` 를 주며 `response` 가 `undefined` 가 된다. **증상은 "배너에 함수 문장이 아니라 영어 고정 문구가 뜬다" 이다**(T-04-06 — 조용한 무력화라 이 문장을 남겨 둔다).

**3. 세 폴백 boolean 이 ok 응답에 항상 실리는가** — ✅

선언 `:85-87`(각 줄 옆 한글 범례), 상승 지점 `:100`(설정 조회 실패) · `:140`(쿨다운 창 조회 실패) · `:149`(`applyCooldown` 판정), 응답 `:184-186`:
```ts
cooldown_fallback: cooldownFallback,
cooldown_skipped: cooldownSkipped,
settings_fallback: settingsFallback,
```
`:177` 객체 리터럴 안에 **조건부 스프레드·삼항 없이** 들어 있다. 전부 `false` 인 줄이 정상이라는 독법이 형제 함수와 같게 성립한다. `candidate_count`(`:182`, 쿨다운 적용 **전**) · `picked_count`(`:183`, 적용 후)도 상시 실린다.

**4. 콘솔 로그가 5경로마다 1건씩 있는가** — ✅ (인수 조건의 개수와 일치)

| 줄 | 지점 | 그 뒤 동작 |
|---|---|---|
| `:99` | 설정 조회 실패 | `settingsFallback = true` 후 **진행** |
| `:114` | 후보 조회 실패 | `:117` 에서 **500** |
| `:121` | 매장 조인 형태 불일치로 후보 N건 제외 | 남은 후보로 **진행** |
| `:139` | 쿨다운 창 조회 실패 | `cooldownSkipped = true` 후 **미적용 진행** |
| `:173` | 결과 덮어쓰기 실패 | `:174` 에서 **500** |

로그 본문에 실리는 것은 `error.message` 와 실패한 **단일 필드**뿐 — `details`·`hint`·행 덤프·환경변수 값 **0건**(T-04-03). 500 응답 본문도 `{ error: <message> }` 뿐이고 그 이유가 `:82-83` 주석에 있다(T-04-04).

**형제 함수는 7지점인데 여기는 5지점인 이유**(차이 2건, 둘 다 구조적 부재다):
- `spin :89-91` **추첨 시각 값 파싱 실패** — respin 에는 시간 가드가 없어 파서를 import 하지 않는다(#42). 그래서 이 파일의 `settings_fallback` 은 **조회 실패에서만** 오른다(`:56-58` 주석에 명시).
- `spin :112` **멱등 조회 실패** — respin 에는 멱등 조회 자체가 없다(#38 의 `from("results")` 2회가 그 부재를 고정한다).

**5. 덮어쓰기 본문에 매장 id 가 있는가** — ✅

`:161-170`
```ts
const { error: upErr } = await supabase.from("results").upsert(
  {
    date: now.date,
    menu: winner.name,
    restaurant_id: winner.restaurant_id,
    candidates: snapshot,
    spun_at: new Date().toISOString(),
  },
  { onConflict: "date" },
);
```
`.select()` 를 붙이지 않았다(성공 시 `data: null`, 응답 값은 `:155` 의 `winner` 에서 만든다 — §Q-2f). 스냅샷은 `:157` 에서 **쿨다운 적용 전** 후보 전체를 담은 순서 그대로 `{ name, restaurant_id }` 로 만든다(`ResultRow.candidates` 와 같은 형태). `date: now.date` + `onConflict: "date"` 조합이 다른 날짜 행을 건드리지 않는다는 보장이다(T-04-09). `spun_at`(`:167`)은 UTC 직렬화라 `lib/time.ts` 경유 규칙의 예외로 유지했다.

**6. spin 과의 diff 가 의도된 비대칭 5개로만 설명되는가** — ✅

주석·빈 줄을 제거한 사본끼리 `diff` 한 결과(`sed -e 's|//.*||' | grep -vE '^\s*$'`) **hunk 6개**가 나왔고, 전부 다음 5개로 분류된다:

| # | 비대칭 | diff hunk |
|---|---|---|
| 1 | CORS + 프리플라이트 (respin 만) | `corsHeaders` 블록 추가 · `json()` 헤더에 스프레드 · `Deno.serve(async (req) =>` + `OPTIONS` 단락 (3 hunk — 같은 사유) |
| 2 | 시간 가드 없음 (spin 만) | `spinTime.ts` import · `spinTime` 지역 변수 · `parseSpinTime` 분기 · `isAfterSpinTime` 반환이 respin 에 없다 |
| 3 | 멱등 스킵 없음 (spin 만) | 멱등 `from("results")` 조회 + `already_decided` 반환이 respin 에 없다 |
| 4 | 쓰기 방식 | spin `.insert(` + `23505` 레이스 분기 ↔ respin `.upsert(` + `onConflict: "date"` + `spun_at` |
| 5 | `from("results")` 개수 | 3(멱등·쿨다운·기록) ↔ 2(쿨다운·덮어쓰기) — 위 3·4 의 산술적 귀결 |

**그 외 차이는 0건이다.** `normalizeCandidates`(`:40-55`)·`type Candidate`(`:31`)·설정 조회 블록·후보 조회 블록·쿨다운 블록·추첨/스냅샷 블록은 주석 제거 사본에서 **완전히 동일**하다.

### 보존 구간 검증 방법에 대한 기록

인수 조건은 `grep -c '게이트웨이는 CORS 헤더를 주입하지 않는다'` → 1 을 요구했지만 **원본(HEAD)에서도 0건**이다 — 파일의 실제 문안은 `// - Supabase 게이트웨이는 배포된 함수 응답에 CORS 헤더를 주입하지 않는다(직접 확인).`(`:17`)이고 인수 조건의 문자열은 그 축약본이다. 의도(CORS 논증 보존)는 **더 강한 방법**으로 확인했다:

```
diff <(git show HEAD:…/respin-roulette/index.ts | sed -n '10,16p') <(sed -n '14,20p' …) → IDENTICAL
diff <(git show HEAD:…/respin-roulette/index.ts | sed -n '24,42p') <(sed -n '57,75p' …) → IDENTICAL
```

CORS 논증 7줄과 `corsHeaders`·`json()`·`OPTIONS` 단락 19줄이 **바이트 단위로 동일**하다(줄 번호만 머리 주석 확장만큼 밀렸다).

## `respin()` 의 배너 동작 — 전후 차이와 미검증 사실

**전** (`ccb58c4` 이전): `setActionError(\`다시 돌리기 실패: ${error.message}\`)` → supabase-js 가 만든 고정 영어 문구 `"Edge Function returned a non-2xx status code"` 만 뜨고, 함수가 보낸 `{ error: "…" }` 는 읽히지도 않고 버려졌다. `RespinResponse.error`(`:19`)는 선언만 있고 소비처가 없었다.

**후** (`app/page.tsx:216-225`):
```ts
const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
if (error) {
  const body: unknown = response ? await response.json().catch(() => null) : null;
  const fallback = error instanceof Error ? error.message : String(error);
  setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, body)}`);
```
`response` 는 라이브러리가 본문을 읽기 **전에** 던진 에러의 `context` 와 같은 미독 `Response` 라서 여기서 정확히 한 번 읽을 수 있다(§Q-3). `FunctionsHttpError` 값 import 0 · `error.context` 경로 0 · `any` 0(`error` 는 `any` 라 `instanceof` 로 좁힌다 — T-04-20). `.catch(() => null)` 이 비-JSON 본문(게이트웨이 HTML)의 두 번째 예외를 값으로 착지시킨다(T-04-19) — 그 경로를 `lib/errors.test.ts` 의 2·3번 케이스가 고정한다.

**⚠ 이 동작은 검증되지 않았다 (Manual-Only).** 브라우저 + 배포된 함수 + 실제 500 응답 세 가지가 동시에 필요한데 라이브에는 새 테이블이 없고 함수도 배포되지 않았다. 자동 장치가 확인한 것은 **타입(`tsc` exit 0 — `response` 가 `Response | undefined` 라는 실측의 재확인)과 순수 헬퍼 3케이스**까지다. 실제 배너 문구 확인은 **Phase 8 컷오버 후 실사용 1회 또는 Phase 6 UI 검증**에 위임한다. 실패 증상은 위 낭독 2번에 적어 둔 그대로다("함수 문장이 아니라 영어 고정 문구가 뜬다" = 500 에서 CORS 가 빠졌다는 신호).

## 자동 계약이 덮지 못하는 지점 (Phase 8 실호출 전까지 미검증)

04-02 가 남긴 세 가지(임베드의 실제 형태 · `settings.spin_time` 직렬화 · 대시보드 로그 도달)가 그대로 유효하다. 덧붙여 이 플랜이 만든 것:

1. **`respin-roulette` 는 한 줄도 실행되지 않았다.** 계약 텍스트 10건 + `deno check` + 낭독 6항목이 전부다. 다만 **이 함수가 Phase 8 에서 새 스키마 경로를 사람이 직접 확인할 수 있는 유일한 창**이다(형제 함수는 시간 가드 때문에 사전 검증 불가) — `todo wr-01` 7번(04-04 가 추가)의 수동 invoke 가 임베드 형태·`menu` 값·`restaurant_id` 를 한 번에 드러낸다.
2. **`upsert` 가 실제로 갱신하는지** 는 확인되지 않았다. `onConflict: "date"` 가 유니크 제약과 짝이 맞는지는 0005 마이그레이션 텍스트 계약이 간접 보장할 뿐이다.
3. **500 본문의 CORS 헤더** 는 배포 후 브라우저에서만 확인된다(위 낭독 2번).

## TDD Gate Compliance

- **RED 게이트:** `69ef0e4` `test(04-03): add failing cases for formatRespinError` ✓
- **GREEN 게이트:** `ccb58c4` `feat(04-03): surface respin error body in the action banner` ✓ · `ebbd7d1` `feat(04-03): rewrite respin-roulette on candidates, settings and cooldown` ✓
- **REFACTOR 게이트:** **없음.** GREEN 직후 계약 50건 + 단위 219건이 전부 초록이고 게이트 5종이 exit 0 이라 정리할 대상이 없었다. 함수 재작성 자체가 리팩터(맨 응답 개수 유지 + 로직 통일)를 포함한다.

순서 검증: `git merge-base --is-ancestor 69ef0e4 ccb58c4` ✓ · `… ccb58c4 ebbd7d1` ✓ (RED → GREEN → GREEN).
respin 계약(#35~#47)의 RED 는 04-01 `a39265b` 가 세웠다 — 이 페이즈의 RED 는 플랜을 가로지른다.

## Decisions Made

- **respin 의 `settings_fallback` 은 조회 실패에서만 오른다.** 설정 조회 문자열은 형제와 같게 두되(`spin_time, cooldown_days` — Phase 8 diff 비교를 위해) 소비하는 것은 `cooldown_days` 뿐이다. 시간 가드가 없으니 파서를 끌어올 자리가 없고(#42), 결과적으로 **같은 이름의 플래그가 두 파일에서 다른 개수의 경로를 덮는다.** 이 사실을 `:56-58` 주석에 남겼다 — 안 그러면 다음 사람이 "왜 여기는 파싱 실패 분기가 없지" 로 되돌린다.
- **`deno.lock` 을 손으로 고치지 않았다.** 핀 교체 후에도 lock 이 바뀌지 않았고(위 표), 쓰이지 않게 된 `@2` 명세자 줄이 남았다. 생성물을 손으로 편집하면 다음 `deno` 명령이 만드는 내용과 갈린다. 해석 결과가 같은 버전이라 동작 영향은 0이다.
- **CORS 논증 보존을 grep 이 아니라 HEAD 대조 diff 로 검증했다.** 인수 조건의 문자열이 파일 원문의 축약본이라 원본에서도 0건이 나온다(위 "보존 구간 검증 방법" 절). 더 강한 증거(바이트 동일)로 대체했다.
- **후보 0개 응답 키 `"no_candidates"` 를 그대로 뒀고 그 이유를 `:92` 주석에 남겼다.** `app/page.tsx:227` 이 이 문자열을 "후보가 없어요" 로 번역한다 — 바꾸면 코드값이 화면에 새어 나온다.
- **요구사항 완료 마킹을 하지 않았다.** 04-03 플랜은 `REQUIREMENTS.md` 를 언급하지 않는다(지시 0건). 04-01 의 결정("검증을 닫는 플랜 하나만 찍는다")대로 SPIN-01·SPIN-02·SPIN-04·SETT-04 는 **04-04 소관**이다.

## Deviations from Plan

**Rule 1~3 자동 수정 0건 · Rule 4 아키텍처 질의 0건.** 플랜이 지정한 3태스크·3커밋·4파일(+삭제 1)·계약 10건을 그대로 수행했다.

기록할 예상 이탈 **2건** (둘 다 코드가 아니라 플랜 텍스트/외부 도구 쪽):

1. **`deno.lock` 이 갱신되지 않았다.** 플랜과 04-02 인계는 "핀 교체가 lock 을 다시 바꾼다(비핀 `@2` 줄 제거 예상)" 고 했으나 `deno check` 는 명세자를 추가만 하고 제거하지 않았다. 플랜의 문구가 조건부("갱신됐다면 lock")였고 인수 조건("두 번째 실행 후 `git status` 0줄")은 그대로 만족하므로 커밋 대상을 함수 1파일로 뒀다. **다른 태스크에서 lock 이 바뀐 일도 없다**(세 커밋 전부 `git status --porcelain -- supabase/functions/deno.lock` 0줄).
2. **인수 조건의 CORS 보존 grep 문자열이 파일 원문과 다르다.** 위 "보존 구간 검증 방법" 절 참조 — 원본 HEAD 에서도 0건이라 조건 자체가 성립 불가였고, 바이트 대조로 대체했다.

금지 사항 전부 준수: `spin-roulette/index.ts`·`_shared/*.ts`·`edgeImports.test.ts` 무변경, `respin()` 밖 `app/page.tsx` 무변경, `RespinResponse` 선언 무변경, `_shared` 신규 모듈 0개, `as`·`any` 0건, `npm install` 0회, 원격 Supabase 명령 0회, `npm run dev` 0회, `git add -A` 0회, `git push` 0회, `.serena/project.yml`·`.planning/config.json` 미커밋, AI 표기 0줄.

## Issues Encountered

None.

관측 1건: `.planning/STATE.md` 의 `### Pending Todos` 절이 "없음. (`.planning/todos/pending/` 비어 있음)" 이라고 적고 있으나 실제로는 6건이 남아 있다(이 플랜이 7건 → 6건으로 줄였다). 이 플랜의 범위 밖이라 고치지 않았고, todo 목록 갱신을 다루는 04-04 가 정정할 자리다.

## User Setup Required

None - no external service configuration required.

⚠ `respin-roulette` 는 아직 **배포되지 않았다.** 라이브에는 구 함수(메뉴 기반)가 돌고 있고 새 코드가 의존하는 `candidates`·`restaurants`·`settings` 는 라이브에 없다. 배포(`npx supabase@2.117.0 functions deploy respin-roulette --project-ref …`)와 마이그레이션 적용은 Phase 8 컷오버에서 사용자가 한다.

## Next Phase Readiness

**04-04(문서·todo — 페이즈 마무리)가 바로 시작 가능하다.**

**04-04 가 참고할 것:**
- **페이즈의 RED 가 전부 닫혔다.** `npm test` `219 passed (219)` · `edgeImports.test.ts` `50 passed (50)` · `check:edge` exit 0. `04-VALIDATION.md` 의 혼합 행(#23·#24·#35·#36 등 spin/respin 이 한 행에 묶인 것)을 이제 **전부 초록으로 칠할 수 있다** — 04-02 가 `⬜ pending` 으로 남긴 이유(절반만 초록)가 해소됐다.
- **요구사항 마킹이 04-04 에 남았다:** SPIN-01 · SPIN-02 · SPIN-04 · SETT-04.
- **todo `wr-01` 7번**(Phase 8 수동 invoke 로 `menu` 가 실제 매장명인지·`restaurant_id` 가 uuid 인지 확인)을 추가할 자리다. 위 "자동 계약이 덮지 못하는 지점" 3건이 그 항목의 내용이다.
- **`.planning/STATE.md` 의 Pending Todos 절이 사실과 다르다**(위 Issues) — 정정 대상.
- **`deno.lock` 에 쓰이지 않는 `@2` 명세자 줄이 남아 있다.** 문서에 남길지 Phase 8 에서 정리할지 판단이 필요하다.
- 화면 하드코딩 문구 "11:55" 교체는 여전히 Phase 6 이다.

**블로커:** 없음.

## Self-Check: PASSED

- 파일 4개(`lib/errors.test.ts` · `lib/errors.ts` · `app/page.tsx` · `supabase/functions/respin-roulette/index.ts` 188줄) 전부 디스크에 존재, 삭제 대상 `wr-02-respin-error-body.md` 는 부재(의도).
- 커밋 3개(`69ef0e4` · `ccb58c4` · `ebbd7d1`) 전부 `git log` 에서 확인.
- 누락 0건.

---
*Phase: 04-server-spin*
*Plan: 03*
*Completed: 2026-09-28*
