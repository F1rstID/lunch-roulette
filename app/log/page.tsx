"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type LunchDayRow, type ResultRow } from "@/lib/supabase/client";
import { todayKstDate, formatHhMmSs, kstParts } from "@/lib/time";
import { currentPhase, displayPhase } from "@/lib/phase";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";
import { useSettings } from "@/lib/useSettings";
import { applyLunchDays, filterSince, type HistoryEntry } from "@/lib/history";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CalendarLog } from "@/components/CalendarLog";

// 구독마다 토픽에 붙일 일련번호. 토픽은 페이지가 아니라 구독 인스턴스마다 유일해야 한다 — 같은 토픽으로 재구독하면
// realtime-js 가 leave 중인 옛 채널을 돌려주고 join 을 건너뛴다(app/page.tsx 의 results-<n> 과 같은 논증).
let topicSeq = 0;

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
  // 같은 창의 점심 기록(목적지·방문). 결과 행과 날짜로 조인해 "간 곳" 을 만든다(lib/history.ts applyLunchDays).
  const [days, setDays] = useState<LunchDayRow[]>([]);
  // 초기 SELECT 실패 메시지. 실패를 빈 달력으로 위장하지 않는다.
  const [loadError, setLoadError] = useState<string | null>(null);

  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const {
    settings,
    loaded: settingsLoaded,
    error: settingsError,
    warning: settingsWarning,
  } = useSettings();

  // 이미 로드한 results 에서 오늘 결과 여부를 파생한다. 로드 창이 [보는 달 1일, 두 달 뒤 1일) — 즉 보는
  // 달과 그 다음 달 — 이라, 이번 달이나 지난달을 보는 동안에는 오늘 행이 창 안에 있어 정확하다. 그보다
  // 과거로 가거나 미래 달로 넘길 때만 오늘 행이 빠져 상단 뱃지가 부정확해진다 — 이 페이지는 뱃지 외에
  // phase 를 쓰지 않아 기능 영향은 0이고, 오늘 결과를 따로 조회하는 것은 뒤쪽 페이즈로 미룬다.
  // 설정 조회가 끝나기 전에는 기본 시각으로 계산한 "추첨 대기" 를 가린다 — 네 페이지의 라벨이 첫 페인트에서
  // 갈리지 않게 하는 표시용 보정이다(D-23).
  const phase = displayPhase(
    currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKey)),
    settingsLoaded,
  );

  // 월 변경 시 또는 마운트 시 해당 월 데이터 로드 (보는 달 + 다음 달 = 2개월 창).
  // 전환일로 조회를 자르지 않는 이유: 창이 이미 두 달이라 행 수가 작고, 전환일이 바뀌면(settings Realtime) 재조회 없이
  // 아래 filterSince 만 다시 돌면 된다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = `${calMonth.y}-${String(calMonth.m).padStart(2, "0")}-01`;
      // 다다음달 1일까지
      const endYear = calMonth.m >= 11 ? calMonth.y + 1 : calMonth.y;
      const endMonth = ((calMonth.m + 1) % 12) + 1; // current+2
      const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
      // 결과와 점심 기록을 같은 창으로 함께 읽는다 — 한쪽만 창이 다르면 조인에서 빠진 날이 "확인 안 됨" 으로 둔갑한다.
      const [resultsRes, daysRes] = await Promise.all([
        supabase.from("results").select("*").gte("date", start).lt("date", end).order("date", { ascending: true }),
        supabase.from("lunch_days").select("*").gte("date", start).lt("date", end),
      ]);
      if (cancelled) return;
      // 이 effect 는 calMonth 마다 재실행된다. 두 실패를 한 줄에 모으고, 성공하면 null 이 들어가 이전 달의 실패 배너가 걷힌다.
      setLoadError(
        joinLoadErrors([formatLoadError("기록", resultsRes.error), formatLoadError("점심 기록", daysRes.error)]),
      );
      if (resultsRes.data) setResults(resultsRes.data as ResultRow[]);
      if (daysRes.data) setDays(daysRes.data as LunchDayRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [calMonth]);

  // 자동 추첨(INSERT)은 추가, 다시 돌리기(UPDATE)는 같은 id 행을 교체
  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel(`results-log-${++topicSeq}`)
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

  // 점심 기록(목적지·방문)의 INSERT/UPDATE. 날짜가 키라 같은 날짜 행을 교체한다 — delete 정책이 없어 DELETE 는 오지 않는다(0007).
  // 창 밖 날짜가 와도 그대로 둔다: 조인은 결과 행 쪽에서 날짜를 찾으므로 남는 행은 아무것도 바꾸지 않는다.
  useEffect(() => {
    const upsertDay = (row: LunchDayRow) =>
      setDays((prev) =>
        prev.some((d) => d.date === row.date) ? prev.map((d) => (d.date === row.date ? row : d)) : [...prev, row],
      );
    const ch: RealtimeChannel = supabase
      .channel(`lunch-days-log-${++topicSeq}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lunch_days" },
        (payload) => upsertDay(payload.new as LunchDayRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "lunch_days" },
        (payload) => upsertDay(payload.new as LunchDayRow),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // 화면에 올리는 행은 전환일 이후만이다(HIST-01). 위 phase 계산은 필터 전 행을 본다 — 오늘 결과가 있다는 사실은
  // 전환일과 무관하고, 전환 절차가 history_since 를 다음 날로 밀어 두는 하루(wr-01) 에도 상단 라벨이 맞아야 한다.
  // 그 위에 점심 기록을 조인해 "간 곳" 기준 행으로 바꾼다(HIST-04) — 단체 점심 안 한 날은 여기서 빠진다.
  const entries = useMemo(
    () => applyLunchDays(filterSince(results, settings.historySince), days),
    [results, settings.historySince, days],
  );

  const logMap = useMemo<Record<string, HistoryEntry<ResultRow>>>(() => {
    const m: Record<string, HistoryEntry<ResultRow>> = {};
    for (const e of entries) m[e.date] = e;
    return m;
  }, [entries]);

  const daysByDate = useMemo<Record<string, LunchDayRow>>(() => {
    const m: Record<string, LunchDayRow> = {};
    for (const d of days) m[d.date] = d;
    return m;
  }, [days]);

  const count = entries.filter((e) =>
    e.date.startsWith(`${calMonth.y}-${String(calMonth.m).padStart(2, "0")}`),
  ).length;

  // 전환일 이전 달이 비어 보이는 것은 고장이 아니라 경계다 — 부제가 그 경계를 말한다.
  // 필터·조회 경계와 같은 판정(=== null)을 쓴다 — 빈 문자열이 흘러들 때 셋이 제각각 갈리지 않게.
  const subhead =
    settings.historySince !== null
      ? `${settings.historySince.replace(/-/g, ".")} 부터 실제로 간 곳, 그리고 그날의 추첨 결과까지.`
      : "매일 실제로 간 곳, 그리고 그날의 추첨 결과까지.";

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

        <div className="l-page-head">
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>
              점심 기록
            </div>
            <h1 style={head.h1}>{count}일의 점심</h1>
            <div style={head.sub}>{subhead}</div>
          </div>
        </div>

        <CalendarLog
          logMap={logMap}
          days={daysByDate}
          todayKey={todayKey}
          year={calMonth.y}
          month={calMonth.m}
          onChangeMonthAction={(y, m) => setCalMonth({ y, m })}
        />
      </main>
    </>
  );
}

// 머리 영역의 여백은 app/globals.css 의 l-page-head 가 가진다(네 페이지 공용).
const head = {
  h1: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;
