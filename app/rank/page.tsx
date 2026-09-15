"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { formatHhMmSs } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { TopBar } from "@/components/TopBar";
import { RankingView } from "@/components/RankingView";

export default function RankPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const phase = currentPhase(now);
  const [results, setResults] = useState<ResultRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("results")
        .select("*")
        .order("date", { ascending: false });
      if (!cancelled && data) setResults(data as ResultRow[]);
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
        <RankingView results={results} />
      </main>
    </>
  );
}
