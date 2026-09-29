// 매장 도메인의 판단을 전부 모아 둔 순수 모듈 — 폼 검증 · 위치 링크 판정 · 표시 정렬 · Realtime 병합.
// 순수성 자체가 이 파일의 계약이다: 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다(lib/settings.ts:2-3).
// 판단을 한곳에 모으는 이유: 레포에 렌더 하네스가 없어 컴포넌트·훅에 남은 분기는 영원히 테스트되지 않는다.
// 길이를 코드포인트로 세는 이유: DB 의 길이 검사가 같은 단위라, 코드유닛으로 재면 여기서 통과시킨 이모지
// 이름이 DB 에서 제약 위반으로 튕긴다 — 두 단위가 갈리는 지점이 곧 사용자가 보는 실패다.
// 여기 검증은 제출 전 실수를 막는 보조일 뿐이고 정본은 0005 의 check 제약이다. RLS 가 열려 있어 누구나
// PostgREST 로 직접 쓸 수 있으므로, 이 함수를 우회한 값은 DB 가 막는다는 전제 위에 서 있다.

// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 데이터 클라이언트가
// 로드되지 않는다 — 이 모듈을 환경변수 없이 테스트할 수 있는 근거다.
import type { RestaurantRow } from "@/lib/supabase/client";
import { MENU_NAME_MAX_LEN, RESTAURANT_LOCATION_MAX_LEN, RESTAURANT_MENUS_MAX } from "@/lib/constants";
import { parseMenuInput } from "@/lib/menus";
import {
  createRowSetReducer,
  initialRowSetState,
  type RowSetAction,
  type RowSetState,
} from "@/lib/rowset";

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

// Realtime 병합 규칙의 정의처는 lib/rowset.ts 한 곳이다 — 조회 전 이벤트 버퍼·중복 INSERT 멱등·UPDATE 의
// 추가 동작·DELETE 키 없음까지 전부 거기 있다. 여기서 정하는 것은 "무엇이 같은 행인가" 뿐이고, 이 테이블은
// PK 가 id 다. 규칙을 여기에 한 벌 더 두면 둘 중 한쪽만 고쳐지는 날이 온다.
export type RestaurantsState = RowSetState<RestaurantRow>;
export type RestaurantsAction = RowSetAction<RestaurantRow>;
export const INITIAL_RESTAURANTS_STATE: RestaurantsState = initialRowSetState<RestaurantRow>();
export const restaurantsReducer = createRowSetReducer<RestaurantRow>((row) => row.id);

