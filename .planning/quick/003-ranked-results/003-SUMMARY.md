---
quick_id: "003"
slug: ranked-results
completed: 2026-10-06
branch: feat/ranked-results
status: complete (PR 대기 — 적용 순서 SQL → 함수 배포 → 머지)
---

# Quick Task 003: 결과 순위(1순위 + 2·3순위) — Summary

## 결과

- 추첨이 쿨다운을 거친 후보 전체의 순서를 정해 `results.ranking`(jsonb) 에 저장한다. 1번째가 당첨이다. 다시 돌리기는 순서 전체를 새로 뽑는다.
- 결과 카드에 `2순위 ○○`·`3순위 ○○` 두 행, 기록 상세에 한 줄. `ranking` 이 없는 과거 행은 전과 같은 카드다.
- 다시 돌리기로 결과 행이 먼저 바뀌어도 휠이 도는 5초 동안 카드·머리글·상단 상태가 새 당첨을 숨긴다(`shownPhase`).
- 문구 정정: 다시 돌리기 안내, "가장 많이 당첨된 매장", "그날 추첨 결과를 볼 수 있어요", "더는 변경할 수 없어요" 삭제, spinning 부제의 시작 시각 언급 삭제.

## 설계 출처

Codex(gpt-6-astra) 상담 2026-10-06 → 사용자 승인. 기각: 휠에 예비 마커, `overflowWrap: anywhere`, 2순위만 다시 뽑기.

## 한 일

| 항목 | 내용 |
|---|---|
| DB | `0006_results_ranking.sql`(add column if not exists + `results_ranking_is_array` check + comment), 롤백 `drop column if exists`. 텍스트 계약 spec 6 + 4 |
| 서버 | `_shared/ranking.ts` `rankCandidates`(Fisher-Yates, crypto 기본 난수, 주입 가능) spec 8. 두 함수가 `winner = ranking[0]`, 쓰기에 `ranking`. `pickRandom` 삭제 |
| 계약 | `edgeImports.test.ts` #59~#62 추가(ranking.ts import 0, import·호출 1회, 당첨 = ranking[0], 쓰기 블록 안 `ranking,` 1회). 0005 spec 의 ResultRow 필드 목록에 `ranking` |
| 클라이언트 | `ResultRow.ranking`, `lib/ranking.ts` `backupRanks`(null·비배열 → [], 1번째 제외, 자리 순위 유지, 상한 2) spec 8 |
| 화면 | `ResultBlock` `backups` prop + 두 행(16px/ink-soft, 라벨 12px/muted, `48px minmax(0,1fr)`), `CalendarLog` 상세 한 줄, `app/page.tsx` `shownPhase`·문구 |
| 문서 | README "0006 적용" 절(순서·확인·롤백), CLAUDE.md(엔트리·`_shared` 4모듈 계약·위험 지점·미사용 코드), CONVENTIONS.md 난수 규약 |

## 실측

로컬 프로덕션 빌드 + 임시 확인 페이지(삭제됨), gstack browse. 390·1280 폭.

| 상태 | 결과 카드 |
|---|---|
| 순위 5개 | 2순위·3순위 두 행 |
| 순위 2개 | 2순위 한 행 |
| 순위 1개 / 구 행 null | 예비 영역 없음(전과 동일) |
| 긴 이름(24자 무공백·23자) | 두 행, 이름 줄바꿈, 넘침 0 |
| 깨진 원소(2번째 null) | 3순위 한 행만(순위 안 당김) |
| 회전 중(`spinning`) | 당첨 없음, 후보 수만 |
| 기록 상세 10/2(순위 있음) | "2순위 그때그집 · 3순위 …" 한 줄 / null 행은 줄 없음 |

가로 넘침 0(두 폭). DOM 에서 `data-probe` 별 `N순위` 텍스트 수로 확인.

## 리뷰 반영

리뷰 1회(fable): Critical 0 · Warning 3 · Info 6. Warning 전부 + IN-01 반영.

| id | 조치 |
|---|---|
| WR-01 | 기본 난수를 crypto 로(이전 `pickRandom` 과 같은 소스), `pickRandom`·spec 삭제, CLAUDE.md 미사용 목록 |
| WR-02 | 쿨다운 전멸 폴백 날 2·3순위에 최근 당첨 매장이 들어올 수 있음을 SQL comment·함수 주석·CLAUDE.md 에 명시 |
| WR-03 | #62 를 insert/upsert 리터럴 안에서 세게, 셔플 spec 에 수열 [0.1,0.7,0.3] → `b d c a` 고정 |
| IN-01 | describe 제목 "3파일" → "4파일" |

반영 안 함: IN-02(`random() >= 1` 미방어 — crypto 기본 경로에서 도달 불가, 주입 난수는 테스트 전용), IN-03(SQL 두 줄 리터럴을 한 줄로 합치면 구문 오류 — 적용 1회 파일이고 spec 이 문자열 존재는 확인), IN-04(0005 spec 이 0006 컬럼을 단언하는 결합 — 의도: TS/SQL 동기화 한 곳에서), IN-05(타임라인 불릿이 5초 "룰렛" 으로 회귀 — 의도), IN-06(`winnerName lineHeight 1.2` 가 구 행 카드에도 적용 — Codex 권고, 의도).

## 게이트

| 게이트 | 결과 |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | exit 0 |
| `npm test` | 21 files / 439 tests |
| `npm run build` | exit 0, 라우트 4개 |
| `npm run check:edge` | exit 0 |
| 커밋 메시지 AI 표기 | 0 |

## 적용 (남은 일)

1. 사용자: SQL Editor 에서 `supabase/migrations/0006_results_ranking.sql` 실행.
2. 함수 2종 배포(사용자 지시 뒤). SQL 보다 먼저 배포 금지.
3. PR 머지(사용자 지시 뒤). 라이브 확인은 단발 요청으로.
4. 확인: 다시 돌리기 뒤 `ranking` 배열, 카드에 두 행.

## 확인하지 못한 것

- 실제 DB 에 0006 을 적용한 적이 없다(로컬 스택 없음). 텍스트 계약과 낭독만.
- 실제 Edge Function 호출(배포 뒤 다시 돌리기로 확인).
- `forceSpin` 5초 동안의 실제 화면 전환(정적 상태만 캡처).

## 소요

| 구간 | 시각 (KST) |
|---|---|
| Codex 상담 | 09:5x ~ 10:0x |
| 브랜치·플랜·구현 커밋 | ~10:12 |
| 리뷰(백그라운드) | 10:13 ~ 10:22, 9분 |
| 리뷰 반영 커밋 | 10:2x |
