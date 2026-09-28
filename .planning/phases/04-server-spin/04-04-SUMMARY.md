---
phase: 04-server-spin
plan: 04
subsystem: docs
tags: [documentation, validation, deno-check, cutover-checklist, phase-gate, npm-audit]

# Dependency graph
requires:
  - phase: 04-server-spin
    plan: 01
    provides: "npm run check:edge 정적 게이트 — 이 플랜이 문서에 적는 '사각지대 해소' 의 실물"
  - phase: 04-server-spin
    plan: 02
    provides: "spin-roulette 재작성 + console.error 7지점 — CLAUDE.md·CONCERNS.md 정정문의 근거"
  - phase: 04-server-spin
    plan: 03
    provides: "respin-roulette 재작성 + 계약 50건 GREEN — VALIDATION 의 혼합 행을 닫을 수 있게 된 조건"
provides:
  - "CLAUDE.md — 검증 명령 5종 + 두 Edge Function 현행 설명(미배포 사실 포함) + console.error 규약 + deno.json/lock 위치·버전 갱신 절차"
  - "CONVENTIONS.md·CONCERNS.md — '타입체크 사각지대'·'console.* 0건'·'kstNow 복붙'·'menus 스키마 가정' 4개 낡은 진술의 현행화"
  - "wr-01-cutover-window.md 7번 — 임베드 배열/객체 함정을 컷오버 직후 수동 invoke 로 확인하는 항목(이 페이즈 최대 함정의 마지막 방어)"
  - "04-VALIDATION.md status: complete · nyquist_compliant: true — Per-Task 맵 20행 판정 완료, manual-only 1행은 초록으로 칠하지 않음"
  - "supabase/functions/deno.lock 276줄 — 미참조 비핀 명세자 제거(재생성)"
affects: [05-restaurant-tab, 06-today-tab, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "코드를 바꾼 페이즈가 그 코드에 관한 낡은 진술을 같은 페이즈에서 정정한다(D-17) — 다음 페이즈로 넘기면 Phase 3 → CONVENTIONS:282 처럼 살아남는다"
    - "생성물(lock)은 손편집 대신 삭제 후 재생성하고 diff 가 기대와 한 줄이라도 다르면 되돌린다"
    - "VALIDATION 의 '판정 완료' 와 '전부 초록' 을 다른 표식으로 분리한다(📋 manual-only)"

key-files:
  created:
    - .planning/phases/04-server-spin/04-04-SUMMARY.md
  modified:
    - CLAUDE.md
    - .planning/codebase/CONVENTIONS.md
    - .planning/codebase/CONCERNS.md
    - supabase/functions/_shared/edgeImports.test.ts
    - .planning/todos/pending/wr-01-cutover-window.md
    - supabase/functions/deno.lock
    - .planning/phases/04-server-spin/04-VALIDATION.md
  deleted: []

key-decisions:
  - "deno.lock 의 비핀 @2 명세자 줄은 손편집이 아니라 삭제 후 재생성으로 지웠다 — deno check 는 명세자를 추가만 하고 정리하지 않으며, lock 은 생성물이라 손으로 고치면 다음 deno 명령과 갈린다"
  - "Manual-Only 항목은 ⬜ pending 을 비우되 ✅ 로 칠하지 않고 📋 manual-only 로 판정했다 — 거짓 초록이 재검증 비용을 숨긴다(T-04-22). 범례를 한 칸 넓혔다"
  - "요구사항 마킹(SPIN-01·SPIN-02·SPIN-04·SETT-04)을 이 플랜이 한 번에 찍었다 — Phase 2 선례(검증을 닫는 플랜 하나만 마킹)이고 04-01·04-03 이 같은 근거로 미뤘다. 태스크 커밋이 아니라 최종 메타데이터 커밋에 넣어 플랜의 '태스크에서 REQUIREMENTS 금지' 도 지켰다"
  - "CONVENTIONS.md 의 jsr 예시(@2 비핀)를 @2.117.2 로 함께 고쳤다(플랜 지정 3건 밖의 +1) — D-02 핀을 되돌리게 만드는 진술이라 T-04-21 의 정확한 벡터다"

patterns-established:
  - "문서 정정 태스크의 인수 조건은 '없어야 할 문자열 0건' + '있어야 할 문자열 N건' 쌍으로 고정한다 — 문장을 다시 쓰고도 사실이 안 바뀌는 실패를 막는다"
  - "페이즈 마지막 플랜이 STATE 의 사실 오류(Pending Todos)까지 함께 정정한다"

requirements-completed: [SPIN-01, SPIN-02, SPIN-04, SETT-04]

# Metrics
duration: 9min
completed: 2026-09-28
---

# Phase 4 Plan 04: 문서 정정 · VALIDATION 마감 · 페이즈 게이트 Summary

**이 페이즈가 뒤집은 두 사실("Edge Function 은 정적 검사 사각지대다", "레포에 `console.*` 이 0건이다")을 문서 4곳에서 정정하고, 임베드 함정 확인 항목을 Phase 8 체크리스트에 심었으며, `04-VALIDATION.md` 를 `status: complete` · `nyquist_compliant: true` 로 닫았다 — 게이트 5종 전부 exit 0, `npm audit` 0건, 미의도 변경 0**

## Performance

- **Duration:** 9min (07:32:54Z 시작 → 07:41Z 문서 완료)
- **Tasks:** 2/2 (+ 오케스트레이터 승인 이탈 1건)
- **Files modified:** 7 (문서 4 + todo 1 + VALIDATION 1 + lock 1) — 코드 동작 변경 **0줄**

## Accomplishments

- **낡은 진술 11건이 현재 사실로 바뀌었다.** 정정한 문장은 전부 이 페이즈가 직접 뒤집은 것들이고, 각 정정은 "없어야 할 문자열 0건 + 있어야 할 문자열 N건" grep 쌍으로 고정됐다(아래 표).
- **이 페이즈 최대 함정의 마지막 방어가 들어갔다.** `wr-01-cutover-window.md` **7번** — 컷오버 직후 `respin-roulette` 수동 invoke 로 `menu` 가 실제 매장명인지, `restaurant_id` 가 uuid 인지 확인. 임베드가 배열로 오느냐 객체로 오느냐는 `deno check` 도 계약 50건도 못 잡고 첫 실호출에서만 드러난다(T-04-11). 같은 사실을 `CONCERNS.md` 항목 5에도 남겨 근거를 이중화했다.
- **문서에 이 페이즈가 하지 않은 일을 적지 않았다.** `CLAUDE.md:16` 에 "**두 함수 모두 아직 배포되지 않았다** — 라이브에는 구 코드(메뉴 기반)가 돌고 `candidates`·`restaurants`·`settings` 도 라이브에 없다" 를 **명시적으로** 적었다. 클라이언트의 `menus` 직접 SELECT 는 Phase 6 까지 사실이라 그대로 뒀고(절반만 정정), `README.md`·`config.toml`·`:5`·`:47` 의 "11:55" 는 건드리지 않았다.
- **`deno.lock` 의 잔존 줄이 정리됐다.** 04-03 이 보고한 미참조 명세자(`jsr:@supabase/supabase-js@2`)를 재생성으로 제거해 277 → **276줄**. diff 는 정확히 `1 deletion(-)`.
- **`04-VALIDATION.md` 가 닫혔다.** Per-Task 맵 20행 전부 판정(⬜ 0), Wave 0 5항목 완료, Sign-Off 6항목을 실측 근거와 함께 만족 → `nyquist_compliant: true`. `Approval` 은 `pending` 유지(승인은 오케스트레이터/사용자 몫).
- **요구사항 4건이 Complete 로 찍혔다** — SPIN-01 · SPIN-02 · SPIN-04 · SETT-04. 체크박스와 Traceability 행 양쪽 반영.

## Task Commits

1. **Task 1: D-17 문서 정정 4파일 + todo `wr-01`** — `ea6c5cb` (docs, **5 files**)
   - `CLAUDE.md` · `.planning/codebase/CONVENTIONS.md` · `.planning/codebase/CONCERNS.md` · `supabase/functions/_shared/edgeImports.test.ts` · `.planning/todos/pending/wr-01-cutover-window.md`
2. **(승인 이탈) `deno.lock` 재생성** — `3d460fb` (chore, **1 file**)
3. **Task 2: `04-VALIDATION.md` 마감** — `3c3710e` (docs, **1 file**)

세 커밋 모두 `git log -1 --format=%B | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**. `.serena/project.yml`·`.planning/config.json` 은 세 커밋 어디에도 없다(끝까지 dirty). 삭제된 파일 0건.

## 정정 항목 — 파일:줄 인용과 grep 증거

### `CLAUDE.md` (정정 4 + 추가 4)

| # | 위치(정정 전) | 무엇을 바꿨나 |
|---|---|---|
| 정정 1 | `:16` | "pg_cron이 11:55에 호출 (시간 가드 + 멱등)" → **매분 폴링 + `settings.spin_time` 판정**, 후보는 `candidates` → `restaurants` 조인, `_shared/cooldown.ts` 필터, 결과에 매장명 스냅샷 + `restaurant_id`. respin 은 "가드 없음, upsert" 를 유지하되 `onConflict: "date"` 와 **컷오버 전 유일한 수동 검증 창**이라는 사실을 덧붙였다. 끝에 **미배포 경고** |
| 정정 2 | `:18` | 흐름 문단의 **서버 쪽만** — `pg_cron 매분 → Edge Function → candidates⋈restaurants 조회 → results 쓰기`. 클라이언트의 `menus` 직접 SELECT 는 Phase 6 까지 사실이라 유지하고 괄호로 "후보 소스를 `candidates` 로 바꾸는 것은 Phase 6" 만 붙였다 |
| 정정 3 | `:22-27` | 검증 명령 블록 **4줄 → 5줄** (`npm run check:edge # deno check 두 Edge Function (index.ts 의 유일한 정적 검사)`) |
| 정정 4 | `:41` | "두 `index.ts` 본문은 **여전히 사각지대** … 낭독으로만 검증" → "`deno check`(`npm run check:edge`)가 **타입**을, 계약 50건이 **형태**를 본다. 둘은 서로를 대체하지 않는다. eslint 는 여전히 못 보고 **남는 사각지대는 동작**(실호출은 컷오버 전 불가)" |
| 추가 1 | 코드 컨벤션 | D-10 — Edge Function 의 500·폴백 경로는 `console.error`(현재 spin **7지점**·respin **5지점**). `app/`·`lib/` 에는 넣지 않는다(배너가 채널). `details`·`hint` 미탑재 |
| 추가 2 | 비표준 규약·함정 | D-01·D-02 — `supabase/functions/deno.json`·`deno.lock` 은 로컬 `check:edge` 전용(배포 미참조), 함수 디렉터리 안 `deno.json` 금지(배포 import map 승격), supabase-js 버전 상승 시 두 `index.ts` 핀 + lock 동시 갱신, 루트 lock 이 생기면 명령을 고친다 |
| 추가 3 | 검증 명령 절 | **04-01 인계** — `deno`(2.9.7, Homebrew)는 npm 밖 외부 도구라 `npm ci` 로 따라오지 않는다는 전제 |
| 추가 4 | 비표준 규약·함정 | **오케스트레이터 관측** — 에디터가 `_shared/*.test.ts` 의 확장자 없는 import 를 "Cannot find module" 로 띄우는 현상(VS Code Deno 확장이 `deno.json` 하위를 Deno 영역으로 켜는 것으로 **추정**). tsc·vitest exit 0 이라 게이트 무관, `deno.json` 위치는 계약이라 옮기지 않음 |

grep 실측: `npm run check:edge` **2**(≥2) · `여전히 사각지대` **0** · `candidates` **3**(≥2) · `restaurant_id` **1** · `deno.json` **2** · `deno.lock` **1** · `import map` **1** · `배너` **3**(≥3) · 검증 블록 줄 수 `grep -cE '^npx tsc --noEmit|^npm run lint|^npm test|^npm run build|^npm run check:edge'` **5**.
`<!-- GSD:project-start -->`(`:74`) 이후 블록 무변경 — diff hunk 는 `@@ -16`·`-18`·`-26`·`-28`·`-41`·`-46` 여섯 개로 전부 그 앞이다.

### `supabase/functions/_shared/edgeImports.test.ts` (머리 주석 1건)

`:1-2` "deno 가 로컬에 없어 deno check 를 돌릴 수 없고 … 유일한 자동 회귀 장치" → "로컬 deno 2.9.7 + `npm run check:edge` 가 **타입**을, 이 spec 이 **형태**를 본다. 서로를 대체하지 않는다. 타입이 맞는지는 check:edge 가 보고 **그 코드가 실제로 도는지는 아무도 보지 않는다** — 실호출은 컷오버 전 불가".
`import` 줄 이하 **한 글자도 건드리지 않았다**: `grep -cE '^[[:space:]]*it\('` → **50**(무변경), `grep -c 'deno 가 로컬에 없어'` → **0**, `grep -c 'check:edge'` → **2**.

### `.planning/codebase/CONVENTIONS.md` (플랜 지정 3 + Rule 2 1)

| # | 위치 | 무엇을 바꿨나 |
|---|---|---|
| 1 | `:281` | "tsconfig·eslint 에서 제외돼 있어 **타입체크·lint가 돌지 않는다**" → "`deno check`(`npm run check:edge`)가 타입을 검사한다(`_shared/*.ts` 전이 포함). 제외는 **함수 디렉터리 2개뿐**이고 **eslint 는 여전히 못 본다**" |
| 2 | `:282` | **Phase 3 이 해결했는데 살아남은 진술** — "`kstNow()`가 두 함수에 **복붙돼 있다**(`…:17-35`, `…:37-55`)" → "공통 로직은 `_shared/{kst,spinTime,cooldown}.ts` 한 곳, 두 함수가 `../_shared/<name>.ts` 로 같은 파일을 본다. 남는 중복은 행 타입 선언뿐". **무효해진 줄 번호 인용 2개 삭제** |
| 3 | `:299-304` | 검증 명령 3줄 → **5줄**(`npm test`·`npm run check:edge` 추가, tsc 주석의 제외 범위도 현행화). 마지막 문장 "이 명령들이 검사하지 않으므로 별도 확인" → "Edge Function 은 `check:edge` + 계약, 마이그레이션은 `supabase/migrations/*.test.ts` 가 본다 — **남는 것은 실호출뿐**이고 그건 Phase 8" |
| +1 | `:275-279` | **플랜 지정 밖(Rule 2)** — jsr 예시가 `@supabase/supabase-js@2`(비핀)였다. D-02 가 두 `index.ts` 를 `@2.117.2` 로 핀했고 계약 #29·#41 이 비핀 토큰 0건을 단언하므로, 이 예시를 보고 핀을 되돌리는 것이 T-04-21 의 정확한 벡터다. 예시를 `@2.117.2` 로 고치고 "런타임 의존은 핀, 타입 전용 `edge-runtime.d.ts` 는 그대로" 한 줄을 붙였다 |

grep 실측: `타입체크·lint가 돌지 않는다` **0** · `복붙돼 있다` **0** · `check:edge` **3**(≥2) · `npm test` **1**(≥1).

### `.planning/codebase/CONCERNS.md` (3건)

| # | 위치 | 무엇을 바꿨나 |
|---|---|---|
| 1 | `:146-151` [P2] 로깅 | 제목 "핵심 경로에 로깅·알림이 **전혀** 없다" → "**로깅은 들어왔고 알림은 여전히 없다**". "코드 전체에 `console.*` 이 **0건**" 삭제 → spin 7지점·respin 5지점. Recommendations 에서 **이행된 권고를 빼고** 남은 것(`net._http_response` 점검·12:10 헬스체크, 둘 다 범위 밖)만 남겼으며 "대시보드 로그에 실제로 보이는지는 배포 후에만 확인" 을 명시 |
| 2 | `:191-196` [P1] → **[P2] 강등** | 제목 "Edge Function이 타입체크·lint 사각지대" → "**타입 검사 안으로 들어왔지만 한 줄도 실행된 적이 없다**". `deno check …` **수동 실행** → `npm run check:edge`(자동) + 계약 50건. "Test coverage: 0" → "텍스트 계약 50건 + 전이 타입 검사. **동작 0.**" 강등 근거를 본문에 적었다 |
| 3 | `:330-331` 스키마 가정 5 | "모두 `from(\"menus\").select(\"id, name\")` … **컴파일 에러 없이** 다음 11:55에 처음 터진다" → 재작성 사실 + "`check:edge` 가 타입 에러를 준다". **그 자리에 남긴 새 사실:** PostgREST 임베드가 배열이냐 객체냐는 정적 검사가 못 잡고(`row.restaurants[0].name` 은 통과 후 `undefined`), `Array.isArray` 접기가 옳은지는 **첫 실호출에서만** 드러난다 → `wr-01` 7번 |

grep 실측: `호출이 **0건**` **0** · `수동 실행` **0** · `from("menus")` **0** · `check:edge` **3**(≥2) · `임베드` **3**(≥2, 기존 `:137` 무관 항목 1 + 신규 2).

### `.planning/todos/pending/wr-01-cutover-window.md` (정정 1 + 추가 1)

- **4번 정정:** "`--no-verify-jwt` 필수(**config.toml 없음**)" → "`supabase/config.toml` 에 `verify_jwt = false` 가 고정돼 있으므로(**63fae89**) CLI 가 그 값을 읽는다 — `--no-verify-jwt` 병행은 **이중 안전**. config.toml 을 건드리거나 플래그를 빼지 말 것(true 로 배포되면 401 로 추첨이 조용히 멈춘다)" (T-04-13)
- **7번 추가:** 배포 직후 `respin-roulette` 수동 invoke → 응답의 `menu` 가 실제 **매장명 문자열**, `restaurant_id` 가 **uuid**(`ok: true`·`candidate_count > 0` 도 함께). 이유와 실패 판독법까지: 빈 문자열/누락이면 임베드 접기가 틀린 것이고 그 상태로 다음 추첨 시각을 넘기지 않는다 (T-04-11)

grep 실측: `config.toml 없음` **0** · `63fae89` **1** · `^7\. ` **1** · `restaurant_id` **1** · `resolves_phase: 8` **1** · `ls .planning/todos/pending | wc -l` → **6**.

## `04-VALIDATION.md` 마감 방식

- **Per-Task 맵:** `| ⬜ pending |` **13행 → 0행**. 12행은 `✅ green`(계약 50건 + 단위 219건 + 게이트 전부 초록), **1행은 `📋 manual-only`** — `04-03-T3` "`respin()` 배너에 함수 본문이 실리는가". 브라우저 + 배포된 함수 + 실제 500 응답 세 가지가 동시에 필요해 이 페이즈에서 확인할 방법이 없다. 범례에 `📋 manual-only(자동 단언이 없는 항목 — 초록으로 칠하지 않는다)` 를 한 칸 넓혔고 기존 범례 줄은 그대로 뒀다. `grep -cE '^\| 04-0[1-4]-T[0-9]'` → **20**(무변경).
- **04-02 중간 메모 갱신:** "계약 50건 중 10건 respin 대기" → 최종 판정(`50 passed (50)`, `219 passed (219)`)과 manual-only 1행의 의미를 함께 적었다.
- **Wave 0:** 5항목 전부 `[x]`. 마지막 1건(`lib/errors.test.ts` 3케이스)에 RED(`69ef0e4`) → GREEN(`ccb58c4`) 근거를 붙였다. `wave_0_complete: true` 는 04-02 가 설정한 값 그대로(확인만).
- **Manual-Only 표:** 5행 **그대로 유지**(전부 Phase 6·8). 낭독 행에 실제 기록 위치를 덧붙였다 — `04-02-SUMMARY.md:174` · `04-03-SUMMARY.md:204`.
- **Sign-Off 6항목** (근거는 아래 §nyquist) → 전부 `[x]`, `nyquist_compliant: false → true`. `status: draft → complete`, **`Approval: pending` 유지**.

### `nyquist_compliant` 를 어떻게 판정했는가 (6항목)

| 항목 | 판정 | 근거(실측) |
|---|---|---|
| All tasks have `<automated>` verify | ✅ | `grep -c '<task type='` vs `grep -c '<automated>'` — 04-01 **3/3** · 04-02 **2/2** · 04-03 **3/3** · 04-04 **2/2** (총 10/10). 체크포인트 태스크 0개 |
| Sampling continuity (3연속 금지) | ✅ | 자동 verify 없는 태스크가 **0개**라 연속 구간이 성립하지 않는다 |
| Wave 0 covers all MISSING | ✅ | Wave 0 5항목 전부 `[x]` — 04-01 이 4개, 04-03-T1 이 마지막 1개 |
| No watch-mode flags | ✅ | 네 플랜의 실행 명령에 `--watch`·워치 `vitest` **0건**. `test:watch` 문자열은 04-01 `read_first` 의 package.json 설명 1곳뿐(실행 명령 아님) |
| Feedback latency < 10s | ✅ | 실측 — `check:edge` **0.27s** · `npm test` **0.55s** · `vitest run _shared lib` **0.65s** · `tsc --noEmit` **0.80s** · `lint` **1.76s**. 태스크 샘플링 0.9s, 웨이브 게이트 합 3.4s. `npm run build` **3.32s** 는 선언된 예외인데 그마저 10초 미만 |
| `nyquist_compliant: true` | ✅ | 위 5항목 만족. **단 이 값은 "샘플링 주기가 충분했다" 이지 "모든 동작이 검증됐다" 가 아니다** — 그 취지를 문서 본문에 명시했다 |

## 페이즈 게이트 5종 + `npm audit` (명령 출력 기준, 추정 없음)

| 게이트 | exit | 출력 |
|---|---|---|
| `npx tsc --noEmit` | **0** | 출력 없음 (0.80s) |
| `npm run lint` | **0** | 출력 없음 (1.76s) |
| `npm test` | **0** | `Test Files  10 passed (10)` · `Tests  219 passed (219)` (0.55s) |
| `npm run build` | **0** | `✓ Compiled successfully in 818ms` · 라우트 4개 `/`·`/_not-found`·`/log`·`/rank` 전부 `○ (Static)` (3.32s) |
| `npm run check:edge` | **0** | 출력 없음 (0.27s) |

`npm audit --audit-level=high` → exit **0**, `found 0 vulnerabilities`. 전체 `npm audit --json` 의 `metadata.vulnerabilities` = `{info:0, low:0, moderate:0, high:0, critical:0, total:0}`. **수정 명령은 실행하지 않았다**(읽기만).

`git status --porcelain | grep -vE '\.serena/project\.yml|\.planning/config\.json' | wc -l` → **0**.
`test -f deno.lock` → exit **1** (루트 lock ABSENT) · `ls supabase/functions/spin-roulette | wc -l` → **1** · `ls supabase/functions/respin-roulette | wc -l` → **1**.

### `deno.lock` 재생성 (오케스트레이터 승인 이탈)

| 항목 | 값 |
|---|---|
| 명령 | `rm supabase/functions/deno.lock && npm run check:edge` (손편집 0) |
| 줄 수 | **277 → 276** |
| `shasum` | `b2b9163bb479…` → `fdf2e8c3b683…` |
| `git diff --stat` | `1 file changed, **1 deletion(-)**` |
| 지워진 줄 | `"jsr:@supabase/supabase-js@2": "2.117.2",` (`:5`) — 두 `index.ts` 가 모두 `@2.117.2` 핀이라 **미참조 명세자**였다 |
| 추가·해시 변경 | **0건** (기대와 완전 일치 → 되돌리지 않음) |
| 멱등 | 2회차 `check:edge` 후 `shasum` 동일, 커밋 후 3회차 `check:edge` 후 `git status --porcelain -- supabase/functions/deno.lock` **0줄** |
| 루트 lock | 전 구간 부재 |

## Deviations from Plan

**Rule 1 버그 수정 0건 · Rule 3 블로커 0건 · Rule 4 아키텍처 질의 0건.** 플랜의 2태스크·2커밋·6파일을 그대로 수행했고 금지 사항을 모두 지켰다.

기록할 이탈 **4건**:

1. **[오케스트레이터 승인] `deno.lock` 재생성 커밋 1개 추가** (`3d460fb`, `chore(04-04)`). 04-03 이 남긴 미참조 명세자 줄을 D-02 원칙대로 재생성으로 정리했다. 결과가 승인 조건(`1 deletion(-)` 만)과 정확히 일치해 되돌리지 않았다. 플랜의 "커밋 2개" 는 이로써 **3개**가 됐다.
2. **[Rule 2] `CONVENTIONS.md` 정정 1건 추가** (플랜 지정 3 → 실제 4). jsr 예시의 비핀 `@2` 가 D-02 핀을 되돌리게 만드는 진술이라 함께 고쳤다. **SUMMARY·VALIDATION 에 쓰는 숫자는 플랜 기준 3 + 부가 1 로 분리해 적었다**(플랜의 "이 숫자를 그대로 쓴다" 지시를 숨기지 않기 위해).
3. **[인계 지시] `CLAUDE.md` 추가 2줄** — `deno` 외부 도구 전제(04-01 관측), 에디터 "Cannot find module" 진단(오케스트레이터 관측, 원인 **추정**임을 문안에 명시). 플랜 D-17 문안에는 없고 실행 지시에 있던 항목이다.
4. **[플랜 텍스트 불일치] `grep -cE 'nyquist_compliant: (true|false)'` = 1 은 성립 불가능한 인수 조건이다.** HEAD(수정 전)에서도 **2**다 — frontmatter 1줄 + Sign-Off 체크리스트의 "`nyquist_compliant: true` set in frontmatter" 1줄이 같은 토큰을 포함한다. 의도(frontmatter 값이 하나, 정직하게 설정)는 `grep -cE '^nyquist_compliant: (true|false)'` → **1** 로 확인했다. 04-03 의 CORS grep 과 같은 종류의 오기다.

**요구사항 마킹 근거(플랜 밖·실행 지시 안):** 플랜 Task 1·2 는 태스크 커밋에서 `REQUIREMENTS.md` 수정을 금지했고("페이즈 검증을 닫는 주체가 한다"), 04-01·04-03 SUMMARY 는 마킹을 **04-04 소관**으로 인계했다. 그래서 태스크 커밋이 아닌 **최종 메타데이터 커밋**에서 `requirements.mark-complete SPIN-01 SPIN-02 SPIN-04 SETT-04` 를 실행했다 — 두 제약을 모두 만족한다. SPIN-02 는 플랜 frontmatter(`[SPIN-01, SPIN-04, SETT-04]`)에 없지만 Traceability 가 "Phase 3 → **Phase 4 (Edge Function 배선에서 완료)**" 로 이 페이즈를 종착지로 지정한다.

## STATE.md 정정 (gsd-sdk 출력 수동 정규화)

| 증상 | 수동 정정 |
|---|---|
| `state.add-decision` 이 `- [Phase ?]:` 접두를 붙임 | 3줄 전부 `- [Phase 4]:` 로 |
| `state.advance-plan` 이 `Status: Phase complete — ready for verification` 로 덮음 | `Status: Executing Phase 04` 복원(페이즈 완료 마킹은 오케스트레이터의 `phase.complete` 소관 — **실행자가 호출하지 않았다**) |
| `advance-plan` 이 `last_activity` 를 날짜만 남김 | `2026-09-28 -- 04-04 완료 (…)` 로 복원 |
| `stopped_at`·`Stopped at:` 이 04-03 값에서 회귀 | `Phase 4 executed — all 4 plans complete, verification next` |
| `roadmap.update-plan-progress` 가 `\| In Progress\|  \|` (빈 셀) 생성 | `\| In Progress \| - \|` 로 정규화 |
| **`### Pending Todos` 가 "없음. (비어 있음)" 으로 거짓 기재** (04-03 관측) | 실제 **6건**을 파일명·목표 페이즈와 함께 나열, 이전 기재가 틀렸다는 사실도 적음 |
| Blockers 의 "Edge Function은 tsc·eslint 사각지대 … `deno check`가 유일한 정적 검사" | `npm run check:edge` 자동화 + 제외 범위 축소 반영. 남는 위험("eslint 못 봄, 동작은 컷오버 전까지 아무도 못 봄")은 유지 |

frontmatter `status:` 는 `advance-plan` 이 `verifying` 으로 바꿨다가 마지막 `state.update-progress` 가 `executing` 으로 되돌렸다 — 손대지 않고 그대로 뒀다(`Status: Executing Phase 04` 와 일치한다). `state.update-progress`·`roadmap.update-plan-progress` 는 SUMMARY 4개가 디스크에 있다는 이유로 `completed_phases: 4`·ROADMAP 행 `4/4 Complete 2026-09-28`·Phase 4 체크박스를 자동으로 채웠다 — **실행자가 `phase.complete` 를 호출한 것이 아니라** 규정된 두 verb 의 출력이다. 검증 승인은 `04-VALIDATION.md` 의 `Approval: pending` 이 그대로 들고 있다.

## Phase 8 SHIP-03 에 남긴 문서 항목

이 플랜은 `README.md` 를 **한 글자도 건드리지 않았다**(플랜 금지). Phase 8 SHIP-03 이 질 항목:

1. **README 의 Edge Function·스키마 설명** — `README.md:51`(`pinned_menus` 미기재)·`:55`(`respin-roulette` 미기재)는 매퍼가 이미 지적한 낡은 진술이고, 여기에 이번 페이즈의 변경(매분 폴링·`settings.spin_time`·매장 조인·`restaurant_id`)이 더해졌다. `CONCERNS.md` 항목 7 이 그 목록이다.
2. **롤백 절차** — 구 테이블 복원 SQL, 구 cron 재등록, 이전 Edge Function 재배포, 되돌리는 판단 기준(ROADMAP Phase 8 성공 기준 2).
3. **배포 체크리스트** — `results` 덤프 → 마이그레이션(사용자) → `functions deploy` 2회 → PR 머지 → 라이브 확인(성공 기준 3). `wr-01` 7항목이 그 초안이다.
4. **검증 명령 5종의 README 반영** — `npm test`·`npm run check:edge` 와 `deno` 외부 도구 전제.

## 이 페이즈가 남긴 미검증 목록 (전부 Phase 6·8)

1. **임베드의 실제 형태** — 배열/객체. `Array.isArray` 접기가 옳은지는 첫 실호출에서만 드러난다 → `wr-01` **7번**(Phase 8 SHIP-04).
2. **`settings.spin_time` 의 실제 직렬화** — PostgREST 가 `time` 을 어떤 문자열로 주는지. `parseSpinTime` 은 `"HH:MM"`·`"HH:MM:SS"` 를 받지만 실물은 본 적 없다 → Phase 8.
3. **`console.error` 가 대시보드 로그에 보이는가** — 배포 후 1건 확인 → Phase 8.
4. **`respin()` 배너에 함수 본문이 실리는가** — 브라우저 필요. 증상 기준은 04-03 낭독 2번(영어 고정 문구 = 500 에 CORS 누락) → Phase 6 UI 검증 또는 Phase 8 실사용.
5. **배포 경고 부재** — `functions deploy` 출력에 `WARNING: Functions using fallback import map` / `deprecated import_map.json` 이 없어야 한다(SC-5) → Phase 8.
6. **`upsert` 가 실제로 갱신하는가** — `onConflict: "date"` 와 유니크 제약의 짝은 0005 텍스트 계약의 간접 보장뿐 → Phase 8.

## 페이즈 전체 커밋 (`65c94b4..HEAD`, AI 표기 **0**)

`git log --format=%B 65c94b4..HEAD | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → **0**. 커밋 수는 **16개**(이 SUMMARY 의 최종 메타데이터 커밋을 더하면 17). 플랜의 인수 조건은 "14개(Phase 3 선례)" 를 기준으로 적었으나 **실제 수는 16** 이다 — 04-01 이 기록 커밋 1개, 04-02 가 기록·상태 커밋 2개를 더 남겼기 때문이고, **0건이 핵심이지 커밋 수가 아니다.**

| # | 커밋 | 플랜 |
|---|---|---|
| 1 | `6ba60ad` chore(04-01): add deno check gate for edge functions | 04-01 |
| 2 | `61186fb` chore(04-01): widen ResultRow.candidates for restaurant_id snapshots | 04-01 |
| 3 | `a39265b` test(04-01): extend edge contract for new schema, settings and cooldown | 04-01 |
| 4 | `7373120` docs(04-01): record deno check gate, snapshot type and contract RED | 04-01 |
| 5 | `bc14529` docs(04-01): complete static gate and contract RED plan | 04-01 |
| 6 | `dd05211` feat(04-02): rewrite spin-roulette on candidates, settings and cooldown | 04-02 |
| 7 | `8ef59a1` docs(04-02): record spin-roulette read-through and validation status | 04-02 |
| 8 | `923d3b7` docs(04-02): complete spin-roulette rewrite plan | 04-02 |
| 9 | `eecfcdf` docs(04-02): advance state and roadmap after spin-roulette rewrite | 04-02 |
| 10 | `69ef0e4` test(04-03): add failing cases for formatRespinError | 04-03 |
| 11 | `ccb58c4` feat(04-03): surface respin error body in the action banner | 04-03 |
| 12 | `ebbd7d1` feat(04-03): rewrite respin-roulette on candidates, settings and cooldown | 04-03 |
| 13 | `c82a04d` docs(04-03): complete respin rewrite and error surfacing plan | 04-03 |
| 14 | `ea6c5cb` docs(04-04): refresh docs and cutover checklist for the deno check gate | 04-04 |
| 15 | `3d460fb` chore(04-04): regenerate deno.lock after respin pin | 04-04 |
| 16 | `3c3710e` docs(04-04): close phase 4 validation map | 04-04 |

## TDD Gate Compliance

이 플랜은 `type: execute`(문서)이고 `tdd="true"` 태스크가 없다 — 코드 동작 변경 0줄(수정한 `.ts` 는 `edgeImports.test.ts` 의 **머리 주석**뿐이고 `it` 50건·단언·헬퍼 무변경). RED/GREEN 게이트는 적용 대상이 아니다. 페이즈 차원의 TDD 게이트는 04-01(RED 22건) → 04-02(GREEN 12건) → 04-03(GREEN 10 + 3건)으로 이미 닫혔다.

## Issues Encountered

None(블로커 0). 관측 2건:

1. **`.planning/codebase/CONCERNS.md`·`CONVENTIONS.md` 에 Phase 3 이 남긴 낡은 진술이 더 있다** — `CONCERNS.md` Tech Debt 의 "[P2] Edge Function 간 유틸 복붙(`kstNow`, `pickRandom`)"(Phase 3 이 `_shared` 로 해소)과 "[P1] 추첨 시각 11:55 하드코딩"(Phase 3 이 로직 2곳을 제거, UI 6곳은 Phase 6). 이 플랜의 정정 대상 밖이라 **건드리지 않았다**. 코드베이스 재매핑 또는 Phase 8 SHIP-03 에서 함께 볼 항목이다.
2. **`npm test` 는 10파일/219건에서 멈춰 있다** — 이 플랜이 테스트를 늘리지 않았다(문서 플랜). 04-01 이 예고한 페이즈 종료 수치와 정확히 일치한다.

## User Setup Required

None.

⚠ 여전히 **미배포·미적용**이다: 두 Edge Function 은 브랜치에만 있고 라이브에는 구 코드가 돈다. `0005_restaurants_settings.sql` 도 적용되지 않았다. 배포·마이그레이션·PR 머지는 Phase 8 컷오버에서 사용자가 `wr-01` 순서대로 수행한다.

## Next Phase Readiness

**Phase 4 실행이 끝났다 — 오케스트레이터 검증(`/gsd:verify-work`) 차례다.**

- 게이트 5종 green · `npm audit` 0건 · 미의도 변경 0 · `04-VALIDATION.md` `status: complete`(`Approval: pending`).
- **`phase.complete` 는 호출하지 않았다** — 검증 후 오케스트레이터 소관.
- 다음 페이즈 후보는 **Phase 5(매장 탭)** — Phase 3·4 와 의존이 없어 병렬 가능하고, Phase 6(오늘 탭)이 후보 소스 교체와 화면의 "11:55" 하드코딩 제거를 맡는다.
- **블로커:** 없음.

## Self-Check: PASSED

- 수정 파일 7개(`CLAUDE.md` · `CONVENTIONS.md` · `CONCERNS.md` · `edgeImports.test.ts` · `wr-01-cutover-window.md` · `deno.lock` · `04-VALIDATION.md`) 전부 디스크에 존재.
- 커밋 3개(`ea6c5cb` · `3d460fb` · `3c3710e`) 전부 `git log` 에서 확인, 각각 5·1·1 파일.
- `REQUIREMENTS.md` 4건 `Complete`, `.planning/todos/pending/` 6건, 루트 `deno.lock` 부재.
- 누락 0건.

---
*Phase: 04-server-spin*
*Plan: 04*
*Completed: 2026-09-28*
