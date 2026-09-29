# Phase 4: 서버 추첨 - Research

**Researched:** 2026-09-28
**Domain:** `deno check` 도입(설정·lock 위치 ↔ Supabase CLI 배포 경로) · 제네릭 없는 supabase-js 임베드 select 의 타입 ↔ PostgREST 런타임 형태 · `FunctionsHttpError`/`response` 본문 읽기 · jsr 버전 해석과 배포 번들의 관계 · Edge Function 관측성(`console.error`)
**Confidence:** HIGH (판정 19건을 이 머신에서 실제로 실행해 확인했다 — `deno check` 11회(플래그·config·lock·frozen 변형 + 타입 폭로 5회 + 전이 검사), 레포 `tsc` 2회, `npm test` 1회, Supabase CLI v2.117.0 소스 3파일 직독, `node_modules` 소스 3파일 직독. 레포에 만든 probe 파일(`supabase/functions/deno.json`·`deno.lock`·루트 `deno.lock`)은 전부 삭제했고 `git status --porcelain -uall` 이 조사 전과 동일함을 확인했다. 미검증 1건: 실호출·배포는 컷오버 전 불가 — Phase 8)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### deno 정적 검사 도입 (사용자 결정 D1, 로드맵 SC-5)
- **D-01 `deno check` 가 두 `index.ts` 의 정적 게이트다.** 모든 함수 수정 태스크의 완료 조건에 "두 파일 `deno check` exit 0" 을 넣는다. 호출 형태는 실측 통과한 두 가지 중 하나 — (a) `deno check --node-modules-dir=none <file>`, (b) `supabase/functions/deno.json` 에 `"nodeModulesDir": "none"` 을 두고 `deno check --config supabase/functions/deno.json <file>`. **리서치가 확정**한다: Supabase CLI 2.117.0 의 `functions deploy` 가 `supabase/functions/deno.json` 을 읽어 번들에 반영하는지(반영한다면 `nodeModulesDir`·`lock` 키가 배포 동작을 바꾸지 않는지)를 공식 문서로 확인하고, 바꿀 수 있으면 (a) 로 간다. 원칙: 루트 `package.json`·`node_modules` 오염 금지, 배포 동작 무변경, 명령은 `package.json` `scripts` 에 `"check:edge"` 로 고정해 `npm run check:edge` 한 줄로 두 파일을 검사한다(검증 명령 4개 → 5개, CLAUDE.md 갱신은 D-17).
- **D-02 `deno.lock`.** jsr 해석 버전을 고정해 `check:edge` 가 재현되게 한다. 기본안: (b) 를 택하면 `supabase/functions/deno.lock`(config 옆에 생성됨)을 커밋, (a) 를 택하면 `--lock supabase/functions/deno.lock` 을 스크립트에 명시. 루트 `deno.lock` 은 만들지 않는다(생기면 `.gitignore` 가 아니라 명령을 고친다). 리서치가 lock 이 배포 번들에 영향 없음을 함께 확인.

#### Edge Function 본문 (SPIN-01·SPIN-04·SETT-04, SPIN-02 마감 — 로드맵 SC-1·2·3)
- **D-03 후보 조회 = `candidates` → `restaurants` 조인.** `from("candidates").select("restaurant_id, created_at, restaurants ( id, name )").order("created_at", { ascending: true })` 형태(FK `candidates.restaurant_id → restaurants.id` 임베드). 정확한 임베드 문법·결과 형태(many-to-one 이 객체로 오는지, 조인 미스 시 `null` 인지)는 **리서치가 supabase-js 2.117 / PostgREST 문서로 확정**. 정규화 결과는 `{ restaurant_id: string; name: string }[]` — 임베드가 `null` 인 행(조회 사이에 매장이 삭제된 경합)은 **제외**하고 `console.error` 로 남긴다(삼키지 않음). 정규화·순서 유지 로직은 함수 안 순수 헬퍼로 두고 이름을 두 파일에서 같게 한다.
- **D-04 설정 읽기 정책(사용자 결정 D2).** `from("settings").select("spin_time, cooldown_days").eq("id", 1).maybeSingle()`. (1) `row === null`(0행) → 기본값(`DEFAULT_SPIN_TIME`, 쿨다운 0), 에러 아님, 플래그 없음. (2) **조회 에러** → 기본값으로 **진행** + `console.error` + 응답 `settings_fallback: true`. (3) `parseSpinTime(row.spin_time) === null` → `DEFAULT_SPIN_TIME` + 같은 플래그(클라이언트 `settingsFromRow` 의 warning 과 대칭). `cooldown_days` 는 그대로 `cooldownWindowStart` 에 넘긴다(오염 입력은 그쪽이 `null` = 창 없음으로 흡수). 근거: Core Value "매일 하나가 자동 확정" > 설정 존중; 클라이언트 SETT-03 과 같은 규칙. `respin-roulette` 는 `cooldown_days` 만 쓰지만 같은 조회·같은 정책.
- **D-05 `spin-roulette` 순서(변경 금지).** `kstNow()` → 설정(D-04) → `isAfterSpinTime(now, spinTime)` 거짓이면 `{ skipped: "before_spin_time", kst: now }`(8필드 유지 — cron 로그에서 함수가 본 시각을 보는 유일한 창) → 오늘 `results` 존재(`select("date, menu, restaurant_id")`, D-18) → `{ skipped: "already_decided", date, menu, restaurant_id }` → 후보(D-03) 0개 → `{ skipped: "no_candidates", date }`(행 미생성 = SPIN-03 서버 반) → 쿨다운(D-06) → `pickRandom(picked)` → `insert({ date, menu: winner.name, restaurant_id: winner.restaurant_id, candidates: snapshot })` → `23505` → `{ skipped: "race_already_decided", date }`; 그 외 insert 에러 → 500. 설정 읽기가 시각 판정보다 앞서는 이유: 판정 자체가 `settings.spin_time` 에 의존한다. 매분 폴링 전제에서 추첨 전 구간은 조회 1회/분(settings)이고, 그 값은 무료 티어 여유 안이다(PROJECT "cron 매분 폴링").
- **D-06 쿨다운 배선(SPIN-02 마감).** `const from = cooldownWindowStart(now.date, cooldownDays)`. `null` 이면 **조회를 생략**한다(쿨다운 0 = 쿼리 0회 = 전환 전과 동일 경로, SETT-04 의 근거). 아니면 `from("results").select("restaurant_id").gte("date", from).lt("date", now.date)` → `applyCooldown(candidates, rows.map(r => r.restaurant_id))`. 조회 에러 → 쿨다운 **미적용으로 진행** + `console.error` + 응답 `cooldown_skipped: true`(D-04 와 같은 Core Value 논증). `applyCooldown.fellBack` → 응답 `cooldown_fallback: true`. 창 의미(오늘 제외 `[today−N, today−1]`, `null` id 무시, 비면 전체 폴백)는 03-CONTEXT D-05 그대로 — 여기서 재정의하지 않는다.
- **D-07 `respin-roulette`.** 유지: CORS 헤더·`OPTIONS` 단락·`json()` 헬퍼·시간 가드 없음·멱등 없음(오늘 결과가 없어도 행을 만든다 — 현행 동작이고 `stalled` 상태의 "지금 돌리기" 여지). 변경: 후보 D-03, 설정 D-04(`cooldown_days`), 쿨다운 D-06, `upsert({ date, menu, restaurant_id, candidates, spun_at: new Date().toISOString() }, { onConflict: "date" })`. 에러는 전부 `json({ error: message }, 500)` + `console.error`. `spinTime.ts` 는 여전히 import 하지 않는다(#17 유지 — 시간 가드가 없으니 `parseSpinTime` 도 불필요).
- **D-08 스냅샷 형태(02-CONTEXT D-04 확정 사항의 실행).** `candidates: [{ name, restaurant_id }]` (담은 순서). `lib/supabase/client.ts` `ResultRow.candidates` → `{ name: string; restaurant_id?: string }[]` — 레거시 60행에는 키가 없으므로 **optional**. `components/CalendarLog.tsx` 는 `name` 만 읽어 무변경(`npx tsc --noEmit` exit 0 으로 확인). 주석에 "Phase 4 부터 restaurant_id 포함, 이전 행은 name 만" 을 남긴다.
- **D-09 응답 JSON 계약(두 함수 공통 키).** ok 경로: `{ ok: true, date, menu, restaurant_id, candidate_count, cooldown_fallback, cooldown_skipped, settings_fallback }` — 세 boolean 은 **항상 존재**(계약 테스트·로그 grep 이 쉬움). skip 경로: `{ skipped: "before_spin_time" | "already_decided" | "no_candidates" | "race_already_decided", date, … }`. 에러: `{ error: string }` + status 500. `menu` 키 이름은 유지(컬럼명과 같고 `app/page.tsx` `RespinResponse` 와 호환). `candidate_count` 는 쿨다운 **적용 전** 후보 수(전환 전 의미 유지); 적용 후 수는 `picked_count` 로 따로 싣는다.
- **D-10 `console.error` 규약 신설.** 500 경로·폴백 경로(D-04 (2)(3), D-06 조회 에러, D-03 조인 미스)마다 `console.error` 1건. 메시지에 맥락(무엇이·어떤 값으로 실패했나 — 예: `settings 조회 실패: <message>`, `spin_time 파싱 실패: "<raw>"`). 현재 레포 `console.*` 0건이라 규약을 CLAUDE.md 에 한 줄로 기록한다(D-17). 클라이언트(`app/`·`lib/`)에는 도입하지 않는다 — 거기는 배너가 채널이다.
- **D-11 타입은 함수 안 로컬.** `SettingsRow`·조인 행·`ResultRow` 를 `lib/` 에서 가져올 수 없다(Deno). 각 `index.ts` 안에 필요한 최소 구조 타입을 선언하고 주석으로 `lib/supabase/client.ts` 와 상호 참조한다. **`_shared` 에 새 모듈을 추가하지 않는다** — 순수 판정 조합(`decideSpin` 류)은 `_shared` 파일 간 import 를 요구해 import 0개 규칙과 충돌한다(03-CONTEXT D-02·D-17). jsr import 가 있는 파일을 `_shared` 에 두는 것도 금지(tsc·vitest 수집 범위 `_shared/**` 가 깨진다). 두 함수의 I/O 중복(설정·후보·쿨다운 조회)은 수용하고 계약 테스트가 양쪽을 같은 규칙으로 고정한다(D-14).

### 클라이언트 — respin 500 본문 표면화 (사용자 결정 D3, todo wr-02)
- **D-12 `app/page.tsx` `respin()`.** `import { FunctionsHttpError } from "@supabase/supabase-js"`(값 import — page.tsx 는 이미 `supabase` 값을 import 한다). `error instanceof FunctionsHttpError` 이면 `const body = await error.context.json().catch(() => null)` 로 본문을 한 번 읽고, 메시지는 D-13 헬퍼로 조립해 `setActionError(\`다시 돌리기 실패: ${message}\`)`. `RespinResponse.error` 가 실제로 읽힌다. `.catch` 인 이유: 본문이 JSON 이 아닐 때(게이트웨이 HTML) 두 번째 예외로 배너가 사라지면 안 된다.
- **D-13 순수 헬퍼 + 테스트.** `lib/errors.ts` 에 `formatRespinError(fallbackMessage: string, body: unknown): string` — `body` 가 `{ error: string }`(비어 있지 않은 문자열)이면 그것, 아니면 `fallbackMessage`. `lib/errors.test.ts` 에 3케이스(본문 우선 / 본문 null·비객체 / `error` 가 빈 문자열). `instanceof`·`json()` 은 페이지(I/O)에, 판단은 순수 모듈에 — "훅에는 I/O 만, 판단은 순수 모듈로" 컨벤션의 페이지 적용. `lib/errors.ts` 의 supabase 값 import 0 유지(`FunctionsHttpError` 는 페이지에서만).
- **D-13a** 해결 시 `.planning/todos/pending/wr-02-respin-error-body.md` 를 **삭제**한다(Phase 3 에서 in-03-04 를 처리한 관례 — `done/` 디렉터리 없음).

### 테스트·검증 (로드맵 SC-4·SC-5, QUAL 관례)
- **D-14 `edgeImports.test.ts` 계약 갱신.** 유지: #1~#6(`_shared` 3파일 import 0), #7a/#16a(진입점 1개), #7·#8·#16(import 경로), #9~#14·#18~#21(복붙 부재), #15(23505 1회), #17(respin 은 spinTime 미import), #22(OPTIONS·CORS). 추가(두 파일 각각): `from("menus")` **0회**, `from("candidates")` 1회, `from("settings")` 1회, `from("results")` ≥1, `restaurants` 임베드 토큰 존재, `"../_shared/cooldown.ts"` import 1회, `cooldownWindowStart(`·`applyCooldown(` 각 1회, `restaurant_id` 가 insert/upsert 본문에 존재, `console.error(` ≥1, `settings_fallback`·`cooldown_fallback`·`cooldown_skipped` 토큰 존재. spin 만: `parseSpinTime(`·`DEFAULT_SPIN_TIME` 존재, 순서 불변식 — `isAfterSpinTime(` 의 `indexOf` < 멱등 조회 < 후보 조회 < `applyCooldown(` < `.insert(`(토큰 위치 비교로 D-05 순서를 고정). respin 만: `.upsert(` 1회, `onConflict: "date"` 1회. **기준 숫자는 플래너가 실측 후 기입**(Phase 3 grep 오기 12건 전례), 주석 제거 사본에서 세고 금지 토큰은 소스 주석에 쓰지 않는다.
- **D-15 SC-4 "기본 설정에서 전환 전과 동일" 테스트.** 순수 조합 모듈이 없으므로(D-11) `_shared` 단위 테스트로 표현한다: `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` `toEqual(DEFAULT_SPIN_TIME)`(추가), `parseSpinTime("11:55:00")` 동일(있으면 인용), `isAfterSpinTime` 11:54:59/11:55:00 경계(기존 인용), `cooldownWindowStart(today, 0) === null`(기존 인용), `applyCooldown(c, [])` 항등(기존 인용). 없는 것만 추가하고 있는 것은 플랜에 "인용" 으로 적는다. **한계를 SUMMARY 에 명시**: `index.ts` 본문의 순서·분기는 D-14 의 텍스트 순서 단언 + `deno check` 타입 통과 + 낭독으로만 검증되고, 실호출은 Phase 8.
- **D-16 완료 조건 5종.** `npx tsc --noEmit`·`npm run lint`·`npm test`·`npm run build`(기존 4) + `npm run check:edge`(D-01). RED 커밋에서 `check:edge` 적색 허용은 **없다** — 계약 테스트 RED 는 vitest 에서만 나타나고 `deno check` 는 항상 초록이어야 한다(타입이 깨진 함수를 커밋하지 않는다).

### 문서 (Phase 3 D-16 선례 — 낡은 진술은 이 페이즈에서 정정)
- **D-17 CLAUDE.md.** (1) 검증 명령 블록에 `npm run check:edge   # deno check 두 Edge Function (유일한 정적 검사)` 추가. (2) `:41` "두 `index.ts` 본문은 여전히 사각지대 — … 낭독으로만 검증되므로 수정 후 직접 확인" → "`deno check`(`npm run check:edge`)가 두 `index.ts` 를 검사한다. 실호출은 컷오버 전 불가" 로 정정. (3) 엔트리포인트의 `spin-roulette`·`respin-roulette` 설명을 `candidates`→`restaurants` 조인 + `settings` + 쿨다운으로 갱신, "흐름" 문단의 `menus` 언급 정정. (4) 코드 컨벤션에 D-10 한 줄("Edge Function 실패·폴백 경로는 `console.error` 로 Supabase 로그에 남긴다. 클라이언트는 배너"). (5) 비표준 규약의 "`deno` 는 로컬에 없다" 류 진술이 있으면 정정. `.planning/codebase/CONVENTIONS.md`·`CONCERNS.md` 의 "Edge Function 타입체크 사각지대"·"deno check 수동 실행" 진술도 같은 커밋에서 정정(라인은 플래너가 실측). `.planning/todos/pending/wr-01-cutover-window.md` 4번 "`--no-verify-jwt` 필수(config.toml 없음)" → "`supabase/config.toml` 에 `verify_jwt = false` 고정(63fae89); `--no-verify-jwt` 병행은 이중 안전" 으로 정정(a525d4c 에서 CLAUDE.md 는 이미 고침). README 의 Edge 설명은 Phase 8 SHIP-03 에 남긴다.
- **D-18** 멱등 검사 컬럼 `select("date, menu")` → `select("date, menu, restaurant_id")`, `already_decided` 응답에 `restaurant_id` 포함(D-05).

### Claude's Discretion
- 함수 내부 헬퍼·로컬 타입 이름, `console.error` 문안(한글 Why 주석 규칙과 별개로 로그 메시지는 한글 가능), 계약 테스트 번호 체계(#23 부터 이어 붙일지 describe 를 나눌지), `deno.json` 의 추가 키(`compilerOptions` 등은 넣지 않는 쪽을 기본으로).
- 플랜 분할 권장: **04-01** `check:edge` 도입(D-01·D-02) + `ResultRow` 타입(D-08) + 계약 테스트 RED(D-14) — Wave 0(정적 게이트가 먼저 켜져야 이후 RED/GREEN 이 타입까지 본다) / **04-02** `spin-roulette` 재작성(D-03~D-06·D-09~D-11·D-18) + D-15 테스트 / **04-03** `respin-roulette`(D-07) + `respin()`·`formatRespinError`(D-12·D-13·D-13a) + 문서(D-17).

### Deferred Ideas (OUT OF SCOPE)
- Edge Function 배포·`--no-verify-jwt`·`respin-roulette` 수동 invoke 검증 — Phase 8(SHIP-04)
- `app/page.tsx` 후보 소스 `menus` → `candidates`, `winnerIndex` 이름→id — Phase 6
- `respin-roulette` 인증·레이트리밋·"오늘 결과 없으면 거부" — 범위 밖(익명 서비스 설계상 수용, CONCERNS 기록 유지)
- `_shared` 순수 판정 조합 모듈(`allowImportingTsExtensions` 로 파일 간 `.ts` import 를 허용하는 안) — 리서치 Open Question 으로만 검토, 이 페이즈에 채택하지 않음
- 결과 없는 날 감지 헬스체크 cron·`net._http_response` 점검 — 범위 밖
- README Edge Function 설명 현행화 — Phase 8 SHIP-03
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SPIN-01** | 설정된 추첨 시각 이후 첫 폴링(매분)에서 오늘 후보 중 매장 하나가 자동 확정된다. 하루 1회 멱등 | §Q-2 — `settings` `maybeSingle()` 의 추론 타입이 `{ spin_time: any; cooldown_days: any } \| null`(실측)이라 `parseSpinTime` 에 넘기기 전 `typeof === "string"` 좁히기가 필요하다. §Q-6b — `PostgrestError.code` 가 `string` 이라 `insErr.code === "23505"` 가 타입 통과(실측). §Pitfall 6 — 멱등 SELECT 의 **에러 경로가 D-05 에 없다**(23505 가 보험이라 진행이 정답) |
| **SPIN-02** | `cooldown_days` > 0이면 최근 N일 당첨 매장은 후보에서 제외. 제외 후 비면 전체 폴백 | §Code Example 1 — `applyCooldown(candidates, ids)` 배선이 `deno check` 통과함을 실제 스켈레톤으로 확인. `recent` 행의 `restaurant_id` 가 `any` 라 `(string \| null)[]` 로 좁혀 넘겨야 `Iterable<string \| null>` 계약과 맞는다. 순수 함수 5경로는 Phase 3 이 이미 14케이스로 덮었다(`cooldown.test.ts`) |
| **SPIN-04** | 다시 돌리기는 오늘 후보에서 다시 뽑아(쿨다운 적용) 결과를 덮어쓴다. 횟수 무제한 | §Q-3 — `FunctionsHttpError.context` 가 읽히지 않은 `Response` 임을 설치본 소스로 확인. **더 나은 경로 발견**: `invoke()` 반환 객체의 `response` 필드가 `Response \| undefined` 로 타입돼 있어 `any` 체인과 값 import 없이 본문을 읽는다. §Pitfall 2 — 500 응답에 CORS 헤더가 없으면 브라우저가 본문을 차단해 D-12 가 조용히 무력화된다 |
| **SETT-04** | 마이그레이션 직후(기본값) 동작은 현재와 동일하다 — 11:55 추첨, 쿨다운 없음 | §Validation Architecture — D-15 5항목 중 **4항목은 이미 존재**(`spinTime.test.ts` #2·#12·#13, `cooldown.test.ts` #1·#7), 없는 것은 `parseSpinTime(DEFAULT_SPIN_TIME_TEXT) toEqual DEFAULT_SPIN_TIME` 왕복 1건뿐이다(실측) |
</phase_requirements>

## Summary

이 페이즈의 기술적 난점은 로직이 아니라 **"정적 검사가 통과했다"는 신호를 어디까지 믿을 수 있는가**다. 그리고 조사 결과 그 신호는 한 지점에서 **거짓말을 한다.** `Database` 제네릭 없이 만든 supabase-js 클라이언트에서 `from("candidates").select("restaurant_id, created_at, restaurants ( id, name )")` 의 추론 타입은 실측으로 `{ restaurant_id: any; created_at: any; restaurants: { id: any; name: any }[] }[] | null` 이다 — **임베드가 배열**이다. 그런데 PostgREST 는 many-to-one 임베드를 **객체**로 돌려준다(공식 문서 인용). 즉 `row.restaurants[0].name` 은 `deno check` 를 통과하면서 런타임에 `undefined` 를 주고, `row.restaurants.name` 은 정답인데 컴파일 에러가 난다. D-01 이 도입하는 `deno check` 는 이 페이즈 최대의 안전장치이지만 **바로 이 한 줄에서는 안전장치가 아니라 함정**이다. 해법은 조회 결과를 추론 타입으로 소비하지 않는 것 — `unknown` 으로 받아 런타임에 좁히는 정규화 헬퍼를 두면 배열/객체 양쪽을 한 줄로 흡수하면서 D-03 이 요구한 "조인 미스 행 제외 + `console.error`" 까지 같은 함수에서 끝난다. 이 형태가 실제로 컴파일되는 것을 전체 스켈레톤을 작성해 `deno check` 로 확인했다(§Code Examples 1, `as` 없는 변형도 통과).

두 번째 발견은 D-01·D-02 의 선택지를 뒤집는다. Supabase CLI **v2.117.0 소스를 직독**한 결과 `functions deploy` 의 import map 탐색은 `<functionsDir>/<slug>/deno.json` — **함수 디렉터리 안만** 본다(`apps/cli/src/shared/functions/deploy.ts:810`·`apps/cli-go/pkg/config/config.go:933-941`). `supabase/functions/deno.json` 은 그 목록에 없다 → **배포에 전혀 보이지 않는다**(반대로 함수 디렉터리 안에 두면 그 파일이 import map 으로 채택되므로 절대 거기 두면 안 된다). 게다가 배포 번들러는 이미 `DENO_NO_PACKAGE_JSON=1` 로 실행돼(`deploy.ts:1447-1452`) 로컬 `deno check` 가 넘어지는 원인(루트 `package.json` → BYONM → `npm:openai` 타입 미해결)을 애초에 우회한다. 그리고 `deploy.ts` 전체에 `lock` 이라는 단어가 **0건**이다 — lock 은 읽히지도, 업로드되지도 않는다. 결론: (a)·(b) 모두 배포 동작을 바꾸지 않으므로 선택 기준은 순전히 **lock 파일의 유지비**인데, 실측이 (b) 의 우위를 보였다 — (a) 로 만든 lock 은 루트 `package.json` 의 의존성 13개를 `workspace.packageJson` 섹션에 박아 넣어(295줄) `npm` 의존성을 건드릴 때마다 흔들리고, (b) 로 만든 lock 은 그 섹션이 없다(276줄). **D-01 의 "바꿀 수 있으면 (a)" 를 (b) 로 뒤집기를 권고한다**(CONTEXT 수정 권고 1건). 덤으로 (b) 는 `deno check --config …` 한 번에 `_shared/*.ts` 까지 전이 검사하므로 `_shared` 가 tsc 5.9.3 과 Deno 내장 TS 6.0.3 **두 컴파일러**의 검사를 받게 된다(실측).

세 번째는 D-12 를 더 단단하게 만드는 발견이다. `functions.invoke()` 의 반환 객체에는 `data`·`error` 외에 **`response` 필드**가 있고 레포 tsc 5.9.3 에서 그 타입이 `Response | undefined` 로 나온다(실측). 구현은 non-2xx 에서 `throw new FunctionsHttpError(response)` 를 던진 뒤 `catch` 에서 `{ data: null, error, response: error.context }` 를 돌려준다 — 즉 `response` 는 `error.context` 와 **같은 객체**이고 본문은 읽히지 않은 상태다(`FunctionsClient.js:262,285-291` 직독). `error` 는 타입이 `any` 이고 `error.context` 도 `any` 인데, `response` 만은 제대로 타입돼 있다. `FunctionsHttpError` 값 import 없이 `any` 를 한 번도 거치지 않고 본문을 읽는 길이 있다는 뜻이다(§Q-3 권고). 다만 **CORS 함정**이 D-12 의 전제를 무너뜨릴 수 있다: 500 응답에 `Access-Control-Allow-Origin` 이 없으면 브라우저가 응답 자체를 차단하고 supabase-js 는 `FunctionsHttpError` 가 아니라 `FunctionsFetchError` 를 주므로 본문이 영원히 안 보인다. D-07 의 `json()` 헬퍼를 **모든** 반환 경로에 쓰는 것이 D-12 의 선행 조건이다.

**Primary recommendation:** `check:edge` 는 (b) `deno check --config supabase/functions/deno.json <두 파일>` 로 고정하고(`deno.json` = `{"nodeModulesDir":"none"}` 한 줄, lock 은 그 옆에 자동 생성 — 둘 다 커밋), 조회 결과는 **절대 추론 타입으로 소비하지 말고** `unknown` → 런타임 좁히기 헬퍼를 거치게 한다. respin 의 500 본문은 `FunctionsHttpError` 대신 `response` 필드로 읽고, 두 함수의 모든 반환을 `json()` 헬퍼 하나로 통일한다.

---

## 오케스트레이터 질문 5건 + 추가 확인 6건 — 실측 답변

> 레포에 만든 probe(`supabase/functions/deno.json`, `supabase/functions/deno.lock`, 루트 `deno.lock`)는 전부 삭제했고 `git status --porcelain --untracked-files=all` 이 조사 전과 동일함을 확인했다. 복원 검증: `npx tsc --noEmit` exit 0 · `npm test` 189/189(10 files, 185ms).

### Q-1. Supabase CLI 2.117.0 `functions deploy` 는 `supabase/functions/deno.json` 을 보는가 → **아니다**

**(a) import map 탐색 경로 — CLI 소스 직독.**
CLI 2.117.0 은 npm 패키지가 플랫폼 바이너리를 띄우는 구조다(`dist/supabase.js` 2KB 런처 → `@supabase/cli-darwin-arm64/bin/supabase`). 그 구현 두 갈래를 GitHub `v2.117.0` 태그에서 직접 읽었다.

TypeScript 구현(`apps/cli/src/shared/functions/deploy.ts:1995-2021`) 의 해석 순서:

| 순위 | 출처 | 비고 |
|------|------|------|
| 1 | `--import-map <path>` 플래그 | `functions deploy --help` 에 존재(실측) |
| 2 | `config.toml [functions.<slug>] import_map` | `supabase/` 기준 상대 경로 |
| 3 | `<functionDir>/deno.json` | `functionDir = dirname(entrypoint)` = `supabase/functions/<slug>/` |
| 4 | `<functionDir>/deno.jsonc` | 〃 |
| 5 | `<functionDir>/import_map.json` | deprecated, 경고 출력 |
| 6 | `supabase/functions/import_map.json` | fallback, 경고 출력 |

Go 구현(`apps/cli-go/pkg/config/config.go:933-941`)도 **같은 규칙**이다:
```go
if len(function.ImportMap) == 0 {
    functionDir := filepath.Dir(function.Entrypoint)
    denoJsonPath := filepath.Join(functionDir, "deno.json")
    denoJsoncPath := filepath.Join(functionDir, "deno.jsonc")
    ...
    // Functions may not use import map so we don't set a default value
}
```
→ **`supabase/functions/deno.json` 은 6개 경로 어디에도 없다. 배포는 그 파일을 열지 않는다.** `--help` 에 `--config` 류 플래그도 없다(실측 — 플래그는 `--project-ref`·`--no-verify-jwt`·`--use-api`·`--import-map`·`--prune`·`--jobs` 뿐).
`[VERIFIED: github.com/supabase/cli @ v2.117.0 소스 직독 + `npx --offline supabase@2.117.0 functions deploy --help`]`

**(b) 반대로 함수 디렉터리 안에 두면 위험하다.** 거기 있는 `deno.json` 은 3순위로 **import map 으로 채택**되고, CLI 의 파서는 `imports`·`scopes`·`importMap`(참조 키) 세 필드만 읽는다(`apps/cli-go/pkg/function/deno.go:21-47`). `{"nodeModulesDir":"none"}` 은 그 셋이 전부 비어 있어 "빈 import map" 이 되고, 번들러 인자 구성이 달라진다(`shouldUseDenoJsonDiscovery` 가 true 가 되면 `--import-map` 플래그를 생략하고 컨테이너 안 Deno 의 자동 탐색에 맡긴다 — `deploy.ts:1365-1367,1465-1470`). **배포 입력이 바뀐다** → 함수 디렉터리 안에는 절대 두지 않는다.
`[VERIFIED: 같은 소스]`

**(c) `nodeModulesDir`·`lock` 키가 배포를 바꾸는가 — 바꿀 수 없다(파일이 안 읽히므로). 그리고 배포 쪽은 이미 같은 문제를 우회한다.**
```ts
// deploy.ts:1447-1452
if (!(yield* Effect.promise(() => shouldUsePackageJsonDiscovery(config.entrypoint, config.importMap)))) {
  env.push("DENO_NO_PACKAGE_JSON=1");
}
// :1369-1379 — package.json 을 "entrypoint 옆" 에서만 찾는다(레포 루트가 아니다)
```
`supabase/functions/<slug>/package.json` 이 없으므로 번들러는 `DENO_NO_PACKAGE_JSON=1` 로 돈다 = 로컬의 `--node-modules-dir=none` 과 같은 효과. 그래서 배포는 지금까지 `npm:openai` 타입 문제를 만난 적이 없다.
`[VERIFIED: 같은 소스]`

**(d) `deno.lock` 은 배포와 무관하다.** `deploy.ts`(2,505줄) 전체에 `lock` 문자열이 **0건**이다. `SIDE_EFFECTS.md` 의 "Files Read" 표에도 lock 이 없다(읽는 것은 `config.toml`·`<slug>/index.ts`·`functions/**/deno.json*`·import 그래프로 도달한 모듈·`static_files`·`functions/import_map.json`).
`[VERIFIED: 같은 소스 + apps/cli/src/commands/functions/deploy/SIDE_EFFECTS.md]`

**(e) 실측 — 네 가지 호출 형태(레포 루트 cwd, 두 `index.ts` 모두):**

| 호출 | 결과 | 생성 파일 |
|------|------|-----------|
| `deno check <file>`(플래그 없음) | **실패** `Failed resolving types. Could not find a matching package for 'npm:openai@^4.52.5'` at `jsr.io/@supabase/functions-js/2.117.2/src/edge-runtime.d.ts:192:25` | 없음 (실패 시엔 lock 도 안 만든다) |
| `deno check --node-modules-dir=none <2 files>` | **통과** (0.47s, exit 0) | **루트 `deno.lock`** (295줄) |
| `deno check --node-modules-dir=none --lock supabase/functions/deno.lock <2 files>` | **통과** | `supabase/functions/deno.lock` 만 (295줄, `workspace.packageJson` 포함) |
| `deno check --config supabase/functions/deno.json <2 files>` | **통과** | `supabase/functions/deno.lock` (276줄, **`workspace.packageJson` 없음**) |
| `supabase/functions/deno.json` 이 있는 상태로 플래그 없이 루트에서 `deno check` | **실패**(같은 에러) — deno 는 **cwd 기준**으로 위로만 탐색하고 하위 디렉터리 config 를 자동 발견하지 않는다 | 없음 |
| cwd 를 `supabase/functions` 로 옮기고 플래그 없이 `deno check spin-roulette/index.ts respin-roulette/index.ts` | **통과**(config 자동 발견) | 〃 |

`[VERIFIED: deno 2.9.7 실행 6회, 각 실행 후 git status diff 로 생성 파일 확인 후 삭제]`
`[CITED: docs.deno.com/runtime/fundamentals/configuration/ — "Deno automatically detects a deno.json or deno.jsonc file in your current working directory or any parent directory"]`

**(f) 판정 — (b) 를 권고한다(D-01 의 기본 선호와 반대).**

| 기준 | (a) `--node-modules-dir=none --lock …` | (b) `--config supabase/functions/deno.json` |
|------|-----------------------------------------|---------------------------------------------|
| 배포 영향 | 없음 | 없음 (Q-1a — CLI 가 그 경로를 안 본다) |
| 추가 커밋 파일 | lock 1개 | deno.json 1개 + lock 1개 |
| lock 내용 | **루트 `package.json` 의존성 13개가 `workspace.packageJson` 에 박힌다** (295줄) → `npm` 의존성 추가·범프마다 lock 이 흔들리고 diff 가 Edge 와 무관하게 커진다 | 그 섹션이 **없다** (276줄). `package.json` 변경과 완전히 독립 |
| 명령 길이 | 플래그 2개 | 플래그 1개 |
| 이유의 소재지 | `package.json` `scripts` 한 줄(주석 불가) | `deno.json`(→ `deno.jsonc` 로 하면 한글 Why 주석을 파일에 남길 수 있다 — 레포의 "파일 머리 주석" 컨벤션과 맞는다) |

정확한 스크립트 한 줄(실측 통과, 0.47s):
```json
"check:edge": "deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts"
```
`supabase/functions/deno.json`:
```json
{ "nodeModulesDir": "none" }
```
(a) 를 택할 경우의 한 줄:
```json
"check:edge": "deno check --node-modules-dir=none --lock supabase/functions/deno.lock supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts"
```

### Q-2. `candidates` → `restaurants` 임베드의 select 문자열·결과 형태·정렬·타입

**(a) 런타임 형태: many-to-one 임베드는 JSON 객체다 — CITED.**
PostgREST 문서의 many-to-one 예시가 정확히 이 형태다:
> *"Note that the embedded `directors` is returned as a JSON object because of the 'to-one' end."*
```json
[ { "title": "…", "directors": { "id": 2, "last_name": "Lumière" } } ]
```
`[CITED: docs.postgrest.org/en/v13/references/api/resource_embedding.html]`
Supabase 쪽 문서도 같은 취지로 "one-to-many 는 `[]`, many-to-one 은 매칭이 없으면 `null`" 이라 적는다.
`[CITED: supabase.com/docs/guides/database/joins-and-nesting — 요약 인용, MEDIUM]`

**(b) 정적 타입은 배열이라고 주장한다 — VERIFIED. ⚠ 이 페이즈 최대 함정.**
`createClient("…","…")`(제네릭 없음)에 대해 네 가지 select 변형의 추론 타입을 `deno check` 로 폭로했다(`const reveal: never = data;` 트릭):

| select 문자열 | 추론된 `data` 타입 |
|---------------|--------------------|
| `"restaurant_id, restaurants(id, name)"` | `{ restaurant_id: any; restaurants: { id: any; name: any; }[]; }[] \| null` |
| `"restaurant_id, restaurants ( id, name )"` (공백 有) | **동일** |
| `"restaurant_id, restaurants!inner(id, name)"` | **동일**(`!inner` 는 타입에 영향 없음) |
| `"restaurant_id, restaurant:restaurants(id, name)"` | 키 이름만 `restaurant` 로 바뀜, 여전히 배열 |
| `"restaurant_id, created_at, restaurants ( id, name )"` | `{ restaurant_id: any; created_at: any; restaurants: { id: any; name: any; }[]; }[] \| null` |

→ **공백·`!inner`·별칭에 대해 타입 파서는 관대하다**(D-14 가 임베드 토큰을 문자열로 단언할 때 공백 변형을 허용할 근거). 그러나 **모든 변형에서 임베드가 배열**이다. `Database` 제네릭이 없어 FK 관계 메타데이터가 없으니 to-one 을 판정할 수 없어 배열로 떨어진다. 즉:
- `row.restaurants.name` → 컴파일 에러(정답인데 막힌다)
- `row.restaurants[0].name` → 컴파일 통과 + 런타임 `undefined`(오답인데 통과한다)

`deno check` 가 이 한 줄에서는 오히려 잘못된 코드를 인증한다.
`[VERIFIED: deno check 2회 — jsr:@supabase/supabase-js@2 → 2.117.2]`

**(c) 대응: 추론 타입을 소비하지 않는다.** `data` 를 `unknown` 을 받는 정규화 헬퍼에 그대로 넘기면(추론 타입 → `unknown` 대입은 항상 합법) 배열/객체 양쪽을 한 줄로 흡수하고, D-03 이 요구한 "조인 미스 제외 + `console.error`" 도 같은 함수에서 끝난다:
```ts
const one = Array.isArray(embed) ? embed[0] : embed;   // 배열이든 객체든 하나로 접는다
```
`as` 를 아예 쓰지 않는 변형(`typeof row === "object" && row !== null` → `"restaurant_id" in row` 좁히기)도 통과함을 확인했다. `[VERIFIED: deno check — §Code Examples 1·2]`

**(d) 조인 미스는 스키마상 도달 불가에 가깝다(그래도 가드는 남긴다).** `candidates.restaurant_id` 는 `not null` PK 이고 `references restaurants(id) on delete cascade`(0005:40) 다 — 매장이 지워지면 후보 행도 같은 트랜잭션에서 사라지므로 "후보는 있는데 매장이 없는" 상태가 DB 에 존재할 수 없다. D-03 의 `null` 가드는 **경합 방어가 아니라 형태 방어**(PostgREST 응답이 예상과 다를 때 전체를 잃지 않는 장치)로 이해하는 것이 정확하다. `!inner` 는 불필요하다(FK + cascade 가 이미 inner 를 보장).
`[VERIFIED: supabase/migrations/0005_restaurants_settings.sql:39-42 직독]`

**(e) `.order("created_at", { ascending: true })` 는 부모(=`candidates`) 정렬이다 — VERIFIED.**
설치본 소스:
```js
// node_modules/@supabase/postgrest-js/dist/index.mjs:756-757
order(column, { ascending = true, nullsFirst, foreignTable, referencedTable = foreignTable } = {}) {
    const key = referencedTable ? `${referencedTable}.order` : "order";
```
→ 옵션 없이 부르면 쿼리 파라미터가 `order=created_at.asc`(top-level). 임베드 정렬은 `{ referencedTable: "restaurants" }` 를 줄 때만 일어난다.
`[VERIFIED: node_modules 소스 + CITED: PostgREST 문서 "the order= parameter at the top level sorts parent rows"]`

**(f) 다른 조회들의 추론 타입(전부 실측):**

| 호출 | `data` 타입 |
|------|-------------|
| `.from("settings").select("spin_time, cooldown_days").eq("id",1).maybeSingle()` | `{ spin_time: any; cooldown_days: any; } \| null` |
| `.from("results").insert({…})` (`.select()` 없음) | `null` (리터럴) |
| `.from("results").upsert({…},{onConflict:"date"})` (`.select()` 없음) | `null` (리터럴) |
| `.from("results").upsert(…).select("date")` | `{ date: any; }[] \| null` |
| `.from("results").insert(…).select("date, menu, restaurant_id")` | `{ date: any; menu: any; restaurant_id: any; }[] \| null` |
| 모든 호출의 `error` | `PostgrestError \| null`, `error.code` 는 `string` |

→ **D-07 의 `upsert` 는 성공 시 행을 돌려주지 않는다**(`data: null`). 응답의 `menu`·`restaurant_id` 는 DB 가 돌려준 값이 아니라 함수가 뽑은 `winner` 에서 만들어야 한다(현행 코드도 그렇게 한다). `.select()` 를 붙일 이유는 없다 — 왕복 페이로드만 늘고, `spun_at` 같은 서버 생성 값을 응답에 실을 계획도 D-09 에 없다.
`[VERIFIED: deno check 타입 폭로 6건]`

**(g) `any` 는 어디로 새는가.** 위 표의 필드가 전부 `any` 라 `parseSpinTime(row.spin_time)` 은 **타입 검사를 전혀 받지 않고** 통과한다. `eslint` 는 두 함수 디렉터리를 무시하므로 `no-unsafe-*` 류도 없다. 따라서 값 좁히기는 순전히 규율이다: `typeof row.spin_time === "string" ? parseSpinTime(row.spin_time) : null`, `typeof r.restaurant_id === "string" ? … : null`, `Number(row.cooldown_days)`(→ `cooldownWindowStart` 가 정수 아닌 값을 `null` 로 흡수).
`[VERIFIED: 같은 probe]`

### Q-3. `FunctionsHttpError.context` 와 더 나은 `response` 필드

**(a) 설치본 소스(supabase-js 2.106.0 / functions-js 2.106.0) 직독 — VERIFIED.**
```js
// node_modules/@supabase/functions-js/dist/module/FunctionsClient.js:258-291
const isRelayError = response.headers.get('x-relay-error');
if (isRelayError && isRelayError === 'true') { throw new FunctionsRelayError(response); }
if (!response.ok) { throw new FunctionsHttpError(response); }     // ← 본문을 읽기 전에 던진다
…
} catch (error) {
  return { data: null, error,
    response: error instanceof FunctionsHttpError || error instanceof FunctionsRelayError
      ? error.context : undefined };
}
```
- `context` 는 **`Response` 객체 그 자체**이고, throw 전에 `.json()`/`.text()` 를 부르지 않으므로 **본문은 미소비** → 호출자가 `.json()` 을 정확히 한 번 읽을 수 있다.
- `invoke()` 는 예외를 던지지 않고 `{ data: null, error, … }` 로 돌려준다.
- 타입: `FunctionsError.context: any`, `FunctionsResponseFailure.error: any`, 그리고 **`response?: Response`**(`dist/module/types.d.ts`).

**(b) 레포 tsc 5.9.3 로 두 패턴을 실제 타입체크했다 — VERIFIED.**

| 패턴 | 타입 |
|------|------|
| `const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette")` | `data: RespinResponse \| null`, `error: **any**`, `response: **Response \| undefined**` |
| `if (error instanceof FunctionsHttpError) { await error.context.json() }` | 컴파일 통과(`context` 가 `any` 라 무엇이든 통과한다 — 검사가 아니다) |

→ **권고(D-12 수정): `FunctionsHttpError` 값 import 없이 `response` 를 쓴다.**
```ts
const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
if (error) {
  // response 는 error.context 와 같은 Response 객체다(supabase-js 내부). 본문은 아직 안 읽혔다.
  const body: unknown = response ? await response.json().catch(() => null) : null;
  const fallback = error instanceof Error ? error.message : String(error);
  setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, body)}`);
  return;
}
```
이점 3개: (1) `any` 체인(`error.context.json()`)을 타지 않는다 — CLAUDE.md "`any` 0건" 취지와 맞는다, (2) import 1줄이 안 늘어난다, (3) `FunctionsRelayError` 경로의 본문도 같은 코드가 읽는다. `error.message` 도 `any` 접근이라 `error instanceof Error` 로 좁히면 `any` 가 0이 된다.
비용/리스크: `response` 필드는 `error.context` 보다 최근에 추가된 API 다 — 설치본 2.106.0 에 타입·구현 모두 있음을 확인했지만 `package.json` 은 `^2.106.0` 이라 범프 시 재확인이 필요하다(§Assumptions A3). `FunctionsHttpError` 경로도 문서화된 공식 예시(같은 파일의 JSDoc 이 `await error.context.json()` 을 권한다)이므로 **둘 다 정답**이고, 이건 재량 판단이다. 어느 쪽을 택해도 D-13 `formatRespinError(fallback, body)` 시그니처는 그대로다.
`[VERIFIED: node_modules 소스 직독 + 레포 tsc 5.9.3 실행 2패턴]`

**(c) ⚠ 전제 조건: 500 응답에 CORS 헤더가 있어야 한다.** 브라우저는 CORS 헤더 없는 교차 출처 응답을 상태코드와 무관하게 차단하고, 그때 `fetch` 가 reject 하므로 supabase-js 는 `FunctionsHttpError` 가 아니라 **`FunctionsFetchError`** 를 만들고 `response` 는 `undefined` 가 된다 — 본문은 영원히 안 보인다. 현행 `respin-roulette` 는 모든 응답을 `json()` 헬퍼(CORS 포함)로 내므로 안전하고, **재작성에서 어느 한 경로만 맨 `new Response(` 로 내면 D-12 가 조용히 무력화된다**. 측정 가능한 계약: 현재 `new Response(` 개수는 respin 2건(헬퍼 1 + OPTIONS 1), spin 7건. respin 을 2건으로 고정하는 단언이 이 함정의 자동 회귀 장치다.
`[VERIFIED: 레포 파일 grep + CORS 는 브라우저 표준 동작(ASSUMED 없음 — 게이트웨이가 헤더를 주입하지 않는다는 사실은 respin-roulette/index.ts:13 이 "직접 확인" 으로 기록)]`

### Q-4. jsr 버전 해석 — lock 은 무엇을 고정하고 무엇을 고정하지 못하는가

**(a) lock 은 로컬 `deno check` 를 확실히 고정한다 — VERIFIED(직접 실험).**
생성된 lock 의 `"jsr:@supabase/supabase-js@2": "2.117.2"` 를 손으로 `2.117.1` 로 내리고 다시 `deno check` 했더니 deno 가 **2.117.1 을 새로 내려받아 사용**하고 lock 을 되돌리지 않았다. 즉 최신 재해석이 아니라 lock 우선이다.
lock 없이 돌리면 오늘 기준 `jsr:@supabase/supabase-js@2` → **2.117.2**, `jsr:@supabase/functions-js/edge-runtime.d.ts` → **`@*` → 2.117.2** 로 해석된다(lock 파일에 그대로 기록됨).
`--frozen` 을 주면 lock 이 갱신돼야 하는 상황에서 **필요한 변경의 diff 를 출력하고 실패**한다(실측). `--frozen` 없이는 조용히 lock 을 고쳐 쓴다 → **`check:edge` 실행 후 `git status` 가 깨끗한지 보는 것이 드리프트 감지기**가 된다(D-16 의 "미의도 변경 0" 게이트와 자연히 짝을 이룬다).
`[VERIFIED: deno 2.9.7 실행 3회]`

**(b) 배포 번들은 lock 을 쓰지 않는다 — VERIFIED(CLI 소스).** Q-1d 참조(`deploy.ts` 에 `lock` 0건, 업로드 목록에도 없음). 게다가 기본 경로는 **API 측 번들링**이다:
```ts
// deploy.ts:2323
const useLocalBundler = !flags.useApi && (flags.useDocker || flags.legacyBundle);
```
→ `--use-docker`/legacy 플래그를 주지 않으면 소스를 멀티파트로 업로드해 서버가 번들한다(`POST /v1/projects/{ref}/functions/deploy`). 따라서 **배포 시점의 jsr 해석은 Supabase 서버가 그 시점에 한다** — 로컬 lock 과 무관하고, `@2` 는 그때의 최신 2.x 가 된다.
`[VERIFIED: 같은 소스]`

**(c) 판정과 권고.** "check 한 것과 배포되는 것이 같다" 를 원하면 **import 명세자를 핀해야** 한다. 선택지:

| 안 | 내용 | 장점 | 단점 |
|----|------|------|------|
| **A (권고)** | lock 커밋 + 런타임 명세자만 핀: `import { createClient } from "jsr:@supabase/supabase-js@2.117.2"`. 타입 전용 `import "jsr:@supabase/functions-js/edge-runtime.d.ts"` 는 **문서 형태 그대로 둔다** | 배포 번들의 런타임 라이브러리가 결정적이 된다. 레포의 "정확 버전 고정" 컨벤션(Phase 1)과 일치 | 패치 반영이 수동. 핀을 올릴 때 lock 도 함께 갱신해야 한다(2곳) |
| B | `@2` 유지 + lock 만 커밋 | 파일 변경 0, 배포는 항상 최신 2.x | `deno check` 가 본 버전 ≠ 배포된 버전. 오늘까지의 동작 방식이며 사고는 없었다 |
| C | A + `edge-runtime.d.ts` 까지 핀(`jsr:@supabase/functions-js@2.117.2/edge-runtime.d.ts`) | 타입도 결정적 | 공식 문서가 쓰는 형태에서 벗어난다. 이 import 는 **타입 전용**(런타임 동작 0)이라 얻는 게 거의 없고 배포 실패 리스크만 새로 만든다 — 비권고 |

A 를 권고하되 **사용자 확인 대상**으로 표시한다(D-02 의 범위를 넓히는 제안이다). B 를 택해도 SC-5 는 충족된다.
`[VERIFIED: 위 실측 + CLI 소스]` / 서버측 번들러가 핀된 명세자를 그대로 해석한다는 점은 `[ASSUMED]`(jsr 표준 동작, 실호출은 Phase 8).

### Q-5. `allowImportingTsExtensions` + `noEmit` (사실만 — 이 페이즈에 채택하지 않음)

스크래치 복제에서 `allowImportingTsExtensions: true`·`noEmit: true`·`moduleResolution: "bundler"`·`paths {"@/*": ["./*"]}` 로 다음 두 형태를 동시에 검사했다:
- `_shared/spinTime.ts` → `import type { KstParts } from "./kst.ts"` (파일 간 `.ts` 상대 import)
- `lib/time.ts` → `export { kstNow } from "@/supabase/functions/_shared/kst.ts"` + `export type { KstParts } from "…/kst.ts"`

| 도구 | 결과 |
|------|------|
| tsc 5.9.3 (레포 설치본) | **exit 0** — 두 형태 모두 통과 `[VERIFIED]` |
| deno 2.9.7 | **통과** — 확장자가 붙었으니 당연 `[VERIFIED]` |
| Next 16.3.5 `npm run build` | **미검증.** 근거 2건으로 통과가 유력하다: (1) Next 의 `writeConfigurationDefaults.js` 가 강제/권고하는 옵션 목록에 `allowImportingTsExtensions` 가 **없다**(grep 0건 — `node_modules/next/dist/` 전체에서 이 옵션이 나오는 곳은 마이그레이션 문서 1곳뿐이고, 거기서는 켜라고 권한다), (2) Phase 3 이 Turbopack 자체는 `.ts` 확장자를 정상 해석하고 **Next 의 타입체크 단계만** `TS5097` 로 막았음을 실측했다 — 그 에러의 원인이 바로 이 옵션의 부재다. `[ASSUMED]` |
| vitest 4.1.11 | **미검증(이번 회차).** Phase 3 이 `./zzprobe` 와 `./zzprobe.ts` 를 둘 다 해석함을 실측했다 `[CITED: 03-RESEARCH §Q5]` |

즉 기술적으로는 가능하다. 그러나 채택 비용은 Phase 3 이 적은 그대로다 — 레포 전체 import 규약을 바꾸고 Next 빌드 경로에 새 변수를 들인다. **이 페이즈에서 채택하지 않는다**(CONTEXT deferred 유지). 다만 `_shared` 조합 모듈이 정말 필요해지는 시점(v2)에는 tsc 쪽 장애물이 1줄로 해결된다는 사실이 확인됐다.

### Q-6. Edge Runtime 세부 — 추측하지 말 것

**(a) `Deno.serve` 핸들러 시그니처 — VERIFIED.**
```ts
Deno.serve(async (req, info) => { … return new Response("ok"); });  // req: Request, info: Deno.ServeHandlerInfo
Deno.serve(async () => { … });                                      // 인자 0개도 합법(현행 spin-roulette)
```
반환값은 `HttpServer<NetAddr>`(쓰지 않는다). `[VERIFIED: deno check — 타입 폭로]`

**(b) `Deno.env.get("SUPABASE_URL")` → `string | undefined`** 이므로 현행의 `!` 가 필요하다(또는 명시적 throw). 변수 이름은 플랫폼 제공이라 그대로 둔다. `[VERIFIED: 같은 probe]`

**(c) `console.error` 는 대시보드 로그에 나온다 — CITED.**
> *"You can use `console.log`, `console.error`, and `console.warn` in your code to emit custom log events. These events also appear in the Logs tool."*
제한: 커스텀 로그 메시지는 **최대 10,000자**, **10초에 100건**까지. 별도 활성화 불필요.
`[CITED: supabase.com/docs/guides/functions/logging]`
→ D-10 의 "경로마다 1건" 은 이 예산 안에서 넉넉하다(매분 폴링 × 1~2건). 메시지에 `error.message` 를 싣되 `details`·`hint` 는 싣지 않는 레포 규약(`lib/errors.ts:5`)을 로그에도 적용할지는 재량이다 — 로그는 사용자에게 보이지 않으므로 `details` 를 넣는 것이 진단에 유리하다(권고: 넣는다).

**(d) `PostgrestError.code` 는 `string`** 이라 `insErr.code === "23505"` 가 좁히기 없이 통과한다. unique 위반 코드가 `23505` 인 것은 Postgres 표준이고 현행 코드가 프로덕션에서 그 경로를 쓰고 있다. `[VERIFIED: 타입 폭로 + 배포 중인 코드]`

**(e) `upsert(..., { onConflict: "date" })` 성공 시 `data: null`** (Q-2f). 에러도 `null` 이므로 "성공" 판정은 `if (upErr)` 의 부재로만 한다 — 현행 코드와 같다.

**(f) `maybeSingle()` 0행은 `data: null, error: null`**, 테이블 부재는 `PGRST205`/404 다. `[CITED: 03-RESEARCH §Q4-b·c — 설치본 소스 + PostgREST 문서]` 컷오버 전에는 `settings`·`candidates` 가 없으므로 이 함수들을 실호출하면 **전부 404 경로**로 떨어진다(그래서 실호출 검증이 Phase 8 인 것이다).

### Q-7. `check:edge` 가 `_shared` 까지 검사한다 (부수 발견, 이득)

probe 에서 `fn/_shared/cooldown.ts` 에 고의로 타입 에러를 넣고 `deno check fn/spin-roulette/index.ts` 를 돌리자:
```
Check fn/spin-roulette/index.ts
TS2322 [ERROR]: Type 'string' is not assignable to type 'number'.
    at …/fn/_shared/cooldown.ts:49:14
```
→ `deno check` 는 import 그래프를 **전이 검사**한다. 따라서 `npm run check:edge` 는 `_shared/*.ts` 를 **Deno 내장 TypeScript 6.0.3** 으로 한 번 더 검사한다(레포 `tsc` 는 5.9.3). 이득: `_shared` 가 두 컴파일러의 교집합에서만 통과한다. 비용: 두 버전이 다르게 판정하는 구문을 쓰면 한쪽만 깨진다(현재 3파일은 양쪽 통과 — 실측). 이 사실은 CLAUDE.md 갱신 문구(D-17)에 넣을 값어치가 있다.
`[VERIFIED: deno check 2회]`

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 추첨 시각 판정 | Edge Function(`spin-roulette`) | `_shared/spinTime.ts`(순수) | 판정 입력(`settings.spin_time`)이 DB 에 있고 service_role 만 결과를 쓴다. 클라이언트의 페이즈 계산은 표시용 추정일 뿐 |
| 오늘 후보 읽기 | Edge Function (service_role) | DB(FK + cascade) | 후보의 무결성은 RLS 가 아니라 **FK + PK** 가 보증한다(중복 담기 불가, 매장 삭제 시 후보 자동 정리) — 함수는 정규화만 한다 |
| 쿨다운 필터 | `_shared/cooldown.ts`(순수) | Edge Function(조회) | 판단은 순수 함수, 창 범위 조회(`gte`/`lt`)만 함수 몫. Phase 3 가 그 경계를 이미 확정했다 |
| 결과 확정(쓰기) | Edge Function only | DB `unique(date)` | `results` 쓰기 정책 0건 = anon 은 절대 쓸 수 없다. 하루 1회 보장의 마지막 방어선은 앱 로직이 아니라 **unique 제약(23505)** 이다 |
| 설정 읽기 | Edge Function + 클라이언트 훅 | — | 같은 행을 양쪽이 읽고 **같은 폴백 규칙**을 따라야 한다(D-04 ↔ `lib/settings.ts`). 규칙이 갈리면 화면과 서버가 다른 시각을 믿는다 |
| 관측성(실패 기록) | Edge Function `console.error` → Supabase Logs | — | cron 의 `net.http_post` 는 fire-and-forget 이라 응답을 아무도 안 본다. 로그가 유일한 채널(CONCERNS "관측성") |
| 사용자에게 실패 알리기 | 클라이언트 배너(`actionError`) | Edge Function 의 `{ error }` 본문 | 서버는 본문에 이유를 싣고, 표면화는 페이지가 한다(D-12). 로그와 배너는 **다른 청중**이다 |
| 정적 검증 | `deno check`(두 `index.ts` + 전이로 `_shared`) | vitest 텍스트 계약, `tsc`(`_shared`·`lib`) | 실호출이 불가능한 페이즈에서 타입 통과 + 텍스트 계약 + 낭독이 전부다 |

## Standard Stack

### Core

**신규 npm 패키지 0개.** 새로 들어오는 도구는 `deno` 하나이고 그것은 npm 밖(brew)에서 이미 설치됐다.

| Tool/Library | Version | Purpose | Why Standard |
|--------------|---------|---------|--------------|
| deno | 2.9.7 (내장 TypeScript 6.0.3) | `npm run check:edge` — 두 `index.ts` 의 유일한 정적 검사 | Edge Runtime 과 같은 런타임. 사용자 결정 D1 로 이미 설치됨(`/opt/homebrew/bin/deno`) |
| `jsr:@supabase/supabase-js` | `@2` → 2.117.2 (lock 고정) | 함수 안 DB 접근 | 현행 두 함수가 쓰는 그대로. Supabase 공식 Edge 예시 형태 |
| `jsr:@supabase/functions-js/edge-runtime.d.ts` | `@*` → 2.117.2 | `Deno.serve`·전역 타입 | 공식 문서가 지정하는 사이드이펙트 import. **핀하지 않는다**(Q-4c 안 C) |
| `_shared/{kst,spinTime,cooldown}.ts` | Phase 3 산출물 | KST·시각 판정·쿨다운 | import 0개 규칙 덕에 Deno·tsc·vitest 3곳에서 동작 |
| vitest | 4.1.11 (정확 고정) | 텍스트 계약 + `_shared` 단위 | `vitest.config.mts` 변경 불필요(`_shared/**` include 이미 있음) |
| typescript (tsc) | 5.9.3 | `lib/`·`_shared`·`app/` 타입 게이트 | 두 `index.ts` 는 여전히 제외 — 그 구멍을 `deno check` 가 메운다 |
| Supabase CLI | 2.117.0 (npx 캐시에 존재) | **이 페이즈에서는 쓰지 않는다**(배포는 Phase 8) | — |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| (b) `--config supabase/functions/deno.json` | (a) `--node-modules-dir=none --lock …` | 배포 영향은 둘 다 0. lock 에 루트 `package.json` 의존성이 박히는 것이 (a) 의 유일한 실질 차이(§Q-1f) |
| `deno.json` | `deno.jsonc` | jsonc 면 한글 Why 주석을 파일 안에 남길 수 있다(레포 컨벤션과 맞는다). CLI 는 두 이름 모두 함수 디렉터리 안에서만 찾으므로 안전성 동일 — **재량** |
| 조회 결과를 `unknown` 으로 받기 | `createClient<Database>` 로 완전 타입 | 임베드가 객체로 정확히 추론되지만 `Database` 타입(관계 메타데이터 포함) 생성·유지가 필요하다. 로컬 스택이 없어 `supabase gen types` 도 못 돌린다 — 이 프로젝트에서는 불가 |
| 조회 결과를 `unknown` 으로 받기 | `as CandidateJoinRow[]` 단언 | CLAUDE.md 가 허용하는 형태지만 **틀린 형태로 단언할 위험**이 바로 이 페이즈의 함정이다(배열 vs 객체). 런타임 좁히기가 단언보다 싸고 정확하다 |
| `response` 필드로 본문 읽기 | `error instanceof FunctionsHttpError` + `error.context.json()` | 공식 JSDoc 예시 형태. `any` 를 거치고 값 import 1줄이 늘지만, API 안정성은 더 오래 검증됐다 — 재량(§Q-3b) |
| 함수별 `json()` 헬퍼 | 현행 spin 의 인라인 `new Response(...)` 7회 | 헬퍼 1개로 줄이면 헤더 누락 함정이 구조적으로 사라지고 계약 테스트가 `new Response(` 개수로 이를 고정할 수 있다 — **권고** |
| `deno check` | `deno lint`·`deno fmt` 추가 도입 | 두 함수만 대상인데 레포 전체 포맷 규약(eslint/prettier 없음)과 충돌 소지. 이 페이즈 범위 밖 |

**Installation:** npm 설치 0건. `package.json` 은 `scripts.check:edge` 한 줄만 늘어난다(`dependencies`·`devDependencies` 무변경 = `package-lock.json` 무변경).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | 이 페이즈는 npm 패키지를 설치하지 않는다 |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

npm 설치 대상이 0개이므로 Package Legitimacy Gate 는 해당 없다. 새로 들어오는 실행 파일 `deno` 는 npm 레지스트리 밖(Homebrew `deno` formula, 사용자가 직접 설치)이고, jsr 명세자 2개는 현행 함수가 이미 쓰는 것과 동일하다(`jsr.io/@supabase/*` = Supabase 공식 스코프). `npm audit` 0건 상태를 이 페이즈도 유지한다(페이즈 게이트에 포함).

## Architecture Patterns

### System Architecture Diagram

```
  pg_cron  '* * * * *'                                브라우저 (오늘 탭)
      │ net.http_post (fire-and-forget, 응답 미검사)        │ supabase.functions.invoke
      │                                                    │  (POST + OPTIONS 프리플라이트)
      ▼                                                    ▼
┌──────────────────────────┐                    ┌──────────────────────────────┐
│ spin-roulette            │                    │ respin-roulette              │
│ (시간 가드 + 멱등)        │                    │ (가드 없음 · 멱등 없음 · CORS) │
└─────────┬────────────────┘                    └─────────┬────────────────────┘
          │                                               │
          │  ①  kstNow()                        ①  kstNow()
          │  ②  settings SELECT ─────────┐      ②  settings SELECT (cooldown_days 만)
          │  ③  isAfterSpinTime? ──no──▶ skipped:before_spin_time  (③ 없음)
          │  ④  results(today) 존재? ─yes▶ skipped:already_decided  (④ 없음)
          │  ⑤  candidates ⋈ restaurants │      ⑤ 같음
          │        0개 ──────────────────▶ skipped:no_candidates   ⑤' 0개면 같은 skip
          │  ⑥  cooldownWindowStart(...)  │      ⑥ 같음
          │        null ─▶ 조회 0회        │
          │        아니면 results 창 조회  │
          │  ⑦  applyCooldown → pickRandom│      ⑦ 같음
          │  ⑧  results INSERT            │      ⑧ results UPSERT(onConflict: date)
          │        23505 ─▶ race_already_decided
          ▼                                               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │ DB  settings(id=1)   candidates ──FK/cascade──▶ restaurants      │
   │     results(date unique, menu 스냅샷, restaurant_id set null)     │
   │     anon: restaurants/candidates 전면 개방 · settings select-only │
   │           results 쓰기 정책 0건 → service_role 전용               │
   └───────────────────┬──────────────────────────────────────────────┘
                       │ Realtime postgres_changes
                       ▼
             열려 있는 모든 탭 (휠 회전 · 결과 표시)

   실패 경로의 목적지는 둘로 갈린다:
     console.error  ──▶ Supabase Edge Logs  (사람이 나중에 본다 / cron 경로의 유일한 창)
     { error } 본문 ──▶ 브라우저 배너        (지금 누른 사람이 본다 / respin 만)

   ─ ─ ─ ─ ─ 검증 경계 ─ ─ ─ ─ ─
   deno check(--config)  ──▶ 두 index.ts + 전이로 _shared/*.ts  (타입만)
   vitest edgeImports    ──▶ 두 index.ts 의 텍스트 형태          (형태만)
   vitest _shared/*.test ──▶ 순수 함수의 동작                     (동작)
   실호출                ──▶ Phase 8 (컷오버 후 respin 수동 invoke)
```

### Recommended Project Structure

```
supabase/functions/
├── deno.json                 # 신규(권고). { "nodeModulesDir": "none" } — check:edge 전용.
│                             #   CLI 는 이 경로를 import map 으로 찾지 않는다(Q-1a) → 배포 무영향
├── deno.lock                 # 신규. deno 가 위 config 옆에 자동 생성(276줄). 커밋한다
├── _shared/                  # 변경 없음(파일 추가 금지 — D-11)
│   ├── kst.ts spinTime.ts cooldown.ts
│   └── *.test.ts             # spinTime.test.ts 에 왕복 1케이스 추가(D-15)
│   └── edgeImports.test.ts   # 계약 확장(D-14)
├── spin-roulette/index.ts    # 재작성. deno.json 을 여기 두면 안 된다(import map 으로 채택됨)
└── respin-roulette/index.ts  # 재작성
lib/
├── supabase/client.ts        # ResultRow.candidates 1줄(D-08)
├── errors.ts                 # formatRespinError 추가(D-13)
└── errors.test.ts            # 3케이스 추가
app/page.tsx                  # respin() 본문 표면화(D-12)
package.json                  # scripts.check:edge 1줄
```

### Pattern 1: 조회 결과는 추론 타입으로 소비하지 않는다 — `unknown` → 런타임 좁히기

**What:** `.select()` 결과를 `unknown` 을 받는 정규화 함수에 그대로 넘기고, 필요한 필드만 런타임에 확인해 도메인 타입으로 만든다.
**When to use:** `Database` 제네릭이 없는 클라이언트의 **모든** 조회 — 특히 임베드가 있는 것.
**Why:** 추론 타입이 임베드를 배열이라고 주장하는데 런타임은 객체다(§Q-2b·a). 추론을 믿는 코드는 `deno check` 를 통과하면서 틀린다. 부수 효과로 D-03 의 "조인 미스 제외 + `console.error`" 가 같은 함수에서 끝난다.

```ts
type Candidate = { restaurant_id: string; name: string };

// PostgREST 는 to-one 임베드를 객체로 주지만, Database 제네릭이 없는 클라이언트의 추론 타입은
// 배열이라고 주장한다. 어느 쪽이 와도 같은 결과를 내도록 한 줄로 접는다.
function normalizeCandidates(rows: unknown): { picked: Candidate[]; skipped: number } {
  if (!Array.isArray(rows)) return { picked: [], skipped: 0 };
  const picked: Candidate[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (typeof row !== "object" || row === null) { skipped++; continue; }
    if (!("restaurant_id" in row) || !("restaurants" in row)) { skipped++; continue; }
    const one = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    if (typeof one !== "object" || one === null || !("name" in one)) { skipped++; continue; }
    if (typeof row.restaurant_id !== "string" || typeof one.name !== "string") { skipped++; continue; }
    picked.push({ restaurant_id: row.restaurant_id, name: one.name });   // 담은 순서 유지
  }
  return { picked, skipped };
}
```
`as` 가 한 번도 안 나오고 `any` 도 안 나온다. `in` 좁히기가 `unknown`→`object` 에서 동작한다.
`[VERIFIED: deno check 통과 — 이 함수와 이를 쓰는 전체 스켈레톤 둘 다]`

### Pattern 2: 폴백 플래그는 "무엇이 기본 동작으로 밀렸는가" 를 지역 변수 3개로 들고 다닌다

**What:** `settingsFallback`·`cooldownSkipped`·`cooldownFallback` 을 `let` 으로 선언하고 각 실패 지점에서 `true` 로 올린 뒤 성공 응답에 **항상** 싣는다(D-09).
**Why:** cron 로그 한 줄에서 정상/비정상을 구분하려면 키가 조건부로 사라지면 안 된다. 세 값이 전부 `false` 인 줄이 정상이다.

```ts
let settingsFallback = false;   // 설정을 못 읽거나 못 읽힌 값이어서 기본값으로 갔다
let cooldownSkipped = false;    // 쿨다운 창 조회가 실패해 필터를 건너뛰었다
let cooldownFallback = false;   // 필터 결과가 0개라 전체 후보로 되돌렸다(applyCooldown 이 판정)
```
세 개를 한 객체로 묶지 않는 이유: 계약 테스트가 토큰 단위로 존재를 단언하고(D-14), 로그 grep 도 평평한 키를 찾는다.

### Pattern 3: 모든 반환을 `json()` 헬퍼 하나로 — CORS 누락이 구조적으로 불가능해진다

**What:** 두 함수 각각에 이름·시그니처가 같은 `json(body: unknown, status = 200): Response` 를 두고, `OPTIONS` 단락만 예외로 맨 `new Response` 를 쓴다.
**Why:** respin 의 500 응답에 CORS 헤더가 빠지면 브라우저가 본문을 차단해 D-12 가 조용히 죽는다(§Q-3c). 헬퍼가 하나면 빠질 자리가 없다. spin 은 CORS 가 필요 없지만(cron 이 서버측에서 호출) 같은 헬퍼 형태를 쓰면 현행 7회 반복이 1곳으로 줄고 Phase 8 낭독에서 두 파일을 diff 로 비교할 수 있다.

```ts
// respin-roulette: CORS 포함 (게이트웨이가 주입하지 않는다 — 현행 주석의 근거를 유지)
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
// spin-roulette: CORS 없음 (호출자가 pg_cron 이라 프리플라이트가 없다)
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
```
계약 테스트로 고정: `new Response(` 개수 = respin **2**(헬퍼+OPTIONS) / spin **1**(헬퍼). 현재 값은 2 / 7 이다(실측).

### Pattern 4: `any` 가 새는 자리마다 `typeof` 한 번

```ts
// settings 행의 필드는 전부 any 다(§Q-2f·g). 좁히기는 컴파일러가 아니라 규율이 한다.
const rawSpin: unknown = settingsRow.spin_time;
const parsed = typeof rawSpin === "string" ? parseSpinTime(rawSpin) : null;
if (!parsed) { console.error(`spin_time 파싱 실패: ${JSON.stringify(rawSpin)}`); settingsFallback = true; }

// 쿨다운 창 조회 결과도 같다. applyCooldown 은 Iterable<string | null> 을 받는다.
const ids: (string | null)[] = (recent ?? []).map((r) =>
  typeof r.restaurant_id === "string" ? r.restaurant_id : null);
```
`JSON.stringify` 로 감싸는 이유: 값이 문자열이 아닐 수도 있는 자리라 템플릿 보간이 `[object Object]` 를 남기면 진단이 안 된다.

### Anti-Patterns to Avoid

- **`row.restaurants[0].name` 또는 `row.restaurants.name` 을 직접 쓰기:** 앞은 통과하고 틀리며, 뒤는 맞는데 컴파일이 막는다(§Q-2b). Pattern 1 로 대체.
- **`supabase/functions/<slug>/deno.json` 을 두기:** 배포가 그것을 import map 으로 채택한다(§Q-1b). 설정 파일은 반드시 한 단계 위(`supabase/functions/`)에.
- **루트에 `deno.lock` 을 남기고 `.gitignore` 로 덮기:** D-02 가 금지한다. 명령을 고치는 쪽이 맞다(§Q-1e).
- **`deno check` 없이 `npm test` 만 보고 함수 수정을 끝내기:** 텍스트 계약은 형태만 본다. 타입은 `check:edge` 만 본다.
- **성공 응답에서 폴백 boolean 을 조건부로 빼기:** D-09 위반 — 로그 grep 과 계약 테스트가 동시에 무력화된다.
- **`upsert(...).select()` 로 응답을 만들기:** 불필요한 왕복. 응답 값은 함수가 이미 들고 있는 `winner` 에서 만든다(§Q-2f).
- **`console.error` 토큰을 한글 주석에 쓰기:** 계약 테스트가 자기 자신을 센다(Phase 3 의 반복된 교훈 — 아래 Pitfall 4의 실측 예 참조).
- **`_shared` 에 새 모듈·jsr import 추가:** D-11. `deno check` 가 `_shared` 를 전이 검사하므로(§Q-7) jsr import 가 섞이면 tsc 쪽에서 즉시 깨진다.
- **`npm run dev` 로 확인하기:** CLAUDE.md 금지(가드런처만). 이 페이즈는 `tsc`·`lint`·`test`·`build`·`check:edge` 로 전부 검증된다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 임베드 응답의 배열/객체 판별 | 문서를 보고 한쪽으로 단정 | `Array.isArray(embed) ? embed[0] : embed` 한 줄 | 정적 타입과 런타임이 서로 다르게 말한다(§Q-2). 양쪽을 접는 비용이 한 줄이다 |
| "오늘 이미 뽑았다" 보장 | 애플리케이션 락·분산 뮤텍스 | `results.date` unique + `23505` 정상 경로 | 매분 폴링이 동시에 두 번 떠도 DB 가 한쪽만 통과시킨다. 현행 설계이고 이미 검증된 경로 |
| 날짜 창 계산 | 함수 안에서 문자열 날짜 산술 | `_shared/cooldown.ts` `cooldownWindowStart` | Phase 3 이 윤년·월·연 경계를 14케이스로 덮었다. 여기서 다시 쓰면 그 테스트가 무의미해진다 |
| 후보 비었을 때 폴백 | 함수 안 if 로 재조회 | `applyCooldown` 의 `{ picked, fellBack }` | 폴백 판정이 두 곳에 있으면 `cooldown_fallback` 응답이 거짓말을 한다 |
| 500 본문 파싱 | `response.text()` 후 직접 JSON.parse + try/catch | `response.json().catch(() => null)` + `formatRespinError` | 실패를 값으로 돌리는 형태가 배너를 지우지 않는다(D-12 의 `.catch` 근거) |
| CORS 헤더 | 경로별로 헤더 객체 복사 | `json()` 헬퍼 1개 (Pattern 3) | 한 경로만 빠뜨리면 그 경로의 본문이 브라우저에서 영구히 안 보인다 |
| jsr 버전 재현성 | 명세자에 손으로 날짜 주석 달기 | `deno.lock` 커밋 | lock 이 실제로 해석을 고정한다(§Q-4a 실험). 단 배포 번들은 별도(§Q-4b) |

**Key insight:** 이 페이즈에서 "직접 만들지 말 것" 1순위는 **타입 추론에 대한 신뢰**다. `deno check` 는 이 페이즈가 얻는 가장 큰 자산이면서, 조회 결과 타입에 대해서는 신뢰할 수 없는 증인이다. 그 한 지점만 런타임 좁히기로 우회하면 나머지 전부를 컴파일러에 맡길 수 있다.

## Runtime State Inventory

> 재작성 페이즈이므로 포함한다. 결론부터: **이 페이즈는 런타임 상태를 하나도 바꾸지 않는다.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **없음.** DB 접근 코드는 바뀌지만 SQL 을 적용하지 않고 함수를 배포하지 않는다. `0005` 는 미적용이고 이 페이즈는 `supabase/migrations/` 를 건드리지 않는다 | 없음 (적용은 Phase 8) |
| Live service config | **없음.** 라이브에는 구 함수(`menus` 를 읽는 코드)가 계속 돈다. `supabase/config.toml` 의 `verify_jwt = false` 도 무변경. 배포 명령을 실행하지 않는다 | 없음 (Phase 8 SHIP-04) |
| OS-registered state | **없음.** pg_cron 잡은 DB 안이고 SQL 을 건드리지 않는다. OS 스케줄러·pm2 사용처 없음 | 없음 |
| Secrets/env vars | **없음.** 함수는 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`(플랫폼 주입)만 읽고 이름이 바뀌지 않는다. `.env.local` 은 `NEXT_PUBLIC_*` 2개 그대로 | 없음 |
| Build artifacts | **2건(둘 다 이 페이즈가 새로 만드는 것).** (1) `supabase/functions/deno.lock` — **커밋 대상**(D-02). (2) `~/Library/Caches/deno`(현재 38MB) — DENO_DIR 캐시, 레포 밖. 추가로 잘못된 명령이 **루트 `deno.lock`** 을 만들 수 있다 → `check:edge` 실행 후 `git status` 확인을 태스크 완료 조건에 넣는다 | lock 커밋 / 루트 lock 생성 시 명령 수정 |

**"결과 행" 이 남는 유일한 지점:** 없음. 이 페이즈 뒤 `git diff` 에 나타나는 모든 변경은 파일뿐이고, 배포되지 않은 상태로 Phase 8 까지 브랜치에 머문다.

## Common Pitfalls

| # | 함정 | 자동 탐지 | 심각도 |
|---|------|-----------|--------|
| 1 | 임베드를 배열로 읽어 `undefined` 를 뽑는다 | ✗ (`deno check` 가 오히려 통과시킨다) | **치명** — 매일 추첨이 조용히 깨진다 |
| 2 | 500 응답에 CORS 헤더가 빠져 본문이 브라우저에서 안 보인다 | △ (`new Response(` 개수 단언) | 높음 — D-12 가 무의미해진다 |
| 3 | `deno.json` 을 함수 디렉터리 안에 둬서 배포 입력이 바뀐다 | ✗ | 높음 — Phase 8 에서만 드러난다 |
| 4 | 계약 테스트 기준 숫자를 주석 포함 원본에서 센다 | ✗ (게이트가 조용히 통과) | 중간 — 회귀 장치가 죽는다 |
| 5 | 루트 `deno.lock` 이 생겨 커밋에 섞인다 | ○ (`git status`) | 낮음 |
| 6 | 멱등 SELECT 의 에러 경로가 설계에 없다 | ✗ | 낮음(23505 가 보험) |
| 7 | `pickRandom([])` — 쿨다운 이후 빈 배열 | ✗ | 낮음(폴백이 보장) |
| 8 | 두 컴파일러 버전 차이(tsc 5.9.3 ↔ Deno TS 6.0.3) | ○ (양쪽 실행) | 낮음 |

### Pitfall 1: `restaurants` 임베드를 배열로 읽는다 ⚠ 최우선

**What goes wrong:** `const name = row.restaurants[0].name` 을 쓴다. `deno check` 통과, 배포 성공, 그리고 매일 `undefined` 를 매장명으로 기록하거나(`menu: undefined` → insert 시 not-null 위반 500) 조인 미스로 전부 걸러져 `no_candidates` 가 된다 — **결과가 안 만들어진다**. Core Value 가 깨지는 유일한 함정이다.
**Why it happens:** `Database` 제네릭이 없으면 postgrest-js 의 타입 파서가 to-one 을 판정할 수 없어 임베드를 배열로 추론한다(§Q-2b 실측 4변형). 런타임의 PostgREST 는 객체를 준다(§Q-2a 문서 인용).
**How to avoid:** Pattern 1. `Array.isArray(embed) ? embed[0] : embed`.
**Warning signs:** 없다 — 컷오버 후 첫 추첨에서만 드러난다. **그래서 Phase 8 SHIP-04 체크리스트에 "respin 수동 invoke 로 `menu` 가 실제 매장명인지 확인" 을 반드시 넣어야 한다.** 이 페이즈에서 할 수 있는 최선은 정규화 헬퍼를 두고 계약 테스트로 그 존재를 고정하는 것이다.
`[VERIFIED: deno check 타입 폭로 5회 + CITED: PostgREST v13 resource embedding]`

### Pitfall 2: 500 응답의 CORS 누락

**What goes wrong:** 재작성 중 어느 에러 경로가 `return new Response(JSON.stringify({error}), { status: 500 })` 로 나간다. 브라우저는 CORS 헤더가 없어 응답을 차단하고, supabase-js 는 `FunctionsFetchError`("Failed to fetch")를 만들며 `response` 는 `undefined` 다 → D-12 가 읽을 본문이 없다. 배너에는 여전히 라이브러리 기본 문구가 뜬다.
**Why it happens:** spin 쪽 코드를 복사해 오면 헤더가 CORS 없이 따라온다(spin 은 CORS 가 필요 없다).
**How to avoid:** Pattern 3 — 모든 반환을 `json()` 으로. 계약 테스트로 `new Response(` 개수를 2(respin)로 고정.
**Warning signs:** 배너 문구가 함수가 보낸 문장이 아니라 영어 고정 문구다.

### Pitfall 3: `deno.json` 위치를 함수 디렉터리로 잡는다

**What goes wrong:** Supabase 공식 import-map 문서는 *"Each function should have its own `deno.json`"* 라고 권한다 — 그 말만 보고 `spin-roulette/deno.json` 을 만들면 CLI 가 그 파일을 **import map 으로** 채택하고(§Q-1b) 번들러 인자 구성이 바뀐다(`--import-map` 생략 + 컨테이너 내부 자동 탐색). 로컬 검사만 원했는데 배포 경로를 건드린 것이다.
**Why it happens:** 공식 문서의 권고가 "import map 용 deno.json" 을 전제한다. 우리 목적은 정반대(배포에 보이지 않는 로컬 전용 설정)다.
**How to avoid:** `supabase/functions/deno.json` — **한 단계 위**. CLI 의 6개 탐색 경로 어디에도 없다(§Q-1a). 파일 머리 주석(jsonc)이나 CLAUDE.md 에 "여기서 한 단계 아래로 내리면 배포 import map 이 된다" 를 남긴다.
**Warning signs:** 없음(배포까지 조용하다) → 위치 자체를 계약 테스트로 고정하는 것이 유일한 방어: `edgeImports.test.ts` 에 "`supabase/functions/<slug>/deno.json` 이 존재하지 않는다" 단언 2건 추가를 권고한다.
`[VERIFIED: CLI v2.117.0 소스 + CITED: supabase.com/docs/guides/functions/import-maps]`

### Pitfall 4: 계약 테스트 기준 숫자를 주석 포함 원본에서 센다

**What goes wrong:** D-14 가 `onConflict: "date"` 1회를 요구하는데, **현행 `respin-roulette/index.ts` 에서 `onConflict` 의 원본 개수는 2다** — 7행의 한글 머리 주석("`results를 upsert(onConflict: date)`로 덮어쓴다")이 자기 자신을 센다. 주석 제거 사본에서는 1이다. 기준을 2로 적으면 코드에서 호출이 사라져도 게이트가 통과한다.
**Why it happens:** Phase 2·3 이 같은 실수를 반복해 기록으로 남겼고(STATE.md 결정 3건), 이 파일에는 그 예가 실제로 남아 있다.
**How to avoid:** `stripComments` 사본에서만 센다(`edgeImports.test.ts:27-32` 의 기존 헬퍼). 금지/기준 토큰을 새 주석에 쓰지 않는다. 특히 D-10 이 도입하는 `console.error` 는 주석에서 "콘솔 에러" 같은 한글 표현으로 쓴다.
**측정한 현행 개수(플래너가 기준을 세울 출발점):**

| 토큰 | spin (원본) | respin (원본) |
|------|-------------|---------------|
| `from("menus")` | 1 | 1 |
| `from("results")` | 2 | 1 |
| `from("candidates")` / `from("settings")` | 0 / 0 | 0 / 0 |
| `23505` | 1 | 0 |
| `Deno.serve(` | 1 | 1 |
| `.insert(` / `.upsert(` | 1 / 0 | 0 / 1 |
| `onConflict` | 0 | **2 (주석 1 포함 — 코드는 1)** |
| `maybeSingle(` | 1 | 0 |
| `corsHeaders` | 0 | 3 |
| `console.error(` | 0 | 0 |
| `new Response(` | 7 | 2 |
| `restaurant_id` | 0 | 0 |

**또 하나:** 계약 테스트 자체의 정규식 리터럴이 레포 전역 grep 을 오염시킨다. 낭독·검증에서 개수를 확인할 때는 `grep -rn --include='index.ts'` 또는 `--exclude='*.test.ts'` 로 범위를 좁힌다(Phase 3 결정 그대로).
`[VERIFIED: grep -F -c 실측]`

### Pitfall 5: 루트 `deno.lock`

**What goes wrong:** 누군가(또는 플래너가) `deno check` 를 플래그 없이/`--config` 없이 돌려 루트에 `deno.lock` 이 생기고 커밋에 섞인다. 그 lock 은 루트 `package.json` 의존성 13개를 품고 있어(§Q-1e) 이후 `npm` 변경마다 diff 가 튄다.
**완화 근거(실측):** 플래그 없는 `deno check` 는 **실패하면서 lock 을 만들지 않는다**(에러가 타입 해석 단계라 lock 기록 전에 끝난다). 즉 실수로 생기는 경로는 "`--node-modules-dir=none` 만 주고 `--lock` 을 빼먹은 경우" 다 → 그래서 `--config` 방식이 한 번 더 안전하다(플래그 조합을 기억할 필요가 없다).
**How to avoid:** 스크립트 한 줄만 쓰게 하고(`npm run check:edge`), 태스크 완료 조건에 `git status --porcelain` 확인을 넣는다.

### Pitfall 6: 멱등 SELECT 의 에러 경로가 D-05 에 없다

**What goes wrong:** 현행 코드는 `const { data: existing } = await supabase.from("results")…` 로 **error 를 버린다**. 조회가 실패하면 "오늘 결과 없음" 으로 오판해 insert 로 진행한다.
**왜 그래도 안전한가:** unique(date) 가 있어 그 insert 는 `23505` 로 거부되고 `race_already_decided` 로 착지한다 — 결과가 덮어써지지 않는다. 즉 **현재 설계가 우연이 아니라 실제로 안전하다**.
**How to avoid / 권고:** D-05 를 바꾸지 말고, `error` 를 받아 `console.error` 1건만 남기고 진행한다(D-10 의 취지에 맞는다). "에러를 삼키지 않는다" 와 "가용성 우선" 을 동시에 만족하는 유일한 조합이다. 이 결정은 CONTEXT 에 없으므로 플래너가 명시해야 한다.

### Pitfall 7: `pickRandom([])`

`applyCooldown` 이 "제외하면 0개면 전체 폴백" 을 보장하고(Phase 3 #9), 후보 0개 검사는 쿨다운보다 **앞**에 있다(D-05 ⑤). 쿨다운 조회 실패 경로에서도 `pool = candidates`(비어 있지 않음)다. 따라서 세 경로 모두 비어 있지 않음이 보장된다 — **단 이 불변식은 코드 배치에 의존한다.** D-05 의 순서를 바꾸면 깨진다. 계약 테스트의 순서 단언(`applyCooldown(` 의 위치 < `.insert(` 의 위치, 후보 0개 검사 < `applyCooldown(`)이 그 방어선이다.
`[VERIFIED: _shared/cooldown.ts:37-55 + kst.ts pickRandom 주석의 전제조건]`

### Pitfall 8: 두 컴파일러가 `_shared` 를 본다

`check:edge` 는 `_shared/*.ts` 를 Deno 내장 TS **6.0.3** 으로, `npx tsc --noEmit` 은 **5.9.3** 으로 검사한다(§Q-7). 현재 3파일은 양쪽 통과다. 새 구문(예: 최신 `satisfies`/데코레이터 조합)을 `_shared` 에 넣으면 한쪽만 깨질 수 있다 — `_shared` 를 건드리는 태스크는 두 명령을 **둘 다** 돌린다.

## Code Examples

### 1. `spin-roulette/index.ts` 전체 스켈레톤 — `deno check` 통과 확인본

> 이 스켈레톤을 그대로 `deno check --node-modules-dir=none` 으로 검사해 **에러 0**임을 확인했다(실제 `_shared` 3파일 복사본을 import 했다). 주석·문안·헬퍼 이름은 재량이고, 여기서 보증하는 것은 **타입이 맞는다는 사실**이다.

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";          // 핀 여부는 Q-4c 결정에 따름
import { kstNow, pickRandom } from "../_shared/kst.ts";
import { DEFAULT_SPIN_TIME, isAfterSpinTime, parseSpinTime } from "../_shared/spinTime.ts";
import { applyCooldown, cooldownWindowStart } from "../_shared/cooldown.ts";

type Candidate = { restaurant_id: string; name: string };            // lib/supabase/client.ts 의 거울(D-11)

function normalizeCandidates(rows: unknown): { picked: Candidate[]; skipped: number } {
  /* Pattern 1 참조 — 생략 */
  return { picked: [], skipped: 0 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async () => {
  const now = kstNow();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ② 설정 — 시각 판정 자체가 이 값에 의존하므로 판정보다 먼저 읽는다(D-05)
  let spinTime = DEFAULT_SPIN_TIME;
  let cooldownDays = 0;
  let settingsFallback = false;
  const { data: settingsRow, error: settingsErr } = await supabase
    .from("settings").select("spin_time, cooldown_days").eq("id", 1).maybeSingle();
  if (settingsErr) {
    console.error(`settings 조회 실패: ${settingsErr.message}`);      // 기본값으로 계속 간다(가용성 > 설정 존중)
    settingsFallback = true;
  } else if (settingsRow) {                                          // null = 시드 없음, 에러가 아니다
    const parsed = typeof settingsRow.spin_time === "string" ? parseSpinTime(settingsRow.spin_time) : null;
    if (parsed) spinTime = parsed;
    else { console.error(`spin_time 파싱 실패: ${JSON.stringify(settingsRow.spin_time)}`); settingsFallback = true; }
    cooldownDays = Number(settingsRow.cooldown_days);                // 오염 입력은 cooldownWindowStart 가 흡수
  }

  // ③ 시각 가드 — kst 8필드를 그대로 싣는 것이 cron 로그에서 함수가 본 시각을 보는 유일한 창이다
  if (!isAfterSpinTime(now, spinTime)) return json({ skipped: "before_spin_time", kst: now });

  // ④ 멱등 — error 를 버리지 않고 로그만 남기고 진행한다(23505 가 최종 보험, Pitfall 6)
  const { data: existing, error: existErr } = await supabase
    .from("results").select("date, menu, restaurant_id").eq("date", now.date).maybeSingle();
  if (existErr) console.error(`오늘 결과 조회 실패(진행): ${existErr.message}`);
  if (existing) {
    return json({ skipped: "already_decided", date: now.date,
      menu: existing.menu, restaurant_id: existing.restaurant_id });
  }

  // ⑤ 후보 — order 는 부모(candidates) 정렬이다(§Q-2e)
  const { data: rows, error: candErr } = await supabase
    .from("candidates")
    .select("restaurant_id, created_at, restaurants ( id, name )")
    .order("created_at", { ascending: true });
  if (candErr) { console.error(`후보 조회 실패: ${candErr.message}`); return json({ error: candErr.message }, 500); }

  const { picked: candidates, skipped } = normalizeCandidates(rows);
  if (skipped > 0) console.error(`후보 ${skipped}건을 매장 조인 미스로 제외했다`);
  if (candidates.length === 0) return json({ skipped: "no_candidates", date: now.date });  // 행을 만들지 않는다

  // ⑥⑦ 쿨다운 — 창이 없으면 조회도 하지 않는다(SETT-04: 기본값이면 전환 전과 같은 쿼리 수)
  let pool = candidates;
  let cooldownFallback = false;
  let cooldownSkipped = false;
  const from = cooldownWindowStart(now.date, cooldownDays);
  if (from !== null) {
    const { data: recent, error: recentErr } = await supabase
      .from("results").select("restaurant_id").gte("date", from).lt("date", now.date);
    if (recentErr) { console.error(`쿨다운 조회 실패(미적용 진행): ${recentErr.message}`); cooldownSkipped = true; }
    else {
      const ids: (string | null)[] = (recent ?? []).map((r) =>
        typeof r.restaurant_id === "string" ? r.restaurant_id : null);
      const res = applyCooldown(candidates, ids);
      pool = res.picked;
      cooldownFallback = res.fellBack;
    }
  }

  const winner = pickRandom(pool);                                   // pool 은 비어 있지 않다(Pitfall 7)
  const snapshot = candidates.map((c) => ({ name: c.name, restaurant_id: c.restaurant_id }));

  const { error: insErr } = await supabase.from("results").insert({
    date: now.date, menu: winner.name, restaurant_id: winner.restaurant_id, candidates: snapshot,
  });
  if (insErr) {
    if (insErr.code === "23505") return json({ skipped: "race_already_decided", date: now.date });
    console.error(`results insert 실패: ${insErr.message}`);
    return json({ error: insErr.message }, 500);
  }

  return json({
    ok: true, date: now.date, menu: winner.name, restaurant_id: winner.restaurant_id,
    candidate_count: candidates.length,                              // 쿨다운 적용 전(D-09)
    picked_count: pool.length,                                       // 적용 후
    cooldown_fallback: cooldownFallback, cooldown_skipped: cooldownSkipped, settings_fallback: settingsFallback,
  });
});
```
`[VERIFIED: deno check --node-modules-dir=none — Check 통과, 에러 0]`

### 2. `app/page.tsx` `respin()` — `response` 필드 경로 (레포 tsc 5.9.3 통과 확인본)

```ts
async function respin() {
  setRespinning(true);
  try {
    // response 는 supabase-js 가 non-2xx 에서 던진 FunctionsHttpError 의 context 와 같은 Response 다.
    // 라이브러리가 본문을 읽기 전에 던지므로 여기서 정확히 한 번 읽을 수 있다.
    const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
    if (error) {
      // JSON 이 아닐 수 있다(게이트웨이 HTML). 두 번째 예외로 배너가 사라지면 안 되므로 값으로 받는다.
      const body: unknown = response ? await response.json().catch(() => null) : null;
      const fallback = error instanceof Error ? error.message : String(error);
      setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, body)}`);
      return;
    }
    if (data?.skipped) {
      const reason = data.skipped === "no_candidates" ? "후보가 없어요" : data.skipped;
      setActionError(`다시 돌리기 건너뜀: ${reason}`);
      return;
    }
    setActionError(null);
  } finally {
    setRespinning(false);
  }
}
```
`[VERIFIED: 레포 node_modules/.bin/tsc 5.9.3 — response: Response | undefined, data: RespinResponse | null]`

### 3. `lib/errors.ts` 추가 (D-13) — 순수, 값 import 0

```ts
/** Edge Function 이 보낸 { error } 본문이 있으면 그것을, 없으면 라이브러리 문구를 쓴다 */
// body 를 unknown 으로 받는 이유: 이 값은 신뢰할 수 없는 네트워크 본문이고, 형태 판정을 여기서 끝내야
// 페이지 쪽에 타입 단언이 새지 않는다. 빈 문자열을 거르는 이유는 "실패: " 로 끝나는 배너를 막는 것이다.
export function formatRespinError(fallbackMessage: string, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const message = body.error;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return fallbackMessage;
}
```
`[VERIFIED: in 좁히기 패턴이 tsc 5.9.3·Deno TS 6.0.3 양쪽에서 통과함을 §Q-2c probe 로 확인]`

### 4. `edgeImports.test.ts` 추가 단언 3종 (D-14 보강 제안)

```ts
// 설정 파일이 함수 디렉터리로 내려가면 배포 import map 이 된다 — 위치 자체를 고정한다(Pitfall 3).
it("spin-roulette 디렉터리에 deno.json 이 없다 (#23)", () => {
  expect(existsSync(new URL("../spin-roulette/deno.json", import.meta.url))).toBe(false);
});

// 모든 응답이 CORS 를 타야 한다 — 맨 new Response 는 OPTIONS 단락 1곳뿐이다(Pitfall 2).
it("respin 의 맨 new Response 는 OPTIONS 단락 1곳 + json 헬퍼뿐이다 (#24)", () => {
  expect(count(respin, /new Response\(/g)).toBe(2);
});

// 후보 정규화 헬퍼를 두 파일이 같은 이름으로 갖는다 — Phase 8 낭독에서 diff 로 비교한다.
it("두 파일의 후보 정규화 헬퍼 이름이 같다 (#25)", () => {
  expect([count(spin, /function normalizeCandidates\(/g), count(respin, /function normalizeCandidates\(/g)])
    .toEqual([1, 1]);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase functions deploy` 가 Docker 로 로컬 eszip 번들 | **기본이 API 측 번들링**(`useLocalBundler = !useApi && (useDocker \|\| legacyBundle)`) | CLI 2.x | Docker 없이 배포된다. 동시에 **로컬 lock 이 배포 번들에 영향 없음**의 근거가 된다(§Q-4b) |
| `supabase/functions/import_map.json` | 함수별 `deno.json` | CLI 가 deprecated 경고를 낸다 | 우리는 둘 다 쓰지 않는다. `import_map.json` 이라는 **이름을 피해야** 한다(fallback 으로 읽힌다) |
| Deno 1.x: `--no-npm` 로 npm 무시 | `--node-modules-dir=none` / `nodeModulesDir: "none"` | Deno 2 | `--no-npm` 은 이 레포에서 **실패한다**("npm specifiers were requested; but --no-npm is specified" — 오케스트레이터 실측) |
| `deno.lock` 버전 3/4 | **버전 5** (`specifiers`/`jsr`/`npm`/`workspace` 섹션) | deno 2.x | 루트에서 만들면 `workspace.packageJson` 에 npm 의존성이 박힌다(§Q-1e) |
| Edge Function 이 타입체크 사각지대 | `npm run check:edge` 가 두 `index.ts` + 전이로 `_shared` 를 검사 | **이번 페이즈** | CLAUDE.md:41 · CONCERNS "[P1] Edge Function 이 타입체크·lint 사각지대" 진술이 낡는다(D-17) |
| 레포 `console.*` 0건 | 실패·폴백 경로마다 `console.error` | **이번 페이즈** | CONCERNS:148-151 "관측성" 권고의 첫 실행 |

**Deprecated/outdated (이 페이즈가 정정해야 하는 진술):**
- `CLAUDE.md:41` "두 `index.ts` 본문은 여전히 사각지대 — 텍스트 계약 + 낭독으로만 검증" → `deno check` 도입으로 절반이 해소된다(타입은 검사됨, 동작은 여전히 미검증).
- `CLAUDE.md:16,18` 엔트리포인트·흐름 문단의 `menus`·"11:55 에 호출" → `candidates`⋈`restaurants` + `settings.spin_time` + 매분 폴링으로.
- `.planning/codebase/CONCERNS.md:191-197` "[P1] Edge Function 이 타입체크·lint 사각지대" 의 "Safe modification: 수정 후 `deno check` 를 **수동 실행**" → `npm run check:edge` 로.
- `.planning/codebase/CONCERNS.md:148-151` "코드 전체에 `console.*` 호출이 0건" → D-10 이 무효화.
- `.planning/todos/pending/wr-01-cutover-window.md` 4번 "`--no-verify-jwt` 필수(config.toml 없음)" → `config.toml` 에 `verify_jwt = false` 가 있다(63fae89). `--help` 에 `--no-verify-jwt` 플래그가 여전히 존재함을 확인했으므로 "병행은 이중 안전" 이 정확한 문장이다.
- `03-RESEARCH.md §Environment Availability` 의 "**deno** ✗ 미설치" → 2.9.7 설치됨.

## Project Constraints (from CLAUDE.md)

| 지시 | 이 페이즈에서 의미하는 것 |
|------|---------------------------|
| **AGENTS.md: "This is NOT the Next.js you know"** — 코드 작성 전 `node_modules/next/dist/docs/` 확인 | 이 페이즈는 Next API 를 새로 쓰지 않는다(함수 본문 + 기존 페이지 1함수). `app/page.tsx` 는 이미 `"use client"` 이고 추가 API 사용 0 |
| 전부 클라이언트 컴포넌트, 서버 컴포넌트·Route Handler·서버 액션 없음 | 쓰기 권한이 필요한 로직은 Edge Function 으로 — 이 페이즈가 정확히 그 원칙의 실행이다 |
| **시간은 항상 `lib/time.ts` 경유**, `Date` 로컬 메서드 금지 | Edge 는 `lib/` 를 못 쓴다 → `_shared/kst.ts` 의 `kstNow()` 가 그 규칙의 Deno 쪽 대응물이다. `new Date().toISOString()`(respin 의 `spun_at`)은 UTC 직렬화라 예외 — 현행 유지 |
| 주석은 한글, Why 만. 파일 머리에 역할·제약 블록 주석 | 두 `index.ts` 머리 주석을 재작성한다(새 조회 대상·폴백 정책·`console.error` 규약). **금지/기준 토큰을 주석에 쓰지 않는다**(Pitfall 4) |
| `interface` 금지, 전부 `type` alias | 함수 안 로컬 타입 전부 `type` |
| **`any` 사용 0건.** 불확실한 곳은 `as` 단언 | 조회 결과 필드가 이미 `any` 로 새어 들어온다(§Q-2g) — `any` 를 **적지** 않고 `typeof` 로 좁히는 것이 이 제약의 실행이다. `as` 는 Pattern 1 로 회피 가능 |
| `~Action` 콜백 접미사 | 새 콜백 prop 0개 |
| `supabase/functions/` 제외는 **함수 디렉터리 2개만**, 좁힌 제외를 다시 넓히지 말 것 | 이 페이즈는 제외 범위를 건드리지 않는다. 대신 그 2개에 `deno check` 를 붙인다 |
| `verify_jwt = false` 고정(변경 금지) | `supabase/config.toml` 무변경. 배포도 하지 않는다 |
| `npm run dev` 는 가드런처로만 | dev 서버 없이 전부 검증된다(`check:edge` 포함) |
| `.serena/project.yml` 커밋 금지 | 커밋 시 파일 명시(`--` 경로 지정) 관행 유지 |
| 커밋·PR 에 AI 표기 금지 | 유지 |
| 라이브 DB·Edge Function·`main` 불변 (컷오버 전) | §Runtime State Inventory — 파일만 바꾼다. `npx supabase functions deploy` 를 절대 실행하지 않는다 |
| 마이그레이션은 사용자가 대시보드에서 적용 | 이 페이즈는 SQL 을 만들지도 적용하지도 않는다 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgREST 가 `candidates`⋈`restaurants` many-to-one 임베드를 **객체**로 돌려준다(문서 인용, 실호출 미검증) | §Q-2a | Pattern 1 이 배열/객체 양쪽을 접으므로 **어느 쪽이 와도 동작한다** — 이 가정이 틀려도 코드는 옳다. 그것이 Pattern 1 을 쓰는 두 번째 이유다 |
| A2 | Supabase 서버측 번들러가 `jsr:` 명세자를 배포 시점에 독립적으로 해석한다(로컬 lock 무시) | §Q-4b | CLI 소스에 lock 참조가 0건인 것은 검증됐다. 서버 동작 자체는 미검증 — 틀리면 lock 이 배포에도 반영돼 **더 안전한 쪽**으로 틀린다 |
| A3 | `invoke()` 반환의 `response` 필드가 `@supabase/supabase-js` `^2.106.0` 범위 안에서 계속 제공된다 | §Q-3b | 범프 후 사라지면 `npx tsc --noEmit` 이 즉시 잡는다(타입 에러). 대안 경로(`FunctionsHttpError.context`)로 1줄 되돌리면 된다 |
| A4 | Edge Runtime 의 `console.error` 가 대시보드 로그에 실제로 나타난다(문서 인용) | §Q-6c | 안 나오면 실패가 다시 안 보이게 된다 — 응답 JSON 의 세 boolean 이 이중 장치다(단 cron 은 응답을 안 읽으므로 respin 경로에서만 유효) |
| A5 | `Next 16.3.5` 빌드가 `allowImportingTsExtensions` 를 그대로 통과시킨다 | §Q-5 | 이 페이즈에 채택하지 않으므로 영향 0. v2 검토 시 `npm run build` 1회로 확인 |
| A6 | 컷오버 후 첫 실호출에서 `settings.spin_time` 이 `"HH:MM:SS"` 로 직렬화된다 | §Q-6f | `parseSpinTime` 이 `"HH:MM"`·`"HH:MM:SS"`·소수 초를 모두 받으므로 안전 실패(기본값 + `settings_fallback: true`) |
| A7 | 매분 `settings` SELECT 1회(1,440/일)가 무료 티어에서 문제없다 | D-05 | 과다하면 Supabase 대시보드의 사용량에서 보인다. 대안: 시각 판정 캐시(범위 밖) |

## Open Questions (RESOLVED 2026-09-28 — 오케스트레이터가 CONTEXT 에 반영)

> RESOLVED: 1 → D-01 (b) `--config` 채택 · 2 → D-02 `jsr:@supabase/supabase-js@2.117.2` 핀(사용자 결정 D4) · 3 → D-12 `response` 필드 · 4 → D-05 멱등 SELECT 에러는 `console.error` + 진행 · 5 → D-09 `candidate_count` 유지 + `picked_count` 신설 · 6 → D-14 #23/#48 로 `deno.json` 위치 고정. 아래 원문은 판단 근거로 보존한다.

1. **D-01 의 (a)/(b) 선택 — 리서치는 (b) 를 권고한다(CONTEXT 기본 선호와 반대).**
   - 아는 것: 배포 영향은 둘 다 0(§Q-1a·d 검증). lock 내용은 (b) 가 더 작고 `package.json` 과 독립(295 vs 276줄, `workspace.packageJson` 유무).
   - 불확실한 것: 사용자가 "레포에 파일을 더 만들지 않는다" 를 더 중시하는지(그러면 (a)).
   - **권고: (b).** 파일이 1개 더 늘지만 그 파일이 이유를 담고(jsonc 로 하면 한글 주석까지), 명령이 짧고, 실수로 루트 lock 이 생길 경로가 없다. 플랜 04-01 에서 한 태스크로 끝난다.

2. **Q-4c 의 jsr 명세자 핀 여부 — 권고 A(런타임만 핀), 사용자 확인 필요.**
   - 아는 것: lock 은 로컬 check 만 고정하고 배포는 그 시점 최신을 쓴다(검증).
   - 불확실한 것: 사용자가 "배포되는 것과 검사한 것이 같아야 한다" 를 요구 수준으로 보는지, 아니면 패치 자동 수용을 선호하는지.
   - 권고: `jsr:@supabase/supabase-js@2.117.2` 로 핀(레포의 정확 버전 고정 컨벤션과 일치). 타입 전용 `edge-runtime.d.ts` 는 문서 형태 유지. **D-02 를 넓히는 제안이므로 계획 확정 전 승인 필요.**

3. **D-12 의 구현 경로 — `response` 필드 vs `FunctionsHttpError`.**
   - 아는 것: 둘 다 컴파일·동작 가능(§Q-3b 실측). `response` 는 `any` 0·import 0, `context` 는 공식 JSDoc 예시.
   - 권고: `response`. 다만 CONTEXT D-12 가 `FunctionsHttpError` 를 명문화했으므로 플래너가 바꿀 때 **근거를 태스크에 인용**해야 한다(A3 리스크 포함).

4. **멱등 SELECT 실패 시의 처리 — CONTEXT 에 없다.**
   - 권고: `console.error` + 진행(23505 가 보험). Pitfall 6. 플랜에 한 줄로 명시.

5. **`candidate_count` 의 의미가 두 함수에서 같은가.**
   - 아는 것: D-09 는 "쿨다운 적용 전" 으로 정의했고 현행 두 함수는 `menus.length`(= 적용 전)를 싣는다. `app/page.tsx` 는 이 값을 읽지 않는다(`RespinResponse` 에 없다).
   - 권고: 정의 그대로 두고 `picked_count` 를 추가. 소비처가 없으니 호환 리스크 0.

6. **계약 테스트가 `deno.json` 위치까지 고정할 것인가(#23 제안).**
   - 권고: 한다. Pitfall 3 은 배포까지 조용하고 되돌리는 비용이 크다. `existsSync` 2건이면 충분하다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **deno** | `npm run check:edge`(D-01·SC-5) | **✓** | 2.9.7 (내장 TS 6.0.3), `/opt/homebrew/bin/deno`, DENO_DIR `~/Library/Caches/deno`(38MB) | 없음 — 없으면 SC-5 를 만족할 수 없다 |
| Node.js | 전체 | ✓ | v25.6.1 | — |
| TypeScript (`tsc`) | `lib`·`_shared`·`app` 게이트 | ✓ | 5.9.3 | — |
| vitest | 계약·단위 테스트 | ✓ | 4.1.11 (정확 고정) | — |
| ESLint | lint 게이트 | ✓ | 9.39.4 | — |
| Next.js (Turbopack) | `npm run build` | ✓ | 16.3.5 (`.env.local` 존재) | — |
| jsr 레지스트리(네트워크) | `deno check` 최초 해석 | ✓ | — | lock + DENO_DIR 캐시가 있으면 오프라인에서도 재실행된다(캐시 확인됨) |
| Supabase CLI | **이 페이즈에서 불필요** | ✓ (npx 캐시 2.117.0) | 2.117.0 | 배포는 Phase 8. 실행하지 않는다 |
| Docker | (선택) 로컬 eszip 번들 | ✓ | 29.2.0 | 기본 배포가 API 번들링이라 필요 없다(§Q-4b) |
| 로컬 Supabase 스택 / psql | 두 함수 실호출 | **✗** | — | **폴백 없음** → `deno check` + 텍스트 계약 + `_shared` 단위 + 낭독. 실호출은 Phase 8 |

**Missing dependencies with no fallback:**
- **로컬 Supabase 스택·라이브 새 테이블.** 라이브에 `settings`·`candidates`·`restaurants` 가 없어(0005 미적용) 재작성된 함수는 컷오버 전 **한 줄도 실행할 수 없다**. 이 페이즈가 만드는 것은 "배포되면 맞을 것" 이고, 그 검증은 Phase 8 SHIP-04 의 respin 수동 invoke 다. Pitfall 1(임베드 형태)은 오직 그 지점에서만 드러나므로 **SHIP-04 체크리스트에 "응답 `menu` 가 실제 매장명인가" 를 반드시 추가**해야 한다.

**Missing dependencies with fallback:** 없음.

## Validation Architecture

> `.planning/config.json` `workflow.nyquist_validation: true` — 포함한다. `workflow.tdd_mode: true` 이므로 계약 테스트가 구현보다 먼저 RED 로 선다(Phase 2·3 방식).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| Config file | `vitest.config.mts` — **변경 불필요**(`supabase/functions/_shared/**/*.test.ts` include 이미 존재, Phase 3 실측) |
| Quick run command | `npx vitest run supabase/functions/_shared` |
| Full suite command | `npm test` |
| **신규 정적 게이트** | `npm run check:edge` = `deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts` (**0.47s 실측**) |
| 현재 기준선 | 10 파일 / **189 tests** 통과, 185ms (`edgeImports` 24(플래너 재측정 — 리서치 초안의 25 는 오기) · `spinTime` 15 · `cooldown` 14 · `kst` 9 · `errors` 7 …) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPIN-01 | 두 `index.ts` 가 타입 정합적이다(새 조회·새 필드 포함) | static | `npm run check:edge` | ❌ Wave 0 (스크립트 신설) |
| SPIN-01 | `from("menus")` 0회 · `from("candidates")` 1회 · `from("settings")` 1회 | contract | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` | ⚠️ 확장(D-14) |
| SPIN-01 | 시각 판정 → 멱등 → 후보 → 쿨다운 → insert **순서**(토큰 위치 비교) | contract | 〃 | ❌ Wave 0 |
| SPIN-01 | `23505` 분기 1회 유지 | contract | 〃 | ✅ #15 (인용) |
| SPIN-01 | `parseSpinTime`·`DEFAULT_SPIN_TIME` 이 spin 에 존재(하드코딩 시각 제거) | contract | 〃 | ❌ Wave 0 |
| SPIN-01 | 후보 0개면 결과 행을 만들지 않는다(`no_candidates` 토큰 + 순서 단언) | contract | 〃 | ⚠️ 확장 |
| SPIN-02 | `"../_shared/cooldown.ts"` import 1회 · `cooldownWindowStart(`·`applyCooldown(` 각 1회 | contract | 〃 | ❌ Wave 0 |
| SPIN-02 | `cooldown_days = 0` → 창 없음 / 제외 후 남음 / 0개면 전체 폴백 / `null` id 무시 / 경계 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` | ✅ 14케이스 (인용) |
| SPIN-04 | respin: `.upsert(` 1회 · `onConflict: "date"` **1회(주석 제거 사본)** | contract | `…/edgeImports.test.ts` | ⚠️ 확장 |
| SPIN-04 | respin: `OPTIONS` 단락 + CORS 보존 · `new Response(` 2회 | contract | 〃 | ✅ #22 + ❌ 신규 |
| SPIN-04 | respin 은 `spinTime.ts` 를 import 하지 않는다 | contract | 〃 | ✅ #17 (인용) |
| SPIN-04 | `formatRespinError`: 본문 우선 / 본문 null·비객체 / `error` 빈 문자열 | unit | `npx vitest run lib/errors.test.ts` | ❌ Wave 0 (3케이스) |
| SPIN-04 | `respin()` 이 본문을 읽는다(`response`/`context` 호출 존재) | 낭독 + tsc | `npx tsc --noEmit` (타입만) | 자동 단언 불가 → Manual-Only |
| SETT-04 | `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` `toEqual(DEFAULT_SPIN_TIME)` | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` | ❌ **Wave 0 (유일한 신규 단위 테스트)** |
| SETT-04 | `parseSpinTime("11:55:00")` 동일 | unit | 〃 | ✅ #2 (인용) |
| SETT-04 | `isAfterSpinTime` 11:54:59 / 11:55:00 경계 | unit | 〃 | ✅ #12·#13 (인용) |
| SETT-04 | `cooldownWindowStart(today, 0) === null` | unit | `…/cooldown.test.ts` | ✅ #1 (인용) |
| SETT-04 | `applyCooldown(c, [])` 항등 | unit | 〃 | ✅ #7 (인용) |
| SETT-04 | 폴백 플래그 3개 토큰이 두 파일에 존재(로그·계약이 읽을 키) | contract | `…/edgeImports.test.ts` | ❌ Wave 0 |
| (회귀) | `ResultRow.candidates` 확장이 `CalendarLog` 를 깨지 않는다 | static | `npx tsc --noEmit` | ✅ (현재 exit 0, 소비처는 `c.name`·`length` 만) |
| (회귀) | `_shared` 3파일 import 0 · 두 파일 복붙 부재 | contract | `…/edgeImports.test.ts` | ✅ #1~#14·#18~#21 (인용) |
| (신규 권고) | `supabase/functions/<slug>/deno.json` 이 **없다** | contract | 〃 | ❌ Wave 0 (Pitfall 3) |
| (신규 권고) | `check:edge` 실행 후 `git status` 가 깨끗하다(루트 lock 미생성 + lock 드리프트 없음) | manual/게이트 | `npm run check:edge && git status --porcelain` | — |

### Sampling Rate

- **Per task commit:** `npm run check:edge`(0.5s) + `npx vitest run supabase/functions/_shared lib`(~0.1s). 두 명령 합쳐 1초 미만이라 태스크마다 돌린다
- **Per wave merge:** `npx tsc --noEmit` + `npm run lint` + `npm test` + `npm run check:edge`
- **Phase gate:** 위 4개 + `npm run build` 전부 green + `npm audit` 0건 + `git status` 에 `.serena/project.yml` 외 미의도 변경 0(특히 루트 `deno.lock` 부재)
- **Max feedback latency:** 10초 (`npm run build` 는 페이즈 게이트 예외 — Phase 2·3 선례)

### Wave 0 Gaps

- [ ] **`package.json` `scripts.check:edge` + `supabase/functions/deno.json` + `deno.lock`(D-01·D-02)** — **가장 먼저.** 정적 게이트가 켜지기 전에 쓴 함수 코드는 타입 사각지대에서 자란다(Phase 3 Pitfall 4 의 재현)
- [ ] `lib/supabase/client.ts` `ResultRow.candidates` 1줄(D-08) — 함수가 쓸 형태를 타입이 먼저 인정해야 한다
- [ ] `supabase/functions/_shared/edgeImports.test.ts` 확장(D-14 + 권고 #23~#25) — RED
- [ ] `supabase/functions/_shared/spinTime.test.ts` 왕복 1케이스(D-15)
- [ ] `lib/errors.test.ts` 3케이스(D-13) — RED
- 프레임워크 설치 불필요 · `vitest.config.mts` 무변경 · 공용 픽스처 불필요

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 `index.ts` 의 **동작**(분기·순서·응답 본문) | SPIN-01·SPIN-04 | 라이브에 새 테이블이 없어 실호출 불가 | 낭독 6항목: (1) 임베드를 `Array.isArray` 로 접는가 (2) 모든 반환이 `json()` 을 거치는가(OPTIONS 제외) (3) 세 폴백 boolean 이 ok 응답에 **항상** 있는가 (4) `console.error` 가 500·폴백 경로마다 1건인가 (5) `insert`/`upsert` 본문에 `restaurant_id` 가 있는가 (6) D-05 순서가 코드 순서와 같은가 |
| 임베드가 실제로 객체로 오는가 | SPIN-01 | 실호출 필요 | **Phase 8 SHIP-04**: 컷오버 후 `curl -X POST …/functions/v1/respin-roulette` → 응답 `menu` 가 실제 매장명인지, `restaurant_id` 가 uuid 인지 확인. Pitfall 1 이 드러나는 유일한 지점 |
| `respin()` 배너에 함수 본문이 실리는가 | SPIN-04 | 브라우저 필요(`npm run dev` 는 가드런처만, 라이브 오염 금지) | Phase 8 이후 실사용 중 1회 확인, 또는 Phase 6 UI 검증에 위임 |
| `console.error` 가 대시보드 로그에 보이는가 | (관측성) | 배포 후에만 | Phase 8: 대시보드 Edge Function Logs 에서 1건 확인 |
| `check:edge` 가 배포 동작을 바꾸지 않았는가 | SC-5 | 배포 필요 | Phase 8: `functions deploy` 출력에 `WARNING: Functions using fallback import map` / `deprecated import_map.json` 이 **없어야** 한다(§Q-1a 의 경고 문구) |

## Security Domain

> `security_enforcement` 설정 없음 = 활성으로 취급.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 익명 서비스가 설계 정체성(REQUIREMENTS Out of Scope). `respin-roulette` 무인증은 기록된 수용 결정(CONCERNS 유지) |
| V3 Session Management | no | 세션 없음 |
| V4 Access Control | **yes** | `results` 쓰기 정책 0건 = service_role 전용. 이 페이즈는 **service_role 키를 쓰는 코드를 다시 쓴다** — 키가 응답·로그에 새지 않는지가 통제점. `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` 를 `console.*`·응답 본문에 절대 싣지 않는다 |
| V5 Input Validation | **yes** | 함수의 입력은 **DB 값**이다(사람이 대시보드에 넣은 `spin_time`·`cooldown_days`, 누구나 담는 `candidates`). `parseSpinTime`·`cooldownWindowStart` 가 총 함수이고, 조회 결과는 `unknown` 좁히기를 거친다(Pattern 1·4). `date`·`menu` 는 DB 제약이 든다 |
| V6 Cryptography | **yes** | `pickRandom` 의 `crypto.getRandomValues` 유지. `Math.random()` 으로 바꾸지 않는다(추첨 공정성) |
| V7 Error Handling & Logging | **yes** | **두 채널을 구분한다**: `console.error` → 로그(`details`·`hint` 포함 가능, 사용자에게 안 보임), `{ error: message }` → 브라우저(`error.message` 만 — `lib/errors.ts:5` 의 근거 그대로). 500 본문에 `details` 를 실으면 SQL 조각·컬럼명이 익명 사용자에게 노출된다 |
| V14 Configuration | **yes** | `verify_jwt = false` 고정(변경 금지). `deno.json` 을 함수 디렉터리에 두지 않는 것도 배포 설정 불변성의 일부다(Pitfall 3) |

### Known Threat Patterns for service_role Edge Function + 익명 호출

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 500 본문에 `details`·`hint` 가 실려 스키마가 샌다 | Information Disclosure | 응답에는 `error.message` 만. `details` 는 `console.error` 쪽에만 |
| `console.error` 에 service_role 키·전체 행이 찍힌다 | Information Disclosure | 메시지에 실을 값을 명시적으로 고른다(무엇이·어떤 값으로 실패했나). 10,000자 제한도 통째 덤프를 막는 이유 |
| `respin-roulette` 를 반복 호출해 결과를 계속 바꾼다 | Tampering | 익명 서비스 설계상 수용(CONCERNS 기록 유지). 이 페이즈가 인증·레이트리밋을 추가하지 않는 것은 **의도된 범위 밖**이며 변경하지 않는다 |
| `OPTIONS` 프리플라이트가 본문 로직을 실행해 결과가 중복 덮어써진다 | Tampering | 현행 단락 유지 + 계약 테스트 #22. 재작성에서 `Deno.serve` 첫 줄 위치를 지킨다 |
| 매분 폴링이 동시에 두 번 떠 결과가 두 번 만들어진다 | Tampering | `unique(date)` + `23505` 정상 경로(#15). 애플리케이션 락을 만들지 않는다 |
| 쿨다운 조회 실패를 삼켜 추첨이 통째로 빠진다 | Denial of Service | D-06 의 "미적용 진행 + `cooldown_skipped: true`". Core Value 가 설정 존중보다 우선 |
| 잘못된 `spin_time` 하나로 추첨이 영구히 멈춘다 | DoS | `parseSpinTime` 총 함수 + `DEFAULT_SPIN_TIME` 착지 + `settings_fallback: true` |
| 배포 시 `verify_jwt` 가 true 로 올라가 401 로 추첨이 조용히 멈춘다 | DoS | `config.toml` 고정(63fae89) + Phase 8 에서 `--no-verify-jwt` 병행 |

## Sources

### Primary (HIGH confidence)

**로컬 실행(이 머신·이 레포에서 직접 확인):**
- `deno check` × 11 — 플래그 4변형 × lock 위치 3종, config 자동 발견(cwd 2케이스), lock 핀 다운그레이드 실험, `--frozen` 드리프트, 타입 폭로 5파일, `_shared` 전이 검사, 전체 스켈레톤 1건
- `node_modules/.bin/tsc` 5.9.3 × 2 — `invoke()` 반환 3필드 타입 폭로, `allowImportingTsExtensions` 프로브
- `npm test` 1회(189/189) · `npx tsc --noEmit` 1회(exit 0) — 조사 전후 상태 동일 확인
- `npx --offline supabase@2.117.0 functions deploy --help` — 플래그 전수(캐시된 CLI, 원격 호출 0)
- `grep -F -c` 토큰 실측 — 두 `index.ts` 13토큰 × 2파일
- `node_modules/@supabase/functions-js/dist/module/{FunctionsClient.js,types.d.ts,FunctionsClient.d.ts}` 직독
- `node_modules/@supabase/postgrest-js/dist/index.mjs:756-757` — `order` 의 `referencedTable` 분기
- `node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js` — 강제 옵션 목록(`allowImportingTsExtensions` 부재)
- 레포 파일 전수: `supabase/functions/**` · `supabase/migrations/0005_*.sql` · `lib/**` · `app/page.tsx` · `CLAUDE.md` · `.planning/**`

**Supabase CLI 소스(GitHub `v2.117.0` 태그, `gh api` 로 직독):**
- `apps/cli/src/shared/functions/deploy.ts` — import map 해석 순서(1995-2021), `defaultFunctionImportMap`(810), `shouldUseDenoJsonDiscovery`/`shouldUsePackageJsonDiscovery`(1365-1379), `DENO_NO_PACKAGE_JSON=1`(1447-1452), `useLocalBundler`(2323), `lock` 참조 0건
- `apps/cli-go/pkg/config/config.go:925-950` — Go 구현의 동일 규칙
- `apps/cli-go/pkg/function/deno.go:21-47` — `deno.json` 을 import map 으로만 파싱(`imports`/`scopes`/`importMap`)
- `apps/cli/src/commands/functions/deploy/SIDE_EFFECTS.md` — Files Read/Written 표(lock 부재)

**공식 문서:**
- https://docs.postgrest.org/en/v13/references/api/resource_embedding.html — to-one 임베드가 JSON 객체, top-level `order` 는 부모 정렬
- https://supabase.com/docs/guides/functions/logging — `console.log/error/warn` 이 Logs 에 나타남, 10,000자 / 10초 100건
- https://supabase.com/docs/guides/functions/import-maps — 함수별 `deno.json` 권고, `--import-map`·`config.toml import_map` 우선
- https://docs.deno.com/runtime/fundamentals/configuration/ — config 자동 발견은 cwd 와 상위 디렉터리

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/guides/database/joins-and-nesting — "one-to-many 는 `[]`, many-to-one 은 매칭 없으면 `null`", `!inner` 의미(요약 인용 — 원문 대조는 PostgREST 쪽으로 대체)
- `.planning/phases/03-pure-logic/03-RESEARCH.md` §Q2·Q4·Q5 — `_shared` 번들 패턴, `maybeSingle` 0행, vitest 수집 경계(Phase 3 실측 재인용)

### Tertiary (LOW confidence)
- 없음. 이 문서의 모든 판정은 로컬 실행·설치본/CLI 소스 직독·공식 문서 인용 중 하나를 근거로 한다.

## Metadata

**Confidence breakdown:**
- `deno check` 도입 형태·lock 위치·배포 무영향: **HIGH** — 6가지 호출을 실행하고 CLI 소스 3파일을 직독했다. 미검증은 배포 실행 자체(Phase 8)
- supabase-js 조회 타입 ↔ PostgREST 런타임 형태: **HIGH(타입) / MEDIUM(런타임)** — 타입은 5회 폭로로 확정, 런타임 객체 형태는 문서 인용뿐이다. **Pattern 1 이 이 불확실성을 무해하게 만든다**(양쪽을 접는다)
- `FunctionsHttpError`/`response` 본문 읽기: **HIGH** — 설치본 구현·타입 양쪽 확인
- jsr 버전 해석: **HIGH(로컬) / MEDIUM(배포)** — 로컬 lock 우선은 실험으로 확정, 서버 번들러 동작은 CLI 소스의 부정적 증거(lock 미참조)에 의존
- Edge Runtime 세부(`Deno.serve`·`env`·로그): **HIGH** — 타입은 실측, 로그는 공식 문서 인용
- `allowImportingTsExtensions`(Q-5): **MEDIUM** — tsc·deno 는 실측, Next 빌드는 미실행(채택하지 않으므로 영향 0)

**Research date:** 2026-09-28
**Valid until:** 2026-10-28 (30일). 단 다음 중 하나가 일어나면 재확인: (1) `@supabase/supabase-js` 범프 → §Q-3b 의 `response` 필드와 §Q-2f 의 추론 타입, (2) Supabase CLI 범프 → §Q-1a 의 import map 탐색 경로, (3) deno 범프 → 내장 TS 버전과 lock 포맷
</content>
</invoke>
