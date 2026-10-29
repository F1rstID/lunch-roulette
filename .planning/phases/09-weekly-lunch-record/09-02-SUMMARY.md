---
phase: 09-weekly-lunch-record
plan: 02
subsystem: today-tab
tags: [destination, visit, weekly-exclusion, hook, realtime, ui]

requires:
  - phase: 09-weekly-lunch-record
    provides: "09-01 — _shared/cooldown.ts 주간 규칙 · lib/lunchDay.ts · LunchDayRow/WeekWinnerRow · formatLunchDayWriteError · 0007 트리거"
  - phase: 06-today-tab
    provides: "app/page.tsx 의 results 구독(토픽 effect 안, isNewSpin 가드) · CandidateList 행 모델 · ResultBlock"
provides:
  - "lib/useLunchWeek.ts — 이번 주 lunch_days(월~오늘)·winners(월~어제) I/O 훅. 재조회 트리거 3개(세대 effect · visibilitychange visible · SUBSCRIBED). 훅 분기 0개 규칙의 의도적 예외(분기 2)"
  - "components/DestinationCard.tsx — 오늘 갈 곳(순위 배지·지도) · 웨이팅 있어요 → 다음 식당 · 1순위로 되돌리기 · 어디서 먹었나요(순위 버튼·다른 매장·단체 점심 안 함·수정). supabase 미호출, ~Action 2개"
  - "lib/candidates.ts listTodayRows(…, excluded) — TodayRow 에 excludedReason·picked, slice 는 휠 items 인덱스. lib/lunchDay.ts weekdayLabel·exclusionBadge"
  - "CandidateList — excluded·wheelCount·allExcluded props, 헤더 '담긴 n · 뽑는 m', 사유 배지('화 방문'/'이번 주 쉬기'), 전원 제외 안내. ResultBlock — 확률 0곳, poolCount, 2·3순위 지도 링크"
  - "app/page.tsx — weekStart(kstParts weekday) · useLunchWeek · excluded/wheelItems/destination/next/isDefault/visit 파생 · setDestination/setVisit(부분 컬럼 upsert) · all_paused 번역 · 머리글 '오늘 갈 곳: B'"
affects: [09-03]

tech-stack:
  added: []
  patterns:
    - "useLunchWeek: useReducer 초기화 함수로 창을 미리 넣고 세대(generation) 변화 effect 가 조회한다 — refresh 디스패치 지점(visible·SUBSCRIBED)과 조회 지점이 분리된다"
    - "DestinationCard 의 '수정' 펼침은 '어느 요약을 보고 눌렀나'(JSON 키) 파생으로 들고 effect 없이 접힌다"
    - "제외 행 구분은 TodayRow.picked — slice(휠 인덱스)만으로는 '제외된 담긴 행' 과 '안 담긴 쉬기 행' 이 갈리지 않는다"

key-files:
  created: [lib/useLunchWeek.ts, components/DestinationCard.tsx]
  modified: [lib/candidates.ts, lib/candidates.test.ts, lib/lunchDay.ts, lib/lunchDay.test.ts, components/CandidateList.tsx, components/ResultBlock.tsx, app/page.tsx, supabase/functions/_shared/edgeImports.test.ts, supabase/migrations/0007_lunch_days.sql, supabase/migrations/0007_lunch_days.test.ts, supabase/rollback/0007_lunch_days.rollback.sql, supabase/rollback/0007_lunch_days.rollback.test.ts]
  deleted: []

key-decisions:
  - "0007 보강(fc446d2): destination_set_at·visited_at·updated_at 은 DB 트리거 lunch_days_stamp 가 now() 로 찍는다 — 클라이언트 시계로 적으면 results.spun_at(서버 시각)과의 stale 비교가 기기 시계 오차에 흔들려 '다시 돌리기 전 선택' 으로 오판된다. 클라이언트 값은 '건드렸다' 신호이고 set_at 변화로 판정해 같은 목적지 재선택도 재각인된다. 롤백에 drop function 추가"
  - "listTodayRows 4번째 인자는 ReadonlyMap<string, ExclusionReason>(Set 이면 사유를 돌려줄 수 없다). 안 담긴 쉬기 매장도 배지를 받는다(카탈로그 전체를 weeklyExclusionMap 에 넘긴다)"
  - "useLunchWeek 분기 2개(visible·SUBSCRIBED) — 둘 다 refresh 디스패치 여부만 가르고 결과를 해석하지 않는다. results 는 구독하지 않는다(과거 행, 오늘 결과는 페이지가 든다)"
  - "poolCount = ranking?.length ?? wheelItems.length — accepting 에도 '뽑는 후보' 를 보인다(담긴 전체는 목록 헤더·TopBar 가 든다)"
  - "DestinationCard 는 shownPhase === 'decided' && destination !== null 에만 — 결과 카드와 같은 가림. 에러 색은 ErrorBanner 와 같은 --red"

duration: 45min
completed: 2026-10-29
---

# Phase 9 Plan 02: 오늘 탭 — 목적지·방문·주간 제외 Summary

**오늘 탭이 "어디 가나(목적지·다음 식당·되돌리기)" 와 "어디 갔나(방문 확인)" 를 보여 주고 `lunch_days` 한 행에 쓰며, 휠은 이번 주 제외 매장을 빼고 목록은 그 사유를 배지로 보인다. 화면 갱신은 전부 Realtime(낙관적 업데이트 0).**

## Accomplishments

- Task 1(RED 364123f → GREEN 96c0cfe): `listTodayRows(candidates, catalog, query, excluded)` — 제외된 담긴 행 `slice: null + excludedReason + picked: true`, 나머지 담긴 행의 slice 는 제외를 건너뛴 휠 인덱스, 안 담긴 쉬기 행도 사유. spec 5건. `useLunchWeek(weekStart, todayKey)` — 초기화 함수로 창 주입, 세대 effect 조회(`Promise.all` lunch_days `[weekStart, today]` · results `[weekStart, today)`), visible/SUBSCRIBED → refresh, 토픽 `lunch-days-<n>` effect 안, INSERT/UPDATE 2분기.
- 0007 트리거 보강(fc446d2) — 위 key-decisions. spec +8.
- Task 2(c8b65b7): `DestinationCard`(목적지 줄 · 액션 줄 flex-wrap inline · 방문 섹션 · 다른 매장 인라인 폼 `role=alert` · 수정) · `ResultBlock`(확률 2곳 삭제, `poolCount`, 2·3순위 `지도` 링크 `target=_blank rel=noopener noreferrer`, 행 grid 3열) · `CandidateList`(props 3, 헤더 "담긴 n · 뽑는 m", 배지 `exclusionBadge`, opacity 는 휠 유무, 토글은 `picked`, 전원 제외 안내 `role=status`, 푸터 규칙 문장) · `lib/lunchDay.ts` `weekdayLabel`·`exclusionBadge`(spec +2).
- Task 3(dbe7d43): `app/page.tsx` 배선(위 provides) + `phaseSubhead` 5번째 인자 · `loadBanner` 에 "이번 주 기록" · respin `all_paused` 번역 · edgeImports #65(페이지 `"all_paused"` 1).

## Deviations from Plan

- 0007 SQL 을 다시 열었다(트리거) — 라이브 미적용이라 가능했고, 적용 뒤였다면 0008 이었을 것.
- `DestinationCard` 는 `destination: Destination`(non-null)을 받고 null 가드는 페이지가 한다 — 플랜의 `| null` 보다 좁다.
- `CandidateList` 행 흐림 기준을 "picked" 에서 "휠에 있음(slice !== null)" 으로 — 제외된 담긴 행도 흐리게(D-08) 하려면 그쪽이 맞다.
- `useLunchWeek` 의 분기는 플랜의 1개가 아니라 2개(visible 판정 포함). CLAUDE.md 에 둘 다 적는다(09-03).

## Verification

- `npx tsc --noEmit` · `npm run lint` · `npm test`(24 files · **544**/544) · `npm run build` · `npm run check:edge` exit 0.
- `npm run build` + `npx next start -p 3100` + gstack browse: 390×844 `scrollWidth` **390**, 1280 **1280**. 캡처 `$TMPDIR/lr-ui-09-02/today-{390,1280}.png`(접수중 페이즈 — 헤더 "담긴 6 · 뽑는 6", "뽑는 후보 6", 푸터 규칙 문장, 배너 "이번 주 기록 불러오기 실패: Could not find the table 'public.lunch_days'" = 0007 미적용 라이브의 정상).
- **미검증**: `DestinationCard` 실렌더(decided 전용 — 11:55 전이라 결과 행이 없다). 390px 에서의 카드 줄바꿈은 flex-wrap·minWidth 0 로 설계했고 리뷰·사용자 확인 대상. 라이브 쓰기 0.

## Next

09-03: 매장 탭 쉬기 · `applyLunchDays` + 기록/랭킹 · README "0007 적용" · CLAUDE.md · REQUIREMENTS.
