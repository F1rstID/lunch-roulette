// 점심 룰렛 "다시 돌리기" Edge Function.
//
// 사용자가 오늘 결과를 다시 뽑고 싶을 때 브라우저가 호출한다.
// spin-roulette와 달리:
// - 시간 가드 없음 (언제든 재돌림 허용)
// - 멱등성 스킵 없음 (이미 결과가 있어도 진행)
// - 같은 날짜의 결과 행을 덮어쓴다 (날짜가 겹치면 갱신)
// - 후보는 오늘 후보 테이블과 매장 테이블의 조인에서 읽는다 (추첨 단위가 메뉴가 아니라 매장이다)
// - 이번 주(월~어제) 간 매장과 "이번 주 쉬기" 매장은 pool 에서 뺀다(0007, 형제와 같은 규칙). 쉬기로 전멸하면
//   결과 행을 건드리지 않고 all_paused 로 끝낸다 — 쉬기를 몰래 되살리지 않는다. 설정·주간 창 조회가 실패해도
//   멈추지 않고 기본값으로 진행하며, 그 사실을 서버 로그 1건과 응답의 폴백 플래그로 드러낸다
// - lunch_days 는 읽기만 한다. 다시 돌리기 전에 고른 목적지는 spun_at 비교로 코드가 무시하므로 여기서 지울 일이 없다
// - 결과 행에는 당첨 매장의 이름 스냅샷과 매장 id 를 함께 쓴다 (매장이 지워져도 기록은 남는다)
// - 후보 전체의 순서(ranking)도 새로 정해 함께 덮어쓴다. 1번째가 당첨이다. 2순위만 다시 뽑는 길은 두지 않는다 —
//   두면 마음에 들 때까지 돌린다(0006)
// DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용.
//
// 브라우저 호출이라 CORS 필수:
// - supabase-js invoke 는 apikey·authorization·content-type 커스텀 헤더를 붙여 POST 하므로
//   브라우저가 먼저 OPTIONS 프리플라이트를 보낸다.
// - Supabase 게이트웨이는 배포된 함수 응답에 CORS 헤더를 주입하지 않는다(직접 확인).
// - 따라서 함수가 직접 Access-Control-* 를 내려야 하고, OPTIONS 는 본문 로직(=재추첨,
//   멱등 아님) 을 실행하지 않도록 즉시 단락시켜야 한다. 안 그러면 프리플라이트가 respin 을
//   실행해 결과가 중복으로 덮어써진다.
// - 다만 그 단락은 OPTIONS 한 메서드만 거른다. 되돌릴 수 없는 쓰기를 지키는 것은 그 아래의
//   POST 검사다 — GET·HEAD 는 프리플라이트 없이 곧장 오고(링크 미리보기 봇·주소창 입력),
//   Allow-Methods 헤더는 브라우저의 교차 출처 요청만 제한할 뿐 비브라우저 호출을 막지 못한다.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
// KST 변환·순서 결정·주간 제외는 _shared/ 한 곳으로 합쳤다 (spin-roulette 와의 복붙 제거).
// 시간 가드가 없는 함수라 추첨 시각 모듈은 끌어오지 않는다 — 파서를 쓸 자리가 없다.
import { kstNow } from "../_shared/kst.ts";
import {
  applyWeeklyExclusions,
  dayExclusionId,
  type DayVisitRef,
  weekStartOf,
  weeklyWindowStart,
} from "../_shared/cooldown.ts";
import { rankCandidates } from "../_shared/ranking.ts";

// lib/supabase/client.ts 의 행 타입을 그대로 쓸 수 없어(Deno 는 경로 별칭·확장자 규칙이 달라
// lib/ 를 import 하지 못한다) 필요한 최소 구조만 여기 다시 선언한다. 한쪽이 늘면 양쪽을 함께 고친다.
// paused_week 는 "이번 주 쉬기" 의 월요일 날짜다 — 활성 판정(이번 주 월요일과 같은가)은 아래 본문이 한다.
type Candidate = { restaurant_id: string; name: string; paused_week: string | null };

// 설정은 단일행이다 — 이 값을 정한 것은 0005 마이그레이션의 check (id = 1) 이고, 코드 쪽에는
// 출처 없는 맨 숫자만 남아 있었다. 이름을 붙여 둬야 "왜 하필 1인가" 를 다시 묻지 않는다.
const SETTINGS_ROW_ID = 1;

// 조회 결과를 추론 타입으로 소비하지 않고 unknown 으로 받아 런타임에 좁힌다.
// 정적 추론은 매장 임베드를 배열이라고 주장하는데 실제 응답은 객체다 — 어느 쪽이 와도 같은 결과가
// 나오도록 한 줄로 접는다. 추론을 믿는 코드는 타입 검사를 통과하면서 매일 빈 값을 기록한다.
// 이 가드는 경합 방어가 아니라 형태 방어다: 후보 행의 매장 id 는 외래키 + 연쇄 삭제라
// "후보는 있는데 매장이 없는" 상태가 DB 에 존재할 수 없다. 응답 형태가 예상과 다를 때 후보 전부를
// 잃지 않으려고 남긴 장치이므로 도달 불가 코드로 보고 지우지 말 것.
// 형제 함수와 이름·시그니처·본문이 같다 — 두 파일을 나란히 놓고 차이를 세는 것이 리뷰 수단이다.
// 반환 필드가 excluded 인 이유: 응답의 skipped 는 "건너뛴 사유" 라는 다른 뜻이라, 같은 이름을
// 쓰면 한 화면 안에서 숫자와 사유 문자열이 같은 낱말로 불린다.
function normalizeCandidates(
  rows: unknown,
): { picked: Candidate[]; excluded: number; excludedIds: string[] } {
  // 배열이 아닌 응답은 "후보 0행" 이 아니라 "형태 불일치 1건" 이다. 0 을 돌려주면 호출부의 로그가
  // 켜지지 않아, 형태 방어가 실제로 작동한 사실이 로그에도 응답에도 남지 않는다.
  if (!Array.isArray(rows)) {
    return { picked: [], excluded: 1, excludedIds: [`<비배열:${rows === null ? "null" : typeof rows}>`] };
  }
  const list: unknown[] = rows;
  const picked: Candidate[] = [];
  const excludedIds: string[] = [];
  for (let index = 0; index < list.length; index++) {
    const row: unknown = list[index];
    // 제외 목록에는 건수가 아니라 "어느 매장" 을 싣는다 — 조인이 깨졌을 때 후보 화면과 대조할
    // 좌표가 된다. id 조차 읽을 수 없는 행은 담은 순서의 인덱스로 부른다.
    const id: unknown = typeof row === "object" && row !== null && "restaurant_id" in row
      ? row.restaurant_id
      : null;
    const label = typeof id === "string" ? id : `#${index}`;
    if (typeof row !== "object" || row === null) { excludedIds.push(label); continue; }
    if (!("restaurant_id" in row) || !("restaurants" in row)) { excludedIds.push(label); continue; }
    const embed: unknown = row.restaurants;
    const one: unknown = Array.isArray(embed) ? embed[0] : embed;
    if (typeof one !== "object" || one === null || !("name" in one)) { excludedIds.push(label); continue; }
    if (typeof row.restaurant_id !== "string" || typeof one.name !== "string") { excludedIds.push(label); continue; }
    // paused_week 는 제외 판정이 아니라 형태 방어다 — 문자열이 아니면 "쉬지 않음" 으로 읽는다(컬럼 부재는 임베드 조회가 먼저 거부한다).
    const pausedWeek: unknown = "paused_week" in one ? one.paused_week : null;
    picked.push({
      restaurant_id: row.restaurant_id,
      name: one.name,
      paused_week: typeof pausedWeek === "string" ? pausedWeek : null,
    }); // 담은 순서를 유지한다
  }
  return { picked, excluded: excludedIds.length, excludedIds };
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
  try {
    // CORS 프리플라이트: 재추첨 로직을 실행하지 않고 즉시 응답한다.
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // 되돌릴 수 없는 쓰기는 POST 로만 받는다. 이 검사가 없으면 함수 URL 한 줄이 곧 실행이다 —
    // GET 은 프리플라이트가 없어 링크 미리보기 봇·주소창 입력만으로 본문이 돌고(HEAD 도 같다),
    // 그때마다 오늘 결과가 덮어써져 모든 탭의 휠이 다시 돈다.
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    const now = kstNow();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let settingsFallback = false; // 설정을 못 읽어 기본값으로 갔다
    let weeklySkipped = false; // 주간 창 조회가 실패해 방문 제외를 건너뛰었다(쉬기 제외는 후보 행에 실려 와 그대로 적용된다)
    let weeklyFallback = false; // 방문 제외 결과가 0개라 쉬기만 뺀 후보로 되돌렸다

    // 조회 열 목록을 형제 함수와 같게 둔다 — 낭독에서 두 파일을 나란히 비교하기 위해서다. 쿨다운 일수는 더 읽지 않는다(0007).
    // 이 함수는 설정값을 쓰지 않는다(시간 가드가 없다). 조회를 남기는 이유는 형제 대칭과 settings_fallback 플래그 하나다 —
    // 설정 표가 깨진 날 다시 돌리기 응답에서도 그 사실이 보여야 한다.
    const { error: settingsErr } = await supabase
      .from("settings")
      .select("spin_time")
      .eq("id", SETTINGS_ROW_ID)
      .maybeSingle();

    if (settingsErr) {
      console.error(`설정 조회 실패(기본값으로 진행): ${settingsErr.message}`);
      settingsFallback = true;
    }

    // 오늘 후보 조회. 정렬 옵션을 주지 않으면 부모(후보 행) 정렬이다 — 임베드 정렬이 아니다.
    const { data: rows, error: candErr } = await supabase
      .from("candidates")
      .select("restaurant_id, created_at, restaurants ( id, name, paused_week )")
      .order("created_at", { ascending: true });

    if (candErr) {
      console.error(`후보 조회 실패: ${candErr.message}`);
      // 응답에는 message 만 싣는다. 상세·힌트를 실으면 스키마가 호출자 쪽으로 샌다.
      // 이 본문은 배너를 통해 익명 사용자에게 그대로 보인다 — 실을 값을 고르는 자리다.
      return json({ error: candErr.message }, 500);
    }

    const { picked: candidates, excluded, excludedIds } = normalizeCandidates(rows);
    if (excluded > 0) {
      console.error(`후보 ${excluded}건을 매장 조인 형태 불일치로 제외했다: ${excludedIds.join(", ")}`);
    }

    // 후보가 없으면 결과 행을 건드리지 않는다. 이 검사가 주간 제외보다 앞이라야 "후보 없음" 과 "전부 쉬기" 가
    // 응답에서 갈린다 — 둘은 사람이 할 일이 다르다(후보 담기 / 쉬기 해제).
    // 이 문자열은 클라이언트가 "후보가 없어요" 로 번역한다 — 바꾸면 화면 문구가 코드값으로 새어 나온다.
    // 제외 건수를 함께 싣는다 — 이게 없으면 "후보 테이블이 비었다" 와 "조인이 깨져 전부 떨어졌다" 가
    // 응답에서 바이트 단위로 같아져, 화면에 후보가 보이는데도 배너만 "후보가 없어요" 로 끝난다.
    if (candidates.length === 0) {
      return json({ skipped: "no_candidates", date: now.date, excluded_count: excluded });
    }

    // 이번 주 제외 — 형제(spin-roulette)와 같은 블록이다. 쉬기는 paused_week 가 이번 주 월요일과 같을 때만 활성이고
    // 월요일에도 적용된다. 방문 제외의 창 [weekStart, today) 는 월요일에 없다(null). 오늘은 창에 안 들어간다 —
    // 그래서 다시 돌리기가 오늘 목적지 매장을 다시 뽑을 수 있다.
    const weekStart = weekStartOf(now.date, now.weekday);
    const windowStart = weeklyWindowStart(now.date, now.weekday);
    // weekStart 가 null(오염 날짜)이면 쉬기를 적용하지 않는다 — null === null 로 쉬지 않는 매장 전원이 걸려 all_paused 가 된다.
    const pausedIds = weekStart === null
      ? []
      : candidates.filter((c) => c.paused_week === weekStart).map((c) => c.restaurant_id);
    const visitedIds: (string | null)[] = [];
    if (windowStart !== null) {
      // 창 조회 둘 — 그 주의 결과 행(당첨·추첨 시각)과 점심 기록(목적지·방문). 날짜로 조인해 하루의 제외 id 를 정한다.
      // 어느 하나라도 실패하면 방문 제외만 건너뛴다(쉬기는 후보 행에 실려 와 이미 손에 있다).
      const [{ data: winners, error: winnersErr }, { data: days, error: daysErr }] = await Promise.all([
        supabase
          .from("results")
          .select("date, restaurant_id, spun_at")
          .gte("date", windowStart)
          .lt("date", now.date),
        supabase
          .from("lunch_days")
          .select("date, destination_id, destination_set_at, visit_status, visited_id")
          .gte("date", windowStart)
          .lt("date", now.date),
      ]);

      if (winnersErr) console.error(`주간 결과 창 조회 실패(방문 제외 미적용 진행): ${winnersErr.message}`);
      if (daysErr) console.error(`주간 기록 창 조회 실패(방문 제외 미적용 진행): ${daysErr.message}`);
      if (winnersErr || daysErr) {
        weeklySkipped = true;
      } else {
        // 행의 필드는 타입 검사를 받지 않고 들어온다(스키마 제네릭 없는 클라이언트). 좁히기는 규율이 한다.
        // 빈 restaurant_id 를 미리 거르지 않는다 — 지워진 매장의 set-null 을 무시하는 분기가 제외 모듈 안에 있다.
        const dayByDate = new Map<string, DayVisitRef>();
        for (const d of days ?? []) {
          if (typeof d.date !== "string") continue;
          dayByDate.set(d.date, {
            destination_id: typeof d.destination_id === "string" ? d.destination_id : null,
            destination_set_at: typeof d.destination_set_at === "string" ? d.destination_set_at : null,
            visit_status: d.visit_status === "visited" || d.visit_status === "skipped" ? d.visit_status : "unknown",
            visited_id: typeof d.visited_id === "string" ? d.visited_id : null,
          });
        }
        for (const w of winners ?? []) {
          if (typeof w.date !== "string") continue;
          visitedIds.push(
            dayExclusionId(
              {
                restaurant_id: typeof w.restaurant_id === "string" ? w.restaurant_id : null,
                spun_at: typeof w.spun_at === "string" ? w.spun_at : "",
              },
              dayByDate.get(w.date) ?? null,
            ),
          );
        }
      }
    }

    const exclusion = applyWeeklyExclusions(candidates, { pausedIds, visitedIds });
    if (exclusion.allPaused) {
      // 쉬기 매장을 몰래 되살리지 않는다. 오늘 결과 행도 건드리지 않는다(있으면 그대로, 없으면 stalled).
      // 이 문자열은 클라이언트가 "후보가 전부 이번 주 쉬기 중이에요" 로 번역한다 — 바꾸면 화면 문구가 코드값으로 새어 나온다.
      return json({
        skipped: "all_paused",
        date: now.date,
        candidate_count: candidates.length,
        excluded_count: excluded,
      });
    }
    const pool = exclusion.picked;
    weeklyFallback = exclusion.fellBack;

    // pool 이 비어 있지 않다는 전제는 코드 배치가 보장한다: 후보 0개 검사가 위에 있고, 전부 쉬기는 바로 위에서
    // 반환했으며, 제외 모듈은 방문으로 전멸하면 쉬기만 뺀 후보로 되돌린다. 순서를 바꾸면 깨진다.
    // 순위는 pool 의 순열이다. 보통은 제외를 거친 후보라 이번 주 간 매장은 예비에도 없지만, 방문으로 전멸한 날은
    // 쉬기만 뺀 후보로 되돌리므로 그날의 2·3순위에는 이번 주 간 매장이 들어온다.
    const ranking = rankCandidates(pool);
    const winner = ranking[0];
    // 스냅샷은 제외 적용 전 후보 전체를 담은 순서 그대로 남긴다 — 기록 상세의 "후보 목록" 은 그날 담긴 것의 사실이다.
    const snapshot = candidates.map((c) => ({ name: c.name, restaurant_id: c.restaurant_id }));

    // 멱등성 없이 덮어쓰기: 같은 날짜 행이 있으면 갱신한다. 되돌릴 수 없는 쓰기라 위의 POST 검사가
    // 무결성 장치다 — 프리플라이트 단락은 OPTIONS 한 메서드만 거르므로 그것만으로는 부족하다.
    const { error: upErr } = await supabase.from("results").upsert(
      {
        date: now.date,
        menu: winner.name,
        restaurant_id: winner.restaurant_id,
        candidates: snapshot,
        ranking,
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
      candidate_count: candidates.length, // 주간 제외 적용 전
      picked_count: pool.length, // 주간 제외 적용 후
      excluded_count: excluded, // 조인 형태 불일치로 버린 행. 폴백 플래그와 같은 독법 — 0 이 정상
      weekly_fallback: weeklyFallback,
      weekly_skipped: weeklySkipped,
      settings_fallback: settingsFallback,
    });
  } catch (e) {
    // 던져진 예외는 반환이 아니라서 json() 을 지나지 않는다 — 런타임 기본 500 에는 CORS 헤더가
    // 없어 브라우저가 본문을 차단하고, 그러면 클라이언트는 FunctionsFetchError 만 받아 실패
    // 사유를 읽는 경로가 통째로 죽는다. "모든 반환이 json() 을 지난다" 는 return 에만 참이었다.
    console.error(`처리되지 않은 예외: ${e instanceof Error ? e.message : String(e)}`);
    return json({ error: "internal_error" }, 500);
  }
});
