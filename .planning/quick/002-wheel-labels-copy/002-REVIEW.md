---
phase: quick-002-wheel-labels-copy
reviewed: 2026-09-30T02:45:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - lib/wheelLabel.ts
  - lib/wheelLabel.test.ts
  - components/Wheel.tsx
  - app/page.tsx
  - components/TopBar.tsx
  - components/ResultBlock.tsx
  - components/CalendarLog.tsx
  - components/RankingView.tsx
  - .planning/STATE.md
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Quick 002: 코드 리뷰 (커밋 6ec1744)

**Reviewed:** 2026-09-30T02:45:00Z (11:45 KST)
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

`git show 6ec1744` 의 9개 파일을 읽고, 휠 기하는 눈이 아니라 계산으로 검증했다(SVG 회전 행렬 + Pretendard SemiBold/Bold woff2 의 실제 advance width 를 fontTools 로 읽어 썼다). 게이트: `npx tsc --noEmit` exit 0 · `npm run lint` 에러 0 · `npx vitest run` 17 파일 411 테스트 통과. 회전 파생부(`hasWinner`·`restRotation`·`isSpinning`·`rotation`·회전 `<g>` 의 `transformOrigin`/`transform`)는 diff 에 한 줄도 없다 — CLAUDE.md 위험 표의 조건을 지켰다.

### 검증한 것 (문제 없음 — 근거만 적는다)

**1. 방사형 좌표계 (`components/Wheel.tsx:233`).** SVG `rotate(φ)` 는 `x' = x cos φ − y sin φ, y' = x sin φ + y cos φ` 이고 y 가 아래로 자라므로 양의 각이 화면상 시계 방향이다. `translate(cx cy) rotate(θ − 90)` 아래에서 로컬 `(r, 0)` 은 `(r cos(θ−90), r sin(θ−90))` 로 가고, 이것은 `polar(cx, cy, r, θ)` 와 문자 그대로 같은 식이다. 따라서 로컬 +x 는 칸 중앙선을 따라 허브 → 테두리다.
- 글자의 읽기 방향(로컬 +x)을 화면 벡터로 풀면 `(sin θ, −cos θ)`, 글자의 "위"(로컬 −y)는 `(−cos θ, −sin θ)`. 위 벡터의 화면 y 성분이 `−sin θ` 이므로 **θ ∈ (0, 180) 에서만 위를 향한다**(y 가 아래로 자라니 음수가 위). 0·90·180: θ=90 은 3시에서 수평 왼→오, θ=0 은 12시에서 아래→위 세로, θ=180 은 6시에서 위→아래 세로 — 셋 다 거꾸로가 아니다.
- 뒤집기 `rotate(180 labelBandMid 0)` (`Wheel.tsx:239`): 회전 중심이 곧 `<text>` 의 앵커(`x=labelBandMid, y=0`, `textAnchor=middle`, `dominantBaseline=central`)라 글자 상자는 같은 점에 같은 크기로 남고 방향만 반대가 된다. 뒤집힌 읽기 방향은 `(−sin θ, cos θ)`, 위는 `(cos θ, sin θ)` → 위의 y 성분 `sin θ` 는 **θ ∈ (180, 360) 에서 음수(위)**, 읽기 방향의 x 성분 `−sin θ` 는 양수(왼→오). θ=270(9시)은 수평 왼→오, 바로 선다.
- 번호 위치: 뒤집힌 글자는 DOM 순서(이름 → 번호)가 로컬 −x 로 진행하므로 마지막 tspan(번호)이 `labelBandMid` 보다 허브 쪽에 온다. 안 뒤집힌 쪽은 첫 tspan(번호)이 허브 쪽. 양쪽 다 번호가 허브 끝이다.
- 회전 오프셋: `screenMid = localMid + rotation` 이고 `rotation` 은 확정 시 음수(`restRotation`), 회전 중 `6·360 + …`. `<g>` 의 `rotate()` 는 임의 실수를 받고 `isLabelFlipped` 는 `normalizeDeg` 로 접으므로 둘이 같은 각을 본다. 확정 시 당첨 칸은 `localMid + restRotation = 0` 이 정확히 나와 `polar(…, 0)` = 12시, 나머지는 `(i − w)·sliceDeg` 로 함께 돈다.

**2. 띠 맞춤.** Pretendard 한글 advance 는 1770/2048 = 0.864em (SemiBold·Bold 동일), 공백 0.23em, "…" 0.82em. 13px + letter-spacing −0.01em → 한 글자 11.1px. 번호 "01" 은 JetBrains Mono 0.6em×9px×2 + 0.12em×9×2 = 12.96, dx 5. **8 글자 라벨 총폭 = 106.8 → r 79.6 ~ 186.4** (띠 74 ~ 192, 허브 테두리 66, 눈금 190 ~ 200). 허브 테두리와 13px, 눈금과 3.6px 여유. "7 + …" 도 88.4 로 같다. 상한 9 였다면 총폭 117.9 로 여유 0 — 8 은 근거가 있다(`lib/wheelLabel.ts:7-8` 의 "약 12px" 어림은 실제 11.1 보다 보수적이다). 세로 방향: 이름 시작 r≈97.5 에서 칸 폭 `2r·sin(sliceDeg/2)` 가 13px 아래로 떨어지려면 sliceDeg < 7.6° → **후보 48개 이상**에서만 라벨이 칸 경계를 넘고, 번호(9px, r=74)는 52개 이상이다. 실사용 범위에서 라벨끼리·라벨-경계 겹침은 없다.

**3. 당첨 배지.** L=14 일 때 `x = −134, width 268`, 중심 `(230, 106)`. 모서리 `(±134, −16)` 의 중심 거리 = √(134² + 140²) = **193.8 < R 200 < R+10 210** — 12시에서 휠 원판 안에 남는다. 세로: 번호 baseline −4(9px, 위 −10.5) · 이름 baseline 12(15px, 한글 잉크 위 ≈ 0, 아래 ≈ 15) 가 rect −16 ~ 18 안이다. 실제 14 글자 폭은 181 이라 배지 폭 어림(18/글자)은 한글에 넉넉하다.

**4. `lib/wheelLabel.ts` 순수성.** import 는 `@/lib/menus` 하나(그 아래 `@/lib/constants`)뿐. React·supabase·환경변수 없음. spec 은 0·180·360·음수·6바퀴·코드포인트 vs 코드유닛(9 이모지 = 18 코드유닛)·`max ≤ 1` 클램프를 다 찍는다.

**5·6. 시계·문구.** `clockTime` 은 `app/page.tsx:276` 에서 TopBar 로 여전히 간다. `StageHeader`·`Footer` 의 prop·`headerLeft`·`headerRight`·`inner` 의 flex 키가 같이 사라져 죽은 키가 없다. 1초 `now` 는 `todayKey`·`phase`·`formatKstLongDay`·`clockTime` 네 곳이 쓴다. `grep` 으로 STAGE/NOW/CANDIDATES/PROBABILITY/FINALIZED/TODAY/1ST/2ND/3RD/SPIN AT/ADD A RESTAURANT/KST 잔존 0(브랜드 `· LUNCH ROULETTE` 만 남음). 이번 커밋이 손댄 한글 문구 중 `className="mono"` 안에 남은 것은 없다(`ResultBlock.tsx:87` 은 시각만 mono 로 감쌌다). `.micro` 의 `text-transform: uppercase` 는 한글에 무효, 0.06em 자간은 11px 에서 0.66px 라 렌더를 유의미하게 바꾸지 않는다.

### 남은 문제

경고 1건은 확정 화면에서 **오른쪽 이웃 라벨이 당첨 배지 위에 그려지는** z-order 다. 나머지는 Info.

## Warnings

### WR-01: 확정 상태에서 당첨 다음 칸(i = w+1)의 방사형 라벨이 당첨 배지 위에 덧그려진다

**File:** `components/Wheel.tsx:175-260` (라벨 `items.map` 의 렌더 순서), 배지 분기 `179-222`
**Issue:** 라벨은 인덱스 순서 하나의 `map` 으로 그려지고 당첨 배지도 그 순서 안(인덱스 `w`)에 있다. SVG 는 문서 순서로 칠하므로 `i > w` 인 라벨은 배지 **위에** 온다. 확정 상태에서 `i = w+1` 은 12시 바로 오른쪽(`+sliceDeg`)이고, 그 방사형 띠(r 74~192)는 배지의 y 범위(90~124)를 **대각선으로 관통**한다. D-04 는 "배지가 옆 칸을 덮는 것" 을 허용했지만 지금은 반대로 옆 칸이 배지를 덮는다 — 왼쪽 이웃(`i = w−1`)은 배지 아래 숨고 오른쪽 이웃은 배지와 당첨 이름 위로 올라오는 비대칭이다. (옛 코드도 순서는 같았지만 가로 라벨이라 겹치는 부분이 번호와 이름 윗 6px 뿐이었다. 방사형으로 바뀌며 겹침이 배지 전체 높이 34px 로 늘었다.)
**Failure scenario (계산):** 라이브 후보 13개, 당첨 "돈돌 부대찌개 매니아"(11 코드포인트). 배지 x = 230 ± 107 = **123 ~ 337**, y 90 ~ 124; 당첨 이름 15px Bold 실폭 122 → x **169 ~ 291**. 오른쪽 이웃 중앙선 θ = 27.7°: 배지 y 범위에 걸리는 r = 106/cos θ ~ 140/cos θ = **119.7 ~ 158.1**, 그 구간의 x = 230 + r·sin θ = **285.6 ~ 303.5** → 배지 안이고 당첨 이름의 마지막 글자 "아"(278 ~ 291) 위를 이웃 이름의 2~5 번째 글자(13px SemiBold 진한 색)가 비스듬히 지난다. 후보 15개(θ = 24°)면 r 116 ~ 153, x **277 ~ 292** 로 더 깊이 들어온다. 당첨 이름이 9 코드포인트 이상이면 글자 충돌, 5 이상이면 배지 흰 여백·테두리 위로 이웃 글자가 올라온다. `w = n−1` 일 때만(오른쪽 이웃이 인덱스 0) 우연히 가려진다.
**Fix:** 배지를 방사형 라벨 뒤에 그린다 — `map` 은 방사형만 돌리고(당첨 칸은 `return null`), 당첨 배지는 `map` 다음에 한 번 렌더한다. 같은 `<g>` 안이라 opacity 전환은 그대로다.
```tsx
{items.map((item, i) => {
  if (isDecided && i === winnerIndex) return null;
  /* 방사형 라벨 그대로 */
})}
{isDecided && winnerIndex >= 0 && items[winnerIndex] && (() => {
  const item = items[winnerIndex];
  const [lx, ly] = polar(cx, cy, labelR, winnerIndex * sliceDeg + sliceDeg / 2 + rotation);
  /* 기존 배지 JSX */
})()}
```
(당첨 배지가 이웃 라벨의 중간을 가리는 것은 D-04 대로 양쪽 모두 같은 모양이 된다.)

## Info

### IN-01: 정확히 180° 인 라벨의 방향이 당첨 인덱스에 따라 달라진다 (부동소수 잔차)

**File:** `components/Wheel.tsx:176-177`, `lib/wheelLabel.ts:23-25`
**Issue:** `screenMid = i·sliceDeg + sliceDeg/2 + restRotation` 은 6시 라벨에서 정확히 180 이 아니라 `180.00000000000003` 또는 `179.99999999999997` 로 나올 수 있다. spec 은 "정확히 180 은 뒤집지 않는다" 를 계약으로 찍지만 호출부가 그 값을 보장하지 못한다.
**Failure scenario:** 전 조합(n ≤ 30)을 돌려 보면 n=14 에서 w=12·13 이면 6시 라벨이 뒤집혀 아래→위로 읽히고, 같은 n=14 에서 다른 w 면 위→아래다. n=26·28 도 w 에 따라 갈린다. 세로 글자라 거꾸로는 아니고 번호도 허브 쪽에 남아 가독성 손상은 없다 — 다시 돌리기 때마다 6시 라벨이 방향을 바꿀 수 있는 정도.
**Fix:** `isLabelFlipped` 가 접기 전에 1e-6 단위로 반올림하거나, `Wheel.tsx` 에서 `screenMid` 를 `Math.round(x * 1e6) / 1e6` 로 넘긴다. spec 의 "180 은 뒤집지 않는다" 케이스에 `180 + 1e-13` 을 추가하면 계약이 실제 입력을 덮는다.

### IN-02: 이모지 위주 이름은 띠를 양쪽으로 넘친다

**File:** `lib/wheelLabel.ts:7-9`, `components/Wheel.tsx:231,248`
**Issue:** 상한 8 은 한글 폭(0.86em)에서 왔고 주석은 "영문은 더 좁다" 까지만 말한다. 이모지는 시스템 이모지 폰트에서 약 1.25em 이라 8 개면 이름 130 + 번호 18 = **≈148 > 118**.
**Failure scenario:** spec 이 지원 입력처럼 다루는 `🍕🍔🍟🌭🥪🌮🌯🥙…` 을 매장명으로 담으면 라벨이 r **59 ~ 207** — 번호가 허브 테두리(66) 아래로 들어가 반쯤 가려지고, 끝 글자는 R=200 을 넘어 바깥 흰 고리 위에 찍힌다. 한글 이름에 이모지 한둘이 섞인 경우(예: "🍕피자헛")는 여유 안이다.
**Fix:** 그대로 두고 주석에 "이모지 위주 이름은 넘친다" 를 적어 한계를 명시하거나, `fitWheelLabel` 에서 이모지(`\p{Extended_Pictographic}`)를 1.5 글자로 세는 폭 가중을 둔다. 후자는 spec 한 줄로 고정한다.

### IN-03: 뒤집힌 분기에서 `nameSpan` 이 버려지고 `fitWheelLabel` 이 두 번 불린다

**File:** `components/Wheel.tsx:226-231, 246-256`
**Issue:** `numberSpan`·`nameSpan` 을 미리 만들어 두고 뒤집힌 쪽은 쓰지 않은 채 같은 내용을 인라인으로 다시 만든다. 결과는 같지만 "번호·이름 tspan 의 정의처가 둘" 이 돼 한쪽만 고치면 두 반원의 글자가 달라진다.
**Fix:** `const label = fitWheelLabel(item.name)` 한 번 계산하고, 두 분기를 `order = flipped ? [name, number] : [number, name]` 처럼 배열로 돌려 tspan 의 속성이 한 곳에만 있게 한다.

### IN-04: `RankingView.tsx:137` — 한글 "최근" 이 `className="mono"` 안에 남아 있다 (이번 커밋 이전부터)

**File:** `components/RankingView.tsx:137`
**Issue:** `<span className="mono">{날짜} 최근</span>` — JetBrains Mono 에 한글이 없어 "최근" 만 폴백 폰트로 섞인다. 이번 커밋이 같은 이유로 `RankingView.tsx:104`·`CalendarLog.tsx:155`·`ResultBlock.tsx:87` 을 고쳤는데 이 줄은 남았다.
**Fix:** `ResultBlock.tsx:87` 과 같은 모양으로 날짜만 감싼다: `<span><span className="mono">{…}</span> 최근</span>`.

### IN-05: spec 의 `WHEEL_LABEL_MAX_CODE_POINTS === 8` 은 띠 산술과 코드로 이어지지 않는다

**File:** `lib/wheelLabel.test.ts:79-81`, `components/Wheel.tsx:85-86`
**Issue:** 테스트는 상수를 8 로 핀할 뿐이고 띠 길이(`Rinner + 18`, `R − 8`)는 `Wheel.tsx` 안 지역값이다. 누군가 `labelBandStart` 를 `Rinner + 30` 으로 옮기면 8 글자가 더는 안 들어가는데 어떤 테스트도 붉어지지 않는다. "짝" 은 주석으로만 묶여 있다.
**Fix:** 띠 오프셋 두 개(18·8)를 `lib/wheelLabel.ts` 의 export 상수로 올리고(순수 숫자라 가능), spec 에서 `(bandLength − 18) / 11.1 ≥ 8` 같은 부등식으로 상한을 유도한다. `Wheel.tsx` 는 그 상수를 읽는다.

### IN-06: 휠 SVG 가 접근성 트리에 잘린 이름과 뒤집힌 순서를 그대로 내보낸다

**File:** `components/Wheel.tsx:114` (`<svg>`), `246-256`
**Issue:** 옛 코드도 `<title>`·aria 가 없었지만 그때는 모든 라벨이 "번호 이름" 순서에 전체 이름이었다. 지금은 왼쪽 반원 라벨이 DOM 에서 "이름 번호" 순서고 이름은 "돈돌 부대찌개…" 로 잘려 있다. 스크린 리더는 SVG `<text>` 를 정적 텍스트로 읽으므로 같은 후보를 목록에서 한 번, 휠에서 잘린 채 다른 순서로 한 번 더 듣는다.
**Fix:** 휠은 `CandidateList` 의 시각적 복제이므로 `<svg aria-hidden="true">` 로 트리에서 뺀다(허브의 추첨 시각은 `ResultBlock`·부제에 있다). 당첨 결과를 읽어 줘야 하면 `ResultBlock` 쪽이 이미 그 역할이다.

### IN-07: 플랜 9번(CLAUDE.md 의 `lib/wheelLabel.ts` 한 줄)이 커밋에 없다

**File:** `.planning/quick/002-wheel-labels-copy/002-PLAN.md:41`, `CLAUDE.md` 엔트리포인트 절
**Issue:** 플랜은 CLAUDE.md 갱신을 작업 9 로 두었는데 `git show 6ec1744 --stat` 에 CLAUDE.md 가 없다. CLAUDE.md 의 위험 표 `components/Wheel.tsx` 행은 회전 각도만 말하고 라벨 좌표계(뒤집기 규칙이 `lib/wheelLabel.ts` 로 내려간 것)를 모른다.
**Fix:** 엔트리포인트 목록에 `lib/wheelLabel.ts` 한 줄(순수 · `normalizeDeg`/`isLabelFlipped`/`fitWheelLabel` · 상한 8/14 의 근거는 띠 길이) 을 넣고, 위험 표 Wheel 행에 "라벨은 별도 `<g>` 에서 `rotation` 으로 다시 계산한다 — 회전 `<g>` 안으로 옮기면 배지가 함께 돈다" 를 덧붙인다.

---

_Reviewed: 2026-09-30T02:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
