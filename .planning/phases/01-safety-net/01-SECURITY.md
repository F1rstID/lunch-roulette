---
phase: 1
slug: safety-net
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-18
verified: 2026-09-18
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm 레지스트리 → 로컬 `node_modules` | 설치 시 lifecycle 스크립트 실행. 이 페이즈에서 새 이름은 `vitest` 하나(+전이 60) | 패키지 코드 (devDependency) |
| Supabase PostgREST → 브라우저 DOM | 초기 SELECT 실패 시 `error.message`가 배너에 렌더 | 에러 문자열 (테이블·SQL 조각 없음) |
| 모듈 로드 시점 `process.env` | `lib/supabase/client.ts` import 순간 anon key 읽음. 이 페이즈는 그 로드를 테스트 경로에서 제거 | NEXT_PUBLIC_* (공개 키) |
| (해당 없음) RLS·Edge Function·마이그레이션·라이브 DB·`main` | 이 페이즈는 어느 것도 건드리지 않음 — `git diff main...HEAD -- supabase` 0줄 | — |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `next` 16.3.5 설치 | mitigate | `--save-exact` 정확 버전, `npm ls next`=16.3.5, lock 동일 커밋 (01-01-SUMMARY) | closed |
| T-01-02 | Elevation of Privilege | 전이 의존성 취약점 | mitigate | 범프 + 비-force `npm audit fix` → `npm audit --audit-level=high` exit 0 (검증기·리뷰어 재실행) | closed |
| T-01-03 | Denial of Service | 범프 후 빌드 회귀 | mitigate | `rm -rf .next && npm run build` exit 0, `npm run dev` 0회 | closed |
| T-01-SC | Tampering | npm install + audit fix (공급망) | mitigate | audit fix 직전/직후 lock 이름 집합 diff 0줄, package.json 선언 변경 next·eslint-config-next만 (01-01-SUMMARY 가드 a·c) | closed |
| T-01-04 | Information Disclosure | `ErrorBanner` 렌더 텍스트 | mitigate | `error.message`만 조립. `JSON.stringify(error)`·`.details`·`.hint` 사용 0건 (grep). UAT: 배너 본문에 키·URL 없음 | closed |
| T-01-05 | Information Disclosure | 환경변수 노출 | mitigate | `lib/errors.ts`·`ErrorBanner.tsx` `process.env` 참조 0건 | closed |
| T-01-06 | Tampering (XSS) | 에러 문자열 렌더 | accept | React 텍스트 노드 자동 이스케이프, `dangerouslySetInnerHTML` 0건 | closed |
| T-01-07 | Repudiation | 조용한 실패 | mitigate | 3 페이지 `role="alert"` 배너 — 실패 주입 UAT 통과 (01-HUMAN-UAT.md) | closed |
| T-01-SC2 | Tampering | `npm install -D vitest` (공급망) | mitigate | blocking-human 게이트에서 사용자가 `vitest-dev/vitest` 확인 후 `approved, vitest@4` → `4.1.11` 정확 고정, lock 커밋, 신규 이름 60개 기록 (01-03-SUMMARY) | closed |
| T-01-08 | Elevation of Privilege | 테스트 도구 런타임 노출 | accept | `vitest`는 devDependencies 전용, 빌드 산출물·Vercel·Supabase 런타임 미포함 | closed |
| T-01-09 | Denial of Service | 러너 파일 수집 범위 | mitigate | `vitest.config.mts` include 3글롭 + exclude, `npx vitest list` 정확히 4파일 (design/·.planning/·supabase/functions 0건, 검증기 프로브 spec으로 재확인) | closed |
| T-01-10 | Information Disclosure | 테스트 출력 비밀값 | mitigate | 대상 모듈 `process.env` 0건, supabase 클라이언트 미로드 | closed |
| T-01-11 | Information Disclosure | 테스트 실행 중 환경변수 | mitigate | `env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY npm test` 36/36 통과 | closed |
| T-01-12 | Tampering | 상수 이사 중 값 변조 | mitigate | `lib/constants.ts` `MENU_NAME_MAX_LEN = 24` 1건, 근거 주석 동반 | closed |
| T-01-13 | Denial of Service | 입력 길이 상한 우회 | accept | 클라이언트 상한은 UX 장치. 실제 경계는 DB check(변경 없음). 익명 대량 insert는 CONCERNS.md 기존 항목·범위 밖 | closed |
| T-01-14 | Spoofing | 잘못된 모듈에서 상수 import | mitigate | re-export 없음, `lib/supabase/client.ts`에 `MENU_NAME_MAX_LEN` 0건 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-01-01 | T-01-06 | React 자동 이스케이프 + dangerouslySetInnerHTML 미사용. XSS 경로 없음 | 플랜 시점 disposition=accept (사용자 승인 로드맵·플랜 검증 통과) | 2026-09-18 |
| R-01-02 | T-01-08 | devDependency 전용 — 런타임 공격면 불변 | 플랜 시점 disposition=accept (사용자 승인 로드맵·플랜 검증 통과) | 2026-09-18 |
| R-01-03 | T-01-13 | 클라이언트 길이 상한은 보안 경계가 아님. DB check 제약이 경계이며 이 페이즈는 그것을 안 바꿈 | 플랜 시점 disposition=accept (사용자 승인 로드맵·플랜 검증 통과) | 2026-09-18 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-18 | 15 | 15 | 0 | orchestrator (플랜 시점 레지스터, 완화 증거 = executor SUMMARY ×4 + gsd-verifier 19/19 + code review + 기계 grep 재실행; 단축 규칙: threats_open 0 & register_authored_at_plan_time true) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-18
