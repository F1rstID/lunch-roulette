---
title: lib/phase.ts 머리 주석 1초 오차 정정 + lib/time.ts hourCycle h23
created: 2026-09-18
source: .planning/phases/01-safety-net/01-REVIEW.md (IN-03, IN-04)
resolves_phase: 3
---
IN-03: `lib/phase.ts` 상단 주석은 "11:55:06 ~ decided"인데 코드는 11:55:05부터 decided (spec은 코드 기준으로 맞음). Phase 3가 파일을 재작성하니 그때 주석 정정. IN-04: `lib/time.ts` 포맷터가 `hour12:false`→h23 ICU 매핑에 의존. 다음에 time.ts를 만질 때 `hourCycle: "h23"` 명시.
