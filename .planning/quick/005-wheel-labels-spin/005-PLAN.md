---
quick_id: "005"
slug: wheel-labels-spin
created: 2026-11-06
branch: feat/wheel-labels-spin
lane: direct (플랜·실행 직접, 리뷰 생략 — 컴포넌트 하나·순수 로직 무변경)
design_source: 사용자 보고 2026-11-06("룰렛 돌 때 글자 다 지워져서 색으로만 구분")
---

# Quick Task 005: 휠이 도는 동안에도 라벨이 칸과 함께 돈다

## 문제

`components/Wheel.tsx` 의 라벨 `<g>` 가 회전 그룹 **밖**에 있고 위치를 `rotation` 으로 JS 계산한다. CSS transition 이 도는 4.8초 동안은 렌더가 없어 라벨이 칸을 따라갈 수 없고, MVP(0206cbf)는 그래서 `showLabels = phase !== "spinning"` 으로 도는 동안 라벨을 숨겼다 — 색만으로 칸을 구분해야 한다.

같은 파일의 둘째 결함: 회전 목표에는 `spinJitter`(±칸의 30%)가 더해지는데 `decided` 의 정지 각도는 `restRotation` 뿐이라 transition 이 끝나고 phase 가 바뀌는 순간 휠이 흩은 만큼 정중앙으로 튄다. 라벨이 보이면 글자로 드러난다.

## 설계

- 방사형 라벨을 회전 `<g>` **안**으로 옮긴다. 좌표는 칸 기준(`localMid`), 뒤집기 판정만 멈출 각도(`localMid + rotation`)로 미리 정한다 — 도는 동안은 고정이라 왼쪽 반원을 지날 때 잠깐 거꾸로지만 멈추면 정확하다(JS 프레임 없이 할 수 있는 최선이고, 실제 룰렛도 글자가 같이 돈다).
- `showLabels` 삭제. 당첨 배지(가로)는 `decided` 에만 그리므로 회전 그룹 밖 정적 그룹에 남긴다.
- `settledRotation = restRotation + spinJitter(...)` 를 도는 목표와 정지 각도 둘 다에 쓴다 → 멈춘 뒤 튐 0. 배지는 `rotation` 기준이라 흩은 만큼 12시에서 살짝 비켜 앉는다(가로 유지, 허용).
- 순수 모듈(`lib/wheelLabel.ts`)·페이지 무변경. CLAUDE.md 위험 표 Wheel 행에 "라벨은 회전 그룹 안" 한 구절.

## 작업

1. `components/Wheel.tsx` 위 변경 + Why 주석.
2. 게이트: tsc · lint · test · build.
3. 임시 확인 페이지 `app/wheelcheck/page.tsx`(7개 후보, spinning → decided 전환)로 로컬 `next start -p 3100` + gstack 브라우저 캡처: 회전 중 라벨 보임, 정지 뒤 배지·라벨·튐 없음. 페이지는 커밋하지 않고 지운다.
4. CLAUDE.md 한 구절, STATE.md Quick 005 행, SUMMARY → 푸시 → PR. 머지·배포는 사용자 지시.

## 인수 조건

- 회전 중 캡처에 매장명·번호가 보인다(색만 있는 프레임 없음).
- 정지 캡처의 당첨 칸이 12시 포인터 아래에 있고 배지가 가로다.
- `grep -c showLabels components/Wheel.tsx` = 0. 게이트 4종 exit 0.
