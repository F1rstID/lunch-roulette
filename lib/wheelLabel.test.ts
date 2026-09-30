// lib/wheelLabel.ts 의 각도 접기·뒤집기 판정·이름 절단 계약.

import { describe, it, expect } from "vitest";
import {
  WHEEL_LABEL_MAX_CODE_POINTS,
  WHEEL_WINNER_LABEL_MAX_CODE_POINTS,
  fitWheelLabel,
  isLabelFlipped,
  normalizeDeg,
} from "./wheelLabel";

describe("normalizeDeg", () => {
  it("범위 안의 값은 그대로다", () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(359.5)).toBe(359.5);
  });

  it("여러 바퀴를 더한 각도를 한 바퀴 안으로 접는다", () => {
    expect(normalizeDeg(6 * 360 + 12)).toBe(12);
    expect(normalizeDeg(720)).toBe(0);
  });

  it("음수 각도(정지 각은 음수다)도 0 이상으로 접는다", () => {
    expect(normalizeDeg(-12)).toBe(348);
    expect(normalizeDeg(-360)).toBe(0);
    expect(normalizeDeg(-372)).toBe(348);
  });
});

describe("isLabelFlipped", () => {
  it("오른쪽 반원(0 초과 180 미만)은 뒤집지 않는다", () => {
    expect(isLabelFlipped(12)).toBe(false);
    expect(isLabelFlipped(90)).toBe(false);
    expect(isLabelFlipped(179.9)).toBe(false);
  });

  it("왼쪽 반원(180 초과)은 뒤집는다", () => {
    expect(isLabelFlipped(180.1)).toBe(true);
    expect(isLabelFlipped(270)).toBe(true);
    expect(isLabelFlipped(348)).toBe(true);
  });

  it("세로로 서는 0 과 180 은 뒤집지 않는다 — 부동소수 잔차가 붙어도 같다", () => {
    expect(isLabelFlipped(0)).toBe(false);
    expect(isLabelFlipped(180)).toBe(false);
    expect(isLabelFlipped(360)).toBe(false);
    expect(isLabelFlipped(180.00000000000003)).toBe(false);
    // 칸 14개, 당첨 인덱스 12 의 정지 각에서 6시에 오는 인덱스 5 의 화면 각도를 Wheel.tsx 와 같은 산술로 낸 값.
    // 정확히 -180 이어야 하지만 -179.99999999999994 가 나온다.
    const sliceDeg = 360 / 14;
    const restRotation = -(sliceDeg * 12 + sliceDeg / 2);
    expect(isLabelFlipped(5 * sliceDeg + sliceDeg / 2 + restRotation)).toBe(false);
  });

  it("회전을 더한 각도와 음수 각도도 같은 규칙이다", () => {
    expect(isLabelFlipped(6 * 360 + 270)).toBe(true);
    expect(isLabelFlipped(-90)).toBe(true); // 270
    expect(isLabelFlipped(-270)).toBe(false); // 90
  });
});

describe("fitWheelLabel", () => {
  it("상한 이하의 이름은 그대로 돌려준다", () => {
    expect(fitWheelLabel("공리")).toBe("공리");
    expect(fitWheelLabel("가나다라마바사아")).toBe("가나다라마바사아"); // 정확히 8
  });

  it("상한을 넘으면 상한 - 1 글자 + … 이다", () => {
    // 공백도 한 코드포인트다: "돈돌 부대찌개" 가 7이다.
    expect(fitWheelLabel("돈돌 부대찌개 매니아")).toBe("돈돌 부대찌개…");
    expect(fitWheelLabel("가나다라마바사아자")).toBe("가나다라마바사…");
  });

  it("코드포인트 단위로 센다 — 이모지 하나가 한 글자다", () => {
    const name = "🍕🍔🍟🌭🥪🌮🌯🥙🍿"; // 9 코드포인트, 18 코드유닛
    expect(fitWheelLabel(name)).toBe("🍕🍔🍟🌭🥪🌮🌯…");
  });

  it("상한을 직접 줄 수 있고 1 이하로는 내려가지 않는다", () => {
    expect(fitWheelLabel("가나다", 2)).toBe("가…");
    expect(fitWheelLabel("가나다", 1)).toBe("가…");
    expect(fitWheelLabel("가", 1)).toBe("가");
  });

  it("기본 상한은 8 이다 — Wheel.tsx 의 띠 길이와 짝이다", () => {
    expect(WHEEL_LABEL_MAX_CODE_POINTS).toBe(8);
  });

  it("당첨 배지 상한은 14 이다 — 배지가 휠 지름 안에 남는 길이", () => {
    expect(WHEEL_WINNER_LABEL_MAX_CODE_POINTS).toBe(14);
    expect(fitWheelLabel("띄어쓰기없는아주긴매장이름스물네글자까지", WHEEL_WINNER_LABEL_MAX_CODE_POINTS)).toBe(
      "띄어쓰기없는아주긴매장이름…",
    );
  });
});
