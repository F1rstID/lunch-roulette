// 최근 당첨 매장을 오늘 후보에서 빼는 쿨다운 필터와, 그 창의 시작 날짜 계산.
// 이 파일도 import 를 하나도 하지 않는다(이유는 kst.ts 머리 주석 참조).
// DB 조회는 여기서 하지 않는다 — "이미 읽어 온 최근 당첨 id" 만 받는다. 조회는 Phase 4 소관이다.

/** "yyyy-mm-dd" 창 시작일. days <= 0 이면 쿨다운을 끈 것이라 null */
// 창은 [today − days, today − 1] 달력 일수이고 오늘은 들어가지 않는다 — 다시 돌리기가 오늘 당첨 매장을
// 다시 뽑을 수 있어야 하기 때문이다(현재 앱과 동일).
// 날짜 산술은 UTC 자정 기준으로만 한다. 로컬 타임존 메서드를 쓰지 않으므로 실행 환경이 어디든 결과가 같다.
// "시간은 lib/time.ts 경유" 규칙의 명시적 예외다 — CONVENTIONS.md:146 이 components/CalendarLog.tsx 에 대해
// 이미 같은 예외를 문서화했고, 여기는 "현재 시각" 에 의존하지 않고 주어진 y/m/d 숫자만 다루는 순수 캘린더
// 산술이라 타임존 버그가 날 자리 자체가 없다.
export function cooldownWindowStart(today: string, days: number): string | null {
  // 오염 입력은 "창 없음" 으로 착지시킨다. days 는 Phase 4 가 DB 에서 직접 읽어 넣고 today 도 호출자가
  // 만드는 값이라, 여기서 좁히지 않으면 "NaN-NaN-NaN" 같은 문자열이 그대로 .gte("date", …) 로 흘러
  // PostgREST 가 date 파싱 에러로 500 을 내고 그날 추첨이 통째로 빠진다. 필터를 끄는 쪽이 훨씬 싸다.
  if (!Number.isInteger(days) || days <= 0) return null; // NaN·Infinity·소수도 여기서 걸린다
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d - days)); // 달·연·윤년 이월을 생성자가 알아서 한다
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = dt.getUTCFullYear();
  const month = pad(dt.getUTCMonth() + 1);
  const day = pad(dt.getUTCDate());
  return `${year}-${month}-${day}`;
}

/** 최근 당첨 매장을 뺀 후보와 폴백 여부 */
// null 승자 무시 → 제외 → 0개면 전체 폴백.
// 마지막 단계가 핵심이다(SPIN-02): 폴백이 없으면 쿨다운이 켜진 날 후보가 전멸해 결과가 아예 안 생긴다.
// 폴백 여부를 boolean 으로 함께 돌려주는 이유는 Phase 4 가 응답에 그 사실을 실을 수 있게 하기 위해서다.
export function applyCooldown<T extends { restaurant_id: string }>(
  candidates: T[],
  recentWinnerIds: Iterable<string | null>,
): { picked: T[]; fellBack: boolean } {
  // 후보가 0개면 뺄 것도, 되돌릴 것도 없다. 여기서 fellBack: true 를 보고하면 Phase 4 응답이
  // "쿨다운 때문에 폴백했다" 고 말하면서 후보 없음을 함께 실어 원인 진단을 어긋나게 한다.
  if (candidates.length === 0) return { picked: candidates, fellBack: false };
  // null 은 전환 이전 레거시 results 행이다 — 매칭 키가 없으므로 무시한다.
  const blocked = new Set<string>();
  for (const id of recentWinnerIds) if (id) blocked.add(id);
  if (blocked.size === 0) return { picked: candidates, fellBack: false };

  const kept = candidates.filter((c) => !blocked.has(c.restaurant_id));
  return kept.length > 0
    ? { picked: kept, fellBack: false }
    : { picked: candidates, fellBack: true };
}
