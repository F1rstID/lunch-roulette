"use client";

// 오늘 후보를 읽어 화면에 공급하는 I/O 전용 훅. 판단은 하나도 하지 않는다 — 어떤 이벤트가 어떤 목록이
// 되는지는 전부 lib/candidates.ts 가 주입한 lib/rowset.ts 의 병합 규칙에 있다. 이유는 하나다: 레포는
// environment: "node" 단일 구성이라 React 렌더 하네스가 없고(vitest.config.mts:13-14), 훅에 분기가 남으면
// 그 분기는 영원히 테스트되지 않는다(lib/useRestaurants.ts:3-6 과 같은 논증).
// 토픽 뒤에 번호를 붙이는 이유는 따로 있다 — 토픽은 페이지가 아니라 **구독 인스턴스마다** 유일해야 한다.
// realtime-js 는 토픽으로 채널을 dedup 하는데 이미 join 된 채널의 leave 는 서버 ack 가 올 때까지 목록에서
// 빠지지 않는다. 라우트 전환은 "떠나는 트리 cleanup → 새 트리 effect" 순서라, 고정 문자열을 쓰면 새 구독이
// 아직 떠나는 중인 옛 인스턴스에 붙어 join 을 통째로 건너뛴다. 에러 없이 조용히 죽고 초기 조회는 정상이라
// 눈에 띄지 않는 것이 이 버그의 성질이다(lib/useSettings.ts:11-15).
// 담김·빠짐 두 이벤트만 구독하는 이유: 이 테이블은 매장 식별자와 담은 시각뿐이라 앱 경로에 행을 고치는
// 동작이 아예 없다. 갱신 분기를 더 두면 아무도 밟지 않는 실패 경로가 하나 늘 뿐이다.
// 컷오버(Phase 8) 전에는 라이브에 이 테이블이 없어 최초 조회가 PGRST205(404)로 실패하고 구독도 재시도에
// 들어간다. 배너 + 빈 목록이 그때의 정상이다 — 오히려 배너가 안 뜨면 에러를 삼키고 있다는 신호다.
// 이 훅은 읽기만 한다. 담기·빼기는 페이지의 핸들러가 직접 부른다 — 읽기와 쓰기를 한 모듈에 두면 화면이
// 쓰기 응답으로도 갱신되기 시작하고, 갱신 경로가 둘이 되면 낙관적 업데이트를 하지 않는다는 레포 규칙이
// 지켜지는지 확인할 수 없다.

import { useEffect, useReducer, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type CandidateRow } from "@/lib/supabase/client";
import {
  INITIAL_CANDIDATES_STATE,
  candidatesReducer,
  type CandidatesState,
} from "@/lib/candidates";

// 인스턴스마다 토픽에 붙일 일련번호. React 의 useId 를 쓰지 않는 이유는 문자 집합이다 — React 19 의 id 는
// «r0» 처럼 ASCII 밖 문자를 담고, 토픽은 소켓 위로 그대로 나가는 식별자라 ASCII 로 묶어 두는 편이 안전하다.
let topicSeq = 0;

export function useCandidates(): CandidatesState {
  const [state, dispatch] = useReducer(candidatesReducer, INITIAL_CANDIDATES_STATE);
  // 초기화 함수로 매기고 state 에 보관한다: 렌더마다 번호가 바뀌면 effect 가 매번 재구독하고,
  // 개발용 이중 렌더에서도 마운트당 번호를 하나만 쓴다(번호가 하나 더 소모돼도 유일성은 그대로다).
  const [topic] = useState(() => `candidates-${++topicSeq}`);

  useEffect(() => {
    // 언마운트 뒤 도착한 응답을 버리는 장치. 취소 플래그를 두고 분기하는 대신 보낼 곳 자체를 빈 함수로
    // 바꾼다 — 그래야 이 훅 본문에 판정이 한 줄도 남지 않는다(lib/useRestaurants.ts 와 같은 형태).
    let send: typeof dispatch = dispatch;
    (async () => {
      // 조회 순서만 고정한다. 휠·목록의 표시 순서는 lib/candidates.ts 의 3단 정렬이 정하고 그쪽이 정본이다 —
      // 두 곳에서 정렬하면 같은 규칙의 정의처가 둘이 된다.
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: true });
      // 성공·실패의 가름은 리듀서가 한다. 여기서는 응답을 그대로 한 액션에 실어 보낸다.
      send({ type: "fetched", rows: (data as CandidateRow[] | null) ?? null, error });
    })();
    return () => {
      send = () => {};
    };
  }, []);

  useEffect(() => {
    // 두 이벤트를 한 분기로 합치지 않는다. 합치면 어떤 이벤트인지 판정하는 단언이 훅으로 되돌아오고,
    // 그 단언은 렌더 하네스가 없어 테스트되지 않는 자리에 놓인다.
    const ch: RealtimeChannel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidates" },
        (payload) => {
          dispatch({ type: "changed", event: "INSERT", row: payload.new as CandidateRow });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "candidates" },
        (payload) => {
          // 이 페이로드에는 PK 밖에 오지 않는다. 이 테이블은 PK 가 매장 식별자라 지울 대상을 그 한 컬럼이
          // 온전히 가리킨다 — 부분 행으로 목록을 다시 만들려 들지 않고 식별자만 넘긴다.
          const oldRow = payload.old as Partial<CandidateRow>;
          dispatch({ type: "changed", event: "DELETE", key: oldRow.restaurant_id ?? null });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [topic]);

  return state;
}
