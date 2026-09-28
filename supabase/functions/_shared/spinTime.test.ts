// supabase/functions/_shared/spinTime.ts 의 파싱·판정 계약을 고정한다. spin_time 은 대시보드에서 사람이
// 직접 넣는 값이라, 이 파서가 잘못 읽거나 멈추면 세 페이지와 추첨 함수가 한꺼번에 어긋난다.
// 다른 단언의 기대값을 DEFAULT_SPIN_TIME 에서 가져오지 않고 { hh: 11, mm: 55 } 리터럴로 적는 이유: 상수를
// 끌어오면 상수가 바뀔 때 기대값도 같이 움직여 "기본 추첨 시각이 11:55 다" 라는 사실이 테스트에서 사라진다
// (components/MenuList.test.ts:3-4 와 같은 논증).
// 초 단위는 일부러 검사하지 않는다 — SpinTime 에 초가 없으므로 파싱 결과에서 버리는 것 자체가 계약이다.

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPIN_TIME,
  DEFAULT_SPIN_TIME_TEXT,
  isAfterSpinTime,
  parseSpinTime,
  secondsOfDay,
} from "./spinTime";

describe("SPINTIME/QUAL-02 — parseSpinTime 은 예외를 던지지 않는 총 함수다", () => {
  it('"11:55" 를 시·분으로 읽는다 (#1)', () => {
    expect(parseSpinTime("11:55")).toEqual({ hh: 11, mm: 55 });
  });

  it('"11:55:00" 도 같은 값으로 읽는다 — PostgREST time 직렬화 형태다 (#2)', () => {
    expect(parseSpinTime("11:55:00")).toEqual({ hh: 11, mm: 55 });
  });

  it('"09:05:30" 의 초는 버린다 (#3)', () => {
    expect(parseSpinTime("09:05:30")).toEqual({ hh: 9, mm: 5 });
  });

  it('"11:55:30.5" 의 소수 초는 허용하되 무시한다 (#4)', () => {
    expect(parseSpinTime("11:55:30.5")).toEqual({ hh: 11, mm: 55 });
  });

  it('"25:00" 은 시 범위 밖이라 null 이다 (#5)', () => {
    expect(parseSpinTime("25:00")).toBeNull();
  });

  it('"11:60" 은 분 범위 밖이라 null 이다 (#6)', () => {
    expect(parseSpinTime("11:60")).toBeNull();
  });

  it("빈 문자열은 null 이다 (#7)", () => {
    expect(parseSpinTime("")).toBeNull();
  });

  it('"1155" 는 구분자가 없어 null 이다 (#8)', () => {
    expect(parseSpinTime("1155")).toBeNull();
  });
});

describe("SPINTIME/QUAL-02 — 기본 추첨 시각의 정의처는 이 파일이다", () => {
  it("DEFAULT_SPIN_TIME 이 11시 55분이다 (#9)", () => {
    expect(DEFAULT_SPIN_TIME).toEqual({ hh: 11, mm: 55 });
  });

  it('DEFAULT_SPIN_TIME_TEXT 가 "11:55" 다 (#10)', () => {
    expect(DEFAULT_SPIN_TIME_TEXT).toBe("11:55");
  });

  it("텍스트 상수를 파싱하면 값 상수가 된다 — 이 한 건만 머리 주석의 리터럴 규칙에서 예외다 (#16)", () => {
    // 계약 자체가 "두 상수가 서로 왕복한다" 이므로 기대값이 상수여야 한다. 리터럴로 적으면
    // #9·#10 을 한 번 더 쓰는 것일 뿐 두 상수의 관계는 어디에도 남지 않는다.
    // 마이그레이션 직후 기본값 동작이 전환 전과 같다(SETT-04)는 사실이 이 왕복 위에 서 있다.
    expect(parseSpinTime(DEFAULT_SPIN_TIME_TEXT)).toEqual(DEFAULT_SPIN_TIME);
  });
});

describe("SPINTIME/QUAL-02 — 시각 경과 판정", () => {
  it("11:55:00 은 하루의 42900 초다 (#11)", () => {
    expect(secondsOfDay({ hour: 11, minute: 55, second: 0 })).toBe(42900);
  });

  it("추첨 1초 전은 아직 지나지 않았다 (#12)", () => {
    expect(isAfterSpinTime({ hour: 11, minute: 54, second: 59 }, { hh: 11, mm: 55 })).toBe(false);
  });

  it("정각부터 지난 것으로 본다 (#13)", () => {
    expect(isAfterSpinTime({ hour: 11, minute: 55, second: 0 }, { hh: 11, mm: 55 })).toBe(true);
  });

  it("정각 직후도 지난 것이다 (#14)", () => {
    expect(isAfterSpinTime({ hour: 11, minute: 55, second: 1 }, { hh: 11, mm: 55 })).toBe(true);
  });

  it("주입한 시각이 경계를 옮긴다 — 12:30 설정에서 12:29:59 는 아직이다 (#15)", () => {
    expect(isAfterSpinTime({ hour: 12, minute: 29, second: 59 }, { hh: 12, mm: 30 })).toBe(false);
  });
});
