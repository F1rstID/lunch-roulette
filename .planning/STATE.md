---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: milestone_complete
stopped_at: Cutover executed 2026-09-29 - live on new model, PR #4 merged (7c43a81). Remaining: user live check (README 7-8), test restaurant cleanup
last_updated: 2026-09-30T01:36:00.000Z
last_activity: 2026-09-30 -- Quick 001 완료: 모바일 레이아웃(320px 부터 가로 넘침 0) + 눈에 보이는 결함 3건. 브랜치 feat/mobile-layout, 리뷰 1회 반영, PR 대기(main 미반영). 컷오버 후 확인(익일 11:55 추첨)은 별개로 남아 있음
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 20
  completed_plans: 20
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-18)

**Core value:** 매일 설정 시각에 오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.
**Current focus:** 컷오버 후 확인 — README 7(당일)·8(익일 11:55 추첨) → 확인용 매장 삭제 → 마일스톤 마감

## Current Position

Phase: 8 (complete)
Plan: 1 of 1 (complete)
Status: Cutover executed — live on new model; user live check + 익일 추첨 확인 remaining
Last activity: 2026-09-30 -- Quick 001 완료: 모바일 레이아웃(320px 부터 가로 넘침 0) + 눈에 보이는 결함 3건. 브랜치 feat/mobile-layout, 리뷰 1회 반영, PR 대기(main 미반영). 컷오버 후 확인(익일 11:55 추첨)은 별개로 남아 있음

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 2 | 3 | - | - |
| 3 | 3 | - | - |
| 4 | 4 | - | - |
| 5 | 2 | - | - |
| 6 | 2 | - | - |
| 7 | 1 | - | - |
| 8 | 1 | - | - |
| 8 | 1 | - | - |

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
| Phase 04 P01 | 4min | 3 tasks | 6 files |
| Phase 04 P02 | 6min | 2 tasks | 3 files |
| Phase 04 P03 | 11min | 3 tasks | 4 files |
| Phase 04 P04 | 6min | 2 tasks | 7 files |
| Phase 05 P01 | 17min | 2 tasks | 8 files |
| Phase 05 P02 | 10min | 3 tasks | 8 files |
| Phase 06 P01 | 23min | 2 tasks | 21 files |
| Phase 06 P02 | 23min | 4 tasks | 28 files |
| Phase 07 P01 | 22min | 3 tasks | 17 files |
| Phase 08 P01 | 50min | 4 tasks | 12 files |

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
- [Phase 4]: deno 설정 파일을 supabase/functions/deno.json 한 단계 위에 둔다 — 함수 디렉터리 안에 두면 Supabase CLI 가 배포 import map 으로 채택해 번들 입력이 바뀐다. 계약 #48 이 existsSync 7원소로 배치를 고정한다
- [Phase 4]: deno.lock 은 커밋하되 --frozen 을 스크립트에 넣지 않는다 — lock 갱신이 필요한 상황에서 diff 를 내며 실패한다. 드리프트 감지기는 git status 이고, 루트에 lock 이 생기면 .gitignore 가 아니라 명령을 고친다
- [Phase 4]: 04-01 은 RED 전용이라 feat(04-01) 커밋이 없다 — 타입 확장은 동작 변경이 아니라 chore 로 커밋했다. GREEN 은 feat(04-02)(적색 12건)·feat(04-03)(10건, #47 포함)이 닫는다
- [Phase 4]: 04-02 — 임베드를 접을 때 row.restaurants[0] 대신 지역 변수 embed 를 거친다 — 인수 조건의 restaurants[0] 0건과 RESEARCH Pattern 1 을 동시에 만족한다
- [Phase 4]: 04-02 — normalizeCandidates 내부를 unknown[] 로 한 번 더 좁힌다 — Array.isArray 가 unknown 을 any[] 로 넓혀 이후 좁히기가 무효가 되는 것을 막는다
- [Phase 4]: 04-02 — 23505 레이스 경로에는 서버 로그를 남기지 않는다 — 실패가 아니라 설계된 정상 경로라 진짜 실패와 섞이면 관측성이 떨어진다
- [Phase 4]: 04-03 — respin 의 설정 폴백 플래그는 조회 실패에서만 오른다 — 시간 가드가 없어 추첨 시각 값을 읽되 파싱하지 않는다(형제 함수는 파싱 실패에서도 오른다)
- [Phase 4]: 04-03 — jsr 핀을 바꿔도 deno.lock 이 갱신되지 않았다 — deno check 는 명세자를 추가만 하고 쓰이지 않게 된 항목을 지우지 않는다. 생성물이라 손으로 고치지 않았다
- [Phase 4]: 04-03 — 배너 에러 판정을 페이지가 아니라 lib/errors.ts 순수 모듈에 뒀다 — invoke 반환의 Response 로 본문을 한 번 읽고 형태 판정은 순수 함수가 끝낸다(FunctionsHttpError 값 import 0 · any 0)
- [Phase 4]: 04-04 — deno.lock 의 비핀 @2 명세자 줄은 손편집이 아니라 삭제 후 재생성으로 지운다 — deno check 는 명세자를 추가만 하고 정리하지 않으며 lock 은 생성물이다
- [Phase 4]: 04-04 — VALIDATION 의 Manual-Only 항목은 pending 을 비우되 green 으로 칠하지 않고 manual-only 로 판정한다 — 거짓 초록은 재검증 비용을 숨긴다 (T-04-22)
- [Phase 4]: 04-04 — 요구사항 마킹(SPIN-01·SPIN-02·SPIN-04·SETT-04)은 페이즈 검증을 닫는 마지막 플랜이 한 번에 찍는다 — Phase 2 선례이고 04-01·04-03 이 같은 근거로 미뤘다
- [Phase 5]: 05-01 — lib/restaurants.ts 가 components/MenuList.tsx 의 parseMenuInput 을 import 한다: lib/ 단방향 규칙의 의도적 예외다. 파싱 구현을 두 벌로 만들지 않으려는 선택이고, Phase 6 이 MenuList 를 지울 때 그 함수를 lib/ 로 옮겨야 예외가 사라진다
- [Phase 5]: 05-01 — 길이 판정·절단의 단위를 코드포인트로 통일했다: DB char_length 와 같은 단위라야 클라이언트가 통과시킨 이모지 이름이 DB 에서 23514 로 튕기지 않는다. 절단 구현은 truncateToCodePoints 한 벌뿐이고 오늘 탭도 그것을 부른다
- [Phase 5]: 05-01 — 이름·위치·메뉴 개수 초과는 절단이 아니라 거부다: 말없이 짧아진 매장명은 다른 가게가 되고, 31번째 메뉴를 버리면 사용자는 전부 등록된 줄 안다. 원소 24자 절단만 기존 parseMenuInput 의 계약으로 남긴다
- [Phase 5]: 05-01 — restaurantsReducer 의 changed 는 error 를 지우지 않는다: 이벤트 하나가 도착했다는 사실이 목록 전체를 읽을 수 있다는 증거가 아니라서, 조회 실패 배너를 여기서 걷으면 반쪽짜리 목록이 정상처럼 보인다 (단일행인 settings 와 갈리는 지점)
- [Phase 5]: 05-01 — 위치 링크 판정을 URL 파싱 + http/https 화이트리스트로 좁혔다: javascript: 와 data: 는 URL 생성자를 통과하므로 '파싱되면 링크' 로 두면 클릭 한 번에 스크립트가 도는 앵커가 목록에 생긴다 (T-05-03)
- [Phase 5]: 05-02 — 훅에 판단을 한 줄도 남기지 않았다: useRestaurants 는 SELECT 1회 + INSERT/UPDATE/DELETE 3분기 + cleanup 만 갖고, 3분기를 한 분기로 합치지 않은 이유는 합치면 eventType 단언이 렌더 하네스가 없는 자리로 되돌아오기 때문이다
- [Phase 5]: 05-02 — 편집 폼의 key 를 행 id 로 줬다: Realtime UPDATE 로 props 가 바뀌어도 폼이 remount 되지 않아 편집 초안이 살아남고 저장이 마지막 쓰기로 덮는다 (익명 서비스라 충돌 UI 없음)
- [Phase 5]: 05-02 — 폼 검증 실패는 페이지 배너가 아니라 폼 안 role=alert 로 띄운다: 쓰기 실패가 아니고 고쳐야 할 입력 칸 옆에 있어야 사용자가 어디를 손볼지 안다. 쓰기 실패만 actionError 로 모인다
- [Phase 5]: 05-02 — 매장 탭은 results 를 구독하지 않는다: 잠금이 없어(D-12) 페이즈 필은 표시용이고, 구독을 하나 더 늘리면 얻는 것(필 갱신)보다 실패 경로가 늘어나는 비용이 크다. 탭을 열어 둔 채 추첨 시각이 지나면 필이 새로고침 전까지 지연된다
- [Phase 5]: 05-02 — 게이트 토큰(useCallback)을 주석 문안에서 뺐다: 인수 조건이 파일 전체 grep 으로 0건을 요구하는데 근거 주석이 자기 자신을 세면 게이트가 무력화된다 (Phase 3 의 같은 결정 재적용)
- [Phase 6]: 06-01 — 목록 병합 규칙의 구현을 lib/rowset.ts 한 벌로 뽑고 키만 주입한다: restaurants 는 id, candidates 는 restaurant_id. 두 벌로 두면 CR-01 급 버그가 한쪽에만 고쳐지는 날이 온다
- [Phase 6]: 06-01 — 리듀서 액션을 fetched/changed 둘로 합쳤다: fetched 가 rows 와 error 를 함께 받아 성공·실패의 가름이 리듀서 spec 을 지난다. 그 결과 useSettings·useRestaurants 두 훅에 if 가 0개다 — 취소 플래그 분기까지 없애려고 cleanup 이 보낼 곳을 빈 함수로 바꾼다(todo in-03 닫음)
- [Phase 6]: 06-01 — 제네릭 리듀서의 UPDATE 는 모르는 키의 행을 추가한다(upsert): payload.new 가 전체 행이라 안전하고 재연결 틈에 놓친 INSERT 를 복구한다. 변경 스트림이 순서를 보장해 DELETE 뒤 같은 키의 UPDATE 로 되살아나는 일은 없다(05-REVIEW IN-02)
- [Phase 6]: 06-01 — 후보 정렬을 candidates.created_at → restaurants.created_at → 매장 id 3단으로 두고 SQL 은 바꾸지 않았다: 자정 재시드가 한 문장 insert 라 첫 키가 전부 동률이고 두 번째 키가 핀을 꽂은 순서를 복원한다(todo wr-02 닫음)
- [Phase 6]: 06-01 — 당첨은 restaurant_id 로만 찾고 이름 폴백을 두지 않는다: 이름으로 되찾으면 동명 매장이 당첨으로 오인되고 컷오버 전 구 결과는 메뉴명이라 매장과 맞을 수 없다. null 이면 -1 로 떨어져 휠 하이라이트만 사라진다
- [Phase 6]: 06-01 — 담기 중 23505 는 에러가 아니라 null 이다: 두 사람이 같은 매장을 동시에 담은 것이고 원하던 상태가 이미 됐으므로 호출부가 성공으로 처리한다. 빼기에는 같은 논증이 서지 않아 일반 실패 문장으로 떨어진다
- [Phase 6]: 06-01 — parseMenuInput·truncateToCodePoints 를 lib/menus.ts 로 옮겨 lib/ → components/ 단방향 예외가 코드에서 사라졌다. 재수출은 두지 않는다(정의처가 둘로 보이면 안 된다). 문서 2곳(CLAUDE.md·STRUCTURE.md)의 예외 문단은 06-02 가 지운다
- [Phase 6]: 06-02 — 오늘 탭이 훅 2개(useRestaurants 무변경 + useCandidates 신규)로 읽고 조인은 클라이언트 순수 함수가 한다: candidates 행은 키와 시각뿐이라 Realtime 페이로드만으로 매장명을 알 수 없고, 카탈로그는 토글 목록 때문에 어차피 전부 필요하다. 훅은 읽기 전용이고 담기·빼기는 페이지 핸들러가 직접 부른다
- [Phase 6]: 06-02 — applyResult 가 todayResultRef(상태 거울)를 읽고 나서 쓰고 isNewSpin 으로 판정해 추첨 시각이 같은 결과 UPDATE 를 걸러 낸다: 매장 삭제가 내보내는 on delete set null 갱신으로 열린 모든 탭의 휠이 5초씩 돌던 경로가 닫혔다(todo in-06). INSERT → UPDATE 순서와 initialLoadedRef 의 의미는 그대로다
- [Phase 6]: 06-02 — 화면 추첨 시각 문구를 전부 기본값 없는 필수 prop 으로 내렸다(Wheel·ResultBlock·CandidateList·PhaseTimeline·phaseSubhead): 기본값이 있으면 배선을 잊은 호출부가 조용히 옛 값을 그린다. ResultBlock 의 spinTime = "11:55" 기본값이 정확히 그 함정이었고, 화면에 보이는 리터럴이 0곳이 됐다(SPIN-06)
- [Phase 6]: 06-02 — 수명이 끝난 임시 계약 spec 은 삭제가 아니라 반대 기대로 뒤집는다: 마이그레이션 계약 #42("MenuRow·PinnedMenuRow 가 아직 남아 있다", 주석에 "제거는 Phase 6")를 [0,0] 기대로 바꿔 테스트 건수 354 를 유지하면서 구 타입이 되돌아오면 걸리는 가드로 만들었다

### Pending Todos

`.planning/todos/pending/` 에 **3건** (2026-09-29 06-REVIEW 수정 후 실측 — 06-02 가 접은 4건을 `git rm` 으로 지웠고, 06-REVIEW 가 1건을 더했다):

- `wr-01-cutover-window.md` — 컷오버 창(SQL → 배포 → 머지) 체크리스트. 04-04 가 **7번(임베드 함정 수동 invoke 확인)** 을 추가했다 → Phase 8
- `in-05-history-since-same-day.md` — 전환일 당일 `results`(`restaurant_id` null)를 기록·랭킹이 어떻게 다룰지 → Phase 7
- `in-07-realtime-resync-on-reconnect.md` — 조회를 `subscribe` 상태 콜백 안으로 옮겨 구독 전 창·재연결 뒤 재조회 공백을 닫을지. `lib/rowset.ts` 의 `fetched` 중복 응답 가드(D-04)를 뒤집는 결정이라 **컷오버 전에 결정만** 한다 (06-REVIEW WR-02 [설계 재논의]) → Phase 8

접힌 4건(2026-09-29, 06-02 Task 3 에서 `git rm`): `wr-02-pinned-reseed-order.md`(→ 06-01 의 3단 정렬) · `in-02-settings-loaded-first-paint.md`(→ `displayPhase`) · `in-03-usesettings-branches-to-reducer.md`(→ 훅 분기 0개) · `in-06-results-update-on-delete-set-null.md`(→ `isNewSpin` 회전 가드).

### Blockers/Concerns

- **로컬 Supabase 스택이 없다.** 마이그레이션·Edge Function 실행 경로는 컷오버 전까지 정적 검토(`deno check`, 파일 리뷰)로만 검증된다. 전환의 최대 리스크 증폭기.
- **Edge Function 의 정적 검사는 `npm run check:edge`(deno check) 하나뿐이다.** tsc·eslint 제외는 함수 디렉터리 2개로 좁혀졌고(`_shared/**` 는 3중 검사) 두 `index.ts` 는 `deno check` + 계약 테스트 50건이 본다 — eslint 는 여전히 못 보고, 동작은 컷오버 전까지 아무도 못 본다.
- **`spin-roulette`는 사전 검증 불가.** 시각 가드 때문에 컷오버 시 `respin-roulette` 수동 invoke로 새 스키마 경로를 대신 확인해야 한다.
- **`npm run dev`는 가드런처로만.** 과거 커널 패닉 이력. 재발 시 `rm -rf .next`.
- **`.serena/project.yml`은 커밋 금지** (serena가 매번 재포맷).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | 모바일 레이아웃 + 눈에 보이는 결함 3건 | 2026-09-30 | 9bd13c6 | [001-mobile-layout](./quick/001-mobile-layout/) |

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-09-29T03:57:33.131Z
Stopped at: Phase 6 review fixes applied - ready for phase.complete
Resume file: None
