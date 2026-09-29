"use client";

import { Fragment, type CSSProperties } from "react";
import type { Phase } from "@/lib/phase";
import { addMinutesToSpinTime, formatSpinTime } from "@/lib/time";
import type { SpinTime } from "@/supabase/functions/_shared/spinTime";

// 문자열이 아니라 값으로 받는다 — 결과 단계가 추첨 시각 + n분이라 더하기가 필요하다.
type Props = { current: Phase; spinTime: SpinTime };

// 결과 단계가 가리키는 것은 추첨 시각 자체가 아니라 휠 애니메이션이 끝나고 결과를 읽는 순간이다.
// 값 5는 원 디자인의 추첨 → 결과 간격(5분)을 그대로 유지하려고 고른 것이고, 설정 시각이 바뀌어도
// 두 단계의 간격은 같게 유지된다.
const RESULT_STEP_OFFSET_MIN = 5;

// 라벨과 순서만 고정한다. 시각 문구는 설정에서 와야 하므로 컴포넌트 안에서 조립한다(SPIN-06).
const STEPS = [
  { id: "accepting", label: "모집" },
  { id: "spinning", label: "룰렛" },
  { id: "decided", label: "결과" },
  { id: "reset", label: "리셋" },
] as const;

export function PhaseTimeline({ current, spinTime }: Props) {
  const spinText = formatSpinTime(spinTime);
  const resultText = formatSpinTime(addMinutesToSpinTime(spinTime, RESULT_STEP_OFFSET_MIN));
  // 자정 리셋만 설정과 무관한 고정 시각이다 — 그 작업은 cron 이 매일 00:00 에 돌린다.
  const times: Record<(typeof STEPS)[number]["id"], string> = {
    accepting: `—${spinText}`,
    spinning: spinText,
    decided: `${resultText}—`,
    reset: "00:00",
  };

  // stalled 는 타임라인 단계가 아니다. 추첨이 건너뛰어져 아직 후보를 담을 수 있는 상태라
  // 화면상으로는 모집(idx 0)과 같다. STEPS 는 4단계 그대로 둔다 — 단계 추가는 UI 작업이다.
  const activeIdx = STEPS.findIndex((s) => s.id === (current === "stalled" ? "accepting" : current));
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
              {times[step.id]}
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
