---
title: parseMenuInput slice(0,24) UTF-16 절단 → 코드포인트 기준으로
created: 2026-09-18
source: .planning/phases/01-safety-net/01-REVIEW.md (WR-01)
resolves_phase: 5
---
`components/MenuList.tsx` `parseMenuInput`·`app/page.tsx` `addMenus`의 `slice(0, MENU_NAME_MAX_LEN)`이 UTF-16 코드유닛 기준이라 DB `char_length`(코드포인트)와 어긋난다. `"가".repeat(23)+"🍕"`(24 코드포인트, DB 허용)가 lone surrogate로 잘림. Phase 5가 매장 메뉴 입력에 parseMenuInput을 재사용하므로 그때 `Array.from(s).slice(0,N).join("")`로 바꾸고 경계 spec 추가. Phase 1에서는 동작 변경 금지라 보류.
