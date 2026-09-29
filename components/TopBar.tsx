"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { Phase } from "@/lib/phase";

type Tab = "today" | "restaurants" | "log" | "rank";

type Props = {
  active: Tab;
  candidateCount?: number;
  phase: Phase;
  clockTime: string; // "HH:mm:ss" or "HH:mm"
};

export function TopBar({ active, candidateCount = 0, phase, clockTime }: Props) {
  const phaseInfo = ((): { label: string; dot: string } => {
    switch (phase) {
      case "accepting":
        return { label: "모집중", dot: "live" };
      case "spinning":
        return { label: "룰렛 회전", dot: "spin" };
      case "decided":
        return { label: "확정", dot: "done" };
      case "stalled":
        // 추첨 시각은 지났는데 결과 행이 없는 구간. "확정" 으로 보이면 안 된다.
        return { label: "추첨 대기", dot: "live" };
      default: {
        // 유니온에 상태가 더 늘면 이 대입이 컴파일 에러가 된다. 이 파일이 갱신을 강제당하는 지점.
        const exhaustive: never = phase;
        return exhaustive;
      }
    }
  })();

  return (
    <header style={s.topbar}>
      <div className="wrap" style={s.topbarInner}>
        <div style={s.brand}>
          <span style={s.brandMark} aria-hidden />
          <span>점심 룰렛</span>
          <span style={s.brandSub}>· LUNCH ROULETTE</span>
        </div>

        <nav style={s.tabs}>
          <TabLink href="/" active={active === "today"}>
            오늘
            {/* 뱃지는 활성 탭 안에서만 그려진다 — 가드가 이미 active === "today" 라 배경색 분기는
                도달하지 못했다. 비활성 탭에도 보일 생각이면 가드를 candidateCount > 0 만으로 푼다. */}
            {active === "today" && candidateCount > 0 && <span style={s.countActive}>{candidateCount}</span>}
          </TabLink>
          <TabLink href="/restaurants" active={active === "restaurants"}>
            매장
          </TabLink>
          <TabLink href="/log" active={active === "log"}>
            기록
          </TabLink>
          <TabLink href="/rank" active={active === "rank"}>
            랭킹
          </TabLink>
        </nav>

        <div style={s.right}>
          <span style={s.statusPill}>
            <span className={`dot ${phaseInfo.dot}`} />
            {phaseInfo.label}
          </span>
          <span style={s.clockReadout}>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }}>NOW</span>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--ink)" }}>
              {clockTime}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        ...s.tab,
        background: active ? "var(--ink)" : "transparent",
        color: active ? "white" : "var(--ink-soft)",
      }}
    >
      {children}
    </Link>
  );
}

const s = {
  topbar: {
    borderBottom: "1px solid var(--line)",
    background: "var(--bg)",
  },
  topbarInner: {
    display: "flex",
    alignItems: "center",
    gap: 28,
    height: 56,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    fontSize: 15,
    whiteSpace: "nowrap",
  },
  brandMark: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    background:
      "conic-gradient(from -90deg, var(--accent) 0 25%, oklch(0.88 0.02 70) 25% 50%, var(--accent) 50% 75%, oklch(0.88 0.02 70) 75% 100%)",
    border: "1.5px solid var(--ink)",
    position: "relative",
    display: "inline-block",
  },
  brandSub: {
    fontWeight: 400,
    color: "var(--muted)",
    marginLeft: 6,
    fontSize: 13,
  },
  tabs: { display: "flex", gap: 4, marginLeft: 8 },
  tab: {
    padding: "8px 12px",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13.5,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    textDecoration: "none",
  },
  countActive: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 999,
    background: "oklch(1 0 0 / 0.18)",
    color: "white",
  },
  right: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 16,
    color: "var(--ink-soft)",
    fontSize: 13,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    padding: "3px 9px",
    borderRadius: 999,
    background: "var(--bg-soft)",
    color: "var(--ink-soft)",
    border: "1px solid var(--line)",
  },
  clockReadout: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 10px",
    border: "1px solid var(--line)",
    borderRadius: 999,
    background: "var(--panel)",
  },
} satisfies Record<string, CSSProperties>;
