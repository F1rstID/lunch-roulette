// app.jsx — root component for the Lunch Roulette prototype.

const TODAY_KEY = fmtDate(TODAY.y, TODAY.m, TODAY.d);
const YESTERDAY_KEY = "2026-05-18";

function App() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  // top-level tab
  const [tab, setTab] = React.useState("today");

  // candidates for today
  const initialCandidates = () => (t.showFakeData ? SEED_CANDIDATES.slice() : []);
  const [candidates, setCandidates] = React.useState(initialCandidates);

  // Reset candidate list when time phase / fake-data toggle changes such
  // that "today" is a different day.
  React.useEffect(() => {
    if (t.timePhase === "next_day") {
      // After midnight reset — candidate list cleared for the new day.
      setCandidates([]);
    } else {
      setCandidates(t.showFakeData ? SEED_CANDIDATES.slice() : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.timePhase, t.showFakeData]);

  // Picked winner — locked when phase enters spinning/decided.
  // We choose deterministically (the first candidate matching "마라탕" if present,
  // otherwise a fixed index) so the prototype's result is repeatable.
  const winnerIndex = React.useMemo(() => {
    if (candidates.length === 0) return -1;
    const idx = candidates.findIndex((c) => c.name === "마라탕");
    return idx >= 0 ? idx : Math.min(2, candidates.length - 1);
  }, [candidates]);

  // map phases to wheel phases
  const wheelPhase = (() => {
    if (t.timePhase === "spinning") return "spinning";
    if (t.timePhase === "decided")  return "decided";
    return "idle";
  })();

  // log: seed + (after decision) today's result. In `next_day` phase the
  // yesterday's result is just part of the seed (already there for 5/18),
  // and 5/19's result *also* moves into the log.
  const logMap = React.useMemo(() => {
    const map = {};
    if (t.showFakeLog) {
      LOG_SEED.forEach((e) => { map[e.date] = e; });
    }
    if (t.timePhase === "decided" && winnerIndex >= 0) {
      const w = candidates[winnerIndex];
      map[TODAY_KEY] = {
        date: TODAY_KEY,
        menu: w.name,
        winnerOf: candidates.length,
        addedBy: w.addedBy,
        note: "",
      };
    }
    if (t.timePhase === "next_day" && t.showFakeLog) {
      // Pretend yesterday (5/19) was decided — put a winner in.
      map[TODAY_KEY] = {
        date: TODAY_KEY,
        menu: "마라탕",
        winnerOf: 8,
        addedBy: "예린",
        note: "어제의 당첨 — 매콤하게 마무리",
      };
    }
    return map;
  }, [t.timePhase, t.showFakeLog, candidates, winnerIndex]);

  // calendar month state
  const [calMonth, setCalMonth] = React.useState({ y: 2026, m: 5 });

  // Spin completion bookkeeping — for now just a callback hook
  const onSpinComplete = React.useCallback(() => {}, []);

  // mount: kill loader
  React.useEffect(() => { const el = document.getElementById("loading"); if (el) el.remove(); }, []);

  // ── derived display values ──────────────────────────────────────────
  const clock = phaseClock(t.timePhase);
  const dayLabel = t.timePhase === "next_day" ? "2026년 5월 20일 수요일" : TODAY_KR;
  const todayKeyForCalendar = t.timePhase === "next_day" ? "2026-05-20" : TODAY_KEY;

  return (
    <>
      {/* ── topbar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <span className="brand-mark" />
            <span>점심 룰렛</span>
            <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6, fontSize: 13 }}>
              · LUNCH ROULETTE
            </span>
          </div>
          <nav className="tabs">
            <button
              className="tab"
              aria-current={tab === "today" ? "true" : "false"}
              onClick={() => setTab("today")}
            >
              오늘
              {tab === "today" && candidates.length > 0 && (
                <span className="count">{candidates.length}</span>
              )}
            </button>
            <button
              className="tab"
              aria-current={tab === "log" ? "true" : "false"}
              onClick={() => setTab("log")}
            >
              기록
            </button>
            <button
              className="tab"
              aria-current={tab === "rank" ? "true" : "false"}
              onClick={() => setTab("rank")}
            >
              랭킹
            </button>
          </nav>
          <div className="topbar-right">
            <span className="status-pill">
              <span className={`dot ${clock.dotClass}`} />
              {clock.statusLabel}
            </span>
            <span className="clock-readout">
              <span style={{ fontSize: 11.5, color: "var(--muted)" }}>NOW</span>
              <span className="mono">{clock.timeStr}</span>
            </span>
          </div>
        </div>
      </header>

      {/* ── page ───────────────────────────────────────────────────── */}
      <main className="wrap" style={{ flex: 1 }}>
        {tab === "today" && (
          <TodayView
            phase={t.timePhase}
            candidates={candidates}
            wheelPhase={wheelPhase}
            winnerIndex={winnerIndex}
            onSpinComplete={onSpinComplete}
            dayLabel={dayLabel}
            clock={clock}
            logMap={logMap}
            onShowRanking={() => setTab("rank")}
            onAdd={(name) => {
              const id = "u" + Date.now();
              setCandidates((arr) => [
                ...arr,
                { id, name, addedBy: "나", addedAt: clock.timeStr },
              ]);
            }}
            onRemove={(id) => setCandidates((arr) => arr.filter((x) => x.id !== id))}
          />
        )}

        {tab === "log" && (
          <CalendarTab
            logMap={logMap}
            todayKey={todayKeyForCalendar}
            year={calMonth.y}
            month={calMonth.m}
            onChangeMonth={(y, m) => setCalMonth({ y, m })}
          />
        )}

        {tab === "rank" && (
          <RankingView logMap={logMap} />
        )}
      </main>

      {/* ── footer ─────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid var(--line)", padding: "16px 0", background: "var(--bg)" }}>
        <div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--muted)", fontSize: 12 }}>
          <span>점심 룰렛 · v0.1 · 결과는 매일 자정에 초기화돼요</span>
          <span className="mono">{clock.timeStr} KST</span>
        </div>
      </footer>

      {/* ── tweaks panel ───────────────────────────────────────────── */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="시간 시뮬레이션">
          <TweakSelect
            label="현재 시각"
            value={t.timePhase}
            options={[
              { value: "accepting", label: "11:30 — 모집중" },
              { value: "spinning",  label: "11:55 — 룰렛 도는 중" },
              { value: "decided",   label: "12:00 — 결과 확정" },
              { value: "next_day",  label: "다음날 09:00 — 리셋됨" },
            ]}
            onChange={(v) => setTweak("timePhase", v)}
          />
        </TweakSection>
        <TweakSection label="데이터">
          <TweakToggle
            label="오늘 후보 시드"
            value={t.showFakeData}
            onChange={(v) => setTweak("showFakeData", v)}
          />
          <TweakToggle
            label="지난달 기록 시드"
            value={t.showFakeLog}
            onChange={(v) => setTweak("showFakeLog", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// ── Today view ───────────────────────────────────────────────────────
function TodayView({ phase, candidates, wheelPhase, winnerIndex, onSpinComplete, dayLabel, clock, logMap, onAdd, onRemove, onShowRanking }) {
  const winner = winnerIndex >= 0 ? candidates[winnerIndex] : null;
  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32 }}>
        <div>
          <div className="micro" style={{ marginBottom: 8 }}>{dayLabel}</div>
          <h1>{phaseHeadline(phase, winner)}</h1>
          <div className="sub">{phaseSubhead(phase, candidates.length, winner)}</div>
        </div>
        <PhaseTimeline current={phase} clock={clock} />
      </div>

      <div style={layoutStyles.cols}>
        {/* Left: wheel + result */}
        <div style={layoutStyles.left}>
          <div className="card" style={layoutStyles.stage}>
            <StageHeader phase={phase} clock={clock} />
            <div style={layoutStyles.wheelHolder}>
              <Wheel
                items={candidates}
                phase={wheelPhase}
                winnerIndex={winnerIndex}
                onSpinComplete={onSpinComplete}
                size={460}
              />
            </div>
            <ResultBlock phase={phase} winner={winner} candidates={candidates} logMap={logMap} onShowRanking={onShowRanking} />
          </div>
        </div>

        {/* Right: menu list */}
        <div style={layoutStyles.right}>
          <MenuList
            items={candidates}
            phase={phase}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        </div>
      </div>
    </>
  );
}

// ── Calendar tab ─────────────────────────────────────────────────────
function CalendarTab({ logMap, todayKey, year, month, onChangeMonth }) {
  const count = Object.values(logMap).filter((e) => !e.holiday).length;
  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="micro" style={{ marginBottom: 8 }}>점심 기록</div>
          <h1>{count}일의 점심</h1>
          <div className="sub">매일 룰렛이 정해준 메뉴, 그리고 그날의 후보 수까지.</div>
        </div>
      </div>
      <CalendarLog
        logMap={logMap}
        todayKey={todayKey}
        year={year}
        month={month}
        onChangeMonth={onChangeMonth}
      />
    </>
  );
}

// ── Phase timeline (top right of page-head) ─────────────────────────
function PhaseTimeline({ current, clock }) {
  const steps = [
    { id: "accepting", label: "모집", time: "—11:55" },
    { id: "spinning",  label: "룰렛",  time: "11:55" },
    { id: "decided",   label: "결과",  time: "12:00—" },
    { id: "next_day",  label: "리셋",  time: "00:00" },
  ];
  const activeIdx = steps.findIndex((s) => s.id === current);
  return (
    <div style={timelineStyles.wrap}>
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div style={timelineStyles.step}>
            <div
              style={{
                ...timelineStyles.bullet,
                background:
                  i < activeIdx ? "var(--ink)" :
                  i === activeIdx ? "var(--accent)" : "white",
                borderColor:
                  i <= activeIdx ? "transparent" : "var(--line)",
              }}
            />
            <div style={{
              ...timelineStyles.lbl,
              color: i === activeIdx ? "var(--ink)" : "var(--muted)",
              fontWeight: i === activeIdx ? 600 : 500,
            }}>
              {s.label}
            </div>
            <div style={timelineStyles.t} className="mono">{s.time}</div>
          </div>
          {i < steps.length - 1 && (
            <div style={{
              ...timelineStyles.bar,
              background: i < activeIdx ? "var(--ink)" : "var(--line)",
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

const timelineStyles = {
  wrap: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "auto 24px",
    alignItems: "start",
    columnGap: 0,
  },
  step: { display: "grid", justifyItems: "center", gridTemplateRows: "auto auto auto", rowGap: 4 },
  bullet: {
    width: 10, height: 10, borderRadius: 5,
    border: "1px solid var(--line)",
    transition: "background .2s, border-color .2s",
  },
  lbl: { fontSize: 12, letterSpacing: "-0.005em" },
  t: { fontSize: 10.5, color: "var(--muted)" },
  bar: {
    height: 1, alignSelf: "center", marginTop: 5,
    width: "100%",
    transition: "background .2s",
    transform: "translateY(0px)",
  },
};

// ── Stage header (above wheel) ──────────────────────────────────────
function StageHeader({ phase, clock }) {
  return (
    <div style={stageStyles.header}>
      <div style={stageStyles.headerLeft}>
        <span className="micro">STAGE</span>
        <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13 }}>
          {phase === "accepting" && "후보 접수중"}
          {phase === "spinning"  && "룰렛 회전중"}
          {phase === "decided"   && "오늘의 결과"}
          {phase === "next_day"  && "새로운 하루"}
        </span>
      </div>
      <div style={stageStyles.headerRight}>
        <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{clock.timeStr}</span>
        <span className={`dot ${clock.dotClass}`} />
      </div>
    </div>
  );
}

// ── Result block under wheel ────────────────────────────────────────
function ResultBlock({ phase, winner, candidates, logMap, onShowRanking }) {
  if (phase === "accepting") {
    return (
      <div style={resultStyles.bar}>
        <div>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>D-26 minutes</div>
          <div style={resultStyles.headline}>
            <span className="mono" style={{ fontSize: 28, fontWeight: 600 }}>11:55</span>
            <span style={{ color: "var(--muted)", fontSize: 14, marginLeft: 8 }}>에 자동 시작</span>
          </div>
        </div>
        <div style={{ ...resultStyles.metric, borderLeft: "1px solid var(--line)" }}>
          <span className="micro">CANDIDATES</span>
          <div className="mono" style={resultStyles.metricNum}>{candidates.length}</div>
        </div>
        <div style={{ ...resultStyles.metric, borderLeft: "1px solid var(--line)" }}>
          <span className="micro">PROBABILITY</span>
          <div className="mono" style={resultStyles.metricNum}>
            {candidates.length ? `${(100 / candidates.length).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>
    );
  }
  if (phase === "spinning") {
    return (
      <div style={{ ...resultStyles.bar, background: "oklch(0.97 0.04 60)", borderColor: "oklch(0.86 0.06 60)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="dot spin" />
          <div>
            <div style={resultStyles.headline}>
              <span style={{ fontWeight: 600, fontSize: 17 }}>룰렛이 돌아가고 있어요</span>
            </div>
            <div style={{ color: "var(--ink-soft)", fontSize: 13, marginTop: 2 }}>
              결과는 곧 발표됩니다…
            </div>
          </div>
        </div>
        <div style={{ ...resultStyles.metric, borderLeft: "1px solid oklch(0.86 0.06 60)" }}>
          <span className="micro">CANDIDATES</span>
          <div className="mono" style={resultStyles.metricNum}>{candidates.length}</div>
        </div>
      </div>
    );
  }
  if (phase === "decided" && winner) {
    return (
      <div style={resultStyles.winnerWrap}>
        <div style={resultStyles.winnerLine}>
          <span className="micro" style={{ color: "var(--accent-ink)" }}>오늘의 점심</span>
          <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>FINALIZED · 11:55</span>
        </div>
        <div style={resultStyles.winnerName}>{winner.name}</div>
        <div style={resultStyles.winnerMeta}>
          <span><b style={{ color: "var(--ink)" }}>{winner.addedBy}</b>님이 추가한 메뉴</span>
          <span style={{ color: "var(--line)" }}>·</span>
          <span><span className="mono">{candidates.length}</span>개 후보 중 당첨</span>
          <span style={{ color: "var(--line)" }}>·</span>
          <span>확률 <span className="mono">{(100/candidates.length).toFixed(1)}%</span></span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button style={resultStyles.ctaPrimary} onClick={onShowRanking}>역대 당첨 랭킹 보기 →</button>
        </div>
      </div>
    );
  }
  if (phase === "next_day") {
    const y = logMap[TODAY_KEY];
    return (
      <div style={resultStyles.bar}>
        <div>
          <div className="micro" style={{ color: "var(--ink-soft)" }}>YESTERDAY</div>
          <div style={resultStyles.headline}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>{y ? y.menu : "—"}</span>
            <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 8 }}>이었어요</span>
          </div>
        </div>
        <div style={{ ...resultStyles.metric, borderLeft: "1px solid var(--line)", flexDirection: "row", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>오늘은 어떨까요?</span>
          <button style={resultStyles.ctaPrimary}>메뉴 추가하기</button>
        </div>
      </div>
    );
  }
  return null;
}

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
    display: "flex", justifyContent: "center", alignItems: "center",
    padding: "32px 24px 24px",
    background:
      "radial-gradient(circle at center, oklch(0.99 0.005 80) 0%, oklch(0.965 0.006 80) 70%)",
  },
};

const stageStyles = {
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--line)",
    background: "white",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
};

const resultStyles = {
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
    display: "flex", flexDirection: "column", gap: 2,
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
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6,
  },
  winnerName: {
    fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em",
    color: "var(--ink)",
    background: "linear-gradient(180deg, var(--ink) 0%, var(--ink) 60%, var(--accent-ink) 60%, var(--accent-ink) 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "var(--ink)",
    margin: "2px 0 8px",
  },
  winnerMeta: {
    color: "var(--ink-soft)", fontSize: 13.5,
    display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap",
  },
  ctaPrimary: {
    appearance: "none", border: 0,
    background: "var(--ink)", color: "white",
    height: 34, padding: "0 14px", borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  ctaSecondary: {
    appearance: "none", border: "1px solid var(--line)",
    background: "white", color: "var(--ink)",
    height: 34, padding: "0 14px", borderRadius: 8,
    fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  ctaGhost: {
    appearance: "none", border: 0, background: "transparent",
    color: "var(--ink-soft)", height: 34, padding: "0 6px",
    fontSize: 13, fontWeight: 500, cursor: "pointer", marginLeft: "auto",
  },
};

// ── phase helpers ───────────────────────────────────────────────────
function phaseClock(phase) {
  if (phase === "accepting") return { timeStr: "11:29", dotClass: "live", statusLabel: "모집중" };
  if (phase === "spinning")  return { timeStr: "11:55", dotClass: "spin", statusLabel: "룰렛 회전" };
  if (phase === "decided")   return { timeStr: "12:03", dotClass: "done", statusLabel: "확정" };
  if (phase === "next_day")  return { timeStr: "09:14", dotClass: "live", statusLabel: "모집중" };
  return { timeStr: "—", dotClass: "", statusLabel: "" };
}

function phaseHeadline(phase, winner) {
  if (phase === "accepting") return "오늘 점심 뭐 먹지?";
  if (phase === "spinning")  return "운명의 카운트다운…";
  if (phase === "decided")   return winner ? "오늘은 이거예요." : "오늘의 점심";
  if (phase === "next_day")  return "오늘도 다시 시작!";
  return "";
}

function phaseSubhead(phase, count, winner) {
  if (phase === "accepting") return `현재 ${count}개의 후보가 룰렛에 올라가 있어요. 11:55에 자동으로 결정돼요.`;
  if (phase === "spinning")  return "룰렛은 11:55에 시작되어 약 5초간 돌아갑니다.";
  if (phase === "decided")   return winner ? `“${winner.name}” · 더는 변경할 수 없어요. 결과는 자정에 초기화됩니다.` : "";
  if (phase === "next_day")  return "어제의 결과는 기록 탭으로 옮겨졌어요. 오늘의 후보를 추가해 주세요.";
  return "";
}

// mount
ReactDOM.createRoot(document.getElementById("app")).render(<App />);
