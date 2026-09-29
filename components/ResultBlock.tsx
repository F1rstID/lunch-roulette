"use client";

import type { CSSProperties } from "react";
import type { Phase } from "@/lib/phase";
import { MenuChips } from "@/components/MenuChips";
import { LocationLink } from "@/components/LocationLink";

type Props = {
  phase: Phase;
  candidateCount: number;
  // 이름은 결과 행의 스냅샷, 메뉴·위치는 페이지가 현재 카탈로그에서 찾아 채운 참고 정보다.
  winner: { name: string; menus: string[]; location: string | null } | null;
  // 설정에서 온 추첨 시각 문구. 기본값을 두지 않는다 — 두면 시각이 다시 이 파일에 숨는다(SPIN-06).
  spinTimeText: string;
};

export function ResultBlock({ phase, candidateCount, winner, spinTimeText }: Props) {
  if (phase === "accepting") {
    return (
      <div style={s.bar}>
        <div>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>
            오늘의 룰렛
          </div>
          <div style={s.headline}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>
              {spinTimeText}
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
            FINALIZED · {spinTimeText}
          </span>
        </div>
        <div style={s.winnerName}>{winner.name}</div>
        {/* 이름과 상세의 출처가 다른 것이 의도다: 이름은 확정 순간의 스냅샷이고 메뉴·위치는 지금
            카탈로그에 있는 값이다. 매장을 지우면 상세만 비고 이름은 남는다(CATL-03) — 기록·랭킹이
            같은 스냅샷 위에 서 있으므로 이름을 카탈로그에서 다시 읽지 않는다.
            둘 다 비면 상세 줄 자체를 그리지 않는다 — 빈 줄은 "정보가 없다" 가 아니라 여백으로 읽힌다. */}
        {(winner.menus.length > 0 || winner.location !== null) && (
          <div style={s.winnerDetail}>
            <MenuChips menus={winner.menus} />
            {winner.location !== null && (
              <div style={s.winnerLocation}>
                <LocationLink location={winner.location} />
              </div>
            )}
          </div>
        )}
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

  // 원래 decided && !winner 였던 분기를 조건만 바꿔 옮긴 것이다. hasResult 가 decided 를 결정하게 된
  // 뒤로는 "결과가 있는데 winner 가 없다" 가 도달 불가라, 같은 문구가 걸릴 자리는 stalled 뿐이다.
  if (phase === "stalled") {
    return (
      <div style={s.bar}>
        <div style={{ padding: "16px 22px" }}>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>
            오늘
          </div>
          <div style={s.headline}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>아직 결과가 없어요</span>
            {/* 서버가 추첨 시각 이후 매분 폴링하므로 지금 담아도 곧 뽑힌다 — 수동 버튼을 두지 않는
                이유이고, 사용자가 알아야 하는 것은 그 사실이지 폴링 주기가 아니다(SPIN-03). */}
            <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>
              후보를 담으면 1분 안에 자동으로 뽑아요
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
  winnerDetail: { margin: "0 0 10px" },
  winnerLocation: {
    fontSize: 12.5,
    color: "var(--muted)",
    marginTop: 5,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
