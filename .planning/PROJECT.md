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
- ✓ `spin-roulette`·`respin-roulette` 를 `candidates`⋈`restaurants` 조인 + `settings.spin_time`/`cooldown_days` + `_shared/cooldown.ts` 위에서 재작성. 설정·쿨다운 조회 실패는 기본값 폴백 + `console.error` + 응답 boolean(`settings_fallback`·`cooldown_fallback`·`cooldown_skipped`), 후보 0개는 `no_candidates`(행 없음 → 다음 폴링 재시도), 경합은 `23505`, respin 은 POST 전용·`upsert(onConflict: date)` — Phase 4 (SPIN-01·02·04, SETT-04). **미배포**(Phase 8)
- ✓ `npm run check:edge`(`deno check --config supabase/functions/deno.json`) 정적 게이트 + `jsr:@supabase/supabase-js@2.117.2` 핀 + `supabase/functions/deno.lock`. 텍스트 계약 58건(`edgeImports.test.ts`)이 형태를 고정 — Phase 4
- ✓ `respin()` 이 `invoke()` 반환의 `response` 로 500 본문을 읽어 함수 문장을 배너에 표시(`lib/errors.ts` `formatRespinError`, `{error}`→`{message}`→fallback, 200자 상한). 페이즈 마감 시 234 tests / 10 files — Phase 4
- ✓ 매장 탭 `/restaurants`: 카탈로그 등록(이름·쉼표 메뉴·위치)·행 인라인 편집·2단계 인라인 삭제 확인·📌 즉시 토글, Realtime 3분기(`lib/useRestaurants.ts` 읽기 전용 훅 + `lib/restaurants.ts` 순수 리듀서 — 조회 전 이벤트는 `pending` 버퍼로 재적용), 정렬 핀 먼저·이름순, 쓰기 실패·중복(23505)·0행 수정/삭제를 한국어 배너로. TopBar 순서 오늘·매장·기록·랭킹 — Phase 5 (CATL-01~06). **미배포**(Phase 8), 컷오버 전 라이브에선 배너+빈 목록이 정상
- ✓ `parseMenuInput`·`addMenus` 절단을 코드포인트 기준으로(todo wr-01), `parseRestaurantForm` 이 DB check(0005)와 1:1, 위치 링크는 `http(s)` 화이트리스트만 `<a>`. 페이즈 마감 시 296 tests / 11 files — Phase 5
- ✓ 오늘 탭이 `candidates`⋈`restaurants` 로 후보를 읽는다: `lib/useCandidates.ts`(INSERT/DELETE 2분기) + `lib/useRestaurants.ts` 두 훅 + `lib/candidates.ts` 순수 조인(3단 정렬 candidates.created_at → restaurants.created_at → id, todo wr-02)·이름 필터(NFC·소문자)·`findWinnerIndex`(id 만)·`isNewSpin`(spun_at 동일 → 휠 안 돎, todo in-06). `components/CandidateList.tsx` 단일 목록 토글(담긴 매장이 휠 순서로 위 + 배지, 안 담긴 매장 흐리게, 필터·잠금·행 단위 busy). 결과는 이름 스냅샷 + 현재 카탈로그의 메뉴 칩·위치 링크(`MenuChips`·`LocationLink` 공유). `MenuList`·`MenuRow`·`PinnedMenuRow` 삭제 — Phase 6 (CAND-01·02·03·05, SPIN-05). **미배포**(Phase 8), 컷오버 전 라이브에선 배너 3개 + 빈 휠·목록이 정상
- ✓ 화면의 `11:55` 리터럴 0곳: `formatSpinTime(settings.spinTime)` 을 `Wheel`·`ResultBlock`·`PhaseTimeline`(결과 단계 = 추첨 시각 + 5분, 24h 순환)·`CandidateList`·헤드라인 문구에 prop 으로, `app/layout.tsx` description 은 시각 제거. `displayPhase(phase, settings.loaded)` 로 설정 로드 전 `stalled` 라벨 깜빡임 제거(4 페이지, todo in-02) — Phase 6 (SPIN-06)
- ✓ 목록 리듀서 일반화 `lib/rowset.ts`(`createRowSetReducer(keyOf)`, pending 버퍼·UPDATE upsert·`fetched` error 우선) 를 `restaurants`·`candidates` 가 공유, `settings`·훅 3개의 조회 판정도 리듀서로(todo in-03), `parseMenuInput`·`truncateToCodePoints` → `lib/menus.ts`(단방향 예외 해소). 리뷰 CR-01: results 토픽을 구독 effect 안에서 매겨 자정 `todayKey` 재구독이 죽지 않게. 페이즈 마감 시 361 tests / 13 files — Phase 6
- ✓ 기록·랭킹이 `settings.history_since` 이후(당일 포함) 결과만 매장 기준으로: `lib/history.ts`(`filterSince` · `buildRanking` 키 `restaurant_id ?? menu`, 이름은 최근 스냅샷 · `buildMonthGrid`) spec 22건(리뷰 WR-03 경계 2건 포함), `RankingView`·`CalendarLog` 는 호출만. 랭킹 조회는 설정 로드 뒤 `.gte("date", min(history_since, 오늘))` + 컬럼 4개, 기록은 월 창 + 필터. 토픽 `results-log/rank-<n>`. `formatHhMm` 삭제, todo in-05 는 컷오버 절차 8번(`history_since + 1`)으로. 페이즈 마감 시 380 tests / 14 files — Phase 7 (HIST-01·02).
- ✓ 컷오버 준비: `supabase/rollback/0005_restaurants_settings.rollback.sql`(0005 역순, 데이터 파기 없음, spec 10건) · README 전면 개정(4테이블·RLS·cron 3종·함수 2종·검증 명령 5종·컷오버 절차 0~9·롤백 기준/순서) · CLAUDE.md 컷오버 문장 · 보안감사 5~7 SECURED 8/8 · PR #4(https://github.com/F1rstID/lunch-roulette/pull/4, 게이트 5종 green, 392 tests, AI 표기 0) — Phase 8 (SHIP-02·03·04, QUAL-05). **라이브 컷오버는 사용자가 README 절차로 실행** — 성공 기준 5(라이브 확인)는 그 뒤 컷오버 전 라이브에선 기록은 전체 기간 표시(현행과 동일), 랭킹은 `results.restaurant_id` 부재로 42703 배너(0005 적용 뒤 동작)

### Active

**매장 모델**
- [x] 매장 카탈로그(`restaurants`): 이름 필수, 메뉴 목록·위치 선택, 핀 플래그. 영구 보관, 자정에 안 지워짐 — Phase 2(스키마)·Phase 5(UI) 완료
- [x] 별도 "매장" 탭에서 익명 누구나 등록·수정·삭제·핀 토글 — Phase 5 완료
- [x] 오늘 후보(`candidates`)는 카탈로그 목록에서 토글로 담고 뺌. 이름 필터. 핀 매장은 자정에 자동 후보 — Phase 6 완료(자정 재시드는 0005 cron)
- [x] 룰렛은 매장을 뽑는다. 결과 아래 그 매장의 메뉴 목록을 참고로 표시 — 서버 Phase 4, 화면 Phase 6 완료(이름은 스냅샷, 메뉴·위치는 현재 카탈로그)
- [x] 기록·랭킹은 매장 기준. 집계는 **전환일 이후** 결과만. 과거 60행은 보존 — Phase 7 완료(집계 키 `restaurant_id ?? menu`, 필터 정의처 `filterSince` 하나)

**설정 테이블**
- [x] 추첨 cron을 매분 폴링으로 바꾸고 함수가 `spin_time`을 읽어 판정 — cron 은 0005(Phase 2), 함수 판정은 Phase 4, 화면 문구는 Phase 6 완료. 남은 `11:55` 는 `_shared/spinTime.ts` 기본값 정의처와 DB 기본값(0002·0005)뿐(유지)
- [ ] 쿨다운: 최근 N일 당첨 매장은 후보에서 제외. 제외 후 후보가 비면 전체로 폴백 — 순수 필터 `_shared/cooldown.ts`(창 = 오늘 제외 `[today−N, today−1]`) Phase 3 완료, Edge 배선 Phase 4 완료(쿨다운 0이면 조회 생략). 실호출 확인은 Phase 8

**품질·버그**
- [x] P1: 추첨 시각에 후보 0개면 UI가 decided로 잠기고 다시돌리기 버튼이 안 뜨는 문제 수정 — 클라이언트 반(`stalled`) Phase 3, 서버 반(`no_candidates` → 행 없음 → 다음 폴링 추첨) Phase 4 완료. `stalled` 수동 버튼은 두지 않기로(Phase 6 D-19: 서버가 매분 폴링, 문구 "후보를 담으면 1분 안에 자동으로 뽑아요")
- [x] P2: 자정 `truncate`가 Realtime DELETE를 안 내서 열린 탭에 어제 후보 잔존 → `delete from`으로 — 0005 `reset-candidates`(Phase 2, CAND-04), 오늘 탭 DELETE 분기 배선 Phase 6

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
| 쿨다운 창 = 오늘 제외 `[today−N, today−1]`, 키는 `restaurant_id`(null 무시), 비면 전체 폴백 | 다시 돌리기가 오늘 당첨을 다시 뽑을 수 있음(현 동작 유지). 레거시 행은 매칭 불가 | ✓ Good (Phase 4 배선, `.gte/.lt` 창 계약 고정) |
| settings 상태 `error`(로드 실패)·`warning`(spin_time 파싱 실패) 분리 | 파싱 경고를 "불러오기 실패" 접두로 내보내면 거짓 문장. 배너는 완성 문장 그대로 | ✓ Good (Phase 3 리뷰 W-10) |
| Realtime 채널 토픽은 구독 인스턴스마다 고유(`settings-changes-<n>`) | realtime-js가 토픽으로 dedup + leave는 서버 ack까지 지연 → 라우트 전환 시 새 구독이 옛 인스턴스에 붙어 조용히 죽음 | ✓ Good (Phase 3 리뷰 WR-01, 소스 추적) |
| 컷오버 전 개발 중 "설정 불러오기 실패" 배너 상시 표시 = 정상 | 라이브에 `settings` 없음(PGRST205). 기본값으로 동작하며 에러는 삼키지 않음 | ✓ Good (Phase 3) |
| 워크트리 격리 끔(순차 실행) | node_modules·.env.local이 워크트리에 없어 build/tsc 불가, 이중 npm install 메모리 위험 | ✓ Good |
| `check:edge` = `deno check --config supabase/functions/deno.json`(`nodeModulesDir: none`), 함수 디렉터리 안 `deno.json` 금지 | 루트 `package.json` 때문에 기본 실행은 BYONM 으로 `npm:openai` 타입 미해결. 함수 디렉터리 안 설정은 CLI 2.117.0 이 배포 import map 으로 채택. 상위 경로는 배포가 읽지 않음(소스 확인) | ✓ Good (Phase 4, 계약 #48) |
| PostgREST many-to-one 임베드는 `unknown` 정규화 헬퍼로 접는다(`as`·`any` 0) | 런타임은 객체인데 제네릭 없는 추론 타입은 배열 → `deno check` 통과·런타임 `undefined`. 정적 검사가 못 잡는 자리라 계약 #47 + Phase 8 수동 invoke 로 이중 방어 | ✓ Good (Phase 4, 실행 프로브 9케이스) |
| `settings`·쿨다운 조회 실패는 기본값으로 **진행** + `console.error` + 응답 boolean | Core Value("매일 하나 확정") > 설정 존중. 0행은 기본값이지 에러 아님. 클라이언트 SETT-03 과 대칭 | ✓ Good (Phase 4, 사용자 D2) |
| `jsr:@supabase/supabase-js@2.117.2` 소스 핀 + `supabase/functions/deno.lock` 커밋(생성물, 손편집 금지) | 배포는 API 측 번들링이라 lock 을 읽지 않음 → 소스 핀만이 배포 버전을 고정. lock 은 로컬 `check:edge` 재현성. 미참조 명세자는 `deno` 가 지우지 않아 재생성으로 정리 | ✓ Good (Phase 4, 사용자 D4) |
| respin 은 POST 전용(405), 던져진 예외도 `json()` 500 으로 착지 | 리뷰 실측: GET/HEAD(링크 미리보기)로 오늘 결과 덮어쓰기 가능, 예외는 CORS 없이 나가 배너가 사유를 못 읽음 | ✓ Good (Phase 4 리뷰 WR-01·IN-08) |
| 매장 탭: 상단 상시 폼 + 행 인라인 편집 + 2단계 인라인 삭제 확인(`window.confirm` 금지), 페이즈 잠금 없음 | 등록 중 입력을 잃지 않고 목록 맥락 유지. 카탈로그는 영구 데이터라 즉시 삭제 전례를 따르지 않음. 브라우저 모달은 스타일·자동화 밖 | ✓ Good (Phase 5, 사용자 위임 D-04~D-07·D-12) |
| 목록 리듀서는 이벤트 하나로 `loaded` 를 올리지 않고 조회 전 이벤트를 `pending` 버퍼에 쌓아 조회 결과 위에 재적용 | 리뷰 실측: `settings` 단일행 논증을 목록에 복제하면 초기 SELECT 보다 먼저 온 Realtime 이벤트가 목록 전체를 버림 | ✓ Good (Phase 5 리뷰 CR-01) |
| `lib/restaurants.ts` → `components/MenuList.tsx` `parseMenuInput` import 는 `lib/` 단방향 규칙의 의도적 예외 | 쉼표 파싱을 두 벌로 만들지 않음(CATL-06). Phase 6 이 `MenuList` 를 지울 때 `lib/` 로 이동 | ✓ Good (Phase 5) → Phase 6 에서 `lib/menus.ts` 로 이동, 예외 소멸 |
| Phase 5~7 빠른 레인: 리서치·플랜체커·패턴맵·discuss·검증자·보안감사 생략, 플랜 2개, 리뷰(fable)+fixer(opus) 만. Phase 8 은 전체 루틴 | 사용자 2026-09-29 속도 불만. Phase 4 실측 5h vs Phase 5 실측 ~1.7h(계획 19m·실행 31m·리뷰 11m·fix 16m·마감 10m). 검증자·감사자는 Phase 4 에서 발견 0 | ✓ Good (Phase 5 실측) |
| 오늘 탭은 훅 2개(`useRestaurants` + `useCandidates`) + 클라이언트 순수 조인 | `candidates` 행이 키·시각뿐이라 이벤트만으로 매장명을 알 수 없고 카탈로그는 토글 목록에 어차피 전부 필요. 임베드 조회는 이벤트마다 재조회 | ✓ Good (Phase 6 D-01) |
| 목록 리듀서를 `lib/rowset.ts` 제네릭으로 일반화, UPDATE 는 upsert, 조회 판정(`fetched`)도 리듀서 안 | 두 번째 사용처(candidates)가 생겨 두 벌이면 CR-01 급 버그가 한쪽에만 고쳐짐. 놓친 INSERT 를 UPDATE 로 복구. 훅에 판단 분기 0(취소 가드 제외) | ✓ Good (Phase 6 D-03~D-05, 리뷰 WR-01 로 취소 가드 관용구 복원) |
| 후보 UI = 단일 목록 + 행 토글, 담긴 매장이 휠 순서로 위(배지) | 담기/빼기가 한 동작이고 휠↔배지 매핑이 유지됨. 두 섹션·고정 순서 대안 기각 | ✓ Good (Phase 6 D-10) |
| 결과 이름은 `results.menu` 스냅샷, 메뉴·위치는 현재 카탈로그 | CATL-03 스냅샷 전제 유지 + 상세는 최신값. 삭제·개명돼도 기록·랭킹과 어긋나지 않음 | ✓ Good (Phase 6 D-18) |
| 추첨 시각 문구는 전부 `spinTimeText` prop(기본값 없음), `layout.tsx` metadata 는 시각 제거, `stalled` 수동 돌리기 버튼 없음 | 기본값을 두면 시각이 다시 컴포넌트에 숨음. 정적 metadata 는 설정을 따를 수 없음. 서버가 매분 폴링하므로 버튼 불필요 | ✓ Good (Phase 6 D-19~D-22) |
| Realtime 토픽은 마운트당이 아니라 **구독마다** 새로 매긴다(`results-<n>` 을 effect 안에서 `++topicSeq`) | 리뷰 실측: 같은 인스턴스가 `todayKey` 로 재구독할 때 토픽이 같으면 realtime-js 가 leave 중인 채널을 돌려주고 join 을 건너뜀 → 밤새 연 탭이 다음 날 결과를 못 받음(구 코드부터 있던 버그) | ✓ Good (Phase 6 리뷰 CR-01) |
| 재연결 후 재조회(구독 확정 전 창) 는 미해결 — todo in-07, 컷오버 전 결정 | `rowset` 중복 응답 가드(D-04)를 바꿔야 하는 설계 항목이라 리뷰 fixer 스코프 밖 | — Pending (Phase 6 리뷰 WR-02) |
| 기록·랭킹 집계 키 = `restaurant_id ?? menu`, 표시 이름 = 최근 당첨일 스냅샷 | id 로만 모으면 삭제된 매장(set null)의 기록이 사라지고, 이름으로만 모으면 개명이 두 줄로 갈라짐. 삭제는 전 행을 한 번에 null 로 바꾸므로 이름 키로 다시 한 덩어리 | ✓ Good (Phase 7 D-02) |
| 전환일 필터 정의처는 `filterSince` 하나, 랭킹 조회 경계는 `min(history_since, 오늘)` | 조회 경계는 대역폭이고 정의는 필터. 전환일이 오늘보다 뒤인 하루(컷오버 절차 8번)에 오늘 행이 빠지면 상단 라벨이 틀림 | ✓ Good (Phase 7 D-01·D-06) |
| 전환일 당일 legacy 행은 읽는 쪽이 아니라 컷오버 SQL 한 줄(`history_since + 1`)로 뺀다 | "당일 + id null 제외" 규칙은 그날 당첨 매장이 나중에 삭제되면 정당한 행까지 지움 | ✓ Good (Phase 7 D-09, todo in-05 종결) |
| Phase 7 은 직접 실행 레인: CONTEXT·플랜 1개 직접, 실행·수정 직접, 에이전트는 리뷰(fable) 1회 | 사용자 2026-09-29 "볼륨 대비 시간 과다". Phase 6 빠른 레인 2.5h 중 에이전트 대기 ~1.5h. 리뷰는 두 페이즈 연속 실제 Critical 을 잡아 유지 | ✓ Good (Phase 7 실측 ~50m) |
| 롤백은 동작 복원이지 데이터 파기가 아니다 — 새 테이블·`results.restaurant_id` 는 남기고 파기문은 주석 블록 | 사용자가 등록한 매장은 데이터. 구 코드는 모르는 테이블·컬럼을 읽지 않아 무해, 재컷오버 때 보존 | ✓ Good (Phase 8 D-01) |
| Realtime 구독 전·재연결 뒤 스냅샷 공백은 수용(in-07 미적용) | `SUBSCRIBED` 콜백 조회는 웹소켓 차단 환경에서 REST 읽기까지 죽여 "Realtime 없어도 읽기는 된다" 를 깬다. 새로고침으로 해소, v2 방향은 CONCERNS 항목 8 | ✓ Good (Phase 8 D-10) |
| 컷오버 당일 확인은 SQL 후보 + 다시 돌리기, 토글 확인은 익일 추첨 전 | 오늘 결과 행이 있는 동안 오늘 탭 토글은 `decided` 로 잠긴다(리뷰 CR-01) — 절차서가 실행 불가 단계를 갖지 않게 | ✓ Good (Phase 8 리뷰 CR-01) |
| PR 은 "Create a merge commit" 으로 머지 | 롤백의 `git revert -m 1` 전제. squash/rebase 면 롤백 분기 | ✓ Good (Phase 8 리뷰 WR-06) |
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
*Last updated: 2026-09-29 after Phase 8 (컷오버 준비) completion — 라이브 컷오버는 사용자 절차*
