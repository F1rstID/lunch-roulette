---
phase: 4
slug: server-spin
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `04-RESEARCH.md` §Validation Architecture. TDD 모드(`workflow.tdd_mode: true`) — 계약 테스트·단위 테스트가 구현보다 먼저 RED 로 선다(Phase 2·3 방식). 단 **`npm run check:edge` 는 RED 를 허용하지 않는다**(CONTEXT D-16): 타입이 깨진 함수는 커밋하지 않는다.
>
> Task ID·Plan·Wave 열은 플래너가 실제 PLAN.md 태스크로 채우고, Status 열은 실행자가 갱신한다(Phase 3 관례).
>
> **2026-09-28 갱신(플래너):** 플랜을 **4개**로 나눴다(04-01 게이트·타입·계약 RED / 04-02 `spin-roulette` / 04-03 `respin-roulette`+`formatRespinError`+`respin()` / 04-04 문서·todo·이 문서 마감). CONTEXT §Claude's Discretion 의 3분할 권고에서 문서 정정(D-17)을 04-04 로 떼어낸 이유는 컨텍스트 예산이다 — 04-03 이 세 태스크(≈48%)를 쓰고 거기에 문서 6파일(≈28%)을 더하면 한 플랜이 75%를 넘긴다. Wave 열은 PLAN frontmatter 의 `wave` 값(04-01=1, 04-02=2, 04-03=3, 04-04=4)이고 04-01 이 GSD 의미의 "Wave 0"(테스트·게이트 인프라) 플랜이라 `1 (W0)` 로 적었다. 네 플랜은 **순차 실행**이다(`use_worktrees: false`). 기준 숫자는 플래너가 2026-09-28 에 두 `index.ts`·두 spec 에서 재측정했다(PATTERNS §베이스라인 표와 일치; `edgeImports.test.ts` 현재 `it` **24건**·마지막 번호 #22, `spinTime.test.ts` 15건·#15, `npm test` 10파일/189건). 신규 계약은 **#23~#48(26건)** 이고 이 중 4건(#42·#45·#46·#48)은 현행 코드에서 이미 초록이므로 **RED 는 22건**이다. 페이즈 종료 시 총 **219건 / 10파일**(189 + 26 + `spinTime` 1 + `lib/errors` 3).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| **Config file** | `vitest.config.mts` — **변경 불필요**(`supabase/functions/_shared/**/*.test.ts`·`lib/**` include 이미 존재). 대신 **정적 게이트 신설이 Wave 0**: `package.json` `scripts.check:edge` + `supabase/functions/deno.json`(`{"nodeModulesDir":"none"}`) + `supabase/functions/deno.lock` (CONTEXT D-01·D-02) |
| **Quick run command** | `npm run check:edge && npx vitest run supabase/functions/_shared lib` |
| **Full suite command** | `npm test` |
| **Static gate (신규)** | `npm run check:edge` = `deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts` — 실측 0.47s, exit 0(현행 두 파일). `_shared/*.ts` 도 전이 검사됨(리서치 §Q-7) |
| **Estimated runtime** | `_shared`+`lib` ~0.2s · 전체 ~210ms · `check:edge` ~0.5s (페이즈 시작 시점 189 tests / 10 files — 플래너 재확인 2026-09-28) |

---

## Sampling Rate

- **After every task commit:** `npm run check:edge` + `npx vitest run supabase/functions/_shared lib` (합쳐 1초 미만). 함수 파일을 건드린 태스크는 `git status --porcelain` 에 **루트** `deno.lock` 이 없어야 한다(D-02). `supabase/functions/deno.lock` 은 **jsr 핀을 바꾸는 태스크(04-02-T1·04-03-T3)에서만** 바뀌고 그 커밋에 포함된다 — 다른 태스크에서 바뀌면 멈추고 보고한다
- **After every plan wave:** `npx tsc --noEmit` + `npm run lint` + `npm test` + `npm run check:edge`
- **Before `/gsd:verify-work`:** 위 4개 + `npm run build` 전부 green + `npm audit` 0건 + `git status` 에 `.serena/project.yml`·`.planning/config.json` 외 미의도 변경 0(특히 루트 `deno.lock`·함수 디렉터리 `deno.json` 부재)
- **Max feedback latency:** 10 seconds (`npm run build` 는 페이즈 게이트 예외 — Phase 2·3 선례. 단 04-03-T2 가 `app/**` 를 건드리므로 그 태스크에서 한 번 당겨 돌린다)

**의도된 빨간 구간**(TDD RED — vitest 만 빨갛다. **이 페이즈의 RED 는 플랜을 가로지른다**: 04-01 이 22건을 세우고 04-02 가 12건, 04-03 이 10건 + 자기 3건을 닫는다. 각 플랜은 자기가 닫을 적색 건수를 SUMMARY 에 숫자로 남긴다):
- `04-01-T3` 직후 — `edgeImports.test.ts` 50건 중 **22건 적색**(`Tests  22 failed | 28 passed (50)`), 전체 `Tests  22 failed | 194 passed (216)`. `check:edge` 는 이때도 exit 0 이어야 한다.
- `04-02-T1` 직후 — 적색 **10건**(`Tests  10 failed | 40 passed (50)`), 전체 `10 failed | 206 passed (216)`. 남은 적색은 전부 `EDGE/SPIN-04` describe + `#47`(헬퍼 이름 대칭)이다.
- `04-03-T1` 직후 — `lib/errors.test.ts` 3건 적색 추가(`3 failed | 7 passed (10)`), 전체 `13 failed | 206 passed (219)`. `npx tsc --noEmit` 이 `TS2305` 1건으로 실패한다(`formatRespinError` 미존재) — 같은 플랜의 다음 태스크가 닫는다.
- `04-03-T3` 이후 — **적색 0**(`Tests  219 passed (219)` · `Test Files  10 passed (10)`).
- `spinTime.test.ts` 왕복 1건(#16, D-15)은 현행 코드로도 통과하므로 **RED 가 아니다** — 회귀 핀임을 플랜이 명시한다.

---

## Per-Task Verification Map

> Task ID = `{plan}-T{n}`. Status 는 실행자가 태스크 완료 시 갱신한다.
>
> Threat Ref 는 위협을 **등록한 플랜과 무관하게** 그 위협을 완화하는 태스크 행에 적는다(예: 04-01-T3 의 `T-04-17` 은 04-02 STRIDE 표의 위협을 계약 #31 로 선제 고정한다). `T-04-12` 는 결번, 04-01 의 `T-04-14`·`T-04-15` 는 표 행이 아니라 플랜 본문의 실행 규칙으로 완화된다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-T1 | 01 | 1 (W0) | SPIN-01 | T-04-01, T-04-02 | 두 `index.ts` 가 정적 검사 안으로 들어온다. 설정 파일은 `supabase/functions/` 위에만, 루트 `deno.lock` 부재, `package-lock.json` 무변경 | static | `npm run check:edge` (exit 0) · `test ! -f deno.lock` · `test -z "$(git diff --stat -- package-lock.json)"` | ❌ W0 (스크립트·deno.json·lock 신설) | ✅ green |
| 04-01-T2 | 01 | 1 (W0) | SPIN-01 / SPIN-04 | — | `ResultRow.candidates` 확장이 소비처를 깨지 않는다(`c.name`·`length` 만 읽는다) | static | `npx tsc --noEmit` · `test -z "$(git diff --stat -- components/CalendarLog.tsx)"` | ✅ (현재 exit 0) | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SPIN-01 | — | `from("menus")` 0회 · `from("candidates")`·`from("settings")` 각 1회 · `restaurants` 임베드 토큰(공백 허용 정규식) — 두 파일 각각 | contract (RED) | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` → exit 1, `22 failed \| 28 passed (50)` | ⚠️ 확장(D-14, #23·#24·#35·#36) | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SPIN-01 | T-04-17 | 시각 판정 → 멱등 → 후보 → 쿨다운 → insert 순서(토큰 `indexOf` 단조 증가 + 전부 > 0) | contract (RED) | 〃 (#31) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SPIN-01 | T-04-02 | spin 에 `parseSpinTime(` 1 · `\bDEFAULT_SPIN_TIME\b` ≥1 · `jsr:@supabase/supabase-js@2.117.2"` 1 및 비핀 `@2"` 0 (respin 도 핀, 단 `parseSpinTime`·`DEFAULT_SPIN_TIME` 은 0) | contract (RED) | 〃 (#29·#30·#41·#42) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SPIN-02 | — | `"../_shared/cooldown.ts"` import 1 · `cooldownWindowStart(` 1 · `applyCooldown(` 1 — 두 파일 각각 | contract (RED) | 〃 (#28·#40) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SPIN-04 | T-04-05, T-04-06 | respin 맨 `new Response(` **정확히 2회**(헬퍼+OPTIONS) · `function json(` 1 · `.upsert(` 1 · `onConflict: "date"` 1(주석 제거 사본) | contract | 〃 (#45·#46 — 현행 코드에서 이미 초록) | ⚠️ 확장(#22 유지 + 신규) | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SETT-04 | T-04-03 | 폴백 boolean 3키(`settings_fallback`·`cooldown_fallback`·`cooldown_skipped`) 각 1회 · `console.error(` spin ≥5 / respin ≥4 — 두 파일 각각 | contract (RED) | 〃 (#32·#33·#43·#44) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | (D-01) | T-04-01 | 함수 디렉터리 2개에 `deno.json`·`deno.jsonc`·`import_map.json` 부재 + `supabase/functions/deno.json` 존재(`existsSync` 7원소) | contract | 〃 (#48 — Task 1 이후 초록) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | (D-03) | T-04-11 | 후보 정규화 헬퍼 선언 토큰이 두 파일에서 같은 이름(`[1, 1]`) | contract (RED) | 〃 (#47) | ❌ W0 | ✅ green |
| 04-01-T3 | 01 | 1 (W0) | SETT-04 | — | `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` `toEqual(DEFAULT_SPIN_TIME)` | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` → exit 0, `16 passed (16)` | ❌ W0 (신규 1건, **RED 없음** — 회귀 핀) | ✅ green |
| (인용) | — | — | SETT-04 | — | `parseSpinTime("11:55:00")` · `isAfterSpinTime` 11:54:59/11:55:00 경계 | unit | 〃 | ✅ #2·#12·#13 | ✅ green |
| (인용) | — | — | SPIN-02 / SETT-04 | — | `cooldownWindowStart(today, 0) === null` · `applyCooldown(c, [])` 항등 · 폴백 · `null` 무시 · 경계 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` | ✅ 14케이스 | ✅ green |
| (인용) | — | — | (회귀) | T-04-05, T-04-09 | `_shared` 3파일 import 0 · 복붙 부재 · `23505` 1회 · #17(respin 은 spinTime 미import) · #22(OPTIONS+CORS) | contract | `…/edgeImports.test.ts` | ✅ #1~#22 | ✅ green |
| 04-02-T1 | 02 | 2 | SPIN-01 / SPIN-02 / SETT-04 | T-04-11, T-04-03, T-04-04, T-04-07, T-04-08, T-04-16, T-04-09, T-04-17, T-04-18 | `spin-roulette` 재작성 후 계약 #23~#34 GREEN + `check:edge` exit 0. `from("results")` 3회(멱등·쿨다운창·insert) · 맨 `new Response(` 1 · `console.error(` 7 · `as`/`any`/`restaurants[0]` 0건 | contract + static | `npm run check:edge && npx vitest run supabase/functions/_shared/edgeImports.test.ts` → `10 failed \| 40 passed (50)` (남은 적색은 respin 대기) | (W0 산출물) | ✅ green |
| 04-02-T2 | 02 | 2 | SPIN-01 | T-04-11, T-04-17 | 낭독 6항목(임베드 접기 · 모든 반환이 `json()` · 세 boolean 상시 · 콘솔 에러 경로별 1건 · insert 에 매장 id · D-05 순서)을 **파일:줄 인용**으로 기록 | manual (낭독) + static | `npm run check:edge && npx tsc --noEmit && npm run lint` · 기록은 `04-02-SUMMARY.md` | 자동 단언 불가 → Manual-Only | ✅ green |
| 04-03-T1 | 03 | 3 | SPIN-04 | T-04-19 | `formatRespinError` 3케이스가 RED 로 선다(본문 우선 / 본문 null·비객체 / `error` 빈 문자열) | unit (RED) | `npx vitest run lib/errors.test.ts` → exit 1, `3 failed \| 7 passed (10)` · `npx tsc --noEmit \| grep -c TS2305` = 1 | ❌ W0 (3케이스) | ✅ green |
| 04-03-T2 | 03 | 3 | SPIN-04 | T-04-19, T-04-20, T-04-04 | `formatRespinError` GREEN + `respin()` 이 `response` 본문을 한 번 읽는다. `FunctionsHttpError`·`error.context` 0건, `lib/errors.ts` 값 import 0건, `respin()` 밖 무변경 | unit + static | `npx vitest run lib/errors.test.ts && npx tsc --noEmit && npm run build` · `grep -c 'FunctionsHttpError' app/page.tsx` = 0 · `grep -cE '^import ' app/page.tsx` = 14 | ❌ W0 → GREEN | ✅ green |
| 04-03-T2 | 03 | 3 | SPIN-04 | — | todo `wr-02-respin-error-body.md` 삭제(D-13a), `done/` 디렉터리 미생성 | grep | `test ! -f .planning/todos/pending/wr-02-respin-error-body.md` · `ls .planning/todos/pending \| wc -l` = 6 | ✅ (현재 7개) | ✅ green |
| 04-03-T3 | 03 | 3 | SPIN-04 / SPIN-02 | T-04-05, T-04-06, T-04-10, T-04-11, T-04-08, T-04-09 | `respin-roulette` 재작성 후 계약 #35~#47 GREEN. CORS 논증·`corsHeaders`·`json()`·OPTIONS 단락·`spun_at` 보존, 맨 `new Response(` 2, `onConflict` 원본 1(주석 토큰 제거), `console.error(` 5 | contract + static | `npm run check:edge && npx vitest run supabase/functions/_shared/edgeImports.test.ts` → `50 passed (50)` · `npm test` → `219 passed (219)` | (W0 산출물) | ✅ green |
| 04-03-T3 | 03 | 3 | SPIN-04 | — | `respin()` 배너에 함수 본문이 실리는가 | 낭독 + Manual-Only | `npx tsc --noEmit`(타입만 — `response: Response \| undefined`) | 자동 단언 불가 → Manual-Only(Phase 6·8) | 📋 manual-only |
| 04-04-T1 | 04 | 4 | (D-17) | T-04-21, T-04-11, T-04-13 | 낡은 진술 정정 + `wr-01` 7번 추가. 새 거짓(미배포 사실 왜곡) 0 | grep | `grep -c '여전히 사각지대' CLAUDE.md` = 0 · `grep -c 'npm run check:edge' CLAUDE.md` ≥ 2 · `grep -c '복붙돼 있다' .planning/codebase/CONVENTIONS.md` = 0 · `grep -c '수동 실행' .planning/codebase/CONCERNS.md` = 0 · `grep -c '63fae89' .planning/todos/pending/wr-01-cutover-window.md` = 1 · `grep -cE '^7\. ' …/wr-01-cutover-window.md` = 1 · `grep -cE '^[[:space:]]*it\(' supabase/functions/_shared/edgeImports.test.ts` = 50 | ✅ (문서 존재) | ✅ green |
| 04-04-T2 | 04 | 4 | SPIN-01 / SPIN-04 / SETT-04 | T-04-22, T-04-SC | 페이즈 게이트 5종 + `npm audit` + 미의도 변경 0. 거짓 초록 금지 | static + gate | `npx tsc --noEmit && npm run lint && npm test && npm run build && npm run check:edge && npm audit --audit-level=high` · `git status --porcelain \| grep -vE '\.serena/project\.yml\|\.planning/config\.json' \| wc -l` = 0 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 📋 manual-only(자동 단언이 없는 항목 — 초록으로 칠하지 않는다)*

**2026-09-28 04-04 최종 판정:** 위 표의 적색 0 · 대기 0. 04-02 가 남겼던 중간 메모("계약 50건 중 10건이 respin 대기")는 04-03 이 `respin-roulette` 를 재작성하며 해소했다 — `npx vitest run supabase/functions/_shared/edgeImports.test.ts` → `50 passed (50)`, `npm test` → `Test Files 10 passed (10)` · `Tests 219 passed (219)`. `📋 manual-only` 1행(`respin()` 배너)은 **통과가 아니라 미검증**이다: 브라우저 + 배포된 함수 + 실제 500 응답 세 가지가 동시에 필요해 이 페이즈에서 확인할 방법이 없다(Phase 6 UI 검증 또는 Phase 8 실사용 1회). 자동 장치가 덮은 범위는 타입(`response: Response | undefined`)과 순수 헬퍼 3케이스까지다.

**페이즈 게이트 5종 (2026-09-28, `3d460fb` 시점 — 04-04-T2 실측):** `npx tsc --noEmit` exit 0 (0.80s) · `npm run lint` exit 0 (1.76s) · `npm test` exit 0 (`Test Files 10 passed (10)` · `Tests 219 passed (219)`, 0.55s) · `npm run build` exit 0 (3.32s, 라우트 4개 정적 생성) · `npm run check:edge` exit 0 (0.27s). `npm audit --audit-level=high` → exit 0, `found 0 vulnerabilities`(전체 `npm audit` 도 0건 — critical·high 0). 미의도 변경 0: `git status --porcelain | grep -vE '\.serena/project\.yml|\.planning/config\.json' | wc -l` → 0, 루트 `deno.lock` 부재(`test -f deno.lock` exit 1), 함수 디렉터리 2개는 각각 `index.ts` 1파일뿐.

---

## Wave 0 Requirements

- [x] **`package.json` `scripts.check:edge` + `supabase/functions/deno.json` + `supabase/functions/deno.lock`(D-01·D-02)** — **가장 먼저**(04-01-T1). 정적 게이트가 켜지기 전에 쓴 함수 코드는 타입 사각지대에서 자란다.
- [x] `lib/supabase/client.ts` `ResultRow.candidates` 1줄(D-08) — 04-01-T2. 함수가 쓸 형태를 타입이 먼저 인정해야 한다.
- [x] `supabase/functions/_shared/edgeImports.test.ts` 확장 #23~#48(D-14 + 권고 3종) — 04-01-T3, RED 22건.
- [x] `supabase/functions/_shared/spinTime.test.ts` 왕복 1건 #16(D-15) — 04-01-T3, RED 없음.
- [x] `lib/errors.test.ts` 3케이스(D-13) — **04-03-T1**(GREEN 이 같은 플랜에 있어 04-03 으로 뒀다). RED 3건(`69ef0e4`) → GREEN(`ccb58c4`), 현재 `lib/errors.test.ts` 10건 전부 초록.
- 프레임워크 설치 불필요 · `vitest.config.mts` 무변경 · 공용 픽스처 불필요.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 `index.ts` 의 **동작**(분기·순서·응답 본문) | SPIN-01·SPIN-04 | 라이브에 새 테이블이 없어 실호출 불가 | 낭독 6항목(SUMMARY 에 파일:줄 인용으로 기록 — Phase 2 T-02-11 관례): (1) 임베드를 `Array.isArray` 로 접는가 (2) 모든 반환이 `json()` 을 거치는가(OPTIONS 제외) (3) 세 폴백 boolean 이 ok 응답에 **항상** 있는가 (4) `console.error` 가 500·폴백 경로마다 1건인가 (5) `insert`/`upsert` 본문에 `restaurant_id` 가 있는가 (6) D-05 순서가 코드 순서와 같은가. **기록 위치: spin 은 `04-02-SUMMARY.md`(04-02-T2), respin 은 `04-03-SUMMARY.md`(04-03-T3, 6번 항목은 "spin 과의 diff 가 의도된 비대칭 5개로만 설명되는가" 로 치환)**. **기록 완료(2026-09-28):** `04-02-SUMMARY.md:174` "## 낭독 리뷰 6항목 (Manual-Only — 파일:줄 인용)"(`dd05211` 시점) · `04-03-SUMMARY.md:204` "## `respin-roulette` 낭독 리뷰 6항목"(`ebbd7d1` 시점, 188줄 기준) — 두 기록 모두 판정이 아니라 파일:줄 인용으로 남았다 |
| 임베드가 실제로 객체로 오는가 | SPIN-01 | 실호출 필요 | **Phase 8 SHIP-04**(todo `wr-01-cutover-window.md` 7번 — 04-04-T1 이 추가한다): 컷오버 후 `respin-roulette` 수동 invoke → 응답 `menu` 가 실제 매장명, `restaurant_id` 가 uuid |
| `respin()` 배너에 함수 본문이 실리는가 | SPIN-04 | 브라우저 필요(`npm run dev` 는 가드런처만, 라이브 오염 금지) | Phase 8 이후 실사용 1회, 또는 Phase 6 UI 검증에 위임. 증상 기준: 배너 문구가 영어 고정 문구면 500 에 CORS 가 빠진 것이다 |
| `console.error` 가 대시보드 로그에 보이는가 | (관측성) | 배포 후에만 | Phase 8: 대시보드 Edge Function Logs 에서 1건 확인 |
| `check:edge` 도입이 배포 동작을 바꾸지 않았는가 | SC-5 | 배포 필요 | Phase 8: `functions deploy` 출력에 `WARNING: Functions using fallback import map` / `deprecated import_map.json` 이 **없어야** 한다 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 네 플랜의 `<task type=` 개수와 `<automated>` 개수가 같다: 04-01 3/3 · 04-02 2/2 · 04-03 3/3 · 04-04 2/2 (총 10/10). 체크포인트 태스크 0개.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — 자동 verify 없는 태스크가 **0개**라 연속 구간 자체가 없다.
- [x] Wave 0 covers all MISSING references — 위 Wave 0 항목 5개가 전부 `[x]`. 04-01 이 4개(게이트·타입·계약 RED·회귀 핀), 04-03-T1 이 마지막 1개(`lib/errors.test.ts`)를 채웠다.
- [x] No watch-mode flags — 네 플랜의 실행 명령에 `vitest`(워치)·`--watch` 0건. `test:watch` 문자열은 04-01 의 `read_first`(package.json scripts 블록 설명) 1곳뿐이고 실행 명령이 아니다.
- [x] Feedback latency < 10s — 실측(2026-09-28): `npm run check:edge` 0.27s · `npm test` 0.55s · `npx vitest run supabase/functions/_shared lib` 0.65s · `npx tsc --noEmit` 0.80s · `npm run lint` 1.76s. 태스크 후 샘플링(0.9s)·웨이브 게이트(합 3.4s) 모두 10초 미만. `npm run build` 3.32s 는 선언된 페이즈 게이트 예외이고 그마저 10초 미만이다.
- [x] `nyquist_compliant: true` set in frontmatter — 위 5항목이 전부 만족이라 `true` 로 올렸다. **단 이 값은 "샘플링 주기가 충분했다" 는 뜻이지 "모든 동작이 검증됐다" 는 뜻이 아니다** — Manual-Only 표 5행(실호출·브라우저·배포 로그·배포 경고)은 여전히 Phase 6·8 몫이고, 그중 임베드 형태 확인은 `wr-01` 7번으로 컷오버 체크리스트에 심었다.

**Approval:** pending
