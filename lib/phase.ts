// 현재 KST 시각 + 주입된 추첨 시각으로 화면 표시용 페이즈를 추정한다. (시간표는 기본 추첨 시각 11:55 기준)
//
//   hasResult = true                     → decided   (시각 무관: 늦은 추첨·다시 돌리기 포함)
//   00:00 ~ 11:54:59                     → accepting
//   11:55:00 ~ 11:55:04                  → spinning  (휠 애니메이션 5초 구간)
//   11:55:05 ~ 23:59:59 인데 결과가 없다  → stalled   (후보 0개 등 — UI 를 잠그지 않는다, SPIN-03)
//
// 단, 실제 spinning/decided 전환은 서버의 results INSERT 이벤트로 트리거되며,
// 이 함수는 UI의 readOnly 토글과 헤드라인 표시용 페이즈 추정에 쓰인다.
// hasResult 인자가 그 사실을 시그니처에 박아 둔 것이다 — decided 를 결정하는 것은 시각이 아니라
// 결과 행의 존재이고, 시각은 그 아래 세 상태만 가른다.

import { kstParts } from "./time";
import { secondsOfDay, type SpinTime } from "@/supabase/functions/_shared/spinTime";

export type Phase = "accepting" | "spinning" | "decided" | "stalled";

const SPIN_ANIM_SEC = 5; // 휠 애니메이션 길이. components/Wheel.tsx 의 SPIN_MS 와 짝이다

// 기본 인자를 두지 않는다. 다른 시간 헬퍼와 달리 여기서는 설정(settings)에서 온 추첨 시각을
// 호출자가 반드시 넘기게 강제해야 한다 — 기본값을 두면 시각이 다시 이 파일에 숨는다.
export function currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean): Phase {
  if (hasResult) return "decided";
  const t = secondsOfDay(kstParts(now));
  const spinAt = spinTime.hh * 3600 + spinTime.mm * 60;

  if (t < spinAt) return "accepting";
  if (t < spinAt + SPIN_ANIM_SEC) return "spinning";
  return "stalled";
}

/** 후보 목록을 읽기 전용으로 잠글 것인가 */
export function isCandidateListLocked(phase: Phase): boolean {
  switch (phase) {
    case "accepting":
      return false;
    case "spinning":
      return true;
    case "decided":
      return true;
    case "stalled":
      // 추첨 시각은 지났는데 결과가 없다 = 후보 0개 등으로 서버가 추첨을 건너뛴 날이다.
      // 여기서 잠그면 사용자가 후보를 담을 방법이 사라진다 (SPIN-03 이 막으려는 그 상황).
      return false;
    default: {
      // 유니온에 상태가 더 늘면 이 대입이 컴파일 에러가 된다. 이 함수가 갱신을 강제당하는 지점.
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}
