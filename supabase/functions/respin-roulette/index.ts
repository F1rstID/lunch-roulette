// 점심 룰렛 "다시 돌리기" Edge Function.
//
// 사용자가 오늘 결과를 다시 뽑고 싶을 때 브라우저가 호출한다.
// spin-roulette와 달리:
// - 시간 가드 없음 (언제든 재돌림 허용)
// - 멱등성 스킵 없음 (이미 결과가 있어도 진행)
// - results를 upsert(onConflict: date)로 덮어쓴다
// DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용.
//
// 브라우저 호출이라 CORS 필수:
// - supabase-js invoke 는 apikey·authorization·content-type 커스텀 헤더를 붙여 POST 하므로
//   브라우저가 먼저 OPTIONS 프리플라이트를 보낸다.
// - Supabase 게이트웨이는 배포된 함수 응답에 CORS 헤더를 주입하지 않는다(직접 확인).
// - 따라서 함수가 직접 Access-Control-* 를 내려야 하고, OPTIONS 는 본문 로직(=재추첨,
//   멱등 아님) 을 실행하지 않도록 즉시 단락시켜야 한다. 안 그러면 프리플라이트가 respin 을
//   실행해 결과가 중복으로 덮어써진다.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// KST 변환·난수 선택은 _shared/ 한 곳으로 합쳤다 (spin-roulette 와의 복붙 제거).
// 시간 가드가 없는 함수라 spinTime.ts 는 끌어오지 않는다.
import { kstNow, pickRandom } from "../_shared/kst.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 모든 응답에 CORS + JSON 헤더를 붙인다.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // CORS 프리플라이트: 재추첨 로직을 실행하지 않고 즉시 응답한다.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    return json({ error: menuErr.message }, 500);
  }

  if (!menus || menus.length === 0) {
    return json({ skipped: "no_candidates", date: now.date });
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
    return json({ error: upErr.message }, 500);
  }

  return json({
    ok: true,
    date: now.date,
    menu: winner.name,
    candidate_count: menus.length,
  });
});
