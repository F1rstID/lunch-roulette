---
phase: 02-data-model
plan: 03
subsystem: validation
tags: [read-through-review, phase-gate, checkpoint, migration, supabase, audit, requirements]

# Dependency graph
requires:
  - phase: 02-02
    provides: "0005_restaurants_settings.sql(154줄) · 계약 테스트 47건 · lib/supabase/client.ts 행 타입 3종 — 이 플랜이 읽고 검증할 대상"
  - phase: 02-01
    provides: "vitest.config.mts include 글롭 — npx vitest run supabase/migrations 가 47건을 수집하는 전제"
provides:
  - "02-VALIDATION.md 낭독 리뷰 기록 11항목 — 계약 테스트가 형태만 보는 지점(방향·기본값·부분 커버리지)에 사람이 읽은 인용 근거를 붙인 기록. Phase 8 컷오버 체크리스트의 입력"
  - "02-VALIDATION.md Per-Task Verification Map 8행(실제 태스크·플랜·웨이브·위협 ID) + wave_0_complete: true"
  - "02-VALIDATION.md Phase Gate 기록 6줄(tsc·lint·test·build·audit·migrations) + 라이브 무접촉 증거 3줄"
  - "사용자 승인 기록(2026-09-21, '승인') — 0005 SQL 을 사람이 직접 읽고 8단계 질문에 답한 뒤 원안 그대로 승인. Phase 8 은 이 승인을 근거로 적용한다"
  - "SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03 완료 마킹 — 02-01·02-02 가 의도적으로 미뤄 둔 단일 마킹 지점"
affects: [03-settings-phase, 04-edge-function, 05-restaurant-ui, 06-page-cutover, 08-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "실행할 수 없는 1회성 산출물(라이브에서 처음 도는 마이그레이션)은 자동 검사 위에 낭독 리뷰를 한 겹 더 얹는다 — 판정만 쓰지 않고 파일:줄 인용을 함께 남겨야 기록이 다음 페이즈의 근거로 쓰인다"
    - "자동/사람 검증 경계를 기록에 명시한다 — '이 항목은 it #N 이 형태를 본다 / 이 항목은 사람만 본다 / 이 항목은 8줄 중 3줄만 자동이다'를 적어 두면 다음 리뷰어가 중복 노동을 하지 않는다"
    - "라이브 무접촉은 주장이 아니라 명령 출력으로 증명한다 — diff 범위 2줄 · CLI 부재 · AI 표기 0건"
    - "요구사항 완료 마킹은 페이즈 안에서 한 플랜만 한다 — 파일을 만든 플랜이 아니라 검증을 닫는 플랜이 찍는다"

key-files:
  created:
    - .planning/phases/02-data-model/02-03-SUMMARY.md
  modified:
    - .planning/phases/02-data-model/02-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "낭독 리뷰 11항목을 '통과' 두 글자로 닫지 않고 파일:줄 인용 + 별도 대조표 3개(항목 4·5·10)로 남겼다 — T-02-11(기록의 정직성) 완화. 판정만 남은 기록은 Phase 8 에서 재검증 비용을 그대로 되돌려준다"
  - "자동 검사가 '아예 없다'고 쓰지 않고 '있지만 대조 대상이 스펙 리터럴이라 CONTEXT 원문과의 대조는 자동화돼 있지 않다'로 정확히 적었다 — 과장된 안전 주장도, 과장된 위험 주장도 Phase 8 판단을 흐린다"
  - "요구사항 5건을 이 플랜에서 마킹했다 — 02-01 이 조기 마킹을 되돌리고 02-02 가 requirements-completed: [] 로 남긴 이유를 이어받았다. 파일 존재가 아니라 '사람이 읽고 승인했다'가 이 페이즈의 완료 정의다"
  - "사용자 지적 0건이라 SQL·스펙·타입을 한 줄도 고치지 않았다 — 승인 후 '정리' 커밋을 덧붙이지 않는다. 승인 대상과 Phase 8 이 적용할 파일이 바이트 단위로 같아야 승인이 의미를 갖는다"

requirements-completed: [SHIP-01, SETT-01, CATL-07, CAND-04, HIST-03]

# Metrics
duration: 11min (자동화) + 체크포인트 대기
completed: 2026-09-21
---

# Phase 2 Plan 03: 낭독 리뷰 · 페이즈 게이트 · 사용자 승인 Summary

**로컬에서 실행할 수 없고 Phase 8 라이브에서 처음이자 한 번에 도는 `0005_restaurants_settings.sql` 을 사람이 전문 낭독해 11항목을 인용 근거와 함께 통과로 기록하고, 게이트 6종과 라이브 무접촉 증거 3줄을 남긴 뒤 사용자 승인(2026-09-21 "승인")으로 Phase 2 를 닫았다 — 소스 코드 변경 0줄.**

## Performance

- **Duration:** 11min (자동화 구간) + 체크포인트 대기
- **Started:** 2026-09-18T09:57Z (Task 1 착수)
- **Automation complete:** 2026-09-18T10:04Z (Task 2 커밋 `7d31b89`)
- **User approval:** 2026-09-21 ("승인")
- **Completed:** 2026-09-21T00:19Z (페이즈 클로즈 재검증 + SUMMARY)
- **Tasks:** 3 (auto 2 · checkpoint 1)
- **Files created:** 1 · **modified:** 2 (`02-VALIDATION.md` · `REQUIREMENTS.md`) — **소스 코드 0**

## Accomplishments

- **낭독 리뷰 11항목 전부 통과**, 불통과 0건. 판정마다 `파일:줄` 또는 원문 인용이 붙어 있고, 의미 항목 3건(4·5·10)은 CONTEXT 원문과 나란히 놓은 **별도 대조표**로 남겼다.
- **Per-Task Verification Map 8행**이 실제 태스크(`02-02 T1/T2/T3` · `02-01 T1`)·플랜·웨이브·위협 ID(`T-02-03`·`T-02-04`·`T-02-06`)로 채워지고 `wave_0_complete: true`. `nyquist_compliant`·`status` 는 checker 소관이라 건드리지 않았다.
- **페이즈 게이트 6종 전부 exit 0** (`vitest migrations` 47 · `npm test` 83 · `tsc` · `lint` · `build` · `audit` 0건). 승인 후 페이즈 클로즈 시점에 **전량 재실행해 동일 결과**를 확인했다.
- **라이브 무접촉 3줄 증명:** supabase diff 2줄 · supabase CLI `NOT INSTALLED` · AI 표기 0건.
- **사용자가 0005 SQL 을 직접 읽고 8단계 질문에 답한 뒤 원안 그대로 승인.** 지적 0건 → SQL·스펙·타입 무수정.
- **요구사항 5건 완료 마킹** — 02-01·02-02 가 의도적으로 비워 둔 단일 마킹 지점을 이 플랜이 집행했다.

## Task Commits

1. **Task 1: 낭독 리뷰 11항목 수행 및 기록** — `1a22ef3` (docs)
2. **Task 2: 검증 맵 채우기 + 페이즈 게이트 5종 + 라이브 무접촉 증거** — `7d31b89` (docs)
3. **Task 3: 사용자 낭독 승인 (checkpoint:human-verify, gate=blocking)** — 커밋 없음(확인 전용, 파일 무변경)

**Plan metadata:** 이 SUMMARY 커밋 + 뒤따르는 상태 갱신 커밋(STATE·ROADMAP).

## 낭독 리뷰 11항목 결과

대상: `supabase/migrations/0005_restaurants_settings.sql` 154줄 **전문 통독**(부분 grep 대체 아님). 기록 정본은 `.planning/phases/02-data-model/02-VALIDATION.md` `## 낭독 리뷰 기록 (11항목)`.

| # | 항목 | 결과 | 자동 대응 | 핵심 근거 |
|---|------|------|-----------|-----------|
| 1 | 머리 주석 "동작 불변 원칙" | 통과 | it #33 | `:2` "적용한 직후의 동작은 지금과 똑같다(11:55 추첨, 쿨다운 없음)" |
| 2 | 프로젝트 ref + 치환 주석 | 통과 | it #32 | `:120` 치환 주석 · `:121` `swxiqytyxjlcgubqlozk` URL |
| 3 | 자정계 cron 2잡 KST↔UTC 계산식 | 통과 | it #34 | `:133` `KST 00:00 = UTC 15:00 (전일)` · `:144` `KST 00:30 = UTC 15:30 (전일)` |
| **4** | **settings 기본값 3+1건 문자 단위 일치** | **통과** | **부분(스펙 리터럴)** | `:36-39` `id ... check (id = 1)` · `'11:55'` · `0` · `((now() at time zone 'Asia/Seoul')::date)` — D-03 원문과 문자 동일 |
| **5** | **cascade/set null 방향** | **통과** | **없음** | `:26` candidates → `on delete cascade` · `:55` results → `on delete set null`. 방향 정상 = HIST-03 보존 |
| 6 | `results` 실행문 1건 | 통과 | it #23 | grep 4건 중 실행문 1건(`:55`), 나머지는 문자열 리터럴 1·주석 2 |
| 7 | `drop table` 2줄이 파일 최후미 | 통과 | it #10 | `tail -5` → `:153` `pinned_menus;` · `:154` `menus;`, 뒤에 실행문 없음 |
| 8 | Pitfall 6 재회전 주석 | 통과 | it #26 | `:53-54` "휠이 재회전한다. 가드는 Phase 6 소관" |
| 9 | publication 3이름 전부 | 통과 | it #43 | `:92` `array['restaurants', 'candidates', 'settings']` — 3/3 육안 확인 |
| **10** | **restaurants·candidates 컬럼 8건 대조** | **통과** | **8줄 중 3줄만** | `:11-16` + `:26-27` = 8/8. 자동은 #45·#46·#47 뿐 |
| 11 | 정책 drop/create (테이블,이름) 쌍 1:1 | 통과 | it #4 | drop 9 · create 9, 매 drop 다음 줄이 같은 쌍의 create. 중복 이름 0 |

**불통과 0건 / 11항목 통과.**

### 사람만 잡을 수 있었던 항목 — 4 · 5 · 10

- **항목 5 (방향)** — 자동 검사가 **없다**. it #47 은 `candidates` 의 cascade 절 형태를, it #24 는 `results` 의 `add column` 문 형태를 각각 따로 본다. **"두 절이 서로 반대 테이블에 붙었는지"** 를 판정하는 단언은 47건 어디에도 없다. 뒤바뀌면 매장 삭제가 과거 `results` 행을 통째로 지워 **HIST-03 이 파괴**된다 — 이 페이즈에서 가장 비싼 오류를 막는 유일한 게이트였다.
- **항목 4 (기본값)** — it #27·#28·#29·#44 가 같은 네 줄을 검사하지만, 기대값이 **스펙 작성자가 옮겨 적은 리터럴**이다. 스펙과 SQL 이 같은 오타를 공유하면 둘 다 초록이다. CONTEXT D-03 **원문과의 대조**는 이 항목이 유일하다.
- **항목 10 (컬럼 정의)** — 자동은 8줄 중 3줄(#45 `id` · #46 `menus` · #47 `candidates.restaurant_id`)만 리터럴로 덮는다. **`location text`(null 허용) · `pinned boolean not null default false` · `created_at timestamptz not null default now()` ×2** 는 이 항목이 유일한 검증 지점이다.

나머지 1·2·3·6·7·8·9·11 은 계약 테스트가 형태 수준에서 이미 보고 있다 — 라이브 1회성 파일이라 육안으로 한 번 더 본 것이다(T-02-11).

## 게이트 5종 + audit (승인 후 재실행, 2026-09-21)

Task 2(2026-09-18) 기록과 페이즈 클로즈 재실행 결과가 **전부 동일**하다. 승인 대기 구간에서 워킹트리가 표류하지 않았다는 확인이다.

| # | 명령 | Exit | 출력 |
|---|------|------|------|
| 1 | `npx vitest run supabase/migrations` | 0 | `Test Files 1 passed (1)` · `Tests 47 passed (47)` · 153ms |
| 2 | `npm test` | 0 | `Test Files 5 passed (5)` · `Tests 83 passed (83)` · 297ms |
| 3 | `npx tsc --noEmit` | 0 | 출력 0바이트 |
| 4 | `npm run lint` | 0 | eslint 출력 0줄 — **신규 에러 0건** |
| 5 | `npm run build` | 0 | `✓ Generating static pages (6/6)`, 라우트 4개(`/`·`/_not-found`·`/log`·`/rank`) 전부 `○ (Static)` |
| 6 | `npm audit` | 0 | `found 0 vulnerabilities` — critical·high 0 유지(T-02-SC. 이 페이즈는 패키지를 설치하지 않았다) |

**`npm run build` 는 `02-VALIDATION.md` 의 10초 지연 예산을 넘는다 — 페이즈 게이트는 지연 예산의 예외다**(페이즈를 닫는 최종 관문이라 페이즈당 한 번만 돈다). 태스크 단위 피드백 루프는 여전히 #1(153ms)·#3 으로 돈다.

`npm run lint` 관측: `CLAUDE.md` 가 2026-09-15 기준으로 적어 둔 `components/Wheel.tsx` `react-hooks/set-state-in-effect` 1건은 **이번에도 재현되지 않았다**(02-01·02-02 와 동일한 세 번째 관측). 이 페이즈는 `components/**` 를 건드리지 않았으므로 Phase 1 이후 이미 해소된 상태를 확인한 것이다. `CLAUDE.md` 수정은 이 플랜 범위 밖이라 하지 않았다 — Phase 6(`components/Wheel.tsx` 를 실제로 고치는 페이즈)에서 정리할 항목.

## 라이브 무접촉 증거 3줄

| # | 명령 | 출력 | 의미 |
|---|------|------|------|
| 1 | `git diff --name-only main...HEAD -- supabase` | `0005_restaurants_settings.sql`<br>`0005_restaurants_settings.test.ts` | **두 줄뿐.** Edge Function(`supabase/functions/**`)·기존 마이그레이션 0001~0004 무변경 |
| 2 | `command -v supabase \|\| echo NOT INSTALLED` | `NOT INSTALLED` | CLI 부재 → `supabase db push`·`supabase functions deploy` 가 **실행될 수 없었다** |
| 3 | `git log $(git merge-base main HEAD)..HEAD --format=%B \| grep -cE 'Co-Authored-By\|Generated with\|Claude-Session'` | `0` | 브랜치 전체 커밋 메시지에 AI 표기 0건 |

보조 증거: `git diff --name-only 9251b3c..HEAD -- lib app components` → `lib/supabase/client.ts` **1줄뿐**(Phase 2 시작 커밋 기준). 브랜치 `feat/restaurant-roulette` 유지. `git log …--name-only | grep -c '.serena/'` → `0`.

마이그레이션 **적용**과 **롤백 SQL 문서화**는 Phase 8 소관이며(D-12 / SHIP-02), 이 페이즈는 파일만 썼다 — 라이브 Supabase DB·Edge Function·`main` 브랜치는 무접촉이다(T-02-10 · T-02-LIVE).

## 사용자 승인 기록 (Task 3 — checkpoint:human-verify, gate=blocking)

- **일자:** 2026-09-21
- **응답 원문:** `승인`
- **제시한 근거:** `02-VALIDATION.md` 낭독 리뷰 11항목 표 + Phase Gate 기록 요약, 그리고 8단계 질문(0005 SQL 전문 통독 → cascade/set null 방향 → settings 기본값 3건 → settings 쓰기 정책 부재 → cron 3잡 시각 → `drop table` 2줄 실행 의사 → publication 3테이블 → 11항목 표와의 일치).
- **사용자 확인 사항:** cascade/set null 방향, settings 기본값, settings 쓰기 차단(SETT-01), cron 3잡, `drop table` 실행 의사(**"적용 직전 0행 재확인 전제"** 로 승인), publication 3테이블, VALIDATION 기록 일치 — **SQL 라인 근거와 함께 읽고 8항목 전부 확인**.
- **지적 사항:** 없음. SQL·스펙·타입 **변경 요청 0건** → 파일을 한 줄도 고치지 않았다.
- **이 승인의 효력:** Phase 8 은 `0005_restaurants_settings.sql` 을 **원안 그대로** 적용한다. 승인 이후 이 파일이 바뀌면 승인은 무효이며 재승인이 필요하다.

## Decisions Made

- **판정 두 글자 대신 인용을 남겼다.** 11항목 전부 `파일:줄` 또는 원문 문구를 붙였고, 의미 항목 3건은 CONTEXT 원문과 나란히 놓은 대조표를 따로 만들었다. Phase 8 리뷰어가 "정말 봤는가"를 되묻지 않아도 되게 하는 것이 T-02-11(Repudiation) 완화의 실체다.
- **자동 검사의 범위를 과장하지도 축소하지도 않았다.** 항목 4 에 대해 "자동 검사가 없다"고 쓰는 편이 리뷰를 극적으로 만들지만 사실이 아니다 — it #27~#29·#44 가 있고, 다만 **기대값의 출처가 스펙이라 원문 대조가 아니다**. 이 구분을 기록에 명시했다.
- **`nyquist_compliant`·`status` 를 건드리지 않았다.** 플랜이 checker/verifier 소관으로 못박은 필드다. 실행자가 자기 작업의 합격 판정을 스스로 쓰면 게이트가 사라진다.
- **요구사항 마킹을 이 플랜에서 집행했다.** 02-01 은 조기 마킹을 되돌렸고 02-02 는 `requirements-completed: []` 로 남겼다. 파일 존재가 아니라 "사람이 읽고 승인했다"가 이 페이즈의 완료 정의이므로 마킹 주체는 02-03 하나다.
- **승인 후 정리 커밋을 만들지 않았다.** 승인 대상과 Phase 8 이 적용할 파일이 바이트 단위로 같아야 승인이 의미를 갖는다.

## Deviations from Plan

**세 태스크 모두 플랜 문구대로 실행됐다.** 낭독 리뷰 불통과 0건, 사용자 지적 0건이라 Rule 1~4 발동 사유가 없었다. 기록할 것은 SDK 출력 교정 1건뿐이다.

### Auto-fixed Issues

**1. [Rule 1 - Bug] GSD SDK 생성 문자열 형식 교정 (3번째 재발 — 02-01·02-02 와 동일 계열)**

- **Found during:** 상태 갱신 단계(SUMMARY 커밋 직후)
- **Issue:** 실측 3건 + 신규 1건.
  - (a) `state.add-decision` 이 결정 3줄을 **`- [Phase ?]:`** 플레이스홀더로 썼다. 기존 로그는 전부 `- [Phase 0N]: …`. (02-02 는 문자열에 `[Phase 02]:` 를 직접 넣어 **이중 접두사**가 됐었다 — 같은 버그의 다른 얼굴이다. 이번엔 접두사를 넣지 않았더니 `?` 가 그대로 남았다. 호출자가 어느 쪽을 택해도 손질이 필요하다.)
  - (b) `roadmap.update-plan-progress` 가 Status 셀을 `| Complete   |`(패딩 3칸)로 써 같은 표의 Phase 1 행 `| Complete    |`(4칸, `Not started` 열폭 기준)과 **한 칸 어긋났다**.
  - (c) `state.record-session` 이 `last_activity` 의 서술 접미사를 날려 `2026-09-21` 날짜만 남겼다.
  - (d) **신규:** `state.record-metric` · `state.add-decision` 이 `QUERY-HANDLERS.md` 문서대로의 **위치 인자를 거부**했다(`{"error":"phase, plan, and duration required"}` · `{"error":"summary required"}`). `--phase/--plan/--duration/--tasks/--files` · `--summary` 명명 플래그로 바꾸니 통과했다 — 문서와 구현이 어긋나 있다.
- **Fix:** (a) 3줄을 `- [Phase 02]:` 로 정규화. (b) 패딩 1칸 보정. (c) `2026-09-21 -- Phase 2 complete (02-03 approved, ready for verification)` 로 복원(frontmatter·본문 2곳). 덧붙여 SDK 가 갱신하지 않은 본문 머리줄 `Phase: 2 (데이터 모델) — EXECUTING` 을 `— COMPLETE (검증 대기)` 로 맞췄다(frontmatter `status: verifying` 과 어긋나 있었다). (d) 호출을 명명 플래그로 바꿔 실행.
- **Files modified:** `.planning/STATE.md`, `.planning/ROADMAP.md` — 의미 변경 0, 형식만 기존 관례에 정렬
- **Committed in:** 상태 갱신 docs 커밋
- **에스컬레이션:** **3개 플랜 연속 재발 = SDK 쪽 버그로 확정.** 02-02-SUMMARY 가 "02-03 또는 페이즈 게이트에서 한 번 보고할 항목"으로 미뤘으므로 **이 SUMMARY 가 그 보고다.** 핸들러 4개(`state.add-decision` · `state.record-metric` · `state.record-session` · `roadmap.update-plan-progress`)가 모두 관련돼 있고, (d)는 문서-구현 불일치라 다음 실행자가 같은 시행착오를 반복한다. Phase 3 이후로 넘기지 말고 GSD 툴체인 쪽에 올릴 것.

---

**Total deviations:** 1 auto-fixed (bug, 계획 문서 형식 — 코드 영향 0)
**Impact on plan:** 없음. 소스 코드·SQL·타입 변경 0줄이라는 이 플랜의 핵심 제약이 그대로 지켜졌다.

## Issues Encountered

없음. 관측 2건만 기록한다.

1. **`CLAUDE.md` 의 lint 에러 1건 기록이 현재 사실과 다르다** (위 게이트 절 참조). 세 플랜 연속 재현되지 않았다. 범위 밖이라 고치지 않았고 Phase 6 로 넘긴다.
2. **체크포인트 대기 구간(2026-09-18 → 09-21)에 워킹트리가 표류하지 않았다.** 게이트 6종 재실행 결과가 Task 2 기록과 전부 동일하고, `git diff --name-only main...HEAD -- supabase` 도 여전히 2줄이다.

## Threat Model Compliance

| Threat ID | 상태 | 근거 |
|---|---|---|
| T-02-10 (라이브 DB·함수·`main` 변조) | mitigated | supabase diff 2줄 · `command -v supabase` → `NOT INSTALLED` · 어떤 태스크에도 적용·배포·원격 SQL 명령 없음. 브랜치 `feat/restaurant-roulette` 유지 |
| T-02-11 (검증 기록의 정직성) | mitigated | 11항목 전부 인용 근거 동반, 게이트는 명령·exit·출력 요약 원문. 자동 검사 커버리지의 한계(항목 4 의 스펙 리터럴, 항목 10 의 3/8)를 축소하지 않고 명시 |
| T-02-03 (anon 이 settings 쓰기) | mitigated | 자동(it #13, 쓰기 정책 0건) + 사람(체크포인트 4번 질문, 사용자 확인) **이중 게이트 통과** |
| T-02-06 (results 이력 무결성) | mitigated | 자동(it #23~#25) + 낭독 리뷰 항목 6(실행문 1건 육안 확인) + 항목 5(set null 방향) |
| T-02-SC (npm 공급망) | mitigated | `npm audit` → `found 0 vulnerabilities`. 이 플랜은 패키지를 설치하지 않았고 `package.json`·`package-lock.json` 무변경 |

## Known Stubs

없음. 이 플랜의 산출물은 문서 기록뿐이고 UI 로 흘러가는 빈 값·플레이스홀더가 없다.

의도적 미완 2건은 02-02 와 동일하며 둘 다 후속 페이즈 소관이다: `0005_restaurants_settings.sql` **미적용**(Phase 8), 매장 삭제 → `results` UPDATE → 휠 **재회전** 가드 부재(Phase 6).

## Verification Results

`<verification>` 전량:

| 검증 | 명령 | 결과 |
|---|---|---|
| 타입 | `npx tsc --noEmit` | exit 0 ✅ |
| lint | `npm run lint` | exit 0, 신규 에러 0 ✅ |
| 전체 스위트 | `npm test` | exit 0 — `Test Files 5 passed (5)` / `Tests 83 passed (83)` ✅ |
| 프로덕션 빌드 | `npm run build` | exit 0 — 라우트 4개 정적 생성 ✅ |
| 계약 테스트 | `npx vitest run supabase/migrations` | exit 0 — `Tests 47 passed (47)` ✅ |
| 공급망 | `npm audit` | `found 0 vulnerabilities` — critical·high 0 유지 ✅ |
| 플레이스홀더 제거 | `grep -c '(planner가 채움)' 02-VALIDATION.md` | `0` ✅ |
| Wave 0 | `grep -c 'wave_0_complete: true' 02-VALIDATION.md` | `1` ✅ |
| supabase 변경 범위 | `git diff --name-only main...HEAD -- supabase` | 2줄 ✅ |
| 코드 변경 범위 | `git diff --name-only 9251b3c..HEAD -- lib app components` | `lib/supabase/client.ts` 1줄 ✅ |
| 라이브 CLI | `command -v supabase \|\| echo NOT INSTALLED` | `NOT INSTALLED` ✅ |
| AI 표기 | `git log $(git merge-base main HEAD)..HEAD --format=%B \| grep -cE '…'` | `0` ✅ |
| 커밋 위생 | `git log …--name-only \| grep -c '.serena/'` | `0` ✅ |
| 사용자 승인 | 체크포인트 응답 | `승인` (2026-09-21) ✅ |

## User Setup Required

None — 이 플랜은 문서만 썼다. 다만 **Phase 8 에서 사용자가 해야 할 일**이 확정됐다: 대시보드 SQL Editor 에서 `0005_restaurants_settings.sql` 1회 실행, 그 직전 `menus`·`pinned_menus` 0행 육안 확인(아래 A2), 그리고 같은 창에서 Edge Function 재배포.

## Next Phase Readiness

- **D-15 — Docker 드라이런은 Phase 2 범위 밖, Phase 8 컷오버 직전 선택 항목.** `postgres:17-alpine` 이미지는 로컬에 pull 되어 있고 `02-RESEARCH.md` §Pattern 6 에 스텁 프렐류드 형태가 있다. Phase 8 계획 시 **체크리스트 선택 항목으로 올릴 것** — 이 페이즈의 검증은 텍스트 파싱(형태) + 낭독(의미)까지이고, SQL 이 실제로 **실행되는지**는 아직 아무도 확인하지 않았다.
- **D-12 — 롤백 SQL(구 테이블·구 cron 복원)은 이 페이즈가 만들지 않았다.** Phase 8 문서(SHIP-02) 소관이다.
- **가정 A2 — 적용 직전 `menus`·`pinned_menus` 0행 육안 확인이 필요하다.** 파일 최후미 `drop table` 2줄의 전제이며, 사용자도 승인 시 이 전제를 명시해 확인했다. 대시보드에서 두 테이블 행 수를 보고 나서 실행한다.
- **Phase 3 — `settings.spin_time` 은 PostgREST 에서 `"11:55:00"`(초 포함)으로 온다.** 파서가 `"11:55"` 를 전제하면 안 된다. `history_since` 는 `"yyyy-mm-dd"` 라 `results.date` 와 문자열 그대로 비교된다.
- **Phase 6 — 3건이 넘어간다.** (1) Pitfall 6 가드: 매장 삭제 → `results` UPDATE → `app/page.tsx` 결과 구독이 새 결과로 오인 → 휠 재회전. (2) `winnerIndex` 를 이름 기준에서 **id 기준**으로 전환. (3) `MenuRow`·`PinnedMenuRow` 타입 제거(0005 가 테이블을 떨구므로 타입만 남으면 유령 계약이 된다).
- **Phase 8 — 마이그레이션 적용과 Edge Function 재배포는 분리 불가한 한 쌍이다.** 적용 후 구 함수는 없어진 `menus` 를 조회해 실패한다. 순서를 나누거나 하나만 먼저 하면 그 사이 구간에 룰렛이 죽는다. 재배포 시 `--no-verify-jwt` 를 잊지 말 것(`CLAUDE.md` — config.toml 부재).

---
*Phase: 02-data-model*
*Completed: 2026-09-21*

## Self-Check: PASSED

- `.planning/phases/02-data-model/02-03-SUMMARY.md` — FOUND
- `.planning/phases/02-data-model/02-VALIDATION.md` — FOUND (낭독 리뷰 기록 · Phase Gate 기록 포함)
- `.planning/REQUIREMENTS.md` — FOUND (5건 `[x]` + 추적 표 Complete)
- commit `1a22ef3` (docs, Task 1 낭독 리뷰) — FOUND
- commit `7d31b89` (docs, Task 2 검증 맵·게이트) — FOUND
