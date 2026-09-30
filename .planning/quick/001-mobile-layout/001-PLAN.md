---
quick_id: "001"
slug: mobile-layout
created: 2026-09-30
branch: feat/mobile-layout
lane: direct (플랜·실행 직접, 리뷰 1회)
---

# Quick Task 001: 모바일 레이아웃 + 눈에 보이는 결함 3건

## 목표

휴대폰 폭에서 4개 탭(오늘·매장·기록·랭킹)이 가로 스크롤 없이 읽히고 눌린다. 데스크톱에서 보이던 결함 3건을 함께 없앤다.

## 근거 (실측 2026-09-30, 라이브)

| 조건 | 값 |
|---|---|
| 뷰포트 390×844, 오늘 탭 `scrollWidth` | 716px |
| 뷰포트 390×844, 매장·기록·랭킹 `scrollWidth` | 686px |
| `app/`·`components/` 의 media query | 0건 |

측정 도구: gstack browse(Playwright Chromium) `viewport 390x844` → `document.documentElement.scrollWidth`.

## 결정

- **D-01 반응형 수단 = `app/globals.css` 의 `l-*` 클래스.** inline style 은 media query 를 쓸 수 없다. 화면 폭에 따라 **바뀌는 속성만** 클래스로 옮기고 색·글꼴·고정 간격은 inline 에 남긴다. CSS 변수 방식은 기각 — `flexWrap`·`flexDirection` 같은 속성은 csstype 이 리터럴 유니온이라 `"var(--x)"` 가 타입 에러다.
- **D-02 같은 속성을 inline 과 클래스 양쪽에 두지 않는다.** inline 이 이기므로 분기가 조용히 꺼진다. 숨김 유틸 2종(`l-hide-stack`·`l-hide-narrow`)만 `!important` 로 예외.
- **D-03 분기는 2개.** 960px(2단 → 1단) · 720px(휴대폰). 720 의 근거: 상단 바 한 줄 배치의 최소 폭이 약 674px.
- **D-04 목록 높이 상한 제거.** 후보 목록 420px · 매장 목록 520px 고정 + 내부 스크롤을 없애고 페이지 스크롤로 통일한다. 휴대폰의 중첩 스크롤은 스크롤이 갇힌다.
- **D-05 휠은 유동 폭.** `size` 는 최대 폭이 되고 SVG 는 viewBox 로 줄어든다. 회전 각도 파생(`isSpinning`·`restRotation`)은 건드리지 않는다.
- **D-06 터치 대상 최소 40px 는 `pointer: coarse` 에서만.** 데스크톱 밀도를 바꾸지 않는다.
- **D-07 클래스 이름 오타는 텍스트 계약 spec 으로 막는다.** 렌더 하네스가 없어 오타는 휴대폰에서만 조용히 깨진다.

## 작업

1. `app/globals.css` — `l-*` 클래스 + media query 2개 + `pointer: coarse` + 본문 `word-break: keep-all`.
2. `components/TopBar.tsx` — 휴대폰에서 2줄(브랜드·상태 / 탭), 부제·시계 숨김.
3. `app/page.tsx` — 페이지 머리·2단 격자·휠 홀더 클래스, 푸터·다시 돌리기 줄바꿈.
4. `components/Wheel.tsx` — 유동 폭, 포인터 위치 `calc(50% - 14px)`.
5. `components/ResultBlock.tsx` — 왼쪽 칸 여백(결함), 셀 여백 클래스, 문구 줄바꿈 단위.
6. `components/CandidateList.tsx`·`components/RestaurantList.tsx` — 높이 상한 제거(결함), "규칙" 라벨 꺾임(결함), 터치 대상, 입력 글자 크기.
7. `components/CalendarLog.tsx`·`app/log/page.tsx` — 1단 전환, 휴대폰 달력 압축.
8. `components/RankingView.tsx` — 시상대 1단, 표 열 축소.
9. `app/restaurants/page.tsx` — 페이지 머리 클래스.
10. `components/layoutClasses.test.ts` — 사용 ⊆ 정의, 정의 ⊆ 사용, 분기 값 2개.
11. 문서 — `CLAUDE.md` 컨벤션, `.planning/codebase/CONVENTIONS.md`.

## 인수 조건

- 390×844 에서 4개 탭 `scrollWidth` = 390 (가로 넘침 0).
- 1280 폭 화면이 기존과 같은 배치다(결함 3건 제외).
- 게이트 5종 green. 커밋·PR AI 표기 0.
- 데이터 로직(`lib/`, Realtime 핸들러, 쓰기 경로) diff 0줄.

## 범위 밖

휠 라벨 가독성(3번), 시계 중복·영문 라벨 정리(4번), 다크 모드.
