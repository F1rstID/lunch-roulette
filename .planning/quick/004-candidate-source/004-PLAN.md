---
quick_id: "004"
slug: candidate-source
created: 2026-10-30
branch: feat/candidate-source
lane: direct (플랜·실행 직접, TDD, 리뷰 1회) — 사용자 결정 d527fe42
design_source: 사용자 보고 2026-10-30("담기 눌러서 담겨 있는데 룰렛에 안 보임") → D1 선택 A (결정 d9d5d722)
---

# Quick Task 004: 사람이 담은 후보는 이번 주 제외를 뚫고 룰렛에 오른다

## 문제

오늘 후보는 두 경로로 생긴다 — 자정 cron `reset-candidates` 가 📌 핀 매장을 자동으로 담는 것과, 사람이 낮에 오늘 탭에서 담기를 누르는 것. 0007 의 주간 제외(이번 주 간 매장 · 이번 주 쉬기)는 둘을 구분하지 않아, 사람이 방금 담은 매장도 "담긴 채 흐리고 휠에 없는" 상태가 된다. 담기는 "오늘 룰렛에 올린다" 는 뜻인데 화면이 그 뜻을 거부한다.

## 설계 (승인됨 — D1 A)

- **`candidates.source`** `text not null default 'seed' check (source in ('seed','manual'))` (0008). cron 재시드는 `'seed'` 를 명시해 쓰고, 오늘 탭 담기는 `'manual'` 을 쓴다. 기본값이 `'seed'` 인 이유: 적용 순서(SQL → 함수 → 머지) 사이에 구 클라이언트가 `source` 없이 넣는 행과 적용 시점에 이미 있는 행이 전부 seed 로 읽혀 **적용 순간 동작이 바뀌지 않는다**. 새 클라이언트가 머지된 뒤부터만 manual 행이 생긴다.
- **규칙 한 문장:** 이번 주 제외(쉬기·방문)는 **seed 행에만** 적용한다. manual 행은 쉬기여도 방문이어도 항상 pool·휠에 오른다. "담기 = 오늘 무조건 룰렛". 쉬기까지 이기는 것은 의도다 — 오늘 담기는 이번 주 쉬기보다 나중의, 더 좁은 사람의 뜻이다(쉬기를 몰래 되살리는 자동 폴백과 다르다).
- **정의처 하나:** `supabase/functions/_shared/cooldown.ts` `applyWeeklyExclusions<T extends { restaurant_id; source }>` 가 유일한 판정이고, Edge 2종과 클라이언트 `wheelPool` 이 그대로 부른다(리뷰 CR-01 의 규율 유지). 형태 방어는 "manual 이 아니면 seed" — 사람 뜻이 확인되지 않은 행을 되살리지 않는 쪽이 안전하다.
- **목록 배지:** 바꾸지 않는다. `wheelPool.offWheel` 은 "실제로 휠에서 빠진 매장" 이라 manual 행은 자연히 빠지고 번호 배지를 받는다. 안 담긴 방문·쉬기 매장은 전처럼 사유 배지를 보이고(정보), 담으면 번호가 된다. 담긴 seed 행을 되살리는 제스처는 빼기 → 담기(두 탭, 새 행이 manual).
- **문구:** 오늘 탭 푸터 "이번 주 간 곳·쉬는 곳은 자동으로 빠져요" → 자동으로 담긴 매장에만 해당함과 직접 담으면 올라감을 말한다. 매장 탭 쉬기 버튼 title·푸터에 "직접 담으면 오늘은 올라가요" 한 구절.

### 구조(A축)
1. **경계.** 판정은 `_shared/cooldown.ts` 한 곳. Edge 는 `source` 를 읽어 좁히기만, 클라이언트는 `CandidateRow.source` 를 `TodayCandidate` 로 옮기기만 한다.
2. **의존 방향.** `CandidateSource` 타입의 정의처는 `_shared/cooldown.ts`(import 0 유지 — 타입 export 는 런타임 export 가 아니라 계약 #36 의 6개 그대로). `lib/supabase/client.ts`·`lib/candidates.ts`·`lib/lunchDay.ts` 는 `import type` 으로 받는다.
3. **테스트 용이성.** 규칙은 순수 함수 spec(`cooldown.test.ts` · `lunchDay.test.ts`)으로, SQL·Edge 는 텍스트 계약으로 고정한다.
4. **변경 국소성.** `source` 값 집합은 SQL check · `CandidateSource` 타입 · Edge 좁히기 셋이 같은 두 낱말을 가정한다 — CLAUDE.md 위험 표에 적는다.

### 기각한 대안
- B) 방문만 덮어쓰고 쉬기 매장은 담기 버튼 비활성: 상태 하나·경합 하나가 늘고 "오늘만 가자" 가 매장 탭 해제를 요구한다.
- C) `restaurants.pinned` 로 자동/수동 추정: 핀 매장은 다시 담아도 못 되살리고, 낮에 핀을 토글하면 같은 행의 판정이 바뀐다(추정은 데이터가 아니다).
- `created_at` 이 자정 근처면 seed: 시계·cron 지연에 기대는 추정.

## 데이터

- `supabase/migrations/0008_candidate_source.sql`: `alter table public.candidates add column if not exists source text not null default 'seed' check (source in ('seed', 'manual'))` + comment + `reset-candidates` 잡 unschedule → 재등록(`insert into public.candidates (restaurant_id, source) select id, 'seed' …`). 재실행 안전형. 다른 잡·표·정책은 건드리지 않는다.
- `supabase/rollback/0008_candidate_source.rollback.sql`: **cron 을 0005 문장으로 먼저 되돌리고** 그 다음 `drop column if exists source`. 순서 이유: 컬럼을 먼저 지우면 그 사이 자정 cron 이 `source` 를 써 실패해 그날 시드가 빠진다. 새 클라이언트의 담기(`source: 'manual'`)는 컬럼 없이 PGRST204 라 PR 되돌림이 먼저다(역순).
- `CandidateRow.source: CandidateSource`. 0005 spec #38 의 CandidateRow 필드 목록을 `RESTAURANT_ROW_FIELDS` 와 같은 방식으로 가른다(`CANDIDATE_ROW_FIELDS`).

## 적용 순서 (README "0008 적용" 절)

1. 사용자가 SQL Editor 에서 0008 실행. 구 함수·구 UI 는 컬럼을 모르고 그대로 동작한다(`select *` 는 컬럼이 늘어도 무사, Edge 는 명시 컬럼이라 영향 없음).
2. 함수 2종 배포. **1번보다 먼저 배포하면 안 된다** — 새 함수는 `select("…, source, …")` 라 컬럼이 없으면 42703 으로 후보 조회가 실패해 그날 추첨을 잃는다.
3. PR 머지. 머지 전의 새 UI 를 컬럼 없는 DB 에 붙이면 담기가 PGRST204 배너로 실패한다 — 그래서 1번이 먼저다.

## 작업 (TDD: 테스트 → 구현)

1. 0008 SQL + spec, 롤백 SQL + spec, 0005 spec `CANDIDATE_ROW_FIELDS`.
2. `_shared/cooldown.ts` `CandidateSource` + `applyWeeklyExclusions` seed 한정(spec #37~#40: manual 방문 생존 · manual 쉬기 생존 · seed 전원 쉬기 + manual 하나 → allPaused 아님 · 방문 전멸 폴백은 seed 기준). `lib/lunchDay.ts` `wheelPool` 제약·전달(spec #57~#59). `lib/candidates.ts` `TodayCandidate.source`·`joinCandidates`. `lib/supabase/client.ts` `CandidateRow.source`. 픽스처 갱신.
3. Edge 2종 — `Candidate.source`, select 에 `source`, `normalizeCandidates` 좁히기("manual" 아니면 "seed"), 머리 주석. `edgeImports.test.ts` 계약 추가(select 문자열 · 좁히기 식, 두 파일).
4. `app/page.tsx` 담기 insert `source: "manual"`(Why 주석). `components/CandidateList.tsx` 푸터 문구. `components/RestaurantList.tsx` 쉬기 title·푸터 구절.
5. README(인프라 표 `candidates` 행 · cron 줄 · "## 0008 적용" · `cooldown_days` 제거는 0009), CLAUDE.md(엔트리포인트 page/cooldown/candidates · 계약 수 · 위험 표 행 · 미사용 코드 0009), STATE.md(Quick 004 행 + 낡은 "push·PR pending" 정정), SUMMARY.
6. 게이트 5종(tsc · lint · test · build · check:edge) → 리뷰 1회 → 반영 → 푸시 → PR(본문에 적용 순서).

## 인수 조건

- `applyWeeklyExclusions([{r1 seed}, {r2 manual}], {visitedIds:[r1,r2]})` → picked `[r2]`, fellBack false. `[{r1 seed}], {pausedIds:[r1]}` → allPaused. `[{r1 seed},{r2 manual}], {pausedIds:[r1,r2]}` → picked `[r2]`, allPaused false.
- `wheelPool` 에서 manual 방문 매장은 items 에 있고 offWheel 에 없다.
- 두 Edge 파일의 select 가 `restaurant_id, created_at, source, restaurants ( id, name, paused_week )` 이고 좁히기 식이 각 1회.
- 0008 SQL: `add column if not exists source` 1 · check 두 값 · cron unschedule 루프 + `cron.schedule('reset-candidates', '0 15 * * *'` 1 · insert 에 `(restaurant_id, source)` · `'seed'`. 롤백: cron 재등록이 drop column 보다 앞.
- 게이트 5종 exit 0. 커밋에 AI 표기 0.
