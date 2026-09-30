---
quick_id: "002"
slug: wheel-labels-copy
completed: 2026-09-30
branch: feat/ui-wheel-labels
commits: [8e2238b, 6ec1744, 6185772, 91de916, 09f1b66]
status: complete (PR 대기, main 미반영)
---

# Quick Task 002: 휠 라벨 가독성 + 시계 중복·영문 라벨 정리 — Summary

## 결과

- 휠 라벨이 칸 방향으로 눕는다. 후보 15개에서도 라벨끼리 겹치지 않는다. 8 코드포인트를 넘는 이름은 7 + "…".
- 시계는 상단 바 한 곳. 스테이지 머리와 푸터의 시계를 지웠다.
- 기능 라벨 9종을 한글로 바꿨다. 브랜드 부제 `· LUNCH ROULETTE` 만 영문으로 남겼다.
- 회전 각도 파생(`isSpinning`·`restRotation`·회전 `<g>`)은 diff 0줄. 데이터 로직 diff 0줄.

## 실측

로컬 프로덕션 빌드(`next build` + `next start -p 3100`), gstack browse(Playwright Chromium). 라벨 겹침은 각 라벨 `<text>` 의 경계 상자 쌍 교차로 셌다. 회전한 글자의 경계 상자는 축 정렬 사각형이라 대각선 이웃끼리 상자만 겹칠 수 있어, 상자 교차가 있는 경우는 캡처로 다시 봤다.

| 화면 | 칸 수 | 라벨 상자 교차 | 육안 겹침 |
|---|---|---|---|
| 오늘 탭(라이브 후보) | 11~13 | 0 | 0 |
| 확인 페이지 | 15 | 4 | 0 |
| 확인 페이지 | 4 | 0 | 0 |
| 확인 페이지 | 1 | 0 | 0 |
| 확인 페이지, 확정 + 24자 당첨 | 15 | 3 | 배지가 이웃 위(의도) |

| 항목 | 값 |
|---|---|
| 확정 배지 폭 (14자 절단, 1280 폭) | 268px, 휠 460px 안 |
| 오늘 탭의 `HH:mm:ss` 문자열 수, 1280 폭 | 1 |
| 오늘 탭의 `HH:mm:ss` 문자열 수, 390 폭 | 0 (상단 바 시계가 720px 이하에서 숨겨짐) |
| 390 폭 `scrollWidth` | 390 |

확인 페이지는 커밋하지 않고 지웠다.

## 한 일

| 항목 | 내용 |
|---|---|
| `lib/wheelLabel.ts` | `normalizeDeg` · `isLabelFlipped`(12시=0, 180 초과만, 부동소수 잔차 허용) · `fitWheelLabel`(8, 당첨 14). spec 13건 |
| `components/Wheel.tsx` | 방사형 띠(반지름 74~192)에 번호 + 이름. 왼쪽 반원은 180° 뒤집고 번호를 뒤로. 당첨 배지는 가로, 라벨 뒤에 한 번. SVG `aria-hidden` |
| 시계 | `StageHeader`·`Footer` 에서 제거, prop 삭제 |
| 라벨 | STAGE(삭제) · NOW→지금 · CANDIDATES→후보 · PROBABILITY→확률 · FINALIZED→확정 · TODAY→오늘 · 1ST/2ND/3RD→1위/2위/3위 · SPIN AT→추첨 시각 · ADD A RESTAURANT→목록에서 담아 주세요 |
| 문서 | CLAUDE.md 엔트리·위험 지점, STRUCTURE.md, STATE.md 의 Quick 001 "PR 대기" 정정 |

## 리뷰 반영

리뷰 1회(Critical 0 · Warning 1 · Info 7). Warning 1건, Info 4건 반영.

| id | 조치 |
|---|---|
| WR-01 | 배지를 map 밖, 라벨 뒤에 한 번 렌더. DOM 순서로 확인(배지 rect 뒤에 오는 라벨 text = 배지 자신의 2개뿐) |
| IN-01 | 180° 허용 오차 1e-6. 칸 14개·당첨 12번의 실제 산술값으로 spec |
| IN-03 | 절단 1회 |
| IN-04 | "최근" 을 mono 밖으로 |
| IN-06 | 휠 SVG `aria-hidden` |
| IN-07 | 문서 커밋(6185772, 리뷰 시작 뒤) |

**반영하지 않은 것:** IN-02(이모지 위주 8자 이름이 띠를 넘침 — 한글 기준 폭 어림이라 이모지만으로 된 이름은 예외), IN-05(spec 의 8 이 띠 산술과 코드로 묶이지 않음 — 주석으로 연결).

## 게이트

| 게이트 | 결과 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 17 files / 411 tests |
| `npm run build` | exit 0, 라우트 4개 |
| `npm run check:edge` | exit 0 |
| 커밋 메시지 AI 표기 | 0 |

## 확인하지 못한 것

- 회전 중 애니메이션에서 라벨이 숨었다 나타나는 전환(opacity). 정지 상태만 캡처했다.
- 실기기.

## 소요

| 구간 | 시각 (KST) |
|---|---|
| 브랜치 생성 | 11:24 |
| 구현 커밋 | 11:33 |
| 리뷰 (백그라운드) | 11:36 ~ 11:47, 11분 |
| 리뷰 반영 커밋 | 11:47 |

## 범위 밖으로 남긴 것

- 다크 모드, 모션 줄이기.
- 포인터를 SVG 안으로(Quick 001 IN-01).
- inline 중복 자동 검사(Quick 001 IN-02).
- 이모지 이름의 띠 폭(IN-02).
