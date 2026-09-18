// lib/phase.ts 의 페이즈 경계를 고정한다. Phase 3 이 추첨 시각을 settings 에서 주입받도록 이 파일을 다시 쓰므로,
// 그 전에 "지금 무엇이 참인지"를 남겨 두지 않으면 전환이 동작을 조용히 바꿔도 알 수 없다.
// 고정 시각은 UTC 문자열로 만든다 (KST = UTC+9). 경계 하나당 it 하나로 쪼갠다 — 어느 경계가 깨졌는지 이름만 보고 알기 위해서.
// msToNextPhase 는 의도적으로 테스트하지 않는다: 참조 0건의 미사용 코드이고 Phase 3 이 제거할 예정이라 계약을 고정하면 삭제를 방해한다.

import { describe, it, expect } from "vitest";
import { currentPhase } from "@/lib/phase";

describe("currentPhase", () => {
  it("KST 자정 직후는 accepting 이다", () => {
    expect(currentPhase(new Date("2026-09-17T15:00:00Z"))).toBe("accepting");
  });

  it("추첨 1초 전(11:54:59)은 아직 accepting 이다", () => {
    expect(currentPhase(new Date("2026-09-18T02:54:59Z"))).toBe("accepting");
  });

  it("11:55:00 정각부터 spinning 으로 넘어간다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:00Z"))).toBe("spinning");
  });

  it("애니메이션 5초 이내(11:55:04)는 여전히 spinning 이다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:04Z"))).toBe("spinning");
  });

  it("애니메이션이 끝나는 11:55:05 부터 decided 다", () => {
    expect(currentPhase(new Date("2026-09-18T02:55:05Z"))).toBe("decided");
  });

  it("자정 직전(23:59:59)까지 decided 가 유지된다", () => {
    expect(currentPhase(new Date("2026-09-18T14:59:59Z"))).toBe("decided");
  });
});
