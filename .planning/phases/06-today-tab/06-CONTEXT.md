# Phase 6: 오늘 탭 - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

오늘 탭(`app/page.tsx`)의 후보 소스를 자유 입력 `menus` 에서 **카탈로그 토글 `candidates`** 로 바꾼다(CAND-01·02·03·05). 결과 화면은 당첨 **매장명 스냅샷** 에 그 매장의 메뉴·위치를 참고로 붙인다(SPIN-05). 화면의 추첨 시각 문구는 전부 `settings.spin_time` 을 따르고 코드에 사용자에게 보이는 `11:55` 리터럴이 0곳이 된다(SPIN-06). `MenuList`·`MenuRow`·`PinnedMenuRow` 는 이 페이즈에서 사라진다.

하지 않는 것: 기록·랭킹의 `history_since` 필터(Phase 7), 배포·마이그레이션 적용·README·컷오버(Phase 8), 매장 등록·수정·핀 UI(Phase 5 완료, 매장 탭), `settings` 편집 UI(v2). 라이브 DB 에는 아직 `restaurants`·`candidates`·`settings` 가 없으므로 컷오버 전 오늘 탭은 **세 배너(매장 카탈로그·오늘 후보·설정) + 빈 휠** 이 정상이다 — 결과 조회만 성공한다(SETT-03·05-CONTEXT §domain 과 같은 논증).

</domain>

<decisions>
## Implementation Decisions

사용자가 전부 위임했다("알아서", 2026-09-29). 아래는 Claude 가 레포 관례·이전 페이즈 결정·이관된 리뷰 항목에서 도출한 **확정** 결정이다 — 플래너·실행자는 되묻지 않고 따른다. 판단 우선순위: 레포 관례(순수 모듈 + I/O 훅, Realtime 단일 갱신 경로) → 매장 탭(Phase 5)과의 일관성 → 서버 추첨 계약(Phase 4)과의 정합.

### 데이터 흐름 — 훅 2개 + 클라이언트 조인
- **D-01** 오늘 탭은 **`useRestaurants()`(기존, 그대로) + `useCandidates()`(신규, `lib/useCandidates.ts`)** 두 훅으로 읽는다. `candidates` 행은 `{ restaurant_id, created_at }` 뿐이라 Realtime INSERT 페이로드만으로는 매장명을 알 수 없다 — 임베드 조회(`candidates.select("*, restaurants(*)")`) 로 시작해도 이벤트마다 재조회가 필요해진다. 카탈로그는 토글 목록을 그리기 위해 어차피 전부 필요하므로 **조인은 클라이언트 순수 함수** 가 한다. 훅은 읽기 전용이고 쓰기(담기·빼기)는 페이지 핸들러가 직접 부른다(Phase 5 D-08·D-16 과 동일).
- **D-02** `useCandidates` 는 `useRestaurants` 를 그대로 복제한다: SELECT 1회(`order("created_at")`) + 토픽 `candidates-<n>`(`topicSeq`, 인스턴스별 유일) + **INSERT·DELETE 2분기** 구독. UPDATE 를 구독하지 않는 이유: PK 와 `created_at` 뿐인 테이블이라 앱 경로에 UPDATE 가 없다(Why 주석으로 남긴다). DELETE 는 `payload.old.restaurant_id`(PK 가 replica identity) 만 온다.
- **D-03 (리듀서 일반화 — 두 번째 사용처)** 목록 리듀서를 **`lib/rowset.ts`** 의 제네릭 `createRowSetReducer<Row>(keyOf)` 로 뽑고 `lib/restaurants.ts`·`lib/candidates.ts` 가 각자 인스턴스(`keyOf = row.id` / `row.restaurant_id`)를 export 한다. `pending` 버퍼 재적용(05-REVIEW CR-01)·중복 INSERT 멱등·DELETE key null 무시·`fetched` 중복 응답 무시 계약은 그대로 옮긴다. 두 벌로 두면 CR-01 급 버그가 한쪽에만 고쳐지는 날이 온다(A-4 변경 국소성). `RestaurantsState`·`INITIAL_RESTAURANTS_STATE`·`restaurantsReducer` 이름은 유지하되 액션 이름은 D-04 로 바뀐다(테스트 갱신).
- **D-04 (todo in-03 접음 — 훅 분기를 리듀서로)** 리듀서 액션은 두 종류뿐이다: `{ type: "fetched"; rows: Row[] | null; error: { message: string } | null }` 와 `{ type: "changed"; event: "INSERT" | "UPDATE"; row: Row } | { type: "changed"; event: "DELETE"; key: string | null }`. `fetched` 는 `error` 가 있으면 실패 경로(`rows` 가 함께 와도), 없으면 `rows ?? []` 로드 경로 — 그 판정이 리듀서 spec 으로 고정된다. `lib/settings.ts` 도 같은 형태로 바꾼다: `{ type: "fetched"; row: SettingsRow | null; error: { message } | null }` · `{ type: "changed"; event; row: SettingsRow | null }` 이고 DELETE 면 `row` 를 보지 않는다(`payload.new` 는 DELETE 에서 `{}` 다). `state.loaded` 가드는 유지한다. 그러면 `useSettings`·`useRestaurants`·`useCandidates` 세 훅에 `if` 가 0개가 되고 CLAUDE.md 의 "훅에는 I/O 만" 문장이 문면 그대로 참이 된다. `lib/settings.test.ts` 머리 주석(현재 "훅에 남은 분기 2개는 낭독으로 검증")을 함께 고친다.
- **D-05 (05-REVIEW IN-02 결정)** 제네릭 리듀서의 UPDATE 는 **upsert** 다 — 있으면 통째 교체, 없으면 추가. `payload.new` 가 전체 행이라 안전하고, 재연결 틈에 놓친 INSERT 가 이후 UPDATE 로 복구된다. Postgres 변경 스트림은 순서가 보장되므로 DELETE 뒤에 같은 키의 UPDATE 가 오는 일은 없다(되살아남 없음). `lib/restaurants.test.ts` 의 "모르는 id 의 UPDATE 는 목록을 바꾸지 않는다" spec 은 반대 기대로 뒤집는다.
- **D-06 (todo wr-02 접음)** 휠·후보 목록 순서는 **`candidates.created_at` 오름차순, 동률이면 `restaurants.created_at` 오름차순, 그래도 동률이면 `id`** 다. 자정 재시드는 한 문장 insert 라 `candidates.created_at` 이 전부 같고 두 번째 키가 핀을 꽂은 순서를 복원한다. SQL 은 바꾸지 않고(2026-09-21 사용자 결정) 순수 함수 `joinCandidates(candidates, restaurants)` 가 정렬한다 — 조회 쿼리의 `.order()` 는 보조일 뿐 정본이 아니다.

### 순수 모듈 `lib/candidates.ts` (import: `lib/constants`·`lib/supabase/client` 의 `import type` 뿐)
- **D-07** export 목록: `candidatesReducer`·`INITIAL_CANDIDATES_STATE`·`CandidatesState`(D-03 인스턴스) / `type TodayCandidate = { id: string; name: string; menus: string[]; location: string | null; pinned: boolean; addedAt: string }` / `joinCandidates(candidates: CandidateRow[], restaurants: RestaurantRow[]): TodayCandidate[]`(내부 조인 — 카탈로그에 없는 `restaurant_id` 는 버린다: cascade 삭제 이벤트가 두 훅에 따로 도착하는 창의 정상 상태) / `filterRestaurantsByName(rows: RestaurantRow[], query: string): RestaurantRow[]`(trim 후 빈 문자열이면 전부, `normalize("NFC").toLowerCase()` 양쪽 적용 후 `includes`, 이름만 — 메뉴는 검색하지 않는다, CAND-02) / `listTodayRows(candidates: TodayCandidate[], catalog: RestaurantRow[], query: string): TodayRow[]`(`TodayRow = { restaurant: RestaurantRow; slice: number | null }` — 담긴 매장이 휠 순서로 먼저(`slice` = 휠 인덱스), 그 뒤에 안 담긴 매장이 `catalog` 순서(핀 먼저·이름순은 페이지가 `sortRestaurants` 로 이미 정렬해 넘긴다)대로, 필터는 두 구간 모두에 적용) / `findWinnerIndex(items: { id: string }[], result: ResultRow | null): number`(**`restaurant_id` 로만** 찾는다. `restaurant_id` 가 null 이면 -1 — 이름 폴백은 두지 않는다: 매장이 지워지면 후보 행도 cascade 로 사라져 어차피 휠에 없고, 컷오버 전 구 함수의 결과는 메뉴명이라 매장과 맞을 수 없다) / `isNewSpin(prev: ResultRow | null, next: ResultRow): boolean`(`prev === null || prev.spun_at !== next.spun_at`).
- **D-08 (todo in-06 접음 — 휠 재회전 가드)** `app/page.tsx` 의 `applyResult` 는 `todayResultRef`(state 거울, 초기 조회·이벤트 양쪽에서 동기 갱신)와 `isNewSpin` 으로 판정한다: `initialLoadedRef.current && isNewSpin(prev, row)` 일 때만 `forceSpin`. `on delete set null` UPDATE 는 `spun_at` 이 같아 휠이 돌지 않고 행만 갱신된다(`restaurant_id` null → `winnerIndex` -1, 이름 스냅샷은 그대로). 다시 돌리기는 `spun_at` 을 새로 쓰므로 정상 재회전은 산다. `payload.old` 는 PK 만 오므로 `old.spun_at` 비교는 불가능하다 — 그래서 ref 다. setState 업데이터 안에서 `setForceSpin` 을 부르지 않는다(StrictMode 이중 실행). **INSERT → UPDATE 핸들러 순서와 `initialLoadedRef` 의 의미(초기 조회 완료 후 이벤트만 회전)는 그대로 둔다** — 바뀌는 것은 구독 테이블(`menus`·`pinned_menus` 분기 삭제)과 가드 한 줄이다.
- **D-09** 결과 채널 토픽은 고정 문자열 `"lunch-realtime"` 대신 **`results-<n>`**(`topicSeq`) 로 바꾼다. 라우트 전환에서 고정 토픽이 떠나는 채널에 붙어 조용히 죽는 문제(`lib/useSettings.ts:11-15`)가 오늘 탭에도 그대로 있었다. 핸들러 순서·가드는 건드리지 않는 변경이다.

### 후보 목록 UI — `components/CandidateList.tsx`(`MenuList` 대체)
- **D-10** **단일 목록 + 행 토글**: 카탈로그 전체가 한 목록에 보이고, 담긴 매장이 **휠 순서로 위에**(슬라이스 색 번호 배지 `SLICE_COLORS[slice]`, 휠과 같은 매핑), 안 담긴 매장이 그 아래 **흐리게**(배지 없음). 토글은 행 끝의 버튼 하나 — 담긴 행은 "빼기", 안 담긴 행은 "담기", `aria-pressed={담김}`. 두 섹션·두 카드로 나누지 않는 이유: 담기/빼기가 한 동작(토글)이고 목록 하나가 "오늘 무엇이 올라갔나" 를 한눈에 보인다. 토글하면 행이 위/아래로 옮겨가는 것이 피드백이다(`fade-up` 재사용, 낙관적 업데이트 없음 — Realtime 이벤트로만 옮겨간다).
- **D-11** 카드 상단은 등록 폼 대신 **이름 필터 입력** 하나(`placeholder "매장 이름으로 찾기"`, 로컬 state, `maxLength` 없음, 잠금 중에도 사용 가능). 필터 결과 0건이면 목록 자리에 `"{q}" 에 맞는 매장이 없어요`. 카탈로그 자체가 0개(`status === "ready"`)면 `등록된 매장이 없어요. 매장 탭에서 먼저 등록해 주세요.` + `/restaurants` `Link`. `status` 는 `RestaurantListStatus` 와 같은 3상태(`loading`·`failed`·`ready`)를 페이지가 두 훅에서 좁혀 넘긴다: 어느 한쪽 `error` → `failed`, 어느 한쪽 미로드 → `loading`, 아니면 `ready`. 실패에는 아무것도 그리지 않는다(05 WR-03 논증).
- **D-12 (CAND-05)** `readOnly = isCandidateListLocked(phase)` 면 토글 버튼 전부 비활성(`disabled`, 흐림)·헤더 부제 `n개 매장 · 마감됨`. `stalled` 는 잠그지 않는다(SPIN-03). 행 단위 `busyId` 로 진행 중인 행의 재클릭을 무시한다(05 IN-04 `pinBusyId` 전례).
- **D-13** 행 구성: 배지(담긴 행만) · 이름(굵게) · 메뉴 요약 한 줄(흐린 글씨, 앞 3개를 " · " 로 잇고 넘치면 "+n", 없으면 "메뉴 미등록") · 📌 **읽기 전용 표시**(`pinned` 행만, `title "고정 매장 — 매일 자정 자동으로 담겨요"`; 핀 토글은 매장 탭 한 곳에만 둔다, Phase 5 D-07) · 토글 버튼. 위치는 행에 넣지 않는다(결과 화면과 매장 탭에서 본다). `formatHhMm(created_at)` 시각 표시는 없앤다 — 담은 시각은 순서로 충분하다.
- **D-14** 헤더: 제목 "오늘의 후보", 부제 `${n}개 매장 · ${spinTimeText}까지 담기`(잠금이면 `· 마감됨`), 우측 mono 카운터 = 담긴 수. 푸터 규칙 문구: `${spinTimeText}에 룰렛이 자동으로 돌아가요 · 📌 고정 매장은 매일 자정 자동으로 담겨요 · 매장 등록·수정은 매장 탭에서`(마지막 구는 `Link`). `TopBar candidateCount` 와 `ResultBlock candidateCount` 는 **담긴 매장 수**(`joinCandidates` 길이)다.
- **D-15** props: `rows: TodayRow[]`(페이지가 `listTodayRows` 결과를 `useMemo` 로 넘기지 않는다 — 필터 state 가 컴포넌트에 있으므로 컴포넌트가 `candidates`·`catalog` 를 받아 `listTodayRows(candidates, catalog, query)` 를 부른다; 판단은 순수 함수에, 컴포넌트는 호출만) · `candidates: TodayCandidate[]` · `catalog: RestaurantRow[]`(정렬 완료) · `status` · `phase` · `spinTimeText: string` · `onAddAction(id: string, name: string): Promise<boolean>` · `onRemoveAction(id: string, name: string): Promise<boolean>`. 컴포넌트는 supabase 를 부르지 않는다.

### 쓰기 핸들러(페이지)·에러 문구
- **D-16** `addCandidate(id, name)` = `supabase.from("candidates").insert({ restaurant_id: id })`, `removeCandidate(id, name)` = `.delete().eq("restaurant_id", id)`(0행 검사 없음 — "이미 빠져 있음" 이 원하던 상태다). 둘 다 try/catch + `Promise<boolean>`(Phase 5 D-08·05-02 `thrownMessage` 전례). 낙관적 업데이트 없음.
- **D-17** `lib/errors.ts` 에 순수 `formatCandidateWriteError(action: "담기" | "빼기", name: string, error: { code?: string; message: string }): string | null`: `23505`(이미 담김) 이고 `담기` 면 **`null`(사용자에겐 에러가 아니다 — 두 사람이 동시에 담은 것, 화면은 Realtime 으로 맞춰진다)**, `23503`(FK — 클릭 직전에 매장이 지워짐) → `"이미 삭제된 매장이에요: {name}"`, 그 외 → `"매장 \"{name}\" {action} 실패: {message}"`. 페이지는 `null` 이면 성공으로 처리한다. `details`·`hint` 는 싣지 않는다.

### 결과 화면(SPIN-05) — `components/ResultBlock.tsx`
- **D-18** `winner` prop 은 `{ name: string; menus: string[]; location: string | null } | null`. **이름은 항상 `todayResult.menu`(스냅샷)** 이고 메뉴·위치는 페이지가 `restaurants` 에서 `todayResult.restaurant_id` 로 찾은 **현재 카탈로그 행**(`useMemo`)에서 채운다 — 없으면(삭제·`restaurant_id` null·컷오버 전) 빈 배열·null. 이름을 카탈로그에서 다시 읽지 않는 이유: CATL-03 "삭제해도 결과의 매장명은 남는다" 와 기록·랭킹의 스냅샷 전제. 메뉴는 칩, 위치는 `parseLocationLink` 로 링크/텍스트 — 둘 다 `RestaurantList` 안의 렌더를 **`components/MenuChips.tsx`·`components/LocationLink.tsx` 로 뽑아 두 화면이 공유**한다(`MENU_CHIP_LIMIT` 도 그리로). 메뉴·위치가 둘 다 없으면 상세 줄을 그리지 않는다.
- **D-19** `stalled` 문구: "아직 결과가 없어요 · 후보를 담으면 1분 안에 자동으로 뽑아요"(서버가 매분 폴링, SPIN-03). "후보 메뉴" → "매장". **stalled 에 수동 "지금 돌리기" 버튼은 두지 않는다** — pg_cron 이 추첨 시각 이후 매분 `spin-roulette` 를 부르고 그 함수가 후보가 생기면 뽑는다(Phase 4 D-05 순서). 기존 "다시 돌리기"(`decided` 전용)는 그대로.

### 추첨 시각 문구(SPIN-06) — `11:55` 리터럴 제거
- **D-20** `lib/time.ts` 에 `formatSpinTime(t: SpinTime): string`("HH:mm", `import type { SpinTime }`) 과 `addMinutesToSpinTime(t: SpinTime, minutes: number): SpinTime`(24시간 순환) 을 추가하고 테스트한다. 페이지는 `const spinTimeText = formatSpinTime(settings.spinTime)` 한 번 계산해 내려보낸다.
- **D-21** 치환 지점(전부 prop 으로 받는다, 기본값 없음): `app/page.tsx` `phaseSubhead(phase, count, spinTimeText, winnerName)` :389-390 · `components/Wheel.tsx:258` 허브 "SPIN AT" 아래 → `spinTimeText` prop(필수) · `components/ResultBlock.tsx:13` `spinTime = "11:55"` 기본값 삭제 → `spinTimeText` 필수 · `components/PhaseTimeline.tsx:9-11` `STEPS` 의 `time` → 컴포넌트 안에서 `spinTimeText` 로 조립(모집 `—${t}`, 룰렛 `${t}`, 결과 `${formatSpinTime(addMinutesToSpinTime(spinTime, RESULT_STEP_OFFSET_MIN))}—` — `RESULT_STEP_OFFSET_MIN = 5` 는 원 디자인의 11:55→12:00 간격을 유지하는 상수, Why 주석; 리셋 `00:00` 은 그대로) · `MenuList` 의 두 곳은 파일 삭제로 사라진다 · `app/layout.tsx:6` metadata description 은 정적 문자열이라 시각을 **뺀다**: "매일 정해진 시각에 자동으로 돌아가는 익명 점심 매장 룰렛".
- **D-22** 수용 기준: `grep -rn '11:55' app components lib --include='*.ts' --include='*.tsx' | grep -v '//'` → **0건**. 주석(`// … 기본값(11:55) …`)·`supabase/functions/_shared/spinTime.ts` 의 `DEFAULT_SPIN_TIME_TEXT` 정의·마이그레이션 기본값·테스트 리터럴은 남는다(ROADMAP 의 "하드코딩된 문자열 0곳" 은 사용자에게 보이는 문구를 뜻한다). `_shared/spinTime.ts:3` 의 "Phase 6 에서 교체된다" 주석은 과거형으로 고친다.
- **D-23 (todo in-02 접음 — 첫 페인트 라벨)** `lib/phase.ts` 에 `displayPhase(phase: Phase, settingsLoaded: boolean): Phase` 를 추가한다: `!settingsLoaded && phase === "stalled"` → `"accepting"`, 그 외 그대로. 설정 조회가 끝나기 전 기본값 11:55 로 계산한 `stalled` 가 "추첨 대기" 로 깜빡이는 것을 막는다(`loaded` 는 실패 경로에서도 참이라 컷오버 전후 모두 안전). **4개 페이지 전부**(`app/page.tsx`·`app/restaurants/page.tsx`·`app/log/page.tsx`·`app/rank/page.tsx`)에서 `currentPhase(...)` 결과를 `displayPhase(…, settings.loaded)` 로 감싼다 — 한 줄씩이고 라벨 일관성이 목적이다. `lib/phase.test.ts` 에 spec 을 더한다.

### 삭제·이동·정리
- **D-24** `components/MenuList.tsx` 를 삭제하고 `parseMenuInput`·`truncateToCodePoints` 를 **`lib/menus.ts`** 로 옮긴다(`components/MenuList.test.ts` → `lib/menus.test.ts`, 13건 그대로). `lib/restaurants.ts` 는 `@/lib/menus` 를 import 해 **`lib/` → `components/` 단방향 예외가 사라진다**(CLAUDE.md·STRUCTURE.md 의 "예외 1곳" 문단 삭제). `lib/supabase/client.ts` 에서 `MenuRow`·`PinnedMenuRow` 삭제(참조 0 확인 후). `lib/constants.ts` 의 `MENU_NAME_MAX_LEN` 주석은 `menus.name`/`pinned_menus.name` 이 아니라 `restaurants.name`·`restaurants.menus` 원소(0005 check) 를 가리키도록 고친다.
- **D-25 (05-REVIEW IN-05 결정)** `components/RestaurantList.tsx` 메뉴 입력의 `maxLength={MENUS_INPUT_MAX_LEN}`(120) 과 그 상수를 **없앤다**. 이름·위치의 `maxLength` 를 이미 같은 이유(코드유닛≠코드포인트)로 뺐고(05 WR-02), 개수 30·원소 24 상한은 `parseRestaurantForm` 이 이유까지 말한다. 오늘 탭에는 더 이상 자유 입력이 없어 `INPUT_MAX_LEN` 대칭 논의 자체가 사라진다.
- **D-26** 접은 todo 4건은 해당 결정을 구현한 플랜에서 `git rm`: `in-02`(D-23)·`in-03`(D-04)·`in-06`(D-08)·`wr-02`(D-06). `in-05`·`wr-01` 은 남긴다.

### 테스트·게이트·문서
- **D-27** vitest(렌더 하네스 없음): `lib/rowset.test.ts`(pending 재적용 순서·중복 INSERT 멱등·UPDATE upsert·DELETE key null·`fetched` 에러 우선·중복 응답 무시), `lib/restaurants.test.ts`(액션 이름 이관 + D-05 반전), `lib/settings.test.ts`(`fetched` error-우선·0행·`changed` DELETE 무시 row), `lib/candidates.test.ts`(조인 순서 3키·누락 매장 제외·필터 빈/공백/대소문자/NFC/0건·`listTodayRows` 배지 인덱스와 필터·`findWinnerIndex` id/null/삭제·`isNewSpin`), `lib/phase.test.ts`(`displayPhase`), `lib/time.test.ts`(`formatSpinTime` 0패딩·`addMinutesToSpinTime` 순환), `lib/errors.test.ts`(`formatCandidateWriteError` 3갈래 + null), `lib/menus.test.ts`(이동). 기준선 296 → 늘어난다(플래너가 개수 계산). 게이트 5종(`tsc`·`lint`·`test`·`build`·`check:edge`) 매 플랜 초록. `supabase/functions/_shared/edgeImports.test.ts` #56 은 `app/page.tsx` 의 `"no_candidates"` 리터럴이 **정확히 1개** 여야 한다 — 다시 돌리기 핸들러는 그대로 남으므로 지키되, 주석·문자열에 두 번째 리터럴을 만들지 않는다.
- **D-28** 문서 정정은 같은 페이즈에서(Phase 5 D-19 전례): `CLAUDE.md` 엔트리포인트(오늘 탭 문단을 `candidates`·`restaurants`·`results` 기준으로, `lib/candidates.ts`·`lib/useCandidates.ts`·`lib/rowset.ts`·`lib/menus.ts`·`components/CandidateList.tsx`·`MenuChips`·`LocationLink` 추가, "Phase 6" 예고 문구 삭제, 흐름 문단, `lib/` 단방향 예외 삭제, 훅 컨벤션 문장, "아직 남은 중복은 두 갈래" 문단, RLS 문장 `menus` → `restaurants`·`candidates`), 위험 지점 표(`winnerIndex` 행 → id 기준·삭제 시 -1 / `app/page.tsx` realtime 행 → results 2분기 + `isNewSpin`·`todayResultRef` 가드 / `lib/useRestaurants.ts` 행 → `lib/rowset.ts` pending 버퍼로 일반화, `useCandidates` 포함), `.planning/codebase/STRUCTURE.md`·`CONVENTIONS.md`(`MenuList` 참조 → `CandidateList`/`RestaurantList`, `INPUT_MAX_LEN` 항목 삭제, 훅 목록)·`CONCERNS.md`(11:55 하드코딩 항목 해소 표기, `MenuList` 참조 정리; 계약 수 58 유지). `README.md` 는 Phase 8(SHIP-03).

### Claude's Discretion
- 필터 입력·토글 버튼·배지·흐림 처리의 정확한 스타일(토큰 `--accent`·`--line`·`--bg-soft`·`--muted` 만), 안 담긴 행의 흐림 정도, 메뉴 요약 구분자.
- `TodayRow`·`TodayCandidate`·`RowSetState` 등 타입/함수의 정확한 이름·시그니처(위 이름은 의도이지 문자 계약이 아니다 — 단 `lib/` 파일명 4개(`rowset`·`candidates`·`useCandidates`·`menus`)와 컴포넌트 파일명 3개(`CandidateList`·`MenuChips`·`LocationLink`)는 고정).
- `phaseSubhead`·헤드라인의 정확한 문안(단 `spinTimeText` 를 포함하고 "메뉴" 대신 "매장").
- `todayResultRef` 갱신 위치(초기 조회·`applyResult`)의 코드 배치.
- `useCandidates` 조회의 `.order()` 사용 여부(정본은 D-06 순수 정렬).
- 플랜 분할: 06-01 순수 로직(D-03~D-07·D-17·D-20·D-23·D-24 의 `lib/` 부분 + 훅 3개의 액션 이관, TDD) / 06-02 UI·배선·문서(D-08~D-16·D-18·D-19·D-21·D-22·D-25·D-26·D-28 + `requirements.mark-complete`). 두 플랜 모두 게이트 5종 초록으로 끝난다.

### Folded Todos
- **in-02-settings-loaded-first-paint** (`.planning/todos/pending/in-02-settings-loaded-first-paint.md`, 03-REVIEW IN-02) — 설정 로드 전 `stalled` 라벨 깜빡임. D-23 `displayPhase` 로 접음.
- **in-03-usesettings-branches-to-reducer** (`.planning/todos/pending/in-03-usesettings-branches-to-reducer.md`, 03-REVIEW IN-03) — 훅 분기 2개를 리듀서 액션으로. D-04 로 접음(세 훅에 동일 적용).
- **in-06-results-update-on-delete-set-null** (`.planning/todos/pending/in-06-results-update-on-delete-set-null.md`, 04-REVIEW IN-09) — `on delete set null` UPDATE 가 휠을 재회전. D-08 `isNewSpin` 가드로 접음.
- **wr-02-pinned-reseed-order** (`.planning/todos/pending/wr-02-pinned-reseed-order.md`, 02-REVIEW WR-02) — 재시드 행 동률 정렬. D-06 클라이언트 3키 정렬로 접음(SQL 불변).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 범위·요구사항
- `.planning/ROADMAP.md` §Phase 6 — Goal·Success Criteria 5·로컬 검증(`winnerIndex` id 기준·`11:55` grep·realtime 핸들러 구조 유지). §Phase 7·8 — 이 페이즈가 하지 않는 것.
- `.planning/REQUIREMENTS.md` §오늘 후보 (CAND-01·02·03·05; CAND-04 는 Phase 2 완료) + §추첨 SPIN-03(stalled 는 잠그지 않는다)·SPIN-05·SPIN-06 + §Out of Scope.
- `.planning/PROJECT.md` — Core Value·Key Decisions(후보 선택 = 카탈로그 토글, 결과 = 매장·메뉴는 참고 표시).

### 스키마·서버 계약 (변경 금지)
- `supabase/migrations/0005_restaurants_settings.sql` :36-45 `candidates`(PK `restaurant_id`, `on delete cascade`, `created_at` 인덱스), :66-69 `results.restaurant_id`(`on delete set null` — UPDATE 이벤트 경고 주석), :87-94 `candidates` RLS 전면 개방, :147-153 자정 `reset-candidates`(`delete from` + 핀 재시드 한 문장 insert — D-06 동률의 원인).
- `.planning/phases/04-server-spin/04-CONTEXT.md` D-05(추첨 순서)·D-09(응답 형태) — `results.menu` 가 매장명 스냅샷, `restaurant_id` 가 함께 실린다는 계약. `supabase/functions/respin-roulette/index.ts` — `spun_at` 을 항상 새로 쓰는 upsert(D-08 의 근거).
- `lib/supabase/client.ts` — `ResultRow`(`restaurant_id: string | null`, `spun_at`)·`RestaurantRow`·`CandidateRow`·`SettingsRow`(수동 유지, 유일 정의처).

### 이전 페이즈 결정·이관 항목
- `.planning/phases/05-restaurants-tab/05-CONTEXT.md` D-07(핀 토글은 매장 탭)·D-08(쓰기는 페이지 핸들러)·D-09(`sortRestaurants`)·D-13·D-16(훅 읽기 전용)·D-17(컴포넌트 구조)·§deferred(Phase 6 인계 목록).
- `.planning/phases/05-restaurants-tab/05-REVIEW.md` CR-01(`pending` 버퍼 — D-03 이 옮기는 계약)·IN-02(D-05 로 결정)·IN-05(D-25 로 결정)·IN-11 이후 `restaurants.ts:93-183` 리듀서 본문.
- `.planning/todos/pending/{in-02-settings-loaded-first-paint,in-03-usesettings-branches-to-reducer,in-06-results-update-on-delete-set-null,wr-02-pinned-reseed-order}.md` — 접은 todo 4건의 원문(각각 해결 방법·주의 포함).

### 관례·재사용 원형
- `CLAUDE.md` — 컨벤션·위험 지점(`app/page.tsx` realtime 핸들러·`winnerIndex`)·검증 명령 5종·가드런처 규칙·`lib/` 단방향 규칙과 그 예외(이 페이즈에서 삭제).
- `.planning/codebase/CONVENTIONS.md` — inline style·`~Action`·Realtime 단언 패턴·훅 규칙·`aria-pressed`. `.planning/codebase/STRUCTURE.md` §"Where to Add New Code".
- `lib/restaurants.ts` :93-183 + `lib/useRestaurants.ts` — 리듀서·훅 원형(D-03·D-02 가 일반화/복제). `lib/settings.ts`·`lib/useSettings.ts` — D-04 대상.
- `app/page.tsx` :44-150 — `initialLoadedRef`·`applyResult`·채널 구성(D-08·D-09 가 손대는 자리, 순서 유지), :379-396 문구 함수(D-21).
- `components/MenuList.tsx` — 카드 골격·`PinButton`·빈 상태(`CandidateList` 의 포팅 원형, 완료 후 삭제). `components/RestaurantList.tsx` :300-362 `RestaurantRowView` — 칩·위치 링크 렌더(D-18 이 뽑는 자리), :22 `MENUS_INPUT_MAX_LEN`(D-25).
- `components/ResultBlock.tsx`·`components/PhaseTimeline.tsx`·`components/Wheel.tsx:246-258`·`components/TopBar.tsx` — D-18·D-21 대상.
- `supabase/functions/_shared/spinTime.ts` — `SpinTime`·`DEFAULT_SPIN_TIME_TEXT`(D-20 포맷터의 입력 타입, 정의처는 여기 한 곳). `lib/time.ts` — 포맷터가 사는 곳.
- `supabase/functions/_shared/edgeImports.test.ts` :49·:392-394 — 계약 #56(`app/page.tsx` 의 `"no_candidates"` 정확히 1개).
- `node_modules/next/dist/docs/01-app/` — Next 16 App Router(AGENTS.md: 학습 데이터와 다를 수 있음). `app/layout.tsx` metadata 수정 전 확인.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRestaurants` + `restaurantsReducer`(pending 버퍼) — 그대로 오늘 탭이 카탈로그를 읽고, 리듀서 본문은 `lib/rowset.ts` 로 일반화돼 `candidates` 가 같은 계약을 얻는다.
- `sortRestaurants`·`parseLocationLink`·`joinMenus`(`lib/restaurants.ts`) — 카탈로그 정렬·위치 링크·메뉴 요약에 재사용.
- `MenuList` 카드 골격(헤더·카운터·목록·빈 상태·푸터·`fade-up` 행)과 `SLICE_COLORS` 번호 배지 — `CandidateList` 가 이어받는다. `RestaurantList` 의 `pinBusyId`·`status` 3상태·`aria-pressed` 패턴.
- `formatRestaurantWriteError` 의 코드 분기 형태 — `formatCandidateWriteError` 의 본.
- `app/page.tsx` 의 `respin()`·`loadBanner` 합성·`actionError`/`loadError` 분리 — 유지.

### Established Patterns
- 순수 모듈(`lib/x.ts`) + I/O 훅(`lib/useX.ts`) + 컴포넌트는 props 만. 판단은 전부 `lib/` 로 밀어내야 테스트된다(렌더 하네스 없음).
- Realtime: 분기별 핸들러, `payload.new as Row`, DELETE 는 `payload.old` 의 PK 만, 함수형 업데이터 + 멱등, 인스턴스별 유일 토픽, cleanup `removeChannel`. 낙관적 업데이트 없음.
- 쓰기 핸들러 `Promise<boolean>` + try/catch + `setActionError(null)`; 실패 문장 = 한글 + 대상 이름 + `error.message`, `details`/`hint` 없음.
- 유니온 분기는 `default: never` 로 exhaustive. 시간은 `lib/time.ts` 경유. 주석은 한글 Why.

### Integration Points
- `app/page.tsx`: 훅 2개 추가, `menus`/`pinned_menus` state·구독·핸들러 삭제, `todayResult` 조회·구독 유지(토픽·가드 변경), `winnerIndex`·`wheelPhase`·`respin` 유지, `CandidateList`·`ResultBlock`·`PhaseTimeline`·`Wheel`·`TopBar` 에 새 prop.
- `app/restaurants/page.tsx`·`app/log/page.tsx`·`app/rank/page.tsx`: `displayPhase` 한 줄(D-23). `app/layout.tsx`: description.
- `lib/supabase/client.ts`: 타입 2개 삭제. `lib/constants.ts`: 주석. `lib/errors.ts`: 함수 1개. `lib/time.ts`: 함수 2개. `lib/phase.ts`: 함수 1개.
- 삭제: `components/MenuList.tsx`·`components/MenuList.test.ts`, todo 4건.

</code_context>

<specifics>
## Specific Ideas

- 사용자 위임 한 마디: "알아서". 판단 기준은 레포 관례 → 매장 탭과의 일관성 → 서버 계약 정합.
- 컷오버 전 라이브에서 오늘 탭은 배너 3개 + 빈 휠 + 빈 목록이 정상 — SUMMARY 의 낭독 항목에 그 증상을 적어 둔다. main 은 이 페이즈에서도 불변이므로 실사용자는 영향 없다.
- 휠 순서 = 목록 배지 순서 = `joinCandidates` 순서 하나. 정렬 정의처를 둘로 만들지 않는다.
- 결과의 이름은 스냅샷, 상세(메뉴·위치)는 현재 카탈로그 — 두 출처가 다른 것이 의도다(D-18).

</specifics>

<deferred>
## Deferred Ideas

- 기록·랭킹의 `history_since` 필터와 전환일 당일 처리 — Phase 7(`in-05`).
- README·롤백 SQL·배포 체크리스트·컷오버 — Phase 8(`wr-01`, SHIP-02~04).
- `stalled` 에서 수동 "지금 돌리기" 버튼 — 서버가 매분 폴링하므로 불필요(D-19). 폴링 간격이 길어지면 재검토.
- `ResultBlock` 의 "n개 후보 중 당첨" 을 `results.candidates` 스냅샷 길이로 바꾸는 것 — 현재는 라이브 후보 수(잠금 후 불변). 스냅샷이 쿨다운 적용 전인지 후인지 확인이 먼저.
- 매장 탭 TopBar 에 "오늘 후보 수" 뱃지 — 필요 제기 없음.
- Realtime 구독 실패(`CHANNEL_ERROR`) 표면화 — 전 페이지 공통, 범위 밖(CONCERNS 유지).
- 위치 URL 뒤 메모 표시(05-REVIEW IN-07) — 표시 설계, 범위 밖.

### Reviewed Todos (not folded)
- `in-05-history-since-same-day.md` — Phase 7(기록·랭킹 집계).
- `wr-01-cutover-window.md` — Phase 8(컷오버 창).

</deferred>

---

*Phase: 06-today-tab*
*Context gathered: 2026-09-29*
