---
quick_id: "002"
slug: wheel-labels-copy
created: 2026-09-30
branch: feat/ui-wheel-labels
lane: direct (플랜·실행 직접, 리뷰 1회)
---

# Quick Task 002: 휠 라벨 가독성 + 시계 중복·영문 라벨 정리

## 목표

후보가 15개일 때도 휠의 매장명이 옆 칸을 침범하지 않고 읽힌다. 시계는 화면에 한 곳만 남기고, 기능을 가진 영문 소형 라벨은 한글로 통일한다.

## 근거 (라이브 2026-09-30 캡처)

- 15칸(24°)에서 라벨 원 반지름 124px 의 칸당 호 길이는 약 52px 인데 "돈돌 부대찌개 매니아" 는 14px 로 약 130px 다. 가로 라벨이 옆 칸으로 넘치고 중심 근처 라벨끼리 붙어 읽힌다.
- 오늘 탭에 시계가 3곳(상단 바 NOW · 스테이지 머리 · 푸터 KST).
- 영문 소형 라벨: STAGE · NOW · CANDIDATES · PROBABILITY · FINALIZED · TODAY · 1ST/2ND/3RD · SPIN AT · ADD A RESTAURANT. 나머지 라벨은 한글이라 한 화면에 두 언어가 섞인다.

## 결정

- **D-01 라벨은 방사형.** 칸 중앙 각도로 회전한 띠(반지름 74~192, 길이 118) 안에 번호 + 이름을 한 줄로 둔다. 띠 길이는 칸 수와 무관하므로 칸이 늘어도 겹치지 않는다.
- **D-02 왼쪽 반원(180°~360°)은 뒤집는다.** 그대로 두면 화면에서 거꾸로 읽힌다. 뒤집은 쪽은 번호를 이름 뒤에 둬 번호가 항상 허브 쪽에 오게 한다.
- **D-03 이름은 8 코드포인트까지, 넘치면 7 + "…".** 띠에서 번호를 뺀 약 102px 을 13px 글자 폭(약 12px)으로 나눈 값. 전체 이름은 목록과 결과 카드에서 본다.
- **D-04 당첨 라벨은 지금처럼 가로 배지.** 확정 상태에서 당첨 칸은 12시에 오므로 방사형이면 세로 글자가 된다. 배지가 옆 칸을 덮는 것은 강조라 허용.
- **D-05 판단은 `lib/wheelLabel.ts`(순수).** 뒤집기 판정·이름 절단·상수. `Wheel.tsx` 는 부르기만 한다. 회전 각도 파생(`isSpinning`·`restRotation`)은 건드리지 않는다.
- **D-06 시계는 상단 바 한 곳.** 스테이지 머리와 푸터의 시계를 지운다. 720px 이하에서는 상단 바 시계도 숨겨져 있어 휴대폰에는 시계가 없다 — 휴대폰은 상태 표시줄에 시계가 있다.
- **D-07 기능 라벨은 한글, 브랜드는 영문 유지.** `· LUNCH ROULETTE` 만 남긴다. `.micro` 의 uppercase 는 한글에 영향이 없어 그대로 둔다.

## 작업

1. `lib/wheelLabel.ts` + `lib/wheelLabel.test.ts` — `normalizeDeg`·`isLabelFlipped`·`fitWheelLabel`·상수.
2. `components/Wheel.tsx` — 방사형 라벨, 허브 문구 한글.
3. `app/page.tsx` — 스테이지 머리·푸터 시계 제거, STAGE 제거.
4. `components/TopBar.tsx` — NOW → 지금.
5. `components/ResultBlock.tsx` — CANDIDATES/PROBABILITY/FINALIZED.
6. `components/CalendarLog.tsx` — TODAY → 오늘.
7. `components/RankingView.tsx` — 1ST/2ND/3RD → 1위/2위/3위.
8. `.planning/STATE.md` — Quick 001 의 "PR 대기" 문구 정정.
9. 문서 — CLAUDE.md 의 `lib/wheelLabel.ts` 한 줄.

## 인수 조건

- 후보 13개 라이브 데이터로 휠을 그렸을 때 라벨끼리 겹침 0(각 라벨 텍스트의 경계 상자 교차 검사).
- 확정 상태에서 당첨 배지가 12시에 가로로 보인다.
- 오늘 탭 DOM 에 `HH:mm:ss` 형태 문자열이 1곳.
- 게이트 5종 green. 커밋·PR AI 표기 0.

## 범위 밖

다크 모드, 포인터 SVG 내장(Quick 001 IN-01), inline 중복 자동 검사(IN-02).
