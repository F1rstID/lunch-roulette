# Requirements: lunch_roulette — 매장 기준 룰렛 전환 + 설정 테이블

**Defined:** 2026-09-18
**Core Value:** 매일 설정 시각에 오늘 담긴 매장 중 하나가 자동으로 확정되고 모든 접속자 화면에 동시에 뜬다.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### 매장 카탈로그 (CATL)

- [ ] **CATL-01**: 사용자는 "매장" 탭에서 이름(필수, 1~24자)·메뉴 목록(선택)·위치(선택, 한 줄 텍스트, URL이면 링크로 표시)를 입력해 매장을 등록할 수 있다
- [ ] **CATL-02**: 사용자는 등록된 매장의 이름·메뉴·위치를 수정할 수 있다
- [ ] **CATL-03**: 사용자는 매장을 삭제할 수 있다. 삭제해도 과거 결과의 매장명 표시는 남는다
- [ ] **CATL-04**: 사용자는 매장을 핀/해제할 수 있고, 핀 매장은 매일 자정 자동으로 오늘 후보에 담긴다
- [ ] **CATL-05**: 매장 등록·수정·삭제·핀 변경이 모든 접속자 화면에 Realtime으로 반영된다
- [ ] **CATL-06**: 메뉴 목록은 쉼표 구분 입력으로 여러 개를 한 번에 넣을 수 있다 (기존 `parseMenuInput` 재활용)
- [ ] **CATL-07**: 같은 이름의 매장은 중복 등록되지 않는다 (DB unique)

### 오늘 후보 (CAND)

- [ ] **CAND-01**: 사용자는 오늘 탭에서 카탈로그 전체 목록을 보고 토글로 오늘 후보에 담고 뺄 수 있다
- [ ] **CAND-02**: 사용자는 이름 필터로 카탈로그 목록을 좁힐 수 있다
- [ ] **CAND-03**: 후보 담기·빼기가 모든 접속자에게 Realtime으로 반영된다
- [ ] **CAND-04**: 자정(KST 00:00)에 오늘 후보가 비워지고 핀 매장만 다시 담긴다. 열린 탭에도 비워짐이 반영된다 (`truncate` → `delete from`)
- [ ] **CAND-05**: 오늘 결과가 확정된 뒤에는 후보 토글이 잠긴다 (기존 readOnly 동작 유지)

### 추첨 (SPIN)

- [ ] **SPIN-01**: 설정된 추첨 시각 이후 첫 폴링(매분)에서 오늘 후보 중 매장 하나가 자동 확정된다. 하루 1회 멱등
- [ ] **SPIN-02**: `cooldown_days` > 0이면 최근 N일 당첨 매장은 후보에서 제외한다. 제외 후 후보가 비면 전체 후보로 폴백한다
- [ ] **SPIN-03**: 추첨 시각에 후보가 0개면 결과가 생기지 않고 UI는 잠기지 않는다. 이후 후보를 담으면 다음 폴링에서 추첨된다
- [ ] **SPIN-04**: 다시 돌리기는 오늘 후보에서 다시 뽑아(쿨다운 적용) 결과를 덮어쓴다. 횟수 무제한
- [ ] **SPIN-05**: 결과 화면에 당첨 매장명과, 있으면 그 매장의 메뉴 목록·위치를 참고로 표시한다
- [ ] **SPIN-06**: 휠·페이즈·타임라인·안내 문구가 설정된 추첨 시각을 따른다. 코드에 하드코딩된 "11:55"가 0곳

### 기록·랭킹 (HIST)

- [ ] **HIST-01**: 기록 캘린더는 전환일(`settings.history_since`) 이후 결과만 매장명으로 표시한다
- [ ] **HIST-02**: 랭킹은 전환일 이후 결과만 매장 기준으로 집계한다
- [ ] **HIST-03**: 전환 이전 `results` 60행은 DB에 그대로 보존된다 (삭제·변환 없음)

### 설정 (SETT)

- [ ] **SETT-01**: `settings` 단일행(`spin_time`, `cooldown_days`, `history_since`)이 존재하고 anon은 읽기만, 편집은 대시보드에서만 가능하다
- [ ] **SETT-02**: 대시보드에서 설정을 바꾸면 열린 탭에 Realtime으로 즉시 반영된다 (새로고침 불필요)
- [ ] **SETT-03**: 설정 로드 전 또는 실패 시 기본값(11:55, 쿨다운 0)으로 동작한다
- [ ] **SETT-04**: 마이그레이션 직후(기본값) 동작은 현재와 동일하다 — 11:55 추첨, 쿨다운 없음

### 품질 (QUAL)

- [ ] **QUAL-01**: `npm test`(vitest)가 있고 순수 로직(`lib/phase.ts`, `lib/time.ts`, spin_time 파싱, 쿨다운 필터, `parseMenuInput`)에 단위 테스트가 있다
- [ ] **QUAL-02**: Edge Function 순수 로직은 `supabase/functions/_shared/`에 Deno import 없이 두어 vitest로 테스트되고, `kstNow` 복붙이 한 곳으로 합쳐진다
- [ ] **QUAL-03**: `next` 16.3.5로 범프되어 `npm audit`에 critical·high가 0이다
- [ ] **QUAL-04**: 3개 페이지의 초기 SELECT 에러가 배너로 표면화된다 (현재 삼킴)
- [ ] **QUAL-05**: `tsc --noEmit`·`lint`·`test`·`build` 전부 통과한 상태로 PR을 연다

### 전환·문서 (SHIP)

- [ ] **SHIP-01**: 컷오버 마이그레이션 1개: `restaurants`·`candidates`·`settings` 생성, RLS·Realtime 등록, cron 교체(spin 매분 폴링, reset은 `delete from` + 핀 재시드), `menus`·`pinned_menus` 제거. 재실행 가능
- [ ] **SHIP-02**: 롤백 절차가 문서화된다 (구 테이블·구 cron 복원 SQL 포함)
- [ ] **SHIP-03**: `CLAUDE.md`·`README.md`가 현행화된다 (낡은 항목 4건 수정 + 새 컨벤션: settings 단일 소스, `_shared` 모듈, 마이그레이션 동작불변 원칙)
- [ ] **SHIP-04**: 배포 체크리스트가 문서화된다: 마이그레이션(사용자, 대시보드) → Edge Function 2개 deploy → PR 머지 → 라이브 확인

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### 매장 카탈로그

- **CATL-V2-01**: 카탈로그가 커지면 검색 UI (현재는 이름 필터로 충분)
- **CATL-V2-02**: 매장별 방문 횟수·마지막 방문일 표시

### 설정

- **SETT-V2-01**: 앱 안 설정 편집 UI (권한 모델이 생기면)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| 다시 돌리기 하루 상한 | 사용자: 무한 재돌리기 OK. `respin_count` 컬럼도 안 만든다 |
| 2단 룰렛(매장 → 메뉴 추첨) | 결과 모델 단순 유지. 메뉴는 참고 표시만 |
| 로그인·권한 | 익명 설계가 서비스 정체성. RLS 개방 유지 |
| 모바일 최적화 | 사용자가 모바일에서 안 씀 |
| 웹 푸시·슬랙 알림 | 회사 슬랙 아님, 푸시 미선택 |
| pg_cron 트리거 재스케줄 | 매분 폴링이 더 단순, 무료티어 한도 여유 |
| 과거 results를 매장으로 매핑 | 메뉴명↔매장 대응이 손실적. 전환일 필터로 대체 |
| 페이즈별 라이브 배포 | 사용자 선택: 마지막 한 번 컷오버 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (roadmap 생성 시 채움) | | |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 0
- Unmapped: 34 ⚠️

---
*Requirements defined: 2026-09-18*
*Last updated: 2026-09-18 after initial definition*
