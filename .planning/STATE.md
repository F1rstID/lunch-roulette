---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 1 complete (4/4) — ready to discuss Phase 2
last_updated: 2026-09-18T07:04:08.657Z
last_activity: 2026-09-18
progress:
  total_phases: 8
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-18)

**Core value:** 매일 설정 시각에 오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.
**Current focus:** Phase 2 — 데이터 모델

## Current Position

Phase: 2
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-18

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 8min | 2 tasks | 2 files |
| Phase 01 P02 | 6min | 3 tasks | 5 files |
| Phase 01 P03 | 9min | 3 tasks | 7 files |
| Phase 01 P04 | 7min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

전체 결정 로그는 PROJECT.md Key Decisions 표에 있다. 현재 작업에 직접 걸리는 것:

- 컷오버 1회 — Phase 8 전까지 라이브 DB·Edge Function·`main`은 불변. 작업은 `feat/restaurant-roulette` 브랜치, 검증은 `tsc`/`lint`/`test`/`build`만.
- 마이그레이션은 한 파일, 사용자가 대시보드 SQL Editor에서 적용 (Claude는 원격 SQL 실행 차단).
- 과거 `results` 60행은 보존하고 집계만 `settings.history_since` 이후로 자른다 — 매핑하지 않는다.
- 설정은 `settings` 단일행이 유일한 출처. 하드코딩 11:55(8파일 11곳)는 Phase 3·6에서 전부 제거.
- Edge Function 순수 로직은 `supabase/functions/_shared/`에 Deno import 없이 두어 vitest가 직접 import.
- [Phase 01]: next·eslint-config-next 16.3.5 범프 + 비-force npm audit fix로 npm audit 9건 → 0건 (앱 소스 무변경) — 범프만으로는 eslint 계열 high 3건이 남아 audit fix가 필수였다. --force·npm update는 선언 범위를 넘기므로 금지 유지
- [Phase 01]: 읽기 실패(loadError)와 쓰기 실패(actionError)를 별도 state 로 분리 — 쓰기 성공 시 setActionError(null) 이 호출되므로 합치면 읽기 실패 메시지가 조용히 지워진다
- [Phase 01]: 에러 문자열 조립을 lib/errors.ts 순수 모듈로 분리 (외부 클라이언트·React·process.env 의존 0) — 01-03 vitest 가 환경변수 없이 그대로 import 한다. 배너는 error.message 만 쓰고 details·hint 는 쓰지 않는다
- [Phase 01]: vitest 를 4.1.11 로 정확 고정 (--save-exact) — 최신 5.0.1 은 engines.node 가 로컬 Node v25.6.1 과 불일치하고 optional peer @types/node 도 레포 ^20 과 어긋난다. 신규 패키지도 01-01 의 정확 버전 고정 컨벤션을 따른다
- [Phase 01]: vitest 수집 경계를 tsconfig·eslint 와 동일하게 맞춤 (design/**·.planning/**·supabase/functions/!(_shared)/** 제외). supabase/functions/** 로 줄이면 include 의 _shared 항목이 무효화되므로 extglob 유지
- [Phase 01]: msToNextPhase 는 테스트하지 않는다 — 참조 0건이고 Phase 3 이 lib/phase.ts 를 다시 쓰며 제거할 예정이라 계약 고정이 삭제를 방해한다
- [Phase 01]: MENU_NAME_MAX_LEN 을 lib/constants.ts(환경변수·supabase·React 의존 0)로 내리고 re-export 를 두지 않았다 — 정의처가 한 곳이어야 import 경로가 갈리지 않는다
- [Phase 01]: 컴포넌트가 supabase 모듈에서 값을 가져오지 않게 최상위 import type 문으로 낮춘다 — 인라인 type 한정자와 달리 문장이 통째로 지워져 모듈 로드가 사라진다. 컴포넌트 내부 순수 헬퍼 테스트의 표준 경로
- [Phase 01]: 회귀 spec 의 24자 기대값은 상수 import 대신 리터럴 — 상수를 import 하면 값이 바뀔 때 기대값도 따라가 DB check 제약(char_length 1~24)의 거울이라는 계약이 사라진다

### Pending Todos

없음. (`.planning/todos/pending/` 비어 있음)

### Blockers/Concerns

- **로컬 Supabase 스택이 없다.** 마이그레이션·Edge Function 실행 경로는 컷오버 전까지 정적 검토(`deno check`, 파일 리뷰)로만 검증된다. 전환의 최대 리스크 증폭기.
- **Edge Function은 tsc·eslint 사각지대.** `supabase/functions/**`가 두 설정에서 제외돼 있어 `deno check`가 유일한 정적 검사다.
- **`spin-roulette`는 사전 검증 불가.** 시각 가드 때문에 컷오버 시 `respin-roulette` 수동 invoke로 새 스키마 경로를 대신 확인해야 한다.
- **`npm run dev`는 가드런처로만.** 과거 커널 패닉 이력. 재발 시 `rm -rf .next`.
- **`.serena/project.yml`은 커밋 금지** (serena가 매번 재포맷).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-18T06:46:56.045Z
Stopped at: 01-04 완료: parseMenuInput 10케이스 회귀 테스트 + MENU_NAME_MAX_LEN 상수 분리 (Phase 1 4/4 · 게이트 5종 통과)
Resume file: None
