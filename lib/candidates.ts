// 오늘 후보 도메인의 판단을 모아 둔 순수 모듈 — 카탈로그 조인 · 이름 필터 · 목록 조립 · 당첨 인덱스 · 새 추첨 판정.
// 휠 순서·목록 배지·당첨 인덱스의 정의처가 여기 하나라는 것이 이 파일의 계약이다. 셋이 갈리면 화면 세 곳이
// 서로 다른 매장을 가리킨다.
// 조인을 클라이언트에서 하는 이유: candidates 행은 키와 시각뿐이라 Realtime 페이로드만으로는 매장명을 알 수
// 없고, 카탈로그는 토글 목록 때문에 어차피 전부 필요하다 — 임베드 조회로 시작해도 이벤트마다 재조회가 붙는다.
// 정렬 키가 3단인 이유: 자정 재시드가 한 문장 insert 라 첫 키(후보 시각)가 전부 같아지고, 그 동률 구간에서
// 두 번째 키(매장 등록 시각)가 핀을 꽂은 순서를 복원한다. SQL 은 바꾸지 않는다(2026-09-21 사용자 결정).
// 당첨을 식별자로만 찾는 이유: 이름으로 되찾으면 동명 매장이 당첨으로 오인되고, 컷오버 전 구 결과는 메뉴명이라
// 매장과 맞을 수 없다.
// 순수성이 계약이다 — 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다.

// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 데이터 클라이언트가 로드되지
// 않는다 — 이 모듈을 환경변수 없이 테스트할 수 있는 근거다.
import type { CandidateRow, ResultRow, RestaurantRow } from "@/lib/supabase/client";
import { createRowSetReducer, initialRowSetState, type RowSetAction, type RowSetState } from "@/lib/rowset";

// 휠과 목록이 그대로 쓰는 모양. addedAt 은 후보 행의 등록 시각이다.
export type TodayCandidate = {
  id: string;
  name: string;
  menus: string[];
  location: string | null;
  pinned: boolean;
  addedAt: string;
};

// slice 가 null 이면 아직 담기지 않은 매장이다. 숫자면 그 값이 곧 휠 조각 번호다.
export type TodayRow = { restaurant: RestaurantRow; slice: number | null };

// 시각 두 개를 "같은 순간인가" 로 비교한다. 문자열 비교를 쓰지 않는 이유: 목록은 정상 상태에서 초기
// 조회(PostgREST)와 이후 이벤트(Realtime)가 만든 행이 **섞인** 배열이고, 두 경로의 직렬화가 같다는 것은
// 코드가 아니라 전제였다. "…T02:00:00+00:00" 과 "…T02:00:00Z" 는 같은 순간인데 문자열로는 다르고, 그
// 차이가 정렬에 새면 탭마다 다른 조각 번호가 보인다.
// 파싱 불가(NaN)는 문자열 비교로 떨어뜨린다 — 0 으로 뭉개면 비교기가 전순서를 잃어(a<b 이면서 b<a)
// sort 결과가 엔진 구현에 따라 흔들린다.
function compareInstants(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  if (ta === tb) return 0;
  return ta < tb ? -1 : 1;
}

export function joinCandidates(candidates: CandidateRow[], restaurants: RestaurantRow[]): TodayCandidate[] {
  const byId = new Map(restaurants.map((row) => [row.id, row]));
  const pairs: { candidate: CandidateRow; store: RestaurantRow }[] = [];
  for (const candidate of candidates) {
    const store = byId.get(candidate.restaurant_id);
    // 카탈로그에 없는 후보는 버린다 — 매장 삭제가 두 구독에 따로 도착하는 창의 정상 상태이고, 그 사이에
    // 이름 없는 유령 후보가 휠에 올라가면 안 된다.
    if (!store) continue;
    pairs.push({ candidate, store });
  }
  // 입력 배열을 변형하지 않는다 — 1초 tick 으로 매초 리렌더되는 페이지가 이 함수를 부르고, 넘어온 배열은
  // 리듀서가 들고 있는 상태다.
  pairs.sort((a, b) => {
    const byCandidate = compareInstants(a.candidate.created_at, b.candidate.created_at);
    if (byCandidate !== 0) return byCandidate;
    const byStore = compareInstants(a.store.created_at, b.store.created_at);
    if (byStore !== 0) return byStore;
    // 마지막 키. 여기까지 동률이면 완전 순서를 만들어야 새로고침마다 순서가 흔들리지 않는다.
    if (a.store.id === b.store.id) return 0;
    return a.store.id < b.store.id ? -1 : 1;
  });
  return pairs.map(({ candidate, store }) => ({
    id: store.id,
    name: store.name,
    menus: store.menus,
    location: store.location,
    pinned: store.pinned,
    addedAt: candidate.created_at,
  }));
}

export function filterRestaurantsByName(rows: RestaurantRow[], query: string): RestaurantRow[] {
  const trimmed = query.trim();
  // 공백뿐인 질의는 "아직 아무것도 안 쳤다" 와 같다. 빈 목록을 보여 주면 사용자가 카탈로그를 잃는다.
  if (trimmed.length === 0) return rows;
  // 조합형으로 들어온 한글을 완성형과 같은 모양으로 맞춘 뒤 비교한다 — 맥 키보드·붙여넣기에서 흔하다.
  // 질의로 정규식을 만들지 않는 것도 계약이다(사용자 입력으로 만든 패턴은 되돌아오지 않는 비용을 연다).
  const needle = trimmed.normalize("NFC").toLowerCase();
  // 메뉴는 보지 않는다. CAND-02 가 요구한 것은 이름 필터이고, 메뉴까지 훑으면 왜 걸렸는지 화면에 근거가 없다.
  return rows.filter((row) => row.name.normalize("NFC").toLowerCase().includes(needle));
}

export function listTodayRows(candidates: TodayCandidate[], catalog: RestaurantRow[], query: string): TodayRow[] {
  const byId = new Map(catalog.map((row) => [row.id, row]));
  const taken = new Set(candidates.map((candidate) => candidate.id));
  const added: TodayRow[] = [];
  candidates.forEach((candidate, index) => {
    const store = byId.get(candidate.id);
    if (!store) return;
    // 번호는 candidates 안의 인덱스이고 필터와 무관하다. 배지 색과 휠 조각 색이 같은 매핑을 쓰므로, 필터로
    // 앞 행이 빠졌다고 다시 매기면 목록의 배지와 휠의 조각이 서로 다른 매장을 가리킨다.
    added.push({ restaurant: store, slice: index });
  });
  // 안 담긴 구간은 넘겨받은 카탈로그 순서를 그대로 유지한다 — 정렬은 호출부가 이미 끝낸 상태다.
  const rest: TodayRow[] = catalog
    .filter((row) => !taken.has(row.id))
    .map((row) => ({ restaurant: row, slice: null }));
  // 필터는 두 구간 모두에 적용한다 — 한쪽만 좁히면 "찾기" 가 목록의 절반에만 듣는다.
  const keep = new Set(filterRestaurantsByName(catalog, query).map((row) => row.id));
  return [...added, ...rest].filter((row) => keep.has(row.restaurant.id));
}

// 구조적 타입으로 받는 이유: 호출부가 무엇을 넘기든 이 함수가 읽는 것은 식별자 하나뿐이다.
export function findWinnerIndex(items: { id: string }[], result: ResultRow | null): number {
  // 이름으로 되찾지 않는다. 매장이 지워지면 후보 행도 함께 사라져 어차피 휠에 없고, 컷오버 전 구 결과는
  // 메뉴명이라 매장과 맞을 수 없다 — 찾지 못한 것이 -1 로 그대로 드러나는 편이 안전하다.
  if (result === null || result.restaurant_id === null) return -1;
  const winnerId = result.restaurant_id;
  return items.findIndex((item) => item.id === winnerId);
}

// 휠을 다시 돌릴지 판정한다. 매장 삭제가 내보내는 결과 UPDATE 는 추첨 시각이 그대로라 여기서 걸러진다 —
// 걸러 내지 않으면 매장 하나를 지울 때마다 열린 모든 탭의 휠이 5초씩 돌아 화면이 잠긴다(todo in-06).
// 다시 돌리기는 추첨 시각을 항상 새로 쓰므로 정상 재회전은 살아 있다. 이전 값을 페이로드에서 읽을 수 없어서
// (DELETE 계열 페이로드에는 PK 만 온다) 호출부가 상태 거울을 들고 이 함수에 넘긴다.
// 두 시각을 문자열이 아니라 순간으로 본다(compareInstants 와 같은 이유): prev 는 REST 로 읽은 행이고
// next 는 Realtime 페이로드라 직렬화가 갈리면 같은 추첨이 "다른 추첨" 으로 읽혀 휠이 헛돈다.
// 파싱 불가(NaN)는 "다르다" 가 아니라 문자열 비교로 떨어뜨린다 — NaN !== NaN 을 그대로 쓰면 매장 삭제가
// 내보내는 set-null UPDATE(같은 문자열)마다 true 가 되어 in-06 이 막은 재회전이 소리 없이 돌아온다.
export function isNewSpin(prev: ResultRow | null, next: ResultRow): boolean {
  if (prev === null) return true;
  const before = Date.parse(prev.spun_at);
  const after = Date.parse(next.spun_at);
  if (Number.isNaN(before) || Number.isNaN(after)) return prev.spun_at !== next.spun_at;
  return before !== after;
}

// 병합 규칙의 정의처는 lib/rowset.ts 한 곳이다. 여기서 정하는 것은 "무엇이 같은 행인가" 뿐이고,
// 이 테이블은 PK 가 restaurant_id 라 Realtime DELETE 페이로드에도 그 컬럼이 실려 온다.
export type CandidatesState = RowSetState<CandidateRow>;
export type CandidatesAction = RowSetAction<CandidateRow>;
export const INITIAL_CANDIDATES_STATE: CandidatesState = initialRowSetState<CandidateRow>();
export const candidatesReducer = createRowSetReducer<CandidateRow>((row) => row.restaurant_id);
