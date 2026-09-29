# Roadmap: lunch_roulette — 매장 기준 룰렛 전환 + 설정 테이블

## Overview

매일 쓰이는 라이브 앱의 추첨 단위를 "자유 입력 메뉴명"에서 "매장 카탈로그"로 바꾸고, 추첨 시각·쿨다운·전환일을 DB `settings` 한 곳으로 모은다. 라이브는 **마지막 한 번의 컷오버까지 건드리지 않는다** — 그 전까지 모든 작업은 `feat/restaurant-roulette` 브랜치에서 `tsc`·`lint`·`test`·`build`로만 검증한다. 순서는 의존 방향을 그대로 따른다: 먼저 안전망(테스트 러너 + 모델과 무관한 수정)을 깔고, 그 위에 스키마와 타입을 확정하고, 순수 로직(시각 판정·쿨다운·KST)을 한 곳으로 모아 테스트로 고정한 뒤, 그 로직을 Edge Function에 배선하고, 마지막에 UI 세 계층(매장 탭 → 오늘 탭 → 기록·랭킹)을 올린다. 8번째 페이즈가 문서 현행화와 단일 컷오버다.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: 안전망** - vitest 도입 + 모델과 무관한 선행 수정(next 범프, 읽기 에러 표면화) (completed 2026-09-18)
- [x] **Phase 2: 데이터 모델** - `restaurants`·`candidates`·`settings` 컷오버 마이그레이션 1파일 + TS 타입 (completed 2026-09-21)
- [x] **Phase 3: 순수 로직** - 추첨 시각·쿨다운·KST를 주입 가능한 단일 출처로 모으고 테스트로 고정 (completed 2026-09-21)
- [x] **Phase 4: 서버 추첨** - Edge Function 2종을 새 스키마·설정·쿨다운 위에서 재작성 (completed 2026-09-28)
- [x] **Phase 5: 매장 탭** - 카탈로그 등록·수정·삭제·핀 UI (completed 2026-09-29)
- [x] **Phase 6: 오늘 탭** - 카탈로그 토글 후보 선택 + 매장 결과 표시 (completed 2026-09-29)
- [x] **Phase 7: 기록·랭킹** - 전환일 이후 결과만 매장 기준으로 표시·집계 (completed 2026-09-29)
- [ ] **Phase 8: 컷오버** - 문서 현행화 + 마이그레이션·배포·머지·롤백 절차 1회 실행

## Phase Details

### Phase 1: 안전망
**Goal**: 앞으로의 모든 변경을 로컬에서 되돌아볼 수 있는 검증 장치를 먼저 깐다. 새 데이터 모델에 전혀 의존하지 않는 작업만 담는다.
**Depends on**: Nothing (first phase)
**Requirements**: QUAL-01, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. `npm test`가 vitest를 실행하고 `lib/time.ts`·`lib/phase.ts`·`parseMenuInput` 단위 테스트가 전부 통과한다 — 환경변수 없이 import 되도록 `MENU_NAME_MAX_LEN` 등 상수를 `lib/supabase/client.ts` 밖으로 분리한 상태로.
  2. `next`·`eslint-config-next`가 16.3.5이고 `npm audit`에 critical·high가 0이다.
  3. 오늘·기록·랭킹 3개 페이지에서 초기 SELECT가 실패하면 빈 화면 대신 한국어 에러 배너가 뜬다.
  4. 라이브 DB·Edge Function·`main` 브랜치가 이 페이즈 동안 전혀 바뀌지 않는다.
**로컬 검증**: `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` · `npm audit`. vitest 설정에도 `design/**`·`supabase/functions/**` 제외를 넣어 인덱서 OOM 전례를 재발시키지 않는다.
**Plans**: 4 plans (3 waves)
- [x] 01-01-PLAN.md — next·eslint-config-next 16.3.5 범프, audit critical·high 0 (wave 1)
- [x] 01-02-PLAN.md — 오늘·기록·랭킹 초기 SELECT 에러 배너 + 공용 ErrorBanner (wave 1)
- [x] 01-03-PLAN.md — vitest 하네스 + lib/time·lib/phase·lib/errors 단위 테스트 (wave 2)
- [x] 01-04-PLAN.md — parseMenuInput 10케이스 회귀 테스트 + MENU_NAME_MAX_LEN 상수 분리 (wave 3)

### Phase 2: 데이터 모델
**Goal**: 매장·후보·설정 스키마를 재실행 가능한 마이그레이션 한 파일과 수동 유지 TS 타입으로 확정한다. 파일만 쓰고 적용은 하지 않는다(적용은 Phase 8).
**Depends on**: Phase 1 (타입 변경을 붙잡을 테스트 러너)
**Requirements**: SHIP-01, SETT-01, CATL-07, CAND-04, HIST-03
**Success Criteria** (what must be TRUE):
  1. 마이그레이션 파일 1개가 `restaurants`(이름 unique·메뉴·위치·핀 플래그), `candidates`, `settings`(단일행 `id = 1` check, 기본값 `spin_time` 11:55 · `cooldown_days` 0 · `history_since`)를 만들고, RLS(익명 쓰기 개방 / `settings`는 anon select만 / `results`는 service_role만)와 `alter publication supabase_realtime add table` 3건을 함께 건다.
  2. 같은 파일이 cron 잡을 "unschedule → 재등록" 패턴으로 교체한다(3잡: 추첨 매분 폴링, 자정 리셋 `delete from public.candidates` + 핀 매장 재시드, `purge-cron-history` 7일 보관 정리 — D-14) — `truncate`가 파일에 0회 등장한다.
  3. 파일 어디에도 `results` 기존 행을 삭제·변환하는 문장이 없고, 구 테이블(`menus`·`pinned_menus`) 제거는 파일의 마지막 단계에 온다.
  4. `lib/supabase/client.ts`의 행 타입이 새 스키마를 반영하고(`RestaurantRow`·`CandidateRow`·`SettingsRow`, `ResultRow.restaurant_id` nullable FK, `results.menu`는 매장명 스냅샷 유지) `npx tsc --noEmit`이 통과한다.
  5. 마이그레이션을 두 번 실행해도 안전하다 — 모든 문이 `if not exists` / `drop ... if exists` / unschedule 후 재등록 중 하나를 쓴다.
**로컬 검증**: 마이그레이션은 로컬 Supabase 스택이 없어 적용해 볼 수 없다. 파일 낭독 리뷰 + 위 5개 항목 체크리스트(`grep truncate`, `grep results` 포함) + `npx tsc --noEmit`으로 확인한다. 프로젝트 ref 하드코딩(`0002_cron.sql` 선례)은 주석으로 계산식을 남긴다.
**Plans**: 3 plans (3 waves)
- [x] 02-01-PLAN.md — vitest 수집 경계에 마이그레이션 계약 스펙 추가 (wave 1)
- [x] 02-02-PLAN.md — 계약 스펙 RED → 0005 마이그레이션 + 행 타입 GREEN (wave 2)
- [x] 02-03-PLAN.md — 낭독 리뷰 11항목·검증 맵·게이트 5종·사용자 승인 (wave 3)

### Phase 3: 순수 로직
**Goal**: 추첨 시각 판정·쿨다운 필터·KST 변환을 주입 가능한 순수 함수 한 곳으로 모으고, 테스트로 계약을 고정한다. 하드코딩 상수와 복붙을 이 페이즈에서 끝낸다.
**Depends on**: Phase 2 (새 스키마 타입), Phase 1 (테스트 러너)
**Requirements**: SETT-02, SETT-03, SPIN-02, SPIN-03, QUAL-02
**Success Criteria** (what must be TRUE):
  1. `supabase/functions/_shared/`에 `kst.ts`(`kstNow`·`pickRandom`)·`spinTime.ts`(`"HH:MM"` 파싱·시각 경과 판정)·`cooldown.ts`가 Deno 전용 import 없이 존재하고 vitest가 직접 import 해 테스트한다. `kstNow` 정의가 레포 전체에 1곳뿐이다.
  2. 쿨다운 필터 테스트가 세 경로를 덮고 통과한다: `cooldown_days = 0`(필터 없음) / 최근 N일 당첨 매장 제외 후 후보 남음 / 제외하면 0개라 전체 후보로 폴백.
  3. `lib/phase.ts`가 추첨 시각을 인자로 주입받고, "결과 행이 없는데 시각은 지났다"를 `decided`가 아닌 별도 상태로 판정한다 — 경계값(직전·정각·애니메이션 종료 후) 테스트가 통과한다.
  4. 설정 로딩 헬퍼가 로드 전·실패 시 기본값(11:55, 쿨다운 0)을 돌려주고, `settings` UPDATE 이벤트를 상태에 병합하는 순수 리듀서에 테스트가 있다.
**로컬 검증**: `npm test`(위 4개 영역 전부) · `npx tsc --noEmit` · `npm run lint`. `_shared/`는 tsc/eslint 제외 경로 안에 있으므로 vitest include에만 명시적으로 넣는다.
**Plans**: 3 plans (3 waves)
- [x] 03-01-PLAN.md — D-12 제외 좁히기 + `_shared` 순수 모듈 3종·spec 4개 + Edge Function import 교체 (wave 1)
- [x] 03-02-PLAN.md — `lib/time.ts` 재수출·`hourCycle` + `lib/phase.ts` 4상태 재작성 + `Phase` 소비처 9곳 전환 (wave 2)
- [x] 03-03-PLAN.md — `lib/settings.ts` 리듀서 + `useSettings` 훅 + 세 페이지 배선 + D-16 문서 현행화 (wave 3)

### Phase 4: 서버 추첨
**Goal**: 두 Edge Function이 새 스키마·`settings`·쿨다운 위에서 결과를 확정하도록 재작성한다. 배포는 하지 않는다(Phase 8).
**Depends on**: Phase 3 (`_shared` 순수 로직)
**Requirements**: SPIN-01, SPIN-04, SETT-04
**Success Criteria** (what must be TRUE):
  1. `spin-roulette`가 하드코딩 시각 대신 `settings.spin_time`을 읽어 판정하고, 매분 호출 전제에서 하루 1회만 결과를 만든다 — 기존 결과가 있으면 skip, unique 위반(`23505`)은 정상 경로로 처리한다.
  2. 두 함수 모두 `candidates` → `restaurants` 조인으로 후보를 읽고, `_shared` 쿨다운 필터를 통과한 목록에서 뽑아 `results`에 매장명 스냅샷과 `restaurant_id`를 함께 쓴다. 다시 돌리기는 횟수 제한 없이 덮어쓴다.
  3. 후보가 0개면 결과 행을 만들지 않고 `no_candidates`로 끝난다 — 이후 후보를 담으면 다음 폴링에서 추첨된다.
  4. 기본 설정(11:55·쿨다운 0)에서 두 함수의 판정 결과가 전환 전 동작과 동일함을 보이는 테스트가 통과한다.
  5. `deno check`가 두 함수에서 통과하고, CORS 헤더·OPTIONS 단락·`verify_jwt = false` 설정이 유지된다.
**로컬 검증**: `deno check supabase/functions/spin-roulette/index.ts` · `.../respin-roulette/index.ts`(tsc·eslint 사각지대라 이것이 유일한 정적 검사) + `_shared` 단위 테스트. 실제 호출 검증은 Phase 8 컷오버에서 `respin-roulette` 수동 invoke로 한다.
**Plans**: 4 plans (4 waves)
- [x] 04-01-PLAN.md — `npm run check:edge` 정적 게이트(`deno.json`·`deno.lock`) + `ResultRow.candidates` 확장 + 계약 26건 RED (wave 1)
- [x] 04-02-PLAN.md — `spin-roulette` 재작성: `candidates`⋈`restaurants`·`settings`·쿨다운·`json()`·콘솔 에러 (wave 2)
- [x] 04-03-PLAN.md — `respin-roulette` 재작성 + `formatRespinError` + `respin()` 500 본문 표면화 (wave 3)
- [x] 04-04-PLAN.md — D-17 문서 정정·컷오버 체크리스트 7번 추가 + 페이즈 게이트 5종 (wave 4)

### Phase 5: 매장 탭
**Goal**: 익명 누구나 매장 카탈로그를 관리하는 새 탭이 생긴다. 오늘 탭과 분리해 오늘 탭을 후보 선택만으로 가볍게 유지한다.
**Depends on**: Phase 2 (스키마·타입), Phase 1 (테스트 러너). Phase 3·4와 병렬 진행 가능
**Requirements**: CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06
**Success Criteria** (what must be TRUE):
  1. 사용자는 매장 탭에서 이름(필수, 1~24자)·메뉴 목록·위치(한 줄 텍스트, URL이면 링크)를 입력해 매장을 등록한다. 메뉴는 쉼표(반각·전각)로 여러 개를 한 번에 넣는다.
  2. 사용자는 등록된 매장의 이름·메뉴·위치를 수정하고, 필요 없는 매장을 삭제한다. 삭제해도 과거 결과의 매장명 표시는 남는다.
  3. 사용자는 매장을 핀/해제하고 핀 상태가 목록에 보인다.
  4. 한 탭의 등록·수정·삭제·핀 변경이 다른 접속자 화면에 Realtime으로 반영된다(INSERT/UPDATE/DELETE 3분기 + 구독 해제).
  5. 쓰기 실패(중복 이름 포함)가 빈 화면이나 raw Postgres 에러 대신 한국어 배너로 뜬다.
**로컬 검증**: `npm run dev`(가드런처)로 폼·목록·핀 UI 렌더와 상호작용 확인 + `parseMenuInput` 재사용 테스트 + `tsc`/`lint`/`test`/`build`. 라이브 DB에 실제 등록하는 검증은 하지 않는다(라이브 오염). 기존 컨벤션 유지: 전부 클라이언트 컴포넌트, inline style + CSS 변수 토큰, `~Action` 콜백 접미사, named export.
**Plans**: 2 plans (2 waves)
- [x] 05-01-PLAN.md — 순수 로직: `lib/restaurants.ts`(폼 검증·정렬·링크 판정·Realtime 리듀서) + `lib/constants.ts` 상수 2개 + `formatRestaurantWriteError` + 코드포인트 절단(todo wr-01) · spec 45건 (wave 1)
- [x] 05-02-PLAN.md — UI 배선: `lib/useRestaurants.ts`(3분기 구독) + `components/RestaurantList.tsx` + `app/restaurants/page.tsx`(쓰기 4종) + `TopBar` 탭 + D-19 문서 정정·CATL 마킹 (wave 2)
**UI hint**: yes

### Phase 6: 오늘 탭
**Goal**: 오늘 탭이 자유 입력 대신 카탈로그 토글로 후보를 담고, 결과가 매장으로 뜬다. 화면의 추첨 시각 문구가 전부 `settings`를 따른다.
**Depends on**: Phase 5 (카탈로그 목록·구독 패턴), Phase 3 (설정 훅·페이즈 로직)
**Requirements**: CAND-01, CAND-02, CAND-03, CAND-05, SPIN-05, SPIN-06
**Success Criteria** (what must be TRUE):
  1. 사용자는 오늘 탭에서 카탈로그 전체 목록을 보고 토글로 오늘 후보에 담고 뺀다. 담긴 매장만 휠에 올라간다.
  2. 사용자는 이름 필터 입력으로 카탈로그 목록을 좁힌다.
  3. 후보 담기·빼기가 다른 접속자에게 Realtime으로 반영되고, 오늘 결과가 확정된 뒤에는 토글이 잠긴다.
  4. 결과 화면에 당첨 매장명과, 있으면 그 매장의 메뉴 목록·위치가 참고로 표시된다. 매장이 삭제돼도 결과의 매장명은 남는다.
  5. 휠·페이즈 뱃지·타임라인·안내 문구가 `settings.spin_time`을 따르고, 코드에 하드코딩된 `11:55` 문자열이 0곳이다.
**로컬 검증**: `npm run dev` 렌더 확인 + 후보 필터·`winnerIndex` 파생(id 기준 매칭) 단위 테스트 + `rg '11:55' app components lib supabase`가 마이그레이션 기본값 외에 0건 + `tsc`/`lint`/`test`/`build`. realtime 핸들러 순서와 `initialLoadedRef` 가드는 휠 이중 회전 지점이므로 구조를 유지한 채 테이블명만 교체한다.
**Plans**: 2 plans (2 waves)
- [x] 06-01-PLAN.md — 순수 로직: `lib/rowset.ts` 제네릭 목록 리듀서 + `lib/candidates.ts`(조인 3단 정렬·이름 필터·당첨 인덱스·새 추첨 판정) + `lib/menus.ts` 이전(단방향 예외 해소) + `displayPhase`·`formatSpinTime`·`formatCandidateWriteError` + 훅 3개 액션 이관 · spec 354건 (wave 1)
- [x] 06-02-PLAN.md — UI 배선: `lib/useCandidates.ts` + `CandidateList`·`MenuChips`·`LocationLink` + `app/page.tsx` 전환(`isNewSpin` 가드·`results-<n>`) + 화면 `11:55` 제거 + `MenuList` 삭제 + D-28 문서 정정·CAND/SPIN 마킹 (wave 2)
**UI hint**: yes

### Phase 7: 기록·랭킹
**Goal**: 기록 캘린더와 랭킹이 전환일 이후 결과만 매장 기준으로 보여준다. 과거 60행은 DB에 남되 집계에서 빠진다.
**Depends on**: Phase 3 (설정 훅), Phase 2 (`history_since` 컬럼)
**Requirements**: HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. 기록 캘린더가 `settings.history_since` 이후 결과만 매장명으로 표시하고, 그 이전 날짜는 비어 있다.
  2. 랭킹이 전환일 이후 결과만 매장 기준으로 집계한다 — 같은 매장이 레거시 이름과 매장 id로 갈라져 두 줄로 뜨지 않는다.
  3. 두 페이지가 결과 INSERT/UPDATE와 `settings` 변경(전환일 포함)을 Realtime으로 반영한다.
  4. `buildRanking`·`buildMonthGrid`가 export 되어 전환일 경계·동점 정렬·월 경계 케이스가 단위 테스트로 고정된다.
**로컬 검증**: `npm test`(전환일 경계·집계) + `npm run dev` 렌더 확인 + `tsc`/`lint`/`build`. 랭킹의 무제한 `select("*")`는 이 페이즈에서 컬럼·기간을 좁혀 PostgREST 행 상한 리스크를 같이 줄인다.
**Plans**: 1 plan (1 wave)
- [x] 07-01-PLAN.md — `lib/history.ts`(`filterSince`·`buildRanking` 키 `restaurant_id ?? menu`·`buildMonthGrid`) + spec 20 · `app/log`·`app/rank` 전환일 필터·랭킹 조회 좁힘·토픽 `results-log/rank-<n>` · `formatHhMm` 삭제 · todo in-05 종결 · HIST-01/02 마킹 (wave 1)
**UI hint**: yes

### Phase 8: 컷오버
**Goal**: 문서를 현행화하고, 롤백 절차를 먼저 적어 둔 뒤 한 번의 컷오버로 라이브를 새 모델로 넘긴다.
**Depends on**: Phase 4, Phase 6, Phase 7 (전부 완료)
**Requirements**: SHIP-02, SHIP-03, SHIP-04, QUAL-05
**Success Criteria** (what must be TRUE):
  1. `CLAUDE.md`·`README.md`가 현행 스키마(`restaurants`·`candidates`·`settings`·`results`), Edge Function 2종, 검증 명령(`npm test` 포함), 새 컨벤션(설정은 `settings` 단일 소스, Edge Function 순수 로직은 `_shared`, 마이그레이션 동작불변 기본값)을 정확히 기술한다 — 매퍼가 찾은 낡은 진술 4건이 남아 있지 않다.
  2. 롤백 절차가 문서화된다: 구 테이블(`menus`·`pinned_menus`) 복원 SQL, 구 cron 재등록 SQL, 이전 Edge Function 재배포 방법, 되돌리는 판단 기준.
  3. 배포 체크리스트가 순서대로 문서화된다: `results` 덤프 보관 → 마이그레이션(사용자가 대시보드 SQL Editor) → Edge Function 2개 `functions deploy` → PR 머지(Vercel 자동) → 라이브 확인.
  4. `tsc`·`lint`·`test`·`build`가 전부 통과한 상태로 PR이 열려 있고, 커밋·PR에 AI 표기가 없다.
  5. 컷오버 후 라이브에서 매장 등록 → 후보 담기 → 다시 돌리기가 매장 결과로 확정되고, 과거 `results` 60행이 그대로 남아 있다.
**로컬 검증**: 이 페이즈만 라이브를 건드린다. 마이그레이션 적용은 사용자가 대시보드에서 수행(Claude는 원격 SQL 실행 차단). `spin-roulette`는 시각 가드 때문에 사전 검증이 불가능하므로 `respin-roulette` 수동 invoke로 새 스키마 경로를 먼저 확인한 뒤 PR을 머지한다.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
(Phase 5는 Phase 3·4와 의존이 없어 병렬 진행 가능)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 안전망 | 4/4 | Complete    | 2026-09-18 |
| 2. 데이터 모델 | 3/3 | Complete    | 2026-09-21 |
| 3. 순수 로직 | 3/3 | Complete    | 2026-09-21 |
| 4. 서버 추첨 | 4/4 | Complete    | 2026-09-28 |
| 5. 매장 탭 | 2/2 | Complete    | 2026-09-29 |
| 6. 오늘 탭 | 2/2 | Complete    | 2026-09-29 |
| 7. 기록·랭킹 | 1/1 | Complete    | 2026-09-29 |
| 8. 컷오버 | 0/TBD | Not started | - |

## Coverage

v1 요구사항 34개 전부가 정확히 한 페이즈에 매핑됐다. 상세 표는 `.planning/REQUIREMENTS.md`의 Traceability 섹션.

| Phase | Requirements | 개수 |
|-------|--------------|------|
| 1 | QUAL-01, QUAL-03, QUAL-04 | 3 |
| 2 | SHIP-01, SETT-01, CATL-07, CAND-04, HIST-03 | 5 |
| 3 | SETT-02, SETT-03, SPIN-02, SPIN-03, QUAL-02 | 5 |
| 4 | SPIN-01, SPIN-04, SETT-04 | 3 |
| 5 | CATL-01, CATL-02, CATL-03, CATL-04, CATL-05, CATL-06 | 6 |
| 6 | CAND-01, CAND-02, CAND-03, CAND-05, SPIN-05, SPIN-06 | 6 |
| 7 | HIST-01, HIST-02 | 2 |
| 8 | SHIP-02, SHIP-03, SHIP-04, QUAL-05 | 4 |
| | **합계** | **34** |

---
*Roadmap created: 2026-09-18*
