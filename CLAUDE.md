@AGENTS.md

# lunch_roulette — 작업 가이드

매일 설정된 시각(기본 11:55 KST)에 서버가 자동으로 돌리는 익명 점심 매장 룰렛. 인프라·배포·pg_cron 상세는 `README.md`가 정본이다 (여기 중복하지 않는다).

## 엔트리포인트·핵심 흐름

- `app/page.tsx` — 오늘 탭. 카탈로그 토글로 후보 담기·빼기 + 룰렛 + 매장 결과(+ 2·3순위) + 오늘 갈 곳·방문 확인(`DestinationCard`, 0007). 휠 `items` 는 후보 − 이번 주 제외(`weeklyExclusionMap` → `wheelPool`, 제외는 `source === "seed"` 행에만 — 0008)이고 `winnerIndex` 도 그 배열 기준이다. 앱의 중심. 화면이 보는 페이즈는 `shownPhase`(`forceSpin` 동안 `spinning`) — 다시 돌리기로 결과 행이 먼저 바뀌어도 휠이 도는 5초 동안 카드·머리글·상단 상태가 새 당첨을 말하지 않는다. 후보 목록 잠금과 다시 돌리기 버튼 표시는 실제 `phase` 를 본다. 후보 소스는 `candidates`⋈`restaurants`(훅 2개 + 클라이언트 순수 조인)이고, 결과 구독은 `results-<n>` 토픽의 INSERT/UPDATE **2분기** + 추첨 시각 비교 가드(`todayResultRef`·`isNewSpin`)다. 후보 쓰기 2종(담기·빼기)은 여기서 직접 PostgREST 를 부르고 실패는 전부 `formatCandidateWriteError` 를 지난다 — 담기는 `source: "manual"` 을 함께 쓴다(0008, 생략하면 DB 기본값 seed 로 들어가 그 매장이 이번 주 제외를 받는다). 점심 기록 쓰기 2종(`setDestination`·`setVisit`)은 `lunch_days` 에 **바꿀 컬럼만** upsert(`onConflict: "date"`)하고 실패는 `formatLunchDayWriteError` 를 지난다 — 시각 컬럼의 값은 DB 트리거 `lunch_days_stamp` 가 now() 로 바꾼다(클라이언트 값은 "건드렸다" 신호).
- `app/log/page.tsx` — 캘린더 기록. `app/rank/page.tsx` — 랭킹. 둘 다 `settings.history_since` **이후**(당일 포함) 결과만 보이고, 화면에 올리는 행은 전부 `lib/history.ts` 의 `filterSince` 를 지난다(`null` 이면 자르지 않는다 — 컷오버 전 라이브가 그 상태. 단 랭킹은 컷오버 전 라이브 DB 에 `results.restaurant_id` 가 없어 명시 컬럼 조회 자체가 42703 배너로 끝난다 — 0005 적용 뒤에만 동작). 랭킹은 설정 로드 뒤에만 조회하고 `.gte("date", …)` + 컬럼 4개(`id,date,menu,restaurant_id`)로 좁힌다 — 조회 경계는 대역폭이고 정의는 `filterSince` 다. 기록은 월 창 조회를 유지하고 필터만 건다. 두 페이지의 results 토픽은 `results-log-<n>`·`results-rank-<n>`(구독마다). 0007 부터 둘 다 같은 창의 `lunch_days` 를 함께 읽고(`lunch-days-log-<n>`·`lunch-days-rank-<n>` INSERT/UPDATE) `applyLunchDays` 를 지난 "간 곳" 행을 그린다 — 랭킹 조회 컬럼은 5개(`id,date,menu,restaurant_id,spun_at`), 단체 점심 안 한 날은 행이 없고 확인 안 된 날은 1순위로 센다.
- `lib/history.ts` — 기록·랭킹의 판단(순수): `filterSince`(전환일 필터) · `applyLunchDays`(결과 행 ⋈ `lunch_days` → "간 곳" 행 `HistoryEntry`: 방문 확인 > 목적지 > 1순위, skipped 제외, `unconfirmed` — 우선순위의 정의처는 `_shared/cooldown.ts` `dayExclusionId`) · `buildRanking`(집계 키 **`restaurant_id ?? menu`**, 이름은 최근 당첨일 스냅샷, 정렬 wins ↓ → lastDate ↓ → key ↑) · `buildMonthGrid`(6×7 격자, 로컬 `Date` 산술의 허용 예외). `RankingView`·`CalendarLog` 는 호출만 한다 — 달력 헤더의 "이번 달 최다 매장" 도 같은 `buildRanking` 이다.
- `app/restaurants/page.tsx` — 매장 탭. 매장 카탈로그 CRUD + 📌 고정 + 이번 주 쉬기(`paused_week` = 이번 주 월요일, 월요일에 저절로 풀린다 — 0007). 쓰기 5종(등록·수정·삭제·핀·쉬기)이 여기서 직접 PostgREST 를 부르고 실패는 전부 `formatRestaurantWriteError` 를 지나 한 배너로 모인다. 페이즈 잠금이 없다 — 매장 편집은 추첨 시각과 무관하다. 오늘 후보 담기는 오늘 탭에 있다 — 📌 토글은 여기 한 곳뿐이고 후보 목록에서는 읽기 전용 표시다.
- `lib/supabase/client.ts` — 브라우저용 supabase 클라이언트 + `ResultRow`/`RestaurantRow`(`paused_week`)/`CandidateRow`(`source`, 0008)/`SettingsRow`/`LunchDayRow`/`WeekWinnerRow` 타입. **DB 타입의 유일한 정의처** (자동 생성 아님, 수동 유지).
- `lib/rowset.ts` — 목록의 Realtime 병합 규칙 한 벌(제네릭). 매장 카탈로그와 오늘 후보가 이 구현 하나를 **키 함수만 주입해** 쓴다(`id` / `restaurant_id`). `pending` 버퍼 재적용·중복 INSERT 멱등·DELETE 키 없음·UPDATE upsert 가 전부 여기 있다.
- `lib/candidates.ts` — 오늘 후보 도메인의 판단(순수): 카탈로그 조인(`TodayCandidate.source` 를 그대로 옮긴다) + 3단 정렬(후보 시각 → 매장 시각 → 매장 id) · 이름 필터 · 목록 조립 · 당첨 인덱스 · 새 추첨 판정. 휠 순서·목록 배지·당첨 인덱스의 정의처가 여기 하나다. `lib/useCandidates.ts` — 그 리듀서에 I/O 를 붙인 훅(SELECT 1회 + `candidates-<n>` 토픽의 INSERT/DELETE **2분기** 구독, 읽기 전용). 갱신을 구독하지 않는 이유는 앱 경로에 이 테이블의 행을 고치는 쓰기가 없기 때문이다 — `source`(0008)도 insert 로만 쓰고 되살리기는 빼기 → 담기(DELETE + INSERT)다. `source` 를 update 로 고치는 경로를 두려면 UPDATE 분기를 함께 더해야 한다.
- `lib/lunchDay.ts` — 주간 점심 기록의 화면 쪽 판단(순수): `destinationOf`(오늘 갈 곳 id·이름·순위 — 기록이 추첨 뒤에 고른 목적지일 때만 기록 쪽) · `nextDestination` · `visitSummary` · `weeklyExclusionMap`(휠 제외·목록 배지의 정의처, 창 `[weekStart, today)`, 쉬기 > 방문) · `wheelPool`(서버의 `applyWeeklyExclusions` 를 그대로 불러 2단 폴백·manual 면제까지 같은 답, `offWheel` 이 목록 배지의 입력) · `lunchWeekReducer`(세대 번호 — `rowset` 과 달리 loaded 뒤 응답도 받는다, 창은 상태에) · `mapHref`(`parseLocationLink` 화이트리스트) · `parseOtherVisitName`(24 코드포인트, 자르지 않고 거부) · `WEEKDAYS`·`weekdayLabel`·`exclusionBadge`. 규칙 자체는 `_shared/cooldown.ts` 에서 값으로 가져온다. `lib/useLunchWeek.ts` — 그 리듀서에 I/O 를 붙인 훅(이번 주 `lunch_days`(오늘 포함)·`results`(오늘 제외) 조회 + `lunch-days-<n>` INSERT/UPDATE 구독 + 재조회 트리거 visible/SUBSCRIBED — 분기 예외, 아래 컨벤션).
- `lib/menus.ts` — 쉼표 파싱(`parseMenuInput`)·코드포인트 절단(`truncateToCodePoints`)의 정의처.
- `lib/ranking.ts` — 결과 행의 `ranking`(jsonb) 에서 화면에 보일 2·3순위를 뽑는 판단(순수, `backupRanks`): null·비배열 → 빈 배열, 1번째(당첨) 제외, **자리 순위 유지**(깨진 원소는 그 자리만 비운다 — 당기면 3순위가 2순위로 둔갑), 상한 `BACKUP_RANKS_SHOWN` 2. 결과 카드(`ResultBlock`)와 기록 상세(`CalendarLog`)가 같은 함수를 쓴다. 순서를 **정하는** 쪽은 `supabase/functions/_shared/ranking.ts` 다.
- `lib/wheelLabel.ts` — 휠 라벨의 판단(순수): 각도 접기(`normalizeDeg`) · 왼쪽 반원 뒤집기 판정(`isLabelFlipped`, 12시=0·시계 방향, 180 초과만) · 띠 길이에 맞춘 이름 절단(`fitWheelLabel`, 8 코드포인트·당첨 배지 14). `components/Wheel.tsx` 는 좌표만 찍는다.
- `lib/time.ts` — KST 포맷터 + `_shared/kst` 재수출 + 화면용 추첨 시각 포맷터(`formatSpinTime`·`addMinutesToSpinTime`). `lib/phase.ts` — 시각·추첨 시각·결과 유무 → 페이즈(`accepting|spinning|decided|stalled`) + `displayPhase`(설정 로드 전 `stalled` 라벨 가림, 4개 페이지가 함께 쓴다). `stalled` = 추첨 시각은 지났는데 결과 행이 없는 구간이고, 이때 후보 목록을 잠그지 않는다.
- `lib/settings.ts` — `settings` 행 → 앱 도메인 변환 + Realtime 병합 리듀서(순수 — supabase·React·환경변수를 **값으로** 끌어오지 않는다. `lib/supabase/client.ts` 에서는 `import type` 만 가져오고, 값 import 는 `_shared/spinTime` 의 `DEFAULT_SPIN_TIME`·`DEFAULT_SPIN_TIME_TEXT`·`parseSpinTime` 셋뿐이다). `lib/useSettings.ts` — 그 리듀서에 I/O 를 붙인 훅(SELECT 1회 + `settings-changes-<n>` 구독 — 토픽은 구독 인스턴스마다 유일해야 한다). 추첨 시각·전환일의 단일 출처(`cooldown_days` 는 0007 이후 읽지 않는다 — `Settings` 에 그 키가 없다).
- `lib/restaurants.ts` — 매장 폼 검증·위치 링크 판정(`http:`/`https:` 화이트리스트)·표시 정렬(핀 먼저·한국어 이름순)·`lib/rowset.ts` 인스턴스(순수 — `lib/supabase/client.ts` 에서 `import type` 만 가져오고, 값 import 는 `lib/constants.ts`·`lib/menus.ts`·`lib/rowset.ts` 셋 다 `lib/` 안쪽이다). 조회 응답보다 먼저 온 이벤트를 `pending` 버퍼에 쌓았다가 응답 목록 위에 재적용하는 규칙은 `lib/rowset.ts` 로 옮겨졌다 — 이벤트 하나로 `loaded` 를 올리지 않는 것이 단일행인 `lib/settings.ts` 와 갈리는 지점이다. `lib/useRestaurants.ts` — 그 리듀서에 I/O 를 붙인 훅(SELECT 1회 + `restaurants-<n>` 토픽의 INSERT/UPDATE/DELETE **3분기** 구독, 읽기 전용). `components/RestaurantList.tsx` — 카드·등록 폼·인라인 편집·핀·2단계 삭제 확인(supabase 미호출, 쓰기는 `~Action` 콜백으로 페이지에 올린다).
- `components/CandidateList.tsx` — 오늘 후보 카드. 카탈로그 전체가 한 목록이고 담긴 매장이 휠 순서로 위에(슬라이스 색 배지), 안 담긴 매장이 그 아래 흐리게 온다. 이름 필터·빈 상태 3종·페이즈 잠금·행 단위 진행 가드를 갖고 supabase 를 부르지 않는다. `components/MenuChips.tsx`·`components/LocationLink.tsx` — 메뉴 칩과 위치 렌더 한 벌. 결과 화면과 매장 탭이 **같은 구현**을 써서 같은 매장이 화면마다 다르게 보이지 않고, 링크의 `target`/`rel` 보호도 한 곳에서 걸린다. 이번 주 제외 행은 담긴 채 흐리고 배지 자리에 사유(`화 방문`/`이번 주 쉬기`, `exclusionBadge`)가 온다 — `listTodayRows` 의 `slice` 는 휠 items 인덱스이고 `picked` 가 담김을 말한다.
- `components/DestinationCard.tsx` — 오늘 갈 곳 카드(decided 전용, 결과 카드와 같은 `shownPhase` 가림). 목적지·순위 배지·지도(`mapHref`), `웨이팅 있어요 → 다음`·`1순위로 되돌리기`, `어디서 먹었나요?`(순위 버튼·다른 매장 인라인 폼·단체 점심 안 함·수정). supabase 미호출, 쓰기는 `onSetDestinationAction`·`onSetVisitAction`. "수정" 펼침은 요약의 JSON 키로 들고 있어 다른 사람의 저장이 도착하면 저절로 접힌다(effect 없음).
- `supabase/functions/_shared/` — Deno 함수와 클라이언트가 **같은 파일로** 공유하는 순수 로직(`kst.ts`·`spinTime.ts`·`cooldown.ts`·`ranking.ts`). `cooldown.ts` 는 0007 부터 주간 제외 규칙이다 — `weekStartOf`·`weeklyWindowStart`(월요일 null = 해제)·`effectiveDestinationId`(`set_at < spun_at` 이면 stale)·`dayExclusionId`(skipped → null · visited → `visited_id` · unknown → 목적지)·`applyWeeklyExclusions`(쉬기 전멸 → `allPaused` 되살리지 않음 · 방문 전멸 → 쉬기만 뺀 후보로 폴백 · **둘 다 `source === "seed"` 행에만** — 사람이 오늘 담은 `manual` 행은 쉬기여도 방문이어도 항상 남는다, 0008) · `CandidateSource` 타입(`seed` | `manual`)의 정의처. 클라이언트는 `lib/lunchDay.ts`·`lib/history.ts` 가 같은 함수를 값으로 가져온다. 그 **네 모듈**이 import 를 하나도 하지 않는 것이 계약이다 — 서로도 import 하지 않는다 (Deno 는 `.ts` 확장자를 요구하고 tsc 는 거부한다). 같은 디렉터리의 `*.test.ts` 는 예외다 (vitest 만 실행하므로 `./kst` 처럼 확장자 없이 가져온다).
- `lib/constants.ts` — 환경변수 없이 import 되는 순수 상수(`MENU_NAME_MAX_LEN` 24 · `RESTAURANT_MENUS_MAX` 30 · `RESTAURANT_LOCATION_MAX_LEN` 200). 세 값 모두 `supabase/migrations/0005_restaurants_settings.sql` 의 check 제약을 코드포인트 단위로 비춘 것이고 늘릴 때는 SQL 과 함께 고친다(24 는 메뉴명·매장명·메뉴 원소가 공용). 테스트가 `lib/supabase/client.ts`(모듈 로드 시 `createClient`)를 끌어오지 않게 분리한 것. `lib/errors.ts` — 로드 에러 메시지 조립(순수). `components/ErrorBanner.tsx` — `role="alert"` 배너.
- `supabase/functions/spin-roulette` — pg_cron이 **매분** 호출하는 추첨 함수. 추첨 시각은 `settings.spin_time` 을 읽어 판정하고(조회·파싱 실패는 기본 시각으로 폴백), 같은 날짜 결과 행이 있으면 멱등 종료한다. 후보는 `candidates`(`source` 포함) → `restaurants ( id, name, paused_week )` 조인에서 읽고(`source` 는 `"manual"` 인가로만 좁혀 그 밖은 seed), 창이 있으면(화~일) `results`·`lunch_days` 두 창 조회를 날짜로 조인해 `dayExclusionId` → `applyWeeklyExclusions`(쉬기 전멸 → `skipped: "all_paused"` 로 결과 행을 만들지 않는다, 다음 분 재시도 · 방문 전멸 → 쉬기만 뺀 후보로 폴백 `weekly_fallback` · 창 조회 실패 → `weekly_skipped`)로 pool 을 만든 뒤 `_shared/ranking.ts` 의 `rankCandidates` 로 **순서 전체**를 정해 `results` 에 매장명 스냅샷 + `restaurant_id` + `ranking`(pool 의 순열, 1번째 = 당첨)을 쓴다. 설정 조회는 `spin_time` 만 읽는다. 당첨을 따로 뽑지 않는다 — 1순위와 당첨이 갈라지면 화면이 두 개의 진실을 보인다. `respin-roulette` — 클라이언트 "다시 돌리기". 시간 가드·멱등 조회가 없고 같은 조인·쿨다운 위에서 `upsert(onConflict: "date")` 로 덮어쓴다 (그래서 컷오버 전 사람이 직접 invoke 해 새 스키마 경로를 볼 수 있는 유일한 함수다). **POST 가 아닌 요청은 405 로 거절한다** — 되돌릴 수 없는 덮어쓰기라 OPTIONS 단락만으로는 GET 한 번(링크 미리보기·주소창)을 막지 못한다. **배포·마이그레이션 적용은 `README.md` 의 컷오버 절차로 함께 한다**(0005 적용 → 함수 2종 배포 → PR 머지, 한 세션 안에 연속 — 0006·0007·0008 도 같은 순서, README 의 해당 절). 순서가 어긋나면 구 코드가 사라진 `menus` 를 읽어 42P01, 매분 폴링이 500, 랭킹의 명시 컬럼 조회가 42703 을 낸다. 절차 완료 전의 라이브(구 코드 + 구 스키마)에 이 브랜치를 붙이면 오늘·매장·랭킹 탭에 "불러오기 실패" 배너 + 빈 목록이 뜨는 것이 정상이다. 롤백은 `supabase/rollback/0005_restaurants_settings.rollback.sql` + README 롤백 절.

흐름: 클라이언트는 `restaurants`/`candidates`/`results`/`lunch_days`를 직접 SELECT/INSERT/UPDATE/DELETE(anon RLS — `lunch_days` 는 delete 정책 없음) → Realtime `postgres_changes`로 동기화. 결과 확정은 **서버(pg_cron 매분 → Edge Function → `candidates`⋈`restaurants` 조회 → results 쓰기)** 만 한다. 클라이언트의 페이즈 계산은 표시용 추정이고, 실제 상태 전환은 results 행 존재 여부가 결정한다.

## 검증 명령

```bash
npx tsc --noEmit   # 타입
npm run lint       # eslint (react-hooks 규칙 포함)
npm test           # vitest run (워치 아님). 워치는 npm run test:watch
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 빌드 자체가 실패한다
npm run check:edge # deno check 두 Edge Function (index.ts 의 유일한 정적 검사)
```

`check:edge` 는 로컬에 설치된 `deno`(2.9.7, Homebrew `/opt/homebrew/bin/deno`)를 전제한다 — npm 의존성이 아니라 외부 도구라 `npm ci` 로 따라오지 않는다.

테스트는 vitest — `npm test` = `vitest run`, 설정은 레포 루트 `vitest.config.mts`, 수집 대상은 `lib/**`·`components/**`·`supabase/functions/_shared/**`·`supabase/migrations/**`·`supabase/rollback/**` 의 `*.test.ts` 뿐이다 (CI는 여전히 없음). `_shared/**`·`migrations/**`·`rollback/**` 는 각각 Phase 3·2·8 이 실제 파일을 채웠다 — 마이그레이션·롤백 spec 은 SQL 을 실행하지 않고 텍스트로 파싱해 계약을 검사한다. `components/layoutClasses.test.ts` 도 같은 방식으로 반응형 클래스를 고정한다(렌더 하네스가 없어 className 오타는 휴대폰에서만 조용히 깨진다). lint는 2026-09-18 기준 에러 0 (`components/Wheel.tsx`는 회전을 props에서 파생하도록 고쳐 `react-hooks/set-state-in-effect` 해결).

## 코드 컨벤션 (이 레포가 이미 내린 선택 — 따른다)

- **전부 클라이언트 컴포넌트.** 서버 컴포넌트·Route Handler·서버 액션 없음. 데이터 접근은 페이지 컴포넌트 안에서 supabase-js 직접 호출. 새 기능도 이 구조를 따르되, 쓰기 권한이 필요한 로직은 Edge Function으로 보낸다 (results 쓰기는 service_role만).
- **스타일: inline style 객체 + CSS 변수.** 컴포넌트마다 파일 하단에 `const s = {...} satisfies Record<string, CSSProperties>`. 색·폰트·반경은 `app/globals.css`의 `--bg`, `--ink`, `--accent` 등 토큰만 쓴다. Tailwind는 설치돼 있지만 유틸리티 클래스는 거의 안 쓴다 (layout.tsx 정도) — 새 코드도 inline style 쪽을 따른다.
- **예외: 화면 폭에 따라 바뀌는 속성만 `app/globals.css` 의 `l-*` 클래스.** inline style 은 media query 를 쓸 수 없어서다. 폭 분기는 **960px(2단 → 1단)·720px(휴대폰) 둘뿐**이고, 터치 대상 확대(`l-tap`)와 입력 칸 16px(`l-input`, iOS 포커스 확대 방지)은 폭이 아니라 `pointer: coarse` 로 가른다 — 가로로 든 휴대폰은 720px 을 넘는다. `l-*` 클래스가 가진 속성을 그 요소의 inline style 에 **다시 두지 않는다** — inline 이 이겨서 분기가 에러 없이 꺼진다(단축 속성 `padding` 이 클래스의 `padding-left` 를 덮는 경우 포함). 숨김 유틸 `l-hide-stack`·`l-hide-narrow` 두 개만 `!important` 다. 클래스는 문자열 리터럴(`className="…"`)로만 붙인다 — `components/layoutClasses.test.ts` 가 이름·media 조건문 3개·`!important` 목록을 텍스트로 고정하고, 리터럴 밖에 나온 `l-*` 토큰(템플릿 문자열·작은따옴표·변수)은 실패시킨다. 그 spec 이 보지 못하는 것은 inline 중복과 접두 오타(`I-`·`1-`) 둘이다. 색·글꼴·폭과 무관한 간격은 여전히 스타일 객체가 가진다.
- **콜백 prop 이름은 `~Action` 접미사** (`onAddAction`, `onRemoveAction`, `onChangeMonthAction`). Next.js 클라이언트 경계의 직렬화 lint를 통과시키기 위한 규약이다. `onX`로 지으면 lint가 잡는다.
- **시간은 항상 `lib/time.ts` 경유.** `Date`의 로컬 메서드(`getHours` 등)를 비즈니스 로직에 직접 쓰지 않는다. 날짜 키는 `"yyyy-mm-dd"` KST 문자열이고 `results.date`와 그대로 비교한다.
- 컴포넌트는 named export, 파일명 = 컴포넌트명 (`components/Wheel.tsx`). 페이지 전용 소형 컴포넌트는 페이지 파일 안에 둔다.
- **공용 훅은 `lib/useX.ts`, `use` 접두** (`lib/useSettings.ts`·`lib/useRestaurants.ts`·`lib/useCandidates.ts`). `lib/` 파일명이 소문자 명사인 관례(`time.ts`·`phase.ts`·`errors.ts`·`constants.ts`)의 유일한 예외다. 훅에는 I/O 만 두고 판단은 같은 이름의 순수 모듈(`lib/settings.ts`·`lib/restaurants.ts`·`lib/candidates.ts`)로 내린다 — 레포에 React 렌더 하네스가 없어서 훅 안의 분기는 테스트되지 않는다. **세 훅 모두 판단 분기가 0개**다 — 조회 성공·실패의 가름까지 리듀서의 `fetched` 액션이 맡는다. **의도적 예외 하나: `lib/useLunchWeek.ts`** 는 분기 2개(`document.visibilityState === "visible"`·구독 콜백 `status === "SUBSCRIBED"`)를 갖는다 — 둘 다 "다시 읽을지" 만 가르고 결과를 해석하지 않으며, 끊긴 사이의 변경을 이벤트로 받지 못하는 구독의 틈(Codex 평가 C1)을 재조회로 닫는 것이 그 훅의 존재 이유다. 무엇을 다시 읽고 stale 응답을 어떻게 버리는지(세대 번호)는 리듀서 `lunchWeekReducer` 가 갖는다. 다른 훅에 이 패턴을 넓히는 것은 별건이다. 남는 `if` 는 `if (cancelled) return;` 한 줄뿐이고 그것은 판단이 아니라 배관이다(언마운트 취소 가드). 레포의 나머지 비동기 effect(`app/page.tsx`·`app/restaurants/page.tsx`)와 같은 관용구로 둔다 — "본문에 `if` 0개" 를 목표로 삼아 이 가드를 재대입되는 클로저로 바꾸면 읽는 사람이 안전성을 스스로 증명해야 한다.
- **`lib/` 는 `app/`·`components/` 를 import 하지 않는다(단방향).** 예외는 없다 — `grep -rn '@/components/' lib` 가 0줄이어야 한다.
- 주석은 한글, Why만. 파일 머리에 역할·제약을 블록 주석으로.
- 마이그레이션은 `supabase/migrations/000N_설명.sql`, cron 등록은 "기존 잡 unschedule → 재등록" 패턴으로 재실행 가능하게.
- Edge Function은 Deno + `jsr:` import. `tsconfig`·eslint 제외는 **함수 디렉터리 2개(`spin-roulette/**`·`respin-roulette/**`)뿐**이고 `_shared/**` 는 tsc·eslint·vitest 3중 검사를 받는다. 두 `index.ts` 본문은 `deno check`(`npm run check:edge`)가 **타입**을 검사하고(전이로 `_shared` 까지), `_shared/edgeImports.test.ts` 의 텍스트 계약 67건이 **형태**(조회 문자열·jsr 핀·폴백 키·헬퍼 이름·로그 지점 수·쿨다운 창 경계)를 고정한다 — 둘은 서로를 대체하지 않는다. eslint 는 여전히 두 파일을 보지 않고, 남는 사각지대는 **동작**이다: 실호출은 컷오버 전 불가라 낭독 기록(`04-02`·`04-03-SUMMARY.md`)이 마지막 방어다.
- **Edge Function 의 500·폴백 경로는 `console.error` 로 Supabase 로그에 남긴다** (무엇이 어떤 값으로 실패했는지까지. 현재 spin 9지점·respin 7지점 — 각 마지막 1건은 핸들러 전체를 감싼 `catch` 다. 던져진 예외는 반환이 아니라서 `json()` 을 지나지 않고, respin 쪽은 CORS 헤더까지 빠져 클라이언트가 사유를 읽지 못한다). `app/`·`lib/` 에는 넣지 않는다 — 클라이언트는 배너가 채널이다(`actionError`/`loadError`). 로그·응답 본문에 `details`·`hint`·행 덤프를 싣지 않는다. 조인 형태 불일치로 버린 후보 수는 로그뿐 아니라 응답 `excluded_count`(두 함수의 `no_candidates`·`ok` 양쪽)로도 싣는다 — 그래야 "후보가 없다" 와 "조인이 깨졌다" 가 응답만으로 구분된다.

## 비표준 규약·함정

- `design/`은 React CDN 프로토타입 + PNG. **빌드 대상 아님**, 시각 참조용. 인덱서 OOM 전례 때문에 tsconfig/eslint/vscode/Tailwind `@source` 네 군데에서 제외돼 있다. 제외를 풀지 말 것. 컴포넌트를 새로 포팅할 때만 열어본다.
- `supabase/functions/` 는 **함수 디렉터리 2개만** 제외다 (Deno 전역·`jsr:` import 때문이고, OOM 근거는 `design/` 쪽이다). `_shared/` 는 제외하지 않는다 — 좁힌 제외를 다시 넓히지 말 것. Edge Function 배포 플래그는 `supabase/config.toml`의 `[functions.*] verify_jwt = false`에 고정돼 있다(63fae89) — 두 함수 모두 anon(pg_cron·publishable key) 호출이라 true로 배포되면 401로 추첨이 조용히 멈춘다. 재배포 시 CLI가 이 파일을 읽지만 `--no-verify-jwt`를 같이 주면 이중 안전.
- `supabase/functions/deno.json`(한 키 `{"nodeModulesDir":"none"}`)·`supabase/functions/deno.lock` 은 로컬 `check:edge` 전용이다 — 배포는 API 측 번들링이라 둘 다 읽지 않는다. **함수 디렉터리 안(`spin-roulette/`·`respin-roulette/`)에 `deno.json`·`deno.jsonc`·`import_map.json` 을 두지 말 것** — 거기 두면 Supabase CLI가 배포 import map 으로 채택해 번들 입력이 바뀐다(계약 #48 이 부재를 고정). supabase-js 버전을 올릴 때는 두 `index.ts` 의 `jsr:@supabase/supabase-js@2.117.2` 핀과 lock 을 **함께** 갱신한다(lock 은 생성물 — 손으로 고치지 않고 재생성한다). 루트에 `deno.lock` 이 생기면 `.gitignore` 가 아니라 명령을 고친다.
- 에디터에서 `supabase/functions/_shared/*.test.ts` 의 확장자 없는 import(`./spinTime`)가 "Cannot find module" 로 뜰 수 있다 — VS Code Deno 확장이 위 `deno.json` 을 보고 그 하위를 Deno 영역으로 켜는 것으로 **추정**한다. `npx tsc --noEmit`·`npm test` 는 exit 0 이라 게이트와 무관하고, `deno.json` 위치는 계약이라 옮기지 않는다.
- 추첨 시각의 코드상 정의처는 `supabase/functions/_shared/spinTime.ts` 의 `DEFAULT_SPIN_TIME` **한 곳**이고, 런타임 값은 `settings.spin_time`(대시보드 편집)이 이긴다. 화면 문구는 전부 `lib/time.ts` 의 `formatSpinTime`·`addMinutesToSpinTime` 를 지나 prop 으로 내려가므로 `app/`·`components/`·`lib/` 에 사용자에게 보이는 시각 리터럴이 0곳이다(SPIN-06). 남은 중복은 DB 쪽 기본값 한 갈래뿐이다: `supabase/migrations/0002_cron.sql` 의 `'55 2 * * *'` 와 `0005` 의 `spin_time` 기본값.
- `kstNow()`·`kstParts()` 는 `supabase/functions/_shared/kst.ts` **한 곳**에 있다. Deno 는 `../_shared/kst.ts`(확장자 포함), 클라이언트는 `@/supabase/functions/_shared/kst`(확장자 없이)로 같은 파일을 본다. `lib/time.ts` 는 그 위의 얇은 재수출 + 포맷터다.
- RLS는 의도적으로 열려 있다: 누구나 `restaurants`·`candidates` 를 읽고 쓸 수 있고, `lunch_days` 는 anon select·insert·update(delete 정책 없음 — 되돌리기는 null 로 update), `results` 는 service_role만 쓰기, `settings` 는 anon select-only 다. `lunch_days` 는 기록·랭킹에 들어가는 첫 anon 쓰기 표다 — 누구나 아무 날짜의 목적지·방문을 고칠 수 있고 그것이 설계(익명 팀 도구)다. `respin-roulette`는 인증·레이트리밋 없음 — 익명 서비스 설계상 수용한 것.
- 4개 페이지 모두 1초 `setInterval`로 `now`를 갱신해 리렌더한다(오늘·매장·기록·랭킹). 페이즈 전환 감지 목적. 무거운 계산은 `useMemo`로 감쌀 것(매장 탭의 `sortRestaurants` 가 그 이유로 감싸져 있다).
- `.serena/project.yml`은 serena가 켤 때마다 재포맷한다 — diff에 떠도 커밋 대상 아님.
- **`npm run dev` 크래시 원인=stale `.next` 캐시 (2026-09-15 규명·수리·검증 완료).** 3개월 방치된 Turbopack 영속 캐시(`.next/dev/cache` 6월22일)가 컴파일 단계 node fork storm(2.5분 3508개)을 일으켜 메모리 고갈 → 커널 패닉 2회. **코드/설정 무관**(5월 이후 불변, 프로덕션 정상). `rm -rf .next` 후 가드런처로 재기동 검증: Ready 234ms, `GET / 200`, node 1개/RSS 251MB로 정상. **재발 시 `rm -rf .next`**. 증폭기: Next가 dev에 힙 13GB(RAM 50%) 부여 → `NEXT_DISABLE_MEM_OVERRIDE=1`로 완화. → 메모리 `lunch-roulette-dev-server-kernel-panic`.

## 위험 지점

| 위치 | 왜 위험한가 |
|---|---|
| `lib/supabase/client.ts` `ResultRow` | 4개 파일 + 2개 Edge Function이 같은 스키마를 가정. 컬럼 바꾸면 전부 손봐야 하고 타입은 수동 동기화. `ranking` 의 원소 모양 `{restaurant_id, name}` 은 두 Edge Function·`ResultRow`·`lib/ranking.ts` 넷이 같은 모양을 가정한다 — 안의 `restaurant_id` 는 외래키가 아니라 매장을 지워도 남으므로 화면은 이름만 읽는다. 적용 순서는 README "0006 적용"·"0007 적용"·"0008 적용": SQL → 함수 배포 → 머지. 함수를 먼저 배포하면 PGRST204(0006)·42703/42P01(0007)·42703(0008, `source` 명시 조회) 로 그날 추첨을 잃는다 |
| `app/page.tsx` realtime 핸들러 | `results` INSERT/UPDATE **2분기**(INSERT 가 먼저) + `initialLoadedRef`로 초기 로드/실시간 구분 + `todayResultRef`·`isNewSpin` 회전 가드. 순서를 바꾸거나 두 분기를 하나로 합치면 휠 이중 회전이 돌아오고, 가드를 빼면 매장 삭제가 내보내는 `on delete set null` UPDATE 마다 열린 모든 탭의 휠이 5초씩 돈다. 토픽(`results-<n>`)은 **effect 안에서** 만든다 — `useState` 로 올리면 자정에 `todayKey` 가 바뀌며 재구독할 때 realtime-js 가 leave 중인 옛 채널을 같은 토픽으로 돌려주고 `subscribe()` 가 join 을 건너뛰어, 밤새 열어 둔 탭이 다음 날 결과를 못 받는다 |
| `app/log`, `app/rank` realtime | INSERT/UPDATE 두 분기 구독. 분기 하나를 지우면 다시 돌리기(UPDATE)가 반영 안 된다. 토픽은 effect 안에서 `results-log-<n>`·`results-rank-<n>` 으로 매긴다(고정 문자열로 되돌리면 개발 이중 마운트·라우트 왕복에서 leave 중인 채널에 붙는다). 랭킹 조회의 아래 경계는 `min(history_since, 오늘)` 이다 — 전환일이 오늘보다 뒤인 하루(컷오버 절차 8번)에 오늘 행이 빠지면 상단 라벨이 "추첨 대기" 로 틀린다. 그 행을 랭킹에서 빼는 것은 `filterSince` 이지 조회가 아니다 |
| `components/Wheel.tsx` 회전 각도 | 회전 각도를 props 에서 파생한다(`isSpinning`·`restRotation`). state+effect 로 되돌리면 `react-hooks/set-state-in-effect` 와 재회전 루프가 함께 돌아온다. 폭은 유동이다 — `size` 는 최대 폭이고 SVG 에 `width`·`height` 속성을 주지 않는다(주면 그 픽셀로 고정돼 좁은 화면에서 카드 밖으로 잘린다). 안쪽 좌표는 전부 viewBox 단위라 줄어들어도 각도 계산은 같다. 라벨은 칸 중앙 각도로 돌린 방사형 띠(반지름 74~192)에 눕고 당첨 배지만 가로(`labelR`)다 — 띠 길이가 칸 수와 무관해서 겹치지 않는 것이므로, 라벨을 다시 가로로 돌리거나 띠를 `labelR` 한 점으로 되돌리면 15칸에서 겹침이 돌아온다 |
| `app/globals.css` 의 `l-*` 클래스 | 휴대폰 배치 전체가 여기 있다. 같은 속성을 inline 에 다시 적으면 넓은 화면에서는 티가 나지 않고 휴대폰에서만 무너진다. 720px 블록 안에서 `.l-topbar` 는 `.wrap` **뒤에** 와야 한다(`.wrap` 의 `padding` 단축 속성이 위아래 여백을 0 으로 덮는다). 본문의 `word-break: keep-all` 때문에 띄어쓰기 없는 긴 매장명은 한 단어다 — 이름이 들어가는 flex·grid 칸은 `minWidth: 0`/`minmax(0, 1fr)` 로 줄어들 수 있어야 넘치지 않는다(메뉴 칩 포함). 반대로 `.l-page-head` 의 둘째 자식(타임라인)은 줄어들면 안 된다 — 내용이 줄지 못해 상자 밖으로 밀린다 |
| `supabase/migrations/0002_cron.sql` · `0005_restaurants_settings.sql` · `supabase/rollback/0005_restaurants_settings.rollback.sql` | 프로젝트 ref 하드코딩(spin 잡 URL). 다른 Supabase로 옮기면 치환 필수 — 전수 목록은 README |
| `winnerIndex` (`app/page.tsx`) | 오늘 후보 조인 목록에서 **`restaurant_id` 로** 찾는다(이름 폴백 없음). 매장이 삭제돼 `restaurant_id` 가 null 이 되면 -1 → 휠 하이라이트만 사라지고 결과의 이름 스냅샷은 남는다. 이름으로 되찾게 바꾸면 동명 매장이 당첨으로 오인된다 |
| `lib/rowset.ts` + `lib/useRestaurants.ts`·`lib/useCandidates.ts` | 매장 3분기·후보 2분기 구독 + 인스턴스별 유일 토픽(`restaurants-<n>`·`candidates-<n>`). 분기 하나를 지우면 그 이벤트가 조용히 반영되지 않고, 토픽을 고정 문자열로 바꾸면 라우트 전환에서 구독이 에러 없이 죽는다(초기 조회는 정상이라 눈에 띄지 않는다). 조회보다 먼저 온 이벤트는 `lib/rowset.ts` 의 `pending` 버퍼가 흡수한다 — 그 버퍼를 지우고 이벤트가 `loaded` 를 올리게 되돌리면 초기 조회 결과 전체가 버려지고, 이제 그 회귀는 **두 목록에 동시에** 생긴다 |
| `lunch_days` 모양 · `_shared/cooldown.ts` | `LunchDayRow`(타입)·두 Edge Function 의 창 조회·`lib/lunchDay.ts`·`lib/history.ts` 다섯이 같은 컬럼 모양을 가정한다(수동 동기화). `effectiveDestinationId` 는 `destination_set_at`(DB 트리거가 찍는 서버 시각) < `results.spun_at` 이면 목적지를 무시한다 — 트리거를 빼고 클라이언트 시각을 저장하면 기기 시계 오차로 선택이 조용히 사라진다. 쉬기 활성 판정 `paused_week === weekStart` 는 Edge·오늘 탭·매장 탭 셋이 같은 `weekStartOf`(KST 요일 입력)를 쓴다 — 한쪽만 로컬 `Date` 요일로 바꾸면 월요일 경계가 갈린다. 창 `[weekStart, today)` 의 `.lt` 를 `.lte` 로 바꾸면 오늘 목적지가 영원히 제외된다(계약 #52·#54) |
| `candidates.source` · `applyWeeklyExclusions` | `seed`/`manual` 두 낱말을 0008 SQL check · `CandidateSource` 타입 · 두 Edge `normalizeCandidates` 좁히기 셋이 같은 집합으로 가정한다(수동 동기화). 면제 판정은 `=== "manual"` 한 방향이다 — `!== "seed"` 로 뒤집으면 모르는 값이 제외를 뚫는다. 오늘 탭 담기 insert 의 `source: "manual"` 을 지우면 에러 없이 옛 동작(담았는데 흐림)으로 돌아간다. 담긴 seed 행을 되살리는 제스처는 빼기 → 담기(새 행이 manual)다 — `update({ source })` 로 바꾸면 `useCandidates` 가 UPDATE 를 구독하지 않아 어느 탭도 반영하지 못한다(`lib/rowset.ts` 는 아는 키의 INSERT 를 교체해 그 두 탭 제스처를 받는다). 자정 cron 은 0008 이 `'seed'` 명시로 재등록했다 — 기본값만 바꾸고 cron 을 안 고치면 시드가 바뀌지 않는다 |
| `lib/useLunchWeek.ts` | 훅 분기 예외(위 컨벤션). 토픽 `lunch-days-<n>` 은 **effect 안에서** 매긴다(자정 재구독). `useReducer` 초기화 함수가 창을 넣으므로 세대 0 조회가 빈 창으로 나가지 않는다 — `INITIAL_LUNCH_WEEK_STATE` 를 그대로 넘기면 `.gte("date", "")` 가 400 으로 끝난다 |
| 클라이언트 에러 표면화 | 쓰기는 `actionError`, 초기 SELECT는 `loadError`(`lib/errors.ts` + `components/ErrorBanner.tsx`)로 배너 표시. 둘을 합치면 쓰기 성공이 읽기 실패 배너를 지운다. Realtime 구독 실패는 여전히 조용함 |

미사용 코드: `Wheel` `onSpinCompleteAction` prop (참조 0). `_shared/kst.ts` 의 `pickRandom` 은 0006 에서 삭제됐다(당첨 = `rankCandidates` 결과의 1번째). `settings.cooldown_days` 컬럼은 0007 이후 코드가 읽지 않는다(comment 만 바꿨고 제거는 0009 — `SettingsRow` 타입에는 DB 모양대로 남는다).

<!-- GSD:project-start source:PROJECT.md -->
## Project

**lunch_roulette — 매장 기준 룰렛 전환 + 설정 테이블**

로그인 없이 팀원 누구나 쓰는 점심 룰렛. 지금은 "메뉴명"을 자유 입력해 후보를 쌓고 매일 11:55 KST에 서버가 자동 추첨한다. 이번 작업으로 추첨 단위를 **매장**으로 바꾼다: 매장 카탈로그(이름 필수, 메뉴·위치 선택)를 영구 보관하고, 오늘 후보는 카탈로그에서 골라 담으며, 룰렛은 매장을 뽑는다. 추첨 시각·쿨다운은 DB `settings` 한 곳에서 관리한다.

**Core Value:** 매일 11:55(또는 설정 시각)에 **오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.** 이게 깨지면 나머지는 의미 없다.

### Constraints

- **Tech stack**: Next.js 16 App Router, 전부 클라이언트 컴포넌트 + supabase-js 직접 호출, inline style 객체 + CSS 변수, `~Action` 콜백 접미사 — 기존 컨벤션 유지(`.planning/codebase/CONVENTIONS.md`). 새 페이지도 같은 구조
- **Compatibility**: 앱은 매일 쓰이는 라이브. 컷오버 절차(README) 완료 전까지 라이브 DB·함수·main 불변. 작업은 브랜치 `feat/restaurant-roulette`. 컷오버 마이그레이션은 하위호환 순서(새 테이블 생성 → 데이터 이관 없음 → 구 테이블 제거)로 한 파일, 롤백 SQL 은 `supabase/rollback/`(migrations/ 밖 — `db push` 가 읽지 않게)
- **Deploy**: 프로덕션 배포는 사용자 명시 지시 때만. DB 마이그레이션은 Claude가 원격 실행 못 함(보안 차단) → 사용자가 대시보드 SQL Editor. Edge Function은 git과 별개로 `npx supabase@2.117.0 functions deploy <name> --project-ref swxiqytyxjlcgubqlozk`. main 직접 푸시 금지, PR 경유
- **Security**: RLS는 익명 개방(`restaurants`·`candidates` 누구나 쓰기), `results` 쓰기 service_role만, `settings` anon select-only. 브라우저 호출 Edge Function은 CORS+OPTIONS 단락 필수(게이트웨이 미주입)
- **Testing**: vitest. Edge Function 순수 로직은 Deno import 없는 `supabase/functions/_shared/`에 두어 vitest가 직접 import. tsc/eslint는 함수 디렉터리 2개(`spin-roulette/**`·`respin-roulette/**`)만 제외하고 `_shared/`는 포함(Phase 3 D-12)
- **Dev**: `npm run dev`는 가드런처로만(과거 커널 패닉). 브라우저 실등록 테스트는 라이브 오염이라 생략
- **Commit**: 커밋·PR에 AI 표기 금지. `.serena/project.yml` 커밋 금지
<!-- GSD:project-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

