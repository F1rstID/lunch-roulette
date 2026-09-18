<!-- refreshed: 2026-09-18 -->
# Architecture

**Analysis Date:** 2026-09-18

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│          Browser (Next.js App Router · 전부 "use client")     │
├──────────────────┬──────────────────┬───────────────────────┤
│   오늘 (today)    │    기록 (log)     │     랭킹 (rank)        │
│  `app/page.tsx`  │`app/log/page.tsx`│  `app/rank/page.tsx`   │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│  프레젠테이션 컴포넌트 (상태 없음 · props in / ~Action out)      │
│  `components/` — Wheel · MenuList · CalendarLog ·            │
│                 RankingView · ResultBlock · TopBar ·         │
│                 PhaseTimeline                                │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  도메인 헬퍼 (순수 함수 + 싱글턴 클라이언트)                     │
│  `lib/time.ts` KST · `lib/phase.ts` 페이즈 ·                  │
│  `lib/colors.ts` 팔레트 · `lib/supabase/client.ts` DB 타입     │
└────────┬────────────────────────────────────────────────────┘
         │ supabase-js (anon key · RLS)
         │ SELECT / INSERT / DELETE + Realtime postgres_changes
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (Postgres)                       │
│  menus · pinned_menus · results                              │
│  `supabase/migrations/0001~0004`                             │
└────────▲──────────────────────────────────▲─────────────────┘
         │ service_role INSERT/UPSERT       │ service_role
         │                                  │
┌────────┴──────────────────┐   ┌───────────┴──────────────────┐
│ `supabase/functions/      │   │ `supabase/functions/         │
│  spin-roulette` (Deno)    │   │  respin-roulette` (Deno)     │
│  시간 가드 + 멱등 INSERT     │   │  가드 없음 · upsert(date)     │
└────────▲──────────────────┘   └───────────▲──────────────────┘
         │ net.http_post                    │ functions.invoke
┌────────┴──────────────────┐               │ (브라우저 → CORS)
│ pg_cron                   │               │
│ spin-lunch-roulette 55 2 *│───────────────┘
│ reset-menus       0 15 *  │ (truncate menus + pinned 재시드)
│ `0002_cron.sql`/`0004_…`  │
└───────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `TodayPage` | 오늘 탭 오케스트레이터. menus/results/pinned 초기 로드, realtime 구독, 쓰기 핸들러 4종, 페이즈 해석 | `app/page.tsx` |
| `LogPage` | 캘린더 탭. 3개월 윈도우 results 조회 + realtime 병합, 월 이동 상태 | `app/log/page.tsx` |
| `RankPage` | 랭킹 탭. results 전량 조회 + realtime 병합 | `app/rank/page.tsx` |
| `RootLayout` | 유일한 서버 컴포넌트. `<html lang="ko">` · metadata · `globals.css` 로드 | `app/layout.tsx` |
| `Wheel` | 룰렛 SVG 렌더 + 회전. 각도를 `phase`/`winnerIndex` props에서 **파생**(state 아님) | `components/Wheel.tsx` |
| `MenuList` | 후보 입력 폼 + 목록 + 핀 토글. `parseMenuInput`으로 쉼표 다중 등록 파싱 | `components/MenuList.tsx` |
| `CalendarLog` | 월 격자 생성(`buildMonthGrid`) + 날짜별 결과 표시 | `components/CalendarLog.tsx` |
| `RankingView` | results 집계(`buildRanking`) → 포디움 + 전체 순위 | `components/RankingView.tsx` |
| `ResultBlock` | 페이즈별 결과/카운트다운/확률 배너 | `components/ResultBlock.tsx` |
| `TopBar` | 탭 내비게이션 + 페이즈 뱃지 + 시계 | `components/TopBar.tsx` |
| `PhaseTimeline` | 모집→룰렛→결과→리셋 4단계 진행 표시 | `components/PhaseTimeline.tsx` |
| `supabase` 싱글턴 | 브라우저 supabase-js 인스턴스 + DB row 타입 정의처 | `lib/supabase/client.ts` |
| `currentPhase` | KST 시각 → `accepting`/`spinning`/`decided` | `lib/phase.ts` |
| KST 헬퍼 | 모든 타임존 변환·포맷 단일 창구 | `lib/time.ts` |
| `spin-roulette` | 11:55 자동 추첨. 시간 가드 + 멱등 INSERT | `supabase/functions/spin-roulette/index.ts` |
| `respin-roulette` | 사용자 재추첨. CORS 처리 + `upsert(onConflict: date)` | `supabase/functions/respin-roulette/index.ts` |

## Pattern Overview

**Overall:** BaaS 직결형 씬 클라이언트(thin client) + 서버 권한 분리 스케줄러

애플리케이션 서버 계층이 **없다**. Next.js는 정적 셸을 제공할 뿐이고, 모든 읽기는 브라우저 → Supabase 직접 호출이다. 쓰기는 권한에 따라 두 경로로 갈린다: 익명이 써도 되는 것(`menus`, `pinned_menus`)은 브라우저가 직접, 진실의 원천인 `results`는 반드시 `service_role` Edge Function을 거친다.

**Key Characteristics:**
- **Route Handler·서버 액션·서버 컴포넌트 없음.** `app/layout.tsx` 하나만 서버 컴포넌트이고 3개 페이지 전부 `"use client"`.
- **서버 상태 라이브러리 없음.** TanStack Query 등을 쓰지 않고, 각 페이지가 `useState` + 초기 SELECT + `postgres_changes` 구독으로 로컬 캐시를 직접 관리한다.
- **낙관적 업데이트 없음.** 쓰기는 DB에 보내기만 하고, 화면 반영은 Realtime 이벤트가 돌아올 때 일어난다(`togglePin` 주석에 명시).
- **시간이 도메인의 축.** 페이즈·리셋·추첨이 전부 KST 벽시계 기준이며, 세 페이지 모두 1초 `setInterval`로 `now`를 갱신해 리렌더한다.
- **DB 스키마 타입은 수동 유지.** `supabase gen types` 자동 생성을 쓰지 않는다.

## Layers

**Route / 오케스트레이션 계층:**
- Purpose: 데이터 페치, realtime 구독, 쓰기 핸들러, 페이즈 해석 — 상태를 가진 유일한 계층
- Location: `app/page.tsx`, `app/log/page.tsx`, `app/rank/page.tsx`
- Contains: `useState`/`useEffect`/`useMemo`, supabase-js 호출, `async` 쓰기 함수
- Depends on: `lib/*`, `components/*`, `@supabase/supabase-js`
- Used by: Next.js App Router (파일 기반 라우팅)

**프레젠테이션 계층:**
- Purpose: props를 받아 그리고, 사용자 의도를 `~Action` 콜백으로 되돌려준다
- Location: `components/`
- Contains: named export 함수 컴포넌트, 파일 하단 `satisfies Record<string, CSSProperties>` 스타일 객체, 순수 헬퍼(`parseMenuInput`, `buildMonthGrid`, `buildRanking`)
- Depends on: `lib/phase.ts`(타입), `lib/colors.ts`, `lib/time.ts`, `lib/supabase/client.ts`(타입만)
- Used by: Route 계층. **컴포넌트는 supabase를 직접 호출하지 않는다** (타입만 import)

**도메인 헬퍼 계층:**
- Purpose: 타임존·페이즈·색·DB 접점의 단일 정의처
- Location: `lib/`
- Contains: 순수 함수 + `supabase` 모듈 싱글턴 + row 타입
- Depends on: 브라우저 `Intl` API, `@supabase/supabase-js`
- Used by: 위 두 계층 모두

**서버 실행 계층 (Deno / Postgres):**
- Purpose: `results` 쓰기 독점, 스케줄링, 자정 리셋
- Location: `supabase/functions/`, `supabase/migrations/`
- Contains: `Deno.serve` 핸들러, `cron.schedule` SQL, RLS 정책
- Depends on: `SUPABASE_SERVICE_ROLE_KEY`, pg_cron, pg_net
- Used by: pg_cron(자동), 브라우저 `functions.invoke`(재추첨)
- **주의:** `tsconfig.json`·`eslint.config.mjs`에서 제외돼 있어 타입체크·lint가 돌지 않는다

## Data Flow

### Primary Request Path — 메뉴 추가

1. 사용자가 `"김치찌개, 마라탕"` 입력 후 submit (`components/MenuList.tsx:48` `submit`)
2. `parseMenuInput`이 쉼표 분리 → trim → 24자 절단 → 입력 내 중복 제거 → 기존 메뉴 제외 (`components/MenuList.tsx:31`)
3. `onAddAction(names)` → `addMenus` (`app/page.tsx:147`)
4. 단일 `supabase.from("menus").insert(rows)` — 원자적, 전부 성공 또는 전부 실패 (`app/page.tsx:153`)
5. 실패 시 `setActionError`, 성공 시 `true` 반환 → `MenuList`가 입력창 비움
6. Postgres INSERT → Realtime `postgres_changes` 브로드캐스트
7. 모든 접속 클라이언트의 INSERT 핸들러가 `setMenus`로 병합(id 중복 가드 + `byCreatedAt` 정렬) (`app/page.tsx:70`)

### 자동 추첨 (11:55 KST) — 결과 확정의 정본 경로

1. pg_cron `spin-lunch-roulette`이 UTC `55 2 * * *`에 발화 (`supabase/migrations/0002_cron.sql:18`)
2. `net.http_post`로 `/functions/v1/spin-roulette` 호출 (Authorization 헤더 없음 → `verify_jwt = false` 필수)
3. 가드 1: `isAfterSpinTime` — KST 11:55 이전이면 `{skipped:"before_spin_time"}` (`supabase/functions/spin-roulette/index.ts:51`)
4. 가드 2: 멱등성 — 오늘 `results` 행이 있으면 `{skipped:"already_decided"}` (`…/spin-roulette/index.ts:64`)
5. `menus` 전량 SELECT → 비어 있으면 `{skipped:"no_candidates"}`
6. `crypto.getRandomValues` 기반 `pickRandom`으로 당첨 선정, 후보 스냅샷을 `candidates` jsonb로 동봉 (`…/spin-roulette/index.ts:97`)
7. `results` INSERT. 동시 호출로 `23505`(unique date) 나면 `{skipped:"race_already_decided"}`로 정상 처리 (`…/spin-roulette/index.ts:108`)
8. Realtime INSERT → `applyResult` → `setTodayResult` + `forceSpin` 5초 → `Wheel`이 `spinning` → `decided` (`app/page.tsx:59`)

### 다시 돌리기 (사용자 트리거)

1. `decided` 상태에서만 노출되는 버튼 → `respin()` (`app/page.tsx:191`)
2. `supabase.functions.invoke("respin-roulette")` — anon publishable key 사용
3. 브라우저가 OPTIONS 프리플라이트 전송 → 함수가 **본문 로직 실행 없이** 즉시 단락 (`supabase/functions/respin-roulette/index.ts:65`). 이 단락이 없으면 프리플라이트가 재추첨을 한 번 더 실행한다
4. 시간 가드·멱등 스킵 없이 `results.upsert({...}, {onConflict:"date"})` (`…/respin-roulette/index.ts:94`)
5. Realtime **UPDATE** 이벤트 → 세 페이지 모두 id 기준으로 행 교체 (`app/page.tsx:93`, `app/log/page.tsx:63`, `app/rank/page.tsx:47`)

### 자정 리셋 (00:00 KST)

1. pg_cron `reset-menus`가 UTC `0 15 * * *`에 발화 (`supabase/migrations/0004_pinned_menus.sql:28`)
2. `truncate table public.menus`
3. `insert into public.menus (name) select name from public.pinned_menus order by created_at` — **고정한 메뉴만** 살아남는다
4. `results`는 손대지 않는다 (영구 보존 → 기록·랭킹 탭의 소스)

**State Management:**
- 전역 스토어 없음. 페이지별 `useState`가 전부이고 페이지 간 공유 상태도 없다(탭 전환 = 전체 재페치).
- 서버와의 동기화는 **초기 SELECT 1회 + realtime 이벤트 누적** 패턴. 폴링·재검증 없음.
- `initialLoadedRef`(`app/page.tsx:35`)가 초기 로드와 실시간 이벤트를 구분한다. 이 가드 덕분에 페이지 진입 시점에 이미 결과가 있어도 휠이 헛돌지 않는다.
- `now`는 1초 tick state. 파생 계산(`winnerIndex` 등)은 `useMemo`로 감싼다.

## Key Abstractions

**Phase (`accepting` | `spinning` | `decided`):**
- Purpose: UI 전체의 모드 스위치. 입력 readOnly, 헤드라인, 뱃지, 타임라인이 전부 여기서 갈린다
- Examples: `lib/phase.ts`, `components/TopBar.tsx`, `components/ResultBlock.tsx`, `components/PhaseTimeline.tsx`
- Pattern: **시각 기반 추정(`phase`)과 사실 기반 확정(`resolvedPhase`)을 구분한다.** `app/page.tsx:140`의 `resolvedPhase = todayResult ? "decided" : phase` — results 행의 존재가 시각보다 우선한다

**Row 타입 (`MenuRow` / `ResultRow` / `PinnedMenuRow`):**
- Purpose: DB 스키마의 TypeScript 표현. 자동 생성이 아닌 **수동 유지**
- Examples: `lib/supabase/client.ts:15-33`
- Pattern: 모든 consumer가 `as ResultRow` 단언으로 supabase 응답을 캐스팅한다. 스키마 변경 시 이 파일 + 두 Edge Function을 함께 고쳐야 한다

**KST 시각 (`lib/time.ts`):**
- Purpose: 클라이언트 로컬 타임존과 무관한 일관된 날짜/시각
- Examples: `todayKstDate`(`"yyyy-mm-dd"`), `kstParts`, `formatHhMmSs`, `formatKstLongDay`
- Pattern: `Intl.DateTimeFormat`의 `timeZone: "Asia/Seoul"`로 계산. 반환한 날짜 문자열은 `results.date`와 그대로 비교한다

**`~Action` 콜백 prop:**
- Purpose: Next.js 클라이언트 경계 직렬화 lint를 통과시키기 위한 명명 규약
- Examples: `onAddAction`, `onRemoveAction`, `onTogglePinAction`, `onChangeMonthAction`, `onSpinCompleteAction`
- Pattern: 콜백 prop은 예외 없이 `Action` 접미사

**인라인 스타일 객체:**
- Purpose: CSS-in-JS 라이브러리 없이 토큰 기반 스타일링
- Examples: 모든 컴포넌트 파일 하단의 `const s = {...} satisfies Record<string, CSSProperties>`
- Pattern: 색·반경·폰트는 `app/globals.css`의 `--bg`/`--ink`/`--accent`/`--line`/`--radius` 토큰만 참조. Tailwind는 설치돼 있지만 `.wrap`/`.card`/`.mono`/`.micro`/`.dot` 같은 전역 유틸 클래스와 `layout.tsx` 정도에만 쓴다

## Entry Points

**Next.js 루트 레이아웃:**
- Location: `app/layout.tsx`
- Triggers: 모든 라우트
- Responsibilities: `globals.css` import, `lang="ko"`, metadata. 유일한 서버 컴포넌트

**3개 페이지 라우트:**
- Location: `app/page.tsx`(`/`), `app/log/page.tsx`(`/log`), `app/rank/page.tsx`(`/rank`)
- Triggers: 브라우저 내비게이션(`TopBar`의 `next/link`)
- Responsibilities: 각 탭의 데이터 로드·구독·렌더

**Edge Function `spin-roulette`:**
- Location: `supabase/functions/spin-roulette/index.ts`
- Triggers: pg_cron → `net.http_post` (UTC 02:55)
- Responsibilities: 오늘의 결과 확정. 시간 가드 + 멱등성 + race 처리

**Edge Function `respin-roulette`:**
- Location: `supabase/functions/respin-roulette/index.ts`
- Triggers: 브라우저 `supabase.functions.invoke`
- Responsibilities: 결과 덮어쓰기 + CORS 프리플라이트 처리

**pg_cron 잡:**
- Location: `supabase/migrations/0002_cron.sql`, `supabase/migrations/0004_pinned_menus.sql`
- Triggers: Postgres 스케줄러
- Responsibilities: 추첨 호출, 자정 truncate + 고정 메뉴 재시드

## Architectural Constraints

- **Threading:** 브라우저 단일 스레드(웹 워커 없음). Edge Function은 요청당 Deno isolate — 함수 간 공유 메모리 없고 모든 상태는 Postgres에 있다.
- **Global state:** `lib/supabase/client.ts:8`의 `supabase` 모듈 싱글턴이 유일. `process.env.NEXT_PUBLIC_SUPABASE_*`를 **모듈 로드 시점에 non-null 단언**으로 읽으므로, env 없이는 `npm run build`가 실패한다(의도된 fail-fast).
- **Circular imports:** 없음. 의존 방향이 `app/ → components/ → lib/`로 단방향이며 `lib/` 내부에서도 `phase.ts → time.ts` 한 방향뿐이다. `components/`는 `app/`을 import하지 않는다.
- **타입 안전망의 경계:** `supabase/functions/**`와 `design/**`은 `tsconfig.json:33` exclude와 `eslint.config.mjs:16-17` globalIgnores에 걸려 있다. **Edge Function 수정 후 `npx tsc --noEmit`·`npm run lint`는 아무것도 잡아주지 않는다** — 배포 전 직접 확인할 것.
- **RLS 전면 개방:** `menus`/`pinned_menus`는 anon이 select·insert·delete 모두 가능(`0001_init.sql:26-28`, `0004_pinned_menus.sql:11-13`). `results`는 anon에게 select 정책만 부여되어 쓰기가 원천 차단된다(`0001_init.sql:31`). 로그인 없는 서비스로서 의도적으로 수용한 설계.
- **추첨 시각 11:55의 4중 중복:** `lib/phase.ts:14-15`(SPIN_HH/MM), `supabase/functions/spin-roulette/index.ts:12-13`(SPIN_HH/MM), `supabase/migrations/0002_cron.sql:20`(`'55 2 * * *'` UTC), UI 문구(`app/page.tsx:340-341`, `components/ResultBlock.tsx:14` 기본값, `components/PhaseTimeline.tsx:10-12`). 시각을 바꾸면 전부 고쳐야 한다.
- **`kstNow()` 중복:** 두 Edge Function에 복붙돼 있다(`spin-roulette/index.ts:17`, `respin-roulette/index.ts:37`). Deno 런타임이라 `lib/time.ts`를 공유할 수 없다.
- **프로젝트 ref 하드코딩:** `supabase/migrations/0002_cron.sql:23`에 `swxiqytyxjlcgubqlozk`가 박혀 있다. 다른 Supabase 프로젝트로 옮기면 치환 필수.
- **`verify_jwt = false`가 필수:** 두 함수 모두 JWT 없이 호출된다(cron은 헤더 없음, 브라우저는 publishable key = JWT 아님). `supabase/config.toml`에 고정돼 있으니 CLI 배포 시 이 파일이 적용되는지 확인할 것 — 기본값 `true`로 배포되면 401로 추첨이 조용히 멈춘다.
- **`design/` 인덱서 OOM:** `design/*.jsx`의 거대한 inline SVG와 `design/screens/*.png` 때문에 tsconfig·eslint·`.vscode/settings.json`·`app/globals.css`의 Tailwind `@source` 네 군데에서 제외돼 있다. 제외를 풀지 말 것.

## Anti-Patterns

### 클라이언트 시각 계산으로 결과 상태를 판정

**What happens:** `currentPhase(now)`가 `decided`를 반환하니 결과가 확정됐다고 가정하고 UI를 그린다.
**Why it's wrong:** `currentPhase`는 **표시용 추정**이다. 후보가 0개여서 추첨이 스킵됐거나 Edge Function이 실패하면 11:55가 지나도 `results` 행이 없다. 반대로 재추첨은 시각과 무관하게 결과를 바꾼다.
**Do this instead:** `app/page.tsx:140`의 `resolvedPhase = todayResult ? "decided" : phase` 패턴을 따라, 결과의 존재 여부를 우선하는 파생값을 만들어 하위 컴포넌트에 내려보낸다.

### 당첨 메뉴를 이름으로 역조회

**What happens:** `winnerIndex = menus.findIndex((m) => m.name === todayResult.menu)` (`app/page.tsx:129`).
**Why it's wrong:** `results`는 당첨 **이름 문자열**만 저장하고 `menus.id`를 참조하지 않는다(`candidates`도 `{name}[]` 스냅샷). 당첨 메뉴가 삭제되면 `-1`이 되어 휠 하이라이트가 사라지고, 동명 메뉴가 있으면 첫 번째가 잡힌다.
**Do this instead:** 새 기능에서 결과와 메뉴를 잇는다면 이름 매칭의 한계를 전제로 `-1`/미스매치 분기를 항상 처리한다. 스키마를 바꾼다면 `results`에 menu id를 추가하고 `lib/supabase/client.ts`의 `ResultRow` + 두 Edge Function을 함께 고쳐야 한다.

### 비즈니스 로직에서 `Date`의 로컬 메서드 사용

**What happens:** `new Date().getHours()`, `toISOString().slice(0,10)` 등으로 "오늘"을 계산한다.
**Why it's wrong:** 사용자의 브라우저 타임존에 따라 날짜 키가 달라져 `results.date`와 어긋난다. 서버는 항상 KST로 판단한다.
**Do this instead:** `lib/time.ts`의 `todayKstDate`/`kstParts`만 쓴다. 예외는 `components/CalendarLog.tsx:18-21`의 `buildMonthGrid` — 여기서 쓰는 `new Date(year, month-1, 1)`은 "지금"을 읽는 게 아니라 주어진 연/월의 격자를 계산하는 순수 달력 산술이므로 허용된다.

### 브라우저에서 `results`에 직접 쓰기

**What happens:** `supabase.from("results").insert(...)`를 클라이언트에서 호출한다.
**Why it's wrong:** `0001_init.sql`은 `results`에 select 정책만 만들었다. RLS가 조용히 거부하고, 애초에 "서버만이 결과를 확정한다"는 이 앱의 핵심 불변식이 깨진다.
**Do this instead:** 결과를 바꾸는 로직은 Edge Function에 두고 `supabase.functions.invoke`로 호출한다 (`app/page.tsx:195` 참고). 새 함수를 만들면 CORS 헤더와 OPTIONS 단락을 `respin-roulette`에서 그대로 가져올 것.

### 콜백 prop을 `onX`로 명명

**What happens:** `<MenuList onAdd={...} />`처럼 평범한 React 관례로 짓는다.
**Why it's wrong:** Next.js 클라이언트 경계 직렬화 lint가 잡는다.
**Do this instead:** `onAddAction`, `onChangeMonthAction`처럼 `Action` 접미사를 붙인다 (`components/MenuList.tsx:16-21`, `components/CalendarLog.tsx` Props 참고).

### effect에서 setState로 애니메이션 상태 관리

**What happens:** `useEffect`로 회전 각도를 계산해 `setRotation`한다.
**Why it's wrong:** `react-hooks/set-state-in-effect`에 걸리고, 실제로도 props의 파생값이라 state로 둘 이유가 없다.
**Do this instead:** `components/Wheel.tsx:58-64`처럼 `phase`/`winnerIndex`에서 각도를 직접 파생하고 CSS transition에 전환을 맡긴다. 랜덤이 필요하면 `Math.random()` 대신 입력값에서 결정적으로 만든다(`spinJitter`의 황금비 분산, `components/Wheel.tsx:25`).

## Error Handling

**Strategy:** 클라이언트는 사용자 행동(쓰기)의 실패만 표면화하고, Edge Function은 HTTP 상태 + 구조화 JSON으로 답한다. 예외를 던지는 코드는 없고 `try/catch`도 `respin`의 `finally`(`app/page.tsx:206`) 한 곳뿐이다.

**Patterns:**
- **쓰기 실패 → 단일 배너.** 네 핸들러(`addMenus`/`removeMenu`/`togglePin`/`respin`)가 supabase `error`를 확인해 `setActionError(한국어 메시지)`를 호출하고, 성공하면 `setActionError(null)`로 지운다. 배너는 `role="alert"`로 렌더된다 (`app/page.tsx:236-248`).
- **실패 시 입력 보존.** `onAddAction`은 `boolean`을 반환하고 `MenuList`는 `false`면 입력창을 비우지 않아 사용자가 즉시 재시도할 수 있다 (`components/MenuList.tsx:57`).
- **Edge Function 응답 3분기:** `{ok:true, ...}` / `{skipped:"사유"}` / `{error:"메시지"}` + 5xx. 클라이언트는 `RespinResponse` 타입(`app/page.tsx:15`)으로 받아 `skipped`도 사용자에게 알린다.
- **race를 정상 경로로 처리.** `spin-roulette`은 unique 위반 `23505`를 에러가 아니라 `{skipped:"race_already_decided"}`로 응답한다 (`supabase/functions/spin-roulette/index.ts:108`).
- **읽기 실패는 조용히 무시.** 세 페이지의 초기 SELECT는 `data`만 확인하고 `error`를 보지 않는다 (`app/page.tsx:47-49`, `app/log/page.tsx:44`, `app/rank/page.tsx:28`). 로드 실패 시 빈 화면이 된다.

## Cross-Cutting Concerns

**Logging:** 구조화 로깅 없음. 클라이언트는 `console` 호출조차 없고, Edge Function은 Supabase 대시보드의 함수 로그(HTTP 응답 본문)에만 의존한다.

**Validation:** 3중.
1. 입력 단계 — `components/MenuList.tsx`의 `INPUT_MAX_LEN = 120`(입력창), `parseMenuInput`의 trim/빈값/중복 제거.
2. 도메인 상수 — `MENU_NAME_MAX_LEN = 24` (`lib/supabase/client.ts:13`). 항목별 절단에 쓰이며 `app/page.tsx:149`에서 방어적으로 한 번 더 적용한다.
3. DB 제약 — `check (char_length(name) between 1 and 24)` (`0001_init.sql:4`, `0004_pinned_menus.sql:5`), `results.date` unique. **DB 제약이 최종 방어선이고, `MENU_NAME_MAX_LEN`은 그 미러다 — 둘을 함께 바꿔야 한다.**

**Authentication:** 없음. 완전 익명 서비스이며 RLS 정책이 "누구나"로 열려 있다. 인증 대신 **쓰기 대상 테이블 분리**(anon: `menus`/`pinned_menus`, service_role: `results`)로 무결성을 지킨다. `respin-roulette`에는 레이트리밋도 없다 — 익명 사내 도구로서 수용한 트레이드오프.

**Realtime 구독:** 페이지마다 고유 채널명을 쓴다 — `"lunch-realtime"`(`app/page.tsx:69`), `"log-results"`(`app/log/page.tsx:54`), `"rank-results"`(`app/rank/page.tsx:37`). 세 페이지 모두 cleanup에서 `supabase.removeChannel(ch)`를 호출한다. `results`는 세 페이지 모두 INSERT와 UPDATE를 함께 구독해 재추첨이 즉시 반영된다.

---

*Architecture analysis: 2026-09-18*
