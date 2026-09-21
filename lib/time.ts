// KST(Asia/Seoul) 기준 시간 헬퍼.
// 클라이언트의 로컬 타임존과 무관하게 일관된 결과를 반환한다.
// KST 벽시계 분해의 구현은 이제 supabase/functions/_shared/kst 한 곳뿐이고 이 파일은 그것을
// 그대로 재수출하는 얇은 층 + 화면용 포맷터다 — 분해 로직을 고칠 일이 생기면 여기가 아니라 저쪽을 고친다.

import { kstParts } from "@/supabase/functions/_shared/kst";

// 기존 소비처(app/log/page.tsx·lib/phase.ts·spec)가 계속 "@/lib/time" 에서 가져올 수 있게 재수출한다.
// isolatedModules 라 값과 타입을 한 문장에 섞지 않는다 — 섞으면 트랜스파일이 타입을 값으로 오해한다.
export { kstParts };
export type { KstParts } from "@/supabase/functions/_shared/kst";

const KST_TZ = "Asia/Seoul";

const formatter = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: KST_TZ, ...opts });

/** "yyyy-mm-dd" (KST 기준). results.date 와 같은 코드 경로(_shared/kst)에서 만든다 */
// 포맷터로 따로 만들지 않는 이유: 이 값은 results.date 와 직접 비교되는 키이고, 그 행을 **쓰는** 쪽은
// Edge Function 의 kstNow().date 다. 두 Intl 경로가 우연히 같은 문자열을 내는 데 기대면, ICU 가 로케일의
// 기본 날짜 패턴을 바꾸는 날 클라이언트만 다른 키를 만들어 "오늘 결과 없음" 이 된다. 출력은 동일하다.
export function todayKstDate(now: Date = new Date()): string {
  return kstParts(now).date;
}

/** "HH:mm" (KST 24시간제) */
export function formatHhMm(now: Date = new Date()): string {
  // 24시간제를 h23 으로 못 박는다. 로케일 기본 사이클에 맡기면 ICU 버전에 따라 자정이 "24" 로
  // 나올 수 있다. 같은 뜻의 불리언 옵션을 함께 적으면 그쪽이 이겨 이 줄이 조용히 죽는다.
  return formatter({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}

/** "HH:mm:ss" (KST 24시간제) */
export function formatHhMmSs(now: Date = new Date()): string {
  return formatter({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23", // 위와 같은 이유
  }).format(now);
}

/** "2026년 5월 19일 화요일" */
export function formatKstLongDay(now: Date = new Date()): string {
  const p = kstParts(now);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${p.year}년 ${p.month}월 ${p.day}일 ${days[p.weekday]}`;
}
