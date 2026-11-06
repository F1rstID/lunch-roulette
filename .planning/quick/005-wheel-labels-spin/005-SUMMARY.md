---
quick_id: "005"
slug: wheel-labels-spin
completed: 2026-11-06
branch: feat/wheel-labels-spin
status: complete (PR 대기 — DB·함수 무변경, 머지만)
---

# Quick Task 005: 휠이 도는 동안에도 라벨이 칸과 함께 돈다 — Summary

## 결과

- 룰렛이 도는 4.8초 동안 매장명·번호가 칸 위에 그대로 보인다. 전에는 도는 순간 라벨이 사라져 색만으로 칸을 구분해야 했다.
- 멈추는 순간의 튐이 사라졌다 — 도는 목표에만 있던 흩음(`spinJitter`)을 정지 각도에도 더해 transition 끝 각도와 decided 각도가 같다.
- 당첨 배지(가로)는 전처럼 정지 뒤에만, 회전 그룹 밖에 그린다.

## 원인

`components/Wheel.tsx` 의 라벨 `<g>` 가 회전 그룹 밖에 있고 각도를 `rotation` 으로 JS 계산했다. CSS transition 중엔 렌더가 없어 따라갈 수 없으니 MVP(0206cbf)가 `showLabels = phase !== "spinning"` 으로 숨겼다.

## 한 일

| 항목 | 내용 |
|---|---|
| `components/Wheel.tsx` | 방사형 라벨을 회전 `<g>` 안으로(좌표 `localMid`, 뒤집기는 `localMid + rotation`), `showLabels` 삭제, `settledRotation = restRotation + spinJitter` 를 목표·정지 둘 다에, 배지는 정적 그룹에 Why 주석 |
| 문서 | CLAUDE.md 위험 표 Wheel 행(회전 그룹 안·흩음 둘 다), STATE.md Quick 005 행 |
| 무변경 | `lib/wheelLabel.ts`(순수 로직 그대로, spec 그대로) · 페이지 · DB · Edge |

## 검증

- `tsc` · `lint` · `test`(593) · `build` exit 0.
- 임시 페이지(`app/wheelcheck`, 삭제)로 로컬 `next start` + gstack 브라우저 캡처 6프레임: 회전 중 3프레임 전부 라벨 보임(빠른 구간은 일부 거꾸로 — 의도된 한계), 마지막 spinning 프레임과 decided 프레임의 칸 각도 동일, 배지 12시 가로. 콘솔 에러 0.
- 리뷰 생략(컴포넌트 하나, 순수 로직 무변경). 라이브 쓰기 0.

## 알려진 한계

- 도는 동안 뒤집기 상태는 고정이라 왼쪽 반원을 지나는 라벨이 잠깐 거꾸로 보인다. 프레임마다 다시 그리려면 JS 애니메이션으로 바꿔야 하고, 그만한 값어치가 없다.
