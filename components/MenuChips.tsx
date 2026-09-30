"use client";

// 매장의 메뉴를 칩으로 그리는 표시 조각 한 벌. 결과 화면과 매장 탭이 같은 구현을 쓴다 — 접는 임계가 두
// 곳에서 갈리면 같은 매장이 화면마다 다르게 보이고, 어느 쪽이 맞는지 화면만 보고는 알 수 없다.
// 넘치는 메뉴를 접는 이유: 메뉴가 스무 개인 매장 하나가 목록을 밀어내면 훑어보기라는 목적이 깨진다.
// 전체 목록은 칩 툴팁에서 본다.
// 이 컴포넌트는 데이터 클라이언트를 한 번도 부르지 않는다 — 받은 배열만 그린다.

import type { CSSProperties } from "react";
import { joinMenus } from "@/lib/restaurants";

// 행에 그대로 펼칠 메뉴 칩 개수. 넘치면 "+n" 한 칸으로 접는다.
const MENU_CHIP_LIMIT = 4;

export function MenuChips({ menus }: { menus: string[] }) {
  // 빈 배열에 null 을 돌려주는 이유: 호출부가 "메뉴가 있으면" 조건을 두 벌로 갖지 않게 한다.
  if (menus.length === 0) return null;

  const shown = menus.slice(0, MENU_CHIP_LIMIT);
  const hiddenCount = menus.length - shown.length;
  const allMenus = joinMenus(menus);

  return (
    <div style={s.chips}>
      {/* key 에 인덱스를 섞는 이유: UI 경로는 parseMenuInput 이 중복을 지우지만 DB check 는 배열 안
          중복을 막지 않는다(0005:26). RLS 가 열려 있어 PostgREST 직접 쓰기로 ["김밥","김밥"] 이
          들어오면 이름만으로는 key 가 겹쳐 칩 하나가 사라진다. */}
      {shown.map((menu, i) => (
        <span key={`${menu}-${i}`} title={allMenus} style={s.chip}>
          {menu}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span title={allMenus} style={s.chipMore}>
          {`+${hiddenCount}`}
        </span>
      )}
    </div>
  );
}

const s = {
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  chip: {
    // 띄어쓰기 없는 긴 메뉴는 keep-all 아래에서 한 단어다 — 줄어들 수 있어야 칩 안에서 꺾이고,
    // 그러지 못하면 칩이 행 끝의 버튼을 덮는다.
    minWidth: 0,
    fontSize: 11.5,
    padding: "1px 7px",
    borderRadius: 999,
    background: "var(--bg-soft)",
    color: "var(--ink-soft)",
    border: "1px solid var(--line-soft)",
  },
  chipMore: {
    fontSize: 11.5,
    padding: "1px 7px",
    borderRadius: 999,
    background: "var(--panel)",
    color: "var(--muted)",
    border: "1px solid var(--line)",
  },
} satisfies Record<string, CSSProperties>;
