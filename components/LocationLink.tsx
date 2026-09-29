"use client";

// 매장의 위치를 그리는 표시 조각 한 벌. 링크인지 아닌지의 판정은 parseLocationLink 가 끝내고 여기서는
// 값이 있으면 앵커, 없으면 텍스트라는 두 갈래만 그린다 — 판정이 화면에 남으면 테스트되지 않는다.
// 프로토콜 화이트리스트(http:·https:)가 javascript:·data: 링크를 막는 유일한 지점이고, 그 보호를 결과
// 화면과 매장 탭이 같은 구현으로 받게 하려고 한 벌로 뽑았다.
// 새 탭으로 여는 속성과 opener 차단 속성을 반드시 함께 다는 이유: 새 창이 원래 탭의 위치를 바꿀 수 있고,
// 위치 문자열은 다른 사용자가 넣은 값이다. 둘 중 하나만 남으면 그 탈취 경로가 그대로 열린다.
// 감싸는 컨테이너는 호출부가 갖는다 — 두 화면의 레이아웃이 다르다.

import type { CSSProperties } from "react";
import { parseLocationLink } from "@/lib/restaurants";

export function LocationLink({ location }: { location: string | null }) {
  // 빈 값에 null 을 돌려주는 이유: 호출부가 "위치가 있으면" 조건을 두 벌로 갖지 않게 한다.
  if (location === null || location.trim().length === 0) return null;

  const link = parseLocationLink(location);

  return link ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" style={s.link}>
      {link.host}
    </a>
  ) : (
    <span>{location}</span>
  );
}

const s = {
  link: { color: "var(--accent-ink)" },
} satisfies Record<string, CSSProperties>;
