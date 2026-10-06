// 점심 룰렛 추첨 Edge Function.
//
// pg_cron 이 매분 이 함수를 호출한다. 추첨 시각은 이 파일이 정하지 않는다 —
// 설정 행의 추첨 시각을 읽어 판정하고, 읽지 못하면 기본 시각으로 착지한다.
// - verify_jwt: false 로 배포 (cron이 익명 호출)
// - 안전장치 1: KST 시각이 설정된 추첨 시각 이전이면 거부 (조기 트리거 방지)
// - 안전장치 2: 같은 날짜의 결과 행이 이미 있으면 즉시 종료 (멱등성)
// - 후보는 오늘 후보 테이블과 매장 테이블의 조인에서 읽는다 (추첨 단위가 메뉴가 아니라 매장이다)
// - 설정·쿨다운·멱등 조회가 실패해도 멈추지 않고 기본값으로 진행한다. 대신 서버 로그 1건과
//   응답의 폴백 플래그로 드러낸다 — 하루 한 번뿐인 추첨을 잃지 않는 쪽이 설정을 정확히 존중하는
//   쪽보다 우선이다. 이 논증이 없으면 다음 사람이 "왜 여기서 안 멈추지" 로 되돌린다
// - 결과 행에는 당첨 매장의 이름 스냅샷과 매장 id 를 함께 쓴다 (매장이 지워져도 기록은 남는다)
// - 당첨 하나가 아니라 후보 전체의 순서(ranking)를 정해 함께 쓴다. 1번째가 당첨이다. 당첨 매장에 웨이팅이
//   걸렸을 때 갈 곳이 추첨 시각에 이미 정해져 있어야 "마음에 들 때까지 다시 뽑기" 가 되지 않는다(0006)
// - DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용
// - KST 변환·시각 판정·순서 결정·쿨다운은 _shared/ 한 곳으로 합쳤다 (respin-roulette 와의 복붙 제거)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.117.2";
import { kstNow } from "../_shared/kst.ts";
import { DEFAULT_SPIN_TIME, isAfterSpinTime, parseSpinTime } from "../_shared/spinTime.ts";
import { applyCooldown, cooldownWindowStart } from "../_shared/cooldown.ts";
import { rankCandidates } from "../_shared/ranking.ts";

// lib/supabase/client.ts 의 행 타입을 그대로 쓸 수 없어(Deno 는 경로 별칭·확장자 규칙이 달라
// lib/ 를 import 하지 못한다) 필요한 최소 구조만 여기 다시 선언한다. 한쪽이 늘면 양쪽을 함께 고친다.
type Candidate = { restaurant_id: string; name: string };

// 설정은 단일행이다 — 이 값을 정한 것은 0005 마이그레이션의 check (id = 1) 이고, 코드 쪽에는
// 출처 없는 맨 숫자만 남아 있었다. 이름을 붙여 둬야 "왜 하필 1인가" 를 다시 묻지 않는다.
const SETTINGS_ROW_ID = 1;

// 조회 결과를 추론 타입으로 소비하지 않고 unknown 으로 받아 런타임에 좁힌다.
// 정적 추론은 매장 임베드를 배열이라고 주장하는데 실제 응답은 객체다 — 어느 쪽이 와도 같은 결과가
// 나오도록 한 줄로 접는다. 추론을 믿는 코드는 타입 검사를 통과하면서 매일 빈 값을 기록한다.
// 이 가드는 경합 방어가 아니라 형태 방어다: 후보 행의 매장 id 는 외래키 + 연쇄 삭제라
// "후보는 있는데 매장이 없는" 상태가 DB 에 존재할 수 없다. 응답 형태가 예상과 다를 때 후보 전부를
// 잃지 않으려고 남긴 장치이므로 도달 불가 코드로 보고 지우지 말 것.
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
    picked.push({ restaurant_id: row.restaurant_id, name: one.name }); // 담은 순서를 유지한다
  }
  return { picked, excluded: excludedIds.length, excludedIds };
}

// 모든 응답에 JSON 헤더를 붙인다. 형제 함수와 달리 CORS 헤더는 붙이지 않는다 — 호출자가
// pg_cron(서버측)이라 프리플라이트 자체가 없다. 빠뜨린 것이 아니므로 다시 넣지 말 것.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async () => {
  try {
    const now = kstNow();

    // 클라이언트 생성이 시각 판정보다 위로 올라온다 — 판정 기준 자체가 DB 의 설정값이기 때문이다.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let spinTime = DEFAULT_SPIN_TIME;
    let cooldownDays = 0;
    let settingsFallback = false; // 설정을 못 읽거나 못 읽힌 값이어서 기본값으로 갔다
    let cooldownSkipped = false; // 쿨다운 창 조회가 실패해 필터를 건너뛰었다
    let cooldownFallback = false; // 필터 결과가 0개라 전체 후보로 되돌렸다

    const { data: settingsRow, error: settingsErr } = await supabase
      .from("settings")
      .select("spin_time, cooldown_days")
      .eq("id", SETTINGS_ROW_ID)
      .maybeSingle();

    if (settingsErr) {
      console.error(`설정 조회 실패(기본값으로 진행): ${settingsErr.message}`);
      settingsFallback = true;
    } else if (settingsRow) {
      // 여기 들어오지 못한 경우(행이 null)는 0행(아직 시드 안 됨)이고 에러가 아니다 — 플래그도 올리지 않는다.
      // 행의 필드는 타입 검사를 전혀 받지 않고 들어온다(스키마 제네릭 없는 클라이언트). 좁히기는 규율이 한다.
      const parsed = typeof settingsRow.spin_time === "string"
        ? parseSpinTime(settingsRow.spin_time)
        : null;
      if (parsed) {
        spinTime = parsed;
      } else {
        // 값이 문자열이 아닐 수도 있는 자리라 템플릿 보간 대신 직렬화해서 남긴다.
        console.error(
          `추첨 시각 설정값을 읽지 못했다(기본값으로 진행): ${JSON.stringify(settingsRow.spin_time)}`,
        );
        settingsFallback = true;
      }
      // 정수·양수 좁히기는 쿨다운 모듈이 흡수한다. 여기서 한 번 더 좁히면 판정처가 둘이 된다.
      cooldownDays = Number(settingsRow.cooldown_days);
    }

    if (!isAfterSpinTime(now, spinTime)) {
      // 분해된 8필드를 줄이지 않고 그대로 싣는다 — cron 로그에서 함수가 본 시각을 보는 유일한 창이다.
      return json({ skipped: "before_spin_time", kst: now });
    }

    // 멱등성: 이미 오늘 결과 있으면 종료
    const { data: existing, error: existErr } = await supabase
      .from("results")
      .select("date, menu, restaurant_id")
      .eq("date", now.date)
      .maybeSingle();

    // 조회 실패를 삼키지 않되 멈추지도 않는다. 여기서 500 을 내면 그날 추첨만 잃고, 중복 기록은
    // 날짜 유니크 제약이 최종 보험으로 막아 준다(아래 레이스 분기로 착지한다).
    if (existErr) console.error(`오늘 결과 조회 실패(진행): ${existErr.message}`);

    if (existing) {
      return json({
        skipped: "already_decided",
        date: now.date,
        menu: existing.menu,
        restaurant_id: existing.restaurant_id,
      });
    }

    // 오늘 후보 조회. 정렬 옵션을 주지 않으면 부모(후보 행) 정렬이다 — 임베드 정렬이 아니다.
    const { data: rows, error: candErr } = await supabase
      .from("candidates")
      .select("restaurant_id, created_at, restaurants ( id, name )")
      .order("created_at", { ascending: true });

    if (candErr) {
      console.error(`후보 조회 실패: ${candErr.message}`);
      // 응답에는 message 만 싣는다. 상세·힌트를 실으면 스키마가 호출자 쪽으로 샌다.
      return json({ error: candErr.message }, 500);
    }

    const { picked: candidates, excluded, excludedIds } = normalizeCandidates(rows);
    if (excluded > 0) {
      console.error(`후보 ${excluded}건을 매장 조인 형태 불일치로 제외했다: ${excludedIds.join(", ")}`);
    }

    // 후보가 없으면 결과 행을 만들지 않는다. 이 검사가 쿨다운보다 앞이라야 아래의 난수 선택이
    // 빈 배열을 받는 경로가 구조적으로 생기지 않는다.
    // 제외 건수를 함께 싣는다 — 이게 없으면 "후보 테이블이 비었다" 와 "조인이 깨져 전부 떨어졌다" 가
    // 응답에서 바이트 단위로 같아져, 로그를 열기 전까지 구분할 수 없다.
    if (candidates.length === 0) {
      return json({ skipped: "no_candidates", date: now.date, excluded_count: excluded });
    }

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
    // 순위는 쿨다운을 거친 pool 의 순열이다 — 쿨다운에 걸린 매장은 오늘 갈 수 없으니 예비에도 없다.
    const ranking = rankCandidates(pool);
    const winner = ranking[0];
    // 스냅샷은 쿨다운 적용 전 후보 전체를 담은 순서 그대로 남긴다.
    const snapshot = candidates.map((c) => ({ name: c.name, restaurant_id: c.restaurant_id }));

    const { error: insErr } = await supabase.from("results").insert({
      date: now.date,
      menu: winner.name,
      restaurant_id: winner.restaurant_id,
      candidates: snapshot,
      ranking,
    });

    if (insErr) {
      // 동시에 두 번 호출됐다면 unique date 제약으로 거부될 수 있음 — 정상 시나리오
      if (insErr.code === "23505") {
        return json({ skipped: "race_already_decided", date: now.date });
      }
      console.error(`결과 기록 실패: ${insErr.message}`);
      return json({ error: insErr.message }, 500);
    }

    return json({
      ok: true,
      date: now.date,
      menu: winner.name,
      restaurant_id: winner.restaurant_id,
      candidate_count: candidates.length, // 쿨다운 적용 전
      picked_count: pool.length, // 쿨다운 적용 후
      excluded_count: excluded, // 조인 형태 불일치로 버린 행. 폴백 플래그와 같은 독법 — 0 이 정상
      cooldown_fallback: cooldownFallback,
      cooldown_skipped: cooldownSkipped,
      settings_fallback: settingsFallback,
    });
  } catch (e) {
    // 던져진 예외는 반환이 아니라서 json() 을 지나지 않는다. 여기서 받지 않으면 런타임이 기본
    // 500 을 내고 이 파일이 정한 헤더도 로그도 붙지 않아, cron 로그에는 실패한 흔적조차 남지
    // 않는다. 환경변수 미주입 같은 부팅 실패가 그 경로다.
    console.error(`처리되지 않은 예외: ${e instanceof Error ? e.message : String(e)}`);
    return json({ error: "internal_error" }, 500);
  }
});
