// KST(Asia/Seoul) 기준 시간 헬퍼.
// 클라이언트의 로컬 타임존과 무관하게 일관된 결과를 반환한다.

const KST_TZ = "Asia/Seoul";

const formatter = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: KST_TZ, ...opts });

/** "yyyy-mm-dd" (KST 기준) */
export function todayKstDate(now: Date = new Date()): string {
  return formatter({ year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "HH:mm" (KST 24시간제) */
export function formatHhMm(now: Date = new Date()): string {
  return formatter({ hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

/** "HH:mm:ss" (KST 24시간제) */
export function formatHhMmSs(now: Date = new Date()): string {
  return formatter({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
}

/** KST 시각 컴포넌트 분해 */
export function kstParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=일 ... 6=토
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // 24시 → 0시 보정
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/** "2026년 5월 19일 화요일" */
export function formatKstLongDay(now: Date = new Date()): string {
  const p = kstParts(now);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${p.year}년 ${p.month}월 ${p.day}일 ${days[p.weekday]}`;
}
