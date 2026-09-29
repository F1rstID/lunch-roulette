---
phase: 06-today-tab
reviewed: 2026-09-29T04:12:11Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - app/page.tsx
  - app/layout.tsx
  - app/restaurants/page.tsx
  - app/log/page.tsx
  - app/rank/page.tsx
  - components/CandidateList.tsx
  - components/MenuChips.tsx
  - components/LocationLink.tsx
  - components/RestaurantList.tsx
  - components/ResultBlock.tsx
  - components/PhaseTimeline.tsx
  - components/Wheel.tsx
  - lib/rowset.ts
  - lib/rowset.test.ts
  - lib/candidates.ts
  - lib/candidates.test.ts
  - lib/menus.ts
  - lib/menus.test.ts
  - lib/restaurants.ts
  - lib/restaurants.test.ts
  - lib/settings.ts
  - lib/settings.test.ts
  - lib/useCandidates.ts
  - lib/useRestaurants.ts
  - lib/useSettings.ts
  - lib/phase.ts
  - lib/phase.test.ts
  - lib/time.ts
  - lib/time.test.ts
  - lib/errors.ts
  - lib/errors.test.ts
  - lib/constants.ts
  - lib/supabase/client.ts
  - supabase/functions/_shared/spinTime.ts
  - supabase/migrations/0005_restaurants_settings.test.ts
  - CLAUDE.md
findings:
  critical: 1
  warning: 2
  info: 7
  total: 10
fixed: 0
deferred: 0
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-29T04:12:11Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

## Summary

Phase 6(오늘 탭) 산출물 36개 파일을 diff base `22e5506` 기준(13커밋, +1768/−777)으로 읽었다. 빠른 레인이라 이 리뷰가 유일한 독립 검증이므로 게이트 5종을 직접 실행했다 — `npx tsc --noEmit` exit 0 · `npm run lint` 에러 0 · `npm test` **354/354** · `npm run build` exit 0(4 라우트) · `npm run check:edge` exit 0. `npm install`·`npm run dev`·원격 Supabase·`git push`·소스 수정은 하지 않았다. D-22 grep(`11:55` 화면 리터럴) 0건, 계약 #56(`"no_candidates"` 정확히 1) 초록을 재확인했다.

전체 구조는 CONTEXT 의 확정 결정을 따른다: `lib/rowset.ts` 제네릭 리듀서에 키만 주입한 두 인스턴스(D-03), `fetched`/`changed` 2액션(D-04), UPDATE upsert(D-05), 3단 정렬(D-06), `findWinnerIndex` 의 id 전용 판정(D-07), `todayResultRef` + `isNewSpin` 회전 가드(D-08), `CandidateList` 의 단일 목록·행 토글·`aria-pressed`·잠금(D-10~D-15), `formatCandidateWriteError` 의 23505→null(D-17), 스냅샷 이름 + 현재 카탈로그 상세(D-18), `spinTimeText` 필수 prop 화(D-21), `displayPhase` 4페이지(D-23), `MenuList` 삭제와 `lib/menus.ts` 이동(D-24), `MENUS_INPUT_MAX_LEN` 삭제(D-25)를 전부 코드로 확인했다. `LocationLink` 의 `http:`/`https:` 화이트리스트·`target="_blank"`·`rel="noopener noreferrer"` 는 한 벌로 옮겨진 뒤에도 유지되고, `RestaurantList` 는 `MENU_CHIP_LIMIT` 4·키 `${menu}-${i}` 를 그대로 물려받아 동작이 바뀌지 않았다(구 파일 :26·:315·:323 과 대조). `error.details`/`hint` 참조는 `lib/errors.ts`·`app/page.tsx` 전역 0건이다.

핵심 우려는 하나다. **`app/page.tsx` 의 results 구독이 자정에 죽는다(CR-01).** D-09 는 토픽을 `results-<n>` 으로 바꿔 "라우트 전환에서 leaving 중인 옛 채널에 붙는" 문제를 닫았다고 했지만, 토픽을 `useState` 에 한 번 만들어 두고 effect 가 `[todayKey, resultsTopic]` 로 재실행되므로 KST 자정에 **같은 인스턴스가 같은 토픽으로 재구독**한다. 이때 옛 채널은 이미 join 된 상태라 leave 가 비동기이고, realtime-js 는 같은 토픽의 leaving 채널을 그대로 돌려주며 `subscribe()` 는 `closed` 가 아니면 join 을 건너뛴다(설치본 코드 라인으로 확인). 자정 이후 열려 있던 탭은 다음 날 추첨 INSERT 를 받지 못해 결과가 있어도 "추첨 대기중" 에 머문다 — Core Value("모든 접속자 화면에 동시에 뜬다")가 밤새 열어 둔 탭에서 깨진다. 구 코드(`"lunch-realtime"` + `[todayKey]`)에도 같은 결함이 있었으므로 회귀는 아니지만, D-09 가 겨눈 것이 바로 이 부류의 버그였고 컷오버 전에 닫혀야 한다. 그 외에는 훅 3개의 취소 가드를 `if` 없이 다시 쓴 것(WR-01, B-7)과 조회·구독 사이의 창과 재연결 뒤 재조회 부재(WR-02, 기존 패턴의 확장)가 Warning 이다.

낭독으로 검토하고 **기각한 가설**(기록용):
- React StrictMode 이중 effect 에서 `resultsTopic`·`topic` state 가 같은 토픽을 재사용해 구독이 죽는지 — 첫 effect 의 cleanup 시점에 채널은 아직 join 전이라 `canPush()` 가 거짓이고, `phoenix.cjs.js:468-470` 이 leave 를 **동기로** `ok` 트리거 → `_onClose` → `RealtimeClient._remove` 가 즉시 목록에서 뺀다. 두 번째 effect 의 `supabase.channel(topic)` 은 새 인스턴스를 만든다(05-REVIEW 와 같은 결론). CR-01 은 이 논증의 반대 경우(join 완료 후 재구독)다.
- `app/log/page.tsx:80` `"log-results"`·`app/rank/page.tsx:59` `"rank-results"` 고정 토픽이 라우트 전환에서 죽는지 — 두 토픽은 페이지마다 다르고 deps 가 `[]` 라 같은 인스턴스가 재구독하지 않는다. 충돌은 "같은 페이지를 leave ack 창(수십 ms) 안에 다시 마운트" 할 때만인데 내비게이션으로는 만들 수 없다. 문제 없음.
- `lib/rowset.ts` UPDATE upsert 가 DELETE 뒤 되살아남을 만드는지 — 변경 스트림은 순서가 보장되므로 스냅샷 이전에 커밋된 옛 UPDATE 가 늦게 배달돼도 그 뒤의 DELETE 가 따라와 일시적이다. `fetched(error)` 는 `pending` 을 버리고(`:75`), 중복 응답은 `state.loaded` 로 거른다(`:70`). 문제 없음.
- `isNewSpin` 이 다시 돌리기를 놓치는지 — `respin-roulette/index.ts:203` 이 `new Date().toISOString()` 을 항상 새로 쓰고 `spin-roulette` 은 DB 기본값 `now()` 다. `on delete set null` UPDATE 는 `spun_at` 을 건드리지 않는다. 문제 없음(단 IN-05 의 직렬화 전제는 남는다).
- `todayResultRef` 가 자정을 넘어 어제 행을 들고 있는지 — 새 `todayKey` 의 조회가 `null` 로 덮어쓰고(`app/page.tsx:122`), 그 사이 도착한 어제 날짜 이벤트는 `:140` 이 거른다. 문제 없음.
- `listTodayRows` 의 `slice` 가 필터에 흔들리는지 — 인덱스는 `candidates` 배열 위치이고(`lib/candidates.ts:78-83`) `keep` 은 그 뒤에 적용된다. `lib/candidates.test.ts:229-235` 가 고정한다. 문제 없음.

**spec #42 반전 판정:** 타당하다. `0005` SQL 이 `drop table if exists public.pinned_menus/menus`(:169-170) 를 들고 있으므로 "TS 에 `MenuRow`/`PinnedMenuRow` 가 없다" 는 같은 파일의 SQL↔TS 동기화 describe 에 속하는 부정 계약이고(#9 의 `drop table` 2건과 짝), 제목("사라졌다")·주석("지워진 사실 자체가 계약")이 새 뜻과 맞는다. 삭제 대신 반전으로 건수를 유지한 판단도 옳다.

**이전 페이즈 이관 항목 판정:**

| 항목 | 판정 | 근거 |
|---|---|---|
| 05-REVIEW CR-01 (`pending` 버퍼 → rowset 이전) | ✅ 닫힘 | `lib/rowset.ts:86-95` 가 조회 전 이벤트를 쌓고 `:79-84` 가 응답 위에 재적용. `lib/rowset.test.ts:99-123`·`lib/restaurants.test.ts:384-415` 가 순서·실패 배너를 고정 |
| 05-REVIEW IN-02 (UPDATE upsert) | ✅ 닫힘 | `lib/rowset.ts:55-56`. 옛 계약 "목록을 바꾸지 않는다" 는 `lib/restaurants.test.ts:362-365` 에서 반대 기대로 뒤집혔고 `lib/rowset.test.ts:80-83` 이 같은 규칙을 든다 |
| 05-REVIEW IN-05 (`maxLength` 삭제) | ✅ 닫힘 | `MENUS_INPUT_MAX_LEN` 상수·`maxLength` 삭제, 근거 주석 `components/RestaurantList.tsx:234-238` |
| 04-REVIEW IN-09 / todo in-06 (휠 재회전 가드) | ✅ 닫힘 | `app/page.tsx:139-148` 이 `prev` 를 읽고 나서 쓰고 `initialLoadedRef && isNewSpin` 으로만 회전. `lib/candidates.test.ts:260-272`. IN-05 의 문자열 비교 전제만 남는다 |
| 03-REVIEW IN-02 / todo in-02 (`displayPhase`) | ✅ 닫힘 | `lib/phase.ts:58-60` + 4페이지 배선(`app/page.tsx:75`·`restaurants/page.tsx:43`·`log/page.tsx:47-50`·`rank/page.tsx:36-39`). `loaded` 는 실패 경로에서도 참(`lib/rowset.ts:75`·`lib/settings.ts:86`)이라 컷오버 전에도 `stalled` 가 보인다 |
| 03-REVIEW IN-03 / todo in-03 (훅 분기 → 리듀서) | ✅ 닫힘(단서) | 조회 성공·실패 가름은 `fetched` 액션으로 내려갔다(`lib/settings.ts:52-54,78-92`). 취소 가드를 `if` 없이 다시 쓴 부분은 WR-01 |

Realtime 구독 실패(`CHANNEL_ERROR`)가 조용한 점과 `ResultBlock` 의 "n개 후보 중 당첨" 이 라이브 후보 수인 점은 06-CONTEXT §deferred 에 따라 발견으로 올리지 않았다.

## Critical Issues

### CR-01: results 구독이 자정(`todayKey` 변경)에 같은 토픽으로 재구독해 조용히 죽는다 — 밤새 열어 둔 탭은 다음 날 결과를 받지 못한다

**File:** `app/page.tsx:60`, `:131-167` (특히 `:150-151` `.channel(resultsTopic)`, `:164-166` cleanup, `:167` deps `[todayKey, resultsTopic]`)
**Issue:** 토픽은 `useState(() => \`results-${++topicSeq}\`)` 로 **컴포넌트 인스턴스당 한 번** 만들어지는데, 구독 effect 는 `todayKey` 에 의존하므로 KST 자정에 같은 인스턴스가 cleanup → setup 을 다시 밟는다. 그 순서에서 일어나는 일(설치본 `@supabase/realtime-js@2.106.0` 기준):
1. cleanup `supabase.removeChannel(channel)` → `Channel.leave()` 가 상태를 `leaving` 으로 바꾸고 leave push 를 보낸다. 채널은 이미 join 돼 있어 `canPush()` 가 참이므로 **동기 `ok` 트리거가 없고**(`node_modules/@supabase/phoenix/priv/static/phoenix.cjs.js:457-472`, `:406-408`) 서버 ack 까지 `RealtimeClient.channels` 에 남는다.
2. setup `supabase.channel(resultsTopic)` → `RealtimeClient.channel()` 은 같은 토픽이 목록에 있으면 **그 인스턴스를 그대로 돌려준다**(`node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js:343-355`). 새 `.on()` 두 건이 leaving 채널에 붙는다.
3. `.subscribe()` 는 `channelAdapter.isClosed()` 일 때만 join 한다(`RealtimeChannel.js:116-121`). 상태가 `leaving` 이라 아무것도 하지 않고 돌아온다 — 예외도 콜백도 없다.
4. ack 가 오면 `_onClose → socket._remove(this)`(`RealtimeChannel.js:102-104`, `RealtimeClient.js:437-438`) 로 채널이 목록에서 빠지고 `removeChannel` 이 `teardown()` 한다. 페이지가 쥔 `channel` 은 닫힌 채널이고 어디에서도 rejoin 되지 않는다.

그 뒤로 이 탭은 `results` INSERT/UPDATE 를 받지 못한다. 다음 날 추첨 시각에 `currentPhase` 가 5초간 `spinning` 을 보였다가 `todayResult` 가 계속 null 이라 `stalled`("추첨 대기중 · 아직 결과가 없어요 · 후보를 담으면 1분 안에 자동으로 뽑아요")로 떨어지고, 후보 목록도 잠기지 않은 채 남는다 — 서버에는 결과가 있는데 화면은 반대를 말한다(B-5). 사무실 브라우저에 탭을 켜 둔 채 퇴근하는 것이 이 앱의 흔한 사용 형태다. 구 코드(`git show 22e5506:app/page.tsx:94,150` — `"lunch-realtime"` + `[todayKey]`)에도 같은 결함이 있었으므로 이 페이즈의 회귀는 아니지만, D-09 가 고치려던 부류가 정확히 이것이고 실제로 걸리는 트리거(같은 인스턴스의 재구독)는 놓쳤다. 06-02 SUMMARY 낭독 1~2항은 핸들러 순서·가드만 봤고 재구독 경로는 보지 않았다. 훅 3개(`lib/useCandidates.ts:37`·`useRestaurants.ts:35`·`useSettings.ts:35`)는 deps 가 `[topic]` 뿐이라 같은 인스턴스가 재구독할 일이 없어 영향이 없다.
**Fix:** 토픽을 state 가 아니라 **effect 실행마다** 새로 만든다. 그러면 마운트·StrictMode 재실행·자정 재구독이 전부 새 채널을 받는다.
```ts
// :60 의 useState 와 그 주석을 지우고, 구독 effect 안에서 만든다.
useEffect(() => {
  const applyResult = (row: ResultRow) => { /* 그대로 */ };
  // 토픽은 인스턴스가 아니라 구독(= 이 effect 의 실행 1회)마다 유일해야 한다. state 에 두면 자정에 todayKey 가
  // 바뀌어 같은 인스턴스가 재구독할 때 realtime-js 가 leaving 중인 옛 채널을 그대로 돌려주고 join 을 건너뛴다.
  const channel: RealtimeChannel = supabase
    .channel(`results-${++topicSeq}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "results" }, (p) => applyResult(p.new as ResultRow))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "results" }, (p) => applyResult(p.new as ResultRow))
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}, [todayKey]);
```
렌더 하네스가 없으니 낭독으로 검증하고, CLAUDE.md 위험 지점 표의 `app/page.tsx` 행에 "토픽은 effect 안에서 만든다 — state 로 올리면 자정 재구독이 죽는다" 를 한 줄 더한다. 훅 3개도 같은 형태(effect 안 생성, `useState` 제거)로 맞추면 네 구독이 한 규칙을 쓴다 — 선택이지만 권장.

## Warnings

### WR-01: 훅 3개의 언마운트 가드를 `if` 를 피하려고 `send` 재바인딩으로 바꾼 것은 뻔한 코드를 영리한 코드로 바꾼 것이다

**File:** `lib/useSettings.ts:38-47`, `lib/useRestaurants.ts:38-53`, `lib/useCandidates.ts:40-55` (문서: `CLAUDE.md:47`, 06-01 SUMMARY Deviation 3)
**Issue:** `let send: typeof dispatch = dispatch; … send({...}); cleanup: send = () => {};` 는 동작한다 — 비동기 IIFE 가 `let` 바인딩을 클로저로 잡으므로 cleanup 이후 도착한 응답은 빈 함수로 간다. 그러나 그 이유가 "인수 조건 `grep -cE '^\s*(if|\} else)'` → 0" 을 문면으로 맞추기 위해서였다는 것을 세 파일의 주석이 스스로 말한다. D-04 의 의도는 **판단 분기**(성공·실패 가름)를 리듀서로 내리는 것이었고 취소 가드는 판단이 아니다. 결과적으로 (a) 읽는 사람이 "클로저가 재대입된 바인딩을 본다" 는 사실을 알아야 안전성을 확신할 수 있고, (b) 같은 관용구가 세 벌로 복제됐으며, (c) `CLAUDE.md:47` 의 "세 훅 모두 본문에 분기가 0개" 는 측정 지표를 목표로 삼은 문장이 됐다. 부수적으로 React 18+ 에서는 언마운트 뒤 `dispatch` 가 no-op 이라 이 가드가 지키는 것은 StrictMode 이중 실행에서 첫 조회의 `fetched` 를 리듀서의 `state.loaded` 가드 앞에서 한 번 더 거르는 것뿐이다(B-7 명시성, B-9 컨벤션 — `app/page.tsx:107,118` 과 `app/restaurants/page.tsx:46,54` 는 여전히 `if (cancelled) return;` 을 쓴다).
**Fix:** 세 훅을 레포의 나머지와 같은 형태로 되돌리고 문장을 정직하게 고친다.
```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase.from("candidates").select("*").order("created_at", { ascending: true });
    // 언마운트·재실행 뒤 도착한 응답은 버린다. 판단이 아니라 취소 가드다 — 성공·실패의 가름은 리듀서가 한다.
    if (cancelled) return;
    dispatch({ type: "fetched", rows: (data as CandidateRow[] | null) ?? null, error });
  })();
  return () => {
    cancelled = true;
  };
}, []);
```
`CLAUDE.md:47` 을 "세 훅 모두 **판단** 분기가 0개(언마운트 취소 가드 `if (cancelled)` 한 줄은 예외)" 로, 플랜의 인수 조건은 `grep -cE 'if \((error|!?data|payload\.)' ` 처럼 판단 분기만 세도록 바꾼다. 대안으로 가드를 아예 지우는 것도 성립한다(React 18+ 무해, 리듀서 `:70` 이 중복을 거른다) — 그 경우 주석에 근거를 적는다.

### WR-02 [설계 재논의]: 조회는 구독이 확정되기 전에 스냅샷을 뜨고, 재연결 뒤에는 재조회가 없다 — `pending` 버퍼가 덮지 않는 반대 방향의 창

**File:** `lib/useCandidates.ts:39-56` ↔ `:58-84`, `lib/useRestaurants.ts:37-54` ↔ `:56-89`, `lib/useSettings.ts:37-48` ↔ `:50-71`, `app/page.tsx:106-129` ↔ `:131-167`, 리듀서 계약 `lib/rowset.ts:6-8,67-70`
**Issue:** 네 구독 모두 SELECT 와 `subscribe()` 를 같은 커밋에서 동시에 띄운다. `lib/rowset.ts` 의 `pending` 버퍼는 "응답보다 **먼저 도착한** 이벤트" 를 흡수하지만, **스냅샷 이후에 커밋되고 join 이전이라 아예 배달되지 않은** 변경은 어느 쪽에도 실리지 않는다. 콜드 로드에서는 REST 응답(~100ms)이 웹소켓 연결 + join ack(~200-400ms)보다 앞서므로 그 창이 매 첫 방문마다 열린다. 더 흔한 경로는 재연결이다: 노트북 슬립·네트워크 단절 뒤 realtime-js 가 소켓을 다시 열고 채널을 rejoin 하지만 `postgres_changes` 에는 재생이 없고 훅은 재조회하지 않는다. 오전에 열어 둔 탭이 점심 직전에 깨어나면 후보 목록·휠이 슬립 동안의 담기·빼기를 모른 채 `spinning` 을 맞고, 당첨 `restaurant_id` 가 이 탭의 `todayCandidates` 에 없으면 `winnerIndex` -1 로 하이라이트도 없다. `candidates` 는 D-02 로 UPDATE 를 구독하지 않아 upsert 자가 치유 경로도 없다(매장 카탈로그와 다른 점). `restaurants`·`settings`·`results` 는 Phase 3·5 부터 같은 형태였고 이 페이즈는 그 패턴을 후보 목록으로 넓혔다. 06-CONTEXT §deferred 의 "구독 실패 표면화" 와는 다른 항목이다 — 여기서는 구독이 살아 있는데 값이 빠진다(B-5).
**Fix:** 조회를 `subscribe` 의 상태 콜백 안에서 `SUBSCRIBED` 마다 실행한다 — 최초 join 과 재연결 rejoin 양쪽에서 스냅샷이 구독 확정 **뒤**에 뜨므로, 그 이후의 이벤트는 스트림으로 오고 그 이전은 스냅샷에 있다.
```ts
useEffect(() => {
  let cancelled = false;
  const ch = supabase
    .channel(topic)
    .on(/* INSERT */).on(/* DELETE */)
    .subscribe((status) => {
      // 조회는 구독이 확정된 뒤에 한다. 스냅샷 시점과 join 사이에 커밋된 변경은 어느 쪽에도 실리지 않고,
      // 재연결의 rejoin 에서도 이 콜백이 다시 불려 끊긴 동안의 변경을 스냅샷으로 되찾는다.
      if (status !== "SUBSCRIBED") return;
      supabase.from("candidates").select("*").order("created_at", { ascending: true }).then(({ data, error }) => {
        if (cancelled) return;
        dispatch({ type: "fetched", rows: (data as CandidateRow[] | null) ?? null, error });
      });
    });
  return () => {
    cancelled = true;
    supabase.removeChannel(ch);
  };
}, [topic]);
```
재조회가 의미를 가지려면 `lib/rowset.ts:70` 의 `if (state.loaded) return state;`(중복 응답 무시)를 "두 번째 `fetched` 는 목록을 **교체**한다" 로 바꿔야 하고, 그 사이 도착한 이벤트를 새 스냅샷 위에 다시 얹으려면 `resync` 진입 시 `pending` 을 다시 쌓는 상태가 필요하다 — D-04 의 `fetched` 계약을 손대는 결정이라 재논의로 태그한다. `lib/settings.ts:82` 는 단일행이라 "Realtime 이 앞서면 이긴다" 논증을 지키되 재조회를 받는 형태로 따로 봐야 한다. 최소 버전(최초 창만 닫기)은 위 코드만으로 되고 리듀서 변경이 없다.

## Info

### IN-01: 빈 휠 문구가 아직 "메뉴 없음 · ADD A MENU" 다

**File:** `components/Wheel.tsx:91-96`
**Issue:** 후보 소스가 매장으로 바뀌었는데(D-01) 후보 0개일 때 허브에 그리는 문구는 "메뉴 없음"/"ADD A MENU" 그대로다. 컷오버 전 라이브에서는 이 화면이 **상시** 첫 인상이고, 컷오버 후에도 자정 직후·핀 0개 날에 보인다. D-21 의 치환 목록이 시각 리터럴만 세어 낱말은 빠졌다(B-6 이름=의도).
**Fix:** `"담긴 매장 없음"` / `"ADD A RESTAURANT"` (또는 `"PICK A PLACE"`) 로 바꾼다. 06-02 SUMMARY 의 "Wheel 4+/1−" 낭독 항목은 이 두 줄을 포함하도록 갱신한다.

### IN-02: `listTodayRows` 를 `useMemo` 없이 부르는 근거 주석이 틀렸다

**File:** `components/CandidateList.tsx:61-63` (컨벤션: `CLAUDE.md:63`)
**Issue:** 주석은 "입력이 매 렌더 새 배열이 아니고, 감싸면 의존성 배열이 필터 state 까지 끌고 들어와 얻는 것이 없다" 고 하지만, `candidates`·`catalog` 는 페이지가 `useMemo` 로 넘긴 안정 참조이고 `query` 는 셋 중 하나일 뿐이라 `useMemo(() => listTodayRows(candidates, catalog, query), [candidates, catalog, query])` 는 매초 tick 렌더(부모의 `onAddAction`/`onRemoveAction` 이 매 렌더 새 함수라 이 컴포넌트는 매초 다시 그려진다)에서 재계산과 `rows` 재생성을 전부 건너뛴다. 오늘 비용은 수십 행 규모라 무시할 만하지만(성능은 범위 밖), 레포 컨벤션("무거운 계산은 useMemo — 매장 탭의 `sortRestaurants` 가 그 이유")과 같은 자리에서 반대 선택을 하면서 근거가 사실과 다르다(B-8).
**Fix:** `useMemo` 로 감싸거나, 감싸지 않을 거면 주석을 "행 수가 수십 개라 비용이 무시할 만해 감싸지 않는다" 로 정직하게 바꾼다.

### IN-03: 로드 중 상태에 안내 문구가 없고 부분 로드 상태에서 토글이 살아 있다

**File:** `components/CandidateList.tsx:97-141`
**Issue:** `status === "loading"` 이면 빈 `<ul>` 만 그린다 — 매장 탭(`components/RestaurantList.tsx:83-87`)은 같은 상태에 "불러오는 중…" 을 둔다(B-9). 또 `rows.map` 은 `status` 와 무관하게 그려지므로 카탈로그가 먼저 오고 후보가 아직 안 온 수백 ms 동안 모든 매장이 "안 담김 + 담기 버튼 활성" 으로 보인다. 그때 담긴 매장을 다시 담으면 23505 → `null` → 배너 없는 성공으로 흡수돼 실해는 없지만, 헤더 카운터 `00` 과 함께 잠깐 거짓 화면이 스친다.
**Fix:** `status === "loading"` 에 "불러오는 중…" `<li>` 를 두고, `rows.map` 을 `status === "ready" &&` 로 감싼다(실패는 이미 바깥에서 막는다).

### IN-04: `busyId` 가 단일 슬롯이라 두 행을 연달아 누르면 먼저 끝난 쪽이 다른 행의 진행 표시를 지운다

**File:** `components/CandidateList.tsx:58`, `:127-137`
**Issue:** 행 A 토글 중 행 B 를 누르면 `setBusyId(B)` 가 A 를 덮고, A 의 `finally` 가 `setBusyId(null)` 로 B 의 busy 를 지운다. B 가 아직 진행 중인데 다시 눌리면 같은 방향 요청이 한 번 더 나간다 — 담기는 23505 로 무해, 빼기는 0행으로 무해라 실해는 없다. 05 IN-04 의 `pinBusyId` 와 같은 형태다.
**Fix:** `Set<string>` 으로 두거나(`setBusyIds(prev => new Set(prev).add(id))` / `delete`), 주석에 "동시 진행은 한 행뿐이라는 가정" 을 적어 둔다.

### IN-05: `created_at`·`spun_at` 문자열 비교가 REST 와 Realtime 의 직렬화가 같다는 전제 위에 있다

**File:** `lib/candidates.ts:40-52` (정렬), `:107-109` (`isNewSpin`)
**Issue:** 초기 조회 행은 PostgREST 가, 이후 행은 Realtime 페이로드가 만든다. 후보 목록은 정상 상태에서 **두 출처의 행이 섞인** 배열이고, `isNewSpin` 은 REST 로 읽은 `prev.spun_at` 과 Realtime 으로 온 `next.spun_at` 을 문자열로 비교한다. 두 경로 모두 Postgres JSON 인코딩(UTC 세션, `+00:00`, 소수 초 뒷자리 0 절단)을 쓰므로 현재 같다고 판단하지만, 그 전제는 코드 주석(`:41`)에만 있고 검증 수단이 없다 — 테스트는 같은 리터럴로만 두 함수를 부른다. 형식이 갈리는 날 정렬은 탭마다 다른 조각 번호를 보이고, `isNewSpin` 은 set-null UPDATE 에 `true` 를 돌려 in-06 이 막은 재회전이 소리 없이 돌아온다.
**Fix:** 비교를 파싱된 시각으로 바꿔 전제를 없앤다 — `Date.parse(a.candidate.created_at) - Date.parse(b.candidate.created_at)` (매장 시각도 같게), `isNewSpin` 은 `Date.parse(prev.spun_at) !== Date.parse(next.spun_at)`. 파싱 불가(NaN)는 "다르다" 로 떨어지므로 회전 쪽이 안전한 기본값이다.

### IN-06: `useSettings` 머리 주석이 사라진 `lunch-realtime` 토픽을 가리킨다

**File:** `lib/useSettings.ts:10-11`
**Issue:** "채널을 settings-changes 계열로 분리한 이유: app/page.tsx 의 lunch-realtime 은 …" — 그 토픽은 D-09 로 `results-<n>` 이 됐다(`app/page.tsx:60`). 낡은 이름을 따라가면 없는 코드를 찾게 된다(B-8).
**Fix:** "app/page.tsx 의 results-<n> 구독은" 으로 고친다. CR-01 수정 후에는 "effect 안에서 만드는 results 토픽" 으로 맞춘다.

### IN-07: CLAUDE.md 에 코드와 어긋나는 문장 세 곳이 남았다

**File:** `CLAUDE.md:74`, `:80`, `:17`
**Issue:** (a) `:74` 위험 지점 표의 `components/Wheel.tsx` 행 — "lint 에러 있는 곳. `lastSpinRef` 가드 제거하면 재회전 루프" 인데 `lastSpinRef` 는 파일에 없고(`grep -c` 0) lint 는 `:38` 이 스스로 0 이라고 적는다. 회전은 props 파생(`Wheel.tsx:58-66`)이라 지켜야 할 것은 "state+effect 로 되돌리지 말 것" 이다. (b) `:80` "미사용 코드: `Wheel` `onSpinCompleteAction` prop" — `formatHhMm`(`lib/time.ts:29`)이 이 페이즈로 소비처 0 이 됐고 06-02 SUMMARY 도 인정하지만 목록에 없다. (c) `:17` "`lib/settings.ts` 의 값 import 는 `DEFAULT_SPIN_TIME`·`parseSpinTime` 뿐" — `DEFAULT_SPIN_TIME_TEXT` 도 값 import 다(`lib/settings.ts:15-20`, 페이즈 이전부터). 이 페이즈가 같은 표·같은 문단을 고치면서 옆 줄을 그대로 뒀다(D-28 범위).
**Fix:** (a) 행을 "회전 각도를 props 에서 파생한다(`isSpinning`·`restRotation`). state+effect 로 되돌리면 `react-hooks/set-state-in-effect` 와 재회전 루프가 돌아온다" 로, (b) "미사용 코드: `Wheel` `onSpinCompleteAction` prop(참조 0) · `lib/time.ts` `formatHhMm`(참조 0, Phase 7 후보)" 로, (c) 목록에 `DEFAULT_SPIN_TIME_TEXT` 를 더한다.

---

_Reviewed: 2026-09-29T04:12:11Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
