// settings 단일행을 앱 도메인으로 옮기고 Realtime 이벤트를 상태에 병합하는 순수 모듈.
// 순수성 자체가 이 파일의 계약이다 — 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다.
// 그래야 러너가 브라우저 전역이나 NEXT_PUBLIC_* 키 없이 이 파일만 단독으로 불러올 수 있다(lib/errors.ts:2-3).
// settings 는 세 페이지가 전부 의존하는 단일 출처다. 대시보드에서 누가 이상한 값을 넣거나 행을 지워도
// 앱이 흰 화면이 되면 안 되므로, 여기 함수들은 어떤 입력에도 값을 돌려주는 총 함수다 — 실패는 예외가 아니라
// 기본값 착지 + warning 반환으로 표현한다(삼키지도 않고, 앱을 멈추지도 않는다).
// error 와 warning 은 다른 채널이다: error 는 로드 실패 전용, warning 은 파싱 경고 전용이다.
// 한 필드에 몰면 로드가 성공한 경우에도 경고가 "설정 불러오기 실패:" 접두를 달고 나와 거짓말이 된다.
// 조회 응답의 성공·실패 가름도 이 리듀서 안에 있다(fetched 가 행과 에러를 함께 받는 이유다) — 그래야 훅에
// 분기가 0개가 되고, 가장 중요한 판정이 렌더 하네스 없는 자리에 남지 않는다.

// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 supabase 클라이언트가
// 로드되지 않는다 — settingsReducer 를 환경변수 없이 테스트할 수 있는 근거다.
import type { SettingsRow } from "@/lib/supabase/client";
import {
  DEFAULT_SPIN_TIME,
  DEFAULT_SPIN_TIME_TEXT,
  parseSpinTime,
  type SpinTime,
} from "@/supabase/functions/_shared/spinTime";

export type Settings = {
  spinTime: SpinTime;
  cooldownDays: number; // 0 = 쿨다운 끔
  // null 은 "전환일 미확정" 이고 로드 전·행 삭제 후에만 나타난다. Phase 7 은 이 상태에서 집계를 자르지 않는다.
  historySince: string | null;
};

// spinTime 에 parseSpinTime 을 거친 값 대신 _shared 의 리터럴 상수를 쓴다 — 비-null 단언을 안 쓰기 위해서다.
export const DEFAULT_SETTINGS: Settings = {
  spinTime: DEFAULT_SPIN_TIME,
  cooldownDays: 0,
  historySince: null,
};

export type SettingsState = {
  settings: Settings;
  loaded: boolean;
  // 로드 실패 전용. 페이지가 formatLoadError("설정", …) 로 감싸 "설정 불러오기 실패:" 접두를 붙인다.
  error: string | null;
  // 파싱 경고 전용. 접두 없이 그대로 배너에 실리는, 단독으로 읽히는 완성 문장이다.
  warning: string | null;
};

export const INITIAL_SETTINGS_STATE: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loaded: false,
  error: null,
  warning: null,
};

export type SettingsAction =
  | { type: "fetched"; row: SettingsRow | null; error: { message: string } | null }
  | { type: "changed"; event: "INSERT" | "UPDATE" | "DELETE"; row: SettingsRow | null };

export function settingsFromRow(row: SettingsRow): { settings: Settings; warning: string | null } {
  const parsed = parseSpinTime(row.spin_time);
  return {
    settings: {
      spinTime: parsed ?? DEFAULT_SETTINGS.spinTime,
      // 음수·NaN 방어: DB check 가 이미 >= 0 을 보장하지만 Realtime 페이로드는 DB 를 거치지 않은
      // 형태로 올 수도 있다고 가정하고 읽는 쪽에서 한 번 더 좁힌다.
      cooldownDays: Number.isFinite(row.cooldown_days) && row.cooldown_days > 0 ? row.cooldown_days : 0,
      // 키가 통째로 빠진 페이로드에서 undefined 가 새어 나가지 않게 null 로 못 박는다. 타입은 이미
      // string | null 이지만 Realtime payload 는 DB 를 거치지 않은 형태로도 오고, Phase 7 이 "전환일
      // 미확정" 을 === null 로 판정하면 undefined 는 그 검사를 통과해 조회 필터로 흘러든다.
      historySince: row.history_since ?? null,
    },
    // 실패를 삼키지 않는다. 이 문장은 접두 없이 배너에 실리므로 단독으로 읽히는 형태여야 한다.
    warning: parsed
      ? null
      : `추첨 시각 설정값 "${row.spin_time}" 을 읽지 못해 기본값 ${DEFAULT_SPIN_TIME_TEXT} 로 동작해요`,
  };
}

export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "fetched": {
      // 훅은 초기 조회 결과를 정확히 한 번 보낸다. 그런데도 도착 시점에 loaded 가 이미 참이면 그 사이
      // Realtime 이벤트가 먼저 들어왔다는 뜻이고, 그쪽이 더 새 값이다 — 늦게 온 조회 응답이(성공이든 실패든)
      // 앱을 옛 행으로 되돌리지 않게 버린다(changed 가 loaded 를 참으로 올리는 것이 이 판정의 근거다).
      if (state.loaded) return state;
      if (action.error) {
        // 행이 함께 와도 실패다. 기본값으로 계속 동작하되 실패를 숨기지 않는다(SETT-03).
        // 파싱 경고와는 다른 채널이라 warning 은 비운다.
        return { settings: DEFAULT_SETTINGS, loaded: true, error: action.error.message, warning: null };
      }
      // row === null 은 0행(아직 시드 안 됨)이고 에러가 아니다 — 배너를 띄우지 않는다.
      if (!action.row) return { settings: DEFAULT_SETTINGS, loaded: true, error: null, warning: null };
      const { settings, warning } = settingsFromRow(action.row);
      return { settings, loaded: true, error: null, warning };
    }
    case "changed": {
      // 두 갈래 모두 loaded 를 참으로 올린다 — 이벤트가 왔다는 것은 현재 상태를 알게 됐다는 뜻이고,
      // 위 두 가드가 "초기 조회보다 앞섰다" 를 판정하는 근거가 바로 이 값이다.
      // DELETE 의 payload.old 는 PK 만 오므로 행을 재구성할 수 없다 → 기본값 복귀가 유일한 처리다.
      if (action.event === "DELETE" || !action.row) {
        return { settings: DEFAULT_SETTINGS, loaded: true, error: null, warning: null };
      }
      // payload.new 는 이미 전체 새 행이다. 얕은 병합({ ...prev, ...row })은 "빠진 필드는 이전 값" 이라는
      // 틀린 가정을 코드에 심으므로 쓰지 않고 통째로 교체한다. 정상 행이 오면 이전 경고도 함께 걷힌다.
      const { settings, warning } = settingsFromRow(action.row);
      return { settings, loaded: true, error: null, warning };
    }
    default: {
      // 액션이 더 늘면 이 대입이 컴파일 에러가 된다. 이 리듀서가 갱신을 강제당하는 지점.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
