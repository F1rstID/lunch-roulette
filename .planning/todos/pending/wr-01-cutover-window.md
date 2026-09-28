---
title: 컷오버 창 — SQL 적용 → Edge Function 배포 → PR 머지를 12:00 KST 이후 연속 수행
created: 2026-09-21
source: .planning/phases/02-data-model/02-REVIEW.md (WR-01)
resolves_phase: 8
---
`0005_restaurants_settings.sql` 의 마지막 두 줄이 `menus`·`pinned_menus` 를 떨구는데, 그 순간 **배포돼 있는 구 코드는 전부 그 테이블을 읽는다** — `app/page.tsx`(menus·pinned_menus), `supabase/functions/spin-roulette/index.ts`, `supabase/functions/respin-roulette/index.ts`. 게다가 이 파일은 `spin-lunch-roulette` 를 매분 폴링으로 바꾸는데 구 함수의 가드는 `>= 11:55` 라 `settings.spin_time` 을 읽지 않는다. SQL 과 코드 사이 공백 구간에서는 (a) 페이지 초기 로드가 `menus` 42P01 로 실패하고, (b) 결과가 아직 없으면 매분 `spin-roulette` 가 500 을 내며 `net._http_response` 를 채우고, (c) 그날 추첨이 통째로 빠질 수 있다.

**SHIP-04 체크리스트에 넣을 항목:**
1. **그날 `results` 행이 확정된 뒤에 시작한다 — 12:00 KST 이후.** 추첨이 이미 끝났으면 매분 폴링이 멱등 skip 으로 떨어져 잃을 추첨이 없다.
2. 적용 직전 `menus`·`pinned_menus` 0행 육안 확인(가정 A2).
3. 대시보드 SQL Editor 에서 `0005_restaurants_settings.sql` 1회 실행.
4. **곧바로** Edge Function 2종 재배포. `supabase/config.toml` 에 `verify_jwt = false` 가 고정돼 있으므로(63fae89) CLI 가 그 값을 읽는다 — `--no-verify-jwt` 를 같이 주는 것은 이중 안전이다. config.toml 을 건드리거나 플래그를 빼지 말 것(true 로 배포되면 401 로 추첨이 조용히 멈춘다).
5. **곧바로** PR 머지(Vercel 배포).
6. 3~5 를 나눠서 하지 않는다. 한 세션 안에서 몇 분 내 연속 수행하고, 다음 날 11:55 전에 끝낸다.
7. 배포 직후 `respin-roulette` 를 수동 invoke 해 응답을 눈으로 확인한다 — `menu` 가 실제 매장명 문자열이고 `restaurant_id` 가 uuid 여야 한다(`ok: true` 와 `candidate_count` > 0 도 함께 본다). PostgREST 의 매장 임베드가 배열로 오느냐 객체로 오느냐는 `deno check` 도 계약 테스트도 잡지 못하고 **첫 실호출에서만** 드러난다. `menu` 가 빈 문자열이거나 `restaurant_id` 가 없으면 임베드 접기가 틀린 것이다 — 그 상태로 다음 추첨 시각을 넘기지 않는다(`spin-roulette` 는 시간 가드 때문에 사전 확인이 불가능하므로 이 한 번이 유일한 창이다).

파일 머리 주석(2~6행)에도 같은 순서가 조건부 문장으로 적혀 있다 — "동작 불변" 은 Phase 4·6·7 코드가 배포된 뒤에만 참이다.
