---
phase: 2
slug: data-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. 근거: `02-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.11 (Phase 1 산출물, 정확 고정) |
| **Config file** | `vitest.config.mts` — Wave 0에서 `include`에 `"supabase/migrations/**/*.test.ts"` 한 줄 추가 (`exclude` 무변경) |
| **Quick run command** | `npx vitest run supabase/migrations` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~1초 (계약 테스트는 파일 파싱만) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run supabase/migrations` (+ 타입을 건드렸으면 `npx tsc --noEmit`)
- **After every plan wave:** Run `npm test` + `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** `npx tsc --noEmit && npm run lint && npm test && npm run build` 전부 green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner가 채움) | — | — | SHIP-01 | — | 모든 문 멱등: 무명 `create index` 0, 맨 `alter publication add table` 0, `create policy` 앞 `drop policy if exists`, `cron.unschedule('문자열')` 0 | contract | `npx vitest run supabase/migrations` | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | SHIP-01 | — | 구 테이블 `drop table`이 파일 마지막 | contract | 〃 | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | SETT-01 | T-02-* | `settings` RLS enable + select 정책 1 · 쓰기 정책 0 (정책 0건 = 기본 거부) | contract | 〃 | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | SETT-01 | — | `SettingsRow` 필드 == SQL 컬럼 목록 | contract + static | 〃 + `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | CATL-07 | — | `restaurants.name` unique + `char_length between 1 and 24` | contract | 〃 | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | CAND-04 | — | `truncate` 0건, `reset-candidates` 본문에 `delete from public.candidates` + 핀 재시드 | contract | 〃 | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | HIST-03 | — | `results` 등장은 `add column if not exists`·정책·주석뿐; delete/update/drop 0건 | contract | 〃 | ❌ W0 | ⬜ pending |
| (planner가 채움) | — | — | D-13 | — | 4개 행 타입 필드 집합 == SQL 컬럼 목록 (이름 대조) | contract | 〃 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `supabase/migrations/0005_restaurants_settings.test.ts` — SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03·D-13 계약 테스트 (SQL 파일 텍스트 파싱, `--` 주석 제거 사본과 원본 둘 다 보유, 기대값은 리터럴, `lib/supabase/client.ts`는 import 하지 않고 소스 텍스트 파싱)
- [ ] `vitest.config.mts` `include`에 `"supabase/migrations/**/*.test.ts"` 추가
- 프레임워크 설치: 불필요 / 공용 픽스처: 불필요

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 마이그레이션 낭독 리뷰 8항목 | SHIP-01 | 로컬 Supabase 스택 없음, SQL 실행 불가 | RESEARCH §Validation Architecture 체크리스트 1~8 (동작 불변 원칙 주석·프로젝트 ref 치환 주석·cron KST 계산식·기본값 문자 일치·cascade/set null 방향·results 문 1개·drop table 최후·Pitfall 6 주석) |
| 실제 적용 후 동작 | SHIP-01 | 라이브 적용은 Phase 8(사용자, 대시보드) | Phase 8 체크리스트. 선택: Docker `postgres:17-alpine` 드라이런(D-15) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
