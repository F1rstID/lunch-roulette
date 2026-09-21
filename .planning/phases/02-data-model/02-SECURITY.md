---
phase: 2
slug: data-model
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-21
verified: 2026-09-21
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

검증 원칙: SUMMARY 서술은 증거로 쓰지 않았다. 레지스터는 세 플랜(`02-01`·`02-02`·`02-03`)의 `<threat_model>` 에서 그대로 가져왔고(플랜 시점 작성), 완화 증거는 이 감사에서 `sed 's/--.*//'` 로 주석을 걷어낸 SQL 사본·스펙 파일·git 범위 명령을 **재실행**해 얻었다. 실행 증거가 필요한 항목(anon 이 `settings` 에 실제로 못 쓰는가)은 `02-REVIEW.md` 의 PostgreSQL 17.11 컨테이너 드라이런 결과를 인용한다 — 이 페이즈는 라이브 DB 를 건드리지 않으므로 그것이 유일한 실행 증거다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 익명 브라우저(anon key) → PostgREST → `public` 스키마 | public 테이블 생성 = REST 엔드포인트 개방. Supabase 가 신규 public 테이블에 anon DML 을 기본 부여하므로 RLS 활성이 유일한 게이트다 | 매장·후보 행 (개인정보 없음, 익명 설계) |
| anon → `public.settings` 단일행 | 추첨 시각·쿨다운·전환일이 여기 있다. 쓰기가 열리면 누구나 서비스 동작을 바꾼다 | 설정 값 (읽기 전용으로 잠금) |
| anon → `restaurants` DELETE → cascade `candidates` / set null `results` | 참조 무결성은 RLS 를 우회한다. 삭제 1건이 두 테이블에 파급된다 | 후보 행 삭제 · 결과 행 FK null 화 |
| pg_cron 잡 본문 → postgres 슈퍼유저 실행 | 본문은 DB 안 최고 권한으로 돈다. 동적 SQL·사용자 입력 경로가 있으면 곧 권한 상승 | 리터럴 SQL만 (`format(%I)` 인자는 코드 내 상수 배열) |
| cron → pg_net → 공개 Edge Function URL | URL 에 프로젝트 ref 하드코딩 (0002 선례) | 빈 JSON body |
| 러너 수집 경계 (`vitest.config.mts` glob → 실행 파일) | include 확대 시 `design/`(인덱서 OOM 전례)·`.planning/` 스크래치가 실행될 수 있다 | 테스트 파일 경로 |
| **워킹트리 → 라이브 Supabase / `main`** | 이 페이즈가 **건너지 않기로 한** 경계. 산출물은 전부 파일이고 적용은 Phase 8 이다 | — (무접촉) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering | `vitest.config.mts` `test.include` | mitigate | 글롭이 `supabase/migrations/**/*.test.ts` 로 한정 (`vitest.config.mts:26`). 감사 재실행 `npx vitest list` → 5파일, `design/**`·`.planning/**` 매치 0건 | closed |
| T-02-02 | Tampering | `test.exclude` extglob | mitigate | `supabase/functions/!(_shared)/**`(`:38`)·`.planning/**`(`:35`)·`design/**`(`:33`) 5항목 그대로. 감사 재실행으로 문자 확인 | closed |
| T-02-03 | Elevation of Privilege | `public.settings` (anon 쓰기) | mitigate | RLS 활성(`0005:74`) + `settings_read` select 정책 **1건만**(`:99`), insert/update/delete/`for all` 정책 0건 (STRIP 사본 grep `on public.settings` → 99행 create 1건·98행 drop 1건뿐). 회귀 가드 spec #12·#13 (`0005_….test.ts:163-172` — WR-04 수정으로 `for all`·`for` 절 생략·정책 총수 1 까지 단언). **실행 증거**: `02-REVIEW.md` 드라이런 — anon 으로 `settings` UPDATE/DELETE 0행, INSERT 는 RLS 위반 ERROR | closed |
| T-02-04 | Tampering / Information Disclosure | 신규 public 테이블 3개 (PostgREST 자동 노출) | mitigate | `enable row level security` 3/3 (`0005:72-74` — restaurants·candidates·settings). spec #11 이 3건 강제. 드라이런 사후 상태에서도 새 테이블 3개 RLS 활성 확인 | closed |
| T-02-05 | Denial of Service | `restaurants` 익명 삭제 → `candidates` cascade | accept | R-02-01 참조. 사실 주석 유지(`0005:38` "참조 무결성은 RLS 를 우회한다"), 권한 확대 없음(`candidates` delete 는 D-06 에서 어차피 개방). D-19 상한이 행 크기 폭주 경로를 별도로 닫는다 | closed |
| T-02-06 | Tampering | `public.results` 이력 무결성 (HIST-03) | mitigate | STRIP 사본에서 `public.results` 정확히 1건 = `alter table … add column if not exists restaurant_id … on delete set null` (`0005:69`). `delete from public.results`·`update public.results`·`drop table … results`·`truncate` 대소문자 무시 grep → 0건. spec #23·#24·#25 가 회귀 가드 | closed |
| T-02-07 | Elevation of Privilege | pg_cron 잡 본문 (postgres 권한 실행) | mitigate | `format(` 사용 1건(`0005:111`)이고 인자는 코드 내 상수 배열 `array['restaurants','candidates','settings']`(`:106`)뿐 — 사용자 입력 경로 0. 잡 본문 3건(`:132`·`:147`·`:158`)은 전부 리터럴 SQL, 변수 보간 없음. unschedule 은 jobid 루프(`:123` 이름 목록은 리터럴 4개) | closed |
| T-02-08 | Information Disclosure | `net.http_post` URL 프로젝트 ref | accept | R-02-02 참조. "다른 프로젝트로 옮기면 치환할 것" 주석 존재(`0005:130`, `$cmd$` 밖 — IN-01 수정으로 `job_run_details` 매분 복제에서 빠짐). spec #32 가 주석 존재를 고정 | closed |
| T-02-09 | Spoofing | 추첨 Edge Function 무인증 노출 | transfer | Phase 4 로 이관되어 있고 **문서가 실재한다**: `ROADMAP.md:75`(시각 판정을 `settings.spin_time` 으로 + 하루 1회 멱등, `23505` 정상 경로)·`:79`(`verify_jwt = false` 유지 명시). 재배포 시 `--no-verify-jwt` 주의는 `CLAUDE.md`·`02-03-SUMMARY` Next Phase Readiness 에 기록. 이 페이즈가 한 일은 cron 주기 `* * * * *` 변경뿐이며 `git diff main...HEAD -- supabase` 는 0005 두 파일뿐(Edge Function 파일 무변경) | closed |
| T-02-10 | Tampering | 라이브 DB · Edge Function · `main` | mitigate | 감사 재실행: `git diff --name-only main...HEAD -- supabase` = 0005 SQL·spec 2줄. `command -v supabase` → `NOT_INSTALLED`(= `db push`·`functions deploy` 실행 불가). 현재 브랜치 `feat/restaurant-roulette`. 페이즈 커밋 범위(`facd186..HEAD`)에 마이그레이션 적용·원격 SQL 흔적 0 | closed |
| T-02-11 | Repudiation | 검증 기록의 정직성 | mitigate | `02-VALIDATION.md:73` 낭독 리뷰 11항목이 판정만이 아니라 인용 근거를 동반하고, `:131` 은 자동 검사 커버리지의 **한계**(항목 4 스펙 리터럴 동어반복, 항목 5 방향 미판정)를 축소하지 않고 명시한다. `:137` Phase Gate 기록은 명령·exit·출력 요약 원문. `02-VERIFICATION.md` 는 SUMMARY 서술을 증거로 쓰지 않았음을 선언하고 5/5 truth 를 파일 줄 인용으로 뒷받침 | closed |
| T-02-SC | Tampering | npm 레지스트리 → `node_modules` (공급망) | mitigate | 페이즈 범위 diff(`facd186..HEAD`)에 `package.json`·`package-lock.json` **0줄** — 신규 패키지 0개. 감사 재실행 `npm audit --audit-level=high` → `found 0 vulnerabilities`, exit 0 (Phase 1 의 critical·high 0 상태 유지) | closed |
| T-02-LIVE | Tampering | 라이브 Supabase · Edge Function · `main` (플랜 01·02 판) | mitigate | T-02-10 과 동일 증거. 세 플랜 어디에도 `supabase db push`·`functions deploy`·원격 SQL 태스크가 없고, 페이즈 커밋 18파일은 전부 워킹트리 파일(`.planning/**`·`lib/supabase/client.ts`·`supabase/migrations/**`·`vitest.config.mts`) | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party / 후속 페이즈)*

**감사 재실행 결과(교차 증거):** `npx vitest run supabase/migrations` → `Tests 53 passed (53)`, `npm test` → `Test Files 5 passed (5)` / `Tests 89 passed (89)`. 회귀 가드가 실제로 수집·실행되고 있으므로 위 표의 spec 번호들이 살아 있는 가드다(수집되지 않는 스펙은 항상 초록이라는 T-02-01 의 전제를 여기서 닫는다).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-05 | `restaurants` 익명 DELETE → `candidates` cascade. 로그인 없는 익명 서비스가 제품 정체성이고(REQUIREMENTS Out of Scope "로그인·권한") 구 `menus` 와 동일 수준이라 권한 확대가 없다. 사실은 `0005:38` 주석에 남겼다 | 플랜 시점 disposition=accept (02-02-PLAN `<threat_model>`, 02-03 체크포인트에서 사용자 승인 2026-09-21) | 2026-09-21 |
| R-02-02 | T-02-08 | `net.http_post` URL 의 프로젝트 ref `swxiqytyxjlcgubqlozk` 하드코딩. ref 는 시크릿이 아니다 — 브라우저 `NEXT_PUBLIC_SUPABASE_URL` 에 이미 노출돼 있고 0002 선례를 유지한다. 이식 사고 방지용 치환 주석을 `0005:130` 에 둔다 | 플랜 시점 disposition=accept (02-02-PLAN `<threat_model>`, 사용자 승인) | 2026-09-21 |
| R-02-03 | T-02-04 / T-02-05 | `restaurants`·`candidates` 의 anon 전면 개방 정책 8건(select/insert/update/delete, `0005:79-94`). 익명 설계상 수용이며 구 `menus`(0001) 와 같은 수준이다. 보상 통제로 **D-19 DB 상한**이 들어갔다: `name` 1~24자·`btrim` 공백 전용 금지·개행 금지(`:25`), `menus` 30원소·빈 원소 금지·원소 24자(`:27`), `location <= 200`(`:28`). 세 테이블이 Realtime publication 에 있어 거대 행 하나가 열린 탭 전부로 방송되는 경로를 DB 가 직접 막는다 | 리뷰 WR-03 → D-19 로 사용자 승인 (2026-09-21), 원 disposition=accept | 2026-09-21 |
| R-02-04 | T-02-09 | 추첨 Edge Function 은 `verify_jwt = false` 로 공개 노출된다. 이 페이즈는 그 결정을 바꾸지 않고 cron 주기만 조정했다. 인증·시간 가드·멱등의 소관은 Phase 4(`ROADMAP.md:75,79`)이며, 그 전까지 노출 수준은 현행과 동일하다 | 플랜 시점 disposition=transfer (02-02-PLAN `<threat_model>`) | 2026-09-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

플랜 레지스터에 매핑되지 않은 신규 공격면. **블로커 아님**(`block_on: high`) — 다음 페이즈가 인수해야 할 항목으로 남긴다.

| Flag | 위치 | 내용 | 처리 |
|------|------|------|------|
| UF-02-01 | `0005:13` `public.text_array_max_len(text[])` | D-19 가 새로 만든 public 함수는 PostgREST 에 **RPC 엔드포인트로 자동 노출**된다(`/rest/v1/rpc/text_array_max_len`). `security definer` 아님(grep 0건) · `immutable strict` · 인자 외 상태를 읽지 않아 권한 상승·정보 노출 경로는 없다. 남는 것은 거대 배열 인자로 CPU 를 태우는 정도의 소음이며 PostgREST 요청 크기 한도 안에 있다 | 수용 가능. Phase 8 적용 후 노출 표면 목록에 이 함수를 포함해 기록할 것 |
| UF-02-02 | `0005:132-137` cron `* * * * *` | 주기 변경은 **현재 배포된** `spin-roulette`(가드 `>= 11:55`, `menus` 조회)와 짝이 맞지 않는다. SQL 적용 ~ 함수 재배포 사이에는 매분 호출이 42P01/500 으로 떨어지며 `net._http_response` 를 채운다(리뷰 WR-01 실측 논증). 가용성·소음 문제이고 데이터 무결성·권한 문제는 아니다 | 이월됨 — `.planning/todos/pending/wr-01-cutover-window.md`(Phase 8 컷오버 창 최소화). SQL 머리 주석 2~6행이 이미 조건부로 경고한다 |
| UF-02-03 | `0005:28` `location` check | `name` 은 개행을 막지만(`position(E'\n' in name) = 0`) `location` 은 길이 200자만 본다 — D-01 의 "한 줄" 정의가 DB 에서 강제되지 않는다. 리뷰 WR-03 제안(개행 금지)의 일부가 D-19 승인 범위에서 빠진 결과다 | 렌더링 측 문제(Phase 5·6 의 표시 로직)로 이월 권고. 보안 경계 아님 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-21 | 13 | 13 | 0 | gsd-security-auditor (플랜 시점 레지스터 3개 병합; 증거 = STRIP SQL grep 재실행 + spec 재실행 53/53·89/89 + `npm audit` 0 + git 범위 명령 + `02-REVIEW.md` Docker 드라이런 실행 증거. 구현 파일 무수정) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter
- [x] 미등록 공격면 3건은 Unregistered Flags 에 기록(블로커 아님, 후속 페이즈 인수)

**Approval:** verified 2026-09-21
