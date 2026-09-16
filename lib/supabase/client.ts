"use client";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
});

// menus.name / pinned_menus.name 의 DB check 제약(char_length 1~24)과 동일. 여기서만 정의한다.
export const MENU_NAME_MAX_LEN = 24;

export type MenuRow = {
  id: string;
  name: string;
  created_at: string;
};

export type ResultRow = {
  id: string;
  date: string;
  menu: string;
  candidates: { name: string }[];
  spun_at: string;
};

// 고정 메뉴. 매일 자정 재시드의 소스 (supabase/migrations/0004_pinned_menus.sql).
export type PinnedMenuRow = {
  name: string;
  created_at: string;
};
