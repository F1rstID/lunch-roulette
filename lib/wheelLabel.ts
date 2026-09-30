// 휠 라벨의 판단(순수): 어느 각도의 라벨을 뒤집어 그릴지, 띠 길이에 맞춰 이름을 어디서 자를지.
// 각도 산술과 절단 규칙이 여기 한 곳에 있어야 components/Wheel.tsx 는 좌표를 찍기만 한다.
// 이 파일은 React·supabase·환경변수를 끌어오지 않는다.

import { truncateToCodePoints } from "@/lib/menus";

// 방사형 띠(허브 바깥 ~ 테두리 안쪽, viewBox 단위 약 118)에서 번호를 뺀 자리에 13px 글자가 들어가는 수.
// 한글 한 글자를 약 12px 로 잡았다. 영문은 더 좁아 실제로는 여유가 남는다.
export const WHEEL_LABEL_MAX_CODE_POINTS = 8;

// 당첨 배지는 가로라 더 길게 쓸 수 있지만, 15px 글자 14개(약 226)에서 멈춰야 배지가 휠 지름(약 400) 안에 남는다.
// 24자 이름을 그대로 두면 배지가 휠 밖까지 뻗어 옆 라벨을 전부 덮는다.
export const WHEEL_WINNER_LABEL_MAX_CODE_POINTS = 14;

// 회전을 거듭 더한 각도(6바퀴 + 정지 각 등)를 0 이상 360 미만으로 접는다. JS 의 % 는 음수를 남긴다.
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// 12시가 0, 시계 방향. 오른쪽 반원의 라벨은 허브에서 테두리 쪽으로 읽히지만, 왼쪽 반원(180 초과)은
// 같은 회전이면 화면에서 거꾸로 서므로 180° 돌려 테두리에서 허브 쪽으로 읽히게 한다.
// 정확히 0 과 180 은 세로 글자라 어느 쪽이든 같다 — 뒤집지 않는다.
export function isLabelFlipped(screenMidDeg: number): boolean {
  return normalizeDeg(screenMidDeg) > 180;
}

// 띠에 들어가지 않는 이름은 앞부분만 남기고 "…" 를 붙인다. "…" 도 한 글자 자리를 쓰므로 상한에서 하나를 뺀다.
// 전체 이름은 후보 목록과 결과 카드가 보여 준다.
export function fitWheelLabel(name: string, maxCodePoints: number = WHEEL_LABEL_MAX_CODE_POINTS): string {
  if (Array.from(name).length <= maxCodePoints) return name;
  return truncateToCodePoints(name, Math.max(1, maxCodePoints - 1)) + "…";
}
