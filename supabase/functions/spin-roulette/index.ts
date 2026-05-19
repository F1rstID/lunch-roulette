// 점심 룰렛 추첨 Edge Function.
//
// 매일 KST 11:55에 pg_cron이 이 함수를 호출한다.
// - verify_jwt: false 로 배포 (cron이 익명 호출)
// - 안전장치 1: KST 시각이 11:55 이전이면 거부 (조기 트리거 방지)
// - 안전장치 2: 같은 날짜의 results row가 이미 있으면 즉시 종료 (멱등성)
// - DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SPIN_HH = 11;
const SPIN_MM = 55;

type KstParts = { date: string; hour: number; minute: number; second: number };

function kstNow(): KstParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  return { date, hour, minute, second };
}

function isAfterSpinTime(p: KstParts): boolean {
  const total = p.hour * 3600 + p.minute * 60 + p.second;
  return total >= SPIN_HH * 3600 + SPIN_MM * 60;
}

function pickRandom<T>(arr: T[]): T {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return arr[u[0] % arr.length];
}

Deno.serve(async () => {
  const now = kstNow();

  if (!isAfterSpinTime(now)) {
    return new Response(
      JSON.stringify({ skipped: "before_spin_time", kst: now }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 멱등성: 이미 오늘 결과 있으면 종료
  const { data: existing } = await supabase
    .from("results")
    .select("date, menu")
    .eq("date", now.date)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ skipped: "already_decided", date: now.date, menu: existing.menu }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // 오늘 후보 조회
  const { data: menus, error: menuErr } = await supabase
    .from("menus")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (menuErr) {
    return new Response(JSON.stringify({ error: menuErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!menus || menus.length === 0) {
    return new Response(
      JSON.stringify({ skipped: "no_candidates", date: now.date }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  const winner = pickRandom(menus);
  const candidates = menus.map((m) => ({ name: m.name }));

  const { error: insErr } = await supabase.from("results").insert({
    date: now.date,
    menu: winner.name,
    candidates,
  });

  if (insErr) {
    // 동시에 두 번 호출됐다면 unique date 제약으로 거부될 수 있음 — 정상 시나리오
    if (insErr.code === "23505") {
      return new Response(
        JSON.stringify({ skipped: "race_already_decided", date: now.date }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      date: now.date,
      menu: winner.name,
      candidate_count: menus.length,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
