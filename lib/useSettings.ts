"use client";

// settings 단일행을 읽어 앱에 공급하는 I/O 전용 훅. 판단은 하나도 하지 않는다 — 어떤 입력이 어떤 상태가
// 되는지는 전부 lib/settings.ts 의 리듀서에 있다. 이유는 하나다: 레포는 environment: "node" 단일 구성이라
// React 렌더 하네스가 없고(vitest.config.mts:13-14), 훅에 분기가 남으면 그 분기는 영원히 테스트되지 않는다.
// 아래 단일행 조회의 0행은 에러가 아니다 — data: null, error: null 이 온다(app/page.tsx 의 오늘 결과와 같은 논증).
// 그래서 error 를 먼저 보고 failed, 아니면 loaded(data ?? null) 로 가른다. 아직 시드되지 않은 정상 상태에서
// 배너가 뜨면 안 되고, 테이블이 통째로 없는 상태는 반대로 반드시 떠야 한다.
// 채널을 settings-changes 로 분리한 이유: app/page.tsx 의 lunch-realtime 은 휠 이중 회전 가드
// (initialLoadedRef)가 걸린 위험 지점이라(CLAUDE.md 위험 지점 표) 실패 경로를 섞지 않는다.
// 컷오버(Phase 8) 전에는 라이브에 settings 테이블이 없어 최초 SELECT 가 PGRST205(404)로 실패하고 구독도
// 5~10초마다 재시도에 들어간다. 채널은 닫히지 않고 앱은 기본값(11:55 · 쿨다운 0)으로 계속 동작하므로
// 이것이 정상이다 — 오히려 배너가 안 뜨면 에러를 삼키고 있다는 신호다(SETT-03).
// 이 훅은 읽기만 한다. 앱 계층에 쓰기 경로를 만들지 않는 것이 RLS 쓰기 정책 0건과 짝을 이루는 통제다.

import { useEffect, useReducer } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type SettingsRow } from "@/lib/supabase/client";
import { INITIAL_SETTINGS_STATE, settingsReducer, type SettingsState } from "@/lib/settings";

export function useSettings(): SettingsState {
  const [state, dispatch] = useReducer(settingsReducer, INITIAL_SETTINGS_STATE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (cancelled) return;
      if (error) dispatch({ type: "failed", message: error.message });
      else dispatch({ type: "loaded", row: (data as SettingsRow | null) ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel("settings-changes")
      .on(
        // UPDATE 의 payload.new 는 전체 새 행이라 통째 교체하면 되고, DELETE 의 payload.old 는 PK 만
        // 오므로 행을 재구성할 수 없다 — 그래서 DELETE 는 row 를 null 로 넘겨 기본값 복귀로 처리한다.
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        (payload) => {
          dispatch({
            type: "changed",
            event: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: payload.eventType === "DELETE" ? null : (payload.new as SettingsRow),
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return state;
}
