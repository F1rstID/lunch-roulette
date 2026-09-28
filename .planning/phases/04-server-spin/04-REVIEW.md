---
phase: 04-server-spin
reviewed: 2026-09-28T07:55:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - supabase/functions/spin-roulette/index.ts
  - supabase/functions/respin-roulette/index.ts
  - supabase/functions/_shared/edgeImports.test.ts
  - supabase/functions/_shared/spinTime.test.ts
  - supabase/functions/deno.json
  - supabase/functions/deno.lock
  - lib/errors.ts
  - lib/errors.test.ts
  - lib/supabase/client.ts
  - app/page.tsx
  - package.json
findings:
  critical: 0
  warning: 4
  info: 12
  total: 16
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-28T07:55:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 4 가 재작성한 두 Edge Function(`spin-roulette`·`respin-roulette`), 그 텍스트 계약(`edgeImports.test.ts` 50건), `deno check` 게이트(`deno.json`·`deno.lock`·`check:edge`), 클라이언트 쪽 `respin()` 500 본문 표면화(`app/page.tsx`·`lib/errors.ts`)를 base `65c94b4` 대비 diff 와 현행 전문으로 읽었다. 검증 환경 실측: `npm test` 219/219 (10 files), `npx tsc --noEmit` exit 0, `npm run check:edge` exit 0, 실행 후 `git status` 에 `deno.lock` 드리프트 없음. `results.date` 의 `unique` (0001:13) 가 `23505` 분기와 `onConflict: "date"` 의 전제임을 마이그레이션 원문으로 확인했다.

**설계 결정(D-01~D-18) 위반은 없다.** D-05 순서(시각 판정 → 멱등 → 후보 → 쿨다운 → 기록)는 코드 배치와 계약 #31 이 일치하고, 쿨다운 창 `[gte windowStart, lt today]` 는 03-CONTEXT D-05 의 "오늘 제외" 의미와 맞으며, 날짜 키는 양쪽 모두 `kstNow().date` 한 경로에서 나온다. `normalizeCandidates` 는 `null`·빈 배열·비문자열 `name`·비문자열 `restaurant_id` 를 전부 제외하고(스크래치 실행으로 재현), 배열/객체 임베드 양쪽에서 같은 값에 도달한다. `formatRespinError` 의 출력은 `ErrorBanner` 가 `<span>{message}</span>` 로 렌더하므로 XSS 경로가 없다. `invoke()` 반환의 `response` 가 미독 `Response` 라는 D-12 전제는 설치본 `FunctionsClient.js` 로 확인했다.

Critical 은 없다. Warning 4건은 (1) `respin-roulette` 가 GET/HEAD 에도 되돌릴 수 없는 덮어쓰기를 실행하는데 파일 머리 주석은 OPTIONS 단락을 "무결성 장치" 라 부르는 점, (2) `normalizeCandidates` 의 형태 실패가 `no_candidates` 와 응답에서 구분되지 않는 점(비배열 입력은 로그조차 없다), (3) `formatRespinError` 가 게이트웨이의 `{ code, message }` 형태(verify_jwt 오배포 401 — CLAUDE.md 가 지목한 최대 배포 함정)를 못 읽는 점, (4) 계약 테스트의 `console.error` 하한 단언이 D-10 "경로마다 1건" 을 실제로는 지키지 못하고 쿨다운 창 경계·`no_candidates` 문자열을 고정하지 않는 점이다. Info 12건은 이름 충돌·미사용 컬럼·테스트 도구의 사각지대·설계 재논의 제안이다.

## Narrative Findings (AI reviewer)

## Critical Issues

없음.

## Warnings

### WR-01: `respin-roulette` 는 POST 가 아닌 요청(GET·HEAD)에도 오늘 결과를 덮어쓴다 — 머리 주석의 "프리플라이트 단락이 곧 무결성 장치" 는 사실이 아니다

**File:** `supabase/functions/respin-roulette/index.ts:71-75`, `:159-160`, `:57-61`
**Issue:** 핸들러는 `req.method === "OPTIONS"` 만 단락시키고(`:73`) 그 외 모든 메서드에서 본문(설정 → 후보 → 쿨다운 → `upsert`)을 실행한다. `Access-Control-Allow-Methods: "POST, OPTIONS"` (`:60`) 는 브라우저의 교차 출처 요청만 제한할 뿐, 같은 출처·비브라우저·단순 요청(GET 은 프리플라이트가 없다)은 막지 않는다. `:159-160` 주석은 "되돌릴 수 없는 쓰기라 위의 프리플라이트 단락이 곧 무결성 장치다" 라고 적었지만 이 단락은 OPTIONS 한 메서드만 거른다. 이 구조는 base 에도 있었으나(`8944712`), 이번 페이즈가 본문을 재작성하면서 이 주석을 새로 추가해 잘못된 불변식을 문서화했다. "인증·레이트리밋 없음" 설계(D-07)는 그대로 두더라도, 멱등하지 않은 쓰기를 멱등 메서드로 노출하는 것은 별개의 결함이다.
**재현:** 함수 URL 을 Slack·Notion 에 붙여넣으면 언퍼링 봇이 GET 을 보낸다 → `Deno.serve` 핸들러가 본문을 실행 → 오늘 `results` 행이 새 당첨 매장으로 덮어써지고 Realtime UPDATE 로 모든 탭의 휠이 재회전한다. `curl -X GET https://<ref>.supabase.co/functions/v1/respin-roulette` 한 줄로도 같다(verify_jwt=false). 브라우저 주소창에 직접 입력해도 같다.
**Fix:**
```ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // 되돌릴 수 없는 쓰기는 POST 로만 받는다. GET 은 프리플라이트가 없어 링크 미리보기·주소창 입력만으로
  // 실행되고, HEAD 도 마찬가지다. OPTIONS 단락은 브라우저 프리플라이트만 거르므로 이 검사가 무결성 장치다.
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  const now = kstNow();
```
`json()` 을 지나므로 계약 #45(`new Response(` 2회) 는 그대로 통과한다. `:159-160` 주석은 "프리플라이트 단락 + POST 검사" 로 정정한다. `edgeImports.test.ts` 에 `count(respin, /req\.method !== "POST"/g)` 1 단언을 #22 옆에 추가하면 되돌림을 막는다.

### WR-02: `normalizeCandidates` 의 형태 실패가 응답에서 `no_candidates` 와 구분되지 않고, 비배열 입력은 로그조차 남기지 않는다

**File:** `supabase/functions/spin-roulette/index.ts:33`, `:135-140`; `supabase/functions/respin-roulette/index.ts:41`, `:120-126`
**Issue:** 세 갈래가 겹친다. (a) `:33`/`:41` 의 `if (!Array.isArray(rows)) return { picked: [], skipped: 0 }` 는 헬퍼 주석이 스스로 "응답 형태가 예상과 다를 때 … 남긴 장치" 라 부른 바로 그 경로인데 `skipped: 0` 을 돌려주므로 `:136`/`:121` 의 `if (skipped > 0)` 로그가 켜지지 않는다 — 형태 방어 장치가 방어에 성공한 사실을 아무 데도 남기지 않는다(B-5 위반). 스크래치 실행: `normalizeCandidates(null)`·`normalizeCandidates("oops")`·`normalizeCandidates({…})` 모두 `{picked:[],skipped:0}`. (b) 행 전부가 형태 검사에서 떨어지면(Pitfall 1 시나리오 — 임베드가 배열도 객체도 아닌 예상 밖 형태) 응답은 `{ skipped: "no_candidates", date }` 로, 후보 테이블이 진짜 비어 있을 때와 바이트 단위로 같다. `console.error` 는 Edge 로그에만 남고 응답(pg_net `net._http_response`·클라이언트 배너)에는 제외 건수가 없다. (c) `:136`/`:121` 로그는 건수만 싣고 어느 `restaurant_id` 가 어떤 형태로 왔는지 싣지 않아 D-10 의 "무엇이·어떤 값으로" 를 못 채운다.
**재현:** 컷오버 후 후보 5개를 담았는데 PostgREST 임베드 키 이름이 다르게 왔다고 가정(예: 별칭·스키마 변경). 매분 폴링 응답은 전부 `no_candidates`, 사용자가 "다시 돌리기" 를 누르면 배너에 "다시 돌리기 건너뜀: 후보가 없어요" 가 뜨는데 화면에는 후보 5개가 보인다. 응답만 봐서는 "테이블이 비었다" 와 "조인이 깨졌다" 를 구분할 수 없다.
**Fix:** (두 파일 동일하게)
```ts
function normalizeCandidates(rows: unknown): { picked: Candidate[]; excluded: number; excludedIds: string[] } {
  // 배열이 아닌 것은 "0행" 이 아니라 "형태 불일치 1건" 이다. 0 을 돌려주면 아래 로그가 켜지지 않는다.
  if (!Array.isArray(rows)) return { picked: [], excluded: 1, excludedIds: [String(rows)] };
  const list: unknown[] = rows;
  const picked: Candidate[] = [];
  const excludedIds: string[] = [];
  for (const row of list) {
    const id = typeof row === "object" && row !== null && "restaurant_id" in row ? String(row.restaurant_id) : "?";
    // … 기존 좁히기; 각 continue 앞에 excludedIds.push(id)
  }
  return { picked, excluded: excludedIds.length, excludedIds };
}
// 호출부
const { picked: candidates, excluded, excludedIds } = normalizeCandidates(rows);
if (excluded > 0) console.error(`후보 ${excluded}건을 매장 조인 형태 불일치로 제외했다: ${excludedIds.join(",")}`);
if (candidates.length === 0) return json({ skipped: "no_candidates", date: now.date, excluded_count: excluded });
// ok 응답에도 excluded_count: excluded 를 싣는다 — 폴백 플래그 3종과 같은 독법(0 이 정상)
```
계약 #47 은 `function normalizeCandidates(` 만 보므로 시그니처 변경에 영향 없다. `no_candidates` 응답에 `excluded_count` 가 실리면 `app/page.tsx:227-231` 의 번역도 "후보가 없어요" 와 "후보 N건을 읽지 못했어요" 로 갈라 쓸 수 있다.

### WR-03: `formatRespinError` 는 함수 자체가 만든 `{ error }` 형태만 읽고, 게이트웨이·런타임의 non-2xx 본문(`{ code, message }`)은 버린다

**File:** `lib/errors.ts:25-31`; `lib/errors.test.ts:44-62`
**Issue:** 이 헬퍼가 가장 필요한 순간은 함수 본문이 돌지 못한 경우다 — CLAUDE.md 가 "true 로 배포되면 401 로 추첨이 조용히 멈춘다" 로 지목한 verify_jwt 오배포는 Supabase 게이트웨이가 `{"code":401,"message":"Invalid JWT"}` 를 돌려주고, 워커 부팅 실패는 `{"code":"BOOT_ERROR","message":"…"}` 형태다. 둘 다 `error` 키가 없어 `:26` 의 `"error" in body` 에서 떨어지고 배너는 라이브러리 고정 문구 "Edge Function returned a non-2xx status code" 로 끝난다. 스크래치 실행: `formatRespinError("FB", { message: "Invalid JWT", code: 401 })` → `"FB"`. D-12 가 만든 본문 읽기 경로가 정확히 "왜 실패했는지 알아야 하는" 시나리오에서 무력화된다. 게이트웨이 401 응답에 CORS 헤더가 실리는지는 실호출 없이 단정할 수 없으나(실리지 않으면 `response` 자체가 `undefined` 라 어차피 fallback), 실릴 때 그 문장을 버릴 이유는 없다.
**재현:** Phase 8 에서 `--no-verify-jwt` 없이 배포되고 `config.toml` 이 무시된 상황을 가정 → 사용자가 "다시 돌리기" → 배너 "다시 돌리기 실패: Edge Function returned a non-2xx status code". 운영자는 대시보드 로그를 열기 전까지 401 인지 500 인지 알 수 없다.
**Fix:**
```ts
// 1순위: 함수가 보낸 { error }. 2순위: 게이트웨이·런타임이 보내는 { message } (verify_jwt 401·BOOT_ERROR).
// 둘 다 사람이 읽을 한 문장이고, 둘 중 어느 것도 없으면 라이브러리 고정 문구로 착지한다.
export function formatRespinError(fallbackMessage: string, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    for (const key of ["error", "message"] as const) {
      if (key in body) {
        const value = (body as Record<typeof key, unknown>)[key];
        if (typeof value === "string" && value.trim().length > 0) return value.trim();
      }
    }
  }
  return fallbackMessage;
}
```
(`as` 없이 쓰려면 `key in body` 뒤에 `const value: unknown = body[key]` 로 TS 4.9+ 의 `in` 좁히기를 그대로 쓰면 된다.) `lib/errors.test.ts` 에 `{ code: 401, message: "Invalid JWT" }` → `"Invalid JWT"`, `{ error: "a", message: "b" }` → `"a"` (우선순위) 두 케이스를 추가한다.

### WR-04: 계약 테스트의 `console.error` 단언이 하한이라 D-10 "경로마다 1건" 을 지키지 못하고, 쿨다운 창 경계와 `no_candidates` 문자열은 아예 고정되지 않는다

**File:** `supabase/functions/_shared/edgeImports.test.ts:242-245`, `:304-307`; (부재) `:175-327`
**Issue:** (a) #32 는 `toBeGreaterThan(4)`, #43 은 `toBeGreaterThan(3)` 이다. spin 은 현재 7건(`:77,89,112,130,136,153,185`), respin 은 5건(`:99,114,121,139,173`) 이라 spin 에서 로그 2건, respin 에서 1건을 지워도 초록이다. 주석은 "로그를 한두 줄 옮겨도" 라 하지만 옮기는 것과 지우는 것을 구분하지 못한다 — #26 이 "3 의 근거" 를 적어 정확히 세는 방식과 어긋나고, D-10 이 규약으로 못 박은 "실패·폴백 경로마다 1건" 은 이 게이트가 지키지 않는다(C-10). (b) 쿨다운 창의 `.lt("date", now.date)` (spin `:150`, respin `:136`) 는 "오늘을 제외한다 — 다시 돌리기가 오늘 당첨 매장을 다시 뽑을 수 있어야 한다"(cooldown.ts:6-7) 는 설계의 유일한 배선인데 어떤 단언도 이를 보지 않는다. `.lte` 로 바뀌면 respin 에서 오늘 당첨 매장이 영구 제외되고(후보 2개면 항상 나머지 하나) 테스트는 초록이다. (c) respin `:125` 주석이 "이 문자열은 클라이언트가 '후보가 없어요' 로 번역한다 — 바꾸면 화면 문구가 코드값으로 새어 나온다" 고 경고하지만, `"no_candidates"` 리터럴을 세는 단언이 없다.
**재현:** (a) spin `:112` 와 `:153` 의 `console.error` 두 줄을 삭제 → `npm test` 219/219 통과. (b) respin `:136` 을 `.lte("date", now.date)` 로 교체 → 통과. (c) respin `:126` 을 `"no_candidate"` 로 오타 → 통과, 배너에는 "다시 돌리기 건너뜀: no_candidate".
**Fix:**
```ts
it("실패·폴백 경로마다 서버 로그가 정확히 하나다 (#32)", () => {
  // 근거: 설정 조회 1 + 시각 파싱 1 + 멱등 조회 1 + 후보 조회 1 + 조인 제외 1 + 쿨다운 조회 1 + 기록 1 = 7.
  expect(count(spin, /console\.error\(/g)).toBe(7);
});
it("쿨다운 창은 [시작일, 오늘) 이다 — 오늘은 뺀다 (#32a)", () => {
  expect([count(spin, /\.gte\("date"/g), count(spin, /\.lt\("date"/g), count(spin, /\.lte\("date"/g)]).toEqual([1, 1, 0]);
});
it('후보 없음 응답 문자열이 클라이언트 번역 키와 같다 (#32b)', () => {
  expect(count(spin, /skipped: "no_candidates"/g)).toBe(1);
});
```
respin 에도 같은 세 단언(#43 은 `toBe(5)`, 근거 5경로). `app/page.tsx:228` 의 `"no_candidates"` 는 vitest 수집 범위 밖이라 양쪽을 한 상수로 묶을 수 없으므로 최소한 함수 쪽을 고정한다.

## Info

### IN-01: `settings_fallback` 키가 두 함수에서 다른 뜻이고, respin 은 `spin_time` 을 읽고 버린다

**File:** `supabase/functions/respin-roulette/index.ts:89-105`; `supabase/functions/spin-roulette/index.ts:76-96`
**Issue:** D-09 는 세 boolean 을 "두 함수 공통 키" 라 정의했지만 spin 의 `settings_fallback` 은 "조회 실패 또는 파싱 실패", respin 은 "조회 실패" 만이다(`:91` 주석이 인정한다). 같은 이름을 grep 해서 읽는 사람은 이 차이를 응답에서 알 수 없다. 또 respin 은 `select("spin_time, cooldown_days")` 로 쓰지 않는 열을 읽는다 — "형제와 같은 조회" 를 위한 것이지만 select 목록은 계약 #37 이 `from("settings")` 만 보므로 좁혀도 게이트는 그대로다. **[설계 재논의]** D-04 "같은 조회·같은 정책" 은 respin 에서 `select("cooldown_days")` 로 좁히고 respin 응답 키를 `settings_read_failed` 처럼 뜻이 하나인 이름으로 바꾸거나, 두 함수의 플래그 의미를 D-09 에 각각 적어 두는 쪽이 정직하다.
**Fix:** 최소 변경은 respin `:94` 를 `.select("cooldown_days")` 로 좁히고 `:85` 주석에 "이 플래그는 조회 실패만 뜻한다(형제와 다르다)" 를 응답 키 옆(`:186`)으로 옮기는 것.

### IN-02: 같은 함수 안에서 `skipped` 가 두 뜻이다 (제외 건수 vs 응답의 건너뜀 사유)

**File:** `supabase/functions/spin-roulette/index.ts:135-140`; `supabase/functions/respin-roulette/index.ts:120-126`
**Issue:** `const { picked: candidates, skipped } = normalizeCandidates(rows)` (숫자) 와 다섯 줄 아래 `json({ skipped: "no_candidates" })` (문자열 사유) 가 한 화면에 있다. `skipped_count` 를 응답에 싣게 되면(WR-02) 세 번째 뜻이 생긴다(B-6).
**Fix:** 헬퍼 반환 필드와 지역 변수를 `excluded` 로 개명(WR-02 의 코드가 이미 그렇게 한다).

### IN-03: `formatRespinError` 는 앞뒤 공백을 남기고 길이 상한이 없으며, `.trim()` 분기는 테스트되지 않는다

**File:** `lib/errors.ts:28`; `lib/errors.test.ts:57-61`
**Issue:** `message.trim().length > 0` 로 판정하고 `message` 원본을 돌려주므로 `{ error: " x " }` → `" x "` (스크래치 실행 확인) — 배너는 "다시 돌리기 실패:  x ". 길이 상한이 없어 PostgREST 가 긴 메시지를 돌려주면 한 줄 배너가 여러 줄로 터진다(현재 함수가 싣는 `message` 는 짧지만 헬퍼는 그 가정을 모른다). 테스트의 빈 문자열 케이스(`""`)는 `.trim()` 이 없어도 통과하므로 공백만 있는 `"   "` 케이스가 없으면 그 분기가 사라져도 초록이다(C-10).
**Fix:** `return message.trim().slice(0, 200)` + `lib/errors.test.ts` 에 `{ error: "   " }` → fallback, `{ error: " x " }` → `"x"` 두 케이스.

### IN-04: `RespinResponse.error` 는 여전히 어디서도 읽지 않는다

**File:** `app/page.tsx:19`
**Issue:** CONTEXT D-12 는 "`RespinResponse.error` 가 실제로 읽힌다" 고 적었지만 500 본문은 `response.json()` → `formatRespinError(body: unknown)` 로 읽고 `data` 는 2xx 에서만 채워지므로 `data.error` 는 도달 불가다. 타입이 "2xx 에도 `error` 가 올 수 있다" 고 거짓말한다(B-7).
**Fix:** `type RespinResponse = { ok?: boolean; skipped?: string }` 로 줄이고 주석에 "500 본문 `{ error }` 는 `formatRespinError` 가 `unknown` 으로 받는다" 를 남긴다.

### IN-05: 계약 테스트의 주석 제거기와 import 정규식에 사각지대가 있다

**File:** `supabase/functions/_shared/edgeImports.test.ts:25-35`, `:55`
**Issue:** `stripComments` 는 `//` 만 자른다. (a) `/* … */` 블록·JSDoc 은 남는다 — `_shared/kst.ts:31,62,67`·`spinTime.ts:17,33,38`·`cooldown.ts:5,28` 이 `/** … */` 를 쓴다(현재 그 줄에 검사 토큰은 없음, 실측). (b) 문자열 리터럴 안의 `//` 도 자른다 — 두 `index.ts` 에 지금은 `//` 를 포함한 문자열이 없지만(실측) `"https://"` 하나가 들어오는 순간 그 줄 이후 토큰이 사라진다. (c) `IMPORT_LINE = /^\s*import\s/` 는 `export { x } from "./kst.ts"`(재수출 = 사실상 import)·`await import("…")`·`import{x}` 를 세지 않는다(실측 0건). `_shared` import 0 계약(#4~#6)은 tsc·deno 두 컴파일러가 독립적으로도 지키므로 실해는 없다.
**Fix:** `stripComments` 에 `.replace(/\/\*[\s\S]*?\*\//g, "")` 를 먼저 적용하고, `IMPORT_LINE` 을 `/^\s*(import|export)\b[^;]*\bfrom\b|\bimport\s*\(/gm` 로 넓힌다.

### IN-06: #48 은 `deno.json` 의 존재만 보고 내용과 `deno.lock` 의 존재는 보지 않는다

**File:** `supabase/functions/_shared/edgeImports.test.ts:338-350`
**Issue:** D-01 의 요지는 위치 + `{"nodeModulesDir":"none"}` 한 키이고, D-02 는 lock 커밋이다. 누가 `deno.json` 에 `imports` 를 넣거나 `nodeModulesDir` 를 지워도, lock 을 `.gitignore` 에 넣어도 #48 은 초록이다.
**Fix:** `JSON.parse(readFileSync(new URL("../deno.json", import.meta.url), "utf8"))` 가 `{ nodeModulesDir: "none" }` 와 `toEqual` 인지, `existsSync(new URL("../deno.lock", import.meta.url))` 가 `true` 인지 두 단언 추가.

### IN-07: respin 의 500 본문은 PostgREST 원문 `message` 를 익명 브라우저에 그대로 싣는다

**File:** `supabase/functions/respin-roulette/index.ts:117`, `:174`
**Issue:** `details`·`hint` 는 뺐지만 `message` 자체가 `relation "public.candidates" does not exist`·`column restaurants.name does not exist` 처럼 테이블·컬럼명을 싣는다. 익명 내부 서비스라 위험은 낮고 `:116` 주석이 이 선택을 인정한다. **[설계 재논의]** 응답에는 고정 한국어 문장(`"후보를 읽지 못했어요"`·`"결과를 기록하지 못했어요"`)을 싣고 원문은 `console.error` 에만 남기는 쪽이 클라이언트 배너 규약("사용자가 읽을 문장")과도 맞는다.
**Fix:** `return json({ error: "후보를 읽지 못했어요" }, 500)` (로그는 그대로).

### IN-08: 던져진 예외는 `json()` 을 지나지 않는다 — D-07 의 "모든 반환 경로" 는 return 에만 참이다

**File:** `supabase/functions/respin-roulette/index.ts:79-82`; `supabase/functions/spin-roulette/index.ts:59-62`; `app/page.tsx:215-235`
**Issue:** `Deno.env.get("SUPABASE_URL")!` 가 비어 `createClient(undefined, …)` 가 던지면 `Deno.serve` 가 CORS 없는 기본 500 을 내고, 브라우저는 `FunctionsFetchError` 를 받아 D-12 본문 경로가 죽는다. 현재 Supabase 런타임에서는 그 환경변수가 항상 주입되므로 실해는 없다. 같은 무늬로 `app/page.tsx` `respin()` 은 `try/finally` 뿐이라 예상 밖 throw 는 배너 없이 unhandled rejection 이 된다(실제로 throw 할 지점은 확인되지 않았다 — `invoke()` 는 던지지 않고 `.json().catch` 가 거부를 흡수한다).
**Fix:** 두 함수 핸들러 본문을 `try { … } catch (e) { console.error(\`처리되지 않은 예외: ${e instanceof Error ? e.message : String(e)}\`); return json({ error: "internal_error" }, 500); }` 로 감싼다. 계약 #34/#45 는 영향 없다. 페이지 쪽은 `catch (e) { setActionError(\`다시 돌리기 실패: ${e instanceof Error ? e.message : String(e)}\`); }` 한 절.

### IN-09: results UPDATE 구독이 `on delete set null` 갱신을 새 결과로 오인한다 (Phase 6 이관 사항 기록)

**File:** `app/page.tsx:115-119`, `:81-88`
**Issue:** 0005:67-68 이 이미 적은 대로, 오늘 당첨 매장을 삭제하면 `results.restaurant_id → null` UPDATE 가 나가고 `applyResult` 가 `setForceSpin(true)` 로 휠을 재회전시킨다. 이 페이즈가 `restaurant_id` 를 실제로 쓰기 시작했으므로 도달 가능해졌다. Phase 6 소관으로 합의돼 있어 여기서는 잊히지 않게 기록만 한다.
**Fix:** Phase 6 에서 `applyResult` 가 `payload.old.spun_at !== payload.new.spun_at` (또는 `menu` 변화) 일 때만 `forceSpin` 을 켜도록 가드.

### IN-10: 설정 단일행 id `1` 이 두 파일에 맨 숫자로 있다

**File:** `supabase/functions/spin-roulette/index.ts:73`; `supabase/functions/respin-roulette/index.ts:95`
**Issue:** `.eq("id", 1)` 의 `1` 은 0005:50 `check (id = 1)` 이 정한 값인데 코드에는 출처 주석이 없다(B-7).
**Fix:** 각 파일 상단에 `const SETTINGS_ROW_ID = 1; // 0005:50 check (id = 1) — 단일행 계약` 을 두고 `.eq("id", SETTINGS_ROW_ID)`.

### IN-11: CORS 허용 헤더 목록은 정적 열거이고 클라이언트 supabase-js 는 caret 범위다

**File:** `supabase/functions/respin-roulette/index.ts:57-61`; `package.json:15`
**Issue:** 설치본 2.106.0 이 `invoke()` 에 붙이는 헤더는 `X-Client-Info`·`apikey`·`Authorization` 뿐이고 `tracePropagation` 은 명시 opt-in 이라(`index.mjs:329`) 오늘 목록은 충분하다. 그러나 `^2.106.0` 은 minor 범프를 허용하고, 서버 쪽은 D-02 로 `jsr:…@2.117.2` 를 정확 핀했으면서 클라이언트만 열려 있다. 새 헤더 하나가 기본으로 켜지면 프리플라이트가 실패해 `FunctionsFetchError` → D-12 본문 경로가 통째로 죽는다(Pitfall 2 와 같은 증상).
**Fix:** `"@supabase/supabase-js": "2.106.0"` 으로 핀하거나, CLAUDE.md 배포 함정 절에 "클라이언트 supabase-js 를 올리면 respin CORS 허용 헤더 목록을 다시 확인한다" 한 줄.

### IN-12: 두 함수의 동일 블록이 약 90줄이다 (D-11 수용 사항 — 설계 재논의 표기만)

**File:** `supabase/functions/spin-roulette/index.ts:22-47`, `:64-96`, `:123-165`; `supabase/functions/respin-roulette/index.ts:29-55`, `:84-105`, `:107-151`
**Issue:** `Candidate` 타입·`normalizeCandidates`·플래그 3종·설정 조회·후보 조회·쿨다운 배선이 두 파일에서 바이트 단위로 같다. D-11 이 "`_shared` import 0 규칙과 충돌" 을 이유로 수용했고 `allowImportingTsExtensions` 경로는 Deferred 다. **[설계 재논의]** WR-01·WR-02 같은 수정이 항상 두 곳을 요구하므로, Phase 8 이후 `_shared/candidates.ts` (jsr import 없는 순수 정규화만)로 `normalizeCandidates` 하나라도 옮기는 것은 import 0 규칙과 충돌하지 않는다 — 이 함수는 `_shared` 의 다른 파일을 필요로 하지 않기 때문이다.
**Fix:** 이 페이즈에서는 변경 없음. 다음 페이즈 후보로 기록.

---

_Reviewed: 2026-09-28T07:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
