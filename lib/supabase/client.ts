"use client";

import { createClient } from "@supabase/supabase-js";
// 후보 출처의 두 낱말은 주간 제외 규칙의 정의처(_shared/cooldown.ts)가 갖는다 — 타입만 가져오므로 Deno 모듈이 로드되지 않는다.
import type { CandidateSource } from "@/supabase/functions/_shared/cooldown";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export type ResultRow = {
  id: string;
  date: string;
  menu: string; // 이제 매장명 스냅샷. 매장이 지워져도 이 문자열이 남아 있는 것이 기록·랭킹의 전제다
  candidates: { name: string; restaurant_id?: string }[]; // Phase 4 부터 restaurant_id 를 함께 싣는다. 전환 이전 행에는 그 키가 아예 없어서 optional 이다
  spun_at: string;
  restaurant_id: string | null; // 매장 삭제 시 set null (supabase/migrations/0005_restaurants_settings.sql)
  // 추첨이 정한 후보 순서. 1번째가 당첨(menu·restaurant_id 와 같다), 2·3번째가 화면의 예비 순위다.
  // 0006 이전 행과 구 함수가 쓴 행은 null. 안의 restaurant_id 는 외래키가 아니라 매장을 지워도 그대로 남는다 —
  // 화면은 이름만 읽는다(lib/ranking.ts). 모양이 깨진 값도 거기서 흡수하므로 여기 타입은 "정상 행의 모양" 이다.
  ranking: { restaurant_id: string; name: string }[] | null;
};

// 매장 카탈로그. 자정에 지워지지 않는 영구 테이블 (supabase/migrations/0005_restaurants_settings.sql).
export type RestaurantRow = {
  id: string;
  name: string;
  menus: string[]; // text[] → PostgREST 는 JSON 배열로 준다
  location: string | null;
  pinned: boolean;
  created_at: string;
  // "이번 주 쉬기" 의 월요일 날짜(0007). 이번 주 월요일과 같을 때만 활성이고 다른 주 값은 만료된 것, null 은 쉬지 않음.
  // 활성 판정은 lib/lunchDay.ts weeklyExclusionMap 과 두 Edge Function 이 같은 비교(=== weekStart)로 한다.
  paused_week: string | null;
};

// 하루 한 행의 점심 기록(supabase/migrations/0007_lunch_days.sql). 행은 누군가 행동할 때만 생기고, 없는 날의 목적지는
// 결과 행의 1순위로 파생한다(_shared/cooldown.ts effectiveDestinationId). 두 Edge Function 은 이 표를 읽기만 한다.
// visit_status 가 unknown 이면 "확인 안 됨" — 기록·랭킹·주간 제외는 목적지에 간 것으로 친다(사용자 결정).
export type LunchDayRow = {
  date: string; // "yyyy-mm-dd" KST. results.date 와 그대로 조인한다
  destination_id: string | null; // 매장 삭제 시 set null. null 은 "바꾸지 않음(=1순위)" 또는 되돌리기
  destination_name: string | null; // 스냅샷 — 매장이 지워져도 "어디 가기로 했나" 가 남는다
  destination_set_at: string | null; // results.spun_at 보다 앞이면 다시 돌리기 전의 선택이라 코드가 무시한다
  visit_status: "unknown" | "visited" | "skipped";
  visited_id: string | null; // visited 인데 null 이면 카탈로그 밖 "다른 매장"
  visited_name: string | null;
  visited_at: string | null;
  updated_at: string;
};

// 이번 주 창 조회가 results 에서 읽는 세 컬럼. 주간 제외 판정에 필요한 것이 이 셋뿐이라 전체 행을 요구하지 않는다.
export type WeekWinnerRow = Pick<ResultRow, "date" | "restaurant_id" | "spun_at">;

// 오늘 후보. PK 가 restaurant_id 라서 같은 매장을 두 번 담을 수 없고,
// Realtime DELETE 이벤트의 payload.old 에도 이 컬럼이 실려 온다 (supabase/migrations/0005_restaurants_settings.sql).
export type CandidateRow = {
  restaurant_id: string;
  created_at: string;
  // 누가 담았나(0008). seed = 자정 cron 의 📌 자동 시드(이번 주 제외를 받는다), manual = 사람이 오늘 탭에서 담기(항상 휠에 오른다).
  // 오늘 탭의 담기 insert 가 "manual" 을 쓰고 DB 기본값은 "seed" 다 — 기본값에 기대는 쓰기는 자정 cron 하나뿐이다.
  source: CandidateSource;
};

// 설정 단일행(id = 1). anon 은 읽기만 가능하고 편집은 대시보드(service_role)에서만 한다
// (supabase/migrations/0005_restaurants_settings.sql).
export type SettingsRow = {
  id: 1;
  spin_time: string; // PostgREST time → "HH:MM:SS" (초 포함). 파서는 "11:55" 가 아니라 "11:55:00" 을 받는다
  cooldown_days: number; // 0007 이후 미사용 — 주간 제외(lunch_days·paused_week)가 대체했다. 컬럼 제거는 다음 마이그레이션
  history_since: string; // "yyyy-mm-dd" (KST 기준 전환일). results.date 와 문자열 그대로 비교한다
};
