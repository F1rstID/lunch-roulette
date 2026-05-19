// ranking.jsx — all-time winners leaderboard.
// Aggregates the log into a ranked list. Visual:
// - Top 3 as a chunky podium row
// - Rest as a dense table below

function buildRanking(logMap) {
  // Sum wins per menu, ignoring holidays.
  const tally = new Map();
  for (const e of Object.values(logMap)) {
    if (e.holiday) continue;
    const cur = tally.get(e.menu) || { menu: e.menu, wins: 0, addedBy: new Set(), lastDate: "" };
    cur.wins += 1;
    if (e.addedBy) cur.addedBy.add(e.addedBy);
    if (!cur.lastDate || e.date > cur.lastDate) cur.lastDate = e.date;
    tally.set(e.menu, cur);
  }
  const total = [...tally.values()].reduce((s, x) => s + x.wins, 0);
  const list = [...tally.values()]
    .map((x) => ({ ...x, addedBy: [...x.addedBy], share: total ? x.wins / total : 0 }))
    .sort((a, b) => b.wins - a.wins || (a.lastDate < b.lastDate ? 1 : -1));
  return { list, total };
}

function RankingView({ logMap }) {
  const { list, total } = React.useMemo(() => buildRanking(logMap), [logMap]);
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
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
        <div>
          <div className="micro" style={{ marginBottom: 8 }}>역대 당첨 랭킹</div>
          <h1>가장 많이 당첨된 메뉴</h1>
          <div className="sub">
            지금까지 룰렛이 정한 점심 <span className="mono">{total}</span>번 · 총 <span className="mono">{list.length}</span>개 메뉴
          </div>
        </div>
      </div>

      {/* Podium for top 3 */}
      <section style={rankStyles.podiumWrap}>
        {topThree.map((m, i) => (
          <PodiumCard key={m.menu} entry={m} rank={i + 1} totalWins={total} />
        ))}
        {/* fillers if fewer than 3 */}
        {topThree.length < 3 &&
          Array.from({ length: 3 - topThree.length }).map((_, i) => (
            <div key={"f" + i} style={{ ...rankStyles.podiumCard, opacity: 0.35, background: "var(--bg-soft)" }}>
              <div className="mono" style={rankStyles.rankNum}>{topThree.length + i + 1}</div>
              <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>—</div>
            </div>
          ))}
      </section>

      {/* Rest of the table */}
      {rest.length > 0 && (
        <section className="card" style={rankStyles.tableCard}>
          <header style={rankStyles.tableHeader}>
            <span className="micro">4위부터</span>
            <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{rest.length}개 메뉴</span>
          </header>
          <div style={rankStyles.tableHead}>
            <span>순위</span>
            <span>메뉴</span>
            <span style={{ textAlign: "right" }}>당첨</span>
            <span>비율</span>
            <span style={{ textAlign: "right" }}>최근 당첨일</span>
          </div>
          {rest.map((m, i) => (
            <RankRow key={m.menu} entry={m} rank={i + 4} maxWins={maxWins} />
          ))}
        </section>
      )}
    </>
  );
}

function PodiumCard({ entry, rank, totalWins }) {
  const medalBg = {
    1: "linear-gradient(180deg, oklch(0.94 0.10 90) 0%, oklch(0.88 0.13 80) 100%)",
    2: "linear-gradient(180deg, oklch(0.95 0.012 70) 0%, oklch(0.88 0.012 70) 100%)",
    3: "linear-gradient(180deg, oklch(0.92 0.06 60) 0%, oklch(0.84 0.08 50) 100%)",
  }[rank];
  const medalBorder = {
    1: "oklch(0.78 0.16 80)",
    2: "oklch(0.80 0.015 70)",
    3: "oklch(0.72 0.10 50)",
  }[rank];
  const labels = { 1: "1ST", 2: "2ND", 3: "3RD" };
  const heights = { 1: 230, 2: 198, 3: 178 };

  return (
    <div style={{ ...rankStyles.podiumCard, minHeight: heights[rank] }}>
      <div style={{ ...rankStyles.podiumMedal, background: medalBg, borderColor: medalBorder }}>
        <span className="mono" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: "oklch(0.30 0.04 70)" }}>
          {labels[rank]}
        </span>
      </div>
      <h3 style={rankStyles.podiumName}>{entry.menu}</h3>
      <div style={rankStyles.podiumWins}>
        <span className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{entry.wins}</span>
        <span style={{ color: "var(--muted)", fontSize: 13, whiteSpace: "nowrap" }}>회 당첨</span>
      </div>
      <div style={rankStyles.podiumMeta}>
        <span>{(entry.share * 100).toFixed(1)}%</span>
        <span style={{ color: "var(--line)" }}>·</span>
        <span className="mono">{entry.lastDate.slice(5).replace("-", ".")} 최근</span>
      </div>
      {entry.addedBy.length > 0 && (
        <div style={rankStyles.podiumByline}>
          <span style={{ color: "var(--muted)", fontSize: 11.5, whiteSpace: "nowrap" }}>추가자</span>
          <span style={{ color: "var(--ink-soft)", fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap" }}>
            {entry.addedBy.slice(0, 3).join(", ")}
            {entry.addedBy.length > 3 && ` 외 ${entry.addedBy.length - 3}명`}
          </span>
        </div>
      )}
    </div>
  );
}

function RankRow({ entry, rank, maxWins }) {
  const pct = (entry.wins / maxWins) * 100;
  return (
    <div style={rankStyles.tableRow}>
      <span className="mono" style={rankStyles.tableRank}>{String(rank).padStart(2, "0")}</span>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>{entry.menu}</span>
        {entry.addedBy.length > 0 && (
          <span style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
            {entry.addedBy.slice(0, 2).join(", ")}
            {entry.addedBy.length > 2 && ` 외`}
          </span>
        )}
      </div>
      <span className="mono" style={{ ...rankStyles.tableWins, textAlign: "right" }}>{entry.wins}</span>
      <div style={rankStyles.barWrap}>
        <div style={{ ...rankStyles.bar, width: `${pct}%` }} />
        <span className="mono" style={rankStyles.barLabel}>{(entry.share * 100).toFixed(1)}%</span>
      </div>
      <span className="mono" style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "right" }}>
        {entry.lastDate.replace(/-/g, ".")}
      </span>
    </div>
  );
}

const rankStyles = {
  podiumWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    alignItems: "end",
    marginBottom: 24,
  },
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
    width: 56, height: 24, borderRadius: 6,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: "1px solid",
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  rankNum: { fontSize: 22, fontWeight: 600, color: "var(--muted)" },
  podiumName: {
    fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em",
    margin: 0, color: "var(--ink)",
  },
  podiumWins: { marginTop: 12, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "nowrap" },
  podiumMeta: {
    marginTop: 6, color: "var(--ink-soft)", fontSize: 13,
    display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
  },
  podiumByline: {
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px dashed var(--line)",
    display: "flex", gap: 10, alignItems: "baseline", justifyContent: "space-between",
    flexWrap: "wrap",
    minWidth: 0,
  },

  tableCard: { padding: 0, overflow: "hidden", marginBottom: 64 },
  tableHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 22px",
    borderBottom: "1px solid var(--line)",
    background: "var(--bg-soft)",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "52px 1fr 64px 1fr 110px",
    gap: 16,
    padding: "10px 22px",
    borderBottom: "1px solid var(--line-soft)",
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--muted)",
    fontWeight: 500,
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "52px 1fr 64px 1fr 110px",
    gap: 16,
    alignItems: "center",
    padding: "14px 22px",
    borderBottom: "1px solid var(--line-soft)",
  },
  tableRank: {
    fontSize: 13, fontWeight: 600, color: "var(--ink-soft)",
    letterSpacing: "0.04em",
  },
  tableWins: { fontSize: 16, fontWeight: 600, color: "var(--ink)" },
  barWrap: {
    position: "relative", height: 6, borderRadius: 3,
    background: "var(--bg-soft)", border: "1px solid var(--line-soft)",
    display: "flex", alignItems: "center",
    marginRight: 56,
  },
  bar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    background: "var(--accent)",
    borderRadius: 3,
    transition: "width .3s",
  },
  barLabel: {
    position: "absolute", right: -52, fontSize: 12,
    color: "var(--ink-soft)", whiteSpace: "nowrap",
  },
};

Object.assign(window, { RankingView });
