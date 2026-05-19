// 현재 KST 시각으로 페이즈를 결정한다.
//
//   00:00 ~ 11:54:59  → accepting
//   11:55:00 ~ 11:55:05  → spinning (애니메이션 동안)
//   11:55:06 ~ 23:59:59  → decided
//
// 단, 실제 spinning/decided 전환은 서버의 results INSERT 이벤트로 트리거되며,
// 이 함수는 UI의 readOnly 토글과 헤드라인 표시용 페이즈 추정에 쓰인다.

import { kstParts } from "./time";

export type Phase = "accepting" | "spinning" | "decided";

const SPIN_HH = 11;
const SPIN_MM = 55;
const SPIN_ANIM_SEC = 5;

export function currentPhase(now: Date = new Date()): Phase {
  const p = kstParts(now);
  const total = p.hour * 3600 + p.minute * 60 + p.second;
  const spinAt = SPIN_HH * 3600 + SPIN_MM * 60;

  if (total < spinAt) return "accepting";
  if (total < spinAt + SPIN_ANIM_SEC) return "spinning";
  return "decided";
}

/** 다음 페이즈 전환까지 남은 ms (UI tick 최적화용) */
export function msToNextPhase(now: Date = new Date()): number {
  const p = kstParts(now);
  const total = p.hour * 3600 + p.minute * 60 + p.second;
  const spinAt = SPIN_HH * 3600 + SPIN_MM * 60;
  const dayEnd = 24 * 3600;
  let target: number;
  if (total < spinAt) target = spinAt;
  else if (total < spinAt + SPIN_ANIM_SEC) target = spinAt + SPIN_ANIM_SEC;
  else target = dayEnd; // 자정 reset
  return (target - total) * 1000;
}
