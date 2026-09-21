---
phase: 03-pure-logic
plan: 02
subsystem: frontend
tags: [phase-state, exhaustiveness-check, tdd, kst, intl, union-widening, spin-03]

# Dependency graph
requires:
  - phase: 03-01
    provides: "supabase/functions/_shared/kst.ts (kstParts·KstParts) 와 _shared/spinTime.ts (SpinTime·DEFAULT_SPIN_TIME·secondsOfDay). lib/ 이 확장자 없이 @/ 별칭으로 가져다 쓴다"
  - phase: 01-03
    provides: "lib/phase.test.ts·lib/time.test.ts 의 경계 6종·포맷 단언 9개. 이번 재작성의 기준선"
provides:
  - "lib/phase.ts — Phase 4상태 유니온(stalled 포함) · currentPhase(now, spinTime, hasResult) 기본 인자 0개 · isCandidateListLocked(phase)"
  - "lib/time.ts — kstParts/KstParts 의 얇은 재수출 + hourCycle h23 포맷터 4개. KST 분해 구현은 레포에 1곳"
  - "Phase 소비처 9곳이 stalled 를 아는 상태. switch+never 가드 3곳이 5번째 상태를 컴파일 에러로 만든다"
  - "세 페이지가 currentPhase 에 추첨 시각을 넘기는 호출 형태 — 03-03 이 DEFAULT_SPIN_TIME 자리에 settings.spinTime 을 꽂으면 된다"
affects: [03-03, 06-ui-copy, 07-log-rank]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "유니온 확장은 소비처 전환과 같은 커밋에 넣는다 — if-체인 + fallback 소비처는 유니온이 넓어져도 tsc 가 침묵하므로 커밋을 나누면 '초록인데 틀린' 중간 상태가 생긴다"
    - "switch + const exhaustive: never 가드를 유니온을 읽는 자리마다 둔다. 레포 첫 switch 사용처 3곳"
    - "시각을 인자로 강제하는 순수 판정 함수: 기본 인자를 버려 '설정에서 온 값' 이 다시 모듈 안에 숨지 못하게 한다"

key-files:
  created: []
  modified:
    - lib/time.ts
    - lib/time.test.ts
    - lib/phase.ts
    - lib/phase.test.ts
    - app/page.tsx
    - app/log/page.tsx
    - app/rank/page.tsx
    - components/MenuList.tsx
    - components/TopBar.tsx
    - components/PhaseTimeline.tsx
    - components/ResultBlock.tsx

key-decisions:
  - "RED 의 실패 형태가 계획 예측(모듈 로드 실패)과 달랐다 — vitest 는 없는 named export 를 undefined 로 바인딩해 16건을 전부 수집하고 11 failed / 5 passed 로 떨어졌다. 'isCandidateListLocked is not a function' + tsc TS2305/TS2554 가 실질 RED 신호다"
  - "isCandidateListLocked 를 components/MenuList.tsx 가 아니라 lib/phase.ts 에 뒀다 — 유니온과 잠금 규칙이 같은 파일에 있어야 never 가드가 상태 추가를 한 곳에서 막는다. MenuList 는 값 import 한 줄로 위임한다"
  - "ResultBlock 의 decided && !winner 분기는 조건만 바꿔 옮겼고 도달 불가가 된 옛 분기를 남기지 않았다 — 문구가 이미 stalled 의 뜻이었다"
  - "PhaseTimeline 의 STEPS 4단계를 유지하고 stalled 를 accepting(idx 0)에 매핑했다 — 단계 추가는 디자인 결정이라 UI 페이즈로 미룬다"
  - "app/log 의 hasResult 는 이미 로드한 results 에서 파생한다. 다른 달을 보고 있으면 뱃지가 부정확할 수 있다는 한계를 코드 주석(app/log/page.tsx:33-36)에 남기고 오늘 결과 조회는 이관했다"
  - "세 페이지가 아직 DEFAULT_SPIN_TIME 을 넘긴다 — 이 플랜의 동작 불변 약속을 지키기 위한 의도된 임시 참조이고 03-03 이 교체한다"

patterns-established:
  - "IIFE + switch + never 로 label/dot 같은 여러 값을 한 번에 정하는 형태 (TopBar·StageHeader)"
  - "spec 이 기대값을 리터럴로 적는다: 추첨 시각을 { hh: 11, mm: 55 } 로 직접 써서 '11:55 가 기본' 이라는 계약이 상수 변경에 딸려가지 않게 한다"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-09-21
---

# Phase 3 Plan 02: 시각 주입 + stalled 4상태 Summary

**`lib/time.ts` 의 `kstParts` 본체를 버리고 `_shared/kst` 재수출로 바꿔 KST 분해 구현을 레포 전체에 1곳으로 만들었고, `lib/phase.ts` 를 `currentPhase(now, spinTime, hasResult)` 로 다시 써 "추첨 시각은 지났는데 결과 행이 없는" 구간을 `decided` 가 아니라 `stalled` 로 판정하게 한 뒤, `Phase` 유니온을 읽는 소비처 9곳을 같은 커밋에서 전환했다. 후보 0개로 추첨이 건너뛰어진 날 후보 목록이 잠기던 P1 이 `isCandidateListLocked("stalled") === false` 로 해소됐다.**

## Performance

- **Duration:** 8min
- **Started:** 2026-09-21T04:45:15Z
- **Completed:** 2026-09-21T04:53:30Z
- **Tasks:** 3
- **Files modified:** 11 (+ todo 파일 1개 삭제)

## Accomplishments

- KST 분해 구현이 `supabase/functions/_shared/kst.ts` **1곳**으로 완성됐다. `lib/time.ts` 는 값 import 1줄(`:6`) + `export { kstParts };`(`:10`) + `export type { KstParts } from …`(`:11`) 세 문장의 얇은 층이 됐고, 기존 소비처(`app/log/page.tsx`·`lib/phase.ts`·spec)는 import 경로를 바꾸지 않았다.
- `lib/` 의 `hour12` 가 **0건**이 됐다(전 3건). 포맷터 2개가 `hourCycle: "h23"` 을 쓴다(`lib/time.ts:27`·`:36`). 포맷 결과가 동일해 `lib/time.test.ts` 의 문자열 단언 9개는 한 글자도 바뀌지 않았다 — 실제 변경은 `date: "2026-09-18"` 한 줄 + 주석 한 줄 = **`+2 / -0`**.
- `Phase` 가 4상태가 됐고 `currentPhase` 가 기본 인자 없이 시각을 받는다. `hasResult` 가 `decided` 를 결정하고 시각은 나머지 세 상태만 가른다 — 클라이언트의 페이즈 추정이 "존재하지 않는 결과"를 확정으로 표시할 수 없는 형태가 시그니처에 박혔다.
- 소비처 9곳이 **한 커밋**(`0a71b10`)에서 전환됐고 `switch` + `const exhaustive: never` 가드가 3곳에 들어갔다(레포 첫 `switch` 사용처).
- `msToNextPhase`·`resolvedPhase`·`SPIN_HH`/`SPIN_MM` 이 전부 사라졌다. todo IN-03(머리 주석 `11:55:06` → `11:55:05`)·IN-04(`hourCycle`)가 닫히고 todo 파일이 삭제됐다.
- 테스트 9파일 145건 → **9파일 155건**(`lib/phase.test.ts` 6 → 16건, 파일 수 불변).

## Task Commits

1. **Task 1: `lib/time.ts` 재수출 + `hourCycle: "h23"`** — `69ee9bc` (refactor)
2. **Task 2 (RED): `lib/phase.test.ts` 재작성 16건** — `6b5ff03` (test)
3. **Task 3 (GREEN): `lib/phase.ts` 재작성 + 소비처 9곳 + todo 삭제** — `0a71b10` (feat)

**REFACTOR 커밋 없음** — 전환 후 정리할 것이 없었고 빈 커밋은 금지다.

## TDD Gate Compliance

`refactor(03-02)` → `test(03-02)` → `feat(03-02)`. RED 가 GREEN 보다 먼저이고 `git log --grep` 으로 순서가 확인된다. 게이트 3종(RED 존재·GREEN 존재·순서) 성립.

### RED 에서 무엇이 왜 실패했는가 (계획 예측과 형태가 달랐다)

`npx vitest run lib/phase.test.ts` → **exit 1**, `Test Files 1 failed (1)` / `Tests 11 failed | 5 passed (16)`.

계획은 "모듈 로드 실패 형태"(named export 해석 실패로 `(0 test)`)를 예상했지만, 실제로는 **수집이 정상으로 끝나고 단언·호출 단계에서 실패**했다. vitest(esbuild 트랜스파일 ESM)가 없는 named export 를 로드 시점에 끊지 않고 `undefined` 로 바인딩하기 때문이다. 실질 RED 신호는 두 가지다:

| 실패 형태 | 건수 | 원문 |
|---|---|---|
| 값 불일치 (`stalled`·`decided` 판정) | 7 | `AssertionError: expected 'decided' to be 'stalled' // Object.is equality` (`lib/phase.test.ts:31`) |
| 함수 부재 | 4 | `TypeError: isCandidateListLocked is not a function` (`lib/phase.test.ts:81`) |

RED 에서 **통과한 5건**은 "아직 건드리지 않았으니 참"인 항목이다 — 경계 4종(자정 직후·11:54:59·11:55:00·11:55:04)은 JS 가 잉여 인자를 무시해 옛 구현이 그대로 맞혔고, #9(자정 직전 + `hasResult=true`)는 옛 구현이 시각만 보고도 `decided` 를 돌려줬다. 이 5건이 통과한 것 자체가 "옛 계약과 새 계약이 겹치는 구간"의 지도다.

`npx tsc --noEmit` → **exit 2**. 계획이 지목한 두 코드가 정확히 나왔다:

```
lib/phase.test.ts(11,24): error TS2305: Module '"@/lib/phase"' has no exported member 'isCandidateListLocked'.
lib/phase.test.ts(15,59): error TS2554: Expected 0-1 arguments, but got 3.
```

`TS2305` **1건** + `TS2554` **12건**(3인자 호출 12자리 전부). `npm run lint` 는 이 시점에도 exit 0 이었다.

## GREEN: 소비처 9곳을 각각 어떻게 바꿨는가

| # | 위치 (전환 후 줄) | 전 | 후 |
|---|---|---|---|
| 1 | `components/MenuList.tsx:52` | `const readOnly = phase !== "accepting";` | `const readOnly = isCandidateListLocked(phase);` — `:13` 에 값 import 추가(`:11` 의 `import type { Phase }` 는 유지). **SPIN-03 직결 지점** |
| 2 | `components/TopBar.tsx:17-34` | IIFE + if-체인, fallback `{ label: "확정", dot: "done" }` | IIFE 형태를 유지한 채 내부를 `switch (phase)` 4분기 + `default` 의 `const exhaustive: never = phase;`(`:30`). `stalled` → `{ label: "추첨 대기", dot: "live" }`(`:25-26`) |
| 3 | `components/PhaseTimeline.tsx:18` | `STEPS.findIndex((s) => s.id === current)` → `-1` → `idx = 2`("결과" 활성) | `s.id === (current === "stalled" ? "accepting" : current)` — idx 0("모집"). `STEPS`(`:8-13`)는 4단계 무변경, `id: "stalled"` 0건 |
| 4 | `components/ResultBlock.tsx:107` | `if (phase === "decided" && !winner) {` | `if (phase === "stalled") {` — **블록 내용(`:108-122`)을 한 글자도 바꾸지 않고 조건만 옮겼다.** 옛 분기는 남기지 않았다(도달 불가 = 죽은 코드). `:13` 의 `spinTime = "11:55"` 기본 prop 무변경 |
| 5 | `app/page.tsx:45` (`phase` 계산) | `:28` `const phase = currentPhase(now);` (state 선언 **위**) | state 블록 아래로 내려 `currentPhase(now, DEFAULT_SPIN_TIME, todayResult !== null)`. `todayResult`(`:32`) 가 선언된 뒤라야 계산 가능하다 |
| 6 | `app/page.tsx:152-160` (`wheelPhase`) | `phase === "spinning" ? "spinning" : "idle"` (우연히 맞음) | 삼항은 그대로 두고 **주석으로 명시**: `WheelPhase` 는 별개 유니온이라 `stalled` 가 없고 `accepting`·`stalled` 둘 다 `"idle"` 이다. `components/Wheel.tsx` 무수정 |
| 7 | `app/page.tsx:307-321` (`StageHeader`) | 삼항 2단 × 2줄(`label`·`dot` 따로) | `const { label, dot } = ((): { label: string; dot: string } => { switch … })();` 4분기 + `never`(`:318`). `stalled` → `{ label: "추첨 대기중", dot: "live" }` |
| 8 | `app/page.tsx:358` (`phaseHeadline`) | fallback `"오늘의 점심"` | `if (phase === "stalled") return "아직 안 정해졌어요.";` 를 fallback 앞에 추가 |
| 9 | `app/page.tsx:368-369` (`phaseSubhead`) | fallback `""` | `` `추첨 시각이 지났지만 결과가 없어요. 현재 ${count}개의 후보가 올라가 있어요.` ``. `:364`·`:365` 의 하드코딩 `11:55` 문구는 **그대로 뒀다**(Phase 6 / SPIN-06) |

**`resolvedPhase` 제거:** `app/page.tsx:156` 의 `const resolvedPhase: Phase = todayResult ? "decided" : phase;` 가 사라지고 8자리(`:228, 229, 236, 249, 258, 263, 267, 286` → 전환 후 `:232, 233, 240, 253, 262, 267, 271, 290`)가 전부 `phase` 가 됐다. respin 버튼 조건은 `phase === "decided" && todayResult`(`:271`) — `hasResult` 가 `decided` 를 결정하므로 의미가 같다. `grep -c 'resolvedPhase' app/page.tsx` → 0.

**`switch` + `never` 가드 3곳:** `lib/phase.ts:47`(`isCandidateListLocked`) · `components/TopBar.tsx:30` · `app/page.tsx:318`(`StageHeader`). `grep -rn ': never' lib/phase.ts components/TopBar.tsx app/page.tsx | wc -l` → **3**.

**세 페이지의 `hasResult` 파생:**
- `app/page.tsx:45` — `todayResult !== null`
- `app/log/page.tsx:37` — `results.some((r) => r.date === todayKey)`. 한계를 `:33-36` 의 한글 Why 주석에 남겼다: *"다른 달을 보고 있으면 오늘 행이 로드 범위 밖이라 상단 뱃지가 부정확할 수 있다 — 이 페이지는 뱃지 외에 phase 를 쓰지 않아 기능 영향은 0이고, 오늘 결과를 따로 조회하는 것은 이 페이지를 다시 쓰는 뒤쪽 페이즈로 미룬다."*
- `app/rank/page.tsx:27` — `results.some((r) => r.date === todayKstDate(now))`. 랭킹은 전체 기간을 로드하므로 정확하다. `todayKstDate` 를 `:6` import 에 추가했다.

## Files Created/Modified

- `lib/time.ts` — `kstParts` 본체 37줄 삭제 → 재수출 3문장. `hour12: false` ×2 → `hourCycle: "h23"` ×2. 머리 주석에 "구현은 `_shared/kst` 한 곳, 여기는 얇은 재수출 + 포맷터" 를 명시. `KST_TZ`·`formatter`·`en-CA`·기본 인자 `now: Date = new Date()` 전부 무변경
- `lib/time.test.ts` — **`+2 / -0`**. `date: "2026-09-18",` 한 줄(`toEqual` 은 잉여 키를 거부한다) + 그 이유를 적은 머리 주석 한 줄. 단언 9개 무변경
- `lib/phase.ts` — 전면 재작성. 머리 주석의 "시간표 블록 + 빈 `//` 줄 + 제약 문장" 구조 유지, `11:55:06` → `11:55:05` 정정(IN-03), `stalled` 행 추가, 제약 문장에 "`hasResult` 인자가 그 사실을 시그니처에 박아 둔 것" 한 줄 추가. `SPIN_ANIM_SEC = 5` 유지, `SPIN_HH`/`SPIN_MM`·`msToNextPhase` 삭제
- `lib/phase.test.ts` — 6건 → 16건, 4 describe. 머리 주석 4요소(왜 존재하는가 / UTC 리터럴 / 경계 하나당 it 하나 / 일부러 안 하는 것 2가지)
- `app/page.tsx` — `+30 / -13`. import 1줄 추가, `phase` 계산 이동, `resolvedPhase` 제거, `StageHeader` switch 화, `stalled` 문구 2곳
- `app/log/page.tsx` · `app/rank/page.tsx` — import 추가 + `phase` 계산 이동·3인자화
- `components/MenuList.tsx` · `TopBar.tsx` · `PhaseTimeline.tsx` · `ResultBlock.tsx` — 위 표대로
- `.planning/todos/pending/in-03-04-phase-time-notes.md` — **삭제**(IN-03·IN-04 둘 다 이 플랜에서 닫혔다)
- `.planning/phases/03-pure-logic/03-VALIDATION.md` — `03-02-T1`~`T3` 행 7개 `⬜ pending` → `✅ green`, Wave 0 체크리스트의 `lib/time.test.ts` `date` 줄·`lib/phase.test.ts` 재작성 2건을 `[x]` 로. `status: draft`·`wave_0_complete: true` 는 지시대로 유지

## Decisions Made

- **헬퍼를 `lib/phase.ts` 에 뒀다.** PATTERNS 는 `components/MenuList.tsx` 의 `parseMenuInput` 을 "컴포넌트 파일의 순수 함수" 선례로 들었지만, 플랜의 지시대로 `lib/phase.ts` 에 뒀다. 유니온 정의와 잠금 규칙이 같은 파일에 있어야 `never` 가드가 상태 추가를 한 곳에서 막는다. `components/MenuList.test.ts` 는 건드리지 않았다(커밋 파일 9개 고정).
- **`isCandidateListLocked` 에서 `spinning` 과 `decided` 의 `return true` 를 한 `case` 로 합치지 않았다.** 폴스루로 묶으면 두 상태가 같은 이유로 잠긴다고 읽히는데, 실제로는 다른 이유다(애니메이션 중 / 확정됨). 분기를 나눠 두면 나중에 한쪽만 바꿀 때 diff 가 정확해진다.
- **`wheelPhase` 는 코드를 바꾸지 않고 주석만 더했다.** 삼항의 결과가 이미 `stalled → "idle"` 로 맞아서 코드를 고치면 동작 불변 약속만 위태로워진다. D-08 의 "명시"는 주석으로 충족했다.
- **세 페이지의 `DEFAULT_SPIN_TIME` import 는 의도된 임시 참조다.** 03-03 의 인수 조건이 `grep -rn 'DEFAULT_SPIN_TIME' app | wc -l` → 0 을 요구하므로 교체 대상이 기계적으로 특정된다.

## Deviations from Plan

코드는 계획대로 실행했고 **관측값 2건이 계획 문면과 달랐다**. 둘 다 계획 예측치의 문제이고 산출물에는 영향이 없다.

### 1. [Rule 1 — 관측 기록] RED 의 실패 형태가 "모듈 로드 실패" 가 아니었다

- **Found during:** Task 2
- **계획 문면:** *"이 RED 는 모듈 로드 실패 형태다 — `isCandidateListLocked` 가 `@/lib/phase` 에 아직 없어 named export 해석이 실패한다."*
- **실측:** 16건이 정상 수집되고 `Tests 11 failed | 5 passed (16)`. 4건은 `TypeError: isCandidateListLocked is not a function`, 7건은 값 불일치(`expected 'decided' to be 'stalled'`). vitest 는 esbuild 트랜스파일 ESM 에서 없는 named export 를 로드 시점에 끊지 않는다.
- **판단:** RED 의 **본질**(구현 없이 실패한다 + 그 이유가 "함수가 없다"와 "판정이 다르다")은 성립하고, 플랜이 요구한 게이트(`exit 1` · `TS2305` · `TS2554`)는 전부 충족했다. spec·구현 어느 쪽도 고치지 않았다.
- **다음에 쓸 사람에게:** `lib/**` 의 "함수가 아직 없다" RED 는 03-01 의 `_shared` 케이스(`Cannot find module` → `(0 test)`)와 형태가 다르다. 전자는 **단언 실패**, 후자는 **수집 실패**다. RED 판정을 `Failed Suites` 로 하면 전자를 놓친다.

### 2. [게이트 문면 정정] 전체 테스트 건수는 161 이 아니라 **155** 다

- **Found during:** Task 3
- **오케스트레이터 문면:** *"expected 9 files / 161 tests = 145 − 6 old phase + 16 new phase + 0 time"*
- **실측:** `Test Files 9 passed (9)` · `Tests 155 passed (155)`. 문면에 적힌 산식 자체(145 − 6 + 16)가 **155** 를 준다 — 161 은 산술 오기다.
- **판단:** 플랜(`03-02-PLAN.md`) 본문의 인수 조건은 파일 수 9만 요구하고 건수를 고정하지 않으므로 위반이 아니다. 측정값 155 를 기록한다.

---

**Total deviations:** 2 (관측 기록 1 + 게이트 산술 정정 1, 코드 무변경)
**Impact on plan:** 산출물·커밋·동작에 영향 없음.

## 이 플랜이 **하지 않은** 것 (경계 확인)

- `components/Wheel.tsx` 무수정 (`git show --name-only HEAD | grep -c 'Wheel.tsx'` → 0). `WheelPhase` 는 별개 유니온이라 `Phase` 확장의 영향을 받지 않는다.
- `PhaseTimeline` 의 `STEPS` 에 `"stalled"` 단계를 추가하지 않았다(`grep -c 'id: "stalled"'` → 0).
- 화면 문구의 하드코딩 `11:55` 를 제거하지 않았다 — `app/page.tsx:364`·`:365`, `components/ResultBlock.tsx:13` 그대로. Phase 6 / SPIN-06 소관.
- `settings` 를 읽지 않았다. `useSettings` 를 만들지 않았다(03-03).
- `app/page.tsx` 의 `actionError` 배너와 `setLoadError(joinLoadErrors([...]))` 블록 무변경.
- `npm run dev` 미실행. 배포·마이그레이션 적용·원격 SQL·`git push` **0건**. `npm install` **0건**. `main` 무변경.
- `vitest.config.mts`·`tsconfig.json`·`eslint.config.mjs` 무변경.

## 검증 결과 (최종 게이트)

| 명령 | 결과 |
|---|---|
| `npx vitest run lib/phase.test.ts` | exit 0 — `Tests 16 passed (16)` |
| `npx vitest run lib/time.test.ts` | exit 0 — `Tests 13 passed (13)` |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0, 신규 에러 0건 |
| `npm test` | exit 0 — `Test Files 9 passed (9)` · `Tests 155 passed (155)` |
| `npm run build` | exit 0 — `Compiled successfully in 581ms` |
| `grep -rn 'hour12' lib \| wc -l` | 0 |
| `grep -c '11:55:06' lib/phase.ts` / `'11:55:05'` | 0 / 1 |
| `grep -rn 'msToNextPhase' lib app components --include='*.ts' --include='*.tsx' \| grep -v '\.test\.' \| wc -l` | 0 (spec 머리 주석의 1건은 의도된 잔존) |
| `grep -c 'resolvedPhase' app/page.tsx` | 0 |
| `grep -rn ': never' lib/phase.ts components/TopBar.tsx app/page.tsx \| wc -l` | 3 |
| `grep -rn 'currentPhase(now,' app \| wc -l` / `'currentPhase(now)'` | 3 / 0 |
| `grep -c 'phase === "decided" && !winner' components/ResultBlock.tsx` | 0 |
| `test -f .planning/todos/pending/in-03-04-phase-time-notes.md` | exit 1 (삭제됨) |
| `git show --name-only --format= HEAD \| wc -l` | 9 |
| 커밋에 `.serena/project.yml`·`.planning/config.json` 포함 | 0건 |
| `git log 68eedb8..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | 0 |

## Next Phase Readiness

**03-03 이 바로 쓸 수 있는 것 — `lib/` 에서 export 되는 이름 전량:**

| 모듈 | export |
|---|---|
| `lib/phase.ts` | `type Phase`("accepting" \| "spinning" \| "decided" \| "stalled") · `currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean): Phase` · `isCandidateListLocked(phase: Phase): boolean` — `SPIN_ANIM_SEC` 은 모듈 내부(비-export) |
| `lib/time.ts` | `kstParts`(재수출) · `type KstParts`(재수출) · `todayKstDate` · `formatHhMm` · `formatHhMmSs` · `formatKstLongDay` — 포맷터 4개는 모두 `now: Date = new Date()` 기본 인자 유지 |

**03-03 이 교체해야 할 임시 참조 — `DEFAULT_SPIN_TIME` import 3자리:**

| 파일 | import 줄 | 사용 줄 |
|---|---|---|
| `app/page.tsx` | `:11` | `:45` `currentPhase(now, DEFAULT_SPIN_TIME, todayResult !== null)` |
| `app/log/page.tsx` | `:10` | `:37` `currentPhase(now, DEFAULT_SPIN_TIME, results.some((r) => r.date === todayKey))` |
| `app/rank/page.tsx` | `:10` | `:27` `currentPhase(now, DEFAULT_SPIN_TIME, results.some((r) => r.date === todayKstDate(now)))` |

세 자리 모두 import 줄에 "settings 주입은 다음 플랜" 이라는 한글 주석이 붙어 있어 `grep -rn 'DEFAULT_SPIN_TIME' app` 이 정확히 6줄(import 3 + 호출 3)을 준다. 03-03 의 인수 조건(`= 0`)을 만족시키려면 주석 줄도 함께 정리해야 한다.

**주의:**
- `lib/phase.ts` 가 `@/supabase/functions/_shared/spinTime` 을 **확장자 없이** 가져온다. `.ts` 를 붙이면 `TS5097` 로 `tsc`·`build` 가 동시에 끊긴다.
- QUAL-02 는 아직 닫히지 않았다 — 03-03 의 문서 정정(D-16: CLAUDE.md 의 "11:55 네 곳"·"kstNow 복붙" 문단, CONVENTIONS.md:144 의 기본 인자 규칙)까지 가야 한다. SPIN-03 도 `stalled` 문구·배너 합류를 03-03 이 마무리한다. 그래서 이 플랜은 `requirements-completed` 를 비워 뒀다.
- `lib/phase.test.ts` 머리 주석의 `msToNextPhase` 1건은 "안 하기로 한 것" 기록이라 의도적으로 남아 있다. 구현 코드 기준 grep 은 `grep -v '\.test\.'` 로 범위를 좁혀야 0 이 나온다(03-01 의 grep 범위 교훈과 같은 형태).

## Self-Check: PASSED

- 수정 파일 11개 전부 존재 확인 (`lib/time.ts`·`lib/time.test.ts`·`lib/phase.ts`·`lib/phase.test.ts`·`app/page.tsx`·`app/log/page.tsx`·`app/rank/page.tsx`·`components/MenuList.tsx`·`TopBar.tsx`·`PhaseTimeline.tsx`·`ResultBlock.tsx`)
- 삭제 파일 1개 부재 확인 (`.planning/todos/pending/in-03-04-phase-time-notes.md` → `test -f` exit 1)
- 커밋 3개 전부 `git log` 에서 확인: `69ee9bc`·`6b5ff03`·`0a71b10`

---
*Phase: 03-pure-logic*
*Completed: 2026-09-21*
