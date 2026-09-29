---
phase: 08-cutover
plan: 01
subsystem: cutover-docs
tags: [rollback, cutover, readme, security-audit, pr]

requires:
  - phase: 02-data-model
    provides: "0005 마이그레이션(재실행 안전형) — 롤백 SQL 이 그 역순"
  - phase: 04-server-spin
    provides: "Edge Function 2종 + config.toml verify_jwt=false + 배포 명령·함정"
  - phase: 07-history-ranking
    provides: "todo in-05 → 절차 3b(history_since + 1), 랭킹 명시 컬럼 조회의 순서 의존(리뷰 WR-01)"
provides:
  - "supabase/rollback/0005_restaurants_settings.rollback.sql — 0005 역순, 데이터 파기 없음, 재실행 안전형 + 텍스트 계약 spec 10건"
  - "README.md 전면 개정 — 현행 인프라 정본 + 컷오버 절차 0~9 + 롤백(판단 기준·순서·구 함수 재배포·앱 롤백)"
  - "07-SECURITY.md — Phase 5~7 묶음 보안감사 SECURED 8/8 (권고 1건 적용: formatLoadError 200자 상한)"
  - "todo 2건 종결(wr-01 → README 절차, in-07 → CONCERNS 항목 8 수용 결정)"
affects: []

tech-stack:
  added: []
  patterns:
    - "롤백 SQL 은 migrations/ 밖(rollback/)에 두고 같은 텍스트 계약 방식으로 고정한다"
    - "절차서의 판정은 응답 필드(ok / skipped + excluded_count)로 적는다 — 낭독 시점 문구를 그대로 옮기지 않는다"

key-files:
  created: [supabase/rollback/0005_restaurants_settings.rollback.sql, supabase/rollback/0005_restaurants_settings.rollback.test.ts, .planning/phases/07-history-ranking/07-SECURITY.md]
  modified: [README.md, CLAUDE.md, vitest.config.mts, lib/errors.ts, lib/errors.test.ts, .planning/codebase/CONCERNS.md, .planning/codebase/STRUCTURE.md, .planning/REQUIREMENTS.md]
  deleted: [.planning/todos/pending/wr-01-cutover-window.md, .planning/todos/pending/in-07-realtime-resync-on-reconnect.md]

key-decisions:
  - "D-01 롤백은 동작 복원이지 데이터 파기가 아니다 — 새 테이블·results.restaurant_id 는 남기고 파기문은 주석"
  - "D-09 문서는 컷오버 후 상태를 현재형으로, 머리에 절차 진행 중 안내 한 줄"
  - "D-10 in-07 미적용·수용 — subscribe 콜백 조회는 웹소켓 차단 환경에서 REST 읽기까지 죽인다"
  - "리뷰 CR-01: 컷오버 당일 오늘 탭 토글은 decided 로 잠긴다 → 당일은 SQL 후보 + 다시 돌리기, 토글 확인은 익일 추첨 전"

duration: 50min
completed: 2026-09-29
---

# Phase 8 Plan 01: 컷오버 준비 Summary

**롤백 SQL·컷오버 절차·현행 문서가 한 곳에 있고, 게이트 5종 green 상태로 PR 을 연다. 라이브 변경(0005 적용·함수 배포·머지)은 사용자가 README 절차로 수행한다.**

## Accomplishments

- `supabase/rollback/0005_restaurants_settings.rollback.sql`: 새 cron 3종 unschedule → `menus`·`pinned_menus` 재생성(0001·0004 스키마, RLS 6정책, publication 가드) → 구 cron 2종(`55 2 * * *`·`0 15 * * *` 0004 본문, timeout 5000ms). 파기문 주석 밖 0. spec 10건(순서·정책·publication `execute`·0004 본문·파기 0).
- README: 4테이블·RLS·cron 3종·함수 2종·검증 명령 5종·설정 편집·ref 치환 전수·동작불변 원칙·컷오버 절차 0~9(당일/익일 분리, 오늘 행 0/1 분기, 응답 필드 판정, merge commit 지정)·롤백(기준 a/b/c, SQL → 함수 → 앱).
- CLAUDE.md: 미배포 문장 → 절차 참조, vitest 수집 목록에 `rollback/**`, RLS 문장, ref 치환 표. CONCERNS: 문서 낡음 [P2]·검증 수단 부재 해소 표기, 항목 8(Realtime 스냅샷 공백 수용 + v2 방향). STRUCTURE 트리.
- 보안감사(5~7 묶음, fable): SECURED 8/8, open 0, 권고 UF-0507-02 적용(`formatLoadError` 도 200자 상한, spec 2).
- 리뷰+역검증(fable): Critical 1(CR-01 당일 토글 잠금) / Warning 6 / Info 11 → 18/18 처리(코드 변경 0). 역검증 초회 1/5 → 수정 후 기준 1·2·3 passed, 4 는 PR 개설로, 5 는 manual-only.

## Deviations from Plan

- 플랜 Task 4 의 `phase.complete` 전에 PR 을 열어야 QUAL-05 를 찍을 수 있어 순서를 PR → 마킹 → complete 로 둔다.
- 리뷰 IN-06(선택) 도 적용 — 구 spin 잡에 timeout 5000ms(구 함수 동작 불변).

## Verification

- `npm test` 392/392 · 15 files · tsc·lint·build·check:edge exit 0 · `git ls-files supabase/migrations | grep -c rollback` 0 · AI 표기 grep(8678f02..HEAD) 0.
- 라이브 DB·Edge Function·main 무변경. 원격 SQL·배포 0회.

## Manual-only (사용자, README 컷오버 절차)

0 사전 기록 → 1 덤프 + 오늘 행 count → 2 12:00 KST 이후 → 3 0005(+3b) → 4 함수 2종 배포 → 5 respin 수동 invoke 판정 → 6 PR 머지(merge commit) → 7 당일 확인 → 8 익일 확인 → 9 롤백 기준.
