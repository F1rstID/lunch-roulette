---
phase: 3
slug: pure-logic
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-21
updated: 2026-09-21
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `03-RESEARCH.md` §Validation Architecture. TDD 모드(`workflow.tdd_mode: true`) — 각 모듈의 spec 이 구현보다 먼저 RED 로 선다.
>
> **2026-09-21 갱신(플래너):** Task ID·Plan·Wave 열을 실제 PLAN.md 태스크로 채웠다. Status 열은 실행자가 갱신한다.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| **Config file** | `vitest.config.mts` — **변경 불필요.** `include` 에 `supabase/functions/_shared/**/*.test.ts` 가 이미 있고 extglob exclude 와의 조합은 리서치가 실측(§Q5). 대신 **`tsconfig.json`·`eslint.config.mjs` 의 제외를 좁히는 D-12 가 Wave 0** (`03-01` Task 1) |
| **Quick run command** | `npx vitest run supabase/functions/_shared lib` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | `_shared`만 ~85ms · 전체 ~140ms (페이즈 시작 시점 89 tests / 5 files) |
| **파일 수 진행** | 시작 5 → 03-01 후 **9** → 03-02 후 9 → 03-03 후 **10** |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/functions/_shared lib` (+ 타입·경계를 건드렸으면 `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit` + `npm run lint`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit && npm run lint && npm test && npm run build` 전부 green + `npm audit` 0건 + `git status` 에 `.serena/project.yml`·`.planning/config.json` 외 미의도 변경 0 (계획 산출물 — `ROADMAP.md`·세 `PLAN.md`·`STATE.md`·이 파일 — 은 실행 시작 전에 오케스트레이터가 커밋하므로 실행 중 `git status` 에 나타나지 않는다)
- **Max feedback latency:** 10 seconds (페이즈 게이트의 `npm run build` 는 지연 예산 예외 — Phase 2 선례)

**의도된 빨간 구간 3곳** (TDD RED 커밋. 다음 태스크가 같은 플랜 안에서 닫는다. 세션은 RED 상태로 끝내지 않는다):
- `03-01` Task 2 직후 — `npx tsc --noEmit` 이 `TS2307` **3건**으로 실패한다(`_shared` 모듈 3개 미존재). 이것이 D-12 좁히기가 실제로 켜졌다는 증거다.
- `03-02` Task 2 직후 — `TS2305`(`isCandidateListLocked` 미존재) + `TS2554`(`currentPhase` 인자 개수) 로 실패한다.
- `03-03` Task 1 직후 — `TS2307` 1건(`@/lib/settings` 미존재).

---

## Per-Task Verification Map

> Task ID = `{plan}-T{n}`. Status 는 실행자가 태스크 완료 시 갱신한다.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-T1 | 01 | 1 (W0) | QUAL-02 | T-03-01 | `_shared` 가 tsc·eslint 대상이 된다. 함수 디렉터리 2개만 제외, `design/**`·`vitest.config.mts` 무변경 (D-12) | static | `npx tsc --noEmit && npm run lint && npm test` | ✅ (설정 2파일) | ✅ green |
| 03-01-T2 | 01 | 1 | QUAL-02, SPIN-02, SETT-02 | T-03-01 | spec 4개가 RED 로 선다. `edgeImports` 는 로드 실패가 아니라 **단언 실패**여야 한다(`readOrEmpty` 폴백) | unit+contract (RED) | `npx vitest run supabase/functions/_shared` → exit 1, `npx tsc --noEmit \| grep -c TS2307` = 3 | ❌ W0 | ✅ green |
| 03-01-T3 | 01 | 1 | QUAL-02 | T-03-01, T-03-04, T-03-05, T-03-07 | `kstParts` UTC 14:59:59/15:00:00·자정 `00`·연 경계·요일·`date` 포함; `kstNow` 키 집합; `pickRandom` 멤버십 | unit | `npx vitest run supabase/functions/_shared/kst.test.ts` (9건) | ❌ W0 | ✅ green |
| 03-01-T3 | 01 | 1 | QUAL-02, SETT-02 | T-03-13 | `parseSpinTime` `"11:55"`·`"11:55:00"`·`"09:05:30"`·소수 초 허용 무시, `"25:00"`·`"11:60"`·`""`·`"1155"` → `null`; `DEFAULT_SPIN_TIME` 리터럴; `isAfterSpinTime` 직전/정각/직후 + 12:30 주입 | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` (15건) | ❌ W0 | ✅ green |
| 03-01-T3 | 01 | 1 | SPIN-02 | T-03-06 | `days <= 0` → `null`; 월·연·**윤년** 경계; 필터 없음 / 제외 후 남음 / 0개 → 전체 폴백 `fellBack: true` / `null` id 무시 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` (10건) | ❌ W0 | ✅ green |
| 03-01-T4 | 01 | 1 | QUAL-02 | T-03-01, T-03-02, T-03-03 | 두 `index.ts` 에 `function kstNow`·`function pickRandom`·`const SPIN_HH` 부재, `from "../_shared/kst.ts"` 존재; `_shared/*.ts` import 0개; OPTIONS 단락·`23505` 보존 | contract | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` (22건) | ❌ W0 | ✅ green |
| 03-01-T4 | 01 | 1 | QUAL-02 | — | `kstNow` 정의가 레포 전체에 1곳 | grep | `grep -rn 'function kstNow' . --include='*.ts' --exclude-dir=node_modules --exclude-dir=.next \| wc -l` = 1 | ✅ | ✅ green |
| 03-02-T1 | 02 | 2 | QUAL-02 | — | `lib/time.ts` 재수출 후에도 포맷 계약 유지. `kstParts` 기대 객체에 `date` 1줄 (D-15) | unit | `npx vitest run lib/time.test.ts` (13건) | ⚠️ 1줄 수정 | ⬜ pending |
| 03-02-T1 | 02 | 2 | QUAL-02 | — | `hour12` 0건, 포맷터 2개가 `hourCycle: "h23"` (D-04 / todo IN-04) | grep | `grep -rn hour12 lib \| wc -l` = 0 | ✅ | ⬜ pending |
| 03-02-T1 | 02 | 2 | QUAL-02 | — | Turbopack 이 `@/supabase/functions/_shared/*` alias import 를 실제로 번들한다 | static | `npm run build` → exit 0 | ✅ | ⬜ pending |
| 03-02-T2 | 02 | 2 | SPIN-03 | T-03-08, T-03-10 | spec 16건이 3인자 `currentPhase` + `isCandidateListLocked` 를 부르며 RED 로 선다 | unit (RED) | `npx vitest run lib/phase.test.ts` → exit 1, `tsc` 에 `TS2305`·`TS2554` | ⚠️ 재작성 | ⬜ pending |
| 03-02-T3 | 02 | 2 | SPIN-03 | T-03-10 | 11:55:05 결과 없음 → `stalled`(≠ `decided`); 경계 6종 × `hasResult=false`; `hasResult=true` 면 어느 시각이든 `decided`; 12:30 주입이 경계를 옮긴다 | unit | `npx vitest run lib/phase.test.ts` (16건) | ⚠️ 재작성 | ⬜ pending |
| 03-02-T3 | 02 | 2 | SPIN-03 | T-03-08 | `isCandidateListLocked("stalled") === false` — 후보 0개로 추첨이 건너뛰어진 날 목록이 잠기지 않는다 | unit | `npx vitest run lib/phase.test.ts` (동 파일 #13~#16) | ❌ W0 | ⬜ pending |
| 03-02-T3 | 02 | 2 | SPIN-03 | T-03-09, T-03-11 | 소비처 9곳이 **한 커밋**에서 전환됨. `switch`+`never` 3곳, `resolvedPhase`·`msToNextPhase` 0건, `ResultBlock` 죽은 분기 0건 | grep | `grep -rn ': never' lib/phase.ts components/TopBar.tsx app/page.tsx \| wc -l` ≥ 3 · `grep -c resolvedPhase app/page.tsx` = 0 · `grep -rn 'msToNextPhase' lib app components --include='*.ts' --include='*.tsx' \| grep -v '\.test\.' \| wc -l` = 0 (spec 제외 — `lib/phase.test.ts` 머리 주석의 1건은 03-02-T2 가 `→ 1` 로 고정한 의도된 잔존) | ✅ | ⬜ pending |
| 03-03-T1 | 03 | 3 | SETT-02, SETT-03 | T-03-13, T-03-18 | spec 24건이 `@/lib/settings` 계약을 부르며 RED 로 선다. supabase 값/타입 import 0건 | unit (RED) | `npx vitest run lib/settings.test.ts` → exit 1, `tsc` 에 `TS2307` 1건 | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03 | 3 | SETT-03 | T-03-13, T-03-18 | 로드 전 `DEFAULT_SETTINGS`(11:55·0·`null`); `failed` → 기본값 + `error`; `loaded(null)` → 기본값 + `loaded` + **error 없음**; 잘못된 `spin_time` → 기본 시각 + `warning` 이고 `error` 는 `null`(예외 금지, W-10) | unit | `npx vitest run lib/settings.test.ts` (24건) | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03 | 3 | SETT-02 | T-03-15 | `changed("UPDATE", row)` 가 `spinTime`·`cooldownDays` 를 통째 교체; `changed("INSERT")` 동일; 정상 행이 `warning` 을 지운다(W-10); `changed("DELETE", null)` → 기본값 복귀 + `error`·`warning` 둘 다 `null`; 리듀서 불변성 | unit | `npx vitest run lib/settings.test.ts` (동 파일 #18~#24) | ❌ W0 | ⬜ pending |
| 03-03-T2 | 03 | 3 | SETT-03 | T-03-13 | `lib/settings.ts` 가 supabase 값 import 0건 — `import type` **문장**만 (§Q7 `supabaseUrl is required.` 방어) | grep | `grep -c '^import type { SettingsRow }' lib/settings.ts` = 1 · `grep -c 'import { type SettingsRow }' lib/settings.ts` = 0 | ✅ | ⬜ pending |
| 03-03-T3 | 03 | 3 | SETT-02, SETT-03 | T-03-14, T-03-16 | 앱 계층 `settings` 쓰기 경로 0건 · 채널 분리 · cleanup `removeChannel` | grep | `grep -cE '\.(insert\|update\|delete\|upsert)\(' lib/useSettings.ts` = 0 · `grep -c settings-changes lib/useSettings.ts` = 2 (머리 주석 1 + `supabase.channel(...)` 1) · `grep -rn settings-changes app \| wc -l` = 0 · `grep -c removeChannel lib/useSettings.ts` = 1 | ✅ | ⬜ pending |
| 03-03-T3 | 03 | 3 | SETT-02 | — | 세 페이지가 `settings.spinTime` 을 주입하고 **로드 실패**는 라벨 "설정" 으로, **파싱 경고**는 접두 없이 배너에 합류(W-10). 03-02 의 `DEFAULT_SPIN_TIME` 임시 참조 0건 | grep | `grep -rn 'useSettings()' app \| wc -l` = 3 · `grep -rn 'DEFAULT_SPIN_TIME' app \| wc -l` = 0 · `grep -rn 'formatLoadError("설정"' app \| wc -l` = 3 · `grep -rn 'settingsWarning' app \| wc -l` = 6 | ✅ | ⬜ pending |
| 03-03-T3 | 03 | 3 | SETT-02, SETT-03 | — | 페이지 통합 후에도 전체 스위트·타입·린트·빌드가 초록 | static | `npm test && npx tsc --noEmit && npm run lint && npm run build` | ✅ | ⬜ pending |
| 03-03-T4 | 03 | 3 | QUAL-02 | T-03-19 | D-16 문서 정정 — **CLAUDE.md 7건 정정 + 1건 추가**(공용 훅 컨벤션)·**CONVENTIONS.md 8줄 정정**. README 무변경(Phase 8) | grep | `grep -c '네 곳에 흩어져 있다' CLAUDE.md` = 0 · `grep -c msToNextPhase CLAUDE.md` = 0 · `grep -c '네 곳에 중복' .planning/codebase/CONVENTIONS.md` = 0 · `git diff --stat -- README.md` 0줄 | ✅ | ⬜ pending |
| 03-03-T4 | 03 | 3 | (페이즈 게이트) | T-03-SC, T-03-LIVE | 신규 패키지 0개 · 라이브 무접촉 · AI 표기 0줄 | static | `git diff --stat 68eedb8 -- package.json package-lock.json` 0줄 · `npm audit` critical·high 0 · `git log 68eedb8..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with'` = 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**grep 작성 규칙 2건(체커 지적 반영):** ① `grep -r` 의 글롭은 반드시 따옴표로 감싼다(`--include='*.ts'`) — zsh 가 먼저 확장해 `no matches found` 로 죽는다. ② "금지 토큰 0건" 형 게이트는 주석을 세지 않도록 줄 앞 주석을 건너뛰는 형태를 쓴다(`grep -c '^[^/]*\bthrow\b' <file>`), 그리고 해당 토큰을 한글 Why 주석 문안에 쓰지 않는다.

---

## Wave 0 Requirements

**`wave_0_complete: true` 의 정의:** D-12 제외 좁히기가 적용되고 **아래 spec 7종이 전부 존재해 러너에 수집될 때.** 이 조건은 `03-03` Task 1(마지막 신규 spec) 시점에 충족되며, `03-03` Task 4 가 frontmatter 를 갱신한다.

- [ ] **`tsconfig.json`·`eslint.config.mjs` 제외 좁히기 (D-12)** — 가장 먼저(`03-01-T1`). 이게 없으면 이후 `_shared` 작업 전부가 정적 검사 사각지대(리서치 §Pitfall 4)
- [ ] `supabase/functions/_shared/kst.test.ts` — QUAL-02 (`03-01-T2`)
- [ ] `supabase/functions/_shared/spinTime.test.ts` — QUAL-02 · SETT-02(파싱) (`03-01-T2`)
- [ ] `supabase/functions/_shared/cooldown.test.ts` — SPIN-02 (`03-01-T2`)
- [ ] `supabase/functions/_shared/edgeImports.test.ts` — QUAL-02(복붙 제거·import 0개 계약) (`03-01-T2`)
- [ ] `lib/time.test.ts:58-66` 기대 객체에 `date` 한 줄 (D-15) (`03-02-T1`)
- [ ] `lib/phase.test.ts` 재작성 — SPIN-03 (`03-02-T2`)
- [ ] `lib/settings.test.ts` (24건) — SETT-02 · SETT-03 (`03-03-T1`)
- 프레임워크 설치 불필요 · `vitest.config.mts` 변경 불필요 · 공용 픽스처 불필요 · **jsdom·`@testing-library/react` 도입 금지**(§Q7)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | 담당 Task |
|----------|-------------|------------|-------------------|-----------|
| 두 `index.ts` 본문이 Deno 에서 컴파일된다 | QUAL-02 | `deno` 미설치 | 낭독 5항목: (1) import 가 `../_shared/*.ts` 확장자 포함 (2) 삭제한 로컬 함수의 잔여 호출 없음 (3) `SPIN_HH`/`SPIN_MM` 참조 0 (4) `respin` 의 OPTIONS 단락·`corsHeaders` 원문 그대로 (5) `spin` 의 `23505` 분기 원문 그대로 | `03-01-T4` |
| `useSettings` 훅 본문 | SETT-02·SETT-03 | React 렌더 하네스 미도입(§Q7) | 낭독 5항목: (0) 훅 반환이 `{ settings, loaded, error, warning }` 4필드이고 세 페이지의 `joinLoadErrors` 배열이 `[loadError, formatLoadError("설정", …), settingsWarning]` 3원소인가(W-10) (1) `error` → `failed` / `data ?? null` → `loaded` 분기 순서 (2) 채널명 `settings-changes`(기존 3채널과 분리) (3) cleanup 에 `removeChannel`, SELECT effect 에 `cancelled` (4) `settings` 쓰기 호출 0건 | `03-03-T3` |
| `stalled` 화면 문구·배너 합류 | SPIN-03·SETT-03 | `npm run dev` 금지(가드런처) | 소비처 9곳 `switch`+`never` 낭독 + `tsc` + grep. 화면 확인은 Phase 6 UI 검증에 위임 | `03-02-T3`, `03-03-T3` |
| 컷오버 전 "설정 불러오기 실패" 배너가 상시 표시된다 | SETT-03 | `settings` 테이블이 라이브에 없다(Phase 8 적용) | **배너가 뜨는 것이 정상이다.** 안 뜨면 에러를 삼키고 있는 것 — 역방향 신호로 쓴다(D-18) | `03-03-T3` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
