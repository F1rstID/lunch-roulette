---
phase: 01-safety-net
plan: 02
subsystem: ui
tags: [error-handling, supabase, client-component, inline-style, a11y]

# Dependency graph
requires: []
provides:
  - "lib/errors.ts — formatLoadError·joinLoadErrors 순수 헬퍼 (외부 의존 0, vitest가 환경변수 없이 import 가능)"
  - "components/ErrorBanner.tsx — role=alert 공용 에러 배너 (message null이면 미렌더)"
  - "오늘·기록·랭킹 3개 페이지의 초기 SELECT 실패가 한국어 배너로 표면화됨"
affects: [01-03, 05-restaurant-tab, 06-today-tab, 07-log-rank]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "읽기 실패(loadError)와 쓰기 실패(actionError)는 별도 state — 합치면 쓰기 성공이 읽기 실패를 지운다"
    - "에러 문자열은 고정 한국어 라벨 + error.message 만으로 조립 (details·hint·원시 객체 금지)"
    - "배너 컴포넌트가 '에러 없음'을 자체 흡수 — 호출부는 조건부 렌더를 반복하지 않는다"
    - "여러 쿼리 실패는 joinLoadErrors 로 한 배너에 합침 (구분자 ' · ')"

key-files:
  created:
    - lib/errors.ts
    - components/ErrorBanner.tsx
    - .planning/phases/01-safety-net/01-02-SUMMARY.md
  modified:
    - app/page.tsx
    - app/log/page.tsx
    - app/rank/page.tsx

key-decisions:
  - "loadError 를 actionError 와 분리했다 — 쓰기 성공 경로마다 setActionError(null) 이 호출되므로 한 state 를 공유하면 읽기 실패 메시지가 사용자 모르게 사라진다"
  - "lib/errors.ts 를 순수 모듈로 고정하고 에러 타입을 라이브러리에서 import 하지 않았다 — { message: string } 구조적 타입만 받아 01-03 vitest 가 supabase 로드 없이 그대로 import 한다"
  - "setLoadError 호출을 cancelled 가드 직후·데이터 반영 직전에 넣어 initialLoadedRef.current = true 가 IIFE 마지막 줄로 남게 했다 (휠 이중 회전 가드 보존)"
  - "app/page.tsx 하단 alertStyles 를 ErrorBanner 로 이사시키고 원본을 삭제해 스타일 중복을 0으로 만들었다 (값은 한 글자도 바꾸지 않음)"

patterns-established:
  - "신규 배너·알림은 ErrorBanner 재사용. 자체 role=alert 마크업을 다시 만들지 않는다"
  - "초기 SELECT 는 반드시 { data, error } 로 받는다 — { data } 단독 구조분해는 조용한 실패를 만든다"

requirements-completed: [QUAL-04]

# Metrics
duration: 7min
completed: 2026-09-18
---

# Phase 01 Plan 02: 초기 SELECT 에러 표면화 Summary

**3개 페이지가 `const { data } = await ...` 로 삼키던 초기 SELECT 에러를 순수 헬퍼(`lib/errors.ts`) + 공용 배너(`components/ErrorBanner.tsx`)로 표면화했다. 실패가 더 이상 "후보 0개 / 기록 0일"이라는 거짓 정상 화면으로 위장되지 않는다.**

## Performance

- **Duration:** 약 7분
- **Started:** 2026-09-18T06:06Z
- **Completed:** 2026-09-18T06:13Z
- **Tasks:** 3
- **Files modified:** 5 (신규 2 · 수정 3)

## Accomplishments

- `lib/errors.ts` 신규 — `formatLoadError(label, error)` / `joinLoadErrors(parts)`. 외부 클라이언트·React·`process.env` 참조 **0건**(기계 검증). 구분자는 `ERROR_SEPARATOR = " · "` 상수로 명시.
- `components/ErrorBanner.tsx` 신규 — `"use client"` + named export. `message`가 null이면 `null` 반환. `app/page.tsx` 의 기존 `alertStyles` 값(색·여백·radius 토큰)을 **한 글자도 바꾸지 않고** 이관해 시각 동일성 유지.
- `app/page.tsx` — 초기 `Promise.all` 세 쿼리(`menus`·`results`·`pinned_menus`)의 `error` 를 전부 읽어 라벨 `"메뉴 목록"`·`"오늘 결과"`·`"고정 메뉴"` 로 감싸 배너 하나로 합침. 기존 인라인 배너 마크업 → `ErrorBanner` 2개(loadError → actionError 순), 하단 `alertStyles` 삭제.
- `app/log/page.tsx`·`app/rank/page.tsx` — 단일 쿼리라 `formatLoadError` 만 사용(라벨 `"기록"`·`"랭킹"`), `<main className="wrap">` 첫 자식으로 배너 배치.
- 게이트 3종 전부 exit 0: `npx tsc --noEmit` (출력 0줄) · `npm run lint` (에러·경고 0) · `npm run build` (Next 16.3.5 Turbopack, 4 라우트 정적 생성, `rm -rf .next` 선행).

## Task Commits

1. **Task 1: `lib/errors.ts` + `components/ErrorBanner.tsx` 생성** — `20ee73a` (feat)
2. **Task 2: 오늘 탭 초기 로드 에러 표면화 + 배너 컴포넌트 교체** — `741d43a` (feat)
3. **Task 3: 기록·랭킹 탭 초기 SELECT 에러 표면화** — `4e33f2d` (feat)

이 플랜 커밋들이 건드린 파일 누적 목록 = `lib/errors.ts`, `components/ErrorBanner.tsx`, `app/page.tsx`, `app/log/page.tsx`, `app/rank/page.tsx` 5개. 플랜 `files_modified` 계약과 정확히 일치. 커밋 히스토리 AI 표기 **0건**.

## Files Created/Modified

| 파일 | 변화 |
|---|---|
| `lib/errors.ts` (신규, 21줄) | 순수 헬퍼 2개 + 구분자 상수 1개. 파일 머리 주석은 `//` 줄주석만 (순수성 grep 오탐 방지 전제) |
| `components/ErrorBanner.tsx` (신규, 52줄) | `role="alert"` 컨테이너 + 메시지 span + `aria-label="닫기"` 버튼. 하단 `const s = {...} satisfies Record<string, CSSProperties>` |
| `app/page.tsx` | +15/−4 (import 2줄, `loadError` state, `setLoadError` 블록, 배너 2개) / 인라인 배너 12줄·`alertStyles` 25줄 삭제 |
| `app/log/page.tsx` | +13/−2 (import 2줄, state, `{ data, error }`, 배너) |
| `app/rank/page.tsx` | +11/−2 (동일 패턴) |

## 동작 계약

| 상황 | 화면 |
|---|---|
| 세 쿼리 전부 성공 | 배너 없음 (`joinLoadErrors([null,null,null]) === null`) |
| `menus` 만 실패 | `메뉴 목록 불러오기 실패: {message}` |
| `menus`+`고정 메뉴` 동시 실패 | 두 문장을 ` · ` 로 이은 **배너 하나** |
| 오늘 결과가 아직 없음 | 배너 없음 — `maybeSingle()` 은 "없음"을 error 가 아닌 `data: null` 로 돌려준다 |
| 기록 탭에서 실패 후 다른 달로 이동해 성공 | 배너 자동 소멸 (성공 경로가 `null` 을 넣음) |
| 쓰기 실패 후 쓰기 성공 | `actionError` 만 사라지고 `loadError` 배너는 유지 |

## 검증 기록

### 기계 검증 (Task 1)

| 항목 | 결과 |
|---|---|
| 브랜치 | `feat/restaurant-roulette` ✓ (`main` 아님) |
| `export function formatLoadError` / `joinLoadErrors` | 각 1건 |
| 순수성 grep `grep -E "supabase\|process\.env\|react" lib/errors.ts \| grep -v "^\s*//" \| grep -v "^//"` | **0줄** |
| `components/ErrorBanner.tsx` 첫 줄 | `"use client";` ✓ |
| `role="alert"` / `aria-label="닫기"` / `satisfies Record<string, CSSProperties>` | 각 1건 |
| `onCloseAction` | 3건 (Props 타입 · 구조분해 · onClick) — 기준 "2 이상" 충족 |

### 기계 검증 (Task 2)

| 항목 | 결과 |
|---|---|
| `alertStyles` 잔존 | **0건** |
| `<ErrorBanner` | 2건 |
| `formatLoadError` | 4줄 (import 1 + 호출 3) — 기준 "3 이상" 충족 |
| `joinLoadErrors` | 2줄 (import + 호출) |
| 세 라벨 `메뉴 목록`·`오늘 결과`·`고정 메뉴` | 전부 존재 (57~59행) |
| 원시 에러 노출 grep | 아래 "기준 판정 정정" 참조 — 실질 0건 |

### 기계 검증 (Task 3)

| 항목 | `app/log/page.tsx` | `app/rank/page.tsx` |
|---|---|---|
| `const { data, error }` | 1 | 1 |
| `<ErrorBanner` | 1 | 1 |
| `formatLoadError` 호출부 (import 제외) | 1 | 1 |
| `removeChannel` | 1 | 1 (구독 정리 무변경) |
| 라벨 | `"기록"` (50행) | `"랭킹"` (33행) |

추가로 두 파일 diff에서 `postgres_changes`·`subscribe`·`removeChannel`·`payload` 를 포함한 변경 줄이 **0줄**임을 확인했다 — Realtime 핸들러는 손대지 않았다.

### 육안 확인 — 휠 이중 회전 가드 (플랜이 명시 요구한 항목)

`git diff app/page.tsx` 를 읽어 확인했다. `setLoadError(...)` 블록은 `if (cancelled) return;` **직후·데이터 반영 직전**에 삽입됐고, 그 아래

```
if (menuRes.data) setMenus(...)
setTodayResult(...)
if (pinRes.data) setPinnedNames(...)
initialLoadedRef.current = true;
```

네 줄은 diff에서 전부 **context 줄(± 없음)** 로 나타난다. 즉 데이터 반영 순서가 그대로이고 `initialLoadedRef.current = true` 가 여전히 초기 로드 IIFE의 마지막 줄이다. 원복 불필요.

### 최종 게이트

```
npx tsc --noEmit  → exit 0 (출력 0줄)
npm run lint      → exit 0 (에러·경고 0)
npm run build     → exit 0 (rm -rf .next 선행, Compiled 1.26s, 정적 6페이지 214ms, 라우트 / · /_not-found · /log · /rank)
git log $(git merge-base main HEAD)..HEAD --format=%B | grep -cE 'Co-Authored-By|Generated with|Claude-Session' → 0
git status --porcelain supabase → 출력 없음
```

## 기준 판정 정정 (기계 grep 2건)

플랜의 grep 기준 두 개가 문자적으로는 어긋나지만 **의도는 충족**한다. 숫자를 맞추려고 무관한 코드를 고치지 않았다.

**(1) Task 2 — 원시 에러 노출 grep이 1줄 출력 (기준: 0줄)**

`grep -En "JSON\.stringify\(.*error|\.details|\.hint" app/page.tsx` 가 잡은 유일한 줄:

```
276:  <span style={respinStyles.hint}>결과를 새로 뽑아 모두에게 반영돼요</span>
```

이건 에러의 `hint` 필드가 아니라 **"다시 돌리기" 버튼 옆 안내 문구의 스타일 키**다. `git merge-base main HEAD` 시점의 `app/page.tsx` 에서도 동일하게(272행) 잡히므로 **이 플랜이 만든 줄이 아니다**. 의도대로 좁힌 검사 `grep -En "JSON\.stringify\([^)]*[Ee]rror|[Ee]rror\.details|[Ee]rror\.hint"` 는 **0줄**이다. 기존 스타일 키 `respinStyles.hint` 의 이름을 바꾸는 건 이 플랜 범위 밖의 무관한 수정이라 하지 않았다 (T-01-04 는 실질 충족).

**(2) Task 3 — `grep -c "formatLoadError"` 가 2 (기준: 1)**

`grep -c` 는 **줄 수**를 센다. 플랜 자신이 지시한 `import { formatLoadError } from "@/lib/errors";` 줄이 함께 잡혀 필연적으로 2가 된다. 호출부만 세면(`grep 'formatLoadError' $f | grep -vc '^import'`) 두 파일 모두 정확히 **1**로, "단일 쿼리 = 호출 1회"라는 기준의 의도와 일치한다. 플랜 작성 시의 산술 누락으로 판단한다.

## Decisions Made

- **`loadError` / `actionError` 분리.** 쓰기 핸들러 4개(`addMenus`·`removeMenu`·`togglePin`·`respin`)가 성공할 때마다 `setActionError(null)` 을 호출한다. 한 state 로 합쳤다면 메뉴를 하나 추가하는 순간 읽기 실패 배너가 조용히 지워졌을 것이다 — 이 플랜이 없애려는 "조용한 실패"를 다른 모양으로 재도입하는 셈. 근거를 코드 주석으로 남겼다.
- **에러 타입을 라이브러리에서 import 하지 않음.** `{ message: string } | null` 구조적 타입으로만 받는다. 구조적 타이핑 덕에 호출부는 아무 변환 없이 그대로 넘기고, `lib/errors.ts` 는 외부 패키지 의존 0을 유지해 01-03 vitest 가 환경변수·브라우저 전역 없이 단독 import 할 수 있다.
- **`error.message` 만 노출.** `details`·`hint` 에는 SQL 조각과 테이블·컬럼명이 실린다(T-01-04). 배너 문자열은 고정 한국어 라벨 + `message` 조합으로만 조립하고, `ErrorBanner` 는 애초에 원시 에러 객체를 받지 않는 시그니처라 구조적으로 샐 경로가 없다.
- **배너가 "에러 없음"을 자체 흡수.** 호출부 3곳이 `{err && (...)}` 를 반복하지 않도록 `message === null → return null` 로 처리했다. 덕분에 오늘 탭의 배너 2개가 각각 4줄이 아닌 1줄이다.
- **`setLoadError` 위치를 데이터 반영 앞으로.** 뒤에 넣으면 `initialLoadedRef.current = true` 가 IIFE 마지막 줄이 아니게 된다. 그 줄은 realtime 이벤트가 "초기 로드인지 실시간 갱신인지" 구분하는 가드라 위치가 곧 계약이다.

## Deviations from Plan

None — plan executed exactly as written. 자동 수정(Rule 1~3) 발동 0건, 아키텍처 질의(Rule 4) 0건, 체크포인트 0건. 위 "기준 판정 정정" 2건은 코드 변경이 아니라 검증식 해석 기록이다.

## Issues Encountered

없음. 세 태스크 모두 첫 시도에 게이트를 통과했다. 빌드 전 `rm -rf .next` 를 선행해 과거 stale Turbopack 캐시로 인한 커널 패닉 전례를 회피했고(`npm run dev` 실행 0회), 빌드는 Compiled 1.26초 / 정적 6페이지 214ms로 정상 종료했다.

## Threat Model 이행

| Threat ID | 이행 결과 |
|---|---|
| T-01-04 (Information Disclosure, 배너 텍스트) | 배너 문자열 = 고정 라벨 + `error.message`. `JSON.stringify(error)`·`error.details`·`error.hint` **사용 0건**(좁힌 grep 0줄로 기계 확인). `ErrorBanner` 는 `message: string \| null` 만 받아 원시 객체가 도달할 수 없다 |
| T-01-05 (Information Disclosure, 환경변수) | `lib/errors.ts` 의 `process.env` 참조 **0건**(순수성 grep 0줄). 배너 경로 어디에서도 `NEXT_PUBLIC_*` 를 읽지 않는다 |
| T-01-06 (Tampering/XSS) | accept 유지 — `dangerouslySetInnerHTML` 신규 도입 0건. 에러 문자열은 JSX 텍스트 노드로 렌더돼 React가 자동 이스케이프한다 |
| T-01-07 (Repudiation, 조용한 실패) | 완화 완료 — 3개 페이지 전부 `{ data, error }` 로 받는다. `const { data } =` 단독 구조분해는 세 파일에서 0건 |

**라이브 무변경 확인:** `git status --porcelain supabase` **출력 없음**. 마이그레이션 실행 0회, Edge Function 배포 0회, `main` 커밋 0건, 패키지 설치 0건(공급망 위협면 불변).

## Known Stubs

없음. TODO·FIXME·placeholder·"준비 중" 문자열이 이 플랜의 5개 파일에 **0건**이며, 하드코딩된 빈 값이 UI로 흐르는 지점도 없다.

## Threat Flags

없음 — 네트워크 엔드포인트·인증 경로·파일 접근·스키마를 하나도 추가하지 않았다. 쿼리 모양과 권한은 그대로이고 기존 응답의 `error` 필드를 읽기 시작했을 뿐이다.

## User Setup Required

None — 외부 서비스 설정 변경 없음. 배너를 눈으로 확인하려면 브라우저 개발자도구에서 Supabase 요청을 차단하거나 `.env.local` 의 키를 일시적으로 망가뜨리면 되지만, **이 플랜의 수용 조건이 아니다**(런타임 확인은 01-03 이후 테스트가 대신한다).

## Next Phase Readiness

- **01-03(vitest 하네스, wave 2)**: `lib/errors.ts` 가 외부 의존 0으로 완성돼 `lib/errors.test.ts` 가 즉시 import 할 수 있다. 고정할 계약은 위 "동작 계약" 표 그대로 — 특히 `joinLoadErrors([null, null])` 이 빈 문자열이 아니라 `null` 이라는 점, 빈 문자열 조각이 걸러진다는 점, 구분자가 `" · "`(공백 포함) 라는 점.
- **01-04(`parseMenuInput` 회귀)**: 접점 없음. `.planning/phases/01-safety-net/ref-parse.test.ts` 는 untracked 로 그대로 뒀다(이 플랜이 건드리지 않음).
- **Phase 5~7(매장·오늘·기록 UI)**: 새 페이지·새 쿼리도 `{ data, error }` + `ErrorBanner` 패턴을 그대로 따르면 된다. 한 페이지에서 쿼리가 2개 이상이 되는 순간 `joinLoadErrors` 로 합친다(오늘 탭이 선례).
- **잔여 우려**: 없음. 다만 이 플랜은 **초기 SELECT** 만 덮는다 — Realtime 구독 실패(`subscribe` 상태 콜백)와 재연결 실패는 여전히 조용하다. 전환 후 실시간 동기화가 핵심이 되는 Phase 6~7에서 별도로 다룰 가치가 있다.

## Self-Check: PASSED

- 파일 존재: `lib/errors.ts` · `components/ErrorBanner.tsx` · `app/page.tsx` · `app/log/page.tsx` · `app/rank/page.tsx` · `01-02-SUMMARY.md` 전부 FOUND
- 커밋 존재: `20ee73a` · `741d43a` · `4e33f2d` 전부 FOUND
- 아티팩트 내용: `lib/errors.ts` 의 두 export, `components/ErrorBanner.tsx` 의 `"use client"`·`role="alert"`, 3개 페이지의 `<ErrorBanner` 전부 FOUND
- 삭제된 추적 파일: **0건** (`git diff --diff-filter=D --name-only HEAD~3 HEAD` 출력 없음)

---
*Phase: 01-safety-net*
*Completed: 2026-09-18*
