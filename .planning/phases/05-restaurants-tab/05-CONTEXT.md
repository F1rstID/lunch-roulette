# Phase 5: 매장 탭 - Context

**Gathered:** 2026-09-28
**Status:** Ready for planning

<domain>
## Phase Boundary

새 라우트 **매장 탭**에서 익명 누구나 매장 카탈로그(`restaurants`)를 **등록·수정·삭제·핀 토글**하고, 그 변경이 Realtime 으로 모든 접속자 화면에 반영된다(CATL-01~06). 오늘 탭은 건드리지 않는다 — 후보 담기·이름 필터·결과 화면의 메뉴 표시는 **Phase 6**, 기록·랭킹은 **Phase 7**, 배포·마이그레이션 적용은 **Phase 8**. 라이브 DB 에는 아직 `restaurants` 가 없으므로(컷오버 전) 이 탭은 라이브에서 "불러오기 실패" 배너 + 빈 목록으로 뜨는 것이 **정상**이다(설정 훅과 같은 논증, SETT-03).

</domain>

<decisions>
## Implementation Decisions

사용자가 네 영역 전부를 위임했다("알아서 최적의 형태로", 2026-09-28). 아래는 Claude 가 레포 관례·이전 결정에서 도출한 **확정** 결정이다 — 플래너는 되묻지 않고 따른다. 재량이 남은 지점은 §Claude's Discretion 에 따로 적었다.

### 탭·라우트
- **D-01** 라우트는 `/restaurants`(`app/restaurants/page.tsx`), 탭 라벨은 **"매장"**. 경로를 테이블명과 맞추는 이유: 라우트·테이블·타입(`RestaurantRow`)이 한 단어로 이어져 검색이 한 번에 끝난다. `TopBar` 의 `Tab` 유니온에 `"restaurants"` 를 더하고 `TabLink` 를 한 줄 추가한다(STRUCTURE.md "새 탭/라우트").
- **D-02** 탭 순서는 **오늘 · 매장 · 기록 · 랭킹**. 매장은 오늘 후보의 공급원이라 오늘 옆이 맞다. 매장 탭에는 TopBar 개수 뱃지를 달지 않는다(뱃지는 "오늘 후보 수" 의미로 오늘 탭 전용) — 총 개수는 카드 헤더 카운터가 보여 준다.
- **D-03** 페이지 골격은 `app/rank/page.tsx` 를 복제한다: 1초 tick · `useSettings()` · 오늘 결과 존재 조회 · `currentPhase` · `TopBar`(페이즈 필·시계 유지 — 세 페이지와 같은 상단). 페이지 전용 소형 컴포넌트는 페이지 파일 하단(`StageHeader`/`Footer` 전례).

### 등록·수정·삭제·핀 UX
- **D-04** 등록 폼은 카드 **상단 상시 노출**(`MenuList` 전례). 필드 3개 — 이름(필수, `maxLength` 24) · 메뉴(선택, 쉼표 한 줄, `maxLength` 120·`INPUT_MAX_LEN` 전례) · 위치(선택, 한 줄, `maxLength` 200). 제출 버튼 "등록", 이름이 비면 비활성. 성공 시 세 필드를 비우고 이름 필드에 포커스, 실패 시 입력을 **보존**한다(`MenuList.submit` 전례). 성공 토스트 없음 — 목록 행의 `fade-up` 등장이 피드백이다.
- **D-05** 수정은 **행 인라인 편집**: 행의 "수정" 버튼 → 그 행이 같은 3필드 폼(저장·취소)으로 바뀐다. 한 번에 한 행만 편집(다른 행의 수정을 누르면 편집 대상이 바뀌고 이전 초안은 버린다). 상단 폼 재사용(edit mode)을 버린 이유: 등록 중이던 입력을 잃는 충돌. 모달을 버린 이유: 레포에 전례 없는 새 패턴이고 인라인이 목록 맥락을 유지한다. 편집 중 같은 행의 Realtime UPDATE 가 오면 화면 목록은 갱신하되 편집 초안은 유지하고 저장 시 덮어쓴다(마지막 쓰기 승리 — 익명 서비스, 충돌 UI 없음). 메뉴 필드는 배열 ↔ `"a, b, c"` 문자열로 왕복한다(`joinMenus`/`parseMenuInput`).
- **D-06** 삭제는 **행 안 2단계 확인**: ✕ → 같은 자리에 "삭제할까요? 오늘 후보에서도 빠져요 · 과거 기록의 이름은 남아요 [삭제] [취소]". `window.confirm` 금지(브라우저 모달은 스타일 밖이고 자동화·테스트가 막힌다). 카탈로그는 영구 데이터라 오늘 탭의 즉시 삭제 전례를 따르지 않는다. 삭제 성공 시 Realtime DELETE 가 행을 지우고, DB 의 `on delete cascade`(candidates)·`on delete set null`(results)은 안내 문구로만 드러낸다.
- **D-07** 핀은 📌 토글 **즉시 update**(확인 없음, `MenuList.PinButton` 전례 그대로 — `aria-pressed`·`aria-label`). 툴팁 "고정 — 매일 자정 자동으로 오늘 후보에 담겨요" / "고정 해제". 핀 토글은 `pinned` 컬럼 update 한 번이고 오늘 후보(`candidates`)는 **건드리지 않는다** — 자정 재시드는 DB cron(0005) 몫이고 즉시 담기는 Phase 6 의 토글이다.
- **D-08** 쓰기 4종(insert·update·delete·pin)은 **페이지의 async 핸들러**에서 supabase 를 직접 호출한다(컴포넌트는 supabase 를 부르지 않는다·`useCallback` 없음·낙관적 업데이트 없음 — 화면은 Realtime 이벤트로 갱신). 콜백 prop 은 `onAddAction`·`onUpdateAction`·`onRemoveAction`·`onTogglePinAction`, 성공 여부 `Promise<boolean>` 반환(폼이 입력 보존 여부를 결정).

### 목록 표시·정렬
- **D-09** 정렬은 **핀 먼저, 그 안에서 이름순**(`localeCompare` `"ko"`) — 카탈로그는 수십 개 규모라 훑어보기가 목적이고 매일 나오는 단골(핀)이 위에 온다. 정렬은 순수 함수 `sortRestaurants` 로 클라이언트에서 하고(테스트), 조회 쿼리는 `order("created_at")` 만 둔다. 오늘 탭 후보 순서(wr-02, Phase 6)와는 별개 결정이다.
- **D-10** 행 구성: 이름(굵게) · 메뉴 칩 **최대 4개 + "+n"**(전체 목록은 칩 `title` 과 편집 폼에서 확인) · 위치(있을 때만; `http(s)` URL 이면 `<a target="_blank" rel="noopener noreferrer">` 로 호스트명 표시, 아니면 텍스트) · 📌 · 수정 · ✕. 오늘 탭의 번호 배지·`SLICE_COLORS` 는 휠 순서용이라 **쓰지 않는다**.
- **D-11** 카드 헤더: 제목 "매장 카탈로그", 부제 "n개 매장 · 핀 k개", 우측 mono 카운터(총 n). 푸터 규칙 문구: "📌 고정한 매장은 매일 자정 오늘 후보에 자동으로 담겨요 · 오늘 후보 담기는 오늘 탭에서". 빈 상태: "아직 등록된 매장이 없어요. 위에서 첫 매장을 등록해 보세요." 페이지네이션·가상화 없음.
- **D-12** 페이즈에 따른 잠금 **없음** — 매장 탭은 추첨 시각과 무관하게 항상 편집 가능하다(`isCandidateListLocked` 는 오늘 후보용). 결과 확정 후에도 매장 수정·삭제는 허용된다(결과 행은 매장명 스냅샷이라 무사, D-06 안내 문구가 그 사실을 말한다).

### 검증·에러 표면화
- **D-13** 순수 모듈 **`lib/restaurants.ts`**(import 는 `@/lib/constants` 와 `parseMenuInput` 뿐, supabase·React 금지): `parseRestaurantForm({ name, menusText, location }) → { ok: true; input: RestaurantInput } | { ok: false; message: string }`. 규칙은 DB 제약(0005 D-19)과 1:1 — 이름 trim 후 1~24 **코드포인트**·개행 금지, 메뉴 `parseMenuInput` 재사용 후 **30개 초과면 에러**(조용한 절단 금지)·원소 24 코드포인트, 위치 trim 후 빈 문자열 → `null`·200 코드포인트 이하. 상수는 `lib/constants.ts` 에 `RESTAURANT_MENUS_MAX = 30`·`RESTAURANT_LOCATION_MAX_LEN = 200`(DB check 와 동일, 주석으로 연결; `MENU_NAME_MAX_LEN` 은 매장명·메뉴 원소 공용 24). 클라이언트 검증은 제출 전 실수를 막는 보조이고 정본은 DB 제약이다.
- **D-14 (todo wr-01 접음)** `parseMenuInput` 의 `slice(0, MENU_NAME_MAX_LEN)` 을 **코드포인트 기준**(`Array.from(str).slice(0, n).join("")`)으로 고친다. `app/page.tsx` `addMenus` 의 같은 절단도 함께. 테스트 케이스: `"가".repeat(23) + "🍕"`(24 코드포인트) 가 온전히 통과, 25 코드포인트는 24 로 잘리며 lone surrogate 를 만들지 않는다.
- **D-15** DB 에러 번역은 `lib/errors.ts` 의 순수 `formatRestaurantWriteError(action, name, error: { code?: string; message: string })`: `23505` → `"이미 등록된 매장이에요: {name}"`, `23514` → `"입력 규칙에 맞지 않아요({name}): 이름 1~24자, 메뉴 30개·24자, 위치 200자"`, 그 외 → `"매장 \"{name}\" {action} 실패: {message}"`(action = 등록/수정/삭제/고정/고정 해제). `details`·`hint` 는 싣지 않는다(기존 원칙). 배너는 페이지의 `actionError` 한 곳 + `ErrorBanner`, 초기 SELECT 실패는 `loadError`(합치지 않는다).
- **D-16** 데이터 접근은 **`lib/useRestaurants.ts` 훅**(읽기 전용 I/O: SELECT 1회 + `restaurants` INSERT/UPDATE/DELETE 3분기 구독, 토픽 `restaurants-<n>` 인스턴스별 유일) + **`lib/restaurants.ts` 순수 리듀서**(`restaurantsReducer`: `loaded`/`failed`/`changed(event,row|id)`, DELETE 는 `payload.old.id` 만 온다 — 기존 `menus` 패턴). 훅은 판단을 하지 않는다(`useSettings` 선례 — 렌더 하네스가 없어 훅 분기는 테스트되지 않는다). 훅에 **쓰기를 넣지 않는다**. 이 훅을 Phase 6 가 그대로 가져다 카탈로그 목록을 읽는다(ROADMAP Phase 6 "Depends on: Phase 5 카탈로그 목록·구독 패턴").
- **D-17** 컴포넌트는 **`components/RestaurantList.tsx`** 하나(카드·폼·목록, `MenuList` 형태). 하위 컴포넌트 `RestaurantForm`(등록·편집 공용)·`RestaurantRowView`·`PinButton`·`DeleteConfirm` 은 같은 파일 안에 두고 export 하지 않는다. `MenuList` 는 Phase 6 까지 그대로 둔다(오늘 탭이 아직 `menus` 를 쓴다).
- **D-18** 테스트(vitest, 렌더 하네스 없음): `lib/restaurants.test.ts`(리듀서 3분기·중복 INSERT 멱등·정렬·폼 파싱 경계값 — 이름 0/1/24/25 코드포인트·개행·메뉴 30/31·빈 원소·위치 200/201·URL 판정), `lib/errors.test.ts` 추가(23505·23514·기타), `components/MenuList.test.ts` 코드포인트 케이스 추가. UI 는 `npm run dev`(가드런처)로 렌더·상호작용 확인만 하고 **라이브 DB 에 실제 등록하지 않는다**(라이브 오염). 게이트 5종 전부 초록.
- **D-19** 문서 정정은 같은 페이즈에서(Phase 3 D-16·Phase 4 D-17 선례): CLAUDE.md 엔트리포인트 절에 `app/restaurants/page.tsx`·`lib/useRestaurants.ts`·`lib/restaurants.ts`·`components/RestaurantList.tsx` 추가, `lib/constants.ts` 설명 갱신, 위험 지점 표에 매장 탭 realtime 3분기 추가. STRUCTURE.md·CONVENTIONS.md 의 라우트 수·훅 목록 갱신.

### Claude's Discretion
- 폼 3필드의 배치(한 줄 / 두 줄)·플레이스홀더 문안·칩 스타일·편집 폼의 저장/취소 버튼 위치 — 토큰(`--accent`·`--line`·`--radius`)만 쓰면 된다.
- `RestaurantInput` 타입 이름·리듀서 action 이름·정렬 함수 시그니처.
- 위치 URL 판정 헬퍼 위치(`lib/restaurants.ts` 안, `URL` 생성자 + `http:`/`https:` 만 링크).
- 메뉴 칩 "+n" 의 임계 4 는 재량이되 상수로 뺀다.
- `/gsd-ui-phase 5`(UI-SPEC) 실행 여부 — 사용자가 위임했으므로 플래너가 CONVENTIONS 만으로 충분하다고 보면 생략 가능.

### Folded Todos
- **wr-01-char-length-truncation** (`.planning/todos/pending/wr-01-char-length-truncation.md`, 출처 01-REVIEW WR-01) — `parseMenuInput`·`addMenus` 의 UTF-16 절단을 코드포인트 기준으로. 매장 메뉴 입력이 같은 함수를 재사용하므로 이 페이즈 D-14 로 접었다. 완료 시 todo 파일 삭제(`git rm`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 범위·요구사항
- `.planning/ROADMAP.md` §Phase 5 — Goal·Success Criteria 5·로컬 검증·UI hint. §Phase 6 — 이 페이즈가 **하지 않는** 것(후보 토글·필터·결과 화면).
- `.planning/REQUIREMENTS.md` §매장 카탈로그 (CATL-01~07) + §Out of Scope + §v2(검색 UI·방문 횟수는 v2).
- `.planning/PROJECT.md` — Core Value·Key Decisions(매장 관리 = 별도 탭, 후보 선택 = 카탈로그 토글은 Phase 6).

### 스키마·제약 (변경 금지)
- `supabase/migrations/0005_restaurants_settings.sql` :16-34 `restaurants` 컬럼·check 제약(D-19 상한), :39-45 `candidates`(`on delete cascade`), :69 `results.restaurant_id`(`on delete set null`), :72-95 RLS 전면 개방, :106 Realtime publication.
- `.planning/phases/02-data-model/02-CONTEXT.md` D-01·D-06·D-07·D-13·D-19 — 테이블·RLS·타입·상한의 원 결정.
- `lib/supabase/client.ts` — `RestaurantRow`·`CandidateRow` 타입(수동 유지, 유일 정의처).

### 관례·재사용 원형
- `CLAUDE.md` — 컨벤션·위험 지점·검증 명령 5종·`npm run dev` 가드런처 규칙.
- `.planning/codebase/CONVENTIONS.md` — inline style·`~Action`·Realtime 단언 패턴·에러 처리·훅 규칙(`lib/useX.ts`).
- `.planning/codebase/STRUCTURE.md` §"Where to Add New Code — 새 탭/라우트·새 컴포넌트·새 도메인 헬퍼".
- `components/MenuList.tsx` — 카드·폼·행·`PinButton`·빈 상태·입력 보존 패턴(포팅 원형). `parseMenuInput` :37.
- `components/TopBar.tsx` — `Tab` 유니온·`TabLink`.
- `app/rank/page.tsx` — 새 라우트 보일러플레이트(1초 tick·설정 훅·TopBar).
- `lib/useSettings.ts` + `lib/settings.ts` — 훅(I/O만)·순수 리듀서 분리와 인스턴스별 토픽의 원형.
- `lib/errors.ts`·`components/ErrorBanner.tsx` — 배너 문장 조립·표시.
- `app/page.tsx` :86-160 — Realtime INSERT/DELETE 분기·`payload.old` 부분 행 처리·멱등 갱신.
- `node_modules/next/dist/docs/01-app/` — Next 16 App Router(AGENTS.md: 학습 데이터와 다를 수 있음, 새 라우트 작성 전 확인).

### 접은 todo
- `.planning/todos/pending/wr-01-char-length-truncation.md` — D-14.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MenuList`: 카드 헤더/폼/목록/푸터 구조, `PinButton`, 빈 상태, 실패 시 입력 보존 — `RestaurantList` 의 골격.
- `parseMenuInput`(순수, 테스트 10건): 메뉴 필드 파싱. 코드포인트 절단으로 고치면 매장명 검증도 같은 헬퍼로 잘라 쓸 수 있다.
- `useSettings`/`settingsReducer`: 훅·리듀서 분리와 토픽 일련번호(`topicSeq`) 패턴을 `useRestaurants` 가 복제.
- `formatLoadError`·`joinLoadErrors`·`ErrorBanner`: 읽기 실패 배너. `formatRespinError` 의 `readableMessage`(trim·상한)는 쓰기 에러 번역에도 재사용 가능.
- `app/rank/page.tsx`: 페이지 골격 69줄.

### Established Patterns
- 전부 `"use client"`·supabase 직접 호출은 페이지에서만·컴포넌트는 props·`~Action`·named export·inline style 토큰·한글 Why 주석.
- Realtime: `postgres_changes` 분기별 핸들러, `payload.new as Row`, DELETE 는 `payload.old as Partial<Row>` + `id` 존재 확인, 함수형 업데이터 + 멱등, cleanup `removeChannel`. 토픽은 인스턴스별 유일(`-<n>`).
- 쓰기 핸들러 `Promise<boolean>`, 성공 시 `setActionError(null)`, 실패 문장 = 한글 + 대상 이름 + `error.message`.
- 테스트는 순수 모듈만(렌더 하네스 없음) — 판단 로직을 `lib/*.ts` 로 밀어내야 검증된다.

### Integration Points
- `components/TopBar.tsx` `Tab` 유니온 + `TabLink`(D-01·D-02).
- `app/restaurants/page.tsx`(신규 라우트) — `useRestaurants` + `useSettings` + 오늘 결과 조회.
- `lib/constants.ts` 상수 2개 추가, `lib/errors.ts` 번역 함수 추가, `lib/supabase/client.ts` 는 이미 `RestaurantRow` 보유(변경 없음 예상).
- Phase 6 이 `useRestaurants` 와 `RestaurantRow` 정렬 헬퍼를 그대로 import 한다.

</code_context>

<specifics>
## Specific Ideas

- 사용자 위임 한 문장: "알아서 최적의 형태로". 판단 기준은 **레포 관례 우선 → 오늘 탭과의 일관성 → 영구 데이터에 맞는 안전장치(삭제 확인)** 순.
- 컷오버 전 라이브에서 이 탭은 배너 + 빈 목록이 정상 — 플랜의 낭독·SUMMARY 에 그 증상을 적어 둔다(설정 배너 선례).
- 매장 삭제가 오늘 후보·결과에 미치는 영향은 코드가 아니라 **문구**로 드러낸다(D-06). DB 가 이미 처리한다.

</specifics>

<deferred>
## Deferred Ideas

- 오늘 탭의 후보 토글·이름 필터·결과 화면의 메뉴/위치 표시·`MenuRow`/`PinnedMenuRow` 타입 삭제·`winnerIndex` id 기준 — Phase 6.
- 매장 탭 TopBar 뱃지에 "오늘 후보 수" 표시 — Phase 6 에서 필요하면.
- 삭제 취소(undo)·휴지통 — 범위 밖(익명 서비스, 2단계 확인으로 충분).
- 카탈로그 검색 UI(CATL-V2-01)·방문 횟수(CATL-V2-02) — v2.
- Realtime 구독 실패(`CHANNEL_ERROR`) 표면화 — 전 페이지 공통 과제, 범위 밖(CONCERNS 기록 유지).

### Reviewed Todos (not folded)
- `in-06-results-update-on-delete-set-null.md` — Phase 6(오늘 탭 realtime UPDATE 가드). 이 페이즈의 삭제 UI 가 그 경로를 실제로 밟게 하므로 Phase 6 에서 반드시 닫는다.
- `wr-02-pinned-reseed-order.md` — Phase 6(후보 목록 정렬). 매장 탭 정렬(D-09)과 별개.
- `in-03-usesettings-branches-to-reducer.md` · `in-02-settings-loaded-first-paint.md` — Phase 6.
- `in-05-history-since-same-day.md` — Phase 7. `wr-01-cutover-window.md` — Phase 8.

</deferred>

---

*Phase: 05-restaurants-tab*
*Context gathered: 2026-09-28*
