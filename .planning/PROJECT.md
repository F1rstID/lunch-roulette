# lunch_roulette — 매장 기준 룰렛 전환 + 설정 테이블

## What This Is

로그인 없이 팀원 누구나 쓰는 점심 룰렛. 지금은 "메뉴명"을 자유 입력해 후보를 쌓고 매일 11:55 KST에 서버가 자동 추첨한다. 이번 작업으로 추첨 단위를 **매장**으로 바꾼다: 매장 카탈로그(이름 필수, 메뉴·위치 선택)를 영구 보관하고, 오늘 후보는 카탈로그에서 골라 담으며, 룰렛은 매장을 뽑는다. 추첨 시각·쿨다운은 DB `settings` 한 곳에서 관리한다.

## Core Value

매일 11:55(또는 설정 시각)에 **오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.** 이게 깨지면 나머지는 의미 없다.

## Requirements

### Validated

<!-- 현 코드베이스가 이미 하고 있고 라이브에서 쓰이는 것. .planning/codebase/ARCHITECTURE.md 기준 -->

- ✓ 익명 누구나 오늘 후보 등록·삭제, Realtime으로 전 접속자 동기화 — existing
- ✓ 매일 11:55 KST pg_cron → Edge Function `spin-roulette` 자동 추첨, 멱등(같은 날 1회) — existing
- ✓ 결과 확정 시 휠 애니메이션 + 결과 표시, 페이즈(accepting/spinning/decided) 표시 — existing
- ✓ 다시 돌리기(`respin-roulette`, 무제한) — existing
- ✓ 고정(핀): 핀한 항목은 자정 초기화 후 자동 재등록 — existing (`pinned_menus`)
- ✓ 기록(캘린더)·랭킹 페이지, 결과 INSERT/UPDATE Realtime 반영 — existing
- ✓ 쉼표 구분 다중 등록 (`parseMenuInput`) — existing
- ✓ 클라이언트 쓰기 실패를 배너로 표면화 (`actionError`) — existing
- ✓ Vercel(main 자동배포) + Supabase 무료 티어 운영 — existing
- ✓ 3개 페이지 초기 SELECT 실패를 `ErrorBanner`로 표면화(`lib/errors.ts`, `loadError`≠`actionError`) — Phase 1
- ✓ `next`·`eslint-config-next` 16.3.5 + 비-force `npm audit fix` → audit 0 — Phase 1
- ✓ vitest 4.1.11 도입(`npm test`), `lib/time`·`lib/phase`·`lib/errors`·`parseMenuInput` 36 tests — Phase 1 (spin_time 파싱·쿨다운 테스트는 Phase 3)
- ✓ 컷오버 마이그레이션 `0005_restaurants_settings.sql` 작성(restaurants·candidates·settings, RLS, publication 3, cron 3잡, results.restaurant_id, 구 테이블 drop) + 계약 테스트 53건 + 행 타입 — Phase 2 (적용은 Phase 8)
- ✓ `settings` 단일행 스키마(spin_time 11:55·cooldown_days 0·history_since KST 적용일, anon select-only) — Phase 2
- ✓ `supabase/functions/_shared/{kst,spinTime,cooldown}.ts` 순수 모듈(import 0개, Deno·vitest·Next 삼중 호환) + 계약 테스트 62건, `kstNow` 단일 정의, 두 Edge Function 복붙 제거 — Phase 3 (QUAL-02)
- ✓ `lib/phase.ts` 추첨 시각 주입 + 4번째 상태 `stalled`(시각 경과·결과 없음 → UI 잠기지 않음, P1 클라이언트 반) + 소비처 9곳 `switch`+`never` — Phase 3 (SPIN-03)
- ✓ `settings` 로딩: `lib/settings.ts` 순수 리듀서(기본값 11:55·쿨다운 0, 로드 실패 `error`·파싱 실패 `warning` 분리) + `lib/useSettings.ts` 훅(인스턴스별 채널 토픽) 세 페이지 배선 — Phase 3 (SETT-02·03)
- ✓ tsc·eslint가 `_shared/` 포함(함수 디렉터리 2개만 제외), CLAUDE.md 7+1·CONVENTIONS.md 8줄 현행화 — Phase 3

### Active

**매장 모델**
- [ ] 매장 카탈로그(`restaurants`): 이름 필수, 메뉴 목록·위치 선택, 핀 플래그. 영구 보관, 자정에 안 지워짐
- [ ] 별도 "매장" 탭에서 익명 누구나 등록·수정·삭제·핀 토글
- [ ] 오늘 후보(`candidates`)는 카탈로그 목록에서 토글로 담고 뺌. 이름 필터. 핀 매장은 자정에 자동 후보
- [ ] 룰렛은 매장을 뽑는다. 결과 아래 그 매장의 메뉴 목록을 참고로 표시
- [ ] 기록·랭킹은 매장 기준. 집계는 **전환일 이후** 결과만. 과거 60행은 보존

**설정 테이블**
- [ ] 추첨 cron을 매분 폴링으로 바꾸고 함수가 `spin_time`을 읽어 판정. 하드코딩 11:55(11곳/8파일) 전부 제거
- [ ] 쿨다운: 최근 N일 당첨 매장은 후보에서 제외. 제외 후 후보가 비면 전체로 폴백 — 순수 필터 `_shared/cooldown.ts`(창 = 오늘 제외 `[today−N, today−1]`) Phase 3 완료, Edge 배선은 Phase 4

**품질·버그**
- [ ] P1: 추첨 시각에 후보 0개면 UI가 decided로 잠기고 다시돌리기 버튼이 안 뜨는 문제 수정 — 클라이언트 반(`stalled`) Phase 3 완료, 서버 반(결과 없음 → 다음 폴링 추첨) Phase 4
- [ ] P2: 자정 `truncate`가 Realtime DELETE를 안 내서 열린 탭에 어제 후보 잔존 → `delete from`으로

**문서·전환**
- [ ] `CLAUDE.md`·`README.md` 현행화 (config.toml 존재, pinned 테이블, lint 해결, 새 컨벤션: settings 단일 소스·`_shared` 모듈) — CLAUDE.md의 `_shared`·훅·검증 범위 항목은 Phase 3에서 반영, README·GSD 블록 잔여는 Phase 8
- [ ] 컷오버 1회: 마이그레이션(사용자가 대시보드 실행) → Edge Function 2개 배포 → PR 머지 → Vercel. 롤백 절차 문서화

### Out of Scope

- 다시 돌리기 하루 상한 — 사용자: 무한 재돌리기 OK. `respin_count` 컬럼도 안 만든다
- 2단 룰렛(매장 → 그 매장 메뉴 추첨) — 결과 모델 단순 유지. 메뉴는 참고 표시만
- 앱 안 설정 편집 UI — 익명 서비스라 전역값 트롤 위험. 대시보드로 충분
- 로그인·권한 — 익명 설계가 서비스 정체성. RLS 개방 유지
- 모바일 최적화 — 사용자가 모바일에서 안 씀
- 웹 푸시·슬랙 알림 — 회사 슬랙 아님, 푸시는 미선택
- pg_cron 트리거 재스케줄 — 매분 폴링이 더 단순(무료티어 한도 여유)
- 과거 results 60행을 매장으로 매핑 — 메뉴명↔매장 대응이 손실적. 전환일 필터로 대체
- 페이즈별 라이브 배포 — 사용자 선택: 마지막 한 번 컷오버. 그 전까지 라이브 불변

## Context

- 코드베이스 지도: `.planning/codebase/` 7문서(2026-09-18). 특히 `CONCERNS.md` 말미 "전환 리스크 7항목"과 `TESTING.md`의 vitest 도입 제약(`lib/supabase/client.ts`가 모듈 로드 시 `createClient` 실행 → 상수를 별도 모듈로 분리해야 테스트 import 가능)
- 라이브: Supabase `swxiqytyxjlcgubqlozk`(F1rstID Org), Vercel `lunch-roulette-umber.vercel.app`, GitHub `F1rstID/lunch-roulette`. 같은 이름의 다른 Supabase 프로젝트(`dtuwddiepnxygtotwglv`)가 다른 계정에 있음 — 배포 대상 혼동 주의
- 현 데이터: `results` 60행(메뉴명, 테스트값 "바나나" 3건 포함), `menus` 0, `pinned_menus` 0
- 직전 작업(2026-09-15~16): 온보딩 하드닝, 핀 메뉴, respin CORS 배포, 쉼표 다중등록. 모두 main 머지·라이브 반영
- settings 설계는 brainstorming 섹션 1까지 승인됨(단일행 타입 컬럼, `updated_at` 제외, `time` 타입, 동작 불변 기본값). 그 설계를 매장 모델 위로 옮긴다
- `CLAUDE.md`는 낡은 항목 4건 있음(코드맵이 확인). 이번에 현행화
- 결정 로그: `~/.gstack/projects/F1rstID-lunch-roulette/` (gstack-decision-search)

## Constraints

- **Tech stack**: Next.js 16 App Router, 전부 클라이언트 컴포넌트 + supabase-js 직접 호출, inline style 객체 + CSS 변수, `~Action` 콜백 접미사 — 기존 컨벤션 유지(`.planning/codebase/CONVENTIONS.md`). 새 페이지도 같은 구조
- **Compatibility**: 앱은 매일 쓰이는 라이브. 컷오버 전까지 라이브 DB·함수·main 불변. 작업은 브랜치 `feat/restaurant-roulette`. 컷오버 마이그레이션은 하위호환 순서(새 테이블 생성 → 데이터 이관 없음 → 구 테이블 제거)로 한 파일
- **Deploy**: 프로덕션 배포는 사용자 명시 지시 때만. DB 마이그레이션은 Claude가 원격 실행 못 함(보안 차단) → 사용자가 대시보드 SQL Editor. Edge Function은 git과 별개로 `npx supabase@2.117.0 functions deploy <name> --project-ref swxiqytyxjlcgubqlozk`. main 직접 푸시 금지, PR 경유
- **Security**: RLS는 익명 개방(menus 계열·restaurants·candidates 누구나 쓰기), `results` 쓰기 service_role만, `settings` anon select-only. 브라우저 호출 Edge Function은 CORS+OPTIONS 단락 필수(게이트웨이 미주입)
- **Testing**: vitest. Edge Function 순수 로직은 Deno import 없는 `supabase/functions/_shared/`에 두어 vitest가 직접 import. tsc/eslint는 함수 디렉터리 2개(`spin-roulette/**`·`respin-roulette/**`)만 제외하고 `_shared/`는 포함(Phase 3 D-12)
- **Dev**: `npm run dev`는 가드런처로만(과거 커널 패닉). 브라우저 실등록 테스트는 라이브 오염이라 생략
- **Commit**: 커밋·PR에 AI 표기 금지. `.serena/project.yml` 커밋 금지

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 룰렛 단위 메뉴명 → 매장 | 점심 결정의 실제 단위. 기록·랭킹이 이름 표기로 흩어지지 않음 | — Pending |
| 매장 전환 + settings를 한 gsd 프로젝트로 | 쿨다운·핀이 후보 정체성에 걸려 순서 의존. 합치면 한 세션 초과 | — Pending |
| 과거 results 보존, 집계는 전환일 이후 | 매핑 손실적, 삭제는 4개월 기록 손실 | — Pending |
| 결과 = 매장만, 메뉴는 참고 표시 | 결과 모델 단순 | — Pending |
| respin 상한 제외 | 사용자: 무한 OK | — Pending |
| 매장 관리 = 별도 탭 | 오늘 탭을 후보 선택만으로 가볍게 | — Pending |
| 후보 선택 = 카탈로그 목록 토글 + 이름 필터 | 카탈로그 규모 작음. 검색 UI는 과함 | — Pending |
| 컷오버 1회, 페이즈별 배포 없음 | 사용자 선택. 라이브는 매일 사용 중 | — Pending |
| settings 단일행 타입 컬럼(`id=1 check`) | CHECK 제약·타입 안전·SELECT 1회·realtime 1행. key-value·env 기각 | — Pending |
| 전환일도 settings 컬럼 | 동작 파라미터 단일 소스 원칙 유지, 상수 하드코딩 회피 | ✓ Good (0005 `history_since`) |
| restaurants DB 상한(D-19): name btrim·개행 금지, location ≤200, menus ≤30·원소 ≤24 | 리뷰 실측: anon 무제한 입력이 Realtime으로 전 탭 방송 | ✓ Good |
| 컷오버 창: 그날 결과 확정 후 SQL→함수 배포→PR 머지 연속 | 구 코드가 menus를 읽는 동안 SQL 적용 시 42P01·매분 500 | — Pending (Phase 8) |
| results.menu는 매장명 스냅샷 유지 + restaurant_id nullable FK | 매장 삭제해도 기록 무사, 과거 행과 스키마 공존 | — Pending |
| cron 매분 폴링 | 정적 스케줄로는 DB 시각 반영 불가. 하루 1440회 무료티어 여유 | — Pending |
| gsd Interactive / Standard / Parallel | 계획서 승인 게이트 유지, 8페이즈 | ✓ Good (Phase 1: 4플랜·검증 루프 2회·리뷰 1회로 완료) |
| vitest 4.1.11 정확 고정, 5.x 보류 | Node 25.6.1·@types/node 20과 engines/peer 불일치 | ✓ Good |
| `_shared` 모듈은 import 0개(type import 포함) | Deno는 상대 import에 `.ts` 확장자 요구, tsc(bundler)는 거부 — 서로 안 부르면 양쪽에서 컴파일. 게이트는 `edgeImports.test.ts` | ✓ Good (Phase 3, 실측) |
| `Phase`에 `stalled` 추가, `hasResult`가 시각보다 우선 | 시각만으로 decided 판정하면 후보 0개일 때 UI가 잠김(P1). 결과 행 존재가 진실 | ✓ Good (Phase 3) |
| 쿨다운 창 = 오늘 제외 `[today−N, today−1]`, 키는 `restaurant_id`(null 무시), 비면 전체 폴백 | 다시 돌리기가 오늘 당첨을 다시 뽑을 수 있음(현 동작 유지). 레거시 행은 매칭 불가 | — Pending (Phase 4 배선) |
| settings 상태 `error`(로드 실패)·`warning`(spin_time 파싱 실패) 분리 | 파싱 경고를 "불러오기 실패" 접두로 내보내면 거짓 문장. 배너는 완성 문장 그대로 | ✓ Good (Phase 3 리뷰 W-10) |
| Realtime 채널 토픽은 구독 인스턴스마다 고유(`settings-changes-<n>`) | realtime-js가 토픽으로 dedup + leave는 서버 ack까지 지연 → 라우트 전환 시 새 구독이 옛 인스턴스에 붙어 조용히 죽음 | ✓ Good (Phase 3 리뷰 WR-01, 소스 추적) |
| 컷오버 전 개발 중 "설정 불러오기 실패" 배너 상시 표시 = 정상 | 라이브에 `settings` 없음(PGRST205). 기본값으로 동작하며 에러는 삼키지 않음 | ✓ Good (Phase 3) |
| 워크트리 격리 끔(순차 실행) | node_modules·.env.local이 워크트리에 없어 build/tsc 불가, 이중 npm install 메모리 위험 | ✓ Good |
| 매퍼 발견 버그 4건 로드맵 포함 | P1은 라이브 장애급, P2는 후보 테이블 교체와 같은 자리 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-21 after Phase 3 (순수 로직) completion*
