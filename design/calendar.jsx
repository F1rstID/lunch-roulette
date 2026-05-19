// calendar.jsx — month grid log + detail panel.
// Reads from a logMap: { "YYYY-MM-DD": entry }.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function buildMonthGrid(year, month /* 1-12 */) {
  // Returns 6×7 = 42 cells, each { y, m, d, dim }.
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay(); // 0..6 sun..sat
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();

  const cells = [];
  // leading days from previous month
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    cells.push({ y: prevYear, m: prevMonth, d, dim: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, dim: false });
  }
  // trailing
  let trail = 1;
  while (cells.length < 42) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear  = month === 12 ? year + 1 : year;
    cells.push({ y: nextYear, m: nextMonth, d: trail, dim: true });
    trail++;
  }
  return cells;
}

function CalendarLog({ logMap, todayKey, year, month, onChangeMonth }) {
  const [selected, setSelected] = React.useState(null);
  const cells = buildMonthGrid(year, month);

  // stats
  const entriesThisMonth = Object.values(logMap).filter(
    (e) => e.date.startsWith(`${year}-${String(month).padStart(2, "0")}`) && !e.holiday
  );
  const topMenu = (() => {
    const counts = {};
    entriesThisMonth.forEach((e) => { counts[e.menu] = (counts[e.menu] || 0) + 1; });
    let best = null;
    for (const k in counts) if (!best || counts[k] > best.count) best = { name: k, count: counts[k] };
    return best;
  })();

  const sel = selected ? logMap[selected] : null;

  return (
    <div style={calStyles.layout}>
      {/* Left: calendar grid */}
      <div className="card" style={calStyles.gridCard}>
        <header style={calStyles.gridHeader}>
          <div>
            <div style={calStyles.gridTitle} className="mono">
              {year}.{String(month).padStart(2, "0")}
            </div>
            <div style={calStyles.gridSub}>
              {entriesThisMonth.length}일 점심 · {topMenu ? `가장 많은 메뉴 “${topMenu.name}” (${topMenu.count}회)` : "기록 없음"}
            </div>
          </div>
          <div style={calStyles.navGroup}>
            <button
              style={calStyles.navBtn}
              onClick={() => {
                const ny = month === 1 ? year - 1 : year;
                const nm = month === 1 ? 12 : month - 1;
                onChangeMonth(ny, nm);
              }}
              aria-label="이전 달"
            >‹</button>
            <button
              style={calStyles.navBtn}
              onClick={() => {
                const ny = month === 12 ? year + 1 : year;
                const nm = month === 12 ? 1 : month + 1;
                onChangeMonth(ny, nm);
              }}
              aria-label="다음 달"
            >›</button>
          </div>
        </header>

        <div style={calStyles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              style={{
                ...calStyles.weekHead,
                color: i === 0 ? "var(--red)" : i === 6 ? "oklch(0.5 0.08 245)" : "var(--ink-soft)",
              }}
            >{w}</div>
          ))}
        </div>

        <div style={calStyles.grid}>
          {cells.map((c, i) => {
            const key = fmtDate(c.y, c.m, c.d);
            const entry = logMap[key];
            const isToday = key === todayKey;
            const weekday = i % 7;
            const isWeekend = weekday === 0 || weekday === 6;
            const isSelected = selected === key;
            return (
              <button
                key={i}
                style={{
                  ...calStyles.cell,
                  background: isSelected ? "oklch(0.95 0.04 60)" : "white",
                  borderColor: isSelected ? "var(--accent)" : "var(--line-soft)",
                  cursor: entry ? "pointer" : "default",
                  opacity: c.dim ? 0.35 : 1,
                }}
                onClick={() => entry && setSelected(isSelected ? null : key)}
                disabled={!entry}
              >
                <div style={calStyles.cellTop}>
                  <span
                    className="mono"
                    style={{
                      ...calStyles.dateNum,
                      color: isToday ? "white" :
                              isWeekend && weekday === 0 ? "var(--red)" :
                              isWeekend && weekday === 6 ? "oklch(0.5 0.08 245)" :
                              "var(--ink)",
                      background: isToday ? "var(--accent)" : "transparent",
                    }}
                  >{c.d}</span>
                  {isToday && <span style={calStyles.todayTag} className="mono">TODAY</span>}
                </div>
                {entry && !entry.holiday && (
                  <div style={calStyles.entryChip}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 3,
                      background: SLICE_COLORS[(c.d - 1) % SLICE_COLORS.length],
                      display: "inline-block",
                      flexShrink: 0,
                    }} />
                    <span style={calStyles.entryName}>{entry.menu}</span>
                  </div>
                )}
                {entry && entry.holiday && (
                  <div style={{ ...calStyles.entryChip, color: "var(--muted)" }}>
                    <span style={calStyles.holidayDot} />
                    <span style={calStyles.entryName}>{entry.note || "공휴일"}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: detail panel */}
      <aside className="card" style={calStyles.detail}>
        {!sel && (
          <div style={calStyles.detailEmpty}>
            <div style={calStyles.detailEmptyIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="5" y="7" width="22" height="20" rx="3" stroke="var(--line)" />
                <line x1="5" y1="13" x2="27" y2="13" stroke="var(--line)" />
                <line x1="11" y1="3" x2="11" y2="9" stroke="var(--line-soft)" strokeWidth="2" strokeLinecap="round" />
                <line x1="21" y1="3" x2="21" y2="9" stroke="var(--line-soft)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 12 }}>
              날짜를 선택하세요
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              점심 기록이 있는 날을 누르면<br />
              그날 무엇을 먹었는지 볼 수 있어요.
            </div>
          </div>
        )}
        {sel && <DetailView entry={sel} />}
      </aside>
    </div>
  );
}

function DetailView({ entry }) {
  const [y, m, d] = entry.date.split("-").map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];

  if (entry.holiday) {
    return (
      <div style={calStyles.detailBody}>
        <div className="mono" style={calStyles.detailDate}>
          {entry.date.replace(/-/g, ".")} <span style={{ color: "var(--muted)" }}>({wd})</span>
        </div>
        <div style={{ ...calStyles.detailMenu, color: "var(--muted)" }}>휴일</div>
        <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>{entry.note}</div>
      </div>
    );
  }

  return (
    <div style={calStyles.detailBody}>
      <div className="mono" style={calStyles.detailDate}>
        {entry.date.replace(/-/g, ".")} <span style={{ color: "var(--muted)" }}>({wd})</span>
      </div>

      <div style={calStyles.detailWinner}>
        <span className="micro" style={{ color: "var(--accent-ink)" }}>당첨</span>
        <h2 style={calStyles.detailMenu}>{entry.menu}</h2>
      </div>

      <dl style={calStyles.detailList}>
        <DetailRow label="후보 수">
          <span className="mono">{entry.winnerOf}개</span>의 메뉴 중 선택
        </DetailRow>
        <DetailRow label="추가한 사람">
          {entry.addedBy || "—"}
        </DetailRow>
        <DetailRow label="당첨 확률">
          <span className="mono">{((1 / entry.winnerOf) * 100).toFixed(1)}%</span>
        </DetailRow>
        {entry.note && (
          <DetailRow label="메모">
            <span style={{ color: "var(--ink-soft)" }}>{entry.note}</span>
          </DetailRow>
        )}
      </dl>

      <div style={calStyles.detailFoot}>
        <span className="micro">SHARE</span>
        <button style={calStyles.shareBtn}>링크 복사</button>
      </div>
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={calStyles.detailRow}>
      <dt style={calStyles.detailKey}>{label}</dt>
      <dd style={calStyles.detailVal}>{children}</dd>
    </div>
  );
}

const calStyles = {
  layout: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    alignItems: "start",
    paddingBottom: 64,
  },
  gridCard: { padding: 0, overflow: "hidden" },
  gridHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 22px 16px",
    borderBottom: "1px solid var(--line)",
  },
  gridTitle: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" },
  gridSub: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  navGroup: { display: "flex", gap: 4 },
  navBtn: {
    width: 32, height: 32, borderRadius: 8,
    border: "1px solid var(--line)",
    background: "white", cursor: "pointer",
    fontSize: 16, color: "var(--ink-soft)",
    display: "grid", placeItems: "center",
  },
  weekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    padding: "12px 14px 8px",
    background: "var(--bg-soft)",
    borderBottom: "1px solid var(--line-soft)",
  },
  weekHead: {
    fontSize: 11, fontWeight: 500, letterSpacing: "0.04em",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
    padding: 14,
    background: "var(--bg-soft)",
  },
  cell: {
    minHeight: 86,
    border: "1px solid var(--line-soft)",
    borderRadius: 9,
    padding: "8px 8px 6px",
    display: "flex", flexDirection: "column", alignItems: "stretch",
    fontFamily: "inherit",
    transition: "background .12s, border-color .12s",
    textAlign: "left",
  },
  cellTop: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6,
  },
  dateNum: {
    fontSize: 12.5, fontWeight: 500,
    width: 22, height: 22, borderRadius: 6,
    display: "inline-grid", placeItems: "center",
    letterSpacing: "-0.01em",
  },
  todayTag: {
    fontSize: 9, fontWeight: 600, letterSpacing: "0.08em",
    color: "var(--accent-ink)",
  },
  entryChip: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 12.5, color: "var(--ink)", marginTop: "auto",
    minWidth: 0,
  },
  entryName: {
    overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
    fontWeight: 500, letterSpacing: "-0.01em",
  },
  holidayDot: {
    width: 6, height: 6, borderRadius: 3,
    background: "var(--line)",
    border: "1px solid var(--muted)",
    flexShrink: 0,
  },

  detail: {
    padding: 24,
    position: "sticky",
    top: 24,
  },
  detailEmpty: {
    padding: "12px 0",
    textAlign: "center",
  },
  detailEmptyIcon: {
    width: 64, height: 64, borderRadius: 12,
    background: "var(--bg-soft)",
    display: "grid", placeItems: "center",
    margin: "0 auto",
  },
  detailBody: { display: "flex", flexDirection: "column", gap: 16 },
  detailDate: { fontSize: 13, color: "var(--ink-soft)", letterSpacing: "0.02em" },
  detailWinner: {
    padding: "16px 18px",
    background: "var(--accent-soft)",
    borderRadius: 12,
    border: "1px solid oklch(0.85 0.05 60)",
  },
  detailMenu: {
    margin: "6px 0 0", fontSize: 26, fontWeight: 700,
    letterSpacing: "-0.025em", color: "var(--ink)",
  },
  detailList: { margin: 0, padding: 0 },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "84px 1fr",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--line-soft)",
    fontSize: 13.5,
  },
  detailKey: { color: "var(--muted)", fontSize: 12.5, margin: 0 },
  detailVal: { margin: 0, color: "var(--ink)" },
  detailFoot: {
    display: "flex", alignItems: "center", gap: 8,
    marginTop: 8,
  },
  shareBtn: {
    appearance: "none", border: "1px solid var(--line)",
    background: "white", color: "var(--ink)",
    height: 30, padding: "0 12px", borderRadius: 8,
    fontSize: 12.5, fontWeight: 500, cursor: "pointer",
  },
};

Object.assign(window, { CalendarLog });
