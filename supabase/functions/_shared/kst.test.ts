// supabase/functions/_shared/kst.ts 의 KST 분해 계약을 고정한다. Phase 4 가 두 Edge Function 의 본문을
// settings·쿨다운 위에서 다시 쓰므로, 그 전에 본문이 딛고 설 "시각 분해"의 경계를 실행 가능한 형태로 남긴다.
// 고정 시각은 전부 UTC 문자열로 만든다 (KST = UTC+9) — 로컬 타임존 메서드를 쓰면 실행 환경에 따라 결과가 흔들린다.
// 난수 분포는 일부러 검사하지 않는다: 난수 품질은 crypto.getRandomValues 의 계약이고, 분포 단언은
// 확률적으로 깜빡여 게이트를 무력화한다. 여기서 고정하는 것은 "입력 배열의 원소만 돌려준다" 는 멤버십뿐이다.
// lib/time.test.ts 와 같은 시각 리터럴을 쓰는 것은 중복이 아니다 — 저쪽은 포맷터 계약을, 이 spec 은 분해 계약을 지킨다.

import { describe, it, expect } from "vitest";
import { kstNow, kstParts } from "./kst";

describe("KST/QUAL-02 — kstParts 가 KST 벽시계로 분해한다", () => {
  it("KST 자정 1초 전(UTC 14:59:59)은 아직 당일이다 (#1)", () => {
    expect(kstParts(new Date("2026-09-18T14:59:59Z")).date).toBe("2026-09-18");
  });

  it("UTC 15:00 정각은 KST 다음 날이다 (#2)", () => {
    expect(kstParts(new Date("2026-09-18T15:00:00Z")).date).toBe("2026-09-19");
  });

  it("자정의 hour 는 24 가 아니라 0 이다 (#3)", () => {
    expect(kstParts(new Date("2026-09-18T15:00:00Z")).hour).toBe(0);
  });

  it("연 경계에서 해가 바뀐다 (#4)", () => {
    expect(kstParts(new Date("2025-12-31T15:00:00Z")).date).toBe("2026-01-01");
  });

  it("요일이 0=일 … 6=토 로 매핑된다 (#5)", () => {
    expect(kstParts(new Date("2026-09-18T02:55:04Z")).weekday).toBe(5);
  });

  it("전체 분해가 리터럴 객체와 같다 (#6)", () => {
    // toEqual 은 잉여 키를 거부한다 — 이 단언 하나가 반환 필드 집합까지 계약으로 고정한다.
    expect(kstParts(new Date("2026-09-18T02:55:04Z"))).toEqual({
      date: "2026-09-18",
      year: 2026,
      month: 9,
      day: 18,
      hour: 11,
      minute: 55,
      second: 4,
      weekday: 5,
    });
  });
});

describe("KST/QUAL-02 — kstNow 는 kstParts(new Date()) 다", () => {
  it("반환 키 집합이 kstParts 와 같다 (#7)", () => {
    // 현재 시각에 의존하므로 값은 단언하지 않는다. 키 집합만으로도 "같은 분해기를 쓴다" 는 사실은 고정된다.
    expect(Object.keys(kstNow()).sort()).toEqual([
      "date",
      "day",
      "hour",
      "minute",
      "month",
      "second",
      "weekday",
      "year",
    ]);
  });
});

// #8·#9(pickRandom)는 0006 에서 함수와 함께 사라졌다 — 순서 결정은 ./ranking.test.ts 가 검사한다.
