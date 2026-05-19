"use client";

import { Fragment, type CSSProperties } from "react";
import type { Phase } from "@/lib/phase";

type Props = { current: Phase };

const STEPS = [
  { id: "accepting", label: "모집", time: "—11:55" },
  { id: "spinning", label: "룰렛", time: "11:55" },
  { id: "decided", label: "결과", time: "12:00—" },
  { id: "reset", label: "리셋", time: "00:00" },
] as const;

export function PhaseTimeline({ current }: Props) {
  const activeIdx = STEPS.findIndex((s) => s.id === current);
  const idx = activeIdx === -1 ? 2 : activeIdx; // decided 후 reset 전엔 decided 유지

  return (
    <div style={s.wrap}>
      {STEPS.map((step, i) => (
        <Fragment key={step.id}>
          <div style={s.step}>
            <div
              style={{
                ...s.bullet,
                background:
                  i < idx
                    ? "var(--ink)"
                    : i === idx
                      ? "var(--accent)"
                      : "white",
                borderColor: i <= idx ? "transparent" : "var(--line)",
              }}
            />
            <div
              style={{
                ...s.lbl,
                color: i === idx ? "var(--ink)" : "var(--muted)",
                fontWeight: i === idx ? 600 : 500,
              }}
            >
              {step.label}
            </div>
            <div style={s.t} className="mono">
              {step.time}
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div
              style={{
                ...s.bar,
                background: i < idx ? "var(--ink)" : "var(--line)",
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

const s = {
  wrap: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "auto 24px",
    alignItems: "start",
    columnGap: 0,
  },
  step: {
    display: "grid",
    justifyItems: "center",
    gridTemplateRows: "auto auto auto",
    rowGap: 4,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    border: "1px solid var(--line)",
    transition: "background .2s, border-color .2s",
  },
  lbl: { fontSize: 12, letterSpacing: "-0.005em" },
  t: { fontSize: 10.5, color: "var(--muted)" },
  bar: {
    height: 1,
    alignSelf: "center",
    marginTop: 5,
    width: "100%",
    transition: "background .2s",
  },
} satisfies Record<string, CSSProperties>;
