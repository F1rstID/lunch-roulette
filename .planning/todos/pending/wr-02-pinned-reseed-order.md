---
title: 후보 목록 정렬을 candidates.created_at + restaurants.created_at 조인 순서로
created: 2026-09-21
source: .planning/phases/02-data-model/02-REVIEW.md (WR-02)
resolves_phase: 6
---
자정 재시드(`insert into public.candidates (restaurant_id) select id from public.restaurants where pinned order by created_at`)는 한 문 안에서 들어가는 행 전부에 **같은 `candidates.created_at`** 을 준다 — 기본값 `now()` 가 트랜잭션 시작 시각이기 때문이다(드라이런 실측: 핀 매장 3개 → ties=3). `order by created_at` 만 쓰는 목록 쿼리는 그 동률 구간에서 힙 물리 순서에 기대게 되고, 새로고침·VACUUM 뒤 순서가 바뀐다.

**해결 방법(Phase 6, SQL 변경 없음):** 후보 목록 쿼리를 `restaurants` 조인으로 뽑고 `order by candidates.created_at, restaurants.created_at` 로 정렬한다. 자정 재시드 행들은 첫 키가 동률이므로 두 번째 키(매장 등록 순서 = 사용자가 핀을 꽂은 순서의 근사)가 핀 순서를 복원한다. supabase-js 로는 `.select("created_at, restaurants(...)").order("created_at").order("created_at", { foreignTable: "restaurants" })` 형태.

**SQL 을 고치지 않기로 한 이유(2026-09-21 사용자 결정):** 리뷰가 제안한 `now() + row_number() * interval '1 microsecond'` 는 D-02 원문(`insert … select id … order by created_at`)을 바꾸고 스펙 #20 정규식까지 흔든다. 정렬은 읽는 쪽 책임으로 두는 편이 마이그레이션을 단순하게 유지한다.
