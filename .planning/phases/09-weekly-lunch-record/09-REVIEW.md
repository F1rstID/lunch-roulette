---
phase: 09-weekly-lunch-record
reviewed: 2026-10-29T02:49:14Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - supabase/functions/_shared/cooldown.ts
  - supabase/functions/_shared/cooldown.test.ts
  - supabase/functions/_shared/edgeImports.test.ts
  - supabase/functions/spin-roulette/index.ts
  - supabase/functions/respin-roulette/index.ts
  - supabase/migrations/0007_lunch_days.sql
  - supabase/migrations/0007_lunch_days.test.ts
  - supabase/rollback/0007_lunch_days.rollback.sql
  - supabase/rollback/0007_lunch_days.rollback.test.ts
  - lib/lunchDay.ts
  - lib/lunchDay.test.ts
  - lib/useLunchWeek.ts
  - lib/history.ts
  - lib/history.test.ts
  - lib/candidates.ts
  - lib/candidates.test.ts
  - lib/errors.ts
  - lib/settings.ts
  - lib/supabase/client.ts
  - app/page.tsx
  - app/log/page.tsx
  - app/rank/page.tsx
  - app/restaurants/page.tsx
  - components/DestinationCard.tsx
  - components/CandidateList.tsx
  - components/ResultBlock.tsx
  - components/RestaurantList.tsx
  - components/CalendarLog.tsx
  - components/RankingView.tsx
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
status: issues_found
---

# Phase 9: 코드 리뷰 보고서

**리뷰 시각:** 2026-10-29T02:49:14Z
**깊이:** standard (+ 0007 트리거는 PostgreSQL `ON CONFLICT DO UPDATE` 의 `EXCLUDED` 규칙과, `useLunchWeek` 의 재연결 재조회는 `node_modules/@supabase/phoenix` 의 `Push.reset()` 구현과 교차 대조)
**리뷰 범위:** `git diff 933a774..HEAD -- . ':!.planning' ':!README.md' ':!CLAUDE.md'` (HEAD = `a260dbe`, 코드 33 파일 · +2724/−384). 문서(README·CLAUDE.md·.planning)는 범위 밖이고 작업 트리의 미커밋 문서는 보지 않았다.
**상태:** issues_found — 머지 전 CR-01 수정 필요

## 요약

주간 규칙의 정의처(`_shared/cooldown.ts` 다섯 함수)는 산술·경계·stale 판정이 전부 맞고, 두 Edge Function 과 클라이언트가 **같은 함수 값**을 가져다 쓴다. 0007 SQL 은 재실행 안전형이고 추가만 하므로 함수 재배포 전의 라이브(구 함수 `restaurants ( id, name )` 임베드 · `cooldown_days` 읽기 · 구 화면 `select *`)를 깨지 않는다. 트리거 `lunch_days_stamp` 는 INSERT 경로·`ON CONFLICT` 의 UPDATE 경로·부분 컬럼 upsert·같은 목적지 재선택 네 경우 모두 의도대로 DB 시각을 찍는다(`EXCLUDED` 는 BEFORE INSERT 트리거의 변경을 반영한다 — PG 문서). `useLunchWeek` 의 세 재조회 경로는 전부 `refresh` 하나를 지나고, 재연결 때 `SUBSCRIBED` 가 다시 불리는 것은 phoenix `Push.reset()` 이 `recHooks` 를 지우지 않아 참이다.

문제는 **클라이언트가 2단 폴백을 모른다**는 데 있다. 서버는 "쉬기 제외 → 방문 제외, 방문으로 전멸이면 쉬기만 뺀 후보로 되돌림" 이고, 클라이언트는 "후보 − (방문 ∪ 쉬기)" 한 단이다. 담긴 매장을 이번 주에 다 가 본 날(핀 3개짜리 팀이면 매주 목·금) 서버는 결과 행을 만드는데 오늘 탭은 빈 휠 + "담긴 후보가 전부 이번 주 제외예요 — 쉬기를 풀거나 매장을 더 담아 주세요" + 당첨 매장 행이 흐리게 "화 방문" 배지를 단 채로 "오늘은 이거예요" 를 함께 보인다(CR-01). ROADMAP 성공 기준 3 의 마지막 문장("폴백하되 그 사실을 화면에 보인다")이 이 지점에서 깨진다. 그 아래로 재조회 응답이 Realtime 이벤트를 덮는 경합(WR-01), 지워진 목적지 매장이 1순위로 둔갑하는 set-null 분기(WR-02), `lunch_days` 이름 컬럼의 길이 제약 부재(WR-03), 실패해도 입력을 지우는 "다른 매장" 폼(WR-04)이 있다.

게이트(리뷰어 실행): `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm test` 24 files / 552 passed · `npm run check:edge` exit 0. `npm run build` 는 `NEXT_PUBLIC_*` 가 필요해 실행하지 않았다(세 SUMMARY 가 exit 0 보고). 커밋 메시지 AI 표기 grep 0 (유일한 매치는 파일명 "CLAUDE.md"). `grep -rn '@/components/' lib` 0. `cooldownDays`·`applyCooldown`·`cooldown_*` 잔존은 `cooldown.ts` 머리 주석 1줄뿐.

## Critical

### CR-01: 방문 전멸 폴백의 날 오늘 탭이 "전부 제외" 와 "오늘의 결과" 를 동시에 보인다 — 휠은 비고 당첨 행은 흐리다

**파일:** `app/page.tsx:109-110,140-141` · `components/CandidateList.tsx:112-116,222,232-233` · `lib/candidates.ts:112-115` (대조 `supabase/functions/_shared/cooldown.ts:99-105`)
**문제:** 서버 pool 은 2단이다 — pool1 = 후보 − 쉬기, pool2 = pool1 − 방문, pool2 가 비면 pool1 로 되돌린다(`applyWeeklyExclusions`, `fellBack: true`). 클라이언트는 한 단이다: `excluded = weeklyExclusionMap(…)`(방문 ∪ 쉬기) → `wheelItems = todayCandidates.filter(c => !excluded.has(c.id))`(`app/page.tsx:109`). 두 정의는 pool2 가 비지 않는 날만 일치한다. 담긴 매장을 월~어제 전부 가 본 날(핀 매장만 담는 팀은 그 주 안에 반드시 온다):
- 추첨 전: 휠 `items=[]` → `Wheel` 의 빈 상태(점선 원)가 그려지고 `ResultBlock` 은 "뽑는 후보 **0**", 목록 상단에 `role=status` 안내 "담긴 후보가 전부 이번 주 제외예요 — 쉬기를 풀거나 매장을 더 담아 주세요"(`CandidateList.tsx:112-116`). 그런데 서버는 `fellBack` 으로 정상 추첨한다 — 안내가 시키는 일(쉬기 해제·매장 담기)은 필요 없고, "뽑는 후보 0" 은 거짓이다.
- 추첨 뒤: 머리글 "오늘은 이거예요" · 결과 카드에 당첨 매장 · `poolCount = ranking.length`(pool1 크기)인데, 휠은 여전히 빈 원이고(`winnerIndex` -1), 목록 헤더 "담긴 n · 뽑는 **0**", 전원 제외 안내는 그대로 떠 있고, **당첨 매장의 행이 opacity 0.62 + "화 방문" 배지**로 "안 뽑힌 매장" 처럼 보인다(`CandidateList.tsx:222,232`). 다시 돌리기를 눌러도 같은 폴백이라 화면은 바뀌지 않는다.
09-02 SUMMARY 는 이 날을 "-1 이 될 수 있고 그때 하이라이트만 빠진다" 로 적었지만, 빠지는 것은 하이라이트가 아니라 휠 전체이고 거기에 모순된 안내 둘이 더 붙는다. `_shared/cooldown.ts:3-4` 머리 주석이 경고한 "둘이 갈라지면 휠에서 빠진 매장이 서버에서 뽑히는 날" 이 정확히 이 날이다. ROADMAP 성공 기준 3 의 "제외 뒤 후보가 0개면 전체 후보로 폴백하되 **그 사실을 화면에 보인다**" 가 불충족이다.
**근거:** `app/page.tsx:109` `todayCandidates.filter((c) => !excluded.has(c.id))` · `:141` `allExcluded = todayCandidates.length > 0 && wheelItems.length === 0` · `components/Wheel.tsx:91` `if (items.length === 0)` 빈 원 분기 · `_shared/cooldown.ts:103-105` pool2 전멸 → `picked: pool1`.
**제안:** 클라이언트도 **같은 함수**로 단을 나눈다 — `applyWeeklyExclusions` 는 import 0 의 순수 함수라 `lib/lunchDay.ts` 가 바로 가져올 수 있다.
1. `lib/lunchDay.ts` 에 `wheelPool(candidates, excluded): { items; fellBack; allPaused }` 를 둔다: `pausedIds = excluded 중 reason "paused"`, `visitedIds = reason "visited"` 로 `applyWeeklyExclusions(candidates.map(c => ({ ...c, restaurant_id: c.id })), …)` 를 부른다. 휠·`poolCount`·헤더 카운터·`allExcluded`(= `allPaused`) 가 전부 그 결과를 본다.
2. `listTodayRows` 에 `onWheel: ReadonlySet<string>` 을 더해 slice 는 **휠에 있는 행에만** 매기고 배지(`excludedReason`)는 그대로 둔다 — 폴백의 날 방문 매장은 "03 · 화 방문" 처럼 번호와 사유를 함께 보인다. `CandidateRowView` 의 opacity 는 `slice !== null` 기준이라 자동으로 맞는다.
3. `fellBack` 이면 `CandidateList` 안내를 "이번 주 담긴 곳을 다 가 봤어요 — 전체 후보에서 뽑아요" 로, `allPaused` 일 때만 지금 문장을 보인다.
4. spec: `lib/lunchDay.test.ts` 에 폴백·전원 쉬기·정상 세 경우, `lib/candidates.test.ts` 에 "폴백의 날 방문 행이 slice 를 받는다", `findWinnerIndex` 가 그 items 에서 당첨을 찾는 경우.

## Warnings

### WR-01: 재조회 응답이 그 사이 도착한 Realtime 이벤트를 덮는다 — 이벤트는 다시 오지 않는다

**파일:** `lib/lunchDay.ts:148-152` (호출 `lib/useLunchWeek.ts:48-64`)
**문제:** `fetched` 는 `days` 를 **통째로 교체**한다. 조회(REST)가 DB 스냅샷을 찍은 뒤 커밋된 UPDATE/INSERT 의 이벤트가 소켓으로 먼저 도착해 `changed` 로 들어오고, 그 뒤 옛 스냅샷의 응답이 와서 그 행을 지운다. 이 표는 INSERT/UPDATE 만 있어 다음 이벤트가 없으므로 다음 `refresh`(탭 복귀·재연결)까지 그 탭만 옛 목적지를 본다. 세대 번호는 "조회 vs 조회" 의 stale 을 거를 뿐 "조회 vs 이벤트" 는 보지 않는다. 창이 열리는 순간이 정확히 `visibilitychange → visible` 과 `SUBSCRIBED` — 휴대폰이 돌아오는 그 순간 누가 "웨이팅 있어요" 를 누르면 돌아온 휴대폰만 다른 목적지를 본다. 초기 로드(세대 0·1)도 같은 창을 가진다(`lib/rowset.ts` 의 `pending` 버퍼가 막던 바로 그 경합인데, 이 리듀서는 버퍼가 없다).
**제안:** 0007 트리거가 `updated_at` 을 DB 시각으로 **항상** 찍으므로 병합 기준이 이미 있다. `fetched` 를 "날짜별 합집합, `updated_at` 이 큰 쪽 유지" 로 바꾼다 — 응답에 없는데 state 에 있는 날짜는 스냅샷 뒤 INSERT 라 유지한다(delete 가 없어 "사라진 행" 은 존재하지 않는다). `lib/lunchDay.test.ts` 에 "changed 뒤 도착한 같은 세대의 fetched 는 더 새 행을 덮지 않는다" 1건.

### WR-02: 목적지 매장이 지워지면 set-null 행이 "되돌리기" 로 읽혀 1순위로 둔갑한다 — 이름 스냅샷은 어디서도 읽히지 않는다

**파일:** `supabase/functions/_shared/cooldown.ts:63-68` · `lib/lunchDay.ts:32-43` · `lib/history.ts:40-47` (스키마 `0007_lunch_days.sql:18-19`)
**문제:** `effectiveDestinationId` 는 `destination_id === null` 을 한 가지 뜻(되돌리기)으로만 본다. 그런데 `on delete set null`(0007:18) 도 같은 값을 만든다. 팀이 B 로 바꿔 B 에 갔고 며칠 뒤 누가 B 를 카탈로그에서 지우면: ① `destinationOf` 가 당첨 A 를 "오늘 갈 곳" 으로 보이고(`destination_name` "B" 는 `fromDay` 가 false 라 읽지 않는다 — `lib/lunchDay.ts:35-36`), ② `applyLunchDays` 가 그날 기록·랭킹을 **A 에 간 날**로 센다(`lib/history.ts:42-47`), ③ `dayExclusionId` 가 A 를 돌려 이번 주 남은 날 A 가 휠·pool 에서 빠진다 — 팀은 A 에 간 적이 없다. 0007:13 과 `LunchDayRow.destination_name` 주석(`lib/supabase/client.ts:44`)은 "매장이 지워져도 어디 가기로 했나가 남는다" 라고 적지만, `destination_id` 가 null 인 경로에서 `destination_name` 을 읽는 코드가 0곳이다. `visited` 분기는 대칭이 맞다(`visited_id` null + `visited_name` → "다른 매장", 제외 없음, 이름 유지) — `destination` 분기만 비대칭이다. 데이터로 구분은 가능하다: 되돌리기는 `destination_name` 도 null 로 쓴다(`app/page.tsx:281-282`), 삭제는 `destination_name` 을 남긴다.
**제안:** `DayDestinationRef` 에 `destination_name` 을 더하고 `effectiveDestinationId` 에 "`destination_id === null && destination_name !== null`(지워진 목적지) 이고 stale 이 아니면 **null**(뺄 매장 없음)" 분기를 넣는다. `destinationOf` 는 그 경우 `{ id: null, name: destination_name, rank: null }`, `applyLunchDays` 는 `restaurant_id: null, menu: destination_name`(지워진 당첨과 같은 이름 키 집계). Edge 두 함수의 `dayByDate` 좁히기(`spin-roulette/index.ts:220-225`·`respin-roulette/index.ts:210-215`)와 `lunch_days` select 에 `destination_name` 을 더하고 `edgeImports` 계약을 갱신한다. spec 3곳(cooldown · lunchDay · history) 각 1건.

### WR-03: `lunch_days` 의 두 이름 컬럼에 길이 제약이 없다 — 이 레포가 모든 사용자 입력 이름에 건 24 코드포인트 check 의 유일한 예외

**파일:** `supabase/migrations/0007_lunch_days.sql:19,23` (대조 `0005_restaurants_settings.sql` 의 `restaurants.name` check · `lib/constants.ts` 머리 주석 · `lib/lunchDay.ts:186-194`)
**문제:** `visited_name` 은 사용자가 치는 값("다른 매장")이고 `destination_name` 도 anon 이 아무 문자열이나 쓸 수 있다(RLS insert/update 개방). 상한은 `parseOtherVisitName` 의 클라이언트 24 코드포인트뿐이다 — PostgREST 를 직접 부르면 수 MB 문자열이 들어가고, 그 값이 `CalendarLog` 칸(`:189`)·달력 머리글 "가장 많이 간 매장 …"(`:69`)·`RankingView` 포디움 `h3`(`:118`)·`DestinationCard` 요약(`:189`)·`aria-label`(`CalendarLog.tsx:138`) 에 그대로 그려진다. CLAUDE.md 가 `MENU_NAME_MAX_LEN` 24 를 "0005 의 check 제약을 코드포인트 단위로 비춘 것" 이라고 못 박은 이유가 바로 이 경로인데, 0007 은 그 규율을 따르지 않았다. 아직 라이브 미적용이라 지금 고치면 0008 이 필요 없다. 같은 자리에서 `visit_status = 'visited'` 인데 `visited_id`·`visited_name` 둘 다 null 인 행(화면은 "오늘은 에서 먹었어요" — `lib/lunchDay.ts:64`·`DestinationCard.tsx:189`)도 막을 수 있다.
**제안:** 0007 에 `check (destination_name is null or char_length(destination_name) between 1 and 24)` · `check (visited_name is null or char_length(visited_name) between 1 and 24)` · `check (visit_status <> 'visited' or visited_id is not null or visited_name is not null)` 세 줄. `0007_lunch_days.test.ts` 에 세 check 의 존재와 숫자 24 를 고정하고, `lib/constants.ts` 머리 주석의 "24 는 메뉴명·매장명·메뉴 원소가 공용" 에 `lunch_days` 두 컬럼을 더한다. `formatLunchDayWriteError` 에 23514 분기("이름은 24자까지") 1줄.

### WR-04: "다른 매장" 저장이 실패해도 입력을 비우고 폼을 닫는다 — 카드가 성공 여부를 받지 못한다

**파일:** `components/DestinationCard.tsx:32-33,56-66` · `app/page.tsx:274,299`
**문제:** `onSetDestinationAction`·`onSetVisitAction` 은 `Promise<void>` 다. 이 레포의 다른 쓰기 콜백 6개(`onAddAction`·`onRemoveAction`·`onUpdateAction`·`onTogglePinAction`·`onTogglePauseAction`·후보 토글)는 전부 `Promise<boolean>` 이고, `RestaurantForm` 은 그 값으로 "실패하면 입력을 그대로 둔다 — 다시 치게 만들면 사용자는 같은 값을 두 번 입력한다"(`RestaurantList.tsx:240`) 를 지킨다. `submitOther` 는 `await onSetVisitAction(...)` 뒤 무조건 `setOtherOpen(false)`·`setOtherText("")` 라, 네트워크 실패·FK 위반 때 배너는 뜨지만 24자 이름은 사라지고 폼은 접힌다. 식당에 앉아 휴대폰으로 치는 상황이라 재입력 비용이 가장 큰 자리다.
**제안:** 두 콜백을 `Promise<boolean>` 으로 바꾸고(`setDestination`·`setVisit` 이 `return true/false`), `submitOther` 는 `ok` 일 때만 비운다. 다른 버튼(순위 버튼·단체 점심 안 함·다음 식당·되돌리기)은 입력이 없어 그대로 둬도 된다.

## Info

### IN-01: 트리거 함수에 `search_path` 고정이 없다

**파일:** `supabase/migrations/0007_lunch_days.sql:65-80`
**문제:** `lunch_days_stamp()` 는 plain plpgsql(security invoker)로 `now()` 만 부른다. anon 은 스키마에 CREATE 권한이 없어 실제 가로채기 경로는 없지만, Supabase 보안 어드바이저가 `function_search_path_mutable` 을 WARN 으로 올리고, 이 레포의 첫 함수라 선례가 된다.
**제안:** `language plpgsql set search_path = pg_catalog, public as $$ … pg_catalog.now() …$$`. 0007 spec 에 `set search_path` 1건.

### IN-02: `destination_set_at`(DB `now()`)과 respin 의 `spun_at`(Edge 런타임 `new Date()`)은 다른 시계다

**파일:** `supabase/functions/respin-roulette/index.ts:264` · `0007_lunch_days.sql:60-63` 주석 · `_shared/cooldown.ts:60-66`
**문제:** 0007 트리거는 "클라이언트 시계 오차" 를 없앴고 spin 의 `spun_at` 은 DB 기본값 `now()`(`0001:16`)라 같은 시계다. 그러나 respin 은 Edge 런타임 시각을 쓴다. 두 서버 시계의 차는 ms 단위라 "다음 식당" 클릭과 다시 돌리기가 그 안에 겹칠 때만 stale 판정이 뒤집힌다 — 실질 위험은 작다. 다만 0007 주석이 "results.spun_at(서버 시각)" 이라고만 적어 두 시계라는 사실이 코드 어디에도 없다.
**제안:** 선택 사항. 한 시계로 두려면 `results` 에 `before update … when (new.spun_at is distinct from old.spun_at)` 로 `spun_at := now()` 를 찍는 트리거 1개(0008). 아니면 `cooldown.ts:60` 주석에 "respin 의 spun_at 은 Edge 시각 — 호스트 간 ms 차는 허용" 한 줄.

### IN-03: `weekStart` 가 null 이면 쉬지 않는 매장이 전부 "쉬기" 로 읽힌다

**파일:** `supabase/functions/spin-roulette/index.ts:189-191` · `respin-roulette/index.ts:180-182`
**문제:** `weekStartOf` 는 `string | null` 인데 `c.paused_week === weekStart` 에 가드가 없다 — null 이면 `paused_week` 가 null 인(=쉬지 않는) 후보 전부가 매치돼 `all_paused` 로 그날 추첨이 멈춘다. 지금은 도달 불가(`kst.ts:58` 이 요일을 `?? 0` 으로 닫고 `now.date` 는 늘 날짜꼴)지만, `weekStartOf` 가 null 을 돌려주는 설계(`cooldown.ts:29-30` "필터를 끄는 쪽이 싸다")와 호출부의 결과가 정반대다.
**제안:** `weekStart !== null && c.paused_week === weekStart`. 클라이언트(`app/page.tsx:53`·`app/restaurants/page.tsx:26`)는 `?? todayKey` 폴백이라 같은 문제가 없다.

### IN-04: `LunchDayWriteAction` 의 "쉬기"·"쉬기 해제" 는 쓰이지 않는다

**파일:** `lib/errors.ts:88-93` (호출 `app/page.tsx:288,293,314,319` · `app/restaurants/page.tsx:172-180`)
**문제:** 쉬기 토글은 `formatRestaurantWriteError("쉬기" | "쉬기 해제", …)` 를 지난다. `formatLunchDayWriteError` 호출 4곳은 전부 "목적지 변경"·"방문 기록" 이다. 유니온 두 멤버와 `:88` 주석("매장 쉬기 토글")이 죽은 경로다.
**제안:** 두 멤버와 주석 문구를 지운다(또는 쉬기 토글을 이쪽으로 옮기고 `RestaurantWriteAction` 에서 뺀다 — 둘 중 하나만).

### IN-05: 지도 링크 셋이 전부 "지도" 라는 같은 이름이고, 펼침 버튼에 `aria-controls` 가 없다

**파일:** `components/DestinationCard.tsx:84,139-144` · `components/ResultBlock.tsx:120`
**문제:** 한 카드 영역에 "지도" 링크가 최대 3개(목적지·2순위·3순위) 있어 스크린리더 링크 목록에서 구분되지 않는다. "다른 매장" 버튼은 `aria-expanded` 를 두면서 가리키는 폼의 id 를 주지 않는다.
**제안:** `aria-label={`${name} 지도`}` 셋, `aria-controls="other-visit-form"` + 폼 `id`.

### IN-06: spec 이 비어 있는 동작

**파일:** `supabase/migrations/0007_lunch_days.test.ts:98-107` · `supabase/functions/_shared/edgeImports.test.ts:211,329` · `lib/lunchDay.test.ts` · `lib/history.test.ts:192-262` · `lib/candidates.test.ts:320-362`
**문제:** (a) 트리거 spec 은 `:= now()` 세 줄과 `is distinct from` 한 줄만 고정한다 — `tg_op = 'INSERT' or` 두 곳을 지우면 INSERT 경로가 꺼져도 green 이다(첫 `setDestination` 이 클라이언트 시각을 그대로 남긴다). (b) edgeImports 는 `from("lunch_days")` 1회와 `.lt("date"` 개수만 세고 **select 열 목록**(`date, destination_id, destination_set_at, visit_status, visited_id`)은 보지 않는다 — `visit_status` 하나가 빠지면 `dayByDate` 좁히기가 전부 `unknown` 으로 떨어져 방문 확인이 조용히 무시되는데 어떤 검사도 울리지 않는다. (c) WR-01 의 "changed 뒤 fetched" 순서, (d) WR-02 의 지워진 목적지 행(`destination_id` null + `destination_name` 비null) 세 모듈, (e) CR-01 의 폴백 날(`findWinnerIndex`·`listTodayRows`) — 전부 spec 0건. (f) `applyLunchDays` 는 `visited` 인데 `visited_name` 이 null 이면 `row.menu`(당첨 이름)로 떨어진다(`lib/history.ts:44`) — "이름 없는 다른 매장" 이 당첨 매장에 간 것으로 집계되는데 spec 도 의도 주석도 없다(WR-03 의 check 가 들어오면 도달 불가가 되므로 그때 함께 닫힌다).
**제안:** (a) `expect(count(/tg_op = 'INSERT'/g)).toBe(2)`. (b) 두 함수에 `select\("date, destination_id, destination_set_at, visit_status, visited_id"\)` 1 · `select\("date, restaurant_id, spun_at"\)` 1 씩. (c)~(e) 각 수정과 함께. (f) WR-03 뒤 `applyLunchDays` 의 그 분기를 `visited_name ?? ""` 로 바꾸고 spec 1건.

### IN-07: `lunch_days` 는 기록·랭킹에 들어가는 첫 anon 쓰기 표다

**파일:** `supabase/migrations/0007_lunch_days.sql:40-45` · `app/page.tsx:278-286,303-312`
**문제:** 지금까지 기록·랭킹의 입력(`results`)은 service_role 만 썼다. 0007 부터 anon 이 **어느 날짜든**(과거·미래 포함) `visit_status='skipped'` 로 기록을 지우거나 `visited_id` 를 특정 매장으로 몰아 랭킹을 올릴 수 있다. `candidates`·`restaurants` 삭제와 같은 신뢰 수준이고 익명 서비스 설계가 수용한 범위지만, "추첨 결과는 바꿀 수 없다" 는 진술이 "추첨 결과 **행**은 바꿀 수 없다, 그 위의 기록은 누구나 바꾼다" 로 바뀐 것이다. 코드 쪽에서 더 할 일은 없고(설계 결정), CLAUDE.md:68 의 RLS 요약 문장에 `lunch_days`(select·insert·update, delete 없음)가 아직 없다는 것만 적어 둔다 — `:29` 흐름 문장에는 들어가 있다. `mapHref` 의 URL 조립(`encodeURIComponent` + `parseLocationLink` 화이트리스트)과 세 링크의 `target=_blank rel=noopener noreferrer` 는 문제 없음.
**제안:** 문서 한 줄(범위 밖이라 여기서는 기록만). 코드 변경 없음.

## 검증한 것 중 문제 없음 (기록)

- **주 시작·창**: `weekStartOf` 는 UTC 자정 산술로 연·월·윤년 이월이 맞고(spec #1~#9), `weeklyWindowStart` 는 월요일 null. Edge 두 함수(`:189-191`·`:180-182`)와 클라이언트(`lib/lunchDay.ts:93-102`)가 월요일에도 쉬기를 적용하고 방문 창만 비운다 — 같은 결과. results 창은 양쪽 `[weekStart, today)`; lunch_days 창은 Edge `[weekStart, today)`, 클라이언트 `[weekStart, today]` 인데 클라이언트의 오늘 행은 목적지 카드만 읽고 `weeklyExclusionMap` 은 당첨 날짜로만 `days` 를 찾으므로 제외 집합은 같다. `lunchWeekReducer.changed` 의 창(`date > today` 거름)도 조회와 같다.
- **stale 규칙(다시 돌리기 뒤)**: `set_at < 새 spun_at` → 당첨. 그 뒤 `isDefault` 가 true 라 되돌리기 버튼이 숨고, 옛 `destination_id` 가 새 1순위와 같아도 `destinationOf` 가 rank 1·같은 id 를 돌려 화면이 모순되지 않는다. 같은 순간은 목적지(spec #17).
- **트리거 네 경로**: INSERT → `now()`; `INSERT … ON CONFLICT DO UPDATE` 의 UPDATE 분기에서 `new` 는 `EXCLUDED`(BEFORE INSERT 트리거 결과 반영) → `old` 와 distinct → 재각인; `setVisit` 의 부분 payload 는 `destination_set_at` 을 SET 하지 않아 `new = old` → 유지; 같은 목적지 재선택은 set_at 만 바뀌어 재각인. `updated_at` 은 무조건. 되돌리기(`destination_id null`)도 set_at 이 찍히지만 `effectiveDestinationId` 가 id null 을 먼저 보므로 무해.
- **지워진 당첨(set-null)**: `findWinnerIndex` -1 → 하이라이트만 빠지고 이름 스냅샷은 남는다(`destinationOf` spec #9). `effectiveDestinationId` 는 둘 다 null 이면 null → 제외 없음. `applyWeeklyExclusions` 가 null id 를 무시(spec #34).
- **`useLunchWeek`**: 토픽 `lunch-days-<n>` 을 effect 안에서 구독마다 매긴다; 채널·리스너 cleanup 둘 다 있다; `if` 는 `cancelled` 가드 + 분기 2개(visible·SUBSCRIBED) 그대로다(`??` 는 분기가 아니다); 자정(todayKey·weekStart 변경) → 두 effect 재실행 → 재구독 → `SUBSCRIBED` → `refresh` 에 새 창 — 그 사이 옛 `winners` 는 새 `weekStart` 필터에 걸려 무해. `SUBSCRIBED` 가 재연결마다 다시 불리는 것은 `node_modules/@supabase/phoenix/priv/static/phoenix.cjs.js:512-518` `rejoin → joinPush.resend` 와 `:154-160` `reset()` 이 `recHooks` 를 비우지 않는 것으로 확인. 세대 0 조회 + `SUBSCRIBED` 재조회의 마운트 2회는 의도(소켓이 안 붙는 환경에서 세대 0 이 유일한 데이터 경로).
- **기록·랭킹 페이지**: `lunch_days` 조회가 results 와 같은 창(`[start, end)`)·같은 하한(`lowerBound`)이고 `Promise.all` 로 함께 간다; 토픽 `lunch-days-log-<n>`·`lunch-days-rank-<n>` 은 effect 안; 함수형 업데이터; DELETE 분기 없음은 0007 에 delete 정책이 없어 맞다(service_role 이 대시보드에서 지우면 새로고침까지 그 행이 남는데, `results` 도 이미 같은 성질이다). `RANK_COLUMNS` 에 `spun_at` 추가 + `toRankResultRow` 동기.
- **0007 SQL**: 모든 문이 재실행 안전형(`if not exists`·`drop policy if exists`·`create or replace`·`drop trigger if exists`·`pg_publication_tables` 가드); RLS select/insert/update 3쌍, delete 없음; comment 3; 추가만이라 함수 재배포 전 라이브 무영향(구 spin 의 `restaurants ( id, name )` 임베드와 `cooldown_days` 조회가 그대로 통과, 구 화면의 `select *` 는 새 컬럼을 무시). 롤백은 표 → 함수 → 컬럼 → comment 순서가 맞고 `drop function` 은 표(트리거)가 사라진 뒤라 의존 에러가 없다. `cooldown_days` comment 원문은 0005:62 와 글자 단위로 같다.
- **컴포넌트 규율**: `DestinationCard`·`CandidateList`·`ResultBlock`·`RestaurantList`·`CalendarLog`·`RankingView` 모두 supabase 값 import 0; 경계를 넘는 콜백은 전부 `~Action`; `l-*` 는 문자열 리터럴만(layoutClasses spec 이 `app`·`components` 를 전수 스캔); inline 에 폭 분기 속성 중복 없음(`flex-wrap` 은 폭 분기가 아니다); 이름 칸 `minWidth: 0`(`DestinationCard.tsx:214`·`ResultBlock.tsx:222,227`·`RestaurantList.tsx:541,543`)과 본문 `overflow-wrap: break-word`(`globals.css:72`)로 24자 무공백 이름이 꺾인다; `badgeText` 28px 에 "이번 주 쉬기" 는 keep-all 아래 "이번/주/쉬기" 로 3줄 — 의도된 선택(주석 `:350`).
- **Edge 응답·로그**: `console.error` spin 9 · respin 7 지점이 계약과 같다; `all_paused` 에 `candidate_count`·`excluded_count` 동반; `weekly_skipped` 는 창 조회 둘 중 하나 실패 시 방문 제외만 건너뛰고 쉬기는 후보 행에 실려 와 적용된다; respin 405 가드·OPTIONS 단락 불변.
- **잔존·방향성**: `cooldownDays`·`applyCooldown`·`cooldownWindowStart`·`cooldown_fallback`·`cooldown_skipped` 는 `cooldown.ts:4` 머리 주석 1줄만; `lib → components` import 0; `lib/lunchDay.ts` 의 값 import 는 `constants`·`restaurants`·`_shared/cooldown` 셋(순수 유지); `lib/candidates.ts` 의 `ExclusionReason` 은 `import type`.

## 역검증 — ROADMAP Phase 9 성공 기준

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | "오늘 갈 곳: ○○" · 웨이팅 → 다음 식당이 모든 탭에 반영 · 되돌리기 · 안 누른 날은 1순위 | **passed-with-note** | `DestinationCard` + `setDestination` upsert + `lunch-days-<n>` 구독 + `destinationOf`(기록 없음 → 1순위, spec #2). 머리글도 "오늘 갈 곳: B"(`app/page.tsx:544`). note: decided 실렌더는 로컬에서 확인 불가(09-02 SUMMARY 도 미검증); WR-01(재조회 경합)·WR-02(목적지 매장 삭제) 두 가장자리에서 "모든 탭이 같은 목적지" 가 깨진다 |
| 2 | 방문 확인 선택 · 안 누른 날 기록 탭 "확인 안 됨" · `results` 불변 | **passed-with-note** | `setVisit` 은 `lunch_days` 만 쓴다(`app/` 안 `from("results")` 는 전부 `.select`); `CalendarLog.tsx:268-271` "갈 곳" + "확인 안 됨" 태그; `applyLunchDays` `unconfirmed = !visited`. note: 실렌더 미확인(라이브 데이터 없음) |
| 3 | 화~금 pool 에서 월~어제 목적지 + 쉬기 제외 · 휠에서 빠지고 목록에 사유+흐림 · 월요일 00:00 해제 · **제외 뒤 0개면 전체 폴백 + 그 사실을 화면에** | **passed-with-note — 마지막 문장 미충족(CR-01)** | 앞 세 문장은 Edge(`applyWeeklyExclusions`)·클라이언트(`weeklyExclusionMap` → 휠 필터·`exclusionBadge`·opacity 0.62)·월요일 null 창으로 충족. 서버 폴백은 구현됐으나(`fellBack` → pool1, 응답 `weekly_fallback`) 화면은 폴백을 모르고 "전부 제외" 안내 + 빈 휠을 보인다 |
| 4 | 2·3순위 지도 버튼 · 기록·랭킹 목적지 기준 | **passed** | `ResultBlock.tsx:120` `backup.href`(`mapHref`), 목적지 카드 `:84`; 두 페이지가 `applyLunchDays(filterSince(…), days)` 를 지난다(`log:143`·`rank:158`), `RankingView` 문구 "가장 많이 간 매장 · 확인 안 된 날은 1순위로 셈" |
| 5 | 0007 + 롤백 + README "0007 적용"(SQL → 함수 2종 → 머지) · 5 게이트 · 커밋·PR AI 표기 0 | **passed-with-note** | SQL·롤백·spec 19건 존재; README:154 "## 0007 적용 (주간 점심 기록, 1회)" 존재(내용은 범위 밖). 리뷰어 실행 게이트 4종 exit 0(`build` 는 env 부재로 미실행 — SUMMARY 3건이 exit 0 보고). 커밋 20개 AI 표기 0. note: PR 은 아직 없어 "PR 에 AI 표기 없음" 은 머지 시점 확인 |

## 요약표

| ID | 심각도 | 파일:행 | 한 줄 |
|---|---|---|---|
| CR-01 | Critical | app/page.tsx:109-110,140-141 · CandidateList.tsx:112-116,222 | 클라이언트가 2단 폴백을 모른다 — 방문 전멸의 날 빈 휠 + "전부 제외" 안내 + 흐린 당첨 행이 "오늘의 결과" 와 공존 |
| WR-01 | Warning | lib/lunchDay.ts:148-152 | `fetched` 가 days 를 통째로 교체해 조회 중 도착한 Realtime 이벤트를 덮는다 — `updated_at` 병합으로 |
| WR-02 | Warning | _shared/cooldown.ts:63-68 · lib/lunchDay.ts:32-43 · lib/history.ts:40-47 | 목적지 매장 삭제(set-null)가 되돌리기로 읽혀 1순위에 간 것으로 기록·제외 — 이름 스냅샷 미사용 |
| WR-03 | Warning | 0007_lunch_days.sql:19,23 | `destination_name`·`visited_name` 길이 check 없음 — 0005 의 24 코드포인트 규율 예외 |
| WR-04 | Warning | DestinationCard.tsx:32-33,56-66 | 쓰기 콜백 `Promise<void>` — "다른 매장" 실패에도 입력 소거·폼 닫힘 |
| IN-01 | Info | 0007_lunch_days.sql:65-80 | 트리거 함수 `search_path` 미고정 |
| IN-02 | Info | respin-roulette/index.ts:264 | respin `spun_at` 은 Edge 시계, `destination_set_at` 은 DB 시계 |
| IN-03 | Info | spin:189-191 · respin:180-182 | `weekStart` null 가드 없음 — null 이면 비쉬기 전원이 쉬기 매치 |
| IN-04 | Info | lib/errors.ts:88-93 | `LunchDayWriteAction` "쉬기"·"쉬기 해제" 미사용 |
| IN-05 | Info | DestinationCard.tsx:84,139 · ResultBlock.tsx:120 | "지도" 링크 3개 동명 · `aria-expanded` 에 `aria-controls` 없음 |
| IN-06 | Info | 0007 test:98-107 · edgeImports:211,329 · 세 lib spec | 트리거 INSERT 가드·Edge select 열 목록·CR/WR 가장자리 spec 0건 |
| IN-07 | Info | 0007_lunch_days.sql:40-45 | 기록·랭킹에 들어가는 첫 anon 쓰기 표 — 설계 수용, 문서 한 줄 |

## 판정

**issues_found — 머지 전 수정 필요.** 규칙 모듈·SQL·훅의 뼈대는 맞고 게이트 4종은 green 이다. 막는 것은 CR-01 하나다 — 서버와 클라이언트가 "휠에 무엇이 오르나" 를 다른 함수로 정하고 있어 성공 기준 3 의 마지막 문장이 거짓이 되는 날이 매주 올 수 있다. 수정은 `applyWeeklyExclusions` 를 클라이언트에서도 부르는 것이라 새 규칙이 아니라 기존 정의처를 쓰는 일이다. WR-01~03 은 0007 이 아직 라이브에 없는 지금이 가장 싼 때(특히 WR-03 은 SQL 적용 뒤면 0008 이 된다). WR-04 는 콜백 반환형 한 줄이다. IN 은 선택.

---

_리뷰: 2026-10-29T02:49:14Z_
_깊이: standard_

## 반영 (2026-10-29, 리뷰 뒤 수정 커밋)

| ID | 처리 | 내용 |
|---|---|---|
| CR-01 | 수정 | `lib/lunchDay.ts wheelPool` — `applyWeeklyExclusions` 를 클라이언트에서 그대로 불러 휠·카운터·안내·배지가 2단 폴백 위에 선다. 폴백 날 방문 행은 휠에 오르고(배지 없음) 목록 위에 "담긴 후보를 이번 주 다 가 봤어요 — 쉬는 곳만 빼고 다시 뽑아요"(`fellBack`). `allExcluded` 는 `allPaused`. spec 5 |
| WR-01 | 수정 | `lunchWeekReducer fetched` — 날짜별 병합, `updated_at`(서버 시각) 이 늦은 쪽 유지, 창 밖 state 행 폐기. spec 3(+#33 기대값 갱신) |
| WR-02 | 수정 | `_shared/cooldown.ts isDestinationFresh` 추가(export 6). `destinationOf`·`applyLunchDays` 가 "id null · 이름 스냅샷 · fresh" 를 지워진 목적지로 갈라 이름으로 보이고·센다(되돌리기와 구분). spec 3 |
| WR-03 | 수정 | 0007 `destination_name`·`visited_name` `check (… between 1 and 24)`. spec 1 |
| WR-04 | 수정 | `DestinationCard` 콜백 `Promise<boolean>`, "다른 매장" 실패에 입력 보존. 페이지 핸들러 boolean 반환 |
| IN-01 | 수정 | 트리거 함수 `set search_path = ''`. spec 1 |
| IN-02 | 기록 | respin `spun_at`(Edge 시계) vs `destination_set_at`(DB) — 둘 다 서버 측이라 수용. 바꾸려면 0008 에서 `spun_at` 도 트리거로 |
| IN-03 | 수정 | Edge 2종 `weekStart === null` 이면 쉬기 미적용(전원 매치 방지) |
| IN-04 | 수정 | `LunchDayWriteAction` 2멤버 제거, errors spec 조정 |
| IN-05 | 일부 | "지도" 링크 `aria-label` `${name} 지도`(3곳). `aria-controls` 는 폼이 조건부 마운트라 생략 |
| IN-06 | 수정 | 트리거 INSERT 가드 spec 2 · Edge select 열 목록 계약 #66 · CR/WR 가장자리 spec(위) |
| IN-07 | 수정 | CLAUDE.md RLS 문장에 `lunch_days`(첫 anon 쓰기 표) |

게이트: tsc · lint · vitest(24 files · **566**) · build · check:edge exit 0.
