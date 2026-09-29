# Coding Conventions

**Analysis Date:** 2026-09-18

정본은 `CLAUDE.md`의 "코드 컨벤션" 절이다. 이 문서는 그 규칙을 실제 코드에서 검증하고, 예외·경계 사례를 파일 경로와 함께 기록한다.

> 검증 결과: `npx tsc --noEmit` 통과(에러 0), `npm run lint` 통과(에러·경고 0). `CLAUDE.md`에 적힌 "`components/Wheel.tsx` `react-hooks/set-state-in-effect` 에러 1건"은 **해소된 상태**다 — `Wheel.tsx`는 회전 각도를 state가 아니라 props 파생값으로 계산한다(`components/Wheel.tsx:55-63`).

## Naming Patterns

**Files:**
- 컴포넌트 파일은 PascalCase, **파일명 = export 하는 컴포넌트명**: `components/Wheel.tsx` → `Wheel`, `components/CalendarLog.tsx` → `CalendarLog`. 예외 없음(7개 파일 전부).
- `lib/` 모듈은 소문자 단수 명사: `lib/time.ts`, `lib/phase.ts`, `lib/colors.ts`, `lib/settings.ts`, `lib/supabase/client.ts`.
- **예외 1종: 공용 훅은 `lib/useX.ts` 로 `use` 접두를 붙인다** — `lib/useSettings.ts`(레포 첫 공용 훅), `lib/useRestaurants.ts`(Phase 5). 같은 도메인의 순수 모듈(`lib/settings.ts`·`lib/restaurants.ts`)과 훅을 파일명으로 가르는 것이 규칙의 목적이므로 소문자 단수 명사로 되돌리지 말 것.
- 페이지는 App Router 규약대로 `app/page.tsx`, `app/restaurants/page.tsx`, `app/log/page.tsx`, `app/rank/page.tsx`.
- 마이그레이션은 `supabase/migrations/000N_설명.sql` (4자리 zero-pad + snake_case 영문 설명): `0001_init.sql`, `0002_cron.sql`, `0003_reseed_menus.sql`, `0004_pinned_menus.sql`.
- Edge Function은 kebab-case 디렉터리 + `index.ts`: `supabase/functions/spin-roulette/index.ts`, `supabase/functions/respin-roulette/index.ts`.

**Functions:**
- camelCase. 컴포넌트만 PascalCase.
- 순수 헬퍼는 동사 접두어로 의도를 드러낸다: `buildMonthGrid`(`components/CalendarLog.tsx:17`), `buildRanking`(`components/RankingView.tsx:13`), `parseMenuInput`(`components/MenuList.tsx:31`), `spinJitter`/`arcPath`/`polar`(`components/Wheel.tsx:25,30,35`).
- 포맷터는 `format~` 접두어: `formatHhMm`, `formatHhMmSs`, `formatKstLongDay` (`lib/time.ts`).
- 로컬 축약 헬퍼 허용: `pad2`, `fmtDate` (`components/CalendarLog.tsx:10,13`).

**Variables:**
- camelCase. 모듈 스코프 상수는 SCREAMING_SNAKE_CASE: `SPIN_ANIM_SEC`(`lib/phase.ts:18`), `DEFAULT_SPIN_TIME`/`DEFAULT_SPIN_TIME_TEXT`(`supabase/functions/_shared/spinTime.ts:9-11` — 추첨 시각의 코드상 정의처), `DEFAULT_SETTINGS`/`INITIAL_SETTINGS_STATE`(`lib/settings.ts:28,42`), `SPIN_TURNS`/`SPIN_MS`/`SPIN_EASING`(`components/Wheel.tsx:19-21`), `MENU_NAME_MAX_LEN`/`RESTAURANT_MENUS_MAX`/`RESTAURANT_LOCATION_MAX_LEN`(`lib/constants.ts` — Phase 1 이 `lib/supabase/client.ts` 에서 옮겼다), `INPUT_MAX_LEN`(`components/MenuList.tsx:32`), `MENUS_INPUT_MAX_LEN`/`MENU_CHIP_LIMIT`(`components/RestaurantList.tsx:23,27`), `SLICE_COLORS`(`lib/colors.ts:2`), `KST_TZ`(`lib/time.ts:4`), `WEEKDAYS`/`STEPS`.
- ref는 `~Ref` 접미어: `initialLoadedRef`(`app/page.tsx:35`), `inputRef`(`components/MenuList.tsx:45`).
- DB 컬럼에서 온 값은 snake_case를 그대로 쓴다(변환하지 않음): `created_at`, `spun_at`, `candidate_count`.

**Types:**
- **`interface`를 쓰지 않는다.** 전부 `type` alias다(레포 전체 `interface` 0건).
- DB 행 타입은 `~Row` 접미어: `MenuRow`, `ResultRow`, `PinnedMenuRow` (`lib/supabase/client.ts:15,21,30`).
- 컴포넌트 props 타입은 파일 내부에서 `type Props = {...}` 로 고정 명명하고 export 하지 않는다(`components/MenuList.tsx:10`, `components/TopBar.tsx:9`, `components/Wheel.tsx:11`, `components/PhaseTimeline.tsx:6`, `components/ResultBlock.tsx:6`, `components/CalendarLog.tsx:43`).
- props가 1~2개로 단순하면 타입 선언 없이 인라인으로 쓴다: `export function RankingView({ results }: { results: ResultRow[] })` (`components/RankingView.tsx:28`).
- 상태 유니온은 리터럴 유니온 타입: `Phase = "accepting" | "spinning" | "decided" | "stalled"`(`lib/phase.ts:16`), `WheelPhase = "idle" | "spinning" | "decided"`(`components/Wheel.tsx:7`), `Tab = "today" | "restaurants" | "log" | "rank"`(`components/TopBar.tsx:7` — 나열 순서가 탭 표시 순서다).

## Code Style

**Formatting:**
- **전용 포매터 없음.** Prettier·Biome·EditorConfig 설정 파일이 레포에 존재하지 않는다. 포맷은 손으로 맞춘다.
- 사실상의 규칙(코드에서 일관되게 관찰됨): 2-space 들여쓰기, 큰따옴표(`"`), 세미콜론 필수, 후행 쉼표 사용, 줄 길이 대략 100자.
- 상수 테이블은 가독성을 위해 정렬 공백을 허용한다: `lib/colors.ts:2-15`, `app/globals.css:13-30`의 토큰 정의.

**Linting:**
- ESLint 9 flat config, 파일은 `eslint.config.mjs`. 실행은 `npm run lint` (= `eslint`, 인자 없음).
- 구성: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` (eslint-config-next 16.2.6, `eslint-plugin-react-hooks` 7.1.1 포함).
- **React Compiler 계열 hooks 규칙이 켜져 있고 실제로 코드 모양을 결정한다.** 이 규칙들을 회피하려고 내려진 설계 결정이 여러 곳에 있다:
  - `react-hooks/purity` → 렌더 중 `Math.random()` 금지. `components/Wheel.tsx:25-28`의 `spinJitter`는 난수 대신 당첨 index에 황금비를 곱한 **결정적 지터**를 쓴다.
  - `react-hooks/set-state-in-effect` → effect에서 setState 금지. `components/Wheel.tsx:55-63`은 회전 각도를 state+effect가 아니라 `phase` 파생값으로 계산한다.
  - `react-hooks/preserve-manual-memoization` → async 핸들러를 `useCallback`으로 감싸면 에러. 그래서 `app/page.tsx`의 쓰기 핸들러 4개(`addMenus`, `removeMenu`, `togglePin`, `respin`)는 **의도적으로 memo 하지 않는다**. 근거 주석이 `app/page.tsx:142-144`에 있다.
- `globalIgnores`로 `design/**` 와 **함수 디렉터리 2개**(`supabase/functions/spin-roulette/**`, `supabase/functions/respin-roulette/**`)를 제외한다(`eslint.config.mjs:9-21`). 근거가 서로 다르다: `design/**` 은 인덱서 OOM 방지라 **풀지 말 것**이고, 함수 2개는 Deno 전역(`Deno.serve`)·`jsr:` import 때문이다. `supabase/functions/_shared/**` 는 import 를 하나도 하지 않는 순수 TS 라 **제외 대상이 아니다** — 린트를 받는다. 이 제외를 `supabase/functions/**` 로 다시 넓히지 말 것(Phase 3 이 좁혔다).

**TypeScript:**
- `tsconfig.json`: `strict: true`, `noEmit: true`, `isolatedModules: true`, `moduleResolution: "bundler"`, target ES2017.
- `exclude`에 `design/**` 와 함수 디렉터리 2개(`supabase/functions/spin-roulette/**`, `supabase/functions/respin-roulette/**`)(`tsconfig.json:33`). → **두 `index.ts` 본문만 타입체크가 돌지 않는다**(수정 후 직접 확인). `supabase/functions/_shared/**` 는 tsc·eslint·vitest 3중 검사를 받고, `lib/` 이 `@/supabase/functions/_shared/*` 로 같은 파일을 **확장자 없이** 가져온다(`.ts` 를 붙이면 `TS5097`).
- **`any` 사용 0건.** 타입이 불확실한 지점은 `as` 단언으로 좁힌다(아래 Realtime 패턴 참조).

## Import Organization

관찰된 순서(`app/page.tsx:1-12`, `app/log/page.tsx:1-9`가 표준형):

1. `"use client";` 지시자 (해당되면 맨 위, 다음 줄 공백)
2. React / Next 코어 — `import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"`, `import Link from "next/link"`
3. 외부 패키지 타입·값 — `import type { RealtimeChannel } from "@supabase/supabase-js"`
4. `@/lib/*` — `@/lib/supabase/client` → `@/lib/time` → `@/lib/phase` → `@/lib/colors`
5. `@/components/*` — 페이지에서 쓰는 순서대로

그룹 사이에 빈 줄을 넣지 않는다. import 블록은 한 덩어리고, 그 아래에 빈 줄 하나 두고 코드가 시작된다.

**Path Aliases:**
- `@/*` → 레포 루트 (`tsconfig.json` `paths`). **상대 경로 `../`를 쓰지 않는다.** 예외 3종(전부 같은 디렉터리 형제 모듈이거나 Deno 제약): `lib/phase.ts:13`의 `from "./time"`, `supabase/functions/_shared/*.test.ts`의 `from "./kst"`, 그리고 두 Edge Function 의 `from "../_shared/kst.ts"` — **Deno 만 확장자를 요구한다**(tsc 는 거부하므로 `lib/` 쪽은 확장자 없이 쓴다).

**Type-only imports:**
- `isolatedModules: true`라 타입은 반드시 `type` 키워드로 표시한다.
- 값과 타입을 함께 가져올 땐 인라인 modifier: `import { supabase, MENU_NAME_MAX_LEN, type MenuRow, type ResultRow } from "@/lib/supabase/client"` (`app/page.tsx:5`).
- 타입만 가져오면 `import type { ... }` (`components/ResultBlock.tsx:3-4`).
- `React.ReactNode`·`React.FormEvent`가 필요한 파일만 `import * as React from "react"`를 추가한다(`components/MenuList.tsx:3`, `components/CalendarLog.tsx:3`, `components/Wheel.tsx:3`).

## Styling

**이 레포는 inline style 객체 + CSS 변수로 통일돼 있다. Tailwind 유틸리티 클래스를 새로 쓰지 않는다.**

- 컴포넌트마다 **파일 하단**에 스타일 객체를 선언한다:
  ```ts
  const s = {
    card: { width: "100%", display: "flex", flexDirection: "column" },
    header: { padding: "18px 20px 14px", borderBottom: "1px solid var(--line)" },
  } satisfies Record<string, CSSProperties>;
  ```
  레포 전체 14개 블록이 이 형태다. `satisfies`를 쓰는 이유: 객체 리터럴의 키 자동완성을 유지하면서 `CSSProperties` 적합성만 검사받기 위함.
- **명명 규칙:** 파일에 스타일 블록이 하나면 `s`. 페이지처럼 여러 덩어리가 필요하면 도메인 접두어를 붙인다 — `pageHeadStyles`, `layoutStyles`, `stageStyles`, `respinStyles`, `alertStyles`, `footerStyles` (`app/page.tsx:347-464`), `head` (`app/log/page.tsx:114`, `components/RankingView.tsx:208`).
- **예외 1건:** `components/Wheel.tsx:308`의 `const outer: CSSProperties = {...}` — 단일 스타일이라 Record 래핑 없이 직접 annotate. 스타일이 하나뿐일 때만 허용되는 형태.
- **동적 스타일은 spread로 합성한다.** 조건부 값은 호출부에서 덮어쓴다:
  ```tsx
  style={{ ...s.input, background: readOnly ? "var(--bg-soft)" : "white" }}
  ```
  (`components/MenuList.tsx:88-92`, `components/TopBar.tsx:76-80`, `components/PhaseTimeline.tsx:25-34`)
- **색·폰트·반경·그림자는 `app/globals.css`의 CSS 변수 토큰만 쓴다:** `--bg`, `--bg-soft`, `--panel`, `--ink`, `--ink-soft`, `--muted`, `--line`, `--line-soft`, `--accent`, `--accent-ink`, `--accent-soft`, `--green`, `--red`, `--radius`, `--radius-lg`, `--shadow-sm`, `--shadow-md`, `--font-sans`, `--font-mono`. 토큰 정의는 `app/globals.css:13-30`.
- 토큰으로 표현 못 하는 일회성 색은 `oklch(...)` 리터럴을 직접 쓴다(`components/Wheel.tsx`의 SVG 스트로크들). 프로젝트 전체가 hex가 아니라 **oklch 색 공간**을 쓴다.
- 전역 클래스는 `app/globals.css`에 정의된 소수만 쓴다: `.wrap`(앱 셸), `.card`, `.mono`, `.micro`, `.divider`, `.dot`(+ `.live`/`.spin`/`.done`). `className={`dot ${phaseInfo.dot}`}` 형태로 조합(`components/TopBar.tsx:49`).
- 애니메이션은 `app/globals.css`의 `@keyframes`(`fade-up`, `pop-in`, `pulse`, `wheel-spin-final`, `wheel-idle-drift`)를 inline `animation` 속성에서 참조: `animation: "fade-up .2s ease-out both"` (`components/MenuList.tsx:262`).
- Tailwind 유틸리티는 `app/layout.tsx:13`의 `className="min-h-screen flex flex-col"` 한 줄에서만 쓴다. 새 코드는 inline style을 따른다.

## Component Conventions

**Client/Server 경계:**
- `app/layout.tsx`가 **유일한 서버 컴포넌트**다(`"use client"` 없음, `metadata` export). 나머지 페이지 4개와 컴포넌트 9개는 전부 `"use client"`.
- Route Handler(`app/api/`), Server Action(`"use server"`), 서버 컴포넌트 데이터 페칭 **전부 없다.** 데이터 접근은 클라이언트 컴포넌트 안에서 supabase-js를 직접 호출한다.
- 쓰기 권한이 필요한 로직(= `results` 테이블 쓰기)은 Edge Function으로 보낸다. `results`는 RLS상 service_role만 쓸 수 있다(`supabase/migrations/0001_init.sql:29-31`).

**Export:**
- 페이지는 `export default function XxxPage()` (App Router 요구).
- 컴포넌트는 **named export**: `export function MenuList(...)`.
- barrel 파일(`index.ts` 재export) 없음. 항상 실제 모듈 경로로 import 한다.

**파일 내부 배치 순서:**
1. `"use client"` → imports
2. 모듈 상수 (`const INPUT_MAX_LEN = 120;`)
3. 순수 헬퍼 함수 (`parseMenuInput`, `buildMonthGrid`, `polar`, `arcPath`)
4. `type Props`
5. export 하는 메인 컴포넌트
6. 파일 전용 하위 컴포넌트 (`PinButton`, `TabLink`, `PodiumCard`, `RankRow`, `DetailView`, `DetailRow`, `StageHeader`, `Footer`, `Pointer`)
7. 스타일 객체

**하위 컴포넌트:**
- 한 곳에서만 쓰는 소형 컴포넌트는 별도 파일로 빼지 않고 **같은 파일 안에 두고 export 하지 않는다.** 페이지 전용도 마찬가지 — `StageHeader`/`Footer`는 `app/page.tsx:296,316`에 산다.

**콜백 prop 이름:**
- **경계를 넘는(export 된) 컴포넌트의 콜백 prop은 `~Action` 접미어를 붙인다.** Next.js 클라이언트 경계 직렬화 lint를 통과시키기 위한 규약이다. `onX`로 지으면 lint가 잡는다.
  - `onAddAction`, `onRemoveAction`, `onTogglePinAction` (`components/MenuList.tsx:15-21`)
  - `onChangeMonthAction` (`components/CalendarLog.tsx:48`)
  - `onSpinCompleteAction` (`components/Wheel.tsx:15`) — 현재 참조 0건(미사용)
- **예외: 파일 내부 전용 컴포넌트는 그냥 `onX`를 쓴다.** 경계를 넘지 않으므로 lint 대상이 아니다 — `PinButton`의 `onToggle`(`components/MenuList.tsx:167`).
- 콜백 타입은 동기/비동기 양쪽을 허용하게 선언한다: `(names: string[]) => boolean | Promise<boolean>`, `(id: string, name: string) => void | Promise<void>`.

**메모이제이션:**
- 4개 페이지 전부 1초 `setInterval`로 `now`를 갱신해 리렌더한다(`app/page.tsx:27`, `app/restaurants/page.tsx:18`, `app/log/page.tsx:17`, `app/rank/page.tsx:17`). **매초 전체 리렌더가 일어나므로 비싼 파생 계산은 `useMemo`로 감싼다** — `winnerIndex`(`app/page.tsx:152`), `logMap`(`app/log/page.tsx:93`), `buildRanking`(`components/RankingView.tsx:29`), `sortRestaurants`(`app/restaurants/page.tsx`).
- 반대로 **핸들러는 `useCallback`으로 감싸지 않는다.** 소비자가 memo 컴포넌트가 아니라 이득이 없고, React Compiler lint가 async 핸들러의 수동 memo를 막는다. 근거가 `app/page.tsx:142-144`에 주석으로 남아 있다.
- `React.memo` 사용 0건.

## Time Handling

- **KST 변환은 전부 `lib/time.ts`를 경유한다.** 비즈니스 로직에서 `Date`의 로컬 메서드(`getHours` 등)를 직접 쓰지 않는다.
- `lib/time.ts`는 `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })`로 구현한다. `en-CA` 로케일이 `yyyy-mm-dd`를 내주기 때문. 오프셋 산술을 직접 하지 않는다.
- **`lib/time.ts`의 포맷터는 `now: Date = new Date()`를 기본 인자로 받는다**(`lib/time.ts:17,22,31`). 호출부는 보통 생략하지만 테스트에서 고정 시각을 주입할 수 있다 — 의도된 seam이다.
- **예외 2곳(기본 인자를 일부러 버렸다):** `currentPhase(now, spinTime, hasResult)`(`lib/phase.ts:22`)와 `kstParts(now)`(`supabase/functions/_shared/kst.ts`)는 시각을 **반드시 주입받는다**. 기본값을 두면 설정(`settings.spin_time`)에서 온 추첨 시각이 다시 모듈 안에 숨고, `decided` 를 결정하는 것이 결과 행의 존재라는 사실도 시그니처에서 사라진다.
- 날짜 키는 `"yyyy-mm-dd"` KST 문자열이고 `results.date`와 문자열 그대로 비교한다(`app/page.tsx:60`, `app/log/page.tsx:84`).
- **허용된 예외 1곳:** `components/CalendarLog.tsx:18-21,222`는 `new Date(year, month-1, 1).getDay()` 등 로컬 `Date` 메서드로 달력 그리드를 만든다. 명시적 y/m/d 숫자로부터 요일·일수를 계산하는 순수 캘린더 산술이고 "현재 시각"에 의존하지 않으므로 타임존 버그가 나지 않는다. **"지금"을 다루는 코드는 반드시 `lib/time.ts`로.**
- 추첨 시각의 **코드상 정의처는 한 곳**이다: `supabase/functions/_shared/spinTime.ts:9-11`의 `DEFAULT_SPIN_TIME`/`DEFAULT_SPIN_TIME_TEXT`. 런타임 값은 `settings.spin_time`(대시보드 편집)이 이기고, 세 페이지는 `useSettings()` → `currentPhase(now, settings.spinTime, …)` 로 그 값을 받는다. 남은 중복 2갈래: 화면 하드코딩 문구(`components/Wheel.tsx`, `components/ResultBlock.tsx:13` 기본 prop `"11:55"`, `app/page.tsx`의 `phaseSubhead`) — **Phase 6 / SPIN-06 소관**, 그리고 DB 쪽 기본값(`supabase/migrations/0002_cron.sql`의 `'55 2 * * *'`, `0005`의 `spin_time` 기본값).

## Data Access

- 브라우저 클라이언트는 `lib/supabase/client.ts`의 싱글턴 `supabase` 하나만 쓴다. 컴포넌트에서 `createClient`를 다시 호출하지 않는다.
- DB 타입은 자동 생성이 아니라 **`lib/supabase/client.ts`에서 수동 유지**한다. 스키마를 바꾸면 여기와 두 Edge Function을 함께 고쳐야 한다.
- 초기 로드는 `useEffect` + 즉시 실행 async IIFE + `cancelled` 플래그 패턴:
  ```ts
  useEffect(() => {
    let cancelled = false;
    (async () => { /* ... */ if (cancelled) return; /* setState */ })();
    return () => { cancelled = true; };
  }, [dep]);
  ```
  (`app/page.tsx:37-55`, `app/log/page.tsx:30-49`, `app/rank/page.tsx:21-33`). 병렬 쿼리는 `Promise.all`로 묶는다(`app/page.tsx:41-45`).
- Realtime 구독은 별도 `useEffect`에서 `supabase.channel(name).on("postgres_changes", {...}).subscribe()`, cleanup에서 `supabase.removeChannel(ch)`. 채널 토픽은 **구독 인스턴스마다** 고유 — 페이지 채널 3개(`"lunch-realtime"`, `"log-results"`, `"rank-results"`)는 이름으로, 공용 훅 2개는 카운터로(`lib/useSettings.ts` → `settings-changes-<n>`, `lib/useRestaurants.ts` → `restaurants-<n>`). 같은 토픽을 두 마운트가 쓰면 라우트 전환 시 realtime-js 가 leave 중인 옛 인스턴스를 돌려줘 새 구독이 조용히 죽는다.
- Realtime payload는 제네릭이라 **행 타입으로 단언한다**: `payload.new as ResultRow`. DELETE는 부분 행만 오므로 `payload.old as Partial<MenuRow>`로 받고 키 존재를 확인한 뒤 쓴다(`app/page.tsx:84-85,110-111`).
- 상태 갱신은 항상 함수형 업데이터 + 멱등 처리. INSERT 이벤트는 중복 삽입을 막는다: `prev.some((m) => m.id === row.id) ? prev : [...prev, row]` (`app/page.tsx:75-77`, `app/log/page.tsx:60`).
- **낙관적 업데이트를 하지 않는다.** 쓰기는 supabase에 보내고, 화면 갱신은 realtime 이벤트가 돌아올 때 일어난다. 근거 주석: `app/page.tsx:172-173`.

## Error Handling

**클라이언트 쓰기 — 확인하고 사용자에게 보여준다:**
```ts
const { error } = await supabase.from("menus").insert(rows);
if (error) {
  setActionError(`메뉴 ${label} 추가 실패: ${error.message}`);
  return false;
}
setActionError(null);
return true;
```
- `app/page.tsx:32`의 `actionError` state 한 곳에 모으고, `role="alert"` 배너로 렌더하며 닫기 버튼을 둔다(`app/page.tsx:236-248`).
- 성공 경로에서 반드시 `setActionError(null)`로 지운다.
- 메시지는 한글 + 실패한 대상 이름 + `error.message`. 형식: `` `메뉴 "${name}" 삭제 실패: ${error.message}` ``.
- 쓰기 핸들러는 UI가 입력을 지울지 판단할 수 있게 **성공 여부를 반환**한다(`addMenus(): Promise<boolean>`). 실패하면 `components/MenuList.tsx:57-60`이 입력값을 보존해 바로 재시도할 수 있게 한다.
- 진행 중 상태는 별도 state로 잠근다: `respinning`(`app/page.tsx:30`) → 버튼 `disabled` + 라벨 교체.
- Edge Function 호출은 전송 에러(`error`)와 **업무적 스킵(`data.skipped`)을 따로 분기**한다(`app/page.tsx:195-205`). 스킵 코드는 한글로 번역해 보여준다(`"no_candidates"` → `"후보가 없어요"`).

**클라이언트 읽기 — 에러를 확인하지 않는다(현재 상태):**
```ts
const { data } = await supabase.from("results").select("*")...;
if (!cancelled && data) setResults(data as ResultRow[]);
```
- `app/page.tsx:41-49`, `app/log/page.tsx:38-44`, `app/rank/page.tsx:24-28` 전부 `error`를 구조분해하지 않는다. 읽기 실패는 조용히 빈 상태로 남는다. **새 읽기 코드를 추가할 때 이 패턴을 그대로 복제하지 말고, 쓰기 쪽의 `actionError` 패턴을 따르는 것이 바람직하다.**

**Edge Function — JSON 봉투로 응답한다:**
- 성공: `{ ok: true, date, menu, candidate_count }`
- 업무적 스킵(HTTP 200): `{ skipped: "before_spin_time" | "already_decided" | "no_candidates" | "race_already_decided", ... }`
- 실패(HTTP 500): `{ error: message }`
- 응답 타입은 클라이언트 쪽에 `type RespinResponse = { ok?: boolean; skipped?: string; error?: string }`로 손으로 맞춰 둔다(`app/page.tsx:15`). Edge Function 응답 모양을 바꾸면 여기도 고쳐야 한다.
- 예외를 던지지 않는다. 모든 분기가 `Response`를 반환한다.
- 동시성 충돌은 에러가 아니라 정상 시나리오로 처리한다: unique 위반 코드 `23505`를 잡아 `skipped: "race_already_decided"`로 200 응답(`supabase/functions/spin-roulette/index.ts:106-113`).
- `respin-roulette`는 CORS가 필수라 모든 응답을 `json()` 헬퍼로 감싸 `Access-Control-*` 헤더를 붙이고, `OPTIONS` 프리플라이트를 **본문 로직 실행 전에 즉시 단락**시킨다(`supabase/functions/respin-roulette/index.ts:28-33,64-67`). 프리플라이트가 재추첨을 실행하는 사고를 막기 위한 구조다.

## Logging

- **로깅 프레임워크 없음. `console.*` 호출도 0건이다.**
- 사용자에게 보여야 하는 실패는 `actionError` 배너로, 서버 쪽 결과는 Edge Function의 JSON 응답 본문으로 드러낸다(Supabase 함수 로그에서 확인).
- 새 코드에서 디버그 로그를 남기고 싶다면 커밋 전에 제거한다 — 레포에 로그가 한 줄도 없는 상태를 유지한다.

## Comments

**When to Comment:**
- **한글로, Why만 쓴다.** 코드가 무엇을 하는지는 적지 않는다.
- **파일 머리에 역할·제약을 블록 주석으로 둔다.** 대표 예:
  - `lib/time.ts:1-2` — "클라이언트의 로컬 타임존과 무관하게 일관된 결과를 반환한다"
  - `lib/phase.ts:1-8` — 페이즈 시간표 + "실제 전환은 서버의 results INSERT가 트리거한다"는 제약
  - `supabase/functions/spin-roulette/index.ts:1-7` — 안전장치 2개와 권한 모델
  - `supabase/functions/respin-roulette/index.ts:1-16` — CORS가 왜 필요하고 OPTIONS를 왜 단락시켜야 하는지(가장 좋은 예시)
- **비직관적 결정에는 근거를 붙인다.** 이 레포는 "왜 이 흔한 방법을 안 썼는가"를 특히 잘 기록한다:
  - `components/Wheel.tsx:23-24` — `Math.random()` 대신 결정적 지터를 쓰는 이유(lint)
  - `components/Wheel.tsx:55-57` — state+effect 대신 파생값을 쓰는 이유
  - `app/page.tsx:142-144` — `useCallback`을 안 쓰는 이유
  - `components/MenuList.tsx:24-25` — `INPUT_MAX_LEN`(120)이 `MENU_NAME_MAX_LEN`(24)과 다른 이유 + 과거 버그
  - `supabase/migrations/0004_pinned_menus.sql:1-3` — 핀 상태를 별도 테이블로 둔 이유(menus는 매일 truncate)
- 값이 다른 곳과 반드시 같아야 하면 주석으로 연결한다: `lib/supabase/client.ts:12` — "DB check 제약(char_length 1~24)과 동일. 여기서만 정의한다".
- **JSDoc/TSDoc:** `lib/time.ts`·`lib/phase.ts`의 export 함수에만 한 줄 `/** ... */`로 **반환 형식 예시**를 적는다(`/** "yyyy-mm-dd" (KST 기준) */`, `/** "2026년 5월 19일 화요일" */`). `@param`·`@returns` 태그는 쓰지 않는다. 컴포넌트에는 JSDoc을 달지 않는다.
- props 설명은 JSDoc이 아니라 `type Props` 안의 필드 위 한 줄 주석으로 단다(`components/MenuList.tsx:13-21`).

## Function Design

**Size:** 순수 헬퍼는 5~30줄. 컴포넌트는 JSX 때문에 길어질 수 있으나(최대 `components/CalendarLog.tsx` 406줄) 로직 자체는 얇다 — 계산은 파일 상단의 순수 함수로 밀어낸다.

**Parameters:**
- 컴포넌트는 props 객체를 시그니처에서 구조분해하고, 기본값도 거기서 준다: `{ active, candidateCount = 0, phase, clockTime }` (`components/TopBar.tsx:16`), `size = 460`(`components/Wheel.tsx:47`), `spinTime = "11:55"`(`components/ResultBlock.tsx:13`).
- 헬퍼는 위치 인자를 쓴다. 시간 함수는 마지막에 `now: Date = new Date()` 기본 인자를 둔다.
- 표시용 정보가 필요하면 호출부가 다시 조회하지 않게 인자로 넘긴다: `onRemoveAction(id, name)` — name은 실패 메시지용(근거 주석 `components/MenuList.tsx:16`).

**Return Values:**
- 쓰기 핸들러는 `Promise<boolean>`(성공 여부) 또는 `Promise<void>`.
- "없음"은 `null`로 표현한다(`ResultRow | null`, `best: {...} | null`). 인덱스 미발견은 `-1`(`winnerIndex`).
- 조기 반환을 선호한다 — `components/ResultBlock.tsx`는 페이즈별로 `if (...) return <JSX/>` 4개를 나열하고 마지막에 `return null`.
- 복잡한 일회성 계산은 즉시 실행 함수로 감싸 값으로 만든다: `const phaseInfo = (() => { ... })()` (`components/TopBar.tsx:17-21`, `components/CalendarLog.tsx:57-67`).

## Module Design

**Exports:** 모듈 최상위에서 필요한 것만 named export 한다. 기본 export는 페이지·layout뿐.

**Barrel Files:** 없다. 만들지 말 것.

**순수 로직의 위치:** 렌더와 무관한 계산은 컴포넌트 밖 모듈 스코프 함수로 뺀다. 재사용되면 `lib/`로 승격한다(`lib/time.ts`, `lib/phase.ts`, `lib/colors.ts`가 그 결과). 한 화면에서만 쓰이면 컴포넌트 파일 상단에 둔다(`buildRanking`, `buildMonthGrid`).

## SQL / Migration Conventions

- 파일명 `supabase/migrations/000N_설명.sql`. 번호는 4자리, 설명은 snake_case 영문.
- **재실행 가능하게 쓴다.** cron 잡은 "기존 잡 unschedule → 재등록" 패턴을 쓴다:
  ```sql
  do $$
  declare jid bigint;
  begin
    for jid in select jobid from cron.job where jobname = 'reset-menus'
    loop perform cron.unschedule(jid); end loop;
  end $$;

  select cron.schedule('reset-menus', '0 15 * * *', $cmd$ ... $cmd$);
  ```
  (`supabase/migrations/0002_cron.sql:6-16`, `0003_reseed_menus.sql:5-13`, `0004_pinned_menus.sql:24-28`). 확장 설치는 `create extension if not exists`.
- **cron 표현식에는 항상 KST↔UTC 환산 주석을 붙인다:** `'0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일)`. cron은 UTC로 돌기 때문에 이 주석이 없으면 매번 오독한다.
- 새 테이블은 같은 마이그레이션에서 RLS를 켜고 정책까지 만든다. 정책 이름은 `테이블_동작`: `menus_read`, `menus_insert`, `menus_delete`, `results_read`, `pinned_read`, `pinned_insert`, `pinned_delete`.
- Realtime이 필요하면 `alter publication supabase_realtime add table public.X;`를 같은 파일에 넣는다.
- 뒤 마이그레이션이 앞 마이그레이션의 동작을 교체할 땐 **무엇을 왜 바꾸는지 주석으로 명시한다**(`0004_pinned_menus.sql:21-23`: "0003의 '어제 후보 전체' → '고정 메뉴만'").
- 전부 소문자 SQL 키워드. 식별자는 `public.` 스키마 명시.

## Edge Function Conventions

- Deno 런타임. import는 `jsr:` 스킴만 쓰고, **런타임 의존은 버전을 핀한다**(로컬 `deno check` 가 보는 버전과 배포가 받는 버전을 맞추기 위해. 타입 전용 `edge-runtime.d.ts` 는 공식 문서 형태 그대로 둔다):
  ```ts
  import "jsr:@supabase/functions-js/edge-runtime.d.ts";
  import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
  ```
- 진입점은 `Deno.serve(async (req) => {...})`. 파일은 `supabase/functions/<name>/index.ts` 하나로 자족한다.
- **`deno check`(`npm run check:edge`)가 두 `index.ts` 의 타입을 검사한다**(`--config supabase/functions/deno.json`, `_shared/*.ts` 까지 전이 검사). `tsconfig.json`·`eslint.config.mjs` 의 제외는 **함수 디렉터리 2개뿐**이고 `_shared/**` 는 포함된다 — 즉 **eslint 는 여전히 두 `index.ts` 를 보지 않는다.** 남는 사각지대는 동작이고, 실호출 확인은 컷오버(Phase 8) 전까지 불가능하다.
- `lib/`는 Deno 에서 import 할 수 없다(경로 별칭·확장자 규칙이 다르다). 공통 로직은 `supabase/functions/_shared/{kst,spinTime,cooldown}.ts` **한 곳**에 있고 두 함수가 `../_shared/<name>.ts`(확장자 포함)로 같은 파일을 본다. 각 `index.ts` 에 남는 중복은 행 타입 선언뿐이다 — **한쪽이 늘면 양쪽을 함께 고친다.**
- 난수는 `Math.random()`이 아니라 `crypto.getRandomValues(new Uint32Array(1))`를 쓴다(`pickRandom`, 두 파일 공통).
- 권한은 `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!`로 service_role 클라이언트를 만든다. 환경변수는 Supabase가 주입한다(레포에 값 없음).
- 배포 플래그 `verify_jwt = false`는 `supabase/config.toml`에 고정돼 있다(두 함수 모두). 이유가 같은 파일에 주석으로 적혀 있다 — 기본값(true)으로 배포되면 401로 추첨이 조용히 멈춘다.

## Accessibility

- 아이콘·기호 버튼에는 `aria-label`을 반드시 단다: `aria-label="삭제"`, `aria-label="닫기"`, `aria-label="이전 달"`/`"다음 달"`, `aria-label={pinned ? "고정 해제" : "고정"}`.
- 토글 버튼은 `aria-pressed`를 함께 준다(`components/MenuList.tsx:172`).
- 장식 요소는 `aria-hidden`(`components/TopBar.tsx:27`, `components/Wheel.tsx:270`).
- 에러 배너는 `role="alert"`(`app/page.tsx:237`).
- 버튼에는 `type`을 명시한다(`type="button"` / `type="submit"`).
- 문서 언어는 `<html lang="ko">`(`app/layout.tsx:12`).

## Verification Commands

```bash
npx tsc --noEmit   # 타입체크 (design·함수 디렉터리 2개 제외. _shared 는 포함)
npm run lint       # eslint 9 flat config + react-hooks 규칙
npm test           # vitest run (lib·components·_shared·migrations 의 *.test.ts)
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 빌드 자체가 실패
npm run check:edge # deno check 두 index.ts (로컬 deno 설치 전제 — npm ci 로 따라오지 않는다)
```

커밋 전 최소 `npx tsc --noEmit`과 `npm run lint` 둘 다 통과시킨다(현재 둘 다 클린). Edge Function 은 `npm run check:edge` + `_shared/edgeImports.test.ts` 계약이, 마이그레이션은 `supabase/migrations/*.test.ts` 텍스트 계약이 본다 — 남는 것은 **실호출**뿐이고 그건 컷오버(Phase 8)에서만 가능하다.

---

*Convention analysis: 2026-09-18*
