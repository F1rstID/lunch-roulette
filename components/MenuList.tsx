"use client";

import * as React from "react";
import { useRef, useState, type CSSProperties } from "react";
import type { MenuRow } from "@/lib/supabase/client";
import { SLICE_COLORS } from "@/lib/colors";
import { formatHhMm } from "@/lib/time";
import type { Phase } from "@/lib/phase";

type Props = {
  items: MenuRow[];
  phase: Phase;
  // 추가 성공 여부를 돌려준다. 실패하면 입력값을 지우지 않아 사용자가 바로 재시도할 수 있다.
  onAddAction: (name: string) => boolean | Promise<boolean>;
  // name 은 실패 메시지에 쓸 표시용. 페이지가 menus 를 다시 뒤지지 않게 여기서 넘긴다.
  onRemoveAction: (id: string, name: string) => void | Promise<void>;
  // 고정된 메뉴 이름 집합. 핀 아이콘 상태를 이름 멤버십으로 판정.
  pinnedNames: Set<string>;
  // currentlyPinned = 클릭 시점의 고정 상태. 핸들러가 이걸 보고 insert/delete 를 고른다.
  onTogglePinAction: (name: string, currentlyPinned: boolean) => void | Promise<void>;
};

export function MenuList({ items, phase, pinnedNames, onAddAction, onRemoveAction, onTogglePinAction }: Props) {
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const readOnly = phase !== "accepting";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const t = val.trim();
    if (!t) return;
    if (items.some((x) => x.name === t)) {
      setVal("");
      return;
    }
    const ok = await onAddAction(t);
    if (!ok) return;
    setVal("");
    inputRef.current?.focus();
  }

  return (
    <div className="card" style={s.card}>
      <header style={s.header}>
        <div>
          <div style={s.title}>오늘의 후보</div>
          <div style={s.subtle}>
            {readOnly
              ? `${items.length}개 메뉴 · 마감됨`
              : `${items.length}개 메뉴 · 11:55까지 자유 추가`}
          </div>
        </div>
        <div className="mono" style={s.counter}>
          {String(items.length).padStart(2, "0")}
        </div>
      </header>

      <form onSubmit={submit} style={s.form}>
        <input
          ref={inputRef}
          type="text"
          placeholder={readOnly ? "오늘은 추가할 수 없어요" : "예) 김치찌개, 마라탕, 샐러드…"}
          maxLength={24}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={readOnly}
          style={{
            ...s.input,
            background: readOnly ? "var(--bg-soft)" : "white",
            color: readOnly ? "var(--muted)" : "var(--ink)",
          }}
        />
        <button
          type="submit"
          disabled={readOnly || !val.trim()}
          style={{
            ...s.addBtn,
            opacity: readOnly || !val.trim() ? 0.4 : 1,
            cursor: readOnly || !val.trim() ? "not-allowed" : "pointer",
          }}
        >
          추가
        </button>
      </form>

      <ul style={s.list}>
        {items.length === 0 && (
          <li style={s.empty}>
            <div style={s.emptyIllu}>
              <div style={{ ...s.emptyDot, background: "var(--line)" }} />
              <div style={{ ...s.emptyDot, background: "var(--line)" }} />
              <div style={{ ...s.emptyDot, background: "var(--line)" }} />
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>
              아직 추가된 메뉴가 없어요.
              <br />
              위 입력창에서 첫 메뉴를 추가해 보세요.
            </div>
          </li>
        )}
        {items.map((m, i) => (
          <li key={m.id} style={s.row}>
            <span
              className="mono"
              style={{
                ...s.idx,
                background: SLICE_COLORS[i % SLICE_COLORS.length],
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.name}>{m.name}</div>
              <div style={s.meta}>
                <span className="mono">{formatHhMm(new Date(m.created_at))}</span>
              </div>
            </div>
            <PinButton
              pinned={pinnedNames.has(m.name)}
              onToggle={() => onTogglePinAction(m.name, pinnedNames.has(m.name))}
            />
            {!readOnly && (
              <button
                aria-label="삭제"
                onClick={() => onRemoveAction(m.id, m.name)}
                style={s.del}
                title="삭제"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <footer style={s.footer}>
        <span className="micro">규칙</span>
        <span style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>
          11:55에 룰렛이 자동으로 돌아갑니다 · 📌 고정한 메뉴는 매일 자동 등록돼요
        </span>
      </footer>
    </div>
  );
}

function PinButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={pinned ? "고정 해제" : "고정"}
      aria-pressed={pinned}
      title={pinned ? "고정 해제 — 내일 자동 등록 취소" : "고정 — 매일 자동 등록"}
      onClick={onToggle}
      style={{
        ...s.pin,
        opacity: pinned ? 1 : 0.32,
        background: pinned ? "var(--accent-soft)" : "transparent",
      }}
    >
      📌
    </button>
  );
}

const s = {
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
    fontSize: 22,
    fontWeight: 600,
    color: "var(--ink)",
    padding: "2px 10px",
    background: "var(--bg-soft)",
    borderRadius: 8,
    letterSpacing: "-0.02em",
  },
  form: {
    display: "flex",
    gap: 8,
    padding: "14px 20px",
    borderBottom: "1px solid var(--line-soft)",
  },
  input: {
    flex: 1,
    height: 38,
    padding: "0 12px",
    border: "1px solid var(--line)",
    borderRadius: 9,
    fontSize: 14,
    outline: "none",
    transition: "border-color .12s, box-shadow .12s",
  },
  addBtn: {
    appearance: "none",
    border: 0,
    background: "var(--ink)",
    color: "white",
    height: 38,
    padding: "0 16px",
    borderRadius: 9,
    fontWeight: 600,
    fontSize: 13.5,
    letterSpacing: "-0.005em",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    maxHeight: 380,
    overflowY: "auto",
  },
  empty: {
    padding: "32px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    textAlign: "center",
  },
  emptyIllu: { display: "flex", gap: 6 },
  emptyDot: { width: 6, height: 6, borderRadius: 3 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 20px",
    borderBottom: "1px solid var(--line-soft)",
    animation: "fade-up .2s ease-out both",
  },
  idx: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "oklch(0.25 0.02 70)",
    border: "1px solid oklch(0 0 0 / 0.06)",
    flexShrink: 0,
  },
  name: {
    fontSize: 14.5,
    fontWeight: 500,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  meta: {
    fontSize: 12,
    color: "var(--muted)",
    display: "flex",
    gap: 6,
    alignItems: "center",
    marginTop: 1,
  },
  del: {
    appearance: "none",
    border: 0,
    background: "transparent",
    color: "var(--muted)",
    width: 26,
    height: 26,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  pin: {
    appearance: "none",
    border: 0,
    width: 26,
    height: 26,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
    transition: "opacity .12s",
  },
  footer: {
    padding: "12px 20px",
    background: "var(--bg-soft)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
} satisfies Record<string, CSSProperties>;
