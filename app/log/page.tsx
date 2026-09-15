"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { todayKstDate, formatHhMmSs, kstParts } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { TopBar } from "@/components/TopBar";
import { CalendarLog } from "@/components/CalendarLog";

export default function LogPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const phase = currentPhase(now);
  const todayKey = todayKstDate(now);

  // 보고 있는 월
  const [calMonth, setCalMonth] = useState(() => {
    const p = kstParts(now);
    return { y: p.year, m: p.month };
  });

  const [results, setResults] = useState<ResultRow[]>([]);

  // 월 변경 시 또는 마운트 시 해당 월 데이터 로드 (3개월 윈도우)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = `${calMonth.y}-${String(calMonth.m).padStart(2, "0")}-01`;
      // 다다음달 1일까지
      const endYear = calMonth.m >= 11 ? calMonth.y + 1 : calMonth.y;
      const endMonth = ((calMonth.m + 1) % 12) + 1; // current+2
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("results")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: true });
      if (!cancelled && data) setResults(data as ResultRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [calMonth]);

  // 자동 추첨(INSERT)은 추가, 다시 돌리기(UPDATE)는 같은 id 행을 교체
  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel("log-results")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "results" },
        (payload) => {
          const row = payload.new as ResultRow;
          setResults((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
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

  const logMap = useMemo<Record<string, ResultRow>>(() => {
    const m: Record<string, ResultRow> = {};
    for (const r of results) m[r.date] = r;
    return m;
  }, [results]);

  const count = results.filter((r) =>
    r.date.startsWith(`${calMonth.y}-${String(calMonth.m).padStart(2, "0")}`),
  ).length;

  return (
    <>
      <TopBar active="log" phase={phase} clockTime={formatHhMmSs(now)} />

      <main className="wrap" style={{ flex: 1 }}>
        <div style={head.wrap}>
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>
              점심 기록
            </div>
            <h1 style={head.h1}>{count}일의 점심</h1>
            <div style={head.sub}>매일 룰렛이 정해준 메뉴, 그리고 그날의 후보 수까지.</div>
          </div>
        </div>

        <CalendarLog
          logMap={logMap}
          todayKey={todayKey}
          year={calMonth.y}
          month={calMonth.m}
          onChangeMonthAction={(y, m) => setCalMonth({ y, m })}
        />
      </main>
    </>
  );
}

const head = {
  wrap: {
    padding: "36px 0 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  h1: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;
