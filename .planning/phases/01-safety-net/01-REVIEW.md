---
phase: 01-safety-net
reviewed: 2026-09-18T06:56:50Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - app/page.tsx
  - app/log/page.tsx
  - app/rank/page.tsx
  - components/ErrorBanner.tsx
  - components/MenuList.tsx
  - components/MenuList.test.ts
  - lib/constants.ts
  - lib/errors.ts
  - lib/errors.test.ts
  - lib/phase.test.ts
  - lib/time.test.ts
  - lib/supabase/client.ts
  - vitest.config.mts
  - package.json
  - CLAUDE.md
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-18T06:56:50Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 1 "안전망"의 산출물 15개 파일을 `git diff 49d0643..HEAD` 기준으로 검토했다. 리뷰어가 직접 실행해 확인한 사실:

- `npx tsc --noEmit` 통과, `npm run lint` 출력 0건(경고·에러 없음), `npm test` 4 파일 36 테스트 전부 통과, `npm audit` 0건. 설치된 버전은 `next@16.3.5`, `eslint-config-next@16.3.5`, `vitest@4.1.11`.
- `lib/phase.ts`·`lib/time.ts`는 base 와 byte-identical (diff 비어 있음). `components/Wheel.tsx`도 변경 없음.
- `app/page.tsx`의 realtime 핸들러 순서와 `initialLoadedRef` 가드는 손대지 않았다. 이번 diff 는 로드 effect 안에 `setLoadError(...)` 한 호출을 `initialLoadedRef.current = true` 앞에 추가했을 뿐이고, 기존 `setTodayResult(...)`/`if (menuRes.data)` 분기는 context 라인 그대로다. 휠 이중 회전 위험은 새로 생기지 않았다.
- `loadError`/`actionError` 는 분리된 state 이며, `ErrorBanner` 는 호출부가 조립한 문자열만 받는다. `formatLoadError` 는 `error.message` 만 읽고 `details`/`hint` 를 만지지 않으며, React 가 `{message}` 를 이스케이프하므로 XSS·키·URL 노출 경로는 확인되지 않았다.
- 어떤 spec 도 `lib/supabase/client.ts` 를 값으로 가져오지 않는다. `MenuList.tsx` 의 client import 는 `import type` 뿐이고, 나머지 전이 import(`lib/colors`, `lib/time`, `lib/constants`, `react`)는 환경변수를 읽지 않는다 — 정적으로 추적해 확인했다.
- `vitest.config.mts` 의 extglob `supabase/functions/!(_shared)/**` 은 vitest 의 globber(tinyglobby/picomatch)가 의도대로 해석한다. 스크래치 디렉터리에 합성 트리를 만들어 확인했고, `supabase/functions/**` 로 단순화하면 `_shared` 가 죽는다는 주석도 사실이다. 다만 아래 IN-01 참고 — 이 exclude 항목들은 include 가 이미 앵커돼 있어 실제로는 아무것도 걸러내지 않는다.
- `npm run build` 는 리뷰어가 실행하지 않았다(`.next/` 를 쓰는 작업이라 CLAUDE.md 의 dev 캐시 경고를 존중). 빌드 통과는 오케스트레이터의 검증 단계에 맡긴다.

Critical 은 없다. Warning 3건 중 2건(WR-01, WR-02)은 이번 phase 가 도입한 코드가 아니라 리뷰 범위 파일에 이미 있던 결함이다 — Phase 1 의 "동작 변경 금지" 원칙에 따라 이 phase 에서 고칠지, 해당 함수를 다시 만지는 phase 로 넘길지는 오케스트레이터가 정한다. 다만 WR-01 은 새 spec 의 주석이 결함을 "DB 제약의 거울"이라고 못 박고 있어, 최소한 주석은 이번에 바로잡아야 한다. WR-03 은 이번 phase 가 편집한 `CLAUDE.md` 가 거짓 진술을 그대로 남긴 것으로, 이 phase 에서 고쳐야 한다.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: 메뉴 이름 절단이 UTF-16 코드 유닛 기준이라 DB `char_length` 제약과 어긋나고, 이모지 경계에서 깨진 서로게이트를 만든다

**File:** `components/MenuList.tsx:38`, `app/page.tsx:165`, `components/MenuList.test.ts:3-4`
**Issue:** `piece.trim().slice(0, MENU_NAME_MAX_LEN)` 은 UTF-16 코드 유닛 24개를 자르지만, `supabase/migrations/0001_init.sql:4`·`0004_pinned_menus.sql:5` 의 `check (char_length(name) between 1 and 24)` 는 코드 포인트를 센다. BMP 밖 문자(이모지 등)가 24번째 자리에 걸치면 high surrogate 하나만 남는다. 리뷰어가 확인한 재현: `"가".repeat(23) + "🍕"` 는 코드 포인트 24개(DB 상으로는 합법)인데 `slice(0, 24)` 결과는 `가…가\ud83c` 로 `isWellFormed() === false`, `JSON.stringify` 는 `"\ud83c"` 를 보낸다. 이 값은 PostgREST 가 U+FFFD 로 치환해 저장하거나 400 으로 거부한다 — 어느 쪽이든 사용자가 입력한 이름이 아니다. `addMenus` 의 "방어적 재정규화"(`app/page.tsx:165`)도 같은 절단이라 두 번 잘라도 결과는 같다. 이 동작은 base 에도 있었지만, 새 spec 헤더(`MenuList.test.ts:3-4`)가 리터럴 24 를 "DB check 제약(char_length 1~24)의 거울"이라고 선언해 잘못된 등가를 계약으로 고정한다. Phase 5 가 이 함수를 매장 메뉴 입력에 재사용한다고 명시돼 있어 재사용 전에 바로잡아야 한다.
**Fix:** 코드 포인트 단위로 자른다. 기존 BMP 전용 spec 은 그대로 통과하고, 경계 케이스 spec 하나를 추가해 계약을 실제로 고정한다.
```ts
// components/MenuList.tsx (parseMenuInput) — app/page.tsx addMenus 도 동일하게
const name = Array.from(piece.trim()).slice(0, MENU_NAME_MAX_LEN).join("");

// components/MenuList.test.ts — 추가
it("24자 경계에 이모지가 걸쳐도 서로게이트 쌍을 자르지 않는다", () => {
  const out = parseMenuInput("가".repeat(23) + "🍕", []);
  expect(out).toEqual(["가".repeat(23) + "🍕"]);
  expect(out[0].isWellFormed()).toBe(true);
});
```
Phase 1 에서 동작을 바꾸지 않기로 결정하면, 최소한 spec 헤더의 "거울" 문구를 "BMP 문자에 한해 일치; 코드 포인트 절단은 Phase 5 에서" 로 고치고 이 항목을 Phase 5 계획에 옮겨 적어야 한다.

### WR-02: `respin()` 실패 배너가 Edge Function 이 보낸 실제 원인을 버리고 supabase-js 의 고정 문구만 보여준다

**File:** `app/page.tsx:211-215`
**Issue:** `supabase/functions/respin-roulette/index.ts:83,105` 는 실패 시 `{ error: menuErr.message }` / `{ error: upErr.message }` 를 500 으로 돌려준다. supabase-js 는 non-2xx 응답을 `FunctionsHttpError` 로 감싸는데, 그 `message` 는 설치된 `@supabase/functions-js/dist/module/types.js:69` 에서 확인한 대로 항상 `'Edge Function returned a non-2xx status code'` 고정 문자열이다. 따라서 사용자는 "다시 돌리기 실패: Edge Function returned a non-2xx status code" 만 보고, 서버가 알려준 이유(예: 메뉴 조회 실패, upsert 실패)는 `error.context`(Response) 안에 묻힌다. `RespinResponse` 타입에 `error?: string` 을 선언해 두고도 읽는 코드가 없다. 레포 품질 축 "메시지는 무엇이·왜 실패했는지를 담는다"에 어긋난다. base 에도 있던 결함이다.
**Fix:** HTTP 에러일 때 응답 본문을 한 번 읽어 서버 메시지를 우선 쓴다.
```ts
import { FunctionsHttpError } from "@supabase/supabase-js";
// …
const { data, error } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
if (error) {
  let reason = error.message;
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as RespinResponse | null;
    if (body?.error) reason = body.error;
  }
  setActionError(`다시 돌리기 실패: ${reason}`);
  return;
}
```

### WR-03: 이번 phase 가 편집한 `CLAUDE.md` 가 HEAD 기준 거짓인 진술 세 가지를 그대로 남겼다

**File:** `CLAUDE.md:26`, `CLAUDE.md:56`, `CLAUDE.md:60`, `CLAUDE.md:11`
**Issue:** `CLAUDE.md` 는 에이전트가 첫 번째로 읽는 정본 가이드다. 이번 diff 가 26행을 통째로 다시 썼는데도 다음이 남아 있다.
- **26행** "2026-09-15 기준 lint 에러 1건 존재 (`components/Wheel.tsx` `react-hooks/set-state-in-effect`)": 거짓. 리뷰어가 `npx eslint components/Wheel.tsx` 를 HEAD 와 base(`git show 49d0643:components/Wheel.tsx | eslint --stdin`) 양쪽에서 실행해 모두 exit 0 을 확인했고, 규칙은 여전히 error 레벨(`--print-config` 결과 `[2]`)이며 플러그인 버전도 7.1.1 로 동일하다. 즉 base 시점에 이미 거짓이었고 이번에 같은 줄을 편집하면서도 검증하지 않았다. "알려진 lint 에러 1건"이 있다고 믿는 에이전트는 새로 생긴 lint 에러를 그 1건으로 오인하고 넘길 수 있다.
- **56행** "`app/log`, `app/rank` realtime — INSERT만 구독 → 다시 돌리기(UPDATE)가 반영 안 됨": 거짓. 두 페이지 모두 base 시점부터 `UPDATE` 핸들러가 있다 (`app/log/page.tsx:70-77`, `app/rank/page.tsx:52-60`).
- **60행** "`addMenu`/`removeMenu`/`respin`은 supabase 에러를 확인하지 않는다 (조용히 실패)": 거짓. `actionError` 로 전부 표면화된다 (`app/page.tsx:170-175, 181-185, 212-220`). 함수명도 `addMenus` 다.
- **11행** 엔트리포인트 목록에 이번 phase 가 만든 `lib/constants.ts`(MENU_NAME_MAX_LEN 유일 정의처), `lib/errors.ts`, `components/ErrorBanner.tsx` 가 없다. 특히 상수를 `client.ts` 에서 옮긴 이유("환경변수 없이 import 가능")는 이 파일에 적혀 있어야 다음 작업자가 다시 `client.ts` 로 되돌리지 않는다.
**Fix:** 26행에서 lint 에러 문구를 삭제하고 "`npm run lint` 는 현재 0건"으로 바꾼다. 56행·60행을 삭제하거나 현재 상태(UPDATE 구독함 / `actionError`·`loadError` 두 배너로 표면화, 단 초기 로드 실패 시 재시도 없음)로 다시 쓴다. 11행 근처에 다음을 추가한다.
```md
- `lib/constants.ts` — 환경변수·클라이언트에 의존하지 않는 상수(`MENU_NAME_MAX_LEN`). client.ts 로 되돌리면 순수 함수 테스트가 깨진다.
- `lib/errors.ts` + `components/ErrorBanner.tsx` — 초기 SELECT 실패 문구 조립·표시. `error.message` 만 쓴다(details/hint 금지).
```

## Info

### IN-01: `vitest.config.mts` 의 exclude 항목 4개는 앵커된 include 때문에 실제로 아무것도 걸러내지 않는다

**File:** `vitest.config.mts:25-36`
**Issue:** include 가 `lib/**`, `components/**`, `supabase/functions/_shared/**` 로 루트에 앵커돼 있어 `.next/`, `design/`, `.planning/`, `supabase/functions/<기타>/` 아래 파일은 애초에 후보가 되지 않는다. 리뷰어가 스크래치 디렉터리에 8개 파일(각 경로에 하나씩)을 둔 합성 트리로 tinyglobby 를 돌린 결과, exclude 를 전부 비워도 수집 집합이 동일했다. 주석은 ".planning/phases/**/ref-parse.test.ts 가 수집되는 것을 막는다"고 하지만 그 파일은 지금 존재하지도 않고, 존재해도 include 에 걸리지 않는다. 한편 사용자 exclude 는 vitest 기본 exclude 를 **대체**하므로 `**/dist/**`, `**/{vite,vitest,…}.config.*` 같은 기본값은 사라졌다 — 현재 include 로는 무해하지만 include 를 넓히는 순간 되살려야 한다.
**Fix:** 두 가지 중 하나를 고른다. (a) 죽은 항목을 지우고 `exclude: ["**/node_modules/**"]` 만 남긴다. (b) 남기되 주석을 "include 를 넓힐 때를 대비한 방어선 — 현재 include 로는 no-op" 으로 고쳐, 나중에 누군가 이 항목이 뭔가를 막고 있다고 오해하지 않게 한다. 어느 쪽이든 `**/dist/**` 를 추가해 두면 기본값 소실을 메운다.

### IN-02: `formatLoadError` 는 빈 `error.message` 를 그대로 붙이고, `joinLoadErrors` 주석의 근거가 사실과 다르며, spec 이 "details/hint 미노출" 계약을 고정하지 않는다

**File:** `lib/errors.ts:10-19`, `lib/errors.test.ts`
**Issue:** (1) `error.message` 가 빈 문자열이면 `"메뉴 목록 불러오기 실패: "` 처럼 콜론 뒤가 비어 "왜"가 빠진 문장이 된다. (2) `joinLoadErrors` 의 주석 "라벨이 비어 만들어진 공백 조각" 은 성립하지 않는다 — `formatLoadError("", err)` 는 `" 불러오기 실패: x"` 를 돌려주므로 빈 문자열이 아니다. 빈 문자열 필터가 실제로 걸러내는 건 호출부가 `""` 를 직접 넣는 경우뿐이다. (3) 파일 헤더가 이 모듈의 보안 계약("details·hint 는 쓰지 않는다")을 명시하는데, `errors.test.ts` 는 `{ message }` 만 넣어 본다. 구조적 타입이라 `details`/`hint` 가 딸린 객체도 통과하므로, 누군가 `${error.message} (${error.hint})` 로 바꿔도 지금 spec 은 초록이다.
**Fix:**
```ts
// lib/errors.ts
export function formatLoadError(label: string, error: { message: string } | null): string | null {
  if (!error) return null;
  const why = error.message.trim() || "알 수 없는 오류";
  return `${label} 불러오기 실패: ${why}`;
}
// 주석: "호출부가 빈 문자열을 직접 넘긴 경우를 걸러낸다" 로 정정

// lib/errors.test.ts — 추가
it("details·hint 는 절대 문장에 섞이지 않는다", () => {
  const err = { message: "permission denied", details: "SELECT * FROM menus", hint: "check RLS" };
  const out = formatLoadError("메뉴 목록", err)!;
  expect(out).not.toContain(err.details);
  expect(out).not.toContain(err.hint);
});
it("message 가 비어도 이유 자리가 비지 않는다", () => {
  expect(formatLoadError("메뉴 목록", { message: "" })).toBe("메뉴 목록 불러오기 실패: 알 수 없는 오류");
});
```

### IN-03: `lib/phase.ts` 머리 주석의 경계가 코드·spec 과 1초 어긋난다 (이번 phase 에서는 파일 불변이 요구사항이라 Phase 3 로 이월)

**File:** `lib/phase.ts:3-5` (불변), `lib/phase.test.ts:22-28`
**Issue:** 주석은 "11:55:00 ~ 11:55:05 → spinning, 11:55:06 ~ → decided" 라고 적었지만 코드는 `total < spinAt + 5` 라 11:55:04 가 마지막 spinning 이고 11:55:05 부터 decided 다. 새 spec 은 코드를 정확히 고정했으므로(`:04 → spinning`, `:05 → decided`) 옳은 쪽은 spec 이다. `lib/phase.ts` 는 이번 phase 에서 byte-identical 이어야 하므로 여기서 고칠 수 없다.
**Fix:** Phase 3 가 `lib/phase.ts` 를 settings 주입 방식으로 다시 쓸 때 주석을 `11:55:00 ~ 11:55:04 → spinning, 11:55:05 ~ → decided` 로 정정하도록 Phase 3 계획에 한 줄 남긴다.

### IN-04: `formatHhMm`/`formatHhMmSs` 의 자정 `00:00` 은 `hour12: false` 의 ICU 매핑에 기대고 있어, spec 이 고정하는 것은 테스트 러너의 ICU 동작이다

**File:** `lib/time.test.ts:37-39, 51-53` (대상 `lib/time.ts:15-27`, 불변)
**Issue:** `kstParts` 는 `% 24` 로 24시를 방어하지만 두 포맷터는 `hour12: false` 만 쓴다. 이 옵션은 오래된 ICU(2020년 이전 Chrome/Node)에서 `h24` 로 해석돼 자정이 `24:00` 이 되던 이력이 있고, `kstParts` 의 `% 24` 가 바로 그 흔적이다. 리뷰어의 Node 25(ICU 78)에서는 `00:00` 이 나오므로 spec 은 통과하지만, 이 spec 이 보증하는 것은 브라우저가 아니라 러너 환경이다. `lib/time.ts` 가 이번 phase 에서 불변이라 여기서 고치지 않는다.
**Fix:** `lib/time.ts` 를 다음에 만질 때 `hour12: false` 를 `hourCycle: "h23"` 으로 바꾼다. 의미가 명시적이고 ICU 버전에 따른 해석 차이가 없다. spec 은 그대로 둔다(기대값이 같다).

### IN-05: 오늘 탭에서 세 쿼리가 같은 원인으로 실패하면 배너 한 줄에 같은 이유가 세 번 반복된다

**File:** `app/page.tsx:56-62`
**Issue:** 네트워크 단절처럼 셋 다 같은 `error.message` 로 실패하면 배너는 `"메뉴 목록 불러오기 실패: TypeError: Failed to fetch · 오늘 결과 불러오기 실패: TypeError: Failed to fetch · 고정 메뉴 불러오기 실패: TypeError: Failed to fetch"` 가 된다. 정직하긴 하지만 읽기 어렵고, 13px 한 줄 배너에서 잘려 마지막 항목이 안 보일 수 있다.
**Fix:** 호출부에서 원인이 전부 같으면 라벨을 합친다. 순수 함수로 두면 spec 도 붙일 수 있다.
```ts
// lib/errors.ts 에 추가
export function joinLoadErrorsByCause(entries: { label: string; error: { message: string } | null }[]): string | null {
  const failed = entries.filter((e) => e.error);
  if (failed.length === 0) return null;
  const causes = new Set(failed.map((e) => e.error!.message));
  if (causes.size === 1 && failed.length > 1) {
    return `${failed.map((e) => e.label).join("·")} 불러오기 실패: ${[...causes][0]}`;
  }
  return joinLoadErrors(failed.map((e) => formatLoadError(e.label, e.error)));
}
```

### IN-06: 로드 실패 배너는 닫기만 있고 재시도가 없어, 닫고 나면 realtime 으로 들어온 조각만 보이는 상태가 무표시로 남는다

**File:** `app/page.tsx:252`, `app/log/page.tsx:99`, `app/rank/page.tsx:71`
**Issue:** 초기 SELECT 가 실패해도 realtime 채널은 정상 구독되므로, 배너를 닫은 뒤 새로 INSERT 되는 메뉴는 `menus` 에 붙는다. 결과적으로 오늘 탭은 "원래 10개 중 실패 후 추가된 2개" 만 가진 목록으로 휠을 그리고, 당첨 메뉴가 그 2개에 없으면 `winnerIndex` 가 -1 이라 하이라이트도 사라진다. base 에서는 배너조차 없었으니 이번 phase 가 상황을 개선한 것은 맞지만, 사용자가 취할 수 있는 조치가 "새로고침"뿐이고 그 사실을 UI 가 말해주지 않는다.
**Fix:** 배너에 재시도 액션을 두고 로드 effect 를 재실행한다. 세 페이지가 같은 패턴이라 `ErrorBanner` 에 선택 prop 하나로 충분하다.
```tsx
// components/ErrorBanner.tsx
type Props = { message: string | null; onCloseAction: () => void; onRetryAction?: () => void };
{onRetryAction && <button type="button" onClick={onRetryAction} style={s.close}>다시 시도</button>}

// app/page.tsx (log·rank 동일)
const [loadAttempt, setLoadAttempt] = useState(0);
useEffect(() => { /* 기존 로드 */ }, [todayKey, loadAttempt]);
<ErrorBanner message={loadError} onCloseAction={() => setLoadError(null)} onRetryAction={() => setLoadAttempt((n) => n + 1)} />
```

---

_Reviewed: 2026-09-18T06:56:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
