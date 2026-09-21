// supabase/functions/_shared/cooldown.ts 의 쿨다운 계약을 고정한다. 창 산술과 폴백은 Phase 4 가 DB 조회를
// 끼워 넣기 전에 확정돼야 한다 — 조회와 섞이면 "왜 오늘 이 매장이 뽑혔는가" 를 테스트로 설명할 수 없게 된다.
// 날짜는 전부 "yyyy-mm-dd" 문자열로만 다룬다. 기대값에 Date 객체를 쓰지 않는 이유: results.date 와 비교되는
// 것이 문자열이고, Date 로 적으면 이 spec 이 실행 환경의 타임존을 다시 끌어들인다.
// DB 조회(.gte/.lt)는 검사 대상이 아니다 — applyCooldown 은 "이미 읽어 온 최근 당첨 id" 만 받는 순수 함수다.

import { describe, it, expect } from "vitest";
import { applyCooldown, cooldownWindowStart } from "./cooldown";

describe("COOLDOWN/SPIN-02 — 창 시작 날짜 산술은 타임존에 의존하지 않는다", () => {
  it("days 가 0 이면 창이 없다 — 쿨다운 끔 (#1)", () => {
    expect(cooldownWindowStart("2026-09-21", 0)).toBeNull();
  });

  it("음수 days 도 끔으로 본다 (#2)", () => {
    expect(cooldownWindowStart("2026-09-21", -3)).toBeNull();
  });

  it("평년 3월 1일의 하루 전은 2월 28일이다 (#3)", () => {
    expect(cooldownWindowStart("2026-03-01", 1)).toBe("2026-02-28");
  });

  it("윤년 3월 1일의 하루 전은 2월 29일이다 (#4)", () => {
    expect(cooldownWindowStart("2024-03-01", 1)).toBe("2024-02-29");
  });

  it("1월 1일의 하루 전은 전년 12월 31일이다 (#5)", () => {
    expect(cooldownWindowStart("2026-01-01", 1)).toBe("2025-12-31");
  });

  it("7일 창은 일주일 전 날짜에서 시작한다 (#6)", () => {
    expect(cooldownWindowStart("2026-09-21", 7)).toBe("2026-09-14");
  });

  // 아래 3건은 "오염 입력이면 창을 끈다" 는 계약이다. 날짜꼴이 아닌 문자열을 돌려주면 Phase 4 의
  // 날짜 필터가 조회 단계에서 터져 그날 추첨이 통째로 빠진다 — 필터를 끄는 쪽이 훨씬 싼 실패다.
  it("날짜꼴이 아닌 today 는 창을 만들지 않는다 (#6a)", () => {
    expect(cooldownWindowStart("", 1)).toBeNull();
  });

  it("숫자가 아닌 days 는 창을 만들지 않는다 (#6b)", () => {
    expect(cooldownWindowStart("2026-09-21", Number.NaN)).toBeNull();
  });

  it("소수 days 도 창을 만들지 않는다 — 달력 일수만 받는다 (#6c)", () => {
    expect(cooldownWindowStart("2026-09-21", 1.5)).toBeNull();
  });
});

describe("COOLDOWN/SPIN-02 — 최근 당첨 매장을 빼되 전멸시키지 않는다", () => {
  it("최근 승자가 없으면 후보가 그대로다 (#7)", () => {
    expect(applyCooldown([{ restaurant_id: "r1" }, { restaurant_id: "r2" }], [])).toEqual({
      picked: [{ restaurant_id: "r1" }, { restaurant_id: "r2" }],
      fellBack: false,
    });
  });

  it("최근 승자를 빼고도 후보가 남으면 그것만 돌려준다 (#8)", () => {
    expect(applyCooldown([{ restaurant_id: "r1" }, { restaurant_id: "r2" }], ["r1"])).toEqual({
      picked: [{ restaurant_id: "r2" }],
      fellBack: false,
    });
  });

  it("전부 걸러지면 전체 후보로 폴백한다 (#9)", () => {
    expect(applyCooldown([{ restaurant_id: "r1" }], ["r1"])).toEqual({
      picked: [{ restaurant_id: "r1" }],
      fellBack: true,
    });
  });

  it("후보가 0개면 폴백했다고 보고하지 않는다 — 되돌릴 후보가 애초에 없다 (#9a)", () => {
    expect(applyCooldown<{ restaurant_id: string }>([], ["r1"])).toEqual({ picked: [], fellBack: false });
  });

  it("null 승자 id 는 무시한다 — 전환 이전 레거시 results 행이다 (#10)", () => {
    expect(applyCooldown([{ restaurant_id: "r1" }, { restaurant_id: "r2" }], [null])).toEqual({
      picked: [{ restaurant_id: "r1" }, { restaurant_id: "r2" }],
      fellBack: false,
    });
  });
});
