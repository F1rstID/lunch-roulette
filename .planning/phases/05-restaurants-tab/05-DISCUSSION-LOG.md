# Phase 5: 매장 탭 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-28
**Phase:** 05-매장 탭
**Areas discussed:** Todo 폴딩, 논의 영역 선택(사용자 전면 위임)

---

## Todo 폴딩

| Option | Description | Selected |
|--------|-------------|----------|
| wr-01-char-length-truncation 접기 | parseMenuInput 코드포인트 절단 수정 + 테스트를 Phase 5 범위에 포함 | ✓ |
| todo 는 하나도 접지 않음 | wr-01 도 별도 처리로 남긴다 | |

**User's choice:** wr-01-char-length-truncation 접기
**Notes:** 나머지 매칭 5건(in-06·wr-02·in-03·in-02·in-05)은 resolves_phase 6~8 이라 제시만 하고 접지 않음.

---

## 논의 영역 선택

| Option | Description | Selected |
|--------|-------------|----------|
| 탭·라우트 자리 | 탭 이름·경로·TopBar 순서·뱃지 | |
| 등록·수정 폼 형태 | 상시 폼 vs 펼침, 인라인 편집 vs 폼 재사용, 삭제 확인 방식 | |
| 목록 표시·정렬 | 정렬 기준, 행 구성, 빈 상태 | |
| 검증·에러 문구 | 사전 검증 범위, 중복 문구, 성공 피드백 | |
| (Other) 알아서 최적의 형태로 | 네 영역 전부 Claude 에 위임 | ✓ |

**User's choice:** "알아서 최적의 형태로" (자유 입력)
**Notes:** 개별 질문 없이 종료. Claude 가 레포 관례·이전 페이즈 결정에서 네 영역의 결정을 도출해 CONTEXT.md D-01~D-19 로 확정했다(각 결정에 대안과 기각 이유 병기). 판단 우선순위: 레포 관례 → 오늘 탭과의 일관성 → 영구 데이터에 맞는 안전장치.

## Claude's Discretion

네 영역 전부(사용자 위임). 세부 재량은 CONTEXT.md §Claude's Discretion — 폼 배치·문안·칩 스타일·타입/액션 이름·URL 판정 헬퍼 위치·칩 임계 상수·UI-SPEC 실행 여부.

## Deferred Ideas

CONTEXT.md §Deferred Ideas 와 동일 — Phase 6(후보 토글·필터·결과 화면·타입 삭제·뱃지), v2(검색·방문 횟수), 범위 밖(undo·구독 실패 표면화).
