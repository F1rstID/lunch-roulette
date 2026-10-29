---
phase: 09-weekly-lunch-record
plan: 03
subsystem: catalog-history-docs
tags: [pause, history, ranking, readme, claude-md, requirements]

requires:
  - phase: 09-weekly-lunch-record
    provides: "09-01 — _shared/cooldown.ts dayExclusionId · LunchDayRow · RestaurantRow.paused_week · 0007 SQL. 09-02 — lib/lunchDay.ts WEEKDAYS·weekdayLabel"
  - phase: 07-history-ranking
    provides: "lib/history.ts filterSince·buildRanking · CalendarLog DetailView · RankingView · 두 페이지의 results 구독"
provides:
  - "lib/history.ts applyLunchDays<T extends HistoryInput>(rows, days) → HistoryEntry<T>[] — 방문 확인 > 목적지 > 1순위, skipped 제외, drawnId/drawnName/unconfirmed. spec 8건"
  - "매장 탭 PauseButton('이번 주 쉬기' / '쉬는 중 · 해제', aria-pressed, 행 단위 busy) + 이름 옆 라벨 + 헤더 '쉬는 중 k개' + togglePause(paused_week = weekStart | null). RestaurantWriteAction 에 쉬기·쉬기 해제"
  - "기록 페이지 — lunch_days 같은 창 조회(Promise.all) + lunch-days-log-<n> INSERT/UPDATE, CalendarLog(logMap: HistoryEntry<ResultRow>, days): 칸 = 간 곳, 쉼 칸, 헤더 '가장 많이 간 매장', 상세 '먹은 곳/갈 곳 + 확인 안 됨 + 추첨 1순위 보조행', 확률 행 삭제, SkippedView. WEEKDAYS·weekdayLabel 은 lib/lunchDay.ts"
  - "랭킹 페이지 — RANK_COLUMNS 에 spun_at, lunch_days 같은 하한 조회 + lunch-days-rank-<n>, RankingView 문구(가장 많이 간 매장 · 방문 · 최근 방문일 · 확인 안 된 날은 1순위로 셈)"
  - "README '## 0007 적용' 절(확인 쿼리 3·배포 순서·롤백) + 인프라 표 lunch_days 행·paused_week·cooldown_days 미사용. CLAUDE.md 엔트리포인트·흐름·컨벤션(훅 분기 예외)·위험 표 2행·미사용 코드·계약 65건·로그 9/7. REQUIREMENTS v1.1 6건 Complete. codebase STRUCTURE/CONVENTIONS 참조"
affects: []

tech-stack:
  added: []
  patterns:
    - "applyLunchDays 는 제네릭 — 기록(전체 행)·랭킹(5컬럼) 둘 다 같은 함수를 지나 '간 곳' 의 정의처가 하나다"
    - "두 페이지의 lunch_days 구독은 날짜 키 upsert 함수형 업데이터, DELETE 분기 없음(0007 delete 정책 없음)"

key-files:
  created: [.planning/phases/09-weekly-lunch-record/09-03-SUMMARY.md]
  modified: [lib/history.ts, lib/history.test.ts, lib/errors.ts, components/RestaurantList.tsx, app/restaurants/page.tsx, components/CalendarLog.tsx, components/RankingView.tsx, app/log/page.tsx, app/rank/page.tsx, README.md, CLAUDE.md, .planning/REQUIREMENTS.md, .planning/codebase/STRUCTURE.md, .planning/codebase/CONVENTIONS.md, .planning/ROADMAP.md, .planning/STATE.md]
  deleted: []

key-decisions:
  - "HistoryEntry<T> 는 T 를 보존한다 — CalendarLog 상세가 candidates·ranking 을 그대로 쓰고, 랭킹은 좁힌 행으로 같은 함수를 지난다"
  - "단체 점심 안 한 날은 entries 에 없고 days 로 '쉼' 칸·SkippedView 를 그린다 — '0회' 가 아니라 행 부재가 맞다"
  - "CalendarLog 의 로컬 Date 요일 계산(허용 예외)을 weekdayLabel(UTC 산술)로 치환 — lib/history.ts buildMonthGrid 가 마지막 예외"
  - "쉬기 토글은 핀과 달리 글자 버튼 — 아이콘으로는 '이번 주만' 이 전달되지 않는다. 영향 행 검사 없음(핀과 같은 규율)"
  - "기록 부제는 '실제로 간 곳, 그리고 그날의 추첨 결과까지' — 기록이 증명하는 것이 바뀌었음을 문구가 말한다"

duration: 50min
completed: 2026-10-29
---

# Phase 9 Plan 03: 매장 쉬기 · 기록/랭킹 목적지 기준 · 문서 Summary

**기록 탭과 랭킹이 "룰렛이 뽑은 곳" 이 아니라 "팀이 간 곳" 을 세고, 매장 탭에서 지겨운 매장을 이번 주만 뺄 수 있다. README 가 0007 적용 순서를 들고 있고 CLAUDE.md·REQUIREMENTS 가 코드와 맞는다. 라이브 적용(SQL → 함수 → 머지)은 사용자 절차다.**

## Accomplishments

- Task 1(RED 10eda00 → GREEN eec4f7f): `applyLunchDays` — `dayExclusionId` 로 id, 이름은 기록 스냅샷 우선(`visited_name` / `destination_name`), `drawnId`·`drawnName`·`unconfirmed`, skipped 제외, 입력 비변형. `HistoryInput = HistoryRow & { spun_at }`. spec 8건(buildRanking 통합 포함).
- Task 2(80061ce): `RestaurantList` props `weekStart`·`onTogglePauseAction`, `pauseBusyId`, 헤더 `· 쉬는 중 k개`, `PauseButton`(글자, `aria-pressed`, title 에 "월요일에 저절로 풀려요"), 이름 옆 `이번 주 쉬기` 라벨(flex-wrap), 푸터 규칙 문장. 페이지 `weekStart`(`kstParts weekday` + `weekStartOf`) + `toggleRestaurantPause`(`paused_week: currentlyPaused ? null : weekStart`). `RestaurantWriteAction` 에 "쉬기"·"쉬기 해제".
- Task 3(ce0a592): 기록 페이지 `days` state·`Promise.all` 조회·`joinLoadErrors` 두 실패·`lunch-days-log-<n>` 구독·`entries = applyLunchDays(filterSince(...), days)`·`daysByDate`; `CalendarLog` 칸(간 곳 / `쉼` 빈 점)·선택 가능 조건·헤더·`SkippedView`·`DetailView(entry: HistoryEntry<ResultRow>)` 라벨/태그/보조행·확률 행 삭제·`weekdayLabel`. 랭킹 페이지 `RANK_COLUMNS` 5개·`toRankResultRow` spun_at·`days`·`lunch-days-rank-<n>`·`applyLunchDays`. `RankingView` 문구 6곳.
- Task 4: README 0007 절 + 표 3행 + 원칙 문장 + 예시 SQL. CLAUDE.md 18곳(엔트리포인트 6·흐름·컨벤션 예외·계약 65·로그 9/7·위험 표 ResultRow 행 + 신규 2행·미사용 코드·DestinationCard·lunchDay 문단). REQUIREMENTS `[x]` 6 + Complete 6 + footer. STRUCTURE 트리 2줄 + 키 파일 3줄, CONVENTIONS 훅 예외 + 토픽 3개. ROADMAP·STATE Phase 9 완료.

## Deviations from Plan

- `CalendarLog` 는 플랜의 "entries 와 days" 그대로이되 `logMap` 키 이름을 유지했다(날짜 → entry). `DetailView` 는 `day` 를 받지 않는다 — 필요한 사실(unconfirmed·drawn*)이 entry 에 있고 skipped 는 별도 `SkippedView` 다.
- 로컬 `Date` 요일 예외가 하나 줄었다(CalendarLog) — `lib/history.ts` 머리 주석 갱신.
- `formatRestaurantWriteError` 시그니처는 리터럴 유니온이라 두 낱말을 더했다(플랜 "문자열이면 그대로" 의 반대 갈래).

## Verification

- `npx tsc --noEmit` · `npm run lint` · `npm test`(24 files · **552**/552) · `npm run build` · `npm run check:edge` exit 0.
- 390×844: `/log` 390 · `/rank` 390 · `/restaurants` 390(`scrollWidth`), 캡처 `$TMPDIR/lr-ui-09-03/*-390.png`. 매장 탭 텍스트에 "이번 주 쉬기" 21개(카탈로그 21행).
- `grep -c '확률' components/CalendarLog.tsx` 0 · `lunch-days-log-`/`lunch-days-rank-` 각 1 · `paused_week` in `app/restaurants/page.tsx` 1 · `cooldown` 잔여 = `SettingsRow.cooldown_days` 타입 주석 + settings spec 부재 단언만.
- 라이브 쓰기 0 · DB·Edge 배포·main 무변경. 라이브(0007 미적용)에서 기록·랭킹 탭은 "점심 기록 불러오기 실패: Could not find the table 'public.lunch_days'" 배너 + 추첨 기준 표시 = 적용 전 정상.
- **미검증**(라이브 데이터 없음): 쉬기 활성 행의 라벨·헤더 카운트, 기록 상세의 "갈 곳/먹은 곳" 분기, `쉼` 칸 — 타입·spec 으로만. 0007 적용 뒤 사용자 확인 대상.

## Phase 9 전체

커밋 17개(fafda65 … 이 문서). 테스트 439 → 552(+113, 파일 21 → 24). 적용은 README "0007 적용": SQL(사용자) → `spin-roulette`·`respin-roulette` 배포 → PR #8 머지.
