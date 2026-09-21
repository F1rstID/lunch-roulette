"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { todayKstDate, formatHhMmSs, kstParts } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";
import { useSettings } from "@/lib/useSettings";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CalendarLog } from "@/components/CalendarLog";

export default function LogPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = todayKstDate(now);

  // 보고 있는 월
  const [calMonth, setCalMonth] = useState(() => {
    const p = kstParts(now);
    return { y: p.year, m: p.month };
  });

  const [results, setResults] = useState<ResultRow[]>([]);
  // 초기 SELECT 실패 메시지. 실패를 빈 달력으로 위장하지 않는다.
  const [loadError, setLoadError] = useState<string | null>(null);

  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const { settings, error: settingsError, warning: settingsWarning } = useSettings();

  // 이미 로드한 results 에서 오늘 결과 여부를 파생한다. 다른 달을 보고 있으면 오늘 행이 로드 범위
  // 밖이라 상단 뱃지가 부정확할 수 있다 — 이 페이지는 뱃지 외에 phase 를 쓰지 않아 기능 영향은 0이고,
  // 오늘 결과를 따로 조회하는 것은 이 페이지를 다시 쓰는 뒤쪽 페이즈로 미룬다.
  const phase = currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKey));

  // 월 변경 시 또는 마운트 시 해당 월 데이터 로드 (3개월 윈도우)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = `${calMonth.y}-${String(calMonth.m).padStart(2, "0")}-01`;
      // 다다음달 1일까지
      const endYear = calMonth.m >= 11 ? calMonth.y + 1 : calMonth.y;
      const endMonth = ((calMonth.m + 1) % 12) + 1; // current+2
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("results")
        .select("*")
        .gte("date", start)
        .lt("date", end)
        .order("date", { ascending: true });
      if (cancelled) return;
      // 이 effect 는 calMonth 마다 재실행된다. 성공하면 null 이 들어가 이전 달의 실패 배너가 걷힌다.
      setLoadError(formatLoadError("기록", error));
      if (data) setResults(data as ResultRow[]);
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

  // 설정 실패·경고는 훅이 소유하므로 닫기 버튼(setLoadError(null))으로 사라지지 않는다. 컷오버 전에는
  // settings 테이블이 없어 상시 표시되는 것이 정상이다. 파싱 경고는 이미 완성된 문장이라 접두를 붙이지 않는다.
  const loadBanner = joinLoadErrors([
    loadError,
    formatLoadError("설정", settingsError ? { message: settingsError } : null),
    settingsWarning,
  ]);

  return (
    <>
      <TopBar active="log" phase={phase} clockTime={formatHhMmSs(now)} />

      <main className="wrap" style={{ flex: 1 }}>
        <ErrorBanner message={loadBanner} onCloseAction={() => setLoadError(null)} />

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
