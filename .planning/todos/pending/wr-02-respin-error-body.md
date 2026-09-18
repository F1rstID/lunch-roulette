---
title: respin() Edge Function 500 본문 {error} 표면화
created: 2026-09-18
source: .planning/phases/01-safety-net/01-REVIEW.md (WR-02)
resolves_phase: 4
---
`app/page.tsx` `respin()`이 supabase-js `FunctionsHttpError`의 고정 문구("Edge Function returned a non-2xx status code")만 보여주고 함수가 보낸 `{error}` 본문을 버린다. `RespinResponse.error`는 선언만 있고 안 읽힘. Phase 4(respin 재작성) 때 `error instanceof FunctionsHttpError`면 `await error.context.json()`으로 본문을 읽어 배너에 표시.
