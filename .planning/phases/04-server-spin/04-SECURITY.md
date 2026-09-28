---
phase: 4
slug: server-spin
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-28
verified: 2026-09-28
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

검증 원칙(Phase 3 과 동일): SUMMARY 네 편의 서술은 증거로 쓰지 않았다(네 편 모두 `## Threat Flags` 절이 없고 `threat` 문자열 0건). 레지스터는 네 플랜(`04-01`~`04-04`)의 `<threat_model>` 에서 그대로 가져왔다 — **38행, 고유 ID 23개**(`T-04-01`~`T-04-11`·`T-04-13`~`T-04-22` 21개 + 네 플랜 공통 `T-04-SC`·`T-04-LIVE`). `T-04-12` 는 어느 플랜에도 없는 결번이다(`04-VALIDATION.md:53` 이 기록) — 레지스터에 넣지 않았다. 같은 ID 가 여러 플랜에 있으면 완화 문안을 합쳐 하나로 판정했다. 완화 증거는 이 감사에서 **HEAD 트리(`1086888`)** 를 상대로 grep·`git`·`npm run check:edge`(2회, lock 멱등 확인)·`npx vitest run supabase/functions/_shared/edgeImports.test.ts`(58/58)·`npm test`(234/234)·`npm audit --audit-level=high`·`test ! -f deno.lock`·`git status --porcelain -- supabase/functions/deno.lock` 을 **재실행**해 얻었고, `index.ts` 를 건드린 커밋 전부(`6ba60ad`·`dd05211`·`ebbd7d1`·`f2e0284`·`ccac31b`·`ce357be`·`2a5957e`·HEAD)를 `git archive` 로 스크래치에 풀어 `deno check` 를 다시 돌렸다(8/8 exit 0, 스크래치 삭제). 리뷰(`04-REVIEW.md`)가 플랜 작성 뒤에 완화를 바꾼 8커밋(`f2e0284`·`ccac31b`·`7ee56d0`·`d9378af`·`ce357be`·`07ff062`·`e965cb4`·`2a5957e`)은 플랜 문면이 아니라 트리 기준으로 판정하고, 강화된 항목에는 그 해시를 적었다. 구현 파일 수정 0건, 트리에 남긴 임시 파일 0건, 커밋 0건, 원격 Supabase 명령 0건.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 로컬 정적 검사 ↔ Supabase 배포 번들러 (`supabase/functions/deno.json`) | `deno check` 가 읽는 설정과 CLI 가 읽는 import map 이 같은 디렉터리 트리에 산다. 파일 하나를 함수 디렉터리 안으로 내리면 로컬 전용 설정이 배포 입력으로 승격되고, 그 사고는 Phase 8 배포 전까지 조용하다 | `{"nodeModulesDir":"none"}` 1키 |
| jsr 레지스트리 → `deno check` 해석 (`deno.lock`) | lock 이 로컬 해석을 고정하지만 배포는 API 측 번들링이라 lock 을 읽지 않는다 → 검사 버전 == 배포 버전을 만드는 장치는 `index.ts` 의 정확 핀뿐이다 | `jsr:@supabase/supabase-js@2.117.2` |
| 계약 테스트 텍스트 ↔ 검사 대상 소스의 주석 | 게이트 토큰이 주석에 있으면 개수 단언이 자기 자신을 세어 회귀 장치가 무력화된다(Phase 2·3 반복 사고) | `stripComments` 사본 |
| pg_cron(익명, `verify_jwt = false`) → `spin-roulette` | 게이트웨이 인증 없이 매분 들어온다. 함수 내부는 service_role 이라 이 경계 안쪽에서 무엇을 쓰느냐가 곧 권한 경계다 | 빈 POST · `console.error` 로그 · 응답 JSON |
| 브라우저(익명, publishable key) → `respin-roulette` | 누구나 POST 할 수 있고 멱등하지 않다. 게이트웨이가 CORS 를 주입하지 않으므로 함수가 직접 내리고, OPTIONS 프리플라이트·GET/HEAD 가 본문을 실행하면 결과가 덮어써진다 | 빈 POST · CORS 헤더 · 500 본문 |
| DB 값 → 함수 로직 (`settings`·`candidates`·`restaurants`) | 입력은 사람이 대시보드에 넣은 `spin_time`·`cooldown_days` 와 누구나 담는 `candidates` 다. `Database` 제네릭이 없어 모든 필드가 `any` 로 들어오고 좁히기는 코드가 한다 | `unknown` → `Candidate[]` · `SpinTime` · `number` |
| PostgREST 임베드 응답 형태 ↔ 정적 추론 타입 | 같은 한 줄에 두 진실(런타임 객체 / 추론 배열). `deno check` 초록이 이 지점에서는 근거가 아니다 | `restaurants ( id, name )` 임베드 |
| 함수 → Supabase Edge Logs (`console.error`) | cron 은 응답을 읽지 않는다 → 로그가 실패의 유일한 채널. 동시에 로그에 무엇을 싣느냐가 정보 노출 경계 | 단일 필드 + `error.message` |
| 함수 500 본문 → 브라우저 배너 (`formatRespinError`) | D-12 로 500 본문이 **실제로 사용자에게 보인다**. 본문은 JSON 이 아닐 수도 있고 형태를 신뢰할 수 없다 | `{ error }` · `{ code, message }` · HTML · null |
| 함수 → `results` 쓰기 (service_role) | anon 쓰기 정책 0건. 하루 1회 보장의 마지막 방어선은 앱 로직이 아니라 `unique(date)` + `23505` 다 | `insert` / `upsert(onConflict: "date")` |
| `crypto.getRandomValues` → 추첨 결과 | 난수원이 추첨 공정성의 전부다 | `Uint32Array(1)` |
| 문서 진술 ↔ 코드 사실 · todo `wr-01` ↔ Phase 8 실행 · VALIDATION 판정 ↔ 실제 게이트 | 낡은 진술은 되돌리기를, 새 거짓은 컷오버 오판을, 거짓 초록은 재검증 누락을 유발한다 | 문서 텍스트 |
| **워킹트리 → 라이브 Supabase / `main`** | 이 페이즈가 **건너지 않기로 한** 경계. 배포·마이그레이션 적용·원격 SQL·`git push` 전부 0건 | — (무접촉) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Tampering | 함수 디렉터리 안 `deno.json` 이 배포 import map 으로 채택되는 경로 | mitigate | `supabase/functions/deno.json` 1줄 `{ "nodeModulesDir": "none" }` — 함수 디렉터리 한 단계 위. `ls supabase/functions/spin-roulette`·`respin-roulette` → 각각 `index.ts` **1파일**뿐(`deno.json`·`deno.jsonc`·`import_map.json` 0). `package.json:10` `deno check --config supabase/functions/deno.json …`. 계약 #48(`edgeImports.test.ts:405-417`) `existsSync` 7원소 `[false×6, true]` — 58/58 재실행 통과. `CLAUDE.md:51` 금지 문구("함수 디렉터리 안에 … 두지 말 것") | closed |
| T-04-02 | Tampering | 루트 `deno.lock` 오염 / 핀 교체 lock 누락 | mitigate | 스크립트 고정: `package.json:10` `--config` 형태 한 줄. lock: `git ls-files supabase/functions/deno.lock` 추적됨(276줄, `workspace`·`packageJson` **0건** — npm 의존성 미포함), `.gitignore` 에 `deno` 0건. **감사 재실행**: `npm run check:edge` 2회 연속 exit 0, 매 실행 뒤 `git status --porcelain -- supabase/functions/deno.lock deno.lock` → **0줄**(멱등), `test ! -f deno.lock` → 루트 lock 부재. lock 이력 3커밋: `6ba60ad`(생성) · `dd05211`(spin 핀, `+"jsr:@supabase/supabase-js@2.117.2"` 같은 커밋) · `3d460fb`(`-"jsr:@supabase/supabase-js@2"` 제거). **편차 기록**: respin 핀 교체 커밋 `ebbd7d1` 은 lock 을 포함하지 않았고 옛 명세자 `@2` 항목이 `c82a04d`·`ea6c5cb` 두 커밋 동안 남았다가 `3d460fb` 에서 제거됐다(플랜 인수 조건 "핀 교체 커밋에 lock 포함" 의 문면 위반, UF-04-02). 다만 그 창에서도 두 명세자 모두 `2.117.2` 로 해석돼 위협 문면 "다음 실행이 다른 버전을 해석한다" 는 성립하지 않았고, HEAD 는 위 재실행으로 멱등·커밋 상태가 실측된다 | closed |
| T-04-03 | Information Disclosure | `console.error` 에 service_role 키·전체 행 | mitigate | `Deno.env.get` 은 spin `:80-81` · respin `:110-111` 의 `createClient` 인자에서만. `console.error` 14건(spin `:97,109-111,132,150,157,179,211,231` · respin `:129,144,152,175,209,229`) 어디에도 `Deno.env`·`SUPABASE_` 토큰 없음. 보간 대상 전수: `*.message` 단일 필드 9건 · `JSON.stringify(settingsRow.spin_time)`(단일 필드, spin `:110`) 1건 · `excludedIds.join(", ")`(id/인덱스 라벨, spin `:157`·respin `:152`) 2건 · `e.message`/`String(e)`(catch) 2건. 행 통째 `JSON.stringify(settingsRow\|rows\|recent\|existing)` **0건**, `console.log/warn/info` 0건. **강화** `07ff062`(WR-04): 계약 #32(`:257-263`) spin **정확 8** · #43(`:343-348`) respin **정확 6** — 하한(>4/>3)에서 정확 개수로. 규약 `CLAUDE.md:45` "로그·응답 본문에 `details`·`hint`·행 덤프를 싣지 않는다" | closed |
| T-04-04 | Information Disclosure | 500 본문 `details`·`hint` / 문서에 ref·키 신규 기재 | mitigate (04-02·04-03) / accept (04-04 문서) | 500 반환 전수: spin `:152` `{ error: candErr.message }` · `:212` `{ error: insErr.message }` · `:232` `{ error: "internal_error" }`; respin `:147`·`:210`·`:230` 동일 + 405 `:104` `{ error: "method_not_allowed" }`. `details`·`hint` 토큰 두 파일 **0건**(코드·주석 모두). 근거 주석 spin `:151` / respin `:145-146`. **PostgREST `message` 원문 노출(REVIEW IN-07 미적용)은 플랜 완화 문면 "`{ error: <message> }` 만" 과 일치해 CLOSED** — 수용 사유: `lib/errors.ts:5` 규약이 `message` 는 허용하고 `details`·`hint` 만 금지하며, 이 서비스는 익명 개방이고 스키마가 공개 레포(`supabase/migrations/**`)에 있다(Phase 3 R-03-03 과 같은 수준). 배너 쪽은 `lib/errors.ts:13` `RESPIN_ERROR_MAX_LEN = 200` 말줄임(`d9378af`) + `ErrorBanner` 텍스트 노드. 04-04 accept 부분: `git diff 65c94b4..HEAD` 추가 줄에서 `swxiqytyxjlcgubqlozk` **0건**, `eyJ…`/`sb_secret_`/`sb_publishable_` **0건** → R-04-02 | closed |
| T-04-05 | Tampering | OPTIONS 프리플라이트가 재추첨 실행 | mitigate | respin `:96-98` `if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }` — `kstNow()`(`:107`)·`createClient`(`:109`) 보다 앞. `corsHeaders` 3건(`:79`,`:89`,`:97`). 계약 #22(`:164-170`, `req.method === "OPTIONS"` 1 + `corsHeaders` ≥2) · #45(`:377-381`, `new Response(` 정확 2 = 단락 `:97` + 헬퍼 `:87`) 통과. **강화** `f2e0284`(WR-01): `:103-105` `if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);` + 계약 #49(`:172-181`, `[1,1,1]`) — 프리플라이트 단락만으로 못 막던 GET/HEAD(링크 미리보기·주소창) 실행 경로가 닫혔고 머리 주석 `:21-23`·upsert 주석 `:195-196` 이 정정됐다 | closed |
| T-04-06 | Denial of Service | 500 에 CORS 누락 → D-12 무력화 | mitigate | respin `json()` `:86-91` `headers: { ...corsHeaders, "Content-Type": … }`. 주석 제거 사본에서 `return json(` **6건**(`:104,147,161,210,213,230`) · `return new Response(` **1건**(`:97` OPTIONS) — OPTIONS 외 모든 반환이 헬퍼 경유, `new Response(` 총 2(#45). **강화** `ce357be`(IN-08): 핸들러 전체 `try { … } catch (e)` `:94-231`, `catch` 도 `json({ error: "internal_error" }, 500)` `:230` — 던져진 예외(환경변수 미주입 등)도 CORS 포함 500; `app/page.tsx:236-241` 외곽 `catch` 추가. spin 도 같은 구조(`json()` `:70-72` CORS 없음은 의도 — 주석 `:68-69`; `return json(` 8 · `new Response(` 1, #34) | closed |
| T-04-07 | Denial of Service | 잘못된 `spin_time`/settings 실패로 추첨 정지 | mitigate | spin `:84` `let spinTime = DEFAULT_SPIN_TIME`; `:96-98` 조회 에러 → 로그 + `settingsFallback = true`, `return` 없음; `:99` 0행은 플래그 없이 기본값; `:102-104` `typeof settingsRow.spin_time === "string" ? parseSpinTime(…) : null`; `:105-113` 파싱 실패 → 로그 + 플래그, 기본값 유지; `:118` `isAfterSpinTime(now, spinTime)` 로 **진행**. `_shared/spinTime.ts:20-25` `parseSpinTime` 총 함수(`return null` 2곳, `throw` 0). 두 `index.ts` 주석 제거 사본 `throw` **0건**. 계약 #30(`:233-239`), `settings_fallback` 응답 `:225` 무조건부(#33) | closed |
| T-04-08 | Denial of Service | 쿨다운·설정 조회 실패로 추첨/재추첨 통째 실패 | mitigate | spin `:178-181` / respin `:174-177` `if (recentErr) { console.error(…); cooldownSkipped = true; }` → `pool = candidates`(`:168`/`:164`) 유지, 진행. 설정 조회: spin `:96-98` / respin `:128-131` 같은 무늬. 응답 `cooldown_skipped`·`settings_fallback`·`cooldown_fallback` 상시(spin `:223-225`, respin `:221-223`; 계약 #33/#44 `[1,1,1]`). 쿨다운 창 조회는 `windowStart !== null`(`:171`/`:167`) 일 때만 — 기본 설정(0일)은 조회 0회 | closed |
| T-04-09 | Tampering | 동시 폴링 이중 결과 / upsert 가 다른 날짜 | mitigate | DB: `supabase/migrations/0001_init.sql:13` `date date not null unique`(이 페이즈 migrations diff 0). spin `:199-204` `insert({ date: now.date, … })`, `:206-210` `insErr.code === "23505"` → `race_already_decided`; 계약 #15 `23505` 정확 1. 애플리케이션 락 코드 0건. respin `:197-206` `upsert({ date: now.date, … }, { onConflict: "date" })`; 계약 #46(`:383-386`, `.upsert(` 1 · `onConflict: "date"` 1). 날짜 키는 양쪽 다 `kstNow().date` 한 경로(spin `:76`, respin `:107`) | closed |
| T-04-10 | Tampering | 익명 사용자의 `respin-roulette` 반복 호출 | **accept** | R-04-01 참조. respin 주석 제거 사본: `req.headers.get`·`rate`·`limit` **0건**, `from("results")` 2건(#38 — 멱등 조회 없음), 유일한 가드는 `:103-105` 메서드 검사(반복 POST 는 설계대로 허용). 기록 유지: `.planning/REQUIREMENTS.md:84` Out of Scope "다시 돌리기 하루 상한 — 무한 재돌리기 OK" · `CONCERNS.md:129-137` [P1] 공개 노출 항목 잔존 · `CLAUDE.md:55` "인증·레이트리밋 없음 — 익명 서비스 설계상 수용" | closed |
| T-04-11 | Tampering | 임베드 배열 오독 → `menu: undefined` / 후보 전멸 | mitigate | spin `:38-66` / respin `:49-77` `function normalizeCandidates(rows: unknown)` — `:60`/`:71` `Array.isArray(embed) ? embed[0] : embed`, `typeof`·`in` 좁히기 4단(`:57-62`/`:68-73`). 주석 제거 사본 재측정: `restaurants[0]` 0 · `\bas\b` 0 · `\bany\b` 0(두 파일). 계약 #47(`:397-403`) `[1,1]` · #24/#36 임베드 토큰 · **강화** `ccac31b`(WR-02): 비배열 입력을 `excluded: 1` 로 세고(`:43-45`/`:54-56`) `excludedIds` 로그 + `no_candidates`·`ok` 두 응답에 `excluded_count`(#50/#51 각 2) — 형태 방어가 작동한 사실이 로그·응답에 드러난다. 문서 장치 실재: `wr-01-cutover-window.md:16` 7번(수동 invoke → `menu`·`restaurant_id` 확인) · `CONCERNS.md:332` "정적 검사가 못 잡는다 … wr-01 7번". 잔여는 Notes 1 | closed |
| T-04-13 | Elevation of Privilege | 배포 시 `verify_jwt` true → 401 로 추첨 정지 | mitigate | `supabase/config.toml:11-15` `[functions.spin-roulette] verify_jwt = false` · `[functions.respin-roulette] verify_jwt = false`. `git diff --name-only 65c94b4..HEAD -- supabase/config.toml` → **0**, `git log -1 -- supabase/config.toml` → `63fae89`(2026-09-15) — 페이즈 무접촉. `wr-01-cutover-window.md:13` 4번 "`verify_jwt = false` 가 고정돼 있으므로(63fae89) … `--no-verify-jwt` … 이중 안전 … config.toml 을 건드리거나 플래그를 빼지 말 것"(`grep -c 63fae89` = 1). "config.toml 없음" 문구 `wr-01`·`CLAUDE.md` **0건**(Phase 3 UF-03-02 드리프트 해소, `CLAUDE.md:50`). 클라이언트 보강 `7ee56d0`(WR-03): `lib/errors.ts:53-56` 가 게이트웨이 `{ code: 401, message }` 도 배너에 싣는다(`lib/errors.test.ts:65-72`) — 오배포 시 "Invalid JWT" 가 보여 조용히 멈추지 않는다. 잔여는 Notes 2 | closed |
| T-04-14 | Tampering | 계약 기준 숫자를 주석 포함 원본에서 측정 | mitigate | `edgeImports.test.ts:30-35` `stripComments`, `:51-56` 사본 6개(`spin`·`respin`·`kst`·`spinTime`·`cooldown`·`page`). `count(` 호출 **72건 전부 사본 변수**, `count(raw` **0건**; 원본은 존재 여부(`rawKst.length` `:63`, `rawPage.length` `:394`)에만. `\bDEFAULT_SPIN_TIME\b` `:237`·`:340`. 감사 재측정(원본/사본): respin `onConflict: "date"` 1/1 · spin `23505` 1/1 · `console.error(` 8/8·6/6 · `corsHeaders` 3/3 — 현재 트리는 주석에 토큰이 없어 차이 0 이지만 사본 측정이 구조적으로 유지된다. REVIEW IN-05 사각지대(블록 주석·문자열 내 `//`) 재측정: 두 `index.ts` 에 `/*` 0 · `://` 0 · 재수출 0 · `import(` 0 — 실해 0 | closed |
| T-04-15 | Denial of Service | 게이트 전 함수 코드 성장 | mitigate | `git log 65c94b4..HEAD` 첫 커밋 `6ba60ad`(2026-09-28 15:57) = `check:edge` 도입(`package.json`+`deno.json`+`deno.lock`) — 함수 본문 첫 변경 `dd05211` 보다 앞. **감사 재실행**: `index.ts` 를 건드린 커밋 전부(`dd05211`·`ebbd7d1`·`f2e0284`·`ccac31b`·`ce357be`·`2a5957e`) + `6ba60ad`·HEAD 를 `git archive` 로 스크래치에 풀어 `deno check --config …` → **8/8 exit 0**(RED 커밋 포함 적색 0). `CLAUDE.md:27` 검증 명령 5줄째 | closed |
| T-04-16 | Denial of Service | 멱등 SELECT 실패를 500 으로 → 그날 추첨 상실 | mitigate | spin `:124-128` 조회 → `:132` `if (existErr) console.error(\`오늘 결과 조회 실패(진행): …\`)` — `return` 없음, `:134` `if (existing)` 로 진행. 논증 주석 `:130-131`. 보험 `:208` 23505 + `0001:13` unique | closed |
| T-04-17 | Denial of Service | `pickRandom([])` | mitigate | spin `:164-166` `if (candidates.length === 0) return json({ skipped: "no_candidates", … })` 가 `:169` `cooldownWindowStart` 보다 앞; respin `:160-162` → `:165` 동일. `_shared/cooldown.ts:38` 후보 0 → 그대로, `:45-47` 전멸 → `{ picked: candidates, fellBack: true }`. 쿨다운 조회 실패 경로는 `pool = candidates` 유지. 전제 주석 spin `:193-194` / respin `:189-190`. 계약 #31(`:241-255`) 5토큰 위치 단조 통과. `kst.ts:68-70` 전제조건 주석(Phase 3 R-03-01 인계) | closed |
| T-04-18 | Tampering | 난수원 교체 | mitigate | spin `:18` / respin `:29` `import { kstNow, pickRandom } from "../_shared/kst.ts"`; `kst.ts:71-75` `crypto.getRandomValues(new Uint32Array(1))`. `function pickRandom` 두 파일 0(#10/#19). `Math.random` 소스 전수(`supabase/functions`·`lib`·`app`·`components`, spec 제외, 주석 제거) **0건** | closed |
| T-04-19 | Denial of Service | 500 본문 비JSON 시 두 번째 예외로 배너 소실 | mitigate | `app/page.tsx:225` `response ? await response.json().catch(() => null) : null`; `lib/errors.ts:47-59` 비객체/`null` → `fallbackMessage`. `lib/errors.test.ts:51-55`(null → fallback) · `:57-61`(빈 문자열 → fallback), `npm test` 234/234 재실행. `ce357be`: `respin()` 외곽 `catch` `:236-241` — `.catch` 밖의 예상 밖 throw 도 배너 | closed |
| T-04-20 | Information Disclosure | `error` any 체인 | mitigate | `app/page.tsx:226` `error instanceof Error ? error.message : String(error)`, `:240` 동일. `error.context` 0 · `FunctionsHttpError` 0 · `: any`/`as any` 0 · import 14줄(값 import 증가는 `lib/errors` `:9` 1줄). `lib/errors.ts` import 0, `body: unknown`(`:47`) | closed |
| T-04-21 | Tampering | 문서 정정 누락으로 `check:edge`·`_shared` 단일 정의 회귀 | mitigate | grep 인수 조건 전부 통과: `'여전히 사각지대' CLAUDE.md`=0 · `'npm run check:edge' CLAUDE.md`=2 · `'복붙돼 있다' CONVENTIONS.md`=0 · `'수동 실행' CONCERNS.md`=0 · `'63fae89' wr-01`=1 · `'^7\. ' wr-01`=1. "deno 가 없어" 계열 문구 4파일(`CLAUDE.md`·`CONVENTIONS.md`·`CONCERNS.md`·`edgeImports.test.ts`) 0건. 정정 실재: `CLAUDE.md:44`(check:edge 가 타입, 계약 58건이 형태)·`:51`(deno.json 위치) · `CONVENTIONS.md:281,303,306` · `CONCERNS.md:194-196,331-333` · `edgeImports.test.ts:1-2`. 잔존 드리프트 1건은 D-17 정정 대상 밖이라 UF-04-01 로 기록 | closed |
| T-04-22 | Repudiation | 거짓 초록 | mitigate | `04-VALIDATION.md:102-110` Manual-Only 표 5행 유지; 표 `:77` `📋 manual-only` 1행은 초록으로 칠하지 않음; `⬜ pending` 본문 0(범례 `:81` 만); `:5` `nyquist_compliant: true` 는 `:114-121` 5항 근거 각각 명시 + `:121` "샘플링 주기 뜻이지 모든 동작이 검증됐다는 뜻이 아니다". `04-VERIFICATION.md` Deferred 8건이 미검증을 Phase 6·8 로 넘기고 초록으로 칠하지 않음. **감사 재실행으로 초록 실증**: `npm run check:edge` exit 0 ×2 · `edgeImports.test.ts` 58/58 · `npm test` 10 files / 234 passed · `npm audit --audit-level=high` `found 0 vulnerabilities` | closed |
| T-04-SC | Tampering | npm 레지스트리 → `node_modules` (공급망) | mitigate | `git diff --stat 65c94b4..HEAD -- package.json package-lock.json` → `package.json` **1줄**(`check:edge` 스크립트, 의존성 변경 0) · `package-lock.json` **0줄**. `node_modules/.package-lock.json`·`package-lock.json` mtime `2026-09-18 15:32`(페이즈 창 `2026-09-28 15:57`~`17:32` 이전) — 설치 0회. 페이즈 창 이후 mtime 인 `node_modules` 파일은 `.vite/vitest/…/results.json`(이 감사의 vitest 캐시)뿐. `npm audit --audit-level=high` 재실행 → `found 0 vulnerabilities`. jsr 명세자는 `jsr:@supabase/supabase-js@2.117.2`(spin `:17`·respin `:26`, 계약 #29/#41 `[1,0]`) + 타입 전용 `jsr:@supabase/functions-js/edge-runtime.d.ts` — Supabase 공식 스코프 2개뿐; lock `:4-8` 전부 2.117.2 + integrity 고정. `deno` 는 Homebrew(`/opt/homebrew/bin/deno` 2.9.7) — npm 밖 | closed |
| T-04-LIVE | Tampering | 라이브 Supabase(함수·DB) · `main` | mitigate | `git branch --show-current` → `feat/restaurant-roulette`, upstream 없음(`fatal: no upstream configured`), `git branch -r` 에 해당 브랜치 없음 — push 0. `main` == `origin/main` == `49d0643`. `git diff --name-only 65c94b4..HEAD -- supabase/migrations supabase/config.toml` → 0. 변경 경로 28개 전부 워킹트리 파일(`.planning/**` 16 · `CLAUDE.md` · `app/page.tsx` · `lib/**` 3 · `package.json` · `supabase/functions/**` 6). `command -v supabase` → 없음; `supabase/.temp/*` mtime `2026-09-15`; `find supabase/.temp ~/.npm/_npx -newer 04-01-PLAN.md` → 0건 — 페이즈 중 CLI 산출물 갱신 없음. 문서: `CLAUDE.md:16` "두 함수 모두 아직 배포되지 않았다". 감사 후 `git status` = 시작 시점과 동일(`.planning/config.json`·`.serena/project.yml` M 2건 + 이 문서) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party / 후속 페이즈)*

**감사 재실행 결과(교차 증거):** `npm run check:edge` exit 0 ×2(lock 드리프트 0) · `npx vitest run supabase/functions/_shared/edgeImports.test.ts` → 58/58 · `npm test` → `Test Files 10 passed (10)` / `Tests 234 passed (234)` · `npm audit --audit-level=high` → `found 0 vulnerabilities` · `test ! -f deno.lock` → 부재 · 커밋별 `deno check` 8/8. 위 표의 계약 번호(#15·#22·#29~#34·#41~#56)는 러너에 실제로 수집·실행되는 살아 있는 가드다.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-10 | `respin-roulette` 는 인증·레이트리밋·"오늘 결과 없으면 거부" 없이 익명 POST 로 무제한 덮어쓴다. `REQUIREMENTS.md:84` Out of Scope("다시 돌리기 하루 상한 — 무한 재돌리기 OK, `respin_count` 컬럼도 안 만든다")·`CLAUDE.md:55`·`CONCERNS.md:129-137` [P1] 이 같은 결정을 기록하며, 이 페이즈는 그 기록을 지우지 않았다. 이번 페이즈가 더한 것은 메서드 검사(`:103-105`, POST 외 405)뿐이고 이는 반복 POST 를 막지 않는다(설계 그대로) | 플랜 시점 disposition=accept (04-03-PLAN `<threat_model>`) | 2026-09-28 |
| R-04-02 | T-04-04 (04-04 문서 부분) | 04-04 문서 태스크는 프로젝트 ref·키를 새로 적지 않았다(페이즈 diff 추가 줄에 ref 0건·키 형태 0건). 기존 문서의 ref 하드코딩(`supabase/migrations/0002_cron.sql:23`, `README.md`)은 이미 CLAUDE.md 위험 지점 표에 기록된 항목이고 이 페이즈 범위 밖이다 | 플랜 시점 disposition=accept (04-04-PLAN `<threat_model>`) | 2026-09-28 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

네 SUMMARY 에 `## Threat Flags` 절이 **없다**(`threat` 문자열 0건). 아래는 감사자가 트리 대조 중 발견한, 플랜 레지스터에 매핑되지 않은 항목이다. **블로커 아님** — 전부 문서 드리프트·프로세스 편차·정보성이고 다음 페이즈가 인수한다.

| Flag | 위치 | 내용 | 처리 |
|------|------|------|------|
| UF-04-01 | `.planning/codebase/CONCERNS.md:23-28` · `:131-132` · `:148` | (a) `:23-28` "[P2] Edge Function 간 유틸 복붙(`kstNow`, `pickRandom`)" 항목이 해결 표시 없이 살아 있고 `:27` 이 "두 함수 모두 타입체크·lint 대상에서 제외돼 있어 … 정적 검사도 못 잡는다" 고 적는다 — Phase 3 가 `_shared` 로 합쳤고 Phase 4 가 `check:edge` 를 켰으므로 두 진술 모두 낡았다. T-04-21 이 막으려는 바로 그 종류의 문장이지만 D-17 의 정정 대상(`:148-151,191-196,331`)에 없었다. (b) `:131-132` 의 줄 번호(`respin-roulette/index.ts:22`, `:63-113`)가 재작성 전 좌표다. (c) `:148` "spin 7지점·respin 5지점" 은 리뷰 전 수치(현재 8·6, `CLAUDE.md:45` 는 갱신됨 — `04-VERIFICATION.md` Anti-Patterns 가 Info 로 기록). 보안 영향: 코드·게이트는 정확하고 문서만 틀렸다 | 문서 드리프트. Phase 8 SHIP-03(문서 현행화)에서 `:23-28` 을 "Phase 3 해결" 로 표기하거나 삭제하고 `:131-132`·`:148` 좌표·수치를 갱신할 것 |
| UF-04-02 (정보성) | `git log` `ebbd7d1`..`3d460fb` | T-04-02 완화 문면 "핀 교체 태스크의 커밋에 lock 을 포함" 을 respin 핀 커밋 `ebbd7d1` 이 지키지 않았다 — lock 은 3커밋 뒤 `3d460fb` 에서 재생성됐고 그 사이 `check:edge` 를 돌리면 `git status` 에 lock 드리프트가 떴을 상태였다. 해석 버전은 창 안에서도 `2.117.2` 로 동일해 실해 0, HEAD 는 멱등 실측 | 프로세스 편차 기록. 다음에 jsr 핀을 바꾸는 태스크는 `check:edge` 실행 → lock 포함 커밋을 **한 커밋**으로 묶을 것(`CLAUDE.md:51` 이 이미 "함께 갱신" 을 지시) |

---

## Notes — Phase 8 에서만 검증 가능한 잔여 위험

1. **T-04-11 임베드 실제 형태**: `normalizeCandidates` 는 객체·배열·`null` 세 형태에 같은 값으로 착지하도록 짜였고 예상 밖 네 번째 형태는 `excluded_count` 로 응답에 드러난다. 그러나 PostgREST 가 실제로 무엇을 보내는지는 컷오버 후 `respin-roulette` 첫 실호출(`wr-01` 7번)에서만 확인된다. 이 페이즈의 완화는 "문서 장치가 트리에 실재한다" 까지다.
2. **T-04-13 배포 플래그**: `config.toml` 고정은 정적 사실이고 CLI 가 실제로 그 값을 읽는지는 `functions deploy` 에서만 실증된다. `wr-01` 4번의 `--no-verify-jwt` 병행이 이중 안전이고, 오배포 시 `formatRespinError` 가 401 본문을 배너에 싣는다(`lib/errors.ts:53-56`).
3. **T-04-04 `message` 노출(IN-07)**: 익명 서비스·공개 스키마 전제에서 수용했다. 이 전제가 바뀌면(로그인 도입 등) 응답을 고정 한국어 문장으로 바꾸고 원문은 `console.error` 에만 남기는 쪽(REVIEW IN-07 Fix)을 다시 본다.
4. **REVIEW IN-11**: respin 의 `Access-Control-Allow-Headers` 는 정적 열거이고 클라이언트 `@supabase/supabase-js` 는 `^2.106.0` caret 이다. 새 기본 헤더가 켜지면 프리플라이트가 실패해 D-12 경로가 죽는다(가용성, 새 공격면 아님). 클라이언트 버전을 올릴 때 헤더 목록을 다시 본다.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-28 | 23 | 23 | 0 | gsd-security-auditor (플랜 시점 레지스터 4개 병합 — 38행 → 고유 23건, `T-04-SC`·`T-04-LIVE` 는 네 플랜 공통이라 1건씩, `T-04-12` 결번; 증거 = HEAD `1086888` 트리 grep 재실행 + `check:edge` ×2/`edgeImports` 58/`npm test` 234/`npm audit` 재실행 + 커밋별 `deno check` 8건 + git 범위·리모트·mtime 명령 + `04-REVIEW.md` 처리 커밋 8건 대조. 구현 파일 무수정, 임시 파일 잔존 0, 커밋 0, 원격 명령 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] 미등록 항목 2건(문서 드리프트 1 + 프로세스 편차 1, 정보성)은 Unregistered Flags 에 기록 — 블로커 아님, Phase 8 인수

**Approval:** verified 2026-09-28
