---
phase: 04-server-spin
plan: 02
subsystem: edge-functions
tags: [supabase, edge-functions, deno, postgrest, cooldown, settings, contract-test]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "0005 마이그레이션의 candidates·restaurants·settings 스키마와 results.restaurant_id — 이 함수가 읽고 쓰는 테이블"
  - phase: 03-pure-logic
    provides: "_shared/{kst,spinTime,cooldown}.ts — 시각 판정·난수 선택·쿨다운 창/필터의 유일한 구현처"
  - phase: 04-server-spin
    plan: 01
    provides: "npm run check:edge 정적 게이트 · ResultRow.candidates 스냅샷 타입 · 계약 #23~#34 RED"
provides:
  - "spin-roulette/index.ts — candidates ⋈ restaurants · settings · 쿨다운 위에서 도는 추첨 함수(97줄 → 200줄)"
  - "normalizeCandidates(rows: unknown) — 임베드 배열/객체 양쪽을 접는 정규화 헬퍼(04-03 이 같은 이름으로 복제한다)"
  - "spin 판 json() 헬퍼 — CORS 없는 형태(맨 new Response 7회 → 1회)"
  - "폴백 플래그 3종 응답 규약(settings_fallback·cooldown_skipped·cooldown_fallback) — 로그 독법의 기준"
  - "supabase/functions/deno.lock 에 jsr 정확 버전 명세자 해석 추가(276줄 → 277줄)"
affects: [04-03-respin-rewrite, 04-04-docs, 06-settings-ui, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "조회 결과를 추론 타입으로 소비하지 않고 unknown 으로 받아 런타임에 좁힌다(임베드 배열/객체 이중 진실 방어)"
    - "폴백은 예외가 아니라 지역 boolean 3개 + 서버 로그 1건으로 표현하고 성공 응답에 상시 싣는다"
    - "쿨다운 창이 null 이면 DB 조회 자체를 생략한다 — 기본 설정에서 전환 전과 같은 쿼리 수"

key-files:
  created: []
  modified:
    - supabase/functions/spin-roulette/index.ts
    - supabase/functions/deno.lock
    - .planning/phases/04-server-spin/04-VALIDATION.md

key-decisions:
  - "임베드를 접을 때 row.restaurants[0] 대신 지역 변수 embed 를 한 번 거친다 — 인수 조건이 restaurants[0] 0건을 요구하는데 RESEARCH Pattern 1 원문은 그 토큰을 포함한다. §Q-2c 의 embed 변수 형태가 같은 동작이면서 금지 토큰을 피한다"
  - "normalizeCandidates 의 내부 순회를 unknown[] 로 한 번 더 좁힌다(const list: unknown[] = rows) — Array.isArray 가 unknown 을 any[] 로 넓혀 이후 좁히기가 전부 무효가 되는 것을 막는다"
  - "23505 레이스 경로에는 콘솔 로그를 남기지 않는다 — 실패가 아니라 설계된 정상 경로이고, 로그를 남기면 대시보드에서 진짜 실패와 구분되지 않는다"
  - "04-VALIDATION.md 의 혼합 행(spin 절반 초록 · respin 절반 대기)은 ⬜ pending 으로 남긴다 — 행 단위 Status 라 절반만 초록으로 칠하면 04-03 이 무엇을 닫아야 하는지가 흐려진다"

patterns-established:
  - "정적 검사가 인증해 주는 오답을 텍스트 인수 조건으로 막는다(restaurants[0] 0건) — deno check 가 통과시키는 한 줄에 대한 유일한 자동 방어선"
  - "GREEN 플랜이 자기 몫의 계약 번호만 닫고 남은 적색을 숫자로 인계한다"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-09-28
---

# Phase 4 Plan 02: `spin-roulette` 재작성 Summary

**`spin-roulette` 를 매장 후보 조인·설정 기반 시각 판정·쿨다운 필터 위에서 다시 써 계약 #23~#34 12건을 초록으로 돌렸다 — `npm run check:edge` exit 0 을 유지한 채 `new Response` 7회가 1회로, 콘솔 로그 0곳이 7곳으로 바뀌었다**

## Performance

- **Duration:** 6min (07:06:13Z → 07:12Z)
- **Tasks:** 2/2
- **Files modified:** 3 (신규 0 + 수정 3)

## Accomplishments

- **Core Value 가 새 스키마 위로 옮겨졌다.** 추첨 단위가 메뉴에서 매장이 됐고(`candidates` ⋈ `restaurants`), 추첨 시각이 코드 상수에서 `settings.spin_time` 으로 옮겨졌으며, 쿨다운이 `_shared` 모듈 배선으로 실제로 켜졌다. `spin-roulette/index.ts` 97줄 → **200줄**.
- **`deno check` 가 인증해 주는 오답을 구조적으로 막았다.** 임베드는 추론 타입이 배열이고 런타임은 객체다 — `normalizeCandidates(rows: unknown)` 가 `Array.isArray(embed) ? embed[0] : embed` 로 접는다. `as` 0건 · `any` 표기 0건 · `restaurants[0]` 0건.
- **실패가 추첨을 멈추지 않는다.** 설정 조회·시각 파싱·멱등 조회·쿨다운 창 조회 네 실패 경로가 전부 기본값 착지 + 로그 1건 + 응답 플래그로 흡수된다. 멈추는 경로는 후보 조회 실패와 기록 실패 2개뿐이다(둘 다 500).
- **응답 헤더 규약이 한 자리로 모였다.** `json()` 도입으로 맨 `new Response(` **7회 → 1회**.
- **계약 12건이 예상대로 정확히 닫혔다.** 04-01 이 예고한 `10 failed | 40 passed (50)` · `10 failed | 206 passed (216)` 과 실측이 일치한다. 차이 0건.

## Task Commits

1. **Task 1 (GREEN): `spin-roulette/index.ts` 재작성** — `dd05211` (feat)
   - `supabase/functions/spin-roulette/index.ts` · `supabase/functions/deno.lock`
2. **Task 2: 낭독 리뷰 6항목 + `04-VALIDATION.md` 중간 갱신** — `8ef59a1` (docs)
   - `.planning/phases/04-server-spin/04-VALIDATION.md`

두 커밋 모두 `git log -1 --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**, `git show --name-only` 에 `.serena/project.yml`·`.planning/config.json` **0건**, 파일 삭제 **0건**.

## GREEN 에서 닫은 계약 (12건)

`npx vitest run supabase/functions/_shared/edgeImports.test.ts` → exit 1, **`Tests  10 failed | 40 passed (50)`**.
`npx vitest run … | grep -c 'EDGE/SPIN-01'` → **0** — spin describe 에서 실패가 한 건도 없다.

| # | 단언 | 이 파일의 근거 |
|---|---|---|
| #23 | `[from("menus") 0, from("candidates") 1]` | `:125` (`from("menus")` 원본 0건) |
| #24 | 매장 임베드 정규식 1회 | `:126` `.select("restaurant_id, created_at, restaurants ( id, name )")` |
| #25 | `from("settings")` 1회 | `:71` |
| #26 | `from("results")` 3회 | `:105`(멱등) · `:147`(쿨다운 창) · `:173`(기록) |
| #27 | `restaurant_id: winner.restaurant_id` 2회 | `:176`(기록 본문) · `:193`(ok 응답) |
| #28 | 쿨다운 3원소 `[import, 창, 필터]` | `:20` import · `:143` `cooldownWindowStart` · `:161` `applyCooldown` |
| #29 | jsr 핀 양방향 `[2.117.2 → 1, 비핀 @2" → 0]` | `:17` |
| #30 | `parseSpinTime(` 1 · `DEFAULT_SPIN_TIME\b` ≥1 | `:83` · `:19`,`:64` (2줄) |
| #31 | D-05 순서 불변식 | `:98` → `:105` → `:125` → `:161` → `:173` (단조 증가) |
| #32 | `console.error(` > 4 | 7건 (아래 표) |
| #33 | 폴백 플래그 3키 각 1 | `:196` · `:197` · `:198` |
| #34 | 맨 `new Response(` 1 · `function json(` 1 | `:52` · `:51` |

**기존 #7a~#15 유지 확인:** `Deno.serve(` 1 · `../_shared/kst.ts` import 1 · `../_shared/spinTime.ts` import 1 · `function kstNow`/`function pickRandom`/`function isAfterSpinTime` 각 0 · `const SPIN_HH`/`const SPIN_MM` 각 0 · **`type KstParts` 0**(로컬 타입 이름은 `Candidate`) · `hour12` 0 · `23505` 1.

## 남은 적색 10건 (전부 04-03 몫)

`npm test` → exit 1, **`Test Files  1 failed | 9 passed (10)`** · **`Tests  10 failed | 206 passed (216)`**. 실패 목록은 `EDGE/SPIN-04` describe 9건 + 대칭 1건이다:

| # | 대상 | 단언 |
|---|---|---|
| #35 | respin | 후보 소스 교체 `[menus 0, candidates 1]` |
| #36 | respin | 매장 임베드 정규식 1회 |
| #37 | respin | `from("settings")` 1회 |
| #38 | respin | `from("results")` 2회 |
| #39 | respin | `restaurant_id: winner.restaurant_id` 2회 |
| #40 | respin | 쿨다운 3원소 |
| #41 | respin | jsr 핀 양방향 |
| #43 | respin | `console.error(` > 3 |
| #44 | respin | 폴백 플래그 3키 |
| #47 | **양쪽** | `function normalizeCandidates(` `[1, 1]` — 현재 `[1, 0]`. 04-01 이 예고한 대로 spin 만으로는 닫히지 않는다 |

## 검증 수치 (명령 출력 기준, 추정 없음)

### 정적 게이트

| 명령 | Task 1 | Task 2 |
|---|---|---|
| `npm run check:edge` | exit **0** (`Check …/spin-roulette/index.ts` · `Check …/respin-roulette/index.ts`) | exit **0** |
| `npx tsc --noEmit` | exit **0** | exit **0** |
| `npm run lint` | exit **0** | exit **0** |
| `npm test` | exit 1 · `10 failed \| 206 passed (216)` | exit 1 · 동일(변동 없음) |

**D-16 준수:** 두 커밋 모두에서 `check:edge` exit 0. 타입이 깨진 함수는 커밋되지 않았다.

### `deno.lock` 갱신 (이 플랜에서 바뀌는 유일한 지점)

| 항목 | 값 |
|---|---|
| 줄 수 | **276 → 277** (`1 file changed, 1 insertion(+)`) |
| 추가된 줄 | `"jsr:@supabase/supabase-js@2.117.2": "2.117.2",` — `specifiers` 맵의 한 줄 |
| 남아 있는 줄 | `"jsr:@supabase/supabase-js@2": "2.117.2"` — `respin-roulette` 가 아직 비핀 명세자를 쓰기 때문이다. 04-03 이 핀하면 이 줄이 빠진다 |
| 멱등 | 2회차 `npm run check:edge` 후 `shasum` 동일 → `git status --porcelain -- supabase/functions/deno.lock` **0줄** |
| 루트 `deno.lock` | `test -f deno.lock` → exit **1** (ABSENT), `git status --porcelain` 에도 항목 없음 |

### 토큰 카운트 (원본 `spin-roulette/index.ts`, `grep -c`)

| 토큰 | 기준 | 실측 |
|---|---|---|
| `from("menus")` | 0 | **0** |
| `from("candidates")` / `from("settings")` / `from("results")` | 1 / 1 / 3 | **1 / 1 / 3** |
| `restaurants ( id, name )` (공백 허용 정규식) | 1 | **1** |
| `restaurant_id: winner.restaurant_id` | 2 | **2** |
| `from "../_shared/cooldown.ts"` / `cooldownWindowStart(` / `applyCooldown(` | 1 / 1 / 1 | **1 / 1 / 1** |
| `jsr:@supabase/supabase-js@2.117.2` / `jsr:@supabase/supabase-js@2"` | 1 / 0 | **1 / 0** |
| `new Response(` / `function json(` / `function normalizeCandidates(` | 1 / 1 / 1 | **1 / 1 / 1** |
| `console.error(` | 7 | **7** |
| `settings_fallback` / `cooldown_fallback` / `cooldown_skipped` / `picked_count` | 1 / 1 / 1 / 1 | **1 / 1 / 1 / 1** |
| `23505` / `Deno.serve(` | 1 / 1 | **1 / 1** |
| `type KstParts` / `hour12` / `const SPIN_HH` / `const SPIN_MM` | 0 / 0 / 0 / 0 | **0 / 0 / 0 / 0** |
| `\bas [A-Z]` / `: any\b\|<any>` / `restaurants[0]` | 0 / 0 / 0 | **0 / 0 / 0** |
| `.insert(` / `.select()` | 1 / 0 | **1 / 0** |
| `parseSpinTime(` / `\bDEFAULT_SPIN_TIME\b` | 1 / ≥1 | **1 / 2** |

### 무변경 확인

| 항목 | 결과 |
|---|---|
| `git diff --stat -- supabase/functions/respin-roulette/index.ts supabase/functions/_shared lib app` | **0줄** (Task 1·Task 2 양쪽) |
| `git diff --stat -- 04-CONTEXT.md 04-RESEARCH.md 04-PATTERNS.md CLAUDE.md` | **0줄** |
| `git diff --stat -- supabase app lib` (Task 2 시점) | **0줄** |
| `REQUIREMENTS.md` | 무변경(플랜 지시대로 — 04-03/04-04 가 마킹) |
| TDD 게이트 | `test(04-01)` `a39265b` → `feat(04-02)` `dd05211` (RED 가 GREEN 을 앞선다) |

## 낭독 리뷰 6항목 (Manual-Only — 파일:줄 인용)

> 대상: `supabase/functions/spin-roulette/index.ts` (200줄, `dd05211` 시점). 판정만이 아니라 근거 줄을 남긴다 — Phase 8 컷오버에서 같은 확인을 다시 하지 않기 위해서다.

**1. 임베드를 `Array.isArray` 로 접는가 (배열/객체 양쪽 흡수)** — ✅

`:40-41`
```ts
const embed: unknown = row.restaurants;
const one: unknown = Array.isArray(embed) ? embed[0] : embed;
```
임베드를 지역 변수로 한 번 받은 뒤 접는다. 배열이면 첫 원소, 객체면 그대로 — 두 진실(추론=배열 / 런타임=객체) 어느 쪽이 와도 같은 값에 도달한다. `:42-43` 이 `typeof`·`in` 으로 `name`·`restaurant_id` 를 각각 좁히므로 형태가 어긋난 행은 `:44` 에 도달하지 못하고 `skipped` 로 센다. **`row.restaurants[0]` 직접 접근은 파일 전체에 0건**이고 `row.restaurants.name`(컴파일이 막는 정답)도 없다.

**2. 모든 반환이 `json()` 을 거치는가** — ✅

맨 `new Response(` 는 `:52` **한 곳뿐**이고 그 자리가 `json()` 헬퍼 본문이다(`:51`). 반환 지점 8곳 전부가 헬퍼를 지난다: `:100`(`before_spin_time`) · `:115`(`already_decided`) · `:132`(후보 조회 500) · `:140`(`no_candidates`) · `:183`(`race_already_decided`) · `:186`(기록 500) · `:189`(ok). 형제 함수와 달리 CORS 헤더가 없고, **왜 없는지**가 `:49-50` 주석에 있다("호출자가 pg_cron 이라 프리플라이트 자체가 없다 — 빠뜨린 것이 아니므로 다시 넣지 말 것").

**3. 세 폴백 boolean 이 ok 응답에 항상 실리는가** — ✅

선언 `:66-68`(각 줄 옆 한글 범례 주석), 상승 지점 `:78`·`:92`(설정) · `:154`(쿨다운 조회) · `:163`(`applyCooldown` 판정), 응답 `:196-198`.
```ts
cooldown_fallback: cooldownFallback,
cooldown_skipped: cooldownSkipped,
settings_fallback: settingsFallback,
```
세 줄 모두 `:189` 의 객체 리터럴 안에 무조건 들어 있다 — **조건부 스프레드·삼항이 없다**. 전부 `false` 인 줄이 정상이라는 독법이 성립한다. `candidate_count`(`:194`, 쿨다운 적용 **전**)와 `picked_count`(`:195`, 적용 후)도 함께 상시 실린다.

**4. 콘솔 로그가 500·폴백 경로마다 1건씩 있는가** — ✅ (7지점, 인수 조건의 개수와 일치)

| 줄 | 지점 | 그 뒤 동작 |
|---|---|---|
| `:77` | 설정 조회 실패 | `settingsFallback = true` 후 **진행** |
| `:89-91` | 추첨 시각 값 파싱 실패 (`JSON.stringify` 로 감싸 남긴다 — 문자열이 아닐 수 있는 자리) | `settingsFallback = true` 후 **진행** |
| `:112` | 멱등 조회 실패 | **진행**(23505 가 최종 보험 — D-18 / Pitfall 6) |
| `:130` | 후보 조회 실패 | `:132` 에서 **500** |
| `:136` | 매장 조인 형태 불일치로 후보 N건 제외 | 남은 후보로 **진행** |
| `:153` | 쿨다운 창 조회 실패 | `cooldownSkipped = true` 후 **미적용 진행** |
| `:185` | 결과 기록 실패 | `:186` 에서 **500** |

로그 본문에 실리는 것은 `error.message` 와 실패한 **단일 필드**뿐이다 — `details`·`hint`·행 전체 덤프·환경변수 값이 0건(T-04-03). 500 응답 본문도 `{ error: <message> }` 뿐이다(`:131` 주석이 근거를 남긴다 — T-04-04).
**의도적으로 로그가 없는 경로:** `:182-184` 의 `23505` 레이스. 실패가 아니라 설계된 정상 경로이고, 여기서 로그를 남기면 대시보드에서 진짜 실패와 섞인다.

**5. 기록 본문에 매장 id 가 있는가** — ✅

`:173-178`
```ts
const { error: insErr } = await supabase.from("results").insert({
  date: now.date,
  menu: winner.name,
  restaurant_id: winner.restaurant_id,
  candidates: snapshot,
});
```
`.select()` 가 붙어 있지 않다(성공 시 `data: null`, 응답 값은 `:169` 의 `winner` 에서 만든다). 스냅샷은 `:171` 에서 **쿨다운 적용 전** 후보 전체를 담은 순서 그대로 `{ name, restaurant_id }` 로 만든다 — `ResultRow.candidates`(04-01 이 넓힌 타입)와 형태가 같다.

**6. D-05 순서가 코드 순서와 같은가 / `pickRandom` 이 빈 배열을 받을 수 없는가** — ✅

| D-05 단계 | 줄 |
|---|---|
| ① `kstNow()` | `:56` |
| ② 설정 읽기 | `:70-96` (`from("settings")` `:71`) |
| ③ 시각 판정 | `:98` |
| ④ 멱등 조회 | `:104-121` (`from("results")` `:105`) |
| ⑤ 후보 조회 + 정규화 + **0개 검사** | `:124-140` (`from("candidates")` `:125`, 0개 검사 `:140`) |
| ⑥ 쿨다운 | `:142-165` (`applyCooldown` `:161`) |
| ⑦ 추첨 | `:169` |
| ⑧ 기록 | `:173` |

설정이 시각 판정보다 **앞**인 이유가 `:58` 주석에 있다("판정 기준 자체가 DB 의 설정값이기 때문이다").
빈 배열 불가의 근거는 세 경로 모두 `:140` 뒤에 있다는 것이다: (a) 쿨다운 창이 없으면 `pool = candidates`(`:142`, 길이 ≥ 1), (b) 쿨다운 조회 실패면 `pool` 이 그대로(`:152-154`), (c) `applyCooldown` 은 전멸 시 전체를 되돌린다(`_shared/cooldown.ts:45-47`). **이 불변식이 코드 배치에 의존한다**는 사실이 `:167-168` 주석에 명시돼 있고(Pitfall 7), 계약 #31 이 순서를 고정한다.

### 낭독에서 고친 것

없다. Task 1 의 구현이 6항목 전부를 처음부터 만족해 Task 1 으로 되돌아간 일이 없다.

## 자동 계약이 덮지 못하는 지점 (Phase 8 실호출 전까지 미검증)

이 페이즈의 검증은 세 겹뿐이다 — 텍스트 계약 50건 · `deno check` 타입 통과 · 낭독. 라이브에 `candidates`·`restaurants`·`settings` 가 아직 없어 **이 함수는 한 줄도 실행되지 않았다.** 다음 세 가지는 어느 자동 장치도 확인하지 않는다:

1. **임베드가 실제로 객체로 오는가** (이 페이즈 최대 함정, T-04-11). `normalizeCandidates` 는 배열/객체 **양쪽**을 흡수하므로 어느 쪽이 와도 동작하지만, 그 사실 자체가 "확인했다" 를 뜻하지 않는다. PostgREST 가 예상 밖의 세 번째 형태(예: `null` 임베드)를 주면 그 행은 조용히 `skipped` 로 빠지고 `:136` 로그만 남는다. → **Phase 8 SHIP-04 수동 invoke 에서 `menu` 가 실제 매장명인지, `restaurant_id` 가 uuid 인지 확인한다**(todo `wr-01` 7번, 04-04 가 추가).
2. **`settings.spin_time` 이 어떤 문자열로 직렬화되는가.** PostgREST 의 `time` 직렬화는 `"11:55:00"` 으로 추정되고 `parseSpinTime` 이 `"HH:MM"`·`"HH:MM:SS"`·소수 초 세 형태를 받도록 이미 넓혀져 있지만(`_shared/spinTime.ts:15`), **실제 응답 형태를 본 적은 없다**. 어긋나면 `:89` 로그 + `settings_fallback: true` + 기본 시각 착지로 드러난다(추첨은 멈추지 않는다).
3. **콘솔 로그가 대시보드 Edge Function Logs 에 실제로 나타나는가.** cron 은 응답을 읽지 않으므로(fire-and-forget) 로그가 실패의 유일한 채널인데, 그 채널이 열려 있는지는 배포 후에만 확인된다.

덧붙여 계약 #31 은 다섯 토큰의 **순서**만 보고 조건식의 내용은 보지 않는다 — 분기 내용의 정확성은 위 낭독이 유일한 근거다.

## TDD Gate Compliance

- **RED 게이트:** `a39265b` `test(04-01): extend edge contract for new schema, settings and cooldown` ✓ (앞선 플랜이 세웠다 — 이 페이즈의 RED 는 플랜을 가로지른다)
- **GREEN 게이트:** `dd05211` `feat(04-02): rewrite spin-roulette on candidates, settings and cooldown` ✓
- **REFACTOR 게이트:** **없음.** GREEN 직후 계약 12건이 전부 초록이고 `check:edge`·`tsc`·`lint` 가 exit 0 이라 정리할 대상이 없었다. 재작성 자체가 리팩터(맨 응답 7회 → 1회)를 포함한다.

`git log --oneline --grep='^test(04-01)'` → `a39265b` 가 `git log --oneline --grep='^feat(04-02)'` → `dd05211` 보다 **먼저** 있다.

## Decisions Made

- **`restaurants[0]` 토큰을 피하려고 지역 변수 `embed` 를 한 번 거쳤다.** 인수 조건이 `grep -c 'restaurants\[0\]'` → 0 을 요구하는데 RESEARCH Pattern 1 원문(`Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants`)은 그 토큰을 포함한다. RESEARCH §Q-2c 가 제시한 `embed` 변수 형태가 동작은 같고 토큰은 피한다. 인수 조건의 의도(Pitfall 1 의 "통과하는 오답" 부재)도 그대로 지켜진다 — 임베드를 **접지 않고** 인덱싱하는 코드가 0건이다.
- **`normalizeCandidates` 내부에서 `const list: unknown[] = rows` 로 한 번 더 좁혔다.** `Array.isArray(rows)` 는 `unknown` 을 `any[]` 로 넓히고, 그러면 이후의 `typeof`·`in` 좁히기가 전부 `any` 위에서 무의미해진다. `unknown[]` 로 받으면 각 좁히기가 실제로 타입을 만든다(`deno check` exit 0 으로 확인). RESEARCH 스켈레톤보다 한 줄 엄격한 변형이고 `as`·`any` 는 여전히 0건이다.
- **`23505` 경로에 로그를 남기지 않았다.** D-10 은 "실패·폴백 경로마다" 로그를 요구하고 레이스는 둘 다 아니다. 로그를 남기면 대시보드에서 진짜 실패와 섞여 관측성이 떨어진다.
- **`04-VALIDATION.md` 의 혼합 행(#23·#24·#35·#36 처럼 spin/respin 이 한 행에 묶인 것)을 `⬜ pending` 으로 남겼다.** Status 는 행 단위라 절반만 초록으로 칠할 수 없고, 칠하면 04-03 이 무엇을 닫아야 하는지가 흐려진다. 대신 표 아래 한 줄로 "spin 쪽 #23~#34 는 전부 초록" 이라는 사실을 남겼다.
- **요구사항 완료 마킹을 하지 않았다.** 플랜 frontmatter 의 `requirements: [SPIN-01, SPIN-02, SETT-04]` 는 이 플랜이 **구현하는** 요구사항이지만, Phase 2 선례("검증을 닫는 플랜 하나만 찍는다")를 04-01 이 이미 적용했고 SPIN-01·SPIN-02 는 respin 쪽 절반이 04-03 에 남아 있다. `REQUIREMENTS.md`·`ROADMAP.md` 요구사항 체크박스 무변경.

## Deviations from Plan

**Rule 1~3 자동 수정 0건 · Rule 4 아키텍처 질의 0건.** 플랜이 지정한 2태스크·2커밋·3파일·계약 12건을 그대로 수행했다.

다만 플랜 본문과 인수 조건이 **한 지점에서 서로 달라** 인수 조건을 택했다(위 Decisions 1번). 플랜 `<action>` (4)는 "RESEARCH Pattern 1 / §Code Examples 1 의 형태를 그대로 쓴다" 고 했고 그 원문은 `row.restaurants[0]` 를 포함하는데, 같은 태스크의 인수 조건은 `restaurants[0]` 0건을 요구한다. RESEARCH §Q-2c 의 `embed` 변수 형태가 두 요구를 동시에 만족하므로 그쪽을 썼다 — 동작·타입 안전성 모두 동일하고, 플랜 `<action>` 이 요약한 "임베드를 `Array.isArray(...) ? [0] : 그대로` 로 접는다" 라는 서술과도 정확히 일치한다.

금지 사항 전부 준수: `respin-roulette/index.ts`·`_shared/*.ts`·`edgeImports.test.ts`·`lib/**`·`app/**` 무변경, `npm install` 0회, 원격 Supabase 명령 0회, `npm run dev` 0회, `git add -A` 0회, `.serena/project.yml`·`.planning/config.json` 미커밋, `as`·`any` 0건, `_shared` 신규 모듈 0개, 배포 0회.

## Issues Encountered

None.

한 가지 기록할 관측: `supabase/functions/deno.lock` 에 `"jsr:@supabase/supabase-js@2"` 명세자 줄이 **남아 있다.** `respin-roulette` 가 아직 비핀 명세자를 쓰기 때문이고, 04-03 이 그쪽을 핀하면 lock 에서 그 줄이 빠지면서 다시 한 번 갱신된다(04-03-T3 이 lock 을 커밋에 포함해야 하는 근거). 그 외 태스크에서 lock 이 바뀌면 멈추고 원인을 찾는다.

## User Setup Required

None - no external service configuration required.

⚠ 이 함수는 아직 **배포되지 않았다.** 라이브에는 구 `spin-roulette`(메뉴 기반)가 계속 돌고 있고, 새 코드가 의존하는 `candidates`·`restaurants`·`settings` 테이블은 라이브에 없다. 배포·마이그레이션 적용은 Phase 8 컷오버에서 사용자가 한다.

## Next Phase Readiness

**04-03(`respin-roulette` 재작성 + `formatRespinError` + `respin()`)이 바로 시작 가능하다.**

**04-03 이 참고할 것:**
- `spin-roulette/index.ts` 가 이제 **형제 아날로그**다. 블록을 옮기되 의도된 비대칭 5개를 유지한다: (1) CORS 헤더 + OPTIONS 단락 유지, (2) 시간 가드 없음(`parseSpinTime`·`DEFAULT_SPIN_TIME` 0건 — 계약 #42), (3) 멱등 스킵 없음, (4) `.upsert(..., { onConflict: "date" })`, (5) `from("results")` 2회(쿨다운 창 + 덮어쓰기).
- `normalizeCandidates` 는 **이름·시그니처를 그대로** 복제해야 #47 이 `[1, 1]` 로 닫힌다. 본문도 같게 두면 Phase 8 낭독에서 두 파일을 diff 로 비교할 수 있다.
- jsr 핀(`@2` → `@2.117.2`)이 `supabase/functions/deno.lock` 을 다시 바꾼다 — 그 태스크의 커밋에 포함한다.
- `respin` 쪽 `console.error(` 기준은 **> 3**(#43)이고 설정 조회는 쿨다운 일수만 쓴다(#37 설명문).
- 완료 시 기대 수치: `edgeImports.test.ts` `50 passed (50)`, `npm test` `219 passed (219)`(`lib/errors.test.ts` 3건 추가 후), `npm run check:edge` exit 0.

**블로커:** 없음.

## Self-Check: PASSED

- 파일 3개(`supabase/functions/spin-roulette/index.ts` 200줄 · `supabase/functions/deno.lock` 277줄 · `.planning/phases/04-server-spin/04-VALIDATION.md`) 전부 디스크에 존재.
- 커밋 2개(`dd05211` · `8ef59a1`) 전부 `git log` 에서 확인.
- 누락 0건.

---
*Phase: 04-server-spin*
*Plan: 02*
*Completed: 2026-09-28*
