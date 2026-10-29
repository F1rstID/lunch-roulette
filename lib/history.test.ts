// lib/history.ts 의 기록·랭킹 계약을 고정한다 — "전환일 이후" 의 뜻(당일 포함)과 "매장 기준" 의 뜻(집계 키)이
// 페이지마다 갈리지 않도록 정의처 하나를 spec 으로 못 박는 것이 목적이다.
// 집계 키가 restaurant_id ?? menu 인 이유: id 로만 모으면 삭제된 매장(on delete set null)의 기록이 랭킹에서
// 통째로 사라지고, 이름으로만 모으면 개명한 매장이 두 줄로 갈라진다. 삭제는 그 매장의 모든 행을 한 번에 null 로
// 바꾸므로 이름 키로 다시 한 덩어리가 된다.
// 행 픽스처는 lib/history.ts 의 HistoryRow 에 묶는다 — 타입 import 는 트랜스파일에서 지워지므로 환경변수를 읽는
// supabase 클라이언트 모듈이 로드되지 않고, 그 타입에 필드가 늘면 spec 이 tsc 에서 함께 깨진다.
// 일부러 안 하는 것: 컴포넌트·페이지는 테스트하지 않는다 — 렌더 하네스가 없고, 판단을 여기로 내린 이유가 그것이다.

import { describe, it, expect } from "vitest";
import type { LunchDayRow } from "@/lib/supabase/client";
import { applyLunchDays, buildMonthGrid, buildRanking, filterSince, type HistoryRow } from "@/lib/history";

type Row = HistoryRow;

const row = (date: string, menu: string, restaurant_id: string | null = null): Row => ({
  date,
  menu,
  restaurant_id,
});

describe("filterSince", () => {
  const rows = [row("2026-09-30", "A"), row("2026-10-01", "B"), row("2026-10-02", "C")];

  it("전환일이 null 이면(로드 전·컷오버 전) 아무것도 자르지 않는다", () => {
    expect(filterSince(rows, null)).toEqual(rows);
  });

  it("전환일 당일 행은 포함된다", () => {
    expect(filterSince(rows, "2026-10-01").map((r) => r.date)).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("전환일 이전 행은 빠진다", () => {
    expect(filterSince(rows, "2026-10-03")).toEqual([]);
  });

  it("입력 순서를 바꾸지 않는다 — 정렬은 호출자의 몫이다", () => {
    const unsorted = [row("2026-10-05", "A"), row("2026-10-01", "B"), row("2026-10-03", "C")];
    expect(filterSince(unsorted, "2026-10-02").map((r) => r.date)).toEqual(["2026-10-05", "2026-10-03"]);
  });
});

describe("buildRanking", () => {
  it("같은 restaurant_id 는 스냅샷 이름이 달라도 한 줄이고, 이름은 최근 당첨일의 스냅샷이다", () => {
    const { list } = buildRanking([
      row("2026-10-01", "옛 이름", "r1"),
      row("2026-10-03", "새 이름", "r1"),
      row("2026-10-02", "옛 이름", "r1"),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ key: "r1", name: "새 이름", wins: 3, lastDate: "2026-10-03" });
  });

  it("restaurant_id 가 null 인 행(삭제된 매장)은 이름 스냅샷을 키로 모인다", () => {
    const { list } = buildRanking([row("2026-10-01", "사라진 집"), row("2026-10-02", "사라진 집")]);
    expect(list).toEqual([{ key: "사라진 집", name: "사라진 집", wins: 2, lastDate: "2026-10-02", share: 1 }]);
  });

  it("개명 뒤 삭제된 매장은 스냅샷 이름 수만큼 갈라진다 — 개명 이력이 없어 되돌릴 수 없는 한계를 고정한다", () => {
    const { list } = buildRanking([row("2026-10-01", "A"), row("2026-10-02", "A"), row("2026-10-03", "B")]);
    expect(list.map((e) => [e.key, e.wins])).toEqual([
      ["A", 2],
      ["B", 1],
    ]);
  });

  it("같은 이름으로 등록됐다 삭제된 서로 다른 매장은 이름 키로 합쳐진다 — 같은 한계의 반대 방향", () => {
    const { list } = buildRanking([row("2026-10-01", "김밥집"), row("2026-10-02", "김밥집")]);
    expect(list).toHaveLength(1);
    expect(list[0].wins).toBe(2);
  });

  it("null 키와 id 키는 이름이 같아도 별개 줄이다 — 같은 이름으로 새로 등록한 매장은 다른 매장이다", () => {
    const { list } = buildRanking([row("2026-10-01", "김밥집"), row("2026-10-02", "김밥집", "r9")]);
    expect(list.map((e) => e.key).sort()).toEqual(["r9", "김밥집"]);
  });

  it("당첨 횟수 내림차순으로 정렬한다", () => {
    const { list } = buildRanking([
      row("2026-10-01", "A", "a"),
      row("2026-10-02", "B", "b"),
      row("2026-10-03", "B", "b"),
    ]);
    expect(list.map((e) => e.key)).toEqual(["b", "a"]);
  });

  it("횟수가 같으면 최근 당첨일이 늦은 쪽이 앞이다", () => {
    const { list } = buildRanking([row("2026-10-01", "A", "a"), row("2026-10-02", "B", "b")]);
    expect(list.map((e) => e.key)).toEqual(["b", "a"]);
  });

  it("횟수·최근일까지 같으면 키 오름차순이다 — 입력 순서에 기대지 않는다", () => {
    // 날짜당 결과는 한 행이라 실제로는 오지 않는 입력이지만, 비교기가 전순서임을 못 박아 둔다.
    const { list } = buildRanking([row("2026-10-01", "B", "b"), row("2026-10-01", "A", "a")]);
    expect(list.map((e) => e.key)).toEqual(["a", "b"]);
  });

  it("share 는 전체 행 대비 비율이고 total 은 행 수다", () => {
    const { list, total } = buildRanking([
      row("2026-10-01", "A", "a"),
      row("2026-10-02", "A", "a"),
      row("2026-10-03", "B", "b"),
    ]);
    expect(total).toBe(3);
    expect(list.find((e) => e.key === "a")?.share).toBeCloseTo(2 / 3);
    expect(list.find((e) => e.key === "b")?.share).toBeCloseTo(1 / 3);
  });

  it("최근 당첨일은 입력 순서와 무관하게 가장 늦은 날짜다", () => {
    const { list } = buildRanking([
      row("2026-10-05", "A", "a"),
      row("2026-10-01", "A", "a"),
      row("2026-10-03", "A", "a"),
    ]);
    expect(list[0].lastDate).toBe("2026-10-05");
  });

  it("빈 입력은 빈 목록과 total 0 이다", () => {
    expect(buildRanking([])).toEqual({ list: [], total: 0 });
  });
});

describe("buildMonthGrid", () => {
  it("항상 42칸(6주)이다", () => {
    expect(buildMonthGrid(2026, 9)).toHaveLength(42);
  });

  it("1월의 앞 패딩은 전년 12월이다", () => {
    const cells = buildMonthGrid(2026, 1);
    const first = cells[0];
    // 2026-01-01 은 목요일이라 앞에 4칸이 온다.
    expect(cells.slice(0, 4).every((c) => c.y === 2025 && c.m === 12 && c.dim)).toBe(true);
    expect(first.d).toBe(28);
  });

  it("12월의 뒤 패딩은 익년 1월이다", () => {
    const cells = buildMonthGrid(2026, 12);
    const trailing = cells.filter((c) => c.dim && c.m === 1);
    // 2026-12-01 은 화요일이라 앞 패딩 2 + 31일 = 33칸 → 뒤 패딩 9칸.
    expect(trailing).toHaveLength(9);
    expect(trailing.every((c) => c.y === 2027)).toBe(true);
    expect(trailing[0].d).toBe(1);
  });

  it("윤년 2월은 29일이다", () => {
    expect(buildMonthGrid(2028, 2).filter((c) => !c.dim)).toHaveLength(29);
  });

  it("본월 1일은 그 요일 자리에 온다(2026-09-01 화요일 → 인덱스 2)", () => {
    const cells = buildMonthGrid(2026, 9);
    expect(cells.findIndex((c) => !c.dim)).toBe(2);
    expect(cells[2]).toEqual({ y: 2026, m: 9, d: 1, dim: false });
  });

  it("본월 셀은 1일부터 말일까지 연속이고 dim 이 아니다", () => {
    const days = buildMonthGrid(2026, 9)
      .filter((c) => !c.dim)
      .map((c) => c.d);
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("31일 월의 마지막 본월 셀은 31일이다", () => {
    const own = buildMonthGrid(2026, 10).filter((c) => !c.dim);
    expect(own[own.length - 1].d).toBe(31);
  });
});

// 0007 부터 기록이 증명하는 것은 추첨이 아니라 목적지다 — 방문 확인 > 목적지 변경 > 1순위 순이고, 확인 안 된 날은
// 1순위에 간 것으로 센다(사용자 결정 2026-10-28). 우선순위 판정은 _shared/cooldown.ts 의 dayExclusionId 와 같은
// 함수라 여기서는 "이름 스냅샷·drawn*·unconfirmed·skipped 제외" 만 묻는다.
const res = (date: string, menu: string, restaurant_id: string | null = null, spun_at = `${date}T02:55:00.000Z`) => ({
  date,
  menu,
  restaurant_id,
  spun_at,
});

function day(over: Partial<LunchDayRow> & { date: string }): LunchDayRow {
  return {
    destination_id: null,
    destination_name: null,
    destination_set_at: null,
    visit_status: "unknown",
    visited_id: null,
    visited_name: null,
    visited_at: null,
    updated_at: `${over.date}T03:10:00.000Z`,
    ...over,
  };
}

describe("applyLunchDays — 기록·랭킹의 입력은 추첨이 아니라 목적지다 (HIST-04)", () => {
  it("기록이 없으면 당첨 그대로이고 확인 안 됨이다 — drawn* 도 같은 값", () => {
    expect(applyLunchDays([res("2026-10-27", "A", "r1")], [])).toEqual([
      { ...res("2026-10-27", "A", "r1"), drawnId: "r1", drawnName: "A", unconfirmed: true },
    ]);
  });

  it("추첨 뒤 바꾼 목적지가 매장이 되고 이름은 스냅샷이며 당첨은 drawn* 에 남는다", () => {
    const d = day({ date: "2026-10-27", destination_id: "r2", destination_name: "B", destination_set_at: "2026-10-27T03:10:00.000Z" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1")], [d])).toMatchObject([
      { restaurant_id: "r2", menu: "B", drawnId: "r1", drawnName: "A", unconfirmed: true },
    ]);
  });

  it("방문 확인된 날은 실제로 간 매장이고 확인됨이다", () => {
    const d = day({ date: "2026-10-27", visit_status: "visited", visited_id: "r3", visited_name: "C" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1")], [d])).toMatchObject([
      { restaurant_id: "r3", menu: "C", drawnId: "r1", unconfirmed: false },
    ]);
  });

  it("카탈로그 밖 '다른 매장' 은 id 없이 이름으로 남는다 — 랭킹은 이름 키로 센다", () => {
    const d = day({ date: "2026-10-27", visit_status: "visited", visited_id: null, visited_name: "편의점" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1")], [d])).toMatchObject([
      { restaurant_id: null, menu: "편의점", unconfirmed: false },
    ]);
  });

  it("목적지 매장이 지워진 날(id null · 이름 스냅샷)은 그 이름으로 세고 되돌리기와 구분된다", () => {
    const deleted = day({ date: "2026-10-27", destination_id: null, destination_name: "사라진 집", destination_set_at: "2026-10-27T03:10:00.000Z" });
    const reverted = day({ date: "2026-10-28", destination_id: null, destination_name: null, destination_set_at: "2026-10-28T03:10:00.000Z" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1"), res("2026-10-28", "A", "r1")], [deleted, reverted])).toMatchObject([
      { restaurant_id: null, menu: "사라진 집", drawnId: "r1", unconfirmed: true },
      { restaurant_id: "r1", menu: "A", unconfirmed: true },
    ]);
  });

  it("단체 점심을 안 한 날은 빠진다", () => {
    const d = day({ date: "2026-10-27", visit_status: "skipped" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1"), res("2026-10-28", "B", "r2")], [d]).map((e) => e.date)).toEqual([
      "2026-10-28",
    ]);
  });

  it("다시 돌리기 전에 고른 목적지(stale)는 당첨 그대로다", () => {
    const d = day({ date: "2026-10-27", destination_id: "r2", destination_name: "B", destination_set_at: "2026-10-27T02:40:00.000Z" });
    expect(applyLunchDays([res("2026-10-27", "A", "r1")], [d])).toMatchObject([{ restaurant_id: "r1", menu: "A" }]);
  });

  it("날짜가 맞지 않는 기록은 무시하고 입력 순서를 보존하며 입력을 바꾸지 않는다", () => {
    const rows = [res("2026-10-28", "B", "r2"), res("2026-10-27", "A", "r1")];
    const d = day({ date: "2026-10-30", visit_status: "visited", visited_id: "r9", visited_name: "Z" });
    const out = applyLunchDays(rows, [d]);
    expect(out.map((e) => [e.date, e.restaurant_id])).toEqual([
      ["2026-10-28", "r2"],
      ["2026-10-27", "r1"],
    ]);
    expect(rows[0].restaurant_id).toBe("r2");
  });

  it("buildRanking 과 이어 쓰면 목적지 키로 센다 — 확인 안 된 날도 1순위로 들어간다", () => {
    const days = [
      day({ date: "2026-10-27", destination_id: "r2", destination_name: "B", destination_set_at: "2026-10-27T03:10:00.000Z" }),
      day({ date: "2026-10-28", visit_status: "visited", visited_id: "r2", visited_name: "B" }),
      day({ date: "2026-10-29", visit_status: "skipped" }),
    ];
    const rows = [res("2026-10-26", "A", "r1"), res("2026-10-27", "A", "r1"), res("2026-10-28", "A", "r1"), res("2026-10-29", "A", "r1")];
    const { list, total } = buildRanking(applyLunchDays(rows, days));
    expect([total, list.map((e) => [e.key, e.wins])]).toEqual([3, [["r2", 2], ["r1", 1]]]);
  });
});
