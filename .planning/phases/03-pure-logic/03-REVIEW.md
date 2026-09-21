---
phase: 3
reviewed: 2026-09-21T05:25:00Z
reviewed_at: 2026-09-21T05:25:00Z
depth: standard
diff_base: 68eedb8
files_reviewed: 26
files_reviewed_list:
  - supabase/functions/_shared/kst.ts
  - supabase/functions/_shared/spinTime.ts
  - supabase/functions/_shared/cooldown.ts
  - supabase/functions/_shared/kst.test.ts
  - supabase/functions/_shared/spinTime.test.ts
  - supabase/functions/_shared/cooldown.test.ts
  - supabase/functions/_shared/edgeImports.test.ts
  - supabase/functions/spin-roulette/index.ts
  - supabase/functions/respin-roulette/index.ts
  - lib/time.ts
  - lib/time.test.ts
  - lib/phase.ts
  - lib/phase.test.ts
  - lib/settings.ts
  - lib/settings.test.ts
  - lib/useSettings.ts
  - app/page.tsx
  - app/log/page.tsx
  - app/rank/page.tsx
  - components/MenuList.tsx
  - components/TopBar.tsx
  - components/ResultBlock.tsx
  - components/PhaseTimeline.tsx
  - tsconfig.json
  - eslint.config.mjs
  - CLAUDE.md
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-21T05:25:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

`68eedb8..HEAD` 의 26개 파일을 낭독하고, 라이브에 닿지 않는 범위에서 실행 검증을 곁들였다: `npx tsc --noEmit` exit 0, `npm run lint` exit 0, `npx vitest run` 10파일 179건 초록(기준선과 동일). 낭독으로 답이 안 나오는 경계값은 임시 spec 을 `lib/` 에 두고 돌린 뒤 지웠다(`parseSpinTime` 12종 입력, `cooldownWindowStart` 5종, `applyCooldown` 3종, `settingsFromRow` 4종 오염 페이로드, `currentPhase` 의 23:59·00:00 주입, `kstParts().date` 와 `todayKstDate()` 의 7개 경계 시각 일치, 리듀서의 이벤트 순서 뒤집힘 2종). `useSettings` 의 채널 수명은 실행할 수 없어 `@supabase/realtime-js@2.106.0` 과 `@supabase/phoenix` 소스를 직접 읽어 판정했다. 작업 트리에 남긴 파일은 없다.

**결론: Critical 0, Warning 1, Info 7.** 순수 모듈 3개(`kst`·`spinTime`·`cooldown`)와 `lib/phase.ts`·`lib/settings.ts` 는 경계·오염 입력에서 설계대로 동작했고(`"24:00"`·공백·`undefined`·`null` 전부 `null`, `h23` 자정 `0`, 윤년·연 경계 정확, 23:59 주입 시 자정 롤오버 정상), Edge Function 두 파일의 import 교체는 동작을 보존한다(옛 `isAfterSpinTime` 도 `>=`, `23505`·CORS·OPTIONS 구간에 diff hunk 0건, 삭제된 로컬 헬퍼 잔여 참조 0건, `before_spin_time` 페이로드 확장은 SUMMARY 의 INFO-13 대로). `Phase` 소비처 9곳 중 `stalled` 를 `decided` 처럼 다루는 곳은 없다(`isCandidateListLocked` 는 `never` 가드로 완전, `PhaseTimeline` 은 `accepting` 매핑, `wheelPhase` 는 `idle`). `app/log/page.tsx:36-38` 의 한계 주석은 참이다 — 다만 로드 창이 3개월(`[calMonth, calMonth+2]`)이라 실제로 오늘 행이 빠지는 것은 **3개월 이상 과거 달 또는 미래 달**을 볼 때뿐이고, 직전 두 달은 정확하다(주석의 "다른 달을 보고 있으면 … 수 있다" 는 그보다 넓게 읽힌다).

하나 남는 실질 결함은 훅 쪽이다. `useSettings` 가 세 라우트에서 **같은 채널 토픽** `settings-changes` 를 쓰는데, realtime-js 는 토픽으로 채널을 dedup 하고 이미 join 된 채널의 `leave` 는 서버 ack 가 올 때까지 목록에서 빠지지 않는다. 탭을 옮기면 새 페이지의 `.on()` 이 떠나는 중인 옛 인스턴스에 붙고 `.subscribe()` 는 건너뛰어져, **라우트 전환 뒤에는 settings Realtime 반영(SETT-02)이 새로고침 전까지 조용히 죽는다**(WR-01). 기존 3개 채널이 페이지마다 이름을 다르게 둔 이유가 정확히 이것이고, 03-03 SUMMARY 도 CONVENTIONS 의 그 규칙이 "불완전해졌다" 고 적었지만 코드는 규칙을 어긴 채로 남았다. StrictMode 이중 마운트는 안전하다(아직 `joining` 이라 `leave` 가 동기 close).

## Narrative Findings (직접 낭독·실행 검증)

구조적(fallow) 사전 분석은 제공되지 않았다. 아래는 전부 직접 낭독·프로브·라이브러리 소스 추적으로 얻은 소견이다.

## Warnings

### WR-01: 세 라우트가 같은 채널 토픽 `settings-changes` 를 재사용해, 탭 전환 뒤 settings Realtime 구독이 조용히 죽는다

**File:** `lib/useSettings.ts:39` (관련 `:37-57`), 호출처 `app/page.tsx:44`, `app/log/page.tsx:34`, `app/rank/page.tsx:26`
**Issue:** `supabase.channel("settings-changes")` 를 세 페이지 컴포넌트가 각자 마운트한다. Next.js App Router 의 클라이언트 라우트 전환에서 React 는 한 커밋 안에서 **떠나는 트리의 effect cleanup 을 먼저 전부 돌리고 그 다음 새 트리의 effect 를 돌린다.** 그 순서 위에서 realtime-js 2.106.0 의 실제 동작은 다음과 같다(소스 인용):

1. cleanup `supabase.removeChannel(ch)` → `ch.unsubscribe()` → `@supabase/phoenix` `Channel.leave()`(`channel.js:238-254`): `state = leaving` 으로 바꾸고 leave push 를 보낸다. **`canPush()`(`socket.isConnected() && isJoined()`, `:188`) 가 참이면 close 는 서버 ack 가 올 때까지 미뤄진다.** 이미 join 된 페이지 채널은 항상 이 경로다.
2. `socket._remove(this)` 는 `close` 이벤트에서만 불린다(`RealtimeChannel.js:103`). 즉 ack 전까지 옛 인스턴스가 `client.channels` 에 남아 있다.
3. 같은 커밋에서 새 페이지의 effect 가 `supabase.channel("settings-changes")` 를 부르면 `RealtimeClient.channel()`(`RealtimeClient.js:343-355`) 은 **토픽이 같은 기존 인스턴스를 그대로 돌려준다.**
4. 그 인스턴스에 `.on("postgres_changes", …)` 를 붙여도 예외가 없다 — `on()` 의 가드(`RealtimeChannel.js:390-395`)는 `isJoined() || isJoining()` 일 때만 던지는데 지금은 `leaving` 이다. 이어지는 `.subscribe()` 는 `channelAdapter.isClosed()` 가 거짓이라 join 블록을 통째로 건너뛴다(`RealtimeChannel.js:121`).
5. 서버 ack → `close` → `_remove`. 새 페이지가 붙인 바인딩은 이미 소켓에서 떨어진 인스턴스 위에 남는다. 이후 `settings` UPDATE/DELETE 는 이 페이지에 도착하지 않고, 에러도 없다.

결과: `/` → `/log` → `/rank` 처럼 탭을 한 번이라도 옮기면 도착 페이지에서는 대시보드 편집이 **새로고침 전까지 반영되지 않는다.** 초기 SELECT 는 정상이라 값 자체는 맞고, 페이즈·배너도 마운트 시점 기준으로는 맞다 — 그래서 눈에 띄지 않는다. 03-03 이 Complete 로 찍은 SETT-02("새로고침 없이 반영")는 라우트 전환 이후에는 성립하지 않는다. StrictMode 이중 마운트는 이 경로가 아니다: 첫 마운트의 채널은 cleanup 시점에 아직 `joining` 이라 `canPush()` 가 거짓이고 `leave()` 가 `leavePush.trigger("ok")` 로 **동기** close 를 일으켜 즉시 목록에서 빠진다(`channel.js:251`). 기존 페이지 채널(`lunch-realtime`·`log-results`·`rank-results`)이 이름을 달리 둔 것이 `.planning/codebase/CONVENTIONS.md` "채널 이름은 페이지마다 고유" 의 근거이고, 이 훅은 그 규칙을 처음으로 어긴다.
**Fix:** 훅 인스턴스마다 토픽을 유일하게 만든다. React 의 `useId()` 가 마운트마다 안정된 고유 문자열을 준다(문자 집합이 걱정되면 모듈 카운터 + `useState` 초기화로 `settings-changes-${n}` 을 만들어도 같다).
```ts
// lib/useSettings.ts
import { useEffect, useId, useReducer } from "react";
…
export function useSettings(): SettingsState {
  const [state, dispatch] = useReducer(settingsReducer, INITIAL_SETTINGS_STATE);
  // 토픽은 훅 인스턴스마다 유일해야 한다. 같은 이름을 세 라우트가 쓰면 라우트 전환 시 realtime-js 가
  // 아직 leave 중인 이전 페이지의 인스턴스를 토픽 기준으로 그대로 돌려줘(dedup) 새 구독이 조용히 죽는다.
  const topic = `settings-changes:${useId()}`;
  …
  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => { … })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [topic]);
```
같이 고칠 것: `.planning/codebase/CONVENTIONS.md` 의 "채널 이름은 페이지마다 고유" 를 "훅·페이지 **인스턴스**마다 고유(공용 훅은 `useId()` 접미)" 로 바꾸고, 03-03 SUMMARY 가 "불완전" 으로 남긴 그 항목을 닫는다. 렌더 하네스가 없어 자동 테스트는 못 붙이지만, `grep -c 'channel("settings-changes")' lib/useSettings.ts → 0` 이 회귀 게이트가 된다.

## Info

### IN-01: `settingsReducer` 가 `state` 를 전혀 읽지 않는 것은 설계대로이나, 이벤트 순서가 뒤집히면 더 새 Realtime 값을 버린다

**File:** `lib/settings.ts:72-92`
**Issue:** IDE 힌트("`state` is declared but its value is never read")는 결함이 아니라 설계의 결과다 — 리듀서 표 5행이 전부 `action` 만으로 결정되고, 03-03 SUMMARY 가 "얕은 병합을 쓰지 않는다" 를 이렇게 코드로 드러냈다. 다만 그 대가로 리듀서는 "이미 더 새 값을 받았다" 는 사실을 알 수 없다. 프로브로 확인한 두 순서: (a) `changed(UPDATE, 12:30)` 뒤에 늦게 도착한 초기 `loaded(11:55 행)` → `spinTime` 이 `11:55` 로 되돌아간다. (b) `changed(UPDATE, 12:30)` 뒤에 초기 SELECT 가 `failed` → 기본값 `11:55` + "설정 불러오기 실패" 배너가 뜬다(테이블이 있다는 증거를 방금 Realtime 으로 받았는데도). 초기 SELECT 가 진행 중인 수백 ms 사이에 관리자 편집이 도착해야 하므로 현실 빈도는 매우 낮다. 기록해 두는 이유: Phase 4·7 이 이 리듀서에 action 을 더할 때 "state 를 안 읽는다" 를 불변식으로 오해하지 않게 하기 위해서다.
**Fix:** `loaded`·`failed` 는 훅이 정확히 한 번만 보내므로, 도착 시점에 이미 `state.loaded` 가 참이면 `changed` 가 앞섰다는 뜻이다 — 그 경우 무시한다. 이 한 줄이 `state` 를 읽게 만들고 두 순서를 모두 닫는다. `lib/settings.test.ts:113-116`(#16 "경고가 있던 state 에서 failed") 는 이 가드에서 "이미 로드된 뒤의 failed 는 무시된다" 로 기대값을 바꿔야 한다(그 시나리오는 훅에서 도달 불가라 의미 손실이 없다).
```ts
    case "loaded":
    case "failed":
      // 초기 조회보다 Realtime 이벤트가 먼저 도착했다면(loaded 가 이미 참) 그쪽이 더 새 값이다.
      if (state.loaded) return state;
      …
```

### IN-02: `loaded` 를 읽는 페이지가 없어, `spin_time` 이 기본값과 다르면 첫 페인트에 틀린 페이즈 라벨이 스친다

**File:** `lib/useSettings.ts:21`, `app/page.tsx:44-47`, `app/log/page.tsx:34-39`, `app/rank/page.tsx:26-29`
**Issue:** 세 페이지 모두 `useSettings()` 에서 `settings`·`error`·`warning` 만 구조 분해하고 `loaded` 는 버린다(`grep -rn 'loaded' app` → 0). 컷오버 후 대시보드가 추첨 시각을 예컨대 12:30 으로 바꾸면, 11:55~12:30 사이에 페이지를 열 때마다 SELECT 가 끝나기 전 첫 렌더에서 `currentPhase(now, DEFAULT 11:55, false)` 가 `stalled` 를 돌려줘 TopBar "추첨 대기"·StageHeader "추첨 대기중"·헤드라인 "아직 안 정해졌어요." 가 수백 ms 보였다가 `accepting` 으로 바뀐다(반대로 시각을 앞당기면 `accepting` → `stalled`). 후보 목록 잠금은 두 상태 모두 `false` 라 영향이 없고 라벨만 흔들린다. SETT-03 의 "기본값으로 계속 동작" 은 의도된 설계이므로 결함이라기보다 Phase 6 이 `stalled` 문구를 다듬을 때 알아야 할 사실이다.
**Fix:** `loaded` 는 SELECT 가 성공·실패 어느 쪽으로 끝나도 참이 되므로(`failed` 도 `loaded: true`) 그 값으로 `stalled` 표시를 가리면 컷오버 전후 모두 안전하다. Phase 6 에서 `stalled` 문구를 붙일 때 `loaded && phase === "stalled"` 로 가드하거나, 페이지가 `!loaded` 동안 `stalled` 를 `accepting` 으로 내려 그리는 한 줄을 두면 된다.

### IN-03: 훅에 분기가 2개 있는데 spec 머리 주석과 CLAUDE.md 는 "분기 0" 을 전제한다 — 가장 중요한 판정(에러 vs 0행)이 테스트 밖에 있다

**File:** `lib/useSettings.ts:29-30`, `:49`; 진술 `lib/settings.test.ts:10`("훅 본문에 분기가 0이다"), `CLAUDE.md:38`
**Issue:** `if (error) dispatch(failed) else dispatch(loaded)` 와 `payload.eventType === "DELETE" ? null : payload.new` 는 판정이다. 특히 앞의 것은 03-03 SUMMARY 가 "0행은 배너를 띄우지 않고, 테이블 부재는 반드시 띄운다" 고 강조한 바로 그 결정인데, 리듀서는 이미 갈라진 action 만 받으므로 spec 24건 어느 것도 이 분기를 지나지 않는다. 낭독 체크리스트가 대신 확인했지만, 낭독은 회귀를 잡지 못한다. 동작은 맞다 — 지적은 "분기 0" 이라는 진술이 거짓이고, 그래서 분기가 테스트 밖에 있다는 점이다.
**Fix:** 분기를 리듀서로 내리면 훅은 배관만 남고 진술이 참이 된다.
```ts
// lib/settings.ts
export type SettingsAction =
  | { type: "fetched"; data: SettingsRow | null; error: { message: string } | null }
  | { type: "event"; eventType: "INSERT" | "UPDATE" | "DELETE"; newRow: SettingsRow | null };
// reducer: fetched → error ? failed 경로 : loaded 경로 / event → DELETE ? 기본값 : settingsFromRow(newRow)
// lib/useSettings.ts
dispatch({ type: "fetched", data: data as SettingsRow | null, error });
dispatch({ type: "event", eventType: payload.eventType, newRow: payload.new as SettingsRow | null });
```
그러면 "`error` 가 있으면 `data` 가 있어도 `failed` 다"·"0행은 배너 없음" 이 spec 2건으로 고정된다.

### IN-04: `cooldownWindowStart`·`applyCooldown`·`settingsFromRow` 의 오염 입력 착지가 "총 함수" 원칙과 어긋나는 자리 3곳

**File:** `supabase/functions/_shared/cooldown.ts:12-21`, `:27-40`; `lib/settings.ts:63`
**Issue:** 프로브 실측 — `cooldownWindowStart("", 1)` 과 `cooldownWindowStart("2026-09-21", NaN)` 은 `null` 이 아니라 `"NaN-NaN-NaN"` 을 돌려준다. Phase 4 가 이 값을 `.gte("date", …)` 에 그대로 넣으면 PostgREST 가 `invalid input syntax for type date` 로 500 을 내고 **그날 추첨이 빠진다.** 지금 호출처는 0곳이고 `kstNow().date` 는 항상 정형이지만, `days` 는 Phase 4 가 DB 에서 직접 읽는다(03-03 SUMMARY 도 "Edge 쪽은 같은 방어를 따로 해야 한다" 고 남겼다) — 파서 `parseSpinTime` 이 "던지지 않는 총 함수" 인 것과 같은 이유로 여기서 막는 편이 싸다. `applyCooldown([], ["r1"])` 은 `{ picked: [], fellBack: true }` 를 돌려주는데, 후보가 원래 0개인데 "폴백했다" 고 보고하면 Phase 4 의 `cooldown_fallback: true` 응답이 `no_candidates` 와 함께 실려 오해를 낳는다. `settingsFromRow` 는 `history_since` 키가 빠진 페이로드에서 `historySince: undefined` 를 만든다(타입은 `string | null`) — Phase 7 이 `=== null` 로 "전환일 미확정" 을 판정하면 `undefined` 가 그 검사를 통과해 `.gte("date", undefined)` 로 흐른다.
**Fix:**
```ts
// cooldown.ts
export function cooldownWindowStart(today: string, days: number): string | null {
  if (!Number.isFinite(days) || days <= 0) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d - Math.trunc(days)));
  …
}
// applyCooldown 첫 줄
if (candidates.length === 0) return { picked: candidates, fellBack: false };
// settings.ts:63
historySince: row.history_since ?? null,
```
`cooldown.test.ts` 에 `("", 1) → null`·`("2026-09-21", NaN) → null`·`([], ["r1"]) → fellBack: false` 3건을 더한다.

### IN-05: `edgeImports.test.ts` 는 두 `index.ts` 의 존재를 단언하지 않아, 파일이 없어지면 "복붙 부재" 단언 10건이 빈 문자열로 통과한다

**File:** `supabase/functions/_shared/edgeImports.test.ts:42-43`, `:55-65`
**Issue:** `readOrEmpty` 는 읽기 실패를 `""` 로 흡수한다(RED 게이트를 위한 의도적 선택). `_shared` 3파일은 #1~#3 이 존재를 먼저 못 박지만 `rawSpin`·`rawRespin` 에는 대응 단언이 없다. 두 함수 파일이 이동·개명되면 #9~#14·#18~#21(`toBe(0)`)은 빈 문자열에서 전부 초록이고, 실패는 #7·#8·#15·#16·#22 에서 "expected 0 to be 1" 로만 나타나 원인이 "파일이 없다" 인지 "import 가 빠졌다" 인지 구분되지 않는다. Phase 2 리뷰 IN-04 와 같은 형태다. 현재 트리에서는 22/22 이고, 부수적으로 `stripComments` 의 `//` 절단이 `https://` 같은 문자열 리터럴도 자르지만 두 파일에 그런 리터럴은 없다.
**Fix:** `EDGE/` describe 두 곳의 맨 앞에 존재 단언을 넣는다.
```ts
it("spin-roulette/index.ts 를 읽었다 (#7a)", () => expect(rawSpin.length).toBeGreaterThan(0));
it("respin-roulette/index.ts 를 읽었다 (#16a)", () => expect(rawRespin.length).toBeGreaterThan(0));
```

### IN-06: 날짜 키 `"yyyy-mm-dd"` 를 만드는 Intl 경로가 클라이언트(`en-CA` 포맷)와 서버(`en-US` parts 조립) 둘로 남아 있다

**File:** `lib/time.ts:15-21`, `supabase/functions/_shared/kst.ts:33-51`
**Issue:** `results.date` 를 **쓰는** 쪽(Edge `kstNow().date`, `kst.ts:51` 의 `${year}-${month}-${day}` 조립)과 **읽는** 쪽(`todayKstDate`, `en-CA` 로케일의 기본 날짜 포맷 출력)이 서로 다른 Intl 경로다. 프로브로 자정·연 경계·윤년·`0999년` 까지 7개 시각에서 일치를 확인했고 두 spec(`lib/time.test.ts`·`kst.test.ts`)이 같은 리터럴을 고정하므로 지금은 안전하다. 그러나 D-03 의 목표("KST 분해 구현 1곳")와 CLAUDE.md 의 "`kstParts()` 는 한 곳" 은 사실이면서도, 앱에서 가장 비싼 키(오늘 날짜)는 여전히 두 구현이 우연히 같은 문자열을 내는 데 기대고 있다. ICU 가 `en-CA` 의 기본 날짜 패턴을 바꾸면(과거에 로케일 패턴이 바뀐 전례가 있다) 클라이언트만 다른 키를 만들어 "오늘 결과 없음" 이 된다.
**Fix:** 포맷터 대신 분해기의 `date` 를 그대로 쓴다. 출력이 같아 `lib/time.test.ts` 는 무변경으로 통과한다.
```ts
/** "yyyy-mm-dd" (KST 기준). results.date 와 같은 코드 경로(_shared/kst)에서 만든다 */
export function todayKstDate(now: Date = new Date()): string {
  return kstParts(now).date;
}
```
`formatHhMm`·`formatHhMmSs` 의 `en-CA` 는 그대로 둬도 된다(날짜 키가 아니다).

### IN-07: CLAUDE.md 정정 8건 중 3건이 코드와 어긋나는 문면을 담고 있다 (나머지 5건은 참)

**File:** `CLAUDE.md:13`, `:14`, `:38` (`8a520e5`); 같은 진술 `lib/settings.test.ts:10`
**Issue:** 코드 대조 결과 — 참: `:12`(`lib/time.ts` 재수출·`stalled` 설명), `:27`(vitest 수집 4경로 = `vitest.config.mts:18-27`), `:41`(제외 2디렉터리 + `_shared` 3중 검사 = `tsconfig.json:33`·`eslint.config.mjs:19-20`), `:44`(`DEFAULT_SPIN_TIME` 정의처 + 남은 중복 2갈래), `:45`(`kstNow`/`kstParts` 단일 정의), `:66`(미사용 `onSpinCompleteAction` — 호출처 0건 확인). 어긋남 3건:
1. `:13` "`lib/settings.ts` — … 리듀서(순수, **값 import 0개**)" — `lib/settings.ts:13-18` 은 `DEFAULT_SPIN_TIME`·`DEFAULT_SPIN_TIME_TEXT`·`parseSpinTime` 을 **값으로** import 한다. 의도("supabase·React·환경변수를 값으로 끌어오지 않는다", 파일 머리 `:2`)와 문면이 다르다.
2. `:38` "`lib/` 의 **소문자 단수 명사 규칙**에 대한 유일한 예외다" — `lib/` 에는 `errors.ts`·`constants.ts`·`colors.ts` 가 있어 "단수" 규칙이 애초에 존재하지 않는다. 존재하지 않는 규칙의 "유일한 예외" 라는 문장은 다음 사람을 헷갈리게 한다.
3. `:14` "import 를 하나도 하지 않는 것이 **이 디렉터리**의 계약이다" — 같은 디렉터리의 `*.test.ts` 4개는 vitest·`./kst` 등을 import 한다. D-02 는 계약을 세 모듈로 한정한다. 덧붙여 `lib/settings.test.ts:10` 의 "훅 본문에 분기가 0이다" 는 IN-03 대로 거짓이다.
**Fix:**
```md
- `lib/settings.ts` — … 리듀서(순수 — supabase·React·환경변수 값 import 0개. `_shared/spinTime` 값 import 만 있다).
- `supabase/functions/_shared/` — … 세 모듈(`kst.ts`·`spinTime.ts`·`cooldown.ts`)이 import 를 하나도 하지 않는 것이 계약이다(spec 은 예외).
- **공용 훅은 `lib/useX.ts`, `use` 접두** (`lib/useSettings.ts`). `lib/` 파일명이 소문자 명사인 관례의 유일한 예외다. 훅에는 I/O 만 …
```
`lib/settings.test.ts:10` 은 IN-03 을 적용하면 참이 되고, 적용하지 않으면 "훅 본문의 분기 2개(에러/0행, DELETE/그 외)는 낭독으로만 검증한다" 로 고친다.

---

_Reviewed: 2026-09-21T05:25:00Z · Depth: standard · diff_base: 68eedb8_
