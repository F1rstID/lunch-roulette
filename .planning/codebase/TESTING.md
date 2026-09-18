# Testing Patterns

**Analysis Date:** 2026-09-18

## 현재 상태: 자동화 테스트 없음

**이 레포에는 테스트 인프라가 전혀 없다.** 추정이 아니라 확인된 사실이다:

| 항목 | 상태 | 확인 방법 |
|---|---|---|
| `test` npm 스크립트 | 없음 | `package.json` scripts = `dev`, `build`, `start`, `lint` 뿐 |
| 테스트 러너 (vitest/jest) | 미설치 | `node_modules`에 `vitest`·`jest` 없음 |
| 테스팅 라이브러리 | 미설치 | `@testing-library/*` 없음 |
| E2E (playwright/cypress) | 미설치 | 해당 패키지 없음 |
| 러너 설정 파일 | 없음 | `vitest.config.*`·`jest.config.*` 없음 |
| 테스트 파일 | 0건 | `*.test.*`·`*.spec.*`·`__tests__/` 검색 결과 없음 |
| 커버리지 | 없음 | `coverage/` 디렉터리 없음 (`.gitignore:15`에 항목만 존재) |
| CI 파이프라인 | 없음 | `.github/` 디렉터리 자체가 없음 |
| pre-commit 훅 | 없음 | husky·lint-staged 미설치 |

`.gitignore:14-15`의 `# testing` / `/coverage` 두 줄은 `create-next-app` 기본 템플릿의 잔재이며, 테스트가 있었던 흔적이 아니다.

**vitest 도입이 계획돼 있다.** `components/MenuList.tsx`의 `parseMenuInput`에 대한 스크래치 유닛 테스트가 레포 **밖에** 존재하지만 커밋되지 않았다. 아래 "테스트 가능한 seam"과 "도입 시 제약"이 그 작업의 출발점이다.

## 현재 쓰이는 검증 수단

테스트 대신 이 세 가지로 회귀를 막는다. 커밋 전에 돌린다.

```bash
npx tsc --noEmit   # 타입체크. strict: true. 2026-09-18 기준 에러 0
npm run lint       # eslint 9 flat config + react-hooks 7.1.1. 에러·경고 0
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 빌드 자체가 실패
```

**이 수단들이 커버하지 못하는 범위 — 여기가 실제 위험 지대다:**
- `supabase/functions/**`는 `tsconfig.json` `exclude`와 `eslint.config.mjs` `globalIgnores` **양쪽에서 제외**된다. Edge Function은 타입체크도 lint도 받지 않는다. `spin-roulette`·`respin-roulette`를 고치면 배포해서 직접 확인하는 수밖에 없다.
- `design/**`도 같은 이유로 제외(빌드 대상 아님, 시각 참조용).
- SQL 마이그레이션(`supabase/migrations/*.sql`)은 어떤 도구도 검사하지 않는다. 적용해 봐야 안다.
- 런타임 동작 — realtime 구독 분기, 페이즈 전환, 휠 회전 상태 머신 — 은 전부 수동 확인 대상이다.

## 수동 검증 흐름

현재 기능 검증은 브라우저에서 한다.

```bash
npm run dev   # http://localhost:3000
```

**주의:** `npm run dev`가 메모리를 폭주시키며 죽은 전례가 있다. 원인은 stale Turbopack 영속 캐시(`.next/dev/cache`)로 규명·수리됐다. 재발하면 `rm -rf .next` 후 재기동한다. 증폭 요인 완화용으로 `NEXT_DISABLE_MEM_OVERRIDE=1`을 줄 수 있다. 상세는 `CLAUDE.md`.

시간에 묶인 동작(11:55 추첨, 자정 리셋)은 실시간으로 기다릴 수 없으므로, 실제로는 Supabase 대시보드에서 `results` 행을 직접 조작하거나 Edge Function을 수동 invoke 해서 확인한다. **이것이 자동화 테스트가 가장 아쉬운 지점이다** — `lib/phase.ts`와 `lib/time.ts`는 인자로 시각을 주입받도록 설계돼 있어서(아래 참조) 유닛 테스트로 즉시 커버된다.

## 테스트 가능한 seam

**이 코드베이스는 순수 함수 비중이 높아 유닛 테스트 도입 비용이 낮다.** 아래가 I/O 없이 바로 테스트 가능한 대상이다.

### 이미 export 되어 바로 테스트 가능

| 함수 | 파일 | 왜 테스트 가치가 있나 |
|---|---|---|
| `parseMenuInput(input, existing)` | `components/MenuList.tsx:31` | 쉼표 분리(반각 `,` + 전각 `，`), trim, 빈 항목 제거, 24자 절단, 입력 내 중복 제거, 기존 메뉴 제외 — 분기가 6개. 코드에 **"순수 함수라 I/O 없이 테스트 가능"** 주석이 명시돼 있다(`:30`) |
| `currentPhase(now)` | `lib/phase.ts:18` | 경계값 3개(11:54:59 / 11:55:00 / 11:55:05). `now: Date` 주입 가능 |
| `msToNextPhase(now)` | `lib/phase.ts:29` | 자정 롤오버 계산. **현재 참조 0건인 미사용 코드** — 테스트를 쓸지 지울지 먼저 결정할 것 |
| `todayKstDate(now)` | `lib/time.ts:10` | 타임존 경계(UTC 15:00 = KST 익일 00:00)에서 날짜 키가 넘어가는지 |
| `formatHhMm` / `formatHhMmSs` | `lib/time.ts:15,20` | 24시간제 포맷 |
| `kstParts(now)` | `lib/time.ts:30` | `hour % 24` 보정(자정을 24시로 주는 로케일 대응), weekday 매핑 |
| `formatKstLongDay(now)` | `lib/time.ts:68` | 한글 요일 문자열 |

**핵심:** `lib/time.ts`와 `lib/phase.ts`의 모든 export는 `now: Date = new Date()`를 기본 인자로 받는다. 고정 `Date`를 넘기면 시스템 시계를 조작하지 않고도 결정적으로 테스트된다. 페이크 타이머가 필요 없다.

```ts
// 주입 seam 예시 — 프로덕션 호출부는 인자를 생략하지만 테스트는 고정 시각을 준다
currentPhase(new Date("2026-09-18T02:54:59Z")); // KST 11:54:59 → "accepting"
currentPhase(new Date("2026-09-18T02:55:00Z")); // KST 11:55:00 → "spinning"
```

### 순수하지만 export 되지 않은 함수

테스트하려면 `export`를 붙여야 한다. `parseMenuInput`이 이미 그 선례다(컴포넌트 파일에서 순수 헬퍼만 골라 export).

| 함수 | 파일 | 내용 |
|---|---|---|
| `buildRanking(results)` | `components/RankingView.tsx:13` | 집계 + 동점 시 최근 당첨일 역순 정렬 + share 비율 |
| `buildMonthGrid(year, month)` | `components/CalendarLog.tsx:17` | 42칸 달력 그리드. 연말연초 롤오버 분기 다수 |
| `pad2` / `fmtDate` | `components/CalendarLog.tsx:10,13` | 사소함. 굳이 테스트할 필요 없음 |
| `spinJitter(winnerIndex, sliceDeg)` | `components/Wheel.tsx:25` | 황금비 기반 **결정적** 지터. 난수가 아니라서 테스트 가능하고, ±30% 범위 보장이 계약이다 |
| `polar` / `arcPath` | `components/Wheel.tsx:30,35` | SVG 기하. large-arc 플래그 경계(180°) |

### Edge Function 내부 헬퍼

`kstNow()`, `isAfterSpinTime()`, `pickRandom()`이 `supabase/functions/*/index.ts`에 있지만 **export 되지 않고, Deno 런타임이며, tsconfig/eslint에서 제외**돼 있다. Next.js 쪽 vitest로는 그대로 불러올 수 없다. `kstNow()`는 두 함수에 복붙돼 있어 드리프트 위험이 가장 큰 코드인데도 검증 수단이 없다.

## 테스트하기 어려운 영역

자동화 도입 시 우선순위를 판단하려면 비용도 같이 봐야 한다.

- **Realtime 구독 핸들러** (`app/page.tsx:57-125`, `app/log/page.tsx:52-75`, `app/rank/page.tsx:35-59`) — supabase 채널 mocking이 필요하다. `app/page.tsx`는 6개 이벤트(menus INSERT/DELETE, results INSERT/UPDATE, pinned_menus INSERT/DELETE) 분기 + `initialLoadedRef`로 초기 로드와 실시간을 구분한다. 순서를 바꾸면 휠이 두 번 돈다.
- **1초 `setInterval` 리렌더** — 3개 페이지 전부(`app/page.tsx:19-22` 등). 컴포넌트 테스트를 쓴다면 페이크 타이머가 필수다.
- **`Wheel` 회전 상태 머신** (`components/Wheel.tsx`) — CSS transition 기반이라 jsdom에서 시각적 결과를 검증할 수 없다. 검증 가능한 것은 `rotation` 계산식뿐이고, 그건 `spinJitter`를 export 하면 커버된다.
- **pg_cron 스케줄** — UTC/KST 환산(`'55 2 * * *'` = KST 11:55)이 맞는지는 Postgres에 적용해야 알 수 있다.

## vitest 도입 시 따라야 할 제약

계획된 vitest 도입이 이 레포의 기존 결정과 충돌하지 않으려면 아래를 지켜야 한다.

**1. lint/tsc 제외 경계를 건드리지 말 것.**
`design/**`과 `supabase/functions/**`는 인덱서 OOM 전례 때문에 `tsconfig.json`, `eslint.config.mjs`, `.vscode/settings.json`, `app/globals.css`의 Tailwind `@source` **네 곳에서** 제외돼 있다. vitest 설정에도 동일한 제외를 넣어야 한다. 테스트 러너가 `design/`의 큰 inline SVG jsx와 PNG를 스캔하면 같은 문제가 재발한다.

**2. 테스트 파일도 `tsconfig.json` `include`에 잡힌다.**
`include`가 `**/*.ts`, `**/*.tsx`라 `*.test.ts`를 어디에 두든 `npx tsc --noEmit` 대상이 된다. vitest 전역(`describe`/`it`/`expect`)을 쓰려면 타입 참조가 필요하고, 아니면 `import { describe, it, expect } from "vitest"`로 명시 import 해야 한다. **명시 import 쪽이 이 레포의 "barrel·전역 없음" 성향과 맞는다.**

**3. eslint가 테스트 파일도 검사한다.**
`eslint.config.mjs`의 `globalIgnores`에 테스트 경로가 없으므로 `npm run lint` 대상이다. 테스트 코드도 기존 컨벤션(큰따옴표, 세미콜론, `type` alias, `any` 금지)을 따라야 한다.

**4. 환경변수 없이 import 되지 않는 모듈이 있다.**
`lib/supabase/client.ts:5-6`은 모듈 로드 시점에 `process.env.NEXT_PUBLIC_SUPABASE_URL!`을 읽어 `createClient`를 호출한다. 이 모듈을 (직접이든 간접이든) import 하는 테스트는 환경변수가 없으면 깨진다. **순수 함수만 테스트하면 이 문제를 피할 수 있다** — `lib/time.ts`·`lib/phase.ts`·`lib/colors.ts`는 supabase에 의존하지 않는다. `components/MenuList.tsx`는 `MENU_NAME_MAX_LEN`을 가져오느라 `lib/supabase/client.ts`에 의존하므로, `parseMenuInput` 테스트는 stub이나 `.env.test`가 필요하다.

**5. 파일 위치·명명은 기존 규약에 맞춘다.**
컴포넌트는 `파일명 = 컴포넌트명`, barrel 파일 없음, import는 `@/*` 별칭. 테스트도 `@/lib/time` 형태로 import 하려면 vitest에 동일한 alias 해석을 설정해야 한다(`tsconfig.json` `paths`의 `@/*` → 레포 루트).

**6. `package.json`에 `test` 스크립트를 추가하고 `CLAUDE.md`의 "검증 명령"·"테스트 인프라 없음" 문장을 함께 갱신해야 한다.** 그러지 않으면 문서가 즉시 거짓이 된다.

## 권장 도입 순서

비용 대비 회귀 방지 효과 순:

1. **`lib/time.ts` + `lib/phase.ts`** — 의존성 0, 시각 주입 seam이 이미 있음, 타임존·경계 버그가 가장 비싼 영역(추첨 시각·날짜 키가 여기서 나온다). 환경변수 문제도 없다.
2. **`parseMenuInput`** — 이미 export 돼 있고 분기가 많다. 스크래치 테스트가 이미 존재하므로 커밋만 하면 된다. 단 위 4번(환경변수) 처리 필요.
3. **`buildRanking` / `buildMonthGrid` export 후 테스트** — 연말연초 롤오버와 동점 정렬은 눈으로 잡기 어려운 버그다.
4. 그 다음에야 컴포넌트/realtime 테스트를 고민한다. mocking 비용이 급격히 올라가므로 먼저 이득을 확인하고 진행한다.

## Coverage

**측정하지 않는다.** 커버리지 도구·임계값·리포트가 없다. 도입한다면 위 seam 기준으로 `lib/`부터 목표를 잡는 편이 현실적이다 — 전체 라인 커버리지 목표는 `components/`의 대부분이 JSX 마크업이라 의미가 없다.

---

*Testing analysis: 2026-09-18*
