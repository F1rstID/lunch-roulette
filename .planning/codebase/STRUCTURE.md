# Codebase Structure

**Analysis Date:** 2026-09-18

## Directory Layout

```
lunch_roulette/
├── app/                      # Next.js App Router. 라우트 = 디렉토리
│   ├── layout.tsx            # 루트 레이아웃 (유일한 서버 컴포넌트)
│   ├── page.tsx              # "/" 오늘 탭 — 앱의 중심 (464줄)
│   ├── globals.css           # 디자인 토큰 + 전역 유틸 클래스 + Tailwind @source
│   ├── favicon.ico
│   ├── restaurants/page.tsx  # "/restaurants" 매장 탭 — 카탈로그 CRUD + 핀
│   ├── log/page.tsx          # "/log" 캘린더 기록
│   └── rank/page.tsx         # "/rank" 랭킹
├── components/               # 프레젠테이션 컴포넌트 (평면 구조, 하위 폴더 없음)
│   ├── TopBar.tsx            # 탭 내비 + 페이즈 뱃지 + 시계
│   ├── ErrorBanner.tsx       # role="alert" 에러 배너 (message null 이면 렌더 0)
│   ├── RestaurantList.tsx    # 매장 카드 — 등록 폼·인라인 편집·핀·2단계 삭제 확인
│   ├── PhaseTimeline.tsx     # 모집→룰렛→결과→리셋 진행 표시
│   ├── Wheel.tsx             # 룰렛 SVG + 회전
│   ├── CandidateList.tsx     # 오늘 후보 카드 — 이름 필터·단일 목록 행 토글·잠금
│   ├── MenuChips.tsx         # 메뉴 칩 + "+n" 접기 (결과 화면·매장 탭 공용)
│   ├── LocationLink.tsx      # 위치 렌더 — http(s)만 앵커, 그 외 텍스트 (공용)
│   ├── ResultBlock.tsx       # 페이즈별 결과 배너
│   ├── CalendarLog.tsx       # 월 격자 달력
│   └── RankingView.tsx       # 포디움 + 순위표
├── lib/                      # 도메인 헬퍼 (순수 함수 + 싱글턴 + 공용 훅)
│   ├── time.ts               # KST 변환 전부
│   ├── phase.ts              # 시각 → 페이즈
│   ├── colors.ts             # 룰렛 슬라이스 팔레트
│   ├── constants.ts          # 환경변수 없이 import 되는 순수 상수 (길이 상한 3개)
│   ├── errors.ts             # 읽기·쓰기·함수 실패 → 한 줄 한국어 문장 (순수)
│   ├── history.ts            # 전환일 필터·매장 기준 집계·월 격자 (순수, 기록·랭킹 정의처)
│   ├── menus.ts              # 쉼표 파싱·코드포인트 절단 (순수, 정의처)
│   ├── rowset.ts             # 목록 Realtime 병합 규칙 한 벌 (제네릭, 키만 주입)
│   ├── settings.ts           # settings 행 → 앱 도메인 + Realtime 리듀서 (순수)
│   ├── useSettings.ts        # 그 리듀서에 I/O 를 붙인 훅 (추첨 시각·쿨다운 단일 출처)
│   ├── restaurants.ts        # 매장 폼 검증·링크 판정·정렬 + rowset 인스턴스 (순수)
│   ├── useRestaurants.ts     # 매장 목록 SELECT 1회 + 3분기 구독 (읽기 전용 훅)
│   ├── candidates.ts         # 후보 조인·정렬·필터·당첨 인덱스·재회전 판정 (순수)
│   ├── useCandidates.ts      # 오늘 후보 SELECT 1회 + 2분기 구독 (읽기 전용 훅)
│   └── supabase/client.ts    # supabase 싱글턴 + DB row 타입 정의처
├── supabase/                 # 서버 측 (함수 디렉터리 2개만 tsconfig/eslint 제외)
│   ├── rollback/             # 0005 롤백 SQL + 계약 spec (migrations/ 밖 — db push 가 읽지 않게)
│   ├── config.toml           # CLI 설정. verify_jwt=false 고정
│   ├── migrations/           # 0001~0005, 순번 적용 (+ 0005 텍스트 계약 spec)
│   └── functions/            # Deno Edge Functions
│       ├── spin-roulette/index.ts    # 설정 시각 자동 추첨 (매분 cron 호출)
│       └── respin-roulette/index.ts  # 다시 돌리기 (브라우저 호출)
├── design/                   # React CDN 프로토타입 + 스크린샷 — 빌드 대상 아님
│   ├── *.jsx                 # 시각 참조용 (Babel standalone)
│   ├── Lunch Roulette.html   # 디자인 토큰 원본
│   └── screens/*.png         # 17장
├── public/                   # create-next-app 기본 SVG (실사용 없음)
├── .vscode/settings.json     # design/·supabase/functions/ 인덱서 제외
├── next.config.ts            # turbopack.root만 설정
├── tsconfig.json             # @/* → ./*, exclude design/·supabase/functions/
├── eslint.config.mjs         # next core-web-vitals + typescript + globalIgnores
├── postcss.config.mjs        # @tailwindcss/postcss
├── .env.example              # NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY
├── CLAUDE.md                 # 작업 가이드 (정본)
├── AGENTS.md                 # Next.js 버전 주의 지침
└── README.md                 # 인프라·배포·pg_cron 정본
```

## Directory Purposes

**`app/`:**
- Purpose: App Router 라우트 + 페이지 수준 상태 오케스트레이션
- Contains: `page.tsx`(라우트당 1개), `layout.tsx`, `globals.css`
- Key files: `app/page.tsx`(데이터 로드·realtime·쓰기 핸들러 전부), `app/globals.css`(CSS 변수 토큰)
- 특이점: 라우트 그룹·병렬 라우트·`loading.tsx`·`error.tsx`·`route.ts` 없음. 페이지 전용 소형 컴포넌트(`StageHeader`, `Footer`)는 별도 파일로 빼지 않고 `app/page.tsx:296-325`에 그대로 둔다

**`components/`:**
- Purpose: 재사용 프레젠테이션 컴포넌트
- Contains: `PascalCase.tsx` 파일들. 전부 `"use client"`, 전부 named export
- Key files: `components/Wheel.tsx`(가장 복잡), `components/CandidateList.tsx`(유일하게 로컬 입력 state 보유 — 이름 필터)
- 규칙: **supabase를 호출하지 않는다.** `lib/supabase/client.ts`에서 타입만 import하고 데이터는 props로 받는다

**`lib/`:**
- Purpose: 타임존·페이즈·색·DB 접점의 단일 정의처
- Contains: 소문자 `.ts` 파일. `"use client"`는 `lib/supabase/client.ts`에만
- Key files: `lib/time.ts`(모든 KST 변환), `lib/supabase/client.ts`(`ResultRow`/`RestaurantRow`/`CandidateRow`/`SettingsRow`), `lib/constants.ts`(길이 상한 — `MENU_NAME_MAX_LEN` 은 Phase 1 에서 여기로 옮겨졌다)
- 규칙: `lib/`는 `app/`·`components/`를 import하지 않는다 (단방향). **예외 없음** — `grep -rn '@/components/' lib` 가 0줄이다. 쉼표 파싱의 정의처가 `lib/menus.ts` 로 내려오며 마지막 예외가 사라졌다(Phase 6 D-24)

**`supabase/migrations/`:**
- Purpose: 스키마 + RLS + pg_cron 잡 정의
- Contains: `000N_설명.sql` 4개
- Key files: `0001_init.sql`(menus·results·RLS·realtime publication), `0002_cron.sql`(두 잡 등록, **프로젝트 ref 하드코딩**), `0003_reseed_menus.sql`(어제 후보 재시드), `0004_pinned_menus.sql`(pinned_menus 테이블 + 재시드 소스 교체)
- 규칙: cron 등록은 "기존 잡 unschedule → 재등록" `do $$ ... $$` 패턴으로 **재실행 가능하게** 작성한다 (`0003`·`0004`가 표준 예시)

**`supabase/functions/`:**
- Purpose: `results`를 쓸 수 있는 유일한 코드 (service_role)
- Contains: `kebab-case/index.ts`, Deno 런타임, `jsr:` import
- 규칙: `tsconfig.json`·`eslint.config.mjs`에서 **제외돼 있어 타입체크·lint가 돌지 않는다.** 수정 후 배포 전 직접 검증할 것

**`design/`:**
- Purpose: 시각 참조 전용 프로토타입
- Contains: React+Babel CDN `.jsx`, 원본 HTML, PNG 스크린샷 17장
- 규칙: **빌드 대상 아님.** 인덱서 OOM 전례 때문에 `tsconfig.json`·`eslint.config.mjs`·`.vscode/settings.json`·`app/globals.css`의 Tailwind `@source` 네 군데에서 제외돼 있다. **제외를 풀지 말 것.** 컴포넌트를 새로 포팅할 때만 열어본다

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: 루트 레이아웃, metadata, `globals.css` 로드
- `app/page.tsx`: `/` 오늘 탭
- `app/restaurants/page.tsx`: `/restaurants` 매장 탭 (카탈로그 CRUD + 핀, 쓰기 4종이 여기 산다)
- `app/log/page.tsx`: `/log` 기록 탭
- `app/rank/page.tsx`: `/rank` 랭킹 탭
- `supabase/functions/spin-roulette/index.ts`: cron이 호출하는 추첨
- `supabase/functions/respin-roulette/index.ts`: 브라우저가 호출하는 재추첨

**Configuration:**
- `next.config.ts`: `turbopack.root`만 지정
- `tsconfig.json`: `@/*` → `./*` 별칭, `strict: true`, `exclude: ["node_modules", "supabase/functions/**", "design/**"]`
- `eslint.config.mjs`: `design/**`·`supabase/functions/**` globalIgnores
- `postcss.config.mjs`: Tailwind v4 플러그인
- `supabase/config.toml`: `project_id`(로컬 CLI 네임스페이스) + 두 함수 `verify_jwt = false`
- `.env.example`: 필요한 env 2개. 실제 값은 `.env.local`(git 제외)
- `.vscode/settings.json`: 인덱서 제외 규칙

**Core Logic:**
- `lib/supabase/client.ts`: DB 클라이언트 + row 타입
- `lib/time.ts`: `todayKstDate`, `kstParts`, `formatHhMmSs`, `formatKstLongDay`, `formatSpinTime`, `addMinutesToSpinTime`
- `lib/phase.ts`: `currentPhase`, `displayPhase`, `isCandidateListLocked`, `Phase` 타입
- `app/page.tsx`: 초기 로드(오늘 결과 1쿼리) + `results` 2분기 구독 + 회전 가드
- `app/page.tsx`: 쓰기 핸들러 `addCandidate`/`removeCandidate`/`respin`
- `lib/rowset.ts`: `createRowSetReducer`·`initialRowSetState` (목록 병합 규칙 한 벌, 키만 주입)
- `lib/restaurants.ts`: `parseRestaurantForm`·`joinMenus`·`parseLocationLink`·`sortRestaurants`·`restaurantsReducer` (매장 도메인의 모든 판단, 순수)
- `lib/useRestaurants.ts`: 매장 목록 SELECT 1회 + `restaurants-<n>` 토픽 3분기 구독 (판단 0, 읽기 전용)
- `lib/candidates.ts`: `joinCandidates`·`filterRestaurantsByName`·`listTodayRows`·`findWinnerIndex`·`isNewSpin`·`candidatesReducer` (오늘 후보 도메인의 모든 판단, 순수)
- `lib/useCandidates.ts`: 오늘 후보 SELECT 1회 + `candidates-<n>` 토픽 2분기 구독 (판단 0, 읽기 전용)
- `lib/menus.ts`: `parseMenuInput`·`truncateToCodePoints` (쉼표 다중 입력 파싱·코드포인트 절단, 순수 함수)
- `lib/history.ts`: `filterSince`·`buildRanking`·`buildMonthGrid` (기록·랭킹의 모든 판단, 순수 — Phase 7 이 두 컴포넌트에서 내렸다)

**Styling:**
- `app/globals.css:12-31`: CSS 변수 토큰(`--bg`, `--ink`, `--accent`, `--line`, `--radius`, `--font-sans` 등)
- `app/globals.css:33-50`: Tailwind v4 `@theme inline` 매핑
- `app/globals.css:75-158`: 전역 유틸 클래스(`.mono`, `.micro`, `.card`, `.wrap`, `.dot.live/.spin/.done`) + keyframes
- 각 컴포넌트 파일 하단: `const s = {...} satisfies Record<string, CSSProperties>`

**Testing:**
- 없음. 테스트 파일·러너·`test` 스크립트·CI 설정이 전부 부재

## Naming Conventions

**Files:**
- 컴포넌트: `PascalCase.tsx` — 파일명 = export하는 컴포넌트명 (`components/Wheel.tsx` → `export function Wheel`)
- 헬퍼/라이브러리: `camelCase.ts` 또는 단어 하나 소문자 (`lib/time.ts`, `lib/phase.ts`, `lib/colors.ts`)
- 라우트: App Router 예약어 `page.tsx`, `layout.tsx`
- 마이그레이션: `000N_snake_case.sql` — 4자리 순번 + 설명 (`0004_pinned_menus.sql`)
- Edge Function: `kebab-case/index.ts` (`spin-roulette/index.ts`)

**Directories:**
- 라우트: 소문자 단어 하나 (`app/log/`, `app/rank/`)
- 최상위: 소문자 단수/복수 (`lib/`, `components/`, `design/`)

**Code:**
- 컴포넌트: named export. **default export는 `page.tsx`/`layout.tsx`에만** (Next.js 요구)
- 콜백 prop: `on~Action` 접미사 필수 (`onAddAction`, `onChangeMonthAction`)
- 모듈 상수: `SCREAMING_SNAKE_CASE` (`SLICE_COLORS`, `MENU_NAME_MAX_LEN`, `MENU_CHIP_LIMIT`, `RESULT_STEP_OFFSET_MIN`, `SPIN_MS`)
- 타입: `PascalCase`. DB row는 `~Row` 접미사 (`MenuRow`, `ResultRow`, `PinnedMenuRow`)
- 스타일 객체: 짧은 파일은 `s`, 여러 그룹이 필요하면 `~Styles` (`pageHeadStyles`, `layoutStyles`, `respinStyles`, `alertStyles`)
- 주석: **한글, Why만.** 파일 머리에 역할·제약을 블록 주석으로 (`lib/phase.ts:1-8`, `supabase/functions/respin-roulette/index.ts:1-16`이 모범 사례)

**Import 순서 (관찰된 규칙):**
1. `"use client"` 지시어
2. React / `next/*`
3. 외부 패키지 (`@supabase/supabase-js` 타입)
4. `@/lib/*`
5. `@/components/*`

## Where to Add New Code

**새 탭/라우트:**
- 페이지: `app/<route>/page.tsx` — `"use client"` + default export
- `TopBar`에 탭 추가: `components/TopBar.tsx`의 `Tab` 유니온(`"today" | "restaurants" | "log" | "rank"`)과 `<TabLink>` 목록 양쪽을 수정. 유니온의 나열 순서를 탭 표시 순서와 맞춘다
- 1초 tick + `currentPhase` + `TopBar` 삽입 보일러플레이트는 `app/rank/page.tsx`(90줄)를 그대로 복사하는 게 가장 짧다
- 쓰기 핸들러·에러 배너 2개(읽기/쓰기 분리)까지 있는 라우트가 필요하면 `app/restaurants/page.tsx`가 더 가까운 원본이다

**새 프레젠테이션 컴포넌트:**
- 구현: `components/<ComponentName>.tsx` — named export, props 타입은 파일 상단 `type Props = {...}`, 스타일 객체는 파일 하단
- 데이터는 props로만 받는다. supabase 호출은 페이지로 올린다
- 페이지에서만 쓰는 20~30줄짜리 소형 컴포넌트는 별도 파일 대신 페이지 파일 하단에 둔다 (`app/page.tsx`의 `StageHeader`/`Footer` 참고)

**새 도메인 헬퍼:**
- 시간 관련: `lib/time.ts`에 추가 (**새 파일을 만들지 말 것** — KST 변환의 단일 창구)
- 페이즈/추첨 시각 관련: `lib/phase.ts`
- 오늘 후보 목록·필터·당첨 판정: `lib/candidates.ts`. 목록의 Realtime 병합 규칙 자체는 `lib/rowset.ts` — 새 목록이 생기면 리듀서를 새로 쓰지 말고 키 함수만 주입한다
- 기록·랭킹의 필터·집계·격자: `lib/history.ts`
- 그 외 순수 헬퍼: `lib/<name>.ts`. 특정 컴포넌트에서만 쓰는 순수 함수라도 테스트가 필요하면 `lib/` 로 내린다 (`buildRanking`·`buildMonthGrid` → `lib/history.ts`, `parseMenuInput` → `lib/menus.ts` 전례) — 컴포넌트 파일은 러너가 수집하지 않는다

**새 DB 테이블/컬럼:**
1. `supabase/migrations/000N_설명.sql` 새로 생성 (기존 파일 수정 금지, 순번 증가)
2. RLS `enable` + 정책 명시 (정책 없으면 anon이 아무것도 못 읽는다)
3. 클라이언트가 실시간으로 봐야 하면 `alter publication supabase_realtime add table public.<t>;`
4. `lib/supabase/client.ts`에 `~Row` 타입 추가 — **DB 타입의 유일한 정의처, 수동 동기화**
5. `results` 스키마를 바꿨다면 두 Edge Function도 함께 수정
6. 마이그레이션 적용은 사용자가 직접 한다

**새 서버 측 로직 (쓰기 권한 필요):**
- 위치: `supabase/functions/<kebab-name>/index.ts`
- 브라우저가 호출할 함수라면 `supabase/functions/respin-roulette/index.ts:21-33`의 `corsHeaders` + `json()` + OPTIONS 단락을 그대로 가져온다
- `supabase/config.toml`에 `[functions.<name>] verify_jwt = false` 블록 추가
- 배포 시 `--no-verify-jwt`를 잊지 말 것
- KST가 필요하면 `kstNow()`를 복사한다 (Deno라 `lib/time.ts` 공유 불가)

**새 스타일:**
- 색·반경·폰트: `app/globals.css:12-31`의 CSS 변수만 쓴다. 하드코딩된 hex/oklch를 컴포넌트에 직접 쓰지 않는다 (예외: 이미 있는 `Wheel`/`ResultBlock`의 장식용 oklch)
- 두 컴포넌트 이상이 공유하는 클래스만 `app/globals.css`에 추가
- Tailwind 유틸리티 클래스는 늘리지 않는다. inline style 객체 쪽을 따른다

**Tests:**
- vitest 가 있다. `npm test` = `vitest run`(워치는 `npm run test:watch`), 설정은 레포 루트 `vitest.config.mts`, 수집 대상은 `lib/**`·`components/**`·`supabase/functions/_shared/**`·`supabase/migrations/**` 의 `*.test.ts` 다. CI 는 아직 없다
- `environment: "node"` 단일 구성이라 **React 렌더 하네스가 없다.** 훅·컴포넌트·페이지 안의 분기는 테스트할 수 없으므로, 판단은 순수 모듈(`lib/*.ts`)로 밀어낸 다음 그곳에서 검증한다 — `lib/rowset.ts`·`lib/settings.ts`·`lib/restaurants.ts`·`lib/candidates.ts` 가 그 결과이고 대응 훅(`lib/useSettings.ts`·`lib/useRestaurants.ts`·`lib/useCandidates.ts`)에는 I/O 만 남는다. 세 훅 모두 본문 분기가 0개다
- 마이그레이션 spec 은 SQL 을 실행하지 않고 텍스트로 파싱해 계약(테이블·제약·RLS·cron)을 검사한다

## Special Directories

**`design/`:**
- Purpose: React CDN 프로토타입 `.jsx` + 원본 HTML + 스크린샷 PNG 17장
- Generated: No (수작업 디자인 산출물)
- Committed: Yes (`design/screens/*.png` 포함)
- 빌드/타입체크/lint 대상: **아니오** — 4개 설정 파일에서 제외

**`public/`:**
- Purpose: create-next-app 기본 SVG 5개
- Generated: 스캐폴딩 산출물
- Committed: Yes
- 실제 참조: 없음 (코드에서 사용하지 않음)

**`.next/`:**
- Purpose: Next.js/Turbopack 빌드·dev 캐시
- Generated: Yes
- Committed: No (`.gitignore`)
- 주의: stale 캐시가 dev 서버 크래시를 일으킨 전례가 있다. 증상 발생 시 `rm -rf .next`

**`supabase/.temp/`:**
- Purpose: Supabase CLI의 링크 상태(`linked-project.json`, `cli-latest`)
- Generated: Yes
- Committed: No (`.gitignore`)

**`.serena/`:**
- Purpose: Serena MCP 서버의 프로젝트 설정·캐시·메모리
- Generated: 부분 (`cache/`는 생성물)
- Committed: `project.yml`만 (`cache/`·`project.local.yml` 제외)
- 주의: `.serena/project.yml`은 Serena가 켜질 때마다 재포맷한다 — diff에 떠도 커밋 대상 아님

**`.omc/`, `.gstack/`:**
- Purpose: 머신 로컬 에이전트 오케스트레이션 상태·로그
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD 코드베이스 분석 문서 (이 파일 포함)
- Generated: Yes (`/gsd:map-codebase`)
- Committed: Yes

---

*Structure analysis: 2026-09-18*
