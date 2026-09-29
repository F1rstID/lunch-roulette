# Phase 6: 오늘 탭 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-29
**Phase:** 06-오늘 탭
**Areas discussed:** Todo 폴딩, 데이터 흐름, 후보 목록 형태, 결과 화면 상세, 추첨 시각 문구 치환, 이관 리뷰 항목(IN-02·IN-05), 삭제·이동 (사용자 전면 위임 — 질문 없이 Claude 가 결정)

---

## Todo 폴딩

| Option | Description | Selected |
|--------|-------------|----------|
| resolves_phase: 6 인 4건 접기 (in-02·in-03·in-06·wr-02) | 각 todo 의 "해결 방법(Phase 6)" 절을 그대로 결정으로 승격 | ✓ |
| 점수 ≥ 0.4 전부 접기 (auto 규칙: in-02·in-06·in-03·in-05·wr-01) | in-05 는 Phase 7, wr-01 은 Phase 8 소관이라 페이즈 경계 침범 | |
| 하나도 접지 않음 | 4건 모두 "Phase 6 의 그 태스크에서" 를 전제로 미뤄 둔 것이라 지금 안 접으면 같은 자리를 두 번 만진다 | |

**User's choice:** 위임 → Claude 선택 (1행). wr-02 는 점수 0.2 이지만 `resolves_phase: 6` 이라 접었고, in-05·wr-01 은 점수 0.4 여도 접지 않았다(auto 규칙 대신 `resolves_phase` 기준).
**Notes:** 접은 todo 는 구현 플랜에서 `git rm`(D-26).

---

## 데이터 흐름

| Option | Description | Selected |
|--------|-------------|----------|
| 훅 2개(`useRestaurants` 재사용 + `useCandidates` 신규) + 클라이언트 순수 조인 | 토글 목록에 카탈로그 전체가 어차피 필요. 이벤트 페이로드만으로 갱신 가능 | ✓ |
| `candidates` 임베드 조회 1개 (`select("*, restaurants(*)")`) | INSERT 이벤트에 매장명이 없어 이벤트마다 재조회 필요, Phase 4 의 임베드 형태 함정(객체/배열) 재현 | |
| 리듀서 일반화 없이 `candidates` 리듀서를 복제 | 40줄 중복 + CR-01 급 버그가 한쪽에만 고쳐질 위험. 두 번째 사용처가 생긴 시점이라 YAGNI 통과 | |

**User's choice:** 위임 → Claude 선택 (1행 + `lib/rowset.ts` 일반화).
**Notes:** 일반화하면서 in-03 의 "훅 분기를 리듀서로" 를 세 훅에 동시에 적용(D-04). IN-02 UPDATE upsert 도 제네릭 리듀서에서 결정(D-05).

---

## 후보 목록 형태

| Option | Description | Selected |
|--------|-------------|----------|
| 단일 목록 + 행 토글, 담긴 매장이 휠 순서로 위(번호 배지), 안 담긴 매장 흐리게 아래 | 토글 한 동작, "오늘 뭐 올라갔나" 한눈, 휠↔배지 매핑 유지 | ✓ |
| 두 섹션(담긴 목록 ✕ / 카탈로그 + 담기) | 같은 매장이 두 위치를 오가고 토글 의미가 버튼 둘로 갈린다 | |
| 카탈로그 순서 고정 + 체크 표시만 | 행 이동이 없어 안정적이나 휠 순서를 목록에서 읽을 수 없다(배지가 흩어짐) | |

**User's choice:** 위임 → Claude 선택 (1행).
**Notes:** 필터는 상단 입력 하나, 잠금 중에도 사용 가능. 핀은 읽기 전용 표시(토글은 매장 탭 한 곳, Phase 5 D-07). stalled 수동 돌리기 버튼은 두지 않음(서버가 매분 폴링, SPIN-03).

---

## 결과 화면 상세

| Option | Description | Selected |
|--------|-------------|----------|
| 이름 = `results.menu` 스냅샷, 메뉴·위치 = 현재 카탈로그(`restaurant_id` 로 조회) | CATL-03 스냅샷 전제 유지 + 상세는 최신값 | ✓ |
| 이름까지 카탈로그에서 읽기 | 매장 삭제·개명 시 결과 이름이 사라지거나 바뀜 — 기록·랭킹과 어긋난다 | |
| `results.candidates` JSON 에서 상세 복원 | 스냅샷에 메뉴·위치가 없다(이름·id 뿐) | |

**User's choice:** 위임 → Claude 선택 (1행). 칩·위치 링크 렌더는 `MenuChips`·`LocationLink` 로 뽑아 매장 탭과 공유.

---

## 추첨 시각 문구 치환

| Option | Description | Selected |
|--------|-------------|----------|
| `spinTimeText` prop 을 모든 소비 컴포넌트에 필수로 내려보냄, 기본값 없음 | 기본값을 두면 시각이 다시 컴포넌트에 숨는다(`lib/phase.ts:20-21` 과 같은 논증) | ✓ |
| 컴포넌트가 `useSettings()` 를 직접 호출 | 구독 인스턴스가 늘고 컴포넌트가 훅을 부르지 않는 구조가 깨진다 | |
| 타임라인 "결과" 단계 시각: 추첨 시각 + 5분 (원 디자인 11:55→12:00 간격) | 상수 `RESULT_STEP_OFFSET_MIN` 로 근거를 코드에 남김 | ✓ |
| 타임라인 "결과" 단계 시각: `${t}—` (룰렛과 동일) | 룰렛·결과가 같은 시각을 두 번 보여 준다 | |
| `app/layout.tsx` description 에서 시각 제거 | metadata 는 정적이라 설정을 따를 수 없다 — 거짓말이 될 문자열은 뺀다 | ✓ |

**User's choice:** 위임 → Claude 선택. 수용 기준은 `grep -rn '11:55' app components lib | grep -v '//'` → 0(D-22).
**Notes:** in-02(첫 페인트 라벨)는 `displayPhase(phase, settings.loaded)` 로 4개 페이지 전부에 적용(D-23) — 한 줄씩이라 라벨 일관성을 우선했다.

---

## 이관 리뷰 항목

| Option | Description | Selected |
|--------|-------------|----------|
| IN-02: UPDATE 를 upsert 로 (있으면 교체, 없으면 추가) | 재연결 틈에 놓친 INSERT 를 이후 UPDATE 가 복구. 변경 스트림 순서 보장으로 되살아남 없음 | ✓ |
| IN-02: 현행 유지(모르는 id 무시) | 놓친 행이 영영 안 보임 | |
| IN-05: `RestaurantList` 메뉴 입력 `maxLength` 삭제, 상한은 `parseRestaurantForm` 이 이유와 함께 거절 | 이름·위치와 같은 처리(05 WR-02), DB 30×24 도달 가능 | ✓ |
| IN-05: 상한을 `30 × (24 + 2)` 로 계산 | 코드유닛 계산이라 여전히 코드포인트와 어긋난다 | |

**User's choice:** 위임 → Claude 선택 (각 1행).

---

## 삭제·이동

| Option | Description | Selected |
|--------|-------------|----------|
| `parseMenuInput`·`truncateToCodePoints` → `lib/menus.ts`, `MenuList` 삭제, `lib/` 단방향 예외 해소 | 05-CONTEXT D-13·CLAUDE.md 가 예고한 그대로 | ✓ |
| `MenuList` 를 남기고 `CandidateList` 를 추가 | 죽은 코드 + 예외 유지 | |

**User's choice:** 위임 → Claude 선택 (1행). `MenuRow`·`PinnedMenuRow` 타입도 삭제(D-24).

## Claude's Discretion

전 영역(사용자 위임). 세부 재량은 CONTEXT.md §Claude's Discretion — 스타일·타입/함수 이름·문안·ref 배치·플랜 분할(06-01 순수 / 06-02 UI·문서).

## Deferred Ideas

CONTEXT.md §deferred — Phase 7(`in-05`)·Phase 8(`wr-01`)·stalled 수동 버튼·후보 수 스냅샷·매장 탭 뱃지·`CHANNEL_ERROR`·IN-07.
