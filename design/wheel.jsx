// wheel.jsx — the roulette wheel.
//
// Architecture
// ────────────
// Slices live inside a single rotating <g> driven by a CSS transition on
// `transform`. Labels are NOT inside that group — they're rendered into a
// second, *static* layer where each label's screen position is computed
// as (slice center angle + current rotation) and the text is drawn plain
// horizontal. That sidesteps the "labels go upside down when wheel stops
// at an angle" mess entirely.
//
// During the actual spin (phase === 'spinning') labels are hidden — they
// would otherwise lag the slices because React state can't keep up with
// the CSS-animated rotation. The wheel still feels alive thanks to the
// motion-blur slices; labels fade back in once the wheel settles.

const TAU = Math.PI * 2;

function polar(cx, cy, r, deg) {
  const a = (deg - 90) * (Math.PI / 180);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx, cy, r, startDeg, endDeg) {
  const [sx, sy] = polar(cx, cy, r, endDeg);
  const [ex, ey] = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey} Z`;
}

function Wheel({ items, phase, winnerIndex, onSpinComplete, size = 460 }) {
  const [rotation, setRotation] = React.useState(0);
  const [transitionMs, setTransitionMs] = React.useState(0);
  const lastSpinRef = React.useRef({ phase: null, winnerIndex: -1 });

  React.useEffect(() => {
    if (phase === "spinning" && winnerIndex >= 0 && items.length > 0) {
      const last = lastSpinRef.current;
      if (last.phase === "spinning" && last.winnerIndex === winnerIndex) return;
      lastSpinRef.current = { phase, winnerIndex };
      const sliceDeg = 360 / items.length;
      const targetOffset = -(sliceDeg * winnerIndex + sliceDeg / 2);
      const jitter = (Math.random() - 0.5) * sliceDeg * 0.6;
      const target = 6 * 360 + targetOffset + jitter;
      setTransitionMs(4800);
      requestAnimationFrame(() => requestAnimationFrame(() => setRotation(target)));
      const t = setTimeout(() => onSpinComplete && onSpinComplete(), 4900);
      return () => clearTimeout(t);
    }
    if (phase === "decided" && winnerIndex >= 0 && items.length > 0) {
      const sliceDeg = 360 / items.length;
      const target = -(sliceDeg * winnerIndex + sliceDeg / 2);
      setTransitionMs(0);
      setRotation(target);
      lastSpinRef.current = { phase: "decided", winnerIndex };
    }
    if (phase === "idle" || phase === "reset") {
      setTransitionMs(0);
      setRotation(0);
      lastSpinRef.current = { phase, winnerIndex: -1 };
    }
  }, [phase, winnerIndex, items.length, onSpinComplete]);

  const cx = size / 2, cy = size / 2;
  const R       = size / 2 - 30;
  const Rinner  = 56;
  const labelR  = R * 0.62;
  const sliceDeg = items.length > 0 ? 360 / items.length : 0;
  const showLabels = phase !== "spinning" && items.length > 0;
  const isDecided = phase === "decided";

  // Empty state
  if (items.length === 0) {
    return (
      <div style={wheelStyles.outer}>
        <Pointer size={size} active={false} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
          <circle cx={cx} cy={cy} r={R + 8}    fill="white" stroke="oklch(0.85 0.012 70)" />
          <circle cx={cx} cy={cy} r={R}        fill="oklch(0.965 0.006 80)" stroke="var(--line-soft)" strokeDasharray="3 4" />
          <circle cx={cx} cy={cy} r={Rinner+8} fill="white" stroke="oklch(0.85 0.012 70)" />
          <circle cx={cx} cy={cy} r={Rinner}   fill="var(--bg-soft)" stroke="var(--line)" />
          <text x={cx} y={cy - 2}  textAnchor="middle" fontFamily="var(--font-sans)" fontSize="13" fontWeight="600" fill="var(--muted)">메뉴 없음</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)" letterSpacing="0.06em">ADD A MENU</text>
        </svg>
      </div>
    );
  }

  return (
    <div style={wheelStyles.outer}>
      <Pointer size={size} active={phase === "spinning" || phase === "decided"} />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <defs>
          <filter id="wheel-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="oklch(0.2 0.02 70)" floodOpacity="0.10" />
          </filter>
        </defs>

        {/* outer chrome ring (static) */}
        <g filter="url(#wheel-shadow)">
          <circle cx={cx} cy={cy} r={R + 10} fill="white" stroke="oklch(0.85 0.012 70)" strokeWidth="1" />
        </g>
        <circle cx={cx} cy={cy} r={R + 4} fill="none" stroke="oklch(0.93 0.008 70)" />

        {/* rotating layer: slices only */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform: `rotate(${rotation}deg)`,
            transition: transitionMs > 0
              ? `transform ${transitionMs}ms cubic-bezier(0.16, 1, 0.18, 1)`
              : "none",
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
          {/* tiny tick marks at slice boundaries on the inner edge */}
          {items.map((_, i) => {
            const a = i * sliceDeg;
            const [x1, y1] = polar(cx, cy, R, a);
            const [x2, y2] = polar(cx, cy, R - 10, a);
            return (
              <line key={"t" + i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
            );
          })}
        </g>

        {/* static label layer — positions are computed with the current
            rotation folded in, so each label sits at the right place on
            the rotated wheel while being drawn HORIZONTAL in screen space. */}
        <g style={{
          opacity: showLabels ? 1 : 0,
          transition: "opacity .25s ease-out",
          pointerEvents: "none",
        }}>
          {items.map((item, i) => {
            const localMid = i * sliceDeg + sliceDeg / 2;
            // Slices rotate by `rotation`. To find where this label's slice
            // sits on screen, add the rotation.
            const screenMid = localMid + rotation;
            const [lx, ly] = polar(cx, cy, labelR, screenMid);
            const isWinner = isDecided && i === winnerIndex;
            return (
              <g key={"l" + item.id} transform={`translate(${lx} ${ly})`}>
                {isWinner && (
                  <rect
                    x={-Math.max(34, item.name.length * 9 + 8)}
                    y={-16}
                    width={Math.max(68, item.name.length * 18 + 16)}
                    height={34}
                    rx={8}
                    fill="white"
                    stroke="var(--ink)"
                    strokeWidth="1.5"
                  />
                )}
                <text
                  x="0" y="-4"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize="9"
                  fontWeight="500"
                  fill={isWinner ? "var(--accent-ink)" : "oklch(0.30 0.02 70 / 0.55)"}
                  letterSpacing="0.12em"
                >
                  {String(i + 1).padStart(2, "0")}
                </text>
                <text
                  x="0" y="12"
                  textAnchor="middle"
                  fontFamily="var(--font-sans)"
                  fontSize={isWinner ? "15" : "14"}
                  fontWeight={isWinner ? 700 : 600}
                  fill="oklch(0.20 0.02 70)"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {item.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* spinning state overlay — sparse motion lines */}
        {phase === "spinning" && (
          <g pointerEvents="none">
            {[0, 60, 120, 180, 240, 300].map((a) => {
              const [x1, y1] = polar(cx, cy, R - 18, a);
              const [x2, y2] = polar(cx, cy, R - 38, a);
              return (
                <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7">
                  <animate attributeName="opacity" values="0.7;0.2;0.7" dur="0.5s" repeatCount="indefinite" />
                </line>
              );
            })}
          </g>
        )}

        {/* static center hub — never rotates */}
        <circle cx={cx} cy={cy} r={Rinner + 10} fill="white" stroke="oklch(0.85 0.012 70)" />
        <circle cx={cx} cy={cy} r={Rinner}     fill="var(--ink)" />
        <text x={cx} y={cy - 6}  textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9"  fill="oklch(1 0 0 / 0.55)" letterSpacing="0.16em">SPIN AT</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="18" fontWeight="600" fill="white" letterSpacing="0.01em">11:55</text>
      </svg>
    </div>
  );
}

function Pointer({ size, active = true }) {
  const left = size / 2 - 14;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: -2,
        left,
        width: 28,
        height: 38,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        zIndex: 5,
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: active ? "var(--accent)" : "var(--ink-soft)",
        boxShadow: active ? "0 0 0 4px oklch(0.68 0.135 55 / 0.15)" : "none",
        marginBottom: 2,
        transition: "background .2s, box-shadow .2s",
      }} />
      <div style={{
        width: 0, height: 0,
        borderLeft: "11px solid transparent",
        borderRight: "11px solid transparent",
        borderTop: `18px solid ${active ? "var(--ink)" : "var(--ink-soft)"}`,
        filter: "drop-shadow(0 2px 2px oklch(0.2 0.02 70 / 0.15))",
        transition: "border-color .2s",
      }} />
    </div>
  );
}

const wheelStyles = {
  outer: {
    position: "relative",
    display: "inline-block",
    lineHeight: 0,
  },
};

Object.assign(window, { Wheel });
