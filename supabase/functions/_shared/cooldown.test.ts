// supabase/functions/_shared/cooldown.ts 의 주간 제외 계약을 고정한다. 창 산술·목적지 규칙·2단 폴백은
// Edge Function 과 클라이언트가 같은 함수로 판정해야 "휠에서 빠진 매장이 서버에서 뽑히는 날" 이 없다 —
// 그 공통 정의처가 이 파일이고, DB 조회(.gte/.lt)는 검사 대상이 아니다(순수 함수만 받는다).
// 날짜는 전부 "yyyy-mm-dd" 문자열로만 다룬다. 기대값에 Date 객체를 쓰지 않는 이유: results.date 와 비교되는
// 것이 문자열이고, Date 로 적으면 이 spec 이 실행 환경의 타임존을 다시 끌어들인다.
// 요일 숫자는 kst.ts 의 kstParts().weekday 와 같은 0=일 … 6=토 다.

import { describe, it, expect } from "vitest";
import * as cooldown from "./cooldown";
import {
  applyWeeklyExclusions,
  dayExclusionId,
  effectiveDestinationId,
  weekStartOf,
  weeklyWindowStart,
} from "./cooldown";

const SUN = 0;
const MON = 1;
const TUE = 2;
const THU = 4;
const SAT = 6;

describe("WEEK-02 — 주 시작(월요일) 산술은 요일 숫자만 받고 타임존에 의존하지 않는다", () => {
  it("월요일은 자기 자신이 주 시작이다 (#1)", () => {
    expect(weekStartOf("2026-10-26", MON)).toBe("2026-10-26");
  });

  it("화요일의 주 시작은 하루 전이다 (#2)", () => {
    expect(weekStartOf("2026-10-27", TUE)).toBe("2026-10-26");
  });

  it("일요일은 그 주의 끝이라 6일 전이 월요일이다 (#3)", () => {
    expect(weekStartOf("2026-11-01", SUN)).toBe("2026-10-26");
  });

  it("토요일의 주 시작은 5일 전이다 (#4)", () => {
    expect(weekStartOf("2026-10-31", SAT)).toBe("2026-10-26");
  });

  it("연초 목요일의 월요일은 전년 12월로 넘어간다 (#5)", () => {
    expect(weekStartOf("2026-01-01", THU)).toBe("2025-12-29");
  });

  it("평년 3월 1일(일)의 월요일은 2월 23일이다 (#6)", () => {
    expect(weekStartOf("2026-03-01", SUN)).toBe("2026-02-23");
  });

  it("윤년 3월 3일(일)의 월요일은 2월 26일이다 — 29일을 건너 센다 (#7)", () => {
    expect(weekStartOf("2024-03-03", SUN)).toBe("2024-02-26");
  });

  // 오염 입력은 "창 없음" 으로 착지시킨다. 날짜꼴이 아닌 문자열을 돌려주면 Edge 의 .gte("date", …) 가
  // PostgREST date 파싱 에러로 500 을 내고 그날 추첨이 통째로 빠진다 — 필터를 끄는 쪽이 훨씬 싼 실패다.
  it("날짜꼴이 아닌 입력은 null 이다 (#8)", () => {
    expect(weekStartOf("", TUE)).toBeNull();
    expect(weekStartOf("2026/10/27", TUE)).toBeNull();
  });

  it("요일 범위(0..6) 밖이나 정수가 아닌 요일도 null 이다 (#9)", () => {
    expect(weekStartOf("2026-10-27", 7)).toBeNull();
    expect(weekStartOf("2026-10-27", -1)).toBeNull();
    expect(weekStartOf("2026-10-27", Number.NaN)).toBeNull();
    expect(weekStartOf("2026-10-27", 1.5)).toBeNull();
  });
});

describe("WEEK-01 — 제외 창은 [weekStart, today) 이고 월요일에는 창이 없다", () => {
  it("월요일은 창이 없다 — 지난 주 기록은 전부 해제된다 (#10)", () => {
    expect(weeklyWindowStart("2026-10-26", MON)).toBeNull();
  });

  it("화~일은 weekStartOf 와 같은 월요일이다 (#11)", () => {
    expect(weeklyWindowStart("2026-10-27", TUE)).toBe("2026-10-26");
    expect(weeklyWindowStart("2026-11-01", SUN)).toBe("2026-10-26");
  });

  it("오염 입력은 weekStartOf 와 같이 null 이다 (#12)", () => {
    expect(weeklyWindowStart("", TUE)).toBeNull();
  });
});

const WINNER = { restaurant_id: "r1", spun_at: "2026-10-27T02:55:00.000Z" };

describe("DEST-01 — 오늘 갈 곳은 lunch_days 가 결과 행보다 뒤에 쓰였을 때만 이긴다", () => {
  it("day 가 없으면 당첨(1순위)이 목적지다 (#13)", () => {
    expect(effectiveDestinationId(WINNER, null)).toBe("r1");
  });

  it("destination_id 가 null 이면(되돌리기) 당첨이다 (#14)", () => {
    expect(
      effectiveDestinationId(WINNER, { destination_id: null, destination_set_at: "2026-10-27T03:10:00.000Z" }),
    ).toBe("r1");
  });

  it("추첨 뒤에 바꾼 목적지는 그대로 쓴다 (#15)", () => {
    expect(
      effectiveDestinationId(WINNER, { destination_id: "r2", destination_set_at: "2026-10-27T03:10:00.000Z" }),
    ).toBe("r2");
  });

  // 다시 돌리기가 results 행을 덮어쓰면 spun_at 이 앞으로 간다. 그 전에 고른 목적지는 옛 순서의 것이라
  // 쓰기 없이 규칙으로 무시한다 — respin 함수가 lunch_days 를 건드리지 않아도 화면이 맞는 이유다.
  it("추첨(다시 돌리기) 전에 고른 목적지는 stale 이라 당첨으로 돌아간다 (#16)", () => {
    expect(
      effectiveDestinationId(WINNER, { destination_id: "r2", destination_set_at: "2026-10-27T02:40:00.000Z" }),
    ).toBe("r1");
  });

  it("같은 순간은 '뒤' 로 본다 — 목적지가 이긴다 (#17)", () => {
    expect(
      effectiveDestinationId(WINNER, { destination_id: "r2", destination_set_at: WINNER.spun_at }),
    ).toBe("r2");
  });

  it("destination_set_at 이 null 이면 추첨 뒤라는 증거가 없어 당첨이다 (#18)", () => {
    expect(effectiveDestinationId(WINNER, { destination_id: "r2", destination_set_at: null })).toBe("r1");
  });

  // 서버 timestamptz 는 "+00:00", 클라이언트 toISOString 은 "Z" 다. 문자열로 비교하면 "T11:50+09:00" 이
  // "T02:55Z" 보다 뒤로 읽히지만 순간으로는 5분 전이다 — 순간 비교여야 stale 판정이 맞는다.
  it("표기가 달라도 순간으로 비교한다 (#19)", () => {
    const spun = { restaurant_id: "r1", spun_at: "2026-10-27T02:55:00.000Z" };
    expect(
      effectiveDestinationId(spun, { destination_id: "r2", destination_set_at: "2026-10-27T11:50:00.000+09:00" }),
    ).toBe("r1");
    expect(
      effectiveDestinationId(spun, { destination_id: "r2", destination_set_at: "2026-10-27T12:00:00.000+09:00" }),
    ).toBe("r2");
  });

  it("파싱이 안 되는 시각은 문자열로 비교한다 — lib/candidates.ts isNewSpin 과 같은 폴백 (#20)", () => {
    expect(
      effectiveDestinationId(
        { restaurant_id: "r1", spun_at: "b" },
        { destination_id: "r2", destination_set_at: "a" },
      ),
    ).toBe("r1");
    expect(
      effectiveDestinationId(
        { restaurant_id: "r1", spun_at: "a" },
        { destination_id: "r2", destination_set_at: "b" },
      ),
    ).toBe("r2");
  });

  it("당첨 매장이 지워져 restaurant_id 가 null 이고 day 가 없으면 null 이다 (#21)", () => {
    expect(effectiveDestinationId({ restaurant_id: null, spun_at: WINNER.spun_at }, null)).toBeNull();
  });
});

describe("WEEK-01 — 하루의 제외 id 는 방문 > 목적지 > 당첨 순이다", () => {
  const AFTER = "2026-10-27T03:10:00.000Z";

  it("단체 점심을 안 한 날(skipped)은 아무것도 빼지 않는다 (#22)", () => {
    expect(
      dayExclusionId(WINNER, {
        destination_id: "r2",
        destination_set_at: AFTER,
        visit_status: "skipped",
        visited_id: null,
      }),
    ).toBeNull();
  });

  it("방문 확인된 날은 목적지가 아니라 실제로 간 매장을 뺀다 (#23)", () => {
    expect(
      dayExclusionId(WINNER, {
        destination_id: "r2",
        destination_set_at: AFTER,
        visit_status: "visited",
        visited_id: "r3",
      }),
    ).toBe("r3");
  });

  it("카탈로그 밖 '다른 매장' 방문(visited_id null)은 뺄 매장이 없다 (#24)", () => {
    expect(
      dayExclusionId(WINNER, {
        destination_id: "r2",
        destination_set_at: AFTER,
        visit_status: "visited",
        visited_id: null,
      }),
    ).toBeNull();
  });

  // 사용자 결정: 아무도 안 누른 날은 1순위(또는 바꾼 목적지)에 간 것으로 친다.
  it("확인 안 된 날(unknown)은 목적지 규칙을 따른다 (#25)", () => {
    expect(
      dayExclusionId(WINNER, {
        destination_id: "r2",
        destination_set_at: AFTER,
        visit_status: "unknown",
        visited_id: null,
      }),
    ).toBe("r2");
  });

  it("day 가 없으면 당첨 매장이다 (#26)", () => {
    expect(dayExclusionId(WINNER, null)).toBe("r1");
  });
});

type C = { restaurant_id: string };
const c = (...ids: string[]): C[] => ids.map((restaurant_id) => ({ restaurant_id }));

describe("WEEK-02 — 2단 폴백: 쉬기는 되살리지 않고, 이번 주 방문은 전멸 때 되돌린다", () => {
  it("후보가 0개면 뺄 것도 폴백할 것도 없다 (#27)", () => {
    expect(applyWeeklyExclusions<C>([], { pausedIds: ["r1"], visitedIds: ["r1"] })).toEqual({
      picked: [],
      allPaused: false,
      fellBack: false,
    });
  });

  it("쉬기도 방문도 없으면 전체가 pool 이다 (#28)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2"), { pausedIds: [], visitedIds: [] })).toEqual({
      picked: c("r1", "r2"),
      allPaused: false,
      fellBack: false,
    });
  });

  // Codex 경고: 쉬기 매장을 몰래 되살리면 "이번 주 쉬기" 가 거짓이 된다. 결과 행을 만들지 않는 쪽이 맞다.
  it("전원이 쉬기면 allPaused 이고 picked 는 비어 있다 — 되살리지 않는다 (#29)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2"), { pausedIds: ["r1", "r2"], visitedIds: [] })).toEqual({
      picked: [],
      allPaused: true,
      fellBack: false,
    });
  });

  it("쉬기 일부는 그 매장만 빠진다 (#30)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2", "r3"), { pausedIds: ["r2"], visitedIds: [] })).toEqual({
      picked: c("r1", "r3"),
      allPaused: false,
      fellBack: false,
    });
  });

  it("이번 주 전부 가 봤으면 쉬기만 뺀 pool 로 되돌리고 fellBack 을 알린다 (#31)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2", "r3"), { pausedIds: ["r3"], visitedIds: ["r1", "r2"] })).toEqual({
      picked: c("r1", "r2"),
      allPaused: false,
      fellBack: true,
    });
  });

  it("방문 일부는 그 매장만 빠진다 (#32)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2", "r3"), { pausedIds: [], visitedIds: ["r1"] })).toEqual({
      picked: c("r2", "r3"),
      allPaused: false,
      fellBack: false,
    });
  });

  it("쉬기와 방문이 같은 매장이면 한 번만 빠지고 폴백이 아니다 (#33)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2"), { pausedIds: ["r1"], visitedIds: ["r1"] })).toEqual({
      picked: c("r2"),
      allPaused: false,
      fellBack: false,
    });
  });

  it("null id 는 무시한다 — 지워진 매장의 set-null 행이다 (#34)", () => {
    expect(applyWeeklyExclusions(c("r1", "r2"), { pausedIds: [null], visitedIds: [null, "r1"] })).toEqual({
      picked: c("r2"),
      allPaused: false,
      fellBack: false,
    });
  });

  it("입력 배열을 바꾸지 않는다 (#35)", () => {
    const input = c("r1", "r2");
    applyWeeklyExclusions(input, { pausedIds: ["r1"], visitedIds: ["r2"] });
    expect(input).toEqual(c("r1", "r2"));
  });
});

describe("모듈 형태 — 최근 N일 쿨다운은 사라졌다", () => {
  it("export 는 주간 규칙 5개뿐이고 applyCooldown·cooldownWindowStart 는 없다 (#36)", () => {
    expect(Object.keys(cooldown).sort()).toEqual(
      ["applyWeeklyExclusions", "dayExclusionId", "effectiveDestinationId", "weekStartOf", "weeklyWindowStart"],
    );
  });
});
