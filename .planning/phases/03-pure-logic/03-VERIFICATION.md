---
phase: 03-pure-logic
verified: 2026-09-21T05:58:00Z
status: passed
score: 26/26 must-haves verified
overrides_applied: 0
deferred:
  - truth: "SPIN-02 런타임 — cooldown_days > 0 이면 최근 N일 당첨 매장이 실제 추첨에서 제외되고, 제외 후 비면 전체 후보로 폴백한다 (applyCooldown 호출처 배선)"
    addressed_in: "Phase 4"
    evidence: "ROADMAP Phase 4 Goal '두 Edge Function이 새 스키마·settings·쿨다운 위에서 결과를 확정하도록 재작성한다'. 03-CONTEXT D-05 'DB 조회는 Phase 4 가 한다', D-06 'Edge Function 은 import 교체만'. 순수 필터 자체는 이 페이즈에서 완성·고정됨(SC2)"
  - truth: "SETT-02 브라우저 실증 — 탭 전환(/ → /log → /rank) 뒤에도 대시보드 settings 편집이 새로고침 없이 반영된다 (WR-01 per-instance topic 수정의 실증)"
    addressed_in: "Phase 6 · Phase 8"
    evidence: "라이브에 settings 테이블이 없어(0005 적용은 Phase 8) 지금은 어느 브라우저에서도 이 경로를 밟을 수 없다. Phase 6 Goal '화면의 추첨 시각 문구가 전부 settings를 따른다' 의 UI 검증과 Phase 8 컷오버 검증이 실증 시점. 구성상 보장은 lib/useSettings.ts:34,51 로 기계 확인"
  - truth: "화면 문구의 하드코딩 11:55 제거 (components/MenuList.tsx:77,166 · ResultBlock.tsx:13 기본 prop · PhaseTimeline.tsx:9-11 · app/page.tsx:375-376)"
    addressed_in: "Phase 6"
    evidence: "ROADMAP Phase 6 Requirements SPIN-06. 03-CONTEXT '하지 않는 것: 화면 문구의 11:55 제거(Phase 6, SPIN-06)'. 코드 상수(SPIN_HH/MM 3벌)는 이 페이즈에서 0건이 됐다"
  - truth: "app/log 의 hasResult 파생이 보는 달·다음 달 밖에서 부정확할 수 있다 — 오늘 결과 별도 조회"
    addressed_in: "Phase 7"
    evidence: "03-CONTEXT D-08 'Phase 7이 두 페이지를 다시 쓸 때 오늘 결과 조회 추가'. app/log/page.tsx:36-39 한글 Why 주석이 한계를 정확히 기록(d36caf8 에서 2개월 창으로 정정됨)"
  - truth: "useSettings 의 분기 2개(에러/0행, DELETE/그 외)를 리듀서 action 으로 내려 spec 으로 고정 (IN-03) · settings.loaded 로 첫 페인트의 stalled 라벨 가리기 (IN-02)"
    addressed_in: "Phase 6"
    evidence: ".planning/todos/pending/in-03-usesettings-branches-to-reducer.md · in-02-settings-loaded-first-paint.md (둘 다 resolves_phase: 6, d36caf8 에서 적재 확인)"
  - truth: "PROJECT.md:81 / CLAUDE.md:83 (GSD project 블록의 Constraints) 의 'tsc/eslint는 supabase/functions/** 제외 유지' 진술이 D-12 이후 낡았다"
    addressed_in: "Phase 8"
    evidence: "ROADMAP Phase 8 Goal '문서를 현행화하고' (SHIP-03). D-16 이 열거한 CLAUDE.md 7건+1건 · CONVENTIONS.md 8줄에는 없던 항목이라 03-03 truth 자체는 충족. 한 줄 수정이므로 Phase 8 전에 quick task 로 닫아도 무방"
  - truth: "두 index.ts 의 Deno 컴파일 실증 (deno check)"
    addressed_in: "Phase 4 · Phase 8"
    evidence: "03-CONTEXT deferred 'deno check 로컬 실행 환경 — Phase 4 계획 시 결정'. 배포는 Phase 8. 지금은 edgeImports.test.ts 24건 + 낭독 + git diff(본문 hunk 0건)로 대체"
---

# Phase 3: 순수 로직 Verification Report

**Phase Goal:** 추첨 시각 판정·쿨다운 필터·KST 변환을 주입 가능한 순수 함수 한 곳으로 모으고, 테스트로 계약을 고정한다. 하드코딩 상수와 복붙을 이 페이즈에서 끝낸다.
**Verified:** 2026-09-21T05:58:00Z
**Status:** passed
**Re-verification:** No — initial verification

검증 원칙: SUMMARY 세 편의 서술은 증거로 쓰지 않았다(03-03-SUMMARY 는 리뷰 수정 이후 두 곳이 낡아 있음을 먼저 확인했다 — `.channel("settings-changes")` 인용과 CONVENTIONS 채널 규칙 "불완전" 문단, 둘 다 `0cd4fb2` 로 바뀐 트리가 정본). 소스 26파일·spec 10파일·설정 3파일·문서 3파일을 직접 읽고, 게이트 명령 전부를 이 프로세스에서 재실행했으며, 테스트가 실제로 무는지는 프로젝트 트리를 건드리지 않는 **스크래치패드 사본**(rsync + `node_modules` 심링크, git worktree 아님)에서 변이 20종으로 확인했다. `_shared` 세 모듈은 Deno·번들러 없이 Node 25 ESM 에서 직접 import 해 30건 프로브를 돌렸다. `deno` 는 없어 두 `index.ts` 는 `git diff`(본문 hunk 0건) + 계약 테스트 + 낭독으로 판정했다. 트리 수정 0건, 임시 파일 잔존 0건, 커밋 0건(`git status` 가 시작 시점과 동일: `.planning/config.json`·`.serena/project.yml` 2건 M 뿐).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 4 + PLAN 세부 truths 병합·중복 제거 = 26)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | **[SC1]** `_shared/kst.ts`(`kstNow`·`pickRandom`)·`spinTime.ts`(`"HH:MM"` 파싱·시각 경과 판정)·`cooldown.ts` 가 Deno 전용 import 없이 존재하고 vitest 가 직접 import 해 테스트한다. `kstNow` 정의가 레포 전체에 1곳 | ✓ VERIFIED | `kst.ts` 75줄(`kstParts` :32 · `kstNow` :63 · `pickRandom` :71), `spinTime.ts` 41줄(`SPIN_TIME_RE` :15 · `parseSpinTime` :20 · `secondsOfDay` :34 · `isAfterSpinTime` :39), `cooldown.ts` 48줄(`cooldownWindowStart` :12 · `applyCooldown` :32). 세 파일 `^import` 0건, `Deno`/`jsr:`/`npm:` 토큰은 주석에만. vitest 직접 import: `kst.test.ts:9 from "./kst"` · `spinTime.test.ts:15` · `cooldown.test.ts:8` → 9+15+14 = 38건 통과. `grep -rn 'function kstNow' --include='*.ts' --exclude='*.test.ts'`(node_modules·.next·design 제외) → **정확히 1건** `_shared/kst.ts:63`; 두 `index.ts` 는 `:12`/`:22` 에서 import 만. Node 25 ESM 직접 import 프로브 30/30 PASS(Deno 전역 의존 없음의 실증) |
| 2 | **[SC2]** 쿨다운 필터 테스트가 세 경로를 덮고 통과: `cooldown_days = 0`(필터 없음) / 제외 후 후보 남음 / 제외하면 0개라 전체 폴백 | ✓ VERIFIED | `cooldown.test.ts` #1(:11-13) `cooldownWindowStart(…, 0) → null` + #7(:51-56) 최근 승자 없음 → 후보 그대로 — D-05 설계상 창 계산과 필터가 분리돼 있어 "days=0 경로" 는 이 두 단언이 함께 덮는다(Phase 4 가 `null` 창이면 조회를 건너뛰고 `[]` 를 넘긴다) / #8(:58-63) `["r1"]` 제외 후 `[r2]` 남음 `fellBack:false` / #9(:65-70) 전멸 → `{ picked: [r1], fellBack: true }`. 변이 M4(폴백 제거) → #9 실패, M5(`days<=0` 가드 제거) → #1·#2 실패 |
| 3 | **[SC3]** `lib/phase.ts` 가 추첨 시각을 인자로 주입받고 "결과 행이 없는데 시각은 지났다" 를 `decided` 가 아닌 별도 상태로 판정 — 경계값(직전·정각·애니메이션 종료 후) 테스트 통과 | ✓ VERIFIED | `lib/phase.ts:22` `currentPhase(now: Date, spinTime: SpinTime, hasResult: boolean)` **기본 인자 없음**, `:16` `Phase` 4상태, `:23` `hasResult → "decided"`, `:29` `return "stalled"`. `lib/phase.test.ts` 16건: 직전 11:54:59 → accepting(:18), 정각 11:55:00 → spinning(:22), 11:55:04 → spinning(:26), 애니메이션 종료 11:55:05 → **stalled**(:30), 23:59:59 → stalled(:34), 자정 직후(:14), `hasResult=true` 3시각 전부 decided(:39-51), 12:30 주입 3경계(:53-65). 변이 M2(`stalled`→`decided`) 3건 실패, M3(`hasResult` 무시) 3건 실패 |
| 4 | **[SC4]** 설정 로딩 헬퍼가 로드 전·실패 시 기본값(11:55, 쿨다운 0)을 돌려주고, `settings` UPDATE 이벤트를 상태에 병합하는 순수 리듀서에 테스트가 있다 | ✓ VERIFIED | `lib/settings.ts:28-32` `DEFAULT_SETTINGS = { spinTime: DEFAULT_SPIN_TIME(11:55), cooldownDays: 0, historySince: null }`, `:43-48` `INITIAL_SETTINGS_STATE` (`loaded: false`), `:87-92` `failed` → 기본값 + `error`, `:93-103` `changed` UPDATE/INSERT → `settingsFromRow` 통째 교체, DELETE → 기본값. `lib/settings.test.ts` 28건(기본값 4 · `settingsFromRow` 9 · 로드 5 · Realtime 병합 7 · 순서 뒤집힘 3). 변이 M10(`failed` 가 error 숨김) 1건, M11(UPDATE 무시) 6건, M13(DELETE 유지) 3건, M20(IN-01 가드 제거) 2건 실패 |
| 5 | **[03-01 D-12]** `_shared/` 가 tsc·eslint 검사 대상. 제외는 함수 디렉터리 2개뿐, `design/**` 유지. Wave 0 첫 커밋 | ✓ VERIFIED | `tsconfig.json:33` `exclude: ["node_modules", "supabase/functions/spin-roulette/**", "supabase/functions/respin-roulette/**", "design/**"]`, `eslint.config.mjs:16-20` 동일 4항목. `d80aa7e`(chore) 가 `dc31939`(RED) 의 조상(`git merge-base --is-ancestor` 성립). `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 를 HEAD 에서 재실행. `vitest.config.mts` 이 페이즈 diff 0줄 |
| 6 | **[03-01 D-02·D-17]** `_shared/*.ts` 세 파일 import 0건, 서로도 안 끌어옴, `spinTime.ts` 는 로컬 `TimeParts` | ✓ VERIFIED | `grep '^import\|^export .* from'` 세 파일 0건. `spinTime.ts:31` `type TimeParts = { hour; minute; second }` 로컬 선언, `isAfterSpinTime(kstParts(…), …)` 구조적 대입을 프로브로 실증. `edgeImports.test.ts` #4-#6 이 회귀 장치 — 변이 M16(`import type … "./kst"`)·M17(`"./kst.ts"`) 둘 다 #5 에서 실패. ℹ️ D-18 의 "TS5097 이 컴파일러 수준에서 강제" 는 **값 import 에만** 참(tsc 5.9.3 프로브: `import type … "./a.ts"` 는 exit 0, 값 import 만 TS5097) — 실효 게이트는 계약 테스트이고 그것이 잡는다 |
| 7 | **[03-01·03-02 D-04 / todo IN-04]** `hour12` 0건, `hourCycle: "h23"` 을 `_shared/kst.ts` 와 `lib/time.ts` 포맷터 2개가 쓴다. 둘을 같이 적지 않는다. `lib/time.test.ts` 문자열 단언 9개 무변경 통과 | ✓ VERIFIED | `grep hour12 lib supabase/functions --exclude='*.test.ts'` → 0. `hourCycle` 3건: `kst.ts:45`, `lib/time.ts:30`, `:39`. `lib/time.test.ts` 13건 통과, 이 페이즈 diff `+2/-0`(`date` 1줄 + 주석 1줄). 변이 M9(`hourCycle` 제거) → 자정 `hour` 단언 2건 실패(`kst.test.ts` #3, `time.test.ts` 자정 보정) |
| 8 | **[03-01 D-05]** 쿨다운 창 `[today − N, today − 1]` 달력 일수, 오늘 제외, 매칭 키 `restaurant_id` 만, `null` 무시, `days <= 0` → `null` | ✓ VERIFIED | `cooldown.ts:16` `!Number.isInteger(days) \|\| days <= 0 → null`, `:20` `Date.UTC(y, mo-1, d-days)` + `getUTC*`, `:41` `if (id) blocked.add(id)`. spec #2 음수, #3 평년 2/28, #4 윤년 2/29, #5 연 경계, #6 7일 창 `2026-09-14`(오늘 9/21 제외 = 14~20), #10 `[null]` 무시, #6a-#6c 오염 입력(IN-04 수정 `8941ee9`). 프로브 6건 일치 |
| 9 | **[03-01 D-06]** 두 Edge Function 은 import 교체만. 복붙(`kstNow`·`pickRandom`·`isAfterSpinTime`·`SPIN_HH/MM`·로컬 `KstParts`) 삭제, `../_shared/*.ts` 확장자 포함 import. 본문(`Deno.serve`·`23505`·CORS·OPTIONS·`menus` 조회) 무변경 | ✓ VERIFIED | `git diff 68eedb8..HEAD` — `spin-roulette/index.ts` hunk 1개(`@@ -5,50 +5,18`): 주석 1줄 + import 2줄 추가(`:12-13`), 복붙 5덩어리 삭제, 호출부 `isAfterSpinTime(now, DEFAULT_SPIN_TIME)`(`:19`) 1줄. `respin-roulette/index.ts` hunk 2개: import 1줄(`:22`)+주석 2줄, 복붙 삭제. `Deno.serve`·`23505`(`:76`)·`corsHeaders`·`OPTIONS`(`:40-42`)·`from("menus")` 구간에 hunk 없음. `edgeImports.test.ts` #7-#22 + #7a·#16a 24/24. 변이 M14(로컬 `kstNow` 재삽입) #9 실패, M15(확장자 제거) #7 실패 |
| 10 | **[03-01 QUAL-02]** `edgeImports.test.ts` 가 두 `index.ts` 와 `_shared/*.ts` 를 텍스트로 파싱해 "`kstNow` 1곳" 을 자동 회귀 장치로 고정 | ✓ VERIFIED | 164줄, `readOrEmpty(new URL("../spin-roulette/index.ts", import.meta.url))`(`:42-43`), 주석 제거 사본에서 개수 단언(`:45-49`), `IMPORT_LINE = /^\s*import\s/gm`(`:52`). IN-05 수정 `e33efa8` 로 `#7a`·`#16a` 진입점 단언 추가(파일 이동 시 빈 문자열 공허 통과 차단). 24건 통과 |
| 11 | **[03-01 D-13·D-18]** `_shared` spec 3개가 경계를 덮는다: KST UTC 14:59:59/15:00:00·자정 `00`·연 경계·요일 / `"11:55"`·`"11:55:00"`·`"09:05:30"`·소수 초 허용, `"25:00"`·`"11:60"`·`""`·`"1155"` → `null` / 월·연·윤년 경계 | ✓ VERIFIED | `kst.test.ts` #1-#6(:12-44) 정확히 그 경계 + #6 `toEqual` 리터럴 8필드. `spinTime.test.ts` #1-#8(:18-48) 8입력 전부 + #15 12:30 주입. `cooldown.test.ts` #3-#5 월·윤년·연. 프로브에서 `" 11:55"`(선행 공백)·`"24:00"` 도 `null` 확인. 변이 M7(`hh>23` 허용) #5 실패, M8(`>=`→`>`) #13 실패 |
| 12 | **[03-01 D-18]** `pickRandom([])` 전제조건이 한글 Why 주석으로 남고 throw 로 바꾸지 않았다 | ✓ VERIFIED | `kst.ts:68-70` 주석 "전제조건: arr.length > 0 … 예외를 던지는 형태로 바꾸지 않는다", 본문 `:71-75` 4줄이 원문(`git diff` 삭제 블록)과 동일. `throw` 0건 |
| 13 | **[03-02 D-03·D-15]** `lib/time.ts` 가 `kstParts` 본체를 버리고 `_shared/kst` 를 재수출(값·타입 분리), 포맷터 4개 시그니처·동작 무변경, `time.test.ts` 기대 객체에 `date` 1줄 | ✓ VERIFIED | `lib/time.ts:6` `import { kstParts } from "@/supabase/functions/_shared/kst"`, `:10` `export { kstParts }`, `:11` `export type { KstParts } from …`. 포맷터 4개 `now: Date = new Date()` 유지(`:22,:27,:34,:44`). IN-06 수정 `63f9ea5` 로 `todayKstDate` 가 `kstParts(now).date`(`:23`) — 쓰기(Edge `kstNow().date`)와 읽기가 같은 코드 경로. `time.test.ts:60` `date: "2026-09-18"`. 변이 M18(date 구분자 `/`) → time 4건 + kst 4건 = 8건 실패(양쪽 spec 이 같은 키를 문다) |
| 14 | **[03-02 D-07 / todo IN-03]** `Phase` 4상태, 기본 인자 없는 3인자 시그니처, `hasResult` 면 시각 무관 `decided`, 머리 주석 `11:55:06` → `11:55:05` 정정, `msToNextPhase` 삭제 | ✓ VERIFIED | `lib/phase.ts:6` "11:55:05 ~ 23:59:59 인데 결과가 없다 → stalled", `grep -c 11:55:06` 0 / `11:55:05` 1. `msToNextPhase` 구현 코드(`lib app components`, spec 제외) 0건 — `lib/phase.test.ts:8` 머리 주석 1건은 "안 하기로 한 것" 기록. `SPIN_HH`/`SPIN_MM` 소스 전수 0건 |
| 15 | **[03-02 SPIN-03]** 추첨 시각이 지났는데 결과 행이 없으면 `stalled`, `isCandidateListLocked("stalled") === false` 라 후보 목록이 잠기지 않는다 (P1 해소) | ✓ VERIFIED | `lib/phase.ts:33-51` `switch` 4분기 + `never`, `stalled → false`(`:41-44`). `components/MenuList.tsx:13` 값 import, `:52` `readOnly = isCandidateListLocked(phase)` — 입력 `disabled={readOnly}`(`:93`)·추가 버튼(`:102`)·삭제 버튼(`:149`) 전부 이 값을 본다. spec #13-#16. 변이 M1(`stalled → true`) 1건 실패 |
| 16 | **[03-02 D-18·D-09]** 유니온 확장 + 소비처 9곳 갱신이 같은 커밋(`0a71b10`), `switch`+`never` 3곳, `ResultBlock` 죽은 분기 없음, `resolvedPhase` 제거, `wheelPhase` stalled→idle, log·rank `hasResult` 파생 | ✓ VERIFIED | `git show --stat 0a71b10` = 9파일 1커밋. 소비처 전수(`grep -rn 'phase ===\|: Phase\|switch (phase)'` app components lib): `MenuList:52`(헬퍼) · `TopBar:18-33`(switch, `stalled → "추첨 대기"/live`) · `PhaseTimeline:18`(`stalled → accepting` idx 0) · `ResultBlock:107`(`phase === "stalled"`, `decided && !winner` 0건) · `app/page.tsx:316-333 StageHeader`(switch, "추첨 대기중") · `:365-371 phaseHeadline` · `:373-382 phaseSubhead` · `:156-162 wheelPhase`(`"idle"`, 주석 명시) · `:282` respin 버튼 `phase === "decided" && todayResult`. `: never` 가드: `lib/phase.ts:47`·`TopBar.tsx:30`·`app/page.tsx:329`(+`lib/settings.ts:107`). `resolvedPhase` 0건. `app/log/page.tsx:40` `results.some(r => r.date === todayKey)`, `app/rank/page.tsx:29` 동일. `Wheel.tsx` 는 별개 `WheelPhase` 유니온이라 소비처 아님(diff 0줄). RESEARCH §Pitfall 1 표 9행과 1:1 |
| 17 | **[03-02]** todo `in-03-04-phase-time-notes.md` 삭제 | ✓ VERIFIED | `test -f` exit 1, `git diff --stat 68eedb8..HEAD` 에 `-7` 삭제 기록 |
| 18 | **[03-03 SETT-03 / D-10 / W-10]** 로드 전·실패·행 없음 어느 경우에도 `DEFAULT_SETTINGS` 로 동작. `settingsFromRow` 는 던지지 않는 총 함수, 파싱 실패는 기본 시각 + `warning`. `SettingsState` 4필드(`error` 로드 실패 전용 / `warning` 파싱 경고 전용) | ✓ VERIFIED | `lib/settings.ts:34-41` 4필드 타입, `:55-73` `settingsFromRow`(`throw` 0건, `parsed ?? DEFAULT`, `warning` 문장은 `DEFAULT_SPIN_TIME_TEXT` 로 조립 — 새 하드코딩 없음), `:62` 음수·NaN 클램프, `:66` `history_since ?? null`(IN-04). spec: 잘못된 행 → `{ spinTime 11:55, error: null, hasWarning: true }`(`:127-134`), `failed` 후 `warning: null`(`:113-120`), 정상 행이 `warning` 지움(`:159-162`). 변이 M12(경고 삼킴) 2건, M19(음수 미클램프) 1건 실패 |
| 19 | **[03-03 D-18 §Pitfall 5]** `maybeSingle()` 0행(`data: null, error: null`)과 테이블 부재(`PGRST205`)를 다른 action 으로 가른다. `error` 먼저 → `failed`, 아니면 `loaded(data ?? null)`. `loaded(null)` 은 배너 없음 | ✓ VERIFIED | `lib/useSettings.ts:39-42` `if (error) dispatch(failed) else dispatch(loaded, row ?? null)` 그 순서. 리듀서 `:83` `!action.row → DEFAULT + error: null`. spec `loaded(null)`(`:104-111`) `error: null`. (이 훅 분기 자체는 렌더 하네스 부재로 낭독 — IN-03 이월, Phase 6) |
| 20 | **[03-03 SETT-02 / D-11 / WR-01]** `postgres_changes` `*` 이벤트가 리듀서로 들어가 `payload.new` 통째 교체, DELETE 는 기본값 복귀. 채널은 `lunch-realtime` 과 분리, 언마운트 시 `removeChannel`, **토픽은 구독 인스턴스마다 유일** | ✓ VERIFIED | `lib/useSettings.ts:28` `let topicSeq = 0`, `:34` `useState(() => \`settings-changes-${++topicSeq}\`)`, `:51` `.channel(topic)`, `:52-65` `.on("postgres_changes", { event: "*", schema: "public", table: "settings" })` → `dispatch(changed, row: DELETE ? null : payload.new)`, `:66-68` `removeChannel(ch)`, effect dep `[topic]`. `grep -c 'channel("settings-changes")'` → 0(WR-01 회귀 게이트). `app/page.tsx:91` `lunch-realtime` 바인딩 6개 무변경(`actionError` 3건·채널 1건). `settings` 는 `0005:106` publication 배열 + `:99` `settings_read` select 정책에 있어 anon Realtime 수신 조건 충족. 리듀서 `:97-103`. IN-01 수정 `57b61fd`: `loaded`/`failed` 가 `state.loaded` 를 읽어 늦게 온 초기 조회를 버린다(spec 3건, 변이 M20 2건 실패) |
| 21 | **[03-03 D-18 §Q7]** `lib/settings.ts` 는 `lib/supabase/client.ts` 에서 `import type` 문장만. 환경변수 없이 리듀서 테스트 가능 | ✓ VERIFIED | `lib/settings.ts:12` `import type { SettingsRow } from "@/lib/supabase/client"` (인라인 modifier 0). `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npx vitest run` → 10파일 189건 통과, `supabaseUrl is required` 0건. spec 은 행 타입도 import 하지 않고 리터럴 픽스처(`:24-31`) |
| 22 | **[03-03 D-11]** 세 페이지가 `useSettings()` 를 쓰고 `currentPhase(now, settings.spinTime, hasResult)` 로 주입. 03-02 의 `DEFAULT_SPIN_TIME` 임시 참조 0건 | ✓ VERIFIED | `useSettings()` 호출 3건: `app/page.tsx:44`·`app/log/page.tsx:34`·`app/rank/page.tsx:26`. `currentPhase(now, settings.spinTime, …)` 3건: `:47`·`:40`·`:29`. `grep -rn DEFAULT_SPIN_TIME app` → 0. `currentPhase(now)` 1인자 호출 0건 |
| 23 | **[03-03 D-11 / Phase 1 배너 설계]** 설정 로드 실패는 `joinLoadErrors` 로 라벨 `"설정"` 합류, 파싱 경고는 접두 없이 3번째 원소, `actionError` 와 절대 합치지 않음, log·rank 는 `joinLoadErrors` 로 승격 | ✓ VERIFIED | `app/page.tsx:240-244` `joinLoadErrors([loadError, formatLoadError("설정", settingsError ? { message } : null), settingsWarning])` → `:267 <ErrorBanner message={loadBanner}>`; `:268` `actionError` 배너 별도·무변경; `:62-68` 초기 3쿼리 `setLoadError` 블록 무변경. `app/log/page.tsx:105-109`·`:116`, `app/rank/page.tsx:75-79`·`:85` 동일 3원소. `formatLoadError("설정"` 3건, `settingsWarning` 6건 |
| 24 | **[03-03 V4 통제]** 앱 계층에 `settings` 쓰기 경로 0건 | ✓ VERIFIED | `grep -cE '\.(insert\|update\|delete\|upsert)\(' lib/useSettings.ts` → 0. 훅의 supabase 호출은 `select`(`:39`)·`channel`/`subscribe`(`:51,:65`)·`removeChannel`(`:67`) 뿐. `app/**` 에 `from("settings")` 0건 |
| 25 | **[03-03 D-16]** CLAUDE.md 7건 정정 + 1건 추가, CONVENTIONS.md 8줄 정정이 코드와 같은 페이즈에서 끝났고, 정정 문면이 코드와 일치한다 | ✓ VERIFIED | **디스크의 CLAUDE.md**(세션 컨텍스트 스냅샷은 낡은 사본이라 파일을 다시 읽음): `:12` `stalled` 설명, `:13` `lib/settings.ts`·`useSettings`(IN-07 정정: "값 import 는 `_shared/spinTime` 뿐", `settings-changes-<n>`), `:14` `_shared/` 계약은 세 모듈·spec 예외(IN-07), `:29` vitest 4경로(= `vitest.config.mts:19-26`), `:38` 훅 컨벤션(IN-07: "소문자 명사 관례의 유일한 예외"), `:41` 제외 2디렉터리 + 3중 검사(= `tsconfig.json:33`·`eslint.config.mjs:19-20`), `:46` 함수 2개만 제외, `:47` `DEFAULT_SPIN_TIME` 정의처 1곳 + 남은 2갈래, `:48` `kstNow`·`kstParts` 1곳, `:66` 미사용 코드에서 `msToNextPhase` 제거(`onSpinCompleteAction` 참조 0 확인). 게이트: `네 곳에 흩어져 있다` 0 · `msToNextPhase` 0 · `복붙돼 있다` 0 · `타입체크·lint가 안 돈다` 0. CONVENTIONS.md `:13-14`(훅 예외) · `:26`(`DEFAULT_SPIN_TIME`/`DEFAULT_SETTINGS`) · `:35`(`Phase` 4상태) · `:51`(eslint 근거 분리) · `:55`(tsconfig, `TS5097`) · `:71`(상대 경로 예외 3종) · `:146`(기본 인자 예외 2곳) · `:149`(11:55 정의처 1곳 + 남은 2갈래) · `:164`(WR-01: "구독 인스턴스마다 고유", `settings-changes-<n>`). 각 진술을 코드 라인과 대조해 참 |
| 26 | **[03-03 D-13]** `lib/settings.test.ts` 가 초기 기본값 · `loaded(row)` 파싱(`"11:55:00"` → 11:55) · 잘못된 `spin_time` → 기본 + `warning` · `failed` → 기본 + `error` · `changed UPDATE` 병합 · 정상 행이 `warning` 지움 · `DELETE` 복귀 · `loaded(null)` 을 덮는다 | ✓ VERIFIED | 28건(계획 24 + IN-01 3 + IN-04 1 재조준 포함). 각 경로의 `it` 위치: `:34-53`, `:57-58`, `:69-75`, `:113-120`, `:138-149`, `:159-162`, `:164-173`, `:104-111`. 리듀서 불변성(`:175-178`). 변이 M10·M11·M12·M13·M19·M20 이 각각 해당 `it` 을 정확히 문다 |

**Score:** 26/26 truths verified

### Deferred Items

이 페이즈에서 충족되지 않았으나 로드맵 후속 페이즈가 명시적으로 맡는 항목. 갭이 아니다. 항목 2 는 사람 검증이 필요한 브라우저 확인이며 **지금은 실행 불가능**하다(아래 "Human Verification Required" 참조).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | SPIN-02 런타임 배선 — `applyCooldown`·`cooldownWindowStart` 호출처 0곳 | Phase 4 | ROADMAP Phase 4 Goal(쿨다운 위에서 재작성), D-05·D-06 |
| 2 | SETT-02 브라우저 실증(탭 전환 후 Realtime 반영, WR-01) | Phase 6 · Phase 8 | 라이브에 `settings` 없음(Phase 8 적용). Phase 6 Goal "추첨 시각 문구가 전부 settings 를 따른다" UI 검증 시점 |
| 3 | 화면 문구 하드코딩 `11:55` (MenuList·ResultBlock·PhaseTimeline·page.tsx) | Phase 6 | SPIN-06, CONTEXT "하지 않는 것" |
| 4 | `app/log` `hasResult` 다른 달 부정확 | Phase 7 | D-08, `app/log/page.tsx:36-39` |
| 5 | IN-02(`loaded` 로 첫 페인트 가리기) · IN-03(훅 분기 → 리듀서) | Phase 6 | `.planning/todos/pending/in-02-*.md`·`in-03-*.md` (`resolves_phase: 6`) |
| 6 | `PROJECT.md:81` / `CLAUDE.md:83`(GSD project 블록) "tsc/eslint는 `supabase/functions/**` 제외 유지" 낡음 | Phase 8 | SHIP-03 문서 현행화. D-16 열거 항목 밖 |
| 7 | 두 `index.ts` `deno check` | Phase 4 · Phase 8 | CONTEXT deferred, 배포 시점 |

### Required Artifacts

`gsd-sdk query verify.artifacts` 3플랜 전부 `all_passed: true`(6+4+4 = 14/14). 아래는 검증자의 L2(실질)·L3(배선) 추가 확인.

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `supabase/functions/_shared/kst.ts` | `KstParts`(date 포함)·`kstParts`·`kstNow`·`pickRandom`, ≥40줄, `hourCycle` | ✓ VERIFIED | 75줄, export 4개, import 0. 소비처: `lib/time.ts:6,11`(값+타입 재수출), 두 `index.ts`(`../_shared/kst.ts`), `kst.test.ts`. WIRED |
| `supabase/functions/_shared/spinTime.ts` | `SpinTime`·`DEFAULT_SPIN_TIME`·`DEFAULT_SPIN_TIME_TEXT`·`parseSpinTime`·`secondsOfDay`·`isAfterSpinTime`, ≥30줄 | ✓ VERIFIED | 41줄, export 6개, import 0, 로컬 `TimeParts`. 소비처: `lib/phase.ts:14`(`secondsOfDay`·`SpinTime`), `lib/settings.ts:13-18`(`DEFAULT_SPIN_TIME`·`DEFAULT_SPIN_TIME_TEXT`·`parseSpinTime`·`SpinTime`), `spin-roulette/index.ts:13`. WIRED |
| `supabase/functions/_shared/cooldown.ts` | `cooldownWindowStart`·`applyCooldown` → `{ picked, fellBack }`, ≥25줄, `fellBack` | ✓ VERIFIED (호출처는 Phase 4) | 48줄, export 2개, import 0. 소비처: `cooldown.test.ts` 14건뿐 — **의도된 ORPHAN**(D-05 "DB 조회는 Phase 4", Deferred #1). 함수 자체는 프로브·변이로 실질 확인 |
| `supabase/functions/_shared/edgeImports.test.ts` | 텍스트 계약 ≥60줄, `readOrEmpty` | ✓ VERIFIED | 164줄, 24 it, `readOrEmpty` 5회(`:39-43`). 러너에 수집(`vitest list`) |
| `supabase/functions/_shared/{kst,spinTime,cooldown}.test.ts` | 단위 spec | ✓ VERIFIED | 73·81·82줄, 9·15·14건. 상대 `./` 확장자 없이 import(vitest 만 실행) |
| `tsconfig.json` / `eslint.config.mjs` | 제외를 함수 디렉터리 2개로 | ✓ VERIFIED | `:33` / `:16-20`. 각 diff 2줄·7줄. `design/**`·`node_modules` 유지 |
| `lib/phase.ts` | 4상태 · `currentPhase(now, spinTime, hasResult)` · `isCandidateListLocked`, ≥25줄, `stalled` | ✓ VERIFIED | 51줄. 소비처 7파일(app 3 + components 4) + spec. WIRED |
| `lib/phase.test.ts` | ≥60줄 | ✓ VERIFIED | 83줄, 16건, 4 describe |
| `lib/time.ts` | 재수출 + `hourCycle` 포맷터, `export type { KstParts }` | ✓ VERIFIED | 48줄(전 82줄). 소비처: `app/page.tsx:7`, `app/log/page.tsx:6`, `app/rank/page.tsx:6`, `components/MenuList.tsx:10`, `lib/phase.ts:13`. WIRED |
| `components/MenuList.tsx` | `readOnly = isCandidateListLocked(phase)` | ✓ VERIFIED | `:13,:52`. `parseMenuInput`(`:37-47`) 무변경, `MenuList.test.ts` 10건 통과 |
| `lib/settings.ts` | `Settings`·`DEFAULT_SETTINGS`·`SettingsState`·`SettingsAction`·`settingsFromRow`·`settingsReducer`, ≥55줄, 값 import 0(supabase) | ✓ VERIFIED | 111줄, export 7개. supabase 값 import 0(`import type` 1줄), `_shared/spinTime` 값 import 1줄. 소비처 `lib/useSettings.ts:24`. WIRED |
| `lib/settings.test.ts` | ≥70줄 | ✓ VERIFIED | 210줄, 28건, 6 describe |
| `lib/useSettings.ts` | SELECT 1회 + 구독 1개 + `removeChannel`, ≥40줄, `settings-changes` | ✓ VERIFIED | 72줄. `settings-changes` 토큰 2건(주석 `:9`, 템플릿 `:34`). 소비처: 세 페이지. WIRED |
| `CLAUDE.md` | D-16 정정 + 훅 컨벤션, `_shared` 포함 | ✓ VERIFIED | Truth 25. `_shared` 언급 8건 |
| `.planning/codebase/CONVENTIONS.md` | 8줄 정정 | ✓ VERIFIED | Truth 25 |
| `.planning/phases/03-pure-logic/03-VALIDATION.md` | 전 행 판정 + frontmatter | ✓ VERIFIED | `^\| 03-.*✅ green` 23행, `⬜ pending` 행 0, `❌ red` 행 0. frontmatter `status: complete`·`nyquist_compliant: true`·`wave_0_complete: true`. `Approval: pending` 은 오케스트레이터 몫 |

### Key Link Verification

`gsd-sdk query verify.key-links` 는 12개 중 6개를 `verified: false` 로 돌려줬으나 전부 도구 한계다 — Deno 상대 경로(`../_shared/kst.ts`)를 "Target not referenced" 로 오판, `\\(` 이스케이프 패턴을 "Invalid regex", `useSettings\(\)`·`maybeSingle\(\)` 을 "not found"(Phase 1 검증에서도 같은 형태의 오탐 기록). 아래는 수동 grep 으로 12/12 확인.

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `spin-roulette/index.ts` | `_shared/kst.ts` | Deno 상대 import(확장자) | ✓ WIRED | `:12` `import { kstNow, pickRandom } from "../_shared/kst.ts"`, `:16` 호출 |
| `spin-roulette/index.ts` | `_shared/spinTime.ts` | `isAfterSpinTime(now, DEFAULT_SPIN_TIME)` | ✓ WIRED | `:13` import, `:19` 호출 |
| `respin-roulette/index.ts` | `_shared/kst.ts` | Deno 상대 import | ✓ WIRED | `:22`, `:44` 호출. `spinTime.ts` 는 의도적으로 안 씀(#17 단언) |
| `edgeImports.test.ts` | 두 `index.ts` | `readOrEmpty(new URL("../spin-roulette/index.ts", …))` | ✓ WIRED | `:42-43`, #7a·#16a 가 읽힘을 먼저 단언 |
| `lib/time.ts` | `_shared/kst.ts` | 값 import + 재수출 | ✓ WIRED | `:6,:10,:11`. `npm run build` 가 Turbopack alias 해석 실증(exit 0) |
| `lib/phase.ts` | `_shared/spinTime.ts` | `secondsOfDay` · `type SpinTime` | ✓ WIRED | `:14`, `:24` 호출 |
| `components/MenuList.tsx` | `lib/phase.ts` | `isCandidateListLocked` | ✓ WIRED | `:13`, `:52` |
| `app/page.tsx` | `lib/phase.ts` | `currentPhase(now, settings.spinTime, todayResult !== null)` | ✓ WIRED | `:8`, `:47` |
| `lib/useSettings.ts` | `public.settings` | `.from("settings").select("*").eq("id", 1).maybeSingle()` 읽기 전용 | ✓ WIRED | `:39`. 쓰기 0건 |
| `lib/useSettings.ts` | `lib/settings.ts` | `useReducer(settingsReducer, INITIAL_SETTINGS_STATE)` | ✓ WIRED | `:24`, `:31` |
| `lib/settings.ts` | `_shared/spinTime.ts` | `parseSpinTime` · `DEFAULT_SPIN_TIME` | ✓ WIRED | `:13-18`, `:29`, `:56` |
| `app/page.tsx` / `log` / `rank` | `lib/useSettings.ts` | `useSettings()` + 배너 합류 | ✓ WIRED | `:10,:44,:47,:240-244` / `:9,:34,:40,:105-109` / `:9,:26,:29,:75-79` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| 세 페이지 `phase` → `TopBar`·`StageHeader`·`MenuList.readOnly`·`ResultBlock`·`PhaseTimeline` | `settings.spinTime` | `useSettings` → `useReducer` ← `supabase.from("settings")…maybeSingle()` + `postgres_changes` | Yes(컷오버 후 DB 행). 컷오버 전은 `failed` → `DEFAULT_SETTINGS` 로 착지(설계, SETT-03) | ✓ FLOWING |
| 세 페이지 `phase` | `hasResult` | `app/page.tsx` `todayResult`(`results` maybeSingle + realtime INSERT/UPDATE), log/rank `results.some(...)` | Yes | ✓ FLOWING |
| 세 페이지 `<ErrorBanner message={loadBanner}>` | `settingsError`·`settingsWarning` | 리듀서 `error`(로드 실패) / `warning`(`settingsFromRow`) | Yes — 컷오버 전엔 `PGRST205` 메시지가 실제로 흐른다(정상, D-18) | ✓ FLOWING |
| `spin-roulette` 조기 반환 `kst: now` | `kstNow()` | `_shared/kst.ts` | Yes. 페이로드가 4필드 → 8필드로 넓어짐(INFO-13, 소비처 없음, 기존 4필드 이름·값 동일) | ✓ FLOWING |

호출부에 `={[]}`·`={null}` 하드코딩 프롭 0건. `app/page.tsx:72` `initialLoadedRef.current = true` 가 여전히 초기 로드 IIFE 마지막 줄 — 휠 이중 회전 가드 보존, `lunch-realtime` 바인딩 6개 무변경.

### Behavioral Spot-Checks (이 프로세스에서 직접 실행)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| 전체 스위트 | `npm test` | `Test Files 10 passed (10)` · `Tests 189 passed (189)` · exit 0 | ✓ PASS |
| 파일별 건수 | `npx vitest run --reporter=verbose` | MenuList 10 · errors 7 · phase 16 · settings 28 · time 13 · cooldown 14 · edgeImports 24 · kst 9 · spinTime 15 · 0005 53 | ✓ PASS |
| 수집 경계 | `npx vitest list` | 정확히 10파일, `design/**`·`.planning/**`·`spin-roulette/**` 0 | ✓ PASS |
| Phase 1 회귀 | `npx vitest run lib/time.test.ts lib/errors.test.ts components/MenuList.test.ts` | 3파일 30건 통과 | ✓ PASS |
| Phase 2 회귀 | `npx vitest run supabase/migrations` | 1파일 53건 통과 | ✓ PASS |
| Phase 1·2 산출물 무접촉 | `git diff --stat 68eedb8..HEAD -- vitest.config.mts package.json package-lock.json README.md components/Wheel.tsx lib/supabase/client.ts lib/constants.ts lib/errors.ts components/ErrorBanner.tsx supabase/migrations/0005_restaurants_settings.{sql,test.ts} lib/errors.test.ts components/MenuList.test.ts` | 출력 0줄 | ✓ PASS |
| 환경변수 없이 | `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npx vitest run` | 189/189, `supabaseUrl is required` 0 | ✓ PASS |
| 타입 | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| 린트 | `npm run lint` | exit 0, 출력 0 | ✓ PASS |
| 빌드 | `NEXT_DISABLE_MEM_OVERRIDE=1 npm run build` | exit 0 — `Compiled successfully in 322ms`, TypeScript 632ms, 정적 4라우트 | ✓ PASS |
| 취약점 | `npm audit --audit-level=high` | `found 0 vulnerabilities` | ✓ PASS |
| `_shared` 직접 실행(Deno·번들러 없이) | Node 25.6.1 ESM 파일에서 `import("…/_shared/{kst,spinTime,cooldown}.ts")` 후 30건 단언 | 30/30 PASS(UTC 경계·자정 0·소수 초·`24:00`/`11:60`/`1155`/선행 공백 → null·윤년·연 경계·NaN·폴백·`null` id·빈 후보) | ✓ PASS |
| 커밋 존재 | `gsd-sdk query verify.commits`(18개 해시) | `all_valid: true` | ✓ PASS |
| TDD 순서 | `git merge-base --is-ancestor` RED→GREEN ×3, Wave 0→RED | 전부 성립 | ✓ PASS |
| 커밋 위생 | `git log 68eedb8..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | 0 (22커밋) | ✓ PASS |
| 워킹트리 | `git status --porcelain --untracked-files=all` | 시작 시점과 동일(`.planning/config.json`·`.serena/project.yml` 2건 M) | ✓ PASS |

### Adversarial Mutation Checks (스크래치패드 사본, 트리 무접촉)

| # | 변이 | 잡은 spec | 실패 건수 |
|---|------|-----------|-----------|
| M1 | `isCandidateListLocked("stalled") → true` | phase #16 | 1 |
| M2 | `currentPhase` 가 `stalled` 대신 `decided` | phase 11:55:05 · 23:59:59 · 12:30:05 | 3 |
| M3 | `hasResult` 무시 | phase `hasResult=true` 3건 | 3 |
| M4 | 쿨다운 폴백 제거 | cooldown #9 | 1 |
| M5 | `days <= 0` 가드 제거 | cooldown #1 · #2 | 2 |
| M7 | `parseSpinTime` `hh > 23` 허용 | spinTime #5 | 1 |
| M8 | `isAfterSpinTime` `>=` → `>` | spinTime #13 | 1 |
| M9 | `kst.ts` `hourCycle` 제거 | kst #3 · time 자정 보정 | 2 |
| M10 | `failed` 가 `error` 를 숨김 | settings failed | 1 |
| M11 | `changed` UPDATE 무시 | settings 병합 5 + 순서 1 | 6 |
| M12 | 잘못된 `spin_time` 경고 삼킴 | settings warning 2 | 2 |
| M13 | DELETE 가 옛 설정 유지 | settings DELETE 2 + 순서 1 | 3 |
| M14 | `spin-roulette` 에 로컬 `kstNow` 재삽입 | edgeImports #9 | 1 |
| M15 | Edge import 확장자 제거 | edgeImports #7 | 1 |
| M16 | `_shared/spinTime.ts` 에 `import type … "./kst"` | edgeImports #5 | 1 |
| M17 | 〃 `"./kst.ts"` (tsc 는 exit 0 — 타입 전용 import 는 TS5097 대상 아님) | edgeImports #5 | 1 |
| M18 | `kstParts.date` 구분자 `/` | time 4 + kst 4 | 8 |
| M19 | 음수 `cooldown_days` 미클램프 | settings 음수 | 1 |
| M20 | IN-01 가드(`state.loaded`) 제거 | settings 순서 2 | 2 |
| M6 | `null` 승자 id 를 `"null"` 문자열로 추가 | — (동치 변이: 후보 id 와 겹칠 수 없어 관측 불가) | 0 (테스트 결함 아님) |

변이 후 원복 → 189/189. 사본 삭제 후 `git status` 동일.

### Probe Execution

`scripts/*/tests/probe-*.sh` 없음, PLAN·SUMMARY 에 probe 선언 없음 — 해당 없음. 이 페이즈의 실행 가능한 검증은 위 스위트·Node 프로브·변이가 담당한다.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SETT-02 | 03-03 | 대시보드에서 설정을 바꾸면 열린 탭에 Realtime 으로 즉시 반영(새로고침 불필요) | ✓ SATISFIED (코드·리듀서 계약) | Truth 20·22·26. 라우트 전환 이후 반영(WR-01)은 per-instance topic 으로 구성상 보장, 브라우저 실증은 Deferred #2 |
| SETT-03 | 03-03 | 로드 전·실패 시 기본값(11:55, 쿨다운 0) | ✓ SATISFIED | Truth 4·18·19·21·23 |
| SPIN-03 | 03-02 (+03-03 마무리) | 추첨 시각에 후보 0개면 결과가 안 생기고 UI 는 잠기지 않는다 | ✓ SATISFIED (클라이언트 반) | Truth 3·15·16. 서버 쪽 "결과가 생기지 않는다" 는 현행 `no_candidates` 조기 반환(`spin-roulette:58-63`) 그대로 |
| QUAL-02 | 03-01, 03-02 (+03-03 문서) | `_shared/` 에 Deno import 없이, vitest 테스트, `kstNow` 복붙 1곳 | ✓ SATISFIED | Truth 1·5·6·9·10·13·25 |
| SPIN-02 | 03-01 | `cooldown_days > 0` 이면 최근 N일 당첨 제외, 비면 전체 폴백 | ⏳ PENDING — **실행자 처분이 옳다** | 순수 필터 + 14건 spec 은 완성(SC2 충족)이나 `applyCooldown` 호출처 0곳(`grep` 전수). 요구사항 문면은 **런타임 추첨 동작**이고 그 배선은 ROADMAP Phase 4 Goal 이 명시적으로 맡는다. REQUIREMENTS.md 추적표는 "Phase 3" 소속이므로, Phase 4 가 닫을 때 QUAL-01 행처럼 "Phase 3(순수 필터) → Phase 4(Edge 배선에서 완료)" 로 분할 표기하는 편이 정확하다(오케스트레이터 판단) |
| QUAL-01 (Phase 3 몫) | — (어느 PLAN frontmatter 에도 없음) | spin_time 파싱·쿨다운 필터 단위 테스트 | ✓ SATISFIED | REQUIREMENTS.md:124 가 "Phase 1 → Phase 3(spin_time 파싱·쿨다운 필터에서 완료)" 로 분할 표기, Phase 1 VERIFICATION 이 이 몫을 Phase 3 로 이관. `spinTime.test.ts` 15건 + `cooldown.test.ts` 14건이 그 증거. frontmatter 미청구는 정보성(추적표가 이미 Complete) |

REQUIREMENTS.md 추적표에서 Phase 3 로 매핑된 ID 는 위 5개 + QUAL-01 분할분 — 그 외 ORPHANED 없음. `96ee327`(03-03) 이 SETT-02·SETT-03·SPIN-03·QUAL-02 4건을 체크박스·표 양쪽에서 Complete 로 바꿨고 SPIN-02 는 남겼다.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (수정 소스 18파일 전수) | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/`not implemented`/`console.log` 0건 | — | 없음 |
| `_shared/spinTime.ts` · `cooldown.ts` | :22,:25 · :16,:18 | `return null` | ℹ️ Info | 총 함수의 의도된 실패 표현(D-01 "throw 금지"). 스텁 아님 |
| `components/ResultBlock.tsx` | :125 | `return null` | ℹ️ Info | if-체인 4분기(`accepting`/`spinning`/`decided && winner`/`stalled`) 뒤 폴백. `decided && !winner` 는 D-07 이후 도달 불가라 사실상 죽은 줄 — 기존 형태 유지, 무해 |
| `components/MenuList.tsx` | :89 | `placeholder=` | ℹ️ Info | HTML input 속성. 스텁 아님 |

정보성 관찰(갭 아님):
- ℹ️ **D-18 문면 정정 권고:** "좁힌 뒤에는 `_shared` 상호 `.ts` import 가 `TS5097` 로 잡혀 D-02·D-17 을 컴파일러가 강제한다" — tsc 5.9.3 실측으로 **값 import 에만** 참이다. `import type … from "./kst.ts"` 는 소거되므로 exit 0(M17). D-02 의 실효 게이트는 `edgeImports.test.ts` #4-#6 이고 그것이 두 형태를 모두 잡는다(M16·M17). RESEARCH §Q1(b) 의 "`import type` 도 tsc 에서 실패" 실측 기록과 어긋나므로 다음 사람이 혼동하지 않게 CONTEXT/RESEARCH 한 줄 주석을 권한다.
- ℹ️ `PROJECT.md:81` → `CLAUDE.md:83`(GSD project 블록) "tsc/eslint는 `supabase/functions/**` 제외 유지" 가 `CLAUDE.md:41,46` 의 정정 문면과 **같은 파일 안에서 모순**된다. Deferred #6(Phase 8), 한 줄이라 quick task 로 먼저 닫아도 된다.
- ℹ️ `CONVENTIONS.md:26` `MENU_NAME_MAX_LEN`(`lib/supabase/client.ts:13`) 은 Phase 1 이후 `lib/constants.ts:8` 이 정의처 — 이 페이즈 소관 밖의 기존 드리프트(D-16 목록에 없음), Phase 8 SHIP-03.
- ℹ️ `03-03-SUMMARY.md` 낭독 체크리스트 3행(`.channel("settings-changes")`)과 "Phase 8 SHIP-03 에 남긴 것" 문단(CONVENTIONS 채널 규칙 "불완전")은 `0cd4fb2` 이전 기록이다. `03-REVIEW.md` Fix Log 가 정정 기록을 담고 있어 SUMMARY 는 수정하지 않는다(역사 문서).
- ℹ️ `spin-roulette` 조기 반환 `kst` 페이로드 4→8필드(INFO-13). 소비처 없음.
- ℹ️ 워킹트리의 `.planning/config.json`·`.serena/project.yml` 수정은 페이즈 소스가 아니다(후자는 CLAUDE.md 가 커밋 대상 아님으로 명시).

### Human Verification Required

**없음 — 지금 시점에는.** 판단 근거:

1. **SETT-02 라우트 전환 후 Realtime 반영(WR-01 수정 실증)** 은 브라우저가 필요하지만, 라이브에 `settings` 테이블이 없고(0005 적용 = Phase 8) 네트워크·라이브 접촉·`npm run dev` 가 이 페이즈 규칙상 금지라 **지금 사람이 열어 봐도 그 경로를 밟을 수 없다.** 코드 수준에서는 realtime-js 의 채널 dedup 이 토픽 문자열 기준이고 `lib/useSettings.ts:34` 가 마운트마다 다른 문자열(`settings-changes-<n>`)을 만들므로, 리뷰가 지적한 "leave 중인 옛 인스턴스를 돌려받는" 조건 자체가 성립하지 않는다 — 이것은 낭독으로 결정 가능한 구성 사실이다. 실증은 Phase 6(추첨 시각 문구가 `settings` 를 따르는 UI 검증)이나 Phase 8(컷오버 후) HUMAN-UAT 에서 다음 절차로 한다: 대시보드에서 `spin_time` 을 바꾸고 `/`·`/log`·`/rank` 를 **탭으로 옮겨 다닌 뒤** 각 페이지의 TopBar 뱃지·헤드라인이 새로고침 없이 바뀌는지 확인. 기대: 세 페이지 모두 수 초 안에 반영. 회귀 게이트는 `grep -c 'channel("settings-changes")' lib/useSettings.ts → 0`.
2. `stalled` 화면 문구·`설정 불러오기 실패` 배너는 VALIDATION Manual-Only 표가 이미 Phase 6 UI 검증에 위임했고, 배너 메커니즘 자체는 Phase 1 human_needed 항목으로 별도 추적 중이다.
3. `useSettings` 낭독 5항목(03-03-SUMMARY)은 검증자가 트리에서 재낭독해 전부 참(`:39-42` 분기 순서, `:34,:51` 토픽, `:66-68` cleanup, `:37,:40,:45` cancelled, 쓰기 0건).

따라서 `human_needed` 로 올리지 않고 Deferred #2 로 이관한다.

### Gaps Summary

갭 없음. 페이즈 목표 — "추첨 시각 판정·쿨다운 필터·KST 변환을 주입 가능한 순수 함수 한 곳으로, 테스트로 계약 고정, 하드코딩 상수·복붙 종결" — 이 코드베이스에서 성립한다. `kstNow`·`kstParts` 구현 1곳, 기본 추첨 시각 코드 정의처 1곳(`DEFAULT_SPIN_TIME`), `SPIN_HH/MM` 3벌·`hour12` 3벌·`msToNextPhase`·`resolvedPhase` 0건, `currentPhase` 는 시각 주입을 시그니처로 강제하고 `stalled` 를 `decided` 와 구분하며 그 구간에서 후보 목록이 잠기지 않는다. 설정은 리듀서 28건 + 훅 배선으로 세 페이지에 흐르고 실패·경고가 서로 다른 채널로 배너에 합류한다. 189건 스위트가 진짜 RED(3 플랜 각각 TS2307/TS2305·TS2554/TS2307)에서 출발해 GREEN 이 됐고, 변이 19종이 정확히 해당 `it` 에서 실패한다. 남은 것은 전부 후속 페이즈가 명시적으로 맡는 항목(Deferred 7건)이며, 그중 SPIN-02 는 순수 필터가 완성됐으나 런타임 배선(Phase 4)까지 가야 요구사항 문면이 관측되므로 실행자의 Pending 처분이 옳다.

---

_Verified: 2026-09-21T05:58:00Z_
_Verifier: Claude (gsd-verifier)_
