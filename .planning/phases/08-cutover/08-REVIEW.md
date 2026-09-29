---
phase: 08-cutover
reviewed: 2026-09-29T06:01:39Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - supabase/rollback/0005_restaurants_settings.rollback.sql
  - supabase/rollback/0005_restaurants_settings.rollback.test.ts
  - vitest.config.mts
  - README.md
  - CLAUDE.md
  - .planning/codebase/CONCERNS.md
  - .planning/codebase/STRUCTURE.md
  - lib/errors.ts
findings:
  critical: 1
  warning: 6
  info: 11
  total: 18
status: fixed
---

# Phase 8: 코드 리뷰 보고서

**리뷰 시각:** 2026-09-29T06:01:39Z
**깊이:** standard (+ 롤백 SQL 은 0001·0002·0004·0005 및 `main` 의 구 함수·구 페이지와 교차 대조)
**리뷰 범위:** `git diff 31eff12..HEAD` (HEAD = `18058a6`. 리뷰 도중 `231ac71 docs(07)`·`18058a6 fix(08)` 두 커밋이 추가로 들어와 범위가 12 파일로 늘었다. `07-SECURITY.md` 는 문서라 제외, `lib/errors.ts` 3줄 변경은 읽었고 문제 없음)
**상태:** fixed — 18/18 처리(문서 15 · 롤백 SQL/spec 3, 코드 변경 0), 2026-09-29

## 요약

이 페이즈의 코드는 롤백 SQL 한 파일과 그 텍스트 계약 spec, 그리고 문서다. 롤백 SQL 은 **0005 절 7·8 의 정확한 역**이고, 0001(`menus` + 정책 3 + publication)·0004(`pinned_menus` + 정책 3 + publication + `reset-menus` 0004 형태)·0002(`spin-lunch-roulette` `55 2 * * *`, `http_post` 형태 그대로)를 재현한다. 모든 문이 재실행 안전형이고(`if not exists` / `drop policy if exists` / jobid 루프 / `pg_publication_tables` 가드), 파기문은 주석 밖에 0건이며, `main` 의 구 `spin-roulette`·`respin-roulette`·`app/page.tsx` 가 읽고 쓰는 컬럼(`menus.id/name/created_at`, `pinned_menus.name/created_at`, `results.date/menu/candidates/spun_at`)이 전부 복원된다. 0005 가 절 8 앞에서 끊긴 부분 적용 상태(롤백 기준 a)에서 실행해도 중복 인덱스·중복 잡 없이 통과한다 — 여기까지는 문제 없음.

문제는 **README 컷오버 절차** 쪽이다. 7번 "오늘 탭에서 후보 담기" 는 컷오버 당일에 **실행 불가능**하다: 그날 `results` 행이 있으면 `lib/phase.ts` 가 `decided` 를 돌려주고 `isCandidateListLocked` 가 토글을 잠근다(CR-01). 그 밑에 5번의 실패 시그니처가 현행 함수 코드와 어긋나 있고(WR-01), 3b·7·8·롤백 기준 (c) 가 "그날 추첨 행이 있다 / 후보가 있다" 는 전제를 적지 않아 주말 컷오버나 후보 0개인 날에 오판을 낳는다(WR-02·03). 나머지는 문서 정합성이다.

게이트: `npm test` 15 files / 391 passed · `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · AI 표기 grep(8678f02..HEAD) 0 · `git ls-files supabase/migrations | grep -c rollback` 0. `npm run build`·`npm run check:edge` 는 이 리뷰의 허용 명령이 아니라 실행하지 않았다(오케스트레이터 Task 4).

## Critical

### CR-01: 컷오버 절차 7번 "오늘 탭에서 후보 담기" 는 컷오버 당일에 잠겨 있어 실행할 수 없다

**파일:** `README.md:117` (근거 코드 `lib/phase.ts:23,39` · `components/CandidateList.tsx:63,199,227` · `app/page.tsx:72`)
**문제:** 7번은 "매장 탭에서 매장 등록 → 오늘 탭에서 후보 담기 → 다시 돌리기" 를 컷오버 당일(3~6 직후)에 하라고 적는다. 그런데 `currentPhase(now, spinTime, todayResult !== null)` 은 오늘 `results` 행이 있으면 시각과 무관하게 `decided` 를 돌려주고, `isCandidateListLocked("decided")` 가 `true` 라 `CandidateList` 의 담기/빼기 버튼이 `disabled` 된다. 2번(12:00 KST 이후 시작)대로면 그날 추첨 행이 이미 있고, 없더라도 5번의 `respin-roulette` 호출이 행을 만든다 — 따라서 7번 시점에는 **항상** 잠겨 있다. 게다가 5번 끝의 `delete from public.restaurants where name = '컷오버 확인용'` 이 유일한 후보를 cascade 로 지우므로, 그 상태에서 7번의 "다시 돌리기" 는 `no_candidates` 배너("후보가 없어요")로 끝난다. 절차서가 사용자를 "화면이 안 된다 → 롤백 기준?" 으로 밀어 넣는 지점이고, ROADMAP 성공 기준 3(체크리스트 순서)·5(라이브 확인) 가 이 단계를 밟는다.
**근거:** `lib/phase.ts:23` `if (hasResult) return "decided";` · `:39` `case "decided": return true;` · `components/CandidateList.tsx:199` `const disabled = readOnly || busy;` → `:227` `disabled={disabled}`.
**제안:** 7번을 둘로 쪼갠다.
- 7(컷오버 당일): 매장 탭에서 매장 등록(잠금 없음) → 후보는 SQL Editor 로 담는다(5번과 같은 `insert into public.candidates (restaurant_id) select id from public.restaurants where name = '…';`; 또는 5번의 확인용 매장·후보를 **7번이 끝난 뒤** 지운다) → 오늘 탭 "다시 돌리기" → 매장명·휠 조각 확인 → `count(*)` 대조. 문장에 "오늘 결과 행이 있는 동안 오늘 탭의 담기/빼기는 잠긴다(`decided`)" 를 한 줄 적는다.
- 8a(익일 오전, 추첨 시각 전): 오늘 탭에서 토글로 후보 담기(잠금 해제 확인) → 8b 추첨 시각 + 5분 `results` 행 확인. 이렇게 하면 8번의 "행이 없으면" 판정에 후보가 있다는 전제도 자연히 생긴다(WR-03).

**처리:** 7번을 당일(매장 탭 등록 + SQL/확인용 후보 + 다시 돌리기 + count 대조 + 정리)과 8(a)(익일 추첨 전 토글로 담기)로 분리. 5번의 확인용 매장·후보는 7번까지 유지. `decided` 잠금 사실을 문장으로.

## Warnings

### WR-01: 5번의 실패 시그니처("`menu` 빈 문자열 / `restaurant_id` 없음")가 현행 함수 동작과 다르다

**파일:** `README.md:115` (근거 `supabase/functions/respin-roulette/index.ts:49-77,150-162`)
**문제:** Phase 4 의 `normalizeCandidates` 는 임베드 형태가 틀린 행을 **제외**한다. 매장 1개·후보 1개로 부른 5번에서 접기가 틀리면 응답은 `menu: ""` 가 아니라 `{ "skipped": "no_candidates", "date": …, "excluded_count": 1 }` 이고 Logs 에 `후보 1건을 매장 조인 형태 불일치로 제외했다` 가 찍힌다. README 는 이 응답을 "후보가 안 들어갔다" 로 읽게 만든다 — CLAUDE.md 가 `excluded_count` 를 응답에 실은 이유("후보가 없다 와 조인이 깨졌다 를 응답만으로 구분")가 절차서에서 사라졌다. 원문은 `wr-01` 7번의 Phase 4 이전 문구를 그대로 옮긴 것이다.
**제안:** "응답이 `ok: true` + `menu: "컷오버 확인용"` + `restaurant_id`(uuid) 면 통과. `skipped: "no_candidates"` 인데 `excluded_count > 0` 이면 PostgREST 임베드 접기가 틀린 것 → 머지하지 말고 롤백 판단. `excluded_count: 0` 이면 후보 insert 가 안 된 것이니 SQL 을 다시 본다. `settings_fallback`·`cooldown_skipped` 가 `true` 면 Logs 를 본다."

**처리:** 5번 판정을 `ok`/`skipped: no_candidates` + `excluded_count` 분기·`settings_fallback`·`cooldown_skipped` 로 교체.

### WR-02: 3b·5·7 은 "컷오버 당일 `results` 행이 이미 있다" 를 전제하는데 그 전제를 적지 않았다

**파일:** `README.md:96,115,117`
**문제:** 3b 는 "(2번대로면 항상)" 이라며 `history_since + 1` 을 무조건으로 만들고, 5번은 "그날의 구 모델 결과 행을 덮어쓴다", 7번은 "`count(*)` 가 1번 행 수와 **같은지**" 를 판정으로 둔다. 셋 다 그날 추첨이 **일어났을 때만** 참이다. 주말·후보 0개인 날(구 함수가 `no_candidates` 로 skip)에 컷오버하면 5번의 upsert 가 **새 행을 insert** 해 `count = 덤프 + 1` 이 되고("행이 줄었으면" 만 적혀 있어 사용자는 늘어난 것을 어떻게 읽을지 모른다), 3b 의 `+1` 은 그날의 정당한 매장 모델 결과를 기록·랭킹에서 하루치 숨긴다. 유지보수 작업을 주말에 하는 것은 흔한 선택이라 가장자리 경우가 아니다.
**제안:** 1번에서 `select count(*) from public.results where date = (now() at time zone 'Asia/Seoul')::date;` 를 함께 적어 두고(0 또는 1), 3b 는 "그 값이 1일 때만", 7번은 "1이면 같아야 하고 0이면 +1 이어야 한다" 로 분기한다.

**처리:** 1번에 오늘 행 count(0/1) 기록 추가, 3b 는 1일 때만, 5·7 의 덮어쓰기/+1 분기를 명시.

### WR-03: 8번·롤백 기준 (c) 가 "익일 후보 0개 → `no_candidates`" 정상 경로를 실패로 오판하게 한다

**파일:** `README.md:118,126` (근거 `supabase/functions/spin-roulette/index.ts:164-166`)
**문제:** 8번은 "행이 없으면 Logs 의 `console.error` 를 본다", (c) 는 "행이 없고 원인을 바로 못 고친다 → 롤백" 이다. 그런데 후보가 0개면 함수는 `{ skipped: "no_candidates" }` 로 정상 종료하고 `console.error` 는 **찍히지 않는다**. 5번의 정리가 후보를 비웠고 📌 매장이 없으면 자정 재시드도 0개라, 익일 아무도 후보를 담지 않으면 정확히 이 상태가 된다 — "에러도 없고 행도 없다" 는 (c) 의 문면상 롤백 조건이다.
**제안:** 8번에 전제를 넣는다: "익일 추첨 시각 전에 후보가 1개 이상 담겨 있어야 한다(전날 매장 탭에서 📌 하나를 고정해 두면 자정 재시드가 보장한다). 행이 없을 때 Logs 에 `no_candidates` 만 있고 `console.error` 가 없으면 후보가 없었던 것이지 실패가 아니다." (c) 도 "후보가 있었는데" 를 붙인다.

**처리:** 8(a) 후보 1개 이상 전제(📌 고정 권고), 8(b)·롤백 (c) 에 `no_candidates` = 실패 아님 명시.

### WR-04: CLAUDE.md 의 vitest 수집 대상 목록에 이 페이즈가 추가한 `supabase/rollback/**` 이 빠져 있다

**파일:** `CLAUDE.md:39` (근거 `vitest.config.mts:29`)
**문제:** "수집 대상은 `lib/**`·`components/**`·`supabase/functions/_shared/**`·`supabase/migrations/**` 의 `*.test.ts` **뿐이다**" — `vitest.config.mts` 에 `supabase/rollback/**/*.test.ts` 를 넣은 같은 커밋 묶음에서 이 문장을 놓쳤다. ROADMAP 성공 기준 1 이 "검증 명령(`npm test` 포함)을 정확히 기술" 을 요구하므로 이 한 줄이 기준을 깬다. README 38행은 맞게 적혀 있어 두 문서가 서로 다르다.
**제안:** `·supabase/rollback/**` 를 목록에 추가하고, 뒤 문장에 "`rollback/**` 은 Phase 8 이 채웠다" 를 덧붙인다.

**처리:** CLAUDE.md 수집 목록에 `supabase/rollback/**` 추가, Phase 8 이 채웠다는 문장.

### WR-05: CONCERNS.md 가 이 페이즈에서 `git rm` 한 `wr-01` todo 를 두 곳에서 여전히 가리킨다

**파일:** `.planning/codebase/CONCERNS.md:325,336`
**문제:** 325행 "컷오버 절차(`wr-01` 8번, `history_since + 1`)가 뺀다", 336행 "`.planning/todos/pending/wr-01-cutover-window.md` 7번이 그 확인 항목이다". 파일은 `c2fac91` 에서 삭제됐고 디렉터리 `.planning/todos/` 자체가 없다. 같은 커밋이 항목 8 을 추가하면서 바로 위 문단을 손대고도 참조를 남겼다.
**제안:** 325행 → "컷오버 절차(README 3b, `history_since + 1`)", 336행 → "README `## 컷오버 절차` 5번이 그 확인 항목이다".

**처리:** CONCERNS.md 두 참조를 README 3b / 5번으로 교체(`wr-01` 잔존 0).

### WR-06: 롤백 3번 `git revert -m 1 <머지 커밋>` 은 squash/rebase 머지에서 실패한다

**파일:** `README.md:137`
**문제:** `-m 1` 은 부모가 둘인 merge commit 에만 유효하다. PR 이 "Squash and merge" 나 "Rebase and merge" 로 들어가면 `git revert -m 1` 은 `error: commit … is not a merge` 로 끊긴다. 레포 어디에도 머지 방식이 적혀 있지 않고, 절차 6번도 지정하지 않는다. 롤백 단계가 필요한 순간에 처음 실패하는 형태다(Vercel promote 가 대안으로 있어 Critical 은 아니다).
**제안:** 6번에 "Create a merge commit 으로 머지한다(롤백 3번의 `-m 1` 이 그 전제)" 를 적거나, 3번을 "merge commit 이면 `git revert -m 1 <해시>`, squash/rebase 면 `git revert <해시>`" 로 분기한다.

**처리:** 6번에 "Create a merge commit" 지정 + 롤백 3번을 merge/squash 분기.

## Info

### IN-01: 0번의 상호참조 "롤백 3번에 필요" 는 "롤백 2번" 이어야 한다

**파일:** `README.md:92`
**문제:** 컷오버 전 `main` 해시를 쓰는 곳은 롤백 **2번**(구 Edge Function 재배포, 130~136행)이다. 3번은 앱 롤백이고 해시를 쓰지 않는다.
**제안:** "(롤백 2번에 필요)".

**처리:** "롤백 2번" 으로 정정.

### IN-02: 5번 curl 의 `$NEXT_PUBLIC_SUPABASE_ANON_KEY` 는 셸에 없다 — 헤더 자체가 불필요하기도 하다

**파일:** `README.md:112-113`
**문제:** 값은 `.env.local` 에 있고 export 되지 않으므로 그대로 실행하면 `apikey: ` 빈 헤더가 나간다. 한편 `verify_jwt = false` 함수는 인증 헤더를 전혀 요구하지 않는다 — 0002·0005 의 `http_post` 가 `Content-Type` 만 실어 수개월 운영됐고, `supabase.functions.invoke`(`app/page.tsx:229`)가 붙이는 `apikey`·`Authorization: Bearer <publishable>` 도 검증되지 않는다. 빈 `apikey` 를 게이트웨이가 거절할지는 확인된 바 없다.
**제안:** `-H "apikey: …"` 를 빼거나, 앞에 `set -a; source .env.local; set +a` 를 둔다. 후자를 택하면 "이 함수는 헤더 없이도 호출된다(0002 cron 과 같다)" 를 한 줄 덧붙인다.

**처리:** curl 에서 `apikey` 헤더 제거 + 인증 불필요 근거 한 줄.

### IN-03: 6번의 "기록·랭킹의 명시 컬럼 조회" — 명시 컬럼은 랭킹뿐이다

**파일:** `README.md:116` (근거 `app/rank/page.tsx:18` `RANK_COLUMNS = "id,date,menu,restaurant_id"` · `app/log/page.tsx:70` `select("*")`)
**문제:** 기록 페이지는 `select("*")` 라 0005 전에도 42703 이 나지 않는다. CLAUDE.md 의 같은 문장은 "랭킹의 명시 컬럼 조회" 로 맞게 적혀 있다.
**제안:** "랭킹의 명시 컬럼 조회(`results.restaurant_id`)는 3번이 먼저여야 동작한다".

**처리:** "랭킹의 명시 컬럼 조회" 로 정정.

### IN-04: 프로젝트 ref 치환 위치 목록이 완전하지 않다

**파일:** `README.md:86` · `CLAUDE.md:76`
**문제:** README 목록(0002·0005·rollback·README)에 `supabase/config.toml:3`(주석)·`CLAUDE.md:96`(deploy 명령)이 빠져 있고, CLAUDE.md 위험 표는 0002 만 "ref 하드코딩" 으로 든다(0005·rollback 도 같다). 기능에는 영향 없지만 "치환 위치" 는 전수를 뜻하는 문장이다.
**제안:** README 86행에 `supabase/config.toml`(주석)·`CLAUDE.md` 를 추가하고, CLAUDE.md 76행을 "`0002_cron.sql`·`0005_…sql`·`rollback/…sql`" 로 넓힌다.

**처리:** README 치환 목록에 `config.toml`·`CLAUDE.md` 추가, CLAUDE.md 위험 표에 0005·rollback 추가.

### IN-05: 롤백 SQL 인덱스 이름 주석이 사실과 다르다 — 자동 이름과 같은 이름이라 재실행이 안전한 것이다

**파일:** `supabase/rollback/0005_restaurants_settings.rollback.sql:27,33`
**문제:** "0001 의 인덱스는 이름이 없었다 … 여기서만 붙인다" 는 오해를 부른다. `create index on public.menus (created_at)` 은 Postgres 가 `menus_created_at_idx` 로 **자동 명명**하고, 이 파일이 고른 이름이 정확히 그것이다. 이 일치 덕분에 롤백 기준 (a)(0005 가 절 8 앞에서 끊겨 `menus` 가 살아 있는 상태)에서 `create index if not exists` 가 no-op 이 된다 — 다른 이름을 골랐다면 중복 인덱스가 생긴다. 지금 선택은 옳고, 주석만 그 이유를 거꾸로 적었다.
**제안:** "이름은 0001 의 무명 `create index` 가 자동으로 받은 `menus_created_at_idx` 와 같게 둔다 — 0005 가 절 8 앞에서 끊겨 `menus` 가 남아 있어도 중복 인덱스가 생기지 않는다."

**처리:** 인덱스 이름 주석을 자동 이름 일치 → 부분 적용 재실행 안전으로 정정.

### IN-06: 구 spin 잡의 `http_post` 에 `timeout_milliseconds` 가 없다(0002 원형 그대로)

**파일:** `supabase/rollback/0005_restaurants_settings.rollback.sql:79-83`
**문제:** 0002 를 충실히 복제한 것이라 "동작 복원" 원칙에는 맞다. 다만 0005:131 이 "pg_net 기본 2000ms 는 콜드스타트에 짧다" 고 적었고, 하루 한 번만 부르는 구 잡은 매분 폴링보다 콜드스타트에 더 노출된다. `timeout_milliseconds := 5000` 을 얹어도 구 함수의 동작은 바뀌지 않는다.
**제안:** 선택 사항. 얹는다면 spec 의 `http_post` 검사에 그 인자를 함께 고정한다.

**처리:** `timeout_milliseconds := 5000` 추가 + spec 고정 + Why 주석(구 함수 동작 불변).

### IN-07: 롤백 spec 의 false-green 여지 3곳

**파일:** `supabase/rollback/0005_restaurants_settings.rollback.test.ts:48-51,60-65`
**문제:** (1) publication spec 은 `array['menus', 'pinned_menus']` 와 `pg_publication_tables` 만 보고 `execute format('alter publication supabase_realtime add table …')` 문은 보지 않는다 — `execute` 줄을 지워도 green 이다. (2) 순서 spec 은 `menus` < 첫 `cron.schedule` 만 본다. `reset-menus` 가 읽는 `pinned_menus`, 그리고 "unschedule 루프가 schedule 보다 앞" (중복 잡 방지의 핵심)은 고정되지 않았다. (3) `reset-menus` 본문이 0004 형태(`truncate table public.menus` + `from public.pinned_menus`)인지, 0002 의 맨 `truncate` 로 퇴행하지 않았는지 검사가 없다. 주석 제거기(`--.*$`)는 이 파일에 대해 정확하다 — 문자열 리터럴·`$cmd$` 본문에 `--` 가 없다.
**제안:** `expect(code).toMatch(/execute format\('alter publication supabase_realtime add table public\.%I', t\)/)` · `pinned_menus` 생성 offset < 첫 schedule · `perform cron.unschedule` offset < 첫 schedule · `reset-menus` 본문 `truncate table public\.menus;\s*insert into public\.menus \(name\)\s*select name from public\.pinned_menus` 4건 추가.

**처리:** spec 4건 추가/강화 — publication `execute`, pinned_menus·unschedule 순서, reset-menus 0004 본문(10 specs).

### IN-08: STRUCTURE.md 의 `migrations/ # 0001~0004` 가 낡았다

**파일:** `.planning/codebase/STRUCTURE.md:48`
**문제:** 0005 와 그 spec 이 있다. 이 페이즈가 바로 윗줄(46)을 추가하면서 옆 줄을 그대로 뒀다. 50행 "11:55 자동 추첨" 도 `settings.spin_time` 기준으로 바뀌었다.
**제안:** "0001~0005, 순번 적용 (+ 0005 텍스트 계약 spec)" · "설정 시각 자동 추첨(매분 cron 호출)".

**처리:** STRUCTURE.md 트리 주석 0005·설정 시각으로 정정.

### IN-09: CONCERNS.md 항목 6 의 "vitest 389건(15 files)" 은 이미 391 이다

**파일:** `.planning/codebase/CONCERNS.md` 항목 6
**문제:** `18058a6` 이 2건을 더해 현재 391 이다. 건수를 문서에 박으면 커밋마다 어긋난다.
**제안:** "vitest 15 files(건수는 `npm test` 가 정본)" 처럼 건수를 빼거나 391 로 갱신.

**처리:** 건수 제거("건수는 npm test 가 정본").

### IN-10: CLAUDE.md Security 제약의 "menus 계열" 은 컷오버 후 존재하지 않는 테이블이다

**파일:** `CLAUDE.md:97`
**문제:** "RLS는 익명 개방(menus 계열·restaurants·candidates 누구나 쓰기)". README 는 새 모델을 현재형으로 쓰기로 했다(D-09). ROADMAP 기준 1 이 "현행 스키마" 를 요구한다.
**제안:** "RLS는 익명 개방(`restaurants`·`candidates` 누구나 쓰기)".

**처리:** "menus 계열" 삭제.

### IN-11: "마이그레이션 동작불변 기본값" 컨벤션이 README 에 문장으로 없다

**파일:** `README.md:72-85`
**문제:** ROADMAP 기준 1 의 새 컨벤션 셋 중 `settings` 단일 소스(12·72·81~85행)·`_shared`(52행)는 있으나, "0005 의 기본값(11:55·쿨다운 0)은 전환 전 동작과 같고 동작 변경은 `settings` UPDATE 로만 한다" 는 문장은 0005 머리 주석에만 있다. 기본값 숫자는 72행에 있어 사실은 맞다.
**제안:** 81행 "설정 바꾸기" 앞에 한 줄: "0005 의 기본값은 전환 전 동작(11:55, 쿨다운 없음)과 같다 — 동작 변경은 마이그레이션이 아니라 `settings` UPDATE 로만 한다."

**처리:** README 인프라 절에 동작불변 원칙 한 줄 추가.

## 검증한 것 중 문제 없음 (기록)

- 롤백 SQL ↔ 0005 절 7·8 역순: unschedule 4이름(`spin-lunch-roulette`·`reset-menus`·`reset-candidates`·`purge-cron-history`) → `menus`·`pinned_menus` → 정책 6 → publication → `spin-lunch-roulette` `55 2 * * *` + `reset-menus` `0 15 * * *`(0004 본문). `create index if not exists` 는 PG 9.5+ 문법이고 `create table if not exists` 뒤에 와서 유효하다.
- 구 코드 호환: `main:app/page.tsx` 는 `menus(*)`·`pinned_menus(name)`·`results(*)` 를 읽고 `menus(name)` insert / `id` delete, `pinned_menus(name)` insert/delete; `main:spin-roulette` 는 `results(date,menu)`·`menus(id,name) order created_at` 을 읽고 `results(date,menu,candidates)` insert; `main:respin-roulette` 는 `results` upsert(`spun_at` 포함). 전부 복원 스키마에 있고 `results.restaurant_id` 는 nullable 이라 구 insert 가 통과한다. Realtime 은 두 테이블이 publication 에 다시 들어가고 DELETE 는 PK replica identity 로 `payload.old` 가 온다.
- 파기 블록(주석) 순서: `candidates` → `settings` → `results.restaurant_id` 컬럼 → `restaurants` → `text_array_max_len` — FK·check 의존 순서가 맞다.
- README 의 함수 동작 진술: `respin` 405(`index.ts:103-105`)·`upsert onConflict: "date"`(`:198-206`)·설정 폴백(`:128-131`) · `spin` 시각 판정·멱등·`no_candidates`·`console.error` 전부 코드와 일치. cron 이름·스케줄 3종, 테이블·제약 4종, RLS 요약, `on delete cascade`(candidates)·`set null`(results) 전부 0005 와 일치. 검증 명령 5종 = `package.json` scripts. 디렉터리 트리 = 실제. `F1rstID/lunch-roulette` = `git remote`. 낡은 진술 4건(`menus`·`results` 만 / `reset-menus` truncate / 함수 1개 / 11:55 고정) 0건.
- `lib/errors.ts`(`18058a6`): `formatLoadError` 가 `readableMessage` 를 지나게 한 3줄 — 쓰기 배너와 같은 200자·공백 규칙, spec 2건 추가. 문제 없음.

## 요약표

| ID | 심각도 | 파일:행 | 한 줄 |
|---|---|---|---|
| CR-01 | Critical | README.md:117 | 컷오버 당일 오늘 탭 후보 토글은 `decided` 잠금 — 7번 실행 불가, 5번 정리 뒤 후보 0개 |
| WR-01 | Warning | README.md:115 | 5번 실패 시그니처가 `normalizeCandidates` 이후 동작(`no_candidates` + `excluded_count`)과 다름 |
| WR-02 | Warning | README.md:96,115,117 | 3b·5·7 이 "그날 추첨 행 존재" 전제를 안 적음 — 주말 컷오버에서 count·history_since 오판 |
| WR-03 | Warning | README.md:118,126 | 익일 후보 0개(`no_candidates`, 에러 없음)를 롤백 기준 (c) 가 실패로 읽음 |
| WR-04 | Warning | CLAUDE.md:39 | vitest 수집 목록에 `supabase/rollback/**` 누락 |
| WR-05 | Warning | CONCERNS.md:325,336 | 삭제된 `wr-01` todo 참조 2곳 |
| WR-06 | Warning | README.md:137 | `git revert -m 1` 은 squash/rebase 머지에서 실패 |
| IN-01 | Info | README.md:92 | "롤백 3번" → 2번 |
| IN-02 | Info | README.md:112-113 | curl 의 env 변수 미export / 헤더 불필요 |
| IN-03 | Info | README.md:116 | 명시 컬럼 조회는 랭킹뿐 |
| IN-04 | Info | README.md:86 · CLAUDE.md:76 | ref 치환 위치 목록 불완전 |
| IN-05 | Info | rollback.sql:27 | 인덱스 이름 주석이 사실(자동 이름과 동일)과 반대 |
| IN-06 | Info | rollback.sql:79-83 | `timeout_milliseconds` 없음(0002 원형) — 선택 |
| IN-07 | Info | rollback.test.ts:48-65 | publication `execute`·pinned_menus 순서·unschedule 순서·0004 본문 미고정 |
| IN-08 | Info | STRUCTURE.md:48,50 | `0001~0004`·`11:55` 낡음 |
| IN-09 | Info | CONCERNS.md 항목 6 | 테스트 건수 하드코딩(389 → 이미 391) |
| IN-10 | Info | CLAUDE.md:97 | "menus 계열" 잔존 |
| IN-11 | Info | README.md:72-85 | 동작불변 기본값 컨벤션 문장 부재 |

## 판정

**issues_found — 머지 전 수정 필요.** 롤백 SQL 과 spec 은 계약대로이고 게이트 3종(test·tsc·lint)은 green 이다. 막는 것은 절차서 한 단계(CR-01)와 그 주변의 전제 누락(WR-01~03)이며 전부 README 문장 수정으로 닫힌다 — 코드 변경은 필요 없다. CR-01·WR-01~06 을 고친 뒤 재검토 없이 PR 을 열어도 된다(IN 은 선택).

---

_리뷰: 2026-09-29T06:01:39Z_
_리뷰어: Claude (gsd-code-reviewer)_
_깊이: standard_
