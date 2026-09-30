---
phase: quick-001-mobile-layout
reviewed: 2026-09-30T01:35:00Z
depth: deep
commit: 9bd13c6
files_reviewed: 13
files_reviewed_list:
  - app/globals.css
  - app/page.tsx
  - app/log/page.tsx
  - app/restaurants/page.tsx
  - components/TopBar.tsx
  - components/Wheel.tsx
  - components/ResultBlock.tsx
  - components/CandidateList.tsx
  - components/RestaurantList.tsx
  - components/CalendarLog.tsx
  - components/RankingView.tsx
  - components/ErrorBanner.tsx
  - components/layoutClasses.test.ts
findings:
  critical: 0
  warning: 8
  info: 4
  total: 12
status: issues_found
---

# Quick 001: 모바일 레이아웃 코드 리뷰

**Reviewed:** 2026-09-30T01:35:00Z
**Depth:** deep
**Commit:** 9bd13c6 (`feat(ui): fit all four tabs to phone widths`)
**Files Reviewed:** 13
**Status:** issues_found

## Summary

커밋 9bd13c6 의 13개 파일을 읽고, 폭에 따라 달라지는 동작은 실제 브라우저로 확인했다.

**확인 방법.** 레포 밖(`/tmp/lr-review`)에서 실제 컴포넌트를 `renderToStaticMarkup` 으로 렌더하고, `app/globals.css` 와 Tailwind preflight(`@layer base`)를 같은 레이어 순서로 붙여 headless Chromium 에서 폭별(320~1280px)로 측정했다. 레포 파일·`.next`·git 상태는 건드리지 않았다. 한계: 정적 마크업이라 상호작용은 재현하지 않았고, `pointer: coarse` 는 media query 를 바꿔 끼워 흉내 냈다. 페이지 3개(`app/*.tsx`)는 훅이 supabase 를 부르므로 JSX 뼈대를 손으로 옮겨 조립했다.

**게이트.** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npx vitest run` 16 files / 398 tests 통과.

**문제없음으로 확인한 것 (요청 1·2·3·4번).**

- **inline ↔ 클래스 충돌 0건.** `l-*` 규칙이 가진 모든 속성(브라우저가 단축 속성을 펼친 longhand 기준, media query 안쪽 포함)을 그 규칙에 매치되는 요소의 inline style 과 대조했다. 오늘 탭 4개 페이즈(접수·회전·확정·추첨 대기)와 매장·기록·랭킹 탭을 렌더한 결과 충돌 0건. 검사기 자체는 일부러 넣은 충돌(`padding` ↔ `paddingBottom`)을 잡는 것으로 확인했다.
- **데스크톱 값 대조.** 지운 inline 속성은 전부 같은 값으로 CSS 에 있다(`headline` 의 `gap 4 + marginLeft 8` → `columnGap 12` 포함). 값이 바뀐 것은 의도된 것뿐이다(`1fr` → `minmax(0, 1fr)`, 푸터 `alignItems`, 목록 높이 상한). 예외 1건은 WR-01.
- **캐스케이드.** `@import "tailwindcss"` 는 `@layer theme, base, components, utilities` 를 선언하고 `l-*` 는 레이어 밖이라 preflight·유틸리티를 항상 이긴다(`.l-input` 14px/16px, `.l-cal-cell` padding 계산값으로 확인). 720px 블록의 `.wrap` → `.l-topbar` 순서, `.l-podium-card[data-rank]`(0,2,0 동률 + 뒤 순서)도 맞다.
- **휠 회전.** `transform-origin` 계산값은 모든 폭에서 `230px 230px`(viewBox 좌표)이고 회전 그룹의 중심이 SVG 중심과 일치한다(332px·262px 로 줄어든 상태 포함). 포인터의 가로 위치도 모든 폭에서 SVG 중심이다. 세로 위치만 IN-01.
- **데이터 로직.** `lib/` diff 0줄, 세 페이지의 변경은 `className`·스타일 객체·감싸는 `div` 뿐이다.

Critical 은 없다. 아래 Warning 8건 중 3건(WR-01·02·04)은 이 커밋이 만든 회귀다.

## Warnings

### WR-01: `.l-page-head > *` 의 `min-width: 0` 이 타임라인까지 줄여 721~880px 에서 오른쪽 여백으로 삐져나온다 (회귀)

**File:** `app/globals.css:171-174` (영향: `app/page.tsx:280-289`, `components/PhaseTimeline.tsx:85-91`)

**Issue:** 규칙이 머리 영역의 **모든** 자식에 `min-width: 0` 을 준다. 이유는 부제 칸(첫째 자식)을 줄이려는 것인데, 오늘 탭의 둘째 자식인 `PhaseTimeline` 도 같이 하한을 잃는다. 타임라인은 `gridAutoColumns: "auto 24px"` 라 내용이 min-content(196.6px) 아래로 줄지 못하므로, 상자만 줄고 내용은 상자 밖으로 넘친다. 커밋 전에는 `min-width: auto` 가 타임라인을 지키고 부제 칸이 줄어드는 몫을 전부 가져갔다.

**Failure scenario:** 확정 페이즈 + 긴 매장명일 때 한 줄 배치가 유지되는 폭에서 발생한다(721px 기준 계산상 약 13자부터, 11자 이름은 실측 넘침 0). 24자 이름 실측:

| 뷰포트 | 타임라인 상자 | 내용이 `.wrap` 내용 영역을 넘는 양 |
|---|---|---|
| 721px | 166.1px | 30.5px |
| 744px (iPad mini 세로) | 172.2px | 24.4px |
| 768px (iPad 세로) | 178.6px | 18.0px |
| 820px | 192.4px | 4.2px |
| 900px 이상 | 209.1px | 0 |

"리셋 00:00" 단계가 본문 오른쪽 정렬선 밖, 화면 끝 1.5px 앞까지 밀린다. 패딩이 32px 라 가로 스크롤은 생기지 않는다. 이 규칙을 뺀 CSS 로 같은 조건을 재면 넘침은 네 폭 모두 0 이다.

**Fix:** 줄어들 자격을 부제 칸에만 주고 나머지 자식은 줄지 않게 한다.

```css
.l-page-head > * {
  min-width: 0;
  max-width: 100%;
}
/* 타임라인은 내용이 줄지 못한다 — 줄어드는 몫은 부제 칸이 전부 가져간다. */
.l-page-head > :not(:first-child) {
  flex-shrink: 0;
}
```

### WR-02: `word-break: keep-all` 뒤로 긴 메뉴 칩이 줄지 못해 핀·수정 버튼을 덮는다 (회귀)

**File:** `app/globals.css:71-72` (넘치는 요소: `components/MenuChips.tsx:29` 의 칩 `span`, 스타일 `:49-56`)

**Issue:** 칩은 `flex-wrap` 컨테이너(`MenuChips.tsx:43-48`)의 flex 자식이고 `min-width` 가 없다. flex 자식의 기본 하한은 min-content 인데, `keep-all` 아래에서는 띄어쓰기 없는 한글이 통째로 한 단어라 min-content 가 글자 전체 폭이 된다. `overflow-wrap: break-word` 는 min-content 계산에 끼지 않으므로 칩이 부모보다 넓은 채로 남는다. 커밋 전(`word-break: normal`)에는 한글이 음절마다 끊겨 칩 안에서 줄이 바뀌었다 — 전역 두 줄만 뺀 CSS 로 재면 넘침이 사라진다.

`MenuChips.tsx` 는 이 커밋의 변경 파일이 아니지만, 원인이 범위 안의 전역 규칙이다. `CLAUDE.md` 위험 지점 표가 요구하는 "`minWidth: 0` 로 줄어들 수 있어야 한다" 가 빠진 자리다.

**Failure scenario:** 매장 탭, 뷰포트 390px, 터치 기기(`l-tap` 40px 적용), 23자 메뉴 `트러플크림까르보나라파스타곱빼기세트메뉴특선`:

| 뷰포트 | 칩 오른쪽 끝 | 칩 컨테이너 오른쪽 끝 | 핀 버튼 왼쪽 끝 | 겹침 |
|---|---|---|---|---|
| 390px | 270.1 | 200.4 | 210.4 | 59.7px (핀 전체 + 수정 버튼 앞 10px) |
| 360px | 270.1 | 170.4 | 180.4 | 89.7px |
| 320px | 270.1 | 130.4 | 140.4 | 129.7px (핀·수정·삭제 일부) |

390px 터치 기기에서는 띄어쓰기 없는 16자부터 넘친다(칩 폭 ≈ 16 + 9.44 × 글자 수, 컨테이너 163.4px). 당첨 결과의 메뉴 칩(`ResultBlock.tsx:96`)도 같은 구현이라, 24자 메뉴면 계산상 329px 아래 화면에서 카드에 잘린다(23자·320px 실측은 잘림 없음).

**Fix:**

```ts
// components/MenuChips.tsx
chip: {
  // 띄어쓰기 없는 긴 메뉴는 keep-all 아래에서 한 단어다 — 줄어들 수 있어야 칩 안에서 꺾인다.
  minWidth: 0,
  fontSize: 11.5,
  // …
},
```

### WR-03: 통계 바가 353px 아래 화면에서 카드에 잘린다

**File:** `components/ResultBlock.tsx:147-155` (`s.bar`), 칸은 `:21-43`

**Issue:** `gridTemplateColumns: "1fr auto auto"` 가 inline 에 남아 폭에 반응하지 않는다. 접수 페이즈의 세 칸은 min-content 합이 319px 이고(휴대폰 여백 14px 기준), 스테이지 카드는 `overflow: hidden` 이라 넘친 만큼 스크롤 없이 잘린다.

**Failure scenario:** 접수 페이즈(낮 시간 기본 화면), 뷰포트 320px. 바 `clientWidth` 286 / `scrollWidth` 319. `PROBABILITY` 라벨의 오른쪽 끝이 321.5px 인데 카드가 304px 에서 자른다 — 라벨 끝 17.5px 이 보이지 않는다. 344px 에서는 여백만 잘리고, 352px 에서 1px 모자라며, 360px 부터 맞는다. 320px 은 WCAG 1.4.10(Reflow)의 기준 폭이다.

**Fix:** 열 구성을 클래스로 옮기고 휴대폰에서는 왼쪽 칸을 한 줄로 올린다. 분기는 기존 720px 을 쓴다.

```css
.l-stat-bar { display: grid; grid-template-columns: 1fr auto auto; }
@media (max-width: 720px) {
  .l-stat-bar { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .l-stat-bar > :first-child { grid-column: 1 / -1; }
}
```

`s.bar` 에서는 `display`·`gridTemplateColumns` 를 지운다(규칙 1). 둘째·셋째 칸의 `borderLeft` 는 첫째 칸 아래로 내려갈 때 위쪽 선이 필요한지 함께 본다.

### WR-04: 휴대폰 폭에서 달력 칸의 접근 이름에서 매장명이 사라진다 (회귀)

**File:** `components/CalendarLog.tsx:158-160` (버튼은 `:109-121`)

**Issue:** 매장명 `span` 을 `l-hide-narrow`(`display: none !important`)로 숨긴다. `display: none` 은 접근성 트리에서도 빠지므로 버튼의 접근 이름이 날짜 숫자만 남는다. 버튼에 `aria-label` 이 없다. 커밋 전에는 모든 폭에서 이름이 버튼 내용이었다.

**Failure scenario:** 720px 이하에서 기록 있는 칸의 글자는 `"2"`, 844px·1280px 에서는 `"2 공리"` 다(실측). VoiceOver 사용자는 "2, 버튼" 만 듣고, 어느 매장인지 알려면 칸을 하나씩 눌러 상세로 옮겨 가야 한다. 같은 이유로 오늘 칸의 `TODAY`(`:140`)도 사라지는데 `aria-current` 가 없다.

**Fix:**

```tsx
<button
  key={i}
  className="l-cal-cell"
  aria-label={entry ? `${c.m}월 ${c.d}일 ${entry.menu}` : undefined}
  aria-current={isToday ? "date" : undefined}
  aria-pressed={entry ? isSelected : undefined}
  …
>
```

### WR-05: 휴대폰에서 날짜를 눌러도 상세가 화면 밖에 그려진다

**File:** `components/CalendarLog.tsx:119` (선택), `:169-190` (상세), `app/globals.css:216-222` (1단 전환)

**Issue:** 960px 이하에서 상세 카드가 달력 아래로 내려가는데, 선택 뒤 스크롤도 포커스 이동도 없다. 이 커밋은 같은 폭에서 칸의 이름을 숨기고 "이름은 눌러서 본다"(`:157` 주석)로 바꿨으므로, 누른 결과가 보이는 것이 이 배치의 전제다.

**Failure scenario:** 뷰포트 390px 에서 달력 격자의 끝이 문서 y=757.5px, 상세 카드의 시작이 y=782.5px 다(실측). 390×844 기기의 Safari 는 주소창·툴바를 빼면 보이는 높이가 약 660~750px 이라, 첫 주의 날짜를 누르면 칸 색만 바뀌고 매장명은 화면 아래에 생긴다. 사용자는 눌린 줄 모르거나 스크롤해야 한다는 것을 알 수 없다.

**Fix:** 선택이 생길 때 상세를 화면으로 끌어온다. effect 안에서 state 를 쓰지 않으므로 `react-hooks/set-state-in-effect` 에 걸리지 않는다.

```tsx
const detailRef = useRef<HTMLElement>(null);
useEffect(() => {
  if (selected === null) return;
  // 2단 배치에서는 상세가 옆에 있어 nearest 가 아무것도 움직이지 않는다.
  detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}, [selected]);
// …
<aside ref={detailRef} className="card" style={s.detail}>
```

### WR-06: 입력 칸 16px 이 폭으로 갈려 가로로 든 아이폰에서 확대가 남는다

**File:** `app/globals.css:252-253`

**Issue:** iOS 의 포커스 확대는 폭이 아니라 기기의 동작이다. `.l-input` 의 16px 이 `max-width: 720px` 안에 있어, 720px 을 넘는 아이폰 화면에서는 14px 로 돌아간다. 같은 파일 `:278-279` 의 주석이 `l-tap` 에 대해 적은 논거("폭이 아니라 입력 수단으로 가른다")가 여기에도 그대로 맞는다.

**Failure scenario:** 아이폰 14 가로(844px)에서 입력 칸의 계산값은 `14px`(실측). "매장 이름으로 찾기" 나 등록 폼에 포커스가 가면 Safari 가 페이지를 확대한다. 가로로 들었을 때 720px 을 넘는 폭은 812·844·852·926·932px 이고, 720px 아래로 남는 것은 667px(SE·8) 뿐이다.

**Fix:** 720px 블록의 규칙을 `pointer: coarse` 블록으로 옮긴다. 분기 값은 늘지 않는다.

```css
@media (pointer: coarse) {
  .l-tap { min-height: 40px; min-width: 40px; }
  /* iOS Safari 는 16px 미만 입력 칸에 포커스가 가면 페이지를 확대한다. 가로로 든 휴대폰은 720px 을 넘는다. */
  .l-input { font-size: 16px; }
}
```

### WR-07: spec 의 className 검사가 읽지 못하는 형태가 있어 오타가 초록으로 통과한다

**File:** `components/layoutClasses.test.ts:35-37`, `:61-67`

**Issue:** 이 spec 이 막겠다고 한 것이 className 오타인데, 아래 형태는 네 검사 어디에도 걸리지 않는다. 정규식에 직접 넣어 확인했다.

| 입력 | 동적 사용 검사(`:64`) | 사용 목록(`:35`) |
|---|---|---|
| ``className={`${cls} l-hide-narow`}`` | 통과 (`[^}]*` 가 `${cls}` 의 `}` 에서 멈춘다) | 못 읽음 |
| `className={pick({a:1}) + " l-x"}` | 통과 (같은 이유) | 못 읽음 |
| `className='l-hide-narow'` | 통과 (`{` 가 없다) | 못 읽음 (큰따옴표만 본다) |
| `const C = "l-cal-cel"; className={C}` | 통과 | 못 읽음 |
| `className="mono I-hide-narrow"` | 통과 | 못 읽음 (`startsWith("l-")` 가 거른다) |

**Failure scenario:** `l-hide-narrow` 는 6곳에서 쓰인다. 일곱 번째 자리에 ``className={`${base} l-hide-narow`}`` 를 넣으면 "사용 ⊆ 정의" 는 그 토큰을 보지 못하고, "정의 ⊆ 사용" 은 나머지 6곳이 채우고, 동적 사용 검사는 첫 `}` 에서 멈춰 통과한다. 6개 테스트가 전부 초록이고 그 요소는 휴대폰에서 숨지 않는다. 여러 곳에서 쓰이는 클래스(`l-stat-cell` 6 · `l-tap` 6 · `l-input` 4 · `l-page-head` 4 · `l-rank-row` 2)가 전부 같다.

**Fix:** 허용 목록을 뒤집는다 — "읽을 수 있는 형태를 찾는다" 가 아니라 "`l-` 토큰은 `className="…"` 안에만 있어야 한다" 로 검사한다.

```ts
it("l-* 토큰은 className=\"…\" 리터럴 안에만 나온다", () => {
  const stray = files.flatMap((file) => {
    // 주석에는 l-page-head 같은 이름이 설명으로 나온다.
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const outside = code.replace(/className="[^"]*"/g, "");
    return Array.from(outside.matchAll(/(?<![\w-])l-[a-z][a-z0-9-]*/g), (m) => `${m[0]} (${file})`);
  });
  expect(stray).toEqual([]);
});
```

접두 오타(`I-`, `1-`)는 텍스트로 가릴 수 없다. 클래스별 사용 개수를 고정하는 것이 유일한 방법이고, 그 비용이 크면 한계를 spec 머리 주석에 적는다.

### WR-08: 분기 값 검사가 셋째 분기를 놓친다

**File:** `components/layoutClasses.test.ts:69-73` (주장은 `app/globals.css:148-149`)

**Issue:** 정규식 `/@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g` 가 읽는 것은 "`px` 정수로 적은 `max-width`/`min-width` 중 `@media` 하나당 **마지막** 것" 뿐이다. `[^{]*` 가 탐욕적이라 앞 조건을 삼킨다. `globals.css` 의 "값을 늘리면 spec 이 막는다" 는 이 범위에서만 참이다.

| 입력 | 잡힌 값 |
|---|---|
| `@media (min-width: 500px) and (max-width: 720px)` | `[720]` — 500 을 놓친다 |
| `@media (width <= 600px)` | `[]` |
| `@media (max-width: 45em)` | `[]` |
| `@media (max-width: 600.5px)` | `[]` |
| `@container (max-width: 500px)` | `[]` |

**Failure scenario:** `@media (min-width: 500px) and (max-width: 720px) { .l-cal-cell { … } }` 를 더하면 잡힌 집합은 여전히 `{720, 960}` 이라 통과하고, 500px 이라는 셋째 분기가 생긴다.

**Fix:** 값을 뽑지 말고 조건문 전체를 허용 목록과 비교한다.

```ts
it("media query 는 허용된 세 조건뿐이다", () => {
  const conditions = Array.from(css.matchAll(/@media\s*([^{]+)\{/g), (m) => m[1].trim());
  expect(Array.from(new Set(conditions)).sort()).toEqual([
    "(max-width: 720px)",
    "(max-width: 960px)",
    "(pointer: coarse)",
  ]);
  expect(css).not.toMatch(/@container/);
});
```

## Info

### IN-01: 포인터의 세로 위치가 고정 px 이라 휠이 줄면 조각 안으로 파고든다

**File:** `components/Wheel.tsx:269-284`

**Issue:** 포인터는 `top: -2`·높이 38px 로 고정이고 휠의 바깥 여백(viewBox 30단위)은 비율대로 준다. 포인터 끝은 모든 폭에서 y=26px 인데 조각 가장자리는 460px 일 때 30px, 332px 일 때 21.7px, 262px 일 때 17.1px 다. 데스크톱에서는 끝이 흰 테두리 안에서 4px 모자라게 멈추고, 390px 화면에서는 조각 안으로 4.3px, 320px 에서는 8.9px 들어간다. 가리키는 방향(12시)과 가로 위치는 맞다 — 모양만 다르다.

**Fix:** 포인터를 SVG 안으로 옮겨 viewBox 단위로 그리면 같이 줄어든다. 그대로 둘 거면 주석에 "세로 위치는 460px 기준" 을 적는다.

### IN-02: 규칙 1(inline 중복 금지)은 어떤 게이트도 지키지 않는다

**File:** `components/layoutClasses.test.ts` (전체), 규칙은 `app/globals.css:146-147`

**Issue:** spec 은 이름·분기 값·`!important` 목록을 고정하지만, 이 방식의 가장 흔한 조용한 실패인 "`l-*` 가 가진 속성을 inline 에 다시 적는 것" 은 보지 않는다. `layoutStyles.cols` 에 `display: "grid"` 를 되돌려도 tsc·lint·vitest 가 전부 통과하고 휴대폰에서만 2단으로 남는다. 지금은 충돌이 0건이다(위 Summary 의 브라우저 대조).

**Fix:** 텍스트 계약으로 좁게 막을 수 있다. 같은 태그에 `className="… l-x …"` 와 `style={s.key}` 가 함께 있으면 그 파일의 `key: { … }` 에서 속성 이름을 뽑아, CSS 의 `.l-x` 선언(camelCase ↔ kebab, `padding`·`margin`·`gap`·`flex` 단축 속성 표 포함)과 겹치는지 본다. spread 로 합친 inline 객체는 읽지 못하므로 그 한계를 주석에 적는다.

### IN-03: 배너 닫기 버튼이 터치 기기에서도 18×16px 이다

**File:** `components/ErrorBanner.tsx:20`, `:43-52`

**Issue:** 이 커밋이 고친 파일이지만 `l-tap` 이 붙지 않았다. `pointer: coarse` 를 켠 상태로 재도 18×16px 이다(D-06 의 40px, WCAG 2.5.8 의 24px 모두 미달). 설정·조회 실패 배너는 닫기 전까지 남으므로 이 버튼이 유일한 출구다. 삭제 확인의 "삭제"(32px), 폼의 "등록"·"저장"·"취소"(38px)도 40px 아래다.

**Fix:** 닫기 버튼에 `className="l-tap"` 을 붙인다. `s.close` 에 `minWidth`·`minHeight` 가 없어 규칙 1 과 충돌하지 않는다.

### IN-04: `headlineNote` 주석의 이유가 같은 커밋의 전역 규칙과 어긋난다

**File:** `components/ResultBlock.tsx:159-160`

**Issue:** "nowrap 이 없으면 한 글자씩 세로로 꺾인다" 는 커밋 전(`flex` 한 줄 + `word-break: normal`)의 동작이다. 같은 커밋이 넣은 `flexWrap: "wrap"` 과 전역 `keep-all` 아래에서는 `nowrap` 이 없어도 문구가 통째로 다음 줄로 내려가고, 꺾이더라도 어절 단위다. `nowrap` 은 이제 이중 안전장치인데 주석은 유일한 방어처럼 읽힌다. 나머지 추가 주석은 한글·Why 규약에 맞는다.

**Fix:** 주석을 지금의 이유로 고친다 — 예: "어절 사이에서도 끊기지 않게 한다. 문구가 둘로 갈라지면 시각 옆에 반쪽만 남는다."

---

_Reviewed: 2026-09-30T01:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
