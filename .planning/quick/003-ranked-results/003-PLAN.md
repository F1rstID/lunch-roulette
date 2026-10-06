---
quick_id: "003"
slug: ranked-results
created: 2026-10-06
branch: feat/ranked-results
lane: direct (플랜·실행 직접, TDD, 리뷰 fable 1회) — 사용자 결정 d527fe42
design_source: Codex(gpt-6-astra) 상담 2026-10-06, 사용자 승인 "둘다 넣자"
---

# Quick Task 003: 결과 순위(1순위 + 2·3순위) 저장·표시

## 문제

추첨이 매장 하나만 정한다. 그 매장에 웨이팅이 걸리면 팀은 즉석에서 다른 곳으로 가고, 앱은 그 사실을 모른다.

## 설계 (승인됨)

- **추첨은 그대로 11:55 한 번.** 서버가 쿨다운을 거친 후보 전체의 무작위 순서를 정해 결과 행에 저장한다. 1순위가 지금의 당첨(`menu`·`restaurant_id`)과 같다.
- **화면.** 결과 카드의 당첨·메뉴·확률 아래에 구분선, 그 아래 `2순위 ○○`, `3순위 ○○` 두 행. 당첨 36px 그대로, 예비 16px/`--ink-soft`, 순위 라벨 12px/`--muted`. 항상 보이고 당첨과 동시에 공개. 설명 문구 없음.
- **룰렛은 단일 당첨 표시 유지.** 조각 번호·색은 후보 식별자이고 순위 체계를 겹치지 않는다. `todayCandidates` 를 순위로 재정렬하지 않는다.
- **다시 돌리기는 순위 전체를 새로 뽑는다.** 안내 문구만 `전체 순위를 새로 뽑아 모두에게 반영돼요` 로.
- **다시 돌리기 카드 공개를 휠 정지에 맞춘다.** `forceSpin` 동안 결과 카드·머리글·상단 상태를 `spinning` 으로 보인다. 지금은 휠이 도는 동안 카드에 새 당첨이 먼저 뜬다.
- **문구 정정 3건.** 기록 탭 "가장 많이 간 매장" → "가장 많이 당첨된 매장", "그날 어디서 먹었는지 볼 수 있어요" → "그날 추첨 결과를 볼 수 있어요", 오늘 탭 부제의 "더는 변경할 수 없어요" 삭제(다시 돌리기와 모순).
- **예외.** 후보 1개: 당첨만. 2개: 2순위 한 행. `ranking` 이 없는 과거 행: 지금 카드와 동일. 삭제된 매장: 이름 스냅샷 유지, 승격 없음. 긴 이름: `minWidth: 0` + 본문의 `break-word`(Codex 의 `anywhere` 는 기각 — 최소 폭 계산에 끼어든다).

### 구조(A축)
1. **경계.** 순서를 정하는 판단은 `supabase/functions/_shared/ranking.ts` 한 곳(Deno·클라이언트 공유, import 0). 화면이 쓸 예비 목록을 뽑는 판단은 `lib/ranking.ts`. 컴포넌트는 받은 배열을 그린다.
2. **의존 방향.** `_shared/ranking.ts` 는 import 0(기존 세 모듈과 같은 계약). `lib/ranking.ts` 는 `lib/supabase/client.ts` 에서 `import type` 만.
3. **테스트 용이성.** 셔플은 난수 함수를 주입받아 결정적으로 검사한다. 예비 목록은 jsonb 가 어떤 형태로 와도(구 행 null·비배열·깨진 원소) 순수 함수가 정한다.
4. **변경 국소성.** 예비 개수(2)는 `lib/ranking.ts` 상수 하나. 순위 저장 형태 `[{restaurant_id, name}]` 는 두 Edge Function 과 `ResultRow` 세 곳이 같은 모양을 가정한다 — 기존 `candidates` 스냅샷과 같은 처지라 CLAUDE.md 위험 지점에 적는다.

### 기각한 대안
- 순위를 저장하지 않고 `candidates` 스냅샷 순서에 뜻을 부여: 구 행의 순서는 담은 순서라 뜻이 없어 구분 플래그가 필요해진다. 새 컬럼이 더 뻔하다.
- 자정 cron 이 순위를 계산: 추첨 시각에 정해지는 값을 다른 시각에 쓰면 다시 돌리기와 어긋난다.
- 휠에 2·3순위 마커: Codex·나 모두 기각(식별자 체계 충돌).

## 데이터

- `supabase/migrations/0006_results_ranking.sql`: `alter table public.results add column if not exists ranking jsonb` + `jsonb_typeof(ranking) = 'array'` check(이름 있는 제약, `if not exists` 가 없어 `do $$ … $$` 로 감싼다) + comment. nullable·기본 null 이라 구 코드와 구 행에 영향이 없다.
- `supabase/rollback/0006_results_ranking.rollback.sql`: `drop column if exists`. 순위 데이터는 사라진다(주석에 명시) — 당첨 자체는 `menu`·`restaurant_id` 에 있어 기록·랭킹은 무사하다.
- `ResultRow.ranking: { restaurant_id: string; name: string }[] | null`.

## 적용 순서 (README 에 절로 적는다)

1. 사용자가 SQL Editor 에서 0006 실행. 이 시점의 구 함수·구 UI 는 컬럼을 모르고 그대로 동작한다.
2. 함수 2종 배포(사용자 지시). **SQL 보다 먼저 배포하면 안 된다** — 새 함수는 `ranking` 을 쓰므로 컬럼이 없으면 PGRST204 로 그날 추첨을 잃는다.
3. PR 머지. UI 는 `select("*")` 라 컬럼이 없어도 `undefined` → 빈 예비 목록으로 동작하므로 순서가 유연하지만, 2번 뒤에 하는 것이 가장 단순하다.

## 작업 (TDD: 테스트 → 구현)

1. `supabase/functions/_shared/ranking.ts` + `ranking.test.ts` — `rankCandidates(pool, random)` Fisher-Yates, 입력 불변, 주입 난수로 결정적 검사.
2. `lib/ranking.ts` + `lib/ranking.test.ts` — `backupRanks(ranking, max)`: null·비배열 → [], 1번째 제외, 자리 순위 유지(깨진 원소는 그 자리만 생략), 상한 2.
3. `supabase/migrations/0006_results_ranking.sql` + spec, `supabase/rollback/0006_results_ranking.rollback.sql` + spec.
4. `spin-roulette/index.ts`·`respin-roulette/index.ts` — `pickRandom` → `rankCandidates`, `winner = ranking[0]`, 쓰기에 `ranking` 추가. `_shared/edgeImports.test.ts` 계약 갱신(ranking.ts import·호출·쓰기, import 0 모듈 넷).
5. `lib/supabase/client.ts` `ResultRow.ranking`.
6. `components/ResultBlock.tsx` — `backups` prop, 두 행. `app/page.tsx` — `backupRanks` 호출, `shownPhase`(forceSpin → spinning) 를 카드·머리글·타임라인·상단 바에, 문구 2건. `components/CalendarLog.tsx` — 상세에 예비 한 줄, 문구 2건.
7. README 적용 절·롤백, CLAUDE.md(엔트리·계약·위험 지점), STATE.md.
8. 로컬 빌드 + 확인 페이지 캡처(후보 1·2·15, 구 행 null, 긴 이름, 390/1280) → 리뷰(fable) → 반영 → PR.

## 인수 조건

- 신규 spec 전부 green, 기존 계약 갱신 후 `npm test` green, 게이트 5종 green.
- 결과 카드: `ranking` 3개 이상이면 두 행, 2개면 한 행, 1개·null 이면 지금과 같은 카드.
- `forceSpin` 동안 오늘 탭 DOM 에 새 당첨 이름이 없다(카드·머리글·부제).
- 두 Edge Function 의 `deno check` 통과. `_shared/ranking.ts` import 0.
- 커밋·PR AI 표기 0.

## 범위 밖

실제 방문 기록(👍👎 와 함께 나중에), 포인터 SVG 내장, 다크 모드.
