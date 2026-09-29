# Phase 7: 기록·랭킹 - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

기록 캘린더(`app/log`)와 랭킹(`app/rank`)이 `settings.history_since` **이후** 결과만 **매장 기준**으로 보여준다(HIST-01·HIST-02). 과거 60행은 DB 에 그대로 남고 화면·집계에서만 빠진다(HIST-03, Phase 2 완료). 집계·달력 산술은 `lib/history.ts` 순수 모듈로 내려 단위 테스트로 고정한다.

하지 않는 것: 컷오버·README·배포(Phase 8), 결과 행에 매장 상세(메뉴·위치) 표시(요구 없음), `settings` 편집 UI(v2), Realtime 구독 실패 표면화(전 페이지 공통, 범위 밖). 컷오버 전 라이브에서 두 페이지는 "설정 불러오기 실패" 배너 + 전체 기간 표시가 정상이다(`historySince === null` → 자르지 않는다, SETT-03).

</domain>

<decisions>
## Implementation Decisions

사용자 위임("알아서", 2026-09-29) + "프로젝트 볼륨에 비해 시간이 너무 든다" → 이 페이즈는 **플랜 1개, 실행·수정 직접**(에이전트 체인 최소). 판단 우선순위: 레포 관례(순수 모듈 + 얇은 컴포넌트) → 오늘 탭(Phase 6)과의 일관성 → 서버 계약(Phase 4) 정합.

### 필터·집계 정의처 — `lib/history.ts`(순수, `import type { ResultRow }` 만)
- **D-01** `filterSince<T extends { date: string }>(rows: T[], historySince: string | null): T[]` — `null` 이면 전부(전환일 미확정·컷오버 전), 아니면 `date >= historySince`(둘 다 KST `"yyyy-mm-dd"` 라 문자열 비교, **당일 포함**). 두 페이지가 화면에 올리는 행은 전부 이 함수를 지난다 — 정의처가 하나여야 "전환일 이후" 의 뜻(포함/미포함)이 페이지마다 갈리지 않는다.
- **D-02 (랭킹 키)** `buildRanking` 의 집계 키는 **`restaurant_id ?? menu`** 다. 표시 이름은 그 키의 **가장 최근 당첨일 행의 `menu` 스냅샷**(개명하면 새 이름으로 합쳐 보인다). 매장이 지워지면 `on delete set null` 이 그 매장의 **모든** 행을 한 번에 null 로 바꾸므로 이름 키로 다시 한 덩어리가 된다 — 갈라지지 않는다. 같은 이름을 새로 등록하면 새 id → 별도 줄(다른 매장이 맞다). 대안 "이름으로만 키잉" 기각: 개명 시 두 줄로 갈라진다. 대안 "id 로만" 기각: 삭제된 매장의 기록이 랭킹에서 통째로 사라진다(CATL-03 스냅샷 전제와 충돌).
- **D-03 (정렬)** `wins` 내림차순 → `lastDate` 내림차순(기존 규칙 유지) → 키 문자열 오름차순(결정성 보장 — `lastDate` 는 날짜당 결과 1행이라 실제로는 동률이 없지만 spec 이 순서를 못 박는다). `share = wins / total`, `total` 은 필터 통과 행 수.
- **D-04** `buildRanking`·`buildMonthGrid` 를 `components/RankingView.tsx`·`components/CalendarLog.tsx` 에서 **`lib/history.ts` 로 옮겨 export** 한다(ROADMAP 성공 기준 4). `CalendarLog` 헤더의 "이번 달 최다" 도 `buildRanking(entriesThisMonth).list[0]` 로 바꿔 집계 정의처를 하나로 한다(이름 키 `counts[e.menu]` 삭제). `buildMonthGrid` 의 로컬 `Date` 산술은 "지금" 을 읽지 않는 순수 달력 산술이라 그대로 두고 Why 주석을 옮긴다(CONVENTIONS 허용 예외).
- **D-05 (타입)** `HistoryRow = Pick<ResultRow, "date" | "menu" | "restaurant_id">` 를 `lib/history.ts` 가 export 하고 `buildRanking`·`RankingView` 는 이 타입을 받는다. 랭킹 페이지 state 는 `RankRow = Pick<ResultRow, "id" | "date" | "menu" | "restaurant_id">`(id 는 Realtime 멱등 병합용). `CalendarLog` 는 상세에 `candidates` 를 쓰므로 `ResultRow` 그대로.

### 조회·Realtime — 페이지
- **D-06 (랭킹 조회)** `settingsLoaded` 가 참이 된 뒤에만 조회하고, `historySince` 가 있으면 `.gte("date", historySince)`, 컬럼은 `RANK_COLUMNS = "id,date,menu,restaurant_id"`(`candidates` jsonb·`spun_at` 제외 — ROADMAP "컬럼·기간을 좁혀 행 상한 리스크 축소"). effect deps `[settingsLoaded, historySince]` → 대시보드에서 전환일을 바꾸면 `useSettings` 의 Realtime 이벤트가 재조회를 일으킨다(성공 기준 3). 조회 경계는 **대역폭 최적화**이고 정의는 D-01 이다 — 화면에 올리기 전 `filterSince` 를 한 번 더 지난다(memo). 컷오버 전(설정 실패 → `loaded` 참·`historySince` null)은 무제한 조회라 현행과 같다. 설정 로드를 기다리는 비용(한 왕복)은 받아들인다 — 기다리지 않으면 무제한 조회 → 로드 후 재조회 두 번이 된다.
- **D-07 (기록 조회)** 월 창(`[보는 달 1일, 두 달 뒤 1일)`) 조회는 전환일과 무관하게 그대로 두고 화면 행만 `filterSince` 를 지난다(memo). 헤더 부제는 `historySince` 가 있으면 `"{yyyy.mm.dd} 부터의 매장 기록 · 그날의 후보 수까지"` 로 바꿔 빈 달이 고장이 아니라 경계임을 말한다. `count`(n일의 점심)·`logMap` 은 필터 통과 행 기준, **`phase` 계산의 "오늘 결과 있음" 은 필터 전 행 기준**(오늘 행의 존재는 전환일과 무관).
- **D-08 (토픽)** 두 페이지의 고정 토픽 `"log-results"`·`"rank-results"` 를 `results-log-<n>`·`results-rank-<n>` 으로 바꾸고 **effect 안에서** 매긴다(Phase 6 CR-01 결정 "토픽은 구독마다"). 랭킹 effect 는 deps 가 `[]` 라 재구독이 없지만 규칙을 한 갈래로 두는 편이 싸다. INSERT/UPDATE 2분기·함수형 멱등 병합·cleanup `removeChannel` 은 그대로(CLAUDE.md 위험 지점).

### 전환일 당일 legacy 행 — todo `in-05` 결정
- **D-09** **(B) 채택**: 읽는 쪽은 당일 `restaurant_id null` 행을 구분하지 않는다. Phase 8 절차(`wr-01-cutover-window.md`)에 한 줄을 추가한다 — "적용이 그날 추첨 이후면 `update public.settings set history_since = history_since + 1 where id = 1;`". 근거: 읽는 쪽 규칙("전환일 당일 + id null 제외")은 그날 당첨 매장이 나중에 삭제되면 정당한 행까지 지우는 오판을 만들고, SQL 한 줄은 "전환일 = 첫 매장 추첨일" 이라는 뜻을 데이터에 그대로 남긴다. `0005` 의 `comment on column` 문구("이 날짜 이후 results 만 집계")와 어긋나지 않는다. `in-05` 파일은 `git rm`.

### 정리·문구
- **D-10** `lib/time.ts` 의 `formatHhMm`(참조 0, Phase 6 이 소비처를 지웠다)과 `lib/time.test.ts` 의 spec 3건을 **삭제**한다. 기록 페이지도 쓰지 않는다 — 날짜 키만 다룬다.
- **D-11** 화면 낱말 "메뉴" → "매장": `RankingView`(제목 "가장 많이 당첨된 매장", 부제 "총 n개 매장", 표 머리 "매장", "n개 매장"), `CalendarLog`(부제 "가장 많이 간 매장", 상세 "n개의 매장 중 선택", 빈 상세 "어디서 먹었는지"), `app/log` 부제. 기록 상세의 후보 목록은 `results.candidates[].name` 그대로(Phase 4 부터 매장명).
- **D-12 (테스트)** `lib/history.test.ts` — `filterSince` 4(null 전부 · 당일 포함 · 이전 제외 · 입력 순서 보존) · `buildRanking` 9(id 키 합산 · 개명 → 최근 스냅샷 이름 · 삭제(null) 행은 이름 키 · legacy(null) 와 id 는 갈라짐이 아니라 각자 · wins 정렬 · 동률 lastDate 역순 · 결정성 키 · share/total · 빈 입력) · `buildMonthGrid` 7(42칸 · 1월 앞 패딩은 전년 12월 · 12월 뒤 패딩은 익년 1월 · 윤년 2월 29일 · 첫 칸 요일 정렬 · dim 플래그 · 31일 월). 기준선 361 → 361 − 3 + 20 = **378**.
- **D-13 (문서)** `CLAUDE.md`(엔트리포인트 log/rank 줄·`lib/history.ts` 줄·위험 지점 log/rank 행·미사용 코드 문단), `.planning/codebase/{STRUCTURE,CONVENTIONS,CONCERNS,INTEGRATIONS,ARCHITECTURE,TESTING}.md` 의 `buildRanking`/`buildMonthGrid` 위치·`formatHhMm`·토픽 참조 정정. `README.md` 는 손대지 않는다(Phase 8).

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` §Phase 7 — 성공 기준 4 + 로컬 검증 문장(컬럼·기간 축소).
- `.planning/todos/pending/in-05-history-since-same-day.md` — D-09 가 닫는다. `wr-01-cutover-window.md` — D-09 가 한 줄 추가.
- `lib/settings.ts:25-27,67` — `historySince: string | null`, null 의 뜻. `lib/supabase/client.ts:12-19,44` — `ResultRow`·`history_since` 형식.
- `app/log/page.tsx`·`app/rank/page.tsx` — 조회·구독·배너 골격(유지). `components/RankingView.tsx:13-26`·`components/CalendarLog.tsx:17-41,57-67` — 옮길 순수 함수.
- `app/page.tsx` results 구독 — `results-${++topicSeq}` 를 effect 안에서 매기는 원형(D-08).
- `.planning/codebase/CONVENTIONS.md:148` — `buildMonthGrid` 로컬 `Date` 허용 예외 문장.

</canonical_refs>

<code_context>
## Existing Code Insights

- 두 페이지 모두 `useSettings` 를 이미 부른다(Phase 6 D-23) — `historySince` 는 추가 I/O 없이 손에 있다.
- 두 페이지의 Realtime INSERT/UPDATE 병합은 함수형 업데이터 + id 멱등(CONVENTIONS) — 유지.
- `CalendarLog` 의 `DetailView` 는 `entry.candidates` 를 쓴다 → 기록 조회는 컬럼을 좁히지 않는다(랭킹만 좁힌다).

</code_context>

<specifics>
## Specific Ideas

- 컷오버 전 라이브에서는 설정 실패로 `historySince` 가 null → 두 페이지가 현행과 동일하게 전체 기간을 보인다. 그래서 이 페이즈도 main·라이브에 영향이 없다.
- 랭킹 대기: 설정 로드 전에는 결과를 조회하지 않으므로 첫 페인트는 빈 상태(현행도 조회 전엔 빈 상태).

</specifics>

<deferred>
## Deferred Ideas

- 기록 상세에 당첨 매장의 현재 메뉴·위치(`MenuChips`·`LocationLink`) — 요구 없음, 필요 제기 시 카탈로그 훅 하나 추가로 가능.
- 랭킹 기간 선택(월별·연도별) — v2.
- Realtime 재연결 재조회 — todo `in-07`(Phase 8 결정).

### Reviewed Todos
- `in-05-history-since-same-day.md` — D-09 로 접음(이 페이즈에서 `git rm`, `wr-01` 에 한 줄 추가).
- `wr-01-cutover-window.md`·`in-07-realtime-resync-on-reconnect.md` — Phase 8.

</deferred>

---

*Phase: 07-history-ranking*
*Context gathered: 2026-09-29*
