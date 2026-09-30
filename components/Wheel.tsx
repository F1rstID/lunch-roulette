"use client";

import * as React from "react";
import type { CSSProperties } from "react";
import { SLICE_COLORS } from "@/lib/colors";
import { WHEEL_WINNER_LABEL_MAX_CODE_POINTS, fitWheelLabel, isLabelFlipped } from "@/lib/wheelLabel";

export type WheelPhase = "idle" | "spinning" | "decided";

type WheelItem = { id: string; name: string };

type Props = {
  items: WheelItem[];
  phase: WheelPhase;
  winnerIndex: number;
  // 설정에서 온 추첨 시각 문구. 기본값을 두지 않는다 — 두면 시각이 다시 이 파일에 숨는다(SPIN-06).
  spinTimeText: string;
  onSpinCompleteAction?: () => void;
  // 최대 폭이다. 자리가 좁으면 그보다 작게 그려지고, 안쪽 좌표는 viewBox 가 비율대로 줄인다.
  size?: number;
};

const SPIN_TURNS = 6;
const SPIN_MS = 4800;
const SPIN_EASING = "cubic-bezier(0.16, 1, 0.18, 1)";

// 포인터가 매번 슬라이스 정중앙에 꽂히면 부자연스러워 ±30% 범위로 흩는다.
// Math.random()은 렌더 순수성 lint(react-hooks/purity)에 걸리므로 당첨 index로 결정적으로 만든다.
function spinJitter(winnerIndex: number, sliceDeg: number): number {
  const frac = ((winnerIndex + 1) * 0.618033988) % 1; // 황금비 분산: 0~1 고르게
  return (frac - 0.5) * sliceDeg * 0.6;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey} Z`;
}

export function Wheel({
  items,
  phase,
  winnerIndex,
  spinTimeText,
  onSpinCompleteAction,
  size = 460,
}: Props) {
  const sliceDeg = items.length > 0 ? 360 / items.length : 0;
  const hasWinner = winnerIndex >= 0 && items.length > 0;

  // 당첨 슬라이스 중앙이 12시 포인터에 오는 정지 각도
  const restRotation = hasWinner ? -(sliceDeg * winnerIndex + sliceDeg / 2) : 0;

  // 회전 각도는 state가 아니라 phase에서 파생한다. spinning이면 CSS transition이 현재 각도에서
  // 목표 각도까지 굴려 주고, decided/idle이면 transition 없이 즉시 정지 각도로 놓는다.
  // state+effect로 갱신하면 react-hooks/set-state-in-effect 에 걸리고, 실제로도 props의 파생값이다.
  const isSpinning = phase === "spinning" && hasWinner;
  const rotation = isSpinning
    ? SPIN_TURNS * 360 + restRotation + spinJitter(winnerIndex, sliceDeg)
    : phase === "decided"
      ? restRotation
      : 0;

  React.useEffect(() => {
    if (!isSpinning) return;
    const t = setTimeout(() => onSpinCompleteAction?.(), SPIN_MS + 100);
    return () => clearTimeout(t);
  }, [isSpinning, onSpinCompleteAction]);

  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 30;
  const Rinner = 56;
  // 당첨 배지의 중심 반지름. 배지는 방사형이 아니라 가로다 — 확정 상태에서 당첨 칸은 12시에 오므로
  // 방사형이면 세로 글자가 된다. 배지가 옆 칸을 덮는 것은 강조라 허용한다.
  const labelR = R * 0.62;
  // 나머지 라벨이 눕는 방사형 띠. 허브 테두리(Rinner + 10) 바깥에서 시작해 칸 끝 눈금(R - 10) 앞에서 끝난다.
  // 띠 길이는 칸 수와 무관하므로 후보가 늘어도 라벨끼리 겹치지 않는다. 이름 상한(lib/wheelLabel.ts)은 이 길이에서 왔다.
  const labelBandStart = Rinner + 18;
  const labelBandEnd = R - 8;
  const labelBandMid = (labelBandStart + labelBandEnd) / 2;
  const showLabels = phase !== "spinning" && items.length > 0;
  const isDecided = phase === "decided";

  if (items.length === 0) {
    return (
      <div style={{ ...outer, maxWidth: size }}>
        <Pointer active={false} />
        <svg viewBox={`0 0 ${size} ${size}`} style={fluidSvg} aria-hidden>
          <circle cx={cx} cy={cy} r={R + 8} fill="white" stroke="oklch(0.85 0.012 70)" />
          <circle cx={cx} cy={cy} r={R} fill="oklch(0.965 0.006 80)" stroke="var(--line-soft)" strokeDasharray="3 4" />
          <circle cx={cx} cy={cy} r={Rinner + 8} fill="white" stroke="oklch(0.85 0.012 70)" />
          <circle cx={cx} cy={cy} r={Rinner} fill="var(--bg-soft)" stroke="var(--line)" />
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--muted)">
            담긴 매장 없음
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="var(--font-sans)" fontSize="10.5" fill="var(--muted)">
            목록에서 담아 주세요
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div style={{ ...outer, maxWidth: size }}>
      <Pointer active={phase === "spinning" || phase === "decided"} />
      {/* 휠은 장식이다 — 같은 정보를 후보 목록이 글자로 가진다. 잘린 이름과 뒤집힌 읽기 순서를 읽어 주지 않는다. */}
      <svg viewBox={`0 0 ${size} ${size}`} style={fluidSvg} aria-hidden>
        <defs>
          <filter id="wheel-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="oklch(0.2 0.02 70)" floodOpacity="0.10" />
          </filter>
        </defs>

        <g filter="url(#wheel-shadow)">
          <circle cx={cx} cy={cy} r={R + 10} fill="white" stroke="oklch(0.85 0.012 70)" strokeWidth="1" />
        </g>
        <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke="oklch(0.93 0.008 70)" />

        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${rotation}deg)`,
            transition: isSpinning ? `transform ${SPIN_MS}ms ${SPIN_EASING}` : "none",
          }}
        >
          {items.map((item, i) => {
            const start = i * sliceDeg;
            const end = (i + 1) * sliceDeg;
            const fill = SLICE_COLORS[i % SLICE_COLORS.length];
            return (
              <path
                key={item.id}
                d={arcPath(cx, cy, R, start, end)}
                fill={fill}
                stroke="white"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {items.map((_, i) => {
            const a = i * sliceDeg;
            const [x1, y1] = polar(cx, cy, R, a);
            const [x2, y2] = polar(cx, cy, R - 10, a);
            return (
              <line
                key={"t" + i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.85"
              />
            );
          })}
        </g>

        <g
          style={{
            opacity: showLabels ? 1 : 0,
            transition: "opacity .25s ease-out",
            pointerEvents: "none",
          }}
        >
          {items.map((item, i) => {
            // 당첨 칸은 방사형 라벨 대신 아래의 가로 배지로 그린다.
            if (isDecided && i === winnerIndex) return null;
            const localMid = i * sliceDeg + sliceDeg / 2;
            const screenMid = localMid + rotation;
            const number = String(i + 1).padStart(2, "0");
            const label = fitWheelLabel(item.name);
            // 칸 중앙 각도로 돌린 좌표계: +x 가 허브에서 테두리로 향한다. 왼쪽 반원은 띠 중앙을 축으로
            // 한 번 더 돌려 화면에서 왼→오로 읽히게 한다. 번호가 항상 허브 쪽에 오도록 그때는 순서를 바꾼다.
            const flipped = isLabelFlipped(screenMid);
            const numberSpan = (
              <tspan fontFamily="var(--font-mono)" fontSize="9" fontWeight="500" fill="oklch(0.30 0.02 70 / 0.55)" letterSpacing="0.12em">
                {number}
              </tspan>
            );
            return (
              <g key={"l" + item.id} transform={`translate(${cx} ${cy}) rotate(${screenMid - 90})`}>
                <text
                  x={labelBandMid}
                  y="0"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={flipped ? `rotate(180 ${labelBandMid} 0)` : undefined}
                  fontFamily="var(--font-sans)"
                  fontSize="13"
                  fontWeight={600}
                  fill="oklch(0.20 0.02 70)"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {flipped ? (
                    <>
                      <tspan>{label}</tspan>
                      <tspan dx={5}>{number}</tspan>
                    </>
                  ) : (
                    <>
                      {numberSpan}
                      <tspan dx={5}>{label}</tspan>
                    </>
                  )}
                </text>
              </g>
            );
          })}
          {/* 배지는 방사형 라벨을 전부 그린 뒤에 한 번 그린다 — map 안에서 그리면 뒤 인덱스의 이웃 라벨이
              배지 위에 얹혀 당첨 이름의 끝 글자를 가로지른다. */}
          {isDecided && hasWinner && (() => {
            const winner = items[winnerIndex];
            const screenMid = winnerIndex * sliceDeg + sliceDeg / 2 + rotation;
            const [lx, ly] = polar(cx, cy, labelR, screenMid);
            const winnerLabel = fitWheelLabel(winner.name, WHEEL_WINNER_LABEL_MAX_CODE_POINTS);
            // 배지 폭은 글자 수 어림(한 글자 약 18)이다. 코드포인트로 세야 이모지 이름이 두 배로 넓어지지 않는다.
            const winnerLen = Array.from(winnerLabel).length;
            return (
              <g transform={`translate(${lx} ${ly})`}>
                <rect
                  x={-Math.max(34, winnerLen * 9 + 8)}
                  y={-16}
                  width={Math.max(68, winnerLen * 18 + 16)}
                  height={34}
                  rx={8}
                  fill="white"
                  stroke="var(--ink)"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="-4"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fontWeight="500"
                  fill="var(--accent-ink)"
                  letterSpacing="0.12em"
                >
                  {String(winnerIndex + 1).padStart(2, "0")}
                </text>
                <text
                  x="0"
                  y="12"
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fontSize="15"
                  fontWeight={700}
                  fill="oklch(0.20 0.02 70)"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {winnerLabel}
                </text>
              </g>
            );
          })()}
        </g>

        {phase === "spinning" && (
          <g pointerEvents="none">
            {[0, 60, 120, 180, 240, 300].map((a) => {
              const [x1, y1] = polar(cx, cy, R - 18, a);
              const [x2, y2] = polar(cx, cy, R - 38, a);
              return (
                <line
                  key={a}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.7"
                >
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.5s" repeatCount="indefinite" />
                </line>
              );
            })}
          </g>
        )}

        <circle cx={cx} cy={cy} r={Rinner + 10} fill="white" stroke="oklch(0.85 0.012 70)" />
        <circle cx={cx} cy={cy} r={Rinner} fill="var(--ink)" />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fontFamily="var(--font-sans)"
          fontSize="9.5"
          fill="oklch(1 0 0 / 0.55)"
          letterSpacing="0.08em"
        >
          추첨 시각
        </text>
        <text
          x={cx}
          y={cy + 13}
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="18"
          fontWeight="600"
          fill="white"
          letterSpacing="0.01em"
        >
          {spinTimeText}
        </text>
      </svg>
    </div>
  );
}

function Pointer({ active = true }: { active?: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        // 세로 위치와 크기는 휠 460px 기준의 고정값이다. 휠이 줄면 끝이 조각 안으로 몇 px 들어가지만
        // 가리키는 방향(12시)은 같다. 같이 줄이려면 포인터를 SVG 안으로 옮겨 viewBox 단위로 그려야 한다.
        top: -2,
        // 휠 폭이 유동이라 픽셀 좌표를 쓸 수 없다. 14 는 아래 width 의 절반이다.
        left: "calc(50% - 14px)",
        width: 28,
        height: 38,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 5,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: active ? "var(--accent)" : "var(--ink-soft)",
          boxShadow: active ? "0 0 0 4px oklch(0.68 0.135 55 / 0.15)" : "none",
          marginBottom: 2,
          transition: "background .2s, box-shadow .2s",
        }}
      />
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "11px solid transparent",
          borderRight: "11px solid transparent",
          borderTop: `18px solid ${active ? "var(--ink)" : "var(--ink-soft)"}`,
          filter: "drop-shadow(0 2px 2px oklch(0.2 0.02 70 / 0.15))",
          transition: "border-color .2s",
        }}
      />
    </div>
  );
}

// 폭은 부모가 정하고 상한(maxWidth)은 호출부가 size 로 얹는다.
const outer: CSSProperties = {
  position: "relative",
  width: "100%",
  lineHeight: 0,
};

// width·height 속성을 주지 않는다 — 주면 그 픽셀로 고정돼 좁은 화면에서 카드 밖으로 잘린다.
const fluidSvg: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
};
