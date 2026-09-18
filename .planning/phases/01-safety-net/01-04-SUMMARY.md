---
phase: 01-safety-net
plan: 04
subsystem: testing
tags: [vitest, parse, pure-function, import-type, constants, tdd]

# Dependency graph
requires:
  - phase: 01-02
    provides: "lib/errors.ts — 외부 의존 0 순수 모듈 선례 (환경변수 없이 import 되는 모듈 경계)"
  - phase: 01-03
    provides: "vitest 4.1.11 하네스 + components/**/*.test.ts 수집 글롭 + @/* alias (설정 변경 없이 이번 spec 이 잡힌다)"
provides:
  - "lib/constants.ts — 환경변수·supabase·React 의존 0 순수 상수 모듈. MENU_NAME_MAX_LEN 의 유일한 정의처"
  - "components/MenuList.test.ts — parseMenuInput 회귀 케이스 10건 (분리·trim·절단·중복 제거·기존 제외 순서를 계약으로 고정)"
  - "컴포넌트 파일의 순수 헬퍼를 환경변수 없이 테스트하는 패턴 (값 import 는 순수 모듈에서, 행 타입은 최상위 import type 으로)"
  - "Phase 1 다섯 게이트 전부 통과한 상태 (tsc·lint·test·build·audit)"
affects: [03-pure-logic, 05-restaurant-tab, 06-today-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "supabase 클라이언트에서는 값이 아니라 타입만 가져온다 — 최상위 `import type` 문은 트랜스파일에서 통째로 지워져 모듈 로드가 발생하지 않는다"
    - "환경변수에 의존하지 않는 상수는 lib/constants.ts 에 둔다. re-export 를 만들지 않아 정의처가 하나로 유지된다"
    - "회귀 spec 의 기대값에는 상수를 import 하지 않고 리터럴을 쓴다 — 상수가 바뀌면 기대값도 따라 움직여 계약이 사라진다"

key-files:
  created:
    - lib/constants.ts
    - components/MenuList.test.ts
    - .planning/phases/01-safety-net/01-04-SUMMARY.md
  modified:
    - lib/supabase/client.ts
    - components/MenuList.tsx
    - app/page.tsx

key-decisions:
  - "spec 의 24자 기대값을 MENU_NAME_MAX_LEN import 대신 리터럴 24 로 썼다 — 상수를 import 하면 값이 바뀔 때 기대값이 같이 움직여 'DB check 제약(char_length 1~24)의 거울' 이라는 사실이 테스트에서 사라진다"
  - "lib/supabase/client.ts 에 re-export 를 남기지 않았다 — 레포에 barrel 이 없고, 정의처가 둘로 보이면 다음 사람이 어느 쪽을 import 할지 헷갈린다"
  - "components/MenuList.tsx 는 `import { type MenuRow }` 가 아니라 별도 `import type { MenuRow }` 문으로 바꿨다 — 인라인 type 한정자는 문장 자체가 남아 런타임 로드가 살아 있을 여지가 있다"
  - "lib/constants.ts 의 주석에서 환경변수 API 이름을 문자열 그대로 쓰지 않았다 — 순수성 검증 grep(process.env|@supabase|from \"react\")이 산문에 걸려 오탐을 낸다"
  - "스크래치 ref-parse.test.ts 는 한 번도 커밋된 적 없는 untracked 파일이라 삭제 전용 커밋(chore)을 만들지 않았다 — 빈 커밋 대신 이 SUMMARY 커밋에 정리 사실을 기록한다"

patterns-established:
  - "컴포넌트 안의 순수 헬퍼 테스트: 헬퍼가 참조하는 상수를 순수 모듈로 내리고, 컴포넌트의 I/O 모듈 import 를 타입 전용으로 낮춘다"
  - "spec 은 vitest 에서 describe·it·expect 를 명시 import 하고 it 이름을 한글 단문으로 쓴다 (01-03 확립분 유지)"

requirements-completed: [QUAL-01]

# Metrics
duration: 7min
completed: 2026-09-18
---

# Phase 1 Plan 04: parseMenuInput 회귀 테스트 + 상수 분리 Summary

**`MENU_NAME_MAX_LEN` 을 환경변수 없는 `lib/constants.ts` 로 내리고 supabase import 를 타입 전용으로 낮춰, `parseMenuInput` 10케이스 회귀 spec 이 supabase 클라이언트 생성 없이 통과한다**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-18T06:38:00Z
- **Completed:** 2026-09-18T06:45:00Z
- **Tasks:** 3
- **Files modified:** 5 (신규 2 · 수정 3)

## Accomplishments
- 진짜 RED 를 관측했다: spec 은 먼저 `supabaseUrl is required` 로 **import 단계에서** 터졌고, 그 실패가 상수 분리의 근거로 커밋에 남았다
- `lib/constants.ts` 신설 — 상수의 정의처가 한 곳이고 re-export 가 없다
- `components/MenuList.tsx` 가 supabase 모듈에서 값을 하나도 가져오지 않는다 (타입 전용 import 한 줄만 남음) → 파일 안의 순수 헬퍼가 환경변수 없이 테스트된다
- 테스트 스위트가 3 spec 26건 → **4 spec 36건**으로 늘었고 `parseMenuInput` 의 동작은 한 줄도 바뀌지 않았다
- Phase 1 의 다섯 게이트(tsc·lint·test·build·audit)가 전부 통과하고, 라이브 리소스·`main` 은 무변경이다

## Task Commits

1. **Task 1 (RED): parseMenuInput 10케이스 spec 작성 + 환경변수 결합 실패 관측** — `f0daba0` (test)
2. **Task 2 (GREEN): lib/constants.ts 분리 + import 재배선** — `fb1ca16` (feat)
3. **Task 3: 스크래치 테스트 정리 + 페이즈 전체 게이트** — 커밋 없음 (아래 "Deviations" 참조: 삭제 대상이 untracked 였다)

**Plan metadata:** 이 SUMMARY 커밋 (`docs(01-04)`)

## RED 증거 (Task 1)

`env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm test` → **exit 1**. 실패 원문:

```
 ❯ components/MenuList.test.ts (0 test)

⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  components/MenuList.test.ts [ components/MenuList.test.ts ]
Error: supabaseUrl is required.
 ❯ validateSupabaseUrl node_modules/@supabase/supabase-js/src/lib/helpers.ts:111:10
 ❯ new SupabaseClient node_modules/@supabase/supabase-js/src/SupabaseClient.ts:291:20
 ❯ createClient node_modules/@supabase/supabase-js/src/index.ts:65:9
 ❯ lib/supabase/client.ts:8:25
      6| const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      7|
      8| export const supabase = createClient(url, key, {
       |                         ^
      9|   realtime: { params: { eventsPerSecond: 10 } },
     10| });
 ❯ components/MenuList.tsx:5:1

 Test Files  1 failed | 3 passed (4)
      Tests  26 passed (26)
```

`(0 test)` 가 핵심이다 — 케이스가 틀린 게 아니라 **모듈 로드가 막혀 테스트가 하나도 등록되지 않았다**. 같은 시점에 `git status --porcelain components/MenuList.tsx lib/supabase/client.ts app/page.tsx` 는 빈 출력이었다(소스 무변경 상태에서 관측한 실패).

## 재배선한 import (Task 2)

| 파일 | 변경 전 | 변경 후 |
|---|---|---|
| `lib/supabase/client.ts:12-13` | `// menus.name … 여기서만 정의한다.` + `export const MENU_NAME_MAX_LEN = 24;` | 삭제 (re-export 없음). `supabase`·`MenuRow`·`ResultRow`·`PinnedMenuRow` 는 그대로 |
| `components/MenuList.tsx:5` | `import { MENU_NAME_MAX_LEN, type MenuRow } from "@/lib/supabase/client";` | `import { MENU_NAME_MAX_LEN } from "@/lib/constants";` + Why 주석 2줄 + `import type { MenuRow } from "@/lib/supabase/client";` |
| `app/page.tsx:5` | `import { supabase, MENU_NAME_MAX_LEN, type MenuRow, type ResultRow, type PinnedMenuRow } from "@/lib/supabase/client";` | 같은 줄에서 상수만 제거 + 6행에 `import { MENU_NAME_MAX_LEN } from "@/lib/constants";` (이 파일은 `supabase` 를 실제로 쓰므로 런타임 로드 유지가 정상) |
| `lib/constants.ts` (신규) | — | `export const MENU_NAME_MAX_LEN = 24;` + 왜 별도 모듈인지 한글 Why 주석 |

검증 grep: `lib/supabase/client.ts` 실코드 `MENU_NAME_MAX_LEN` **0건**, `lib/constants.ts` 정의 **1건**, `MenuList.tsx` 의 supabase import 는 `^import type { MenuRow } from "@/lib/supabase/client";` **1줄뿐**, `@/lib/constants` 참조는 `MenuList.tsx`·`app/page.tsx` 각 1줄.

## 수집된 spec (`npx vitest list | cut -d'>' -f1 | sort -u`)

```
components/MenuList.test.ts
lib/errors.test.ts
lib/phase.test.ts
lib/time.test.ts
```

정확히 4줄. `npm test` = `Test Files 4 passed (4)` / `Tests 36 passed (36)` (01-03 의 26건 + 이번 10건).

## 페이즈 게이트 결과 (Task 3)

| 게이트 | 명령 | exit | 비고 |
|---|---|---|---|
| 타입 | `npx tsc --noEmit` | 0 | — |
| 린트 | `npm run lint` | 0 | 출력 없음. CLAUDE.md 가 적어 둔 `Wheel.tsx` 의 `react-hooks/set-state-in-effect` 는 현재 재현되지 않는다 |
| 테스트 | `npm test` | 0 | 4 파일 / 36건 통과, 실패 0 |
| 테스트(환경변수 제거) | `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm test` | 0 | 이 플랜의 목표 조건 |
| 빌드 | `rm -rf .next && npm run build` | 0 | 4 라우트 전부 static prerender. `NEXT_DISABLE_MEM_OVERRIDE=1` 로 실행(CLAUDE.md 메모리 가드) |
| 감사 | `npm audit --audit-level=high` | 0 | critical 0 · high 0 · moderate 0 · low 0 (총 0) |

라이브 불변: `git status --porcelain supabase` 빈 출력, `git diff --name-only main...HEAD -- supabase supabase/migrations` 빈 출력, 브랜치 `feat/restaurant-roulette`, `git log $(git merge-base main HEAD)..HEAD` 의 AI 표기(`Co-Authored-By`/`Generated with`/`Claude-Session`) **0건**. `npm run dev` 는 띄우지 않았다.

## Files Created/Modified
- `lib/constants.ts` (신규) — 환경변수·supabase·React 의존 0 순수 상수 모듈. `MENU_NAME_MAX_LEN = 24` 의 유일한 정의처
- `components/MenuList.test.ts` (신규) — `parseMenuInput` 회귀 10케이스. 이름은 스크래치 정본 그대로
- `lib/supabase/client.ts` — 상수 정의·주석 제거 (클라이언트와 행 타입 3종은 불변)
- `components/MenuList.tsx` — import 재배선 + Why 주석. `parseMenuInput` 본문·시그니처·export 위치 무변경
- `app/page.tsx` — 5행에서 상수 분리, 6행에 constants import 추가. 165행 사용처 무변경

## Decisions Made
- **기대값에 상수 대신 리터럴 24.** 상수를 import 하면 누군가 상수를 20으로 바꿔도 테스트가 초록으로 남는다. 24는 DB check 제약의 거울이므로 테스트가 그 숫자를 직접 붙잡아야 한다 (이유를 spec 머리 주석에 남김).
- **re-export 없음.** `lib/supabase/client.ts` 에 호환용 re-export 를 두면 import 경로가 둘이 되어 다음 사람이 헷갈린다. 사용처가 2곳뿐이라 즉시 재배선이 더 싸다.
- **인라인 `type` 한정자 대신 별도 `import type` 문.** `import { type MenuRow } from ...` 는 import 문장 자체가 남는다. 문장을 통째로 지우는 형태여야 "환경변수 없이 로드된다"가 구조적으로 보장된다 (`components/CalendarLog.tsx:5` 의 기존 선례와 동일한 형태).
- **`app/page.tsx` 는 타입 전용으로 낮추지 않았다.** 이 파일은 `supabase` 클라이언트를 실제로 호출하므로 런타임 로드가 정상이며, 억지로 낮추면 오히려 오해를 만든다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `lib/constants.ts` 주석이 순수성 검증 grep 에 오탐으로 걸렸다**
- **Found during:** Task 2 (수용 조건 검증)
- **Issue:** 첫 작성본 주석에 환경변수 API 이름을 문자열 그대로 적어(`createClient(process.env...)`) 수용 조건인 `grep -E 'process\.env|@supabase|from "react"' lib/constants.ts` 가 2줄을 뱉었다. 실제 코드 의존은 0이지만 산문이 가드를 깨뜨렸다.
- **Fix:** 같은 의미를 API 이름 없이 "환경변수를 읽는다" 로 다시 썼다. 의미는 유지되고 grep 은 0줄이 됐다.
- **Files modified:** `lib/constants.ts`
- **Verification:** `grep -cE 'process\.env|@supabase|from "react"' lib/constants.ts` → 0, `npm test`/`tsc`/`lint` 전부 재통과
- **Committed in:** `fb1ca16` (Task 2 커밋에 포함)

**2. [Rule 3 - Blocking] Task 3 의 `chore(01-04)` 커밋을 만들지 않았다**
- **Found during:** Task 3 (스크래치 정리)
- **Issue:** 플랜은 `chore(01-04): remove scratch parse test` 커밋을 지시했지만, `.planning/phases/01-safety-net/ref-parse.test.ts` 는 **한 번도 커밋된 적 없는 untracked 파일**이었다 (`git ls-files` 빈 출력, `git log --all -- <path>` 빈 출력). 삭제해도 스테이징할 변경이 없어 커밋이 불가능하다.
- **Fix:** 파일을 삭제하고(삭제 전 10개 케이스 이름 대조 완료 — 전부 1건씩 존재), 정리 사실을 이 SUMMARY 와 SUMMARY 커밋 메시지에 기록했다. 빈 커밋(`--allow-empty`)은 히스토리 노이즈라 만들지 않았다.
- **Files modified:** `.planning/phases/01-safety-net/ref-parse.test.ts` (삭제)
- **Verification:** `test -e .planning/phases/01-safety-net/ref-parse.test.ts` 실패(파일 없음), `git status --short` 에 잔여 흔적 없음
- **Committed in:** — (커밋할 diff 없음. 사실 기록은 이 SUMMARY)

---

**Total deviations:** 2 auto-fixed (둘 다 Rule 3 blocking)
**Impact on plan:** 산출물·동작·수용 조건은 플랜 그대로. 1번은 검증 가드를 통과시키기 위한 주석 표현 수정, 2번은 대상 파일이 git 추적 밖이라 커밋이 성립하지 않는 구조적 사유. 범위 확대 없음.

## Issues Encountered
- 없음. `parseMenuInput` 의 10케이스는 구현과 하나도 어긋나지 않았다 (분리→trim→절단→중복 판정 순서가 스크래치 기대값과 일치). 동작 변경은 0건이다.

## User Setup Required
None — 외부 서비스 설정·신규 패키지 설치 0건. 위협면 변화 없음 (`supabase/**`·RLS·Edge Function·마이그레이션 무변경).

## Next Phase Readiness
- **Phase 1 성공 기준 1번 완성.** `npm test` 가 `lib/time.ts`·`lib/phase.ts`·`parseMenuInput` 를 전부 덮고, 환경변수 없이 import 된다. 4번(라이브·`main` 무변경)도 유지.
- **QUAL-01 은 이 플랜으로 Phase 1 몫이 끝났다.** 요구사항 문장에 남은 `spin_time` 파싱·쿨다운 필터 단위 테스트는 **Phase 3(순수 로직)** 에서 닫힌다 — 아직 그 코드가 존재하지 않는다.
- Phase 5(매장 탭)가 `parseMenuInput` 을 매장 메뉴 입력에 재사용할 때 이 10케이스가 회귀망이 된다. Phase 2 가 `MENU_NAME_MAX_LEN` 을 매장 이름 상한으로 재해석한다면 `lib/constants.ts` 한 곳만 보면 된다.
- 남은 주의: `components/Wheel.tsx` 의 회전 상태 머신과 `app/log`·`app/rank` 의 INSERT-only 구독은 여전히 테스트 없는 영역이다 (이 페이즈 범위 밖, 기존 CONCERNS 유지).

---
*Phase: 01-safety-net*
*Completed: 2026-09-18*

## Self-Check: PASSED

- 생성 파일 3개 존재 확인 (`lib/constants.ts`·`components/MenuList.test.ts`·본 SUMMARY)
- 커밋 2개 존재 확인 (`f0daba0` test → `fb1ca16` feat, TDD 게이트 순서 준수)
- 스크래치 `.planning/phases/01-safety-net/ref-parse.test.ts` 삭제 확인
