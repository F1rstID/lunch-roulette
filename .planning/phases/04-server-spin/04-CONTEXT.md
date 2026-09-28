# Phase 4: 서버 추첨 - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning
**Source:** 오케스트레이터가 ROADMAP Phase 4 성공 기준 5항 + 승인된 설계(02-CONTEXT D-01~D-04·D-08, 03-CONTEXT D-02·D-05·D-14, PROJECT.md Key Decisions) + 캐리포워드 todo(wr-02-respin-error-body) + 사용자 결정 D1~D3(2026-09-28) 를 현재 코드·실측에 대조해 옮김 (discuss-phase 대체, Phase 2·3 방식)

<domain>
## Phase Boundary

두 Edge Function(`spin-roulette`·`respin-roulette`) 본문을 새 스키마(`candidates` → `restaurants` 조인)·`settings`(추첨 시각·쿨다운)·`_shared` 쿨다운 필터 위에서 **재작성**하고, 결과 행에 매장명 스냅샷과 `restaurant_id` 를 함께 쓴다. `deno check` 를 로컬 정적 검사로 **도입**한다(사용자 결정 D1, 로드맵 SC-5). 클라이언트 변경은 두 가지뿐이다: `ResultRow.candidates` 타입 1줄, `app/page.tsx` `respin()` 의 500 본문 표면화(사용자 결정 D3, todo wr-02). **배포·마이그레이션 적용은 하지 않는다**(Phase 8). 라이브·main 무변경.

**하지 않는 것:** 오늘 탭의 후보 소스 `menus` → `candidates` 교체(Phase 6), 화면 문구·휠·타임라인(Phase 6), 기록·랭킹(Phase 7), `respin-roulette` 인증·레이트리밋(설계상 수용 — CONCERNS 기록 유지), 결과 없는 날 감지 헬스체크 cron(범위 밖), Edge Function 배포·`--no-verify-jwt`·실호출 검증(Phase 8).

**현재 코드 사실(계획 전제, 2026-09-28 실측):**
- `supabase/functions/spin-roulette/index.ts`(97줄)·`respin-roulette/index.ts`(89줄): 둘 다 `from("menus").select("id, name")` 를 읽고 `candidates: [{ name }]` 스냅샷만 쓰며 `restaurant_id` 를 기록하지 않는다. spin 은 `isAfterSpinTime(now, DEFAULT_SPIN_TIME)` 하드 판정(settings 미독), 멱등 검사 `select("date, menu")`, insert 23505 → `race_already_decided`. respin 은 CORS 헤더 + `OPTIONS` 단락 + `json()` 헬퍼, `upsert(..., { onConflict: "date" })`, 시간 가드·멱등 없음. 두 파일 모두 `console.*` 0건(레포 전체 0건 — CONCERNS "관측성").
- `_shared` 계약(Phase 3 완료): `kst.ts`(`kstNow()`·`pickRandom`·`KstParts` 8필드), `spinTime.ts`(`DEFAULT_SPIN_TIME`·`DEFAULT_SPIN_TIME_TEXT`·`parseSpinTime`·`isAfterSpinTime`), `cooldown.ts`(`cooldownWindowStart(today, days): string | null`·`applyCooldown(candidates, ids): { picked, fellBack }`). **세 파일 import 0개 규칙**(type import 포함). `edgeImports.test.ts` 24건이 두 `index.ts` 를 텍스트로 고정(#7~#22: `../_shared/kst.ts` import, 복붙 부재, 23505 유지, CORS/OPTIONS 유지, respin 은 `spinTime.ts` 미import).
- 스키마(`0005`, 미적용): `candidates(restaurant_id uuid PK → restaurants.id on delete cascade, created_at)`, `restaurants(id, name, menus text[], location, pinned, created_at)`, `settings(id=1, spin_time time default '11:55', cooldown_days int default 0, history_since date)`, `results.restaurant_id uuid null → restaurants.id on delete set null`. cron `spin-lunch-roulette` 는 `* * * * *` 매분 폴링(시각 판정은 함수 몫), `net.http_post` 는 fire-and-forget(응답 미검사).
- `lib/supabase/client.ts:22` `ResultRow.candidates: { name: string }[]`. 소비처는 `components/CalendarLog.tsx:223,248,251` 뿐이고 `c.name` 만 읽는다. `SettingsRow`(client.ts:52-57)는 lib 전용 — Deno 에서 import 불가.
- `app/page.tsx:217-226` `respin()`: `supabase.functions.invoke<RespinResponse>("respin-roulette")` 의 `error.message`(supabase-js 고정 문구 "Edge Function returned a non-2xx status code")만 배너에 싣고, 함수가 보낸 `{ error }` 본문은 버린다. `RespinResponse.error` 는 선언만 있다. supabase-js 2.106.0: `FunctionsHttpError extends FunctionsError { context: any }`(`context` 는 `Response`), `@supabase/supabase-js` 에서 export.
- **deno 2.9.7 설치됨**(`brew install deno`, 2026-09-28, D1). 실측: `deno check supabase/functions/<fn>/index.ts` 기본 실행은 **두 파일 모두 실패** — `jsr:@supabase/functions-js/edge-runtime.d.ts`(2.117.2 로 해석)가 `npm:openai@^4.52.5` 타입을 참조하고, 레포 루트 `package.json` 때문에 deno 가 BYONM 모드로 `node_modules` 에서 찾다 실패한다. `deno check --node-modules-dir=none <file>` 과 `--config <deno.json>`(`{"nodeModulesDir":"none"}`) 은 **현행 두 파일에서 통과**(`Check …` 출력, 에러 0). `--no-npm` 은 실패. 실행 시 루트에 `deno.lock` 이 생성된다(프로브 후 삭제함). `supabase/functions/deno.json` 은 레포에 없다(03-RESEARCH:120).
- `jsr:@supabase/supabase-js@2` 는 오늘 2.117.2 로 해석된다(클라이언트는 2.106.0). `Database` 제네릭 없이 쓰므로 `.select()` 결과 타입은 느슨하다 — 조인 결과는 함수 안 로컬 타입으로 받는다.
- 라이브에 `settings`·`candidates`·`restaurants` 가 없다 → 이 페이즈의 함수는 **컷오버 전 실호출 불가**. 검증 수단은 `deno check`(D-01) + `edgeImports.test.ts` 계약 + `_shared` 단위 테스트 + 낭독뿐이다.
</domain>

<decisions>
## Implementation Decisions

### deno 정적 검사 도입 (사용자 결정 D1, 로드맵 SC-5)
- **D-01 `deno check` 가 두 `index.ts` 의 정적 게이트다.** 모든 함수 수정 태스크의 완료 조건에 "두 파일 `deno check` exit 0" 을 넣는다. **호출 형태는 (b) 로 확정**(리서치 §Q-1 실측, 2026-09-28): `supabase/functions/deno.json` = `{"nodeModulesDir":"none"}` 한 줄, `package.json` scripts 에 `"check:edge": "deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts"`(실측 0.47s, exit 0). 근거: Supabase CLI 2.117.0 소스(`deploy.ts:810,1995-2021`)의 import map 탐색은 `<functionDir>/deno.json`·`.jsonc`·`import_map.json`·`supabase/functions/import_map.json` 뿐이라 **`supabase/functions/deno.json` 은 배포에 보이지 않고**, 번들러는 `DENO_NO_PACKAGE_JSON=1` 로 돌아 로컬 실패 원인을 우회하며, `lock` 참조 0건. (a) `--node-modules-dir=none` 은 lock 에 루트 `package.json` 의존성 13개를 `workspace.packageJson` 으로 박아(295줄) npm 변경마다 흔들리므로 기각. **함수 디렉터리 안(`spin-roulette/`·`respin-roulette/`)에 `deno.json`·`deno.jsonc`·`import_map.json` 을 두는 것은 금지** — 거기 두면 배포 import map 으로 채택돼 번들이 바뀐다(계약 테스트 D-14 #23 으로 부재를 고정). 부수 이득: `deno check --config` 는 `_shared/*.ts` 를 전이 검사하므로 `_shared` 가 tsc 5.9.3 + Deno TS 6.0.3 두 컴파일러를 통과해야 한다. 원칙 유지: 루트 `package.json`·`node_modules` 오염 금지, 배포 동작 무변경, 검증 명령 4개 → 5개(CLAUDE.md 갱신은 D-17).
- **D-02 `deno.lock` + 런타임 명세자 핀(사용자 결정 D4, 2026-09-28).** `supabase/functions/deno.lock`(config 옆에 자동 생성, 276줄, `workspace.packageJson` 없음)을 **커밋**한다 — 로컬 해석을 실제로 고정함이 실측됐다(2.117.1 로 내리면 deno 가 따름). 루트 `deno.lock` 은 만들지 않는다(생기면 `.gitignore` 가 아니라 명령을 고친다). `check:edge` 실행 후 `git status` 가 깨끗해야 한다 — lock 드리프트 감지기(`--frozen` 은 diff 를 내며 실패하므로 스크립트에 넣지 않고 `git status` 게이트로 본다). 배포는 기본이 API 측 번들링(`useLocalBundler = !useApi && (useDocker || legacyBundle)`)이라 lock 을 읽지 않는다 → 검사 버전 == 배포 버전이 되도록 **두 `index.ts` 의 런타임 import 를 `jsr:@supabase/supabase-js@2.117.2` 로 핀**한다. 타입 전용 `import "jsr:@supabase/functions-js/edge-runtime.d.ts"` 는 공식 문서 형태 그대로 둔다(핀 안 함 — 런타임 동작 0). 버전 올리는 절차(두 import 줄 + lock 재생성)는 CLAUDE.md 에 한 줄(D-17).

### Edge Function 본문 (SPIN-01·SPIN-04·SETT-04, SPIN-02 마감 — 로드맵 SC-1·2·3)
- **D-03 후보 조회 = `candidates` → `restaurants` 조인.** `from("candidates").select("restaurant_id, created_at, restaurants ( id, name )").order("created_at", { ascending: true })`(FK `candidates.restaurant_id → restaurants.id` 임베드; `.order` 는 부모 `candidates` 정렬 — postgrest-js 실측). **런타임 형태는 객체**(PostgREST many-to-one, 매칭 없으면 `null` — 문서 인용)인데 **`Database` 제네릭 없는 추론 타입은 배열**(`restaurants: { id: any; name: any }[]` — 실측, 공백·`!inner`·별칭 변형 전부 동일)이다. 즉 `row.restaurants[0].name` 은 `deno check` 를 통과하고 런타임에 `undefined` 를 준다 — **이 페이즈 최대 함정**. 따라서 **조회 결과를 추론 타입으로 소비하지 않는다**: `data` 를 `unknown` 을 받는 정규화 헬퍼에 넘겨 `Array.isArray(embed) ? embed[0] : embed` 로 접고 `typeof` 로 좁힌다(`as`·`any` 0 으로 컴파일 통과 확인 — 리서치 §Code Examples 1). 정규화 결과는 `{ restaurant_id: string; name: string }[]`(담은 순서 유지) — 임베드가 `null`/형태 불일치인 행(조회 사이에 매장이 삭제된 경합)은 **제외**하고 `console.error` 로 남긴다(삼키지 않음). 헬퍼 이름·시그니처는 두 파일에서 같게 한다(D-14 #25). `settings` `maybeSingle()` 의 추론 타입도 `{ spin_time: any; cooldown_days: any } | null` 이라 `parseSpinTime` 에 넘기기 전 `typeof === "string"` 좁히기가 필요하다(같은 원칙).
- **D-04 설정 읽기 정책(사용자 결정 D2).** `from("settings").select("spin_time, cooldown_days").eq("id", 1).maybeSingle()`. (1) `row === null`(0행) → 기본값(`DEFAULT_SPIN_TIME`, 쿨다운 0), 에러 아님, 플래그 없음. (2) **조회 에러** → 기본값으로 **진행** + `console.error` + 응답 `settings_fallback: true`. (3) `parseSpinTime(row.spin_time) === null` → `DEFAULT_SPIN_TIME` + 같은 플래그(클라이언트 `settingsFromRow` 의 warning 과 대칭). `cooldown_days` 는 그대로 `cooldownWindowStart` 에 넘긴다(오염 입력은 그쪽이 `null` = 창 없음으로 흡수). 근거: Core Value "매일 하나가 자동 확정" > 설정 존중; 클라이언트 SETT-03 과 같은 규칙. `respin-roulette` 는 `cooldown_days` 만 쓰지만 같은 조회·같은 정책.
- **D-05 `spin-roulette` 순서(변경 금지).** `kstNow()` → 설정(D-04) → `isAfterSpinTime(now, spinTime)` 거짓이면 `{ skipped: "before_spin_time", kst: now }`(8필드 유지 — cron 로그에서 함수가 본 시각을 보는 유일한 창) → 오늘 `results` 존재(`select("date, menu, restaurant_id")`, D-18; **조회 에러면 `console.error` 후 진행** — 23505 가 멱등의 보험이라 여기서 멈추면 그날 추첨만 잃는다, 리서치 Pitfall 6) → `{ skipped: "already_decided", date, menu, restaurant_id }` → 후보(D-03) 0개 → `{ skipped: "no_candidates", date }`(행 미생성 = SPIN-03 서버 반) → 쿨다운(D-06) → `pickRandom(picked)` → `insert({ date, menu: winner.name, restaurant_id: winner.restaurant_id, candidates: snapshot })` → `23505` → `{ skipped: "race_already_decided", date }`; 그 외 insert 에러 → 500. 설정 읽기가 시각 판정보다 앞서는 이유: 판정 자체가 `settings.spin_time` 에 의존한다. 매분 폴링 전제에서 추첨 전 구간은 조회 1회/분(settings)이고, 그 값은 무료 티어 여유 안이다(PROJECT "cron 매분 폴링").
- **D-06 쿨다운 배선(SPIN-02 마감).** `const from = cooldownWindowStart(now.date, cooldownDays)`. `null` 이면 **조회를 생략**한다(쿨다운 0 = 쿼리 0회 = 전환 전과 동일 경로, SETT-04 의 근거). 아니면 `from("results").select("restaurant_id").gte("date", from).lt("date", now.date)` → `applyCooldown(candidates, rows.map(r => r.restaurant_id))`. 조회 에러 → 쿨다운 **미적용으로 진행** + `console.error` + 응답 `cooldown_skipped: true`(D-04 와 같은 Core Value 논증). `applyCooldown.fellBack` → 응답 `cooldown_fallback: true`. 창 의미(오늘 제외 `[today−N, today−1]`, `null` id 무시, 비면 전체 폴백)는 03-CONTEXT D-05 그대로 — 여기서 재정의하지 않는다.
- **D-07 `respin-roulette`.** 유지: CORS 헤더·`OPTIONS` 단락·`json()` 헬퍼·시간 가드 없음·멱등 없음(오늘 결과가 없어도 행을 만든다 — 현행 동작이고 `stalled` 상태의 "지금 돌리기" 여지). 변경: 후보 D-03, 설정 D-04(`cooldown_days`), 쿨다운 D-06, `upsert({ date, menu, restaurant_id, candidates, spun_at: new Date().toISOString() }, { onConflict: "date" })`. 에러는 전부 `json({ error: message }, 500)` + `console.error`. **모든 반환 경로가 `json()` 헬퍼를 지난다** — 500 에 CORS 헤더가 빠지면 브라우저가 응답을 차단해 supabase-js 가 `FunctionsFetchError` 를 주고 D-12 의 본문 읽기가 조용히 죽는다(리서치 Pitfall 2). `new Response(` 는 OPTIONS 단락 1 + 헬퍼 1 = **2회**로 계약 테스트가 고정(D-14 #24). `spin-roulette` 도 같은 이름의 `json()` 헬퍼(CORS 없음 — pg_net 호출)로 반환을 통일한다. `spinTime.ts` 는 여전히 import 하지 않는다(#17 유지 — 시간 가드가 없으니 `parseSpinTime` 도 불필요).
- **D-08 스냅샷 형태(02-CONTEXT D-04 확정 사항의 실행).** `candidates: [{ name, restaurant_id }]` (담은 순서). `lib/supabase/client.ts` `ResultRow.candidates` → `{ name: string; restaurant_id?: string }[]` — 레거시 60행에는 키가 없으므로 **optional**. `components/CalendarLog.tsx` 는 `name` 만 읽어 무변경(`npx tsc --noEmit` exit 0 으로 확인). 주석에 "Phase 4 부터 restaurant_id 포함, 이전 행은 name 만" 을 남긴다.
- **D-09 응답 JSON 계약(두 함수 공통 키).** ok 경로: `{ ok: true, date, menu, restaurant_id, candidate_count, cooldown_fallback, cooldown_skipped, settings_fallback }` — 세 boolean 은 **항상 존재**(계약 테스트·로그 grep 이 쉬움). skip 경로: `{ skipped: "before_spin_time" | "already_decided" | "no_candidates" | "race_already_decided", date, … }`. 에러: `{ error: string }` + status 500. `menu` 키 이름은 유지(컬럼명과 같고 `app/page.tsx` `RespinResponse` 와 호환). `candidate_count` 는 쿨다운 **적용 전** 후보 수(전환 전 의미 유지); 적용 후 수는 `picked_count` 로 따로 싣는다.
- **D-10 `console.error` 규약 신설.** 500 경로·폴백 경로(D-04 (2)(3), D-06 조회 에러, D-03 조인 미스)마다 `console.error` 1건. 메시지에 맥락(무엇이·어떤 값으로 실패했나 — 예: `settings 조회 실패: <message>`, `spin_time 파싱 실패: "<raw>"`). 현재 레포 `console.*` 0건이라 규약을 CLAUDE.md 에 한 줄로 기록한다(D-17). 클라이언트(`app/`·`lib/`)에는 도입하지 않는다 — 거기는 배너가 채널이다.
- **D-11 타입은 함수 안 로컬.** `SettingsRow`·조인 행·`ResultRow` 를 `lib/` 에서 가져올 수 없다(Deno). 각 `index.ts` 안에 필요한 최소 구조 타입을 선언하고 주석으로 `lib/supabase/client.ts` 와 상호 참조한다. **`_shared` 에 새 모듈을 추가하지 않는다** — 순수 판정 조합(`decideSpin` 류)은 `_shared` 파일 간 import 를 요구해 import 0개 규칙과 충돌한다(03-CONTEXT D-02·D-17). jsr import 가 있는 파일을 `_shared` 에 두는 것도 금지(tsc·vitest 수집 범위 `_shared/**` 가 깨진다). 두 함수의 I/O 중복(설정·후보·쿨다운 조회)은 수용하고 계약 테스트가 양쪽을 같은 규칙으로 고정한다(D-14).

### 클라이언트 — respin 500 본문 표면화 (사용자 결정 D3, todo wr-02)
- **D-12 `app/page.tsx` `respin()` — `response` 필드 경로(리서치 §Q-3 로 확정).** `functions.invoke()` 의 반환 객체에는 `data`·`error` 외에 `response` 가 있고 레포 tsc 5.9.3 에서 `Response | undefined` 로 타입된다(실측). non-2xx 에서 `FunctionsClient.js:262` 가 본문을 읽기 전에 `throw new FunctionsHttpError(response)` 하고 catch 가 `{ data: null, error, response: error.context }` 를 돌려주므로 `response` 는 `error.context` 와 같은 미독 `Response` 다. 따라서 **`FunctionsHttpError` 값 import 없이** `const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette")`; `error` 이면 `const body = response ? await response.json().catch(() => null) : null`; 메시지는 D-13 헬퍼로 조립해 `setActionError(\`다시 돌리기 실패: ${message}\`)`. `any` 를 한 번도 거치지 않는다(`error`·`error.context` 는 `any`). `RespinResponse.error` 가 실제로 읽힌다. `.catch` 인 이유: 본문이 JSON 이 아닐 때(게이트웨이 HTML) 두 번째 예외로 배너가 사라지면 안 된다. 선행 조건: 함수 쪽 500 에 CORS 헤더(D-07).
- **D-13 순수 헬퍼 + 테스트.** `lib/errors.ts` 에 `formatRespinError(fallbackMessage: string, body: unknown): string` — `body` 가 `{ error: string }`(비어 있지 않은 문자열)이면 그것, 아니면 `fallbackMessage`. `lib/errors.test.ts` 에 3케이스(본문 우선 / 본문 null·비객체 / `error` 가 빈 문자열). `instanceof`·`json()` 은 페이지(I/O)에, 판단은 순수 모듈에 — "훅에는 I/O 만, 판단은 순수 모듈로" 컨벤션의 페이지 적용. `lib/errors.ts` 의 supabase 값 import 0 유지(페이지도 D-12 로 값 import 를 늘리지 않는다).
- **D-13a** 해결 시 `.planning/todos/pending/wr-02-respin-error-body.md` 를 **삭제**한다(Phase 3 에서 in-03-04 를 처리한 관례 — `done/` 디렉터리 없음).

### 테스트·검증 (로드맵 SC-4·SC-5, QUAL 관례)
- **D-14 `edgeImports.test.ts` 계약 갱신.** 유지: #1~#6(`_shared` 3파일 import 0), #7a/#16a(진입점 1개), #7·#8·#16(import 경로), #9~#14·#18~#21(복붙 부재), #15(23505 1회), #17(respin 은 spinTime 미import), #22(OPTIONS·CORS). 추가(두 파일 각각): `from("menus")` **0회**, `from("candidates")` 1회, `from("settings")` 1회, `from("results")` ≥1, `restaurants` 임베드 토큰 존재, `"../_shared/cooldown.ts"` import 1회, `cooldownWindowStart(`·`applyCooldown(` 각 1회, `restaurant_id` 가 insert/upsert 본문에 존재, `console.error(` ≥1, `settings_fallback`·`cooldown_fallback`·`cooldown_skipped` 토큰 존재. spin 만: `parseSpinTime(`·`DEFAULT_SPIN_TIME` 존재, `jsr:@supabase/supabase-js@2.117.2` 핀 토큰 존재(두 파일, D-02), 순서 불변식 — `isAfterSpinTime(` 의 `indexOf` < 멱등 조회 < 후보 조회 < `applyCooldown(` < `.insert(`(토큰 위치 비교로 D-05 순서를 고정). respin 만: `.upsert(` 1회, `onConflict: "date"` 1회(주석 제거 사본 — 원본은 주석 포함 2회로 실측됨). **리서치 제안 3종 추가:** #23 함수 디렉터리 2개에 `deno.json`·`deno.jsonc`·`import_map.json` 부재(D-01) + `supabase/functions/deno.json` 존재, #24 respin `new Response(` 정확 2회(D-07), #25 후보 정규화 헬퍼 선언 토큰이 두 파일에서 같은 이름(D-03). 임베드 토큰 단언은 공백 변형 허용 정규식(`restaurants\s*\(\s*id\s*,\s*name\s*\)`). **기준 숫자는 플래너가 실측 후 기입**(Phase 3 grep 오기 12건 전례), 주석 제거 사본에서 세고 금지 토큰은 소스 주석에 쓰지 않는다.
- **D-15 SC-4 "기본 설정에서 전환 전과 동일" 테스트.** 순수 조합 모듈이 없으므로(D-11) `_shared` 단위 테스트로 표현한다: `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` `toEqual(DEFAULT_SPIN_TIME)` — **신규 1건**(리서치 확인: 나머지 4항목은 `spinTime.test.ts` #2·#12·#13, `cooldown.test.ts` #1·#7 로 이미 존재 → 플랜에 "인용" 으로 적는다). 기준선 189 tests / 10 files. **한계를 SUMMARY 에 명시**: `index.ts` 본문의 순서·분기는 D-14 의 텍스트 순서 단언 + `deno check` 타입 통과 + 낭독으로만 검증되고, 실호출은 Phase 8.
- **D-16 완료 조건 5종.** `npx tsc --noEmit`·`npm run lint`·`npm test`·`npm run build`(기존 4) + `npm run check:edge`(D-01). RED 커밋에서 `check:edge` 적색 허용은 **없다** — 계약 테스트 RED 는 vitest 에서만 나타나고 `deno check` 는 항상 초록이어야 한다(타입이 깨진 함수를 커밋하지 않는다).

### 문서 (Phase 3 D-16 선례 — 낡은 진술은 이 페이즈에서 정정)
- **D-17 CLAUDE.md.** (1) 검증 명령 블록에 `npm run check:edge   # deno check 두 Edge Function (유일한 정적 검사)` 추가. (2) `:41` "두 `index.ts` 본문은 여전히 사각지대 — … 낭독으로만 검증되므로 수정 후 직접 확인" → "`deno check`(`npm run check:edge`)가 두 `index.ts` 를 검사한다. 실호출은 컷오버 전 불가" 로 정정. (3) 엔트리포인트의 `spin-roulette`·`respin-roulette` 설명을 `candidates`→`restaurants` 조인 + `settings` + 쿨다운으로 갱신, "흐름" 문단의 `menus` 언급 정정. (4) 코드 컨벤션에 D-10 한 줄("Edge Function 실패·폴백 경로는 `console.error` 로 Supabase 로그에 남긴다. 클라이언트는 배너"). (5) "`deno` 가 로컬에 없어 `deno check` 를 돌릴 수 없다" 진술 정정 — CLAUDE.md 에는 없고(매퍼 grep 0건) 실제 위치는 `supabase/functions/_shared/edgeImports.test.ts:1` 머리 주석과 `.planning/codebase/CONCERNS.md:195` 다. `.planning/codebase/CONVENTIONS.md`·`CONCERNS.md` 의 "Edge Function 타입체크 사각지대"·"deno check 수동 실행" 진술도 같은 커밋에서 정정(매퍼 실측: `CONVENTIONS.md:281,282,299-304` — `:282` 의 "`kstNow()` 가 두 함수에 복붙돼 있다" 는 Phase 3 이 해결한 낡은 진술이라 함께 정정, `CONCERNS.md:148-151,191-196,331`, `CLAUDE.md:16,18,22-27,41`; 플래너가 재확인). `.planning/todos/pending/wr-01-cutover-window.md` 4번 "`--no-verify-jwt` 필수(config.toml 없음)" → "`supabase/config.toml` 에 `verify_jwt = false` 고정(63fae89); `--no-verify-jwt` 병행은 이중 안전" 으로 정정(a525d4c 에서 CLAUDE.md 는 이미 고침), 그리고 **7번 추가**: "배포 직후 `respin-roulette` 수동 invoke 응답의 `menu` 가 실제 매장명이고 `restaurant_id` 가 uuid 인지 확인 — 임베드 배열/객체 함정(D-03)은 정적 검사로 못 잡고 첫 실호출에서만 드러난다"(SHIP-04 체크리스트 항목). CLAUDE.md 에 D-01·D-02 한 줄: "`supabase/functions/deno.json`·`deno.lock` 은 로컬 `check:edge` 전용(배포 미참조). 함수 디렉터리 안에는 `deno.json` 을 두지 않는다(배포 import map 으로 채택됨). supabase-js 버전을 올릴 때는 두 `index.ts` 의 `jsr:` 핀과 lock 을 함께 갱신." README 의 Edge 설명은 Phase 8 SHIP-03 에 남긴다.
- **D-18** 멱등 검사 컬럼 `select("date, menu")` → `select("date, menu, restaurant_id")`, `already_decided` 응답에 `restaurant_id` 포함(D-05).

### Claude's Discretion
- 함수 내부 헬퍼·로컬 타입 이름, `console.error` 문안(한글 Why 주석 규칙과 별개로 로그 메시지는 한글 가능), 계약 테스트 번호 체계(#23 부터 이어 붙일지 describe 를 나눌지), `deno.json` 의 추가 키(`compilerOptions` 등은 넣지 않는 쪽을 기본으로).
- 플랜 분할 권장: **04-01** `check:edge` 도입(D-01·D-02) + `ResultRow` 타입(D-08) + 계약 테스트 RED(D-14) — Wave 0(정적 게이트가 먼저 켜져야 이후 RED/GREEN 이 타입까지 본다) / **04-02** `spin-roulette` 재작성(D-03~D-06·D-09~D-11·D-18) + D-15 테스트 / **04-03** `respin-roulette`(D-07) + `respin()`·`formatRespinError`(D-12·D-13·D-13a) + 문서(D-17).
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 4 성공 기준 5항 — 이 문서의 상위 계약(SC-5 의 `deno check` 는 D-01 로 실행 가능해짐)
- `.planning/phases/02-data-model/02-CONTEXT.md` D-01~D-04(테이블·`results.candidates` 형태)·D-08(매분 폴링)
- `.planning/phases/03-pure-logic/03-CONTEXT.md` D-02·D-17(`_shared` import 0)·D-05(쿨다운 창 의미)·D-14(`{ picked, fellBack }`)
- `supabase/migrations/0005_restaurants_settings.sql` — 컬럼·FK·cron 본문의 정본
- `supabase/functions/_shared/{kst,spinTime,cooldown}.ts` — 호출 계약; `_shared/edgeImports.test.ts` — 계약 테스트 idiom(`readOrEmpty`·`stripComments`·`count`)
- `lib/settings.ts` `settingsFromRow` — 설정 파싱 정책의 클라이언트 거울(D-04 와 대칭이어야 함)
- `lib/supabase/client.ts` — `ResultRow`·`SettingsRow`·`CandidateRow`·`RestaurantRow`(로컬 타입의 원본)
- `app/page.tsx` L18-19(`RespinResponse`)·L214-231(`respin()`); `lib/errors.ts`·`lib/errors.test.ts` — 순수 헬퍼 위치와 테스트 스타일
- `.planning/todos/pending/wr-02-respin-error-body.md`(이 페이즈에서 해결·삭제), `wr-01-cutover-window.md`(4번 문구 정정)
- `supabase/config.toml` — `verify_jwt = false` 고정(변경 금지)
- `.planning/codebase/CONCERNS.md` "관측성"·"Edge Function 사각지대"·"`respin-roulette` 공개 노출" — 정정 대상과 범위 밖 항목의 근거
</canonical_refs>

<specific_ideas>
## Specific Ideas

- 응답의 세 boolean(`settings_fallback`·`cooldown_skipped`·`cooldown_fallback`)은 "무엇이 기본 동작으로 밀렸는가" 를 cron 로그 한 줄에서 읽게 하려는 것이다 — 값이 전부 `false` 인 줄이 정상이고, `true` 가 보이면 그날 설정·DB 를 본다.
- 두 함수의 후보 정규화 헬퍼는 이름·시그니처를 같게 두면 Phase 8 낭독에서 diff 로 비교할 수 있다.
- `check:edge` 스크립트는 파일 두 개를 한 명령에 나열한다 — `deno check` 는 여러 진입점을 받는다.
</specific_ideas>

<deferred>
## Deferred Ideas

- Edge Function 배포·`--no-verify-jwt`·`respin-roulette` 수동 invoke 검증 — Phase 8(SHIP-04)
- `app/page.tsx` 후보 소스 `menus` → `candidates`, `winnerIndex` 이름→id — Phase 6
- `respin-roulette` 인증·레이트리밋·"오늘 결과 없으면 거부" — 범위 밖(익명 서비스 설계상 수용, CONCERNS 기록 유지)
- `_shared` 순수 판정 조합 모듈(`allowImportingTsExtensions` 로 파일 간 `.ts` import 를 허용하는 안) — 리서치 Open Question 으로만 검토, 이 페이즈에 채택하지 않음
- 결과 없는 날 감지 헬스체크 cron·`net._http_response` 점검 — 범위 밖
- README Edge Function 설명 현행화 — Phase 8 SHIP-03
</deferred>

<research_questions>
## Open Questions for Research — RESOLVED 2026-09-28 (`04-RESEARCH.md` §Q-1~Q-5, 위 D-01·D-02·D-03·D-05·D-07·D-12·D-14·D-15·D-17 에 반영됨)

- **Q-1** `supabase/functions/deno.json` 은 배포에 보이지 않음(CLI 소스 직독) → D-01 (b) 확정, D-02 lock 위치 `supabase/functions/deno.lock`.
- **Q-2** many-to-one 임베드: 런타임 객체 / 추론 타입 배열 → D-03 정규화 헬퍼(`unknown` → 런타임 좁히기).
- **Q-3** `invoke()` 반환의 `response: Response | undefined` 가 미독 본문 → D-12 값 import 없이 읽기.
- **Q-4** lock 은 로컬만 고정, 배포는 API 측 번들링 → 사용자 결정 D4: `jsr:@supabase/supabase-js@2.117.2` 핀.
- **Q-5** `allowImportingTsExtensions` + `noEmit` 은 tsc·deno 통과 실측, Next 빌드 미실행 `[ASSUMED]` — 이 페이즈 채택 안 함(Deferred 유지).
</research_questions>
