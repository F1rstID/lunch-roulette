---
phase: 01-safety-net
plan: 03
subsystem: testing
tags: [vitest, vite, rolldown, unit-test, kst, timezone, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "package-lock.json 재해상 + lock 이름 집합 불변 기준선 (신규 이름이 vitest 계열임을 대조할 수 있는 상태)"
  - phase: 01-02
    provides: "lib/errors.ts — 외부 의존 0 순수 모듈 (환경변수 없이 import 가능)"
provides:
  - "npm test = vitest run 하네스 (vitest 4.1.11 정확 버전 고정, devDependency)"
  - "vitest.config.mts — include 3개 글롭 + design/**·.planning/**·supabase/functions/!(_shared)/** 제외 + @/* alias"
  - "lib/time.ts·lib/phase.ts·lib/errors.ts 의 현재 동작을 고정한 회귀 테스트 26건"
  - "supabase/functions/_shared/**/*.test.ts 수집 경로 선점 — Phase 3 이 Deno 공유 순수 로직을 넣으면 설정 수정 없이 잡힌다"
affects: [01-04, 03-settings-phase, 05-restaurant-tab, 06-today-tab, 08-cutover]

# Tech tracking
tech-stack:
  added: [vitest@4.1.11]
  patterns:
    - "spec 은 vitest 에서 describe·it·expect 를 명시 import (globals: false) — tsconfig include 가 **/*.ts 라 spec 도 타입체크 대상이기 때문"
    - "고정 시각은 UTC 문자열 Date 로 만든다 — 페이크 타이머 없이 now 주입 seam 만 쓴다"
    - "테스트 이름은 한글로 '무엇이 참인지'를 적는다 (경계 하나당 it 하나)"
    - "러너 설정 파일은 .mts — package.json 에 type: module 이 없어 .ts 설정은 Vite configLoader 경고를 낸다"

key-files:
  created:
    - vitest.config.mts
    - lib/time.test.ts
    - lib/phase.test.ts
    - lib/errors.test.ts
    - .planning/phases/01-safety-net/01-03-SUMMARY.md
  modified:
    - package.json
    - package-lock.json
    - CLAUDE.md

key-decisions:
  - "vitest 를 4.1.11 로 정확 고정했다 — 사람이 승인한 라인이 4.x 이고, 최신 5.0.1 은 engines.node(^22.12 || ^24 || >=26)가 로컬 Node v25.6.1 과 맞지 않으며 optional peer @types/node(^22 || >=24)도 레포의 ^20 과 어긋난다"
  - "npm install -D vitest(캐럿 해상) 대신 --save-exact 를 썼다 — 01-01 이 세운 '직접 의존성은 정확 버전 고정' 컨벤션을 신규 패키지에도 적용"
  - "msToNextPhase 는 테스트하지 않았다 — 참조 0건 미사용 코드이고 Phase 3 이 lib/phase.ts 를 다시 쓰며 제거할 예정이라 계약을 고정하면 삭제를 방해한다 (spec 머리 주석에 이유 명시)"
  - "joinLoadErrors 의 빈 문자열 분기를 null 분기와 별도 it 으로 고정했다 — null 만 검사하면 빈 문자열 필터가 사라져도 초록이 유지된다"
  - "CLAUDE.md 는 두 문장만 고쳤다 (검증 명령 블록 + '테스트 인프라 없음'). 같은 줄의 lint 에러 문장은 Phase 8(SHIP-03) 소관이라 손대지 않았다"

patterns-established:
  - "러너 수집 경계 = tsconfig·eslint 제외 경계와 동일 (design/**·supabase/functions/**). 인덱서 OOM 전례를 러너에서도 재발시키지 않는다"
  - "어서션 유효성은 변이 점검으로 증명한다 — 소스를 일부러 깨 실패를 확인하고 git checkout 으로 즉시 원복 (커밋 금지)"
  - "신규 패키지 도입 시 lock '이름 집합' diff 를 기록한다 (before/after grep -o '\"node_modules/[^\"]*\"' | sort -u)"

requirements-completed: [QUAL-01]

# Metrics
duration: 9min
completed: 2026-09-18
---

# Phase 01 Plan 03: vitest 하네스 + 순수 모듈 계약 고정 Summary

**`npm test`(= `vitest run`)를 도입하고 환경변수 없이 import 되는 순수 모듈 3개의 현재 동작을 테스트 26건으로 못 박았다. Phase 3 이 `lib/phase.ts`를 다시 쓸 때 동작이 조용히 바뀌면 이제 빨간불이 뜬다.**

## Performance

- **Duration:** 약 9분 (Task 1 체크포인트는 이전 세션)
- **Started:** 2026-09-18T06:26Z (continuation 세션)
- **Completed:** 2026-09-18T06:35Z
- **Tasks:** 3 (Task 1 = blocking-human 체크포인트, Task 2 = RED, Task 3 = GREEN)
- **Files modified:** 7 (신규 4 + 수정 3)

## Accomplishments

- **하네스 도입.** `vitest@4.1.11`(정확 고정, devDependency) + `vitest.config.mts` + `npm test`/`npm run test:watch`. `npm test` exit 0, **Test Files 3 passed (3) / Tests 26 passed (26)**, 실행 119ms.
- **KST 계약 고정.** 날짜 키 자정 롤오버(UTC 14:59:59 → 당일 / 15:00:00 → 익일)·연 경계(2025-12-31T15:00Z → `"2026-01-01"`)·24시간제 포맷·`kstParts` 의 `hour % 24` 0시 보정·한글 긴 날짜 = 19건.
- **페이즈 경계 고정.** `currentPhase` 6건 — 자정 직후 / 11:54:59 / 11:55:00 / 11:55:04 / 11:55:05 / 23:59:59. 이 6줄이 Phase 3 전환의 회귀 기준선이다.
- **에러 조립 고정.** `formatLoadError` 2건 + `joinLoadErrors` 5건 (null·빈 문자열·혼합·복수 구분자 `" · "`).
- **수집 범위 봉쇄.** `npx vitest list` 가 정확히 3개 파일만 수집 — `design/`·`.planning/`·`supabase/functions/` 0건. 특히 워킹트리에 남아 있는 미추적 스크래치 `.planning/phases/01-safety-net/ref-parse.test.ts` 가 수집되지 않는다.
- **어서션 유효성 증명.** `SPIN_MM` 변이로 3건이 실제로 실패했고, 원복 후 26건 전부 초록. `lib/phase.ts` 최종 diff 0줄.
- **게이트 4종 exit 0:** `npm test` · `npx tsc --noEmit` · `npm run lint` · `npm run build`(Turbopack, 4 라우트 정적 생성). `npm audit` 도 **0 vulnerabilities** 유지.

## Task Commits

1. **Task 1: vitest 패키지 정당성 확인 (blocking-human 게이트)** — 커밋 없음 (확인 전용 태스크, 산출물 0)
2. **Task 2 (RED): 순수 모듈 spec 3개 작성 + 하네스 부재 확인** — `13f0b1b` (test)
3. **Task 3 (GREEN): vitest 하네스 구현 + 변이 점검** — `873cafe` (feat)

TDD 게이트 순서 `test(01-03)` → `feat(01-03)` 충족. 커밋 히스토리 AI 표기 **0건** (`git log $(git merge-base main HEAD)..HEAD --format=%B | grep -cE 'Co-Authored-By|Generated with|Claude-Session'` → 0).

## Task 1 — 패키지 정당성 감사 기록 (사람 승인)

RESEARCH.md 에 `## Package Legitimacy Audit` 표가 없어 `vitest` 는 `[ASSUMED]` 로 취급됐고, 설치 전 차단 게이트에서 아래를 확인했다.

| 확인 항목 | 결과 |
|---|---|
| `npm view vitest repository.url` | `git+https://github.com/vitest-dev/vitest.git` — 공식 저장소 일치 |
| `npm view vitest dist-tags.latest` | `5.0.1` |
| 4.x 최신 배포 | `4.1.11` (2026-08-18 배포) |
| 라이선스 | MIT |
| 주간 다운로드 | 94,501,079 |
| 메인테이너 | ariperkkio · antfu · hiogawa · oreanno · yyx990803 |
| 타이포스쿼트 대조 | `vitests` → E404 (존재하지 않음), `vite-test` 는 무관한 별개 실물 패키지 |
| 노출면 | devDependency 전용. `npm run build` 산출물·Vercel·Supabase 런타임에 포함되지 않음 |

**버전 적합성 판정:** `vitest@5.0.1` 은 이 환경에 맞지 않는다 — `engines.node` 가 `^22.12.0 || ^24.0.0 || >=26.0.0` 인데 로컬은 **Node v25.6.1**, optional peer `@types/node` 는 `^22 || >=24` 인데 레포는 `^20` 이다. `4.1.11` 은 양쪽 모두 충족한다.

**사람의 승인 신호(원문):** `approved, vitest@4` → 4.x 라인 승인. 이에 따라 설치 명령을 `npm install -D --save-exact vitest@4.1.11` 로 확정했다.

## RED 증거 (Task 2)

spec 3개를 쓴 상태에서 `npm test` 실행 — **exit 1**, 출력 원문:

```
npm error Missing script: "test"
npm error
npm error To see a list of scripts, run:
npm error   npm run
```

`npm test 2>&1 | grep -F 'Missing script'` 매치 확인 (grep exit 0). 환경: **Node v25.6.1 / npm 11.9.0**. 플랜이 예고한 대로 npm 11.x 는 따옴표까지 찍는다.

이 시점 소스 무변경 확인: `git status --porcelain lib/time.ts lib/phase.ts lib/errors.ts` → 0줄.

## GREEN — 해석된 버전과 수집 목록 (Task 3)

**설치:** `npm install -D --save-exact vitest@4.1.11` → `added 35 packages, changed 1 package, and audited 405 packages in 3s` / `found 0 vulnerabilities`. `npm ls vitest` → `vitest@4.1.11` (package.json `devDependencies` 에 캐럿 없이 `"vitest": "4.1.11"`).

**`npx vitest list | cut -d'>' -f1 | sort -u` — 정확히 3줄:**

```
lib/errors.test.ts
lib/phase.test.ts
lib/time.test.ts
```

전체 목록(26건) 원문은 `npx vitest list` 로 재생성 가능하며, 파일별 내역은 `lib/phase.test.ts` 6건 · `lib/time.test.ts` 13건 · `lib/errors.test.ts` 7건이다. 기본 리포터는 비-TTY 에서 `Test Files 3 passed (3)` 만 찍으므로 목록 확인에는 `vitest list` 를 썼다.

**설정 검증:** `grep -c 'design/\*\*' vitest.config.mts` = 1 · `grep -c '\.planning' vitest.config.mts` = 2 · `grep -c '_shared' vitest.config.mts` = 3. `node -e "...scripts.test==='vitest run'"` exit 0.

## lock 이름 집합 변화 (공급망 가드)

01-01 이 세운 방식 그대로 설치 직전/직후 스냅샷을 비교했다 (`grep -o '"node_modules/[^"]*"' package-lock.json | sort -u`).

| 항목 | 값 |
|---|---|
| 설치 전 이름 수 | 439 |
| 설치 후 이름 수 | 499 |
| **신규 (added)** | **60** (top-level 45 + `vite`/`vitest` 내부 중첩 15) |
| **제거 (removed)** | **0** |

신규 60개 중 **26개는 플랫폼별 optional 네이티브 바이너리**(`@rolldown/binding-*` 16개, `lightningcss-*` 10개)라 이 머신에서 실제 설치되는 것은 해당 플랫폼 것뿐이다. 나머지 실질 이름:

`vitest` · `@vitest/expect` · `@vitest/mocker` · `@vitest/pretty-format` · `@vitest/runner` · `@vitest/snapshot` · `@vitest/spy` · `@vitest/utils` · `vite` · `rolldown` · `@rolldown/pluginutils` · `@oxc-project/types` · `chai` · `assertion-error` · `expect-type` · `@types/chai` · `@types/deep-eql` · `@standard-schema/spec` · `es-module-lexer` · `estree-walker` · `pathe` · `tinybench` · `tinyexec` · `tinyrainbow` · `std-env` · `siginfo` · `stackback` · `obug` · `why-is-node-running` · `fsevents` · (중첩) `lightningcss` · `postcss` · `picomatch`

**플랜 예측과의 차이:** 플랜은 전이 의존성으로 `vite`·`esbuild`·`rollup` 이 따라온다고 적었지만, 실제로는 `vite` + **`rolldown`** 이며 `esbuild`·`rollup` 은 들어오지 않았다 (vitest 4 / Vite 8 계열이 번들러를 rolldown 으로 바꿨다). 이름 수가 60개로 늘어난 것도 rolldown·lightningcss 의 플랫폼별 바이너리 항목 때문이다. 노출면 판단(devDependency 전용, 프로덕션 번들 미포함)은 변하지 않는다. `npm audit` 은 설치 후에도 **0 vulnerabilities**.

## 변이 점검 (어서션 유효성 증명)

`lib/phase.ts` 의 `SPIN_MM` 을 `55 → 56` 으로 일시 변경 → `npm test` **exit 1**, `Test Files 1 failed | 2 passed (3)` / `Tests 3 failed | 23 passed (26)`.

실패한 테스트 3건 (전부 `lib/phase.test.ts > currentPhase`):

| 테스트 이름 | 어서션 실패 내용 |
|---|---|
| `11:55:00 정각부터 spinning 으로 넘어간다` | `expected 'accepting' to be 'spinning'` |
| `애니메이션 5초 이내(11:55:04)는 여전히 spinning 이다` | `expected 'accepting' to be 'spinning'` |
| `애니메이션이 끝나는 11:55:05 부터 decided 다` | `expected 'accepting' to be 'decided'` |

11:54:59·자정·23:59:59 경계는 1분 이동으로도 값이 바뀌지 않아 통과한 것이 정상이다 (변이가 경계 3개만 넘긴다).

**원복:** `git checkout -- lib/phase.ts` → `git status --porcelain lib/phase.ts` **0줄**, `grep -c "SPIN_MM = 55" lib/phase.ts` = **1**, `npm test` 재실행 **26건 전부 통과**. 변이 상태는 커밋되지 않았고 이 플랜의 최종 diff 에 `lib/phase.ts` 는 **한 줄도 없다** (`git log ... --grep='(01-03)' --name-only` 에 미등장).

## Files Created/Modified

- `vitest.config.mts` 신규 — node 환경, `globals: false`, include `lib/**`·`components/**`·`supabase/functions/_shared/**` 의 `*.test.ts`, exclude `node_modules`·`.next`·`design/**`·`.planning/**`·`supabase/functions/!(_shared)/**`, `resolve.alias` 정규식 `{ find: /^@\//, replacement: <repoRoot> }`.
- `lib/time.test.ts` 신규 (85줄) — `todayKstDate` 3 · `formatHhMm` 3 · `formatHhMmSs` 3 · `kstParts` 2 · `formatKstLongDay` 2.
- `lib/phase.test.ts` 신규 (33줄) — `currentPhase` 경계 6건. `msToNextPhase` 미언급(주석 제외 `grep -c` = 0).
- `lib/errors.test.ts` 신규 (40줄) — `formatLoadError` 2 · `joinLoadErrors` 5.
- `package.json` — `"test": "vitest run"`, `"test:watch": "vitest"`, `devDependencies.vitest = "4.1.11"`.
- `package-lock.json` — vitest 계열 60개 이름 추가, 제거 0.
- `CLAUDE.md` — 2줄 추가 / 1줄 삭제. 검증 명령 블록에 `npm test` 한 줄, "테스트 인프라 없음" 문장을 현재 상태로 교체.

## Decisions Made

플랜 대비 판단이 필요했던 지점만 적는다 (전체는 frontmatter `key-decisions`).

1. **`--save-exact` + 명시 버전.** 플랜 원문은 `npm install -D vitest` 였으나 그대로 실행하면 캐럿 해상으로 `5.0.1` 이 들어오고, 이는 사람이 승인한 4.x 라인이 아니며 `engines.node` 도 맞지 않는다. 체크포인트 응답(`approved, vitest@4`)과 01-01 의 정확 고정 컨벤션을 함께 만족하는 `--save-exact vitest@4.1.11` 로 확정했다.
2. **`kstParts` 첫 케이스는 `toEqual` 로 객체 전체를 비교했다.** 필드별 `toBe` 를 늘어놓으면 필드가 추가·삭제돼도 초록이 유지된다. 자정 케이스만 관심 필드 3개(`day`·`hour`·`weekday`)로 좁혔다.
3. **CLAUDE.md 의 lint 에러 문장은 그대로 뒀다.** 현재 `npm run lint` 는 에러 0이라 그 문장도 사실과 다르지만, 이 플랜이 잠근 계약은 "테스트 인프라" 두 문장이고 문서 전면 현행화는 Phase 8(SHIP-03) 소관이다. Phase 8 이 처리할 항목으로 넘긴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 설치 명령을 `--save-exact vitest@4.1.11` 로 고정**
- **Found during:** Task 3 (하네스 구현)
- **Issue:** 플랜의 `npm install -D vitest` 는 `dist-tags.latest` = `5.0.1` 을 캐럿(`^5.0.1`)으로 들여온다. 이는 (a) 사람이 승인한 4.x 라인이 아니고, (b) `engines.node`(`^22.12 || ^24 || >=26`)가 로컬 Node v25.6.1 과 맞지 않으며, (c) 01-01 이 세운 "직접 의존성 정확 고정" 컨벤션을 깬다.
- **Fix:** `npm install -D --save-exact vitest@4.1.11`
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm ls vitest` → `vitest@4.1.11`, `package.json` 에 캐럿 없음, `npm test` exit 0
- **Committed in:** `873cafe` (Task 3 커밋)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 설치 대상 패키지 이름은 그대로이고 버전 지정 방식만 체크포인트 승인 내용에 맞췄다. 스코프 증가 없음.

## Issues Encountered

- **플랜의 전이 의존성 예측(`vite`·`esbuild`·`rollup`)이 실제와 달랐다** — vitest 4 는 `rolldown` 기반이라 `esbuild`·`rollup` 이 들어오지 않고 대신 `rolldown` + 플랫폼별 네이티브 바이너리 26개가 붙는다. lock 이름 수 증가폭(60)이 예상보다 컸던 이유가 이것이고, 실질 신규 라이브러리는 34개다. 노출면 결론(devDependency 전용)은 그대로라 조치하지 않았다.
- **테스트 기대값과 런타임 불일치 0건.** 플랜이 표로 준 기대값을 쓰기 전에 로컬 Node ICU 로 전수 대조했고 전부 일치했다 — 특히 KST 자정이 `"24:00"` 이 아니라 **`"00:00"`** 임을 재확인했다. 구현을 고칠 일이 없었다 (Phase 1 동작 변경 금지 준수).

## Threat Flags

없음. 이 플랜은 네트워크 엔드포인트·인증 경로·스키마·RLS·Edge Function 을 하나도 만들지 않았다. 유일한 신뢰 경계(npm 레지스트리 → 로컬 `node_modules`)는 Task 1 blocking-human 게이트와 lock 이름 집합 기록으로 처리됐고(T-01-SC2), 러너 수집 범위 봉쇄로 T-01-09 도 닫혔다(수집 3개 실측).

## User Setup Required

None — 외부 서비스 설정 변경 없음. 다른 개발 환경에서는 `npm ci` 로 이 lock 을 재현하면 `npm test` 가 그대로 돈다.

## Next Phase Readiness

- **01-04 (parseMenuInput 테스트)**: 하네스가 준비됐다. `components/**/*.test.ts` 가 이미 include 에 있으므로 `components/MenuList.test.ts` 를 만들면 설정 수정 없이 수집된다. 워킹트리의 미추적 스크래치 `.planning/phases/01-safety-net/ref-parse.test.ts` 는 러너가 수집하지 않으며(exclude `.planning/**` 실측 확인), 01-04 가 정식 spec 으로 옮기고 정리할 대상으로 그대로 남겨 뒀다.
- **Phase 3 (설정 테이블·시각 주입)**: `lib/phase.test.ts` 6건이 회귀 기준선이다. 추첨 시각을 `settings` 에서 주입받게 바꾸면 이 spec 은 "하드코딩 11:55" 를 전제하므로 **의도적으로 함께 고쳐야 한다** — 그때 무엇이 바뀌는지가 diff 로 드러나는 것이 이 플랜의 목적이다. `msToNextPhase` 는 테스트가 없으니 자유롭게 제거할 수 있다.
- **Phase 3 (Deno 공유 로직)**: `supabase/functions/_shared/**/*.test.ts` 수집 경로를 선점해 뒀다. 공유 순수 로직(`kstNow` 중복 등)을 Deno import 없이 그 디렉터리에 두면 vitest 가 바로 집어간다.
- **주의 사항 하나:** `vitest.config.mts` 의 `supabase/functions/!(_shared)/**` 는 extglob 이다. `supabase/functions/**` 로 줄이면 include 의 `_shared` 항목이 통째로 무효화된다 — 설정에 한글 주석으로 못 박아 뒀다.

---
*Phase: 01-safety-net*
*Completed: 2026-09-18*

## Self-Check: PASSED

- 파일 5개 전부 FOUND (`vitest.config.mts`, spec 3개, 이 SUMMARY)
- 커밋 2개 전부 FOUND (`13f0b1b` test, `873cafe` feat)
- `lib/phase.ts` 최종 diff 0줄 (변이 원복 확인)
