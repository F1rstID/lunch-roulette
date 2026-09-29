---
phase: 05-restaurants-tab
reviewed: 2026-09-29T01:17:53Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - lib/restaurants.ts
  - lib/restaurants.test.ts
  - lib/useRestaurants.ts
  - components/RestaurantList.tsx
  - app/restaurants/page.tsx
  - components/TopBar.tsx
  - lib/errors.ts
  - lib/errors.test.ts
  - lib/constants.ts
  - components/MenuList.tsx
  - components/MenuList.test.ts
  - app/page.tsx
findings:
  critical: 1
  warning: 4
  info: 13
  total: 18
fixed: 12
deferred: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-09-29T01:17:53Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 5(매장 탭) 산출물 12개 파일을 diff base `1f05c81` 기준으로 읽었다. 게이트 3종은 초록이다(`npx tsc --noEmit` exit 0 · `npm run lint` 에러 0 · `npm test` 279/279). 원격 Supabase·`npm install`·`npm run dev` 는 실행하지 않았다.

전체 구조(순수 모듈 ↔ I/O 훅 ↔ props 전용 컴포넌트 ↔ 페이지 핸들러)는 D-08·D-13·D-16·D-17 을 따르고, `parseLocationLink` 의 `http:`/`https:` 화이트리스트, `formatRestaurantWriteError` 의 `details`/`hint` 미노출, 쓰기 4종의 실패 → `actionError`·성공 → `setActionError(null)` 경로, 편집 저장 후 `setEditingId(null)` 이 Realtime 도착에 의존하지 않는 점, `TopBar` 탭 추가가 세 페이지의 `active` 리터럴을 깨지 않는 점(`app/log/page.tsx:113`·`app/rank/page.tsx:83`), `truncateToCodePoints` 도입이 BMP 문자열에 대해 기존 `slice` 와 동치인 점은 확인했다.

핵심 우려는 하나다. **`restaurantsReducer` 가 `lib/settings.ts` 의 단일행 논증("이벤트가 먼저 오면 그쪽이 더 새 값")을 목록에 그대로 복제했다.** 단일행에서는 UPDATE 이벤트가 전체 상태이지만 목록에서는 이벤트 하나가 전체 목록이 아니다. 초기 SELECT 응답보다 먼저 Realtime 이벤트가 한 건이라도 도착하면 SELECT 결과 전체가 버려지고(행 1개 또는 0개만 남음), 같은 창에서 SELECT 실패는 배너 없이 삼켜진다(CR-01). 그 외에는 입력 `maxLength` 의 코드유닛/코드포인트 불일치, 폼 `busy` 가 예외에 갇히는 경로, 로드 실패 시에도 "첫 매장을 등록해 보세요" 가 뜨는 빈 상태, 링크 화이트리스트 테스트 공백이 Warning 이다.

낭독으로 검토하고 **기각한 가설**(기록용): `useRestaurants` 의 인스턴스별 토픽이 React StrictMode 의 effect 이중 실행에서 같은 토픽으로 재사용돼 구독이 죽는지 — `@supabase/phoenix` `Channel.leave()` 는 아직 join 되지 않은 채널(`canPush()` 거짓)에서 `ok` 를 동기로 트리거해 `socket._remove` 까지 동기로 끝나므로, 두 번째 effect 의 `supabase.channel(topic)` 은 새 채널을 만든다. 문제 없음.

Realtime 구독 실패(`CHANNEL_ERROR`)가 조용한 점은 05-CONTEXT §deferred 에 따라 발견으로 올리지 않았다.

## Critical Issues

### CR-01: 초기 SELECT 응답보다 먼저 온 Realtime 이벤트가 목록 전체를 버리고 조회 실패를 삼킨다

**File:** `lib/restaurants.ts:117-153` (호출부 `lib/useRestaurants.ts:37-88`)
**Issue:** `changed` 분기 세 갈래가 모두 `loaded: true` 를 올리고(`:137`·`:142`·`:144`·`:151`), `loaded` 는 `state.loaded` 가 참이면 액션을 통째로 버린다(`:121`), `failed` 도 같다(`:126`). 훅은 SELECT(`useRestaurants.ts:42-48`)와 구독(`:58-84`)을 별개 effect 로 동시에 띄우므로, 다른 접속자의 INSERT/UPDATE/DELETE 가 SELECT 응답보다 먼저 도착하는 창이 매 마운트마다 열린다.

재현 시나리오(순수 리듀서 수준에서 결정적으로 재현된다):
1. `INITIAL_RESTAURANTS_STATE` → `{ type: "changed", event: "INSERT", row: ROW_B }` → `{ rows: [ROW_B], loaded: true }`.
2. 이어서 SELECT 응답 `{ type: "loaded", rows: [ROW_A, ROW_B, ...50개] }` → `:121` 에서 무시 → 화면 목록은 **ROW_B 하나**. 새로고침 전까지 복구 경로 없음. DELETE 가 먼저 오면 `rows: []` + `loaded: true` 가 되어 카탈로그가 통째로 빈 목록으로 보인다.
3. 같은 순서에서 SELECT 가 실패하면 `failed` 도 `:126` 에서 무시 → `error` 는 `null` 그대로 → **배너 없음**. `:132-133` 의 주석("이벤트 하나가 도착했다는 사실이 목록 전체를 읽을 수 있다는 증거는 아니라서")이 이미 이 사실을 인정하면서도 `loaded` 를 올리는 자기모순이다. B-5(정직한 에러 처리) 위반.

`lib/settings.ts:78-81` 의 논증은 단일행이라 성립한다(UPDATE 페이로드 = 전체 상태). 목록에는 옮겨 오면 안 되는 논증이다. 현재 테스트에는 "loaded 전에 changed" 시나리오가 없어(`lib/restaurants.test.ts:261-322`) 이 결함이 초록 뒤에 숨어 있다.

**Fix:** 조회 전 이벤트를 버퍼에 쌓고 조회 결과 위에 순서대로 재적용한다. `loaded` 는 오직 `loaded`/`failed` 만 올린다.
```ts
type Change =
  | { event: "INSERT" | "UPDATE"; row: RestaurantRow }
  | { event: "DELETE"; id: string | null };

export type RestaurantsState = {
  rows: RestaurantRow[];
  loaded: boolean;
  error: string | null;
  // 조회 응답 전에 도착한 이벤트. 응답이 오면 그 위에 도착 순서대로 재적용한다 — 이벤트 하나는 목록 전체가 아니다.
  pending: Change[];
};

function applyChange(rows: RestaurantRow[], c: Change): RestaurantRow[] {
  if (c.event === "DELETE") return c.id === null ? rows : rows.filter((r) => r.id !== c.id);
  if (c.event === "INSERT") return rows.some((r) => r.id === c.row.id) ? rows : [...rows, c.row];
  return rows.map((r) => (r.id === c.row.id ? c.row : r));
}

case "loaded": {
  if (state.loaded) return state;
  const rows = state.pending.reduce(applyChange, action.rows);
  return { rows, loaded: true, error: null, pending: [] };
}
case "failed":
  if (state.loaded) return state;
  // 부분 목록을 정상처럼 보이지 않게 비운다. 실패는 배너로 남긴다.
  return { rows: [], loaded: true, error: action.message, pending: [] };
case "changed": {
  const change: Change = action.event === "DELETE" ? { event: "DELETE", id: action.id } : { event: action.event, row: action.row };
  if (!state.loaded) return { ...state, pending: [...state.pending, change] };
  return { ...state, rows: applyChange(state.rows, change) };
}
```
테스트 추가: (a) `changed(INSERT ROW_B)` → `loaded([ROW_A])` ⇒ `rows` 가 `[ROW_A, ROW_B]`; (b) `changed(DELETE r1)` → `loaded([ROW_A, ROW_B])` ⇒ `[ROW_B]`; (c) `changed(INSERT)` → `failed("boom")` ⇒ `error === "boom"`. 기존 "늦게 온 loaded/failed 무시" 두 테스트(`:278-286`)는 그대로 통과한다.

**처리:** ✅ fixed `f4cd828` — 조회 전 이벤트를 `pending` 에 쌓아 조회 결과 **위에** 도착 순서대로 재적용하고, `loaded` 는 `loaded`/`failed` 만 올린다. 병합 규칙은 `applyChange` 한 곳으로 모았다. 순서 고정 테스트 4건(INSERT/UPDATE/DELETE 선행 + 선행 이벤트 뒤 `failed` 가 배너를 세우는지). 늦게 온 `loaded`/`failed` 를 버리는 기존 가드는 그대로 뒀다 — `loaded` 를 올리는 액션이 둘뿐이 되어 같은 창의 조회 실패를 삼키는 경로가 사라졌고, 그 가드가 지키는 것은 이제 중복 응답뿐이다.

## Warnings

### WR-01: 이름·위치 입력의 `maxLength` 가 코드유닛으로 세어 DB 가 허용하는 값을 먼저 막는다

**File:** `components/RestaurantList.tsx:191`, `:207`
**Issue:** HTML `maxlength` 는 UTF-16 코드유닛 단위다. `maxLength={MENU_NAME_MAX_LEN}`(24)은 이모지 1개를 2로 세므로, `parseRestaurantForm` 과 테스트(`lib/restaurants.test.ts:99` "DB 가 허용하는 값을 먼저 막지 않는다")가 보장한다고 선언한 24 코드포인트 이름(예: `"가".repeat(23) + "🍕"`, 25 코드유닛)을 브라우저가 입력 단계에서 거부한다. 위치 필드(`:207`, 200)도 같다. 코드포인트 절단(D-14)을 도입한 목적과 정반대 방향의 불일치이고, 편집 모드에서는 저장된 값이 상한을 넘으면(이모지 포함 위치 등) 폼이 "지우기만 가능" 상태로 열린다. 실사용 빈도는 낮지만 선언된 불변식이 컴포넌트에서 깨진다(B-7). 부차적으로, 붙여넣기 절단이 코드유닛 경계에서 일어나는 브라우저에서는 lone surrogate 가 `Array.from` 길이 검사를 통과해 DB 까지 가서 400 으로 튕긴다.
**Fix:** 이름·위치의 `maxLength` 를 제거하고 `parseRestaurantForm` 의 거절 메시지에 맡긴다(이미 사용자에게 이유를 말해 준다). 상한 힌트가 필요하면 `maxLength={MENU_NAME_MAX_LEN * 2}` 처럼 코드유닛 여유를 주고 그 이유를 주석으로 남긴다. 메뉴 입력(`:199`, 120)은 원소 상한이 아니라 입력창 상한이라 그대로 둬도 된다.

**처리:** ✅ fixed `5b6c414` — 이름·위치의 `maxLength` 를 제거하고 이유를 주석으로 남겼다(코드유닛 ↔ 코드포인트 불일치). 초과 판정은 `parseRestaurantForm` 한 곳이 이유까지 말한다. 메뉴 입력창 120 은 IN-05 로 이월.

### WR-02: 폼 제출·삭제 확인이 예외 경로에서 `busy`/확인 상태에 갇힌다

**File:** `components/RestaurantList.tsx:168-170`, `:99-103`
**Issue:** `setBusy(true); const ok = await onSubmit(...); setBusy(false);` 에 `try/finally` 가 없다. `onSubmit` 이 던지면 `busy` 가 영원히 참이 되어 "등록/저장" 버튼이 비활성으로 잠기고, 예외는 unhandled rejection 으로 새어 배너도 없다. `DeleteConfirm` 의 `onConfirm`(`:101-102`) 도 같은 형태다. supabase-js 는 fetch 실패를 `{ error }` 로 돌려주므로 평소에는 던지지 않지만, 같은 레포의 `app/page.tsx:236-244` 가 정확히 이 이유("예상 밖 throw 가 여기서 빠져나가면 배너 없는 unhandled rejection")로 `try/catch/finally` 를 두고 있다. 새 코드가 그 규약을 따르지 않았다(B-5·B-9).
**Fix:**
```ts
setBusy(true);
let ok = false;
try {
  ok = await onSubmit(parsed.input);
} catch (e) {
  setFormError(e instanceof Error ? e.message : String(e));
} finally {
  setBusy(false);
}
if (!ok) return;
```
`DeleteConfirm.onConfirm` 도 `try { await onRemoveAction(...) } finally { setConfirmingId(null) }` 로 감싼다.

**처리:** ✅ fixed `ec2b0f3` — 폼 제출을 `try/catch/finally` 로 감싸 `busy` 를 반드시 풀고 예외 문구를 폼 옆에 띄운다. `DeleteConfirm.onConfirm` 은 `finally` 로 확인 상태를 닫는다. 페이지 쓰기 4종도 본문을 `try/catch` 로 감싸 throw 가 `actionError` 배너로 착지한다.

### WR-03: 로드 실패·로드 전에도 "아직 등록된 매장이 없어요 · 첫 매장을 등록해 보세요" 가 뜬다

**File:** `components/RestaurantList.tsx:72-80` (호출부 `app/restaurants/page.tsx:24`, `:147-153`)
**Issue:** 빈 상태 분기는 `items.length === 0` 만 본다. 리듀서는 "실패를 '매장 0개' 로 위장하지 않는다"(`lib/restaurants.ts:127`)고 `error` 를 남기지만, 컴포넌트는 `loaded`/`error` 를 받지 않아 실패 시 배너 바로 아래에 등록을 권하는 문구를 그린다. 컷오버 전 라이브(테이블 없음, PGRST205)에서는 이 조합이 **상시** 화면이고, 컷오버 후에도 일시 실패마다 사용자를 등록 시도(→ 다시 실패)로 유도한다. 05-02 SUMMARY 편차 1 이 `loaded` 미사용을 "스켈레톤 없음" 으로 정당화했지만 실패 상태는 그 결정의 범위 밖이다(B-5·B-6).
**Fix:** 훅이 이미 주는 `loaded`·`error` 를 페이지에서 구조분해해 `RestaurantList` 에 `status: "loading" | "failed" | "ready"` 로 넘기고, 빈 상태 문구는 `status === "ready" && items.length === 0` 일 때만 렌더한다. `failed` 에는 문구를 생략(배너가 이미 설명)하거나 "목록을 불러오지 못했어요" 한 줄만 둔다.

**처리:** ✅ fixed `0fed1da` — 훅이 주는 `loaded`·`error` 를 페이지가 `status: "loading" | "failed" | "ready"` 로 좁혀 넘긴다. 등록 권유는 `ready` + 0개에서만, 로드 전은 "불러오는 중…", 실패는 목록 영역을 비우고 배너만 남긴다(05-02 편차 1 해소).

### WR-04: 링크 화이트리스트 테스트가 `javascript:` 한 건뿐이다

**File:** `lib/restaurants.test.ts:200-223`
**Issue:** `parseLocationLink` 는 `<a href>` 로 나가는 값의 **유일한** 보안 경계다(`lib/restaurants.ts:65-66`). 그런데 테스트는 `javascript:` 만 검사한다. 05-CONTEXT §특히 볼 것 (4) 가 명시한 `data:`·프로토콜 상대(`//host/x`) 는 없고, 대소문자 스킴(`HTTPS://`, `JAVASCRIPT:`)·`ftp:`/`mailto:`·앞뒤 공백(`"  https://x  "`) 도 없다. 현재 구현은 이 입력들을 올바르게 처리하지만(직접 확인: `new URL("//x")` 는 base 없이 throw, `url.protocol` 은 소문자 정규화), 회귀 시 검출할 단언이 없다. 같은 파일에서 `parseRestaurantForm` 의 `"\r"` 개행(`:39` 는 `\r` 도 거절)과 "김밥, , 라면" 같은 혼합 빈 원소(D-18 "빈 원소")도 이 함수 수준에서는 단언이 없다(C-10).
**Fix:** 다음 케이스를 추가한다.
```ts
it.each(["data:text/html,<script>1</script>", "//evil.example/x", "ftp://x", "mailto:a@b", "JAVASCRIPT:alert(1)"])(
  "%s 는 링크가 아니다", (v) => expect(parseLocationLink(v)).toBeNull());
it("대문자 스킴은 정규화되어 링크다", () =>
  expect(parseLocationLink("HTTPS://Naver.me/x")).toEqual({ href: "https://naver.me/x", host: "naver.me" }));
it("앞뒤 공백은 떼고 판정한다", () => expect(parseLocationLink("  https://naver.me/x  ")?.host).toBe("naver.me"));
it("이름의 \\r 도 거절한다", () =>
  expect(parseRestaurantForm({ name: "김밥\r천국", menusText: "", location: "" }).ok).toBe(false));
it("메뉴 사이 빈 원소는 걸러진다", () =>
  expect(parseRestaurantForm({ name: "김밥천국", menusText: "김밥, , 라면", location: "" }))
    .toEqual({ ok: true, input: { name: "김밥천국", menus: ["김밥", "라면"], location: null } }));
```

**처리:** ✅ fixed `15d22f6` — `data:`·`//host`·`ftp:`·`mailto:`·`JAVASCRIPT:` 5건 + 대문자 스킴/호스트 정규화·앞뒤 공백·URL 뒤 메모 두 갈래(호스트 뒤는 파싱 실패, 경로 뒤는 href 에 삼켜짐)를 추가했다. `parseRestaurantForm` 쪽은 이름의 `\r` 거절과 빈·공백 메뉴 원소 제거. 테스트 283 → 294.

## Info

### IN-01: 0행 UPDATE/DELETE 가 "성공" 으로 보고된다

**File:** `app/restaurants/page.tsx:79-118`
**Issue:** `.update(...).eq("id", id)`·`.delete().eq("id", id)` 는 대상 행이 이미 원격에서 지워졌어도 `error: null` 로 돌아온다. 편집 중 행이 삭제되고 Realtime DELETE 가 아직 안 온 창에서 저장하면 편집 모드는 닫히고 `actionError` 는 지워지지만 아무것도 저장되지 않는다. 오늘 탭의 `removeMenu`·`togglePin` 과 같은 기존 패턴이라 Info 로 둔다. 같은 맥락에서, 저장 후 행에 새 값이 보이는 것은 전적으로 Realtime 에 달려 있어 구독이 죽은 탭에서는 "저장됐는데 옛 값" 이 남는다(05-CONTEXT §deferred).
**Fix:** 영향 행 수가 의미 있는 두 핸들러(수정·삭제)에 `.select("id")` 를 붙이고 `data.length === 0` 이면 `"이미 삭제된 매장이에요: {name}"` 을 `actionError` 로 올린다.

**처리:** ✅ fixed `ffe3987` — 수정·삭제에 `.select("id")` 를 붙이고 0행이면 `"이미 삭제된 매장이에요: {이름}"` 을 배너로 올린 뒤 `false` 를 돌려준다(수정은 편집 폼을 열어 둬 치던 값을 지킨다). `formatRestaurantWriteError` 가 `error: null` 을 그 경우로 받는다 + 테스트 1건.

### IN-02 [설계 재논의]: 모르는 id 의 UPDATE 를 버리면 놓친 INSERT 를 영영 복구하지 못한다

**File:** `lib/restaurants.ts:146-153`, 테스트 `lib/restaurants.test.ts:306-309`
**Issue:** UPDATE 의 `payload.new` 는 전체 행이므로 목록에 없으면 추가해도 안전하다(upsert). 현재는 버리고 테스트가 그 동작을 고정한다. 재연결 틈에 INSERT 를 놓친 행은 이후 어떤 UPDATE 로도 나타나지 않는다. CR-01 수정과 함께 `applyChange` 의 UPDATE 분기를 "있으면 교체, 없으면 추가" 로 바꾸는 편이 자가 치유적이다.

**처리:** ⏸ not applied — 설계 재논의. UPDATE upsert 는 "모르는 id 의 UPDATE 는 목록을 바꾸지 않는다" 를 고정한 기존 계약·테스트를 뒤집는 결정이라 CR-01 과 분리했다. `pending` 버퍼로 "조회 전 이벤트 유실" 은 닫혔고, 남은 것은 재연결 틈에 놓친 INSERT 한 갈래다.

### IN-03: 편집·삭제 확인 중인 행이 원격에서 지워지면 초안이 말없이 사라지고 `editingId` 가 stale 로 남는다

**File:** `components/RestaurantList.tsx:50-51`, `:81-121`
**Issue:** `items.map` 에서 행이 빠지면 폼이 언마운트되어 초안이 사라지지만 `editingId`/`confirmingId` 는 존재하지 않는 id 를 계속 가리킨다. id 는 uuid 라 재사용되지 않으므로 오동작은 없고, 사용자 통지가 없는 것만 문제다.
**Fix:** `useEffect(() => { if (editingId && !items.some((r) => r.id === editingId)) setEditingId(null); }, [items, editingId])` 로 정리하고, 필요하면 `formError` 대신 페이지 배너에 "편집 중이던 매장이 삭제됐어요" 를 올린다.

**처리:** ✅ fixed `4ce2213` — `items` 멤버십으로 거른 파생값으로 분기한다(effect·setState 없음 — `react-hooks/set-state-in-effect`). 사용자 통지 문구는 추가하지 않았다.

### IN-04: 핀 토글 연타가 같은 값을 두 번 쓴다

**File:** `components/RestaurantList.tsx:117`, `app/restaurants/page.tsx:103-118`
**Issue:** 낙관적 업데이트가 없어 두 번째 클릭도 같은 `r.pinned` 를 읽는다. 두 요청 모두 `pinned: !currentlyPinned` 로 같은 값을 쓰므로 "두 번 눌러 원복" 이 되지 않는다. 오늘 탭 `PinButton` 과 동일한 기존 동작이다.
**Fix:** `PinButton` 에 `busy` 를 두거나, 핸들러가 `.update({ pinned: !currentlyPinned }).eq("id", id).eq("pinned", currentlyPinned)` 로 조건부 갱신해 stale 클릭을 0행으로 떨어뜨린다.

**처리:** ✅ fixed `ebe2116` — 행 단위 `pinBusyId` 로 진행 중인 행의 재클릭을 무시하고 그 행의 버튼만 비활성으로 둔다(조건부 갱신은 쓰지 않았다 — 0행 처리 규약이 IN-01 과 갈린다).

### IN-05 [설계 재논의]: 메뉴 입력창 120자 상한이 DB 의 30개 × 24자 허용과 충돌한다

**File:** `components/RestaurantList.tsx:23`, `:199`
**Issue:** 편집 폼은 `joinMenus(r.menus)` 로 기존 메뉴를 한 줄에 복원한다(`:89`). 메뉴 6~7개만 넘어도 120 코드유닛을 넘어 편집 폼이 "지우기만 가능" 상태로 열리고, DB 가 허용하는 30개는 UI 로 도달할 수 없다. `MENU_CHIP_LIMIT` 주석이 "전체 목록은 편집 폼에서 볼 수 있다" 고 하지만 편집은 그 자리에서 막힌다.
**Fix:** 메뉴 입력을 `maxLength` 없는 `<input>` 으로 두고 개수 상한은 `parseRestaurantForm` 의 30개 거절에 맡기거나, 상한을 `RESTAURANT_MENUS_MAX * (MENU_NAME_MAX_LEN + 2)` 로 계산해 근거를 코드에 남긴다.

**처리:** ⏸ not applied — 설계 재논의. 메뉴 입력창 상한을 바꾸면 오늘 탭 `INPUT_MAX_LEN` 과의 대칭, DB 가 허용하는 30×24, 한 줄 입력의 실사용 폭 사이에서 숫자를 새로 정해야 한다. `MenuList` 를 지우는 Phase 6 과 함께 본다.

### IN-06: 메뉴 칩 `key={menu}` 가 중복 원소에서 React key 충돌을 낸다

**File:** `components/RestaurantList.tsx:264`
**Issue:** UI 경로는 `parseMenuInput` 이 중복을 제거하지만 DB check 는 배열 내 중복을 막지 않아(`0005:26`) PostgREST 직접 쓰기로 `["김밥","김밥"]` 이 들어오면 key 경고와 칩 누락이 생긴다.
**Fix:** `key={`${i}-${menu}`}` 또는 `shownMenus.map((menu, i) => <span key={i} …>)`.

**처리:** ✅ fixed `774b0c0` — `key={`${menu}-${i}`}` + DB check 가 배열 내 중복을 막지 않는다는 근거 주석.

### IN-07: URL 뒤에 붙인 메모가 경로로 삼켜져 화면에서 사라진다

**File:** `lib/restaurants.ts:72-75`
**Issue:** `"https://naver.me/x 2층 안쪽"` 은 WHATWG URL 파서가 공백을 `%20` 으로 인코딩해 파싱에 성공하므로 링크 텍스트는 `naver.me` 뿐이고 "2층 안쪽" 은 href 안에만 남는다. 사용자가 링크+메모를 한 칸에 적는 건 자연스러운 입력이다.
**Fix:** 첫 공백 이전 토큰만 URL 후보로 보고 나머지는 텍스트로 함께 렌더하거나(`{ href, host, note }`), 최소한 `<a title={link.href}>` 로 전체를 노출한다.

**처리:** ⏸ not applied(거동만 고정) — 링크 옆에 메모를 함께 그리는 것은 표시 설계 결정이라 미적용. 대신 현재 거동 두 갈래를 `15d22f6` 테스트로 못 박았다: 호스트 뒤 메모(`https://x.com 맛있음`)는 파싱이 깨져 링크가 아니고, 경로 뒤 메모(`https://naver.me/x 2층 안쪽`)는 `%20` 으로 href 에 삼켜진다.

### IN-08: `RESPIN_ERROR_MAX_LEN` 이 이제 매장 쓰기 경로에서도 쓰이는데 이름과 테스트가 respin 전용이다

**File:** `lib/errors.ts:13`, `:78`
**Issue:** `formatRestaurantWriteError` 가 `readableMessage` 를 거치므로 200자 절단이 쓰기 배너에도 적용되지만, 상수명은 `RESPIN_` 이고 `lib/errors.test.ts:122-152` 에는 긴 원문 절단 케이스가 없다(B-6·C-10).
**Fix:** `BANNER_MESSAGE_MAX_LEN` 으로 개명하고 `formatRestaurantWriteError("등록", "x", { message: "가".repeat(250) })` 가 `…` 로 끝나는 단언을 추가한다.

**처리:** ✅ fixed `f5f46ec` — `BANNER_MESSAGE_MAX_LEN` 으로 개명하고 이름에서 `RESPIN_` 을 뗀 이유를 주석에 남겼다. 쓰기 배너에도 절단이 적용된다는 단언 1건 추가(테스트 주석의 상수명도 갱신).

### IN-09: 상한 숫자가 메시지 리터럴에 두 번 더 박혀 있다

**File:** `lib/restaurants.ts:41`, `:47`, `:51`; `lib/errors.ts:76`
**Issue:** "24자까지예요"·"30개까지예요"·"200자까지예요"·"이름 1~24자, 메뉴 30개·24자, 위치 200자" 가 `lib/constants.ts` 의 값과 별개 리터럴이다. 테스트가 리터럴을 쓰는 것은 의도된 거울이지만(`lib/restaurants.test.ts:2-3`), 소스까지 리터럴이면 상수를 바꿨을 때 메시지가 거짓말을 한다(B-7).
**Fix:** `` `매장 이름은 ${MENU_NAME_MAX_LEN}자까지예요` `` 처럼 상수를 보간한다. 테스트의 리터럴 기대값은 그대로 둬 거울 역할을 유지한다.

**처리:** ⏸ not applied — 세 상한은 `0005` 의 check 제약과 함께 움직이는 값이라, 메시지 보간은 SQL·상수·문구를 한 커밋에서 고칠 때 하는 편이 안전하다. 이번 범위에서 제외.

### IN-10: 폼 입력 3개에 접근 가능한 이름이 없다

**File:** `components/RestaurantList.tsx:187-211`
**Issue:** 세 `<input>` 이 `placeholder` 만 갖고 `aria-label`/`<label>` 이 없다. 값이 채워진 뒤에는 스크린리더가 어떤 칸인지 읽지 못한다. 편집 모드에서는 세 칸 모두 값이 채워진 채 열리므로 더 두드러진다. 버튼 쪽(`aria-label`·`aria-pressed`·`type="button"`·`role="alert"`)은 갖춰져 있다.
**Fix:** `aria-label="매장 이름"`·`"메뉴"`·`"위치"` 를 붙이고, 편집 폼에는 `<form aria-label={`${initial.name} 수정`}>` 을 둔다.

**처리:** ✅ fixed `12af16a` — 세 입력에 `aria-label`(매장 이름·메뉴·위치), 폼에는 `aria-label`(등록 / `{이름} 수정`).

### IN-11: `TopBar` 뱃지 스타일 삼항의 한쪽이 죽은 코드다 (기존 코드)

**File:** `components/TopBar.tsx:48-49`
**Issue:** `active === "today" && …` 가드 안에서 다시 `active === "today" ? s.countActive : s.count` 를 고르므로 `s.count`(`:152-158`) 는 도달 불가다. 이번 diff 가 건드린 줄은 아니지만 검토 대상 파일에 있어 기록한다.
**Fix:** `style={s.countActive}` 로 줄이고 `s.count` 를 지우거나, 뱃지를 비활성 탭에도 보일 생각이면 바깥 가드를 `candidateCount > 0` 만으로 푼다.

**처리:** ✅ fixed `af5ae13` — `style={s.countActive}` 로 줄이고 도달 불가였던 `s.count` 스타일도 지웠다. 비활성 탭에 뱃지를 보일 생각이면 바깥 가드를 푼다는 선택지를 주석으로 남겼다.

### IN-12: 매장 삭제가 오늘 탭의 휠을 다시 돌린다 — Phase 6 in-06 으로 추적 중

**File:** `app/restaurants/page.tsx:92-101` (영향: `app/page.tsx:84-91`)
**Issue:** `results.restaurant_id` 의 `on delete set null`(`0005:69`) 이 오늘 결과 행에 UPDATE 를 내보내고, 오늘 탭 `applyResult` 는 `date === todayKey` 면 `setForceSpin(true)` 를 실행한다. 이 페이즈의 삭제 UI 가 그 경로를 처음으로 실제로 밟는다. 05-CONTEXT §deferred 가 Phase 6 에서 반드시 닫기로 했고 컷오버(Phase 8) 전에는 도달하지 않으므로 Info 로만 남긴다.
**Fix:** Phase 6 에서 `applyResult` 가 `row.menu`/`row.spun_at` 이 이전 값과 같으면 `forceSpin` 을 올리지 않게 가드한다.

**처리:** ⏸ not applied — Phase 6 todo(`in-06-results-update-on-delete-set-null`)가 이미 추적 중이고 컷오버(Phase 8) 전에는 도달하지 않는다.

### IN-13: `joinMenus` ↔ `parseMenuInput` 왕복이 쉼표를 품은 원소에서 깨진다

**File:** `lib/restaurants.ts:57-60`
**Issue:** UI 로는 만들 수 없지만 PostgREST 직접 쓰기로 `["김밥,라면"]` 이 저장되면 편집 폼이 `"김밥,라면"` 으로 복원하고 저장 시 두 원소로 갈라진다. 전각 쉼표도 같다. 익명 개방 RLS 설계상 수용 범위이지만 "왕복이 성립해야 한다"(`:57`) 는 주석의 전제 조건(원소에 쉼표 없음)을 적어 두는 편이 정직하다.
**Fix:** 주석에 전제를 명시하거나, `parseMenuInput` 재사용 지점에서 원소 안 쉼표를 거절하는 검증을 DB check(`position(',' in m) = 0`)와 함께 추가하는 것을 Phase 6/8 에 넘긴다.

**처리:** ⏸ not applied — 원소 안 쉼표 거절은 DB check(`position(',' in m) = 0`)와 함께 가야 의미가 있어 Phase 6/8 로 넘긴다.

---

_Reviewed: 2026-09-29T01:17:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
