---
phase: 04-server-spin
plan: 01
subsystem: testing
tags: [deno, deno-check, vitest, contract-test, edge-functions, supabase, typescript]

# Dependency graph
requires:
  - phase: 02-data-model
    provides: "0005 마이그레이션의 candidates·restaurants·settings 스키마와 results.restaurant_id — 계약 테스트가 단언하는 조회 문자열의 출처"
  - phase: 03-pure-logic
    provides: "_shared/{kst,spinTime,cooldown}.ts 순수 모듈과 edgeImports.test.ts 계약 24건 + 헬퍼 4개(readOrEmpty·stripAfter/stripComments·count)"
provides:
  - "npm run check:edge — 두 index.ts 를 deno check 로 검사하는 정적 게이트 (레포 검증 명령 4종 → 5종)"
  - "supabase/functions/deno.json(한 키) · deno.lock(276줄 생성물) — 배포 경로 밖 로컬 전용 설정"
  - "ResultRow.candidates = { name: string; restaurant_id?: string }[] — Phase 4 스냅샷 형태"
  - "edgeImports.test.ts 50건 (기존 24 보존 + 신규 26) 중 적색 22건 — 04-02·04-03 의 GREEN 목표"
  - "spinTime.test.ts #16 — 텍스트/값 기본 상수 왕복 회귀 핀 (SETT-04 5항목의 마지막 1건)"
affects: [04-02-spin-rewrite, 04-03-respin-rewrite, 04-04-docs, 08-cutover]

# Tech tracking
tech-stack:
  added: ["deno 2.9.7 (Homebrew, npm 밖 외부 도구 — 신규 npm 패키지 0개)"]
  patterns:
    - "deno 설정 파일은 supabase/functions/ 한 단계 위에만 둔다 (함수 디렉터리 안은 배포 import map 으로 채택됨)"
    - "설정 파일의 위치 자체를 existsSync 배열 단언으로 계약화한다"
    - "개수가 아니라 순서를 묻는 단언은 indexOf 위치 비교로 쓴다 (count 헬퍼로 표현 불가)"

key-files:
  created:
    - supabase/functions/deno.json
    - supabase/functions/deno.lock
  modified:
    - package.json
    - lib/supabase/client.ts
    - supabase/functions/_shared/edgeImports.test.ts
    - supabase/functions/_shared/spinTime.test.ts

key-decisions:
  - "deno 설정을 supabase/functions/deno.json(호출 형태 b)에 두고 --config 로 넘긴다 — --node-modules-dir=none 단독은 루트 deno.lock 에 npm 의존성 13개를 workspace.packageJson 으로 박는다"
  - "deno.lock 은 커밋하되 --frozen 은 스크립트에 넣지 않는다 — 드리프트 감지기는 git status 다"
  - "ResultRow.candidates 확장은 chore 로 커밋한다 — 타입 확장은 동작 변경이 아니고, test(04-01) 앞에 feat(04-01) 이 있으면 TDD 게이트 점검이 헷갈린다"
  - "요구사항(SPIN-01·02·04·SETT-04) 완료 마킹은 이 플랜에서 하지 않는다 — Phase 2 선례(검증을 닫는 플랜 하나만 마킹)를 따라 04-03/04-04 가 찍는다"

patterns-established:
  - "정적 게이트 우선: 함수 본문을 쓰기 전에 deno check 를 먼저 켠다 (Phase 3 D-12 좁히기를 첫 커밋으로 올린 것과 같은 순서)"
  - "RED 가 플랜을 가로지른다: 04-01 이 22건을 세우고 04-02 가 12건, 04-03 이 10건을 닫는다"
  - "RED 커밋에서도 deno check·tsc·lint 는 초록이다 — 빨간 것은 vitest 뿐 (D-16)"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-09-28
---

# Phase 4 Plan 01: 정적 게이트 + 스냅샷 타입 + 계약 RED Summary

**`npm run check:edge`(deno check) 정적 게이트 신설 + `ResultRow.candidates` 스냅샷 타입 확장 + `edgeImports.test.ts` 26건 확장으로 04-02·04-03 이 닫을 적색 22건을 세웠다**

## Performance

- **Duration:** 4min 9s
- **Started:** 2026-09-28T06:56:21Z
- **Completed:** 2026-09-28T07:00:30Z
- **Tasks:** 3/3
- **Files modified:** 6 (신규 2 + 수정 4)

## Accomplishments

- **정적 게이트가 켜졌다.** `npm run check:edge` 한 줄이 두 `index.ts` 를 `deno check --config supabase/functions/deno.json` 으로 검사한다. Phase 1 이후 처음으로 두 Edge Function 본문이 자동 타입 검사를 받는다 — 레포 검증 명령이 4종에서 5종이 됐다.
- **설정 파일의 위치가 계약이 됐다.** `deno.json` 은 `supabase/functions/` 한 단계 위에만 있고, 함수 디렉터리 2개에는 `index.ts` 뿐이다. 계약 #48 이 `existsSync` 7원소 배열로 이 배치를 고정한다 — 이 사고(배포 import map 승격)는 Phase 8 배포 전까지 조용하므로 텍스트 계약이 유일한 조기 경보다.
- **스냅샷 타입이 함수보다 먼저 넓어졌다.** `ResultRow.candidates` 가 `{ name: string; restaurant_id?: string }[]` 이고 소비처 무변경으로 `tsc` exit 0 — 확장이 하위호환임이 증명됐다.
- **적색 22건이 정확히 예상대로 섰다.** 플래너 예측(22 failed | 28 passed)과 실측이 단언 번호까지 일치한다.

## Task Commits

1. **Task 1 (Wave 0): `npm run check:edge` 정적 게이트 신설 (D-01·D-02)** — `6ba60ad` (chore)
   - `package.json` · `supabase/functions/deno.json` · `supabase/functions/deno.lock`
2. **Task 2 (Wave 0): `ResultRow.candidates` 확장 (D-08)** — `61186fb` (chore)
   - `lib/supabase/client.ts`
3. **Task 3 (RED): 계약 26건 + 왕복 1건 (D-14·D-15)** — `a39265b` (test)
   - `supabase/functions/_shared/edgeImports.test.ts` · `supabase/functions/_shared/spinTime.test.ts`

각 커밋 모두 `git log -1 --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**, `git show --name-only` 에 `.serena/project.yml`·`.planning/config.json` **0건**, 파일 삭제 **0건**.

## Files Created/Modified

- `supabase/functions/deno.json` (신규, 1줄) — `{ "nodeModulesDir": "none" }` 한 키. `compilerOptions`·`imports` 0건. JSON 은 주석을 못 받으므로 Why 는 04-04 의 CLAUDE.md 한 줄이 진다.
- `supabase/functions/deno.lock` (신규, 생성물 **276줄**) — `"version": "5"`, `jsr:@supabase/supabase-js@2` → `2.117.2` 로 해석 고정. `workspace.packageJson` 섹션 **0건**(= 루트 `package.json` 의존성 13개가 박히지 않은 (b) 형태라는 증거).
- `package.json` — `scripts` 에 `check:edge` 한 줄 추가(`lint` 다음, `test` 앞). `dependencies`·`devDependencies` 무변경 → `git diff --stat -- package-lock.json` **출력 0줄**.
- `lib/supabase/client.ts` — `candidates` 1줄 + 필드 옆 한글 주석.
- `supabase/functions/_shared/edgeImports.test.ts` — 164줄 → **348줄**, `it(` 24 → **50**. `existsSync` 를 `node:fs` import 에 추가(레포 최초 사용).
- `supabase/functions/_shared/spinTime.test.ts` — `it(` 15 → **16**.

## 검증 수치 (명령 출력 기준, 추정 없음)

### Task 1 — `check:edge` 게이트

| 항목 | 명령 | 결과 |
|---|---|---|
| 최초 실행 | `npm run check:edge` | **exit 0**, 출력 없음(에러 0), `0.279 total` (deno 전역 캐시 적중 — 리서치 프로브가 이미 jsr 을 받아 둔 상태였다. 플래너 실측 0.47s 와 같은 수준) |
| lock 줄 수 | `wc -l supabase/functions/deno.lock` | **276** |
| lock 형태 | `grep -c 'packageJson' …/deno.lock` | **0** |
| lock 내용 | `grep -c 'jsr:@supabase/supabase-js' …/deno.lock` | **1** |
| 루트 lock 부재 | `test -f deno.lock` | **exit 1** (ABSENT) — `git status --porcelain` 에도 루트 `deno.lock` 항목 없음 |
| lock 멱등 | 2회차 실행 전후 `shasum` | 동일(`67f93c92…`), 커밋 후 `git status --porcelain -- supabase/functions/deno.lock` **0줄** |
| 함수 디렉터리 | `ls supabase/functions/{,re}spin-roulette \| wc -l` | **1 / 1** |
| 스크립트 | `grep -c '"check:edge"' package.json` / `grep -c 'deno check --config supabase/functions/deno.json'` | **1 / 1** |
| 설정 키 | `nodeModulesDir` / `compilerOptions` / `imports` | **1 / 0 / 0** |
| 의존성 무변경 | `git diff --stat -- package-lock.json` | **0줄** |
| 함수·설정 무변경 | `git diff --stat -- 두 index.ts tsconfig.json eslint.config.mjs vitest.config.mts` | **0줄** |

**루트 `deno.lock` 부재 확인 방법:** `--config supabase/functions/deno.json` 형태는 lock 을 config 옆에 만든다. 매 태스크 커밋 직전에 (a) `test -f deno.lock` 이 exit 1 인지, (b) `git status --porcelain` 에 `supabase/functions/deno.lock` 외의 lock 항목이 없는지 두 가지로 봤다. 세 태스크 전부 통과. (`--node-modules-dir=none` 만 주고 `--lock` 을 빼면 루트에 생긴다 — 그때는 `.gitignore` 가 아니라 명령을 고친다.)

### Task 2 — `ResultRow` 확장이 소비처를 깨지 않았다

| 증거 | 결과 |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `git diff --stat -- components/CalendarLog.tsx app/page.tsx app/log/page.tsx app/rank/page.tsx` | **출력 0줄** |
| `grep -c 'restaurant_id?: string'` | **1** |
| `grep -c 'candidates: { name: string }\[\]'` (낡은 형태) | **0** |
| `grep -c 'restaurant_id?: string \| undefined'` | **0** (레포 관례대로 `?` 표기) |
| `grep -c 'Phase 4'` | **1** (`?` 의 이유가 주석에 남았다) |

소비처 `components/CalendarLog.tsx:223,248,251` 은 `c.name` 과 `length` 만 읽으므로 optional 키 추가가 하위호환이다. `tsc` exit 0 + 소비처 diff 0줄이 그 증명이다.

### Task 3 — RED 내역 (단언 번호별)

`npx vitest run supabase/functions/_shared/edgeImports.test.ts` → **exit 1**, `Tests  22 failed | 28 passed (50)`. `grep -c 'Failed to load'` → **0** (전부 단언 실패이지 수집 실패가 아니다).

**예상치와 실측이 완전히 일치한다.** 플랜 `<interfaces>` 의 RED 예상치 도출(신규 26건 중 #42·#45·#46·#48 이 이미 초록 → 적색 22)이 단언 번호 단위까지 맞았다. 차이 0건.

| # | 대상 | 단언 | 상태 | 실패 메시지 요약 |
|---|---|---|---|---|
| #23 | spin | 후보 소스 교체 `[menus 0, candidates 1]` | 🔴 | `expected [ 1, +0 ] to deeply equal [ +0, 1 ]` |
| #24 | spin | 매장 임베드 정규식 1회 | 🔴 | `expected +0 to be 1` |
| #25 | spin | `from("settings")` 1회 | 🔴 | `expected +0 to be 1` |
| #26 | spin | `from("results")` 3회 (멱등·쿨다운·기록) | 🔴 | `expected 2 to be 3` |
| #27 | spin | `restaurant_id: winner.restaurant_id` 2회 | 🔴 | `expected +0 to be 2` |
| #28 | spin | 쿨다운 3원소 `[import, 창, 필터]` | 🔴 | `expected [ +0, +0, +0 ] to deeply equal [ 1, 1, 1 ]` |
| #29 | spin | jsr 핀 양방향 `[2.117.2 1, 비핀 0]` | 🔴 | `expected [ +0, 1 ] to deeply equal [ 1, +0 ]` |
| #30 | spin | `parseSpinTime(` 1 · `DEFAULT_SPIN_TIME\b` ≥1 | 🔴 | `expected [ +0, true ] to deeply equal [ 1, true ]` |
| #31 | spin | D-05 순서 불변식 (indexOf 5지점) | 🔴 | `expected [ false, false ] to deeply equal [ true, true ]` |
| #32 | spin | `console.error(` > 4 | 🔴 | `expected 0 to be greater than 4` |
| #33 | spin | 폴백 플래그 3키 각 1 | 🔴 | `expected [ +0, +0, +0 ] to deeply equal [ 1, 1, 1 ]` |
| #34 | spin | 맨 `new Response(` 1 · `function json(` 1 | 🔴 | `expected [ 7, +0 ] to deeply equal [ 1, 1 ]` |
| #35 | respin | 후보 소스 교체 | 🔴 | `expected [ 1, +0 ] to deeply equal [ +0, 1 ]` |
| #36 | respin | 매장 임베드 정규식 1회 | 🔴 | `expected +0 to be 1` |
| #37 | respin | `from("settings")` 1회 | 🔴 | `expected +0 to be 1` |
| #38 | respin | `from("results")` 2회 (쿨다운·덮어쓰기) | 🔴 | `expected 1 to be 2` |
| #39 | respin | `restaurant_id: winner.restaurant_id` 2회 | 🔴 | `expected +0 to be 2` |
| #40 | respin | 쿨다운 3원소 | 🔴 | `expected [ +0, +0, +0 ] to deeply equal [ 1, 1, 1 ]` |
| #41 | respin | jsr 핀 양방향 | 🔴 | `expected [ +0, 1 ] to deeply equal [ 1, +0 ]` |
| #42 | respin | 시간 가드 부재 `[parseSpinTime 0, DEFAULT_SPIN_TIME 0]` | 🟢 | — (현행 코드로 이미 참, #17 의 연장) |
| #43 | respin | `console.error(` > 3 | 🔴 | `expected 0 to be greater than 3` |
| #44 | respin | 폴백 플래그 3키 각 1 | 🔴 | `expected [ +0, +0, +0 ] to deeply equal [ 1, 1, 1 ]` |
| #45 | respin | `new Response(` 2 · `function json(` 1 | 🟢 | — (CORS 헬퍼 + OPTIONS 단락이 이미 그 형태) |
| #46 | respin | `.upsert(` 1 · `onConflict: "date"` 1 (stripped) | 🟢 | — (주석 제거 사본에서 세어 1/1) |
| #47 | 양쪽 | `function normalizeCandidates(` `[1, 1]` | 🔴 | `expected [ +0, +0 ] to deeply equal [ 1, 1 ]` |
| #48 | 설정 위치 | `existsSync` 7원소 (부재 6 + 존재 1) | 🟢 | — (Task 1 이 배치를 만든 뒤 참) |

**기존 #1~#22 (24건) 전부 초록 유지** — 한 건도 지우거나 고치지 않았다 (`grep -c '(#22)'` → 1 로 마지막 단언 보존 확인).

`spinTime.test.ts` → **exit 0**, `Tests  16 passed (16)`. #16 은 현행 코드로 통과하는 **회귀 핀**이지 RED 가 아니다.

### 세 커밋 공통 게이트

| 명령 | Task 1 | Task 2 | Task 3 |
|---|---|---|---|
| `npm run check:edge` | exit **0** | exit **0** | exit **0** |
| `npx tsc --noEmit` | exit **0** | exit **0** | exit **0** |
| `npm run lint` | exit **0** | exit **0** | exit **0** |
| `npm test` | exit 0 · `10 passed (10)` / `189 passed (189)` | exit 0 · 동일 | exit **1** · `Test Files 1 failed \| 9 passed (10)` · `Tests 22 failed \| 194 passed (216)` |

**D-16 준수:** RED 커밋(`a39265b`)에서도 `check:edge` 는 exit 0 이다. 빨간 것은 vitest 뿐이고 타입이 깨진 함수는 커밋되지 않았다.

### 기타 인수 조건

| 항목 | 결과 |
|---|---|
| `grep -cE '^[[:space:]]*it\(' edgeImports.test.ts` | **50** |
| `grep -cE '^[[:space:]]*it\(' spinTime.test.ts` | **16** |
| `grep -c '(#48)'` / `grep -c '(#16)'` / `grep -c '(#22)'` | **1 / 1 / 1** |
| `grep -c 'existsSync' edgeImports.test.ts` | **8** (import 1 + #48 의 7회) |
| `grep -c 'toMatch\|describe.each'` | **0** |
| `grep -c 'indexOf'` | **7** (`stripAfter` 1 + #31 의 5 + 주석 1) |
| `git diff --stat -- 두 index.ts vitest.config.mts` | **0줄** |
| TDD 게이트 | `git log --oneline --grep='^test(04-01)'` → `a39265b` |

## TDD Gate Compliance

이 플랜은 **RED 전용**이다. `feat(04-01)` 커밋이 존재하지 않으며 그것이 의도다 — 타입 확장(Task 2)은 동작 변경이 아니라 `chore` 로 커밋했고, `test(04-01)` 앞에 `feat(04-01)` 이 있으면 게이트 점검이 헷갈린다.

- **RED 게이트:** `a39265b` `test(04-01): extend edge contract for new schema, settings and cooldown` ✓
- **GREEN 게이트:** 이 플랜에 **없다.** `feat(04-02)`(spin-roulette 재작성)·`feat(04-03)`(respin-roulette 재작성)이 닫는다.
- **REFACTOR 게이트:** 해당 없음.

**적색 22건의 분배 (다음 플랜의 완료 조건):**

| 닫는 플랜 | 건수 | 단언 번호 |
|---|---|---|
| **04-02** (`spin-roulette` 재작성) | **12** | #23 #24 #25 #26 #27 #28 #29 #30 #31 #32 #33 #34 |
| **04-03** (`respin-roulette` 재작성) | **10** | #35 #36 #37 #38 #39 #40 #41 #43 #44 **#47** |

⚠ **#47 은 04-03 몫이다.** `[count(spin, …), count(respin, …)]` 가 `[1, 1]` 이어야 하므로 04-02 가 `spin` 쪽에 `normalizeCandidates` 를 넣어도 `[1, 0]` 으로 여전히 적색이다 — respin 이 같은 이름의 헬퍼를 가져야 비로소 초록이 된다. **04-02 완료 시점의 기대 수치는 `Tests 10 failed | 40 passed (50)`** 이다(22 − 12 = 10).

## 검증의 한계 (D-15 가 명시를 요구한 것)

이 페이즈의 계약은 **형태만** 본다. 라이브에 `candidates`·`restaurants`·`settings` 가 없어 두 함수를 한 줄도 실행할 수 없으므로(컷오버 전), 검증 수단은 (1) 이 텍스트 계약 50건, (2) `deno check` 타입 통과, (3) 낭독 — 세 가지가 전부다.

자동 단언이 **닿지 않는** 지점:
- **임베드가 런타임에 객체로 오는가** (RESEARCH §Q-2b, 이 페이즈 최대 함정). 추론 타입은 배열이고 런타임은 객체다 — `deno check` 는 `row.restaurants[0].name` 을 통과시키고 런타임에 `undefined` 를 준다. #24·#36 은 조회 **문자열**이 있는지만 보고, 정규화 헬퍼의 **존재**는 #47 이 보지만 그 헬퍼가 옳게 접는지는 아무도 보지 않는다. → Phase 8 SHIP-04 의 `respin-roulette` 수동 invoke 에서만 드러난다.
- **분기 내용.** #31 은 다섯 토큰의 **순서**만 보고 조건식의 내용은 보지 않는다.
- **`deno check` 와 배포의 간극.** lock 은 로컬 해석만 고정하고 배포는 API 측 번들링이라 lock 을 읽지 않는다 — 그 간극을 메우는 것은 #29·#41 의 jsr 핀뿐이고, 핀 자체는 04-02·04-03 이 넣는다.

## Decisions Made

- **요구사항 완료 마킹을 이 플랜에서 하지 않았다.** 플랜 frontmatter 의 `requirements: [SPIN-01, SPIN-02, SPIN-04, SETT-04]` 는 이 플랜이 **RED 를 세우는** 요구사항이지 닫는 요구사항이 아니다. Phase 2 의 선례("요구사항 완료 마킹은 페이즈 안에서 검증을 닫는 플랜 하나만 한다 — 파일을 만든 02-02 가 아니라 사람 승인을 받은 02-03 이 찍었다")를 그대로 적용했다. `REQUIREMENTS.md` 무변경.
- **`deno.lock` 을 `.gitignore` 로 덮지 않았다.** 루트에 lock 이 생기는 경로는 명령 형태 실수 하나뿐이고, `.gitignore` 로 가리면 그 실수가 조용해진다. 드리프트 감지기는 `git status` 로 남겼다(D-02 그대로).

## Deviations from Plan

None - plan executed exactly as written.

플랜이 지정한 3태스크·3커밋·6파일·22 적색을 그대로 수행했다. 자동 수정(Rule 1~3) 0건, 아키텍처 질의(Rule 4) 0건. 금지 사항(두 `index.ts` 무변경, `npm install` 0회, 원격 Supabase 명령 0회, `git add -A` 0회, `.serena/project.yml`·`.planning/config.json` 미커밋) 전부 준수.

## Issues Encountered

None.

한 가지 기록할 관측: `npm run check:edge` 최초 실행이 `0.279s` 로 끝나고 `Check file:///…` 출력이 없었다. 이는 리서치 단계의 프로브가 deno 전역 캐시를 이미 채워 둔 결과이고, exit 0 + `deno.lock` 276줄 생성으로 실제 검사가 수행됐음이 확인된다. 캐시가 빈 환경(CI·새 머신)에서는 jsr 다운로드만큼 더 걸린다.

## User Setup Required

None - no external service configuration required.

⚠ 단, **로컬에 `deno` 가 설치돼 있어야 `npm run check:edge` 가 돈다.** 이 레포는 `deno 2.9.7`(Homebrew, `/opt/homebrew/bin/deno`)을 전제한다. npm 의존성이 아니므로 `npm ci` 로는 따라오지 않는다 — 04-04(D-17)가 CLAUDE.md 에 이 전제를 적는다.

## Next Phase Readiness

**04-02(`spin-roulette` 재작성)가 바로 시작 가능하다.** 필요한 것이 전부 서 있다:
- 정적 게이트(`npm run check:edge`)가 켜져 있어 재작성 중 타입 사각지대가 없다.
- `ResultRow.candidates` 가 새 스냅샷 형태를 인정한다.
- 닫아야 할 적색 12건(#23~#34)이 단언 번호로 특정돼 있다.

**04-02 가 반드시 지킬 것:**
- 로컬 타입 이름을 **`KstParts` 로 쓰지 않는다** — #13(`type KstParts` 0건)이 적색이 된다. `Candidate`·`SettingsLike` 류로 짓는다.
- `const SPIN_HH`/`const SPIN_MM`(#12) · `hour12`(#14) 는 재작성 후에도 0이어야 한다.
- jsr 핀(`@2.117.2`) 교체는 **`supabase/functions/deno.lock` 이 함께 바뀌는 유일한 지점**이다 — 같은 커밋에 포함한다. 그 외 태스크에서 lock 이 바뀌면 멈추고 원인을 찾는다.
- 재작성 후 기대 수치: `Tests 10 failed | 40 passed (50)`, `npm run check:edge` exit 0.

**블로커:** 없음.

## Self-Check: PASSED

파일 7개(`supabase/functions/deno.json`·`deno.lock`·`package.json`·`lib/supabase/client.ts`·`_shared/edgeImports.test.ts`·`_shared/spinTime.test.ts`·이 SUMMARY) 전부 디스크에 존재. 커밋 4개(`6ba60ad`·`61186fb`·`a39265b`·`7373120`) 전부 `git log` 에서 확인. 누락 0건.

---
*Phase: 04-server-spin*
*Plan: 01*
*Completed: 2026-09-28*
