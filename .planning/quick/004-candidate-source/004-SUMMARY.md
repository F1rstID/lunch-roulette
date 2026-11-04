---
quick_id: "004"
slug: candidate-source
completed: 2026-10-30
branch: feat/candidate-source
status: complete (PR 대기 — 적용 순서 0008 SQL → 함수 2종 배포 → 머지, README "0008 적용")
---

# Quick Task 004: 사람이 담은 후보는 이번 주 제외를 뚫고 룰렛에 오른다 — Summary

## 결과

- `candidates.source`(`seed` | `manual`, 기본 `seed`, 0008). 자정 cron `reset-candidates` 는 `'seed'` 를 명시해 📌 매장을 시드하고, 오늘 탭 담기는 `'manual'` 을 쓴다.
- 이번 주 제외(간 매장 · 이번 주 쉬기)는 **seed 행에만** 적용된다. 사람이 오늘 담은 매장은 쉬기여도 방문이어도 휠·추첨 pool 에 항상 오른다 — "담기 = 오늘 룰렛에 올린다". manual 이 하나라도 있으면 `all_paused` 도 `weekly_fallback` 도 아니다.
- 판정은 `supabase/functions/_shared/cooldown.ts` `applyWeeklyExclusions` 한 곳이고, Edge 2종과 오늘 탭 `wheelPool` 이 같은 함수에 `source` 를 넘긴다. 목록 배지는 바뀌지 않았다 — manual 행은 `offWheel` 에서 자연히 빠져 번호 배지를 받는다.
- 이미 담긴(📌 seed) 매장을 되살리는 제스처는 **빼기 → 담기**(새 행이 manual). `lib/rowset.ts` 가 아는 키의 INSERT 를 교체해 DELETE 를 놓친 탭도 그 새 행을 받는다.
- 문구: 오늘 탭 푸터 "그중 이번 주 간 곳·쉬는 곳은 빠져요 · 직접 담으면 그래도 올라가요(이미 담긴 매장은 빼고 다시 담기)", 매장 탭 쉬기 버튼 title·푸터에 "직접 담으면 올라가요".

## 설계 출처

사용자 보고 2026-10-30("담기 눌러서 담겨 있는데 룰렛에 안 보임") → D1 세 안 중 A(source 컬럼 · 담기가 전부 이김) 선택, 결정 d9d5d722. 기각: B(쉬기 매장은 담기 비활성), C(핀 여부로 추정 — 핀 매장을 못 되살림).

## 한 일

| 항목 | 내용 |
|---|---|
| DB | `0008_candidate_source.sql`(add column if not exists + 인라인 check + comment + `reset-candidates` unschedule → `source='seed'` 명시 재등록). 롤백은 **잡을 0005 문장으로 먼저** 되돌리고 drop column. 텍스트 계약 spec 10 + 6. 0005 spec #38 은 `CANDIDATE_ROW_FIELDS` 로 가름 |
| 규칙 | `_shared/cooldown.ts` `CandidateSource` 타입 + `applyWeeklyExclusions<T extends { restaurant_id; source }>` — 두 단 모두 `source === "manual"` 면 면제(한 방향 판정, 모르는 값은 제외 유지). spec #37~#41 |
| Edge | 두 `index.ts` — `Candidate.source`, `select("restaurant_id, created_at, source, restaurants ( id, name, paused_week )")`, `normalizeCandidates` 좁히기(`"manual"` 아니면 `"seed"`), 머리 주석. 계약 #67(select 문자열·좁히기 식·타입 import, 두 파일) |
| 클라이언트 | `CandidateRow.source` · `TodayCandidate.source`(`joinCandidates`) · `wheelPool` 제약·전달(spec #57~#60) · 담기 insert `source: "manual"` · `rowset` 아는 키 INSERT 교체(spec 1) · `useCandidates` 주석 |
| 문서 | README 인프라 표·cron 줄·"## 0008 적용"(확인 쿼리·순서·빼기→담기·롤백)·`cooldown_days` 제거는 0009, CLAUDE.md(엔트리포인트 6곳·계약 67·위험 표 `candidates.source` 행·미사용 코드), STATE.md(낡은 "push·PR pending" 정정 + Quick 004 행) |

## 검증

- `npx tsc --noEmit` · `npm run lint` · `npm test`(27 files · **593** — 004 이전 566) · `npm run build` · `npm run check:edge` exit 0.
- 리뷰 1회(`004-REVIEW.md`): Critical 0 · Warning 3 · Info 3 → Warning 3·Info 2 반영, Info 1 기록(0007 spec 선례와 같은 패턴).
- 라이브 쓰기 0 · DB·Edge 배포·main 무변경.
- **미검증(라이브 데이터 없음):** 담기 뒤 번호 배지로 바뀌는 화면, 빼기 → 담기 뒤 manual 행의 Realtime 반영, 자동 추첨 응답의 `weekly_fallback` 이 manual 있는 날 false 인지 — 0008 적용 뒤 사용자 확인 대상(README 4번).

## 적용 순서 (README "0008 적용")

1. 사용자: SQL Editor 에서 0008 실행(기본값 seed 라 적용 순간 동작 불변). 2. `spin-roulette`·`respin-roulette` 배포(`--no-verify-jwt`) — SQL 보다 먼저 금지(42703). 3. PR 머지 — 머지 전 새 UI 를 컬럼 없는 DB 에 붙이면 담기가 PGRST204.

## 다음

- 0009: `settings.cooldown_days` 제거 + respin `spun_at` 트리거화(기존 0008 예정분을 뒤로 밈).
- 방문 버튼 2주 관찰 뒤 👍👎 씨앗(`.planning/seeds/thumbs-vote.md`).
