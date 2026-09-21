---
phase: 3
slug: pure-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `03-RESEARCH.md` §Validation Architecture. TDD 모드(`workflow.tdd_mode: true`) — 각 모듈의 spec이 구현보다 먼저 RED로 선다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| **Config file** | `vitest.config.mts` — **변경 불필요.** `include`에 `supabase/functions/_shared/**/*.test.ts`가 이미 있고 extglob exclude와의 조합은 리서치가 실측(§Q5). 대신 **`tsconfig.json`·`eslint.config.mjs`의 제외를 좁히는 D-12가 Wave 0** |
| **Quick run command** | `npx vitest run supabase/functions/_shared lib` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | `_shared`만 ~85ms · 전체 ~140ms (현재 89 tests / 5 files) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/functions/_shared lib` (+ 타입·경계를 건드렸으면 `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit` + `npm run lint`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit && npm run lint && npm test && npm run build` 전부 green + `npm audit` 0건 + `git status`에 `.serena/project.yml`·`.planning/config.json` 외 미의도 변경 0
- **Max feedback latency:** 10 seconds (페이즈 게이트의 `npm run build`는 지연 예산 예외 — Phase 2 선례)

---

## Per-Task Verification Map

> Task ID는 플래너가 PLAN.md를 쓰면서 채운다. 아래 행은 요구사항 → 검증 계약의 초안이며, 실행자는 자신의 태스크에 해당하는 행의 Status를 갱신한다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 0 | QUAL-02 | — | `_shared`가 tsc·eslint 대상 (D-12) | static | `npx tsc --noEmit && npx eslint supabase/functions/_shared` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-02 | — | `kstParts` UTC 14:59:59/15:00:00·연 경계·자정 `00`·요일 | unit | `npx vitest run supabase/functions/_shared/kst.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-02 | — | `pickRandom`이 배열 원소만 돌려준다(멤버십) | unit | 〃 | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-02, SETT-02 | — | `parseSpinTime` `"11:55"`·`"11:55:00"`·`"09:05:30"`·소수 초 허용, `"25:00"`·`"11:60"`·`""`·`"1155"` → null; `isAfterSpinTime` 직전/정각/직후 | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | SPIN-02 | — | days 0 → 필터 없음 / 제외 후 남음 / 0개 → 전체 폴백 `fellBack: true` / `null` id 무시 / 창 시작 월·연·윤년 경계 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | QUAL-02 | — | 두 `index.ts`에 `function kstNow`·`function pickRandom`·`const SPIN_HH` 부재, `from "../_shared/kst.ts"` 존재; `_shared/*.ts`에 import 문 0개 | contract | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | SPIN-03 | — | 11:55:05 결과 없음 → `stalled`(≠ `decided`); 경계 6종 × `hasResult=false`; `hasResult=true`면 어느 시각이든 `decided`; 12:30 주입 | unit | `npx vitest run lib/phase.test.ts` | ⚠️ 재작성 | ⬜ pending |
| TBD | 02 | 2 | SPIN-03 | — | `stalled`에서 후보 목록 잠금 해제(순수 헬퍼) | unit | `npx vitest run lib/phase.test.ts` (헬퍼 위치는 플래너 결정) | ❌ W0 | ⬜ pending |
| TBD | 02 | 2 | QUAL-02 | — | `lib/time.ts` 재수출 후 포맷 계약 유지, `kstParts` 기대 객체에 `date` 1줄 | unit | `npx vitest run lib/time.test.ts` | ⚠️ 1줄 수정 | ⬜ pending |
| TBD | 02 | 2 | QUAL-02 | — | `hour12` 0건 (D-04) | grep | `grep -rn hour12 lib supabase/functions/_shared \| wc -l` = 0 | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | SETT-03 | — | 로드 전 `DEFAULT_SETTINGS`(11:55·0); `failed` → 기본값 + `error`; `loaded(null)` → 기본값 + `loaded` + error 없음; 잘못된 `spin_time` → 기본 시각 + `warning` | unit | `npx vitest run lib/settings.test.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 3 | SETT-02 | — | `changed("UPDATE", row)` 병합; `changed("DELETE")` 기본값 복귀; `"11:55:00"` → `{hh:11, mm:55}` | unit | 〃 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **`tsconfig.json`·`eslint.config.mjs` 제외 좁히기 (D-12)** — 가장 먼저. 이게 없으면 이후 `_shared` 작업 전부가 정적 검사 사각지대(리서치 §Pitfall 4)
- [ ] `supabase/functions/_shared/kst.test.ts` — QUAL-02
- [ ] `supabase/functions/_shared/spinTime.test.ts` — QUAL-02 · SETT-02(파싱)
- [ ] `supabase/functions/_shared/cooldown.test.ts` — SPIN-02
- [ ] `supabase/functions/_shared/edgeImports.test.ts` — QUAL-02(복붙 제거·import 0개 계약)
- [ ] `lib/settings.test.ts` — SETT-02 · SETT-03
- [ ] `lib/phase.test.ts` 재작성 — SPIN-03
- [ ] `lib/time.test.ts:58-66` 기대 객체에 `date` 한 줄 (D-15)
- 프레임워크 설치 불필요 · `vitest.config.mts` 변경 불필요 · 공용 픽스처 불필요

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 `index.ts` 본문이 Deno에서 컴파일된다 | QUAL-02 | `deno` 미설치 | 낭독: (1) import 2줄이 `../_shared/*.ts` 확장자 포함 (2) 제거한 로컬 함수의 잔여 호출 없음 (3) `SPIN_HH`/`SPIN_MM` 참조 0 |
| `useSettings` 훅 본문 | SETT-02·SETT-03 | React 렌더 하네스 미도입(§Q7) | 낭독 3항목: (1) `error` → `failed` / `data ?? null` → `loaded` 분기 (2) 채널명 `settings-changes`(기존 채널과 분리) (3) cleanup에 `removeChannel` |
| `stalled` 화면 문구·배너 합류 | SPIN-03·SETT-03 | `npm run dev` 금지(가드런처) | 소비처 9곳 `switch`+`never` 낭독 + tsc; 화면 확인은 Phase 6 UI 검증에 위임 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
