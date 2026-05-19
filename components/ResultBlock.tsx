"use client";

import type { CSSProperties } from "react";
import type { Phase } from "@/lib/phase";

type Props = {
  phase: Phase;
  candidateCount: number;
  winner: { name: string } | null;
  spinTime?: string; // "HH:mm"
};

export function ResultBlock({ phase, candidateCount, winner, spinTime = "11:55" }: Props) {
  if (phase === "accepting") {
    return (
      <div style={s.bar}>
        <div>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>
            오늘의 룰렛
          </div>
          <div style={s.headline}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>
              {spinTime}
            </span>
            <span style={{ color: "var(--muted)", fontSize: 14, marginLeft: 8 }}>
              에 자동 시작
            </span>
          </div>
        </div>
        <div style={{ ...s.metric, borderLeft: "1px solid var(--line)" }}>
          <span className="micro">CANDIDATES</span>
          <div className="mono" style={s.metricNum}>
            {candidateCount}
          </div>
        </div>
        <div style={{ ...s.metric, borderLeft: "1px solid var(--line)" }}>
          <span className="micro">PROBABILITY</span>
          <div className="mono" style={s.metricNum}>
            {candidateCount ? `${(100 / candidateCount).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "spinning") {
    return (
      <div
        style={{
          ...s.bar,
          background: "oklch(0.97 0.04 60)",
          borderColor: "oklch(0.86 0.06 60)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px" }}>
          <span className="dot spin" />
          <div>
            <div style={s.headline}>
              <span style={{ fontWeight: 600, fontSize: 17 }}>룰렛이 돌아가고 있어요</span>
            </div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 2 }}>
              결과는 곧 발표됩니다…
            </div>
          </div>
        </div>
        <div style={{ ...s.metric, borderLeft: "1px solid oklch(0.86 0.06 60)" }}>
          <span className="micro">CANDIDATES</span>
          <div className="mono" style={s.metricNum}>
            {candidateCount}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "decided" && winner) {
    return (
      <div style={s.winnerWrap}>
        <div style={s.winnerLine}>
          <span className="micro" style={{ color: "var(--accent-ink)" }}>
            오늘의 점심
          </span>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            FINALIZED · {spinTime}
          </span>
        </div>
        <div style={s.winnerName}>{winner.name}</div>
        <div style={s.winnerMeta}>
          <span>
            <span className="mono">{candidateCount}</span>개 후보 중 당첨
          </span>
          {candidateCount > 0 && (
            <>
              <span style={{ color: "var(--line)" }}>·</span>
              <span>
                확률 <span className="mono">{(100 / candidateCount).toFixed(1)}%</span>
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (phase === "decided" && !winner) {
    return (
      <div style={s.bar}>
        <div style={{ padding: "16px 22px" }}>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>
            오늘
          </div>
          <div style={s.headline}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>아직 결과가 없어요</span>
            <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>
              후보 메뉴가 없으면 룰렛이 돌지 않아요.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const s = {
  bar: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    alignItems: "center",
    gap: 0,
    padding: 0,
    borderTop: "1px solid var(--line)",
    background: "var(--bg-soft)",
  },
  headline: { display: "flex", alignItems: "baseline", gap: 4 },
  metric: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "16px 22px",
  },
  metricNum: { fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" },
  winnerWrap: {
    background: "white",
    borderTop: "1px solid var(--line)",
    padding: "22px 26px 24px",
    animation: "fade-up .35s ease-out both",
  },
  winnerLine: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  winnerName: {
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: "-0.03em",
    color: "var(--ink)",
    margin: "2px 0 8px",
  },
  winnerMeta: {
    color: "var(--ink-soft)",
    fontSize: 13.5,
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
} satisfies Record<string, CSSProperties>;
