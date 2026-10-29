# Phase 9: 주간 점심 기록 - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Phase Boundary

룰렛이 뽑은 순서(0006 `results.ranking`)를 팀이 실제로 어떻게 썼는지 **하루 한 행**으로 남기고, 그 기록으로 **이번 주 제외 목록**을 만든다. 세 기능이 한 데이터 위에 선다.

1. **오늘 갈 곳** — 기본은 1순위. 누구든 "웨이팅 있어요 → 다음 식당" 을 누르면 모든 탭이 같은 목적지로 바뀐다. 되돌릴 수 있다.
2. **여기서 먹었어요** — 선택적 방문 확인. 안 누른 날은 "확인 안 됨" 으로 구분된다. `results` 는 덮어쓰지 않는다.
3. **이번 주 제외** — 월~어제의 목적지 매장 + "이번 주 쉬기" 매장은 추첨 pool 과 휠에서 빠지고 목록에 사유와 함께 흐리게 남는다. 월요일 00:00 KST 전부 해제. `settings.cooldown_days`(최근 N일 당첨 제외)는 이 규칙으로 대체된다.

덤으로 2·3순위 지도 버튼, 확률 표시 제거(Codex 평가 C5 — 제외된 매장이 휠 칸을 차지해 표시 확률이 거짓이었다), 기록·랭킹의 목적지 기준 집계.

하지 않는 것: 👍👎 투표(`.planning/seeds/thumbs-vote.md`), 가중치 추첨, 로그인·레이트리밋, Codex 품질 평가의 나머지 항목(C2 결과 조회 경합·C3 설정 fail-closed·C4 respin 타이머 — 별건), `cooldown_days` 컬럼 삭제(추가 → 코드 전환 → 제거 중 "제거" 는 다음 마이그레이션), `.planning/codebase/*.md` 전면 갱신(참조 정정만).

설계 정본은 `.planning/notes/weekly-exclusion-visit-record.md`(2026-10-28 /gsd-explore). 이 문서는 그 결정을 코드 단위로 내린 것이다.

</domain>

<decisions>
## Implementation Decisions

직접 실행 레인(결정 d527fe42): 플랜 3개, 실행·수정 직접, 순수 모듈·SQL 계약은 TDD, 리뷰 fable 1회. 판단 우선순위: 설계 정본 → 레포 관례(순수 모듈 + 얇은 컴포넌트 + `~Action`) → 0005·0006 선례(재실행 안전형 SQL, 적용 순서).

### 데이터 — 0007 `supabase/migrations/0007_lunch_days.sql`(추가만, 재실행 안전형)
- **D-01 `lunch_days` 하루 한 행.** `date date primary key` · `destination_id uuid references restaurants(id) on delete set null` · `destination_name text` · `destination_set_at timestamptz` · `visit_status text not null default 'unknown' check (visit_status in ('unknown','visited','skipped'))` · `visited_id uuid references restaurants(id) on delete set null` · `visited_name text` · `visited_at timestamptz` · `updated_at timestamptz not null default now()`. 행은 **누군가 행동할 때** 생긴다(`upsert onConflict date`) — 아무도 안 누른 날은 행이 없고 목적지는 파생값(D-02)이다. 이름 스냅샷을 함께 두는 이유는 `results.menu` 와 같다(매장이 지워져도 기록이 남는다). RLS: anon select·insert·update 개방, delete 정책 없음(= 기본 거부 — 되돌리기는 null 로 update 다). publication 에 추가(0005 의 존재 검사 루프 재사용). `comment on table` 로 "1번째 = 기본 목적지" 규칙을 DB 에도 남긴다.
- **D-05 `restaurants.paused_week date`(nullable).** "이번 주 쉬기" = 그 주 월요일 날짜를 저장. 활성 판정은 `paused_week === 이번 주 월요일` 이라 **만료가 자동**이고 cron 이 없다. 해제 = null. 핀 매장도 자정 리셋이 후보에 넣되 제외된다(핀 유지 — 핀은 "매일 올린다", 쉬기는 "이번 주는 뽑지 않는다" 로 뜻이 다르다). `restaurants` 는 이미 publication 에 있어 `useRestaurants` 구독으로 공짜로 흐른다. comment 추가.
- **D-07 `settings.cooldown_days` 는 코드에서 미사용.** 컬럼은 남긴다(0007 은 추가만). `comment on column` 을 "0007 이후 미사용 — 주간 제외로 대체" 로 바꾼다. `lib/settings.ts` 의 `Settings.cooldownDays` 필드와 spec 은 삭제(`SettingsRow.cooldown_days` 타입은 DB 모양이라 남긴다).
- **롤백** `supabase/rollback/0007_lunch_days.rollback.sql`: `drop table if exists lunch_days` + `alter table restaurants drop column if exists paused_week` + cooldown_days comment 복원. 적용 역순(PR 되돌림 → 함수 재배포 → SQL)을 머리 주석에.

### 순수 규칙 — `supabase/functions/_shared/cooldown.ts`(import 0, Edge·클라이언트 공용)
- **D-04 주 시작.** `weekStartOf(date: "yyyy-mm-dd", weekday: 0..6): string` — 월요일 날짜. 월요일 오프셋 = `(weekday + 6) % 7`, 산술은 기존 `cooldownWindowStart` 와 같은 UTC 자정 방식(연·월 이월은 생성자가). `weeklyWindowStart(today, weekday): string | null` — 오늘이 월요일이면 **null(창 없음)**, 아니면 weekStart. 창 = `[weekStart, today)` — 오늘은 안 들어간다(지금과 같은 이유: 다시 돌리기가 오늘 목적지를 다시 뽑을 수 있어야 한다). 요일은 `kstParts(now).weekday`(Edge 는 `kstNow()`, 클라이언트는 `kstParts(now)`) — 로컬 `Date` 요일 메서드 금지.
- **D-02 목적지 파생(단일 정의처).** `effectiveDestinationId(winner: { restaurant_id: string | null; spun_at: string }, day: { destination_id: string | null; destination_set_at: string | null } | null): string | null` — day 가 없거나 `destination_id` 가 null 이면 winner.restaurant_id. day 의 `destination_set_at` 이 `spun_at` **이전**이면 다시 돌리기로 순서가 바뀐 뒤의 옛 목적지라 무시하고 winner — 쓰기 없이 규칙으로 stale 을 처리한다(respin 함수가 lunch_days 를 건드리지 않는다). 둘 다 순간 비교(`Date.parse`), 파싱 불가면 문자열 비교(`lib/candidates.ts` `isNewSpin` 과 같은 이유).
- **D-03 하루의 제외 id.** `dayExclusionId(winner, day): string | null` — `visit_status === "skipped"` → null(단체 점심 안 함, 아무것도 안 뺀다) · `"visited"` → `visited_id`(카탈로그 밖 "다른 매장" 이면 null → 안 뺀다) · `"unknown"`(또는 day 없음) → `effectiveDestinationId`. 사용자 결정 "아무도 안 누른 날은 1순위 간 것으로 친다" 가 이 셋째 분기다.
- **D-06 2단 폴백.** `applyWeeklyExclusions(candidates, { pausedIds, visitedIds }): { picked; allPaused: boolean; fellBack: boolean }` — pool1 = 후보 − pausedIds. **pool1 이 비면 `allPaused: true`, picked 빈 배열**(쉬기 매장을 몰래 되살리지 않는다 — Codex 경고). pool2 = pool1 − visitedIds. 비면 pool1 로 되돌리고 `fellBack: true`(이번 주 다 가 봤으면 다시 가는 게 맞다). 기존 `applyCooldown`·`cooldownWindowStart` 는 삭제(참조 0 이 되고, "최근 N일" 개념이 사라졌다). 파일 머리 주석을 주간 규칙으로 다시 쓴다.

### Edge Function 2종 — 같은 변경
- **D-16 조회.** candidates embed 를 `restaurants ( id, name, paused_week )` 로 넓히고 `normalizeCandidates` 가 `paused_week: string | null` 을 함께 좁힌다(문자열 아니면 null). 창이 있으면(`weeklyWindowStart !== null`) 두 조회: `results.select("date, restaurant_id, spun_at").gte("date", weekStart).lt("date", today)` · `lunch_days.select("date, destination_id, destination_set_at, visit_status, visited_id").gte(...).lt(...)`. 날짜로 조인해 `dayExclusionId` → visitedIds. pausedIds = 후보 중 `paused_week === weekStart`(창이 null 인 월요일에도 쉬기는 적용한다 — 월요일에 "이번 주 쉬기" 를 누르면 그날부터 빠져야 한다. 월요일의 weekStart 는 today 자신이므로 `weekStartOf` 로 따로 구한다).
- **응답.** `cooldown_fallback`·`cooldown_skipped` → `weekly_fallback`(pool2 전멸 → pool1)·`weekly_skipped`(창 조회 둘 중 하나 실패 → 방문 제외 없이 pool1). 설정 조회에서 `cooldown_days` 를 더는 읽지 않는다(`select("spin_time")`; respin 은 설정 조회 자체가 필요 없어지지만 형제 대칭·`settings_fallback` 플래그를 위해 유지). **allPaused 는 `skipped: "all_paused"`** 로 결과 행을 만들지 않는다 — 오늘 탭은 stalled 로 떨어져 후보 목록이 잠기지 않고, 누가 쉬기를 풀거나 후보를 더하면 다음 분 cron 이 재시도한다. `candidate_count`(전체)·`picked_count`(pool) 유지. 결과 행의 `candidates` 스냅샷은 지금처럼 **전체 후보**(쉬기 포함) — 기록 상세의 "후보 목록" 은 그날 담긴 것의 사실이다.
- **D-15 클라이언트 번역.** `app/page.tsx` respin 의 `skipped` 분기에 `all_paused` → "후보가 전부 이번 주 쉬기 중이에요".
- 로그 지점 수가 바뀐다(창 조회 2개 → `console.error` 각 1). 계약 #(spin 8·respin 6) 갱신.

### 클라이언트 타입·순수 모듈
- **타입(`lib/supabase/client.ts`)** `RestaurantRow.paused_week: string | null` · 새 `LunchDayRow = { date; destination_id: string | null; destination_name: string | null; destination_set_at: string | null; visit_status: "unknown" | "visited" | "skipped"; visited_id: string | null; visited_name: string | null; visited_at: string | null; updated_at: string }` · `WeekWinnerRow = Pick<ResultRow, "date" | "restaurant_id" | "spun_at">`.
- **`lib/lunchDay.ts`(순수, `import type` + `_shared/cooldown` 값 import).**
  - `destinationOf(result: ResultRow | null, day: LunchDayRow | null): { id: string | null; name: string; rank: number | null } | null` — result 없으면 null. `effectiveDestinationId` 로 id 를 정하고, 이름은 day 의 스냅샷(id 가 day 것일 때) 아니면 `result.menu`. rank 는 `ranking` 에서 id 의 위치+1(없으면 null).
  - `nextDestination(ranking, currentId): { id; name } | null` — ranking 에서 currentId 뒤 첫 항목. currentId 가 없으면 `ranking[1]`. 끝이면 null(버튼 숨김).
  - `visitSummary(day): { kind: "unknown" } | { kind: "skipped" } | { kind: "visited"; name: string }`.
  - `weeklyExclusionMap(weekStart, today, winners: WeekWinnerRow[], days: LunchDayRow[], candidates: { id; paused_week }[]): Map<string, { reason: "visited"; date: string } | { reason: "paused" }>` — 목록 배지·휠 제외의 정의처. 날짜별 `dayExclusionId`, 쉬기는 `paused_week === weekStart`. **오늘 날짜는 넣지 않는다**(창과 같다).
  - `lunchWeekReducer`(순수): state `{ days: LunchDayRow[]; winners: WeekWinnerRow[]; loaded; error; generation }`. 액션 `fetched { generation; days; winners; error }` — **현재 세대만 받고 교체(refresh)**(`lib/rowset.ts` 와 달리 loaded 뒤 응답도 받는다 — 재조회 복구가 이 훅의 목적이다; stale 응답은 세대 불일치로 버린다) · `changed { row: LunchDayRow }`(INSERT/UPDATE 공통 upsert by date, 창 밖 날짜는 무시) · `refresh` → generation+1 반환(훅이 그 번호로 조회).
- **D-13 훅 `lib/useLunchWeek.ts`.** `useLunchWeek(weekStart: string, todayKey: string)`: 마운트·`weekStart`/`todayKey` 변경·`visibilitychange → visible`·채널 `SUBSCRIBED` 콜백에서 `refresh` 디스패치 → 조회 2개(lunch_days `[weekStart, today]` 포함, results `[weekStart, today)`) → `fetched`. lunch_days INSERT/UPDATE 2분기 구독, 토픽 `lunch-days-<n>` **effect 안에서**(자정 재구독). 훅 본문에 `if (status === "SUBSCRIBED")` 한 분기가 생긴다 — "훅 분기 0개" 규칙의 **의도적 예외**로 CLAUDE.md 에 적는다(Codex 평가 A1: 재연결·재조회는 I/O 계층의 판단이고, 그것을 금지한 규칙이 C1 을 만들었다). 결정 자체(무엇을 다시 읽나)는 리듀서 `refresh` 가 갖는다.
- **D-14 쓰기(페이지 핸들러, 낙관적 업데이트 없음, try/catch, actionError).** `setDestination(id | null, name | null)` → `lunch_days.upsert({ date, destination_id, destination_name, destination_set_at: now ISO }, { onConflict: "date" })` — null 이 되돌리기. `setVisit({ status, id, name })` → upsert `{ date, visit_status, visited_id, visited_name, visited_at }`. upsert 가 다른 컬럼을 건드리지 않게 **부분 컬럼만** 보낸다(PostgREST upsert 는 보낸 컬럼만 갱신). 매장 탭 `togglePause(id, name, currentlyPaused)` → `restaurants.update({ paused_week: currentlyPaused ? null : weekStart })`. 에러 조립은 `lib/errors.ts` 에 `formatLunchDayWriteError(action, name, error)` 한 벌 추가(기존 두 벌과 같은 모양).

### 오늘 탭(`app/page.tsx` + `components/`)
- **D-08 휠·목록.** `excluded = weeklyExclusionMap(...)`(memo). 휠 `items = todayCandidates.filter(c => !excluded.has(c.id))`. `winnerIndex = findWinnerIndex(wheelItems, todayResult)`. `CandidateList` 는 `excluded` 를 prop 으로 받아 제외 행을 **`slice: null` 처럼 흐리게**(opacity 0.62) 두되 "담김" 상태(토글 = 빼기)는 유지하고, 배지 자리에 사유("화요일 방문" / "이번 주 쉬기")를 보인다. `listTodayRows` 는 `candidates` 를 휠 items 가 아니라 **전체 후보**로 받고 slice 번호는 휠 items 인덱스로 매긴다 — 시그니처에 `excluded: ReadonlySet<string>` 추가, 제외 행은 `slice: null, excludedReason` 로 반환. 헤더 카운터는 "담긴 n · 뽑는 m". TopBar 의 candidateCount 는 전체 유지.
- **D-09 목적지 카드.** `components/DestinationCard.tsx`(신규, supabase 미호출). decided 에만. 윗줄 `오늘 갈 곳` 마이크로 라벨 + 매장명(순위 배지 "1순위") + 지도(`LocationLink` 재사용 — 위치가 링크면 링크, 아니면 매장명 네이버지도 검색 `https://map.naver.com/p/search/{encodeURIComponent(name)}`). 아랫줄: `nextDestination` 있으면 `웨이팅 있어요 → {다음 이름}로` 버튼, 목적지가 1순위가 아니면 `되돌리기`. 변경 뒤 한 줄 "방금 바뀜 · 모두에게 보여요"(이름 없음). `shownPhase === "spinning"` 동안은 그리지 않는다(결과 카드와 같은 가림).
- **D-10 방문 확인.** 같은 카드 아래 섹션 `어디서 먹었나요?`: ranking 각 항목 버튼(`1순위 A` …) + `다른 매장`(누르면 인라인 입력 24자 + 저장) + `단체 점심 안 함`. 저장 뒤 `오늘은 B에서 먹었어요 · 수정` / `오늘은 단체 점심 안 했어요 · 수정`. 수정 = 다시 버튼 줄. decided 이후 항상 보인다(13시 제한 없음 — 식당에 앉은 사람이 그때 누른다). 보조 위계(13px, muted).
- **D-11 확률 제거.** `ResultBlock` 의 "확률 x%" 두 곳과 `CalendarLog` 상세의 "당첨 확률" 행 삭제. "n개 후보 중 당첨" 의 n 은 `ranking?.length ?? candidateCount`(실제 pool). 2·3순위 행에 지도 아이콘 추가(`LocationLink` 를 ranking 의 `restaurant_id` 로 카탈로그에서 찾아, 없으면 이름 검색 링크) — 이 링크 조립 함수 `mapHref(name, location)` 는 `lib/lunchDay.ts` 에 둔다(순수).
- **머리글.** decided 부제 `"${winnerName}" · 결과는 자정에 초기화됩니다.` → 목적지가 바뀐 날은 `"오늘 갈 곳: B" · …`. stalled 에 `all_paused` 구분은 하지 않는다(결과 행 부재는 같다) — 후보 목록 상단 안내가 "담긴 후보가 전부 이번 주 쉬기 중이에요" 를 보인다(`excluded.size === candidates.length && candidates.length > 0`).

### 매장 탭·기록·랭킹
- **쉬기 버튼.** `RestaurantList` 행에 `PinButton` 옆 `PauseButton`: 기본 "이번 주 쉬기", 활성이면 "쉬는 중 · 해제"(`aria-pressed`). `onTogglePauseAction(id, name, currentlyPaused)`. 쉬기 활성 매장은 이름 옆 작은 라벨 "이번 주 쉬기". `sortRestaurants` 는 바꾸지 않는다(핀 먼저·이름순 유지 — 쉬기는 정렬 기준이 아니다).
- **D-12 기록·랭킹 = 목적지 기준.** `lib/history.ts` 에 `applyLunchDays(rows: ResultRow[], days: LunchDayRow[]): HistoryEntry[]` — `HistoryEntry = HistoryRow & { drawnName: string; drawnId: string | null; unconfirmed: boolean }`: 날짜로 조인, `dayExclusionId` 와 같은 우선순위(visited > destination > winner)로 `restaurant_id`/`menu` 를 치환, 이름은 day 스냅샷 우선, `skipped` 날은 **제외**(점심을 안 먹었다), `visit_status !== "visited"` 면 `unconfirmed: true`. `buildRanking` 입력은 이 결과(HistoryRow 호환). 기록 페이지: 월 창 조회에 `lunch_days` 조회 추가(`[start, end)` 같은 창) + lunch_days INSERT/UPDATE 구독(`lunch-days-log-<n>`). 랭킹 페이지: `lunch_days.select("*").gte("date", lowerBound)` 추가(설정 로드 뒤, results 와 같은 게이트) + 구독 `lunch-days-rank-<n>`. `CalendarLog` 칸은 목적지 이름, 상세는 `갈 곳`/`먹은 곳` 라벨 + 다르면 `추첨 1순위 A` 보조행 + "확인 안 됨" 태그 + skipped 날은 "단체 점심 안 함". `RankingView` 제목 "가장 많이 간 매장", 부제에 "확인 안 된 날은 1순위로 셈". "이번 달 최다" 도 같은 입력.

### 문서·요구사항
- **D-18** README "## 0007 적용 (주간 점심 기록, 1회)" 절 — 0006 절과 같은 4단계(SQL 확인 쿼리: `lunch_days` 테이블·`restaurants.paused_week` 컬럼 존재) + 롤백. `CLAUDE.md`: 엔트리포인트(`lib/lunchDay.ts`·`lib/useLunchWeek.ts`·`DestinationCard`), `_shared/cooldown.ts` 설명(주간), 위험 표(`lunch_days` 모양 넷이 공유 · `effectiveDestinationId` 의 spun_at 비교 · 훅 분기 예외), 미사용 코드 문단(`cooldown_days`), 테스트 건수. `.planning/REQUIREMENTS.md` 에 "## v1.1 Requirements" 절: **DEST-01**(오늘 갈 곳: 기본 1순위·다음 식당·되돌리기·모든 탭 동기·지도) · **VISIT-01**(방문 확인 선택·확인 안 됨 구분·results 불변) · **WEEK-01**(이번 주 제외 = 월~어제 목적지 ∪ 쉬기, pool·휠에서 제외·목록 사유) · **WEEK-02**(월요일 00:00 KST 해제·쉬기 버튼·전멸 2단 폴백) · **HIST-04**(기록·랭킹 목적지 기준·skipped 제외) · **SHIP-05**(0007 적용 절·롤백·게이트·AI 표기 0). Traceability 6행 추가.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/notes/weekly-exclusion-visit-record.md` — 설계 결정 8 + 제약 + 미결 4(이 문서가 전부 닫는다: 쉬기 버튼 = 매장 탭 / 목적지 = 파생 + 변경 시만 저장 / 쉬기 저장 = `restaurants.paused_week` / 확인 안 됨 = 랭킹 포함 + 라벨).
- `.planning/ROADMAP.md` §Phase 9 — 성공 기준 1~5.
- `.context/codex-features-2026-10-06.md`(untracked) — 제안 1·2·3·4·6, "다른 매장"·"단체 점심 안 함" 선택지, 2단 폴백 경고. `.context/codex-eval-2026-10-06.md` — C1(재조회)·C5(확률).
- `supabase/migrations/0005_restaurants_settings.sql` — RLS drop→create 쌍·publication 존재 검사 루프·comment 선례. `0006_results_ranking.sql` — 추가만 + `do $$` 제약 존재 검사.
- `supabase/functions/_shared/cooldown.ts`·`cooldown.test.ts` — 대체 대상(UTC 자정 산술·폴백 boolean 반환 형태 유지).
- `supabase/functions/spin-roulette/index.ts:160-196` · `respin-roulette/index.ts:160-200` — 교체할 쿨다운 블록. `_shared/edgeImports.test.ts:192-390` — 갱신할 계약(#cooldown 호출 수·응답 필드·로그 지점 수).
- `lib/useSettings.ts`·`lib/useCandidates.ts` — 훅 형태(토픽·cancelled 가드). `app/page.tsx:139-180` — 토픽을 effect 안에서 매기는 원형(자정 재구독).
- `lib/candidates.ts` `listTodayRows`·`findWinnerIndex` — 시그니처 확장 지점. `components/CandidateList.tsx:165-205` `CandidateRowView` — 배지 자리.
- `components/ResultBlock.tsx:84-135` — 확률 두 곳·2·3순위 행. `components/CalendarLog.tsx:208-262` `DetailView` — 확률 행·배지 자리.
- `lib/history.ts` `buildRanking`·`HistoryRow` — `applyLunchDays` 가 앞단에 붙는다. `app/rank/page.tsx:15-30` `RANK_COLUMNS`/`SplitColumns` — 컬럼 리터럴 패턴.
- `components/RestaurantList.tsx:296-333` `RestaurantRowView`·`PinButton` — `PauseButton` 모델.
- `README.md:142-151` "0006 적용" — 0007 절 형식.

</canonical_refs>

<code_context>
## Existing Code Insights

- `kstParts().weekday`(0=일…6=토)가 이미 있다 — 월요일 계산에 로컬 `Date` 가 필요 없다. Edge 의 `kstNow()` 와 클라이언트의 `kstParts(now)` 가 같은 구현이다.
- `applyCooldown` 의 반환 형태 `{ picked, fellBack }` 과 "0개면 전체 폴백" 분기는 2단 폴백의 두 번째 단으로 그대로 옮겨진다. 바뀌는 것은 입력(두 집합)과 1단(allPaused)이다.
- `results` 의 Realtime 은 세 페이지가 이미 구독한다. 이번 주 `winners` 는 과거 행이라 바뀌지 않으므로(삭제 set-null 만 예외 — 그러면 그날 제외가 사라지는 것이 맞다) `useLunchWeek` 는 `lunch_days` 만 구독하고 `results` 는 조회만 한다. 오늘 결과는 페이지가 이미 들고 있어 `destinationOf(todayResult, todayDay)` 에 그대로 넘긴다.
- PostgREST upsert 는 보낸 컬럼만 쓴다 — `destination_*` 만 보내면 `visit_*` 는 유지된다. 그래서 하나의 표에 두 사실(목적지·방문)을 두고도 쓰기 핸들러를 둘로 나눌 수 있다.
- `lib/rowset.ts` 의 `fetched` 는 `loaded` 뒤 응답을 버린다(D-04, 05-REVIEW). 재조회 복구가 목적인 `lunchWeekReducer` 는 그 규칙을 **따르지 않고** 세대 번호로 stale 을 거른다 — 두 리듀서가 다른 이유를 각자 머리에 적는다.
- `LocationLink` 는 `http/https` 만 링크로 그린다. 지도 검색 링크는 이름으로 만든 URL 이라 같은 화이트리스트를 통과한다.
- `edgeImports.test.ts` 가 `console.error` 개수(spin 8·respin 6)를 고정한다. 쿨다운 창 조회 1개 → 2개 조회(results·lunch_days)로 각 +1.

</code_context>

<specifics>
## Specific Ideas

- 요일 라벨은 `["일","월","화","수","목","금","토"]` + "방문" — "화요일 방문" 이 아니라 "화 방문" 으로 짧게(배지 자리). `CalendarLog` 의 `WEEKDAYS` 를 `lib/lunchDay.ts` 로 옮겨 export 하고 둘이 같은 배열을 본다.
- 되돌리기는 1순위로 돌아가는 것이지 "이전 목적지" 가 아니다(히스토리 없음).
- "다른 매장" 입력은 `MENU_NAME_MAX_LEN`(24) 코드포인트 제한 + 공백 거부 — `lib/restaurants.ts` 의 `codePointLength` 를 export 하지 않고 `lib/menus.ts` `truncateToCodePoints` 로 자르지도 않는다: 거부가 규칙이다(이름은 식별자). 검증 함수 `parseOtherVisitName(text): { ok: true; name } | { ok: false; message }` 를 `lib/lunchDay.ts` 에.

</specifics>

<deferred>
## Deferred Ideas

- 👍👎 "다음에도 갈까요?" — `.planning/seeds/thumbs-vote.md`.
- `settings.cooldown_days` 컬럼 제거 — 0008.
- 나머지 훅(`useCandidates`·`useRestaurants`·`useSettings`·results)의 재연결 재조회 — `in-07`·Codex C1. 이 Phase 는 `useLunchWeek` 에만 적용해 패턴을 먼저 세운다.
- Codex C2(초기 SELECT 가 이벤트를 덮는 경합)·C3(설정 fail-closed)·C4(respin 타이머)·C7(후보 1개 휠) — 별건 Quick.

</deferred>
