# External Integrations

**Analysis Date:** 2026-09-18

외부 의존은 **Supabase 하나**로 수렴한다. 결제·메일·분석·에러추적 등 다른 서드파티 SaaS는 전혀 없다. 나머지는 호스팅(Vercel)과 폰트 CDN 2곳뿐이다.

## APIs & External Services

**Backend-as-a-Service:**
- Supabase — DB·실시간·서버리스 함수·스케줄러를 전부 담당
  - SDK/Client: `@supabase/supabase-js` 2.106.0 (브라우저), `jsr:@supabase/supabase-js@2` (Edge Function)
  - 클라이언트 생성처: `lib/supabase/client.ts` — 앱 전체에서 이 싱글턴 하나만 import 한다
  - Auth: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key, `sb_publishable_…` 형식 — JWT가 아니다)
  - 프로젝트 ref: `swxiqytyxjlcgubqlozk` (region `ap-northeast-2` / Seoul). `supabase/.temp/linked-project.json`과 `supabase/migrations/0002_cron.sql`에 기록
  - **ref 하드코딩 지점:** `supabase/migrations/0002_cron.sql`의 `net.http_post` URL. 다른 Supabase 프로젝트로 이전하려면 이 문자열을 치환한 뒤 재적용해야 한다

**폰트 CDN (런타임 외부 요청):**
- jsDelivr — Pretendard. `app/globals.css:2`에서 `@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/...")`
- Google Fonts — JetBrains Mono. `app/globals.css:3`
- `next/font` 미사용 — CSS `@import`라 셀프호스팅·프리로드 최적화가 없고, 두 CDN이 렌더 블로킹 경로에 들어간다

**프로토타입 전용 CDN (빌드 제외, 런타임 무관):**
- `design/Lunch Roulette.html`이 unpkg에서 React 18.3.1 UMD + `@babel/standalone` 7.29.0을 로드한다. 앱 번들과 무관한 시각 참조용

## Data Storage

**Databases:**
- Supabase Postgres (무료 티어)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` (브라우저), `Deno.env.get("SUPABASE_URL")` (Edge Function)
  - Client: supabase-js PostgREST 쿼리 빌더. ORM·마이그레이션 프레임워크 없음, 원시 SQL 마이그레이션 파일 직접 관리
  - 스키마 정의: `supabase/migrations/0001_init.sql`, `0004_pinned_menus.sql`
  - **DB 타입은 자동 생성이 아니라 수동 유지** — `lib/supabase/client.ts`의 `MenuRow`/`ResultRow`/`PinnedMenuRow`가 유일한 정의처. 컬럼을 바꾸면 앱 4개 파일 + Edge Function 2개를 직접 동기화해야 한다

  | 테이블 | 용도 | 수명 | 정의 |
  |---|---|---|---|
  | `public.menus` | 오늘 룰렛 후보 | 매일 KST 00:00 truncate | `0001_init.sql` |
  | `public.results` | 확정된 추첨 결과 | 영구 보존, `date` unique | `0001_init.sql` |
  | `public.pinned_menus` | 고정 메뉴 (자정 재시드 소스) | 영구 보존, `name` PK | `0004_pinned_menus.sql` |

**Row Level Security (의도적으로 열려 있음):**
- `menus` — select/insert/delete 전부 `true` (익명 누구나 추가·삭제)
- `pinned_menus` — select/insert/delete 전부 `true` (익명 누구나 고정 토글)
- `results` — select만 `true`. **INSERT/UPDATE 정책이 없어 service_role만 쓸 수 있다** → 결과 확정 경로가 Edge Function으로 강제된다
- 로그인 없는 익명 서비스 설계상 수용한 트레이드오프

**File Storage:**
- 없음. Supabase Storage 미사용. 정적 에셋은 `public/`의 SVG 5개와 `app/favicon.ico`뿐

**Caching:**
- 없음. Redis·Supabase 캐시 계층 미사용. 모든 읽기가 Postgres 직행

## Realtime

- Supabase Realtime `postgres_changes` — 다중 접속 동기화의 유일한 수단. 폴링·SWR·React Query 없음
- Publication 등록: `alter publication supabase_realtime add table ...` (`0001_init.sql`의 `menus`/`results`, `0004_pinned_menus.sql`의 `pinned_menus`)
- 클라이언트 설정: `lib/supabase/client.ts`의 `realtime: { params: { eventsPerSecond: 10 } }`

| 채널명 | 구독처 | 구독 이벤트 |
|---|---|---|
| `results-<n>` | `app/page.tsx` | `results` INSERT/UPDATE (구독마다 effect 안에서 번호) |
| `results-log-<n>` | `app/log/page.tsx` | `results` INSERT/UPDATE |
| `results-rank-<n>` | `app/rank/page.tsx` | `results` INSERT/UPDATE |
| `settings-changes-<n>` · `restaurants-<n>` · `candidates-<n>` | `lib/useSettings.ts` · `lib/useRestaurants.ts` · `lib/useCandidates.ts` | 각 테이블 변경 |

세 페이지 모두 `useEffect` 정리 단계에서 `supabase.removeChannel(...)`을 호출한다. 새 실시간 화면을 추가할 때 이 패턴을 따를 것.

## Serverless Functions (Supabase Edge Functions)

두 함수 모두 Deno 런타임, `jsr:` import, `SUPABASE_SERVICE_ROLE_KEY`로 service_role 클라이언트를 만든다. **`tsconfig`/eslint에서 제외돼 타입체크·lint가 돌지 않으므로 수정 후 직접 검증해야 한다.**

**`spin-roulette` (`supabase/functions/spin-roulette/index.ts`):**
- 호출자: pg_cron → `pg_net`의 `net.http_post` (익명, Authorization 헤더 없음)
- 엔드포인트: `https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette`
- 가드 1 — 시간: KST 11:55 이전이면 `{skipped: "before_spin_time"}` 반환하고 종료
- 가드 2 — 멱등성: 같은 `date`의 `results` 행이 있으면 `{skipped: "already_decided"}`
- 가드 3 — 경합: insert가 `23505`(unique 위반)면 `{skipped: "race_already_decided"}`
- 당첨 선정: `crypto.getRandomValues` 기반 `pickRandom`. `results`에 INSERT
- CORS 헤더 없음 (브라우저가 호출하지 않으므로 불필요)

**`respin-roulette` (`supabase/functions/respin-roulette/index.ts`):**
- 호출자: 브라우저. `app/page.tsx:195`의 `supabase.functions.invoke<RespinResponse>("respin-roulette")`
- 시간 가드 없음, 멱등성 스킵 없음. `results`를 `upsert({ onConflict: "date" })`로 덮어쓴다
- **CORS를 함수가 직접 내려준다** — Supabase 게이트웨이는 CORS 헤더를 주입하지 않는다(코드 주석에 직접 확인 기록). `corsHeaders` 상수 + 모든 응답을 감싸는 `json()` 헬퍼
- `OPTIONS` 프리플라이트를 본문 로직 앞에서 즉시 단락시킨다. **이 단락을 제거하면 프리플라이트가 재추첨을 실행해 결과가 중복 덮어써진다**
- 인증·레이트리밋 없음 — anon publishable key만 있으면 누구나 하루 결과를 무한히 바꿀 수 있다 (익명 서비스 설계상 수용)

**배포 플래그:** 두 함수 모두 `verify_jwt = false`가 `supabase/config.toml`에 고정돼 있다. 기본값(true)으로 배포되면 401이 나면서 점심 추첨이 조용히 멈춘다.
(참고: `CLAUDE.md`는 "config.toml 없음, `--no-verify-jwt`를 잊지 말 것"이라고 적고 있으나 현재 `supabase/config.toml`이 존재하며 플래그가 선언돼 있다 — CLAUDE.md 쪽이 오래된 서술이다.)

## Scheduled Jobs (pg_cron + pg_net)

확장 활성화: `create extension if not exists pg_net; create extension if not exists pg_cron;` (`supabase/migrations/0002_cron.sql`)

| 잡 이름 | 스케줄 (UTC) | KST | 동작 |
|---|---|---|---|
| `spin-lunch-roulette` | `55 2 * * *` | 11:55 | `net.http_post`로 `spin-roulette` 호출 |
| `reset-menus` | `0 15 * * *` | 00:00 | `menus` truncate 후 `pinned_menus`를 재시드 |

- `reset-menus`는 3번 재정의됐다: `0002`(단순 truncate) → `0003`(어제 후보 전체 재시드) → **`0004`(고정 메뉴만 재시드, 현행)**. `0004_pinned_menus.sql`이 정본
- 모든 cron 마이그레이션은 "기존 잡 `cron.unschedule` → 재등록" 패턴이라 재실행 가능하다. 새 cron 마이그레이션도 이 패턴을 따를 것
- pg_cron 응답을 확인하지 않는다 — `net.http_post`는 fire-and-forget. 함수가 401/500을 내도 DB 쪽에 알림이 없다

**추첨 시각 11:55는 네 곳에 흩어져 있다.** 바꾸려면 전부 수정: `lib/phase.ts`(`SPIN_HH`/`SPIN_MM`), `supabase/functions/spin-roulette/index.ts`(`SPIN_HH`/`SPIN_MM`), `supabase/migrations/0002_cron.sql`(`55 2 * * *`), UI 문구(`app/page.tsx`, `README.md`).

## Authentication & Identity

- **없음 (의도적).** 완전 익명 서비스. Supabase Auth 미사용, 로그인 UI·세션·사용자 테이블 전무
- 유일한 자격증명 구분: anon publishable key(브라우저, 읽기 + `menus`/`pinned_menus` 쓰기) vs service_role key(Edge Function, `results` 쓰기)
- 사용자 식별 수단이 없어 감사 추적·레이트리밋·남용 차단이 불가능하다

## Monitoring & Observability

**Error Tracking:**
- 없음. Sentry 등 미연동

**Logs:**
- Supabase 대시보드의 Edge Function 로그와 pg_cron 실행 기록(`cron.job_run_details`)이 전부
- 앱 코드에 로깅 프레임워크 없음. 클라이언트 쓰기 실패는 `app/page.tsx`의 `actionError` state로 화면에만 표시하고 어디에도 전송하지 않는다
- 자동 추첨이 실패하면(예: 함수 401, 후보 0개) **감지 수단이 사실상 없다**

**Analytics:**
- 없음. Vercel Analytics·GA 미연동

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js 자동 감지, 무료 티어). GitHub `F1rstID/lunch-roulette` 임포트 방식
- `vercel.json`·`.vercel/` 없음 — 빌드 설정·환경변수 전부 Vercel 대시보드에만 존재하고 레포에 형상관리되지 않는다

**CI Pipeline:**
- 없음. `.github/` 디렉토리 부재. 타입체크·lint·빌드 게이트가 자동으로 도는 곳이 한 군데도 없다
- 프론트엔드 배포는 Vercel의 git push 연동에 의존
- **DB 마이그레이션과 Edge Function 배포는 완전 수동**이며 앱 배포와 분리돼 있다 (Supabase CLI로 별도 실행). 스키마 변경과 코드 배포가 원자적이지 않다

## Environment Configuration

**Required env vars (클라이언트, 레포 기준):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — publishable key
- 둘 다 `lib/supabase/client.ts:5-6`에서만 참조. 빌드 시 없으면 `npm run build` 실패

**Required env vars (Edge Function, 플랫폼 자동 주입):**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — **service_role 권한. 레포·클라이언트 번들에 절대 들어가면 안 된다**

**Secrets location:**
- 로컬: `.env.local` (존재. `.gitignore`의 `.env*` 규칙으로 커밋 제외 — 값은 문서에 옮기지 않는다)
- 템플릿: `.env.example` (빈 값, 커밋됨)
- 프로덕션: Vercel Project Settings → Environment Variables
- service_role key: Supabase 플랫폼이 Edge Function 런타임에 주입. 레포에 정의처 없음

## Webhooks & Callbacks

**Incoming:**
- `POST /functions/v1/spin-roulette` — pg_cron이 `pg_net`으로 호출하는 사실상의 내부 웹훅. 인증 없음(`verify_jwt: false`), 시간 가드 + 멱등성으로 방어
- `POST /functions/v1/respin-roulette` — 브라우저 invoke. 인증·레이트리밋 없음
- **Next.js 쪽 수신 엔드포인트는 없다** — Route Handler·API Route·서버 액션이 하나도 없다. 앱은 순수 클라이언트 렌더링 + supabase-js 직통

**Outgoing:**
- Postgres → Supabase Edge Function (`net.http_post`, `0002_cron.sql`)
- 그 외 외부로 나가는 요청 없음

---

*Integration audit: 2026-09-18*
