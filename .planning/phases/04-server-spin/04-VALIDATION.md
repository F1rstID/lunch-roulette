---
phase: 4
slug: server-spin
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `04-RESEARCH.md` §Validation Architecture. TDD 모드(`workflow.tdd_mode: true`) — 계약 테스트·단위 테스트가 구현보다 먼저 RED 로 선다(Phase 2·3 방식). 단 **`npm run check:edge` 는 RED 를 허용하지 않는다**(CONTEXT D-16): 타입이 깨진 함수는 커밋하지 않는다.
>
> Task ID·Plan·Wave 열은 플래너가 실제 PLAN.md 태스크로 채우고, Status 열은 실행자가 갱신한다(Phase 3 관례).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| **Config file** | `vitest.config.mts` — **변경 불필요**(`supabase/functions/_shared/**/*.test.ts`·`lib/**` include 이미 존재). 대신 **정적 게이트 신설이 Wave 0**: `package.json` `scripts.check:edge` + `supabase/functions/deno.json`(`{"nodeModulesDir":"none"}`) + `supabase/functions/deno.lock` (CONTEXT D-01·D-02) |
| **Quick run command** | `npm run check:edge && npx vitest run supabase/functions/_shared lib` |
| **Full suite command** | `npm test` |
| **Static gate (신규)** | `npm run check:edge` = `deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts` — 실측 0.47s, exit 0(현행 두 파일). `_shared/*.ts` 도 전이 검사됨(리서치 §Q-7) |
| **Estimated runtime** | `_shared`+`lib` ~0.2s · 전체 ~185ms · `check:edge` ~0.5s (페이즈 시작 시점 189 tests / 10 files) |

---

## Sampling Rate

- **After every task commit:** `npm run check:edge` + `npx vitest run supabase/functions/_shared lib` (합쳐 1초 미만). 함수 파일을 건드린 태스크는 `git status --porcelain` 에 루트 `deno.lock`·`supabase/functions/deno.lock` 변경이 **없어야** 한다(lock 드리프트 감지기, D-02)
- **After every plan wave:** `npx tsc --noEmit` + `npm run lint` + `npm test` + `npm run check:edge`
- **Before `/gsd:verify-work`:** 위 4개 + `npm run build` 전부 green + `npm audit` 0건 + `git status` 에 `.serena/project.yml`·`.planning/config.json` 외 미의도 변경 0(특히 루트 `deno.lock`·함수 디렉터리 `deno.json` 부재)
- **Max feedback latency:** 10 seconds (`npm run build` 는 페이즈 게이트 예외 — Phase 2·3 선례)

**의도된 빨간 구간**(TDD RED 커밋 — vitest 만 빨갛다. 같은 플랜의 다음 태스크가 닫는다. 세션은 RED 상태로 끝내지 않는다):
- `edgeImports.test.ts` 확장 직후(D-14 신규 단언) — `from("menus")` 0회 등이 현행 파일에서 실패한다. `check:edge` 는 이때도 초록이어야 한다.
- `lib/errors.test.ts` 3케이스 직후(D-13) — `formatRespinError` 미존재로 단언 실패(vitest 는 없는 named export 를 `undefined` 로 바인딩하므로 exit code 와 `npx tsc --noEmit` TS2305 로 RED 를 판정 — Phase 3 결정).
- `spinTime.test.ts` 왕복 1케이스(D-15)는 현행 코드로도 통과하므로 RED 없음 — 회귀 고정 목적임을 플랜에 명시.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (플래너) | 01 | 0 | SPIN-01 | — | N/A | static | `npm run check:edge` (두 파일 exit 0) | ❌ W0 (스크립트·deno.json·lock 신설) | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-01 / SPIN-04 | — | `ResultRow.candidates` 확장이 소비처를 깨지 않는다 | static | `npx tsc --noEmit` | ✅ (exit 0, 소비처는 `c.name`·`length` 만) | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-01 | — | `from("menus")` 0회 · `from("candidates")`·`from("settings")` 각 1회 · `restaurants` 임베드 토큰 | contract | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` | ⚠️ 확장(D-14) — RED | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-01 | — | 시각 판정 → 멱등 → 후보 → 쿨다운 → insert 순서(토큰 `indexOf` 비교) | contract | 〃 | ❌ W0 | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-01 | — | `parseSpinTime(`·`DEFAULT_SPIN_TIME`·`jsr:@supabase/supabase-js@2.117.2` 토큰 존재 | contract | 〃 | ❌ W0 | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-02 | — | `"../_shared/cooldown.ts"` import 1회 · `cooldownWindowStart(`·`applyCooldown(` 각 1회(두 파일) | contract | 〃 | ❌ W0 | ⬜ pending |
| (플래너) | 01 | 0 | SPIN-04 | T-04-?? (CORS) | respin `new Response(` 정확 2회 · `.upsert(` 1회 · `onConflict: "date"` 1회(주석 제거 사본) | contract | 〃 | ⚠️ 확장(#22 유지 + 신규) | ⬜ pending |
| (플래너) | 01 | 0 | SETT-04 | — | 폴백 boolean 3개 토큰(`settings_fallback`·`cooldown_fallback`·`cooldown_skipped`) 두 파일 존재 · `console.error(` ≥1 | contract | 〃 | ❌ W0 | ⬜ pending |
| (플래너) | 01 | 0 | (D-01) | T-04-?? (배포 import map) | 함수 디렉터리 2개에 `deno.json`·`deno.jsonc`·`import_map.json` 부재 + `supabase/functions/deno.json` 존재 | contract | 〃 | ❌ W0 (#23) | ⬜ pending |
| (플래너) | 01 | 0 | (D-03) | — | 후보 정규화 헬퍼 선언 토큰이 두 파일에서 같은 이름 | contract | 〃 | ❌ W0 (#25) | ⬜ pending |
| (플래너) | 01 | 0 | SETT-04 | — | `parseSpinTime(DEFAULT_SPIN_TIME_TEXT)` `toEqual(DEFAULT_SPIN_TIME)` | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` | ❌ W0 (신규 1건, RED 없음) | ⬜ pending |
| (인용) | — | — | SETT-04 | — | `parseSpinTime("11:55:00")` · `isAfterSpinTime` 11:54:59/11:55:00 경계 | unit | 〃 | ✅ #2·#12·#13 | ✅ green |
| (인용) | — | — | SPIN-02 / SETT-04 | — | `cooldownWindowStart(today, 0) === null` · `applyCooldown(c, [])` 항등 · 폴백 · `null` 무시 · 경계 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` | ✅ 14케이스 | ✅ green |
| (인용) | — | — | (회귀) | — | `_shared` 3파일 import 0 · 복붙 부재 · 23505 1회 · #17 · #22 | contract | `…/edgeImports.test.ts` | ✅ #1~#22 | ✅ green |
| (플래너) | 02 | 1 | SPIN-01 / SPIN-02 / SETT-04 | T-04-?? (service_role) | `spin-roulette` 재작성 후 계약 GREEN + `check:edge` exit 0 | contract + static | `npm run check:edge && npx vitest run supabase/functions/_shared` | (W0 산출물) | ⬜ pending |
| (플래너) | 03 | 1 | SPIN-04 / SPIN-02 | T-04-?? (CORS·공개 노출) | `respin-roulette` 재작성 후 계약 GREEN + `check:edge` exit 0 | contract + static | 〃 | (W0 산출물) | ⬜ pending |
| (플래너) | 03 | 1 | SPIN-04 | — | `formatRespinError`: 본문 우선 / 본문 null·비객체 / `error` 빈 문자열 | unit | `npx vitest run lib/errors.test.ts` | ❌ W0 (3케이스) — RED | ⬜ pending |
| (플래너) | 03 | 1 | SPIN-04 | — | `respin()` 이 `response` 본문을 읽는다 | static + 낭독 | `npx tsc --noEmit` (`response: Response \| undefined` 타입 통과) | 자동 단언 불가 → Manual-Only | ⬜ pending |
| (플래너) | 03 | 1 | (D-17) | — | CLAUDE.md·CONVENTIONS·CONCERNS·todo 정정 문자열 존재 / 낡은 문장 0 | grep | `grep -c` 인수조건(플래너 실측 기입) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` `scripts.check:edge` + `supabase/functions/deno.json` + `supabase/functions/deno.lock` — **가장 먼저**(CONTEXT D-01·D-02). 정적 게이트가 켜지기 전에 쓴 함수 코드는 타입 사각지대에서 자란다.
- [ ] `lib/supabase/client.ts` `ResultRow.candidates` 1줄(D-08) — 함수가 쓸 형태를 타입이 먼저 인정해야 한다.
- [ ] `supabase/functions/_shared/edgeImports.test.ts` 확장(D-14 + #23~#25) — RED.
- [ ] `supabase/functions/_shared/spinTime.test.ts` 왕복 1케이스(D-15).
- [ ] `lib/errors.test.ts` 3케이스(D-13) — RED(플랜 03 의 Wave 0 로 두거나 플랜 01 에 합칠지는 플래너 재량).
- 프레임워크 설치 불필요 · `vitest.config.mts` 무변경 · 공용 픽스처 불필요.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 `index.ts` 의 **동작**(분기·순서·응답 본문) | SPIN-01·SPIN-04 | 라이브에 새 테이블이 없어 실호출 불가 | 낭독 6항목(SUMMARY 에 파일:줄 인용으로 기록 — Phase 2 T-02-11 관례): (1) 임베드를 `Array.isArray` 로 접는가 (2) 모든 반환이 `json()` 을 거치는가(OPTIONS 제외) (3) 세 폴백 boolean 이 ok 응답에 **항상** 있는가 (4) `console.error` 가 500·폴백 경로마다 1건인가 (5) `insert`/`upsert` 본문에 `restaurant_id` 가 있는가 (6) D-05 순서가 코드 순서와 같은가 |
| 임베드가 실제로 객체로 오는가 | SPIN-01 | 실호출 필요 | **Phase 8 SHIP-04**(todo `wr-01-cutover-window.md` 7번, D-17): 컷오버 후 `respin-roulette` 수동 invoke → 응답 `menu` 가 실제 매장명, `restaurant_id` 가 uuid |
| `respin()` 배너에 함수 본문이 실리는가 | SPIN-04 | 브라우저 필요(`npm run dev` 는 가드런처만, 라이브 오염 금지) | Phase 8 이후 실사용 1회, 또는 Phase 6 UI 검증에 위임 |
| `console.error` 가 대시보드 로그에 보이는가 | (관측성) | 배포 후에만 | Phase 8: 대시보드 Edge Function Logs 에서 1건 확인 |
| `check:edge` 도입이 배포 동작을 바꾸지 않았는가 | SC-5 | 배포 필요 | Phase 8: `functions deploy` 출력에 `WARNING: Functions using fallback import map` / `deprecated import_map.json` 이 **없어야** 한다 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
