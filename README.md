# 점심 룰렛 (Lunch Roulette)

매일 설정된 시각(기본 11:55 KST)에 서버가 자동으로 돌리는 익명 멀티유저 점심 **매장** 룰렛.

> 이 문서는 `0005` 마이그레이션 적용 + Edge Function 2종 배포 + PR 머지가 끝난 상태를 기술한다.
> 절차가 진행 중이면 아래 **컷오버 절차** 절을 본다. 코드 구조·컨벤션·위험 지점은 `CLAUDE.md` 가 정본이다.

## 개요

- 매장 탭에서 누구나 매장을 등록·수정·삭제·📌 고정 (이름 필수, 메뉴·위치 선택, 완전 익명)
- 오늘 탭에서 카탈로그를 토글해 오늘 후보를 담음. 📌 고정 매장은 매일 자정 자동으로 담김
- 설정 시각(`settings.spin_time`, 기본 11:55 KST)에 서버가 후보 중 하나를 뽑아 결과 확정 → 모든 접속자 화면에 동시 표시
- 결과는 그날 고정, "다시 돌리기" 로 덮어쓸 수 있음. 자정에 후보 초기화(고정 매장 재시드)
- 기록(캘린더)·랭킹은 전환일(`settings.history_since`) 이후 결과만 매장 기준으로 집계. 과거 결과 행은 DB 에 그대로 보존

## 스택

- Next.js 16 (App Router, 전부 클라이언트 컴포넌트) + TypeScript
- Supabase (Postgres, Realtime, Edge Functions, pg_cron, pg_net) — 무료 티어
- Vercel 배포 — 무료 티어
- 테스트 vitest, Edge Function 정적 검사 Deno

## 로컬 개발

```bash
cp .env.example .env.local       # NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm ci
npm run dev                      # http://localhost:3000
```

`npm run dev` 가 예전에 stale `.next` 캐시로 커널 패닉을 일으킨 적이 있다 — 재발하면 `rm -rf .next` 뒤 재기동(`CLAUDE.md` 참조).

검증 명령 5종(모두 exit 0 이어야 PR 을 연다):

```bash
npx tsc --noEmit     # 타입
npm run lint         # eslint
npm test             # vitest run — lib/·components/·supabase/functions/_shared/·supabase/migrations/·supabase/rollback/ 의 *.test.ts
npm run build        # 프로덕션 빌드 (NEXT_PUBLIC_SUPABASE_* 없으면 실패)
npm run check:edge   # deno check 두 Edge Function (로컬 deno 2.9.x 필요, Homebrew)
```

## 디렉토리

```
app/                    Next.js 페이지 — / 오늘 · /restaurants 매장 · /log 기록 · /rank 랭킹
components/             UI 컴포넌트 (supabase 를 부르지 않는다, 쓰기는 ~Action 콜백)
lib/                    순수 모듈(time·phase·settings·restaurants·candidates·history·rowset·menus·errors)
                        + I/O 훅(useSettings·useRestaurants·useCandidates) + supabase 클라이언트·행 타입
supabase/migrations/    0001~0005 마이그레이션 (+ 0005 텍스트 계약 spec)
supabase/rollback/      0005 롤백 SQL (+ 계약 spec) — migrations/ 밖에 두어 db push 가 읽지 않는다
supabase/functions/     Edge Function 2종 + _shared/ (Deno·클라이언트가 같은 파일로 쓰는 순수 로직)
design/                 React+Babel CDN 프로토타입 (빌드 대상 아님, 시각 참조용)
```

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new) → GitHub 로그인 → `F1rstID/lunch-roulette` 임포트 (Next.js 자동 감지)
2. **Environment Variables** (`.env.local` 값 그대로):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://swxiqytyxjlcgubqlozk.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_…`
3. `main` 머지마다 자동 배포. 롤백은 Vercel 대시보드 → Deployments → 이전 배포 "Promote to Production"

## Supabase 인프라

- 프로젝트 ref: `swxiqytyxjlcgubqlozk` (ap-northeast-2 / Seoul, F1rstID's Org). **같은 이름의 다른 프로젝트 `dtuwddiepnxygtotwglv` 에 배포하지 말 것.**
- 테이블 4개 (`supabase/migrations/0005_restaurants_settings.sql`):
  | 테이블 | 역할 | RLS(anon) |
  |---|---|---|
  | `restaurants` | 영구 매장 카탈로그 (name unique 1~24자, menus text[] ≤30×24자, location ≤200자, pinned) | select·insert·update·delete 전면 개방 |
  | `candidates` | 오늘 후보 (PK `restaurant_id` → cascade) | 전면 개방 |
  | `settings` | 단일행 id=1: `spin_time`(기본 11:55) · `cooldown_days`(기본 0) · `history_since`(기본 적용일) | **select 만** — 편집은 대시보드 SQL Editor(service_role) |
  | `results` | 확정 결과 영구 보존. `menu` = 매장명 스냅샷, `restaurant_id`(set null), `candidates` jsonb | select 만 — 쓰기는 Edge Function(service_role) |
- pg_cron 잡 3개 (전부 0005 가 등록, 재실행 안전형):
  - `spin-lunch-roulette` `* * * * *` — **매분** `spin-roulette` 를 pg_net 으로 호출. 시각 판정·멱등은 함수가 한다
  - `reset-candidates` `0 15 * * *` (KST 00:00) — `candidates` 비우고 📌 매장 재시드
  - `purge-cron-history` `30 15 * * *` — `cron.job_run_details` 7일 초과분 삭제
- Edge Function 2개 (`supabase/config.toml` 에 `verify_jwt = false` 고정 — true 로 배포되면 401 로 추첨이 조용히 멈춘다):
  - `spin-roulette` — 매분 호출됨. `settings.spin_time` 이후·그날 결과 없음·후보 있음일 때만 추첨(쿨다운 `_shared/cooldown.ts`). 실패는 `console.error` 로 Edge Function Logs 에
  - `respin-roulette` — 클라이언트 "다시 돌리기". POST 만(405), 시간 가드 없음, `results` upsert(`onConflict: date`). 컷오버 직후 새 스키마 경로를 사람이 확인할 수 있는 유일한 함수
- 설정 바꾸기(대시보드 SQL Editor):
  ```sql
  update public.settings set spin_time = '12:10', cooldown_days = 3 where id = 1;
  ```
  앱·함수 모두 Realtime/조회로 즉시 따른다. 재배포 불필요.
- 다른 Supabase 프로젝트로 옮길 때 `swxiqytyxjlcgubqlozk` 치환 위치: `supabase/migrations/0002_cron.sql`, `supabase/migrations/0005_restaurants_settings.sql`(spin 잡 URL), `supabase/rollback/0005_restaurants_settings.rollback.sql`, 이 README

## 컷오버 절차 (메뉴 모델 → 매장 모델, 1회)

라이브를 바꾸는 것은 이 절차뿐이다. Claude 는 원격 SQL 을 실행할 수 없으므로 **사람이** 순서대로 한다. 3~6 은 한 세션 안에 몇 분 내 연속 수행 — 그 사이가 벌어지면 구 코드가 사라진 `menus` 를 읽어 42P01, 매분 폴링이 500 을 낸다(`0005` 머리 주석).

0. **사전 기록** — `git rev-parse main` 결과(컷오버 전 해시)를 적어 둔다(롤백 3번에 필요). `gh auth status` 활성 계정이 `F1rstID` 인지, Vercel env 2개가 있는지 확인. 대시보드 Table Editor 에서 `menus`·`pinned_menus` 가 0행인지 육안 확인(0005 는 두 테이블을 이관 없이 떨군다).
1. **`results` 덤프 보관** — SQL Editor 에서 `select * from public.results order by date;` 결과를 CSV 로 내려받아 보관(Table Editor → Export 도 가능). 행 수를 적어 둔다(7번에서 대조).
2. **12:00 KST 이후에 시작** — 그날 추첨이 이미 끝나 있으면 매분 폴링이 멱등 skip 으로 떨어져 잃을 추첨이 없다.
3. **0005 적용** — SQL Editor 에 `supabase/migrations/0005_restaurants_settings.sql` 전체를 붙여 1회 실행. 에러로 끊기면 원인을 고치고 **같은 파일을 다시** 실행한다(모든 문이 재실행 안전형).
   - 3b. 그날 추첨 **이후** 적용했다면(2번대로면 항상) 전환일을 다음 날로 민다 — 그날의 구 모델 결과(메뉴명, `restaurant_id` null)가 기록·랭킹에 섞이지 않게:
     ```sql
     update public.settings set history_since = history_since + 1 where id = 1;
     ```
4. **Edge Function 2종 배포** — 레포 루트에서:
   ```bash
   npx supabase@2.117.0 functions deploy spin-roulette  --project-ref swxiqytyxjlcgubqlozk --no-verify-jwt
   npx supabase@2.117.0 functions deploy respin-roulette --project-ref swxiqytyxjlcgubqlozk --no-verify-jwt
   ```
   `config.toml` 이 이미 `verify_jwt = false` 라 플래그는 이중 안전이다. 함수 디렉터리 안에 `deno.json`·`import_map.json` 을 두지 않는다(배포 import map 으로 채택됨).
5. **`respin-roulette` 수동 확인** — 새 스키마 경로가 실제로 도는지 보는 유일한 창(`spin-roulette` 는 시간 가드 때문에 사전 확인 불가). 매장 1개 + 후보 1개가 있어야 하므로 SQL 로 넣고 부른다:
   ```sql
   insert into public.restaurants (name, menus) values ('컷오버 확인용', '{"테스트"}') returning id;
   insert into public.candidates (restaurant_id) select id from public.restaurants where name = '컷오버 확인용';
   ```
   ```bash
   curl -s -X POST https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/respin-roulette \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Content-Type: application/json" -d '{}'
   ```
   응답에 `ok: true`, `menu` 가 `"컷오버 확인용"`(문자열), `restaurant_id` 가 uuid 이면 통과. `menu` 가 빈 문자열이거나 `restaurant_id` 가 없으면 PostgREST 임베드 접기가 틀린 것 — **머지하지 말고 롤백 판단**(아래). 이 호출은 **그날의 구 모델 결과 행을 덮어쓴다**(`upsert onConflict: date`) — 원본은 1번 덤프에 있고, 3b 로 전환일을 다음 날로 밀었으므로 기록·랭킹에는 오지 않는다. 확인 뒤 `delete from public.restaurants where name = '컷오버 확인용';` (후보는 cascade, 오늘 결과 행은 `restaurant_id` 가 null 로 바뀌어 남고 7번의 실사용 다시 돌리기가 덮어쓴다).
6. **PR 머지** — `feat/restaurant-roulette` → `main`. Vercel 이 자동 배포(1~2분). 기록·랭킹의 명시 컬럼 조회는 3번이 먼저여야 동작한다(`results.restaurant_id`).
7. **라이브 확인** — 매장 탭에서 매장 등록 → 오늘 탭에서 후보 담기 → "다시 돌리기" → 매장명이 결과로 뜨고 휠이 그 조각을 가리키는지. 기록 탭에서 과거 날짜가 비어 있고(전환일 이전은 집계 제외), SQL Editor 에서 `select count(*) from public.results;` 가 1번 행 수와 **같은지**(오늘 행은 새로 생긴 것이 아니라 5·7번이 덮어쓴 것이다 — 행이 줄었으면 잘못된 것).
8. **익일 확인** — 다음 날 추첨 시각 + 5분에 `results` 에 그날 행이 있는지. 없으면 대시보드 Edge Function Logs 의 `spin-roulette` `console.error` 를 본다.
9. 문제가 생기면 아래 **롤백** 판단 기준으로.

## 롤백 (매장 모델 → 메뉴 모델)

**되돌리는 기준** — 다음 셋 중 하나면 롤백, 그 외 화면 문제는 hotfix:
- (a) 3번 0005 가 에러로 끊겼고 원인을 고쳐 재실행해도 넘어가지 않는다
- (b) 5번 `respin-roulette` 가 `ok: true` + 매장명 + uuid 를 주지 않는다
- (c) 8번 익일 추첨 시각 + 5분까지 `results` 행이 없고 Logs 의 `console.error` 로 원인을 바로 못 고친다

**순서** (컷오버의 역순 — SQL 먼저, 그다음 함수, 마지막 앱):
1. SQL Editor 에서 `supabase/rollback/0005_restaurants_settings.rollback.sql` 1회 실행 — 새 cron 3종 제거 → `menus`·`pinned_menus` 재생성(RLS·publication 포함) → 구 cron 2종 재등록(`spin-lunch-roulette` 11:55 고정, `reset-menus`). 재실행 안전형. `restaurants`·`candidates`·`settings`·`results.restaurant_id` 는 **남긴다**(구 코드에 무해, 재컷오버 때 데이터 보존). 파기는 파일 끝 주석 블록을 풀어 따로.
2. 구 Edge Function 재배포 — 0번에서 적어 둔 컷오버 전 `main` 해시로:
   ```bash
   git checkout <컷오버 전 main 해시> -- supabase/functions
   npx supabase@2.117.0 functions deploy spin-roulette  --project-ref swxiqytyxjlcgubqlozk --no-verify-jwt
   npx supabase@2.117.0 functions deploy respin-roulette --project-ref swxiqytyxjlcgubqlozk --no-verify-jwt
   git checkout HEAD -- supabase/functions
   ```
3. 앱 롤백 — 머지 전이면 아무것도 안 해도 된다. 머지 뒤면 Vercel 대시보드에서 이전 배포 "Promote to Production" 또는 `git revert -m 1 <머지 커밋>` 을 `main` 에 PR 로.
4. 확인 — 오늘 탭이 메뉴 입력 폼으로 돌아오고 `menus` 에 insert 가 되는지, 다음 11:55 에 `results` 행이 생기는지.

## 메모리 사용 주의

VS Code 의 백그라운드 인덱서(TS LSP, ESLint, Tailwind IntelliSense)가 `design/` 의 jsx 프로토타입과 큰 PNG 를 한꺼번에 스캔하면 메모리가 폭주할 수 있어, `.vscode/settings.json`·`eslint.config.mjs`·`tsconfig.json`·`globals.css` 의 Tailwind `@source` 모두에서 `design/` 과 Edge Function 디렉터리 2개(`spin-roulette/`·`respin-roulette/`)를 제외해 두었다. `_shared/` 는 제외하지 않는다(tsc·eslint·vitest 3중 검사). 제외를 다시 넓히지 말 것.
