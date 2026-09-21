// KST(Asia/Seoul) 벽시계 분해. 이 파일이 레포 전체에서 KST 분해의 유일한 구현처다
// (lib/time.ts 는 얇은 재수출이고, 두 Edge Function 은 여기서 가져다 쓴다 — 복붙은 더 없다).
// 이 파일은 import 를 하나도 하지 않는다. Deno 는 상대 import 에 ".ts" 확장자를 요구하고,
// tsc(moduleResolution: bundler, allowImportingTsExtensions 없음)는 그 확장자를 거부하기 때문이다.
// 서로 import 하지 않아야 Deno · tsc · Turbopack · vitest 네 곳에서 모두 컴파일된다.

const KST_TZ = "Asia/Seoul";

// 0=일 … 6=토. Intl 의 "short" 요일 문자열을 숫자로 옮기는 표다.
const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type KstParts = {
  date: string; // "yyyy-mm-dd" — results.date 와 그대로 비교하는 날짜 키
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=일 … 6=토
};

/** KST 벽시계 분해. 기본 인자를 두지 않는다 — "지금" 이 필요하면 kstNow() 를 쓴다 */
export function kstParts(now: Date): KstParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    // 24시간제를 h23 으로 못 박는다. 로케일 기본 비-12 사이클에 맡기면 ICU 버전·로케일에 따라 자정이
    // "24" 로 나올 수 있다(h24). h23 은 자정을 "00" 으로 보장한다. 같은 뜻의 불리언 옵션을 함께 적으면
    // 그쪽이 이겨 이 줄이 조용히 무시되므로, 이 옵션 하나만 둔다.
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // h23 에서는 도달 불가. h24 로케일 실수를 막는 방어선으로 남긴다
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY[get("weekday")] ?? 0,
  };
}

/** 지금 이 순간의 KST 분해 */
export function kstNow(): KstParts {
  return kstParts(new Date());
}

/** 배열에서 한 원소를 균등하게 뽑는다 */
// 전제조건: arr.length > 0. 빈 배열이면 undefined 를 돌려주면서 타입은 T 라고 주장한다 —
// 호출자가 먼저 길이를 검사하는 계약이고, 현행 두 Edge Function 이 실제로 그렇게 하고 있다.
// 동작 변경 금지 원칙상 이 페이즈에서 예외를 던지는 형태로 바꾸지 않는다.
export function pickRandom<T>(arr: T[]): T {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u); // Deno · Node≥19 전역이라 import 하지 않는다
  return arr[u[0] % arr.length];
}
