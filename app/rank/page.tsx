"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { formatHhMmSs, todayKstDate } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";
import { useSettings } from "@/lib/useSettings";
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

  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const { settings, error: settingsError, warning: settingsWarning } = useSettings();

  // 랭킹은 전체 기간을 로드하므로 오늘 행이 있으면 여기에 들어 있다.
  const phase = currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKstDate(now)));

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

  // 설정 실패·경고는 훅이 소유하므로 닫기 버튼(setLoadError(null))으로 사라지지 않는다. 컷오버 전에는
  // settings 테이블이 없어 상시 표시되는 것이 정상이다. 파싱 경고는 이미 완성된 문장이라 접두를 붙이지 않는다.
  const loadBanner = joinLoadErrors([
    loadError,
    formatLoadError("설정", settingsError ? { message: settingsError } : null),
    settingsWarning,
  ]);

  return (
    <>
      <TopBar active="rank" phase={phase} clockTime={formatHhMmSs(now)} />
      <main className="wrap" style={{ flex: 1 }}>
        <ErrorBanner message={loadBanner} onCloseAction={() => setLoadError(null)} />
        <RankingView results={results} />
      </main>
    </>
  );
}
