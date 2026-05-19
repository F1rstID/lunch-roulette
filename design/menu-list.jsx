// menu-list.jsx — input + list of candidate menus for today.
// During 'accepting' phase: user can add and delete (only their own
// in real life, but since we have no auth, all are deletable).
// During 'spinning'/'decided': read-only.

function MenuList({ items, phase, onAdd, onRemove }) {
  const [val, setVal] = React.useState("");
  const inputRef = React.useRef(null);
  const readOnly = phase !== "accepting";

  const submit = (e) => {
    e?.preventDefault();
    const t = val.trim();
    if (!t) return;
    if (items.some((x) => x.name === t)) {
      // gentle nudge — focus, no error noise
      setVal("");
      return;
    }
    onAdd(t);
    setVal("");
    inputRef.current?.focus();
  };

  return (
    <div className="card" style={menuStyles.card}>
      <header style={menuStyles.header}>
        <div>
          <div style={menuStyles.title}>오늘의 후보</div>
          <div style={menuStyles.subtle}>
            {readOnly
              ? `${items.length}개 메뉴 · 마감됨`
              : `${items.length}개 메뉴 · 11:55까지 자유 추가`}
          </div>
        </div>
        <div style={menuStyles.counter} className="mono">{String(items.length).padStart(2,"0")}</div>
      </header>

      <form onSubmit={submit} style={menuStyles.form}>
        <input
          ref={inputRef}
          type="text"
          placeholder={readOnly ? "오늘은 추가할 수 없어요" : "예) 김치찌개, 마라탕, 샐러드…"}
          maxLength={24}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={readOnly}
          style={{
            ...menuStyles.input,
            background: readOnly ? "var(--bg-soft)" : "white",
            color: readOnly ? "var(--muted)" : "var(--ink)",
          }}
        />
        <button
          type="submit"
          disabled={readOnly || !val.trim()}
          style={{
            ...menuStyles.addBtn,
            opacity: readOnly || !val.trim() ? 0.4 : 1,
            cursor: readOnly || !val.trim() ? "not-allowed" : "pointer",
          }}
        >
          추가
        </button>
      </form>

      <ul style={menuStyles.list}>
        {items.length === 0 && (
          <li style={menuStyles.empty}>
            <div style={menuStyles.emptyIllu}>
              <div style={{ ...menuStyles.dot, background: "var(--line)" }} />
              <div style={{ ...menuStyles.dot, background: "var(--line)" }} />
              <div style={{ ...menuStyles.dot, background: "var(--line)" }} />
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              아직 추가된 메뉴가 없어요.<br />
              위 입력창에서 첫 메뉴를 추가해 보세요.
            </div>
          </li>
        )}
        {items.map((m, i) => (
          <li key={m.id} style={menuStyles.row}>
            <span
              className="mono"
              style={{
                ...menuStyles.idx,
                background: SLICE_COLORS[i % SLICE_COLORS.length],
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={menuStyles.name}>{m.name}</div>
              <div style={menuStyles.meta}>
                <span>{m.addedBy}</span>
                <span style={{ color: "var(--line)" }}>·</span>
                <span className="mono">{m.addedAt}</span>
              </div>
            </div>
            {!readOnly && (
              <button
                aria-label="삭제"
                onClick={() => onRemove(m.id)}
                style={menuStyles.del}
                title="삭제"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <footer style={menuStyles.footer}>
        <span className="micro">규칙</span>
        <span style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>
          11:55에 룰렛이 자동으로 돌아갑니다 · 결과는 자정에 초기화돼요
        </span>
      </footer>
    </div>
  );
}

const menuStyles = {
  card: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px 14px",
    borderBottom: "1px solid var(--line)",
  },
  title: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" },
  subtle: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  counter: {
    fontSize: 22, fontWeight: 600, color: "var(--ink)",
    padding: "2px 10px",
    background: "var(--bg-soft)",
    borderRadius: 8,
    letterSpacing: "-0.02em",
  },
  form: {
    display: "flex", gap: 8,
    padding: "14px 20px",
    borderBottom: "1px solid var(--line-soft)",
  },
  input: {
    flex: 1,
    height: 38, padding: "0 12px",
    border: "1px solid var(--line)",
    borderRadius: 9,
    fontSize: 14,
    outline: "none",
    transition: "border-color .12s, box-shadow .12s",
  },
  addBtn: {
    appearance: "none", border: 0,
    background: "var(--ink)", color: "white",
    height: 38, padding: "0 16px",
    borderRadius: 9, fontWeight: 600, fontSize: 13.5,
    letterSpacing: "-0.005em",
  },
  list: {
    listStyle: "none", margin: 0, padding: 0,
    maxHeight: 380, overflowY: "auto",
  },
  empty: {
    padding: "32px 20px",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 12,
    textAlign: "center",
  },
  emptyIllu: { display: "flex", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  row: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 20px",
    borderBottom: "1px solid var(--line-soft)",
    animation: "fade-up .2s ease-out both",
  },
  idx: {
    width: 28, height: 28, borderRadius: 8,
    display: "grid", placeItems: "center",
    fontSize: 11, fontWeight: 600,
    color: "oklch(0.25 0.02 70)",
    border: "1px solid oklch(0 0 0 / 0.06)",
    flexShrink: 0,
  },
  name: { fontSize: 14.5, fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" },
  meta: { fontSize: 12, color: "var(--muted)", display: "flex", gap: 6, alignItems: "center", marginTop: 1 },
  del: {
    appearance: "none", border: 0, background: "transparent",
    color: "var(--muted)", width: 26, height: 26, borderRadius: 6,
    cursor: "pointer", fontSize: 13,
  },
  footer: {
    padding: "12px 20px",
    background: "var(--bg-soft)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex", alignItems: "center", gap: 10,
  },
};

Object.assign(window, { MenuList });
