// KST(Asia/Seoul) 기준 시간 헬퍼.
// 클라이언트의 로컬 타임존과 무관하게 일관된 결과를 반환한다.
// KST 벽시계 분해의 구현은 이제 supabase/functions/_shared/kst 한 곳뿐이고 이 파일은 그것을
// 그대로 재수출하는 얇은 층 + 화면용 포맷터다 — 분해 로직을 고칠 일이 생기면 여기가 아니라 저쪽을 고친다.

import { kstParts } from "@/supabase/functions/_shared/kst";
// 값이 아니라 타입만 쓴다. 이 파일은 포맷터 층이고, 추첨 시각의 값 정의처는 _shared 한 곳으로 남긴다.
import type { SpinTime } from "@/supabase/functions/_shared/spinTime";

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

/** "HH:mm:ss" (KST 24시간제) */
export function formatHhMmSs(now: Date = new Date()): string {
  return formatter({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    // 24시간제를 h23 으로 못 박는다. 로케일 기본 사이클에 맡기면 ICU 버전에 따라 자정이 "24" 로
    // 나올 수 있다. 같은 뜻의 불리언 옵션을 함께 적으면 그쪽이 이겨 이 줄이 조용히 죽는다.
    hourCycle: "h23",
  }).format(now);
}

/** "2026년 5월 19일 화요일" */
export function formatKstLongDay(now: Date = new Date()): string {
  const p = kstParts(now);
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${p.year}년 ${p.month}월 ${p.day}일 ${days[p.weekday]}`;
}

// 아래 둘은 Date 가 아니라 설정에서 온 벽시계 숫자 두 개를 다룬다. 화면에 보일 추첨 시각 문구가 이 한 곳에서
// 만들어져야 같은 시각이 헤드라인·휠 허브·타임라인에서 제각각 조립되지 않는다(SPIN-06).

/** { hh, mm } → "HH:mm" (0 패딩) */
// Intl 을 쓰지 않는 이유: 이것은 타임존 변환이 아니라 숫자 둘을 문자열로 잇는 일이고, 입력에 날짜가 없다.
export function formatSpinTime(t: SpinTime): string {
  return `${String(t.hh).padStart(2, "0")}:${String(t.mm).padStart(2, "0")}`;
}

/** 추첨 시각에 분을 더한다. 24시간으로 순환하고 입력 객체를 변형하지 않는다 */
// 순환이 필요한 이유: 타임라인의 결과 단계가 추첨 시각 + 5분이라, 추첨 시각이 23:58 이면 다음 날로 넘어간다.
export function addMinutesToSpinTime(t: SpinTime, minutes: number): SpinTime {
  const MINUTES_PER_DAY = 24 * 60;
  // 음수도 받을 수 있게 한 번 더 더한 뒤 나머지를 낸다 — 자바스크립트의 % 는 음수 피제수에서 음수를 낸다.
  const total = (((t.hh * 60 + t.mm + minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return { hh: Math.floor(total / 60), mm: total % 60 };
}
