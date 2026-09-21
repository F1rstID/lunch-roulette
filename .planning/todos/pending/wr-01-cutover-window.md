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
4. **곧바로** Edge Function 2종 재배포 — `--no-verify-jwt` 필수(config.toml 없음).
5. **곧바로** PR 머지(Vercel 배포).
6. 3~5 를 나눠서 하지 않는다. 한 세션 안에서 몇 분 내 연속 수행하고, 다음 날 11:55 전에 끝낸다.

파일 머리 주석(2~6행)에도 같은 순서가 조건부 문장으로 적혀 있다 — "동작 불변" 은 Phase 4·6·7 코드가 배포된 뒤에만 참이다.
