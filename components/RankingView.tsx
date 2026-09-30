"use client";

import { useMemo, type CSSProperties } from "react";
// 집계(키·정렬)는 lib/history.ts 가 정한다 — 이 컴포넌트는 호출만 하고 판단을 갖지 않는다.
// 결과 행 전체가 아니라 HistoryRow 만 받는 이유: 랭킹 페이지가 조회 컬럼을 그만큼으로 좁힌다.
import { buildRanking, type HistoryRow, type RankEntry } from "@/lib/history";

export function RankingView({ results }: { results: HistoryRow[] }) {
  const { list, total } = useMemo(() => buildRanking(results), [results]);
  const topThree = list.slice(0, 3);
  const rest = list.slice(3);
  const maxWins = list[0]?.wins || 1;

  if (list.length === 0) {
    return (
      <div style={{ padding: "80px 0", textAlign: "center", color: "var(--muted)" }}>
        아직 기록이 없어요.
      </div>
    );
  }

  return (
    <>
      <div className="l-page-head">
        <div>
          <div className="micro" style={{ marginBottom: 8 }}>
            역대 당첨 랭킹
          </div>
          <h1 style={head.h1}>가장 많이 당첨된 매장</h1>
          <div style={head.sub}>
            지금까지 룰렛이 정한 점심 <span className="mono">{total}</span>번 · 총{" "}
            <span className="mono">{list.length}</span>개 매장
          </div>
        </div>
      </div>

      <section className="l-podium" style={s.podiumWrap}>
        {topThree.map((m, i) => (
          <PodiumCard key={m.key} entry={m} rank={i + 1} />
        ))}
        {topThree.length < 3 &&
          Array.from({ length: 3 - topThree.length }).map((_, i) => (
            // 빈 자리는 3단 배치의 모양을 잡으려고 있다. 세로로 쌓이는 폭에서는 빈 카드일 뿐이라 숨긴다.
            <div
              key={"f" + i}
              className="l-hide-narrow"
              style={{
                ...s.podiumCard,
                opacity: 0.35,
                background: "var(--bg-soft)",
              }}
            >
              <div className="mono" style={s.rankNum}>
                {topThree.length + i + 1}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>—</div>
            </div>
          ))}
      </section>

      {rest.length > 0 && (
        <section className="card" style={s.tableCard}>
          <header style={s.tableHeader}>
            <span className="micro">4위부터</span>
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{rest.length}개 매장</span>
          </header>
          <div className="l-rank-row" style={s.tableHead}>
            <span>순위</span>
            <span>매장</span>
            <span style={{ textAlign: "right" }}>당첨</span>
            <span className="l-hide-narrow">비율</span>
            <span style={{ textAlign: "right" }}>최근 당첨일</span>
          </div>
          {rest.map((m, i) => (
            <RankRow key={m.key} entry={m} rank={i + 4} maxWins={maxWins} />
          ))}
        </section>
      )}
    </>
  );
}

function PodiumCard({ entry, rank }: { entry: RankEntry; rank: number }) {
  const medalBg: Record<number, string> = {
    1: "linear-gradient(180deg, oklch(0.94 0.10 90) 0%, oklch(0.88 0.13 80) 100%)",
    2: "linear-gradient(180deg, oklch(0.95 0.012 70) 0%, oklch(0.88 0.012 70) 100%)",
    3: "linear-gradient(180deg, oklch(0.92 0.06 60) 0%, oklch(0.84 0.08 50) 100%)",
  };
  const medalBorder: Record<number, string> = {
    1: "oklch(0.78 0.16 80)",
    2: "oklch(0.80 0.015 70)",
    3: "oklch(0.72 0.10 50)",
  };
  const labels: Record<number, string> = { 1: "1위", 2: "2위", 3: "3위" };

  // 순위별 높이는 app/globals.css 의 l-podium-card[data-rank] 가 가진다 — 세로로 쌓일 때 0 으로 되돌려야 해서다.
  return (
    <div className="l-podium-card" data-rank={rank} style={s.podiumCard}>
      <div
        style={{
          ...s.podiumMedal,
          background: medalBg[rank],
          borderColor: medalBorder[rank],
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "oklch(0.30 0.04 70)",
          }}
        >
          {labels[rank]}
        </span>
      </div>
      <h3 style={s.podiumName}>{entry.name}</h3>
      <div style={s.podiumWins}>
        <span
          className="mono"
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          {entry.wins}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>
          회 당첨
        </span>
      </div>
      <div style={s.podiumMeta}>
        <span>{(entry.share * 100).toFixed(1)}%</span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span>
          <span className="mono">{entry.lastDate.slice(5).replace("-", ".")}</span> 최근
        </span>
      </div>
    </div>
  );
}

function RankRow({
  entry,
  rank,
  maxWins,
}: {
  entry: RankEntry;
  rank: number;
  maxWins: number;
}) {
  const pct = (entry.wins / maxWins) * 100;
  return (
    <div className="l-rank-row" style={s.tableRow}>
      <span className="mono" style={s.tableRank}>
        {String(rank).padStart(2, "0")}
      </span>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "-0.01em",
          }}
        >
          {entry.name}
        </span>
      </div>
      <span className="mono" style={{ ...s.tableWins, textAlign: "right" }}>
        {entry.wins}
      </span>
      <div className="l-hide-narrow" style={s.barWrap}>
        <div style={{ ...s.bar, width: `${pct}%` }} />
        <span className="mono" style={s.barLabel}>
          {(entry.share * 100).toFixed(1)}%
        </span>
      </div>
      <span
        className="mono"
        style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "right" }}
      >
        {entry.lastDate.replace(/-/g, ".")}
      </span>
    </div>
  );
}

// 머리 영역의 여백은 app/globals.css 의 l-page-head 가 가진다(네 페이지 공용).
const head = {
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 6px",
  },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;

const s = {
  // 격자(3단 ↔ 1단)는 l-podium 이 가진다.
  podiumWrap: { marginBottom: 24 },
  podiumCard: {
    background: "white",
    border: "1px solid var(--line)",
    borderRadius: 14,
    padding: "20px 22px 20px",
    display: "flex",
    flexDirection: "column",
    boxShadow: "var(--shadow-sm)",
    minWidth: 0,
  },
  podiumMedal: {
    width: 56,
    height: 24,
    borderRadius: 6,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid",
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  rankNum: { fontSize: 22, fontWeight: 600, color: "var(--muted)" },
  podiumName: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: "-0.025em",
    margin: 0,
    color: "var(--ink)",
  },
  podiumWins: {
    marginTop: 12,
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "nowrap",
  },
  podiumMeta: {
    marginTop: 6,
    color: "var(--ink-soft)",
    fontSize: 13,
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  tableCard: { padding: 0, overflow: "hidden", marginBottom: 64 },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 22px",
    borderBottom: "1px solid var(--line)",
    background: "var(--bg-soft)",
  },
  // 열 구성과 좌우 여백은 l-rank-row 가 가진다. 여기 padding 단축 속성을 쓰면 좌우까지 덮어써
  // 휴대폰 여백이 꺼지므로 위아래만 따로 적는다.
  tableHead: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottom: "1px solid var(--line-soft)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--muted)",
    fontWeight: 500,
  },
  tableRow: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 14,
    borderBottom: "1px solid var(--line-soft)",
  },
  tableRank: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--ink-soft)",
    letterSpacing: "0.04em",
  },
  tableWins: { fontSize: 16, fontWeight: 600, color: "var(--ink)" },
  barWrap: {
    position: "relative",
    height: 6,
    borderRadius: 3,
    background: "var(--bg-soft)",
    border: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    marginRight: 56,
  },
  bar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    background: "var(--accent)",
    borderRadius: 3,
    transition: "width .3s",
  },
  barLabel: {
    position: "absolute",
    right: -52,
    fontSize: 12,
    color: "var(--ink-soft)",
    whiteSpace: "nowrap",
  },
} satisfies Record<string, CSSProperties>;
