# Phase 3: 순수 로직 - Research

**Researched:** 2026-09-21
**Domain:** TypeScript 모듈 경계(tsc `exclude` ↔ Deno 확장자 규칙) · `Intl.DateTimeFormat` `hourCycle` · Supabase Realtime `postgres_changes` 페이로드 · PostgREST `maybeSingle`/`PGRST205` · vitest 4 수집 경계 · ESLint 9 flat `globalIgnores`
**Confidence:** HIGH (핵심 판정 14건을 이 레포에서 실제로 실행해 확인했다 — tsc 4회, next build 2회, vitest 5회, eslint 3회, node 5회. 모든 probe 파일은 삭제했고 `git status`·`tsc`·`test`·`lint`는 조사 전 상태로 복원됐다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### `_shared` 모듈 (QUAL-02, 로드맵 SC-1·SC-2)
- **D-01** 파일 3개, 각각 self-contained: `supabase/functions/_shared/kst.ts`(`kstParts(now: Date)` → `{ date: "yyyy-mm-dd", year, month, day, hour, minute, second, weekday }`, `kstNow()` = `kstParts(new Date())`, `pickRandom<T>(arr: T[]): T`), `_shared/spinTime.ts`(`SpinTime = { hh: number; mm: number }`, `DEFAULT_SPIN_TIME_TEXT = "11:55"`, `parseSpinTime(text): SpinTime | null` — `"HH:MM"`·`"HH:MM:SS"` 둘 다 수용, 범위 밖·형식 불일치는 `null`(throw 금지), `secondsOfDay(parts)`, `isAfterSpinTime(parts, spin)`), `_shared/cooldown.ts`(`cooldownWindowStart(today: "yyyy-mm-dd", days): string | null` — `days <= 0`이면 `null`, `applyCooldown<T extends { restaurant_id: string }>(candidates: T[], recentWinnerIds: Iterable<string | null>): T[]`).
- **D-02 `_shared`는 import 0개 규칙.** Deno·Node·상호 import 전부 금지. 이유: Deno는 상대 import에 `.ts` 확장자를 요구하고, tsc(`moduleResolution: bundler`, `allowImportingTsExtensions` 없음)는 `lib/`에서 끌어올 때 그 확장자를 거부한다. 서로 import하지 않으면 두 세계 모두에서 컴파일된다. spec(`_shared/*.test.ts`)은 `./kst`처럼 확장자 없이 import(vitest만 실행). `pickRandom`의 `crypto.getRandomValues`는 Deno·Node≥19 전역이라 import 불필요.
- **D-03 클라이언트 재사용 경로.** `lib/phase.ts`·`lib/settings.ts`는 `@/supabase/functions/_shared/spinTime`을, `lib/time.ts`는 `@/supabase/functions/_shared/kst`를 import한다. `lib/time.ts`의 `kstParts`는 자체 구현을 지우고 `_shared/kst.ts`의 것을 re-export한다(포맷터 `todayKstDate`·`formatHhMm`·`formatHhMmSs`·`formatKstLongDay`는 그대로). 결과: KST 분해 구현이 레포 전체에 1곳, `kstNow` 정의 1곳.
- **D-04 `hourCycle: "h23"` 명시**(todo IN-04). `_shared/kst.ts`와 `lib/time.ts` 포맷터 모두 `hour12: false` 대신 `hourCycle: "h23"`. `% 24` 보정은 방어용으로 남겨도 되나 주석으로 이유를 적는다. `rg -n 'hour12' lib supabase/functions/_shared` → 0건이 검증.
- **D-05 쿨다운 의미.** "최근 N일 당첨 매장" = `results.date`가 `[today − N, today − 1]`(KST 날짜 문자열, 달력 일수)인 행의 `restaurant_id`. **오늘은 창에 안 들어간다**(다시 돌리기가 오늘 당첨 매장을 다시 뽑을 수 있음 — 현재 앱과 동일). 매칭 키는 `restaurant_id`만, `null`(레거시 행)은 무시. 제외 후 0개면 **전체 후보로 폴백**(SPIN-02). 날짜 산술은 `Date.UTC`로 문자열만 다뤄 타임존 무관. DB 조회(`.gte("date", from).lt("date", today)`)는 Phase 4가 한다.
- **D-06 Edge Function은 import 교체만.** 두 `index.ts`에서 로컬 `kstNow`·`pickRandom`·`isAfterSpinTime`·`SPIN_HH/MM`을 지우고 `import { kstNow, pickRandom } from "../_shared/kst.ts"`, `import { parseSpinTime, isAfterSpinTime, DEFAULT_SPIN_TIME_TEXT } from "../_shared/spinTime.ts"`(확장자 필수)로 바꾼다. 동작 불변(여전히 `menus` 읽고 11:55 기본값). 본문 재작성·`settings` 읽기는 Phase 4. `deno check` 불가하므로 검증은 낭독 + 계약 테스트(D-12).

#### `lib/phase.ts` (SPIN-03 클라이언트 반, 로드맵 SC-3)
- **D-07** `Phase = "accepting" | "spinning" | "decided" | "stalled"`. 시그니처 `currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean): Phase`(기본 인자 없음 — 시각 주입 강제). 규칙: `hasResult` → `decided`(시각 무관: 늦은 추첨·다시 돌리기 포함). 아니면 `t < spin` → `accepting`, `spin ≤ t < spin + 5s` → `spinning`, 그 뒤 → `stalled`. `SPIN_ANIM_SEC = 5` 유지. `msToNextPhase` 삭제(참조 0). 머리 주석을 코드 기준으로 정정(11:55:05부터 전환 — todo IN-03).
- **D-08 호출처 최소 반영(동작 동일 유지).** `app/page.tsx`: `currentPhase(now, settings.spinTime, todayResult !== null)`, `resolvedPhase` 우회 변수 제거, `wheelPhase`에서 `stalled` → `"idle"`. `MenuList`: `readOnly = phase === "spinning" || phase === "decided"`(stalled는 편집 가능 = P1 해소). `app/log`·`app/rank`: `hasResult`는 이미 로드한 `results`에서 `some(r => r.date === todayKey)`로 파생(다른 달을 보는 log 페이지는 부정확할 수 있음 → deferred, Phase 7이 두 페이지를 다시 쓸 때 오늘 결과 조회 추가).
- **D-09 `stalled` 표시 최소 문구(Phase 6이 다듬음).** TopBar `{ label: "추첨 대기", dot: "live" }`, `StageHeader` "추첨 대기중", `ResultBlock` 새 분기 "아직 결과가 없어요. 후보를 담으면 1분 안에 추첨돼요"(정확 문안은 재량), `PhaseTimeline`은 `stalled`를 `accepting` 단계에 매핑. TS 분기 누락은 `switch` + `never` 가드로 잡는다.

#### 설정 로딩 (SETT-02·SETT-03, 로드맵 SC-4)
- **D-10 `lib/settings.ts`(순수).** 도메인 타입 `Settings = { spinTime: SpinTime; cooldownDays: number; historySince: string | null }`, `DEFAULT_SETTINGS = { spinTime: parseSpinTime(DEFAULT_SPIN_TIME_TEXT)!, cooldownDays: 0, historySince: null }`(`null` = 전환일 미확정; Phase 7은 이때 집계하지 않고 배너를 믿는다). `settingsFromRow(row: SettingsRow): { settings: Settings; warning: string | null }` — `spin_time` 파싱 실패 시 기본 시각 + warning(삼키지 않음). 리듀서 `settingsReducer(state, action)`: state `{ settings, loaded: boolean, error: string | null }`, action `loaded(row | null)` / `failed(message)` / `changed(event: "INSERT"|"UPDATE"|"DELETE", row)`. `DELETE`(대시보드에서 행 삭제)는 기본값 복귀. `row === null`(시드 없음)도 기본값 + `loaded: true`.
- **D-11 `lib/useSettings.ts`(I/O 훅, 레포 첫 공용 훅).** `useSettings(): { settings, loaded, error }`. 마운트 시 `supabase.from("settings").select("*").eq("id", 1).maybeSingle()`, 채널 `settings-changes`로 `postgres_changes` `*`를 구독해 리듀서에 디스패치, 언마운트 시 `removeChannel`. 실패는 `error`로 노출하고 페이지가 `joinLoadErrors([... , formatLoadError("설정", err)])`로 배너에 합친다(Phase 1의 조인 설계 그대로, 기본값으로는 계속 동작 = SETT-03). 세 페이지 모두 훅을 쓴다. 컨벤션 기록: 공용 훅은 `lib/useX.ts`, `use` 접두 — CLAUDE.md 코드 컨벤션에 한 줄 추가.
- **D-12 검증 범위 확장.** `tsconfig.json`·`eslint.config.mjs`의 `supabase/functions/**` 제외를 `supabase/functions/spin-roulette/**`·`supabase/functions/respin-roulette/**`로 좁혀 `_shared/`가 tsc·eslint 대상이 되게 한다(제외 이유였던 Deno 전역·인덱서 OOM은 `_shared`에 해당 없음). Edge Function 두 파일에는 Phase 2식 텍스트 계약 테스트를 둔다: `from "../_shared/kst.ts"` 존재, `function kstNow`·`function pickRandom`·`const SPIN_HH` 부재. 위치는 `supabase/functions/_shared/edgeImports.test.ts`(vitest include 범위 안).
- **D-13 테스트 목록(계약).** `_shared/kst.test.ts`: UTC 14:59:59/15:00:00 경계, 자정 `00`(24 아님), 연 경계, 요일. `_shared/spinTime.test.ts`: `"11:55"`·`"11:55:00"`·`"09:05:30"` 파싱, `"25:00"`·`"11:60"`·`""`·`"1155"` → null, `isAfterSpinTime` 직전/정각/직후. `_shared/cooldown.test.ts`: days 0 → 필터 없음, 제외 후 남음, 제외하면 0개 → 전체 폴백, `null` id 무시, 창 시작 월·연 경계(`2026-03-01` − 1 = `2026-02-28`, `2026-01-01` − 1 = `2025-12-31`). `lib/phase.test.ts` 재작성: 기존 6경계 × `hasResult=false`, `hasResult=true`면 어느 시각이든 decided, 사용자 지정 시각(12:30) 주입, 11:55:05 → stalled. `lib/settings.test.ts`: 초기 기본값, `loaded` 행 파싱(`"11:55:00"` → 11:55), 잘못된 `spin_time` → 기본 + warning, `failed` → 기본 + error, `changed UPDATE` 병합, `DELETE` 복귀, `loaded(null)`. 기존 `lib/time.test.ts` 그대로 통과(re-export).

### Claude's Discretion
- 파일 내부 함수 이름·주석 문안(한글 Why), `stalled` 문구, 리듀서 action 표기, `_shared` 테스트 파일 분할.
- `restaurants(pinned)` 같은 무관 항목 없음. 계획 분할 권장: 03-01 `_shared` 3모듈+테스트+Edge import 교체+검증 범위 확장 / 03-02 `lib/phase.ts`+`lib/time.ts`+호출처·컴포넌트 `stalled` / 03-03 `lib/settings.ts`+`useSettings`+페이지 배선+CLAUDE.md.

### Deferred Ideas (OUT OF SCOPE)
- Edge Function 본문(`candidates`·`settings`·쿨다운 조회, `restaurant_id` 기록) — Phase 4
- `deno check` 로컬 실행 환경(deno 미설치) — Phase 4 계획 시 설치 여부 결정
- 화면 문구·타임라인·휠의 `11:55` 제거, `stalled` 디자인 — Phase 6
- `history_since` 집계 필터·`historySince: null` 처리, log 페이지 다른 달 조회 시 `hasResult` 정확도 — Phase 7
- Realtime 구독 실패(`CHANNEL_ERROR`) 표면화 — 전 페이지 공통 과제, 이 프로젝트 범위 밖(CONCERNS 기록 유지)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SETT-02** | 대시보드에서 설정을 바꾸면 열린 탭에 Realtime으로 즉시 반영된다 (새로고침 불필요) | §질문 4 — `postgres_changes` UPDATE의 `payload.new`가 **전체 새 행**이므로 `settingsFromRow(payload.new)` 한 번으로 병합이 끝난다(부분 패치 병합 불필요). `payload.old`는 PK만. §Pattern 4 구독 코드 |
| **SETT-03** | 설정 로드 전 또는 실패 시 기본값(11:55, 쿨다운 0)으로 동작한다 | §질문 4 — `maybeSingle()`이 0행에서 `data: null, error: null`(설치본 소스 확인), 테이블 부재는 `PGRST205`/404. 두 갈래가 **다른 action**으로 들어가야 한다(§Pitfall 5). §Pattern 3 리듀서 |
| **SPIN-02** | `cooldown_days` > 0이면 최근 N일 당첨 매장은 후보에서 제외. 제외 후 비면 전체 폴백 | §질문 8 — `Date.UTC` 날짜 산술을 월·연·윤년·TZ(UTC+14/−11) 경계에서 실측. §Pattern 5 `applyCooldown` |
| **SPIN-03** | 추첨 시각에 후보가 0개면 결과가 생기지 않고 **UI는 잠기지 않는다** | §Pitfall 1 — `Phase`에 `"stalled"`를 더해도 기존 9개 소비처에서 tsc 에러가 **0건**이다. `switch`+`never` 가드가 없으면 `MenuList`의 `readOnly`가 그대로 `true`로 남아 SPIN-03이 조용히 미완성된다 |
| **QUAL-02** | Edge 순수 로직을 `_shared/`에 Deno import 없이 두어 vitest로 테스트, `kstNow` 복붙 합치기 | §질문 1·2·5 — tsc `exclude`/`.ts` 확장자/Turbopack/vitest 수집을 전부 실측. §Pitfall 2가 D-01 시그니처의 D-02 위반 1건을 지적 |
</phase_requirements>

## Summary

이 페이즈의 기술적 난점은 로직이 아니라 **모듈 경계**다. `supabase/functions/_shared/`의 파일 하나가 세 개의 다른 컴파일러(로컬 `tsc --noEmit`, Next 16 Turbopack 빌드, 배포 시 Deno)와 두 개의 러너(vitest, Deno 런타임)를 동시에 만족해야 하는데, 이들이 **상대 import의 `.ts` 확장자에 대해 정반대 요구**를 한다. Deno는 확장자를 요구하고("local import specifiers must always include the full file extension"), tsc는 `allowImportingTsExtensions` 없이는 `TS5097`로 거부한다. 이 레포에서 두 방향을 모두 실행해 확인했다: `lib/`에서 `.ts` 확장자로 끌어오면 `tsc --noEmit`도 `npm run build`도 실패하고, **D-12로 제외를 좁히고 나면 `_shared` 파일끼리의 `./kst.ts` 상대 import도 같은 에러**가 난다. 결론 — **D-02(`_shared` import 0개)는 충분할 뿐 아니라 D-12가 켜지는 순간 컴파일러가 강제하는 규칙이 된다.** 다만 D-01이 적어 둔 `secondsOfDay(parts)`·`isAfterSpinTime(parts, spin)` 시그니처는 `kst.ts`의 `KstParts` 타입을 필요로 해서 **현재 문면 그대로는 D-02를 어긴다** — 해법은 `spinTime.ts` 안에 `{ hour; minute; second }` 최소 구조 타입을 **로컬 선언**하는 것이다(TS 구조적 타이핑이라 `KstParts`가 그대로 대입된다). 이게 이 조사가 찾은 가장 중요한 수정 사항이다.

두 번째 발견은 계획을 조용히 무너뜨릴 수 있는 종류다. `Phase` 유니온에 `"stalled"`를 추가해도 **기존 9개 소비처 어디에서도 tsc 에러가 나지 않는다** — 전부 `if`-체인 + fallback 반환이기 때문이다. 그대로 두면 `MenuList`의 `readOnly = phase !== "accepting"`가 `stalled`에서 `true`로 남아 **SPIN-03(후보 0개일 때 UI 잠기지 않음)이 초록으로 보이면서 미구현**이 된다. D-09의 `switch` + `never` 가드는 스타일 개선이 아니라 **이 페이즈의 안전장치**이고, 태스크로 명시돼야 한다. 반대로 `ResultBlock`의 `phase === "decided" && !winner` 분기는 D-07·D-08 이후 **도달 불가**가 되고, 그 안의 문구("아직 결과가 없어요 / 후보 메뉴가 없으면 룰렛이 돌지 않아요")가 정확히 `stalled`용이다 — 새로 만들 게 아니라 조건만 바꿔 옮기면 된다.

세 번째는 기존 테스트와의 충돌 1건이다. **D-13의 "기존 `lib/time.test.ts` 그대로 통과"는 거짓이다.** `kstParts`가 `date` 필드를 얻으면 `lib/time.test.ts:58`의 `toEqual({year, ...})`가 잉여 키 때문에 실패한다(실행해 확인). 1줄 수정으로 끝나지만 계획에 없으면 Wave 중간에 빨간 줄로 튀어나온다. 그 밖에 `hourCycle: "h23"`(D-04)은 Node 25.6.1/ICU 78.2에서 현재 `hour12: false`와 **포맷 결과가 완전히 동일**해 안전한 경화이고, `hour12`가 있으면 `hourCycle`이 무시되므로 **둘을 같이 두지 말고 `hour12`를 지워야** 한다.

**Primary recommendation:** `_shared` 3파일은 서로도 import하지 않는 완전 self-contained 모듈로 쓰고(교차 타입은 인라인 구조 타입으로 해결), D-12의 tsc·eslint 제외 좁히기를 **Wave 0 선행 태스크**로 올려 그 규칙을 컴파일러가 강제하게 만든 다음, `Phase` 유니온 확장은 반드시 `switch`+`never` 가드 전환과 **같은 태스크** 안에서 한다.

---

## 오케스트레이터 질문 8건 — 실측 답변

> 모든 probe 파일은 조사 종료 시 삭제했고 `git status --porcelain --untracked-files=all`이 조사 전(`.planning/config.json`·`.serena/project.yml` 2건 M)과 동일함을 확인했다. `npx tsc --noEmit` exit 0 · `npm test` 89/89 · `npx eslint` 출력 0줄로 복원 검증.

### Q1. tsc `exclude`·`.ts` 확장자·Turbopack — D-02는 충분한가

**(a) 제외된 파일도 import되면 타입체크된다 — VERIFIED.**
스크래치패드에 레포 `tsconfig.json`을 복제(`exclude: ["node_modules", "supabase/functions/**", "design/**"]`, `moduleResolution: "bundler"`, `paths {"@/*": ["./*"]}`)하고 `lib/phase.ts`가 `@/supabase/functions/_shared/kst`를 import하게 한 뒤 그 파일에 고의로 타입 에러를 넣었다.

```
$ npx tsc --noEmit -p probe1/tsconfig.json
probe1/supabase/functions/_shared/kst.ts(7,14): error TS2322: Type 'string' is not assignable to type 'number'.
exit=2
```
→ `exclude`는 **루트 파일 집합만** 줄인다. import로 도달하면 전부 검사된다. `[VERIFIED: 로컬 tsc 5.9.3 실행]`

**(b) `.ts` 확장자는 tsc·Next 양쪽에서 거부된다 — VERIFIED.**

| 시도 | 결과 |
|------|------|
| `lib/phase.ts` → `"@/supabase/functions/_shared/kst.ts"` | `error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.` |
| `_shared/spinTime.ts` → `"./kst.ts"` (lib에서 도달 가능) | 동일 `TS5097` (파일 경로만 다름) |
| `app/zzprobe/page.tsx` → `"@/…/zzspin.ts"` + `npm run build` | Turbopack은 `✓ Compiled successfully in 219ms` → 그 다음 `Running TypeScript ...` 단계에서 `TS5097` → `Failed to type check.` |

즉 **번들러(Turbopack)는 `.ts` 확장자를 해석하지만 Next 16의 타입체크 단계가 막는다.** `[VERIFIED: 로컬 tsc + next build 16.3.5 실행]`

**(c) 확장자 없는 import는 Turbopack이 정상 해석한다 — VERIFIED.**
같은 probe에서 확장자를 뺀 `"@/supabase/functions/_shared/zzspin"`로 바꾸자:
```
✓ Compiled successfully in 631ms
  Finished TypeScript in 849ms
Route (app)  ┌ ○ /  ├ ○ /_not-found  ├ ○ /log  ├ ○ /rank  └ ○ /zzprobe
```
→ `tsconfig` `exclude`에 있어도 `@/*` alias로 `_shared` 모듈을 끌어와 **정적 라우트까지 정상 생성**된다. D-03의 클라이언트 재사용 경로는 빌드 관점에서 안전하다. `[VERIFIED: next build 16.3.5]`

**(d) D-12를 켜면 D-02가 기계적으로 강제된다 — VERIFIED(중요).**
`exclude`를 `spin-roulette/**`·`respin-roulette/**`로 좁힌 `tsconfig.probe.json`으로 돌리면 `_shared/**`가 **루트 집합에 들어와** lib에서 도달하지 않는 파일까지 검사된다:
```
supabase/functions/_shared/zzprobeBad.test.ts(6,7): error TS2322: Type 'string' is not assignable to type 'number'.
supabase/functions/_shared/zzprobeExt.test.ts(2,26): error TS5097: An import path can only end with a '.ts' extension …
```
좁히기 **전**에는 같은 파일들로 `npx tsc --noEmit` exit **0**이었다(= 지금은 `_shared`가 타입체크 사각지대). 따라서 D-12는 두 가지를 동시에 해 준다: (1) `_shared` spec이 타입체크 대상이 되고, (2) `.ts` 상대 import가 컴파일 에러가 되어 D-02가 규약이 아니라 게이트가 된다. `[VERIFIED: 로컬 tsc 실행]`

**(e) 판정: D-02는 충분하다. 단, D-01의 시그니처 2개가 현재 문면 그대로는 D-02를 어긴다.**
`spinTime.secondsOfDay(parts)`·`isAfterSpinTime(parts, spin)`의 `parts`는 `kst.ts`의 반환 타입이다. `import type { KstParts } from "./kst"`(확장자 없이)를 쓰면 **Deno가 깨지고**, `"./kst.ts"`를 쓰면 **tsc가 깨진다**. 해법은 §Pitfall 2 / §Code Examples의 **로컬 최소 구조 타입 선언**이다. `allowImportingTsExtensions: true`를 tsconfig에 추가하는 대안도 문법적으로는 가능하지만(`noEmit: true`라 허용 조건 충족), 레포 전체 import 규약을 바꾸고 Next 빌드 경로에 새 변수를 들이는 비용이 D-02보다 크다 — **권장하지 않는다**.

### Q2. Deno 측 — 확장자 요구, `_shared` 번들, `crypto` 전역

- **확장자 필수:** Deno 공식 문서 인용 — *"With ECMAScript modules, local import specifiers must always include the full file extension. It cannot be omitted."* 예시도 `import { add } from "./calc";` → WRONG / `"./calc.ts"` → CORRECT로 명시. `[CITED: docs.deno.com/runtime/fundamentals/modules/]`
- **`_shared` 번들:** Supabase 공식 가이드의 권장 구조가 `supabase/functions/_shared/`이고, 함수는 `import { … } from '../_shared/transform.ts'` / `'../_shared/cors.ts'` 형태로 끌어온다. 배포 시 함께 번들된다. `[CITED: supabase.com/docs/guides/functions/development-environment, /functions/recursive-functions, /functions/cors]` → **D-06의 `../_shared/kst.ts`는 공식 패턴 그대로**다.
- **`crypto.getRandomValues` 전역:**
  - Node: `_shared`에 둔 probe를 vitest(node 환경)에서 실행해 `typeof globalThis.crypto?.getRandomValues === "function"` 통과 확인. `[VERIFIED: vitest 4.1.11 / Node 25.6.1 실행]`
  - Deno: Web Crypto API 전역. import 없이 쓰는 현행 코드(`spin-roulette/index.ts:42-46`, `respin-roulette/index.ts:57-61`)가 **프로덕션에서 매일 동작 중**인 것이 경험적 증거다. `[VERIFIED: 배포 중인 레포 코드]`
- **주의:** `supabase/functions/deno.json`(top-level Deno config)은 이 레포에 **없다**. 공식 권장 구조에는 있지만 없어도 배포는 된다(현행). 이 페이즈에서 만들 필요 없음 — Phase 4가 `deno check` 도입을 결정할 때 함께 판단.

### Q3. `hourCycle: "h23"` vs `hour12: false`

Node v25.6.1 / ICU 78.2, `Intl.DateTimeFormat(…).formatToParts()` 실측:

| 옵션 | resolved.hourCycle | KST 자정 hour | KST 11:55 hour |
|------|--------------------|---------------|----------------|
| `hour12: false` (현행, en-CA·en-US 동일) | `h23` | `00` | `11` |
| `hourCycle: "h23"` (제안) | `h23` | `00` | `11` |
| `hourCycle: "h24"` | `h24` | **`24`** | `11` |
| `hour12: false` + `hourCycle: "h23"` | `h23` | `00` | `11` |
| **`hour12: true` + `hourCycle: "h23"`** | **`h12`** | **`12`** | `11` |

- **h23이 자정 `00`을 보장한다 — VERIFIED.** `[VERIFIED: node -e 실행]`
- **`hour12`가 있으면 `hourCycle`이 무시된다 — VERIFIED.** ECMA-402가 `hour12`를 우선하고 `hourCycle`을 `undefined`로 만든다. 마지막 행이 그 증거다(h23을 줬는데 h12로 resolve). → **D-04 실행 시 `hour12`를 남겨 두지 말고 지운다.** 남겨도 `false`면 결과는 같지만, 나중에 누가 `true`로 뒤집으면 `hourCycle`이 조용히 죽는다.
- **포맷 문자열은 완전히 동일 — VERIFIED.** `lib/time.test.ts`의 9개 문자열 단언이 그대로 초록이다:

| 시각(KST) | `hour12:false` | `hourCycle:"h23"` |
|-----------|----------------|--------------------|
| 11:55:00 | `"11:55"` / `"11:55:00"` | `"11:55"` / `"11:55:00"` |
| 11:55:04 | `"11:55"` / `"11:55:04"` | `"11:55"` / `"11:55:04"` |
| 00:00:00 | `"00:00"` / `"00:00:00"` | `"00:00"` / `"00:00:00"` |

- **`% 24` 보정은 남겨 둔다.** h23에서는 도달 불가지만 h24에서는 실제로 `24`가 나온다(표 3행). 주석으로 "h24 로케일 실수 방어"를 적으면 D-04 문면과 일치.
- **덤으로:** `en-US`·`en-CA`·`en-GB`가 `formatToParts`의 year/month/day/hour/minute/second/weekday(short)에서 **완전히 같은 값**을 준다(1500일 비교 mismatch 0). `_shared/kst.ts`의 로케일 선택은 자유롭다. 요일을 ICU 없이 `new Date(Date.UTC(y, m-1, d)).getUTCDay()`로 구해도 1500일 전부 일치했다 — 로케일 의존을 0으로 만들고 싶으면 이쪽이 더 단단하다(재량).

### Q4. Realtime 페이로드 · `maybeSingle` · 테이블 부재

**(a) `postgres_changes` 페이로드 — CITED.** Realtime 프로토콜 문서의 UPDATE 예시:
```json
{ "type": "UPDATE",
  "record":     { "id": 46, "text": "content", "created_at": "2025-11-03T09:32:55+00:00" },
  "old_record": { "id": 46 } }
```
`record`(supabase-js의 `payload.new`)는 **전체 새 행**, `old_record`(`payload.old`)는 **PK만**(replica identity 기본값). DELETE도 `old_record`가 PK만이고, DELETE 필터링은 `replica identity full`이 필요하다. `[CITED: supabase.com/docs/guides/realtime/protocol, /guides/realtime/postgres-changes]`
→ `settings`는 `id int primary key check (id = 1)`(`0005_…sql:36`)이므로 UPDATE `payload.new`에 `spin_time`·`cooldown_days`·`history_since`가 **전부** 실려 온다. **부분 병합 로직 불필요** — `settingsFromRow(payload.new as SettingsRow)`로 통째 교체하면 된다(D-10의 `changed` action 그대로). DELETE는 `{ id: 1 }`만 오므로 D-10의 "기본값 복귀"가 유일하게 가능한 처리다.

**(b) `maybeSingle()` 0행 — VERIFIED(설치본 소스).** `node_modules/@supabase/postgrest-js/dist/index.mjs` 처리 경로:
```js
if (_this2.isMaybeSingle && Array.isArray(data)) if (data.length > 1) {
  error = { code: "PGRST116", details: `Results contain ${data.length} rows, …`, hint: null,
            message: "JSON object requested, multiple (or no) rows returned" };
  data = null; status = 406; statusText = "Not Acceptable";
} else if (data.length === 1) data = data[0];
else data = null;              // ← 0행: error 는 건드리지 않는다(null 유지)
```
→ **빈 테이블: `data: null`, `error: null`.** `@supabase/supabase-js` 2.106.0 설치본 기준. `[VERIFIED: node_modules 소스 확인]`
이 경로가 곧 D-10의 `loaded(null)` 액션이다 — **에러가 아니므로 배너를 띄우면 안 된다**(`app/page.tsx:54-55`가 `results`에 대해 이미 같은 논리를 쓴다).

**(c) 테이블 부재(컷오버 전 개발 경로) — CITED.** PostgREST는 `PGRST205`를 **HTTP 404**로 돌려주고 메시지는 `Could not find the table 'public.settings' in the schema cache`다. Postgres 원본 `42P01`(undefined table)도 404로 매핑된다. `[CITED: postgrest.org/en/v13/references/errors.html, supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-objects-in-schema]`
postgrest-js는 non-2xx 본문을 `JSON.parse` 해서 `error` 객체로 그대로 넘긴다(배열 본문 + 404만 빈 배열로 특수 처리하는데, 이 에러 본문은 객체라 해당 없음). → **`error.code === "PGRST205"`, `error.message === "Could not find the table 'public.settings' in the schema cache"`.** `formatLoadError("설정", err)`가 만드는 배너 문구는 그대로 `설정 불러오기 실패: Could not find the table 'public.settings' in the schema cache`다. 컷오버 전 개발 중에는 **이 배너가 항상 떠 있는 것이 정상**이며, 기본값으로 앱이 계속 동작하는 것이 SETT-03의 합격선이다.

**(d) 구독 실패(보너스, 개발 중 실제로 밟힘) — CITED.** `settings`는 아직 `supabase_realtime` publication에 없다. Realtime 프로토콜 문서의 에러 표:

| 시나리오 | 서버 재시도 | 클라이언트 조치 |
|----------|------------|-----------------|
| Subscription insert failed (table/publication missing) | **예, 5~10초마다** | degraded state로 표면화하거나 Realtime 활성화 확인 |

그리고 *"These do **not** close the channel"* — 즉 컷오버 전에는 `settings-changes` 채널이 **5~10초 주기로 조용히 재시도**한다. 앱 동작에는 영향 없지만 devtools 네트워크가 시끄러워진다. **별도 채널(D-11)로 분리해 둔 것이 정답**이다 — 기존 `lunch-realtime` 채널(휠 이중 회전 가드가 걸려 있는 곳)과 실패 경로를 섞지 않는다. `[CITED: supabase.com/docs/guides/realtime/protocol]`

### Q5. vitest 4.1 수집 경계

`_shared`에 임시 파일 3개, `spin-roulette/`에 임시 spec 1개를 두고 실행:

```
$ npx vitest list --filesOnly
components/MenuList.test.ts
lib/errors.test.ts
lib/phase.test.ts
lib/time.test.ts
supabase/migrations/0005_restaurants_settings.test.ts
supabase/functions/_shared/zzprobe.test.ts        ← include 적중
supabase/functions/_shared/zzprobeExt.test.ts     ← include 적중

$ npx vitest run supabase/functions/_shared
Test Files  2 passed (2)   Tests  3 passed (3)   Duration 83ms
```
`supabase/functions/spin-roulette/zzprobeExcluded.test.ts`(일부러 `expect(1).toBe(2)`)는 **목록에 없고 실행되지 않았다**. → `include: "supabase/functions/_shared/**/*.test.ts"` + `exclude: "supabase/functions/!(_shared)/**"` extglob 조합이 `vitest.config.mts:21-23,36-38`의 주석대로 정확히 동작한다. **설정 변경 불필요(Wave 0 항목 아님).** `[VERIFIED: vitest 4.1.11 실행]`
부수 확인: vitest는 `./zzprobe`·`./zzprobe.ts` 둘 다 해석한다 — 그래도 **확장자는 쓰지 말 것**(Q1-d에서 tsc가 막는다).

### Q6. eslint `globalIgnores` 좁히기

`eslint.probe.config.mjs`로 `"supabase/functions/**"`를 `spin-roulette/**`·`respin-roulette/**` 두 줄로 교체하고 실행:

```
$ npx eslint --config eslint.probe.config.mjs supabase/functions -f json
supabase/functions/_shared/zzprobe.test.ts     | errors: 0 warnings: 0   ← vitest import, 무탈
supabase/functions/_shared/zzprobe.ts          | errors: 0 warnings: 0
supabase/functions/_shared/zzprobeBad.test.ts  | errors: 0 warnings: 0
supabase/functions/_shared/zzprobeExt.test.ts  | errors: 0 warnings: 0   ← ./x.ts import, lint는 무관심
supabase/functions/_shared/zzprobeLint.ts      | errors: 1 warnings: 1

  2:30  error    Unexpected any. Specify a different type     @typescript-eslint/no-explicit-any
  3:9   warning  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars

$ npx eslint --config eslint.probe.config.mjs supabase/functions/spin-roulette/index.ts
  0:0  warning  File ignored because of a matching ignore pattern.   ← 여전히 무시됨 ✓
```
- `_shared/**/*.ts`가 린트 대상이 되고 `@typescript-eslint` 규칙이 정상 작동한다. `[VERIFIED: eslint 9.39.4 실행]`
- **`*.test.ts`가 `vitest`를 import해도 에러·경고 0건.** `eslint-config-next`에는 `import/no-extraneous-dependencies` 계열이 없어서 devDependency import가 문제되지 않는다. D-12 안전.
- 두 Edge Function 디렉터리는 계속 무시된다(Deno 전역 `Deno.serve`·`jsr:` import가 린트에 걸리지 않는다).
- **문서 동기화 필요:** `.planning/codebase/CONVENTIONS.md`에 "`globalIgnores`로 `design/**`, `supabase/functions/**`를 제외한다 … **풀지 말 것**"이 적혀 있다. 인덱서 OOM 근거는 `design/**` 쪽이고 `supabase/functions/**`의 근거는 `eslint.config.mjs:15` 주석대로 "Deno Edge Function 제외"다. 좁히기는 그 근거와 모순되지 않지만 **CONVENTIONS.md 한 줄 정정이 이 페이즈 산출물에 포함돼야 한다**(안 하면 다음 매퍼가 되돌린다).

### Q7. 순수 리듀서 테스트 방식 — `useSettings`는 테스트하지 않는다

**리듀서는 jsdom 없이 테스트된다 — VERIFIED.** `lib/`에 `import type { SettingsRow } from "@/lib/supabase/client"`만 쓴 probe 리듀서와 spec을 두고 실행 → **4 passed**, `environment: "node"` 그대로, jsdom·React 불필요. `switch` + `const never: never = action` 가드도 tsc를 통과한다. `[VERIFIED: vitest 실행]`

**대조군이 중요하다.** 같은 파일에서 `import("@/lib/supabase/client")`(값 import)를 하면:
```
Caused by: Error: supabaseUrl is required.
 ❯ createClient node_modules/@supabase/supabase-js/dist/index.mjs:842:9
 ❯ lib/supabase/client.ts:8:25
```
레포에 `.env.local`이 **있는데도** 터진다 — Vite/vitest는 `process.env.NEXT_PUBLIC_*`를 채우지 않기 때문이다. `lib/constants.ts` 머리 주석이 말하는 그 제약이 그대로 재현된다. `[VERIFIED: vitest 실행]`
→ **`lib/settings.ts`는 `lib/supabase/client.ts`에서 값을 절대 가져오지 않는다.** `SettingsRow`는 `import type` **문장**으로(인라인 `type` modifier 아님 — `components/MenuList.tsx:6-7`의 근거 주석과 동일한 이유) 가져온다.

**`useSettings` 훅은 단위 테스트하지 않기를 권한다.** 근거:
1. 비용: jsdom + `@testing-library/react` + `react-dom/test-utils` + supabase 클라이언트 목 = **신규 devDependency 3개 이상**과 vitest `environment` 분기. 레포는 지금껏 `environment: "node"` 단일 구성이고(`vitest.config.mts:13-14` 주석이 "컴포넌트를 렌더하지 않는다"를 명시적 결정으로 적어 뒀다), Phase 1이 vitest를 정확 버전 고정으로 들인 취지와도 어긋난다.
2. 가치: 훅을 **I/O만** 남기면(쿼리 1회 + 구독 1개 + `removeChannel`) 테스트할 분기가 사라진다. 판단 로직 전부가 리듀서·`settingsFromRow`에 있고 그쪽은 D-13이 7케이스로 덮는다.
3. 대신 넣을 것: 훅이 리듀서에 **어떤 action을 디스패치하는지**를 리듀서 spec이 직접 호출해 고정하고(=현재 D-13 목록), 훅 본문은 낭독 리뷰 체크(§Validation Architecture의 Manual-Only 표) 3항목으로 검증한다.

### Q8. `cooldownWindowStart` 날짜 산술

권장 식(타임존·로케일 의존 0):
```ts
export function cooldownWindowStart(today: string, days: number): string | null {
  if (days <= 0) return null;                       // 0 = 쿨다운 끔 (음수도 끔으로 취급)
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days)); // Date.UTC 가 달·연·윤년 이월을 알아서 한다
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}
```
실측(`node`, `TZ` 미설정 / `Pacific/Kiritimati`(UTC+14) / `Pacific/Midway`(UTC−11) **세 번 모두 동일 출력**):

| 입력 | 결과 | 확인 대상 |
|------|------|-----------|
| `("2026-03-01", 1)` | `2026-02-28` | 평년 2월 경계 (D-13 명시 케이스) |
| `("2026-01-01", 1)` | `2025-12-31` | 연 경계 (D-13 명시 케이스) |
| `("2024-03-01", 1)` | `2024-02-29` | **윤년** — D-13에 없는 케이스, 추가 권장 |
| `("2026-03-01", 7)` | `2026-02-22` | 다일 이월 |
| `("2026-09-21", 30)` | `2026-08-22` | 월 넘김 |
| `("2026-01-05", 365)` | `2025-01-05` | 1년 |
| `("2026-09-21", 0)` / `(…, -3)` | `null` / `null` | 끔 |

`new Date(Date.UTC(…)).toISOString().slice(0, 10)`도 전 케이스 동일 결과를 준다(더 짧지만, `getUTC*` 조합이 "UTC만 쓴다"는 의도를 코드로 드러내서 한글 Why 주석 컨벤션에 더 맞는다 — 재량). `[VERIFIED: node v25.6.1 실행, TZ 3종]`

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| KST 벽시계 분해(`kstParts`·`kstNow`) | 공유 순수 모듈 (`_shared/kst.ts`) | — | Deno(서버 추첨)와 브라우저(페이즈 표시)가 **같은 답**을 내야 한다. 정의처가 둘이면 시각 기준이 갈린다 |
| 추첨 시각 파싱·경과 판정 | 공유 순수 모듈 (`_shared/spinTime.ts`) | — | Edge Function이 `settings.spin_time`으로 결정(Phase 4)하고 클라이언트가 같은 문자열로 표시 추정(이 페이즈) |
| 쿨다운 필터 | 공유 순수 모듈 (`_shared/cooldown.ts`) | — | **이 페이즈에서는 순수 함수만.** DB 조회·적용은 Edge Function(Phase 4) 단독 책임 |
| 페이즈 판정(`accepting/spinning/decided/stalled`) | 클라이언트 (`lib/phase.ts`) | — | 순수 UI 표시 추정이다. 실제 상태 전환은 `results` 행 존재가 결정(CLAUDE.md) — `hasResult` 인자가 그 사실을 시그니처에 박는다 |
| 설정 도메인 변환·병합 | 클라이언트 순수 (`lib/settings.ts`) | — | React 없이 테스트 가능해야 한다(§Q7) |
| 설정 I/O(SELECT + 구독) | 클라이언트 훅 (`lib/useSettings.ts`) | Supabase Realtime | anon select-only. 쓰기는 대시보드(service_role)만 — 앱 계층에 쓰기 경로가 **없다** |
| `settings` 쓰기 | DB/대시보드 | — | RLS에 쓰기 정책 0건(`0005_…sql:100-101`). 이 페이즈는 읽기만 만든다 |
| 결과 확정 | Edge Function(Phase 4) | pg_cron | 이 페이즈는 **건드리지 않는다** — import 교체만(D-06) |

## Standard Stack

### Core

**신규 패키지 0개.** 이 페이즈는 기존 스택 안에서 모듈 경계만 바꾼다.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.11 (정확 고정) | `_shared`·`lib` 순수 로직 러너 | Phase 1 산출물. `_shared` include가 `vitest.config.mts:23`에 이미 있다 |
| typescript | 5.9.3 | `tsc --noEmit` 게이트 | D-12로 `_shared`까지 범위 확장 |
| eslint / eslint-config-next | 9.39.4 / 16.3.5 | lint 게이트 | D-12로 `_shared`까지 범위 확장 |
| next | 16.3.5 (Turbopack) | `npm run build` 게이트 | `_shared` alias import를 실제로 번들함을 확인(§Q1-c) |
| `Intl.DateTimeFormat` | Node 25.6.1 / ICU 78.2 내장 | KST 변환 | 런타임 내장. Deno에도 같은 API가 있어 `_shared`가 양쪽에서 동작 |
| `crypto.getRandomValues` | Node ≥19 · Deno 전역 | `pickRandom` | 내장 CSPRNG. import 불필요(§Q2) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D-02(import 0개) | `allowImportingTsExtensions: true` + 전부 `.ts` 확장자 | 문법상 가능(`noEmit: true`라 허용 조건 충족)하지만 **레포 전체 import 규약**을 바꾸고 `lib/`·`app/`까지 파급된다. Next 빌드 경로에 새 변수를 들인다. 비추천 |
| D-02 | `_shared`를 npm workspace 패키지로 분리 | 빌드 단계·`package.json` 추가. 3파일·200줄에 과한 구조 |
| `Intl` 기반 `kstParts` | `+09:00` 오프셋 수동 산술 | KST는 1988년 이후 DST 없음 → 산술도 맞지만, 기존 테스트 계약(`lib/time.test.ts`)과 구현이 둘 다 `Intl`이라 바꿀 이유 없음 |
| ICU 요일(`weekday: "short"` + map) | `new Date(Date.UTC(y,m-1,d)).getUTCDay()` | 1500일 비교 mismatch 0(§Q3). 로케일 의존을 0으로 만들지만 기존 구현·테스트가 이미 초록 — **재량** |
| `@testing-library/react`로 `useSettings` 테스트 | (안 함) | devDependency 3개 + jsdom 도입. §Q7 참조 |

**Installation:** 없음. `package.json`·`package-lock.json` 무변경이 이 페이즈의 불변식이다.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | 이 페이즈는 외부 패키지를 설치하지 않는다 |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

설치 대상이 0개이므로 Package Legitimacy Gate는 해당 없음. 기존 의존성은 Phase 1에서 `npm audit` 0건으로 확인됐고 이 페이즈는 그 상태를 유지한다(`npm audit` 재확인이 페이즈 게이트에 포함).

## Architecture Patterns

### System Architecture Diagram

```
                     ┌──────────────────────────────────────────────┐
                     │  DB: public.settings (단일행 id = 1)          │
                     │  spin_time time · cooldown_days int ·        │
                     │  history_since date       [anon: SELECT만]   │
                     └───────┬──────────────────────────┬───────────┘
                             │ (1) 최초 SELECT           │ (2) Realtime
                             │  .eq("id",1).maybeSingle()│  postgres_changes "*"
                             ▼                           ▼
              ┌──────────────────────────────────────────────────────┐
              │ lib/useSettings.ts  (I/O만. 판단 없음)                 │
              │   dispatch(loaded(row|null)) / failed(msg)            │
              │            / changed(event, row)                     │
              └───────────────────────┬──────────────────────────────┘
                                      ▼
              ┌──────────────────────────────────────────────────────┐
              │ lib/settings.ts  (순수·테스트 대상)                     │
              │   settingsReducer ─ settingsFromRow ─ DEFAULT_SETTINGS│
              │   출력: { settings, loaded, error }                    │
              └───────┬──────────────────────────┬───────────────────┘
                      │ settings.spinTime         │ error
                      ▼                           ▼
   ┌──────────────────────────────────┐   ┌──────────────────────────────┐
   │ lib/phase.ts                     │   │ joinLoadErrors([...,          │
   │  currentPhase(now, spinTime,     │   │   formatLoadError("설정",err)])│
   │               hasResult)         │   │  → <ErrorBanner>              │
   │  → accepting|spinning|decided|   │   └──────────────────────────────┘
   │     stalled                      │
   └───────┬──────────────────────────┘
           │ Phase
           ▼
   ┌────────────────────────────────────────────────────────────────┐
   │ TopBar · StageHeader · PhaseTimeline · ResultBlock · MenuList   │
   │   (switch + never 가드로 4번째 상태 누락을 컴파일 에러로)          │
   └────────────────────────────────────────────────────────────────┘

   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  공유 순수 모듈 경계  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
   supabase/functions/_shared/     ← import 0개. 서로도 안 끌어온다
     kst.ts        kstParts · kstNow · pickRandom
     spinTime.ts   SpinTime · DEFAULT_SPIN_TIME(_TEXT) · parseSpinTime
                   · secondsOfDay · isAfterSpinTime
     cooldown.ts   cooldownWindowStart · applyCooldown
        ▲                                   ▲
        │ 확장자 없이 (@/… alias)             │ 확장자 필수 (../_shared/x.ts)
        │ tsc·Turbopack·vitest               │ Deno 런타임
   lib/time.ts · lib/phase.ts           supabase/functions/spin-roulette/index.ts
   lib/settings.ts                      supabase/functions/respin-roulette/index.ts
                                        (Phase 3은 import 교체만 — 본문은 Phase 4)
```

### Recommended Project Structure

```
supabase/functions/_shared/      # 신규. tsc·eslint·vitest 대상으로 승격(D-12)
├── kst.ts                       # import 0개
├── kst.test.ts                  # import: vitest, ./kst  (확장자 없이)
├── spinTime.ts                  # import 0개 ← kst.ts 도 안 끌어온다
├── spinTime.test.ts
├── cooldown.ts                  # import 0개
├── cooldown.test.ts
└── edgeImports.test.ts          # 두 index.ts 를 텍스트로 파싱하는 계약 테스트(D-12)

lib/
├── time.ts                      # kstParts 는 _shared/kst 재수출, 포맷터는 유지
├── phase.ts                     # spinTime 주입 + stalled
├── settings.ts                  # 신규 순수 모듈 (값 import 0개)
├── settings.test.ts
└── useSettings.ts               # 신규 훅 (레포 첫 lib/useX.ts)
```

### Pattern 1: `_shared` 모듈은 "인라인 구조 타입"으로 교차 의존을 대신한다

**What:** 타입을 공유해야 하는데 import가 금지될 때, **필요한 최소 필드만** 파라미터 자리에 인라인으로 적는다. TypeScript는 구조적 타입이라 `kst.ts`의 `KstParts`가 그대로 대입된다.
**When to use:** `_shared` 모듈 사이의 모든 타입 참조.

```ts
// supabase/functions/_shared/spinTime.ts
// 이 파일은 아무것도 import 하지 않는다 — Deno 는 "./kst.ts", tsc 는 "./kst" 를 요구해
// 어느 쪽을 적어도 한쪽이 깨진다. 타입은 최소 구조로 받아 구조적 타이핑에 맡긴다.
type TimeParts = { hour: number; minute: number; second: number };

export function secondsOfDay(p: TimeParts): number {
  return p.hour * 3600 + p.minute * 60 + p.second;
}
export function isAfterSpinTime(p: TimeParts, spin: SpinTime): boolean {
  return secondsOfDay(p) >= spin.hh * 3600 + spin.mm * 60;
}
```
`kstParts(now)`의 반환값을 그대로 넘길 수 있다. 확장자 문제도, `import type` 문제도 발생하지 않는다.
`[VERIFIED: 구조적 타이핑은 TS 기본 동작. `.ts`/무확장 import가 양쪽에서 실패하는 것은 §Q1-b·Q1-d 실측]`

### Pattern 2: `Phase` 유니온 확장은 `switch` + `never` 가드와 한 태스크로 묶는다

**What:** 유니온 멤버를 추가할 때 모든 소비처를 `if`-체인에서 `switch`로 바꾸고 `default`에 `never` 대입을 둔다.
**When to use:** `Phase`에 `"stalled"`를 넣는 바로 그 태스크.

```ts
// components/TopBar.tsx — Before (stalled 를 추가해도 tsc 는 아무 말 없이 "확정" 으로 떨어진다)
const phaseInfo = (() => {
  if (phase === "accepting") return { label: "모집중", dot: "live" };
  if (phase === "spinning")  return { label: "룰렛 회전", dot: "spin" };
  return { label: "확정", dot: "done" };       // ← stalled 가 여기로 샌다
})();

// After — 분기를 빠뜨리면 컴파일이 멈춘다
const phaseInfo = ((): { label: string; dot: string } => {
  switch (phase) {
    case "accepting": return { label: "모집중",   dot: "live" };
    case "spinning":  return { label: "룰렛 회전", dot: "spin" };
    case "decided":   return { label: "확정",     dot: "done" };
    case "stalled":   return { label: "추첨 대기", dot: "live" };
    default: {
      // 유니온에 상태가 더 늘면 이 대입이 에러가 된다. 이 파일이 갱신을 강제당하는 지점.
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
})();
```
`[VERIFIED: 유니온 확장이 기존 9개 소비처에서 tsc 에러 0건임을 §Pitfall 1의 전수 목록으로 확인]`

### Pattern 3: 설정 리듀서는 "총 함수"다 — 어떤 입력도 기본값으로 착지한다

**What:** `settingsFromRow`가 절대 throw하지 않고, 파싱 실패를 `warning`으로 **반환**한다(D-10).
**Why:** `settings`는 앱의 세 페이지가 전부 의존하는 단일 출처다. 대시보드에서 누가 이상한 값을 넣거나 행을 지워도 앱이 흰 화면이 되면 안 된다(가용성).

```ts
// lib/settings.ts — 값 import 0개. SettingsRow 는 import type 문장으로만.
import type { SettingsRow } from "@/lib/supabase/client";
import { DEFAULT_SPIN_TIME, parseSpinTime, type SpinTime } from "@/supabase/functions/_shared/spinTime";

export type Settings = { spinTime: SpinTime; cooldownDays: number; historySince: string | null };
export const DEFAULT_SETTINGS: Settings = {
  spinTime: DEFAULT_SPIN_TIME,   // parseSpinTime(...)! 대신 상수 — 비-null 단언을 안 쓴다
  cooldownDays: 0,
  historySince: null,
};

export function settingsFromRow(row: SettingsRow): { settings: Settings; warning: string | null } {
  const parsed = parseSpinTime(row.spin_time);
  return {
    settings: {
      spinTime: parsed ?? DEFAULT_SETTINGS.spinTime,
      // 음수·NaN 방어: DB check 가 이미 >= 0 을 보장하지만 Realtime 페이로드는 DB 를 거치지 않은
      // 형태로 올 수도 있다고 가정하고 읽는 쪽에서 한 번 더 좁힌다.
      cooldownDays: Number.isFinite(row.cooldown_days) && row.cooldown_days > 0 ? row.cooldown_days : 0,
      historySince: row.history_since ?? null,
    },
    warning: parsed ? null : `설정의 추첨 시각("${row.spin_time}")을 읽지 못해 기본값 11:55로 동작해요`,
  };
}
```

### Pattern 4: 설정 구독은 **별도 채널**로 — 기존 `lunch-realtime`과 섞지 않는다

**What:** `settings-changes` 채널 하나에 `event: "*"` 바인딩 하나.
**Why:** (1) 컷오버 전에는 `settings`가 publication에 없어 구독이 실패하고 서버가 5~10초마다 재시도한다(§Q4-d) — 그 실패를 휠 가드(`initialLoadedRef`)가 걸린 채널과 같은 곳에 두지 않는다. (2) `app/page.tsx`의 `lunch-realtime`은 6개 바인딩이 얽혀 있고 CLAUDE.md가 "순서 바꾸면 휠 이중 회전"이라고 적어 둔 위험 지점이다.

```ts
// lib/useSettings.ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (cancelled) return;
    // 0행은 에러가 아니다 — maybeSingle 이 data: null, error: null 을 준다(postgrest-js 소스 확인).
    // 테이블 자체가 없으면(컷오버 전) PGRST205 / 404 가 error 로 온다. 둘을 다른 action 으로 가른다.
    if (error) dispatch({ type: "failed", message: error.message });
    else dispatch({ type: "loaded", row: (data as SettingsRow | null) ?? null });
  })();
  return () => { cancelled = true; };
}, []);

useEffect(() => {
  const ch: RealtimeChannel = supabase
    .channel("settings-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, (payload) => {
      // UPDATE 의 payload.new 는 전체 새 행이다(replica identity 기본값에서도).
      // DELETE 의 payload.old 는 PK 만 오므로 행을 재구성할 수 없다 → 기본값 복귀가 유일한 처리.
      dispatch({
        type: "changed",
        event: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
        row: payload.eventType === "DELETE" ? null : (payload.new as SettingsRow),
      });
    })
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, []);
```
`[CITED: supabase.com/docs/guides/realtime/protocol (record/old_record), /guides/realtime/getting_started (removeChannel cleanup)]`

### Pattern 5: 쿨다운은 "필터 + 폴백"을 한 함수 안에서 끝낸다

```ts
// supabase/functions/_shared/cooldown.ts — import 0개
export function applyCooldown<T extends { restaurant_id: string }>(
  candidates: T[],
  recentWinnerIds: Iterable<string | null>,
): { picked: T[]; fellBack: boolean } {
  // null 은 전환 이전 레거시 results 행이다 — 매칭 키가 없으므로 무시한다(D-05).
  const blocked = new Set<string>();
  for (const id of recentWinnerIds) if (id) blocked.add(id);
  if (blocked.size === 0) return { picked: candidates, fellBack: false };

  const kept = candidates.filter((c) => !blocked.has(c.restaurant_id));
  // 전부 걸러졌으면 "오늘 추첨 없음"이 아니라 전체 후보로 되돌린다(SPIN-02).
  // 이 폴백이 없으면 쿨다운이 켜진 날 후보가 전멸해 결과가 안 생긴다.
  return kept.length > 0 ? { picked: kept, fellBack: false } : { picked: candidates, fellBack: true };
}
```
**D-01은 반환형을 `T[]`로 적었지만 CONTEXT의 Specific Ideas가 `{ picked, fellBack }`을 제안했다.** Phase 4가 응답 JSON에 `cooldown_fallback: true`를 실으려면 객체형이 필요하고, 나중에 바꾸면 `_shared` 계약 테스트와 Edge 본문을 두 번 손댄다. **지금 객체형으로 확정하기를 권한다** — 단 D-01 문면을 바꾸는 일이라 계획에서 명시적으로 기록할 것(§Open Questions Q-1).

### Anti-Patterns to Avoid

- **`_shared`에서 `import type { X } from "./y"`:** 타입만 가져와도 import 문이다. Deno는 확장자를 요구하고 tsc는 거부한다(§Q1-d). Pattern 1로 대체.
- **`hour12`와 `hourCycle`을 같이 적기:** `hour12`가 이기므로 `hourCycle`이 죽는다(§Q3). 지운다.
- **`Phase` 소비처를 `if`-체인으로 남겨두기:** 컴파일러가 잡아주지 않는다(§Pitfall 1).
- **`lib/settings.ts`에서 `supabase` 값 import:** vitest가 `supabaseUrl is required.`로 즉사한다(§Q7).
- **`ResultBlock`에 `stalled` 분기를 "새로" 만들기:** `decided && !winner` 분기가 도달 불가가 되면서 그 문구가 정확히 stalled용이다 — 조건만 바꿔 옮기고 죽은 분기를 남기지 않는다.
- **`settings` 구독을 `lunch-realtime` 채널에 끼워 넣기:** §Pattern 4.
- **`npm run dev`로 확인하기:** CLAUDE.md 금지(가드런처만). 이 페이즈는 `tsc`·`lint`·`test`·`build`만으로 전부 검증 가능하다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KST 벽시계 분해 | `getTime() + 9*3600*1000` 수동 오프셋 | `Intl.DateTimeFormat("en-*", { timeZone: "Asia/Seoul" }).formatToParts` | 기존 구현·테스트가 이미 이 방식이고 초록이다. 바꾸면 테스트 계약이 아니라 구현을 검증하게 된다 |
| 날짜 N일 빼기 | 문자열 파싱 + 월별 일수 테이블 | `Date.UTC(y, m-1, d-days)` | 윤년·월·연 이월을 런타임이 처리한다(§Q8 실측 7케이스) |
| 난수 | `Math.random()` | `crypto.getRandomValues` | 현행 동작 유지 + `react-hooks/purity` 린트가 렌더 중 `Math.random()`을 금지한다(CONVENTIONS.md) |
| 타입 공유 | `_shared` 사이 import, 또는 타입 정의 복붙 | 인라인 구조 타입(Pattern 1) | import는 컴파일이 깨지고, 복붙은 이 페이즈가 없애려는 바로 그 문제다 |
| 유니온 분기 누락 탐지 | 리뷰·테스트 | `switch` + `never` (Pattern 2) | 9개 소비처를 사람이 빠짐없이 훑는 것보다 컴파일러가 싸고 확실하다 |
| 설정 부분 병합 | `{ ...prev, ...payload.new }` 얕은 병합 | `settingsFromRow(payload.new)` 통째 교체 | `payload.new`가 이미 전체 행이다(§Q4-a). 얕은 병합은 "빠진 필드는 이전 값"이라는 **틀린 가정**을 코드에 심는다 |

**Key insight:** 이 페이즈의 "직접 만들지 말 것" 1순위는 라이브러리가 아니라 **타입 공유 메커니즘**이다. `_shared`가 두 컴파일러를 동시에 만족해야 한다는 제약 때문에, 보통이면 당연한 `import type` 한 줄이 여기서는 금지 항목이 된다.

## Runtime State Inventory

> 리팩터·이름 이동 페이즈이므로 포함한다. 결론부터: **이 페이즈는 런타임 상태를 하나도 바꾸지 않는다.**

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **없음.** DB 스키마·데이터 접근 0건. `settings` 행은 Phase 2의 0005가 시드하고 적용은 Phase 8 (검증: `git diff main...HEAD -- supabase/migrations`에 0005 2파일뿐, 이 페이즈는 `supabase/migrations/`를 건드리지 않는다) | 없음 |
| Live service config | **없음.** Edge Function 소스는 바뀌지만(D-06) **재배포하지 않는다** — 라이브에는 구 코드가 그대로 돈다. `supabase` CLI가 로컬에 없어(`command -v supabase` → NOT INSTALLED) 실수로 배포될 수도 없다. n8n·Datadog 등 외부 서비스 없음 | 없음 (배포는 Phase 8, `--no-verify-jwt` 필수) |
| OS-registered state | **없음.** pg_cron 잡은 DB 안이고 이 페이즈는 SQL을 안 건드린다. OS 스케줄러·pm2·launchd 사용처 없음 | 없음 |
| Secrets/env vars | **없음.** `.env.local`·`.env.example`은 `NEXT_PUBLIC_SUPABASE_*` 2개뿐이고 이름이 바뀌지 않는다. `_shared`·`lib/settings.ts`는 환경변수를 읽지 않는다(그게 §Q7의 전제다) | 없음 |
| Build artifacts | **1건.** `.next/types/validator.ts`가 라우트 목록을 캐시한다 — 조사 중 임시 라우트를 지운 직후 `tsc --noEmit`이 `TS2307: Cannot find module '../../app/zzprobe/page.js'`로 실패했고 `npm run build` 재실행으로 복구됐다. 이 페이즈는 라우트를 추가·삭제하지 않으므로 해당 없지만, **라우트를 건드린 뒤 `tsc`가 이상하면 빌드를 다시 돌릴 것**. `tsconfig.tsbuildinfo`(incremental)는 `exclude` 변경을 정상 반영했다(D-12 probe에서 즉시 새 에러 출력) | 없음 (증상 발생 시 `npm run build` 재실행) |

**"결과 행"이 남는 유일한 지점:** 없음. 이 페이즈 뒤 `git diff`에 나타나는 모든 변경은 파일뿐이고, 배포되지 않은 상태로 Phase 8까지 브랜치에 머문다.

## Common Pitfalls

### Pitfall 1: `Phase`에 `"stalled"`를 더해도 컴파일러가 아무 말을 하지 않는다 ⚠ 최우선

**What goes wrong:** 유니온 멤버를 추가하면 "이제 모든 분기를 고쳐야 한다"고 생각하지만, 기존 소비처가 전부 `if`-체인 + fallback이라 **tsc 에러가 0건**이다. 화면은 계속 렌더되고 테스트도 초록이며, `MenuList`만 조용히 틀린다.

**전수 목록(9개 소비처, 전부 이 페이즈에서 손대야 함):**

| 파일:줄 | 현재 코드 | `stalled`가 떨어지는 곳 | 필요 조치 |
|---------|-----------|------------------------|-----------|
| `components/MenuList.tsx:49` | `readOnly = phase !== "accepting"` | `readOnly = true` | **SPIN-03 직결.** `phase === "spinning" \|\| phase === "decided"`로 (D-08) |
| `components/TopBar.tsx:18-20` | if-체인 → `return { label: "확정", dot: "done" }` | "확정" 뱃지 | `switch`+`never`, `"추첨 대기"` (D-09) |
| `components/PhaseTimeline.tsx:16-17` | `findIndex` → `-1` → `idx = 2` | "결과" 단계 활성 | `stalled` → `accepting` 매핑 (D-09) |
| `components/ResultBlock.tsx:14/46/76/105` | if-체인 4분기 | **어디에도 안 걸려 `return null`** = 빈 영역 | `105`의 `decided && !winner`를 `phase === "stalled"`로 전환(문구가 이미 맞다) |
| `app/page.tsx:302-304` (`StageHeader`) | 삼항 → "오늘의 결과"/`done` | "오늘의 결과" | `switch`, "추첨 대기중" (D-09) |
| `app/page.tsx:336-341` (`phaseHeadline`) | if-체인 → `"오늘의 점심"` | 무해하지만 부정확 | `stalled` 분기 추가 |
| `app/page.tsx:343-350` (`phaseSubhead`) | if-체인 → `""` | 빈 부제 | `stalled` 분기 추가 |
| `app/page.tsx:148-154` (`wheelPhase`) | `phase === "spinning" ? … : "idle"` | `"idle"` ✓ | 우연히 맞음. D-08대로 명시 |
| `app/page.tsx:267` (respin 버튼) | `resolvedPhase === "decided" && todayResult` | 버튼 숨김 ✓ | `resolvedPhase` 제거 후 재확인 |

**How to avoid:** Pattern 2. 유니온 확장과 `switch` 전환을 **같은 커밋**에 넣는다. 나눠서 하면 사이 커밋이 "초록인데 틀린" 상태다.
**Warning signs:** `Phase`를 넓힌 뒤 `npx tsc --noEmit`이 통과하면 그 자체가 신호다 — 전환이 아직 안 끝났다는 뜻이다.
`[VERIFIED: 소비처 목록은 `grep -rn 'phase === \|phase !== \|: Phase\|currentPhase' app components lib` 전수]`

### Pitfall 2: D-01 시그니처를 문자 그대로 구현하면 D-02가 깨진다

**What goes wrong:** `secondsOfDay(parts)`를 쓰려고 `spinTime.ts`가 `kst.ts`의 타입을 import한다 → `"./kst"`면 Deno 런타임 실패, `"./kst.ts"`면 `tsc --noEmit`·`npm run build` 실패(§Q1-b·d).
**Why it happens:** D-02는 "값 import"를 상상하고 쓰였지만, 실제로 부딪히는 것은 **타입 import**다.
**How to avoid:** Pattern 1의 인라인 구조 타입. 또는 `secondsOfDay`를 `kst.ts` 쪽으로 옮긴다(그러면 `spinTime.ts`가 `hour/minute/second`를 직접 받는 형태로 바뀐다 — 어느 쪽이든 import는 0개가 유지돼야 한다).
**Warning signs:** `_shared/*.ts` 첫 줄에 `import`가 보이면 그 순간 규칙 위반이다. D-12 적용 후에는 `npx tsc --noEmit`이 TS5097로 직접 잡아 준다.

### Pitfall 3: `kstParts`에 `date`를 더하면 기존 `lib/time.test.ts`가 깨진다

**What goes wrong:** D-13은 "기존 `lib/time.test.ts` 그대로 통과(re-export)"라고 적었지만, `lib/time.test.ts:58`은
```ts
expect(kstParts(new Date("2026-09-18T02:55:04Z"))).toEqual({
  year: 2026, month: 9, day: 18, hour: 11, minute: 55, second: 4, weekday: 5,
});
```
`toEqual`은 **잉여 키를 허용하지 않는다**(vitest 4.1.11에서 실행해 확인 — 기대값에 `date`가 없으면 throw).
**How to avoid:** 두 선택지 중 하나를 계획에 명시한다.
- **(A) 권장:** `date`를 `kstParts` 반환에 넣고 `lib/time.test.ts:58-66`의 기대 객체에 `date: "2026-09-18"` 한 줄을 더한다. Edge Function이 `now.date`를 쓰므로(`spin-roulette/index.ts:67`) `date`는 필요하다.
- (B) `kstParts`는 그대로 두고 `_shared/kst.ts`에 `kstDateOf(parts)` 또는 `kstNow()`만 `date`를 합성해 돌려준다. 기존 spec 무변경이지만 반환 타입이 둘로 갈린다.
**Warning signs:** 없음 — Wave 중간에 빨간 줄로 나타난다. **미리 태스크에 적어 두는 것이 유일한 예방책이다.**
`[VERIFIED: vitest 실행 — 잉여 키 toEqual 실패 / toMatchObject 통과]`

### Pitfall 4: `_shared`가 타입체크·린트를 **아직** 안 받고 있다

**What goes wrong:** `_shared/`에 파일을 만들고 `npm test`가 초록이면 다 된 줄 안다. 하지만 좁히기(D-12) 전에는 `tsconfig.json` `exclude: ["… "supabase/functions/**" …]` 때문에 **명백한 타입 에러가 있어도 `tsc --noEmit`이 exit 0**이고(§Q1-d 실측), eslint는 파일을 아예 열지 않는다. vitest는 타입체크를 하지 않는다(esbuild transpile-only).
**How to avoid:** **D-12(tsc·eslint 제외 좁히기)를 `_shared` 파일을 쓰기 전 Wave 0/첫 태스크로 올린다.** 순서가 반대면 그동안 작성한 코드가 검증 사각지대에 있다가 마지막에 몰아서 터진다.
**Warning signs:** `_shared`에 `any`를 넣어도 `npm run lint`가 조용하면 좁히기가 아직 안 된 것이다.

### Pitfall 5: `maybeSingle`의 "0행"과 "테이블 없음"을 같은 분기로 처리한다

**What goes wrong:** `if (!data) dispatch(failed(...))`처럼 쓰면 **시드가 안 된 정상 상태**(0행)를 실패로 표시해 배너가 뜬다. 반대로 `if (error) return;`로 삼키면 컷오버 전 `PGRST205`가 조용히 사라져 SETT-03의 실패 경로가 검증되지 않는다.
**Why it happens:** `maybeSingle()`은 0행에서 `data: null, error: null`을, 테이블 부재에서 `data: null, error: {code:"PGRST205", …}`를 준다 — `data`만 보면 구별이 안 된다(§Q4-b·c).
**How to avoid:** `error`를 먼저 보고 `failed`, 아니면 `loaded(data ?? null)`. `app/page.tsx:54-55`가 `results`에 대해 이미 같은 논리를 주석으로 적어 뒀다 — 그 패턴을 따른다.
**Warning signs:** 컷오버 전 개발 중에 배너가 **안 뜨면** 에러를 삼키고 있는 것이다(테이블이 없으므로 떠야 정상).

### Pitfall 6: `pickRandom([])`은 타입이 `T`라고 주장하지만 `undefined`를 준다

**What goes wrong:** `arr[u[0] % 0]` → `arr[NaN]` → `undefined`. 시그니처는 `T`라서 호출자가 방어하지 않는다.
**Why it happens:** 현행 두 Edge Function이 호출 직전에 `menus.length === 0`을 검사하고 있어서(`spin-roulette/index.ts:90`, `respin-roulette/index.ts:86`) 지금은 안 터진다 — **호출자 쪽 규율에 의존하는 계약**이다.
**How to avoid:** `_shared/kst.ts`에 전제조건을 한글 Why 주석으로 명시하고, Phase 4가 `applyCooldown` 결과를 넘길 때 다시 빈 배열 검사를 하도록 계약 테스트에 남긴다. (동작 변경 금지 원칙상 이 페이즈에서 throw로 바꾸지 않는다.)
**Warning signs:** 없음 — 후보 0개일 때만 나타나고, 그게 정확히 SPIN-03 시나리오다.

### Pitfall 7: `spin_time`이 항상 `"HH:MM:SS"`라고 가정한다

**What goes wrong:** PostgREST의 `time` 직렬화는 소수 초를 포함할 수 있다(`"11:55:30.5"`). `^\d{2}:\d{2}(:\d{2})?$` 같은 정규식은 이걸 `null`로 떨어뜨려 기본값 + warning 경로로 샌다.
**Why it happens:** 0005의 기본값 `'11:55'`는 `"11:55:00"`으로 나오지만, 대시보드에서 사람이 초 단위를 넣을 수 있다.
**How to avoid:** `^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$`로 소수부를 허용하되 **무시**한다(초는 추첨 판정에 안 쓴다 — `SpinTime`은 `{hh, mm}`). D-13의 거부 케이스(`"25:00"`·`"11:60"`·`""`·`"1155"`)는 그대로 `null`이 된다.
**Warning signs:** 대시보드에서 시각을 바꿨는데 앱이 11:55로 돌아가고 warning 배너가 뜬다.

### Pitfall 8: `lib/time.ts`의 re-export가 `isolatedModules`에 걸린다

**What goes wrong:** `export { kstParts, type KstParts } from "@/supabase/functions/_shared/kst";`에서 **타입을 값처럼 재수출**하면 `isolatedModules: true`(tsconfig:13) 환경에서 에러가 난다.
**How to avoid:** 값과 타입을 나눈다 — `export { kstParts } from "…";` + `export type { KstParts } from "…";`. CONVENTIONS.md의 "타입은 반드시 `type` 키워드로 표시" 규칙과 같은 근거다.
**Warning signs:** `npx tsc --noEmit`이 `TS1205`/`TS1448` 계열로 잡아 준다 — 이건 컴파일러가 막아 주는 쪽이라 상대적으로 안전하다.

### Pitfall 9: 컷오버 전 `settings` 구독이 5~10초마다 재시도한다

**What goes wrong:** 개발 중 devtools 네트워크 탭에 Realtime 재조인이 계속 찍혀 "뭔가 망가졌다"고 오판한다.
**Why it happens:** `settings`가 아직 `supabase_realtime` publication에 없다(0005 적용은 Phase 8). Realtime 프로토콜상 *Subscription insert failed (table/publication missing)*은 서버가 5~10초마다 재시도하고 채널은 닫히지 않는다.
**How to avoid:** 예상된 동작임을 `useSettings.ts` 머리 주석에 남긴다. 기능적으로는 기본값으로 계속 동작하므로 SETT-03 합격.
`[CITED: supabase.com/docs/guides/realtime/protocol]`

## Code Examples

### `_shared/kst.ts` — import 0개, `date` 포함 (D-01 + Pitfall 3-A)

```ts
// KST(Asia/Seoul) 벽시계 분해. 이 파일이 레포 전체에서 KST 변환의 유일한 구현처다.
// import 를 하나도 하지 않는 이유: Deno 는 상대 import 에 ".ts" 확장자를 요구하고,
// tsc(moduleResolution: bundler, allowImportingTsExtensions 없음)는 그 확장자를 거부한다.
// 서로 import 하지 않으면 Deno · tsc · Turbopack · vitest 네 곳에서 모두 컴파일된다.

const KST_TZ = "Asia/Seoul";
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type KstParts = {
  date: string;  // "yyyy-mm-dd" — results.date 와 그대로 비교하는 날짜 키
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
  weekday: number; // 0=일 … 6=토
};

export function kstParts(now: Date): KstParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
    // hour12: false 가 아니라 hourCycle: "h23" 을 쓴다. hour12 는 로케일 기본 비-12 사이클(h23 또는
    // h24)에 위임하는 것이라 ICU 버전·로케일에 따라 자정이 "24" 로 나올 수 있다. h23 은 "00" 을 보장한다.
    // (hour12 와 hourCycle 을 같이 적으면 hour12 가 이겨 hourCycle 이 무시되므로 hour12 는 지운다.)
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // h23 에서는 도달 불가. h24 로케일 실수를 막는 방어선으로 남긴다
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAY[get("weekday")] ?? 0,
  };
}

export function kstNow(): KstParts {
  return kstParts(new Date());
}

// 전제조건: arr.length > 0. 빈 배열이면 undefined 를 돌려주면서 타입은 T 라고 주장한다 —
// 호출자가 반드시 길이를 먼저 검사한다(현행 두 Edge Function 이 그렇게 하고 있다).
export function pickRandom<T>(arr: T[]): T {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u); // Deno · Node≥19 전역. import 불필요
  return arr[u[0] % arr.length];
}
```
`[VERIFIED: hourCycle 거동·로케일 동등성·crypto 전역은 §Q3·Q2 실측. import 0개 규칙은 §Q1-d 실측]`

### `_shared/spinTime.ts` — 기본 추첨 시각의 유일한 정의처

```ts
// 기본 추첨 시각(11:55)의 유일한 정의처. settings.spin_time 이 있으면 그쪽이 이긴다.
// 화면 문구에 박혀 있는 "11:55"(app/page.tsx · components/MenuList.tsx · PhaseTimeline · Wheel)는
// Phase 6(SPIN-06)에서 settings 로 교체된다 — 이 파일이 그 작업의 기준점이다.
// 이 파일도 import 0개다(kst.ts 조차 끌어오지 않는다 — 이유는 kst.ts 머리 주석 참조).

export type SpinTime = { hh: number; mm: number };

export const DEFAULT_SPIN_TIME_TEXT = "11:55";
// parseSpinTime(...)! 대신 리터럴 상수를 둔다 — 비-null 단언을 호출처에 퍼뜨리지 않기 위해서.
export const DEFAULT_SPIN_TIME: SpinTime = { hh: 11, mm: 55 };

// "HH:MM" · "HH:MM:SS" · "HH:MM:SS.ffffff"(PostgREST time 직렬화) 를 받는다. 초는 버린다.
// throw 하지 않는다: 이 값은 대시보드에서 사람이 넣은 문자열이고, 잘못된 값 하나가
// 세 페이지를 흰 화면으로 만들면 안 된다. 실패는 null 로 돌려 호출자가 기본값으로 착지한다.
const RE = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;

export function parseSpinTime(text: string): SpinTime | null {
  const m = RE.exec(text);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm };
}

// kst.ts 의 KstParts 를 import 하지 않고 최소 구조만 받는다 — TS 는 구조적 타입이라 그대로 대입된다.
type TimeParts = { hour: number; minute: number; second: number };

export function secondsOfDay(p: TimeParts): number {
  return p.hour * 3600 + p.minute * 60 + p.second;
}

export function isAfterSpinTime(p: TimeParts, spin: SpinTime): boolean {
  return secondsOfDay(p) >= spin.hh * 3600 + spin.mm * 60;
}
```

### `lib/phase.ts` — 시각 주입 + `stalled` (D-07)

```ts
// 현재 KST 시각 + 설정된 추첨 시각으로 화면 표시용 페이즈를 추정한다.
//
//   hasResult = true                     → decided  (시각 무관: 늦은 추첨·다시 돌리기 포함)
//   t < spin                             → accepting
//   spin ≤ t < spin + 5s                 → spinning (휠 애니메이션 구간)
//   t ≥ spin + 5s 인데 결과가 없다        → stalled  (후보 0개 등 — UI 를 잠그지 않는다, SPIN-03)
//
// 실제 상태 전환의 정본은 여전히 results 행의 존재다. 그래서 시각이 아니라 hasResult 가 decided 를
// 결정하고, 시각은 그 아래 세 상태를 가른다. 기본 인자를 두지 않는 것도 같은 이유다 —
// 호출자가 settings 에서 온 시각을 반드시 넘기게 강제한다.

import { secondsOfDay, type SpinTime } from "@/supabase/functions/_shared/spinTime";
import { kstParts } from "@/lib/time";

export type Phase = "accepting" | "spinning" | "decided" | "stalled";

const SPIN_ANIM_SEC = 5; // 휠 애니메이션 길이. components/Wheel.tsx 의 SPIN_MS 와 짝이다

export function currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean): Phase {
  if (hasResult) return "decided";
  const t = secondsOfDay(kstParts(now));
  const spinAt = spinTime.hh * 3600 + spinTime.mm * 60;
  if (t < spinAt) return "accepting";
  if (t < spinAt + SPIN_ANIM_SEC) return "spinning";
  return "stalled";
}
```
> `msToNextPhase`는 삭제한다(참조 0건, Phase 1이 테스트를 일부러 안 걸어 둔 이유가 이것이다 — STATE.md 결정 로그).

### `edgeImports.test.ts` — Deno 파일의 유일한 자동 검증 (D-12)

```ts
// deno 가 로컬에 없어 deno check 를 돌릴 수 없다(환경 실측). 두 Edge Function 의 import 교체가
// 실제로 일어났는지를 텍스트로 확인하는 것이 이 페이즈가 가진 유일한 자동 회귀 장치다.
// Phase 2 의 마이그레이션 계약 테스트와 같은 방식이고, 같은 한계(형태만 본다)를 갖는다.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const files = {
  spin: readFileSync("supabase/functions/spin-roulette/index.ts", "utf8"),
  respin: readFileSync("supabase/functions/respin-roulette/index.ts", "utf8"),
};

describe.each(Object.entries(files))("%s/index.ts", (_name, src) => {
  it("_shared/kst.ts 를 확장자와 함께 import 한다 (Deno 요구사항)", () => {
    expect(src).toMatch(/from\s+"\.\.\/_shared\/kst\.ts"/);
  });
  it("로컬 kstNow 복붙이 남아 있지 않다", () => {
    expect(src).not.toMatch(/function\s+kstNow/);
  });
  it("로컬 pickRandom 복붙이 남아 있지 않다", () => {
    expect(src).not.toMatch(/function\s+pickRandom/);
  });
  it("SPIN_HH 하드코딩이 남아 있지 않다", () => {
    expect(src).not.toMatch(/const\s+SPIN_HH/);
  });
});
```
> `spin-roulette`만 `spinTime.ts`를 쓰고 `respin-roulette`는 시간 가드가 없다(`respin-roulette/index.ts:1-8` 주석). `describe.each`로 묶되 `spinTime.ts` import 단언은 `spin` 쪽에만 건다.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `hour12: false`로 24시간제 지정 | `hourCycle: "h23"` 명시 | ECMA-402가 `hourCycle`을 도입한 이후 계속 권장. `hour12: false`는 로케일 기본 비-12 사이클(h23 **또는 h24**)에 위임 | Node 25.6.1/ICU 78.2에서는 둘 다 h23이라 **결과 동일**. 경화 목적 (todo IN-04) |
| Edge Function마다 헬퍼 복붙 | `supabase/functions/_shared/` | Supabase 공식 권장 구조 | 이 페이즈의 본론(QUAL-02) |
| `Phase` 3상태 + `resolvedPhase` 우회 변수 | 4상태 + `hasResult` 주입 | 이번 변경 | P1(후보 0개 잠금) 해소, SPIN-03 |
| `supabase/functions/**` 통째 tsc·eslint 제외 | 함수 디렉터리만 제외 | 이번 변경(D-12) | `_shared`가 정적 검사 대상으로 편입. CONVENTIONS.md 갱신 필요 |

**Deprecated/outdated:**
- `lib/phase.ts` 머리 주석의 `11:55:06 ~ decided` — 코드는 `11:55:05`부터다(todo IN-03). 재작성하며 정정.
- `lib/phase.ts` `msToNextPhase` — 참조 0건. 삭제.
- CLAUDE.md "추첨 시각 11:55는 **네 곳에 흩어져 있다**" — 이 페이즈 후 `lib/phase.ts`의 `SPIN_HH/MM`과 두 Edge Function의 상수가 사라지고 `_shared/spinTime.ts` 1곳 + UI 문구(Phase 6) + 마이그레이션 기본값으로 재편된다. **CLAUDE.md 갱신은 Phase 8(SHIP-03) 소관이지만, D-11이 "공용 훅은 `lib/useX.ts`" 컨벤션 한 줄 추가를 이 페이즈에 지정했다** — 두 항목을 함께 처리할지 계획에서 정할 것.
- CLAUDE.md "`kstNow()`는 두 Edge Function에 복붙돼 있다 (Deno라 `lib/time.ts` 공유 불가)" — 이 페이즈가 무효화한다(`_shared` 경유로 공유 가능).

## Project Constraints (from CLAUDE.md)

| 지시 | 이 페이즈에서 의미하는 것 |
|------|---------------------------|
| **AGENTS.md: "This is NOT the Next.js you know"** — 코드 작성 전 `node_modules/next/dist/docs/` 확인 | 이 페이즈는 Next API를 새로 쓰지 않는다(훅·순수 함수만). `"use client"` 지시자 위치 규약만 기존 파일 그대로 유지 |
| 전부 클라이언트 컴포넌트, 서버 컴포넌트·Route Handler·서버 액션 없음 | `lib/useSettings.ts`는 클라이언트 훅. 이를 쓰는 세 페이지는 이미 `"use client"` |
| inline style 객체 + CSS 변수, `~Action` 콜백 접미사 | `stalled` 문구 추가 시 기존 `s` 객체 스타일을 그대로 쓴다. 새 콜백 prop 없음 |
| **시간은 항상 `lib/time.ts` 경유**, `Date`의 로컬 메서드 금지 | `_shared/kst.ts`가 새 정의처가 되고 `lib/time.ts`가 그것을 재수출하므로 규칙은 유지된다. `cooldownWindowStart`의 `Date.UTC`/`getUTC*`는 **로컬 메서드가 아니다**(TZ 무관 산술, §Q8) |
| 컴포넌트는 named export, 파일명 = 컴포넌트명 | `lib/` 모듈은 소문자(CONVENTIONS.md). `lib/useSettings.ts`는 레포 첫 훅 파일 — D-11이 컨벤션 한 줄 추가를 지정 |
| 주석은 한글, Why만. 파일 머리에 역할·제약 블록 주석 | `_shared` 3파일 전부 머리 주석 필수(특히 "import 0개" 이유) |
| **Edge Function은 tsconfig·eslint에서 제외돼 타입체크·lint가 안 돈다 — 수정 후 직접 확인** | D-12가 `_shared`만 편입한다. 두 `index.ts`는 여전히 사각지대 → `edgeImports.test.ts` + 낭독 |
| `design/`·`supabase/functions/` 제외를 **풀지 말 것** (인덱서 OOM) | D-12는 `supabase/functions/`를 **부분** 해제한다. OOM 근거는 `design/`의 대형 JSX/PNG이고 `_shared`는 3파일·수백 줄 — 해당 없음. **CONVENTIONS.md 문장 정정 필요** |
| `interface` 금지, 전부 `type` alias | `SpinTime`·`Settings`·`KstParts` 전부 `type` |
| `any` 사용 0건. 불확실한 곳은 `as` 단언 | `payload.new as SettingsRow` |
| `npm run dev`는 가드런처로만 | 이 페이즈는 dev 서버 없이 전부 검증된다 |
| `.serena/project.yml` 커밋 금지 | 커밋 시 `--` 파일 지정으로 회피(기존 관행) |
| 커밋·PR에 AI 표기 금지 | Phase 2 검증에서 `grep -c 'Co-Authored-By\|Generated with'` = 0 확인된 상태 유지 |
| 라이브 DB·Edge Function·`main` 불변 (컷오버 전) | §Runtime State Inventory — 이 페이즈는 파일만 바꾼다 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `_shared/*.ts`가 **Deno 런타임에서** 실제로 컴파일·실행된다 (`deno check` 불가) | §Q2 | Edge Function 배포 시점(Phase 8)에 실패. 완화: 공식 `_shared` 패턴 준수 + `edgeImports.test.ts` + 순수 TS만 사용(Deno 전용 API 0개) + 낭독 리뷰 |
| A2 | 배포된 Supabase Edge Runtime의 Deno 버전이 `crypto.getRandomValues`를 전역으로 제공한다 | §Q2 | 현행 코드가 프로덕션에서 매일 쓰고 있어 위험 0에 가깝다 |
| A3 | PostgREST가 `settings.spin_time`(type `time`)을 `"HH:MM:SS"`로 직렬화한다 | §Pitfall 7 | 형태가 다르면 `parseSpinTime`이 `null` → 기본값 + warning으로 착지(설계상 안전 실패). 실제 형태는 Phase 8 컷오버에서 최초 확인 |
| A4 | 컷오버 전 개발 중 `settings` 조회가 `PGRST205`/404로 실패한다(테이블 부재) | §Q4-c | 다른 코드/메시지라도 `formatLoadError`가 `error.message`만 쓰므로 배너는 정상 동작. 문구만 달라진다 |
| A5 | `settings` 구독 실패가 다른 채널(`lunch-realtime`)에 영향을 주지 않는다 | §Q4-d, §Pattern 4 | 별도 채널을 쓰는 것이 이 가정의 완화책 자체다. 프로토콜 문서는 "채널을 닫지 않는다"고만 말한다 |
| A6 | `hasResult`를 log·rank 페이지에서 `results.some(r => r.date === todayKey)`로 파생해도 실용상 충분하다 | D-08 | log 페이지에서 다른 달을 보면 부정확 → 뱃지만 틀린다(기능 영향 0). CONTEXT가 Phase 7로 deferred |

## Open Questions

1. **Q-1: `applyCooldown` 반환형 — `T[]`(D-01) vs `{ picked, fellBack }`(Specific Ideas)**
   - 알고 있는 것: D-01 문면은 `T[]`, CONTEXT의 Specific Ideas는 Phase 4가 `cooldown_fallback: true`를 응답에 싣게 객체형을 제안한다.
   - 불확실한 것: 사용자가 Phase 4의 응답 JSON에 폴백 여부를 노출하길 원하는지.
   - 권고: **객체형으로 확정.** 나중에 바꾸면 `_shared` 계약 테스트 + Edge 본문을 두 번 고친다. 계획 문서에 "D-01 반환형을 객체로 조정"을 명시적으로 기록.

2. **Q-2: `kstParts` 반환에 `date`를 넣을 것인가 (Pitfall 3)**
   - 알고 있는 것: Edge Function이 `now.date`를 쓴다. `lib/time.test.ts:58`의 `toEqual`이 잉여 키를 거부한다(실측).
   - 불확실한 것: Phase 1이 만든 spec을 이 페이즈가 고쳐도 되는지 — D-13은 "그대로 통과"를 기대했다.
   - 권고: **(A) `date`를 넣고 spec 1줄 수정.** Phase 1 spec 머리 주석이 "Phase 3이 이 파일을 다시 쓰므로"라고 이미 적고 있어 취지에 어긋나지 않는다. 계획에 명시적 태스크로.

3. **Q-3: CLAUDE.md·CONVENTIONS.md 갱신을 이 페이즈에서 어디까지 할 것인가**
   - 알고 있는 것: D-11이 "공용 훅은 `lib/useX.ts`" 한 줄 추가를 이 페이즈에 지정했다. 동시에 이 페이즈는 CLAUDE.md의 "11:55 네 곳"·"`kstNow` 복붙"·CONVENTIONS.md의 "`globalIgnores` 풀지 말 것" 3개 진술을 낡게 만든다. 문서 현행화의 정본은 Phase 8(SHIP-03)이다.
   - 권고: **이 페이즈에서는 "낡아진 진술 3건"을 todo로 적어 Phase 8에 넘기고, D-11이 지정한 훅 컨벤션 한 줄만 추가**한다. 이유: 부분 갱신이 SHIP-03의 "매퍼가 찾은 낡은 진술 4건" 체크리스트와 어긋나면 Phase 8에서 중복 검증 비용이 든다. 사용자 확인 필요.

4. **Q-4: `secondsOfDay`의 소속 — `spinTime.ts`(D-01) vs `kst.ts`**
   - 알고 있는 것: 어느 쪽이든 import 0개를 지킬 수 있다(Pattern 1 또는 이동).
   - 권고: **D-01대로 `spinTime.ts`에 두고 인라인 구조 타입을 쓴다.** "시각 비교"라는 의미가 `spinTime` 쪽에 가깝고, `kst.ts`를 순수 변환기로 유지하면 책임이 선명하다. 재량 범위이므로 계획자가 정해도 무방.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체 | ✓ | v25.6.1 (ICU 78.2) | — |
| vitest | `_shared`·`lib` 테스트 | ✓ | 4.1.11 (정확 고정) | — |
| TypeScript (`tsc`) | 타입 게이트 + D-12 | ✓ | 5.9.3 | — |
| ESLint | lint 게이트 + D-12 | ✓ | 9.39.4 | — |
| Next.js (Turbopack) | `npm run build` 게이트 | ✓ | 16.3.5 (`.env.local` 존재) | — |
| **deno** | `deno check` — 두 `index.ts` 정적 검사 | **✗** | — | **`edgeImports.test.ts` 텍스트 계약 + 낭독 리뷰** (D-12). `_shared`는 vitest·tsc·eslint 3중 검사로 덮인다 |
| **supabase CLI** | Edge Function 배포 | **✗** | — | 필요 없음 — 이 페이즈는 배포하지 않는다(Phase 8) |
| 로컬 Supabase 스택 / psql | Realtime·PostgREST 실동작 확인 | **✗** | — | 공식 문서 인용 + `node_modules` 소스 확인으로 대체(§Q4). 실동작은 Phase 8 |
| Docker | (선택) Postgres 드라이런 | ✓ | 29.2.0 | 이 페이즈는 SQL을 안 다룸 — 불필요 |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:**
- `deno` — 두 `index.ts` 본문의 타입 정합성을 자동 검증할 수 없다. `_shared` 쪽은 tsc가 덮으므로 **이 페이즈에서 새로 생기는 사각지대는 "import 문 2줄이 Deno에서 해석되는가"뿐**이고, 그것이 공식 패턴과 문자 단위로 같음을 `edgeImports.test.ts`가 고정한다. Phase 4가 deno 설치 여부를 결정한다(CONTEXT deferred).

## Validation Architecture

> `.planning/config.json`의 `workflow.nyquist_validation: true` — 포함한다. `workflow.tdd_mode: true`이므로 각 모듈의 spec이 구현보다 먼저 RED로 선다(Phase 2의 02-02 방식).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.11 (정확 고정, `environment: "node"`, `globals: false`) |
| Config file | `vitest.config.mts` — **변경 불필요.** `include`에 `"supabase/functions/_shared/**/*.test.ts"`가 이미 있고(`:23`) extglob exclude와의 조합을 실측 확인했다(§Q5) |
| Quick run command | `npx vitest run supabase/functions/_shared lib` |
| Full suite command | `npm test` |
| Estimated runtime | `_shared`만 ~85ms · 전체 ~140ms (현재 89 tests / 5 files) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-02 | `kstParts`가 UTC 14:59:59/15:00:00, 연 경계, 자정 `00`, 요일을 정확히 분해 | unit | `npx vitest run supabase/functions/_shared/kst.test.ts` | ❌ Wave 0 |
| QUAL-02 | `pickRandom`이 배열 원소만 돌려준다 (분포 아님 — 멤버십) | unit | 〃 | ❌ Wave 0 |
| QUAL-02 | `kstNow` 정의가 레포 전체에 1곳 — 두 `index.ts`에 `function kstNow` 부재 | contract | `npx vitest run supabase/functions/_shared/edgeImports.test.ts` | ❌ Wave 0 |
| QUAL-02 | 두 `index.ts`가 `from "../_shared/kst.ts"`(확장자 포함)로 import | contract | 〃 | ❌ Wave 0 |
| QUAL-02 | `_shared`가 타입체크·린트 대상이다 | static | `npx tsc --noEmit && npx eslint` | ✅ (D-12 적용 후) |
| QUAL-02 | `_shared/*.ts`에 import 문 0개 (D-02) | contract | `edgeImports.test.ts`에 `expect(src).not.toMatch(/^import /m)` 3파일 추가 **권장** | ❌ Wave 0 |
| SPIN-02 | `cooldown_days = 0` → 필터 없음 | unit | `npx vitest run supabase/functions/_shared/cooldown.test.ts` | ❌ Wave 0 |
| SPIN-02 | 최근 N일 당첨 제외 후 후보 남음 | unit | 〃 | ❌ Wave 0 |
| SPIN-02 | 제외 결과 0개 → 전체 후보 폴백 (`fellBack: true`) | unit | 〃 | ❌ Wave 0 |
| SPIN-02 | `restaurant_id: null` 레거시 승자 무시 | unit | 〃 | ❌ Wave 0 |
| SPIN-02 | `cooldownWindowStart` 월·연·**윤년** 경계 + `days<=0 → null` | unit | 〃 | ❌ Wave 0 |
| SPIN-03 | 11:55:05에 결과가 없으면 `stalled`(≠ `decided`) | unit | `npx vitest run lib/phase.test.ts` | ⚠️ 재작성 |
| SPIN-03 | 경계 6종 × `hasResult=false`; `hasResult=true`면 어느 시각이든 `decided` | unit | 〃 | ⚠️ 재작성 |
| SPIN-03 | 사용자 지정 시각(12:30) 주입이 경계를 옮긴다 | unit | 〃 | ⚠️ 재작성 |
| SPIN-03 | `stalled`에서 `MenuList.readOnly === false` | unit(순수 파생) 또는 낭독 | `readOnly` 계산을 순수 헬퍼로 뽑으면 자동화 가능 — **권장** | ❌ Wave 0 |
| SETT-03 | 로드 전 `DEFAULT_SETTINGS`(11:55 · 0) | unit | `npx vitest run lib/settings.test.ts` | ❌ Wave 0 |
| SETT-03 | `failed(msg)` → 기본값 유지 + `error` 노출 | unit | 〃 | ❌ Wave 0 |
| SETT-03 | `loaded(null)`(시드 없음) → 기본값 + `loaded: true`, **error 없음** | unit | 〃 | ❌ Wave 0 |
| SETT-03 | 잘못된 `spin_time` → 기본 시각 + `warning` (throw 금지) | unit | 〃 | ❌ Wave 0 |
| SETT-02 | `changed("UPDATE", row)` 병합이 `spinTime`·`cooldownDays`를 갱신 | unit | 〃 | ❌ Wave 0 |
| SETT-02 | `changed("DELETE", null)` → 기본값 복귀 | unit | 〃 | ❌ Wave 0 |
| SETT-02 | `"11:55:00"` → `{hh:11, mm:55}` (PostgREST 직렬화 형태) | unit | `npx vitest run supabase/functions/_shared/spinTime.test.ts` | ❌ Wave 0 |
| (회귀) | `lib/time.ts` 재수출 후에도 기존 포맷 계약 유지 | unit | `npx vitest run lib/time.test.ts` | ⚠️ 1줄 수정 (Pitfall 3) |
| (회귀) | `rg -n 'hour12' lib supabase/functions/_shared` → 0건 (D-04) | contract/grep | `grep -rn hour12 lib supabase/functions/_shared \| wc -l` = 0 | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run supabase/functions/_shared lib` (~90ms) + 타입·경계를 건드렸으면 `npx tsc --noEmit`
- **Per wave merge:** `npm test` + `npx tsc --noEmit` + `npm run lint`
- **Phase gate:** `npx tsc --noEmit && npm run lint && npm test && npm run build` 전부 green + `npm audit` 0건 + `git status`에 `.serena/project.yml` 외 미의도 변경 0
- **Max feedback latency:** 10초 (`npm run build`는 페이즈 게이트 예외 — Phase 2 선례)

### Wave 0 Gaps

- [ ] **`tsconfig.json`·`eslint.config.mjs` 제외 좁히기 (D-12)** — **가장 먼저.** 이게 없으면 이후 모든 `_shared` 작업이 정적 검사 사각지대에서 진행된다(§Pitfall 4)
- [ ] `supabase/functions/_shared/kst.test.ts` — QUAL-02
- [ ] `supabase/functions/_shared/spinTime.test.ts` — QUAL-02 · SETT-02(파싱)
- [ ] `supabase/functions/_shared/cooldown.test.ts` — SPIN-02
- [ ] `supabase/functions/_shared/edgeImports.test.ts` — QUAL-02(복붙 제거·import 0개 계약)
- [ ] `lib/settings.test.ts` — SETT-02 · SETT-03
- [ ] `lib/phase.test.ts` 재작성 — SPIN-03
- [ ] `lib/time.test.ts:58-66` 기대 객체에 `date` 한 줄 (Pitfall 3, Q-2 결정에 따름)
- 프레임워크 설치 불필요 · `vitest.config.mts` 변경 불필요(§Q5) · 공용 픽스처 불필요

### Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 두 `index.ts` 본문이 Deno에서 컴파일된다 | QUAL-02 | `deno` 미설치 | 낭독: (1) import 2줄이 `../_shared/*.ts` 확장자 포함인가 (2) 제거한 로컬 함수의 잔여 호출이 없는가 (3) `SPIN_HH`/`SPIN_MM` 참조가 0인가 |
| `useSettings` 훅 본문 | SETT-02·SETT-03 | React 렌더 하네스 미도입(§Q7) | 낭독 3항목: (1) `error` → `failed` / `data ?? null` → `loaded` 분기 (2) 채널명이 `settings-changes`(기존 채널과 분리) (3) cleanup에 `removeChannel` |
| `stalled` 화면 문구 | SPIN-03 | `npm run dev` 금지(가드런처) | 문자열 단언으로 대체하거나 Phase 6 UI 검증에 위임 |

## Security Domain

> `security_enforcement` 설정 없음 = 활성으로 취급.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 익명 서비스가 설계 정체성(REQUIREMENTS Out of Scope) |
| V3 Session Management | no | 세션 없음 |
| V4 Access Control | **yes (간접)** | `settings`는 anon **select-only** — RLS 쓰기 정책 0건(`0005_…sql:100-101`). **이 페이즈가 앱에 `settings` 쓰기 경로를 만들지 않는 것**이 통제다. `useSettings`에 `insert/update/delete` 호출이 0건인지 확인 |
| V5 Input Validation | **yes** | `spin_time`은 사람이 대시보드에 넣은 문자열 + Realtime 페이로드다. `parseSpinTime`이 **총 함수**(throw 0, 범위 검증, 실패 시 null)여야 한다. `cooldown_days`도 읽는 쪽에서 `> 0` 좁히기 |
| V6 Cryptography | **yes** | `crypto.getRandomValues` 유지. `Math.random()`으로 바꾸지 않는다(추첨 공정성 + `react-hooks/purity` 린트) |
| V7 Error Handling & Logging | **yes** | `formatLoadError`가 `error.message`만 쓰고 `details`·`hint`는 버린다 — 후자에 SQL 조각·테이블/컬럼명이 실린다(`lib/errors.ts:5` 주석). `settings` 에러도 같은 경로를 탄다 |

### Known Threat Patterns for 익명 anon key + Supabase Realtime + 단일 설정 행

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 잘못된 `spin_time`(오타·형식 오류) 하나가 세 페이지를 흰 화면으로 만든다 | Denial of Service | `parseSpinTime` 총 함수 + `DEFAULT_SETTINGS` 착지 + warning 노출 (D-10) |
| 대시보드에서 `settings` 행을 지웠는데 `payload.old`가 PK만 와서 앱이 상태를 복구 못 한다 | DoS | `DELETE` → 기본값 복귀 (D-10). 복구 정보가 필요 없는 설계 |
| 앱 코드에 `settings` 쓰기 경로가 생기면 누구나 추첨 시각을 바꾼다 | Tampering / Elevation | RLS에 쓰기 정책 0건(기본 거부). 앱 계층에도 쓰기 호출을 만들지 않는다 |
| 에러 배너로 스키마 정보가 샌다 | Information Disclosure | `error.message`만 사용. **단, `PGRST205` 메시지는 `public.settings`라는 테이블명을 포함한다** — 익명 개방 서비스이고 스키마가 공개 레포에 있어 수용 가능(기존 결정과 동일) |
| `Math.random()`으로 교체돼 추첨이 예측 가능해진다 | Tampering | `_shared/kst.ts` 주석에 근거 명시 + `pickRandom` 테스트 유지 |
| 기록 복붙 제거 과정에서 `respin-roulette`의 OPTIONS 단락이 사라져 프리플라이트가 재추첨을 실행 | Tampering | D-06은 **import 교체만**. `respin-roulette/index.ts:63-67`의 OPTIONS 분기를 건드리지 않는다 — 낭독 체크리스트 항목 |

## Sources

### Primary (HIGH confidence)

**로컬 실행(이 레포·이 머신에서 직접 확인한 것):**
- `npx tsc --noEmit` × 4 (현재 tsconfig / 좁힌 tsconfig / `.ts` 확장자 / 스크래치 복제) — `exclude` 루트 집합 동작, `TS5097`
- `npm run build` × 3 (무확장 / `.ts` 확장자 / 복원) — Turbopack 해석 + Next 16 타입체크 단계
- `npx vitest list --filesOnly` · `npx vitest run …` × 5 — 수집 경계, `_shared` 실행, `toEqual` 잉여 키, `import type` 소거, 값 import 실패
- `npx eslint --config … -f json` × 3 — `globalIgnores` 좁히기, `vitest` import 무탈, 함수 디렉터리 여전히 무시
- `node` × 5 — `hourCycle` 표, 포맷 문자열 동등성, `Date.UTC` 경계 7케이스 × TZ 3종, 로케일 동등성 1500일, 요일 산술
- `node_modules/@supabase/postgrest-js/dist/index.mjs` `processResponse` — `maybeSingle` 0행 거동 (supabase-js 2.106.0)
- 레포 파일 전수: `lib/*.ts` · `app/**` · `components/**` · `supabase/functions/**` · `supabase/migrations/0005_*.sql` · 4개 설정 파일

**공식 문서:**
- https://docs.deno.com/runtime/fundamentals/modules/ — 확장자 필수 규칙 (직접 인용)
- https://supabase.com/docs/guides/functions/development-environment — `_shared` 권장 구조
- https://supabase.com/docs/guides/functions/recursive-functions · /functions/cors — `../_shared/x.ts` import 패턴
- https://supabase.com/docs/guides/realtime/protocol — `record`/`old_record` 예시, postgres_changes 구독 에러 표(5~10초 재시도)
- https://supabase.com/docs/guides/realtime/postgres-changes — replica identity full, DELETE 필터 제약
- https://postgrest.org/en/v13/references/errors.html — `PGRST205` 404, `42P01` 404

### Secondary (MEDIUM confidence)
- https://supabase.com/docs/guides/troubleshooting/resolving-42p01-relation-does-not-exist-error-W4_9-V — `42P01` 메시지 형태
- https://supabase.com/docs/guides/troubleshooting/postgrest-not-recognizing-objects-in-schema — "Could not find the table 'X' in the schema cache" 문구
- https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting — publication 미등록 진단, useEffect cleanup

### Tertiary (LOW confidence)
- 없음. 이 문서의 모든 판정은 로컬 실행 또는 공식 문서 인용을 근거로 한다.

## Metadata

**Confidence breakdown:**
- 모듈 경계(tsc·Deno·Turbopack·vitest·eslint): **HIGH** — 5개 도구에서 양쪽 방향을 전부 실행해 확인. 유일한 미검증은 Deno 런타임 자체(A1, `deno` 미설치)
- `Intl`/날짜 산술: **HIGH** — Node 25.6.1에서 표로 실측, TZ 3종 교차 검증
- Realtime 페이로드·PostgREST: **HIGH** — 페이로드는 공식 프로토콜 문서 인용, `maybeSingle`은 설치본 소스 직접 확인. 실동작 검증은 Phase 8
- 기존 코드 영향 분석(`Phase` 소비처 9곳, `toEqual` 충돌): **HIGH** — 전수 grep + 실행 확인
- 설정 훅 설계: **MEDIUM** — 구독 실패 격리(A5)와 `spin_time` 직렬화 형태(A3)는 컷오버 전 검증 불가

**Research date:** 2026-09-21
**Valid until:** 2026-10-21 (30일 — 스택이 정확 버전 고정이고 외부 의존이 없어 안정적). 단 `@supabase/supabase-js`를 범프하면 §Q4-b(`maybeSingle` 내부 동작)를 재확인할 것.
