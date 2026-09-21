---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
stopped_at: Phase 3 complete (3/3) — ready to discuss Phase 4
last_updated: 2026-09-21T05:56:01.089Z
last_activity: 2026-09-21 -- Phase 3 complete (verification passed 26/26, review 6 fixed/2 deferred)
progress:
  total_phases: 8
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 38
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-18)

**Core value:** 매일 설정 시각에 오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.
**Current focus:** Phase 4 — 서버 추첨

## Current Position

Phase: 4
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-21 -- Phase 3 complete (verification passed 26/26, review 6 fixed/2 deferred)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 13
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 2 | 3 | - | - |
| 3 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01 P01 | 8min | 2 tasks | 2 files |
| Phase 01 P02 | 6min | 3 tasks | 5 files |
| Phase 01 P03 | 9min | 3 tasks | 7 files |
| Phase 01 P04 | 7min | 3 tasks | 5 files |
| Phase 02 P01 | 2min | 1 tasks | 1 files |
| Phase 02 P02 | 8min | 3 tasks | 3 files |
| Phase 02 P03 | 11min | 3 tasks | 3 files |
| Phase 03 P01 | 10min | 4 tasks | 11 files |
| Phase 03 P02 | 8min | 3 tasks | 11 files |
| Phase 03 P03 | 10min | 4 tasks | 7 files |

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
- [Phase 02]: vitest include 글롭을 supabase/migrations/**/*.test.ts 로 한정 (supabase/** 로 넓히지 않음) — exclude 의 extglob supabase/functions/!(_shared)/** 과 겹치는 판정을 만들면 Phase 3 의 _shared 수집 경로가 조용히 깨진다
- [Phase 02]: 마이그레이션 계약 spec 은 검사 대상 SQL 파일 옆(supabase/migrations/)에 둔다 — 로컬 Supabase 스택이 없어 SQL 을 실행할 수 없고 텍스트 파싱이 유일한 자동 회귀 장치다 (D-15: Docker 드라이런은 Phase 8 선택 항목)
- [Phase 02]: 0005 의 정책 줄에서 이름 정렬 패딩(0001·0004 습관)을 버리고 단일 공백으로 썼다 — drop/create 정책 쌍의 (테이블,이름) 1:1 검사가 단일 공백 정규식이라 정렬 패딩을 넣으면 9개 중 하나도 매치되지 않아 멱등성 게이트가 조용히 무력화된다
- [Phase 02]: publication 가드를 테이블별 do 블록 3개가 아니라 배열 루프 1개로 — 대상이 한 줄 리터럴 배열이어야 '세 이름이 전부 있는가'를 집합 비교로 검사할 수 있다
- [Phase 02]: SQL 문 개수 단언은 주석 제거 사본에서만 센다 — 한글 Why 주석에 create policy 같은 토큰이 섞이면 원본 grep 이 자기 자신을 세어 게이트가 통과해 버린다
- [Phase 02]: 낭독 리뷰 11항목은 '통과' 판정이 아니라 파일:줄 인용과 함께 기록한다 — 판정만 남은 기록은 Phase 8 컷오버에서 재검증 비용을 그대로 되돌려준다 (T-02-11)
- [Phase 02]: 계약 테스트가 덮지 못하는 지점을 기록에 명시했다 — cascade/set null 방향은 자동 단언 0건, settings 기본값은 기대값 출처가 스펙 리터럴이라 CONTEXT 원문 대조가 아니며, 컬럼 정의는 8줄 중 3줄만 자동이다
- [Phase 02]: 요구사항 완료 마킹은 페이즈 안에서 검증을 닫는 플랜 하나만 한다 — 파일을 만든 02-02 가 아니라 사람 승인을 받은 02-03 이 SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03 을 찍었다
- [Phase 3]: _shared/*.ts 세 파일은 import 0개 — Deno 는 상대 import 에 .ts 확장자를 요구하고 tsc(bundler)는 거부한다. 서로 import 하지 않아야 Deno·tsc·Turbopack·vitest 네 곳에서 모두 컴파일된다. 교차 타입은 로컬 구조 타입으로 받는다
- [Phase 3]: tsc·eslint 제외 좁히기(D-12)를 첫 커밋으로 올렸다 — 좁히기 전에는 _shared 의 타입 에러가 tsc --noEmit exit 0 으로 지나간다. RED 의 TS2307 3건이 좁히기가 켜졌다는 증거다
- [Phase 3]: 게이트용 금지 토큰(hour12·SPIN_HH·function kstNow)을 소스 주석에 쓰지 않는다 — 주석이 자기 자신을 세면 게이트가 무력화된다. 계약 spec 의 정규식 리터럴까지 세는 레포 전역 grep 은 --include='index.ts' 로 범위를 좁혀 측정한다
- [Phase 3]: spin-roulette 는 DEFAULT_SPIN_TIME 상수를 그대로 넘기고 respin-roulette 는 spinTime.ts 를 끌어오지 않는다 — 시간 가드가 없는 함수에 불필요한 의존을 만들지 않는다 (edgeImports #17 이 부재를 단언)
- [Phase 3]: Phase 유니온 확장과 소비처 9곳 전환을 한 커밋에 넣었다 — 소비처가 전부 if-체인 + fallback 이라 유니온을 넓혀도 tsc 에러가 0건이고, 커밋을 나누면 그 사이가 MenuList 만 조용히 틀린 '초록인데 틀린' 상태가 된다
- [Phase 3]: currentPhase 에서 기본 인자를 버리고 hasResult 를 시그니처에 박았다 — decided 를 결정하는 것은 시각이 아니라 results 행의 존재이고, 추첨 시각이 지났는데 결과가 없으면 stalled 로 떨어져 후보 목록이 잠기지 않는다 (SPIN-03)
- [Phase 3]: lib/** 의 '함수가 아직 없다' RED 는 수집 실패가 아니라 단언 실패로 나타난다 — vitest 는 없는 named export 를 undefined 로 바인딩한다. RED 판정을 Failed Suites 로 하면 놓치므로 exit code 와 tsc TS2305/TS2554 로 본다
- [Phase 3]: settings 상태를 error(로드 실패)와 warning(spin_time 파싱 경고) 두 필드로 갈랐다 — 한 필드에 몰면 로드가 성공했는데 경고가 formatLoadError 의 '설정 불러오기 실패:' 접두를 달고 나와 거짓말이 된다
- [Phase 3]: 판단을 훅이 아니라 리듀서에 모았다 — 레포는 environment: node 단일 구성이라 렌더 하네스가 없고, 훅에 남는 분기는 영원히 테스트되지 않는다. useSettings 는 SELECT 1회 + 구독 1개 + cleanup 만 갖는다
- [Phase 3]: 게이트용 토큰(maybeSingle)을 주석 문안에서 뺐다 — 인수 조건이 파일 전체 grep 으로 호출 1건을 세는데 주석이 자기 자신을 세면 게이트가 무력화된다 (Phase 3 의 기존 결정 재적용)

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

Last session: 2026-09-21T05:08:32.092Z
Stopped at: 03-03 완료: settings 리듀서 + useSettings 훅 + 세 페이지 배선, D-16 문서 정정 (10파일 179건)
Resume file: None
