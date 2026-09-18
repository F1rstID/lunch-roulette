# Technology Stack

**Analysis Date:** 2026-09-18

## Languages

**Primary:**
- TypeScript 5.9.3 (`strict: true`) — 앱 코드 전부. `app/`, `components/`, `lib/` 및 `supabase/functions/`
  - 브라우저 타깃 코드: `app/page.tsx`, `app/log/page.tsx`, `app/rank/page.tsx`, `components/*.tsx`, `lib/*.ts`
  - Deno 타깃 코드: `supabase/functions/spin-roulette/index.ts`, `supabase/functions/respin-roulette/index.ts` — **`tsconfig.json`·`eslint.config.mjs`에서 제외돼 타입체크·lint가 돌지 않는다**

**Secondary:**
- SQL (PostgreSQL 방언) — 스키마·RLS·pg_cron 잡. `supabase/migrations/0001_init.sql` ~ `0004_pinned_menus.sql`
- CSS — 디자인 토큰 + Tailwind v4 진입점. `app/globals.css` (158줄). 컴포넌트 스타일은 CSS 파일이 아니라 TSX 안의 inline style 객체에 있다
- JSX (빌드 제외) — `design/*.jsx`. Babel standalone CDN으로 브라우저에서 직접 도는 시각 참조용 프로토타입, **빌드 대상 아님**
- TOML — Supabase CLI 설정. `supabase/config.toml`

## Runtime

**Environment:**
- Node.js v25.6.1 (로컬 확인값). `package.json`에 `engines` 필드 없음, `.nvmrc`/`.node-version`/`.tool-versions` 없음 — **Node 버전이 어디에도 고정돼 있지 않다**
- Deno (Supabase Edge Runtime) — Edge Function 2개 전용. 버전은 Supabase 플랫폼이 관리, 레포에 고정값 없음
- 브라우저 — 앱 전체가 `"use client"` 컴포넌트라 실질 런타임은 브라우저. 서버 컴포넌트·Route Handler·서버 액션 없음

**Package Manager:**
- npm 11.9.0
- Lockfile: `package-lock.json` 존재 (lockfileVersion 3, 커밋됨)
- `packageManager` 필드 없음

## Frameworks

**Core:**
- Next.js 16.2.6 (App Router) — `app/` 디렉토리 라우팅. 라우트 3개: `/`(`app/page.tsx`), `/log`(`app/log/page.tsx`), `/rank`(`app/rank/page.tsx`)
  - **주의:** `AGENTS.md`가 명시하듯 이 버전은 학습 데이터와 API·컨벤션이 다를 수 있다. 코드 작성 전 `node_modules/next/dist/docs/`(`01-app/`, `03-architecture/`)의 해당 가이드를 읽을 것
  - Turbopack root를 명시 고정: `next.config.ts`의 `turbopack.root = path.resolve(__dirname)`
- React 19.2.4 / React DOM 19.2.4 — 훅 기반. `useState`/`useEffect`/`useMemo`/`useRef`만 쓰고 상태관리 라이브러리 없음
  - React Compiler lint(`preserve-manual-memoization`)가 동작 중 — `app/page.tsx:142` 주석이 async 핸들러를 `useCallback`으로 감싸지 않는 이유를 설명한다
- Tailwind CSS 4.3.0 — 설치돼 있지만 유틸리티 클래스는 `app/layout.tsx`의 `className="min-h-screen flex flex-col"` 정도만 쓴다. 실제 스타일링은 inline style 객체 + CSS 변수

**Testing:**
- **없음.** 테스트 러너·`test` 스크립트·테스트 파일·커버리지 설정 전부 부재

**Build/Dev:**
- Turbopack (Next.js 내장) — `npm run dev`, `npm run build`
- PostCSS + `@tailwindcss/postcss` 4.3.0 — `postcss.config.mjs`의 유일한 플러그인
- ESLint 9.39.4 + `eslint-config-next` 16.2.6 — `eslint.config.mjs` (flat config, `defineConfig`/`globalIgnores` 사용)
- Supabase CLI v2.117.0 (`supabase/.temp/cli-latest` 기록값) — 마이그레이션·Edge Function 배포용. devDependency가 아니라 외부 설치 도구

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.106.0 — DB 쿼리 + Realtime + Edge Function invoke를 모두 담당하는 **유일한 런타임 의존성**(next/react 제외). 하위 패키지 `@supabase/realtime-js`, `@supabase/postgrest-js`도 2.106.0
  - 브라우저 클라이언트 단일 인스턴스: `lib/supabase/client.ts`. `realtime.params.eventsPerSecond = 10`으로 생성
  - Edge Function 쪽은 npm이 아니라 JSR로 별도 로드: `jsr:@supabase/supabase-js@2`

**Infrastructure:**
- 별도 인프라 패키지 없음. 의존성 트리가 극도로 얇다 — `dependencies`는 `@supabase/supabase-js`, `next`, `react`, `react-dom` 4개뿐
- 날짜/시간 라이브러리 없음 — KST 변환은 `Intl.DateTimeFormat`만으로 직접 구현 (`lib/time.ts`)
- UUID·난수 라이브러리 없음 — `crypto.getRandomValues` (Edge Function), `gen_random_uuid()` (Postgres)

**Dev-only:**
- `@types/node` ^20 (설치된 Node는 v25 — 타입 정의가 런타임보다 훨씬 낮다), `@types/react` ^19, `@types/react-dom` ^19, `typescript` ^5

## Configuration

**Environment:**
- 클라이언트 전용 공개 변수 2개만 사용. 참조처는 `lib/supabase/client.ts:5-6` 한 곳
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 템플릿: `.env.example` (빈 값 2줄, 커밋됨). 로컬 값: `.env.local` (존재, `.gitignore`의 `.env*` 규칙으로 제외 — **값은 문서화하지 않는다**)
- 두 변수 모두 `!` non-null assertion으로 읽으므로 미설정 시 런타임에서야 깨진다. 단 `npm run build`는 변수 없으면 실패한다
- Edge Function 측 변수(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)는 Supabase 플랫폼이 자동 주입 — 레포에 정의처 없음

**Build:**
- `next.config.ts` — Turbopack root만 설정
- `tsconfig.json` — `target: ES2017`, `moduleResolution: bundler`, `strict`, path alias `@/* → ./*`, `plugins: [{ name: "next" }]`
  - `exclude`: `node_modules`, `supabase/functions/**`, `design/**`
- `postcss.config.mjs` — Tailwind PostCSS 플러그인
- `eslint.config.mjs` — `globalIgnores`에 `design/**`, `supabase/functions/**` 추가
- `app/globals.css` — Tailwind v4 `@source` 디렉티브로 스캔 범위를 `app/**`, `components/**`로 수동 축소
- `supabase/config.toml` — `project_id = "lunch_roulette"`(로컬 CLI 네임스페이스). `[functions.spin-roulette]`·`[functions.respin-roulette]` 모두 `verify_jwt = false` 고정
- `.vscode/settings.json` — watcher/search/tsserver/eslint/tailwind 5개 채널 모두에서 `design/**`·`supabase/functions/**` 제외

**제외 설정은 풀지 말 것:** `design/`(큰 inline SVG jsx + PNG)과 `supabase/functions/`(Deno)를 인덱서가 스캔하면 메모리가 폭주한 전례가 있다. `tsconfig.json`, `eslint.config.mjs`, `.vscode/settings.json`, `app/globals.css`의 `@source` — 네 곳이 한 세트다.

## Platform Requirements

**Development:**
- Node.js + npm (버전 고정 없음 — 현재 v25.6.1/11.9.0에서 동작 확인)
- `.env.local`에 Supabase URL/anon key 필요
- Supabase CLI (원격 배포 시). 연결된 프로젝트 ref는 `supabase/.temp/linked-project.json`에 기록되며 이 디렉토리는 gitignore 대상
- Edge Function 수정 시 Deno 툴체인이 로컬에 없으면 타입 검증 수단이 전혀 없다 — 배포 후 실제 호출로 확인해야 한다
- **dev 서버가 크래시하면 `rm -rf .next`** (stale Turbopack 영속 캐시가 원인으로 규명됨). 완화 플래그: `NEXT_DISABLE_MEM_OVERRIDE=1`

**Production:**
- Vercel (Next.js 앱, 무료 티어). `vercel.json`·`.vercel/` 없음 — 전부 Vercel 대시보드 설정에 의존
- Supabase (Postgres + Realtime + Edge Functions + pg_cron, 무료 티어, region `ap-northeast-2`)
- 소스: GitHub `F1rstID/lunch-roulette`

## 검증 명령

```bash
npx tsc --noEmit   # 타입 (supabase/functions/, design/ 는 제외돼 검사 안 됨)
npm run lint       # eslint 9 flat config
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 실패
```

CI 파이프라인 없음 (`.github/` 부재) — 위 명령은 전부 수동 실행이다.

---

*Stack analysis: 2026-09-18*
