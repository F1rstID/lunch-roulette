// 매장 도메인의 판단을 전부 모아 둔 순수 모듈 — 폼 검증 · 위치 링크 판정 · 표시 정렬 · Realtime 병합.
// 순수성 자체가 이 파일의 계약이다: 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다(lib/settings.ts:2-3).
// 판단을 한곳에 모으는 이유: 레포에 렌더 하네스가 없어 컴포넌트·훅에 남은 분기는 영원히 테스트되지 않는다.
// 길이를 코드포인트로 세는 이유: DB 의 길이 검사가 같은 단위라, 코드유닛으로 재면 여기서 통과시킨 이모지
// 이름이 DB 에서 제약 위반으로 튕긴다 — 두 단위가 갈리는 지점이 곧 사용자가 보는 실패다.
// 여기 검증은 제출 전 실수를 막는 보조일 뿐이고 정본은 0005 의 check 제약이다. RLS 가 열려 있어 누구나
// PostgREST 로 직접 쓸 수 있으므로, 이 함수를 우회한 값은 DB 가 막는다는 전제 위에 서 있다.
// 단방향 규칙(lib/ 는 components/ 를 import 하지 않는다)의 의도적 예외가 하나 있다: 메뉴 쉼표 파싱을
// 두 벌로 만들지 않으려고 기존 컴포넌트의 순수 함수를 그대로 가져다 쓴다(CATL-06). Phase 6 이 MenuList 를
// 지울 때 그 파싱 함수를 이 디렉터리로 옮기고 이 예외를 없애야 한다.

// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 데이터 클라이언트가
// 로드되지 않는다 — 이 모듈을 환경변수 없이 테스트할 수 있는 근거다.
import type { RestaurantRow } from "@/lib/supabase/client";
import { MENU_NAME_MAX_LEN, RESTAURANT_LOCATION_MAX_LEN, RESTAURANT_MENUS_MAX } from "@/lib/constants";
import { parseMenuInput } from "@/components/MenuList";

// String.length 는 UTF-16 코드유닛이라 이모지 하나를 2로 센다. DB 와 같은 단위로 재려면 펼쳐서 세야 한다.
function codePointLength(text: string): number {
  return Array.from(text).length;
}

// 쓰기 핸들러가 그대로 PostgREST 에 넘길 모양. location 이 null 인 것이 "없음" 이다.
export type RestaurantInput = {
  name: string;
  menus: string[];
  location: string | null;
};

// 실패를 예외가 아니라 값으로 돌려준다 — 호출부(폼)가 메시지를 배너에 싣고 입력을 보존해야 하기 때문이다.
export type RestaurantFormResult = { ok: true; input: RestaurantInput } | { ok: false; message: string };

// 판정 순서는 이름 → 메뉴 → 위치다. 첫 실패에서 멈추는 이유: 배너가 한 줄이라 여러 실패를 나열해도
// 사용자가 고칠 수 있는 것은 한 번에 하나다. 예외를 던지지 않는 총 함수다.
export function parseRestaurantForm(form: { name: string; menusText: string; location: string }): RestaurantFormResult {
  const name = form.name.trim();
  if (name.length === 0) return { ok: false, message: "매장 이름을 입력해 주세요" };
  // 개행을 조용히 지우지 않는 이유: 붙여넣은 값이 무엇으로 바뀌어 저장됐는지 모르는 편이 더 나쁘다.
  if (/[\n\r]/.test(name)) return { ok: false, message: "매장 이름에 줄바꿈을 넣을 수 없어요" };
  // 이름도 자르지 않고 거절한다 — 매장명은 사람이 검색할 식별자라 말없이 짧아지면 다른 가게가 된다.
  if (codePointLength(name) > MENU_NAME_MAX_LEN) return { ok: false, message: "매장 이름은 24자까지예요" };

  // 원소 절단·빈 항목 제거·입력 내 중복 제거는 전부 이 함수의 계약이다. 카탈로그에는 "이미 있는 메뉴"
  // 개념이 없으므로 제외 목록은 빈 배열을 넘긴다.
  const menus = parseMenuInput(form.menusText, []);
  // 개수만은 절단하지 않는다 — 31번째를 말없이 버리면 사용자는 전부 등록된 줄 안다.
  if (menus.length > RESTAURANT_MENUS_MAX) return { ok: false, message: "메뉴는 30개까지예요" };

  const location = form.location.trim();
  if (codePointLength(location) > RESTAURANT_LOCATION_MAX_LEN) {
    return { ok: false, message: "위치는 200자까지예요" };
  }
  // 빈 문자열이 아니라 null 로 보낸다 — DB 는 null 만 "없음" 으로 보고, 빈 문자열은 값이라 200자 제약을 탄다.
  return { ok: true, input: { name, menus, location: location.length === 0 ? null : location } };
}

// 편집 폼이 배열을 한 줄 입력으로 되돌리는 유일한 창구. parseRestaurantForm 과 왕복이 성립해야 한다.
export function joinMenus(menus: string[]): string {
  return menus.join(", ");
}

export type LocationLink = { href: string; host: string };

// 위치를 링크로 렌더할지를 컴포넌트가 아니라 여기서 정한다 — 판정이 화면에 남으면 테스트되지 않는다.
// 프로토콜 화이트리스트가 javascript:·data: 링크를 막는 유일한 지점이다. 그 두 스킴은 URL 파싱에
// 성공하므로 "파싱되면 링크" 로 두면 클릭 한 번에 스크립트가 도는 앵커가 목록에 생긴다.
export function parseLocationLink(location: string | null): LocationLink | null {
  if (location === null) return null;
  const trimmed = location.trim();
  if (trimmed.length === 0) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // href 는 URL 이 정규화한 값, host 는 화면에 보일 짧은 이름이다.
    return { href: url.href, host: url.host };
  } catch {
    // 위치는 대개 "2층 안쪽" 같은 일반 텍스트라 파싱 실패가 정상 경로다 — 링크가 아니라는 뜻일 뿐이다.
    return null;
  }
}

// 표시 순서: 핀 먼저, 같은 그룹 안에서는 한국어 이름순. 카탈로그는 수십 개 규모라 훑어보기가 목적이고
// 매일 나오는 단골(핀)이 위에 있어야 한다.
// 복사본을 정렬하는 이유: 원본은 리듀서가 들고 있는 상태 배열이고, 1초 tick 으로 매초 리렌더되는 페이지가
// useMemo 로 이 함수를 부른다. 제자리 정렬은 그 상태를 렌더 중에 몰래 바꾼다.
export function sortRestaurants(rows: RestaurantRow[]): RestaurantRow[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
}

export type RestaurantsState = {
  // 조회 순서(created_at)를 그대로 유지한다. 표시 순서는 sortRestaurants 가 화면 쪽에서 따로 정한다 —
  // 정렬을 여기에 넣으면 같은 규칙의 정의처가 둘이 된다.
  rows: RestaurantRow[];
  loaded: boolean;
  error: string | null;
};

export const INITIAL_RESTAURANTS_STATE: RestaurantsState = {
  rows: [],
  loaded: false,
  error: null,
};

// DELETE 만 행이 아니라 id 를 받는 비대칭이 계약이다 — Realtime 의 DELETE 페이로드에는 PK 밖에 오지 않는다.
// 그 사실을 액션 타입에 박아 두면 훅·컴포넌트는 그것을 몰라도 된다.
export type RestaurantsAction =
  | { type: "loaded"; rows: RestaurantRow[] }
  | { type: "failed"; message: string }
  | { type: "changed"; event: "INSERT" | "UPDATE"; row: RestaurantRow }
  | { type: "changed"; event: "DELETE"; id: string | null };

export function restaurantsReducer(state: RestaurantsState, action: RestaurantsAction): RestaurantsState {
  switch (action.type) {
    case "loaded":
      // 훅은 초기 조회 결과를 정확히 한 번 보낸다. 그런데도 도착 시점에 loaded 가 이미 참이면 그 사이
      // Realtime 이벤트가 먼저 들어왔다는 뜻이고 그쪽이 더 새 값이다 — 늦게 온 조회 응답이 목록을
      // 옛 상태로 되돌리지 않게 버린다(lib/settings.ts:78-81 의 논증).
      if (state.loaded) return state;
      return { rows: action.rows, loaded: true, error: null };
    case "failed":
      // 같은 이유로 무시한다. 방금 Realtime 으로 살아 있는 목록을 받았는데 뒤늦은 조회 실패가 그것을
      // 실패 배너로 덮으면 화면이 사실과 반대되는 상태를 말하게 된다.
      if (state.loaded) return state;
      // 빈 목록 + 에러다. 실패를 "매장 0개" 로 위장하지 않는 것이 여기서 error 를 남기는 이유다.
      return { rows: [], loaded: true, error: action.message };
    case "changed": {
      // 세 갈래 모두 loaded 를 참으로 올린다 — 이벤트가 왔다는 것은 현재 상태를 알게 됐다는 뜻이고,
      // 위 두 가드가 "초기 조회보다 앞섰다" 를 판정하는 근거가 바로 이 값이다.
      // error 는 그대로 둔다: 이벤트 하나가 도착했다는 사실이 목록 전체를 읽을 수 있다는 증거는 아니라서,
      // 조회 실패 배너를 여기서 지우면 반쪽짜리 목록이 정상처럼 보인다(설정 단일행과 다른 점이다).
      if (action.event === "DELETE") {
        // id 마저 없으면 무엇을 지울지 알 수 없다. 목록을 비우는 대신 그대로 둔다.
        const rows = action.id === null ? state.rows : state.rows.filter((row) => row.id !== action.id);
        return { rows, loaded: true, error: state.error };
      }
      if (action.event === "INSERT") {
        // 같은 행이 두 번 와도 늘지 않게 한다 — 구독 재연결 직후 같은 이벤트가 되풀이될 수 있다.
        if (state.rows.some((row) => row.id === action.row.id)) {
          return { rows: state.rows, loaded: true, error: state.error };
        }
        return { rows: [...state.rows, action.row], loaded: true, error: state.error };
      }
      // payload.new 는 이미 전체 새 행이다. 얕은 병합({ ...prev, ...row })은 "빠진 필드는 이전 값" 이라는
      // 틀린 가정을 코드에 심으므로 통째로 교체한다. 모르는 id 면 바꿀 행이 없어 목록이 그대로 남는다.
      const updated = action.row;
      return {
        rows: state.rows.map((row) => (row.id === updated.id ? updated : row)),
        loaded: true,
        error: state.error,
      };
    }
    default: {
      // 액션이 더 늘면 이 대입이 컴파일 에러가 된다. 이 리듀서가 갱신을 강제당하는 지점.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
