---
phase: 08-cutover
verified: 2026-09-29T06:01:39Z
status: passed
score: 4/5
passed: 4
failed: 0
pending: 0
manual_only: 1
---

# Phase 8: 목표 역검증

> **재판정(2026-09-29, 오케스트레이터):** 리뷰 18건 처리 뒤 기준 1·3 은 passed(WR-04·IN-10·IN-11 / CR-01·WR-01~03·06 반영, `5b0efb1`·`4f330c7`·`4f68d0d`·`eb17355`), 기준 4 는 PR #4 개설(https://github.com/F1rstID/lunch-roulette/pull/4, 게이트 5종 exit 0 · 392 tests · 커밋·PR 본문 AI 표기 0)로 passed. 기준 5 는 manual-only(README 컷오버 절차 7·8). 최종 **4/5 passed + 1 manual-only**. 아래는 초회 검증 원문이다.

**검증 시각:** 2026-09-29T06:01:39Z (HEAD `18058a6`)
**방법:** ROADMAP §Phase 8 성공 기준 1~5 를 각각 레포의 실제 파일·명령 결과와 대조. 리뷰(`08-REVIEW.md`)의 발견을 근거로 인용한다.
**로컬 게이트 실측:** `npm test` 15 files / 391 passed · `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `git log 8678f02..HEAD --format=%B | grep -viE 'CLAUDE\.md' | grep -ciE 'co-authored-by|generated with|claude|anthropic'` → 0 · `git ls-files supabase/migrations | grep -c rollback` → 0. `npm run build`·`npm run check:edge` 는 이 검증의 허용 명령 밖이라 미실행.

## 성공 기준별 판정

| # | 기준 | 판정 | 근거 |
|---|---|---|---|
| 1 | `CLAUDE.md`·`README.md` 가 현행 스키마 4테이블·Edge Function 2종·검증 명령(`npm test` 포함)·새 컨벤션(설정 단일 소스·`_shared`·마이그레이션 동작불변 기본값)을 정확히 기술하고 낡은 진술 4건이 없다 | **failed** (경미 — 문장 3곳) | 충족: README 67~80행 4테이블·RLS·cron 3종·함수 2종이 0005·`index.ts` 와 전부 일치, 33~41행 검증 명령 5종 = `package.json` scripts, 낡은 진술 4건(`menus`·`results` 만 / `reset-menus` truncate / 함수 1개 / 11:55 고정) grep 0건, CLAUDE.md 의 "아직 배포되지 않았다" 가 컷오버 절차 참조로 교체됨. **미충족:** CLAUDE.md:39 vitest 수집 목록에 이 페이즈가 추가한 `supabase/rollback/**` 이 빠져 "…뿐이다" 가 거짓(WR-04) — 기준이 명시한 "검증 명령(`npm test` 포함)" 항목의 부정확. CLAUDE.md:97 "menus 계열" 이 현행 스키마에 없음(IN-10). "동작불변 기본값" 컨벤션은 숫자만 있고 문장이 없음(IN-11) |
| 2 | 롤백 절차 문서화: 구 테이블(`menus`·`pinned_menus`) 복원 SQL, 구 cron 재등록 SQL, 이전 Edge Function 재배포 방법, 되돌리는 판단 기준 | **passed** | `supabase/rollback/0005_restaurants_settings.rollback.sql` 28~56행 두 테이블 + 정책 6 + 60~71행 publication, 75~96행 구 cron 2종(`55 2 * * *`·`0 15 * * *`, 0004 본문) — 0001·0002·0004 와 대조해 일치, `main` 의 구 함수·구 페이지가 읽는 컬럼 전부 복원, 파기문 주석 밖 0건(spec 이 고정). README 121~138행: 판단 기준 (a)(b)(c) = D-02, 순서 SQL → 함수 → 앱, 구 함수 재배포 = `git checkout <해시> -- supabase/functions` + deploy 2줄 = D-03, 앱 롤백 = Vercel promote / `git revert`. 주의: `git revert -m 1` 은 머지 방식에 따라 실패(WR-06) — 대안(Vercel promote)이 있어 기준 충족은 유지 |
| 3 | 배포 체크리스트가 순서대로: `results` 덤프 → 마이그레이션(사용자 SQL Editor) → Edge Function 2개 deploy → PR 머지(Vercel 자동) → 라이브 확인 | **failed** | 순서 자체는 맞다: README 92~119행 0 사전 → 1 덤프 → 2 12:00 이후 → 3 0005(+3b) → 4 deploy 2종 → 5 respin 수동 → 6 머지 → 7 라이브 확인 → 8 익일 → 9 롤백, 단계별 근거 한 줄씩(D-06), todo `wr-01` 삭제 확인. **미충족:** 7번 "오늘 탭에서 후보 담기" 가 컷오버 당일 실행 불가 — 오늘 `results` 행이 있으면 `lib/phase.ts:23,39` 가 `decided` 로 토글을 잠그고, 5번 정리가 유일한 후보를 cascade 로 지워 "다시 돌리기" 가 `no_candidates` 로 끝난다(CR-01). 5번의 실패 시그니처가 현행 `normalizeCandidates` 동작과 불일치(WR-01), 3b·7 의 count 판정이 "그날 추첨 행 존재" 를 전제하나 명시 없음(WR-02), 8번·(c) 가 후보 0개의 정상 skip 을 실패로 읽게 함(WR-03). "순서대로 문서화" 는 실행 가능해야 의미가 있으므로 failed |
| 4 | `tsc`·`lint`·`test`·`build` 전부 통과한 상태로 PR 이 열려 있고 커밋·PR 에 AI 표기가 없다 | **pending** (오케스트레이터 Task 4) | PR 은 리뷰 시점에 열리지 않았다(설계상 이 검증 뒤에 연다). 로컬 실측: test 391 passed · tsc 0 · lint 0 · 커밋 본문 AI 표기 grep 0. `build`·`check:edge` 는 미실측(허용 명령 밖) — Task 4 에서 5종 전부 exit 0 을 다시 확인할 것. 작업 트리에 `.planning/REQUIREMENTS.md`·`.planning/config.json`·`.serena/project.yml` 미커밋 변경 있음(D-13: 뒤 둘은 계속 미커밋) |
| 5 | 컷오버 후 라이브에서 매장 등록 → 후보 담기 → 다시 돌리기가 매장 결과로 확정되고 과거 `results` 60행이 그대로 남아 있다 | **manual-only** | 사용자가 README 7번에서 수행. 단 CR-01 을 고치기 전에는 이 기준의 "후보 담기" 를 오늘 탭에서 할 수 없고(당일은 SQL 로, 토글은 익일 오전), "60행 그대로" 는 WR-02 의 분기(그날 행이 없던 날은 +1)를 적어야 정확히 판정된다 |

## 갭과 구체적 수정

### GAP-1 (기준 3, CR-01) — 7번을 당일/익일로 분리

`README.md:117` 을 다음으로 교체:

```
7. **라이브 확인(컷오버 당일)** — 매장 탭에서 매장 등록(잠금 없음). 오늘 결과 행이 있는 동안 오늘 탭의 담기/빼기는 잠긴다(`decided`) — 후보는 SQL Editor 로 담는다:
   insert into public.candidates (restaurant_id) select id from public.restaurants where name = '<등록한 매장>';
   오늘 탭 "다시 돌리기" → 매장명이 결과로 뜨고 휠이 그 조각을 가리키는지. 기록 탭 과거 날짜 비어 있음. `select count(*) from public.results;` 는 1번 값과 같아야 한다(1번에서 오늘 행이 0이었던 날은 +1).
8. **익일 확인** — (a) 추첨 시각 전 오늘 탭에서 토글로 후보 담기(잠금 해제 확인, 1개 이상). (b) 추첨 시각 + 5분에 `results` 행 확인. 없으면 Logs: `no_candidates` 만 있고 `console.error` 가 없으면 후보가 없었던 것(실패 아님), `console.error` 가 있으면 그 원인.
```

5번 끝의 정리 문장은 "7번이 끝난 뒤" 로 옮기거나, 7번의 후보로 5번의 확인용 매장을 재사용한다.

### GAP-2 (기준 3, WR-01) — 5번 실패 시그니처 교체

`README.md:115` "`menu` 가 빈 문자열이거나 `restaurant_id` 가 없으면 PostgREST 임베드 접기가 틀린 것" → "`skipped: "no_candidates"` 인데 `excluded_count > 0` 이면 PostgREST 임베드 접기가 틀린 것(Logs 에 `매장 조인 형태 불일치` 1건). `excluded_count: 0` 이면 후보 insert 가 안 된 것. `settings_fallback`·`cooldown_skipped` 가 `true` 면 Logs 를 본다."

### GAP-3 (기준 3, WR-02·WR-03) — 전제 명시

- `README.md:93` 1번에 `select count(*) from public.results where date = (now() at time zone 'Asia/Seoul')::date;` 결과(0/1) 기록 추가.
- `README.md:96` 3b "(2번대로면 항상)" → "(1번의 오늘 행이 1일 때만 — 0이면 건너뛴다)".
- `README.md:126` (c) 에 "후보가 1개 이상 담겨 있었는데" 추가.

### GAP-4 (기준 1, WR-04·IN-10·IN-11) — CLAUDE.md·README 세 문장

- `CLAUDE.md:39` 수집 목록에 `·supabase/rollback/**` 추가.
- `CLAUDE.md:97` "menus 계열·" 삭제.
- `README.md:81` 앞에 "0005 의 기본값은 전환 전 동작(11:55, 쿨다운 없음)과 같다 — 동작 변경은 마이그레이션이 아니라 `settings` UPDATE 로만 한다." 한 줄.

### GAP-5 (기준 2 보강, WR-06) — 머지 방식 고정 또는 분기

`README.md:116` 6번에 "Create a merge commit 으로 머지(롤백 3번 `-m 1` 의 전제)" 를 적거나 `:137` 을 "merge commit 이면 `git revert -m 1 <해시>`, squash/rebase 면 `git revert <해시>`" 로.

### GAP-6 (부수, WR-05·IN-01·IN-08) — 상호참조

`.planning/codebase/CONCERNS.md:325,336` 의 `wr-01` 참조 → README 3b / 5번. `README.md:92` "롤백 3번" → 2번. `STRUCTURE.md:48` "0001~0004" → 0005.

## 결론

**gaps_found, 1/5** (passed 1 · failed 2 · pending 1 · manual-only 1). 실패 둘은 모두 문서 문장이고 코드 변경이 없다 — GAP-1~4 를 적용하면 기준 1·3 이 passed 로 바뀌고, 기준 4 는 Task 4 의 PR 개설과 `build`·`check:edge` 실측으로 닫힌다. 롤백 SQL·spec·게이트 3종은 이미 계약대로다.

---

_검증: 2026-09-29T06:01:39Z_
_검증자: Claude (gsd-code-reviewer, 목표 역검증 겸)_
