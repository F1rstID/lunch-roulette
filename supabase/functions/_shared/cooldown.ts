// 주간 제외 규칙의 정의처. "이번 주(월~어제) 간 매장" 과 "이번 주 쉬기" 매장을 추첨 pool 에서 빼는 판정과,
// 그 판정에 필요한 주 시작(월요일)·오늘 갈 곳(목적지)·하루의 제외 id 규칙이 전부 여기 있다.
// Edge Function 2종(서버 pool)과 클라이언트(휠·목록 배지)가 같은 함수를 쓴다 — 둘이 갈라지면 "휠에서 빠진
// 매장이 서버에서 뽑히는 날" 이 생긴다. 0007 이전의 "최근 N일 쿨다운"(applyCooldown·cooldownWindowStart)은
// 이 규칙으로 대체돼 사라졌다.
// 이 파일도 import 를 하나도 하지 않는다(이유는 kst.ts 머리 주석 참조). DB 조회는 여기서 하지 않는다 —
// "이미 읽어 온 행" 만 받는다.

/** 당첨(결과 행)에서 목적지 판정에 필요한 둘 */
export type WinnerRef = { restaurant_id: string | null; spun_at: string };

/** lunch_days 행에서 목적지 판정에 필요한 둘 */
export type DayDestinationRef = { destination_id: string | null; destination_set_at: string | null };

/** lunch_days 행에서 제외 판정에 필요한 넷 */
export type DayVisitRef = DayDestinationRef & {
  visit_status: "unknown" | "visited" | "skipped";
  visited_id: string | null;
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** date("yyyy-mm-dd") 가 속한 주의 월요일. 요일은 kstParts().weekday(0=일…6=토). 오염 입력이면 null */
// 날짜 산술은 UTC 자정 기준으로만 한다. 로컬 타임존 메서드를 쓰지 않으므로 실행 환경이 어디든 결과가 같다.
// "시간은 lib/time.ts 경유" 규칙의 명시적 예외다 — 여기는 "현재 시각" 에 의존하지 않고 주어진 y/m/d 숫자와
// 요일 숫자만 다루는 순수 캘린더 산술이라 타임존 버그가 날 자리 자체가 없다. 요일을 Date 에서 다시 구하지 않고
// 인자로 받는 이유도 같다 — KST 요일은 kst.ts 가 Intl 로 이미 구했고, 여기서 Date 요일 메서드를 쓰면 UTC 요일이 된다.
export function weekStartOf(date: string, weekday: number): string | null {
  // 오염 입력은 "창 없음" 으로 착지시킨다. 날짜꼴이 아닌 문자열을 돌려주면 그대로 .gte("date", …) 로 흘러
  // PostgREST 가 date 파싱 에러로 500 을 내고 그날 추첨이 통째로 빠진다. 필터를 끄는 쪽이 훨씬 싸다.
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
  const m = DATE_KEY.exec(date);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const daysSinceMonday = (weekday + 6) % 7; // 월=0 … 일=6
  const dt = new Date(Date.UTC(y, mo - 1, d - daysSinceMonday)); // 달·연·윤년 이월을 생성자가 알아서 한다
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** 이번 주 제외 창의 시작일. 창은 [weekStart, today) — 월요일은 창이 없어 null */
// 오늘은 창에 들어가지 않는다 — 다시 돌리기가 오늘 목적지 매장을 다시 뽑을 수 있어야 하기 때문이다(쿨다운 때와 같다).
// 월요일에 null 을 돌려주는 것이 "매주 월요일 00:00 KST 전부 해제" 의 구현이다. 해제하는 cron 이 없다.
export function weeklyWindowStart(today: string, weekday: number): string | null {
  if (weekday === 1) return null;
  return weekStartOf(today, weekday);
}

// 두 시각을 순간으로 비교한다. 서버 timestamptz 는 "+00:00", 클라이언트 toISOString 은 "Z" 라 문자열 비교로는
// 같은 순간이 다르게 읽힌다. 둘 중 하나라도 Date.parse 가 실패하면 문자열 비교로 폴백한다 —
// lib/candidates.ts 의 isNewSpin 과 같은 이유다(파싱 불가 입력에도 결정적인 답을 내야 한다).
function isBefore(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a < b;
  return ta < tb;
}

/** 기록의 목적지 선택이 이 추첨 뒤의 것인가. set_at 이 null 이거나 spun_at 이전이면 stale(다시 돌리기 전 선택) */
// destination_set_at 이 spun_at 이전이면 다시 돌리기로 순서가 바뀐 뒤의 옛 목적지다 — 쓰기 없이 규칙으로
// 무시한다. 그래서 respin 함수가 lunch_days 를 건드리지 않아도 모든 탭이 같은 답을 본다.
// 같은 순간은 "뒤" 로 본다(set_at >= spun_at 이면 fresh). set_at 이 null 이면 추첨 뒤라는 증거가 없다.
// id 와 따로 내보내는 이유: 목적지 매장이 지워지면 destination_id 는 set-null 되고 이름 스냅샷만 남는데, 그 행이
// "되돌리기"(둘 다 null)가 아니라 "지워진 목적지" 임을 화면·기록이 가리려면 선택의 신선도를 id 없이도 물어야 한다.
export function isDestinationFresh(winner: WinnerRef, day: DayDestinationRef): boolean {
  if (day.destination_set_at === null) return false;
  return !isBefore(day.destination_set_at, winner.spun_at);
}

/** 오늘 갈 곳의 매장 id. day 가 없거나 목적지를 비웠거나 추첨 전에 고른 것이면 당첨(1순위) */
// 목적지 매장이 지워진 행(destination_id null · 이름 스냅샷 남음)도 여기서는 당첨 id 로 떨어진다 — 이 함수는 "제외할
// 매장" 의 정의처이고 지워진 매장은 후보일 수 없어 뺄 것이 없다. 이름을 보이는 쪽(lib/lunchDay.ts·lib/history.ts)이
// isDestinationFresh + 스냅샷으로 그 경우를 가른다.
export function effectiveDestinationId(winner: WinnerRef, day: DayDestinationRef | null): string | null {
  if (!day || day.destination_id === null) return winner.restaurant_id;
  if (!isDestinationFresh(winner, day)) return winner.restaurant_id;
  return day.destination_id;
}

/** 그날 이번 주 제외에 넣을 매장 id. 방문 확인 > 목적지 > 당첨 순이고, 단체 점심을 안 한 날은 null */
// 셋째 분기가 사용자 결정 "아무도 안 누른 날은 1순위(또는 바꾼 목적지)에 간 것으로 친다" 다.
// visited 인데 visited_id 가 null 이면 카탈로그 밖 "다른 매장" 이라 뺄 매장이 없다.
export function dayExclusionId(winner: WinnerRef, day: DayVisitRef | null): string | null {
  if (!day) return effectiveDestinationId(winner, null);
  if (day.visit_status === "skipped") return null;
  if (day.visit_status === "visited") return day.visited_id;
  return effectiveDestinationId(winner, day);
}

/** 쉬기 매장을 빼고(전멸이면 allPaused — 되살리지 않는다), 그 다음 이번 주 방문 매장을 뺀다(전멸이면 pool1 로 폴백) */
// 2단인 이유: "이번 주 쉬기" 는 사람이 명시한 뜻이라 몰래 되살리면 거짓이 된다 — 전멸이면 결과 행을 만들지 않는
// 쪽이 맞다(호출자가 all_paused 로 보고하고 다음 분에 재시도한다). 반면 "이번 주 다 가 봤다" 는 기록이 만든
// 자연 제외라 전멸이면 다시 가는 게 맞다. 그래서 둘째 단만 되돌린다. 폴백·전멸 여부를 boolean 으로 함께 돌려주는
// 이유는 호출자가 응답에 그 사실을 실어 "왜 오늘 이 매장이 뽑혔는가" 를 응답만으로 설명할 수 있게 하기 위해서다.
export function applyWeeklyExclusions<T extends { restaurant_id: string }>(
  candidates: readonly T[],
  exclusions: { pausedIds: Iterable<string | null>; visitedIds: Iterable<string | null> },
): { picked: T[]; allPaused: boolean; fellBack: boolean } {
  // 후보가 0개면 뺄 것도, 되돌릴 것도 없다. 여기서 allPaused·fellBack 을 올리면 응답이 "쉬기 때문에 비었다" 고
  // 말하면서 후보 없음을 함께 실어 원인 진단을 어긋나게 한다.
  if (candidates.length === 0) return { picked: [], allPaused: false, fellBack: false };

  // null 은 지워진 매장의 set-null 행이다 — 매칭 키가 없으므로 무시한다.
  const paused = new Set<string>();
  for (const id of exclusions.pausedIds) if (id) paused.add(id);
  const visited = new Set<string>();
  for (const id of exclusions.visitedIds) if (id) visited.add(id);

  const pool1 = candidates.filter((c) => !paused.has(c.restaurant_id));
  if (pool1.length === 0) return { picked: [], allPaused: true, fellBack: false };

  const pool2 = pool1.filter((c) => !visited.has(c.restaurant_id));
  return pool2.length > 0
    ? { picked: pool2, allPaused: false, fellBack: false }
    : { picked: pool1, allPaused: false, fellBack: true };
}
