// 주간 점심 기록의 화면 쪽 판단(순수): 오늘 갈 곳 · 다음 식당 · 방문 요약 · 이번 주 제외 맵 · 주간 상태 리듀서 ·
// 지도 링크 · "다른 매장" 이름 검증. 규칙 자체(목적지 파생·하루의 제외 id)의 정의처는 _shared/cooldown.ts 고,
// 여기서는 그 함수를 값으로 가져다 화면이 쓰는 모양(이름 스냅샷·순위 번호·배지 사유)으로 옮긴다 — Edge Function 과
// 같은 함수를 쓰는 것이 "휠에서 빠진 매장이 서버에서 뽑히는 날" 을 없애는 장치다(lib/time.ts 가 _shared/kst 를,
// lib/settings.ts 가 _shared/spinTime 을 가져오는 선례와 같다).
// 이 파일이 하나인 이유: 휠에서 빠지는 매장·목록 배지의 사유·목적지 카드의 이름이 따로 조립되면 화면 세 곳이 다른 매장을 가리킨다.
// 순수성이 계약이다 — 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다. 행 타입은 `import type` 으로만 가져온다.

import type { LunchDayRow, ResultRow, WeekWinnerRow } from "@/lib/supabase/client";
import { MENU_NAME_MAX_LEN } from "@/lib/constants";
import { parseLocationLink } from "@/lib/restaurants";
import { dayExclusionId, effectiveDestinationId } from "@/supabase/functions/_shared/cooldown";

// 요일 라벨. 자리는 kst.ts 의 kstParts().weekday(0=일…6=토)와 같다 — 달력 머리글과 목록 배지("화 방문")가 같은 배열을 본다.
export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type RankingList = NonNullable<ResultRow["ranking"]>;

export type Destination = {
  id: string | null; // 당첨 매장이 지워진 날은 null — 이름 스냅샷만 남는다
  name: string;
  rank: number | null; // 순위 목록 안의 자리(1부터). 순위 밖 매장을 고른 날은 null
};

function rankingName(ranking: RankingList | null, id: string): string | null {
  return ranking?.find((entry) => entry.restaurant_id === id)?.name ?? null;
}

/** 오늘 갈 곳. 결과가 없으면 null, 기록이 목적지를 바꾼(그리고 추첨 뒤인) 날만 기록 쪽 id·이름·순위다 */
// 그 외(기록 없음·되돌리기·다시 돌리기 전 선택)는 전부 당첨이고, 당첨은 정의상 1순위다(0006: ranking[0] === menu·restaurant_id)
// — ranking 이 null 인 구 행에서도 그렇다. 이름은 기록의 스냅샷을 먼저 쓴다: 매장이 지워져도 그날 "어디 가기로 했나" 가 남아야 한다.
export function destinationOf(result: ResultRow | null, day: LunchDayRow | null): Destination | null {
  if (result === null) return null;
  const id = effectiveDestinationId(result, day);
  const fromDay = day !== null && day.destination_id !== null && id === day.destination_id;
  if (!fromDay) return { id: result.restaurant_id, name: result.menu, rank: 1 };
  const index = result.ranking?.findIndex((entry) => entry.restaurant_id === id) ?? -1;
  return {
    id,
    name: day.destination_name ?? rankingName(result.ranking, id) ?? result.menu,
    rank: index === -1 ? null : index + 1,
  };
}

/** "웨이팅 있어요" 가 갈 다음 매장 — 순위에서 현재 목적지의 다음. 끝이거나 순위가 없으면 null(버튼을 숨긴다) */
// 현재가 순위 밖(또는 null)이면 1순위에 있는 것으로 보고 2순위를 내놓는다 — 되돌리기 뒤의 자리와 같다.
export function nextDestination(
  ranking: RankingList | null,
  currentId: string | null,
): { id: string; name: string } | null {
  if (!ranking) return null;
  const at = currentId === null ? -1 : ranking.findIndex((entry) => entry.restaurant_id === currentId);
  const next = ranking[at === -1 ? 1 : at + 1];
  return next ? { id: next.restaurant_id, name: next.name } : null;
}

export type VisitSummary = { kind: "unknown" } | { kind: "skipped" } | { kind: "visited"; name: string };

/** 기록 탭·목적지 카드가 보이는 방문 요약. 행이 없으면 "확인 안 됨" 이다 */
export function visitSummary(day: LunchDayRow | null): VisitSummary {
  if (day === null || day.visit_status === "unknown") return { kind: "unknown" };
  if (day.visit_status === "skipped") return { kind: "skipped" };
  // 카탈로그 밖 "다른 매장" 은 visited_id 가 없고 이름 스냅샷만 있다. 스냅샷까지 비면 빈 문자열 — 화면이 라벨만 보인다.
  return { kind: "visited", name: day.visited_name ?? "" };
}

export type ExclusionReason = { reason: "visited"; date: string } | { reason: "paused" };

/** "yyyy-mm-dd" 의 요일 라벨("월"…). UTC 자정 산술이라 실행 환경 타임존과 무관하다(_shared/cooldown.ts weekStartOf 와 같은 예외) */
export function weekdayLabel(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** 목록 배지 문구 — "화 방문" / "이번 주 쉬기". 배지 자리가 좁아 요일은 한 글자다 */
export function exclusionBadge(reason: ExclusionReason): string {
  return reason.reason === "paused" ? "이번 주 쉬기" : `${weekdayLabel(reason.date)} 방문`;
}

/** 이번 주 휠·추첨에서 빠지는 매장 → 사유. 목록 배지와 휠 제외의 정의처다 */
// 방문 제외의 창은 [weekStart, today) 라 오늘은 안 들어간다(다시 돌리기가 오늘 목적지를 다시 뽑을 수 있어야 한다).
// 월요일은 weekStart === today 로 창이 비어 방문 제외가 0 이고 쉬기만 적용된다 — Edge Function 의 weeklyWindowStart 와 같은 결과다.
// 쉬기가 방문을 덮는다: 사람이 명시한 뜻이 기록이 만든 자연 제외보다 표시 우선이다.
export function weeklyExclusionMap(
  weekStart: string,
  today: string,
  winners: readonly WeekWinnerRow[],
  days: readonly LunchDayRow[],
  candidates: readonly { id: string; paused_week: string | null }[],
): Map<string, ExclusionReason> {
  const map = new Map<string, ExclusionReason>();
  const dayByDate = new Map(days.map((day) => [day.date, day]));
  // 날짜순으로 걸어 같은 매장을 두 번 갔으면 먼저 간 날이 배지에 남는다. 양쪽 다 "yyyy-mm-dd" 키라 문자열 비교로 충분하다.
  const inWindow = winners
    .filter((winner) => winner.date >= weekStart && winner.date < today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const winner of inWindow) {
    const id = dayExclusionId(winner, dayByDate.get(winner.date) ?? null);
    if (id !== null && !map.has(id)) map.set(id, { reason: "visited", date: winner.date });
  }
  for (const candidate of candidates) {
    if (candidate.paused_week === weekStart) map.set(candidate.id, { reason: "paused" });
  }
  return map;
}

// 주간 상태. lib/rowset.ts 와 달리 loaded 뒤의 조회 응답도 받는다 — 이 훅의 목적이 재연결·탭 복귀 때의 재조회 복구이기 때문이다
// (Codex 평가 C1: 구독이 끊긴 사이의 변경은 이벤트로 오지 않는다). stale 응답은 세대 번호로 거른다: refresh 가 세대를 올리고,
// 훅은 조회를 보낼 때의 세대를 fetched 에 실어 보내며, 리듀서는 현재 세대와 다른 응답을 버린다.
// 창(weekStart·today)을 상태에 두는 이유: changed 가 창 밖 날짜(지난 주 행의 수정)를 거를 기준이 필요하고, 그 기준은
// 조회를 보낸 쪽이 아는 값이다. lunch_days 창은 오늘을 포함한다(목적지 카드가 오늘 행을 본다) — results 창(어제까지)과 다르다.
export type LunchWeekState = {
  days: LunchDayRow[];
  winners: WeekWinnerRow[];
  loaded: boolean;
  error: string | null; // 조회 실패 전용. 페이지가 formatLoadError 로 접두를 붙인다
  generation: number;
  weekStart: string;
  today: string;
};

export const INITIAL_LUNCH_WEEK_STATE: LunchWeekState = {
  days: [],
  winners: [],
  loaded: false,
  error: null,
  generation: 0,
  weekStart: "",
  today: "",
};

export type LunchWeekAction =
  | { type: "refresh"; weekStart: string; today: string }
  | {
      type: "fetched";
      generation: number;
      days: LunchDayRow[];
      winners: WeekWinnerRow[];
      error: { message: string } | null;
    }
  | { type: "changed"; row: LunchDayRow };

export function lunchWeekReducer(state: LunchWeekState, action: LunchWeekAction): LunchWeekState {
  switch (action.type) {
    case "refresh": {
      // 가진 행은 그대로 둔다 — 재조회 중에도 화면이 비지 않는다. 응답이 오면 통째로 바뀐다.
      return { ...state, generation: state.generation + 1, weekStart: action.weekStart, today: action.today };
    }
    case "fetched": {
      if (action.generation !== state.generation) return state;
      // 실패를 삼키지 않되 가진 행도 버리지 않는다 — 재조회 실패가 멀쩡한 화면을 비우면 안 된다.
      if (action.error) return { ...state, loaded: true, error: action.error.message };
      return { ...state, days: action.days, winners: action.winners, loaded: true, error: null };
    }
    case "changed": {
      const { date } = action.row;
      // 창을 받기 전(초기 상태, 둘 다 "")에는 어떤 날짜도 today("") 보다 커서 자연히 걸러진다.
      if (date < state.weekStart || date > state.today) return state;
      const at = state.days.findIndex((day) => day.date === date);
      const days = at === -1 ? [...state.days, action.row] : state.days.map((day, i) => (i === at ? action.row : day));
      return { ...state, days };
    }
    default: {
      // 액션이 더 늘면 이 대입이 컴파일 에러가 된다. 이 리듀서가 갱신을 강제당하는 지점.
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

// 매장명으로 지도를 여는 검색 URL. 위치가 링크면 그 링크가 이긴다(사람이 적어 둔 정확한 자리).
const NAVER_MAP_SEARCH = "https://map.naver.com/p/search/";

/** 지도 버튼의 href. http(s) 위치는 그대로, 아니면 이름 검색 */
// 링크 판정은 lib/restaurants.ts 의 parseLocationLink 와 같은 화이트리스트다 — javascript: 같은 스킴이 여기로 새면
// LocationLink 가 막은 것을 지도 버튼이 다시 연다.
export function mapHref(name: string, location: string | null): string {
  const link = parseLocationLink(location);
  if (link) return link.href;
  return `${NAVER_MAP_SEARCH}${encodeURIComponent(name.trim())}`;
}

export type OtherVisitName = { ok: true; name: string } | { ok: false; message: string };

/** "다른 매장" 입력 검증. 이름은 식별자라 자르지 않고 거부한다(lib/menus.ts 의 절단과 다른 규칙) */
// 상한은 매장명과 같은 MENU_NAME_MAX_LEN(24, 코드포인트) — 카탈로그에 있었다면 그 이름으로 저장될 값이다.
export function parseOtherVisitName(text: string): OtherVisitName {
  const name = text.trim();
  if (name.length === 0) return { ok: false, message: "매장 이름을 입력해 주세요" };
  if (name.includes("\n")) return { ok: false, message: "줄바꿈 없이 한 줄로 적어 주세요" };
  if ([...name].length > MENU_NAME_MAX_LEN) {
    return { ok: false, message: `매장 이름은 ${MENU_NAME_MAX_LEN}자까지만 쓸 수 있어요` };
  }
  return { ok: true, name };
}
