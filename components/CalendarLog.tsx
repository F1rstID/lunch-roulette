"use client";

import * as React from "react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LunchDayRow, ResultRow } from "@/lib/supabase/client";
import { SLICE_COLORS } from "@/lib/colors";
// 격자 산술과 "이번 달 최다 매장" 집계는 lib/history.ts 가 정한다 — 랭킹 페이지와 같은 키 규칙을 쓰기 위해서다.
// 0007 부터 이 컴포넌트가 받는 행은 applyLunchDays 를 지난 것이다: menu·restaurant_id 가 "간 곳" 이고 추첨 1순위는 drawn* 에 있다.
import { buildMonthGrid, buildRanking, type HistoryEntry } from "@/lib/history";
// 요일 라벨과 요일 계산은 lib/lunchDay.ts 가 든다 — 오늘 탭 배지("화 방문")와 같은 배열·같은 산술이다.
import { WEEKDAYS, weekdayLabel } from "@/lib/lunchDay";
import { backupRanks } from "@/lib/ranking";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDate(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

type LogEntry = HistoryEntry<ResultRow>;

type Props = {
  // 날짜 → 간 곳 기준 행(단체 점심 안 한 날은 없다).
  logMap: Record<string, LogEntry>;
  // 날짜 → 점심 기록 행. 단체 점심 안 한 날(skipped)을 달력에 표시하려면 결과 행과 별도로 필요하다.
  days: Record<string, LunchDayRow>;
  todayKey: string;
  year: number;
  month: number;
  onChangeMonthAction: (y: number, m: number) => void;
};

export function CalendarLog({ logMap, days, todayKey, year, month, onChangeMonthAction }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const cells = buildMonthGrid(year, month);

  // 좁은 화면에서는 상세가 달력 아래로 내려가 누른 결과가 화면 밖에 생긴다. 칸의 매장명도 그 폭에서는
  // 숨기므로, 누른 결과가 보이는 것이 그 배치의 전제다. nearest 라서 상세가 이미 보이는 2단 배치에서는
  // 아무것도 움직이지 않는다.
  useEffect(() => {
    if (selected === null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [selected]);

  const monthPrefix = `${year}-${pad2(month)}`;
  const entriesThisMonth = Object.values(logMap).filter((e) => e.date.startsWith(monthPrefix));
  // 이름이 아니라 매장 키로 센다 — 개명한 매장이 두 줄로 갈라지면 "가장 많이 간 매장" 이 틀린다.
  const topRestaurant = buildRanking(entriesThisMonth).list[0] ?? null;

  const sel = selected ? (logMap[selected] ?? null) : null;
  const selDay = selected ? (days[selected] ?? null) : null;
  // 단체 점심 안 한 날은 간 곳 행이 없다 — 상세는 그 사실 한 줄이다.
  const selSkipped = sel === null && selDay !== null && selDay.visit_status === "skipped";

  return (
    <div className="l-cols-log" style={s.layout}>
      <div className="card" style={s.gridCard}>
        <header style={s.gridHeader}>
          <div style={s.gridHeaderText}>
            <div style={s.gridTitle} className="mono">
              {year}.{pad2(month)}
            </div>
            <div style={s.gridSub}>
              {entriesThisMonth.length}일 점심 ·{" "}
              {topRestaurant
                ? `가장 많이 간 매장 "${topRestaurant.name}" (${topRestaurant.wins}회)`
                : "기록 없음"}
            </div>
          </div>
          <div style={s.navGroup}>
            <button
              className="l-tap"
              style={s.navBtn}
              onClick={() => {
                const ny = month === 1 ? year - 1 : year;
                const nm = month === 1 ? 12 : month - 1;
                onChangeMonthAction(ny, nm);
              }}
              aria-label="이전 달"
            >
              ‹
            </button>
            <button
              className="l-tap"
              style={s.navBtn}
              onClick={() => {
                const ny = month === 12 ? year + 1 : year;
                const nm = month === 12 ? 1 : month + 1;
                onChangeMonthAction(ny, nm);
              }}
              aria-label="다음 달"
            >
              ›
            </button>
          </div>
        </header>

        <div className="l-cal-week" style={s.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              style={{
                ...s.weekHead,
                color:
                  i === 0
                    ? "var(--red)"
                    : i === 6
                      ? "oklch(0.5 0.08 245)"
                      : "var(--ink-soft)",
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="l-cal-grid" style={s.grid}>
          {cells.map((c, i) => {
            const key = fmtDate(c.y, c.m, c.d);
            const entry = logMap[key];
            // 단체 점심 안 한 날 — 간 곳 행은 없지만 "안 먹었다" 는 사실은 칸에 남긴다(빈 칸과 다르다).
            const skipped = days[key]?.visit_status === "skipped";
            const selectable = entry !== undefined || skipped;
            const isToday = key === todayKey;
            const weekday = i % 7;
            const isWeekend = weekday === 0 || weekday === 6;
            const isSelected = selected === key;
            return (
              <button
                key={i}
                className="l-cal-cell"
                // 좁은 화면에서는 매장명과 "오늘" 표시가 display: none 이라 접근성 트리에서도 빠진다.
                // 보이는 글자에 기대지 않고 이름을 직접 준다.
                aria-label={
                  entry ? `${c.m}월 ${c.d}일 ${entry.menu}` : skipped ? `${c.m}월 ${c.d}일 단체 점심 안 함` : undefined
                }
                aria-current={isToday ? "date" : undefined}
                aria-pressed={selectable ? isSelected : undefined}
                style={{
                  ...s.cell,
                  background: isSelected ? "oklch(0.95 0.04 60)" : "white",
                  borderColor: isSelected ? "var(--accent)" : "var(--line-soft)",
                  cursor: selectable ? "pointer" : "default",
                  opacity: c.dim ? 0.35 : 1,
                }}
                onClick={() => selectable && setSelected(isSelected ? null : key)}
                disabled={!selectable}
              >
                <div style={s.cellTop}>
                  <span
                    className="mono"
                    style={{
                      ...s.dateNum,
                      color: isToday
                        ? "white"
                        : isWeekend && weekday === 0
                          ? "var(--red)"
                          : isWeekend && weekday === 6
                            ? "oklch(0.5 0.08 245)"
                            : "var(--ink)",
                      background: isToday ? "var(--accent)" : "transparent",
                    }}
                  >
                    {c.d}
                  </span>
                  {isToday && (
                    <span style={s.todayTag} className="l-hide-narrow">
                      오늘
                    </span>
                  )}
                </div>
                {entry && (
                  <div style={s.entryChip}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        background: SLICE_COLORS[(c.d - 1) % SLICE_COLORS.length],
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    {/* 휴대폰 칸은 폭이 40px 남짓이라 이름이 들어가지 않는다. 점만 남기고 이름은 눌러서 본다. */}
                    <span className="l-hide-narrow" style={s.entryName}>
                      {entry.menu}
                    </span>
                  </div>
                )}
                {!entry && skipped && (
                  <div style={s.entryChip}>
                    <span style={s.skipDot} />
                    <span className="l-hide-narrow" style={{ ...s.entryName, color: "var(--muted)" }}>
                      쉼
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <aside ref={detailRef} className="card" style={s.detail}>
        {!sel && !selSkipped && (
          <div style={s.detailEmpty}>
            <div style={s.detailEmptyIcon}>
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
              그날 간 곳과 추첨 결과를 볼 수 있어요.
            </div>
          </div>
        )}
        {sel && <DetailView entry={sel} />}
        {selSkipped && selected && <SkippedView date={selected} />}
      </aside>
    </div>
  );
}

// 단체 점심을 안 한 날의 상세 — 간 곳 행이 없으므로 날짜와 그 사실만 있다.
function SkippedView({ date }: { date: string }) {
  return (
    <div style={s.detailBody}>
      <div className="mono" style={s.detailDate}>
        {date.replace(/-/g, ".")} <span style={{ color: "var(--muted)" }}>({weekdayLabel(date)})</span>
      </div>
      <div style={{ ...s.detailWinner, background: "var(--bg-soft)", borderColor: "var(--line)" }}>
        <span className="micro" style={{ color: "var(--muted)" }}>
          이날
        </span>
        <h2 style={{ ...s.detailMenu, fontSize: 20, color: "var(--ink-soft)" }}>단체 점심 안 했어요</h2>
      </div>
    </div>
  );
}

function DetailView({ entry }: { entry: LogEntry }) {
  const wd = weekdayLabel(entry.date);
  const winnerOf = entry.candidates?.length ?? 0;
  const backups = backupRanks(entry.ranking);
  // 간 곳이 추첨 1순위와 다르면(목적지 변경·방문 확인) 1순위를 보조행으로 남긴다 — 추첨 결과도 기록의 일부다.
  const drawDiffers = entry.drawnId !== entry.restaurant_id || entry.drawnName !== entry.menu;

  return (
    <div style={s.detailBody}>
      <div className="mono" style={s.detailDate}>
        {entry.date.replace(/-/g, ".")}{" "}
        <span style={{ color: "var(--muted)" }}>({wd})</span>
      </div>

      <div style={s.detailWinner}>
        <div style={s.detailLabelLine}>
          <span className="micro" style={{ color: "var(--accent-ink)" }}>
            {entry.unconfirmed ? "갈 곳" : "먹은 곳"}
          </span>
          {/* 방문 확인이 없는 날은 목적지(기본 1순위)에 간 것으로 센다 — 그 가정을 숨기지 않는다. */}
          {entry.unconfirmed && <span style={s.detailTag}>확인 안 됨</span>}
        </div>
        <h2 style={s.detailMenu}>{entry.menu}</h2>
        {drawDiffers && <div style={s.detailDrawn}>추첨 1순위 {entry.drawnName}</div>}
      </div>
      {/* 그날의 2·3순위. 0006 이전 행은 비어 있어 줄 자체가 없다. */}
      {backups.length > 0 && (
        <div style={s.detailBackups}>
          {backups.map((backup, i) => (
            <span key={backup.rank}>
              {i > 0 && <span style={{ color: "var(--line)" }}> · </span>}
              <span style={{ color: "var(--muted)" }}>{backup.rank}순위</span> {backup.name}
            </span>
          ))}
        </div>
      )}

      <dl style={s.detailList}>
        <DetailRow label="후보 수">
          <span className="mono">{winnerOf}개</span>의 매장 중 선택
        </DetailRow>
        {entry.candidates && entry.candidates.length > 0 && (
          <DetailRow label="후보 목록">
            <span style={{ color: "var(--ink-soft)" }}>
              {entry.candidates.map((c) => c.name).join(", ")}
            </span>
          </DetailRow>
        )}
      </dl>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.detailRow}>
      <dt style={s.detailKey}>{label}</dt>
      <dd style={s.detailVal}>{children}</dd>
    </div>
  );
}

const s = {
  // 격자(달력 옆 상세 ↔ 달력 아래 상세)는 app/globals.css 의 l-cols-log 가 가진다.
  layout: { paddingBottom: 64 },
  gridCard: { padding: 0, overflow: "hidden" },
  gridHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "20px 22px 16px",
    borderBottom: "1px solid var(--line)",
  },
  // 부제에 매장명이 들어간다 — 줄어들 수 있어야 긴 이름이 달 이동 버튼을 밀어내지 않는다.
  gridHeaderText: { minWidth: 0 },
  gridTitle: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" },
  gridSub: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  navGroup: { display: "flex", gap: 4, flexShrink: 0 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--line)",
    background: "white",
    cursor: "pointer",
    fontSize: 16,
    color: "var(--ink-soft)",
    display: "grid",
    placeItems: "center",
  },
  // 요일 줄·날짜 격자·칸의 여백과 칸 높이는 l-cal-week·l-cal-grid·l-cal-cell 이 가진다.
  weekRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    background: "var(--bg-soft)",
    borderBottom: "1px solid var(--line-soft)",
  },
  weekHead: { fontSize: 11, fontWeight: 500, letterSpacing: "0.04em", textAlign: "center" },
  // 1fr 이 아니라 minmax(0, 1fr) 인 이유: 1fr 의 하한은 내용 폭이라 긴 매장명이 든 열만 넓어진다.
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    background: "var(--bg-soft)",
  },
  cell: {
    border: "1px solid var(--line-soft)",
    borderRadius: 9,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    fontFamily: "inherit",
    transition: "background .12s, border-color .12s",
    textAlign: "left",
  },
  cellTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  dateNum: {
    fontSize: 12.5,
    fontWeight: 500,
    width: 22,
    height: 22,
    borderRadius: 6,
    display: "inline-grid",
    placeItems: "center",
    letterSpacing: "-0.01em",
  },
  todayTag: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--accent-ink)",
  },
  entryChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12.5,
    color: "var(--ink)",
    marginTop: "auto",
    minWidth: 0,
  },
  entryName: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontWeight: 500,
    letterSpacing: "-0.01em",
  },
  // 단체 점심 안 한 날의 점 — 색 조각이 아니라 빈 테두리라 "기록은 있지만 간 곳은 없다" 로 읽힌다.
  skipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    border: "1px solid var(--muted)",
    display: "inline-block",
    flexShrink: 0,
  },
  detailLabelLine: { display: "flex", alignItems: "center", gap: 8 },
  detailTag: {
    fontSize: 10.5,
    fontWeight: 600,
    color: "var(--muted)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "1px 6px",
    background: "white",
  },
  detailDrawn: { marginTop: 6, fontSize: 12.5, color: "var(--muted)" },
  detail: {
    padding: 24,
    position: "sticky",
    top: 24,
  },
  detailEmpty: { padding: "12px 0", textAlign: "center" },
  detailEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 12,
    background: "var(--bg-soft)",
    display: "grid",
    placeItems: "center",
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
    margin: "6px 0 0",
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "-0.025em",
    color: "var(--ink)",
  },
  detailBackups: { fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.6 },
  detailList: { margin: 0, padding: 0 },
  detailRow: {
    display: "grid",
    gridTemplateColumns: "84px minmax(0, 1fr)",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--line-soft)",
    fontSize: 13.5,
  },
  detailKey: { color: "var(--muted)", fontSize: 12.5, margin: 0 },
  detailVal: { margin: 0, color: "var(--ink)" },
} satisfies Record<string, CSSProperties>;
