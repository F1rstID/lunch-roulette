---
phase: 07-history-ranking
plan: 01
subsystem: history-ranking
tags: [vitest, tdd, history-since, ranking, calendar, realtime]

requires:
  - phase: 03-pure-logic
    provides: "lib/settings.ts 의 historySince(string | null) — null 은 전환일 미확정"
  - phase: 06-today-tab
    provides: "results.menu 매장명 스냅샷 + restaurant_id(set null) 형태, 토픽은 구독마다(CR-01)"
provides:
  - "lib/history.ts — filterSince · buildRanking(키 restaurant_id ?? menu) · buildMonthGrid + HistoryRow/RankEntry/MonthCell"
  - "app/log·app/rank 가 settings.history_since 이후만 표시(HIST-01·HIST-02), 랭킹 조회는 gte + 컬럼 4개"
  - "todo in-05 종결(D-09: wr-01 절차 8번 history_since + 1)"
affects: [08-cutover]

tech-stack:
  added: []
  patterns:
    - "전환일 필터 정의처 하나(filterSince) — 조회 경계는 대역폭, 화면 행은 항상 필터를 지난다"
    - "집계 키 restaurant_id ?? menu — 삭제(set null)는 이름으로 한 덩어리, 개명은 최근 스냅샷 이름"

key-files:
  created: [lib/history.ts, lib/history.test.ts]
  modified: [lib/time.ts, lib/time.test.ts, components/RankingView.tsx, components/CalendarLog.tsx, app/log/page.tsx, app/rank/page.tsx, .planning/todos/pending/wr-01-cutover-window.md, CLAUDE.md, .planning/codebase/STRUCTURE.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/CONCERNS.md, .planning/codebase/INTEGRATIONS.md, .planning/codebase/ARCHITECTURE.md, .planning/codebase/TESTING.md, .planning/REQUIREMENTS.md]
  deleted: [.planning/todos/pending/in-05-history-since-same-day.md]

key-decisions:
  - "D-06 랭킹 조회 아래 경계 = min(history_since, 오늘) — 전환일이 오늘보다 뒤인 하루(wr-01 8번)에도 오늘 행을 읽어 상단 라벨을 맞춘다. 그 행을 랭킹에서 빼는 것은 filterSince"
  - "D-09 in-05 는 읽는 쪽이 아니라 컷오버 절차 한 줄(history_since + 1)로 닫는다"
  - "D-10 formatHhMm 삭제(참조 0)"

patterns-established:
  - "컴포넌트 안 순수 함수라도 테스트가 필요하면 lib/ 로 내린다(러너가 components/*.tsx 를 수집하지 않는다)"

duration: 22min
completed: 2026-09-29
---

# Phase 7 Plan 01: 기록·랭킹 전환일 필터 + 매장 기준 집계 Summary

**기록 캘린더와 랭킹이 `settings.history_since` 이후 결과만 매장 기준으로 보여준다. 집계·격자 산술은 `lib/history.ts` 로 내려 spec 20건으로 고정됐다.**

## Performance

- **Duration:** 22min (컨텍스트 5m · 플랜 5m · 실행 12m)
- **Started:** 2026-09-29T05:15Z · **Completed:** 2026-09-29T05:37Z
- **Tasks:** 3 · **Files:** 17(+1 삭제)

## Accomplishments

- `lib/history.ts`(순수): `filterSince`(null → 안 자름, 당일 포함) · `buildRanking`(키 `restaurant_id ?? menu`, 이름은 최근 스냅샷, wins ↓ → lastDate ↓ → key ↑) · `buildMonthGrid`(42칸). `lib/history.test.ts` 20건 — RED(수집 실패) → GREEN.
- `RankingView`·`CalendarLog` 는 호출만. 달력 헤더 "이번 달 최다" 도 같은 `buildRanking`(이름 키 집계 0벌). 문구 메뉴 → 매장.
- `app/rank`: `settingsLoaded` 뒤 조회, `.gte("date", min(historySince, today))`, 컬럼 `id,date,menu,restaurant_id`, deps `[settingsLoaded, lowerBound]`(전환일 Realtime 변경 → 재조회), 화면 행은 `filterSince` memo. `app/log`: 월 창 조회 유지 + `filterSince` memo, 부제에 전환일, `phase` 는 필터 전 행.
- 토픽 `results-log-<n>`·`results-rank-<n>` effect 안(CR-01 결정 일관). INSERT/UPDATE 2분기·멱등 병합 유지.
- `formatHhMm` + spec 3건 삭제. todo `in-05` → `wr-01` 8번(`history_since + 1`). 문서 7곳 정정, HIST-01·02 Complete.

## Task Commits

1. `test(07-01)` RED spec 20 + formatHhMm spec 삭제
2. `feat(07-01)` lib/history.ts + formatHhMm 삭제 — 378/14 green
3. `feat(07-01)` 컴포넌트·페이지 배선 + in-05 종결
4. `docs(07-01)` 문서·요구사항·SUMMARY

## Deviations from Plan

- 랭킹 조회 아래 경계를 CONTEXT D-06 의 `historySince` 그대로가 아니라 `min(historySince, todayKey)` 로 잡았다 — D-09(컷오버 절차가 전환일을 다음 날로 민다)와 합치면 그 하루 동안 오늘 행이 안 읽혀 TopBar 라벨이 "추첨 대기" 로 틀린다. 정의(`filterSince`)는 그대로라 랭킹 내용은 영향 없다. CLAUDE.md 위험 지점에 기록.
- 플랜 1개·실행 직접(사용자 시간 요구). 리뷰(fable)는 유지.

## Verification

- `npm test` 378/378 · 14 files (기준 361 − 3 + 20) · `npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm run check:edge` 전부 exit 0.
- `grep -rn 'formatHhMm\b' lib app components` → 0 · `grep -n '"log-results"\|"rank-results"' app` → 0.
- 컷오버 전 라이브 동작: 설정 실패 → `loaded` 참·`historySince` null → 두 페이지 전체 기간 표시(현행과 동일). main·라이브·Edge Function·마이그레이션 무변경.

## Manual-only (사용자)

가드런처 `npm run dev` → `/log`·`/rank` 렌더. 컷오버 전엔 "설정 불러오기 실패" 배너 + 기존 기록 전체가 정상. 랭킹 제목 "가장 많이 당첨된 매장", 달력 부제 "가장 많이 간 매장". 컷오버 후에는 전환일 이전 달이 비고 기록 부제가 "yyyy.mm.dd 부터의 매장 기록" 이어야 한다.

## Next Phase Readiness

Phase 8 컷오버: `wr-01` 1~8(8번 = 추첨 이후 적용 시 `history_since + 1`), `in-07` 결정, 보안감사 5~7 묶음 1회, `/gsd-verify-work`.
