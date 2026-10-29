// lib/lunchDay.ts 의 판단 계약을 고정한다 — 오늘 갈 곳 · 다음 식당 · 방문 요약 · 이번 주 제외 맵 · 주간 상태 리듀서 ·
// 지도 링크 · "다른 매장" 이름 검증. 목적지·제외의 규칙 자체는 _shared/cooldown.ts 가 정하고(그쪽 spec 이 든다),
// 여기서 묻는 것은 그 규칙을 화면이 쓰는 모양으로 옮긴 결과다 — 이름 스냅샷 우선·순위 번호·배지 사유·세대 번호.
// 행 타입은 `import type` 으로만 가져온다 — 트랜스파일에서 지워져 supabase 클라이언트가 로드되지 않는다.

import { describe, it, expect } from "vitest";
import type { LunchDayRow, ResultRow, WeekWinnerRow } from "@/lib/supabase/client";
import {
  INITIAL_LUNCH_WEEK_STATE,
  WEEKDAYS,
  destinationOf,
  exclusionBadge,
  weekdayLabel,
  lunchWeekReducer,
  mapHref,
  nextDestination,
  parseOtherVisitName,
  visitSummary,
  weeklyExclusionMap,
} from "@/lib/lunchDay";

const SPUN_AT = "2026-10-27T02:55:00.000Z";
const BEFORE_SPIN = "2026-10-27T02:40:00.000Z";
const AFTER_SPIN = "2026-10-27T03:10:00.000Z";

const RANKING = [
  { restaurant_id: "r1", name: "김밥천국" },
  { restaurant_id: "r2", name: "샐러드바" },
  { restaurant_id: "r3", name: "국밥집" },
];

const RESULT: ResultRow = {
  id: "res-1",
  date: "2026-10-27",
  menu: "김밥천국",
  candidates: [],
  spun_at: SPUN_AT,
  restaurant_id: "r1",
  ranking: RANKING,
};

function day(over: Partial<LunchDayRow> = {}): LunchDayRow {
  return {
    date: "2026-10-27",
    destination_id: null,
    destination_name: null,
    destination_set_at: null,
    visit_status: "unknown",
    visited_id: null,
    visited_name: null,
    visited_at: null,
    updated_at: AFTER_SPIN,
    ...over,
  };
}

describe("DEST-01 — destinationOf: 오늘 갈 곳의 id·이름·순위", () => {
  it("결과가 없으면 목적지도 없다 (#1)", () => {
    expect(destinationOf(null, null)).toBeNull();
  });

  it("기록 행이 없으면 1순위(당첨)가 목적지다 (#2)", () => {
    expect(destinationOf(RESULT, null)).toEqual({ id: "r1", name: "김밥천국", rank: 1 });
  });

  it("추첨 뒤에 2순위로 바꿨으면 그 매장이고 이름은 기록의 스냅샷이다 (#3)", () => {
    const d = day({ destination_id: "r2", destination_name: "샐러드바(옛 이름)", destination_set_at: AFTER_SPIN });
    expect(destinationOf(RESULT, d)).toEqual({ id: "r2", name: "샐러드바(옛 이름)", rank: 2 });
  });

  it("추첨(다시 돌리기) 전에 바꾼 목적지는 stale 이라 1순위로 돌아간다 (#4)", () => {
    const d = day({ destination_id: "r2", destination_name: "샐러드바", destination_set_at: BEFORE_SPIN });
    expect(destinationOf(RESULT, d)).toEqual({ id: "r1", name: "김밥천국", rank: 1 });
  });

  it("되돌리기(destination_id null)는 1순위다 (#5)", () => {
    expect(destinationOf(RESULT, day({ destination_set_at: AFTER_SPIN }))).toEqual({
      id: "r1",
      name: "김밥천국",
      rank: 1,
    });
  });

  it("순위 밖 매장을 목적지로 고른 행은 순위가 없고 이름은 스냅샷이다 (#6)", () => {
    const d = day({ destination_id: "r9", destination_name: "새로 담은 집", destination_set_at: AFTER_SPIN });
    expect(destinationOf(RESULT, d)).toEqual({ id: "r9", name: "새로 담은 집", rank: null });
  });

  it("스냅샷 이름이 비면 순위 목록의 이름으로, 그것도 없으면 당첨 이름으로 채운다 (#7)", () => {
    const d = day({ destination_id: "r3", destination_name: null, destination_set_at: AFTER_SPIN });
    expect(destinationOf(RESULT, d)?.name).toBe("국밥집");
    const noRanking: ResultRow = { ...RESULT, ranking: null };
    expect(destinationOf(noRanking, d)?.name).toBe("김밥천국");
  });

  it("0006 이전 행(ranking null)도 당첨은 1순위다 (#8)", () => {
    expect(destinationOf({ ...RESULT, ranking: null }, null)).toEqual({ id: "r1", name: "김밥천국", rank: 1 });
  });

  it("당첨 매장이 지워져 restaurant_id 가 null 이어도 이름 스냅샷으로 1순위를 보인다 (#9)", () => {
    expect(destinationOf({ ...RESULT, restaurant_id: null }, null)).toEqual({ id: null, name: "김밥천국", rank: 1 });
  });
});

describe("DEST-01 — nextDestination: 웨이팅이면 순위의 다음 매장", () => {
  it("1순위에 있으면 2순위다 (#10)", () => {
    expect(nextDestination(RANKING, "r1")).toEqual({ id: "r2", name: "샐러드바" });
  });

  it("2순위에 있으면 3순위다 (#11)", () => {
    expect(nextDestination(RANKING, "r2")).toEqual({ id: "r3", name: "국밥집" });
  });

  it("마지막 순위면 다음이 없다 — 버튼을 숨긴다 (#12)", () => {
    expect(nextDestination(RANKING, "r3")).toBeNull();
  });

  it("현재 id 가 없거나 순위 밖이면 2순위다 (#13)", () => {
    expect(nextDestination(RANKING, null)).toEqual({ id: "r2", name: "샐러드바" });
    expect(nextDestination(RANKING, "r9")).toEqual({ id: "r2", name: "샐러드바" });
  });

  it("후보가 하나뿐이거나 순위가 없으면 다음이 없다 (#14)", () => {
    expect(nextDestination([RANKING[0]], "r1")).toBeNull();
    expect(nextDestination(null, "r1")).toBeNull();
  });
});

describe("VISIT-01 — visitSummary: 확인 안 됨 · 단체 점심 안 함 · 어디서 먹었나", () => {
  it("행이 없거나 unknown 이면 확인 안 됨이다 (#15)", () => {
    expect(visitSummary(null)).toEqual({ kind: "unknown" });
    expect(visitSummary(day())).toEqual({ kind: "unknown" });
  });

  it("skipped 는 단체 점심 안 함이다 (#16)", () => {
    expect(visitSummary(day({ visit_status: "skipped" }))).toEqual({ kind: "skipped" });
  });

  it("visited 는 매장 이름(스냅샷)과 함께 온다 — 카탈로그 밖 '다른 매장' 도 이름만 있다 (#17)", () => {
    expect(visitSummary(day({ visit_status: "visited", visited_id: "r2", visited_name: "샐러드바" }))).toEqual({
      kind: "visited",
      name: "샐러드바",
    });
    expect(visitSummary(day({ visit_status: "visited", visited_id: null, visited_name: "편의점" }))).toEqual({
      kind: "visited",
      name: "편의점",
    });
  });

  it("visited 인데 이름 스냅샷까지 비면 빈 문자열이다 — 화면이 라벨만 보인다 (#18)", () => {
    expect(visitSummary(day({ visit_status: "visited", visited_id: "r2" }))).toEqual({ kind: "visited", name: "" });
  });
});

const WEEK_START = "2026-10-26"; // 월
const TODAY = "2026-10-29"; // 목

function winner(date: string, id: string | null): WeekWinnerRow {
  return { date, restaurant_id: id, spun_at: `${date}T02:55:00.000Z` };
}

describe("WEEK-01 — weeklyExclusionMap: 휠에서 빠질 매장과 목록 배지의 사유", () => {
  it("월~어제의 당첨(기록 없음)이 '방문' 사유로 들어가고 날짜가 함께 온다 (#19)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-26", "r1"), winner("2026-10-27", "r2")], [], []);
    expect([...map.entries()]).toEqual([
      ["r1", { reason: "visited", date: "2026-10-26" }],
      ["r2", { reason: "visited", date: "2026-10-27" }],
    ]);
  });

  it("오늘 당첨은 넣지 않는다 — 다시 돌리기가 오늘 목적지를 다시 뽑을 수 있어야 한다 (#20)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner(TODAY, "r1")], [], []);
    expect(map.size).toBe(0);
  });

  it("창 밖(지난 주) 당첨은 넣지 않는다 (#21)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-23", "r1")], [], []);
    expect(map.size).toBe(0);
  });

  it("기록이 목적지를 바꾼 날은 바뀐 매장이, 방문 확인한 날은 실제로 간 매장이 들어간다 (#22)", () => {
    const days = [
      day({ date: "2026-10-26", destination_id: "r2", destination_set_at: "2026-10-26T03:10:00.000Z" }),
      day({ date: "2026-10-27", visit_status: "visited", visited_id: "r3" }),
    ];
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-26", "r1"), winner("2026-10-27", "r1")], days, []);
    expect([...map.keys()].sort()).toEqual(["r2", "r3"]);
  });

  it("단체 점심을 안 한 날은 아무것도 넣지 않는다 (#23)", () => {
    const days = [day({ date: "2026-10-27", visit_status: "skipped" })];
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-27", "r1")], days, []);
    expect(map.size).toBe(0);
  });

  it("같은 매장을 두 번 갔으면 먼저 간 날짜를 남긴다 (#24)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-28", "r1"), winner("2026-10-26", "r1")], [], []);
    expect(map.get("r1")).toEqual({ reason: "visited", date: "2026-10-26" });
  });

  it("이번 주 쉬기(paused_week === weekStart)는 '쉬기' 사유다 (#25)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [], [], [
      { id: "r1", paused_week: WEEK_START },
      { id: "r2", paused_week: null },
      { id: "r3", paused_week: "2026-10-19" }, // 지난 주 쉬기는 만료됐다
    ]);
    expect([...map.entries()]).toEqual([["r1", { reason: "paused" }]]);
  });

  it("쉬기와 방문이 같은 매장이면 쉬기가 이긴다 — 사람이 명시한 뜻이 표시 우선이다 (#26)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-27", "r1")], [], [{ id: "r1", paused_week: WEEK_START }]);
    expect(map.get("r1")).toEqual({ reason: "paused" });
  });

  it("월요일(weekStart === today)은 방문 제외가 없고 쉬기만 적용된다 (#27)", () => {
    const map = weeklyExclusionMap(WEEK_START, WEEK_START, [winner("2026-10-23", "r2")], [], [{ id: "r1", paused_week: WEEK_START }]);
    expect([...map.entries()]).toEqual([["r1", { reason: "paused" }]]);
  });

  it("지워진 매장의 set-null 당첨은 넣을 매장이 없다 (#28)", () => {
    const map = weeklyExclusionMap(WEEK_START, TODAY, [winner("2026-10-27", null)], [], []);
    expect(map.size).toBe(0);
  });
});

describe("DEST-01 — lunchWeekReducer: 세대 번호로 stale 응답을 버리고 재조회로 복구한다", () => {
  const REFRESHED = lunchWeekReducer(INITIAL_LUNCH_WEEK_STATE, { type: "refresh", weekStart: WEEK_START, today: TODAY });

  it("초기 상태는 빈 목록 · 로드 전 · 세대 0 · 창 없음이다 (#29)", () => {
    expect(INITIAL_LUNCH_WEEK_STATE).toEqual({
      days: [],
      winners: [],
      loaded: false,
      error: null,
      generation: 0,
      weekStart: "",
      today: "",
    });
  });

  it("refresh 는 세대를 하나 올리고 창을 기억한다 — 나머지는 그대로다 (#30)", () => {
    expect(REFRESHED).toEqual({ ...INITIAL_LUNCH_WEEK_STATE, generation: 1, weekStart: WEEK_START, today: TODAY });
  });

  it("현재 세대의 fetched 는 두 목록을 통째로 바꾸고 로드 완료다 (#31)", () => {
    const next = lunchWeekReducer(REFRESHED, {
      type: "fetched",
      generation: 1,
      days: [day()],
      winners: [winner("2026-10-27", "r1")],
      error: null,
    });
    expect(next).toEqual({ ...REFRESHED, days: [day()], winners: [winner("2026-10-27", "r1")], loaded: true, error: null });
  });

  it("다른 세대의 fetched 는 무시한다 — 늦게 온 옛 조회가 새 목록을 덮지 않는다 (#32)", () => {
    const twice = lunchWeekReducer(REFRESHED, { type: "refresh", weekStart: WEEK_START, today: TODAY });
    const next = lunchWeekReducer(twice, { type: "fetched", generation: 1, days: [day()], winners: [], error: null });
    expect(next).toBe(twice);
  });

  it("로드 뒤에 온 같은 세대의 fetched 도 받는다 — rowset 과 달리 재조회 복구가 목적이다 (#33)", () => {
    const loaded = lunchWeekReducer(REFRESHED, { type: "fetched", generation: 1, days: [day()], winners: [], error: null });
    const again = lunchWeekReducer(REFRESHED, { type: "refresh", weekStart: WEEK_START, today: TODAY });
    const refetched = lunchWeekReducer(
      { ...loaded, generation: again.generation },
      { type: "fetched", generation: 2, days: [], winners: [], error: null },
    );
    expect([refetched.days, refetched.loaded]).toEqual([[], true]);
  });

  it("fetched 의 error 는 문자열로 남고 가진 행은 유지한다 (#34)", () => {
    const loaded = lunchWeekReducer(REFRESHED, { type: "fetched", generation: 1, days: [day()], winners: [], error: null });
    const failed = lunchWeekReducer(loaded, {
      type: "fetched",
      generation: 1,
      days: [],
      winners: [],
      error: { message: "boom" },
    });
    expect([failed.error, failed.days, failed.loaded]).toEqual(["boom", [day()], true]);
  });

  it("changed 는 같은 날짜를 교체하고 새 날짜는 더한다 (#35)", () => {
    const loaded = lunchWeekReducer(REFRESHED, { type: "fetched", generation: 1, days: [day()], winners: [], error: null });
    const replaced = lunchWeekReducer(loaded, { type: "changed", row: day({ visit_status: "skipped" }) });
    expect(replaced.days).toEqual([day({ visit_status: "skipped" })]);
    const added = lunchWeekReducer(replaced, { type: "changed", row: day({ date: "2026-10-28" }) });
    expect(added.days.map((d) => d.date)).toEqual(["2026-10-27", "2026-10-28"]);
  });

  it("changed 는 오늘 행도 받는다 — 목적지 카드가 오늘 행을 본다 (#36)", () => {
    const next = lunchWeekReducer(REFRESHED, { type: "changed", row: day({ date: TODAY }) });
    expect(next.days.map((d) => d.date)).toEqual([TODAY]);
  });

  it("창 밖 날짜의 changed 는 무시한다 — 지난 주 행을 고쳐도 이번 주 목록이 바뀌지 않는다 (#37)", () => {
    expect(lunchWeekReducer(REFRESHED, { type: "changed", row: day({ date: "2026-10-23" }) })).toBe(REFRESHED);
    expect(lunchWeekReducer(REFRESHED, { type: "changed", row: day({ date: "2026-10-30" }) })).toBe(REFRESHED);
  });

  it("창을 받기 전(초기 상태)의 changed 는 무시한다 (#38)", () => {
    expect(lunchWeekReducer(INITIAL_LUNCH_WEEK_STATE, { type: "changed", row: day() })).toBe(INITIAL_LUNCH_WEEK_STATE);
  });

  it("리듀서는 넘겨받은 state 를 변형하지 않는다 (#39)", () => {
    const loaded = lunchWeekReducer(REFRESHED, { type: "fetched", generation: 1, days: [day()], winners: [], error: null });
    lunchWeekReducer(loaded, { type: "changed", row: day({ date: "2026-10-28" }) });
    expect(loaded.days.length).toBe(1);
  });
});

describe("DEST-01 — mapHref: 위치가 링크면 그대로, 아니면 이름으로 지도 검색", () => {
  it("http(s) 위치는 그대로 쓴다 (#40)", () => {
    expect(mapHref("김밥천국", "https://naver.me/abc")).toBe("https://naver.me/abc");
    expect(mapHref("김밥천국", "http://example.com/x")).toBe("http://example.com/x");
  });

  it("위치가 없거나 글이면 네이버 지도 이름 검색이다 (#41)", () => {
    const expected = `https://map.naver.com/p/search/${encodeURIComponent("김밥천국")}`;
    expect(mapHref("김밥천국", null)).toBe(expected);
    expect(mapHref("김밥천국", "2층 안쪽")).toBe(expected);
  });

  it("javascript: 같은 스킴은 링크로 보지 않는다 — LocationLink 와 같은 화이트리스트 (#42)", () => {
    expect(mapHref("김밥천국", "javascript:alert(1)")).toBe(
      `https://map.naver.com/p/search/${encodeURIComponent("김밥천국")}`,
    );
  });

  it("이름의 앞뒤 공백은 떼고 검색한다 (#43)", () => {
    expect(mapHref("  김밥천국 ", null)).toBe(`https://map.naver.com/p/search/${encodeURIComponent("김밥천국")}`);
  });
});

describe("VISIT-01 — parseOtherVisitName: 카탈로그 밖 매장 이름은 식별자라 자르지 않고 거부한다", () => {
  it("빈 입력·공백은 실패다 (#44)", () => {
    expect(parseOtherVisitName("").ok).toBe(false);
    expect(parseOtherVisitName("   ").ok).toBe(false);
  });

  it("24자까지만 받는다 — 25자는 실패이고 메시지가 상한을 말한다 (#45)", () => {
    expect(parseOtherVisitName("가".repeat(24))).toEqual({ ok: true, name: "가".repeat(24) });
    const failed = parseOtherVisitName("가".repeat(25));
    expect(failed.ok).toBe(false);
    expect(failed.ok === false && failed.message).toMatch(/24자/);
  });

  it("줄바꿈이 섞이면 실패다 (#46)", () => {
    expect(parseOtherVisitName("김밥\n천국").ok).toBe(false);
  });

  it("정상 입력은 앞뒤 공백을 뗀 이름이다 (#47)", () => {
    expect(parseOtherVisitName(" 편의점 ")).toEqual({ ok: true, name: "편의점" });
  });

  it("이모지처럼 두 코드 유닛인 글자도 한 글자로 센다 (#48)", () => {
    expect(parseOtherVisitName("😀".repeat(24)).ok).toBe(true);
    expect(parseOtherVisitName("😀".repeat(25)).ok).toBe(false);
  });
});

describe("WEEKDAYS — 요일 라벨은 kstParts().weekday(0=일…6=토)와 같은 자리다", () => {
  it("일·월·화·수·목·금·토 7개다 (#49)", () => {
    expect([...WEEKDAYS]).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
  });

  it("weekdayLabel 은 날짜 키의 요일을 타임존과 무관하게 돌려준다 (#50)", () => {
    expect(["2026-10-26", "2026-10-27", "2026-11-01", "2026-01-01"].map(weekdayLabel)).toEqual(["월", "화", "일", "목"]);
  });

  it("exclusionBadge 는 방문이면 '화 방문', 쉬기면 '이번 주 쉬기' 다 (#51)", () => {
    expect(exclusionBadge({ reason: "visited", date: "2026-10-27" })).toBe("화 방문");
    expect(exclusionBadge({ reason: "paused" })).toBe("이번 주 쉬기");
  });
});
