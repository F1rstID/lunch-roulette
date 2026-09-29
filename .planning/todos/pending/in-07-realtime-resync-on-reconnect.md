---
title: 조회를 subscribe 상태 콜백 안으로 옮겨 구독 전 창과 재연결 뒤 재조회 공백을 닫는다
created: 2026-09-29
source: .planning/phases/06-today-tab/06-REVIEW.md (WR-02)
resolves_phase: 8
---
컷오버 전에 **결정만** 한다. `lib/rowset.ts` 의 D-04 `fetched` 계약(중복 응답 무시)을 손대는 변경이라 Phase 6 리뷰에서 [설계 재논의] 로 태그하고 미적용했다.

## 문제 (06-REVIEW WR-02 원문 요지)

**대상:** `lib/useCandidates.ts` 조회 effect ↔ 구독 effect · `lib/useRestaurants.ts` 같은 쌍 · `lib/useSettings.ts` 같은 쌍 · `app/page.tsx` 의 오늘 결과 조회 ↔ results 구독. 리듀서 계약은 `lib/rowset.ts` 의 `pending` 버퍼와 `if (state.loaded) return state;`.

네 구독 모두 SELECT 와 `subscribe()` 를 같은 커밋에서 **동시에** 띄운다. `lib/rowset.ts` 의 `pending` 버퍼는 "응답보다 **먼저 도착한** 이벤트" 를 흡수하지만, **스냅샷 이후에 커밋되고 join 이전이라 아예 배달되지 않은** 변경은 어느 쪽에도 실리지 않는다. 버퍼가 덮지 않는 **반대 방향의 창**이다.

두 경로로 열린다:

1. **콜드 로드.** REST 응답(~100ms)이 웹소켓 연결 + join ack(~200-400ms)보다 앞서므로 그 창이 매 첫 방문마다 열린다.
2. **재연결(더 흔하다).** 노트북 슬립·네트워크 단절 뒤 realtime-js 가 소켓을 다시 열고 채널을 rejoin 하지만 `postgres_changes` 에는 재생이 없고 훅은 재조회하지 않는다. 오전에 열어 둔 탭이 점심 직전에 깨어나면 후보 목록·휠이 슬립 동안의 담기·빼기를 모른 채 `spinning` 을 맞고, 당첨 `restaurant_id` 가 이 탭의 `todayCandidates` 에 없으면 `winnerIndex` -1 로 하이라이트도 없다.

`candidates` 는 D-02 로 UPDATE 를 구독하지 않아 upsert 자가 치유 경로도 없다(매장 카탈로그와 갈리는 지점). `restaurants`·`settings`·`results` 는 Phase 3·5 부터 같은 형태였고 Phase 6 이 그 패턴을 후보 목록으로 넓혔다. 06-CONTEXT §deferred 의 "구독 실패 표면화" 와는 **다른 항목**이다 — 여기서는 구독이 살아 있는데 값이 빠진다(B-5).

## 고치는 방향 (원문 Fix)

조회를 `subscribe` 의 상태 콜백 안에서 `SUBSCRIBED` 마다 실행한다 — 최초 join 과 재연결 rejoin 양쪽에서 스냅샷이 구독 확정 **뒤**에 뜨므로, 그 이후의 이벤트는 스트림으로 오고 그 이전은 스냅샷에 있다.

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

## 결정해야 하는 것 (재논의 지점)

- 재조회가 의미를 가지려면 `lib/rowset.ts` 의 `if (state.loaded) return state;`(중복 응답 무시)를 **"두 번째 `fetched` 는 목록을 교체한다"** 로 바꿔야 한다. 그 가드는 지금 D-04 의 `fetched` 계약이고 `lib/rowset.test.ts`·`lib/restaurants.test.ts` 가 고정하고 있다.
- 재조회 사이에 도착한 이벤트를 새 스냅샷 위에 다시 얹으려면 `resync` 진입 시 `pending` 을 다시 쌓는 상태가 필요하다(지금 `pending` 은 최초 로드 전에만 쌓인다).
- `lib/settings.ts:82` 는 단일행이라 "Realtime 이 앞서면 이긴다" 논증을 지키되 재조회를 받는 형태로 **따로** 봐야 한다.
- **최소 버전**(최초 창만 닫기)은 위 코드만으로 되고 리듀서 변경이 0이다 — 재연결 재조회를 포기하면 오늘 계약을 하나도 건드리지 않는다. 이 쪽을 고를지가 첫 갈림길이다.

## 함께 볼 것

- `app/page.tsx` 의 오늘 결과 조회는 훅이 아니라 페이지 effect다(`[todayKey]`). 같은 형태로 옮기면 CR-01 로 effect 안에서 매기게 된 `results-<n>` 토픽과 한 effect 에 모인다.
- 두 effect 를 하나로 합치면 조회 effect 의 deps(`[]`)와 구독 effect 의 deps(`[topic]`)가 합쳐진다 — 훅 쪽은 둘 다 마운트당 한 번이라 문제없지만, 페이지 쪽은 `todayKey` 가 함께 들어온다.

**Phase 7 추가(07 리뷰 IN-06):** `app/rank/page.tsx` 의 재조회(전환일 변경·자정)는 `setResults(data)` 로 상태를 통째로 갈아끼워 SELECT 스냅샷 뒤·응답 전에 도착한 INSERT/UPDATE 이벤트를 버린다. 초기 로드의 기존 창과 같은 성질이고 이제 전환일 변경이 그 창을 임의 시점에 다시 연다(드물다). `rowset` 의 `pending` 버퍼를 결과 목록에도 적용할지 이 todo 에서 함께 결정한다.
