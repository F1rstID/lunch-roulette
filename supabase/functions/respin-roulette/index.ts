// 점심 룰렛 "다시 돌리기" Edge Function.
//
// 사용자가 오늘 결과를 다시 뽑고 싶을 때 클라이언트가 호출한다.
// spin-roulette와 달리:
// - 시간 가드 없음 (언제든 재돌림 허용)
// - 멱등성 스킵 없음 (이미 결과가 있어도 진행)
// - results를 upsert(onConflict: date)로 덮어쓴다
// DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function pickRandom<T>(arr: T[]): T {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return arr[u[0] % arr.length];
}

Deno.serve(async () => {
  const now = kstNow();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 오늘 후보 조회 (menus는 자정 전까지 그대로 유지됨)
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

  // 멱등성 없이 덮어쓰기: 같은 date row가 있으면 갱신
  const { error: upErr } = await supabase.from("results").upsert(
    {
      date: now.date,
      menu: winner.name,
      candidates,
      spun_at: new Date().toISOString(),
    },
    { onConflict: "date" },
  );

  if (upErr) {
    return new Response(JSON.stringify({ error: upErr.message }), {
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
