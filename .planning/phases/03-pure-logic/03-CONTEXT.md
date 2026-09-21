# Phase 3: 순수 로직 - Context

**Gathered:** 2026-09-21
**Status:** Ready for planning
**Source:** 오케스트레이터가 ROADMAP Phase 3 성공 기준 + 승인된 설계(PROJECT.md Key Decisions, 02-CONTEXT D-03/D-05/D-13) + 캐리포워드 todo(in-03-04)를 현재 코드에 대조해 옮김 (discuss-phase 대체, Phase 2 방식)

<domain>
## Phase Boundary

추첨 시각 판정·쿨다운 필터·KST 변환을 **주입 가능한 순수 함수 한 곳**(`supabase/functions/_shared/`)으로 모으고, 클라이언트 `lib/phase.ts`가 추첨 시각을 인자로 받으며 "시각은 지났는데 결과가 없다"를 `stalled`로 구분한다. `settings` 로딩 헬퍼(기본값·순수 리듀서·Realtime 훅)를 만들고 세 페이지에 꽂아 **기본값에서의 동작은 지금과 동일**하게 유지한다.

**하지 않는 것:** Edge Function 본문 재작성(Phase 4 — 여기서는 복붙 제거용 import 교체만), 화면 문구의 `11:55` 제거(Phase 6, SPIN-06), `history_since` 집계 필터(Phase 7), 배포·마이그레이션 적용(Phase 8). 라이브·main 무변경.

**현재 코드 사실(계획 전제):**
- `kstNow()`·`pickRandom()`·`isAfterSpinTime()`이 `spin-roulette/index.ts`·`respin-roulette/index.ts`에 복붙돼 있고, `lib/time.ts`에 같은 Intl 기반 `kstParts()`가 한 벌 더 있다 (세 벌).
- `lib/phase.ts`는 `SPIN_HH/MM` 하드코딩, `Phase = accepting|spinning|decided`, 시각만으로 `decided`를 돌려줘 결과가 없어도 11:55:05부터 UI가 잠긴다 (P1: 후보 0개 잠금). `msToNextPhase`는 참조 0.
- `app/page.tsx`는 `resolvedPhase = todayResult ? "decided" : phase`, `MenuList`는 `readOnly = phase !== "accepting"`. `app/log`·`app/rank`는 `currentPhase(now)`를 TopBar 뱃지에만 쓴다.
- `SettingsRow.spin_time`은 PostgREST `time` → `"HH:MM:SS"` 문자열. `settings` 테이블은 라이브에 아직 없다(Phase 8 적용) — 로드 실패 경로가 개발 중 실제로 밟힌다.
- `deno`는 로컬에 없다 → Edge Function은 `deno check` 불가. `_shared`는 vitest include에 이미 있음(`vitest.config.mts`).
</domain>

<decisions>
## Implementation Decisions

### `_shared` 모듈 (QUAL-02, 로드맵 SC-1·SC-2)
- **D-01** 파일 3개, 각각 self-contained: `supabase/functions/_shared/kst.ts`(`kstParts(now: Date)` → `{ date: "yyyy-mm-dd", year, month, day, hour, minute, second, weekday }`, `kstNow()` = `kstParts(new Date())`, `pickRandom<T>(arr: T[]): T`), `_shared/spinTime.ts`(`SpinTime = { hh: number; mm: number }`, `DEFAULT_SPIN_TIME_TEXT = "11:55"`, `parseSpinTime(text): SpinTime | null` — `"HH:MM"`·`"HH:MM:SS"` 둘 다 수용, 범위 밖·형식 불일치는 `null`(throw 금지), `secondsOfDay(parts)`, `isAfterSpinTime(parts, spin)`), `_shared/cooldown.ts`(`cooldownWindowStart(today: "yyyy-mm-dd", days): string | null` — `days <= 0`이면 `null`, `applyCooldown<T extends { restaurant_id: string }>(candidates: T[], recentWinnerIds: Iterable<string | null>): T[]`).
- **D-02 `_shared`는 import 0개 규칙.** Deno·Node·상호 import 전부 금지. 이유: Deno는 상대 import에 `.ts` 확장자를 요구하고, tsc(`moduleResolution: bundler`, `allowImportingTsExtensions` 없음)는 `lib/`에서 끌어올 때 그 확장자를 거부한다. 서로 import하지 않으면 두 세계 모두에서 컴파일된다. spec(`_shared/*.test.ts`)은 `./kst`처럼 확장자 없이 import(vitest만 실행). `pickRandom`의 `crypto.getRandomValues`는 Deno·Node≥19 전역이라 import 불필요.
- **D-03 클라이언트 재사용 경로.** `lib/phase.ts`·`lib/settings.ts`는 `@/supabase/functions/_shared/spinTime`을, `lib/time.ts`는 `@/supabase/functions/_shared/kst`를 import한다. `lib/time.ts`의 `kstParts`는 자체 구현을 지우고 `_shared/kst.ts`의 것을 re-export한다(포맷터 `todayKstDate`·`formatHhMm`·`formatHhMmSs`·`formatKstLongDay`는 그대로). 결과: KST 분해 구현이 레포 전체에 1곳, `kstNow` 정의 1곳.
- **D-04 `hourCycle: "h23"` 명시**(todo IN-04). `_shared/kst.ts`와 `lib/time.ts` 포맷터 모두 `hour12: false` 대신 `hourCycle: "h23"`. `% 24` 보정은 방어용으로 남겨도 되나 주석으로 이유를 적는다. `rg -n 'hour12' lib supabase/functions/_shared` → 0건이 검증.
- **D-05 쿨다운 의미.** "최근 N일 당첨 매장" = `results.date`가 `[today − N, today − 1]`(KST 날짜 문자열, 달력 일수)인 행의 `restaurant_id`. **오늘은 창에 안 들어간다**(다시 돌리기가 오늘 당첨 매장을 다시 뽑을 수 있음 — 현재 앱과 동일). 매칭 키는 `restaurant_id`만, `null`(레거시 행)은 무시. 제외 후 0개면 **전체 후보로 폴백**(SPIN-02). 날짜 산술은 `Date.UTC`로 문자열만 다뤄 타임존 무관. DB 조회(`.gte("date", from).lt("date", today)`)는 Phase 4가 한다.
- **D-06 Edge Function은 import 교체만.** 두 `index.ts`에서 로컬 `kstNow`·`pickRandom`·`isAfterSpinTime`·`SPIN_HH/MM`을 지우고 `import { kstNow, pickRandom } from "../_shared/kst.ts"`, `import { parseSpinTime, isAfterSpinTime, DEFAULT_SPIN_TIME_TEXT } from "../_shared/spinTime.ts"`(확장자 필수)로 바꾼다. 동작 불변(여전히 `menus` 읽고 11:55 기본값). 본문 재작성·`settings` 읽기는 Phase 4. `deno check` 불가하므로 검증은 낭독 + 계약 테스트(D-12).

### `lib/phase.ts` (SPIN-03 클라이언트 반, 로드맵 SC-3)
- **D-07** `Phase = "accepting" | "spinning" | "decided" | "stalled"`. 시그니처 `currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean): Phase`(기본 인자 없음 — 시각 주입 강제). 규칙: `hasResult` → `decided`(시각 무관: 늦은 추첨·다시 돌리기 포함). 아니면 `t < spin` → `accepting`, `spin ≤ t < spin + 5s` → `spinning`, 그 뒤 → `stalled`. `SPIN_ANIM_SEC = 5` 유지. `msToNextPhase` 삭제(참조 0). 머리 주석을 코드 기준으로 정정(11:55:05부터 전환 — todo IN-03).
- **D-08 호출처 최소 반영(동작 동일 유지).** `app/page.tsx`: `currentPhase(now, settings.spinTime, todayResult !== null)`, `resolvedPhase` 우회 변수 제거, `wheelPhase`에서 `stalled` → `"idle"`. `MenuList`: `readOnly = phase === "spinning" || phase === "decided"`(stalled는 편집 가능 = P1 해소). `app/log`·`app/rank`: `hasResult`는 이미 로드한 `results`에서 `some(r => r.date === todayKey)`로 파생(다른 달을 보는 log 페이지는 부정확할 수 있음 → deferred, Phase 7이 두 페이지를 다시 쓸 때 오늘 결과 조회 추가).
- **D-09 `stalled` 표시 최소 문구(Phase 6이 다듬음).** TopBar `{ label: "추첨 대기", dot: "live" }`, `StageHeader` "추첨 대기중", `ResultBlock` 새 분기 "아직 결과가 없어요. 후보를 담으면 1분 안에 추첨돼요"(정확 문안은 재량), `PhaseTimeline`은 `stalled`를 `accepting` 단계에 매핑. TS 분기 누락은 `switch` + `never` 가드로 잡는다.

### 설정 로딩 (SETT-02·SETT-03, 로드맵 SC-4)
- **D-10 `lib/settings.ts`(순수).** 도메인 타입 `Settings = { spinTime: SpinTime; cooldownDays: number; historySince: string | null }`, `DEFAULT_SETTINGS = { spinTime: parseSpinTime(DEFAULT_SPIN_TIME_TEXT)!, cooldownDays: 0, historySince: null }`(`null` = 전환일 미확정; Phase 7은 이때 집계하지 않고 배너를 믿는다). `settingsFromRow(row: SettingsRow): { settings: Settings; warning: string | null }` — `spin_time` 파싱 실패 시 기본 시각 + warning(삼키지 않음). 리듀서 `settingsReducer(state, action)`: state `{ settings, loaded: boolean, error: string | null }`, action `loaded(row | null)` / `failed(message)` / `changed(event: "INSERT"|"UPDATE"|"DELETE", row)`. `DELETE`(대시보드에서 행 삭제)는 기본값 복귀. `row === null`(시드 없음)도 기본값 + `loaded: true`.
- **D-11 `lib/useSettings.ts`(I/O 훅, 레포 첫 공용 훅).** `useSettings(): { settings, loaded, error }`. 마운트 시 `supabase.from("settings").select("*").eq("id", 1).maybeSingle()`, 채널 `settings-changes`로 `postgres_changes` `*`를 구독해 리듀서에 디스패치, 언마운트 시 `removeChannel`. 실패는 `error`로 노출하고 페이지가 `joinLoadErrors([... , formatLoadError("설정", err)])`로 배너에 합친다(Phase 1의 조인 설계 그대로, 기본값으로는 계속 동작 = SETT-03). 세 페이지 모두 훅을 쓴다. 컨벤션 기록: 공용 훅은 `lib/useX.ts`, `use` 접두 — CLAUDE.md 코드 컨벤션에 한 줄 추가.
- **D-12 검증 범위 확장.** `tsconfig.json`·`eslint.config.mjs`의 `supabase/functions/**` 제외를 `supabase/functions/spin-roulette/**`·`supabase/functions/respin-roulette/**`로 좁혀 `_shared/`가 tsc·eslint 대상이 되게 한다(제외 이유였던 Deno 전역·인덱서 OOM은 `_shared`에 해당 없음). Edge Function 두 파일에는 Phase 2식 텍스트 계약 테스트를 둔다: `from "../_shared/kst.ts"` 존재, `function kstNow`·`function pickRandom`·`const SPIN_HH` 부재. 위치는 `supabase/functions/_shared/edgeImports.test.ts`(vitest include 범위 안).
- **D-13 테스트 목록(계약).** `_shared/kst.test.ts`: UTC 14:59:59/15:00:00 경계, 자정 `00`(24 아님), 연 경계, 요일. `_shared/spinTime.test.ts`: `"11:55"`·`"11:55:00"`·`"09:05:30"` 파싱, `"25:00"`·`"11:60"`·`""`·`"1155"` → null, `isAfterSpinTime` 직전/정각/직후. `_shared/cooldown.test.ts`: days 0 → 필터 없음, 제외 후 남음, 제외하면 0개 → 전체 폴백, `null` id 무시, 창 시작 월·연 경계(`2026-03-01` − 1 = `2026-02-28`, `2026-01-01` − 1 = `2025-12-31`). `lib/phase.test.ts` 재작성: 기존 6경계 × `hasResult=false`, `hasResult=true`면 어느 시각이든 decided, 사용자 지정 시각(12:30) 주입, 11:55:05 → stalled. `lib/settings.test.ts`: 초기 기본값, `loaded` 행 파싱(`"11:55:00"` → 11:55), 잘못된 `spin_time` → 기본 + warning, `failed` → 기본 + error, `changed UPDATE` 병합, `DELETE` 복귀, `loaded(null)`. 기존 `lib/time.test.ts` 그대로 통과(re-export).

### Claude's Discretion
- 파일 내부 함수 이름·주석 문안(한글 Why), `stalled` 문구, 리듀서 action 표기, `_shared` 테스트 파일 분할.
- `restaurants(pinned)` 같은 무관 항목 없음. 계획 분할 권장: 03-01 `_shared` 3모듈+테스트+Edge import 교체+검증 범위 확장 / 03-02 `lib/phase.ts`+`lib/time.ts`+호출처·컴포넌트 `stalled` / 03-03 `lib/settings.ts`+`useSettings`+페이지 배선+CLAUDE.md.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` Phase 3 성공 기준 4항 — 이 문서의 상위 계약
- `.planning/phases/02-data-model/02-CONTEXT.md` D-03(settings 기본값)·D-13(`SettingsRow`)·D-05(동작 불변)
- `.planning/todos/pending/in-03-04-phase-time-notes.md` — IN-03 주석 정정, IN-04 `hourCycle`
- `lib/time.ts`·`lib/phase.ts`·`lib/phase.test.ts` — 교체 대상과 기존 테스트 스타일
- `supabase/functions/spin-roulette/index.ts`·`respin-roulette/index.ts` — 복붙 제거 대상
- `lib/errors.ts`·`app/page.tsx` L50-62 — `joinLoadErrors` 배너 합류 패턴
- `vitest.config.mts` — `_shared` include 주석, extglob exclude
- `.planning/codebase/CONVENTIONS.md` — `~Action` 접미사, inline style, 한글 Why 주석
</canonical_refs>

<specific_ideas>
## Specific Ideas

- `_shared/spinTime.ts` 머리 주석에 "이 파일이 기본 추첨 시각의 유일한 정의처. 화면 문구의 11:55는 Phase 6에서 `settings`로 교체"를 남겨 CLAUDE.md의 '네 곳에 흩어져 있다' 항목을 이 페이즈에서 갱신할 근거로 삼는다.
- `applyCooldown`이 폴백했는지 호출자가 알 수 있게 `{ picked: T[]; fellBack: boolean }`을 돌려주면 Phase 4가 응답 JSON에 `cooldown_fallback: true`를 실을 수 있다.
- `useSettings`의 리듀서 디스패치는 페이지의 기존 `postgres_changes` 핸들러와 독립 채널 — `initialLoadedRef` 휠 가드와 얽히지 않게 한다.
</specific_ideas>

<deferred>
## Deferred Ideas

- Edge Function 본문(`candidates`·`settings`·쿨다운 조회, `restaurant_id` 기록) — Phase 4
- `deno check` 로컬 실행 환경(deno 미설치) — Phase 4 계획 시 설치 여부 결정
- 화면 문구·타임라인·휠의 `11:55` 제거, `stalled` 디자인 — Phase 6
- `history_since` 집계 필터·`historySince: null` 처리, log 페이지 다른 달 조회 시 `hasResult` 정확도 — Phase 7
- Realtime 구독 실패(`CHANNEL_ERROR`) 표면화 — 전 페이지 공통 과제, 이 프로젝트 범위 밖(CONCERNS 기록 유지)
</deferred>
