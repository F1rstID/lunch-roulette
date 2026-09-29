// 기록·랭킹의 판단(순수): 전환일 필터 · 매장 기준 집계 · 월 격자.
// 순수성이 계약이다 — 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다(lib/candidates.ts 와 같은 논증).
// 이 파일이 하나인 이유: "전환일 이후" 의 뜻(당일 포함)과 "매장 기준" 의 뜻(집계 키)이 기록 페이지와 랭킹 페이지에서
// 따로 조립되면 같은 결과 행이 한 화면에는 있고 다른 화면에는 없는 날이 온다.

// 값이 아니라 타입만 쓴다 — 트랜스파일에서 통째로 지워져 supabase 클라이언트가 로드되지 않는다.
import type { ResultRow } from "@/lib/supabase/client";

// 랭킹이 읽는 컬럼만. 랭킹 페이지는 조회 자체를 이 컬럼으로 좁히므로(candidates jsonb 제외) 전체 행을 요구하면 안 된다.
export type HistoryRow = Pick<ResultRow, "date" | "menu" | "restaurant_id">;

/** 전환일(settings.history_since) 이후 행만 남긴다. 당일 포함. null 은 "전환일 미확정" 이라 자르지 않는다 */
// 문자열 비교로 충분한 이유: 양쪽 다 KST "yyyy-mm-dd" 키다(results.date 와 settings.history_since 의 형식 계약).
// null 에서 자르지 않는 것이 계약인 이유: 로드 전·설정 실패(컷오버 전 라이브)·행 삭제 후에 화면이 통째로 비면
// "기록이 없다" 는 거짓이 된다 — 설정이 없으면 전체를 보이는 쪽이 정직하다(SETT-03 과 같은 방향).
export function filterSince<T extends { date: string }>(rows: T[], historySince: string | null): T[] {
  if (historySince === null) return rows;
  return rows.filter((row) => row.date >= historySince);
}

export type RankEntry = {
  // 집계 키. 매장 id 가 있으면 id, 없으면(삭제된 매장) 이름 스냅샷.
  key: string;
  // 표시 이름. 그 키의 가장 최근 당첨일 행이 가진 스냅샷이라 개명이 반영된다.
  name: string;
  wins: number;
  lastDate: string;
  share: number;
};

// 결정성을 위한 전순서 비교. localeCompare 를 쓰지 않는 이유: 키는 uuid 아니면 이름이고 정렬의 목적은
// 사람이 읽는 순서가 아니라 "같은 입력이면 같은 출력" 이다 — 로케일·ICU 버전에 흔들리면 안 된다.
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 매장 기준 당첨 집계. 키는 restaurant_id ?? menu, 정렬은 wins ↓ → lastDate ↓ → key ↑ */
// id 로만 모으면 삭제된 매장(on delete set null)의 기록이 랭킹에서 통째로 사라지고, 이름으로만 모으면 개명한 매장이
// 두 줄로 갈라진다. 삭제는 그 매장의 모든 행을 한 번에 null 로 바꾸므로 **개명한 적이 없는** 매장은 이름 키로 다시
// 한 덩어리가 된다. 개명 뒤 삭제된 매장은 스냅샷 이름 수만큼 갈라지고, 같은 이름으로 등록됐다 삭제된 서로 다른 매장은
// 합쳐진다 — 개명 이력이 데이터에 없어 읽는 쪽이 복원할 수 없는 한계이고, 기록이 통째로 사라지는 id-only 보다 낫다고
// 판단한 것이다(07-CONTEXT D-02). 같은 이름으로 다시 등록한 매장은 새 id 를 받아 별개 줄이 된다 — 다른 매장이 맞다.
export function buildRanking(rows: HistoryRow[]): { list: RankEntry[]; total: number } {
  const tally = new Map<string, Omit<RankEntry, "share">>();
  for (const row of rows) {
    const key = row.restaurant_id ?? row.menu;
    const cur = tally.get(key) ?? { key, name: row.menu, wins: 0, lastDate: "" };
    cur.wins += 1;
    if (row.date > cur.lastDate) {
      cur.lastDate = row.date;
      cur.name = row.menu;
    }
    tally.set(key, cur);
  }
  const total = rows.length;
  const list = Array.from(tally.values())
    .map((entry) => ({ ...entry, share: total ? entry.wins / total : 0 }))
    .sort(
      (a, b) =>
        b.wins - a.wins || compareStrings(b.lastDate, a.lastDate) || compareStrings(a.key, b.key),
    );
  return { list, total };
}

export type MonthCell = { y: number; m: number; d: number; dim: boolean };

const GRID_CELLS = 42; // 6주 × 7일 — 어떤 달도 6주 안에 들어가고, 높이가 달마다 흔들리지 않는다.

/** 달력 6×7 격자. 앞뒤 패딩은 이웃 달의 날짜이고 dim 으로 표시한다 */
// 로컬 Date 메서드를 쓰는 두 자리 중 하나(lib/time.ts 경유 규칙의 허용 예외 — 나머지는 components/CalendarLog.tsx
// DetailView 의 요일 계산): "지금" 을 읽는 것이 아니라 주어진
// 연·월의 요일·일수를 구하는 순수 달력 산술이라 실행 환경의 타임존이 결과를 바꾸지 못한다.
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();

  const cells: MonthCell[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    cells.push({ y: prevYear, m: prevMonth, d, dim: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, dim: false });
  }
  let trail = 1;
  while (cells.length < GRID_CELLS) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cells.push({ y: nextYear, m: nextMonth, d: trail, dim: true });
    trail++;
  }
  return cells;
}
