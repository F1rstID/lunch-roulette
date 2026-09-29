"use client";

import { createClient } from "@supabase/supabase-js";

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
};

// 매장 카탈로그. 자정에 지워지지 않는 영구 테이블 (supabase/migrations/0005_restaurants_settings.sql).
export type RestaurantRow = {
  id: string;
  name: string;
  menus: string[]; // text[] → PostgREST 는 JSON 배열로 준다
  location: string | null;
  pinned: boolean;
  created_at: string;
};

// 오늘 후보. PK 가 restaurant_id 라서 같은 매장을 두 번 담을 수 없고,
// Realtime DELETE 이벤트의 payload.old 에도 이 컬럼이 실려 온다 (supabase/migrations/0005_restaurants_settings.sql).
export type CandidateRow = {
  restaurant_id: string;
  created_at: string;
};

// 설정 단일행(id = 1). anon 은 읽기만 가능하고 편집은 대시보드(service_role)에서만 한다
// (supabase/migrations/0005_restaurants_settings.sql).
export type SettingsRow = {
  id: 1;
  spin_time: string; // PostgREST time → "HH:MM:SS" (초 포함). 파서는 "11:55" 가 아니라 "11:55:00" 을 받는다
  cooldown_days: number; // 0 = 쿨다운 끔
  history_since: string; // "yyyy-mm-dd" (KST 기준 전환일). results.date 와 문자열 그대로 비교한다
};
