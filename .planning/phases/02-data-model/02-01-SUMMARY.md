---
phase: 02-data-model
plan: 01
subsystem: testing
tags: [vitest, glob, contract-test, supabase, migration, config]

# Dependency graph
requires:
  - phase: 01-03
    provides: "vitest.config.mts — include 3개 글롭 + exclude 5항목(design/**·.planning/**·supabase/functions/!(_shared)/**) + @/* alias"
provides:
  - "vitest.config.mts test.include 4번째 글롭 supabase/migrations/**/*.test.ts — 마이그레이션 계약 스펙 수집 경로"
  - "02-02 의 RED 게이트가 '수집 0건'(러너 설정 실패)이 아니라 '단언 실패'(진짜 RED)임을 보증하는 전제 조건"
  - "npx vitest run supabase/migrations 를 02-VALIDATION.md 의 quick run command 로 쓸 수 있는 상태"
affects: [02-02, 02-03, 03-settings-phase, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "실행할 수 없는 산출물(로컬 스택 없는 마이그레이션 SQL)은 텍스트 파싱 계약 테스트로 회귀를 잡고, spec 은 검사 대상 파일 옆에 둔다"
    - "수집 경계를 넓힐 때는 넓힌 직후 npx vitest list 로 파일 목록이 의도한 만큼만 변했는지 확인한다 (신규 매치 0건도 유효한 기대값)"

key-files:
  created:
    - .planning/phases/02-data-model/02-01-SUMMARY.md
  modified:
    - vitest.config.mts

key-decisions:
  - "glob 을 supabase/migrations/**/*.test.ts 로 한정하고 supabase/** 로 넓히지 않았다 — exclude 의 extglob supabase/functions/!(_shared)/** 과 겹치는 판정을 만들지 않기 위해서다"
  - "exclude 배열은 한 글자도 건드리지 않았다 — 커밋 전 git show HEAD:vitest.config.mts 의 exclude 블록과 diff 로 바이트 동일성을 확인했다"
  - "이 시점에 supabase/migrations/*.test.ts 파일을 미리 만들지 않았다 — 그 파일은 02-02 의 RED 산출물이고, 빈 매치(0건)로도 vitest 는 정상 동작한다"
  - "D-15 에 따라 Docker 드라이런 하네스는 도입하지 않았다 (Phase 8 선택 항목). Phase 2 의 자동 회귀 장치는 이 include 한 줄에 얹힌 계약 테스트가 유일하다"

patterns-established:
  - "include 신규 항목 위에는 '왜 이 형태인지'만 적는 한글 Why 주석 1~2줄 (01-03 의 _shared 항목 주석과 동일 어투)"

# 이 플랜의 frontmatter 는 requirements: [SHIP-01] 이지만 완료로 올리지 않는다 —
# SHIP-01 은 "컷오버 마이그레이션 1개 생성" 이고 그 파일은 02-03 이 만든다 (02-02·02-03 도 같은 ID 를 claim).
# 러너 설정만 바꾼 이 플랜이 Complete 를 찍으면 마이그레이션 미작성이 추적 표에서 가려진다. 마킹은 02-03 이 한다.
requirements-completed: []

# Metrics
duration: 2min
completed: 2026-09-18
---

# Phase 2 Plan 01: vitest 마이그레이션 수집 경로 Summary

**`vitest.config.mts` `test.include` 에 `supabase/migrations/**/*.test.ts` 글롭을 추가해, 02-02 가 쓸 마이그레이션 계약 스펙이 러너에 잡히도록 수집 경계를 한 칸 넓혔다 (기존 4파일 36건·exclude 5항목은 무변경).**

## Performance

- **Duration:** 2min
- **Started:** 2026-09-18T09:36:05Z
- **Completed:** 2026-09-18T09:37:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- `test.include` 가 4개 글롭이 되었고 마지막 항목이 `supabase/migrations/**/*.test.ts` 다. 02-VALIDATION.md 의 Wave 0 요구 2건 중 1건이 닫혔다.
- 수집 경계 확대가 기존 경계를 침범하지 않음을 증명했다 — `npx vitest list` 결과가 확장 전후 모두 정확히 4파일(`components/MenuList.test.ts` · `lib/errors.test.ts` · `lib/phase.test.ts` · `lib/time.test.ts`), `npm test` 36건 전부 통과.
- `exclude` 5항목이 문자 단위로 무변경임을 커밋 전 diff 로 확인했다 (T-02-01 · T-02-02 완화).

## Task Commits

Each task was committed atomically:

1. **Task 1: vitest include 에 supabase/migrations 글롭 추가** — `bf930f2` (chore)

**Plan metadata:** (아래 docs 커밋 — SUMMARY·STATE·ROADMAP)

## Files Created/Modified

- `vitest.config.mts` — `test.include` 에 `"supabase/migrations/**/*.test.ts"` 1줄 + 한글 Why 주석 2줄 추가 (3 insertions, 0 deletions)

## Decisions Made

- **글롭 범위를 `supabase/migrations/` 로 한정.** `supabase/**` 로 넓히면 `exclude` 의 `supabase/functions/!(_shared)/**` extglob 과 겹치는 판정이 생겨 Phase 3 의 `_shared` 수집 경로가 조용히 흔들릴 수 있다.
- **spec 은 SQL 파일 옆(`supabase/migrations/`)에 둔다.** 로컬 Supabase 스택이 없어 마이그레이션을 실행할 수 없으므로, 계약 테스트가 `.sql` 을 텍스트로 파싱해 검사한다. 이 사실을 include 항목 위 Why 주석에 남겼다 (D-15 — Docker 드라이런 하네스는 Phase 8 선택 항목).
- **테스트 파일을 선제 생성하지 않았다.** `supabase/migrations/*.test.ts` 는 02-02 의 RED 산출물이다. 매치 0건이어도 vitest 는 정상 동작한다(검증됨).

## Deviations from Plan

**Task 1 자체는 플랜 문구 그대로 실행됐다.** 아래는 플랜 실행 후 상태 기록 단계에서 발생한 조정 1건이다.

### Auto-fixed Issues

**1. [Rule 1 - Bug] SHIP-01 완료 표기를 되돌렸다 (조기 완료 마킹)**

- **Found during:** 상태 갱신 단계 (`requirements.mark-complete`)
- **Issue:** 이 플랜의 frontmatter 가 `requirements: [SHIP-01]` 이라 워크플로 지시대로 `gsd-sdk query requirements.mark-complete SHIP-01` 을 실행했고, `REQUIREMENTS.md` 에서 SHIP-01 이 `[x]` · 추적 표가 `Complete` 로 바뀌었다. 그런데 SHIP-01 의 문구는 "컷오버 마이그레이션 1개: `restaurants`·`candidates`·`settings` 생성, RLS·Realtime 등록, cron 교체 … 재실행 가능" 이다. 이 플랜은 러너 설정 1줄만 바꿨고 **마이그레이션 파일은 아직 존재하지 않는다**(02-03 산출물). 같은 SHIP-01 을 02-02·02-03 도 claim 한다(`grep requirements: 02-0*-PLAN.md` 로 확인). 즉 이 시점의 Complete 는 거짓 이력이고, 페이즈 검증이 "SHIP-01 은 이미 끝났다"고 읽으면 마이그레이션 미작성을 놓친다.
- **Fix:** `git checkout -- .planning/REQUIREMENTS.md` 로 해당 파일만 되돌렸다(다른 파일 무영향 — 시작 시점에 clean 했음). SHIP-01 은 마이그레이션을 실제로 만드는 **02-03 이 마킹한다.**
- **Files modified:** `.planning/REQUIREMENTS.md` (순변화 0 — 되돌림)
- **Verification:** `grep -n "SHIP-01" .planning/REQUIREMENTS.md` → `- [ ] **SHIP-01**` · `| SHIP-01 | Phase 2 — 데이터 모델 | Pending |`, `git status --short` 에 `REQUIREMENTS.md` 없음
- **Committed in:** — (되돌림이므로 커밋 내용 없음)

**2. [Rule 1 - Bug] SDK 가 생성한 문자열 3건의 형식 교정**

- **Found during:** 상태 갱신 단계
- **Issue:** (a) `state.add-decision` 이 `- [Phase ?]: [Phase 02]: …` 로 접두사를 이중 출력 — 기존 14줄은 전부 `- [Phase 01]: …` 형식. (b) `roadmap.update-plan-progress` 가 표 셀을 `| In Progress|  |` 로 써 파이프 앞 공백 누락 + Completed 열 공백. (c) `state.record-session` 이 `last_activity` 의 서술 접미사(`-- Phase 2 planning complete` 형태)를 날려 날짜만 남김.
- **Fix:** (a) 이중 접두사 2줄을 `- [Phase 02]:` 로 정규화. (b) `| In Progress | - |` 로 교정(다른 행과 동일 형식). (c) `2026-09-18 -- Phase 2 executing (02-01 complete)` 로 복원.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md`
- **Verification:** `git diff` 육안 확인 — 의미 변경 없음, 형식만 기존 관례에 정렬
- **Committed in:** docs 커밋

---

**Total deviations:** 2 auto-fixed (2 bug)
**Impact on plan:** 둘 다 문서 정확성 문제이고 코드·수집 경계에는 영향이 없다. 범위 확대 없음 — `vitest.config.mts` 커밋은 플랜 명세 그대로 3 insertions / 0 deletions 단일 파일이다.

## Issues Encountered

None. 다만 기록해 둘 관측 1건: CLAUDE.md 가 "2026-09-15 기준 lint 에러 1건(`components/Wheel.tsx` `react-hooks/set-state-in-effect`)" 이라고 적고 있으나, 이번 검증에서 `npm run lint` 는 **exit 0 · 출력 0줄**이었다. Phase 1 작업 중 해소된 것으로 보인다. 이 플랜의 범위 밖이라 수정·추적하지 않았고 CLAUDE.md 도 건드리지 않았다 — 페이즈 게이트에서 재확인할 항목.

## Verification Results

인수 조건을 전부 명령으로 실행해 확인했다.

| 검증 | 명령 | 결과 |
|---|---|---|
| 신규 글롭 존재 | `grep -c 'supabase/migrations/\*\*/\*\.test\.ts' vitest.config.mts` | `1` ✅ |
| extglob 무변경 | `grep -c 'supabase/functions/!(_shared)/\*\*' vitest.config.mts` | `1` ✅ |
| `.planning/**` 무변경 | `grep -c "'\.planning/\*\*'"` | `1` ✅ |
| exclude 바이트 동일 | `diff <(git show HEAD:vitest.config.mts \| sed -n '/exclude/,/\],/p') <(sed -n ...)` | 차이 없음 ✅ |
| 커밋 크기 | `git show --numstat --format= HEAD -- vitest.config.mts` | `3  0` (삭제 0, 추가 3 — 허용 1~3) ✅ |
| 수집 파일 | `npx vitest list \| cut -d'>' -f1 \| sort -u` | 정확히 4줄, 신규 매치 0건 ✅ |
| 전체 스위트 | `npm test` | exit 0 — `Test Files 4 passed (4)` / `Tests 36 passed (36)` ✅ |
| 타입 | `npx tsc --noEmit` | exit 0 ✅ |
| lint | `npm run lint` | exit 0 ✅ |
| 커밋 위생 | `git show --name-only --format= HEAD` | `vitest.config.mts` 1건뿐 — `.serena/project.yml` 0 · `.planning/config.json` 0 ✅ |
| AI 표기 | `git log -1 --format=%B \| grep -ciE 'Co-Authored-By\|Generated with\|Claude-Session'` | `0` ✅ |

## Threat Model Compliance

| Threat ID | 상태 | 근거 |
|---|---|---|
| T-02-01 (include 확대로 의도치 않은 디렉터리 수집) | mitigated | 글롭을 `supabase/migrations/` 로 한정. `npx vitest list` 가 확장 전후 동일한 4줄 — `design/**` · `.planning/**` 신규 매치 0건 |
| T-02-02 (extglob 축소로 `_shared` 무효화) | mitigated | `exclude` 블록 바이트 동일성 diff 로 확인 |
| T-02-SC (패키지 공급망) | mitigated | 설치 0건. `package.json` · `package-lock.json` 미변경 (커밋 파일 1개) |
| T-02-LIVE (라이브 Supabase / `main`) | mitigated | 파일 1개만 수정. `supabase` CLI 미실행, 원격 SQL 0건, 브랜치 `feat/restaurant-roulette` 유지 |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-02 가 바로 착수 가능하다.** `supabase/migrations/0005_restaurants_settings.test.ts` 를 만들면 별도 설정 없이 수집된다. `npx vitest run supabase/migrations` 가 지금은 "No test files found" 이지만, 스펙 파일이 생기는 즉시 실행된다 — 즉 02-02 의 RED 가 러너 설정 실패로 위장될 여지가 없다.
- `tsconfig.json` `exclude` 에 `supabase/migrations` 가 없으므로(RESEARCH A6) 신규 spec 은 `tsc --noEmit` · eslint 대상에 자동 포함된다. 추가 설정 작업 없음.
- Wave 0 요구 2건 중 남은 1건은 계약 테스트 파일 자체(02-02)다.

---
*Phase: 02-data-model*
*Completed: 2026-09-18*

## Self-Check: PASSED

- `vitest.config.mts` — FOUND
- `.planning/phases/02-data-model/02-01-SUMMARY.md` — FOUND
- commit `bf930f2` — FOUND (git log --all)
