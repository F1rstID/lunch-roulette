---
phase: quick-003-ranked-results
reviewed: 2026-10-06T01:20:00Z
depth: deep
commit: d00603c
files_reviewed: 17
files_reviewed_list:
  - supabase/migrations/0006_results_ranking.sql
  - supabase/migrations/0006_results_ranking.test.ts
  - supabase/rollback/0006_results_ranking.rollback.sql
  - supabase/rollback/0006_results_ranking.rollback.test.ts
  - supabase/functions/_shared/ranking.ts
  - supabase/functions/_shared/ranking.test.ts
  - supabase/functions/_shared/edgeImports.test.ts
  - supabase/functions/spin-roulette/index.ts
  - supabase/functions/respin-roulette/index.ts
  - lib/supabase/client.ts
  - lib/ranking.ts
  - lib/ranking.test.ts
  - lib/candidates.test.ts
  - supabase/migrations/0005_restaurants_settings.test.ts
  - components/ResultBlock.tsx
  - components/CalendarLog.tsx
  - app/page.tsx
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Quick 003: 결과 순위 저장·표시 — 코드 리뷰

**Reviewed:** 2026-10-06
**Depth:** deep (커밋 d00603c 전수 + 호출 체인 추적)
**Files Reviewed:** 17
**Status:** issues_found (Critical 0 · Warning 3 · Info 6)

## Summary

커밋 d00603c 의 17개 파일을 읽고, 두 Edge Function 의 쓰기·응답 경로, `_shared/ranking.ts` → `lib/ranking.ts` → `ResultBlock`/`CalendarLog` 체인, `app/page.tsx` 의 `shownPhase` 분기 전부(머리글·부제·TopBar·PhaseTimeline·StageHeader·ResultBlock·Wheel 배지·CandidateList·다시 돌리기 버튼)를 추적했다. 게이트 4종(`npx tsc --noEmit`·`npm run lint`·`npx vitest run` 441/441·`npm run check:edge`)은 전부 통과했다.

**핵심 결론: 추첨을 잃거나 데이터를 깨뜨리는 결함은 없다.** 당첨 = `ranking[0]` 이 쓰기 페이로드와 응답에서 일치하고, `rankCandidates` 가 받는 pool 은 코드 배치상 비어 있을 수 없으며, Fisher-Yates 의 1번째 원소는 pool 위에서 균등이라 당첨 분포는 전과 같다. 배포 순서를 어겨도(함수 먼저) PGRST204 가 `console.error` 1건 + 500 으로 끝나고 행은 생기지 않는다. `forceSpin` 동안 새 당첨 이름이 DOM 에 오르는 경로는 찾지 못했다(휠 배지는 `isDecided` 조건이라 회전 중엔 그려지지 않고, `showLabels` 가 꺼져 방사형 라벨도 숨는다).

남은 것은 **문서가 코드와 어긋나는 지점 둘**(난수 소스 교체가 조용히 일어났고 `pickRandom` 이 거짓 주석과 함께 죽은 export 로 남았다 · DB `comment on column` 과 함수 주석이 쿨다운 폴백 경로를 부정한다)과 **텍스트 계약의 false-green 틈 하나**(#62 가 `ranking,` 의 위치를 보지 않는다)다. 셋 다 0006 SQL 을 라이브에 1회 적용하기 **전에** 고치는 것이 싸다 — 특히 WR-02 는 적용되면 대시보드에 박힌다.

## 검증 결과 (문제 없음으로 확인한 항목)

우선순위 1~7 의 질문에 대한 답. 아래는 코드로 확인했고 지적할 것이 없는 항목이다.

1. **서버 정합성.** `spin-roulette/index.ts:199-210`·`respin-roulette/index.ts:195-212`: `ranking = rankCandidates(pool)` → `winner = ranking[0]` → 페이로드 `menu: winner.name, restaurant_id: winner.restaurant_id, ranking` → 응답 `menu/restaurant_id` 도 같은 `winner`. pool 비어 있지 않음은 `candidates.length === 0` 조기 반환(:167/:163)과 `applyCooldown` 의 전멸 폴백(cooldown.ts:45-47)이 보장하며 이 커밋은 그 배치를 바꾸지 않았다. Fisher-Yates(뒤→앞, j∈[0,i])는 균등 순열이므로 `ranking[0]` 은 pool 위 균등 — `pickRandom` 과 같은 분포. `_shared/ranking.ts` 는 import 0, 두 함수는 `../_shared/ranking.ts` 로 확장자 포함 import, `deno check` 통과. 응답 모양은 변경 없음(`ranking` 을 응답에 싣지 않는다 — 클라이언트 `RespinResponse`·README 의 응답 독법과 일치).
2. **배포 순서.** 함수 먼저 → `insErr.code = "PGRST204"` ≠ `23505` → `console.error("결과 기록 실패: …")` + 500, 행 없음, 매분 재시도되다 SQL 적용 직후 다음 분에 정상. UI 먼저 → `select("*")` 에 `ranking` 키가 없어 `undefined` → `backupRanks(undefined)` → `[]`(`lib/ranking.ts:21` `Array.isArray` 가드). 구 클라이언트는 `payload.new as ResultRow` 캐스팅이라 모르는 컬럼을 무시한다. Realtime `postgres_changes` 의 `payload.new` 는 INSERT/UPDATE 모두 새 튜플 전체(jsonb 는 파싱된 값)라 설정 변경 없이 `ranking` 이 실린다. `results` 에 컬럼 단위 grant 가 없어(0001·0005 전수 확인) 새 컬럼이 anon select 에 자동 포함된다.
3. **`lib/ranking.ts` 방어.** 구멍 있는 배열(`ranking[index]` → `undefined` → `nameOf` null → 자리만 비움)·문자열·숫자·객체 전부 `[]` 또는 자리 생략. `rank = index + 1` 로 자리 고정. `max` 0·음수·NaN → 루프 조건 `index <= max` 가 거짓이라 `[]`. JSON 출처라 getter 는 존재할 수 없다. 서버는 `restaurants.name` check(0005:25, 1~24 자·공백 아님)를 지난 이름만 쓰므로 빈 이름은 손으로 고친 행에서만 가능.
4. **UI.** 390px: `winnerWrap` 좌우 26px → 338px, 격자 `48px minmax(0,1fr)` + 12px gap → 이름 칸 278px. 본문 `word-break: keep-all; overflow-wrap: break-word`(globals.css:71-72) 아래서 `minmax(0,1fr)` 트랙은 min-content 기여가 0 이라 24코드포인트 무공백 이름(16px 기준 ≈384px)이 2줄로 꺾인다. 구 행: `backups.length > 0 &&` 가 영역 전체(구분선 포함)를 감싸 추가 DOM 0. `shownPhase` 소비처 7곳 전부 확인 — `phaseHeadline/phaseSubhead(spinning)` 은 이름 인자를 쓰지 않고, `TopBar`·`StageHeader` 는 라벨만, `ResultBlock(spinning)` 은 `winner` 를 읽지 않으며, `Wheel` 은 `wheelPhase` 가 이미 `forceSpin` 을 보고 있었고 배지는 `isDecided && hasWinner`(Wheel.tsx:222) 조건이라 회전 중 미렌더. `CandidateList phase={phase}`(:342)·다시 돌리기 조건 `phase === "decided"`(:321) 은 실제 페이즈 유지. `PhaseTimeline` 에 `spinning` 을 넘기면 `activeIdx = 1` — 시각 효과 외 부작용 없음(IN-05).
5. **Spec.** `rankCandidates` 의 random→0 케이스를 손으로 추적: i=3 swap(3,0) → d b c a / i=2 swap(2,0) → c b d a / i=1 swap(1,0) → b c d a = 기대값 `["b","c","d","a"]`. random→0.999999 는 i≤3 에서 `floor(0.999999·(i+1)) = i` 로 항등. 두 값이 "뒤→앞, j∈[0,i]" 표준형을 고정한다(inside-out 변형이면 다른 수열). 0005 spec #41 의 `RESULT_ROW_FIELDS` 는 하드코딩 목록과 TS 타입의 비교라 거짓 초록은 아니지만 결합이 생겼다(IN-04).
6. **SQL.** `conrelid = 'public.results'::regclass` + `conname` 존재 검사로 `add constraint` 를 감싸 2회차 안전. check 는 `null` 허용·`"x"`(string)·`{}`(object) 거부·`[]` 허용 — 의도대로. 두 줄로 나뉜 `'…' '…'` 는 PostgreSQL §4.1.2.1 "개행을 포함한 공백으로만 분리된 문자열 상수는 하나로 이어진다" 에 해당해 **유효**하다(IN-03 의 취약성은 별개).
7. **CLAUDE.md.** `lib/ranking.ts` 는 import 0(계획의 "client.ts 에서 import type" 조차 필요 없었다). `grep '@/components/' lib` 0줄. 훅 3종 미변경. 주석은 한글 Why.

## Warnings

### WR-01: 난수 소스가 CSPRNG → `Math.random` 으로 조용히 바뀌었고, `pickRandom` 이 거짓 주석과 함께 죽은 export 로 남았다

**File:** `supabase/functions/_shared/ranking.ts:14` · `supabase/functions/_shared/kst.ts:67-75` · `supabase/functions/_shared/kst.test.ts:4-9`
**Issue:** 전환 전 당첨은 `pickRandom`(kst.ts:71, `crypto.getRandomValues`)이 뽑았고 kst.ts:4·kst.test.ts:4 가 "난수 품질은 `crypto.getRandomValues` 의 계약" 이라고 적어 두었다. 이 커밋은 두 함수의 호출을 `rankCandidates(pool)` 로 바꾸면서 기본 난수를 `Math.random` 으로 두었다(ranking.ts:14). 분포는 같지만(둘 다 균등) **소스가 바뀐 사실이 커밋 메시지·플랜·주석 어디에도 없다.** 동시에 `pickRandom` 은 호출자 0(`grep -rn pickRandom` — 자기 spec 과 부재 계약 #10·#19·#61 만 남음)인데 export 와 spec(kst.test.ts:63-72)이 그대로이고, 그 머리 주석 "현행 두 Edge Function 이 실제로 그렇게 하고 있다"(kst.ts:70)는 이제 거짓이다. CLAUDE.md "미사용 코드" 목록에도 없다.
**Failure scenario:** 다음 사람이 kst.ts 를 읽고 "추첨 난수는 crypto 다" 로 믿은 채 보안·공정성 질문에 답하거나, 반대로 `pickRandom` 을 "쓰이는 코드" 로 보고 유지 비용을 들인다. 기능 장애는 아니다 — Deno 의 `Math.random` 은 OS 엔트로피로 시드되는 xorshift128+ 라 점심 룰렛의 요구를 충족한다.
**Fix:** 둘 중 하나를 택해 문서와 코드를 일치시킨다.
```ts
// (a) 기존 계약 유지: 기본 난수를 crypto 로. Deno·Node≥19·브라우저 전역이라 import 0 계약을 지킨다.
function cryptoRandom(): number {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 2 ** 32; // [0, 1)
}
export function rankCandidates(pool: readonly RankedEntry[], random: () => number = cryptoRandom): RankedEntry[] { … }
```
그리고 `kst.ts` 의 `pickRandom` + `kst.test.ts` 의 "KST/QUAL-02" describe 를 지운다(계약 #10·#19·#61 은 부재 단언이라 그대로 초록).
(b) `Math.random` 을 유지하려면 ranking.ts:11 주석에 "crypto 를 쓰지 않는 이유" 를 적고, kst.ts:68-70 주석을 고치거나 `pickRandom` 을 지운다. 어느 쪽이든 CLAUDE.md "미사용 코드" 줄을 갱신한다.

### WR-02: DB `comment on column` 과 두 함수의 주석이 쿨다운 **폴백** 경로를 부정한다

**File:** `supabase/migrations/0006_results_ranking.sql:29` · `supabase/functions/spin-roulette/index.ts:198` · `supabase/functions/respin-roulette/index.ts:194`
**Issue:** 컬럼 주석은 "쿨다운을 거친 후보만 들어간다", 함수 주석은 "쿨다운에 걸린 매장은 오늘 갈 수 없으니 예비에도 없다" 라고 단정한다. 그러나 `applyCooldown`(cooldown.ts:45-47) 은 후보가 전멸하면 **쿨다운에 걸린 후보 전체**를 되돌리고(`fellBack: true`), 그 pool 이 그대로 `rankCandidates` 로 들어간다(spin:199). 즉 폴백 날의 `ranking` 2·3순위는 최근 당첨 매장이다.
**Failure scenario:** `cooldown_days = 3`, 오늘 후보 2개가 모두 최근 3일 안에 당첨 → 폴백 → `ranking = [A, B]`, 카드 2순위 = 최근 당첨 매장. 대시보드에서 컬럼 주석을 읽은 사람은 "순위가 쿨다운을 어겼다 = 버그" 로 판단해 UI 나 함수에 필터를 덧대고, 그 필터가 폴백 날 예비를 0개로 만든다. `comment on` 은 SQL 1회 적용 뒤 라이브 카탈로그에 박히므로 적용 전에 고치는 것이 싸다(재실행 안전형이라 뒤에 고칠 수도 있다).
**Fix:**
```sql
comment on column public.results.ranking is
  '추첨이 정한 후보 순서. [{"restaurant_id": uuid, "name": 매장명 스냅샷}, …]. 1번째가 당첨이며 menu·restaurant_id 와 같다. '
  '쿨다운을 거친 후보의 순열이다(단, 후보가 전멸해 폴백한 날은 전체 후보 — 응답 cooldown_fallback 참조). 0006 이전 행과 구 함수가 쓴 행은 null. 안의 restaurant_id 는 외래키가 아니라 매장을 지워도 그대로 남는다.';
```
두 함수의 :198/:194 주석도 같은 뜻으로("폴백이면 전체 후보가 순위에 든다 — 그날은 어디든 가야 한다").

### WR-03: 텍스트 계약 #62 가 `ranking,` 의 **위치**를 보지 않아 쓰기에서 빠져도 초록이고, 결정성 spec 하나는 항등식이다

**File:** `supabase/functions/_shared/edgeImports.test.ts:447-449` · `supabase/functions/_shared/ranking.test.ts:35-39`
**Issue:** #62 는 `^\s*ranking,\s*$` 가 파일에 정확히 1줄 있는지만 센다. "결과 행 쓰기에 ranking 을 싣는다" 는 제목과 달리 그 줄이 `insert({…})`/`upsert({…})` 안에 있는지 확인하지 않는다. 또 ranking.test.ts:35 "주입한 수열대로 결정적이다" 는 같은 입력을 두 번 넣어 같은지 비교한다 — 어떤 결정적 함수라도 통과하는 항등식이라 알고리즘을 고정하지 않는다(random→0·→0.999999 두 케이스는 고정한다 — 검증 결과 5 참조).
**Failure scenario:** 리팩터링에서 `ranking,` 을 응답 `json({ ok: true, …, ranking, … })` 으로 옮기고 insert 페이로드에서 빼면(응답에 순위를 싣자는 요구는 자연스럽다) #62 는 그대로 1건으로 초록인데 결과 행의 `ranking` 은 매일 null 이 된다. 이 레포는 두 `index.ts` 의 **형태**를 텍스트 계약으로만 지키므로(CLAUDE.md) 이 틈은 다른 검사가 메우지 못한다.
**Fix:**
```ts
// edgeImports.test.ts #62 — 쓰기 호출 블록 안에서 센다
const WRITE_WITH_RANKING = /\.(insert|upsert)\(\s*\{[^}]*^\s*ranking,\s*$[^}]*\}/ms;
expect([WRITE_WITH_RANKING.test(spin), WRITE_WITH_RANKING.test(respin)]).toEqual([true, true]);

// ranking.test.ts:35 — 수열의 구체 결과를 고정한다
// i=3: floor(0.1·4)=0 swap(3,0) → d b c a / i=2: floor(0.7·3)=2 swap(2,2) → d b c a / i=1: floor(0.3·2)=0 swap(1,0) → b d c a
expect(rankCandidates(pool, sequence([0.1, 0.7, 0.3])).map((e) => e.restaurant_id)).toEqual(["b", "d", "c", "a"]);
```

## Info

### IN-01: `edgeImports.test.ts` 의 describe 제목·주석이 "_shared 3파일" 로 남아 있다

**File:** `supabase/functions/_shared/edgeImports.test.ts:63`, `:90`
**Issue:** #59 는 "이제 4파일" 이라고 말하는데 같은 파일의 describe 제목(:63)과 주석(:90 "_shared 3파일의 #1~#3")은 3파일이다. CLAUDE.md:23 은 "네 모듈" 로 갱신됐다.
**Fix:** 두 문구를 "4파일" 로, 또는 #59 를 그 describe 안으로 옮긴다.

### IN-02: `rankCandidates` 는 `random() >= 1` 을 방어하지 않는다

**File:** `supabase/functions/_shared/ranking.ts:17`
**Issue:** 주입된 난수가 1 이상을 돌려주면 `j = i + 1` 로 범위를 벗어나 `ranked[i] = undefined` 가 되고 배열이 한 칸 자란다 → `winner.name` 에서 TypeError → 바깥 catch 의 `internal_error` 500(원인 로그 없음). `Math.random` 은 [0,1) 이라 기본 경로에서는 도달 불가 — WR-01(a) 의 `u[0] / 2**32` 도 [0,1) 이다.
**Fix:** `const j = Math.min(i, Math.floor(random() * (i + 1)));` 한 줄, 또는 주석에 "random 은 [0,1) 계약" 을 명시.

### IN-03: 0006 의 두 줄짜리 문자열 상수는 개행에 의존해 유효하다

**File:** `supabase/migrations/0006_results_ranking.sql:28-29`
**Issue:** `'…' <개행> '…'` 는 PostgreSQL 이 하나로 이어 주지만(§4.1.2.1), 포매터·사람이 한 줄로 합치면 구문 오류다. 0006 spec 은 `comment on column` 과 `1번째` 의 존재만 보므로 그 회귀를 잡지 못한다.
**Fix:** `||` 로 명시 연결하거나 한 리터럴로 쓴다. (WR-02 수정과 함께 고치면 한 번이다.)

### IN-04: 0005 spec 이 0006 의 사실을 단언한다

**File:** `supabase/migrations/0005_restaurants_settings.test.ts:85`, `:366-368`
**Issue:** `RESULT_ROW_FIELDS` 에 `ranking` 이 들어가 "0005" 라는 이름의 spec 이 0006 컬럼을 요구한다. 0006 을 롤백(컬럼 drop)해도 TS 타입에서 `ranking` 을 빼면 #41 이 깨지고, 반대로 두면 타입이 라이브 스키마보다 넓다. 하드코딩 비교라 거짓 초록은 아니다.
**Fix:** ResultRow 필드 단언을 0006 spec 으로 옮기거나, describe 제목을 "0005+0006" 으로 고쳐 결합을 드러낸다.

### IN-05: `PhaseTimeline`·`TopBar` 에 `spinning` 을 넘기면 재추첨 5초 동안 타임라인이 "룰렛 11:55" 로 되돌아간다

**File:** `app/page.tsx:282`, `:295` · `components/PhaseTimeline.tsx:37-38`
**Issue:** 13:00 재추첨에서 `activeIdx = 1` 이 되어 결과(idx 2) 불릿이 꺼지고 룰렛 불릿이 켜진다. 기능 부작용은 없다(인덱스 계산 외 분기 없음) — 플랜이 명시한 선택이고, 질문 4 의 "부작용" 답은 이것뿐이다.
**Fix:** 의도라면 그대로. 타임라인만 실제 페이즈로 두고 싸게 끊으려면 `<PhaseTimeline current={phase} …/>` 로 되돌린다(이름 노출과 무관).

### IN-06: `winnerName` 의 `lineHeight: 1.2` 는 구 행 카드도 바꾼다

**File:** `components/ResultBlock.tsx:198`
**Issue:** 커밋 메시지는 "old rows render exactly as before" 라고 했지만 이 줄은 모든 행(0006 이전 포함)의 당첨 이름 줄 높이를 줄인다(36px × 기본 ↔ 1.2). 긴 이름 2줄 처리를 위한 의도된 조정으로 보이며 버그는 아니다.
**Fix:** 그대로 두고 커밋/플랜 문구만 "backups 영역은 구 행에 DOM 0" 으로 정확히 하거나, 변경을 별도 커밋으로 분리한다.

---

_Reviewed: 2026-10-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
