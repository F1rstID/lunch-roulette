"use client";

// 이번 주 점심 기록(lunch_days, 월~오늘)과 당첨(results, 월~어제)을 읽어 화면에 공급하는 I/O 훅. 판단은 lib/lunchDay.ts 의
// lunchWeekReducer 가 한다 — 어떤 응답이 어떤 상태가 되는지(세대 불일치 폐기·창 밖 날짜 무시·upsert)는 전부 그쪽 spec 이 든다.
//
// 이 훅은 "훅 분기 0개" 규칙(lib/useSettings.ts·lib/useCandidates.ts)의 **의도적 예외** 다. 분기 둘이 남는다:
//   (1) 구독 콜백의 `status === "SUBSCRIBED"` — 채널이 (다시) 붙은 순간 재조회한다. 소켓이 끊긴 사이의 INSERT/UPDATE 는
//       이벤트로 오지 않으므로 "구독 하나로 화면을 맞춘다" 가 그 구간에서 거짓이 된다(Codex 평가 C1). 재연결·재조회는
//       I/O 계층의 판단이고, 그것을 금지한 규칙이 C1 을 만들었다(A1). 결정 자체(무엇을 다시 읽나·stale 응답 처리)는 리듀서가 갖는다.
//   (2) `document.visibilityState === "visible"` — 휴대폰에서 다른 앱을 보다 돌아온 탭은 소켓이 죽었다 살아난 뒤일 수 있다.
//       hidden 으로 가는 순간에도 재조회하면 낭비라 visible 만 받는다.
// 두 분기 모두 "refresh 를 디스패치할지" 만 가르고 결과를 해석하지 않는다. 다른 훅으로 이 패턴을 넓히는 것은 별건(in-07·C1).
//
// 조회는 세대(state.generation)가 바뀔 때마다 한 번이다. refresh 가 세대를 올리고 창을 상태에 적으므로, 마운트(세대 0, 초기화
// 함수가 창을 미리 넣는다)·재연결·탭 복귀·자정(todayKey 변경 → 재구독 → SUBSCRIBED → refresh) 네 경로가 같은 effect 하나를 지난다.
// 늦게 온 옛 조회는 리듀서가 세대 불일치로 버리고, 언마운트 뒤 응답은 cancelled 가드가 버린다.
//
// 토픽은 **구독마다** effect 안에서 매긴다(app/page.tsx 의 results 구독과 같은 CR-01 논증) — 이 훅은 자정에 todayKey·weekStart 가
// 바뀌어 같은 인스턴스가 재구독한다. state 에 둔 토픽으로 재구독하면 realtime-js 가 leave 중인 옛 채널을 돌려주고 join 을 건너뛴다.
// lunch_days 는 INSERT/UPDATE 두 분기만 구독한다 — delete 정책이 없어 DELETE 이벤트가 올 경로가 없다(0007). results 는 구독하지
// 않는다: 이번 주 당첨은 과거 행이라 바뀌지 않고(매장 삭제의 set-null 만 예외 — 그러면 그날 제외가 사라지는 것이 맞고, 다음
// 재조회가 반영한다), 오늘 결과는 페이지가 이미 들고 있다.
// 이 훅은 읽기만 한다. 목적지·방문 쓰기는 페이지의 핸들러가 직접 부른다(읽기·쓰기 분리 규칙은 lib/useCandidates.ts 머리 주석).

import { useEffect, useReducer } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type LunchDayRow, type WeekWinnerRow } from "@/lib/supabase/client";
import { INITIAL_LUNCH_WEEK_STATE, lunchWeekReducer, type LunchWeekState } from "@/lib/lunchDay";

// 구독마다 토픽에 붙일 일련번호. React 의 useId 를 쓰지 않는 이유는 문자 집합이다 — React 19 의 id 는
// «r0» 처럼 ASCII 밖 문자를 담고, 토픽은 소켓 위로 그대로 나가는 식별자라 ASCII 로 묶어 두는 편이 안전하다.
let topicSeq = 0;

export function useLunchWeek(weekStart: string, todayKey: string): LunchWeekState {
  // 초기화 함수로 창을 미리 넣는다 — 그래야 세대 0 의 첫 조회가 빈 창("")으로 나가지 않는다.
  const [state, dispatch] = useReducer(
    lunchWeekReducer,
    { weekStart, todayKey },
    (init) => ({ ...INITIAL_LUNCH_WEEK_STATE, weekStart: init.weekStart, today: init.todayKey }),
  );
  const { generation, weekStart: windowStart, today: windowEnd } = state;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // lunch_days 는 오늘을 포함한다(목적지 카드가 오늘 행을 본다). results 는 어제까지다 — 오늘 결과는 페이지가 들고 있고,
      // 제외 창 [weekStart, today) 와 같은 경계다(_shared/cooldown.ts weeklyWindowStart).
      const [daysRes, winnersRes] = await Promise.all([
        supabase.from("lunch_days").select("*").gte("date", windowStart).lte("date", windowEnd),
        supabase
          .from("results")
          .select("date, restaurant_id, spun_at")
          .gte("date", windowStart)
          .lt("date", windowEnd),
      ]);
      // 언마운트·재실행 뒤 도착한 응답은 버린다. 판단이 아니라 취소 가드(배관)다 — 성공·실패의 가름은 리듀서의 fetched 액션이 한다.
      if (cancelled) return;
      dispatch({
        type: "fetched",
        generation,
        days: (daysRes.data as LunchDayRow[] | null) ?? [],
        winners: (winnersRes.data as WeekWinnerRow[] | null) ?? [],
        error: daysRes.error ?? winnersRes.error,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [generation, windowStart, windowEnd]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") dispatch({ type: "refresh", weekStart, today: todayKey });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [weekStart, todayKey]);

  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel(`lunch-days-${++topicSeq}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lunch_days" },
        (payload) => {
          dispatch({ type: "changed", row: payload.new as LunchDayRow });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lunch_days" },
        (payload) => {
          dispatch({ type: "changed", row: payload.new as LunchDayRow });
        },
      )
      .subscribe((status) => {
        // (1) 의 분기. 첫 구독에서도 한 번 더 읽는다 — 세대 0 조회와 구독 사이의 틈을 닫는 비용이 요청 하나다.
        if (status === "SUBSCRIBED") dispatch({ type: "refresh", weekStart, today: todayKey });
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [weekStart, todayKey]);

  return state;
}
