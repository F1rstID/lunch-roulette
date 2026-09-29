---
phase: 05-07 (combined — 05-restaurants-tab · 06-today-tab · 07-history-ranking)
audited: 2026-09-29T14:55:14+09:00
status: SECURED
threats_total: 8
threats_mitigated: 8
threats_open: 0
plan_register: 31 IDs (T-05-01~12 · T-05-SC · T-05-LIVE · T-06-01~15 · T-06-SC · T-06-LIVE — mitigate 25 · accept 6 · open 0)
asvs_level: 1
tree: e1040e3 (feat/restaurant-roulette, unpushed)
---

# Phase 5·6·7 — Security (합본)

> 세 페이즈가 더하거나 바꾼 클라이언트 코드를 한 번에 감사한다. 판정 원칙은 Phase 4(`04-SECURITY.md`)와 같다 — SUMMARY 의 서술은 증거로 쓰지 않았고, 모든 완화는 HEAD `e1040e3` 트리를 상대로 grep·`git`·`npx tsc --noEmit`(exit 0)·`npm run lint`(exit 0, 에러·경고 0)·`npm test`(14 files / 380 passed)를 **재실행**해 얻었다. 구현 파일 수정 0건, 커밋 0건, 원격 Supabase 명령 0건, `git` 쓰기 명령 0건.

감사 범위의 위협 8건은 의뢰자가 지정한 것이고, Phase 5·6 네 플랜의 `<threat_model>`(고유 31건)을 그 8건 아래에 매핑해 전부 판정했다. **Phase 7 플랜(`07-01-PLAN.md`)에는 `<threat_model>` 이 없고 SUMMARY 에 `## Threat Flags` 절도 없다**(빠른 레인) — Phase 7 코드(`lib/history.ts`·`app/log`·`app/rank`·`RankingView`·`CalendarLog`)는 T4·T5·T7 에서 직접 검사했다. 이미 수용된 위험(`R-04-01` respin 무인증·무제한, `R-04-02`)은 다시 다투지 않고 참조만 한다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 익명 브라우저 → PostgREST(`restaurants`·`candidates`) | RLS 전면 개방(0005:77-94). 앱 계층 인증·레이트리밋 없음. 클라이언트 검증은 보조이고 정본은 0005 의 check 제약 | 이름·메뉴 배열·위치·핀 · `restaurant_id` |
| DB 행(`location`) → 다른 사용자의 `<a href>` | 남이 넣은 문자열이 내 브라우저에서 앵커가 된다. 스킴 화이트리스트가 유일한 방어 | `http(s)://…` 또는 임의 텍스트 |
| Realtime `payload.new`/`payload.old` → 리듀서·핸들러 | INSERT/UPDATE 는 전체 행, DELETE 는 PK 만. `Database` 제네릭이 없어 전부 캐스트 | 행 객체 · 키 |
| PostgREST 에러 객체 → `ErrorBanner` | `code`·`message`·`details`·`hint` 중 화면에 닿는 것을 `lib/errors.ts` 가 정한다 | `message`(200자 절단) · 고정 한국어 문장 |
| 브라우저 → `respin-roulette`(Edge Function, service_role) | 클라이언트가 `results` 를 쓰는 유일한 간접 경로. POST 만 통과(04 T-04-05) | 빈 POST |
| `results`·`settings` → 화면 | 클라이언트 쓰기 경로 0건(정책 부재 = 기본 거부). 읽기는 anon 전면 | 결과 스냅샷 · 설정 단일행 |
| **워킹트리 → 라이브 Supabase / `main`** | 이 감사가 건너지 않은 경계 | — (무접촉) |

---

## Threat Register (의뢰 8건)

| T-ID | 위협 | 완화 | 근거(file:line · 코드 인용) | 상태 |
|------|------|------|------------------------------|------|
| **T1** | 링크 주입 / XSS — `location` 이 `javascript:`·`data:` 앵커가 되거나 사용자 문자열이 HTML 로 렌더됨 | 스킴 화이트리스트 + 앵커 1곳에 `target`·`rel` 동반 + 전부 React 텍스트 노드 | `lib/restaurants.ts:75-76` `const url = new URL(trimmed); if (url.protocol !== "http:" && url.protocol !== "https:") return null;` · `components/LocationLink.tsx:21` `<a href={link.href} target="_blank" rel="noopener noreferrer" style={s.link}>` · `:25` 비링크는 `<span>{location}</span>` · `grep -rn 'target=\|rel='` app/components/lib → **LocationLink.tsx:21 한 곳**(다른 `href=` 는 `TopBar`·`CandidateList:123,171` 의 정적 라우트) · 두 소비처가 같은 컴포넌트: `RestaurantList.tsx:314`·`ResultBlock.tsx:101` · `dangerouslySetInnerHTML\|innerHTML\|eval(\|new Function(\|document.write` → **0** · 텍스트 노드: `RestaurantList.tsx:310` `{row.name}` · `MenuChips.tsx:30` `{menu}` · `CandidateList.tsx:215` `{row.restaurant.name}` · `ResultBlock.tsx:91` `{winner.name}` · `CalendarLog.tsx:154,205` `{entry.menu}` · `:220` `{entry.candidates.map((c) => c.name).join(", ")}` · `RankingView.tsx:116,166` `{entry.name}` · `Wheel.tsx:207` SVG `<text>` 안 `{item.name}` · 속성 싱크(`MenuChips.tsx:29` `title={allMenus}`, `CandidateList.tsx:226` `aria-label`)는 React 가 이스케이프하는 문자열 속성이고 URL·HTML 싱크가 아님 · spec `lib/restaurants.test.ts:228-236` `javascript:alert(1)`·`data:text/html,<script>…` → `null` | MITIGATED |
| **T2** | 입력 남용 vs DB check — 클라이언트 우회로 상한 초과·빈 이름·개행이 들어가거나, 23514/23505 처리가 SQL 을 노출 | 상수 3개가 0005 를 코드포인트 단위로 비추고, 정본은 DB 제약, 에러는 고정 문장 | 상수 `lib/constants.ts:9,13,16` `24`·`30`·`200` ↔ `0005:24` `char_length(name) between 1 and 24 and btrim(name) <> '' and position(E'\n' in name) = 0` · `:26` `cardinality(menus) <= 30 and array_position(menus, '') is null and … text_array_max_len(menus) … <= 24` · `:28` `location is null or char_length(location) <= 200` · 단위 일치 `lib/restaurants.ts:22-23` `Array.from(text).length`(= `char_length`) · 판정 `:40` 빈 이름 · `:42` `/[\n\r]/` 개행(DB 보다 엄격) · `:44` 이름 >24 · `:50` 메뉴 >30 · `:53-55` 위치 >200 · `:57` 빈 위치 → `null` · `lib/menus.ts:14` `Array.from(text).slice(0, max).join("")`(대리쌍 보존) · `:24-25` 원소 24 절단 + 빈 원소 제거(`array_position(menus,'')` 대응) · 폼은 제출 전 파싱만 통과 `RestaurantList.tsx:193-198`, HTML `maxLength` 없음(`:234-238` 코드유닛/코드포인트 불일치 논증) · 정본 선언 `lib/restaurants.ts:6-7` "정본은 0005 의 check 제약… 우회한 값은 DB 가 막는다" · 에러 번역 `lib/errors.ts:80` `if (error.code === "23505") return \`이미 등록된 매장이에요: ${name}\`` · `:82` `23514` → 상한 3종 고정 문장 · 그 외 `:84` `readableMessage(error.message)`(SQL 조각이 실리는 `details`·`hint` 미참조) · 후보 `:100-103` 23505/23503 · DB 가 배열 내 중복을 막지 않는 점은 `MenuChips.tsx:25-29` 가 key 에 인덱스를 섞어 렌더 붕괴를 막음 · spec `restaurants.test.ts:101-112,172-182,200-211` 경계 24/25·30/31·200/201 · `0005_restaurants_settings.test.ts:181-182,312-330` SQL 텍스트 고정 · `errors.test.ts:129-144` | MITIGATED |
| **T3** | 에러 표면화 — 배너에 `details`·`hint`·긴 원문이 실리거나 클라이언트가 `console.error` 로 남김 | `message` 만, 200자 절단, 배너는 텍스트 노드, 콘솔 0건 | `lib/errors.ts:5` 규약 · `grep -rnE '\.(details\|hint)\b'` app/components/lib(테스트 제외) → 에러 참조 **0**(유일 매치 `app/page.tsx:323` 은 스타일 키 `respinStyles.hint`) · `lib/errors.ts:15` `const BANNER_MESSAGE_MAX_LEN = 200;` · `:38-40` 절단 + `…` · 적용 `:52,:56`(respin) `:84`(매장 쓰기) `:103`(후보 쓰기) · 쓰기 실패 문장 전수: `app/restaurants/page.tsx:88,109,114,130,135,156` 모두 `formatRestaurantWriteError`, catch 경로 `:94,120,141,162` 도 `{ message: thrownMessage(e) }` 로 같은 함수 · `app/page.tsx:198,203,213,218` `formatCandidateWriteError` · `:234,248` `formatRespinError` · 직접 조립은 접두("다시 돌리기 실패: ")와 `:239` `data.skipped`(우리 함수의 2xx 본문)뿐 · `components/ErrorBanner.tsx:18-19` `<div role="alert"…><span>{message}</span>` · `grep -rn 'console\.'` app/components/lib → **0** · spec `errors.test.ts:99-111,169` 200 경계 | MITIGATED (잔여 1건 → 권고 §1) |
| **T4** | Realtime 페이로드 신뢰 — 부분 행·형태 이탈 행이 목록을 재구성하거나 페이지를 크래시 | 캐스트 뒤 총 함수로 좁힘, DELETE 는 키만, 키 없음은 무시, 결과 UPDATE 는 시각 비교 | 캐스트 지점 전수: `useRestaurants.ts:69,76` `payload.new as RestaurantRow` · `:85-86` `payload.old as Partial<RestaurantRow>` → `key: oldRow.id ?? null` · `useCandidates.ts:71,80-81` `oldRow.restaurant_id ?? null` · `useSettings.ts:68-69` · `app/page.tsx:156,161` · `app/log/page.tsx:92,100` · `app/rank/page.tsx:100,109`(`toRankResultRow` `:25-30` 로 4컬럼만 깎음) · 리듀서 `lib/rowset.ts:46` `return change.key === null ? rows : rows.filter((row) => keyOf(row) !== change.key);` · `:53` INSERT 멱등 · `:91` 조회 전 `pending` 버퍼 · `:98` `const exhaustive: never = action;` · 설정 `lib/settings.ts:63` `Number.isFinite(row.cooldown_days) && row.cooldown_days > 0 ? row.cooldown_days : 0` · `:67` `historySince: row.history_since ?? null` · `:57` `parseSpinTime`(`_shared/spinTime.ts:21-27` — `RegExp.exec` 가 비문자열도 문자열로 강제해 `null` 착지, `throw` 0) · `:97-98` DELETE/빈 행 → `DEFAULT_SETTINGS` · 결과 `app/page.tsx:137` `if (row.date !== todayKey) return;` · `lib/candidates.ts:126-132` `isNewSpin` NaN 안전 · `:54` 카탈로그 밖 후보 버림 · `:113` `restaurant_id === null → -1` · `CalendarLog.tsx:192` `entry.candidates?.length ?? 0` · `:217` 배열·길이 가드 · 위조 가능성: `postgres_changes` 는 Realtime 서버가 WAL 에서 생성하고 클라이언트가 같은 토픽에 보낼 수 있는 것은 `broadcast`/`presence` 뿐이라 `.on("postgres_changes")` 핸들러에 닿지 않는다 — 행 형태는 0005 컬럼 타입·check 로 묶이고 `results`·`settings` 행은 service_role 만 쓴다 · spec `rowset.test.ts`(DELETE key null · pending 재적용) · `settings.test.ts:77-78,89` · `candidates.test.ts:311,319,333,339` | MITIGATED |
| **T5** | 데이터 노출 / 조회 범위 — 불필요 컬럼·무제한 기간·PII | 랭킹 컬럼 4개, 기록 2개월 창, PII 없음, anon 전면 읽기는 설계 | `app/rank/page.tsx:18` `const RANK_COLUMNS = "id,date,menu,restaurant_id";` · `:79` `.select(RANK_COLUMNS)` · `:80` `if (lowerBound !== null) query = query.gte("date", lowerBound);` · `app/log/page.tsx:68-73` `.gte("date", start).lt("date", end)`(보는 달 + 다음 달) · `app/page.tsx:110-114` `.eq("date", todayKey).maybeSingle()` · `app/restaurants/page.tsx:49-53` `.select("date").eq("date", todayKey)` · 0005 컬럼에 개인정보 없음(이름·메뉴·위치·핀 / 키·시각 / 설정), 로그인 없음 · anon 읽기 정책 `0005:78,88,101` 은 설계(PROJECT.md:93) · 키는 `lib/supabase/client.ts:5-6` `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY` 뿐 | MITIGATED |
| **T6** | 쓰기 경로 — 클라이언트가 `results`·`settings` 를 쓰거나, 필터 없는 삭제, respin 이 POST 외로 나감 | `results`·`settings` 클라이언트 쓰기 0건, 삭제·갱신은 전부 `.eq` 키 지정, respin 은 `functions.invoke` 기본 POST | `grep -rn 'from("results")'` app/lib → `app/page.tsx:111`·`app/restaurants/page.tsx:50`·`app/log/page.tsx:69`·`app/rank/page.tsx:79` **전부 SELECT** · `from("settings")` → `lib/useSettings.ts:44` SELECT 만 · `\.insert(\|\.update(\|\.upsert(\|\.delete(` 전수: `app/page.tsx:197` `.from("candidates").insert({ restaurant_id: id })` · `:212` `.from("candidates").delete().eq("restaurant_id", id)` · `app/restaurants/page.tsx:86` `.insert({ name, menus, location })`(id·pinned·created_at 미지정) · `:105-107` `.update({…}).eq("id", id).select("id")` · `:128` `.delete().eq("id", id).select("id")` · `:153-154` `.update({ pinned: !currentlyPinned }).eq("id", id)` · (`CandidateList.tsx:157` 는 `Set.delete`) · FK `0005:43` `references public.restaurants(id) on delete cascade` → 23503 번역 `lib/errors.ts:102` · respin `app/page.tsx:229` `supabase.functions.invoke<RespinResponse>("respin-roulette")` → `node_modules/@supabase/functions-js/dist/main/FunctionsClient.js:251` `method: method || 'POST'` · 함수 쪽 405 가드는 04 T-04-05 · `results` 쓰기 정책 0건(0001) · `settings` 쓰기 정책 0건 `0005:99-101` | MITIGATED (anon CRUD 자체는 ACCEPTED — R-0507-01) |
| **T7** | 가용성 — 무한 목록 렌더, 1초 리렌더, 랭킹 1,000행 상한, 필터 ReDoS, Realtime 폭주 | 목록은 스크롤 상자·수십 행 전제(수용), 무거운 파생값 memo, 정규식 없음, 상한은 문서화 | 목록 `RestaurantList.tsx:461-462` `maxHeight: 520, overflowY: "auto"` · `CandidateList.tsx:289-290` `maxHeight: 420` · 페이지네이션 없음 = 수용(T-05-12/T-06-15, 05-CONTEXT D-11) · 1초 `setInterval` 4곳(`app/page.tsx:39`·`restaurants/page.tsx:18`·`log/page.tsx:22`·`rank/page.tsx:38`, CLAUDE.md:64 관례) · memo: `restaurants/page.tsx:68` `useMemo(() => sortRestaurants(rows))` · `app/page.tsx:77-93` 조인·정렬·당첨·winner 4개 · `RankingView.tsx:9` `useMemo(() => buildRanking(results))` · 비memo 는 `CandidateList.tsx:69`(`:64-67` 근거) · `CalendarLog.tsx:29,34`(42칸·≤2개월 행) · 필터 `lib/candidates.ts:84-86` `normalize("NFC").toLowerCase()` + `includes` · `grep 'new RegExp\|RegExp('` app/components/lib(테스트 제외) → **0** · PostgREST 1,000행 상한: `.planning/codebase/CONCERNS.md:182,239` "전환일 이후 하루 1행이라 … 약 3년" 문서화 = 수용(R-0507-05) · `lib/supabase/client.ts:9` `realtime: { params: { eventsPerSecond: 10 } }` — 이 값은 **클라이언트가 보내는** 메시지 속도 제한이라 수신 폭주 방어가 아니다. 수신 측 부하는 행 크기 상한(0005, D-19)과 익명 쓰기 수용(R-0507-01)으로 한계가 정해진다 · respin 연타가 열린 탭 전부의 휠을 5초씩 돌리는 것(`app/page.tsx:141-143`)은 R-04-01 의 귀결 | MITIGATED / ACCEPTED(무한 목록 · 1,000행 · 익명 쓰기 — R-0507-01·02·05) |
| **T8** | 공급망 / 설정 — 새 npm 의존성, 코드 내 비밀, `NEXT_PUBLIC_*` 에 anon 외 키 | 의존성 diff 0, 비밀 0, env 는 anon 2개, 배포 파일 무변경 | `git diff --stat 1086888..HEAD -- package.json package-lock.json` → **0줄**(1086888 = Phase 4 감사 HEAD, Phase 5 시작 직전; `git log` 같은 범위 → 커밋 0) · `22e5506^..HEAD` 도 0줄 · 설치된 `@supabase/supabase-js` 2.106.0(`package.json:15` `^2.106.0`) 그대로 · `grep -rnE 'eyJ[A-Za-z0-9_-]{20,}\|sb_secret_\|sb_publishable_\|SUPABASE_SERVICE'` app/components/lib → **0**(주석의 낱말 `service_role` 2곳뿐: `app/page.tsx:226`·`client.ts:38`) · `process.env` → `lib/supabase/client.ts:5-6` 두 줄뿐 · `.gitignore:34-35` `.env*` / `!.env.example` · `git ls-files` 의 env 는 `.env.example`(값 비어 있음)뿐 · `git diff --name-only 1086888..HEAD -- supabase/migrations/*.sql supabase/functions/{spin,respin}-roulette supabase/config.toml supabase/functions/deno.{lock,json}` → **0** · `_shared/spinTime.ts` 변경은 주석 2줄 · 게이트: `tsc` 0 · `eslint` 0/0 · vitest 380/380 · `npm audit` 는 이 감사의 허용 명령 밖(네트워크)이라 재실행하지 않았다 — lock 이 Phase 4 감사(`found 0 vulnerabilities`) 이후 무변경이므로 같은 입력이다 | MITIGATED |

---

## 플랜 레지스터 매핑 (Phase 5·6 `<threat_model>` 31건)

| Threat ID | Category | Disposition | 매핑 | Evidence | Status |
|-----------|----------|-------------|------|----------|--------|
| T-05-01 | Tampering | mitigate | T2 | `lib/restaurants.ts:22-23,40-57` 코드포인트 판정 | closed |
| T-05-02 | Info Disclosure | mitigate | T3 | `lib/errors.ts:70-85` `message` 만 · `error.(details\|hint)` 0 | closed |
| T-05-03 | Tampering | mitigate | T1 | `lib/restaurants.ts:75-76` · spec `:228-236` | closed |
| T-05-04 | DoS | mitigate | T2 | `lib/restaurants.ts:44,50,53` 거부 · 메뉴 **원소** 는 `lib/menus.ts:24` 절단(플랜 문면 "거부" 와 다르나 상한 ≤24 는 동일하게 지켜지고 spec `restaurants.test.ts:151` 이 그 사실을 명시) | closed (편차 기록) |
| T-05-05 | Tampering | mitigate | T2 | `lib/menus.ts:13-15` `Array.from(...).slice` · spec `menus.test.ts:55-66` | closed |
| T-05-06 | Tampering | mitigate | T1 | `LocationLink.tsx:21` (RestaurantList 는 `:314` 로 위임) | closed |
| T-05-07 | Info Disclosure | mitigate | T3 | `app/restaurants/page.tsx:88-162` 전부 `formatRestaurantWriteError` | closed |
| T-05-08 | Tampering | mitigate | T4 | `useRestaurants.ts:85-86` · `rowset.ts:46` | closed |
| T-05-09 | Repudiation | mitigate | — | `RestaurantList.tsx:117-128` `DeleteConfirm` · `:352-366` 파급 문구 · `window.confirm\|alert\|prompt` 0 | closed |
| T-05-10 | Spoofing | mitigate | — | `useRestaurants.ts:38` `` `restaurants-${++topicSeq}` `` | closed |
| T-05-11 | EoP | **accept** | T6 | R-0507-01 | closed |
| T-05-12 | DoS | **accept** | T7 | R-0507-02 | closed |
| T-06-01 | Tampering | mitigate | T7 | `lib/candidates.ts:84-86` · `RegExp` 0 | closed |
| T-06-02 | Info Disclosure | mitigate | T3 | `lib/errors.ts:93-104` · `:103` `readableMessage` | closed |
| T-06-03 | Tampering | mitigate | T4 | `lib/rowset.ts:44-46` | closed |
| T-06-04 | Tampering | **accept** | T4 | R-0507-03 | closed |
| T-06-05 | Spoofing | mitigate | T4 | `lib/candidates.ts:110-116` id 만 · spec `:319` | closed |
| T-06-06 | Tampering | mitigate | T4 | `lib/candidates.ts:51-54` | closed |
| T-06-07 | DoS | mitigate | T4 | `lib/candidates.ts:126-132` · `app/page.tsx:141` | closed |
| T-06-08 | EoP | **accept** | T6 | R-0507-01 | closed |
| T-06-09 | Tampering | mitigate | T1 | `LocationLink.tsx:21` · `ResultBlock.tsx:101` | closed |
| T-06-10 | Info Disclosure | mitigate | T3 | `app/page.tsx:198-218` · `` setActionError(` `` 는 respin 접두 3곳뿐(`:234,239,248`) | closed |
| T-06-11 | DoS | mitigate | T4 | `app/page.tsx:57,119,138-144` `todayResultRef` + `isNewSpin` | closed |
| T-06-12 | Spoofing | mitigate | — | `app/page.tsx:152` effect 안 `` `results-${++topicSeq}` `` · `useCandidates.ts:40` · `useSettings.ts:39` · `log:87` · `rank:95` · `"lunch-realtime"` 0 | closed |
| T-06-13 | Tampering | mitigate | T4 | `useCandidates.ts:71,80-81` | closed |
| T-06-14 | Repudiation | **accept** | — | R-0507-04 | closed |
| T-06-15 | DoS | **accept** | T7 | R-0507-02 | closed |
| T-05-SC / T-06-SC | Tampering | mitigate | T8 | package diff 0줄 | closed |
| T-05-LIVE / T-06-LIVE | Tampering | mitigate | — | `git branch --show-current` → `feat/restaurant-roulette` · `git branch -r --contains HEAD` → 없음(미푸시) · `origin/main` = `49d0643`(Phase 4 감사 때와 동일) · 마이그레이션·함수·config·lock diff 0 · 이 감사의 원격 명령 0 | closed |

---

## Open issues

**없음(BLOCKER 0).** 아래는 차단 사유가 아닌 권고다.

### 권고 1 (Low · 비차단) — `formatLoadError` 만 200자 상한을 지나지 않는다

- `lib/errors.ts:17-20` `return \`${label} 불러오기 실패: ${error.message}\`;` — `readableMessage` 미경유. `:13-14` 는 상한을 "한 함수가 아니라 배너 한 줄의 성질" 이라고 적었는데(05 IN-08 개명 근거) 로드 경로 4곳(`app/page.tsx:116,264-266`·`restaurants/page.tsx:55,172-173`·`log:76,138`·`rank:83,126`)은 그 성질을 받지 않는다. 같은 성격의 잔여: `RestaurantList.tsx:209` `setFormError(e instanceof Error ? e.message : String(e))`(콜백이 이미 전부 catch 하므로 사실상 도달 불가) · `lib/settings.ts:72` 경고문에 `row.spin_time` 원문(`time` 컬럼, anon 쓰기 불가).
- 왜 OPEN 이 아닌가: 세 입력 모두 **공격자가 통제하지 못한다**(SELECT 실패의 `message` 는 PostgREST/게이트웨이가 만들고, `settings` 는 service_role 만 쓴다). `formatLoadError` 의 형태는 Phase 5 이전(`git show 1086888:lib/errors.ts:15`)과 동일해 이 세 페이즈의 회귀도 아니다. 영향은 게이트웨이가 긴 비JSON 본문을 돌려줄 때 배너가 길어지는 UX 뿐이고 `ErrorBanner` 에 닫기 버튼이 있다.
- 제안: `formatLoadError` 의 `error.message` 를 `readableMessage(error.message) ?? "알 수 없는 오류"` 로 바꾸고 `errors.test.ts` 에 로드 경로 200 경계 1건을 더한다(한 줄 변경, Phase 8 SHIP 정리에 편승 가능).

---

## Accepted risks

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-0507-01 | T-05-11 · T-06-08 (→ T6·T7) | anon 이 `restaurants` 를 CRUD 하고 `candidates` 를 담고 뺀다 — 인증·레이트리밋 없음. `0005:77-94` 정책 8건이 `using (true)`/`with check (true)`, `PROJECT.md:93` "RLS는 익명 개방", `CLAUDE.md:63` "RLS는 의도적으로 열려 있다". 피해 상한: 카탈로그 파괴(영구, 복구 수단 없음 — 05-CONTEXT §deferred) · 오늘 후보 조작(자정 리셋). `respin-roulette` 무인증(R-04-01)과 같은 수용 수준 | 플랜 시점 disposition=accept (05-02 · 06-02 `<threat_model>`) | 2026-09-29 |
| R-0507-02 | T-05-12 · T-06-15 (→ T7) | 카탈로그·후보 목록에 페이지네이션·가상화 없음(05-CONTEXT D-11). 수십 개 규모 전제, 스크롤 상자(`maxHeight`)로 레이아웃만 묶는다. 상한 필요 시 v2 CATL-V2-01 | 플랜 시점 accept | 2026-09-29 |
| R-0507-03 | T-06-04 (→ T4) | `lib/rowset.ts:55-56` UPDATE 가 모르는 키를 추가(upsert). Postgres 변경 스트림 순서 보장(06-CONTEXT D-05)에 기대며, 오적용돼도 다음 조회·이벤트가 바로잡는다 | 플랜 시점 accept | 2026-09-29 |
| R-0507-04 | T-06-14 | 후보 빼기에 확인 단계 없음(`CandidateList.tsx:145-161` 토글 즉시 호출). 휘발 데이터 + 같은 버튼으로 복구 | 플랜 시점 accept | 2026-09-29 |
| R-0507-05 | (→ T7) | 랭킹 조회가 PostgREST 기본 행 상한(1,000)에 걸리면 에러 없이 집계가 틀린다. `CONCERNS.md:182,239` 가 "약 3년" 으로 기록. Phase 7 에는 플랜 레지스터가 없어 여기서 명시 수용으로 올린다 | 이 감사(CONCERNS 기록 인용) | 2026-09-29 |
| (참조) R-04-01 · R-04-02 | T-04-10 · T-04-04 | `04-SECURITY.md` 그대로. 재론하지 않음 | — | 2026-09-28 |

---

## Unregistered Flags

네 SUMMARY 의 `## Threat Flags` 는 전부 "없음" 이고 표의 항목이 플랜 ID 에 1:1 로 매핑된다(위 레지스터 표로 재검증). Phase 7 은 절 자체가 없다. 아래는 감사자가 추가로 기록하는 정보성 항목이다 — **블로커 아님**.

| Flag | 위치 | 내용 | 처리 |
|------|------|------|------|
| UF-0507-01 | `07-01-PLAN.md` | Phase 7 에 `<threat_model>` 이 없다(빠른 레인). 새 공격면은 `results` SELECT 2종(컬럼·기간 축소)과 순수 집계뿐이라 이 문서의 T4·T5·T7 로 흡수했다 | 정보성. Phase 8 은 현행 루틴이므로 레지스터가 다시 생긴다 |
| UF-0507-02 | `lib/errors.ts:17-20` | 권고 1(로드 경로 200자 상한 미적용) | Phase 8 SHIP 정리 후보 |
| UF-0507-03 | 워킹트리 | 감사 도중 워킹트리가 **이 감사와 무관한 동시 작업**으로 바뀌었다: 14:50:31 에 `M vitest.config.mts`(`supabase/rollback/**/*.test.ts` 수집 추가)·`?? supabase/rollback/0005_restaurants_settings.rollback.test.ts` 가 나타났다가 14:55 에는 사라지고 대신 `M .planning/REQUIREMENTS.md` 가 나타났다. 이 감사의 `npm test`(14:50:07, 14 files/380)·`tsc`·`eslint` 는 그 변경 전 트리를 검사했고, 그 파일들은 범위 밖이라 판정하지 않았다. 이 감사가 트리에 남긴 것은 이 문서 하나다 | 정보성. Phase 8 작업물로 추정 — 그 페이즈의 감사가 다룬다 |

---

## Security Audit Trail

| Audit Date | Scope | Threats | Closed | Open | Run By |
|------------|-------|---------|--------|------|--------|
| 2026-09-29 | Phase 5·6·7 합본, HEAD `e1040e3` | 의뢰 8 + 플랜 31 | 8 + 31 | 0 | gsd-security-auditor (grep·git 읽기 명령·`tsc`·`eslint`·`vitest` 재실행. 구현 파일 무수정, 커밋 0, 원격 명령 0, 임시 파일 잔존 0) |

---

## Sign-Off

- [x] 의뢰 위협 8건 전부 file:line 증거로 판정 (MITIGATED 8 · 그중 설계 수용 부분은 ACCEPTED 로 병기)
- [x] Phase 5·6 플랜 레지스터 31건 전부 closed (mitigate 25 · accept 6)
- [x] 수용 위험 5건 신규 기록 + Phase 4 항목 2건 참조
- [x] `threats_open: 0`
- [x] 권고 1건(Low, 비차단)·정보성 플래그 3건 기록

**Approval:** SECURED 2026-09-29
