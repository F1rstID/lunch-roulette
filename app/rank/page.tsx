"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { formatHhMmSs, todayKstDate } from "@/lib/time";
import { currentPhase, displayPhase } from "@/lib/phase";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";
import { useSettings } from "@/lib/useSettings";
import { filterSince } from "@/lib/history";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RankingView } from "@/components/RankingView";

// 랭킹이 읽는 컬럼만 조회한다. candidates jsonb 가 행마다 가장 무겁고 랭킹은 그것을 쓰지 않는다.
// id 는 Realtime 이벤트의 멱등 병합에 필요하다.
const RANK_COLUMNS = "id,date,menu,restaurant_id";
type RankRow = Pick<ResultRow, "id" | "date" | "menu" | "restaurant_id">;

// 구독마다 토픽에 붙일 일련번호(app/log/page.tsx 와 같은 논증).
let topicSeq = 0;

export default function RankPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const [results, setResults] = useState<RankRow[]>([]);
  // 초기 SELECT 실패 메시지. 실패를 "기록 0건" 랭킹으로 위장하지 않는다.
  const [loadError, setLoadError] = useState<string | null>(null);

  const todayKey = todayKstDate(now);

  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const {
    settings,
    loaded: settingsLoaded,
    error: settingsError,
    warning: settingsWarning,
  } = useSettings();

  // 조회는 전환일 이후로 좁히므로 오늘 행이 있으면 여기에 들어 있다(아래 lowerBound 가 오늘을 항상 포함한다).
  // 설정 조회가 끝나기 전에는 기본 시각으로 계산한 "추첨 대기" 를 가린다 — 네 페이지의 라벨이 첫 페인트에서
  // 갈리지 않게 하는 표시용 보정이다(D-23).
  const phase = displayPhase(
    currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKey)),
    settingsLoaded,
  );

  // 조회의 아래 경계. 전환일이 오늘보다 뒤면(전환 절차가 history_since 를 다음 날로 밀어 둔 하루, wr-01) 오늘 행이
  // 빠져 상단 라벨이 "추첨 대기" 로 틀리므로 오늘까지는 내려 잡는다 — 그 행을 랭킹에서 빼는 것은 filterSince 다.
  // null 은 전환일 미확정(컷오버 전 라이브 포함)이고 그때는 전체 기간을 읽는다.
  const historySince = settings.historySince;
  const lowerBound = historySince === null ? null : historySince < todayKey ? historySince : todayKey;

  // 설정이 오기 전에는 조회하지 않는다 — 먼저 무제한으로 읽고 설정이 오면 다시 읽는 두 번 조회보다 한 왕복 기다리는
  // 쪽이 싸다. 전환일이 대시보드에서 바뀌면(settings Realtime) deps 가 바뀌어 다시 읽는다.
  useEffect(() => {
    if (!settingsLoaded) return;
    let cancelled = false;
    (async () => {
      let query = supabase.from("results").select(RANK_COLUMNS).order("date", { ascending: false });
      if (lowerBound !== null) query = query.gte("date", lowerBound);
      const { data, error } = await query;
      if (cancelled) return;
      setLoadError(formatLoadError("랭킹", error));
      if (data) setResults(data as RankRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsLoaded, lowerBound]);

  useEffect(() => {
    const ch: RealtimeChannel = supabase
      .channel(`results-rank-${++topicSeq}`)
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

  // 화면에 올리는 행은 전환일 이후만이다(HIST-02). 조회 경계는 대역폭이고 정의는 이 한 줄이다.
  const visible = useMemo(() => filterSince(results, historySince), [results, historySince]);

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
        <RankingView results={visible} />
      </main>
    </>
  );
}
