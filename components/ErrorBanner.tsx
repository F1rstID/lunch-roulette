"use client";

import type { CSSProperties } from "react";

type Props = {
  message: string | null;
  // 콜백 prop 은 ~Action 접미사 — Next 클라이언트 경계 직렬화 lint 규약.
  onCloseAction: () => void;
};

// message 가 null 이면 아무것도 렌더하지 않는다. 호출부마다 `{err && (...)}` 조건을 반복하지 않도록
// "에러 없음" 상태를 배너가 직접 흡수한다.
// 문자열은 호출부가 조립해서 넘긴다 — 이 컴포넌트는 원시 에러 객체를 알지 못하므로 details·hint 가 샐 경로가 없다.
export function ErrorBanner({ message, onCloseAction }: Props) {
  if (!message) return null;

  return (
    <div role="alert" style={s.wrap}>
      <span style={s.message}>{message}</span>
      <button type="button" onClick={onCloseAction} className="l-tap" style={s.close} aria-label="닫기">
        ×
      </button>
    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    padding: "10px 14px",
    border: "1px solid var(--red)",
    borderRadius: "var(--radius)",
    background: "var(--panel)",
    color: "var(--red)",
    fontSize: 13,
  },
  // 메시지에는 매장명과 서버 문구가 들어간다. 줄어들 수 있어야 긴 한 단어가 닫기 버튼을 화면 밖으로 밀지 않는다.
  message: { minWidth: 0 },
  close: {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 4px",
  },
} satisfies Record<string, CSSProperties>;
