"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, MENU_NAME_MAX_LEN, type MenuRow, type ResultRow, type PinnedMenuRow } from "@/lib/supabase/client";
import { todayKstDate, formatKstLongDay, formatHhMmSs } from "@/lib/time";
import { currentPhase, type Phase } from "@/lib/phase";
import { TopBar } from "@/components/TopBar";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { Wheel, type WheelPhase } from "@/components/Wheel";
import { MenuList } from "@/components/MenuList";
import { ResultBlock } from "@/components/ResultBlock";

// respin-roulette Edge Function 응답 (supabase/functions/respin-roulette/index.ts 와 맞춘다)
type RespinResponse = { ok?: boolean; skipped?: string; error?: string };

export default function TodayPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = todayKstDate(now);
  const phase = currentPhase(now);

  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [todayResult, setTodayResult] = useState<ResultRow | null>(null);
  const [forceSpin, setForceSpin] = useState(false);
  const [respinning, setRespinning] = useState(false);
  // 마지막 쓰기(메뉴 추가·삭제·고정·다시 돌리기) 실패 메시지. 성공하면 지운다.
  const [actionError, setActionError] = useState<string | null>(null);
  // 고정된 메뉴 이름 집합. 파생 표시(핀 아이콘 상태)에 O(1) 멤버십으로 쓴다.
  const [pinnedNames, setPinnedNames] = useState<Set<string>>(new Set());
  const initialLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    initialLoadedRef.current = false;
    (async () => {
      const [menuRes, todayRes, pinRes] = await Promise.all([
        supabase.from("menus").select("*").order("created_at", { ascending: true }),
        supabase.from("results").select("*").eq("date", todayKey).maybeSingle(),
        supabase.from("pinned_menus").select("name"),
      ]);
      if (cancelled) return;
      if (menuRes.data) setMenus(menuRes.data as MenuRow[]);
      setTodayResult(todayRes.data ? (todayRes.data as ResultRow) : null);
      if (pinRes.data) setPinnedNames(new Set((pinRes.data as { name: string }[]).map((p) => p.name)));
      initialLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  useEffect(() => {
    // results INSERT(자동 추첨) / UPDATE(다시 돌리기) 공통 처리
    const applyResult = (row: ResultRow) => {
      if (row.date !== todayKey) return;
      setTodayResult(row);
      if (initialLoadedRef.current) {
        setForceSpin(true);
        setTimeout(() => setForceSpin(false), 5000);
      }
    };

    const channel: RealtimeChannel = supabase
      .channel("lunch-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "menus" },
        (payload) => {
          const row = payload.new as MenuRow;
          setMenus((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row].sort(byCreatedAt),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "menus" },
        (payload) => {
          const oldRow = payload.old as Partial<MenuRow>;
          if (oldRow.id) setMenus((prev) => prev.filter((m) => m.id !== oldRow.id));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "results" },
        (payload) => applyResult(payload.new as ResultRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "results" },
        (payload) => applyResult(payload.new as ResultRow),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pinned_menus" },
        (payload) => {
          const name = (payload.new as PinnedMenuRow).name;
          setPinnedNames((prev) => (prev.has(name) ? prev : new Set(prev).add(name)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "pinned_menus" },
        (payload) => {
          const name = (payload.old as Partial<PinnedMenuRow>).name;
          if (!name) return;
          setPinnedNames((prev) => {
            if (!prev.has(name)) return prev;
            const next = new Set(prev);
            next.delete(name);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todayKey]);

  const winnerIndex = useMemo(() => {
    if (!todayResult) return -1;
    return menus.findIndex((m) => m.name === todayResult.menu);
  }, [todayResult, menus]);

  const wheelPhase: WheelPhase = forceSpin
    ? "spinning"
    : todayResult
      ? "decided"
      : phase === "spinning"
        ? "spinning"
        : "idle";

  const resolvedPhase: Phase = todayResult ? "decided" : phase;

  // 아래 세 핸들러는 useCallback 으로 감싸지 않는다. 소비자(MenuList, button)가 memo 컴포넌트가
  // 아니라 참조 안정성의 이득이 없고, React Compiler lint(preserve-manual-memoization)가
  // async 핸들러의 수동 memo 를 보존하지 못해 에러를 낸다.
  // 여러 이름을 한 번에 등록. MenuList 가 파싱·중복 제거를 끝낸 배열을 준다.
  // 단일 insert 문이라 전부 성공하거나 전부 실패한다(원자적). 방어적으로 한 번 더 정규화.
  async function addMenus(names: string[]): Promise<boolean> {
    const rows = names
      .map((n) => n.trim().slice(0, MENU_NAME_MAX_LEN))
      .filter(Boolean)
      .map((name) => ({ name }));
    if (rows.length === 0) return false;
    const { error } = await supabase.from("menus").insert(rows);
    if (error) {
      const label = rows.length === 1 ? `"${rows[0].name}"` : `${rows.length}개`;
      setActionError(`메뉴 ${label} 추가 실패: ${error.message}`);
      return false;
    }
    setActionError(null);
    return true;
  }

  async function removeMenu(id: string, name: string) {
    const { error } = await supabase.from("menus").delete().eq("id", id);
    if (error) {
      setActionError(`메뉴 "${name}" 삭제 실패: ${error.message}`);
      return;
    }
    setActionError(null);
  }

  // 고정 토글. currentlyPinned 는 클릭 시점의 상태 — 켜짐이면 해제(delete), 꺼짐이면 고정(insert).
  // 실제 pinnedNames 갱신은 realtime 이벤트로 이뤄진다(menus 추가와 동일한 패턴).
  async function togglePin(name: string, currentlyPinned: boolean) {
    if (currentlyPinned) {
      const { error } = await supabase.from("pinned_menus").delete().eq("name", name);
      if (error) {
        setActionError(`"${name}" 고정 해제 실패: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("pinned_menus").insert({ name });
      if (error) {
        setActionError(`"${name}" 고정 실패: ${error.message}`);
        return;
      }
    }
    setActionError(null);
  }

  async function respin() {
    setRespinning(true);
    try {
      // service_role 함수가 results를 덮어쓰고, realtime UPDATE로 휠이 다시 돈다
      const { data, error } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
      if (error) {
        setActionError(`다시 돌리기 실패: ${error.message}`);
        return;
      }
      if (data?.skipped) {
        const reason = data.skipped === "no_candidates" ? "후보가 없어요" : data.skipped;
        setActionError(`다시 돌리기 건너뜀: ${reason}`);
        return;
      }
      setActionError(null);
    } finally {
      setRespinning(false);
    }
  }

  const clockTime = formatHhMmSs(now);
  const headline = phaseHeadline(resolvedPhase, todayResult?.menu);
  const subhead = phaseSubhead(resolvedPhase, menus.length, todayResult?.menu);

  return (
    <>
      <TopBar
        active="today"
        candidateCount={menus.length}
        phase={resolvedPhase}
        clockTime={clockTime}
      />

      <main className="wrap" style={{ flex: 1 }}>
        <div style={pageHeadStyles.head}>
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>
              {formatKstLongDay(now)}
            </div>
            <h1 style={pageHeadStyles.h1}>{headline}</h1>
            <div style={pageHeadStyles.sub}>{subhead}</div>
          </div>
          <PhaseTimeline current={resolvedPhase} />
        </div>

        {actionError && (
          <div role="alert" style={alertStyles.wrap}>
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              style={alertStyles.close}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        )}

        <div style={layoutStyles.cols}>
          <div style={layoutStyles.left}>
            <div className="card" style={layoutStyles.stage}>
              <StageHeader phase={resolvedPhase} clockTime={clockTime} />
              <div style={layoutStyles.wheelHolder}>
                <Wheel items={menus} phase={wheelPhase} winnerIndex={winnerIndex} size={460} />
              </div>
              <ResultBlock
                phase={resolvedPhase}
                candidateCount={menus.length}
                winner={todayResult ? { name: todayResult.menu } : null}
              />
              {resolvedPhase === "decided" && todayResult && (
                <div style={respinStyles.wrap}>
                  <button
                    type="button"
                    onClick={respin}
                    disabled={respinning || forceSpin}
                    style={respinStyles.button}
                  >
                    {respinning || forceSpin ? "다시 돌리는 중…" : "🎲 다시 돌리기"}
                  </button>
                  <span style={respinStyles.hint}>결과를 새로 뽑아 모두에게 반영돼요</span>
                </div>
              )}
            </div>
          </div>

          <div style={layoutStyles.right}>
            <MenuList
              items={menus}
              phase={resolvedPhase}
              pinnedNames={pinnedNames}
              onAddAction={addMenus}
              onRemoveAction={removeMenu}
              onTogglePinAction={togglePin}
            />
          </div>
        </div>
      </main>

      <Footer clockTime={clockTime} />
    </>
  );
}

function StageHeader({ phase, clockTime }: { phase: Phase; clockTime: string }) {
  const label =
    phase === "accepting" ? "후보 접수중" : phase === "spinning" ? "룰렛 회전중" : "오늘의 결과";
  const dot = phase === "accepting" ? "live" : phase === "spinning" ? "spin" : "done";
  return (
    <div style={stageStyles.header}>
      <div style={stageStyles.headerLeft}>
        <span className="micro">STAGE</span>
        <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13 }}>{label}</span>
      </div>
      <div style={stageStyles.headerRight}>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
          {clockTime}
        </span>
        <span className={`dot ${dot}`} />
      </div>
    </div>
  );
}

function Footer({ clockTime }: { clockTime: string }) {
  return (
    <footer style={footerStyles.wrap}>
      <div className="wrap" style={footerStyles.inner}>
        <span>점심 룰렛 · v0.1 · 결과는 매일 자정에 초기화돼요</span>
        <span className="mono">{clockTime} KST</span>
      </div>
    </footer>
  );
}

function byCreatedAt(a: MenuRow, b: MenuRow) {
  return a.created_at < b.created_at ? -1 : 1;
}

function phaseHeadline(phase: Phase, winnerName?: string) {
  if (phase === "accepting") return "오늘 점심 뭐 먹지?";
  if (phase === "spinning") return "운명의 카운트다운…";
  if (phase === "decided" && winnerName) return "오늘은 이거예요.";
  return "오늘의 점심";
}

function phaseSubhead(phase: Phase, count: number, winnerName?: string) {
  if (phase === "accepting")
    return `현재 ${count}개의 후보가 룰렛에 올라가 있어요. 11:55에 자동으로 결정돼요.`;
  if (phase === "spinning") return "룰렛은 11:55에 시작되어 약 5초간 돌아갑니다.";
  if (phase === "decided" && winnerName)
    return `"${winnerName}" · 더는 변경할 수 없어요. 결과는 자정에 초기화됩니다.`;
  return "";
}

const pageHeadStyles = {
  head: {
    padding: "36px 0 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 32,
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 6px",
  },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;

const layoutStyles = {
  cols: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
    gap: 24,
    paddingBottom: 56,
  },
  left: { display: "flex", flexDirection: "column", gap: 16 },
  right: { display: "flex", flexDirection: "column", gap: 16 },
  stage: {
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  wheelHolder: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "32px 24px 24px",
    background:
      "radial-gradient(circle at center, oklch(0.99 0.005 80) 0%, oklch(0.965 0.006 80) 70%)",
  },
} satisfies Record<string, CSSProperties>;

const stageStyles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--line)",
    background: "white",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
} satisfies Record<string, CSSProperties>;

const respinStyles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 26px 18px",
    borderTop: "1px solid var(--line)",
    background: "white",
  },
  button: {
    appearance: "none",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--bg-soft)",
    color: "var(--ink)",
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    cursor: "pointer",
  },
  hint: { color: "var(--muted)", fontSize: 12.5 },
} satisfies Record<string, CSSProperties>;

const alertStyles = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: "10px 14px",
    border: "1px solid var(--red)",
    borderRadius: "var(--radius)",
    background: "var(--panel)",
    color: "var(--red)",
    fontSize: 13,
  },
  close: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 4px",
  },
} satisfies Record<string, CSSProperties>;

const footerStyles = {
  wrap: {
    borderTop: "1px solid var(--line)",
    padding: "16px 0",
    background: "var(--bg)",
  },
  inner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "var(--muted)",
    fontSize: 12,
  },
} satisfies Record<string, CSSProperties>;
