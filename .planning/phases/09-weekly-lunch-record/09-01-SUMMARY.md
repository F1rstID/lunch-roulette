---
phase: 09-weekly-lunch-record
plan: 01
subsystem: weekly-exclusion-core
tags: [cooldown, lunch_days, migration, edge-function, pure-module, tdd]

requires:
  - phase: 03-pure-logic
    provides: "_shared/ import 0 계약 · kstParts().weekday · 텍스트 계약 spec 방식"
  - phase: 04-server-spin
    provides: "spin/respin 의 쿨다운 블록·응답 플래그·console.error 지점 수 계약(edgeImports.test.ts)"
  - phase: 08-cutover
    provides: "0006 적용 순서(SQL → 함수 → 머지) 선례 · 롤백 SQL 위치(rollback/)"
provides:
  - "supabase/functions/_shared/cooldown.ts — weekStartOf · weeklyWindowStart · effectiveDestinationId · dayExclusionId · applyWeeklyExclusions (import 0, spec 36건). applyCooldown·cooldownWindowStart 삭제"
  - "supabase/migrations/0007_lunch_days.sql + rollback — lunch_days 표(date PK · visit_status 3값 · FK set null 2 · RLS select/insert/update · publication) · restaurants.paused_week · cooldown_days comment 미사용. 텍스트 계약 spec 2파일 19건"
  - "spin-roulette · respin-roulette — restaurants(id, name, paused_week) 임베드 · 창 조회 2개(results·lunch_days) · 2단 폴백 · skipped: all_paused · 응답 weekly_fallback/weekly_skipped. edgeImports 계약 갱신(+2건, console.error 9/7)"
  - "lib/lunchDay.ts — destinationOf · nextDestination · visitSummary · weeklyExclusionMap · lunchWeekReducer(세대 번호) · INITIAL_LUNCH_WEEK_STATE · mapHref · parseOtherVisitName · WEEKDAYS (spec 49건)"
  - "lib/supabase/client.ts — RestaurantRow.paused_week · LunchDayRow · WeekWinnerRow. lib/settings.ts 에서 cooldownDays 제거. lib/errors.ts formatLunchDayWriteError"
affects: [09-02, 09-03]

tech-stack:
  added: []
  patterns:
    - "주간 규칙의 정의처는 _shared/cooldown.ts 하나 — Edge 와 클라이언트(lib/lunchDay.ts)가 같은 함수를 값으로 가져온다"
    - "lunchWeekReducer 는 rowset 과 달리 loaded 뒤 응답도 받고 stale 은 세대 번호로 거른다(재조회 복구가 목적)"
    - "Edge 창 조회 둘은 Promise.all 로 묶고 어느 하나 실패면 방문 제외만 건너뛴다(쉬기는 후보 행에 실려 와 항상 적용)"

key-files:
  created: [supabase/migrations/0007_lunch_days.sql, supabase/migrations/0007_lunch_days.test.ts, supabase/rollback/0007_lunch_days.rollback.sql, supabase/rollback/0007_lunch_days.rollback.test.ts, lib/lunchDay.ts, lib/lunchDay.test.ts]
  modified: [supabase/functions/_shared/cooldown.ts, supabase/functions/_shared/cooldown.test.ts, supabase/functions/_shared/edgeImports.test.ts, supabase/functions/spin-roulette/index.ts, supabase/functions/respin-roulette/index.ts, lib/supabase/client.ts, lib/settings.ts, lib/settings.test.ts, lib/errors.ts, lib/errors.test.ts, lib/candidates.test.ts, lib/restaurants.test.ts, supabase/migrations/0005_restaurants_settings.test.ts]
  deleted: []

key-decisions:
  - "D-02 보강: destination_set_at 이 null 이면 추첨 뒤라는 증거가 없어 당첨으로 본다. 같은 순간(set_at === spun_at)은 목적지가 이긴다. 순간 비교는 Date.parse + 문자열 폴백(isNewSpin 선례)"
  - "D-06 그대로: 후보 0 → 플래그 전부 false(원인 진단 분리) · 쉬기 전멸 → allPaused, picked [] · 방문 전멸 → pool1 폴백"
  - "all_paused 응답에 candidate_count·excluded_count 를 함께 싣는다 — 후보 없음과 구분. edgeImports #50·#51 은 3으로"
  - "모듈 파일명 cooldown.ts 는 유지(import 경로 1곳) — 계약은 cooldown_ 키(응답·설정 컬럼) 0건으로 고정"
  - "lunchWeekReducer: refresh 가 창(weekStart·today)을 상태에 적고 generation+1, changed 는 그 창으로 밖 날짜를 거른다(lunch_days 창은 오늘 포함, results 창은 오늘 제외)"
  - "formatLunchDayWriteError 접두는 '<동사> 실패(<대상>): <원문>' — 대상이 매장이 아닐 때(단체 점심 안 함)도 자연스럽다. 23503·null 은 '이미 삭제된 매장이에요'"
  - "0005 spec #36 은 RESTAURANT_ROW_FIELDS(= RESTAURANT_COLUMNS + paused_week) 로 가른다 — SQL 쪽(#35)은 0005 파일만 본다"

duration: 55min
completed: 2026-10-29
---

# Phase 9 Plan 01: 주간 제외·목적지 규칙의 정의처 Summary

**서버(Edge 2종)와 클라이언트(lib/lunchDay.ts)가 `_shared/cooldown.ts` 의 같은 다섯 함수로 "오늘 갈 곳" 과 "이번 주 제외" 를 판정한다. 0007 SQL·롤백은 텍스트 계약으로 고정됐고, 화면은 아직 건드리지 않았다(09-02·09-03).**

## Accomplishments

- `_shared/cooldown.ts` 교체(RED fafda65 → GREEN 6190281): `weekStartOf(date, weekday)`(UTC 자정 산술, 월요일 오프셋 `(weekday+6)%7`, 오염 입력 null) · `weeklyWindowStart`(월요일 null) · `effectiveDestinationId`(stale = set_at < spun_at → 당첨) · `dayExclusionId`(skipped → null · visited → visited_id · unknown → 목적지) · `applyWeeklyExclusions`(2단 폴백). spec 36건, 구 export 0(#36 이 export 집합을 고정).
- 0007 SQL(RED 9557c64 → GREEN b075d0e): `lunch_days` 9컬럼 · comment 3 · RLS 3쌍(delete 없음) · `restaurants.paused_week date` · `settings.cooldown_days` comment "0007 이후 미사용" · publication 루프. 롤백: `drop table if exists` + `drop column if exists` + comment 원복, 역순·데이터 소실 주석. spec 12 + 7건.
- Edge 2종(a764750): import 4함수(+`type DayVisitRef` 인라인) · `select("spin_time")` · 임베드 `restaurants ( id, name, paused_week )` · `normalizeCandidates` 가 paused_week 좁힘 · `Promise.all` 창 조회 2개 · 날짜 Map 조인 → `dayExclusionId` · `applyWeeklyExclusions` → `all_paused` 조기 반환 · `weekly_fallback`/`weekly_skipped`. `deno check` exit 0. edgeImports 계약: #24·#36 임베드, #25·#37 `cooldown_days` 0, #26·#38 `lunch_days` 1, #28·#40 함수 4종, #31 순서, #32·#43 로그 9/7, #52·#54 창 2·2·0, #33·#44 `weekly_*` + `cooldown_` 0, #50·#51 3, 신규 #63·#64 `all_paused`.
- `lib/lunchDay.ts`(RED af5253a → GREEN a8ab32d): 9 export + 타입(`Destination`·`VisitSummary`·`ExclusionReason`·`LunchWeekState`·`LunchWeekAction`·`OtherVisitName`). `mapHref` 는 `parseLocationLink` 화이트리스트 재사용. spec 49건.
- 타입·정리: `RestaurantRow.paused_week`, `LunchDayRow`, `WeekWinnerRow`, `SettingsRow.cooldown_days` 주석. `Settings.cooldownDays` 삭제(settings spec 4건 삭제·2건 추가). `formatLunchDayWriteError` + spec 5. 픽스처 17곳 `paused_week: null`, candidates spec 로컬 `Store` 타입 확장, 0005 spec `RESTAURANT_ROW_FIELDS`.

## Deviations from Plan

- 플랜 verify "`grep -c 'cooldown' index.ts` → 0" 은 import 경로(`../_shared/cooldown.ts`)가 있어 불가능 — 계약을 `cooldown_` 0 으로 바꿨다(파일명 유지는 CONTEXT 결정).
- `excluded_count` 가 all_paused 응답에도 실려 두 함수 모두 3회 — 플랜의 "2" 를 3으로(이유: 후보 없음과 전부 쉬기를 응답만으로 가른다).
- `lunchWeekReducer.refresh` 는 플랜의 "generation+1 반환" 대신 액션에 창을 싣고 상태에 적는다 — `useReducer` 훅이 반환값을 동기로 못 읽으므로, 훅은 `state.generation` 변화를 effect 로 받아 조회한다(09-02 Task 1 에서 확정).
- `effectiveDestinationId` 에 set_at null 분기 추가(DB 는 nullable). `applyWeeklyExclusions` 의 candidates 는 `readonly T[]`.
- `listTodayRows` 4번째 인자는 09-02 에서 `ReadonlyMap<string, ExclusionReason>`(Set 이면 사유를 돌려줄 수 없다).

## Verification

- `npx tsc --noEmit` · `npm run lint` · `npm test`(24 files · **534**/534, 09 이전 439) · `npm run build` · `npm run check:edge` 전부 exit 0.
- `grep -rn 'applyCooldown\|cooldownWindowStart\|cooldown_fallback\|cooldown_skipped\|cooldownDays' lib app components supabase` → spec 의 부재 단언 2줄만.
- 커밋 7개(fafda65 · 6190281 · 9557c64 · b075d0e · a764750 · af5253a · a8ab32d). AI 표기 0. 라이브 DB·Edge 배포·main 무변경.

## Next

09-02: `listTodayRows(…, excluded)` · `useLunchWeek` · `DestinationCard` · 오늘 탭 배선. 09-03: 매장 탭 쉬기 · 기록/랭킹 `applyLunchDays` · README "0007 적용" · CLAUDE.md.
