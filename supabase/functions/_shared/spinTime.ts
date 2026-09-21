// 추첨 시각 문자열의 파싱과 "지났는가" 판정. 기본 추첨 시각(11:55)의 유일한 정의처가 여기다
// (settings.spin_time 이 있으면 그쪽이 이긴다 — 이 파일은 그 값이 없거나 읽히지 않을 때의 착지점이다).
// 화면 문구에 박혀 있는 "11:55" 는 Phase 6(SPIN-06)에서 settings 로 교체된다. 그 작업의 기준점이 이 파일이다.
// 이 파일도 import 를 하나도 하지 않는다 — kst.ts 조차 끌어오지 않는다(이유는 kst.ts 머리 주석 참조).

export type SpinTime = { hh: number; mm: number };

// Edge 응답·화면 문구가 쓰는 텍스트 형태. 값 형태는 아래 상수가 정본이다.
export const DEFAULT_SPIN_TIME_TEXT = "11:55";
// 파서를 거친 뒤 비-null 단언을 붙이는 형태를 호출처에 퍼뜨리지 않으려고 리터럴 상수로 둔다.
export const DEFAULT_SPIN_TIME: SpinTime = { hh: 11, mm: 55 };

// "HH:MM" · "HH:MM:SS" · "HH:MM:SS.ffffff" 를 받는다. 마지막 형태는 PostgREST 의 time 직렬화가
// 낼 수 있는 소수 초다 — 허용하되 버린다(SpinTime 에 초가 없고, 초는 추첨 판정에 쓰지 않는다).
const SPIN_TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

/** "11:55" · "11:55:00" → { hh, mm }. 읽을 수 없으면 null */
// 예외를 던지지 않는 총 함수다: 이 값은 대시보드에서 사람이 넣은 문자열이고,
// 잘못된 값 하나가 세 페이지를 흰 화면으로 만들면 안 된다. 실패는 null 로 돌려 호출자가 기본값에 착지한다.
export function parseSpinTime(text: string): SpinTime | null {
  const m = SPIN_TIME_RE.exec(text);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

// kst.ts 의 KstParts 를 가져오지 않고 필요한 최소 구조만 받는다. "./kst" 는 Deno 가, "./kst.ts" 는 tsc 가
// 거부하므로 타입 하나를 위해 import 를 들이는 대신 구조적 타이핑에 맡긴다 (lib/errors.ts:4 와 같은 논증).
type TimeParts = { hour: number; minute: number; second: number };

/** 자정부터의 경과 초 (11:55:00 → 42900) */
export function secondsOfDay(p: TimeParts): number {
  return p.hour * 3600 + p.minute * 60 + p.second;
}

/** 주어진 벽시계가 추첨 시각을 지났는가 (정각 포함) */
export function isAfterSpinTime(p: TimeParts, spin: SpinTime): boolean {
  return secondsOfDay(p) >= spin.hh * 3600 + spin.mm * 60;
}
