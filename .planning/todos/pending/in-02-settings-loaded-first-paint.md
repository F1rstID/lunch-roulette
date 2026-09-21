---
title: 페이즈 라벨을 settings.loaded 로 가려 첫 페인트의 틀린 문구를 없애기
created: 2026-09-21
source: .planning/phases/03-pure-logic/03-REVIEW.md (IN-02)
resolves_phase: 6
---
세 페이지가 `useSettings()` 에서 `settings`·`error`·`warning` 만 쓰고 `loaded` 는 버린다(`grep -rn 'loaded' app` → 0). 컷오버 뒤 대시보드가 추첨 시각을 예컨대 12:30 으로 바꾸면, 11:55~12:30 사이에 페이지를 열 때마다 초기 SELECT 가 끝나기 전 첫 렌더가 기본값 11:55 로 `currentPhase` 를 계산해 `stalled` 를 돌려준다 — TopBar "추첨 대기" · StageHeader "추첨 대기중" · 헤드라인 "아직 안 정해졌어요." 가 수백 ms 보였다가 `accepting` 으로 바뀐다(시각을 앞당기면 반대로 `accepting` → `stalled`). 후보 목록 잠금은 두 상태 모두 `false` 라 기능 영향은 없고 라벨만 흔들린다.

**해결 방법(Phase 6, `stalled` 문구를 붙이는 그 태스크에서):** `loaded` 는 SELECT 가 성공·실패 어느 쪽으로 끝나도 참이 되므로(`failed` 경로도 `loaded: true`) 그 값으로 가리면 컷오버 전후 모두 안전하다. 둘 중 하나:

- 표시 조건을 `loaded && phase === "stalled"` 로 좁힌다.
- 또는 `!loaded` 동안에는 `stalled` 를 `accepting` 으로 내려 그린다(후보 입력이 열려 있는 쪽이 안전한 기본값이다).

**지금 고치지 않는 이유:** SETT-03("로드 전·실패 시에도 기본값으로 계속 동작")은 의도된 설계이고, `stalled` 문구 자체가 Phase 6 에서 다시 쓰인다. 라벨을 지금 가리면 Phase 6 이 같은 자리를 두 번 만지게 된다.
