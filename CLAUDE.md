@AGENTS.md

# lunch_roulette — 작업 가이드

매일 11:55 KST에 서버가 자동으로 돌리는 익명 점심 메뉴 룰렛. 인프라·배포·pg_cron 상세는 `README.md`가 정본이다 (여기 중복하지 않는다).

## 엔트리포인트·핵심 흐름

- `app/page.tsx` — 오늘 탭. 메뉴 CRUD + 룰렛 + 결과. 앱의 중심.
- `app/log/page.tsx` — 캘린더 기록. `app/rank/page.tsx` — 랭킹.
- `app/restaurants/page.tsx` — 매장 탭. 매장 카탈로그 CRUD + 📌 고정. 쓰기 4종(등록·수정·삭제·핀)이 여기서 직접 PostgREST 를 부르고 실패는 전부 `formatRestaurantWriteError` 를 지나 한 배너로 모인다. 페이즈 잠금이 없다 — 매장 편집은 추첨 시각과 무관하다. 오늘 후보 담기는 아직 없다(Phase 6).
- `lib/supabase/client.ts` — 브라우저용 supabase 클라이언트 + `MenuRow`/`ResultRow` 타입. **DB 타입의 유일한 정의처** (자동 생성 아님, 수동 유지).
- `lib/time.ts` — KST 포맷터 + `_shared/kst` 재수출. `lib/phase.ts` — 시각·추첨 시각·결과 유무 → 페이즈(`accepting|spinning|decided|stalled`). `stalled` = 추첨 시각은 지났는데 결과 행이 없는 구간이고, 이때 후보 목록을 잠그지 않는다.
- `lib/settings.ts` — `settings` 행 → 앱 도메인 변환 + Realtime 병합 리듀서(순수 — supabase·React·환경변수를 **값으로** 끌어오지 않는다. `lib/supabase/client.ts` 에서는 `import type` 만 가져오고, 값 import 는 `_shared/spinTime` 의 `DEFAULT_SPIN_TIME`·`parseSpinTime` 뿐이다). `lib/useSettings.ts` — 그 리듀서에 I/O 를 붙인 훅(SELECT 1회 + `settings-changes-<n>` 구독 — 토픽은 구독 인스턴스마다 유일해야 한다). 추첨 시각·쿨다운의 단일 출처.
- `lib/restaurants.ts` — 매장 폼 검증·위치 링크 판정(`http:`/`https:` 화이트리스트)·표시 정렬(핀 먼저·한국어 이름순)·Realtime 병합 리듀서(순수 — `lib/supabase/client.ts` 에서 `import type` 만 가져온다. 단 하나의 값 import 는 `components/MenuList.tsx` 의 `parseMenuInput` 이고 그것이 `lib/` 단방향 규칙의 예외다). `lib/useRestaurants.ts` — 그 리듀서에 I/O 를 붙인 훅(SELECT 1회 + `restaurants-<n>` 토픽의 INSERT/UPDATE/DELETE **3분기** 구독, 읽기 전용). `components/RestaurantList.tsx` — 카드·등록 폼·인라인 편집·핀·2단계 삭제 확인(supabase 미호출, 쓰기는 `~Action` 콜백으로 페이지에 올린다).
- `supabase/functions/_shared/` — Deno 함수와 클라이언트가 **같은 파일로** 공유하는 순수 로직(`kst.ts`·`spinTime.ts`·`cooldown.ts`). 그 **세 모듈**이 import 를 하나도 하지 않는 것이 계약이다 — 서로도 import 하지 않는다 (Deno 는 `.ts` 확장자를 요구하고 tsc 는 거부한다). 같은 디렉터리의 `*.test.ts` 는 예외다 (vitest 만 실행하므로 `./kst` 처럼 확장자 없이 가져온다).
- `lib/constants.ts` — 환경변수 없이 import 되는 순수 상수(`MENU_NAME_MAX_LEN` 24 · `RESTAURANT_MENUS_MAX` 30 · `RESTAURANT_LOCATION_MAX_LEN` 200). 세 값 모두 `supabase/migrations/0005_restaurants_settings.sql` 의 check 제약을 코드포인트 단위로 비춘 것이고 늘릴 때는 SQL 과 함께 고친다(24 는 메뉴명·매장명·메뉴 원소가 공용). 테스트가 `lib/supabase/client.ts`(모듈 로드 시 `createClient`)를 끌어오지 않게 분리한 것. `lib/errors.ts` — 로드 에러 메시지 조립(순수). `components/ErrorBanner.tsx` — `role="alert"` 배너.
- `supabase/functions/spin-roulette` — pg_cron이 **매분** 호출하는 추첨 함수. 추첨 시각은 `settings.spin_time` 을 읽어 판정하고(조회·파싱 실패는 기본 시각으로 폴백), 같은 날짜 결과 행이 있으면 멱등 종료한다. 후보는 `candidates` → `restaurants` 조인에서 읽고 `_shared/cooldown.ts` 로 거른 뒤 `results` 에 매장명 스냅샷 + `restaurant_id` 를 쓴다. `respin-roulette` — 클라이언트 "다시 돌리기". 시간 가드·멱등 조회가 없고 같은 조인·쿨다운 위에서 `upsert(onConflict: "date")` 로 덮어쓴다 (그래서 컷오버 전 사람이 직접 invoke 해 새 스키마 경로를 볼 수 있는 유일한 함수다). **POST 가 아닌 요청은 405 로 거절한다** — 되돌릴 수 없는 덮어쓰기라 OPTIONS 단락만으로는 GET 한 번(링크 미리보기·주소창)을 막지 못한다. **두 함수 모두 아직 배포되지 않았다** — 라이브에는 구 코드(메뉴 기반)가 돌고 `candidates`·`restaurants`·`settings` 도 라이브에 없다 (배포·마이그레이션 적용은 Phase 8 컷오버).

흐름: 클라이언트는 `menus`/`results`를 직접 SELECT/INSERT/DELETE(anon RLS) → Realtime `postgres_changes`로 동기화 (오늘 탭의 후보 소스를 `candidates` 로 바꾸는 것은 Phase 6). 결과 확정은 **서버(pg_cron 매분 → Edge Function → `candidates`⋈`restaurants` 조회 → results 쓰기)** 만 한다. 클라이언트의 페이즈 계산은 표시용 추정이고, 실제 상태 전환은 results 행 존재 여부가 결정한다.

## 검증 명령

```bash
npx tsc --noEmit   # 타입
npm run lint       # eslint (react-hooks 규칙 포함)
npm test           # vitest run (워치 아님). 워치는 npm run test:watch
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 빌드 자체가 실패한다
npm run check:edge # deno check 두 Edge Function (index.ts 의 유일한 정적 검사)
```

`check:edge` 는 로컬에 설치된 `deno`(2.9.7, Homebrew `/opt/homebrew/bin/deno`)를 전제한다 — npm 의존성이 아니라 외부 도구라 `npm ci` 로 따라오지 않는다.

테스트는 vitest — `npm test` = `vitest run`, 설정은 레포 루트 `vitest.config.mts`, 수집 대상은 `lib/**`·`components/**`·`supabase/functions/_shared/**`·`supabase/migrations/**` 의 `*.test.ts` 뿐이다 (CI는 여전히 없음). `_shared/**`·`migrations/**` 는 각각 Phase 3·2 가 실제 파일을 채웠다 — 마이그레이션 spec 은 SQL 을 실행하지 않고 텍스트로 파싱해 계약을 검사한다. lint는 2026-09-18 기준 에러 0 (`components/Wheel.tsx`는 회전을 props에서 파생하도록 고쳐 `react-hooks/set-state-in-effect` 해결).

## 코드 컨벤션 (이 레포가 이미 내린 선택 — 따른다)

- **전부 클라이언트 컴포넌트.** 서버 컴포넌트·Route Handler·서버 액션 없음. 데이터 접근은 페이지 컴포넌트 안에서 supabase-js 직접 호출. 새 기능도 이 구조를 따르되, 쓰기 권한이 필요한 로직은 Edge Function으로 보낸다 (results 쓰기는 service_role만).
- **스타일: inline style 객체 + CSS 변수.** 컴포넌트마다 파일 하단에 `const s = {...} satisfies Record<string, CSSProperties>`. 색·폰트·반경은 `app/globals.css`의 `--bg`, `--ink`, `--accent` 등 토큰만 쓴다. Tailwind는 설치돼 있지만 유틸리티 클래스는 거의 안 쓴다 (layout.tsx 정도) — 새 코드도 inline style 쪽을 따른다.
- **콜백 prop 이름은 `~Action` 접미사** (`onAddAction`, `onRemoveAction`, `onChangeMonthAction`). Next.js 클라이언트 경계의 직렬화 lint를 통과시키기 위한 규약이다. `onX`로 지으면 lint가 잡는다.
- **시간은 항상 `lib/time.ts` 경유.** `Date`의 로컬 메서드(`getHours` 등)를 비즈니스 로직에 직접 쓰지 않는다. 날짜 키는 `"yyyy-mm-dd"` KST 문자열이고 `results.date`와 그대로 비교한다.
- 컴포넌트는 named export, 파일명 = 컴포넌트명 (`components/Wheel.tsx`). 페이지 전용 소형 컴포넌트는 페이지 파일 안에 둔다.
- **공용 훅은 `lib/useX.ts`, `use` 접두** (`lib/useSettings.ts`·`lib/useRestaurants.ts`). `lib/` 파일명이 소문자 명사인 관례(`time.ts`·`phase.ts`·`errors.ts`·`constants.ts`)의 유일한 예외다. 훅에는 I/O 만 두고 판단은 같은 이름의 순수 모듈(`lib/settings.ts`·`lib/restaurants.ts`)로 내린다 — 레포에 React 렌더 하네스가 없어서 훅 안의 분기는 테스트되지 않는다.
- **`lib/` 는 `app/`·`components/` 를 import 하지 않는다(단방향). 예외 1곳**: `lib/restaurants.ts` 가 `components/MenuList.tsx` 의 `parseMenuInput` 을 가져온다 — 쉼표 파싱을 두 벌로 만들지 않으려는 의도적 예외다(CATL-06). Phase 6 이 오늘 탭을 `candidates` 로 바꾸며 `MenuList` 를 지울 때 `parseMenuInput`·`truncateToCodePoints` 를 `lib/` 로 옮겨야 이 예외가 사라진다.
- 주석은 한글, Why만. 파일 머리에 역할·제약을 블록 주석으로.
- 마이그레이션은 `supabase/migrations/000N_설명.sql`, cron 등록은 "기존 잡 unschedule → 재등록" 패턴으로 재실행 가능하게.
- Edge Function은 Deno + `jsr:` import. `tsconfig`·eslint 제외는 **함수 디렉터리 2개(`spin-roulette/**`·`respin-roulette/**`)뿐**이고 `_shared/**` 는 tsc·eslint·vitest 3중 검사를 받는다. 두 `index.ts` 본문은 `deno check`(`npm run check:edge`)가 **타입**을 검사하고(전이로 `_shared` 까지), `_shared/edgeImports.test.ts` 의 텍스트 계약 58건이 **형태**(조회 문자열·jsr 핀·폴백 키·헬퍼 이름·로그 지점 수·쿨다운 창 경계)를 고정한다 — 둘은 서로를 대체하지 않는다. eslint 는 여전히 두 파일을 보지 않고, 남는 사각지대는 **동작**이다: 실호출은 컷오버 전 불가라 낭독 기록(`04-02`·`04-03-SUMMARY.md`)이 마지막 방어다.
- **Edge Function 의 500·폴백 경로는 `console.error` 로 Supabase 로그에 남긴다** (무엇이 어떤 값으로 실패했는지까지. 현재 spin 8지점·respin 6지점 — 각 마지막 1건은 핸들러 전체를 감싼 `catch` 다. 던져진 예외는 반환이 아니라서 `json()` 을 지나지 않고, respin 쪽은 CORS 헤더까지 빠져 클라이언트가 사유를 읽지 못한다). `app/`·`lib/` 에는 넣지 않는다 — 클라이언트는 배너가 채널이다(`actionError`/`loadError`). 로그·응답 본문에 `details`·`hint`·행 덤프를 싣지 않는다. 조인 형태 불일치로 버린 후보 수는 로그뿐 아니라 응답 `excluded_count`(두 함수의 `no_candidates`·`ok` 양쪽)로도 싣는다 — 그래야 "후보가 없다" 와 "조인이 깨졌다" 가 응답만으로 구분된다.

## 비표준 규약·함정

- `design/`은 React CDN 프로토타입 + PNG. **빌드 대상 아님**, 시각 참조용. 인덱서 OOM 전례 때문에 tsconfig/eslint/vscode/Tailwind `@source` 네 군데에서 제외돼 있다. 제외를 풀지 말 것. 컴포넌트를 새로 포팅할 때만 열어본다.
- `supabase/functions/` 는 **함수 디렉터리 2개만** 제외다 (Deno 전역·`jsr:` import 때문이고, OOM 근거는 `design/` 쪽이다). `_shared/` 는 제외하지 않는다 — 좁힌 제외를 다시 넓히지 말 것. Edge Function 배포 플래그는 `supabase/config.toml`의 `[functions.*] verify_jwt = false`에 고정돼 있다(63fae89) — 두 함수 모두 anon(pg_cron·publishable key) 호출이라 true로 배포되면 401로 추첨이 조용히 멈춘다. 재배포 시 CLI가 이 파일을 읽지만 `--no-verify-jwt`를 같이 주면 이중 안전.
- `supabase/functions/deno.json`(한 키 `{"nodeModulesDir":"none"}`)·`supabase/functions/deno.lock` 은 로컬 `check:edge` 전용이다 — 배포는 API 측 번들링이라 둘 다 읽지 않는다. **함수 디렉터리 안(`spin-roulette/`·`respin-roulette/`)에 `deno.json`·`deno.jsonc`·`import_map.json` 을 두지 말 것** — 거기 두면 Supabase CLI가 배포 import map 으로 채택해 번들 입력이 바뀐다(계약 #48 이 부재를 고정). supabase-js 버전을 올릴 때는 두 `index.ts` 의 `jsr:@supabase/supabase-js@2.117.2` 핀과 lock 을 **함께** 갱신한다(lock 은 생성물 — 손으로 고치지 않고 재생성한다). 루트에 `deno.lock` 이 생기면 `.gitignore` 가 아니라 명령을 고친다.
- 에디터에서 `supabase/functions/_shared/*.test.ts` 의 확장자 없는 import(`./spinTime`)가 "Cannot find module" 로 뜰 수 있다 — VS Code Deno 확장이 위 `deno.json` 을 보고 그 하위를 Deno 영역으로 켜는 것으로 **추정**한다. `npx tsc --noEmit`·`npm test` 는 exit 0 이라 게이트와 무관하고, `deno.json` 위치는 계약이라 옮기지 않는다.
- 추첨 시각의 코드상 정의처는 `supabase/functions/_shared/spinTime.ts` 의 `DEFAULT_SPIN_TIME` **한 곳**이고, 런타임 값은 `settings.spin_time`(대시보드 편집)이 이긴다. 아직 남은 중복은 두 갈래다: 화면 하드코딩 문구 "11:55"(Phase 6 에서 `settings` 로 교체), `supabase/migrations/0002_cron.sql`의 `'55 2 * * *'`와 `0005` 의 기본값(DB 쪽 기본값).
- `kstNow()`·`kstParts()` 는 `supabase/functions/_shared/kst.ts` **한 곳**에 있다. Deno 는 `../_shared/kst.ts`(확장자 포함), 클라이언트는 `@/supabase/functions/_shared/kst`(확장자 없이)로 같은 파일을 본다. `lib/time.ts` 는 그 위의 얇은 재수출 + 포맷터다.
- RLS는 의도적으로 열려 있다: 누구나 menus insert/delete 가능, results는 service_role만 쓰기. `respin-roulette`는 인증·레이트리밋 없음 — 익명 서비스 설계상 수용한 것.
- 4개 페이지 모두 1초 `setInterval`로 `now`를 갱신해 리렌더한다(오늘·매장·기록·랭킹). 페이즈 전환 감지 목적. 무거운 계산은 `useMemo`로 감쌀 것(매장 탭의 `sortRestaurants` 가 그 이유로 감싸져 있다).
- `.serena/project.yml`은 serena가 켤 때마다 재포맷한다 — diff에 떠도 커밋 대상 아님.
- **`npm run dev` 크래시 원인=stale `.next` 캐시 (2026-09-15 규명·수리·검증 완료).** 3개월 방치된 Turbopack 영속 캐시(`.next/dev/cache` 6월22일)가 컴파일 단계 node fork storm(2.5분 3508개)을 일으켜 메모리 고갈 → 커널 패닉 2회. **코드/설정 무관**(5월 이후 불변, 프로덕션 정상). `rm -rf .next` 후 가드런처로 재기동 검증: Ready 234ms, `GET / 200`, node 1개/RSS 251MB로 정상. **재발 시 `rm -rf .next`**. 증폭기: Next가 dev에 힙 13GB(RAM 50%) 부여 → `NEXT_DISABLE_MEM_OVERRIDE=1`로 완화. → 메모리 `lunch-roulette-dev-server-kernel-panic`.

## 위험 지점

| 위치 | 왜 위험한가 |
|---|---|
| `lib/supabase/client.ts` `ResultRow` | 4개 파일 + 2개 Edge Function이 같은 스키마를 가정. 컬럼 바꾸면 전부 손봐야 하고 타입은 수동 동기화 |
| `app/page.tsx` realtime 핸들러 | INSERT/UPDATE/DELETE 분기 + `initialLoadedRef`로 초기 로드/실시간 구분. 순서 바꾸면 휠 이중 회전 |
| `app/log`, `app/rank` realtime | INSERT/UPDATE 두 분기 구독. 분기 하나를 지우면 다시 돌리기(UPDATE)가 반영 안 된다 |
| `components/Wheel.tsx` useEffect | 회전 상태 머신. lint 에러 있는 곳. `lastSpinRef` 가드 제거하면 재회전 루프 |
| `supabase/migrations/0002_cron.sql` | 프로젝트 ref 하드코딩. 다른 Supabase로 옮기면 치환 필수 (README 참조) |
| `winnerIndex` (`app/page.tsx`) | `menus`에서 **이름으로** 찾는다. 당첨 메뉴가 삭제되면 -1 → 휠 하이라이트 사라짐. 중복 이름이면 첫 번째 |
| `lib/useRestaurants.ts` + `app/restaurants/page.tsx` | INSERT/UPDATE/DELETE 3분기 구독 + 인스턴스별 유일 토픽. 분기 하나를 지우면 그 이벤트가 조용히 반영되지 않고, 토픽을 고정 문자열로 바꾸면 라우트 전환에서 구독이 에러 없이 죽는다(초기 조회는 정상이라 눈에 띄지 않는다) |
| 클라이언트 에러 표면화 | 쓰기는 `actionError`, 초기 SELECT는 `loadError`(`lib/errors.ts` + `components/ErrorBanner.tsx`)로 배너 표시. 둘을 합치면 쓰기 성공이 읽기 실패 배너를 지운다. Realtime 구독 실패는 여전히 조용함 |

미사용 코드: `Wheel` `onSpinCompleteAction` prop (참조 0).

<!-- GSD:project-start source:PROJECT.md -->
## Project

**lunch_roulette — 매장 기준 룰렛 전환 + 설정 테이블**

로그인 없이 팀원 누구나 쓰는 점심 룰렛. 지금은 "메뉴명"을 자유 입력해 후보를 쌓고 매일 11:55 KST에 서버가 자동 추첨한다. 이번 작업으로 추첨 단위를 **매장**으로 바꾼다: 매장 카탈로그(이름 필수, 메뉴·위치 선택)를 영구 보관하고, 오늘 후보는 카탈로그에서 골라 담으며, 룰렛은 매장을 뽑는다. 추첨 시각·쿨다운은 DB `settings` 한 곳에서 관리한다.

**Core Value:** 매일 11:55(또는 설정 시각)에 **오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.** 이게 깨지면 나머지는 의미 없다.

### Constraints

- **Tech stack**: Next.js 16 App Router, 전부 클라이언트 컴포넌트 + supabase-js 직접 호출, inline style 객체 + CSS 변수, `~Action` 콜백 접미사 — 기존 컨벤션 유지(`.planning/codebase/CONVENTIONS.md`). 새 페이지도 같은 구조
- **Compatibility**: 앱은 매일 쓰이는 라이브. 컷오버 전까지 라이브 DB·함수·main 불변. 작업은 브랜치 `feat/restaurant-roulette`. 컷오버 마이그레이션은 하위호환 순서(새 테이블 생성 → 데이터 이관 없음 → 구 테이블 제거)로 한 파일
- **Deploy**: 프로덕션 배포는 사용자 명시 지시 때만. DB 마이그레이션은 Claude가 원격 실행 못 함(보안 차단) → 사용자가 대시보드 SQL Editor. Edge Function은 git과 별개로 `npx supabase@2.117.0 functions deploy <name> --project-ref swxiqytyxjlcgubqlozk`. main 직접 푸시 금지, PR 경유
- **Security**: RLS는 익명 개방(menus 계열·restaurants·candidates 누구나 쓰기), `results` 쓰기 service_role만, `settings` anon select-only. 브라우저 호출 Edge Function은 CORS+OPTIONS 단락 필수(게이트웨이 미주입)
- **Testing**: vitest. Edge Function 순수 로직은 Deno import 없는 `supabase/functions/_shared/`에 두어 vitest가 직접 import. tsc/eslint는 함수 디렉터리 2개(`spin-roulette/**`·`respin-roulette/**`)만 제외하고 `_shared/`는 포함(Phase 3 D-12)
- **Dev**: `npm run dev`는 가드런처로만(과거 커널 패닉). 브라우저 실등록 테스트는 라이브 오염이라 생략
- **Commit**: 커밋·PR에 AI 표기 금지. `.serena/project.yml` 커밋 금지
<!-- GSD:project-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

