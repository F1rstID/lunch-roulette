---
phase: 01-safety-net
plan: 01
subsystem: infra
tags: [next.js, npm-audit, dependencies, security, turbopack, eslint]

# Dependency graph
requires: []
provides:
  - "next 16.3.5 · eslint-config-next 16.3.5 정확 버전 고정 (캐럿 없음)"
  - "npm audit critical·high 0 — 실제로는 moderate·low까지 0 (total 0)"
  - "package-lock.json 재해상 완료 — 이후 모든 페이즈가 이 잠금 위에서 빌드된다"
affects: [01-02, 01-03, 01-04, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "직접 의존성은 --save-exact 정확 버전 고정 유지 (캐럿·틸드 금지)"
    - "비-force npm audit fix = lock 전이 재해상 전용. --force·npm update는 금지"
    - "의존성 변경 후 게이트 순서: rm -rf .next → tsc → lint → build → audit"

key-files:
  created:
    - .planning/phases/01-safety-net/01-01-SUMMARY.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "범프와 audit fix를 태스크별로 분리 커밋해 '범프 단독 효과'와 '잔여 정리 효과'를 히스토리에서 분리 측정 가능하게 했다"
  - "npm audit fix가 딸려 올린 @babel/* 13개·browserslist 데이터 3개는 되돌리지 않았다 — 전부 기존 semver 범위 안 이동이고 lock 패키지 이름 집합이 불변이라 공급망 위험이 늘지 않는다"
  - "Next 16 업그레이드 가이드 점검 결과 앱 소스 변경 0건 — 코드 수정 없이 종료 (files_modified 계약 준수)"

patterns-established:
  - "공급망 가드: audit fix 직전/직후 lock 패키지 '이름 집합' diff가 0줄이어야 한다 (버전 이동만 허용)"
  - "선언 범위 가드: git merge-base 기준선 대비 package.json 선언 변경은 의도한 패키지 줄만"

requirements-completed: [QUAL-03]

# Metrics
duration: 8min
completed: 2026-09-18
---

# Phase 01 Plan 01: next 16.3.5 보안 범프 Summary

**`next`·`eslint-config-next`를 16.2.6 → 16.3.5로 정확 버전 범프하고 비-force `npm audit fix`로 잔여 eslint 계열 전이 취약점까지 닫아 `npm audit`을 9건 → 0건으로 만들었다. 앱 소스는 한 줄도 바뀌지 않았다.**

## Performance

- **Duration:** 약 8분
- **Started:** 2026-09-18T05:54Z
- **Completed:** 2026-09-18T06:02Z
- **Tasks:** 2
- **Files modified:** 2 (`package.json`, `package-lock.json`)

## Accomplishments

- `next` 16.2.6 → **16.3.5** (dependencies, `--save-exact`), `eslint-config-next` 16.2.6 → **16.3.5** (devDependencies, `--save-exact`). 기존 "캐럿 없는 정확 버전 고정" 방식 유지.
- 범프만으로 **critical 1 / high 6 → critical 0 / high 3** (`postcss`·`sharp`·`nanoid` 해소).
- 비-force `npm audit fix` 1회로 잔여 3건까지 닫아 **최종 total 0** — 플랜 게이트(critical·high 0)를 넘어 moderate·low까지 0.
- 네 게이트 전부 exit 0: `npx tsc --noEmit`(출력 0줄) · `npm run lint`(에러·경고 0) · `npm run build`(Next 16.3.5 Turbopack, 4 라우트 정적 생성 성공) · `npm audit --audit-level=high`.
- 공급망 가드 3종 기계 검증 통과 — 선언 범위 변경 0줄(두 패키지 제외), lock 신규 패키지 이름 **0개**, 신규/제거 lock 경로 **0개**.

## Task Commits

1. **Task 1: next·eslint-config-next 16.3.5 범프** — `d1f1ec6` (chore)
2. **Task 2: 잔여 취약점 정리(비-force npm audit fix) + 로컬 검증 게이트** — `1d8ddf4` (chore)

이 플랜 커밋들이 건드린 파일 누적 목록 = `package.json`, `package-lock.json` 두 개뿐 (`git log $(git merge-base main HEAD)..HEAD --grep='(01-01)' --name-only`로 확인). 커밋 히스토리 AI 표기 **0건**.

## Files Created/Modified

- `package.json` — `dependencies.next`, `devDependencies["eslint-config-next"]` 두 줄만 `16.3.5`로. 다른 선언 무변경.
- `package-lock.json` — 두 패키지 범프 + 전이 의존성 25개 재해상. 패키지 이름 집합 불변.

## Audit 수치 (세 시점)

| 시점 | critical | high | moderate | low | total |
|---|---|---|---|---|---|
| 범프 전 (기준선) | 1 | 6 | 1 | 1 | 9 |
| 범프 후 (`d1f1ec6`) | 0 | 3 | 1 | 1 | 5 |
| audit fix 후 (`1d8ddf4`) | **0** | **0** | **0** | **0** | **0** |

**범프 전 9건 내역:** critical `next`(App Router Turbopack 미들웨어/프록시 우회 등 묶음) · high `postcss`·`sharp`·`nanoid`·`brace-expansion`·`browserslist`·`js-yaml` · moderate `baseline-browser-mapping` · low `@babel/core`.

**범프 후 잔여 3건(전부 high)** — 예측과 정확히 일치. 모두 `next` 업그레이드 경로 **밖**:
- `brace-expansion` — `eslint`→`minimatch@3` 경로와 `@typescript-eslint/typescript-estree`→`minimatch@10` 경로 2곳
- `js-yaml` — `eslint`→`@eslint/eslintrc`
- `browserslist` — `eslint-plugin-react-hooks`→`@babel/core`

## npm audit fix 실행 기록 (가드 근거)

**실행한 명령 원문:** `npm audit fix` — `--force` **사용 0회**, 실행 **정확히 1회**. `npm update`도 0회.
결과 출력: `changed 25 packages, and audited 370 packages` / `found 0 vulnerabilities`.

### 가드 (a) — 선언 범위 불변

`git diff package.json`(워킹트리) = **0줄**. Task 1이 이미 커밋된 상태라 예상대로이며, 비-force `npm audit fix`가 `package.json`을 건드리지 않았음을 뜻한다.

커밋 여부에 무관한 기계 판정 — `git diff --unified=0 $(git merge-base main HEAD) -- package.json | grep -E '^[+-][^+-]' | grep -vE '(next|eslint-config-next)'` → **0줄 출력**. 기준선 대비 선언 변경은 다음 4줄이 전부:

```
-    "next": "16.2.6",
+    "next": "16.3.5",
-    "eslint-config-next": "16.2.6",
+    "eslint-config-next": "16.3.5",
```

### 가드 (b) — lock 전이 재해상 표 (정본: 실제 diff)

`npm audit fix` 커밋(`1d8ddf4`)이 옮긴 25개. **신규·제거 경로 0개, 전부 버전 이동.**

| package | old | new | 비고 |
|---|---|---|---|
| js-yaml | 4.1.1 | 4.3.2 | **권고 해소** (high) |
| brace-expansion | 1.1.14 | 1.1.21 | **권고 해소** (high) |
| brace-expansion | 5.0.6 | 5.0.12 | **권고 해소** (high, `@typescript-eslint/typescript-estree` 중첩 경로) |
| browserslist | 4.28.2 | 4.29.0 | **권고 해소** (high) |
| @babel/core | 7.29.0 | 7.29.7 | **권고 해소** (low) |
| baseline-browser-mapping | 2.10.31 | 2.11.25 | **권고 해소** (moderate) |
| update-browserslist-db | 1.2.3 | 1.3.3 | browserslist 동반 |
| caniuse-lite | 1.0.30001793 | 1.0.30001810 | browserslist 데이터 |
| electron-to-chromium | 1.5.359 | 1.5.431 | browserslist 데이터 |
| node-releases | 2.0.44 | 2.0.56 | browserslist 데이터 |
| @babel/code-frame | 7.29.0 | 7.29.7 | @babel/core 동반 |
| @babel/compat-data | 7.29.3 | 7.29.7 | @babel/core 동반 |
| @babel/generator | 7.29.1 | 7.29.8 | @babel/core 동반 |
| @babel/helper-compilation-targets | 7.28.6 | 7.29.7 | @babel/core 동반 |
| @babel/helper-globals | 7.28.0 | 7.29.7 | @babel/core 동반 |
| @babel/helper-module-imports | 7.28.6 | 7.29.7 | @babel/core 동반 |
| @babel/helper-module-transforms | 7.28.6 | 7.29.7 | @babel/core 동반 |
| @babel/helper-string-parser | 7.27.1 | 7.29.7 | @babel/core 동반 |
| @babel/helper-validator-identifier | 7.28.5 | 7.29.7 | @babel/core 동반 |
| @babel/helper-validator-option | 7.27.1 | 7.29.7 | @babel/core 동반 |
| @babel/helpers | 7.29.2 | 7.29.7 | @babel/core 동반 |
| @babel/parser | 7.29.3 | 7.29.8 | @babel/core 동반 |
| @babel/template | 7.28.6 | 7.29.7 | @babel/core 동반 |
| @babel/traverse | 7.29.0 | 7.29.8 | @babel/core 동반 |
| @babel/types | 7.29.0 | 7.29.8 | @babel/core 동반 |

플랜의 사전 예측(js-yaml·brace-expansion×2·browserslist·update-browserslist-db·@babel/core 6건)은 전부 적중했고, 여기에 `@babel/*` 나머지 13개 + browserslist 데이터 3개 + `baseline-browser-mapping` 1개가 semver 범위 안에서 함께 올라왔다. 가드 (c)가 0개를 확인했으므로 정상 범위로 판정하고 되돌리지 않았다.

### 가드 (c) — 신규 패키지 이름 0개 (T-01-SC 대응)

`diff "${TMPDIR:-/tmp}/lock-names-before.txt" <(grep -o '"node_modules/[^"]*"' package-lock.json | sort -u)` → **0줄 출력** (스냅샷 439개 이름, exit 0).
독립 교차검증으로 lock `packages` 맵을 커밋 전/후 비교한 결과도 **ADDED PATH 0 / REMOVED PATH 0**. 즉 audit fix는 새 패키지를 단 하나도 들이지 않았고 버전만 옮겼다. 신규 패키지 도입은 01-03 blocking 체크포인트로 남는다.

## Next 16 업그레이드 문서 확인 (AGENTS.md 지시)

`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` 전체 헤딩 45개를 훑고, breaking 표시 항목을 이 앱 소스에 대조했다.

**결론: 해당 없음 — 앱 소스 변경 필요 항목 0건.** 근거 (grep 히트 0건으로 기계 확인):

| 가이드 항목 | 이 앱의 상태 |
|---|---|
| Async Request APIs (`cookies`/`headers`/`draftMode`/`params`/`searchParams`) | 전 파일 `"use client"`. 호출 0건 |
| `middleware` → `proxy` | `middleware.ts`·`proxy.ts` 없음 |
| `next/image` 변경 5건 (로컬 쿼리스트링·`minimumCacheTTL`·`imageSizes`·`qualities`·로컬 IP 제한) | `next/image` import 0건 |
| Turbopack 기본화 / webpack config 충돌 | `next.config.ts`에 이미 top-level `turbopack` 사용, `webpack` 키 없음 |
| Turbopack config 위치 (`experimental.turbopack` → top-level) | 이미 top-level |
| ESLint Flat Config / `next lint` 제거 | 이미 `eslint.config.mjs` + `"lint": "eslint"` |
| Scroll Behavior Override | `scroll-behavior` CSS 0건 → 영향 없음 |
| Caching APIs (`revalidateTag`/`updateTag`/`refresh`/`cacheLife`) | 호출 0건 |
| Runtime Configuration 제거 (`getConfig`) | 사용 0건 |
| `unstable_` 접두 제거, `unstable_rootParams` | `unstable_` 0건 |
| Parallel Routes `default.js` 필수 | 병렬 라우트 없음 (`app/`: layout·page 3개뿐) |
| AMP 제거, `next/legacy/image`, `images.domains` | 사용 0건 |
| 메타데이터 라우트 async params (`icon`/`opengraph-image`/`sitemap`) | 해당 파일 없음 |
| Node 20.9+ / TypeScript 5+ | 빌드·tsc 통과로 충족 확인 |

참고(조치 불필요): 16.3 가이드는 `AGENTS.md`의 managed block이 최신 문안으로 갱신될 수 있다고 안내한다. 이 레포의 블록은 구 문안이지만 **`next dev`가 실행될 때 Next가 스스로 재작성**하며, 이 플랜의 `files_modified`는 두 파일뿐이므로 건드리지 않았다. `npm run dev` 금지 규칙과도 맞물리니 문서 현행화 페이즈(Phase 8 계열)에서 다루면 된다.

## Decisions Made

- **범프와 audit fix를 분리 커밋.** GSD 태스크별 커밋 기본값을 따르되, 그 덕에 "범프 단독으로 어디까지 닫히는가"(critical 0/high 3)가 히스토리에 남았다. 다음에 같은 판단을 할 때 재측정이 불필요하다.
- **audit fix가 딸려 올린 19개 동반 패키지를 되돌리지 않음.** 전부 기존 semver 범위 안 이동이고 이름 집합이 불변이라 공급망 노출이 늘지 않는다. 되돌리려면 lock을 수동 편집해야 하는데 그 편이 재현성 면에서 더 나쁘다.
- **앱 소스는 손대지 않음.** 업그레이드 가이드 대조 결과 해당 항목이 없었고, 있었더라도 플랜 지시는 "코드를 고치지 말고 SUMMARY에 적고 보고"였다.

## Deviations from Plan

None — plan executed exactly as written. 자동 수정(Rule 1~3) 발동 0건, 아키텍처 질의(Rule 4) 0건.

## Issues Encountered

None. 범프·audit fix·네 게이트 모두 1회 실행으로 통과했다. 빌드 전 `rm -rf .next`를 플랜 지시대로 선행해 과거 stale Turbopack 캐시 전례를 회피했고, 빌드는 Compiled 1.2초 / 정적 6페이지 236ms로 정상 종료했다.

## Threat Model 이행

| Threat ID | 이행 결과 |
|---|---|
| T-01-01 (Tampering, next 설치) | `--save-exact`로 정확 버전만 지정, 신규 이름 도입 0. `npm ls next eslint-config-next`가 `16.3.5` 두 줄만 출력하고 `UNMET`·`invalid` 표기 없음. lock 동일 커밋 포함 |
| T-01-02 (EoP, 전이 취약점) | 비-force `audit fix` 1회로 잔여 3건 해소. `npm audit --audit-level=high` exit 0, 기계 판정 `critical+high=0` exit 0 |
| T-01-03 (DoS, 빌드 회귀) | `rm -rf .next` 후 `npm run build` exit 0. `npm run dev` 실행 0회 |
| T-01-SC (공급망) | 가드 (c) lock 이름 집합 diff 0줄 + `packages` 맵 경로 diff 0건으로 기계 검증 |

**라이브 무변경 확인:** `git status --porcelain supabase` **출력 없음**. 마이그레이션 실행 0회, Edge Function 배포 0회, `main` 커밋 0건.

## User Setup Required

None — 외부 서비스 설정 변경 없음. 다른 개발 환경에서는 `npm ci`로 이 lock을 그대로 재현하면 된다.

## Next Phase Readiness

- **01-02(같은 wave, 에러 배너)**: 이 플랜은 `app/`·`components/`·`lib/`를 건드리지 않았으므로 병렬 충돌 없음. 16.3.5 위에서 `tsc`·`lint`·`build`가 통과함이 확인돼 곧바로 진행 가능.
- **01-03(vitest 하네스)**: 새 패키지(`vitest` 계열)를 들이는 첫 지점이다. 이 플랜이 lock 이름 집합을 불변으로 유지했으므로, 01-03의 blocking 체크포인트에서 "새로 들어온 이름"이 곧 vitest 계열인지 그대로 대조할 수 있다.
- **잔여 우려 없음** — moderate·low까지 0이라 Phase 8 PR 설명에 넘길 잔여 권고가 없다.
- **재현 메모:** `npm install`을 다시 돌리면 캐럿 범위 패키지(`@supabase/supabase-js` 등)가 움직여 audit 수치가 바뀔 수 있다. 검증은 `npm ci` 기준으로 볼 것.

## Self-Check: PASSED

- 파일 존재: `package.json` · `package-lock.json` · `01-01-SUMMARY.md` 전부 FOUND
- 커밋 존재: `d1f1ec6` · `1d8ddf4` 전부 FOUND
- 아티팩트 내용: `package.json`에 `"next": "16.3.5"`, `package-lock.json`에 `next-16.3.5.tgz` 전부 FOUND

---
*Phase: 01-safety-net*
*Completed: 2026-09-18*
