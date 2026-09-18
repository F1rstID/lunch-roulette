---
status: complete
phase: 01-safety-net
source: [01-VERIFICATION.md]
started: 2026-09-18T07:02:04Z
updated: 2026-09-18T07:04:08Z
---

## Current Test

[complete]

## Tests

### 1. 3개 페이지 초기 SELECT 실패 배너 브라우저 확인
expected: anon key를 틀리게 하거나 `*.supabase.co`를 차단한 뒤 `/`, `/log`, `/rank`를 열면 빈 화면 대신 `role="alert"` 배너 — "메뉴 목록 불러오기 실패: …" / "기록 불러오기 실패: …" / "랭킹 불러오기 실패: …". ×로 닫힘. 오늘 탭은 배너 아래 휠·목록 골격 유지. SQL 조각·환경변수 미노출.
result: passed — 2026-09-18 실패 주입 검증: 잘못된 anon key로 `npm run build` 후 `next start -p 3111`, 헤드리스 브라우저(gstack browse)로 `/`·`/log`·`/rank` 렌더. 세 경로 모두 `[role=alert]` 1개, 텍스트 "메뉴 목록 불러오기 실패: Invalid API key · 오늘 결과 불러오기 실패: … · 고정 메뉴 불러오기 실패: …" / "기록 불러오기 실패: Invalid API key" / "랭킹 불러오기 실패: Invalid API key". body에 키·supabase.co 문자열 없음. × 클릭 후 alert 0개, 휠 SVG 유지. 스크린샷 scratchpad/uat-{today,log,rank}.png (세션 스크래치, 레포 외).

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
