# Codebase Concerns

**Analysis Date:** 2026-09-18

전수 조사 기준: 앱 소스 ~2,200줄 (`app/`, `components/`, `lib/`), Edge Function 243줄, 마이그레이션 4개 133줄.
검증 결과 `npx tsc --noEmit` **통과**, `npm run lint` **통과**(에러 0). 테스트 러너·CI는 존재하지 않는다.

---

## Tech Debt

### [P1] 추첨 시각 "11:55"이 8개 파일 11곳에 하드코딩

- Issue: 단일 상수 출처가 없다. 로직 2곳 + cron 1곳 + UI 문구 6곳 + 문서 2곳으로 흩어져 있고, 서로 다른 표현(숫자 상수 / cron 표현식 / 한글 문장 / SVG 텍스트)이라 grep 한 번으로 전부 잡히지도 않는다. `CLAUDE.md`는 "네 곳"이라고 적혀 있으나 실제로는 더 늘어났다.
- Files:
  - 로직: `lib/phase.ts:14-16` (`SPIN_HH`/`SPIN_MM`/`SPIN_ANIM_SEC`), `supabase/functions/spin-roulette/index.ts:12-13`
  - 스케줄: `supabase/migrations/0002_cron.sql:20` (`'55 2 * * *'` UTC)
  - UI(감사 시점): `app/page.tsx`의 `phaseSubhead` 2곳, `app/layout.tsx:6`, `components/PhaseTimeline.tsx:9-10`, 구 `MenuList` 2곳, `components/Wheel.tsx:258`, `components/ResultBlock.tsx:13`(prop 기본값)
  - 문서: `README.md:3,8,53,55`, `CLAUDE.md`
- Impact: 시각을 바꾸면 일부만 고쳐질 확률이 매우 높다. UI 문구와 실제 동작이 어긋나도 타입체크·lint·빌드 어디에도 걸리지 않고, 사용자만 혼란을 겪는다. cron만 빠뜨리면 추첨 자체가 엉뚱한 시간에 돈다.
- Fix approach: `lib/spinTime.ts`(가칭)에 `SPIN_HH`/`SPIN_MM`/`SPIN_LABEL`("11:55")을 한 번만 정의하고 `lib/phase.ts`·모든 UI가 `SPIN_LABEL`을 import 하게 바꾼다. `components/ResultBlock.tsx`의 `spinTime` prop 기본값도 이 상수로 교체. Deno 쪽(`spin-roulette`)은 파일 공유가 안 되므로 상수 위치를 주석으로 상호 참조하고, cron 표현식은 `0002_cron.sql` 주석에 "KST HH:MM = UTC HH:MM" 계산식을 남긴 현재 방식을 유지한다.
- **해소 (Resolved, Phase 6 / SPIN-06, 2026-09-29):** 값 정의처는 `supabase/functions/_shared/spinTime.ts`의 `DEFAULT_SPIN_TIME` 한 곳이 됐고(Deno·클라이언트가 같은 파일을 본다), 런타임 값은 `settings.spin_time`이 이긴다. 화면 문구는 `lib/time.ts`의 `formatSpinTime`·`addMinutesToSpinTime`가 조립해 **prop 으로만** 내려가고 기본값이 없다. 수용 기준 grep — `grep -rn '11:55' app components lib --include='*.ts' --include='*.tsx' | grep -v '//' | grep -vF '.test.ts'` → **0줄**. 남은 리터럴은 근거 주석·테스트 기대값·`_shared/spinTime.ts`의 기본 상수·DB 쪽 기본값(`0002_cron.sql`의 `'55 2 * * *'`, `0005`의 `spin_time`)뿐이고, 마지막 갈래는 의도적으로 남긴다(DB 기본값은 앱이 못 읽을 때의 착지점이다).

### [P2] Edge Function 간 유틸 복붙 (`kstNow`, `pickRandom`)

- Issue: 두 함수가 동일한 `kstNow()`(19줄)와 `pickRandom()`(5줄)을 글자 단위로 복제하고 있다. Deno 런타임이라 `lib/time.ts`를 공유할 수 없다는 제약은 사실이나, Deno는 `supabase/functions/_shared/` 패턴으로 파일 공유가 가능하다.
- Files: `supabase/functions/spin-roulette/index.ts:17-46`, `supabase/functions/respin-roulette/index.ts:37-61`
- Impact: KST 처리 버그를 한쪽만 고치면 다른 쪽이 조용히 어긋난다. 두 함수 모두 타입체크·lint 대상에서 제외돼 있어(`tsconfig.json:33`, `eslint.config.mjs:17`) 정적 검사도 못 잡는다.
- Fix approach: `supabase/functions/_shared/kst.ts`로 추출해 양쪽에서 `import { kstNow, pickRandom } from "../_shared/kst.ts"`. Supabase CLI는 `_` 접두사 디렉터리를 함수로 배포하지 않고 번들에 포함시킨다. 추출 후 두 함수 모두 재배포 필요.

### [P2] `MENU_NAME_MAX_LEN` 24가 3곳에 중복 정의

- Issue: 클라이언트 상수 1곳 + DB check 제약 2곳이 같은 숫자를 각각 들고 있다. `lib/supabase/client.ts:12` 주석이 "여기서만 정의한다"고 선언하지만 실제로는 DB가 진짜 정본이다.
- Files: `lib/supabase/client.ts:13`, `supabase/migrations/0001_init.sql:4` (`menus.name`), `supabase/migrations/0004_pinned_menus.sql:5` (`pinned_menus.name`)
- Impact: DB 제약만 늘리면 클라이언트가 계속 잘라 보내고(`lib/menus.ts`의 절단), 클라이언트만 늘리면 insert가 23514로 실패한다. 후자는 `actionError`로 노출되지만 메시지가 raw Postgres 에러다.
- Fix approach: 값 변경 시 3곳을 한 커밋에 묶는다. 식당 카탈로그 전환 때 이름 길이가 24자를 넘을 가능성이 크므로 그 마이그레이션에서 함께 재검토.
- **부분 해소 (Phase 1·5·6):** 클라이언트 정의처가 `lib/constants.ts:9`의 `MENU_NAME_MAX_LEN` 한 곳으로 모였고 `lib/restaurants.ts`의 `parseRestaurantForm`이 23514 를 사람 말로 번역한다. 구 `menus`·`pinned_menus` 쪽 check 두 곳은 컷오버(Phase 8)에서 테이블과 함께 사라지고, 그 뒤에는 `0005`의 `restaurants.name`·`restaurants.menus` 원소 제약 2곳과 상수 1곳이 남는다 — **여전히 수동 동기화**다.

### [P2] `ResultRow.candidates` jsonb 스키마가 5개 지점에 암묵 가정으로 퍼져 있다

- Issue: `{ name: string }[]` 형태가 타입 선언 1곳, 생산 2곳(Edge Function), 소비 2곳에서 각각 독립적으로 가정된다. DB는 `jsonb not null`일 뿐 형태를 강제하지 않는다.
- Files: 선언 `lib/supabase/client.ts:21-27` / 생산 `supabase/functions/spin-roulette/index.ts:98`, `supabase/functions/respin-roulette/index.ts:91` / 소비 `components/CalendarLog.tsx:223,248,251`, `app/page.tsx:260`
- Impact: 형태를 바꾸면 Edge Function은 타입체크 밖이라 컴파일 에러가 안 나고, 다음 날 11:55에 처음 드러난다. 기존 행과 신규 행의 형태가 섞이면 캘린더 상세가 조용히 빈칸이 된다(`?.` 옵셔널 체이닝으로 방어돼 있어 에러조차 안 난다).
- Fix approach: `candidates` 스키마 변경 시 반드시 (a) 옵셔널 필드로 추가 → (b) 과거 행 백필 → (c) 필수화 3단계로 나눈다. `lib/supabase/client.ts`에 `type Candidate` 를 따로 export 해 소비 지점이 인라인 추론에 의존하지 않게 한다.

### [P2 → 해소됨, Phase 4~8] 정본 문서(`CLAUDE.md`, `README.md`)가 코드보다 뒤처져 있다

- 해소: `CLAUDE.md` 는 Phase 4~7 이 페이즈마다 정정했고, `README.md` 는 Phase 8 이 전면 개정했다(4테이블·RLS·cron 3종·함수 2종·검증 명령 5종·컷오버 절차·롤백). 아래 표는 2026-09-18 감사 시점의 기록으로 남긴다.
- Issue(당시): 2026-09-15/16 수정 이후 문서가 갱신되지 않아, 지금 읽으면 **이미 고쳐진 문제를 남아 있는 문제로 오인**하게 된다. 확인한 불일치:
  | 문서 진술 | 실제 (2026-09-18 검증) |
  |---|---|
  | `CLAUDE.md:25` "lint 에러 1건 존재 (`components/Wheel.tsx`)" | `npm run lint` 에러 0. `Wheel.tsx:55-63`은 state+effect를 버리고 props 파생값으로 재작성됨 |
  | `CLAUDE.md:41` "config.toml 없음 — `--no-verify-jwt` 잊지 말 것" | `supabase/config.toml` 존재, 두 함수 모두 `verify_jwt = false` 고정 |
  | `CLAUDE.md:55` "`app/log`, `app/rank`는 INSERT만 구독" | 양쪽 모두 UPDATE 구독 추가됨 (`app/log/page.tsx:63-70`, `app/rank/page.tsx:48-54`) |
  | `CLAUDE.md:59` "클라이언트 쓰기 에러를 확인하지 않는다" | `actionError` state로 전부 노출 (`app/page.tsx:32,147-209,236-248`) |
  | `CLAUDE.md` "11:55은 네 곳" | 감사 시점 실제 11곳. Phase 6 이후 화면 갈래가 0곳이 되고 `CLAUDE.md`도 그에 맞춰 갱신됐다 (위 [P1] 해소 줄 참조) |
  | `README.md:51` "테이블: `menus`, `results`" | `pinned_menus` 누락 (`supabase/migrations/0004_pinned_menus.sql`) |
  | `README.md:54` "`reset-menus` → `menus` truncate" | truncate **+ `pinned_menus` 재시드** 로 변경됨 (`0004_pinned_menus.sql:28-36`) |
  | `README.md:55` Edge Function 1개만 기술 | `respin-roulette` 누락 (CORS 처리·시간 가드 없음이라는 중요 사실 포함) |
- Files: `CLAUDE.md`, `README.md`
- Impact: 신규 작업자(사람·에이전트 모두)가 이미 해결된 항목을 다시 고치거나, 반대로 `respin-roulette`·`pinned_menus`의 존재를 모른 채 스키마를 건드린다. 식당 카탈로그 전환처럼 DB를 손대는 작업에서 특히 위험하다.
- Fix approach: 전환 작업 착수 전에 위 표대로 두 문서를 한 커밋에 정정한다. `CLAUDE.md`의 "위험 지점" 표는 본 문서로 포인터만 남기고 중복을 제거하는 편이 유지보수에 낫다.

### [P3] 미사용 코드

- `lib/phase.ts:29-38` `msToNextPhase` — 참조 0. 1초 `setInterval` 대신 쓰려다 만 흔적으로 보인다. 아래 [성능] 항목의 해법으로 쓰거나 삭제한다.
- `components/Wheel.tsx:15,65-69` `onSpinCompleteAction` — 유일한 호출부 `app/page.tsx:255`가 이 prop을 넘기지 않는다. `useEffect`가 매번 `setTimeout`을 걸고 아무것도 하지 않는다.
- Impact: 낮음. 다만 `Wheel`의 effect는 "회전 완료 시점"이라는 존재하지 않는 계약을 암시해 오해를 부른다.
- Fix approach: `app/page.tsx`의 `forceSpin` 해제 타이머(`app/page.tsx:64`)를 이 콜백으로 옮기거나, 둘 다 삭제한다.

### [P3] 회전 시간 상수가 두 곳에서 어긋난다

- Issue: `components/Wheel.tsx:20` `SPIN_MS = 4800`, `lib/phase.ts:16` `SPIN_ANIM_SEC = 5`, `app/page.tsx:64` `setTimeout(..., 5000)` — 애니메이션 길이가 세 곳에 따로 있다.
- Files: `components/Wheel.tsx:20`, `lib/phase.ts:16`, `app/page.tsx:64`
- Impact: 현재는 5000 > 4800이라 시각적으로 문제없다. 하나만 줄이면 회전 중 휠이 먼저 멈추거나, 결과 표시가 늦어진다.
- Fix approach: 위 [P1]의 공통 상수 모듈에 `SPIN_ANIM_MS`를 넣고 셋을 파생시킨다.

---

## Known Bugs

### [P1] 후보 0개로 11:55을 넘기면 하루 종일 복구 불가

- Symptoms: 결과가 확정되지 않았는데 UI는 `decided`로 넘어간다. 메뉴 입력창이 비활성(`readOnly`)이 되고, "다시 돌리기" 버튼은 `todayResult`가 있어야만 렌더되므로 나타나지 않는다. 화면에는 "오늘의 점심"이라는 빈 헤드라인과 빈 서브헤드만 남는다(`app/page.tsx:335,344`). 자정 재시드 전까지 어떤 조작으로도 복구되지 않는다.
- Files: `supabase/functions/spin-roulette/index.ts` (`skipped: "no_candidates"` 반환, results 행 미생성), `lib/phase.ts` (시각만으로 `decided` 판정), 구 `MenuList` (`readOnly = phase !== "accepting"`), `app/page.tsx` (respin 버튼 조건)
- Trigger: 11:55 이전에 아무도 메뉴를 추가하지 않았거나(고정 메뉴도 0개), 누군가 11:55 직전에 전부 삭제했을 때. RLS가 열려 있어 삭제는 누구나 가능하다([보안] 참조).
- Workaround: 없음. 운영자가 직접 `results`에 행을 넣거나, `respin-roulette`를 curl로 호출해야 한다(후보가 없으면 이것도 `no_candidates`로 스킵되므로 먼저 메뉴를 넣어야 한다).
- Fix approach: (a) `todayResult == null && phase !== "accepting"` 상태를 별도 `stalled` 페이즈로 인식해 입력창을 계속 열어두고, (b) 그 상태에서 "지금 돌리기" 버튼으로 `respin-roulette`를 호출할 수 있게 한다. `respin-roulette`는 시간 가드가 없으므로 그대로 재사용 가능하다.
- **해소 (Resolved, Phase 3·4·6 / SPIN-03, 2026-09-29):** (a) 는 `lib/phase.ts`의 `stalled` + `isCandidateListLocked("stalled") === false` 로 들어갔고 `components/CandidateList.tsx`의 토글이 그 구간에서 살아 있다. (b) 는 **두지 않기로 했다**(D-19) — pg_cron 이 추첨 시각 이후 **매분** `spin-roulette` 를 부르므로 후보를 담으면 1분 안에 서버가 뽑는다. 수동 버튼은 같은 일을 하는 두 번째 경로를 여는 비용만 남는다. `ResultBlock`의 `stalled` 문구가 그 사실을 사람 말로 알린다.

### [P2] 자정 `truncate`가 실시간으로 전파되지 않아 열린 탭이 유령 메뉴를 보여준다

- Symptoms: 자정을 넘긴 시점에 열려 있던 탭이 어제 메뉴 목록을 계속 표시하고, 그 위에 재시드된 고정 메뉴 INSERT 이벤트가 덧붙어 중복 항목으로 보인다.
- Files: `supabase/migrations/0004_pinned_menus.sql:32-34` (`truncate table public.menus;` 후 재시드), `app/page.tsx:80-87` (DELETE 이벤트 기반 제거), `app/page.tsx:37-55` (`todayKey` 변경 시 재조회)
- Trigger: Postgres `TRUNCATE`는 논리 복제에서 행 단위 DELETE 메시지를 내지 않으므로 Realtime `postgres_changes`의 DELETE 핸들러가 호출되지 않는다. 클라이언트는 `todayKey`가 바뀌면서 재조회를 시도하지만, cron(UTC 15:00)과 클라이언트의 1초 tick이 같은 순간에 경쟁한다. 재조회가 truncate보다 먼저 끝나면 stale 목록이 남는다.
- Workaround: 새로고침.
- Fix approach: cron SQL을 `truncate` 대신 `delete from public.menus;`로 바꾸면 행 단위 DELETE가 복제돼 실시간 반영된다(행 수가 수십 개 수준이라 성능 차이 무의미). 또는 클라이언트가 `todayKey` 변경 후 수 초 뒤 한 번 더 재조회한다.

### [P2] `menus.name`에 unique 제약이 없어 동시 추가 시 중복 행이 생긴다

- Symptoms: 같은 메뉴가 휠에 두 조각으로 나타나 당첨 확률이 2배가 되고, 목록에도 두 줄로 보인다. 핀 아이콘은 이름 기준(`pinnedNames.has(m.name)`)이라 두 행이 함께 켜지는데 삭제는 id 기준이라 한 줄만 사라진다.
- Files: `supabase/migrations/0001_init.sql:2-6` (unique 없음), `lib/menus.ts:20` (`parseMenuInput` 중복 제거는 **클라이언트가 현재 로드한 목록** 기준일 뿐), 구 `MenuList`의 핀 상태 판정, `app/page.tsx`의 `winnerIndex`
- Trigger: 두 사용자가 거의 동시에 같은 이름을 추가. 또는 한 사용자의 탭이 Realtime 이벤트를 받기 전에 다른 탭에서 추가.
- Workaround: 중복된 한 줄을 수동 삭제.
- Fix approach: `create unique index on public.menus (name);` 추가 후, 클라이언트 insert 실패(23505)를 "이미 있는 메뉴"로 번역해 조용히 무시한다. 식당 카탈로그 전환 시 자연스럽게 해결되는 항목이므로 그 마이그레이션에 포함시키는 편이 낫다.
- **해소 (Resolved, Phase 2·5·6, 2026-09-29):** 예상대로 카탈로그 전환이 닫았다. 오늘 후보는 `candidates.restaurant_id` 가 **PK** 라 같은 매장이 두 번 담기지 못하고, 동시 담기의 `23505` 는 `formatCandidateWriteError` 가 `null` 로 번역해 화면에 실패로 뜨지 않는다(원하던 상태가 이미 됐다). 휠 조각이 두 개로 갈리는 경로 자체가 사라졌다. 구 `menus` 테이블의 unique 부재는 컷오버(Phase 8)에서 테이블과 함께 없어진다.

### [P3] `winnerIndex`가 이름 매칭이라 당첨 메뉴가 삭제되면 휠 하이라이트가 사라진다

- Symptoms: `menus.findIndex((m) => m.name === todayResult.menu)`가 -1이 되어 휠이 정지 각도 0으로 돌아가고 당첨 라벨 박스가 렌더되지 않는다. 결과 텍스트(`ResultBlock`)는 남으므로 화면이 서로 모순된 상태가 된다.
- Files: `app/page.tsx:127-130`, `components/Wheel.tsx:50-63`, `components/Wheel.tsx:167`
- Trigger: 확정 후에는 UI에서 삭제 버튼이 숨겨지지만 다른 탭·다른 사용자·직접 API 호출로는 여전히 삭제 가능하다(RLS 개방). 중복 이름이면 첫 번째 행이 당첨으로 표시돼 실제 당첨 조각과 다를 수 있다.
- Workaround: 없음(표시 문제).
- Fix approach: `results`에 당첨 메뉴 id를 함께 저장하고 id로 매칭한다. 식당 카탈로그 전환 시 필수로 함께 처리할 항목.
- **해소 (Resolved, Phase 2·4·6, 2026-09-29):** `results.restaurant_id`(0005:66-69)가 생겼고 `lib/candidates.ts`의 `findWinnerIndex`가 **그 식별자로만** 찾는다(이름 폴백 없음 — 동명 매장 오인이 구조적으로 불가능하다). 매장이 지워지면 `on delete set null` 로 -1 이 되어 하이라이트만 사라지고 이름 스냅샷은 남는데, **그것이 의도한 화면**이다(CATL-03). 같은 UPDATE 가 휠을 재회전시키던 파생 문제는 `isNewSpin` 가드가 막는다.

### [P3] 고정(핀)만 남고 메뉴를 삭제하면 당일 핀 해제 경로가 사라진다

- Symptoms: `pinned_menus`에는 이름이 남아 있는데 `menus`에 해당 행이 없으면 핀 버튼이 렌더되지 않아 해제할 방법이 없다. 다음 날 자정 재시드로 다시 등장한 뒤에야 해제 가능.
- Files: 구 `MenuList` (핀 버튼은 오늘 목록 행에만 붙었다), `app/page.tsx`의 구 핀 토글
- Trigger: 고정된 메뉴를 오늘 목록에서 삭제.
- Workaround: 같은 이름을 다시 추가한 뒤 핀 해제.
- Fix approach: 목록 하단에 "고정 목록" 섹션을 따로 두고 `pinnedNames` 전체를 노출한다.
- **해소 (Resolved, Phase 5·6, 2026-09-29):** 핀이 오늘 목록이 아니라 **카탈로그 행의 속성**(`restaurants.pinned`)이 됐고 토글은 매장 탭 한 곳에만 있다. 카탈로그는 자정에 지워지지 않는 영구 테이블이라 "오늘 목록에서 빠져서 해제할 수 없는" 상태가 성립하지 않는다. 오늘 후보에서 빼도 📌 는 매장 탭에 그대로 남는다.

### [P3] 동시 핀 토글이 raw Postgres 에러로 노출된다

- Symptoms: 두 사용자가 같은 이름을 동시에 고정하면 한쪽이 `duplicate key value violates unique constraint "pinned_menus_pkey"` 를 그대로 본다.
- Files: `app/page.tsx:182-186`, `supabase/migrations/0004_pinned_menus.sql:4-7` (name PK)
- Fix approach: insert를 `upsert({ name }, { onConflict: "name", ignoreDuplicates: true })`로 바꾼다. 삭제도 이미 존재하지 않는 행이면 무해하므로 그대로 둔다.

---

## Security Considerations

### [P1] `respin-roulette`가 인증·시간 가드·레이트리밋 없이 공개 노출

- Risk: `verify_jwt = false`(`supabase/config.toml:14-15`) + CORS `Access-Control-Allow-Origin: *`(`supabase/functions/respin-roulette/index.ts:22`) + 시간 가드 없음 + 멱등성 없음. URL만 알면 누구나(브라우저·curl 무관, 키조차 불필요) 무한히 POST 해서 오늘 결과를 계속 덮어쓸 수 있다.
- Files: `supabase/functions/respin-roulette/index.ts:63-113`, `supabase/config.toml:14-15`
- Current mitigation: 없음. `CLAUDE.md:44`가 "익명 서비스 설계상 수용"이라고 명시적으로 선언한 트레이드오프다.
- Recommendations (사내 소규모 사용에도 최소한 아래 2개는 권장):
  1. 호출 빈도 제한 — `results.spun_at` 을 읽어 직전 재추첨 후 N초(예: 10초) 이내면 `skipped: "cooldown"` 반환. 함수 내부에서 완결되므로 인프라 추가 불필요.
  2. 오늘 결과가 없으면 거부 — 현재는 결과가 없는 날에도 새 행을 만든다. `spin-roulette`의 시간 가드를 우회해 오전 중 결과를 조기 확정시킬 수 있다.
  3. (선택) `Access-Control-Allow-Origin`을 배포 도메인으로 좁힌다. CORS는 브라우저 보호일 뿐 curl은 막지 못하나, 타 사이트에서의 임베드 남용은 줄인다.

### [P2] `menus` / `pinned_menus` 익명 insert·delete 전면 개방

- Risk: 누구나 오늘 후보 전체를 삭제하거나(→ 위 [Known Bugs] P1 유발), 임의 개수를 삽입할 수 있다. 고정 메뉴는 매일 자동 등록되므로 악의적 핀은 영구 오염이 된다.
- Files: `supabase/migrations/0001_init.sql:26-28`, `supabase/migrations/0004_pinned_menus.sql:11-13`
- Current mitigation: `char_length(name) between 1 and 24` 제약과 URL 비공개성뿐. 삽입 개수·빈도 제한 없음.
- Recommendations: 서비스 성격상 전면 잠금은 부적절하므로, (a) `pinned_menus` 총 행 수 상한을 트리거로 강제(예: 30개), (b) `menus` 1일 삽입 상한을 트리거로 강제, (c) 삭제는 `created_at > now() - interval '1 hour'` 처럼 최근 추가분으로 제한하는 정책을 검토한다.

### [P2] 로깅은 들어왔고 알림은 여전히 없다

- Risk: Edge Function 양쪽의 500·폴백 경로에 `console.error`가 들어갔다(Phase 4 — spin 7지점·respin 5지점, 규약은 `CLAUDE.md` 코드 컨벤션). 남는 위험은 **알림**이다: `net.http_post`는 응답을 확인하지 않는 fire-and-forget이라 실패가 cron 쪽에 남지 않고, 대시보드 로그는 사람이 열어야 보인다. 추첨이 며칠째 멈춰도 사용자가 화면을 보고 알아채야 한다.
- Files: `supabase/migrations/0002_cron.sql:22-26` (`net.http_post` 결과 미검사), `supabase/functions/spin-roulette/index.ts`·`respin-roulette/index.ts` (`console.error` + 응답의 폴백 플래그 3키)
- Current mitigation: Edge Function 콘솔 에러 → Supabase 대시보드 로그(수동 조회), `cron.job_run_details`, ok 응답에 상시 실리는 `settings_fallback`·`cooldown_fallback`·`cooldown_skipped`.
- Recommendations: `net._http_response`를 주기적으로 확인하는 cron 잡이나, 결과가 없는 날을 감지하는 12:10 헬스체크 잡을 검토한다(둘 다 Phase 4 범위 밖). 그 전에 **배포 후 대시보드 로그에 1건이 실제로 보이는지** 확인한다 — 아직 두 함수가 배포되지 않아 이 경로는 한 번도 관측되지 않았다(Phase 8).

### [P3] 시크릿 관리

- `.env.local`(143 bytes) 존재. `.gitignore:31-32`가 `.env*`를 제외하고 `.env.example`만 허용하므로 커밋 위험은 없다. 내용은 확인하지 않았다.
- `README.md:43-44`에 Supabase 프로젝트 URL과 publishable key 접두사(`sb_publishable_…`)가 적혀 있다. publishable key는 공개 전제라 유출은 아니지만, 프로젝트 ref가 문서·마이그레이션(`supabase/migrations/0002_cron.sql:23`)에 하드코딩돼 있어 [Fragile Areas] 참조.
- `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 런타임 환경변수로만 사용되며 클라이언트 번들에는 없다(`supabase/functions/*/index.ts:59-61,72-73`). 구조상 올바르다.

---

## Performance Bottlenecks

### [P2] 1초 tick × Intl.DateTimeFormat 매회 신규 생성

- Problem: 3개 페이지 모두 1초마다 `setNow(new Date())`로 전체 트리를 리렌더한다. 그 리렌더마다 `lib/time.ts`의 헬퍼가 **매 호출 새 `Intl.DateTimeFormat` 인스턴스를 만든다**(`lib/time.ts:6-7`은 팩토리 함수이지 캐시가 아니다, `lib/time.ts:39-49`도 인라인 생성).
- Files: `lib/time.ts:6-7,39-49`, `app/page.tsx:19-25` (`todayKstDate`+`currentPhase`+`formatHhMmSs`+`formatKstLongDay` = 초당 최소 4개 생성), `app/log/page.tsx:12-19`, `app/rank/page.tsx:12-18`
- Cause: `Intl.DateTimeFormat` 생성은 포맷 실행보다 수십 배 비싸다. 메뉴 20개 기준 초당 25개 내외의 포맷터가 생성·폐기되며, 여기에 `Wheel`의 SVG(슬라이스 N개 + 눈금 N개 + 라벨 N그룹)가 `React.memo` 없이 매초 전체 재조정된다.
- Improvement path:
  1. `lib/time.ts`의 포맷터를 모듈 레벨 상수로 캐시한다(옵션 조합이 4종뿐이라 단순 상수화로 충분). 가장 비용 대비 효과가 크다.
  2. 행마다 시간 문자열을 만들던 자리는 Phase 6 이 없앴다 — 오늘 후보 행은 담은 시각을 표시하지 않고 순서로 대신한다(D-13). 행당 `new Date()` N개가 사라졌다.
  3. `Wheel`을 `React.memo`로 감싸고, `app/page.tsx`가 넘기는 props가 초당 변하지 않게 유지한다(현재 `items`/`phase`/`winnerIndex`는 이미 안정적).
  4. 근본적으로는 `lib/phase.ts:29-38`의 미사용 `msToNextPhase`를 써서 "다음 전환까지 한 번만 타이머"로 바꾸되, 시계 표시(`clockTime`)는 별도 컴포넌트로 분리해 1초 리렌더 범위를 좁힌다.

### [P2 → 완화됨, Phase 7] `app/rank/page.tsx`의 `results` 조회 범위

- 현재: 컬럼 4개(`id,date,menu,restaurant_id`)로 좁혔고 `.gte("date", min(history_since, 오늘))` 로 기간을 잘랐다. 전환일 이후 하루 1행이라 PostgREST 행 상한(1,000)까지 약 3년.
- 남은 것: 상한에 닿아도 **에러 없이 조용히 틀린다**는 성질은 그대로다. 그 전에 명시적 `limit` 또는 서버 집계 view 로 옮긴다.

### [P3] 외부 CDN 폰트 2종을 CSS `@import`로 로드

- Problem: `app/globals.css:2-3`이 jsdelivr(Pretendard)와 Google Fonts(JetBrains Mono)를 런타임 `@import`로 가져온다. 렌더 블로킹이며 외부 가용성에 의존한다. Next의 `next/font` 최적화(self-hosting, preload, CLS 방지)를 전혀 받지 못한다.
- Files: `app/globals.css:2-3`
- Improvement path: `next/font/local`(Pretendard)·`next/font/google`(JetBrains Mono)로 전환하고 `--font-sans`/`--font-mono` 토큰에 주입한다.

---

## Fragile Areas

### [P2] Edge Function은 타입 검사 안으로 들어왔지만 한 줄도 실행된 적이 없다

- Files: `supabase/functions/spin-roulette/index.ts`, `supabase/functions/respin-roulette/index.ts`
- Why fragile: `npm run check:edge`(`deno check --config supabase/functions/deno.json`)가 두 `index.ts`를 검사하고 `_shared/*.ts`까지 전이 검사한다(Phase 4). `tsconfig.json`·`eslint.config.mjs`의 제외는 **함수 디렉터리 2개로 좁혀져** `_shared/**`는 3중 검사를 받는다 — 남은 것은 eslint 사각지대뿐이다. 진짜 위험은 정적 검사가 아니라 **실행**이다: 로컬 Supabase 스택이 없어 이 두 파일은 한 줄도 실행돼 본 적이 없는데, 이것이 **제품의 유일한 쓰기 경로**다. [P1]에서 [P2]로 강등한 근거가 딱 여기까지다.
- Safe modification: 수정 후 `npm run check:edge`(exit 0) + `npx vitest run supabase/functions/_shared/edgeImports.test.ts`(텍스트 계약 58건). 배포 후에는 `curl -X POST <url>/functions/v1/respin-roulette`로 실제 응답을 확인한다. `spin-roulette`는 시간 가드 때문에 추첨 시각 이전엔 `skipped: "before_spin_time"`만 돌아오므로 정상 경로를 검증할 수 없다 — 그래서 `respin` 쪽이 컷오버의 유일한 검증 창이다.
- Test coverage: 텍스트 계약 58건 + 전이 타입 검사(리뷰 후 `5b11547`: `console.error` spin 8·respin 6 정확 개수, 쿨다운 창 경계, respin 405 가드 고정). **동작 0.**

### [P1] `supabase/migrations/0002_cron.sql`의 프로젝트 ref 하드코딩 + cron 잡 정본의 분산

- Files: `supabase/migrations/0002_cron.sql:23` (`https://swxiqytyxjlcgubqlozk.supabase.co/...`), `supabase/migrations/0003_reseed_menus.sql`, `supabase/migrations/0004_pinned_menus.sql:21-36`
- Why fragile: (a) 다른 Supabase 프로젝트로 옮기면 URL 치환 필수. (b) `reset-menus` 잡의 실제 정의가 0002 → 0003 → 0004로 세 번 재정의돼, **현재 무엇이 도는지 알려면 가장 마지막 마이그레이션을 찾아야 한다.** 파일명(`0003_reseed_menus`)만 봐서는 0004에 의해 무효화됐음을 알 수 없다. (c) `'55 2 * * *'`가 UTC라는 전제는 DB 타임존이 UTC일 때만 성립하며, 이 전제는 주석에만 있다.
- Safe modification: cron 잡을 바꿀 때는 반드시 새 마이그레이션에서 "기존 unschedule → 재등록" 패턴을 유지하고, 적용 후 `select jobname, schedule, command from cron.job;`로 실제 상태를 확인한다. 마이그레이션 파일이 곧 현재 상태가 아니라는 점을 잊지 말 것.
- Test coverage: 0. 로컬 Supabase 스택 사용 흔적 없음(`supabase/.temp/linked-project.json`만 존재) — 마이그레이션은 사실상 **프로덕션에 직접 적용**된다.

### [P2] `app/page.tsx` realtime 핸들러 + `initialLoadedRef` + `forceSpin` 타이머

- Files: `app/page.tsx:37-55` (초기 로드), `app/page.tsx:57-125` (6개 구독), `app/page.tsx:59-66` (`applyResult`)
- Why fragile:
  - `initialLoadedRef.current`가 true가 되기 전에 도착한 INSERT는 회전 애니메이션 없이 결과만 반영된다. 초기 로드가 느린 회선에서 11:55 정각에 접속하면 애니메이션을 놓친다.
  - `setTimeout(() => setForceSpin(false), 5000)`(`app/page.tsx:64`)에 cleanup이 없다. 5초 내 재추첨이 두 번 오면 첫 타이머가 두 번째 회전을 조기 종료시키고, 언마운트 후에도 타이머가 살아 있다.
  - 두 effect 모두 `todayKey` 의존이라 자정에 재구독된다 — 위 [Known Bugs] P2의 경쟁 조건 지점.
- Safe modification: 핸들러 순서·`initialLoadedRef` 세팅 시점을 바꾸지 말 것. 타이머를 만지려면 `useRef`에 보관하고 이전 타이머를 `clearTimeout` 한 뒤 재설정한다.
- Test coverage: 0. 이 로직은 브라우저 2개를 띄워 수동 확인하는 수밖에 없다.

### [P2] `components/Wheel.tsx` 회전 상태 머신

- Files: `components/Wheel.tsx:49-69`
- Why fragile: 회전 각도가 `phase`·`winnerIndex`의 순수 파생값이고, "굴러가는 느낌"은 CSS transition의 유무(`isSpinning`)에만 의존한다. `spinJitter`(`Wheel.tsx:25-28`)는 `Math.random()`이 렌더 순수성 lint에 걸려 황금비 해시로 대체한 것이라, 같은 `winnerIndex`면 항상 같은 각도로 멈춘다(재추첨 시 같은 메뉴가 나오면 휠이 미동도 하지 않는다 — 실제 관측 가능한 현상).
- Safe modification: `rotation` 계산을 state로 되돌리지 말 것(`react-hooks/set-state-in-effect` 재발). 재추첨 시 회전을 보장하려면 `spun_at`을 jitter 입력에 섞는 편이 안전하다.
- Test coverage: 0.

### [P3] `lib/time.ts` 우회 — 캘린더가 로컬 `Date` 생성자를 직접 사용

- Files: `components/CalendarLog.tsx:18-21` (`new Date(year, month - 1, 1)`, `.getDay()`, `.getDate()`), `components/CalendarLog.tsx:221-222` (`new Date(y, m - 1, d).getDay()`)
- Why fragile: 현재 동작은 **정확하다**(로컬 자정으로 생성한 Y/M/D의 요일은 타임존과 무관하게 맞다). 하지만 `CLAUDE.md:32`가 금지한 패턴이고, 여기에 시·분을 섞는 순간 조용히 틀려진다. 그 회귀를 잡아줄 테스트가 없다.
- Safe modification: 이 파일에서 시각(hour/minute)을 다루게 되면 즉시 `lib/time.ts`의 `kstParts`로 옮긴다.
- Test coverage: 0.

---

## Scaling Limits

**`results` 테이블 (영구 누적):**
- Current capacity: 하루 1행. 보고된 기존 데이터 약 60행(일부 테스트 데이터 포함 — 로컬에서는 검증 불가, 전환 전 실제 조회 필요).
- Limit: `app/rank/page.tsx:24-28`의 무제한 조회가 PostgREST 기본 행 상한(통상 1,000)에 걸리는 약 3년 시점. 에러 없이 랭킹이 틀려진다.
- Scaling path: 위 [Performance] 참조 — 집계 view 또는 명시적 기간 필터.

**`menus` 테이블 (일일 초기화):**
- Current capacity: 수십 행 가정. 휠은 항목당 SVG path 1 + 눈금선 1 + 라벨 그룹 1을 렌더한다(`components/Wheel.tsx:121-153,163-208`).
- Limit: 삽입 제한이 없어 악의적/실수로 수백~수천 행이 들어가면 휠 라벨이 겹쳐 판독 불가가 되고 초당 리렌더와 겹쳐 브라우저가 멈춘다. 목록은 `maxHeight: 380` 스크롤이라 UI상 경고도 없다.
- Scaling path: 삽입 상한 트리거 + 휠에 표시 항목 수 상한(초과 시 "외 N개" 처리).

**Supabase 무료 티어:**
- Limit: Edge Function 호출 수·Realtime 동시 접속·DB 용량. `respin-roulette`가 무인증 공개라 호출 수는 외부에서 임의로 소진시킬 수 있다([보안] P1).
- Scaling path: 쿨다운 도입이 곧 쿼터 방어다.

---

## Dependencies at Risk

**`next` 16.2.6 — critical 등급 권고 존재:**
- Risk: `npm audit` 기준 **critical 1 / high 6 / moderate 1 / low 1 (총 9건)**. 직접 의존성 중 `next`가 critical(App Router 미들웨어 우회, Server Actions DoS 등 다수 권고 묶음). 전이 의존성 중 `postcss`·`sharp`·`nanoid`는 `next` 업그레이드로 해소되지만, `brace-expansion`·`browserslist`·`js-yaml`(각 high)은 `eslint`·`eslint-plugin-react-hooks→@babel/core` 서브트리에서 오므로 `next` 범프로는 남는다 — `npm audit fix`(비-force, 기존 semver 범위 내 lock 재해상)까지 해야 0건이 된다 (2026-09-18 플랜 검증기 실측).
- Impact: 이 앱은 미들웨어·Server Actions·이미지 최적화를 쓰지 않아(전부 클라이언트 컴포넌트) 실제 노출면은 좁을 가능성이 높다. 다만 Vercel에서 서버 런타임으로 구동되므로 무시할 근거는 되지 못한다.
- Migration plan: `next@16.3.5`로 업그레이드(**semver minor, 파괴적 변경 아님**). `eslint-config-next`도 16.2.6에 핀돼 있으므로 함께 올린다. 업그레이드 후 `npx tsc --noEmit` → `npm run lint` → `npm run build` → `rm -rf .next && npm run dev` 순으로 검증. `AGENTS.md` 지시대로 `node_modules/next/dist/docs/`의 변경 사항을 먼저 확인할 것.

**`@supabase/supabase-js` ^2.106.0:**
- Risk: 캐럿 범위라 `npm install` 시점마다 마이너가 올라간다. 락파일이 커밋돼 있어(`package-lock.json`) CI 없는 현 상태에서도 재현성은 유지된다.
- Impact: 낮음. 다만 Edge Function은 `jsr:@supabase/supabase-js@2`(범위 지정)를 별도로 받으므로 **클라이언트와 서버의 supabase-js 버전이 서로 다를 수 있다**. Realtime 프로토콜 변경 시 한쪽만 깨질 수 있다.
- Migration plan: Edge Function 재배포 시 동작 확인을 잊지 말 것.

**타입 자동 생성 미사용:**
- Risk: `lib/supabase/client.ts:15-33`의 세 타입이 전부 수동이다. `supabase gen types typescript`를 쓰지 않아 DB 스키마와 타입의 동기화를 보장하는 장치가 없다.
- Impact: 스키마 변경이 컴파일 에러로 드러나지 않는다. 식당 카탈로그 전환에서 가장 크게 물릴 지점.
- Migration plan: 전환 작업 시 `supabase gen types typescript --linked > lib/supabase/database.types.ts` 도입을 함께 검토한다(`supabase/config.toml`이 이미 있으므로 진입 장벽이 낮아졌다).

---

## Missing Critical Features

**추첨 실패 감지·복구:**
- Problem: cron → Edge Function 경로가 실패해도 재시도·알림·수동 트리거 UI가 없다.
- Blocks: 장애 발생 시 사용자가 "오늘 결과 없음" 화면을 보는 것 외에 할 수 있는 일이 없다. [Known Bugs] P1과 같은 뿌리.

**로컬 개발용 Supabase 스택:**
- Problem: `supabase/config.toml`은 생겼지만 `supabase start` 기반 로컬 DB 워크플로 흔적이 없고, README도 원격 프로젝트만 안내한다(`README.md:20-26`).
- Blocks: 마이그레이션·Edge Function을 프로덕션 외에서 시험할 방법이 없다. 스키마 전환 작업의 최대 리스크 증폭기.

**결과 백업/롤백 절차:**
- Problem: `results`는 유일한 영구 데이터인데 백업·복구 절차가 문서화돼 있지 않고, 마이그레이션에 down 스크립트가 없다.
- Blocks: 전환 마이그레이션이 데이터를 망가뜨리면 되돌릴 수 없다.

**접근성·반응형:**
- Problem: `app/page.tsx:366`의 2컬럼 그리드가 고정 비율이고 미디어 쿼리가 없다. 휠 `size={460}` 고정(`app/page.tsx:255`).
- Blocks: 모바일에서 레이아웃이 깨진다. 점심 메뉴 앱의 실사용 환경이 주로 모바일이라는 점에서 우선순위가 낮지 않다.

---

## Test Coverage Gaps

**전체:** 테스트 파일 0개, 테스트 러너 0개(`package.json:5-10`에 `test` 스크립트 없음), CI 0개(`.github/` 디렉터리 부재). 즉 **커버리지 0%**이며, 회귀를 잡는 유일한 장치는 `tsc`·`eslint`뿐이다. 그마저도 Edge Function은 제외 대상이다.

**즉시 단위 테스트가 가능한(=I/O 없는 순수 함수) 미검증 로직 — 우선순위 High:**
| 대상 | 파일 | 왜 위험한가 |
|---|---|---|
| `parseMenuInput` | `lib/menus.ts:20` | 전각/반각 쉼표, 24자 절단, 중복 제거 분기. **회귀 spec 13건이 붙었다**(`lib/menus.test.ts`, Phase 1) |
| `currentPhase` | `lib/phase.ts:18-26` | 페이즈 경계(11:54:59 / 11:55:00 / 11:55:05)가 전체 UI 동작을 가른다 |
| `kstParts` / `todayKstDate` | `lib/time.ts:10-65` | 24시→0시 보정(`lib/time.ts:60`), 날짜 경계, 비 KST 브라우저 동작 |
| `buildRanking` · `filterSince` | `lib/history.ts` | 집계 키(`restaurant_id ?? menu`)·동점·share·전환일 당일 포함. **spec 20건으로 고정됨(Phase 7)** |
| `buildMonthGrid` | `lib/history.ts` | 월 경계·42셀 패딩·윤년. spec 으로 고정됨(Phase 7) |
| `spinJitter` / `arcPath` | `components/Wheel.tsx:25-40` | 각도 계산. 틀리면 당첨 조각과 포인터가 어긋난다 |

**단위 테스트가 어려운 미검증 영역 — 우선순위 Medium:**
- Realtime 핸들러 6종(`app/page.tsx:57-125`) — 통합 테스트 또는 수동 2탭 시나리오 필요.
- Edge Function 2종 — `deno test` + 로컬 Supabase 필요. 특히 `spin-roulette`의 시간 가드·멱등 경로(`insErr.code === "23505"`)는 현재 **한 번도 자동 검증된 적이 없다**.
- cron 잡 3세대(`0002`→`0003`→`0004`) 누적 결과.

**권장 최소 셋업:** `node --test` + `tsx`(추가 의존성 최소) 또는 `vitest`로 위 High 표의 6개 순수 함수만 먼저 덮는다. 러너 도입 자체가 데이터 모델 전환의 안전망이 되므로, 전환 **이전**에 하는 것이 순서상 맞다.

---

## 예정된 데이터 모델 전환(restaurants 카탈로그 + daily candidates) 위험

다음 작업이 자유 텍스트 메뉴 → 식당 카탈로그 + 일일 후보 구조로의 전환이므로, 위 항목 중 이 전환을 직접 위협하는 것들을 한곳에 모은다.

**1. 역사 데이터가 자유 텍스트라 매핑이 본질적으로 손실적이다 — 최대 리스크**
- `results.menu`(text)와 `results.candidates`(jsonb `[{name}]`)가 과거 기록의 **유일한 저장소**다(`supabase/migrations/0001_init.sql:11-17`). 식당 id로 옮기려면 이름 → 식당 매핑이 필요한데, 오타·표기 흔들림·테스트 데이터("테스트" 류 보고됨)가 섞여 있어 자동 매핑이 불가능하다.
- 대응: 전환 전에 `select date, menu from results order by date;` 전체를 덤프해 육안 검토 → 매핑 테이블을 **수작업으로 확정** → 매핑 불가 행은 `restaurant_id = null` + `legacy_name` 보존으로 남긴다. `results` 컬럼을 파괴적으로 바꾸지 말고 **추가 컬럼 + 백필** 방식을 쓴다.

**2. 이름 기준 조인이 코드 6곳에 박혀 있다**
- **해소됨(Phase 6·7).** 오늘 탭의 `winnerIndex` 는 `restaurant_id` 매칭, 기록·랭킹의 집계 키는 `lib/history.ts` 의 `restaurant_id ?? menu` 다(삭제된 매장은 이름 스냅샷으로 한 덩어리, 개명은 최근 스냅샷 이름으로 합쳐짐). legacy 행(이름만 있는)은 `filterSince` 가 전환일 이전으로 잘라 화면에 오지 않는다 — 전환일 당일의 구 모델 행 한 줄은 컷오버 절차(README 3b, `history_since + 1`)가 뺀다. 남은 이름 기준 표시는 기록 상세의 후보 목록(`results.candidates[].name`)뿐이고 그것은 스냅샷 표시라 의도다.

**3. `pinned_menus`의 PK가 `name`이다**
- `supabase/migrations/0004_pinned_menus.sql:4-7`. 식당 FK로 바꾸려면 PK 교체 = 테이블 재생성이고, 여기에 걸린 **자정 재시드 cron 잡 본문**(`0004_pinned_menus.sql:28-36`)도 함께 재작성해야 한다. cron 잡은 마이그레이션 파일이 아니라 DB에 살아 있으므로, 새 마이그레이션에서 unschedule → 재등록 패턴을 반드시 지킬 것.
- `truncate table public.menus`가 FK 참조를 받는 테이블이 되면 실패하거나 `cascade`가 필요해진다 — 이 실패는 **자정에 조용히 일어나고 아무도 알아채지 못한다**(로깅 없음).

**4. Realtime publication 등록을 잊기 쉽다**
- 새 테이블은 `alter publication supabase_realtime add table public.<t>;`를 명시적으로 해야 한다(`0001_init.sql:34-35`, `0004_pinned_menus.sql:16`이 선례). 빠뜨리면 앱은 정상처럼 보이다가 **다른 탭에서만 반영이 안 되는** 재현 어려운 버그가 된다.

**5. Edge Function 의 스키마 가정은 이제 컴파일 에러를 내지만, 임베드 형태는 그래도 못 잡는다**
- 두 함수는 `candidates` → `restaurants` 조인으로 후보를 읽고 `results`에 매장명 스냅샷 + `restaurant_id`를 쓴다(Phase 4 재작성). 스키마를 바꾸면 `npm run check:edge`가 타입 에러를 준다 — "컴파일 에러 없이 다음 추첨에서 처음 터지는" 상태는 아니다.
- **단 PostgREST 임베드가 배열로 오느냐 객체로 오느냐는 정적 검사가 못 잡는다.** 추론 타입은 배열이고 실제 응답은 객체라 `row.restaurants[0].name`은 타입 검사를 통과하고 런타임에 `undefined`를 준다. 두 함수 모두 `Array.isArray`로 접어 뒀지만 그게 옳은지는 **첫 실호출에서만** 드러난다 → README `## 컷오버 절차` 5번이 그 확인 항목이다.
- 대응 순서: 앱 배포보다 **Edge Function 재배포를 먼저** 하고, `respin-roulette`를 수동 호출해 새 스키마 경로를 검증한 뒤 UI를 내보낸다(`spin-roulette`는 시간 가드 때문에 사전 검증이 불가능하므로 `respin` 경로로 대신 확인).

**6. 검증 수단이 없다 → 대부분 해소(Phase 1~8)**
- 현재: vitest 15 files(건수는 `npm test` 가 정본), 롤백 SQL(`supabase/rollback/`, 텍스트 계약 spec), `results` 덤프가 컷오버 절차 1번. 남은 것: CI 0, 로컬 Supabase 스택 없음(마이그레이션·롤백은 리허설 없이 프로덕션에서 첫 실행 — 재실행 안전형으로 대체).
- 당시: 테스트 0, CI 0, 로컬 Supabase 스택 없음, 마이그레이션은 프로덕션 직접 적용(보안 정책상 사용자가 수동 적용), down 마이그레이션 없음, `results` 백업 절차 미문서화.
- 대응: (a) 전환 착수 전 `results` 전체 덤프를 파일로 보관, (b) 위 [Test Coverage Gaps]의 순수 함수 6개에 러너를 먼저 도입, (c) 마이그레이션을 "추가만 하는" 단계와 "제거하는" 단계로 분리해 최소 하루 이상 간격을 둔다.

**7. `CLAUDE.md`·`README.md`가 스키마를 틀리게 기술 중 → 해소(Phase 8 README 전면 개정)**
- 당시: `README.md:51`은 `pinned_menus`를, `README.md:55`는 `respin-roulette`를 아예 모른다.

**8. Realtime 구독 전·재연결 뒤 스냅샷 공백 (알려진 공백, 수용 — Phase 8 결정)**
- 네 구독(`useSettings`·`useRestaurants`·`useCandidates`·`app/page.tsx` results) 모두 SELECT 와 `subscribe()` 를 동시에 띄운다. `lib/rowset.ts` 의 `pending` 버퍼는 응답보다 먼저 온 이벤트를 흡수하지만, **스냅샷 이후 커밋 + join 이전** 변경은 어느 쪽에도 실리지 않는다(콜드 로드 수백 ms). 재연결(슬립 복귀) 뒤에도 `postgres_changes` 는 재생이 없고 훅은 재조회하지 않는다. 랭킹 재조회(전환일 변경·자정)는 상태를 통째로 교체해 같은 창을 다시 연다.
- 수용 이유: 조회를 `subscribe` 의 `SUBSCRIBED` 콜백 안으로 옮기는 최소 수정은 웹소켓이 막힌 네트워크(사내 프록시)에서 REST 조회까지 죽여 "Realtime 없어도 읽기는 된다" 는 현행 보장을 깬다. 후보 목록이 슬립 동안의 담기·빼기를 모르는 증상은 새로고침으로 해소된다.
- 고칠 방향(v2): `SUBSCRIBED` 마다 재조회 **+** 초기 REST 조회는 유지, `rowset` 의 두 번째 `fetched` 를 "목록 교체" 로 바꾸고 재조회 중 `pending` 을 다시 쌓는다. `lib/settings.ts` 단일행은 "Realtime 이 앞서면 이긴다" 논증을 지키며 따로. `visibilitychange` 트리거도 후보.

---

*Concerns audit: 2026-09-18*
