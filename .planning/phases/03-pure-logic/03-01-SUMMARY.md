---
phase: 03-pure-logic
plan: 01
subsystem: infra
tags: [deno, edge-function, vitest, intl, tsconfig, eslint, contract-test, kst]

# Dependency graph
requires:
  - phase: 01-03
    provides: "vitest.config.mts — include 에 supabase/functions/_shared/**/*.test.ts 가 이미 있고 exclude 의 extglob 이 함수 디렉터리만 배제한다 (이 플랜에서 무변경)"
  - phase: 02-02
    provides: "0005_restaurants_settings.test.ts — readOrEmpty·stripAfter/stripComments·count 텍스트 계약 테스트 관용구의 원본"
provides:
  - "supabase/functions/_shared/kst.ts — KstParts(date 포함)·kstParts(now)·kstNow()·pickRandom. 레포 전체 KST 분해의 유일한 구현처"
  - "supabase/functions/_shared/spinTime.ts — SpinTime·DEFAULT_SPIN_TIME·DEFAULT_SPIN_TIME_TEXT·parseSpinTime·secondsOfDay·isAfterSpinTime. 기본 추첨 시각의 유일한 정의처"
  - "supabase/functions/_shared/cooldown.ts — cooldownWindowStart(today, days)·applyCooldown → { picked, fellBack }"
  - "_shared/ 가 tsc·eslint 검사 대상이 된 상태 (D-12). 제외는 spin-roulette/**·respin-roulette/** 두 디렉터리뿐"
  - "edgeImports.test.ts — deno 미설치 환경에서 두 Edge Function 에 대한 유일한 자동 회귀 장치 (22건)"
affects: [03-02, 03-03, 04-edge-function, 06-ui-copy, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "import 0개 공유 모듈: Deno(확장자 필수)와 tsc(확장자 거부)가 정반대를 요구하므로 _shared/*.ts 는 서로도 import 하지 않고 교차 타입은 로컬 구조 타입으로 받는다"
    - "정적 검사 경계를 먼저 좁히고(Wave 0) 그 다음에 파일을 쓴다 — 순서가 반대면 새 코드가 tsc·eslint 사각지대에서 쌓인다"
    - "실행할 수 없는 산출물(Deno 파일)은 텍스트 계약 테스트로 회귀를 잡고, 그 spec 의 한계(형태만 본다)를 머리 주석에 함께 적는다"

key-files:
  created:
    - supabase/functions/_shared/kst.ts
    - supabase/functions/_shared/spinTime.ts
    - supabase/functions/_shared/cooldown.ts
    - supabase/functions/_shared/kst.test.ts
    - supabase/functions/_shared/spinTime.test.ts
    - supabase/functions/_shared/cooldown.test.ts
    - supabase/functions/_shared/edgeImports.test.ts
  modified:
    - tsconfig.json
    - eslint.config.mjs
    - supabase/functions/spin-roulette/index.ts
    - supabase/functions/respin-roulette/index.ts

key-decisions:
  - "D-12(제외 좁히기)를 첫 커밋으로 올렸다 — 좁히기 전에는 _shared 의 타입 에러가 tsc --noEmit exit 0 으로 지나간다. RED 커밋의 TS2307 3건이 좁히기가 실제로 켜졌다는 증거다"
  - "_shared/*.ts 세 파일 전부 import 0개. spinTime.ts 는 kst.ts 의 KstParts 대신 로컬 구조 타입으로 벽시계를 받는다 — 확장자 있는 import 는 tsc 가, 없는 import 는 Deno 가 거부한다"
  - "spin-roulette 호출부는 parseSpinTime(DEFAULT_SPIN_TIME_TEXT) 가 아니라 DEFAULT_SPIN_TIME 상수를 그대로 넘긴다 — 비-null 단언을 호출처에 퍼뜨리지 않는다 (D-18)"
  - "respin-roulette 는 spinTime.ts 를 끌어오지 않는다 — 시간 가드가 없는 함수라 필요 없는 의존이고, edgeImports #17 이 그 부재를 단언으로 고정한다"
  - "kst.ts 주석에서 hour12 라는 토큰 자체를 쓰지 않았다 — 'hour12 0건' 게이트가 자기 자신을 세지 않게 하기 위해서다 (Phase 2 의 '주석 제거 사본에서 센다' 교훈의 소스 쪽 대응)"
  - "'hour12/SPIN_HH 0건' 형 레포 전역 grep 게이트는 계약 spec 의 정규식 리터럴까지 세므로 소스 파일로 범위를 좁혀 측정했다 — spec 에서 그 토큰을 빼면 회귀 장치가 사라진다"
  - "요구사항 완료 마킹은 하지 않았다 — QUAL-02 는 03-03 의 문서 정정까지, SPIN-02 는 Phase 4 의 Edge 본문 배선까지 가야 닫힌다 (Phase 2 에서 세운 '검증을 닫는 플랜 하나만 찍는다' 규칙)"

patterns-established:
  - "단위 spec 머리 주석 4~6줄: 이 spec 이 왜 존재하는가 + 무엇을 일부러 안 하는가(분포·초 단위·DB 조회) + 그 이유"
  - "짝을 이루는 불변식은 한 it 안에서 배열 toEqual 로 함께 단언한다 (SPIN_HH·SPIN_MM / OPTIONS 단락·corsHeaders)"
  - "Edge Function 수정은 import 교체까지만 하고 본문은 한 글자도 건드리지 않는다 — 본문 재작성은 Phase 4"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-09-21
---

# Phase 3 Plan 01: `_shared` 순수 모듈 Summary

**KST 분해·추첨 시각 판정·쿨다운 필터를 import 0개의 `supabase/functions/_shared/` 모듈 3개로 모으고, 두 Edge Function 의 문자 단위 복붙(`kstNow`·`pickRandom`·`isAfterSpinTime`·`SPIN_HH/MM`·로컬 `KstParts`)을 그 모듈 import 로 교체했다. 그 전에 `tsconfig`·`eslint` 제외를 함수 디렉터리 2개로 좁혀 새 코드가 정적 검사 사각지대에 있지 않게 했다.**

## Performance

- **Duration:** 10min
- **Started:** 2026-09-21T04:29:12Z
- **Completed:** 2026-09-21T04:40:00Z
- **Tasks:** 4
- **Files modified:** 11 (신규 7 · 수정 4)

## Accomplishments

- `kstNow` 정의가 레포 전체에 **1곳**(`_shared/kst.ts:63`)이 됐다. 이전에는 두 Edge Function 에 문자 단위로 동일한 복붙 2벌 + `lib/time.ts` 의 `kstParts` 1벌 = 3벌이었다(`lib/time.ts` 재수출 전환은 03-02).
- `_shared/` 가 `tsc`·`eslint` 검사 대상이 됐다. D-02(import 0개)가 규약에서 **컴파일러 게이트**로 승격됐다 — `./kst.ts` 형태 상대 import 는 이제 `TS5097` 로 즉시 잡힌다.
- 테스트 5파일 89건 → **9파일 145건**. 신규 56건(`kst` 9 · `spinTime` 15 · `cooldown` 10 · `edgeImports` 22)이 전부 계획된 개수 그대로다.
- SPIN-02 의 핵심(쿨다운 제외 후 후보 0개 → 전체 폴백 + `fellBack: true`)이 `applyCooldown` 한 함수 안에서 끝나고 `cooldown.test.ts` #9 가 그 경로를 고정한다.
- 두 함수의 CORS·OPTIONS 단락·`23505` 레이스 처리·`menus` 조회가 원문 그대로 보존됐고, 그 보존 자체를 계약 테스트가 단언한다.

## Task Commits

1. **Task 1 (Wave 0): tsconfig·eslint 제외 좁히기 (D-12)** — `d80aa7e` (chore)
2. **Task 2 (RED): `_shared` spec 4개** — `dc31939` (test)
3. **Task 3 (GREEN 1/2): `_shared` 순수 모듈 3개** — `193e42c` (feat)
4. **Task 4 (GREEN 2/2): Edge Function import 교체** — `4d91ba0` (feat)

REFACTOR 커밋은 만들지 않았다 — 정리할 것이 없었고 빈 커밋은 금지다.

## TDD Gate Compliance

`chore` → `test(03-01)` → `feat(03-01)` ×2 순서로 RED 가 첫 GREEN 보다 먼저다. 게이트 3종 전부 성립.

### D-12 좁히기 전후의 `tsc` 거동 차이 (이 플랜의 전제)

| 시점 | `npx tsc --noEmit` | 의미 |
|---|---|---|
| Task 1 전 | exit 0 (`_shared` 에 파일이 없어도, **있어도** 동일) | `exclude: "supabase/functions/**"` 가 `_shared` 를 통째로 가린다 |
| Task 1 후 | exit 0 | 좁혔지만 아직 `_shared` 에 파일이 없다 |
| Task 2 (RED) 후 | **exit 1 — `TS2307` 정확히 3건** | spec 3개가 없는 모듈(`./kst`·`./spinTime`·`./cooldown`)을 부른다. **이 3건이 좁히기가 실제로 켜졌다는 증거다** |
| Task 3 후 | exit 0 | 모듈 3개가 생기며 `TS2307` 3건이 닫혔다 |
| Task 4 후 | exit 0 | 두 `index.ts` 는 여전히 제외 대상이라 tsc 가 보지 않는다 (의도된 설계) |

측정된 `TS2307` 3건 원문:
```
supabase/functions/_shared/cooldown.test.ts(8,52): error TS2307: Cannot find module './cooldown' ...
supabase/functions/_shared/kst.test.ts(9,46): error TS2307: Cannot find module './kst' ...
supabase/functions/_shared/spinTime.test.ts(15,8): error TS2307: Cannot find module './spinTime' ...
```

### RED 에서 무엇이 왜 실패했는가 (두 가지 형태가 섞인다)

`npx vitest run supabase/functions/_shared` → **exit 1**, `Test Files 4 failed (4)` / `Tests 16 failed | 6 passed (22)`.

| 파일 | 실패 형태 | 이유 |
|---|---|---|
| `kst.test.ts` · `spinTime.test.ts` · `cooldown.test.ts` | **모듈 로드 실패** (`Failed Suites 3`, `Error: Cannot find module './kst' imported from …`, 각 `(0 test)`) | 구현 파일이 아직 없다. "모듈이 없다" 는 정확한 RED 신호다 |
| `edgeImports.test.ts` | **단언 실패 16건 / 통과 6건** (수집은 정상: `22 tests`) | `readOrEmpty` 폴백이 읽기 실패를 빈 문자열로 흡수해, 모듈 로드 실패가 아니라 "무엇이 왜 없는지" 가 단언으로 드러난다 |

`edgeImports.test.ts` 단독 실행에서 `Failed to load` 0건 · `No test files found` 0건 — 수집 실패가 아니라 단언 실패임이 확인됐다. RED 에서 통과한 6건은 `#4·#5·#6`(빈 문자열의 import 0건)과 `#15`(`23505` 보존) · `#17`(respin 이 spinTime 을 안 씀) · `#22`(OPTIONS 보존) 로, 전부 **"아직 건드리지 않았으니 참"** 인 항목이다.

### GREEN 에서 무엇이 통과시켰는가

- **Task 3 후:** 단위 spec 34건 전부 초록(`kst` 9 + `spinTime` 15 + `cooldown` 10). `edgeImports` 는 13 failed / 9 passed 로 **빨간 상태가 정상** — `SHARED/` 6건이 초록으로 바뀌었고 `EDGE/` 쪽 복붙 부재·import 존재 단언이 남아 있었다.
- **Task 4 후:** `edgeImports` 22/22 초록. 전체 `npm test` 9파일 145건 초록.

## Files Created/Modified

- `tsconfig.json` — `exclude` 의 `"supabase/functions/**"` 한 항목을 `spin-roulette/**`·`respin-roulette/**` 두 항목으로. `node_modules`·`design/**` 무변경, 배열 순서 유지
- `eslint.config.mjs` — `globalIgnores` 같은 방식으로 분리 + 주석을 `design/**` 근거(인덱서 OOM·대형 JSX/PNG)와 함수 디렉터리 근거(Deno 전역·`jsr:` import)로 나누고 `_shared/` 가 검사 대상임을 한 줄로 명시
- `supabase/functions/_shared/kst.ts` — `KstParts`(`date` 맨 앞)·`kstParts(now: Date)`(기본 인자 없음)·`kstNow()`·`pickRandom`. `hourCycle: "h23"`, `% 24` 방어선 유지, `pickRandom` 본문 4줄은 원문 그대로 + 전제조건 주석
- `supabase/functions/_shared/spinTime.ts` — 정규식 `SPIN_TIME_RE` 로 `"HH:MM"`·`"HH:MM:SS"`·소수 초를 받고 초는 버린다. `DEFAULT_SPIN_TIME` 은 리터럴 상수, 로컬 구조 타입으로 벽시계를 받는다
- `supabase/functions/_shared/cooldown.ts` — `Date.UTC` + UTC 게터만 쓰는 날짜 산술(`days <= 0` → `null`), `applyCooldown` 의 3단 파이프라인
- `supabase/functions/_shared/kst.test.ts` (9) · `spinTime.test.ts` (15) · `cooldown.test.ts` (10) · `edgeImports.test.ts` (22)
- `supabase/functions/spin-roulette/index.ts` — `+5 / −37`. import 2줄 추가, 복붙 5덩어리 삭제, 호출부 2인자화
- `supabase/functions/respin-roulette/index.ts` — `+3 / −28`. import 1줄 추가, 복붙 3덩어리 삭제

## 두 Edge Function 낭독 체크리스트 (자동 검증 사각지대 — `deno` 미설치)

| # | 항목 | 판정 | 인용 |
|---|---|---|---|
| 1 | 새 import 가 `../_shared/*.ts` 형태이고 확장자가 붙어 있는가 | ✅ | `spin-roulette/index.ts:12` `import { kstNow, pickRandom } from "../_shared/kst.ts";` · `:13` `import { DEFAULT_SPIN_TIME, isAfterSpinTime } from "../_shared/spinTime.ts";` · `respin-roulette/index.ts:22` `import { kstNow, pickRandom } from "../_shared/kst.ts";` (respin 은 1줄만 — `:20-21` 주석이 "시간 가드가 없는 함수라 spinTime.ts 는 끌어오지 않는다" 를 남긴다) |
| 2 | 삭제한 로컬 함수의 잔여 **호출**이 없는가 (단일 인자 `isAfterSpinTime(now)`) | ✅ | `spin-roulette/index.ts` 의 `isAfterSpinTime(` 매치는 `:19` `if (!isAfterSpinTime(now, DEFAULT_SPIN_TIME)) {` 한 곳뿐. `respin-roulette` 에는 호출 0건 |
| 3 | `SPIN_HH`/`SPIN_MM` 참조가 0인가 | ✅ | `spin-roulette/index.ts` 의 `SPIN_` 매치는 `:13`(import)·`:19`(호출) 두 줄뿐이고 둘 다 `DEFAULT_SPIN_TIME` 이다. `const SPIN_HH`/`const SPIN_MM` 은 두 파일 모두 0건 |
| 4 | `respin-roulette` 의 OPTIONS 단락과 `corsHeaders` 가 원문 그대로인가 | ✅ | `:24-28` `corsHeaders` · `:31-36` `json()` · `:39-42` `if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }` — `git diff` 에 이 구간 hunk 0건(삭제 hunk 는 `:35-61` 복붙 블록 하나뿐) |
| 5 | `spin-roulette` 의 `23505` 분기가 원문 그대로인가 | ✅ | `:74-85` `if (insErr) { … if (insErr.code === "23505") { … "race_already_decided" … } … }` — `git diff` 에 이 구간 hunk 0건 |

추가 낭독 확인: `from("menus")` 가 두 파일에 각 1건으로 남아 있다(테이블 교체는 Phase 4). `Deno.env.get` 두 줄도 무변경.

## Decisions Made

- **`isAfterSpinTime(now, DEFAULT_SPIN_TIME)`** — 계획 문면의 대안(`parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` 경유)을 쓰지 않았다. D-18 이 비-null 단언 제거를 지시했으므로 값 상수를 그대로 넘기는 편이 호출부가 단순하고, `settings` 주입은 Phase 4 가 이 인자 자리에 꽂으면 된다.
- **`kst.ts` 주석에서 `hour12` 토큰을 쓰지 않았다.** 리서치 §Code Examples 의 머리 주석 문안은 `hour12` 와 `hourCycle` 을 둘 다 언급하는데, 그대로 쓰면 `grep -c 'hour12' kst.ts → 0` 게이트가 주석 때문에 깨지고 `hourCycle` 도 2건이 된다. 같은 내용을 토큰 없이("같은 뜻의 불리언 옵션을 함께 적으면 그쪽이 이겨 이 줄이 조용히 무시된다") 적었다. Phase 2 의 "주석이 게이트를 무력화한다" 교훈을 소스 쪽에 적용한 것.
- **`spinTime.ts` 주석에 `parseSpinTime(...)!` 문면을 쓰지 않았다.** 인수 조건이 `grep -c 'parseSpinTime(.*)!' → 0` 이라 리서치 스니펫의 주석을 그대로 옮기면 게이트가 주석을 센다.
- **`cooldownWindowStart` 의 반환 조립을 3줄로 쪼갰다.** 인수 조건 `grep -c 'getUTC' → 3` 은 **줄 수**를 세는데 리서치 스니펫은 세 개의 `getUTC*` 호출이 한 줄에 있다(→ 1). 의도(연·월·일 셋 다 UTC 게터로 읽는다)를 지키려면 줄을 나눠야 한다.
- **요구사항 마킹을 하지 않았다.** `requirements: [QUAL-02, SPIN-02]` 이지만 둘 다 이 플랜에서 닫히지 않는다 — QUAL-02 의 문서 정정(D-16)은 03-03, SPIN-02 의 Edge 배선은 Phase 4. Phase 2 에서 세운 규칙을 따른다.

## Deviations from Plan

계획 코드는 그대로 실행했고, **인수 조건의 측정 범위 2건**이 실제 트리에서 맞지 않아 범위를 좁혀 측정했다. 코드 결함이 아니라 게이트 문면의 문제다.

### 측정 범위를 좁힌 인수 조건 (Rule 1 성격 — 게이트 정정)

**1. `grep -rn 'hour12' supabase/functions | wc -l` → `0` 이 아니라 `4`**
- **Found during:** Task 4
- **측정값:** 4. 전부 `supabase/functions/_shared/edgeImports.test.ts:110,111,140,141` — 이 플랜이 **스스로 만든 계약 테스트**의 `it` 이름과 정규식 리터럴 `/hour12/g` 다.
- **소스 기준 측정:** `grep -rn 'hour12' supabase/functions --include='index.ts' | wc -l` → **0**. `lib/` 의 `hour12` 3건은 03-02 소관(`lib/time.ts` 전환)이라 이 플랜 범위 밖이다.
- **판단:** spec 에서 그 토큰을 빼면 D-04 회귀 장치가 통째로 사라진다. 게이트 문면이 "Edge Function 소스"를 뜻했다고 보고 범위를 좁혀 측정했다.

**2. `grep -rn 'const SPIN_HH\|const SPIN_MM' supabase/functions | wc -l` → `0` 이 아니라 `1` / `grep -rn 'function kstNow' . --include='*.ts' … | wc -l` → `1` 이 아니라 `3`**
- **Found during:** Task 4
- **측정값:** `const SPIN_HH` 1건 = `edgeImports.test.ts:103` 의 `/const SPIN_HH/g`·`/const SPIN_MM/g` 리터럴(한 줄). `function kstNow` 3건 중 2건이 `edgeImports.test.ts:90,129` 의 `/function kstNow/g` 리터럴.
- **소스 기준 측정:** `--include='index.ts'` → **0** / `--exclude='*.test.ts'` → **1**, 그 1건이 `supabase/functions/_shared/kst.ts:63` `export function kstNow(): KstParts {` 이고 `grep -c 'export function kstNow' _shared/kst.ts` → `1`. **QUAL-02 의 실질(정의 1곳)은 충족**이다.

---

**Total deviations:** 2 (둘 다 인수 조건의 측정 범위 정정, 코드 무변경)
**Impact on plan:** 산출물·커밋·동작에 영향 없음. 다음 페이즈가 같은 게이트를 쓸 때는 `--include='index.ts'` 또는 `--exclude='*.test.ts'` 를 붙여야 한다.

### 예상된 무해한 응답 변화 1건 (INFO-13 — 동작 불변 원칙의 명시적 예외)

`spin-roulette` 의 조기 반환 페이로드가 넓어진다:

```
before: { "skipped": "before_spin_time", "kst": { date, hour, minute, second } }
after:  { "skipped": "before_spin_time", "kst": { date, year, month, day, hour, minute, second, weekday } }
```

`spin-roulette/index.ts:21` 이 `kst: now` 를 통째로 싣는데 `kstNow()` 반환이 로컬 `{ date, hour, minute, second }` 에서 `KstParts` 로 넓어졌기 때문이다. 필드 4개(`year`·`month`·`day`·`weekday`)가 더 붙는다. **소비처가 없는 진단용 페이로드**이고(pg_cron 이 응답 본문을 읽지 않는다) 기존 4개 필드의 이름·값은 그대로라, 추첨 동작에는 영향이 없다. `date`·`hour`·`minute`·`second` 가 전부 부분집합이라 `now.date` 를 쓰는 자리들(`:37`·`:42`·`:62`·`:71`·`:78`·`:93`)도 그대로 동작한다.

## Issues Encountered

- **`npx vitest run ... | tail` 의 종료 코드가 `tail` 의 것이라 RED 판정이 거짓으로 초록이었다.** 파이프 없이 파일로 리다이렉트해 `$?` 를 다시 측정했다(`exit 1` 확인). 이후 모든 게이트는 파이프 없이 exit code 를 잡았다.
- `.planning/phases/03-pure-logic/03-VALIDATION.md` 의 `wave_0_complete: false` 를 `true` 로 올렸다 — Task 1 이 Wave 0 이고 `d80aa7e` 로 닫혔다. 03-01-T1~T4 행 7개는 `⬜ pending` → `✅ green`. `status: draft` 는 지시대로 유지했다.

## 이 플랜이 **하지 않은** 것 (경계 확인)

- Edge Function 배포·마이그레이션 적용·원격 SQL 실행 **0건**. `npm install` **0건**(신규 devDependency 0). `git push` **0건**. `main` 무변경.
- `vitest.config.mts` **무변경** (`git diff --stat -- vitest.config.mts` 0줄).
- `lib/time.ts`·`lib/phase.ts`·`app/**`·`components/**` 무변경 — 03-02 소관.
- 두 `index.ts` 의 본문(`menus` 조회·`23505`·CORS·OPTIONS·upsert) 무변경 — Phase 4 소관.
- `npm run dev` 미실행.

## 검증 결과 (최종 게이트)

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0, 신규 에러 0건 |
| `npm test` | exit 0 — `Test Files 9 passed (9)` · `Tests 145 passed (145)` (89 + 56) |
| `npm run build` | exit 0 — `Compiled successfully in 461ms`, 정적 라우트 4개 생성 |
| `npx vitest run supabase/functions/_shared/edgeImports.test.ts` | exit 0 — `Tests 22 passed (22)` |
| `git diff --stat -- vitest.config.mts` | 0줄 |
| `git log 6347066..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | 0 |
| 커밋에 `.serena/project.yml`·`.planning/config.json` 포함 | 0건 |

## Next Phase Readiness

- **03-02 가 바로 쓸 수 있는 것:** `@/supabase/functions/_shared/kst`·`@/supabase/functions/_shared/spinTime`(확장자 **없이** — `lib/` 규칙). `lib/time.ts` 는 `export { kstParts } from …` + `export type { KstParts } from …` 로 나눠 재수출해야 한다(`isolatedModules`). `lib/time.test.ts:58-66` 의 `kstParts` 기대 객체에 **`date: "2026-09-18"` 한 줄을 더해야** 통과한다 — `toEqual` 이 잉여 키를 거부하므로 이 한 줄을 빠뜨리면 03-02 가 빨간 줄로 시작한다(D-15).
- `lib/` 의 `hour12` 3건(`lib/time.ts:16,24,48`)은 아직 남아 있다 — D-04 의 나머지 절반이 03-02 소관이다.
- **Phase 4 가 이어받을 계약:** `applyCooldown` 은 `{ picked, fellBack }` 을 주므로 응답에 `cooldown_fallback` 을 실을 수 있다. `picked` 가 빈 배열일 수 있는 경로는 없지만(폴백이 전체를 되돌린다) `pickRandom` 은 여전히 호출자 길이 검사에 의존하는 계약이다(T-03-05, accept).
- **주의:** 두 `index.ts` 는 D-12 이후에도 tsc·eslint 제외 대상이다. `edgeImports.test.ts` 는 **형태만** 본다 — import 경로 해석·타입 정합성은 Phase 8 배포 시점에야 드러난다. `deno check` 도입 여부는 Phase 4 가 결정한다.

## Self-Check: PASSED

- 생성 파일 7개 전부 존재 확인 (`kst.ts`·`spinTime.ts`·`cooldown.ts`·spec 4개)
- 수정 파일 4개 전부 존재 확인 (`tsconfig.json`·`eslint.config.mjs`·두 `index.ts`)
- 커밋 4개 전부 `git log` 에서 확인: `d80aa7e`·`dc31939`·`193e42c`·`4d91ba0`

---
*Phase: 03-pure-logic*
*Completed: 2026-09-21*
