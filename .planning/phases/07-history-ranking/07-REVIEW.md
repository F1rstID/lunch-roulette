---
phase: 07-history-ranking
reviewed: 2026-09-29T05:35:53Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - lib/history.ts
  - lib/history.test.ts
  - app/log/page.tsx
  - app/rank/page.tsx
  - components/RankingView.tsx
  - components/CalendarLog.tsx
  - lib/time.ts
  - lib/time.test.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 7: 기록·랭킹 — Code Review Report

**Reviewed:** 2026-09-29T05:35:53Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

`lib/history.ts`(순수 모듈 신설) · spec 20건 · `app/log`·`app/rank` 배선 · `RankingView`·`CalendarLog` 호출 전환 · `formatHhMm` 삭제를 파일 단위로 읽고, 두 페이지 ↔ `lib/settings.ts`/`useSettings` ↔ `lib/history.ts` 사이의 계약을 교차 확인했다. `npx tsc --noEmit`·`npm run lint`·`npm test`(378/378) 모두 exit 0. `grep -rn '@/components/\|@/app/' lib` 0줄(A2 유지). 옛 토픽 `"log-results"`/`"rank-results"` 참조 0, `formatHhMm` 코드 참조 0.

집중 점검 항목의 결론:

- **`history_since` 경계**: `filterSince` 의 `date >= historySince` 는 양쪽이 KST `"yyyy-mm-dd"` 라 문자열 비교로 정확하고 당일 포함이 spec 으로 고정돼 있다. `null` 은 자르지 않고, 리듀서가 `?? null` 로 `undefined` 를 막는다. 문제 없음.
- **랭킹 키 `restaurant_id ?? menu`**: 개명·삭제·동명 재등록·legacy 행의 4가지 중 3가지는 의도대로다. **개명 후 삭제** 는 주석·D-02 의 주장("다시 한 덩어리")과 달리 갈라진다 — WR-03.
- **랭킹 effect deps `[settingsLoaded, lowerBound]`**: `lowerBound` 는 문자열이라 1초 틱에 영향받지 않고, 전환일 변경·자정(전환일이 오늘보다 뒤인 날)에만 재조회한다. cleanup 의 `cancelled` 가 옛 응답을 버린다. 정확하다. 단, 조회를 설정 뒤로 **직렬화** 한 결과 상단 라벨이 한 왕복 동안 틀리게 보이는 창이 생겼다 — WR-02.
- **Realtime 병합 vs `RankRow`**: `ResultRow` 가 `RankRow` 의 상위 구조라 타입·동작 모두 문제 없다. 다만 좁힌 컬럼 의도가 Realtime 경로에서는 지켜지지 않는다 — IN-04.
- **토픽 유일성**: 두 페이지 모두 `results-{log,rank}-${++topicSeq}` 를 effect 안에서 매긴다. StrictMode 이중 마운트·라우트 왕복 모두 새 토픽이다. 문제 없음.
- **`useMemo` deps**: `visible`·`logMap`·`RankingView` 의 memo 전부 정확하다.
- **페이즈 배지의 필터 전 행 사용**: 랭킹은 `lowerBound ≤ 오늘` 이 보장돼 오늘 행이 항상 조회 범위 안이고, 기록은 월 창 안이다. 의도대로다.
- **쿼리 빌더 재대입 타이핑**: `.gte()`·`.order()` 가 `this` 를 돌려주므로 `let query` 재대입은 컴파일된다(tsc exit 0).
- **이전 동작 대비 회귀**: 컷오버 전 라이브 DB 에 대해 랭킹 페이지가 **더 이상 동작하지 않는다**(문서는 "현행과 동일" 이라고 주장) — WR-01.
- **테스트(C-10)**: 20건 모두 구체 값을 단언한다(동어반복 없음). 빠진 케이스 1건(WR-03) 과 픽스처 타입 연결(IN-05).
- **주석**: 전부 한글 Why. 사실과 어긋나는 문장 2곳(WR-03, IN-01).

## Critical Issues

없음. 데이터 손실·보안·크래시 경로는 찾지 못했다.

## Warnings

### WR-01: 컷오버 전 DB 에서 랭킹 조회가 42703 으로 실패한다 — 문서의 "현행과 동일" 주장이 거짓

**File:** `app/rank/page.tsx:17,64`
**문제:** `RANK_COLUMNS = "id,date,menu,restaurant_id"` 로 명시 컬럼 조회를 하는데, `results.restaurant_id` 는 `supabase/migrations/0005_restaurants_settings.sql:69` 의 `alter table public.results add column if not exists restaurant_id …` 에서만 생긴다. 0005 는 라이브에 미적용(CLAUDE.md: "`candidates`·`restaurants`·`settings` 도 라이브에 없다"). 이 브랜치를 라이브 DB 에 붙이면 PostgREST 가 `42703 column results.restaurant_id does not exist` 를 돌려주고, 배너 "랭킹 불러오기 실패: …" + "아직 기록이 없어요." 빈 랭킹이 된다. 이전 코드(`select("*")`)는 이 DB 에서 정상이었으므로 **이 페이즈가 만든 회귀**다. 기록 페이지는 `select("*")` 라 영향 없다.

세 문서가 반대로 적혀 있다:
- `07-CONTEXT.md:11` "컷오버 전 라이브에서 두 페이지는 '설정 불러오기 실패' 배너 + 전체 기간 표시가 정상이다"
- `07-CONTEXT.md:67` "두 페이지가 현행과 동일하게 전체 기간을 보인다. 그래서 이 페이즈도 main·라이브에 영향이 없다"
- `07-01-SUMMARY.md:75,79` "두 페이지 전체 기간 표시(현행과 동일)" / Manual-only "컷오버 전엔 … 기존 기록 전체가 정상"

프로덕션은 `wr-01` 순서(3 SQL → 5 PR 머지)가 지켜지는 한 안전하다. 그러나 SUMMARY 가 사용자에게 시키는 수동 검증(가드런처 `npm run dev` → `/rank`)은 라이브 DB 를 보므로 **그대로 실행하면 실패 배너를 보게 된다** — 그것이 정상인지 회귀인지 문서가 말해 주지 않는다.

**근거:**
```ts
// app/rank/page.tsx:17
const RANK_COLUMNS = "id,date,menu,restaurant_id";
// app/rank/page.tsx:64
let query = supabase.from("results").select(RANK_COLUMNS).order("date", { ascending: false });
```
```sql
-- supabase/migrations/0005_restaurants_settings.sql:69 (라이브 미적용)
alter table public.results add column if not exists restaurant_id uuid references public.restaurants(id) on delete set null;
```

**제안:** 코드는 그대로 두되(컬럼 좁히기는 D-06 의 목적이다) 사실을 문서에 맞춘다.
1. `07-CONTEXT.md:11,67`·`07-01-SUMMARY.md:75,79` 를 "컷오버 전 라이브 DB 에서는 **기록 페이지만** 현행과 동일하고, 랭킹 페이지는 0005 의 `results.restaurant_id` 가 없어 42703 배너 + 빈 랭킹이 정상이다" 로 고친다.
2. `wr-01-cutover-window.md` 5번에 한 줄: "랭킹 페이지의 `select("id,date,menu,restaurant_id")` 는 3번(0005) 이 먼저 적용돼야 동작한다 — 3 앞에 5 를 두지 않는 또 하나의 이유".
3. `CLAUDE.md:10` 의 괄호 "(`null` 이면 자르지 않는다 — 컷오버 전 라이브가 그 상태)" 는 `filterSince` 에 대해서는 참이지만 랭킹 조회 자체가 실패한다는 사실을 한 문장 덧붙인다.

### WR-02: 랭킹 조회를 설정 뒤로 직렬화하면서 추첨 시각 이후 "추첨 대기" 라벨이 한 왕복 동안 반드시 보인다

**File:** `app/rank/page.tsx:47-50,60-61`
**문제:** `displayPhase(phase, settingsLoaded)` 는 `settingsLoaded === false` 인 동안만 `stalled → accepting` 을 가린다(`lib/phase.ts:58-60`). 이 페이즈부터 결과 조회는 `if (!settingsLoaded) return;` 으로 **설정 응답 뒤에** 시작한다. 그러면 추첨 시각 + 5초 이후에 페이지를 열 때 다음 순서가 **결정적으로** 생긴다:

1. 설정 `fetched` → `settingsLoaded = true`, `results = []`
2. 같은 렌더에서 `currentPhase(now, spinTime, false)` → `"stalled"`, `displayPhase` 는 더 이상 가리지 않음 → TopBar "추첨 대기"
3. 결과 조회 effect 가 이제야 시작 → 한 왕복 뒤 `results` 도착 → "확정"

이전 코드는 두 조회를 마운트에서 병렬로 시작했으므로 이 창은 경합에 따라 0에 가까웠다. D-23 이 `displayPhase` 를 넣은 목적이 첫 페인트의 라벨 흔들림 제거였는데, D-06 의 직렬화가 랭킹 페이지에서 그것을 되돌렸다. 기능 영향은 0(라벨뿐)이지만 D-23 의 목적 자체를 깨는 회귀다. 조회 실패 시에는 `results` 가 영구히 `[]` 라 배너와 함께 "추첨 대기" 가 계속 보이는데, 그것은 정직한 상태라 문제 삼지 않는다.

**근거:**
```ts
// app/rank/page.tsx:47-50
const phase = displayPhase(
  currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKey)),
  settingsLoaded,          // ← 결과 조회가 아직 시작도 안 했는데 가림막이 걷힌다
);
// app/rank/page.tsx:60-61
useEffect(() => {
  if (!settingsLoaded) return;
```

**제안:** 결과 조회의 첫 응답까지 가림막을 유지한다. 판단은 페이지에 두지 않고 기존 `displayPhase` 인자로 흘린다.
```ts
const [resultsLoaded, setResultsLoaded] = useState(false);
// ...effect 안, 응답 처리 뒤:
setLoadError(formatLoadError("랭킹", error));
if (data) setResults(data as RankRow[]);
setResultsLoaded(true); // 성공·실패 모두 — 실패면 배너가 사유를 말하고 라벨은 정직하게 stalled 로 간다
// ...
const phase = displayPhase(
  currentPhase(now, settings.spinTime, results.some((r) => r.date === todayKey)),
  settingsLoaded && resultsLoaded,
);
```
`lib/phase.ts` 의 `displayPhase` 머리 주석에 "두 번째 인자는 '페이즈를 계산할 입력이 다 왔는가' 이고, 랭킹은 설정 + 결과 둘 다" 를 한 줄 덧붙이면 오늘 탭·매장 탭과의 차이가 코드에 남는다.

### WR-03: "삭제되면 이름 키로 다시 한 덩어리" 는 개명 이력이 없는 매장에만 참이다 — 주석·D-02 가 과장하고 spec 이 그 경계를 비운다

**File:** `lib/history.ts:38-40,44` (spec: `lib/history.test.ts:53-61`)
**문제:** 키가 `restaurant_id ?? menu` 이므로 삭제(`on delete set null`) 뒤에는 **행마다의 `menu` 스냅샷**이 키가 된다. 개명 이력이 있으면 스냅샷이 둘 이상이라 한 매장이 이름 수만큼 갈라진다:

- r1 "A" 당첨 10-01·10-02 → 개명 "B" → 10-03 당첨 → 삭제. 세 행 모두 `restaurant_id = null`, `menu` 는 A·A·B → `buildRanking` 결과 `A: 2회`, `B: 1회` **두 줄**(삭제 전에는 `B: 3회` 한 줄이었다).
- 반대 방향도 있다: 서로 다른 매장 두 개가 같은 이름으로 각각 등록·삭제되면 이름 키로 **합쳐진다** — D-02 가 "같은 이름을 새로 등록하면 별도 줄(다른 매장이 맞다)" 이라고 못 박은 원칙과 삭제 뒤에는 어긋난다.

이것은 데이터에 개명 이력이 없어 클라이언트가 고칠 수 없는 모델의 한계이고, id-only(기록 소실)·name-only(개명 분리)보다 낫다는 D-02 의 선택은 타당하다. 문제는 **주석이 반대로 말한다**는 것과, spec 의 "삭제된 매장" 케이스(`:53-56`)가 이름이 하나뿐인 픽스처라 이 경계를 검증하지 않는데 독자는 검증된 것으로 읽는다는 것이다(B8·C-10).

**근거:**
```ts
// lib/history.ts:38-40
// id 로만 모으면 삭제된 매장(on delete set null)의 기록이 랭킹에서 통째로 사라지고, 이름으로만 모으면 개명한 매장이
// 두 줄로 갈라진다. 삭제는 그 매장의 모든 행을 한 번에 null 로 바꾸므로 이름 키로 다시 한 덩어리가 된다.
//                                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 개명 이력이 있으면 거짓
```

**제안:**
1. 주석을 사실대로: "삭제는 모든 행을 한 번에 null 로 바꾸므로 **개명한 적이 없는** 매장은 이름 키로 한 덩어리가 된다. 개명 뒤 삭제된 매장은 이름 수만큼 갈라지고, 같은 이름으로 등록됐다 삭제된 서로 다른 매장은 합쳐진다 — 개명 이력이 데이터에 없어 읽는 쪽이 복원할 수 없는 한계이고, 기록이 통째로 사라지는 id-only 보다 낫다고 판단한 것(07-CONTEXT D-02)."
2. spec 2건 추가로 경계를 못 박는다(현재 동작을 고정하는 것이지 바꾸는 것이 아니다):
```ts
it("개명 뒤 삭제된 매장은 이름 스냅샷 수만큼 갈라진다 — 개명 이력이 없어 되돌릴 수 없는 한계", () => {
  const { list } = buildRanking([row("2026-10-01", "A"), row("2026-10-02", "A"), row("2026-10-03", "B")]);
  expect(list.map((e) => [e.key, e.wins])).toEqual([["A", 2], ["B", 1]]);
});
it("같은 이름으로 등록됐다 삭제된 서로 다른 매장은 이름 키로 합쳐진다", () => {
  const { list } = buildRanking([row("2026-10-01", "김밥집"), row("2026-10-02", "김밥집")]);
  expect(list).toHaveLength(1);
});
```
3. `07-CONTEXT.md:22` D-02 문장에도 같은 단서를 한 줄 단다.

## Info

### IN-01: "로컬 Date 메서드를 쓰는 유일한 자리" 는 사실이 아니다

**File:** `lib/history.ts:68`
**문제:** `components/CalendarLog.tsx:191` 의 `DetailView` 도 `new Date(y, m - 1, d).getDay()` 로 요일을 구한다. `.planning/codebase/CONVENTIONS.md:148` 은 두 곳을 모두 허용 예외로 적고 있어 주석만 틀렸다.
**제안:** "로컬 Date 메서드를 쓰는 두 자리 중 하나(`components/CalendarLog.tsx` `DetailView` 의 요일 계산이 나머지)" 로 고친다.

### IN-02: `RANK_COLUMNS` 문자열과 `RankRow` 타입이 서로를 모른다

**File:** `app/rank/page.tsx:17-18`
**문제:** 한쪽에 컬럼을 더하고 다른 쪽을 잊으면 tsc 가 잡지 못하고 런타임에 `undefined` 필드가 조용히 생긴다(B7). 또 `RankRow` 는 `lib/history.ts` 의 `HistoryRow` 에 `id` 를 더한 것과 같은데 `Pick` 을 따로 나열해 정의처가 둘이 됐다.
**제안:**
```ts
import { type HistoryRow } from "@/lib/history";
const RANK_COLUMN_LIST = ["id", "date", "menu", "restaurant_id"] as const satisfies readonly (keyof ResultRow)[];
const RANK_COLUMNS = RANK_COLUMN_LIST.join(",");
type RankRow = HistoryRow & Pick<ResultRow, "id">;
```
(`RANK_COLUMN_LIST` 와 `RankRow` 의 키 집합이 같다는 것까지 타입으로 묶으려면 `Pick<ResultRow, (typeof RANK_COLUMN_LIST)[number]>` 를 쓰고 `HistoryRow` 와의 호환은 `RankingView` 호출부에서 구조적으로 검사된다.)

### IN-03: 같은 이름 `RankRow` 가 페이지에서는 타입, 컴포넌트에서는 함수다

**File:** `app/rank/page.tsx:18` · `components/RankingView.tsx:142`
**문제:** 한 기능 안에서 동일 식별자가 두 뜻(상태 행 타입 / 4위 이하 표 행 컴포넌트)으로 쓰인다. 지금은 파일이 달라 충돌하지 않지만 grep·리팩터 시 혼동한다(B6).
**제안:** 컴포넌트를 `RankTableRow` 로, 또는 타입을 `RankResultRow` 로 바꾼다.

### IN-04: Realtime 경로는 컬럼을 좁히지 않는다 — 조회만 좁힌 상태가 된다

**File:** `app/rank/page.tsx:83-84,92-93`
**문제:** `payload.new as ResultRow` 를 그대로 `RankRow[]` 에 넣는다. 타입은 상위 구조라 통과하고 동작도 맞지만, D-06 의 "candidates jsonb 제외" 는 조회 응답에만 적용되고 Realtime 으로 들어온 행은 `candidates`·`spun_at` 을 통째로 들고 상태에 남는다. 상태의 행 모양이 출처에 따라 다르다는 것을 타입이 감춘다.
**제안:**
```ts
const toRankRow = ({ id, date, menu, restaurant_id }: ResultRow): RankRow => ({ id, date, menu, restaurant_id });
// INSERT: const row = toRankRow(payload.new as ResultRow);
// UPDATE: 동일
```

### IN-05: spec 픽스처 타입을 `HistoryRow` 로 묶지 않은 근거가 부정확하고, 묶으면 드리프트를 tsc 가 잡는다

**File:** `lib/history.test.ts:6-7,13`
**문제:** 주석은 "행 타입이 사는 모듈은 로드 시점에 환경변수를 읽으므로 spec 이 묶이면 러너에서 즉사한다" 고 하는데, `import type { HistoryRow } from "@/lib/history"` 는 트랜스파일에서 통째로 지워져 `lib/supabase/client.ts` 를 로드하지 않는다(`lib/history.ts:6-7` 자신이 같은 논증으로 `import type` 을 쓴다). 같은 문장이 `lib/candidates.test.ts:6-7` 에도 있어 레포 관례이긴 하다. 로컬 `Row` 는 지금 `HistoryRow` 와 구조가 같지만 연결이 없어 `HistoryRow` 에 필드가 늘어도 spec 은 그대로 통과한다.
**제안:** `type Row = HistoryRow;` 로 바꾸고 주석을 "타입 import 는 지워지므로 안전하다" 로 정정한다(candidates spec 도 같이 고치면 관례가 한 갈래가 된다). 덤으로 `buildMonthGrid` "12월의 뒤 패딩" 은 `trailing.length > 0` 대신 정확히 9칸(2026-12-01 화요일 → 앞 2 + 31 = 33)을 단언하면 더 강하다.

### IN-06: 재조회는 상태를 통째로 갈아끼워 조회 중 도착한 Realtime 이벤트를 버린다

**File:** `app/rank/page.tsx:69`
**문제:** `setResults(data as RankRow[])` 는 응답으로 상태를 대체한다. SELECT 스냅샷 이후 커밋됐지만 응답보다 먼저 도착한 INSERT/UPDATE 이벤트는 사라진다. 초기 로드에서는 이전부터 있던 창(`lib/rowset.ts` 의 `pending` 버퍼가 매장·후보에서만 이것을 흡수한다)인데, 이 페이즈부터 전환일 변경이 **임의 시점**에 같은 창을 다시 연다. 전환일 변경은 드물어 실익은 작다.
**제안:** 코드 변경 없이 `in-07-realtime-resync-on-reconnect.md`(Phase 8) 에 "랭킹 재조회 창" 을 한 줄 덧붙여 결정을 한곳에서 하게 한다.

### IN-07: 같은 값에 대한 null 판정 관용구가 두 갈래다

**File:** `app/log/page.tsx:128` vs `lib/history.ts:17`·`app/rank/page.tsx:56`
**문제:** 부제는 `settings.historySince ? … : …`(truthy), 필터와 조회 경계는 `=== null`. 지금 런타임 형태는 `string | null` 뿐이라 결과가 같지만, 빈 문자열이 흘러들면 부제는 기본 문구·필터는 전부 통과·조회는 `.gte("date", "")` 로 셋이 제각각 갈린다.
**제안:** `settings.historySince !== null ? … : …` 로 맞춘다. 부제 문구가 wr-01 8번의 하루 동안 미래 날짜("2026.10.02 부터의 매장 기록" 를 10.01 에 표시)를 보이는 것도 같은 줄이라 함께 볼 만하지만, 그 하루의 정직한 상태라 문제 삼지 않는다.

## Summary Table

| 심각도 | 건수 | 항목 |
|---|---|---|
| Critical | 0 | — |
| Warning | 3 | WR-01 컷오버 전 DB 에서 랭킹 42703(문서 주장과 반대) · WR-02 랭킹 조회 직렬화로 "추첨 대기" 라벨 창 · WR-03 개명 후 삭제 분리(주석·spec 경계) |
| Info | 7 | IN-01 "유일한 자리" 주석 오류 · IN-02 컬럼 문자열/타입 미연결 · IN-03 `RankRow` 동명이의 · IN-04 Realtime 행 미축소 · IN-05 픽스처 타입 근거 · IN-06 재조회 창 · IN-07 null 관용구 |

**Verdict:** 판단 로직(`lib/history.ts`)과 deps·토픽·병합은 정확하고 spec 이 실제 값을 단언한다. 머지 전에 고칠 것은 Warning 3건 — 그중 WR-01 은 코드가 아니라 문서·컷오버 절차의 사실 정정이고, WR-02 는 `resultsLoaded` 한 줄, WR-03 은 주석 정정 + spec 2건이다.

---

_Reviewed: 2026-09-29T05:35:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
