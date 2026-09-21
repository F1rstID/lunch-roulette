"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { formatHhMmSs, todayKstDate } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { formatLoadError } from "@/lib/errors";
// 아직 기본 추첨 시각(11:55)을 그대로 넘긴다. settings 주입은 다음 플랜이다.
import { DEFAULT_SPIN_TIME } from "@/supabase/functions/_shared/spinTime";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RankingView } from "@/components/RankingView";

export default function RankPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [results, setResults] = useState<ResultRow[]>([]);
  // 초기 SELECT 실패 메시지. 실패를 "기록 0건" 랭킹으로 위장하지 않는다.
  const [loadError, setLoadError] = useState<string | null>(null);

  // 랭킹은 전체 기간을 로드하므로 오늘 행이 있으면 여기에 들어 있다.
  const phase = currentPhase(now, DEFAULT_SPIN_TIME, results.some((r) => r.date === todayKstDate(now)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("results")
        .select("*")
        .order("date", { ascending: false });
      if (cancelled) return;
      setLoadError(formatLoadError("랭킹", error));
      if (data) setResults(data as ResultRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel("rank-results")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "results" },
        (payload) => {
          const row = payload.new as ResultRow;
          setResults((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
        },
      )
      .on(
        // 다시 돌리기는 같은 날짜 행을 UPDATE 하므로 id 기준으로 교체
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "results" },
        (payload) => {
          const row = payload.new as ResultRow;
          setResults((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  return (
    <>
      <TopBar active="rank" phase={phase} clockTime={formatHhMmSs(now)} />
      <main className="wrap" style={{ flex: 1 }}>
        <ErrorBanner message={loadError} onCloseAction={() => setLoadError(null)} />
        <RankingView results={results} />
      </main>
    </>
  );
}
