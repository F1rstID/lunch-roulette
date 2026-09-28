// 점심 룰렛 "다시 돌리기" Edge Function.
//
// 사용자가 오늘 결과를 다시 뽑고 싶을 때 브라우저가 호출한다.
// spin-roulette와 달리:
// - 시간 가드 없음 (언제든 재돌림 허용)
// - 멱등성 스킵 없음 (이미 결과가 있어도 진행)
// - 같은 날짜의 결과 행을 덮어쓴다 (날짜가 겹치면 갱신)
// - 후보는 오늘 후보 테이블과 매장 테이블의 조인에서 읽는다 (추첨 단위가 메뉴가 아니라 매장이다)
// - 설정 행에서 쿨다운 일수를 읽어 최근 당첨 매장을 후보에서 뺀다. 설정·쿨다운 조회가 실패해도
//   멈추지 않고 기본값으로 진행하며, 그 사실을 서버 로그 1건과 응답의 폴백 플래그로 드러낸다
// - 결과 행에는 당첨 매장의 이름 스냅샷과 매장 id 를 함께 쓴다 (매장이 지워져도 기록은 남는다)
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
import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
// KST 변환·난수 선택·쿨다운은 _shared/ 한 곳으로 합쳤다 (spin-roulette 와의 복붙 제거).
// 시간 가드가 없는 함수라 추첨 시각 모듈은 끌어오지 않는다 — 파서를 쓸 자리가 없다.
import { kstNow, pickRandom } from "../_shared/kst.ts";
import { applyCooldown, cooldownWindowStart } from "../_shared/cooldown.ts";

// lib/supabase/client.ts 의 행 타입을 그대로 쓸 수 없어(Deno 는 경로 별칭·확장자 규칙이 달라
// lib/ 를 import 하지 못한다) 필요한 최소 구조만 여기 다시 선언한다. 한쪽이 늘면 양쪽을 함께 고친다.
type Candidate = { restaurant_id: string; name: string };

// 조회 결과를 추론 타입으로 소비하지 않고 unknown 으로 받아 런타임에 좁힌다.
// 정적 추론은 매장 임베드를 배열이라고 주장하는데 실제 응답은 객체다 — 어느 쪽이 와도 같은 결과가
// 나오도록 한 줄로 접는다. 추론을 믿는 코드는 타입 검사를 통과하면서 매일 빈 값을 기록한다.
// 이 가드는 경합 방어가 아니라 형태 방어다: 후보 행의 매장 id 는 외래키 + 연쇄 삭제라
// "후보는 있는데 매장이 없는" 상태가 DB 에 존재할 수 없다. 응답 형태가 예상과 다를 때 후보 전부를
// 잃지 않으려고 남긴 장치이므로 도달 불가 코드로 보고 지우지 말 것.
// 형제 함수와 이름·시그니처·본문이 같다 — 두 파일을 나란히 놓고 차이를 세는 것이 리뷰 수단이다.
function normalizeCandidates(rows: unknown): { picked: Candidate[]; skipped: number } {
  if (!Array.isArray(rows)) return { picked: [], skipped: 0 };
  const list: unknown[] = rows;
  const picked: Candidate[] = [];
  let skipped = 0;
  for (const row of list) {
    if (typeof row !== "object" || row === null) { skipped++; continue; }
    if (!("restaurant_id" in row) || !("restaurants" in row)) { skipped++; continue; }
    const embed: unknown = row.restaurants;
    const one: unknown = Array.isArray(embed) ? embed[0] : embed;
    if (typeof one !== "object" || one === null || !("name" in one)) { skipped++; continue; }
    if (typeof row.restaurant_id !== "string" || typeof one.name !== "string") { skipped++; continue; }
    picked.push({ restaurant_id: row.restaurant_id, name: one.name }); // 담은 순서를 유지한다
  }
  return { picked, skipped };
}

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

  let cooldownDays = 0;
  let settingsFallback = false; // 설정을 못 읽어 기본값으로 갔다
  let cooldownSkipped = false; // 쿨다운 창 조회가 실패해 필터를 건너뛰었다
  let cooldownFallback = false; // 필터 결과가 0개라 전체 후보로 되돌렸다

  // 조회 열 목록을 형제 함수와 같게 둔다 — Phase 8 낭독에서 두 파일을 나란히 비교하기 위해서다.
  // 추첨 시각 값은 읽어 오되 쓰지 않는다: 이 함수에는 시간 가드가 없어 파서를 끌어올 자리가 없다.
  // 그래서 이 파일의 설정 폴백 플래그는 조회 실패에서만 오른다 (형제 쪽은 값 파싱 실패에서도 오른다).
  const { data: settingsRow, error: settingsErr } = await supabase
    .from("settings")
    .select("spin_time, cooldown_days")
    .eq("id", 1)
    .maybeSingle();

  if (settingsErr) {
    console.error(`설정 조회 실패(기본값으로 진행): ${settingsErr.message}`);
    settingsFallback = true;
  } else if (settingsRow) {
    // 여기 들어오지 못한 경우(행이 null)는 0행(아직 시드 안 됨)이고 에러가 아니다 — 플래그도 올리지 않는다.
    // 정수·양수 좁히기는 쿨다운 모듈이 흡수한다. 여기서 한 번 더 좁히면 판정처가 둘이 된다.
    cooldownDays = Number(settingsRow.cooldown_days);
  }

  // 오늘 후보 조회. 정렬 옵션을 주지 않으면 부모(후보 행) 정렬이다 — 임베드 정렬이 아니다.
  const { data: rows, error: candErr } = await supabase
    .from("candidates")
    .select("restaurant_id, created_at, restaurants ( id, name )")
    .order("created_at", { ascending: true });

  if (candErr) {
    console.error(`후보 조회 실패: ${candErr.message}`);
    // 응답에는 message 만 싣는다. 상세·힌트를 실으면 스키마가 호출자 쪽으로 샌다.
    // 이 본문은 배너를 통해 익명 사용자에게 그대로 보인다 — 실을 값을 고르는 자리다.
    return json({ error: candErr.message }, 500);
  }

  const { picked: candidates, skipped } = normalizeCandidates(rows);
  if (skipped > 0) console.error(`후보 ${skipped}건을 매장 조인 형태 불일치로 제외했다`);

  // 후보가 없으면 결과 행을 건드리지 않는다. 이 검사가 쿨다운보다 앞이라야 아래의 난수 선택이
  // 빈 배열을 받는 경로가 구조적으로 생기지 않는다.
  // 이 문자열은 클라이언트가 "후보가 없어요" 로 번역한다 — 바꾸면 화면 문구가 코드값으로 새어 나온다.
  if (candidates.length === 0) return json({ skipped: "no_candidates", date: now.date });

  let pool = candidates;
  const windowStart = cooldownWindowStart(now.date, cooldownDays);
  // 창이 없으면(쿨다운 0 = 기본 설정) 조회 자체를 하지 않는다 — 전환 전과 같은 쿼리 수를 유지한다.
  if (windowStart !== null) {
    const { data: recent, error: recentErr } = await supabase
      .from("results")
      .select("restaurant_id")
      .gte("date", windowStart)
      .lt("date", now.date);

    if (recentErr) {
      console.error(`쿨다운 창 조회 실패(미적용 진행): ${recentErr.message}`);
      cooldownSkipped = true;
    } else {
      // 빈 값을 미리 거르지 않는다 — 전환 이전 레거시 행을 무시하는 분기가 쿨다운 모듈 안에 있고,
      // 여기서 걸러 버리면 그 분기가 영원히 죽어 계약이 한쪽에서만 유지된다.
      const ids: (string | null)[] = (recent ?? []).map((r) =>
        typeof r.restaurant_id === "string" ? r.restaurant_id : null
      );
      const filtered = applyCooldown(candidates, ids);
      pool = filtered.picked;
      cooldownFallback = filtered.fellBack;
    }
  }

  // pool 이 비어 있지 않다는 전제는 코드 배치가 보장한다: 후보 0개 검사가 위에 있고, 쿨다운 조회
  // 실패 경로는 후보 전체를 그대로 쓰며, 쿨다운 모듈은 전멸 시 전체를 되돌린다. 순서를 바꾸면 깨진다.
  const winner = pickRandom(pool);
  // 스냅샷은 쿨다운 적용 전 후보 전체를 담은 순서 그대로 남긴다.
  const snapshot = candidates.map((c) => ({ name: c.name, restaurant_id: c.restaurant_id }));

  // 멱등성 없이 덮어쓰기: 같은 날짜 행이 있으면 갱신한다. 되돌릴 수 없는 쓰기라 위의 프리플라이트
  // 단락이 곧 무결성 장치다.
  const { error: upErr } = await supabase.from("results").upsert(
    {
      date: now.date,
      menu: winner.name,
      restaurant_id: winner.restaurant_id,
      candidates: snapshot,
      spun_at: new Date().toISOString(),
    },
    { onConflict: "date" },
  );

  if (upErr) {
    console.error(`결과 덮어쓰기 실패: ${upErr.message}`);
    return json({ error: upErr.message }, 500);
  }

  return json({
    ok: true,
    date: now.date,
    menu: winner.name,
    restaurant_id: winner.restaurant_id,
    candidate_count: candidates.length, // 쿨다운 적용 전
    picked_count: pool.length, // 쿨다운 적용 후
    cooldown_fallback: cooldownFallback,
    cooldown_skipped: cooldownSkipped,
    settings_fallback: settingsFallback,
  });
});
