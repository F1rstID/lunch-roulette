---
title: results UPDATE 구독이 on delete set null 갱신을 새 결과로 오인하지 않게 가드
created: 2026-09-28
source: .planning/phases/04-server-spin/04-REVIEW.md (IN-09)
resolves_phase: 6
---
`app/page.tsx:118-122`(REVIEW 시점 `:115-119`) 의 realtime UPDATE 분기는 payload 를 그대로 `applyResult` 에 넘기고, `applyResult`(`:84-92`, REVIEW 시점 `:81-88`)는 새 결과로 보고 `setForceSpin(true)` 로 휠을 다시 돌린다. 그런데 `results.restaurant_id` 는 `on delete set null` 이라(`0005:67-69` 가 이미 적어 둔 사실) **오늘 당첨 매장을 카탈로그에서 지우면 UPDATE 이벤트가 한 번 더 나간다** — 당첨 결과는 그대로인데 휠만 재회전한다. Phase 4 가 `restaurant_id` 를 실제로 쓰기 시작하면서 도달 가능해진 경로다.

REVIEW IN-09 원문:

> 0005:67-68 이 이미 적은 대로, 오늘 당첨 매장을 삭제하면 `results.restaurant_id → null` UPDATE 가 나가고 `applyResult` 가 `setForceSpin(true)` 로 휠을 재회전시킨다. 이 페이즈가 `restaurant_id` 를 실제로 쓰기 시작했으므로 도달 가능해졌다. Phase 6 소관으로 합의돼 있어 여기서는 잊히지 않게 기록만 한다.

**재현:** 오늘 결과가 확정된 뒤 매장 카탈로그에서 당첨 매장을 삭제 → `results.restaurant_id` 가 null 로 갱신 → 열려 있는 모든 탭의 휠이 다시 돈다(결과 문자열은 그대로). `menu` 는 이름 스냅샷이라 표시는 바뀌지 않으므로, 사용자에게는 "이유 없이 휠이 도는" 것으로만 보인다.

**수정 방향(Phase 6, 오늘 탭의 후보 소스를 `candidates` 로 옮기는 그 태스크에서):** `applyResult` 가 `payload.old.spun_at !== payload.new.spun_at`(또는 `menu` 변화)일 때만 `forceSpin` 을 켜도록 가드한다. 다시 돌리기는 `spun_at` 을 항상 새로 쓰므로(`respin-roulette` 의 upsert 본문) 정상 재회전은 그대로 살아 있다.

**지금 고치지 않는 이유:** Phase 4 의 범위는 Edge Function 본문과 `respin()` 의 500 본문 표면화뿐이고, 이 분기는 Phase 6 이 realtime 핸들러를 `candidates` 기준으로 다시 쓸 때 같은 자리를 만진다. 지금 고치면 그 태스크가 같은 줄을 두 번 건드린다 (CLAUDE.md "위험 지점" — realtime 핸들러 분기 순서).
