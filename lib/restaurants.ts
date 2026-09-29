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

// 리듀서가 목록에 적용하는 최소 단위. DELETE 만 행이 아니라 id 인 비대칭은 Realtime 페이로드 그대로다.
export type RestaurantChange =
  | { event: "INSERT" | "UPDATE"; row: RestaurantRow }
  | { event: "DELETE"; id: string | null };

export type RestaurantsState = {
  // 조회 순서(created_at)를 그대로 유지한다. 표시 순서는 sortRestaurants 가 화면 쪽에서 따로 정한다 —
  // 정렬을 여기에 넣으면 같은 규칙의 정의처가 둘이 된다.
  rows: RestaurantRow[];
  loaded: boolean;
  error: string | null;
  // 조회 응답보다 먼저 도착한 Realtime 이벤트를 도착 순서대로 쌓아 둔 것. 응답이 오면 그 목록 위에
  // 다시 적용한다. 목록에서는 이벤트 하나가 전체 상태가 아니라는 점이 단일행(lib/settings.ts:78-81)과
  // 갈리는 지점이다 — "이벤트가 먼저 왔으니 그쪽이 더 새 값" 으로 조회 결과를 버리면 카탈로그가 그
  // 한 행으로 쪼그라들고, 같은 창의 조회 실패는 배너조차 없이 삼켜진다.
  pending: RestaurantChange[];
};

export const INITIAL_RESTAURANTS_STATE: RestaurantsState = {
  rows: [],
  loaded: false,
  error: null,
  pending: [],
};

// 이벤트 한 건을 목록에 적용한다. 즉시 적용(조회 후)과 재적용(조회 전 버퍼)이 이 함수 하나를 같이 쓰는
// 것이 "조회 전후의 병합 규칙이 같다" 는 보장이다 — 두 벌로 나누면 한쪽만 고쳐지는 날이 온다.
function applyChange(rows: RestaurantRow[], change: RestaurantChange): RestaurantRow[] {
  if (change.event === "DELETE") {
    // id 마저 없으면 무엇을 지울지 알 수 없다. 목록을 비우는 대신 그대로 둔다.
    return change.id === null ? rows : rows.filter((row) => row.id !== change.id);
  }
  if (change.event === "INSERT") {
    // 같은 행이 두 번 와도 늘지 않게 한다 — 구독 재연결 직후 같은 이벤트가 되풀이될 수 있고,
    // 조회 응답에 이미 들어 있는 행이 버퍼에도 남아 있는 것은 정상 경로다.
    if (rows.some((row) => row.id === change.row.id)) return rows;
    return [...rows, change.row];
  }
  // payload.new 는 이미 전체 새 행이다. 얕은 병합({ ...prev, ...row })은 "빠진 필드는 이전 값" 이라는
  // 틀린 가정을 코드에 심으므로 통째로 교체한다. 모르는 id 면 바꿀 행이 없어 목록이 그대로 남는다.
  return rows.map((row) => (row.id === change.row.id ? change.row : row));
}

// DELETE 만 행이 아니라 id 를 받는 비대칭이 계약이다 — Realtime 의 DELETE 페이로드에는 PK 밖에 오지 않는다.
// 그 사실을 액션 타입에 박아 두면 훅·컴포넌트는 그것을 몰라도 된다.
export type RestaurantsAction =
  | { type: "loaded"; rows: RestaurantRow[] }
  | { type: "failed"; message: string }
  | { type: "changed"; event: "INSERT" | "UPDATE"; row: RestaurantRow }
  | { type: "changed"; event: "DELETE"; id: string | null };

export function restaurantsReducer(state: RestaurantsState, action: RestaurantsAction): RestaurantsState {
  switch (action.type) {
    case "loaded": {
      // loaded 를 참으로 올리는 것은 loaded·failed 두 액션뿐이고 훅은 그중 하나만 정확히 한 번 보낸다.
      // 그러므로 여기서 state.loaded 가 참이면 진짜 중복 응답이라 버린다.
      if (state.loaded) return state;
      // 조회 결과 **위에** 그 사이 도착한 이벤트를 도착 순서대로 다시 적용한다. 순서를 지켜야
      // "INSERT 뒤 DELETE" 가 지워진 행이 되살아나는 결과로 뒤집히지 않는다.
      return {
        rows: state.pending.reduce(applyChange, action.rows),
        loaded: true,
        error: null,
        pending: [],
      };
    }
    case "failed":
      // 같은 이유로 중복 응답만 버린다.
      if (state.loaded) return state;
      // 빈 목록 + 에러다. 실패를 "매장 0개" 로 위장하지 않는 것이 여기서 error 를 남기는 이유다.
      // 버퍼도 함께 버린다 — 이벤트 몇 건으로 만든 부분 목록을 남기면 배너와 화면이 서로 다른 말을 한다.
      return { rows: [], loaded: true, error: action.message, pending: [] };
    case "changed": {
      const change: RestaurantChange =
        action.event === "DELETE"
          ? { event: "DELETE", id: action.id }
          : { event: action.event, row: action.row };
      // 조회 전이면 적용하지 않고 버퍼에 쌓는다. 여기서 loaded 를 올리지 않는 것이 CR-01 수정의 핵심이다 —
      // 올리면 뒤늦게 도착한 조회 응답(목록의 정본)과 조회 실패(배너의 정본)가 통째로 버려진다.
      if (!state.loaded) return { ...state, pending: [...state.pending, change] };
      // error 는 그대로 둔다: 이벤트 하나가 도착했다는 사실이 목록 전체를 읽을 수 있다는 증거는 아니라서,
      // 조회 실패 배너를 여기서 지우면 반쪽짜리 목록이 정상처럼 보인다(설정 단일행과 다른 점이다).
      return { ...state, rows: applyChange(state.rows, change) };
    }
    default: {
      // 액션이 더 늘면 이 대입이 컴파일 에러가 된다. 이 리듀서가 갱신을 강제당하는 지점.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
