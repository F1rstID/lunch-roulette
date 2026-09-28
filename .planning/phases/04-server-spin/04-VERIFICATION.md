---
phase: 04-server-spin
verified: 2026-09-28T08:25:10Z
status: passed
score: 39/39 must-haves verified
overrides_applied: 0
deferred:
  - truth: "두 index.ts 의 실행 동작 — PostgREST 매장 임베드가 실제로 객체로 오는가, upsert(onConflict: date) 가 실제로 갱신하는가, 응답 menu 가 매장명이고 restaurant_id 가 uuid 인가"
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 4 로컬 검증 절 '실제 호출 검증은 Phase 8 컷오버에서 respin-roulette 수동 invoke로 한다' · .planning/todos/pending/wr-01-cutover-window.md 7번 · 04-VALIDATION Manual-Only 표 1·2행. 라이브에 candidates·restaurants·settings 가 없어 지금은 어느 환경에서도 실행 불가"
  - truth: "settings.spin_time 의 실제 PostgREST 직렬화 문자열이 parseSpinTime 이 받는 세 형태(HH:MM · HH:MM:SS · 소수 초) 안에 있다"
    addressed_in: "Phase 8"
    evidence: "04-02·04-04-SUMMARY 미검증 목록 2번 · Phase 8 goal '한 번의 컷오버로 라이브를 새 모델로 넘긴다'. 어긋나도 spin-roulette/index.ts:103-113 이 settings_fallback: true + 기본 시각으로 착지하므로 추첨은 멈추지 않는다"
  - truth: "respin() 배너에 함수가 보낸 500 본문 문장이 실린다 (브라우저 + 배포된 함수 + 실제 500 응답 세 가지가 동시에 필요)"
    addressed_in: "Phase 6 · Phase 8"
    evidence: "04-VALIDATION Manual-Only 표 3행 · Phase 6 goal(오늘 탭 재작성 시 UI 검증) · Phase 8 실사용 1회. 증상 기준은 04-03-SUMMARY 낭독 2번: 영어 고정 문구가 뜨면 500 에 CORS 가 빠진 것"
  - truth: "console.error 가 Supabase 대시보드 Edge Function Logs 에 실제로 나타난다"
    addressed_in: "Phase 8"
    evidence: "04-VALIDATION Manual-Only 표 4행 — 배포 후에만 확인 가능. cron 은 응답을 읽지 않아(fire-and-forget) 로그가 실패의 유일한 채널"
  - truth: "check:edge 도입(supabase/functions/deno.json)이 배포 동작을 바꾸지 않는다 — functions deploy 출력에 fallback import map 경고 부재 (SC-5 의 배포 측 반)"
    addressed_in: "Phase 8"
    evidence: "04-VALIDATION Manual-Only 표 5행. RESEARCH §Q-1 의 CLI 소스 근거(탐색 경로 6개에 supabase/functions/deno.json 없음)는 정적 논증이고 실증은 배포뿐"
  - truth: "results UPDATE 구독이 on delete set null 갱신을 새 결과로 오인하지 않는다 (REVIEW IN-09 — Phase 4 가 restaurant_id 를 쓰기 시작하며 도달 가능해진 경로)"
    addressed_in: "Phase 6"
    evidence: ".planning/todos/pending/in-06-results-update-on-delete-set-null.md (resolves_phase: 6, 822349c 적재 확인)"
  - truth: "화면 문구의 하드코딩 11:55 제거 · 오늘 탭 후보 소스 menus → candidates · winnerIndex 이름→id · no_candidates 응답의 excluded_count 를 배너 문구로 갈라 쓰기"
    addressed_in: "Phase 6"
    evidence: "ROADMAP Phase 6 goal '오늘 탭이 자유 입력 대신 카탈로그 토글로 후보를 담고 … 추첨 시각 문구가 전부 settings를 따른다'(SPIN-05·SPIN-06) · 04-CONTEXT Deferred · app/page.tsx 는 이 페이즈에서 respin() 밖 무변경(git diff 65c94b4..HEAD 확인)"
  - truth: "계약 #56 이 app/page.tsx 의 no_candidates 리터럴을 읽는다 — vitest 수집 범위 밖의 파일을 텍스트로 보는 경계 넘는 단언"
    addressed_in: "Phase 6"
    evidence: "edgeImports.test.ts:47-49,390-395 주석이 의도(Phase 6 가 번역 키를 지우면 깨지도록)를 적음 · 07ff062. Phase 6 이 page.tsx 를 다시 쓸 때 함께 옮긴다 — gap 아님, 인계 항목"
---

# Phase 4: 서버 추첨 Verification Report

**Phase Goal:** 두 Edge Function이 새 스키마·`settings`·쿨다운 위에서 결과를 확정하도록 재작성한다. 배포는 하지 않는다(Phase 8).
**Verified:** 2026-09-28T08:25:10Z (HEAD `5b11547`)
**Status:** passed
**Re-verification:** No — initial verification

검증 원칙: SUMMARY 네 편·REVIEW·VALIDATION 의 서술은 증거로 쓰지 않았다. 두 `index.ts` 전문(234줄·232줄), 계약 spec 418줄, `_shared` 3파일, `lib/errors.ts`·`lib/errors.test.ts`·`lib/supabase/client.ts`·`app/page.tsx` respin 구간, `deno.json`·`deno.lock`·`package.json`·`supabase/config.toml`, 마이그레이션 0001·0005, 문서 5파일을 직접 읽었고 게이트 명령 6종(`tsc`·`lint`·`test`·`build`·`check:edge`·`audit`)을 이 프로세스에서 재실행했다. 함수 본문의 판정 헬퍼 `normalizeCandidates` 는 두 파일에서 추출해 **스크래치패드에서 deno 로 실행**(9케이스)했고, `_shared` 기본 설정 경로는 Node 25 ESM 직접 import 로 15건 프로브를 돌렸다. TDD 주장은 `git archive` 로 RED 커밋(`a39265b`)·GREEN 커밋(`ebbd7d1`) 트리를 스크래치패드에 펼쳐 vitest 를 재실행해 확인했다. 트리 수정 0건, 커밋 0건, 임시 파일 잔존 0건(`git status` 는 시작 시점과 동일: `.planning/config.json`·`.serena/project.yml` 2건 M 뿐).

**두 시점의 수치를 구분한다.** 플랜·SUMMARY·VALIDATION 의 수치(219 tests · 계약 50건 · `console.error` spin 7·respin 5 · `new Response` 등)는 **리뷰 수정 이전**(`ff69879` 시점) 값이다. 리뷰(`04-REVIEW.md`, 16건 중 9건 수정) 후 커밋 10개(`f2e0284..5b11547`)가 얹혀 현재 실측은 **234 tests · 계약 58건 · `console.error` spin 8·respin 6** 이다. 이 차이는 결함이 아니라 리뷰 후 진화이며 CLAUDE.md:44-45 는 갱신됐다. 리뷰 수정이 플랜 must_haves·D-01~D-18 을 깨지 않았음을 아래 표에서 항목별로 확인했다(예: WR-01 의 405 분기가 `json()` 을 지나 #45 `new Response` 2회 유지, WR-02 의 `excluded` 개명이 #47 헬퍼 이름 계약 유지, IN-08 의 `catch` 가 #34/#45 유지).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 5 + PLAN 4개 truths 병합·중복 제거 = 39)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | **[SC1]** `spin-roulette` 가 하드코딩 시각 대신 `settings.spin_time` 을 읽어 판정하고, 매분 호출 전제에서 하루 1회만 결과를 만든다 — 기존 결과가 있으면 skip, `23505` 는 정상 경로 | ✓ VERIFIED | `spin-roulette/index.ts:91-95` `from("settings").select("spin_time, cooldown_days").eq("id", SETTINGS_ROW_ID).maybeSingle()` → `:102-107` `parseSpinTime` 으로 `spinTime` 갱신 → `:118` `isAfterSpinTime(now, spinTime)`. 하드코딩 상수 `SPIN_HH/MM` 0건(#12). 멱등: `:124-142` `from("results").select("date, menu, restaurant_id").eq("date", now.date).maybeSingle()` → `already_decided`. `:208-210` `insErr.code === "23505"` → `race_already_decided`(로그 없음 — 정상 경로). cron 은 `0005:132-134` `'* * * * *'` 매분. `results.date unique`(`0001:13`)가 23505 의 전제 |
| 2 | **[SC2]** 두 함수 모두 `candidates`→`restaurants` 조인으로 후보를 읽고 `_shared` 쿨다운 필터를 통과한 목록에서 뽑아 `results` 에 매장명 스냅샷과 `restaurant_id` 를 함께 쓴다. 다시 돌리기는 횟수 제한 없이 덮어쓴다 | ✓ VERIFIED | 조인: spin `:144-148` / respin `:138-141` `from("candidates").select("restaurant_id, created_at, restaurants ( id, name )").order("created_at")` — `from("menus")` 양쪽 0건(#23·#35). 쿨다운: spin `:170-190` / respin `:165-185` `cooldownWindowStart` → `applyCooldown` (import `../_shared/cooldown.ts` spin `:20` / respin `:30`). 쓰기: spin `:200-204` `insert({ date, menu: winner.name, restaurant_id: winner.restaurant_id, candidates: snapshot })`, respin `:197-206` `upsert({ …, spun_at }, { onConflict: "date" })`. respin 에 `isAfterSpinTime`·멱등 조회 0건(`from("results")` 2회 #38), 횟수 카운터 0건 — 무제한 덮어쓰기 |
| 3 | **[SC3]** 후보가 0개면 결과 행을 만들지 않고 `no_candidates` 로 끝난다 — 이후 후보를 담으면 다음 폴링에서 추첨된다 | ✓ VERIFIED | spin `:164-166` `if (candidates.length === 0) return json({ skipped: "no_candidates", date, excluded_count })` — `insert` `:200` 보다 앞이고 쿨다운 `:169` 보다도 앞(D-05, Pitfall 7: `pickRandom([])` 구조적 불가). respin `:160-162` 동일. 행이 없으므로 다음 분 폴링은 `:135` `existing` 이 null 이라 후보 조회로 진행한다. #53·#55 가 리터럴을, #31 이 순서를 고정 |
| 4 | **[SC4]** 기본 설정(11:55·쿨다운 0)에서 두 함수의 판정 결과가 전환 전 동작과 동일함을 보이는 테스트가 통과한다 | ✓ VERIFIED | `spinTime.test.ts:60-65` #16 `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` = `DEFAULT_SPIN_TIME`(이 페이즈 신규, +7줄 diff) + 기존 #2·#12·#13(`"11:55:00"` 파싱, 11:54:59/11:55:00 경계) + `cooldown.test.ts` #1·#7(`days=0 → null`, 승자 없음 → 항등). 함수 쪽 기본 경로: spin `:85-86` `spinTime = DEFAULT_SPIN_TIME; cooldownDays = 0`, `:170-172` `windowStart === null` 이면 쿨다운 조회 **생략**(전환 전과 쿼리 수 동일). Node 프로브 15/15 PASS(`parseSpinTime('11:55:00')`=DEFAULT · 경계 · `cooldownWindowStart(today,0)`=null · `cooldownWindowStart(today,NaN)`=null · `applyCooldown(c,[])` 항등). **한계(D-15 명시):** 테스트 표면은 `_shared` 단위 + 계약 텍스트(#30·#31)이고 함수 본문 자체는 실행되지 않는다 — Phase 8 몫(Deferred 1) |
| 5 | **[SC5]** `deno check` 가 두 함수에서 통과하고, CORS 헤더·OPTIONS 단락·`verify_jwt = false` 가 유지된다 | ✓ VERIFIED | `npm run check:edge` 이 프로세스에서 **exit 0**, 실행 후 `git status` 에 lock 드리프트 0·루트 `deno.lock` 부재. respin `:79-83` `corsHeaders` 3필드(`Origin *`·`Headers authorization, x-client-info, apikey, content-type`·`Methods POST, OPTIONS`), `:96-98` `req.method === "OPTIONS"` 단락, `:86-91` `json()` 이 `...corsHeaders` 스프레드 → 405·500·ok 전부 CORS 포함. `supabase/config.toml:12-16` 두 함수 `verify_jwt = false`, 이 페이즈 diff 0줄. #22·#45 가 고정. 배포 측 확인(경고 부재)은 Deferred 5 |
| 6 | **[04-01 D-01]** `npm run check:edge` 한 줄이 두 `index.ts` 를 `--config supabase/functions/deno.json` 으로 검사하고 exit 0 | ✓ VERIFIED | `package.json:10` `"check:edge": "deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts"`. 실측 exit 0. deno 2.9.7 설치 확인 |
| 7 | **[04-01 D-01]** 설정 파일은 `supabase/functions/deno.json` 한 단계 위에만 있고 함수 디렉터리 2개 안에는 `deno.json`·`deno.jsonc`·`import_map.json` 이 없다 | ✓ VERIFIED | `supabase/functions/deno.json` = `{ "nodeModulesDir": "none" }` 한 키. `ls supabase/functions/{spin,respin}-roulette` → 각 `index.ts` 1파일뿐. 계약 #48(`:405-417`) `existsSync` 7원소 `[false×6, true]` 통과 |
| 8 | **[04-01 D-02]** `supabase/functions/deno.lock` 은 생성물이고 루트 `deno.lock` 은 없다. `check:edge` 후 드리프트 0 | ✓ VERIFIED | lock 276줄, `:5` `"jsr:@supabase/supabase-js@2.117.2": "2.117.2"`, 비핀 `@2"` 줄 **0건**(04-04 `3d460fb` 재생성으로 정리됨 — SUMMARY 의 `b2b9163…`/`fdf2e8c3…` 는 커밋이 아니라 lock 의 shasum). `test -f deno.lock` → 부재. `check:edge` 실행 후 `git status --porcelain` 변화 0 |
| 9 | **[04-01 D-08]** `ResultRow.candidates` 가 `{ name: string; restaurant_id?: string }[]` 이고 optional 이유가 주석에 있으며 `CalendarLog.tsx` 무변경·`tsc` exit 0 | ✓ VERIFIED | `lib/supabase/client.ts:22` 정확히 그 형태 + "전환 이전 행에는 그 키가 아예 없어서 optional" 주석(이 페이즈 diff 1줄). `git diff 65c94b4..HEAD -- components/CalendarLog.tsx` 0줄, `CalendarLog.tsx:223,248,251` 은 `c.name`·`length` 만 읽음. `npx tsc --noEmit` exit 0 |
| 10 | **[04-01 D-14]** `edgeImports.test.ts` 가 기존 24건을 지우지 않고 26건을 더해 50건이 됐고 그중 22건이 RED 였다 | ✓ VERIFIED | **스크래치 재실행:** `git archive a39265b` 트리에서 `npx vitest run …/edgeImports.test.ts` → `Tests 22 failed \| 28 passed (50)`(그 시점 두 `index.ts` 는 `from("menus")` 각 1건). 현재 HEAD 는 리뷰 수정 8건(#49~#56) 추가로 **58건 / 58 통과**. 기존 #1~#22·#7a·#16a 전부 잔존(`:61-170`) |
| 11 | **[04-01 D-14]** 개수 단언은 `stripComments` 사본에서 세고 `DEFAULT_SPIN_TIME` 은 `\b` 경계를 쓴다 | ✓ VERIFIED | `:51-56` `stripComments(raw*, "//")` 사본 5개(+page), 개수 단언 전부 사본 변수(`spin`·`respin`) 사용. `:237` `/DEFAULT_SPIN_TIME\b/g`, `:340` 동일. 원본 변수(`raw*`)는 존재·길이 단언(#1~#3·#56)에만 |
| 12 | **[04-01 D-15·SETT-04]** `spinTime.test.ts` #16 왕복 1건이 추가됐고 현행 코드로도 통과한다(회귀 핀) | ✓ VERIFIED | `spinTime.test.ts:60-65`, 파일 16건 통과. 이 페이즈 diff `+7` 줄이 그 케이스 하나. Phase 3 시점 15건 → 16건 |
| 13 | **[04-02 SPIN-01·D-04·D-05]** 설정 조회 실패·파싱 실패 시 멈추지 않고 `DEFAULT_SPIN_TIME`·쿨다운 0 으로 진행, `console.error` 1건 + `settings_fallback: true` | ✓ VERIFIED | spin `:96-99` 조회 에러 → 로그 + 플래그, 진행. `:100-116` 0행은 플래그 없이 기본값, `:102-104` `typeof spin_time === "string"` 좁힘 후 `parseSpinTime`, 실패 시 `:109-113` `JSON.stringify` 로그 + 플래그. `:115` `cooldownDays = Number(…)` — NaN 은 `cooldown.ts:16` 이 `null` 창으로 흡수(프로브 PASS). `settingsFallback` 은 `:226` 응답에 상시 |
| 14 | **[04-02 D-05]** 순서 `kstNow()` → 설정 → `isAfterSpinTime` → 멱등 조회 → 후보 → 쿨다운 → `pickRandom` → insert, 계약 #31 이 고정 | ✓ VERIFIED | `:76` kstNow → `:91` settings → `:118` isAfterSpinTime → `:126` results(멱등) → `:146` candidates → `:188` applyCooldown → `:196` pickRandom → `:200` insert. #31(`:241-255`) 5토큰 `indexOf` 단조 증가 통과. 설정이 판정보다 앞인 이유 `:78` 주석 |
| 15 | **[04-02 D-03]** `normalizeCandidates(rows: unknown)` 이 `Array.isArray(embed) ? embed[0] : embed` 로 접고 `typeof` 로 좁히며 `as`·`any` 0. 형태 어긋난 행은 제외 + `console.error` | ✓ VERIFIED | `:38-66` 시그니처 `(rows: unknown): { picked; excluded; excludedIds }`, `:59-60` 접기, `:57-62` `typeof`·`in` 좁히기 4단. `\bas\b`·`\bany\b`·`restaurants[0]` 주석 밖 0건(두 파일). `:156-158` 제외 시 로그. **deno 실행 프로브 9케이스:** 객체 임베드·배열 임베드 → 같은 `picked`, `null` 임베드 → 제외 + id 기록, 비배열 → `excluded: 1`, 순서 보존 — spin/respin 결과 전부 동일(ALL_SAME) |
| 16 | **[04-02 D-18]** 멱등 조회가 `select("date, menu, restaurant_id")`, `already_decided` 에 `restaurant_id` 포함, 조회 에러는 로그 후 진행 | ✓ VERIFIED | `:124-128` select 3열, `:132` `if (existErr) console.error(…)` 후 계속, `:135-141` 응답에 `restaurant_id: existing.restaurant_id`. 23505 가 최종 보험(`:208`) — Pitfall 6 권고대로 |
| 17 | **[04-02 SPIN-02·D-06]** `cooldownWindowStart` 가 `null` 이면 조회 생략, 창은 `[from, today)`, 조회 실패 → `cooldown_skipped`, 전멸 폴백 → `cooldown_fallback` | ✓ VERIFIED | `:170-172` `windowStart !== null` 가드, `:173-177` `.gte("date", windowStart).lt("date", now.date)`(#52 `[1,1,0]` — `.lte` 0), `:179-181` 실패 → 로그 + `cooldownSkipped`, `:188-190` `applyCooldown` → `pool`·`cooldownFallback`. `:185-186` `null` id 를 거르지 않고 넘김(레거시 행 무시 분기를 `cooldown.ts:41` 에 맡김). 프로브: `applyCooldown` 전멸 → `fellBack: true` |
| 18 | **[04-02 D-08]** insert 본문 `{ date, menu: winner.name, restaurant_id: winner.restaurant_id, candidates: snapshot }`, 스냅샷은 담은 순서 `{ name, restaurant_id }`, `23505` → `race_already_decided` | ✓ VERIFIED | `:197` `snapshot = candidates.map((c) => ({ name, restaurant_id }))`(쿨다운 적용 **전** 전체, `.order("created_at")` 순), `:200-204` insert 본문 4키, `:208-210` 레이스. #27 `restaurant_id: winner.restaurant_id` 2회(본문+응답). `results.candidates jsonb`·`menu text`(`0001:14-15`) 와 호환 |
| 19 | **[04-02 D-07·D-09]** 모든 반환이 `json()` 을 지난다(맨 `new Response` 1회), ok 응답에 세 boolean 상시 + `candidate_count`/`picked_count`, `before_spin_time` 은 `kst` 8필드 | ✓ VERIFIED | `:70-72` `json()` 이 유일한 `new Response(`(#34 `[1,1]`). 반환 9곳(`:121,:136,:153,:166,:210,:213,:216,:232`) 전부 `json(`. `:216-226` ok 리터럴에 `candidate_count`·`picked_count`·`excluded_count`·세 boolean 무조건부. `:121` `kst: now`(`kstParts` 8필드 — 프로브 확인). IN-08 `:227-233` `catch` 도 `json(…, 500)` |
| 20 | **[04-02 D-02]** 런타임 import `jsr:@supabase/supabase-js@2.117.2` 핀, `edge-runtime.d.ts` 는 비핀, lock 갱신 | ✓ VERIFIED | spin `:16-17` / respin `:25-26` 정확히 그 두 줄. #29·#41 `[1, 0]`(비핀 `@2"` 0). lock `:4-8` functions-js·supabase-js·auth-js·postgrest-js 전부 2.117.2 |
| 21 | **[04-03 SPIN-04·D-07]** `respin-roulette` 가 조인에서 읽고 `settings.cooldown_days` 로 쿨다운을 적용해 결과를 덮어쓴다(횟수 무제한). 시간 가드·멱등 스킵 없음 | ✓ VERIFIED | respin `:122-135` 설정 → `:138-141` 조인 → `:165-185` 쿨다운 → `:197-206` upsert. `isAfterSpinTime`·`parseSpinTime`·`DEFAULT_SPIN_TIME` 0건(#42), 멱등 조회 없음(#38 `from("results")` 2 = 쿨다운 창 `:169` + 덮어쓰기 `:197`). 카운터·제한 0건 |
| 22 | **[04-03 D-07]** CORS 머리 주석·`corsHeaders` 3필드·`json()`·OPTIONS 단락·`upsert(onConflict: "date")`·`spun_at` 보존, 맨 `new Response(` 정확히 2회 | ✓ VERIFIED | `:14-23` CORS 논증(WR-01 로 `:21-23` 3줄 추가 — GET·HEAD 는 POST 검사가 막는다), `:79-83`·`:86-91`·`:96-98`, `:197-206` `spun_at: new Date().toISOString()` + `{ onConflict: "date" }`(#46 `[1,1]`). `new Response(` `:87`·`:97` 2회(#45 `[2,1]`). WR-01 `:103-105` 405 는 `json()` 경유라 계약 유지 |
| 23 | **[04-03 D-07·#17]** respin 은 `spinTime.ts` 를 import 하지 않고, `settings` 조회 문자열은 spin 과 같되 `cooldown_days` 만 소비 → `settings_fallback` 은 조회 실패에서만 | ✓ VERIFIED | `:29-30` import 2줄(kst·cooldown)뿐, #17 0건. `:122-126` `select("spin_time, cooldown_days")` 동일 문자열, `:131-135` `cooldownDays` 만 읽음, `:128-131` 조회 실패에서만 플래그. `:119-121` 주석이 비대칭을 명시(REVIEW IN-01 은 설계 재논의로 미적용) |
| 24 | **[04-03 D-03·#47]** 후보 정규화 헬퍼가 spin 과 같은 이름·시그니처 | ✓ VERIFIED | 두 파일에서 `type Candidate` + `function normalizeCandidates(` 블록(각 30줄)을 추출해 `diff` → **바이트 동일**. #47 `[1,1]` 통과 |
| 25 | **[04-03 D-13]** `lib/errors.ts` 에 `formatRespinError(fallbackMessage: string, body: unknown): string`, 값 import 0, 세 케이스가 `lib/errors.test.ts` 에 있다 | ✓ VERIFIED | `lib/errors.ts:47-59` 시그니처 일치, 파일 전체 `import` 0건. `lib/errors.test.ts:44-117` `formatRespinError` **10건**(플랜 3 + WR-03 `{code,message}` 2 + IN-03 trim/공백/200 상한 3 + 우선순위 1 + 경계 1), 파일 17건 통과 |
| 26 | **[04-03 D-12]** `respin()` 이 `invoke()` 의 `response` 로 500 본문을 정확히 한 번 읽고, `FunctionsHttpError` 값 import·`any` 없이 `error instanceof Error` 로 좁히며 `.catch(() => null)` 로 비-JSON 본문을 흡수 | ✓ VERIFIED | `app/page.tsx:222` `const { data, error, response } = await supabase.functions.invoke<RespinResponse>(…)`, `:225` `response ? await response.json().catch(() => null) : null`(파일 내 `response.json()` 2건 중 실호출 1 + 주석 1), `:226` `instanceof Error`, `:227` `formatRespinError(fallback, body)`. `FunctionsHttpError` 0 · `error.context` 0 · `: any`/`as any` 0. import 14줄 |
| 27 | **[04-03 D-13a]** `wr-02-respin-error-body.md` 삭제, `done/` 미생성 | ✓ VERIFIED | `test -f .planning/todos/pending/wr-02-respin-error-body.md` → 부재(diff `-7`), `.planning/todos/done` 부재. pending 7파일(in-06 신규 포함) |
| 28 | **[04-03 Phase Boundary]** `app/page.tsx` 는 `respin()` 과 import 한 줄 밖을 건드리지 않았다 | ✓ VERIFIED | `git diff 65c94b4..HEAD -- app/page.tsx` hunk 3개: import 1줄(`:9`), `RespinResponse` 타입 + 주석(`:18-22`, 리뷰 IN-04 `e965cb4` — respin 응답 타입이라 경계 안), `respin()` 본문(`:216-245`). 후보 소스 `menus`·`winnerIndex`·문구 무변경 |
| 29 | **[04-03 D-16]** `check:edge` exit 0 이고 계약 50건과 단위 테스트 전체가 초록(219/219 · 10 files) | ✓ VERIFIED | **스크래치 재실행:** `git archive ebbd7d1` 트리 `npx vitest run` → `Test Files 10 passed (10)` · `Tests 219 passed (219)`. HEAD 는 234/234. `check:edge` HEAD exit 0 |
| 30 | **[04-04 D-17 (1)]** `CLAUDE.md` 검증 명령 블록이 5줄이고 `npm run check:edge` 포함 | ✓ VERIFIED | `CLAUDE.md:23-27` 5줄(`tsc`·`lint`·`test`·`build`·`check:edge`), `:30` deno 외부 도구 전제. `git show HEAD:CLAUDE.md` 에 `check:edge` 4건 — 커밋됨. (이 세션 시스템 프롬프트의 CLAUDE.md 사본은 `ea6c5cb` 이전 스냅샷이라 4줄로 보이나 디스크·HEAD 가 정본) |
| 31 | **[04-04 D-17 (2)]** "두 `index.ts` 본문은 여전히 사각지대 … 낭독으로만" 이 정정됐다 | ✓ VERIFIED | `grep -c '여전히 사각지대' CLAUDE.md` → 0. `:44` "`deno check`(`npm run check:edge`)가 **타입**을 검사하고 … 텍스트 계약 58건이 **형태**를 고정 … 남는 사각지대는 **동작**" |
| 32 | **[04-04 D-17 (3)]** 엔트리포인트의 두 함수 설명이 `candidates`→`restaurants`·`settings`·쿨다운으로, 흐름 문단의 함수 쪽 `menus` 가 정정되고 클라이언트 쪽 `menus` 는 유지 | ✓ VERIFIED | `CLAUDE.md:16` "pg_cron이 **매분** 호출 … `settings.spin_time` … `candidates` → `restaurants` 조인 … `restaurant_id` … POST 가 아닌 요청은 405 … 두 함수 모두 아직 배포되지 않았다". `:18` 서버 쪽 "`candidates`⋈`restaurants` 조회 → results 쓰기", 클라이언트 쪽 "`menus`/`results` … (후보 소스를 `candidates` 로 바꾸는 것은 Phase 6)" |
| 33 | **[04-04 D-17 (4)]** 코드 컨벤션에 D-10 한 줄(콘솔 에러 규약·클라이언트는 배너) | ✓ VERIFIED | `CLAUDE.md:45` "Edge Function 의 500·폴백 경로는 `console.error` 로 … spin 8지점·respin 6지점 … `app/`·`lib/` 에는 넣지 않는다 — 클라이언트는 배너가 채널" (리뷰 후 수치로 갱신됨) |
| 34 | **[04-04 D-17·D-01·D-02]** 비표준 규약 절에 `deno.json`·`deno.lock` 위치·용도·금지·버전 갱신 절차 | ✓ VERIFIED | `CLAUDE.md:51` 한 항목에 네 가지 전부: 로컬 전용/배포 미참조, 함수 디렉터리 안 금지(#48 인용), `jsr:` 핀 + lock 재생성 함께, 루트 lock 생기면 명령을 고친다 |
| 35 | **[04-04 D-17 (5)]** "`deno` 가 없어 `deno check` 를 돌릴 수 없다" 의 실제 위치 2곳(`edgeImports.test.ts:1`·`CONCERNS.md:195`) 정정 | ✓ VERIFIED | `edgeImports.test.ts:1-2` "로컬 deno 2.9.7 + npm run check:edge 가 두 index.ts 의 타입을 검사하지만 … 이 spec 이 보는 것은 형태다". `CONCERNS.md:194-195` `check:edge` 서술, `grep -c '수동 실행'` → 0 |
| 36 | **[04-04 D-17]** `CONVENTIONS.md:281,282,299-304`·`CONCERNS.md:148-151,191-196,331` 현행화 | ✓ VERIFIED | `CONVENTIONS.md:281` check:edge + 제외 범위, `:303` 검증 명령 5줄째, `:306` 마지막 문장; `grep -c '복붙돼 있다'` → 0. `CONCERNS.md:194`([P1]→[P2] 강등 근거), `:331`(스키마 가정 → 조인 + `restaurant_id`). 이 페이즈 diff: CONVENTIONS 14줄·CONCERNS 23줄 |
| 37 | **[04-04 D-17]** `wr-01-cutover-window.md` 4번이 `verify_jwt = false`(63fae89) 문구로 정정되고 7번(수동 invoke 로 `menu`·`restaurant_id` 확인)이 추가됐다 | ✓ VERIFIED | 파일 4번 "`supabase/config.toml` 에 `verify_jwt = false` 가 고정돼 있으므로(63fae89) … `--no-verify-jwt` … 이중 안전", 7번 "`respin-roulette` 를 수동 invoke … `menu` 가 실제 매장명 … `restaurant_id` 가 uuid … 첫 실호출에서만 드러난다". `63fae89` 커밋 실재 |
| 38 | **[04-04]** 문서에 이 페이즈가 하지 않은 일(배포·마이그레이션 적용·화면 문구·README)을 한 것처럼 적지 않았다 | ✓ VERIFIED | `CLAUDE.md:16` "두 함수 모두 아직 배포되지 않았다 … 배포·마이그레이션 적용은 Phase 8", `:18` 후보 소스 교체는 Phase 6. `README.md` 이 페이즈 diff 0줄(파일 목록에 없음). `spinTime.ts:3` 화면 "11:55" 는 Phase 6 |
| 39 | **[04-04 D-16]** 페이즈 게이트 5종 exit 0, `npm audit` critical·high 0, `git status` 에 `.serena/project.yml`·`.planning/config.json` 외 미의도 변경 0, 루트 `deno.lock` 부재 | ✓ VERIFIED | 이 프로세스 실측(HEAD `5b11547`): `npx tsc --noEmit` 0 · `npm run lint` 0 · `npm test` 0(234/234, 10 files) · `npm run build` 0(라우트 4개 `○ Static`) · `npm run check:edge` 0 · `npm audit --audit-level=high` 0(`found 0 vulnerabilities`). `git status --porcelain` = 위 2파일뿐. 루트 lock 부재. 페이즈 커밋 28개(`65c94b4..HEAD`) 본문에 AI 표기 0건 |

**Score:** 39/39 truths verified

### Deferred Items

이 페이즈에서 충족되지 않았지만 로드맵의 후속 페이즈가 명시적으로 맡는 항목(Step 9b). 상태 판정에 영향 없음. 상세는 frontmatter `deferred:`.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 두 `index.ts` 의 **실행** 동작 — 임베드 실제 형태, `upsert` 실제 갱신, 응답 `menu`·`restaurant_id` 실물 | Phase 8 | ROADMAP Phase 4 로컬 검증 절 "실제 호출 검증은 Phase 8 컷오버에서 `respin-roulette` 수동 invoke" · `wr-01` 7번 · VALIDATION Manual-Only 1·2행 |
| 2 | `settings.spin_time` 실제 직렬화 문자열 | Phase 8 | SUMMARY 미검증 2번. 어긋나도 `settings_fallback` 폴백(spin `:103-113`) |
| 3 | `respin()` 배너에 함수 500 본문이 실리는가 | Phase 6 · Phase 8 | VALIDATION Manual-Only 3행. 브라우저+배포+실제 500 필요 |
| 4 | `console.error` 가 대시보드 로그에 보이는가 | Phase 8 | VALIDATION Manual-Only 4행 |
| 5 | `check:edge` 도입이 배포 동작을 바꾸지 않는가(deploy 경고 부재) | Phase 8 | VALIDATION Manual-Only 5행 (SC-5 배포 측 반) |
| 6 | results UPDATE 구독의 `on delete set null` 오인(IN-09) | Phase 6 | todo `in-06-…` `resolves_phase: 6` |
| 7 | 화면 "11:55"·후보 소스 `menus`→`candidates`·`winnerIndex`·`excluded_count` 배너 분기 | Phase 6 | ROADMAP Phase 6 goal (SPIN-05·06) · 04-CONTEXT Deferred |
| 8 | 계약 #56 의 `app/page.tsx` 경계 넘는 단언 | Phase 6 | `edgeImports.test.ts:47-49,390-395` 의도 주석. gap 아님 — Phase 6 이 page 를 다시 쓸 때 옮긴다 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/functions/deno.json` | `nodeModulesDir` 한 키 | ✓ VERIFIED | `{ "nodeModulesDir": "none" }` 1줄. `package.json:10` 이 `--config` 로 참조 (WIRED) |
| `supabase/functions/deno.lock` | jsr 해석 고정, `2.117.2` | ✓ VERIFIED | 276줄, `:4-8` 2.117.2 전부, 비핀 `@2"` 0. `check:edge` 가 자동 생성·재검증 (WIRED) |
| `package.json` | `scripts.check:edge` | ✓ VERIFIED | `:10`. CLAUDE.md:27·CONVENTIONS:303 이 인용 (WIRED) |
| `lib/supabase/client.ts` | `restaurant_id?: string` | ✓ VERIFIED | `:22`. `CalendarLog.tsx:223-251` 소비 (WIRED) |
| `supabase/functions/_shared/edgeImports.test.ts` | ≥240줄, `existsSync` | ✓ VERIFIED | 418줄, `:12` import, `:405-417` #48. vitest 수집 58/58 (WIRED) |
| `supabase/functions/_shared/spinTime.test.ts` | `(#16)` | ✓ VERIFIED | `:60` 16/16 (WIRED) |
| `supabase/functions/spin-roulette/index.ts` | ≥130줄, `normalizeCandidates` | ✓ VERIFIED | 234줄, `:38` 선언 · `:155` 호출. `Deno.serve` 1(#7a). 데이터: settings·results·candidates 실조회 → insert (FLOWING, 구조상) |
| `supabase/functions/respin-roulette/index.ts` | ≥120줄, `normalizeCandidates` | ✓ VERIFIED | 232줄, `:49` 선언 · `:150` 호출. `app/page.tsx:222` 가 `invoke("respin-roulette")` (WIRED) |
| `lib/errors.ts` | `formatRespinError` | ✓ VERIFIED | `:47-59`, import 0. `app/page.tsx:9` import · `:227,:241` 호출 (WIRED) |
| `lib/errors.test.ts` | `formatRespinError` | ✓ VERIFIED | `:44-117` 10건, 17/17 (WIRED) |
| `app/page.tsx` | `formatRespinError` | ✓ VERIFIED | `:9,:227,:241`. `setActionError` → `ErrorBanner`(기존 배선) (WIRED) |
| `CLAUDE.md` | `check:edge` | ✓ VERIFIED | `:27,:30,:44,:51` 4건, HEAD 커밋됨 |
| `.planning/codebase/CONVENTIONS.md` | `check:edge` | ✓ VERIFIED | `:281,:303,:306` |
| `.planning/codebase/CONCERNS.md` | `check:edge` | ✓ VERIFIED | `:194,:195,:331` |
| `.planning/todos/pending/wr-01-cutover-window.md` | `restaurant_id` | ✓ VERIFIED | 7번 항목. 4번 `63fae89` 1건 |
| `.planning/phases/04-server-spin/04-VALIDATION.md` | `status: complete` | ✓ VERIFIED | frontmatter `status: complete`, `nyquist_compliant: true`, 표 Status 전부 `✅ green` + manual-only 1행. ℹ️ 본문 수치(219·50건·7/5)는 리뷰 전 시점 — 문서 후속 |

`gsd-sdk query verify.artifacts` 4플랜 전부 `all_passed: true`(6/6·2/2·4/4·5/5). `verify.key-links` 는 04-01~04-03 에서 `verified: 0` 을 냈으나 **도구의 오판**이다 — `to` 가 파일이 아닌 `public.settings` 같은 논리 대상이거나(`Target not referenced`), 패턴을 정규식이 아닌 리터럴로 찾거나(`restaurants\s*\(…`), `\(` 를 잘못 이스케이프한(`Invalid regex pattern: formatRespinError\(`) 경우다. 아래 표는 전부 직접 grep 으로 판정했다.

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `package.json` | `supabase/functions/deno.json` | `--config` 인자 | ✓ WIRED | `package.json:10` 패턴 `deno check --config supabase/functions/deno.json` 정확 일치 |
| `edgeImports.test.ts` | `supabase/functions/deno.json` | `existsSync` 존재/부재 | ✓ WIRED | `:415` `existsSync(new URL("../deno.json", import.meta.url))` = true, `:409-414` 함수 디렉터리 6경로 = false |
| `edgeImports.test.ts` | `spin-roulette/index.ts` | `readOrEmpty(new URL("../spin-roulette/index.ts"…))` | ✓ WIRED | `:45`, respin `:46`, page `:49` |
| `spin-roulette/index.ts` | `_shared/cooldown.ts` | `cooldownWindowStart`/`applyCooldown` 확장자 import | ✓ WIRED | `:20` `from "../_shared/cooldown.ts"`, 호출 `:170`·`:188` |
| `spin-roulette/index.ts` | `public.candidates ⋈ public.restaurants` | 임베드 select + `normalizeCandidates` | ✓ WIRED | `:146-147` `from("candidates").select("restaurant_id, created_at, restaurants ( id, name )")` → `:155` 정규화. FK `0005:40`, `created_at` `0005:41` |
| `spin-roulette/index.ts` | `public.settings` | `select(spin_time, cooldown_days).eq(id,1).maybeSingle()` | ✓ WIRED | `:91-95`, `SETTINGS_ROW_ID = 1`(`:28`) ↔ `0005:50` `check (id = 1)` |
| `spin-roulette/index.ts` | `public.results` | 멱등 조회·쿨다운 창·insert | ✓ WIRED | `:126`·`:174`·`:200` = 3회(#26). 결과가 응답으로 되돌아감(`:216-226`) |
| `respin-roulette/index.ts` | `_shared/cooldown.ts` | 확장자 import | ✓ WIRED | `:30`, 호출 `:165`·`:183` |
| `respin-roulette/index.ts` | `public.candidates ⋈ public.restaurants` | 임베드 select + `normalizeCandidates` | ✓ WIRED | `:139-140` → `:150` |
| `app/page.tsx` | `lib/errors.ts` | `formatRespinError(fallback, body)` | ✓ WIRED | `:9` import, `:227` `formatRespinError(fallback, body)`, `:241` `formatRespinError(fallback, null)` |
| `app/page.tsx` | `respin-roulette/index.ts` | `invoke` 의 `response` 로 `{ error }` 읽기 | ✓ WIRED | `:222` `invoke<RespinResponse>("respin-roulette")`, `:225` `response.json()`. 함수 쪽 500 이 `json()`(CORS 포함)을 지나는 것이 전제(`:147,:210,:230`) — 브라우저 실증은 Deferred 3 |
| `CLAUDE.md` | `package.json` | `npm run check:edge` | ✓ WIRED | sdk 검증 통과 + `:27` |
| `wr-01-cutover-window.md` | `respin-roulette/index.ts` | SHIP-04 7번 수동 invoke | ✓ WIRED | sdk 검증 통과 + 7번 원문 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `spin-roulette/index.ts` | `spinTime`·`cooldownDays` | `from("settings")` 실조회 `:91-95` → `parseSpinTime`/`Number` | DB 행(라이브에 아직 없음 — 없으면 기본값 경로, 0행은 에러 아님) | ✓ FLOWING(구조) |
| `spin-roulette/index.ts` | `candidates`·`pool`·`winner` | `from("candidates")` 임베드 `:144-148` → `normalizeCandidates` → `applyCooldown` → `pickRandom` | 실조회; 정적 반환·하드코딩 후보 0건 | ✓ FLOWING(구조) |
| `spin-roulette/index.ts` | `results` 행 | `insert` `:200-204` 에 `winner`·`snapshot` | 응답 `:216-226` 이 같은 값을 되돌림 | ✓ FLOWING(구조) |
| `respin-roulette/index.ts` | 동일 3종 | 동일 경로 + `upsert` `:197-206` | 동일 | ✓ FLOWING(구조) |
| `app/page.tsx` `respin()` | `body` → `actionError` | `response.json()` `:225` → `formatRespinError` → `setActionError` → `ErrorBanner` | 네트워크 본문; 하드코딩 없음 | ✓ FLOWING(구조) |

"구조" 표기: 데이터 소스가 실제 DB 조회·네트워크 응답임은 코드로 확정되나, 라이브에 새 테이블이 없고 함수가 배포되지 않아 **런타임 흐름은 Phase 8 까지 관측 불가**(Deferred 1·3).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 정적 게이트 5종 + audit (HEAD) | `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` · `npm run check:edge` · `npm audit --audit-level=high` | exit 0 ×6. test `10 files / 234 passed`, build 라우트 4개 Static, audit `found 0 vulnerabilities` | ✓ PASS |
| lock 드리프트·루트 lock | `check:edge` 후 `git status --porcelain`; `test -f deno.lock` | 변화 0(`.planning/config.json`·`.serena/project.yml` 뿐); 루트 lock 부재 | ✓ PASS |
| 파일별 테스트 수(회귀) | `npx vitest run --reporter=json` | MenuList 10 · errors 17 · phase 16 · settings 28 · time 13 · migrations 53 · cooldown 14 · edgeImports 58 · kst 9 · spinTime 16 = **234**. Phase 1~3 분 189(=03-VERIFICATION 기준선) + 신규 45(edgeImports 34 · errors 10 · spinTime 1) | ✓ PASS |
| `normalizeCandidates` 임베드 접기 (두 파일 추출 → deno 실행) | 스크래치 `deno run run.ts` 9케이스 | 객체/배열 임베드 → 같은 `picked`; `null` 임베드 → 제외 + id; 비배열 → `excluded: 1`; 비문자열 `name`/`restaurant_id` → 제외; 순서 보존. spin == respin **ALL_SAME**, 추출 본문 `diff` 0줄 | ✓ PASS |
| `_shared` 기본 설정 경로 = 전환 전 (SC-4) | 스크래치 `node shared-probe.mjs` (Node 25 타입 스트리핑 직접 import) | 15/15 PASS — `parseSpinTime('11:55:00')`=DEFAULT · #16 왕복 · 11:54:59 false/11:55:00 true · `cooldownWindowStart(today,0)`=null · `(today,NaN)`=null · `(today,7)`=`2026-09-21` · `applyCooldown` 항등/제외/전멸폴백/null 무시 · `kstParts` 8필드·`date` 키 | ✓ PASS |
| TDD RED 실재 (04-01 주장) | `git archive a39265b` → 스크래치 → `npx vitest run …/edgeImports.test.ts` | `Tests 22 failed \| 28 passed (50)` — 그 시점 두 `index.ts` 는 `from("menus")` 각 1건 | ✓ PASS |
| TDD GREEN 실재 (04-03 주장) | `git archive ebbd7d1` → 스크래치 → `npx vitest run` | `Test Files 10 passed (10)` · `Tests 219 passed (219)` | ✓ PASS |
| 커밋 무결성 | SUMMARY·REVIEW 인용 7자리 해시 29개 `git cat-file -t` | 28개 commit 실재. `b2b9163` 1건 MISSING → 인용 맥락 확인 결과 **`deno.lock` 의 `shasum`** 이지 커밋이 아님(04-03-SUMMARY:150·04-04-SUMMARY:183) | ✓ PASS |
| AI 표기 금지 (프로젝트 제약) | `git log --format=%B 65c94b4..HEAD \| grep -ciE 'co-authored-by\|generated with\|claude\|anthropic'` | 0 | ✓ PASS |
| 실호출·배포·브라우저 배너 | — | 라이브에 새 테이블 없음, 함수 미배포 | ? SKIP → Deferred 1·3·4·5 |

스크래치 트리는 실행 후 삭제했고 프로젝트 `git status` 는 시작 시점과 동일하다.

### Probe Execution

`scripts/*/tests/probe-*.sh` 없음(`find scripts -path '*/tests/probe-*.sh'` 0건), PLAN·SUMMARY 에 probe 선언 없음 — 해당 없음(Phase 3 과 동일). 이 페이즈의 실행 가능한 검증은 위 스위트·deno/Node 프로브·RED/GREEN 재실행이 담당한다.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SPIN-01 | 04-01, 04-02, 04-04 | 설정된 추첨 시각 이후 첫 폴링(매분)에서 오늘 후보 중 매장 하나가 자동 확정된다. 하루 1회 멱등 | ✓ SATISFIED | Truth 1·13·14·16. spin `:91-121` `settings.spin_time` 판정, `:124-142` 멱등, `:208-210` 23505, `0005:134` 매분 cron. REQUIREMENTS.md `[x]`·Complete (`ea6c5cb` 계열 메타 커밋에서 마킹) — 근거 실재 |
| SPIN-02 | 04-01, 04-02, 04-03 (Phase 3 → Phase 4 이관) | `cooldown_days` > 0 이면 최근 N일 당첨 매장 제외, 비면 전체 폴백 | ✓ SATISFIED | Truth 2·17·21. spin `:169-192` / respin `:164-187` 배선, 폴백은 `cooldown.ts:45-47`(프로브 전멸 → `fellBack: true`). 03-VERIFICATION 이 Phase 4 로 deferred 했던 항목이 여기서 닫힘. REQUIREMENTS.md Complete — 근거 실재 |
| SPIN-04 | 04-01, 04-03, 04-04 | 다시 돌리기는 오늘 후보에서 다시 뽑아(쿨다운 적용) 결과를 덮어쓴다. 횟수 무제한 | ✓ SATISFIED | Truth 2·21·22·26. respin `:138-206`, 가드·카운터 0, 405 로 GET 차단(WR-01). 배너 표면화 Truth 25·26. REQUIREMENTS.md Complete — 근거 실재 |
| SETT-04 | 04-01, 04-02, 04-04 | 마이그레이션 직후(기본값) 동작은 현재와 동일 — 11:55 추첨, 쿨다운 없음 | ✓ SATISFIED | Truth 4·12. `spinTime.test.ts` #16 + 기존 4건, `cooldown.test.ts` #1·#7, spin `:85-86,:170-172` 기본 경로 쿼리 0회. Node 프로브 15/15. REQUIREMENTS.md Complete — 근거 실재 |
| (SPIN-03 서버 반, 참고) | Phase 3 소관 | 후보 0개면 결과가 생기지 않는다 | ✓ SATISFIED | Truth 3. spin `:164-166` / respin `:160-162`. Phase 3 의 `stalled` UI 반과 합쳐 요구사항 문면 완성 |

**ORPHANED 없음.** REQUIREMENTS.md 가 Phase 4 에 매핑한 ID 는 SPIN-01·SPIN-04·SETT-04(`:146`)이고 SPIN-02 는 Traceability(`:112`)가 "Phase 3 → Phase 4 (Edge Function 배선에서 완료)" 로 지정 — 네 ID 전부 플랜 frontmatter 가 claim 했고(04-01 이 4개 전부) 코드 근거가 실재한다. `[x]`·Complete 전환은 이 페이즈 diff(`.planning/REQUIREMENTS.md` 16줄)에서 확인.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (수정 파일 12개 전수) | — | `TBD`·`FIXME`·`XXX`·`TODO`·`HACK`·`PLACEHOLDER`·`not yet implemented` | — | **0건** |
| 두 `index.ts` | — | `return null`·`return {}`·`return []`·`=> {}`·`as`·`any`·`restaurants[0]` | — | **0건**(주석 밖) |
| `04-VALIDATION.md` 본문 · `CONCERNS.md:195-196` | — | 리뷰 전 수치 잔존(`219 passed`·"계약 50건"·`console.error` 7/5) | ℹ️ Info | 코드와 문서의 시점 차이. CLAUDE.md:44-45 는 58건·8/6 으로 갱신됨. **gap 아님 — 문서 후속**(다음 문서 정정 시 함께) |
| `04-REVIEW.md` IN-01·05·06·07·11·12 | — | 미적용 6건(설계 재논의·도구 사각지대·범위 밖) | ℹ️ Info | 각 `처리:` 줄에 사유 기록됨. IN-05(블록 주석·문자열 내 `//`)·IN-06(`deno.json` 내용·lock 존재 단언 부재)은 현재 실해 0으로 실측됐고 다음에 계약을 손댈 때 함께 볼 항목 |

### Human Verification Required

**없음 — 이 페이즈에서 사람이 지금 확인할 수 있는 항목이 없다.** VALIDATION 의 Manual-Only 5행과 SUMMARY 의 미검증 6항목은 전부 "라이브에 새 테이블이 없고 함수가 배포되지 않아 **어느 환경에서도** 실행 불가" 한 것들이고, ROADMAP Phase 4 절이 "실제 호출 검증은 Phase 8 컷오버에서 `respin-roulette` 수동 invoke로 한다" 고 후속 페이즈를 명시하므로 Step 9b 기준으로 **Deferred**(위 표 1~5)에 넣었다. Phase 3 선례(`03-VERIFICATION.md` — SETT-02 브라우저 실증을 Phase 6·8 로 deferred, status passed)와 같은 처리다. PLAN 4개에 `<human-check>` 블록 0건.

Phase 8 SHIP-04 에서 사람이 볼 항목(참고, `wr-01-cutover-window.md` 7번이 정본):
1. **`respin-roulette` 수동 invoke** — 응답 `ok: true`, `menu` 가 실제 매장명, `restaurant_id` 가 uuid, `candidate_count` > 0, `excluded_count` 0. `menu` 가 비거나 `restaurant_id` 가 없으면 임베드 접기가 틀린 것.
2. **브라우저 "다시 돌리기" 실패 배너** — 함수가 보낸 문장이 뜨는지. 영어 고정 문구 "Edge Function returned a non-2xx status code" 면 500 에 CORS 가 빠진 것.
3. **대시보드 Edge Function Logs** 에 `console.error` 1건 도달 확인.
4. **`functions deploy` 출력**에 `fallback import map`/`deprecated import_map.json` 경고 부재.

### Disconfirmation Pass (Confirmation Bias Counter)

- **부분 충족 1건:** SC-4 의 "두 함수의 판정 결과가 … 동일함을 보이는 테스트" 는 함수 본문이 아니라 `_shared` 단위 + 계약 텍스트(#30·#31) 위에 서 있다. D-11(순수 조합 모듈을 `_shared` 에 두지 않음)·D-15(한계 명시)가 사용자 승인 결정이고, 함수 본문의 기본 경로(`:85-86,:170-172`)는 낭독 + 이 검증의 코드 인용으로 확인했다. VERIFIED 로 두되 한계를 Truth 4 에 적었다.
- **통과하지만 행위를 직접 보지 않는 테스트 1건:** #31 은 다섯 토큰의 **위치**만 보고 조건식 내용은 보지 않는다(SUMMARY 도 인정). 분기 내용은 이 검증에서 `:118-166` 를 직접 읽어 확인했다. #33/#44 도 키 **존재 1회**만 세며 "ok 응답 안에 무조건부" 인지는 `:216-226`/`:213-224` 낭독이 근거다.
- **테스트 없는 에러 경로:** `existErr`(`:132`)·`recentErr`(`:179`)·`catch`(`:227`)·405(`:103`) 는 텍스트 계약(#32 8건 정확 개수·#49)으로 존재만 고정되고 실행되지 않는다. 라이브 없이는 불가 — Deferred 1.
- **Inversion(통과하고도 틀릴 수 있는 길 3가지):** (a) PostgREST 임베드가 배열·객체·`null` 어느 것으로 와도 `normalizeCandidates` 가 같은 값에 도달함을 deno 프로브로 확인 — 남는 위험은 "예상 밖 네 번째 형태" 뿐이고 그때는 `excluded_count` 로 응답에 드러난다. (b) `settings.spin_time` 이 `"11:55:00"` 로 오면 `parseSpinTime` 이 받음(프로브), 아니면 `settings_fallback` 폴백 — 추첨은 멈추지 않는다. (c) `cooldown_days` 가 `null`/문자열이면 `Number()` → NaN → `cooldownWindowStart` 가 `null` 창(프로브) — 쿨다운만 꺼진다. 세 경로 모두 Core Value(매일 하나 확정)를 깨지 않는다.

### Gaps Summary

갭 없음. 페이즈 목표 — "두 Edge Function 이 새 스키마·`settings`·쿨다운 위에서 결과를 확정하도록 재작성, 배포는 하지 않음" — 이 코드베이스에서 성립한다. 두 `index.ts` 는 `candidates`⋈`restaurants` 조인·`settings` 단일행·`_shared/cooldown.ts` 위에서 돌고 `results` 에 매장명 스냅샷 + `restaurant_id` 를 쓰며, `from("menus")` 0건·하드코딩 시각 0건·`as`/`any` 0건이다. `spin-roulette` 는 `settings.spin_time` 판정 → 멱등 → 후보 → 쿨다운 → insert(23505 정상 경로) 순서를 지키고 후보 0개면 행을 만들지 않는다. `respin-roulette` 는 같은 조회 위에서 `upsert(onConflict: "date")` 로 무제한 덮어쓰며 CORS·OPTIONS·POST 검사·`json()` 통일을 갖췄다. `deno check` 게이트(`npm run check:edge`)가 exit 0 이고 `verify_jwt = false` 는 무변경이다. 234건 스위트(Phase 1~3 189건 회귀 없음 + 신규 45건)가 진짜 RED(22건, 스크래치 재실행으로 실증)에서 GREEN 이 됐고, 리뷰 후 수정 10커밋은 플랜 must_haves·D-01~D-18 을 하나도 깨지 않았다. 배포·실호출·브라우저 배너·대시보드 로그는 이 페이즈의 명시적 범위 밖이자 ROADMAP 이 Phase 8 로 지정한 항목이라 Deferred 8건으로 기록했고, 문서의 리뷰 전 수치 잔존은 Info 다.

---

_Verified: 2026-09-28T08:25:10Z_
_Verifier: Claude (gsd-verifier)_
