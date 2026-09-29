// lib/time.ts 의 KST 변환·포맷 계약을 실행 가능한 형태로 못 박는다.
// 고정 시각은 전부 UTC 문자열로 만든다 — 로컬 타임존 메서드를 쓰면 실행 환경에 따라 결과가 흔들린다 (KST = UTC+9).
// todayKstDate 의 반환값은 results.date 와 직접 비교되는 날짜 키라, 자정·연 경계가 이 앱에서 가장 비싼 버그 영역이다.
// kstParts 분해에 date 가 들어 있는 것은 Edge Function 이 그 값을 그대로 results.date 키로 쓰기 때문이다.

import { describe, it, expect } from "vitest";
import {
  addMinutesToSpinTime,
  formatHhMmSs,
  formatKstLongDay,
  formatSpinTime,
  kstParts,
  todayKstDate,
} from "@/lib/time";

describe("todayKstDate", () => {
  it("KST 자정 1초 전(UTC 14:59:59)은 아직 당일 날짜다", () => {
    expect(todayKstDate(new Date("2026-09-18T14:59:59Z"))).toBe("2026-09-18");
  });

  it("UTC 15:00 정각은 KST 다음 날 00:00 이라 날짜 키가 넘어간다", () => {
    expect(todayKstDate(new Date("2026-09-18T15:00:00Z"))).toBe("2026-09-19");
  });

  it("연 경계에서도 KST 기준으로 해가 바뀐다", () => {
    expect(todayKstDate(new Date("2025-12-31T15:00:00Z"))).toBe("2026-01-01");
  });
});

describe("formatHhMmSs", () => {
  it("추첨 정각은 초까지 11:55:00 으로 찍힌다", () => {
    expect(formatHhMmSs(new Date("2026-09-18T02:55:00Z"))).toBe("11:55:00");
  });

  it("초가 그대로 반영된다", () => {
    expect(formatHhMmSs(new Date("2026-09-18T02:55:04Z"))).toBe("11:55:04");
  });

  it("KST 자정은 00:00:00 이다", () => {
    expect(formatHhMmSs(new Date("2026-09-18T15:00:00Z"))).toBe("00:00:00");
  });
});

describe("kstParts", () => {
  it("UTC 시각을 KST 벽시계 컴포넌트로 분해한다", () => {
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

  it("자정은 24시가 아니라 0시로 보정되고 날짜·요일이 함께 넘어간다", () => {
    const parts = kstParts(new Date("2026-09-18T15:00:00Z"));
    expect(parts.day).toBe(19);
    expect(parts.hour).toBe(0);
    expect(parts.weekday).toBe(6);
  });
});

describe("formatKstLongDay", () => {
  it("한글 긴 날짜 문자열을 만든다", () => {
    expect(formatKstLongDay(new Date("2026-09-18T02:55:00Z"))).toBe("2026년 9월 18일 금요일");
  });

  it("자정을 넘기면 다음 날 요일로 바뀐다", () => {
    expect(formatKstLongDay(new Date("2026-09-18T15:00:00Z"))).toBe("2026년 9월 19일 토요일");
  });
});

// 아래 두 함수는 Date 가 아니라 설정에서 온 벽시계 숫자 두 개를 다룬다 — 타임존 변환이 아니라 문자열 조립과
// 분 산술이다. 화면에 보일 추첨 시각 문구의 조립처를 한 곳으로 모으는 것이 목적이다(SPIN-06).
describe("formatSpinTime", () => {
  it("기본 추첨 시각은 11:55 로 찍힌다", () => {
    expect(formatSpinTime({ hh: 11, mm: 55 })).toBe("11:55");
  });

  it("한 자리 시·분은 0 으로 채운다", () => {
    expect(formatSpinTime({ hh: 9, mm: 5 })).toBe("09:05");
  });

  it("자정은 00:00 이다", () => {
    expect(formatSpinTime({ hh: 0, mm: 0 })).toBe("00:00");
  });
});

describe("addMinutesToSpinTime", () => {
  it("5분을 더하면 11:55 가 12:00 이 된다 (타임라인의 결과 단계가 이 계산을 쓴다)", () => {
    expect(addMinutesToSpinTime({ hh: 11, mm: 55 }, 5)).toEqual({ hh: 12, mm: 0 });
  });

  it("분이 60 을 넘으면 시가 오른다", () => {
    expect(addMinutesToSpinTime({ hh: 11, mm: 30 }, 45)).toEqual({ hh: 12, mm: 15 });
  });

  it("자정을 넘으면 24시간으로 순환한다", () => {
    expect(addMinutesToSpinTime({ hh: 23, mm: 58 }, 5)).toEqual({ hh: 0, mm: 3 });
  });

  it("0분을 더하면 같은 값이고 입력 객체를 변형하지 않는다", () => {
    const spin = { hh: 11, mm: 55 };
    expect([addMinutesToSpinTime(spin, 0), spin]).toEqual([
      { hh: 11, mm: 55 },
      { hh: 11, mm: 55 },
    ]);
  });
});
