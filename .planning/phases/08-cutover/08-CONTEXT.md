# Phase 8: 컷오버 - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

문서를 현행화하고(SHIP-03), 롤백 절차를 먼저 적고(SHIP-02), 배포 체크리스트를 순서대로 문서화한 뒤(SHIP-04), 게이트 5종 green 상태로 PR 을 연다(QUAL-05). **라이브를 바꾸는 실행(마이그레이션 적용·Edge Function 배포·PR 머지)은 이 페이즈의 산출물이 아니라 사용자가 체크리스트대로 수행하는 운영 행위다** — Claude 는 원격 SQL 을 실행할 수 없고(보안 차단), 프로덕션 배포·원격 적용은 명시 지시가 있을 때만 한다. 브랜치 푸시 + PR 열기까지가 Claude 의 마지막 동작이고, 머지는 사용자가 체크리스트 5번에서 한다.

Phase 5~7 묶음 보안감사(`07-SECURITY.md`)는 이 페이즈 시작과 함께 fable 감사자가 1회 수행한다. Phase 8 자체 코드는 롤백 SQL(실행되지 않는 파일)과 문서뿐이라 별도 감사를 두지 않는다.

</domain>

<decisions>
## Implementation Decisions

사용자 위임("가자", 2026-09-29) + 시간 요구 → 직접 실행 레인 유지(플랜 1개, 실행 직접), 검증은 fable 1회(리뷰 + 목표 역검증 겸함). 리서치 생략: 미지수(Supabase CLI 배포·pg_cron·Vercel)는 Phase 4·기존 README·메모리에 이미 있다.

### 롤백 — SHIP-02
- **D-01** 롤백 SQL 은 `supabase/rollback/0005_restaurants_settings.rollback.sql` 한 파일. `supabase/migrations/` 에 두지 않는 이유: CLI 의 `db push` 가 그 디렉터리를 마이그레이션으로 읽는다. 내용은 0005 의 역순: 새 cron 3종 unschedule → 구 cron 2종 재등록(`spin-lunch-roulette` `55 2 * * *`, `reset-menus` 0004 형태) → `menus`·`pinned_menus` 재생성(0001·0004 스키마 + RLS 정책 + publication) → `results.restaurant_id` 는 **떨구지 않는다**(구 코드가 모르는 컬럼은 무해하고, 재컷오버 때 데이터가 남는다) → `restaurants`·`candidates`·`settings` 도 **떨구지 않는다**(사용자가 등록한 매장은 데이터다 — 롤백은 동작 복원이지 데이터 파기가 아니다. 파기는 마지막 절에 주석 처리된 문으로만 둔다). 전부 재실행 안전형(if not exists / jobid 루프).
- **D-02** 롤백 판단 기준을 README 에 적는다: (a) 마이그레이션이 중간에 에러로 끊겼고 재실행으로도 안 넘어감, (b) 컷오버 당일 `respin-roulette` 수동 invoke 가 `ok: true` + 매장명 + uuid 를 안 줌, (c) 다음 날 추첨 시각 + 5분까지 `results` 행이 안 생김(Edge Function Logs 에 `console.error`). 그 외 UI 문제는 롤백이 아니라 hotfix.
- **D-03** 구 Edge Function 재배포 방법: `git checkout main -- supabase/functions` 후 같은 deploy 명령(main 이 아직 구 코드일 때), 머지 뒤라면 `git checkout <컷오버 전 main 해시> -- supabase/functions`. 해시는 체크리스트 0번에서 사용자가 적어 둔다. 앱 롤백은 Vercel 대시보드 "Promote previous deployment" 또는 `git revert` 머지 커밋.
- **D-04** 롤백 SQL 의 계약 테스트 `supabase/rollback/0005_restaurants_settings.rollback.test.ts`(0005 spec 과 같은 텍스트 파싱 방식): 새 잡 3종 unschedule · 구 잡 2종 schedule · `menus`·`pinned_menus` `create table if not exists` · RLS 정책 6개 · publication 존재 검사 · **`drop table` 문이 주석 밖에 0개**. `vitest.config.mts` include 에 `supabase/rollback/**/*.test.ts` 한 줄 추가(Phase 1 의 수집 경계 원칙대로 디렉터리 단위).

### 배포 체크리스트 — SHIP-04 (todo `wr-01` 1~8 을 README 로 흡수)
- **D-05** README `## 컷오버 절차` 절에 0~9 순서: 0 사전(컷오버 전 main 해시 기록, gh 계정 F1rstID, `menus`·`pinned_menus` 0행 육안, Vercel env 확인) → 1 `results` 덤프(대시보드 Table Editor → CSV export 또는 SQL Editor `select * from public.results order by date` 결과 저장) → 2 **12:00 KST 이후** 시작 → 3 SQL Editor 에서 0005 1회 실행(에러 시 재실행 안전) → 3b 그날 추첨 이후 적용이면 `update public.settings set history_since = history_since + 1 where id = 1;` → 4 Edge Function 2종 배포(`npx supabase@2.117.0 functions deploy spin-roulette --project-ref swxiqytyxjlcgubqlozk --no-verify-jwt`, respin 동일; 다른 동명 프로젝트 `dtuwddiepnxygtotwglv` 금지) → 5 `respin-roulette` 수동 invoke 로 `ok`·`menu`(매장명)·`restaurant_id`(uuid) 확인 — 매장 1개·후보 1개를 먼저 등록해야 하므로 5 는 PR 머지 뒤 화면에서 하거나, 머지 전이라면 SQL 로 `restaurants`·`candidates` 에 1행씩 insert → 6 PR 머지(Vercel 자동 배포) → 7 라이브 확인(매장 등록 → 후보 담기 → 다시 돌리기 → 매장 결과, 과거 `results` 행 수 = 덤프 행 수) → 8 다음 날 추첨 시각 + 5분에 `results` 행 확인 → 9 롤백 판단 기준. 3~6 은 한 세션 몇 분 안에 연속.
- **D-06** 순서의 근거를 각 단계에 한 줄씩(0005 머리 주석·wr-01 원문·07 리뷰 WR-01: 랭킹의 명시 컬럼 조회는 3 이 먼저여야 동작).

### 문서 현행화 — SHIP-03
- **D-07** README 전면 개정: 개요(매장 룰렛·설정 시각·후보 토글)·스택·로컬 개발(`npm ci`, 가드런처 주의, 검증 명령 5종)·디렉터리(`lib/` 순수 모듈·훅, `supabase/functions/_shared`, `supabase/rollback`)·Vercel·Supabase 인프라(테이블 4 + RLS 요약 + cron 3종 `spin-roulette` 매분·`reset-candidates`·`purge-cron-history` + Edge Function 2종 + `settings` 편집 방법 + 프로젝트 ref 치환 위치 0002·0005)·컷오버 절차·롤백·메모리 주의. `.env.example` 언급 유지. 낡은 진술 4건(`menus`·`results` 만 / `reset-menus` truncate / Edge Function 1개 / 11:55 고정) 전부 제거.
- **D-08** CLAUDE.md 는 Phase 4~7 이 이미 현행화했으므로 컷오버 관련 문장만 고친다: "두 함수 모두 아직 배포되지 않았다 … 컷오버 Phase 8" → "배포·마이그레이션 적용은 README 의 컷오버 절차로 함께 한다(순서가 어긋나면 42P01/500/42703)". "컷오버 전 라이브에서 배너가 정상" 류 문장은 **절차 완료 전까지 참**이므로 "컷오버 전" 조건부 표현을 유지한다. `.planning/codebase/CONCERNS.md` 의 README 낡음 항목([P2] 정본 문서 뒤처짐)을 해소 표기.
- **D-09** 문서의 시제: PR 은 컷오버 절차 6번에서 머지되므로 README 본문은 새 모델을 현재형으로 쓰되, 맨 위에 "이 문서는 0005 적용 + 함수 배포 + 머지가 끝난 상태를 기술한다. 절차 진행 중이면 `## 컷오버 절차` 를 본다" 한 줄을 둔다.

### todo 결정
- **D-10 (`in-07` 결정 — 미적용·수용)** 조회를 `subscribe` 콜백 안으로 옮기지 않는다. 최소 버전도 웹소켓이 막힌 네트워크(사내 프록시)에서 REST 조회까지 함께 죽여 "Realtime 없어도 읽기는 된다" 는 현행 보장을 깬다. 콜드 로드 창(~수백 ms)과 재연결 공백은 수용하고 `CONCERNS.md` 에 "알려진 공백 + 고칠 방향(`SUBSCRIBED` 콜백 재조회 + `rowset` 두 번째 `fetched` 교체 + `pending` 재적립)" 으로 남긴다. 랭킹 재조회 창(07 IN-06)도 같은 항목. todo 파일은 `git rm`.
- **D-11 (`wr-01`)** 내용을 README 절차로 흡수하고 `git rm`.

### PR — QUAL-05
- **D-12** 게이트 5종 green 확인 → `gh auth switch --user F1rstID` → `git push -u origin feat/restaurant-roulette` → `gh pr create --base main` 제목 "매장 기준 룰렛 전환 + settings 테이블", 본문은 `.planning/config.json` `ship.pr_body_sections` 순서(User Stories → Risks → Success Metrics)를 손으로 채운다 + 컷오버 절차 링크 + **"머지는 README 컷오버 절차 6번 — 3·4 를 먼저"** 경고. AI 표기 0(커밋·PR 본문 모두). 머지하지 않는다.
- **D-13** `.planning/` 은 PR 에 포함된다(브랜치에 이미 커밋돼 있고 정본). `.serena/project.yml`·`.planning/config.json` 은 계속 미커밋.

### 검증
- **D-14** fable 1회: 리뷰(롤백 SQL·문서 사실 대조 — 0005 와 역순 일치, cron 이름·스케줄 문자열 일치, README 의 명령·경로가 실제 파일과 일치) + 목표 역검증(ROADMAP 성공 기준 1~4; 5 는 컷오버 후 manual-only). `08-REVIEW.md` + `08-VERIFICATION.md`. 수정은 직접.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` §Phase 8 성공 기준 1~5 · `.planning/REQUIREMENTS.md` SHIP-02·03·04·QUAL-05.
- `supabase/migrations/0005_restaurants_settings.sql` 머리 주석(2~9행, 동작 불변 조건·순서) + 절 7(cron)·8(drop).
- `supabase/migrations/0001_init.sql`·`0002_cron.sql`·`0004_pinned_menus.sql` — 롤백이 복원할 구 스키마·정책·cron 의 정본.
- `.planning/todos/pending/wr-01-cutover-window.md`(1~8) · `in-07-realtime-resync-on-reconnect.md`.
- `.planning/phases/04-server-spin/04-0{2,3}-SUMMARY.md` 의 배포 주의(verify_jwt false 고정, 임베드 형태는 첫 실호출에서만 드러남).
- 메모리 `lunch-roulette-deploy-gotchas`(gh 계정 F1rstID, 동명 프로젝트 금지) — `gh auth status` 현재 활성 계정은 MAZE-JungWan 이라 전환 필요.

</canonical_refs>

<specifics>
## Specific Ideas

- Claude 의 마지막 동작은 PR 열기. 그 뒤 사용자에게 체크리스트 0~9 를 그대로 보여 주고 멈춘다.
- 컷오버 당일 `history_since` 처리(3b)는 07 D-09 의 결정을 절차로 옮긴 것.

</specifics>

<deferred>
## Deferred Ideas

- Realtime 재연결 재조회(in-07 방향) — v2, CONCERNS 에 방향만.
- 로컬 Supabase 스택 리허설(02 D-15 선택 항목) — 하지 않음, 재실행 안전형 SQL 로 대체.
- `settings` 편집 UI — v2(대시보드 SQL 로 편집).

</deferred>

---

*Phase: 08-cutover*
*Context gathered: 2026-09-29*
