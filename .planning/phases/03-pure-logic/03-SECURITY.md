---
phase: 3
slug: pure-logic
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-21
verified: 2026-09-21
---

# Phase 3 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

검증 원칙: SUMMARY 세 편의 서술은 증거로 쓰지 않았다(03-03-SUMMARY 의 `.channel("settings-changes")` 인용은 `0cd4fb2` 이전 기록이라 트리와 다르다). 레지스터는 세 플랜(`03-01`·`03-02`·`03-03`)의 `<threat_model>` 에서 그대로 가져왔고(21건 — `T-03-01`~`T-03-19` + 세 플랜 공통의 `T-03-SC`·`T-03-LIVE`), 완화 증거는 이 감사에서 **HEAD 트리(`bc79223`)** 를 상대로 grep·`git`·`npx tsc --noEmit`·`npx vitest run`·`npm run lint`·`npm run build`·Node 25 프로브(스크래치패드에 `@/` 해석 훅을 두고 `_shared/*.ts`·`lib/settings.ts`·`lib/phase.ts` 를 직접 import, 40건 오염 입력)를 **재실행**해 얻었다. 리뷰(`03-REVIEW.md` Fix Log)가 플랜 작성 뒤에 완화를 바꾼 6커밋(`0cd4fb2`·`57b61fd`·`8941ee9`·`e33efa8`·`63f9ea5`·`d36caf8`)은 플랜 문면이 아니라 트리 기준으로 판정했다. `deno` 는 없어 두 `index.ts` 는 `git diff 68eedb8..HEAD` 의 hunk 위치 + `edgeImports.test.ts` 24/24 + 낭독으로 판정했다. 구현 파일 수정 0건, 트리에 남긴 임시 파일 0건, 커밋 0건.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 브라우저 번들 ↔ Deno 런타임 (`supabase/functions/_shared/`) | 같은 파일이 Turbopack(클라이언트)과 Deno(Edge) 두 런타임에서 컴파일된다. 한쪽 전역(`Deno.*`·`node:`)이 섞이면 반대쪽이 배포 시점에야 깨진다 | 순수 함수 (시각·문자열·후보 배열) |
| 정적 검사 경계 (`tsconfig.json:33` · `eslint.config.mjs:16-20`) | 제외 목록 = "검사받지 않는 코드". 이 페이즈가 `supabase/functions/**` 통짜 제외를 함수 디렉터리 2개로 좁혔다 | `_shared/**` 7파일이 tsc·eslint 프로그램 안으로 |
| 브라우저(anon) → `respin-roulette` (무인증·비멱등) | OPTIONS 프리플라이트가 본문을 실행하면 결과가 중복 덮어쓰기된다 | 빈 POST · CORS 헤더 |
| `crypto.getRandomValues` → 추첨 결과 | 난수원이 추첨 공정성의 전부다 | `Uint32Array(1)` |
| `Phase` 유니온 ↔ 소비처 9곳 | 유니온을 넓혀도 if-체인 + fallback 소비처에서 tsc 가 침묵한다 — "초록인데 틀린" 상태가 가능한 유일한 지점 | `"stalled"` 리터럴 |
| 화면 페이즈 추정 ↔ 실제 상태 (`results` 행) | 추정이 정본을 덮어쓰면 존재하지 않는 결과가 "확정" 으로 보인다 | `hasResult: boolean` |
| 대시보드(사람) → `settings.spin_time` → 세 페이지 | 사람이 손으로 넣은 문자열 하나가 앱 전체의 시각 판정을 결정한다 | `"HH:MM:SS"` 문자열 · `cooldown_days` · `history_since` |
| Realtime `postgres_changes` 페이로드 → 앱 상태 | 앱이 만든 값이 아니다. `payload.new` 가 통째로 상태에 들어가고 DELETE 는 PK 만 온다 | `SettingsRow` 형태의 객체 |
| anon(브라우저) → `public.settings` | select 정책 1건·쓰기 정책 0건(`0005:98-99`). 앱 계층에 쓰기 호출이 없는 것이 앱 쪽 통제 | 읽기 전용 |
| PostgREST 에러 객체 → 화면 배너 | `message` 에 테이블명(`public.settings`)이 실린다. `details`·`hint` 는 버린다 | 에러 문자열 |
| **워킹트리 → 라이브 Supabase / `main`** | 이 페이즈가 **건너지 않기로 한** 경계. 배포·마이그레이션 적용·`git push` 전부 0건 | — (무접촉) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Tampering | `_shared/*.ts` import 문 (Deno/Node 전역이 브라우저 번들로 새는 경로) | mitigate | 감사 재실행: `grep -cE '^\s*import\s'` → `kst.ts` 0 · `spinTime.ts` 0 · `cooldown.ts` 0. 주석 제거 사본에서 `Deno\.\|process\.env\|require(\|node:\|globalThis\|import\.meta` → 세 파일 전부 0. `spinTime.ts:31` 로컬 `TimeParts` 로 `KstParts` 를 대체(D-17). **게이트 승격 실증**: `npx tsc --noEmit --listFilesOnly` 에 `_shared` 7파일이 있고 두 `index.ts` 는 없다(D-12); `.ts` 확장자 import 를 담은 스크래치 파일에 tsc 가 `TS5097` 을 낸다; `npx eslint _shared/kst.ts` exit 0(검사됨) · `spin-roulette/index.ts` "File ignored". 회귀 가드 `edgeImports.test.ts` #4-#6(`:67-77`, `IMPORT_LINE = /^\s*import\s/gm` `:52`) 24/24 통과. **번들 경계 실증**: `NEXT_TELEMETRY_DISABLED=1 NEXT_DISABLE_MEM_OVERRIDE=1 npm run build` exit 0, `Compiled successfully`, 정적 4라우트 — `lib/time.ts:6`·`lib/settings.ts:13-18` 이 끌어오는 `_shared/kst`·`_shared/spinTime` 이 브라우저 번들로 컴파일된다 | closed |
| T-03-02 | Tampering | `respin-roulette` OPTIONS 프리플라이트 단락 | mitigate | 트리: `respin-roulette/index.ts:40-42` `if (req.method === "OPTIONS") { return new Response("ok", { headers: corsHeaders }); }` · `corsHeaders` `:24-28` 정의 + `:34`·`:41` 참조(3건 ≥ 2). `git diff 68eedb8..HEAD` 의 hunk 2개(`@@ -17,6 +17,9`·`@@ -32,34 +35,6`)는 import 추가와 복붙 삭제뿐 — `corsHeaders`·`json()`·OPTIONS 구간에 변경 0. `edgeImports.test.ts` #22(`:157-163`, `req.method === "OPTIONS"` 1건 + `corsHeaders` ≥ 2 짝 단언) 통과 | closed |
| T-03-03 | Tampering | `spin-roulette` `23505` 레이스 처리 | mitigate | 트리: `spin-roulette/index.ts:74-81` `if (insErr.code === "23505") … "race_already_decided"` 원문, `:47` `.from("menus")` 유지. diff hunk 는 `@@ -5,50 +5,18` 한 개(머리 주석·import·`isAfterSpinTime(now, DEFAULT_SPIN_TIME)` 호출부)뿐이고 `:26` 이후 본문은 hunk 0. `edgeImports.test.ts` #15(`:122-124`, `23505` 정확히 1건) 통과 | closed |
| T-03-04 | Tampering | 난수원 `crypto.getRandomValues` (`pickRandom`) | mitigate | `_shared/kst.ts:71-75` 본문 4줄이 diff 의 삭제 블록(두 `index.ts` 의 옛 `pickRandom`)과 문자 단위로 동일. `grep -c 'crypto.getRandomValues' kst.ts` → 1. `Math.random` 은 소스 전수(`supabase/functions`·`lib`·`app`·`components`, spec 제외)에서 주석 제거 후 **0**(유일한 매치 `components/Wheel.tsx:24` 는 "쓰지 않는다" 는 주석). `kst.test.ts` #8(`:64`)·#9(`:68`) 통과. 프로브: 100회 추출 전부 입력 배열 원소 | closed |
| T-03-05 | Denial of Service | `pickRandom([])` — 타입은 `T` 지만 `undefined` 를 준다 | accept | R-03-01 참조. `kst.ts:68-70` 전제조건 주석("arr.length > 0 … 예외를 던지는 형태로 바꾸지 않는다"), 주석 제거 사본 `throw` 0. 현행 두 호출자가 직전에 길이를 검사한다: `spin-roulette/index.ts:58` `if (!menus \|\| menus.length === 0)` → `:65` `pickRandom(menus)`, `respin-roulette/index.ts:61` → `:65` 동일. 프로브 `pickRandom([])` → `undefined`(throw 없음, 문서화된 계약과 일치). Phase 4 인계 계약: `applyCooldown` 은 후보가 비어 있지 않은 한 빈 `picked` 를 돌려주지 않는다(프로브 3경로) | closed |
| T-03-06 | Denial of Service | 쿨다운 필터가 후보를 전멸시킨다 | mitigate | `_shared/cooldown.ts:44-47` `kept.length > 0 ? { picked: kept, fellBack: false } : { picked: candidates, fellBack: true }`. `cooldown.test.ts` #9(`:65`, 전멸 → 전체 폴백) + IN-04 추가분 #9a(`:72`, 후보 0개는 `fellBack: false`) 통과. 프로브: `["r1","r2"]` 전부 차단 → `picked` 2개 · `fellBack: true`; 일부 차단 → 남은 것만; `[]` → `fellBack: false` | closed |
| T-03-07 | Information Disclosure | `_shared` 모듈이 시크릿·환경변수를 읽는다 | mitigate | 주석 제거 사본에서 `process.env`·`Deno.env`·`Deno.` → 세 파일 0(T-03-01 과 같은 측정). `Deno.env.get` 은 `spin-roulette/index.ts:27-28`·`respin-roulette/index.ts:47-48` 각 2건으로만 남고 그 줄은 diff hunk 밖. 시크릿 형태 리터럴(`eyJ…`·`sb_secret`·`SUPABASE_SERVICE_ROLE_KEY`) 소스 전수 0(매치 2건은 `service_role` 을 언급하는 주석). `.env.local` 은 `.gitignore:34` 로 무시되고 키 이름은 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY` 둘뿐 | closed |
| T-03-08 | Denial of Service | `components/MenuList.tsx` `readOnly` — `stalled` 에서 후보 입력이 잠긴다 | mitigate | `components/MenuList.tsx:13` 값 import + `:52` `const readOnly = isCandidateListLocked(phase);` (`phase !== "accepting"` 0건). `lib/phase.ts:33-51` `switch` 4분기 + `default` `const exhaustive: never = phase;`(`:47`), `stalled → false`(`:41-44`). `lib/phase.test.ts` #13-#16(`:68-80`) 통과 — `stalled` 는 잠기지 않는다 | closed |
| T-03-09 | Tampering | `Phase` 유니온 확장과 소비처 갱신의 커밋 분리 | mitigate | `git show --name-only --format= 0a71b10` → 정확히 9파일(`lib/phase.ts` + `app/*` 3 + `components/*` 4 + todo 삭제 1). 감사 재grep 소비처 9곳 전부 `stalled` 인지: `MenuList:52`(헬퍼) · `TopBar:18-33`(switch) · `PhaseTimeline:18`(`stalled → accepting`) · `ResultBlock:107` · `app/page.tsx:318-329` StageHeader(switch) · `:369` headline · `:379` subhead · `:160` wheelPhase(`stalled → "idle"`) · `:282` respin 버튼(`decided && todayResult`). `: never` 가드 3건(`lib/phase.ts:47`·`TopBar.tsx:30`·`app/page.tsx:329`). `resolvedPhase` 0건. `components/Wheel.tsx` 의 `phase ===` 매치는 별개 `WheelPhase` 유니온 | closed |
| T-03-10 | Spoofing | 존재하지 않는 결과를 "확정" 으로 표시 (`decided` 오판) | mitigate | `lib/phase.ts:22` `currentPhase(now, spinTime, hasResult)` 기본 인자 없음, `:23` `if (hasResult) return "decided";` 가 첫 줄, 시각은 `:27-29` 에서 나머지 세 상태만 가른다. `lib/phase.test.ts` #5(`:30`, 11:55:05 결과 없음 → `stalled`)·#6(`:34`)·#7-#9(`:40-48`, 결과 있으면 시각 무관 `decided`) 통과. 프로브: 11:55:05/결과 없음 → `"stalled"`, 11:54:59/결과 있음 → `"decided"`. 세 페이지의 `hasResult` 는 실제 `results` 행에서 파생(`app/page.tsx:47` `todayResult !== null`, `app/log/page.tsx:40`·`app/rank/page.tsx:29` `results.some(...)`) | closed |
| T-03-11 | Tampering | `components/ResultBlock.tsx` 의 도달 불가 분기 잔존 | mitigate | `grep -c 'phase === "decided" && !winner'` → 0 · `grep -c 'phase === "stalled"'` → 1(`:107`). `:105-106` 주석이 조건만 옮겼음을 기록. `:125` `return null` 폴백은 기존 형태 유지(죽은 분기 아님) | closed |
| T-03-12 | Information Disclosure | 해당 없음 — 데이터를 읽거나 표시 범위를 넓히지 않는다 | accept | R-03-02 참조. `stalled` 문구 전수: `TopBar.tsx:27` `"추첨 대기"` · `app/page.tsx:325-326` StageHeader `"추첨 대기중"` · `:369` `"아직 안 정해졌어요."` · `:379-380` 템플릿의 유일한 보간 `${count}` 는 `phaseSubhead(phase: Phase, count: number, …)`(`:373`) 의 `number` 이고 호출부 `:235` 가 `menus.length` 를 넘긴다 · `ResultBlock.tsx:115-117` 리터럴. 사용자 입력·DB 문자열·에러 객체 보간 0 | closed |
| T-03-13 | Denial of Service | 잘못된 `spin_time` 하나가 세 페이지를 흰 화면으로 만든다 | mitigate | `_shared/spinTime.ts:20-27` `parseSpinTime` — 정규식(`:15`) 불일치·범위 밖(`:25`) 전부 `null`, `throw` 0. `lib/settings.ts:55-73` `settingsFromRow` — `parsed ?? DEFAULT_SETTINGS.spinTime`(`:59`), `Number.isFinite(...) && > 0`(`:62`), `history_since ?? null`(`:66`, IN-04 `8941ee9`), 실패는 `warning`(`:69-71`) 으로 반환. `grep -c '^[^/]*\bthrow\b'` → `spinTime.ts` 0 · `cooldown.ts` 0 · `settings.ts` 0. `lib/settings.test.ts` #8(`:69`)·#9(`:73`)·#17(`:127`, `warning` 만 차고 `error` 는 `null`) 통과, 환경변수 제거(`env -u NEXT_PUBLIC_*`) 상태에서도 28/28. **프로브**: `parseSpinTime` 13종(`"25:00"`·`"11:60"`·`""`·`"1155"`·선행 공백·`"24:00"`·`null`·`undefined`·`1155`·`{}`) 전부 `null` 또는 정상값, throw 0; `settingsFromRow` 7종 오염 행(`spin_time: null`·키 누락 `{}`·`cooldown_days: "7"`/`NaN`/`Infinity`·`history_since: 42`) 전부 값 반환, `spinTime` 은 `{11,55}` 로 착지, `cooldownDays` 는 0, `warning` 은 완성 문장. `warning` 이 `error` 채널과 분리돼 `formatLoadError("설정", …)` 접두를 받지 않는다(`app/page.tsx:240-244` 배열 3원소, 세 번째가 `settingsWarning` 그대로) | closed |
| T-03-14 | Elevation of Privilege / Tampering | 앱 코드에 `settings` 쓰기 경로가 생기면 누구나 추첨 시각을 바꾼다 | mitigate | 2차 통제(앱): `grep -cE '\.(insert\|update\|delete\|upsert\|rpc)\(' lib/useSettings.ts` → **0**. `from("settings")` 는 레포 전체(`app`·`lib`·`components`)에서 `lib/useSettings.ts:39` `.select("*").eq("id", 1).maybeSingle()` 한 곳뿐. `settings` + 쓰기 메서드 동일 줄 매치 0. 훅의 supabase 호출은 `select`(`:39`)·`channel`/`subscribe`(`:51`,`:65`)·`removeChannel`(`:67`) 뿐. 1차 통제(RLS, Phase 2 참조): `0005:74` `enable row level security`, 주석 제거 사본 `on public.settings` → `:98` drop · `:99` `create policy settings_read … for select` 2건, `for insert/update/delete/all` **0** | closed |
| T-03-15 | Tampering | Realtime 페이로드의 얕은 병합 | mitigate | `lib/settings.ts:102` `changed` 와 `:84` `loaded` 모두 `settingsFromRow(action.row)` 로 **통째 교체**. 주석 제거 사본 `\.\.\.(prev\|state\|action\.row\|row)` → 0(유일한 매치는 `:100` 의 "쓰지 않는다" 주석). DELETE: `lib/useSettings.ts:61` 이 `row: null` 로 넘기고 `lib/settings.ts:97-99` 가 `DEFAULT_SETTINGS` 로 복귀. `lib/settings.test.ts` 병합 7건(`:138-178`) + 순서 뒤집힘 3건(`:185-202`, IN-01 `57b61fd` — `state.loaded` 가드 `:81`·`:90`) 통과. 프로브: `changed UPDATE {spin_time:"zz"}` → 기본 시각 + `warning`, `changed UPDATE row=undefined` → 기본값, `INITIAL_SETTINGS_STATE.loaded` 는 리듀서 호출 뒤에도 `false`(불변) | closed |
| T-03-16 | Denial of Service | Realtime 채널 누수 / 이중 구독 (StrictMode 이중 마운트) — **WR-01 이후 판정** | mitigate | 트리(`0cd4fb2` 반영): `lib/useSettings.ts:28` 모듈 카운터, `:34` `useState(() => \`settings-changes-${++topicSeq}\`)` — 구독 **인스턴스마다** 유일한 토픽, `:51` `.channel(topic)`, effect 의존성 `[topic]`(`:69`), cleanup `:66-68` `supabase.removeChannel(ch)`. SELECT effect: `:37` `let cancelled = false` → `:40` `if (cancelled) return;` → `:45` `cancelled = true`, 의존성 `[]`(`:47`). 회귀 게이트 `grep -c 'channel("settings-changes")'` → **0**. 페이지 채널 토픽과 충돌 없음: `app/page.tsx:91` `lunch-realtime` · `app/log/page.tsx:70` `log-results` · `app/rank/page.tsx:49` `rank-results` · 훅 `topic`. `lunch-realtime` 에 바인딩 추가 0. StrictMode 이중 마운트의 안전성(첫 마운트 채널이 `joining` 이라 `leave` 가 동기 close)은 렌더 하네스 부재로 실행 불가 — `03-REVIEW.md` WR-01 절의 realtime-js 2.106.0 소스 추적을 인용하며, 토픽이 마운트마다 다르므로 dedup 조건 자체가 성립하지 않는다는 구성 사실은 `:34` 로 기계 확인 | closed |
| T-03-17 | Information Disclosure | 에러 배너로 스키마 정보가 샌다 (`PGRST205` 의 `public.settings`) | accept | R-03-03 참조. `lib/errors.ts:10-13` `formatLoadError` 는 `error.message` 만 쓴다(`:5` 주석: `details`·`hint` 에 SQL 조각·컬럼명이 실려 버린다). 훅은 `error.message` 만 리듀서에 넘긴다(`lib/useSettings.ts:41`), 페이지는 `{ message: settingsError }` 로 감싼다(`app/page.tsx:242`·`app/log/page.tsx:107`·`app/rank/page.tsx:77`). `components/ErrorBanner.tsx:19` 는 `<span>{message}</span>` 텍스트 노드 — 원시 에러 객체가 배너에 닿는 경로 없음 | closed |
| T-03-18 | Denial of Service | 로드 실패를 에러로 안 보고 삼켜 SETT-03 경로가 검증되지 않는다 | mitigate | `lib/useSettings.ts:41-42` `if (error) dispatch({ type: "failed", message: error.message }); else dispatch({ type: "loaded", row: (data …) ?? null });` — `error` 를 먼저 본다. 역방향 신호 주석 `:18` "배너가 안 뜨면 에러를 삼키고 있다는 신호다". 리듀서 `:83` `loaded(null)` → `error: null`(0행은 배너 없음), `:92` `failed` → `error: message`(숨기지 않음). `lib/settings.test.ts` #14(`:104`)·#15(`:113`) 통과. 프로브: `failed("PGRST205")` → `error: "PGRST205"` · `loaded(null)` → `error: null`. 세 페이지가 `settingsError` 를 `joinLoadErrors` 로 배너에 합류(`app/page.tsx:240-244,:267` — `:268` `actionError` 배너는 별도·무변경) | closed |
| T-03-19 | Tampering | 문서 정정 누락으로 다음 매퍼가 D-12 를 되돌린다 | mitigate | `.planning/codebase/CONVENTIONS.md:51` — "**풀지 말 것**" 은 이제 `design/**` 에만 걸리고 함수 2개는 Deno 근거로 분리, "`supabase/functions/**` 로 다시 넓히지 말 것(Phase 3 이 좁혔다)" 명시; `:55` tsconfig 제외 2디렉터리 + `_shared` 3중 검사 + `TS5097`; `:71` 상대 경로 예외 3종; `:146` 기본 인자 예외 2곳; `:164` 채널 토픽 "구독 인스턴스마다 고유". 디스크의 `CLAUDE.md`: 낡은 문구 4종(`타입체크·lint가 안 돈다`·`네 곳에 흩어져 있다`·`복붙돼 있다`·`msToNextPhase`) 전부 **0**, `:41`·`:46` 이 함수 디렉터리 2개만 제외 + "다시 넓히지 말 것", `_shared` 언급 9건. 설정 파일 자체(`tsconfig.json:33`·`eslint.config.mjs:19-20`)가 문서와 일치. 잔존 드리프트 1건은 UF-03-02 로 기록 | closed |
| T-03-SC | Tampering | npm 레지스트리 → `node_modules` (공급망) | mitigate | `git diff --stat 68eedb8..HEAD -- package.json package-lock.json` → **0줄**. `node_modules/.package-lock.json` mtime `2026-09-18 15:32`(페이즈 창 `2026-09-21 11:45`~`14:57` 이전) — 설치 0회. 페이즈 창 안에 mtime 이 바뀐 `node_modules` 하위는 `next/dist`·`.vite-temp` 뿐이고 이는 이 감사가 돌린 build·vitest 의 런타임 캐시다. `npm audit` 은 네트워크 금지 제약으로 **재실행하지 않았다**(03-03-SUMMARY·03-VERIFICATION 의 `found 0 vulnerabilities` 는 서술 인용) | closed |
| T-03-LIVE | Tampering | 라이브 Supabase Edge Function · DB · `main` | mitigate | `git branch --show-current` → `feat/restaurant-roulette`. `git branch -r` 에 `origin/feat/restaurant-roulette` **없음** — 이 브랜치는 한 번도 push 되지 않았다(`origin/main`·`chore/*`·`feat/comma-multi-add`·`fix/respin-cors-deploy` 뿐). `main` == `origin/main` == `49d0643`. `git diff --name-only 68eedb8..HEAD -- supabase/migrations` → 0. `command -v supabase`·`deno` → 미설치. **플랜 전제 정정**: "CLI 가 로컬에 없어 배포될 수 없다" 는 절반만 참이다 — `~/.npm/_npx/*/node_modules/supabase`(v2.117.0, 3벌) 와 `supabase/.temp/linked-project.json`(라이브 ref `swxiqytyxjlcgubqlozk` 링크)이 존재한다. 다만 전부 `2026-09-15` mtime 이고 페이즈 시작 이후 갱신된 CLI 산출물은 0건(`find -newer 03-01-PLAN.md` → 0), 세 SUMMARY 의 명령 기록에 `functions deploy`·`db push`·`git push`·원격 SQL 0건. 페이즈 커밋 23개는 전부 워킹트리 파일(47경로: `.planning/**`·`lib/**`·`app/**`·`components/**`·`supabase/functions/**`·설정 3파일). 감사 후 `git status` = 시작 시점과 동일(`.planning/config.json`·`.serena/project.yml` 2건 M + 이 문서) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party / 후속 페이즈)*

**감사 재실행 결과(교차 증거):** `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npx vitest run` → `Test Files 10 passed (10)` / `Tests 189 passed (189)` · `npx vitest run supabase/functions/_shared/edgeImports.test.ts` → 24/24 · `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npx vitest run lib/settings.test.ts` → 28/28(`supabaseUrl is required` 0건) · `npm run build` exit 0(정적 4라우트) · Node 25.6.1 프로브 40건 throw 0. 위 표의 spec 번호들은 러너에 실제로 수집·실행되는 살아 있는 가드다. 변이 증거는 `03-VERIFICATION.md` "Adversarial Mutation Checks" M1~M20(스크래치 사본, 트리 무접촉)을 인용한다 — M1(`stalled` 잠금)·M3(`hasResult` 무시)·M4(폴백 제거)·M10(`failed` 가 `error` 숨김)·M12(경고 삼킴)·M14/M15(Edge 복붙 재삽입·확장자 제거)·M16/M17(`_shared` 상호 import)이 각각 해당 spec 에서 잡혔다.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-03-01 | T-03-05 | `pickRandom([])` 는 `undefined` 를 `T` 라고 주장한다. 두 Edge Function 이 직전에 `menus.length === 0` 을 검사하고(`spin-roulette:58`·`respin-roulette:61`) 있어 호출자 규율에 의존하는 계약이며, 동작 변경 금지 원칙(D-18)상 이 페이즈에서 throw 로 바꾸지 않았다. 전제조건은 `kst.ts:68-70` 주석에 있고 Phase 4 가 `applyCooldown` 결과를 넘길 때 빈 배열을 다시 검사한다 | 플랜 시점 disposition=accept (03-01-PLAN `<threat_model>`) | 2026-09-21 |
| R-03-02 | T-03-12 | 03-02 는 데이터를 읽거나 표시 범위를 넓히지 않는다. `stalled` 문구 5곳은 고정 한국어 리터럴 + `number` 보간(`menus.length`) 뿐이고 사용자 입력·DB 값·에러 객체를 포함하지 않는다 | 플랜 시점 disposition=accept (03-02-PLAN `<threat_model>`) | 2026-09-21 |
| R-03-03 | T-03-17 | 컷오버 전 배너에 `Could not find the table 'public.settings' in the schema cache` 가 뜨며 테이블명 하나가 노출된다. `formatLoadError` 가 `message` 만 쓰고 `details`·`hint`(SQL 조각·컬럼명)는 버리며(`lib/errors.ts:5,10-13`), 이 서비스는 익명 개방이고 스키마가 공개 레포(`supabase/migrations/**`)에 있다 — 기존 결정(Phase 1 배너 설계)과 동일 수준 | 플랜 시점 disposition=accept (03-03-PLAN `<threat_model>`) | 2026-09-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

세 SUMMARY 에 `## Threat Flags` 절이 **없다**(grep `threat` 0건). 아래는 감사자가 트리 대조 중 발견한, 플랜 레지스터에 매핑되지 않은 항목이다. **블로커 아님**(`block_on: high` — 전부 낮음/정보성) — 다음 페이즈가 인수해야 할 항목으로 남긴다.

| Flag | 위치 | 내용 | 처리 |
|------|------|------|------|
| UF-03-01 | `lib/settings.ts:71` | 파싱 경고 문장이 원본 `row.spin_time` 을 그대로 보간한다(`추첨 시각 설정값 "${row.spin_time}" 을 …`). 이 문자열은 DB/Realtime 페이로드에서 온 값이 배너에 실리는 **새 경로**다. 완화 요인: `ErrorBanner.tsx:19` 가 React 텍스트 노드로 렌더해 마크업 주입은 불가하고, `settings` 는 service_role 만 쓸 수 있으며(`0005:98-99`) 컬럼 타입이 `time` 이라 PostgREST 가 임의 문자열을 줄 수 없다. 남는 것은 길이 폭주 정도(프로브: `null`·`undefined` 도 문자열로 그대로 찍힌다) | 수용 가능. Phase 6 이 배너 문구를 다듬을 때 보간값 길이를 자르거나 `String(row.spin_time).slice(0, 32)` 형태로 상한을 둘지 결정 |
| UF-03-02 | `CLAUDE.md:46` · `supabase/config.toml` | `CLAUDE.md:46`("Edge Function 배포 플래그(`verify_jwt: false`)는 **레포에 없다** (config.toml 없음)")이 디스크와 어긋난다 — `supabase/config.toml` 은 **git 추적 파일**(`63fae89`, 페이즈 이전)이고 `[functions.spin-roulette]`·`[functions.respin-roulette]` 에 `verify_jwt = false` 가 고정돼 있다. 이 페이즈(`8a520e5`·`d36caf8`)가 그 줄을 다시 쓰면서 거짓 진술을 그대로 옮겼다. 같은 맥락으로 T-03-LIVE 의 플랜 전제("CLI 가 없어 배포 불가")도 `npx supabase@2.117.0` 캐시 + `.temp` 링크가 있어 절반만 참이다(위 표 참조). 보안 영향: 두 함수의 공개 노출 결정은 Phase 2 R-02-04 로 이미 수용됐고, 플래그가 레포에 고정돼 있는 편이 재배포 시 401 사고를 막는다 — 문서만 틀렸다 | 문서 드리프트. Phase 8 SHIP-03(문서 현행화)에서 `CLAUDE.md:46` 을 "`supabase/config.toml` 에 `verify_jwt = false` 고정" 으로 정정하고, "라이브 무접촉" 통제를 "CLI 부재" 가 아니라 "명령 미실행 + `.temp`/npx 캐시 mtime" 으로 서술할 것 |
| UF-03-03 (정보성) | `spin-roulette/index.ts:21` | 조기 반환 페이로드 `kst: now` 가 `kstNow()` 반환 확장으로 4필드 → 8필드(`year`·`month`·`day`·`weekday` 추가, 03-01-SUMMARY INFO-13). 무인증 엔드포인트의 응답 본문 변화이지만 내용은 서버 벽시계뿐이고 소비처(pg_cron)는 본문을 읽지 않는다 | 위협 아님. Phase 4 가 본문을 재작성할 때 진단 페이로드 형태를 다시 정한다 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-21 | 21 | 21 | 0 | gsd-security-auditor (플랜 시점 레지스터 3개 병합, `T-03-SC`·`T-03-LIVE` 는 세 플랜 공통이라 1건씩; 증거 = HEAD `bc79223` 트리 grep 재실행 + `tsc`/`lint`/`vitest` 189/189/`build` 재실행 + Node 프로브 40건 + git 범위·리모트·mtime 명령 + `03-REVIEW.md` Fix Log 커밋 대조 + `03-VERIFICATION.md` 변이 M1~M20 인용. 구현 파일 무수정, 임시 파일 잔존 0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] 미등록 공격면 2건 + 정보성 1건은 Unregistered Flags 에 기록(블로커 아님, Phase 6·8 인수)

**Approval:** verified 2026-09-21
