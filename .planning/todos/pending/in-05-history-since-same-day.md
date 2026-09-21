---
title: 전환일 당일 results(restaurant_id is null)를 기록·랭킹이 어떻게 다룰지 정한다
created: 2026-09-21
source: .planning/phases/02-data-model/02-REVIEW.md (IN-05)
resolves_phase: 7
---
`settings.history_since` 기본값은 KST 기준 **적용일 당일**이다. 그런데 WR-01 의 권고("그날 결과가 확정된 뒤 = 12:00 KST 이후 적용")를 따르면 적용일 D 에는 이미 구 모델 결과 `results(date = D, restaurant_id = null)` 가 한 행 있고, 이 행은 `date >= history_since` 필터를 그대로 통과한다. 즉 전환 첫날만 "매장 기록" 에 매장 id 가 없는 행이 섞인다.

**Phase 6·7 이 정할 것 — 둘 중 하나:**
- **(A) 읽는 쪽에서 처리.** log·rank 쿼리가 `history_since` 당일 행 중 `restaurant_id is null` 인 것을 legacy 로 보고 랭킹 집계에서 제외하거나(메뉴명 스냅샷만 기록 탭에 표시), 명시적으로 "전환 전 기록" 으로 구분해 보여 준다.
- **(B) Phase 8 에서 한 줄로 회피.** 적용 직후 `update public.settings set history_since = history_since + 1 where id = 1;` 를 실행해 당일 결과를 집계 범위에서 뺀다. SHIP-02 롤백/절차 문서의 선택 항목으로 적는다.

(B) 가 더 싸지만 "전환일 = 적용일 자동"(D-03)의 문면과 어긋나므로, 어느 쪽이든 결정한 내용을 `history_since` 의 `comment on column` 문구와 맞춰 둘 것.
