---
phase: 03-pure-logic
plan: 03
subsystem: frontend
tags: [settings, reducer, realtime, hook, error-banner, docs, sett-02, sett-03, qual-02]

# Dependency graph
requires:
  - phase: 03-01
    provides: "supabase/functions/_shared/spinTime.ts — DEFAULT_SPIN_TIME·DEFAULT_SPIN_TIME_TEXT·parseSpinTime(총 함수). lib/settings.ts 가 확장자 없이 @/ 별칭으로 가져다 쓴다"
  - phase: 03-02
    provides: "currentPhase(now, spinTime, hasResult) 3인자 시그니처와 세 페이지의 DEFAULT_SPIN_TIME 임시 참조 6줄 — 이 플랜이 교체한 자리"
  - phase: 02-02
    provides: "lib/supabase/client.ts SettingsRow(:52-57) 와 public.settings 스키마(0005). 이 페이즈는 둘 다 건드리지 않는다"
provides:
  - "lib/settings.ts — Settings·DEFAULT_SETTINGS·SettingsState(4필드)·SettingsAction·settingsFromRow·settingsReducer. 값 import 0개의 순수 모듈"
  - "lib/useSettings.ts — 레포 첫 공용 훅(lib/useX.ts). SELECT 1회 + settings-changes 구독 1개 + removeChannel, 쓰기 경로 0건"
  - "세 페이지가 settings.spinTime 을 currentPhase 에 주입하고 설정 실패/경고를 읽기 배너에 합류시키는 형태"
  - "CLAUDE.md·CONVENTIONS.md 현행화 — Phase 3 이 낡게 만든 진술 15건 정정 + 훅 컨벤션 1건 추가"
affects: [04-server-spin, 06-ui-copy, 07-log-rank, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "I/O 훅 + 순수 리듀서 분리: 훅에는 분기를 두지 않는다 — 레포에 React 렌더 하네스가 없어 훅 안의 분기는 영원히 테스트되지 않는다"
    - "에러 채널 2개: 로드 실패(error, formatLoadError 접두 O)와 파싱 경고(warning, 접두 X)를 다른 필드로 갈라 joinLoadErrors 배열 3원소로 합친다"
    - "Realtime payload 는 얕은 병합하지 않는다 — payload.new 가 전체 행이라 통째 교체하고, DELETE 는 payload.old 가 PK 만이라 기본값 복귀가 유일한 처리다"
    - "게이트용 토큰(maybeSingle)을 주석 문안에서 뺀다 — 주석이 자기 자신을 세면 파일 전체 grep 게이트가 무력화된다"

key-files:
  created:
    - lib/settings.ts
    - lib/settings.test.ts
    - lib/useSettings.ts
  modified:
    - app/page.tsx
    - app/log/page.tsx
    - app/rank/page.tsx
    - CLAUDE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/phases/03-pure-logic/03-VALIDATION.md

key-decisions:
  - "warning 문안의 기본 시각을 리터럴 '11:55' 가 아니라 DEFAULT_SPIN_TIME_TEXT 로 조립했다 — 같은 커밋 묶음에서 CLAUDE.md 에 '코드상 정의처는 _shared/spinTime.ts 한 곳' 이라고 쓰면서 새 하드코딩을 만들면 그 문장이 즉시 거짓이 된다"
  - "settingsReducer 는 이전 state 를 읽지 않는다 — 리듀서 표의 5행이 전부 action 만으로 결정되고, 얕은 병합을 쓰지 않겠다는 계약이 '이전 값을 참조할 자리가 없다' 로 코드에 드러난다"
  - "훅 머리 주석에서 maybeSingle 이라는 토큰을 빼고 '아래 단일행 조회' 로 바꿨다 — 인수 조건이 파일 전체에서 호출 1건을 세는 형태라 주석이 게이트를 무력화한다(Phase 3 의 기존 결정 재적용)"
  - "spec #16 을 'INITIAL 에서 failed' 가 아니라 '경고가 있던 state 에서 failed' 로 썼다 — 전자는 #15 의 부분집합이라 회귀를 잡지 못한다"
  - "requirements 마킹은 SETT-02·SETT-03·SPIN-03·QUAL-02 4건만 했다. SPIN-02(쿨다운)는 _shared/cooldown.ts 가 존재하고 10건으로 덮였지만 호출처가 0곳이라 Phase 4 몫으로 남겼다"

requirements-completed: [SETT-02, SETT-03, SPIN-03, QUAL-02]

# Metrics
duration: 10min
completed: 2026-09-21
---

# Phase 3 Plan 03: 설정 리듀서 + 읽기 전용 구독 훅 Summary

**`settings` 단일행을 앱에 공급하는 두 조각을 만들었다 — 판단이 전부 들어 있는 순수 모듈 `lib/settings.ts`(도메인 타입 · 기본값 · `settingsFromRow` · 리듀서, supabase 값 import 0개)와 I/O 만 하는 훅 `lib/useSettings.ts`(SELECT 1회 + `settings-changes` 구독 1개 + cleanup, 쓰기 호출 0건). 세 페이지가 `currentPhase(now, settings.spinTime, …)` 로 설정 시각을 받고, 설정 로드 실패는 라벨 "설정"으로, `spin_time` 파싱 경고는 접두 없이 읽기 배너에 합류한다. 마지막으로 Phase 3 이 낡게 만든 문서 진술을 같은 페이즈에서 정정했다(D-16).**

## Performance

- **Duration:** 10min
- **Started:** 2026-09-21T04:57:42Z
- **Completed:** 2026-09-21T05:08:00Z
- **Tasks:** 4
- **Files:** 3 created + 6 modified

## Accomplishments

- `settings` 가 없어도·못 읽어도·파싱이 깨져도 앱이 11:55 · 쿨다운 0 으로 계속 도는 경로가 spec 24건으로 고정됐다(SETT-03). `settingsFromRow` 는 어떤 입력에도 값을 돌려주는 총 함수이고 파싱 실패를 `warning` 으로 **반환**한다 — 삼키지도 않고 앱을 멈추지도 않는다.
- `maybeSingle` 의 **0행(시드 안 됨)** 과 **테이블 부재(PGRST205)** 가 서로 다른 action 으로 갈렸다. `error` 를 먼저 보고 `failed`, 아니면 `loaded(data ?? null)` — 0행에서는 배너가 뜨지 않고, 테이블이 없으면 반드시 뜬다.
- 대시보드 편집이 새로고침 없이 반영된다(SETT-02). `settings-changes` 채널의 `*` 이벤트가 리듀서로 들어가 `payload.new` 를 **통째 교체**하고, `DELETE` 는 기본값 복귀다.
- `error`(로드 실패)와 `warning`(파싱 경고)이 **다른 필드**로 갈렸다 — 로드가 성공했는데 `spin_time` 만 이상한 경우에 `설정 불러오기 실패:` 접두가 붙는 거짓말을 막는다(W-10). spec #16·#17·#21 이 이 분리를 고정한다.
- 03-02 의 임시 참조가 전부 사라졌다: `grep -rn 'DEFAULT_SPIN_TIME' app | wc -l` → **0**(import 3 + 호출 3 + 주석 3줄 제거).
- 테스트 9파일 155건 → **10파일 179건**(`lib/settings.test.ts` 24건). 오케스트레이터 예측치 179와 정확히 일치.
- D-16 문서 현행화가 코드와 **같은 페이즈**에서 끝났다 — CLAUDE.md 7건 정정 + 1건 추가, CONVENTIONS.md 8줄 정정.

## Task Commits

1. **Task 1 (RED): `lib/settings.test.ts` 24건** — `ab5f4bb` (test)
2. **Task 2 (GREEN 1/2): `lib/settings.ts` 순수 모듈** — `da3503c` (feat)
3. **Task 3 (GREEN 2/2): `lib/useSettings.ts` + 세 페이지 배선** — `4631d92` (feat)
4. **Task 4: D-16 문서 정정 + VALIDATION 갱신** — `8a520e5` (docs)

**REFACTOR 커밋 없음** — GREEN 후 정리할 것이 없었고 빈 커밋은 금지다.

## TDD Gate Compliance

`test(03-03)` → `feat(03-03)` → `feat(03-03)` → `docs(03-03)`. RED 가 첫 GREEN 보다 먼저이고 `git log --oneline` 으로 순서가 확인된다. 게이트 3종(RED 존재 · GREEN 존재 · 순서) 성립.

### RED 에서 무엇이 왜 실패했는가

`npx vitest run lib/settings.test.ts` → **exit 1**, `Test Files 1 failed (1)` / `Tests no tests`. 이번 RED 는 계획 예측대로 **모듈 로드 실패** 형태였다(03-02 의 "단언 실패" 형태와 다르다 — 그쪽은 모듈이 존재하고 export 만 없었다):

```
FAIL  lib/settings.test.ts [ lib/settings.test.ts ]
Error: Cannot find package '@/lib/settings' imported from /…/lib/settings.test.ts
 ❯ lib/settings.test.ts:13:1
```

`npx tsc --noEmit` → `TS2307` **1건**(계획이 지목한 그 코드, 그 건수):

```
lib/settings.test.ts(18,8): error TS2307: Cannot find module '@/lib/settings' or its corresponding type declarations.
```

`npm run lint` 는 이 시점에도 exit 0. `git diff --stat -- package.json package-lock.json` 0줄(신규 패키지 0개).

## GREEN: 리듀서 경로를 어떻게 닫았는가

**로드 경로 5건 + Realtime 병합 7건 + `settingsFromRow` 8건 + 기본값 4건 = 24건.** 리듀서 표 5행이 전부 `action` 만으로 결정되므로 `settingsReducer` 는 이전 `state` 를 한 번도 읽지 않는다 — "얕은 병합을 쓰지 않는다" 는 계약이 "이전 값을 참조할 자리가 없다" 로 코드에 드러난다.

| action | settings | loaded | error | warning | 고정한 it |
|---|---|---|---|---|---|
| `loaded(row)` | `settingsFromRow(row).settings` | `true` | `null` | 파싱 경고 | #13, #17 |
| `loaded(null)` | `DEFAULT_SETTINGS` | `true` | `null` | `null` | #14 |
| `failed(msg)` | `DEFAULT_SETTINGS` | `true` | `msg` | `null` | #15, #16 |
| `changed(INSERT\|UPDATE, row)` | 통째 교체 | `true` | `null` | 파싱 경고 | #18~#21 |
| `changed(DELETE, null)` | `DEFAULT_SETTINGS` | `true` | `null` | `null` | #22, #23 |

`error`/`warning` 분리를 지키는 것은 #16(경고가 있던 state 에 `failed` 가 와도 경고가 `error` 채널로 새지 않는다) · #17(잘못된 행을 읽으면 `warning` 만 차고 `error` 는 `null`) · #21(정상 행이 오면 경고가 지워진다) 세 건이다.

## `useSettings` 낭독 체크리스트 (자동 검증 사각지대 — §Q7)

React 렌더 하네스를 도입하지 않기로 한 결정(D-11 / §Q7) 때문에 훅 본문은 낭독으로 검증한다. 5항목 전부 **파일:줄 인용**:

| # | 항목 | 확인 위치 | 판정 |
|---|---|---|---|
| 0 | 훅 반환이 `{ settings, loaded, error, warning }` 4필드인가 | `lib/useSettings.ts:21` `useSettings(): SettingsState` · `:59` `return state;` — 리듀서 상태를 타입 그대로 돌려준다. 세 페이지가 `settings`·`error`·`warning` 셋을 구조 분해한다(`app/page.tsx:44`, `app/log/page.tsx:34`, `app/rank/page.tsx:26`) | ✅ |
| 1 | `error` → `failed` / `data ?? null` → `loaded` 가 **그 순서**인가 | `lib/useSettings.ts:29` `if (error) dispatch({ type: "failed", … })` → `:30` `else dispatch({ type: "loaded", row: (data as SettingsRow \| null) ?? null })`. 0행(`data: null, error: null`)은 `loaded(null)` 로 떨어져 배너를 띄우지 않는다 | ✅ |
| 2 | 배너 배열이 `[loadError, formatLoadError("설정", …), settingsWarning]` **3원소**인가 (경고에 접두가 붙지 않는가) | `app/page.tsx:240-244` · `app/log/page.tsx:104-108` · `app/rank/page.tsx:75-79`. 세 번째 원소는 `formatLoadError` 를 거치지 않고 완성 문장 그대로 통과한다 | ✅ |
| 3 | 채널명이 `settings-changes` 이고 기존 3채널과 분리돼 있는가 | `lib/useSettings.ts:39` `.channel("settings-changes")`. `grep -rn 'settings-changes' app` → 0줄. `app/page.tsx` 의 `lunch-realtime` 은 1건 그대로(바인딩 추가 0) | ✅ |
| 4 | cleanup 에 `removeChannel`, SELECT effect 에 `cancelled` 가 있는가 | `lib/useSettings.ts:55` `supabase.removeChannel(ch);` · `:25` `let cancelled = false` → `:28` `if (cancelled) return;` → `:33` `cancelled = true` | ✅ |
| 5 | `settings` 쓰기 호출이 0건인가 | `grep -cE '\.(insert\|update\|delete\|upsert)\(' lib/useSettings.ts` → **0**. 훅에 있는 supabase 호출은 `select`(`:27`)와 `channel`/`subscribe`(`:39,:53`)뿐이다 (V4 / T-03-14) | ✅ |

## 세 페이지 배선 (파일:줄)

| 페이지 | 훅 호출 | `currentPhase` 주입 | 배너 합류 | `ErrorBanner` |
|---|---|---|---|---|
| `app/page.tsx` | `:44` | `:47` `currentPhase(now, settings.spinTime, todayResult !== null)` | `:240-244` `loadBanner` | `:267` (`:268` `actionError` 배너는 **무변경**) |
| `app/log/page.tsx` | `:34` | `:39` | `:104-108` | `:115` |
| `app/rank/page.tsx` | `:26` | `:29` | `:75-79` | `:85` |

- `app/page.tsx:60-66` 의 `setLoadError(joinLoadErrors([...]))` 3줄 배열(페이지 쿼리 3개용)은 **건드리지 않았다.** 설정 줄은 렌더 파생값(`loadBanner`)으로만 합쳤다.
- `app/log`·`app/rank` 는 `formatLoadError` 단독에서 `joinLoadErrors` 로 승격됐다(각각 import + 호출 2건).
- 설정 에러·경고는 훅이 소유하므로 닫기 버튼(`setLoadError(null)`)으로 사라지지 않는다는 사실을 세 페이지의 한글 Why 주석에 남겼다.

## 컷오버 전 "설정 불러오기 실패" 배너는 정상이다 (D-18)

라이브에 `settings` 테이블이 없으므로(적용은 Phase 8) 최초 SELECT 는 `PGRST205`/404 로 실패하고, 배너에 `설정 불러오기 실패: Could not find the table 'public.settings' in the schema cache` 가 **항상 떠 있는 것이 정상**이다. `settings` 가 `supabase_realtime` publication 에도 없어 구독은 5~10초마다 재시도하지만 채널은 닫히지 않고 다른 채널에 영향도 없다. 기본값(11:55 · 쿨다운 0)으로 앱이 계속 동작하는 것이 SETT-03 의 합격선이다.

**역방향 신호:** 컷오버 전에 이 배너가 **안 뜨면** 에러를 삼키고 있는 것이다(T-03-18). 이 문장을 `lib/useSettings.ts:11-13` 머리 주석에 남겼다.

## D-16 문서 정정 (코드와 같은 페이즈에서)

**CLAUDE.md — 7건 정정 + 1건 추가**

| 대상 | 정정 후 |
|---|---|
| 엔트리포인트(`:12-13`) | `lib/phase.ts` 설명에 `stalled` 추가 + `lib/settings.ts`·`lib/useSettings.ts`·`supabase/functions/_shared/` 항목 신설 |
| vitest 수집 대상(`:27`) | `supabase/migrations/**` 누락 보완(Phase 2) + `_shared`·`migrations` 에 실제 파일이 생겼다는 사실 |
| 코드 컨벤션(추가) | **공용 훅은 `lib/useX.ts`, `use` 접두** — 훅에는 I/O 만, 판단은 같은 도메인의 순수 모듈로 |
| Edge Function 검사(`:38`) | 제외는 함수 디렉터리 2개뿐이고 `_shared/**` 는 tsc·eslint·vitest 3중 검사. 두 `index.ts` 만 사각지대 |
| `supabase/functions/` 제외(`:43`) | 함수 2개만 제외 + OOM 근거는 `design/` 쪽이라는 구분. "다시 넓히지 말 것" |
| 추첨 시각 중복(`:44`) | "네 곳에 흩어져 있다" → **코드상 정의처는 `_shared/spinTime.ts` 한 곳**, 런타임은 `settings.spin_time` 이 이김. 남은 중복은 UI 문구(Phase 6) + DB 기본값 |
| `kstNow` 복붙(`:45`) | `_shared/kst.ts` 단일 정의. Deno 는 `../_shared/kst.ts`, 클라이언트는 확장자 없이 같은 파일을 본다 |
| 미사용 코드(`:63`) | `msToNextPhase` 제거(03-02 가 삭제함). `Wheel onSpinCompleteAction` 은 남긴다 |

**CONVENTIONS.md — 8줄 정정**: `:13`(훅 파일명 예외 신설) · `:25`(`SPIN_HH`/`SPIN_MM` → `DEFAULT_SPIN_TIME`·`DEFAULT_SETTINGS`) · `:34`(`Phase` 에 `stalled`) · `:50`(eslint 제외 범위 + 근거 분리) · `:54`(tsconfig 제외 범위) · `:70`(상대 경로 예외 3종) · `:144`(기본 인자 규칙 — `currentPhase`·`kstParts` 예외 2곳) · `:147`(11:55 중복 → 정의처 1곳 + 남은 2갈래).

**Phase 8 SHIP-03 에 남긴 것:** `README.md` 전체(배포·pg_cron 정본, 이 태스크는 무변경 확인만 했다) · 배포 체크리스트 · 롤백 절차. 추가로 발견한 항목 하나 — `CONVENTIONS.md` 의 Data Access 절("채널 이름은 페이지마다 고유: `lunch-realtime`, `log-results`, `rank-results`")은 이제 훅이 소유한 4번째 채널(`settings-changes`)이 생겨 불완전하다. D-16 의 8줄 목록에 없어 이번에 고치지 않았다(정정 건수를 문면대로 유지).

## 검증 결과 (페이즈 게이트 5종)

| 명령 | 결과 |
|---|---|
| `npx vitest run lib/settings.test.ts` | exit 0 — `Tests 24 passed (24)` |
| `npm test` | exit 0 — `Test Files 10 passed (10)` · `Tests 179 passed (179)` |
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0, 신규 에러 0건 |
| `npm run build` | exit 0 — `Compiled successfully in 455ms` |
| `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| `grep -rn 'DEFAULT_SPIN_TIME' app \| wc -l` | 0 |
| `grep -rn 'useSettings()' app \| wc -l` | 3 |
| `grep -rn 'currentPhase(now, settings.spinTime' app \| wc -l` | 3 |
| `grep -rn 'formatLoadError("설정"' app \| wc -l` | 3 |
| `grep -rn 'settingsWarning' app \| wc -l` | 6 |
| `grep -rn 'settings-changes' app \| wc -l` | 0 |
| `grep -c '^import type { SettingsRow }' lib/settings.ts` | 1 (인라인 modifier 형태는 0) |
| `grep -c '^[^/]*\bthrow\b' lib/settings.ts` | 0 |
| `grep -c ': never' lib/settings.ts` | 1 |
| `grep -c 'actionError' app/page.tsx` / `'lunch-realtime'` | 3 / 1 (Phase 1 배너·채널 무변경) |
| `git diff --stat 68eedb8 -- README.md components/Wheel.tsx lib/supabase/client.ts vitest.config.mts package.json package-lock.json` | 출력 0줄 |
| `git log 68eedb8..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | 0 (페이즈 전체 14커밋) |

## Deviations from Plan

코드는 계획대로 실행했고 **문면 충돌 2건 + 관측 기록 1건**이 있었다. 셋 다 산출물 계약에는 영향이 없다.

### 1. [Rule 3 — 인수 조건 상호 충돌] 게이트 토큰을 주석 문안에서 뺐다 (2곳)

- **Found during:** Task 1, Task 3
- **충돌 A (Task 1):** `<read_first>` 는 spec 머리 주석 4번째 줄에 *"jsdom·testing-library 3개를 들이는 비용"* 이라고 쓰라고 했는데, 같은 태스크의 인수 조건은 `grep -c 'testing-library\|jsdom' lib/settings.test.ts` → **0** 을 요구한다. 둘을 동시에 만족할 수 없다.
- **충돌 B (Task 3):** 머리 주석 지시 ②는 *"`maybeSingle` 의 0행은 에러가 아니다"* 를 적으라고 했는데, 인수 조건은 `grep -c 'maybeSingle' lib/useSettings.ts` → **1**(호출 1건)이다. 주석에 토큰을 쓰면 2가 된다(실측으로 2를 확인한 뒤 고쳤다).
- **판단:** 두 게이트의 **의도**는 "패키지를 들이지 않았다"·"단일행 조회가 한 자리뿐이다" 이고, 둘 다 주석을 세는 것이 목적이 아니다. Phase 3 이 이미 내린 결정(*"게이트용 금지 토큰을 소스 주석에 쓰지 않는다 — 주석이 자기 자신을 세면 게이트가 무력화된다"*, STATE.md Decisions)을 그대로 적용해 **주석의 뜻은 유지하고 토큰만 바꿨다**: `lib/settings.test.ts:9-10` *"렌더 하네스(DOM 구현 + 렌더 테스트 라이브러리) 3개를 들이는 비용 대비 훅 본문에 분기가 0이다"*, `lib/useSettings.ts:6` *"아래 단일행 조회의 0행은 에러가 아니다"*.
- **결과:** 두 게이트 모두 요구값 그대로 통과(0 · 1). 실제 패키지 가드(`git diff --stat -- package.json package-lock.json` 0줄)도 통과.

### 2. [Rule 2 — 새 거짓 방지] warning 문안의 "11:55" 를 상수에서 조립했다

- **Found during:** Task 2
- **계획 문면:** warning 예시가 `… 기본값 11:55 로 동작해요` 리터럴이다.
- **실제:** `lib/settings.ts:67-69` 에서 `${DEFAULT_SPIN_TIME_TEXT}` 로 조립했다(출력 문자열은 동일). import 는 같은 한 줄(`@/supabase/functions/_shared/spinTime`)이라 `grep -c` = 1 그대로다.
- **이유:** 같은 플랜의 Task 4 가 CLAUDE.md 에 *"추첨 시각의 코드상 정의처는 `_shared/spinTime.ts` 한 곳"* 이라고 쓴다. 여기서 리터럴을 새로 박으면 그 문장이 커밋 시점에 이미 거짓이 되고, 플랜이 금지한 *"낡은 진술을 새 거짓으로 바꾸지 않는다"* 에 걸린다. 화면 하드코딩 `11:55`(Phase 6 / SPIN-06)는 계획대로 하나도 건드리지 않았다.

### 3. [측정값 기록] `grep -c '⬜ pending' 03-VALIDATION.md` 는 0 이 아니라 **1** 이다

- **Found during:** Task 4
- **실측:** 1. 남은 1건은 표 아래 **범례 줄**(`:76` `*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*`)이고 상태 행이 아니다. 행 기준으로 좁히면 `grep -c '^|.*⬜ pending'` → **0**, `grep -c '^| 03-.*✅ green'` → **23**(전 행 green).
- **판단:** 범례를 지우면 기호 정의가 사라져 문서가 손상되므로 고치지 않고 측정값을 기록한다. 게이트의 의도("모든 행이 판정됐다")는 행 기준 grep 으로 충족된다. `red` 판정 행은 0건이라 표 아래 사유 줄은 추가하지 않았다.

---

**Total deviations:** 3 (인수 조건 충돌 해소 1 + 새 거짓 방지 1 + 측정값 기록 1)
**Impact on plan:** 공개 계약·커밋 구성·동작에 영향 없음.

## 요구사항 마킹 (실제로 찍은 ID)

`SETT-02` · `SETT-03` · `SPIN-03` · `QUAL-02` **4건**을 `REQUIREMENTS.md` 체크박스와 추적 표 양쪽에서 Complete 로 바꿨다.

- **SETT-02 / SETT-03** — 이 플랜이 직접 닫았다(frontmatter `requirements`).
- **SPIN-03** — 03-02 가 `isCandidateListLocked("stalled") === false` 로 UI 잠금을 풀었고, 이 플랜이 `stalled` 문구·배너 합류를 마무리했다. 03-02 SUMMARY 가 *"SPIN-03 도 03-03 이 마무리한다"* 로 넘긴 항목이다.
- **QUAL-02** — `_shared` 3모듈 + `kstNow` 단일화는 03-01 이 했지만, 03-02 SUMMARY 가 *"QUAL-02 는 D-16 문서 정정까지 가야 닫힌다"* 로 남겼고 그 정정이 이 플랜의 Task 4 다.
- **마킹하지 않은 것 — `SPIN-02`(쿨다운).** 추적 표상 Phase 3 소속이고 `_shared/cooldown.ts` + spec 10건이 이미 초록이지만, **호출처가 0곳**이다(Edge Function 본문은 Phase 4 가 다시 쓴다). "제외 후 후보가 비면 전체 폴백" 이라는 요구사항 문면이 런타임에서 관측되지 않으므로 Pending 으로 뒀다. **오케스트레이터/검증자 판단 필요 지점.**

레포 규칙대로 *"페이즈 안에서 검증을 닫는 플랜 하나만 찍는다"* 를 따랐다(Phase 2 선례).

## 이 플랜이 **하지 않은** 것 (경계 확인)

- `settings` 에 쓰는 코드를 만들지 않았다 — 앱 계층 쓰기 경로 0건(SETT-01 의 앱 쪽 통제).
- `lunch-realtime` 채널에 바인딩을 추가하지 않았다. `app/page.tsx` 의 `actionError` 배너와 `setLoadError(joinLoadErrors([...]))` 블록 무변경.
- 화면 문구의 하드코딩 `11:55` 제거 0건 — `app/page.tsx` `phaseSubhead`, `components/ResultBlock.tsx:13`, `Wheel`, `PhaseTimeline` 그대로(Phase 6 / SPIN-06).
- `history_since` 로 집계를 자르지 않았다(Phase 7 / HIST-01·02). 훅은 값을 도메인에 실어 나르기만 한다.
- Edge Function 본문 무변경 — 여전히 `menus` 를 읽는다(Phase 4).
- `lib/supabase/client.ts`·`components/Wheel.tsx`·`vitest.config.mts`·`README.md`·`package.json` 무변경(diff 0줄).
- `npm run dev` 미실행. 배포·마이그레이션 적용·원격 SQL·`git push` **0건**. `npm install` **0건**. `main` 무변경.
- jsdom·`@testing-library/react` 미설치 — `useSettings` 단위 테스트 0건(대신 낭독 5항목).

## Next Phase Readiness

**Phase 4(서버 추첨)가 바로 쓸 수 있는 것:**

| 모듈 | export |
|---|---|
| `lib/settings.ts` | `type Settings` · `DEFAULT_SETTINGS` · `type SettingsState` · `INITIAL_SETTINGS_STATE` · `type SettingsAction` · `settingsFromRow` · `settingsReducer` |
| `lib/useSettings.ts` | `useSettings(): SettingsState` — 세 페이지가 이미 쓰고 있다 |
| `supabase/functions/_shared/` | `kst.ts`(`kstNow`·`kstParts`) · `spinTime.ts`(`parseSpinTime`·`isAfterSpinTime`·`DEFAULT_SPIN_TIME`) · `cooldown.ts`(`applyCooldown`) — Edge Function 이 `../_shared/*.ts` 로 가져다 쓴다 |

**주의:**
- `settings.historySince` 는 `string | null` 이다. `null` 은 "전환일 미확정"(로드 전·행 삭제 후)이고 Phase 7 은 이 상태에서 집계를 자르면 안 된다.
- `settings.cooldownDays` 는 읽는 쪽에서 이미 `>= 0` 으로 좁혀져 있다(`Number.isFinite` + 양수 체크). Edge Function 쪽은 DB 값을 직접 읽으므로 같은 방어를 따로 해야 한다.
- 컷오버 전 개발 중 배너 1건(`설정 불러오기 실패: Could not find the table 'public.settings' …`)은 정상이다. Phase 8 이 `0005` 를 적용하면 사라진다.

## Self-Check: PASSED

- 생성 파일 3개 존재 확인: `lib/settings.ts`(99줄) · `lib/settings.test.ts`(170줄) · `lib/useSettings.ts`(60줄)
- 수정 파일 6개 존재 확인: `app/page.tsx` · `app/log/page.tsx` · `app/rank/page.tsx` · `CLAUDE.md` · `.planning/codebase/CONVENTIONS.md` · `.planning/phases/03-pure-logic/03-VALIDATION.md`
- 커밋 4개 전부 `git log` 에서 확인: `ab5f4bb` · `da3503c` · `4631d92` · `8a520e5`
- 커밋에 `.serena/project.yml`·`.planning/config.json` 포함 0건

---
*Phase: 03-pure-logic*
*Completed: 2026-09-21*
