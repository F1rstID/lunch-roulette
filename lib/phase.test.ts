// lib/phase.ts 의 페이즈 경계를 고정한다. Phase 6 이 이 값을 화면 문구·타임라인에 연결하므로,
// 그 전에 판정 계약을 못 박아 두지 않으면 문구 작업이 판정을 조용히 바꿔도 알 수 없다.
// 이 spec 이 새로 못 박는 것은 "stalled" 다 — 추첨 시각이 지났는데 결과 행이 없는 구간이고,
// 그 구간에서 후보 목록이 잠기지 않아야 한다(SPIN-03).
// 고정 시각은 UTC 문자열로 만든다 (KST = UTC+9). 경계 하나당 it 하나로 쪼갠다 — 어느 경계가 깨졌는지 이름만 보고 알기 위해서.
// 일부러 안 하는 것 ①: 추첨 시각을 상수에서 import 하지 않고 { hh, mm } 리터럴로 적는다.
// 상수를 끌어오면 기본값이 바뀔 때 기대값도 같이 움직여 "11:55 가 기본이다" 라는 계약이 테스트에서 사라진다.
// 일부러 안 하는 것 ②: msToNextPhase 는 테스트하지 않는다 — 이 플랜이 삭제하는 참조 0건의 미사용 코드다.

import { describe, it, expect } from "vitest";
import { currentPhase, isCandidateListLocked } from "@/lib/phase";

describe("currentPhase — 결과가 없을 때의 시각 경계 (spinTime 11:55)", () => {
  it("KST 자정 직후는 accepting 이다", () => {
    expect(currentPhase(new Date("2026-09-17T15:00:00Z"), { hh: 11, mm: 55 }, false)).toBe("accepting");
  });

  it("추첨 1초 전(11:54:59)은 아직 accepting 이다", () => {
    expect(currentPhase(new Date("2026-09-18T02:54:59Z"), { hh: 11, mm: 55 }, false)).toBe("accepting");
  });

  it("11:55:00 정각부터 spinning 으로 넘어간다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:00Z"), { hh: 11, mm: 55 }, false)).toBe("spinning");
  });

  it("애니메이션 5초 이내(11:55:04)는 여전히 spinning 이다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:04Z"), { hh: 11, mm: 55 }, false)).toBe("spinning");
  });

  it("애니메이션이 끝나는 11:55:05 에 결과가 없으면 decided 가 아니라 stalled 다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:05Z"), { hh: 11, mm: 55 }, false)).toBe("stalled");
  });

  it("자정 직전(23:59:59)까지 stalled 가 유지된다", () => {
    expect(currentPhase(new Date("2026-09-18T14:59:59Z"), { hh: 11, mm: 55 }, false)).toBe("stalled");
  });
});

describe("currentPhase — 결과가 있으면 시각과 무관하게 decided 다", () => {
  it("추첨 전(11:54:59)이어도 결과가 있으면 decided 다", () => {
    expect(currentPhase(new Date("2026-09-18T02:54:59Z"), { hh: 11, mm: 55 }, true)).toBe("decided");
  });

  it("KST 자정 직후여도 결과가 있으면 decided 다", () => {
    expect(currentPhase(new Date("2026-09-17T15:00:00Z"), { hh: 11, mm: 55 }, true)).toBe("decided");
  });

  it("자정 직전(23:59:59)에도 결과가 있으면 decided 다", () => {
    expect(currentPhase(new Date("2026-09-18T14:59:59Z"), { hh: 11, mm: 55 }, true)).toBe("decided");
  });
});

describe("currentPhase — 주입한 추첨 시각이 경계를 옮긴다", () => {
  it("12:30 을 주입하면 12:29:59 는 accepting 이다", () => {
    expect(currentPhase(new Date("2026-09-18T03:29:59Z"), { hh: 12, mm: 30 }, false)).toBe("accepting");
  });

  it("12:30 을 주입하면 12:30:00 정각은 spinning 이다", () => {
    expect(currentPhase(new Date("2026-09-18T03:30:00Z"), { hh: 12, mm: 30 }, false)).toBe("spinning");
  });

  it("12:30 을 주입하면 12:30:05 는 stalled 다", () => {
    expect(currentPhase(new Date("2026-09-18T03:30:05Z"), { hh: 12, mm: 30 }, false)).toBe("stalled");
  });
});

describe("isCandidateListLocked — stalled 에서는 후보 목록이 잠기지 않는다 (SPIN-03)", () => {
  it("accepting 은 잠기지 않는다", () => {
    expect(isCandidateListLocked("accepting")).toBe(false);
  });

  it("spinning 은 잠긴다", () => {
    expect(isCandidateListLocked("spinning")).toBe(true);
  });

  it("decided 는 잠긴다", () => {
    expect(isCandidateListLocked("decided")).toBe(true);
  });

  it("stalled 는 잠기지 않는다 — 후보 0개로 추첨이 건너뛰어진 날에도 계속 담을 수 있어야 한다", () => {
    expect(isCandidateListLocked("stalled")).toBe(false);
  });
});
