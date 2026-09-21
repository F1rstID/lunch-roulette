---
title: useSettings 의 분기 2개를 리듀서 action 으로 내려 훅을 배관만 남기기
created: 2026-09-21
source: .planning/phases/03-pure-logic/03-REVIEW.md (IN-03)
resolves_phase: 6
---
훅에 판정이 2개 있다 — `lib/useSettings.ts` 의 `if (error) dispatch(failed) else dispatch(loaded)` 와 `payload.eventType === "DELETE" ? null : payload.new`. 앞의 것은 03-03 SUMMARY 가 "0행은 배너를 띄우지 않고, 테이블 부재는 반드시 띄운다" 고 강조한 바로 그 결정인데, 리듀서는 **이미 갈라진** action 만 받으므로 `lib/settings.test.ts` 의 어느 spec 도 이 분기를 지나지 않는다. 레포에 React 렌더 하네스가 없어 훅은 낭독으로만 검증되고, 낭독은 회귀를 잡지 못한다. 동작은 현재 맞다 — 문제는 가장 중요한 판정이 테스트 밖에 있다는 것이다.

**해결 방법(Phase 6):** 분기를 리듀서로 내린다.

```ts
// lib/settings.ts
export type SettingsAction =
  | { type: "fetched"; data: SettingsRow | null; error: { message: string } | null }
  | { type: "event"; eventType: "INSERT" | "UPDATE" | "DELETE"; newRow: SettingsRow | null };
// fetched → error 가 있으면 실패 경로(데이터가 함께 와도), 없으면 data ?? null 로드 경로
// event   → DELETE 면 기본값 복귀, 아니면 settingsFromRow(newRow)
// lib/useSettings.ts
dispatch({ type: "fetched", data: data as SettingsRow | null, error });
dispatch({ type: "event", eventType: payload.eventType, newRow: payload.new as SettingsRow | null });
```

그러면 "`error` 가 있으면 `data` 가 있어도 실패다"·"0행은 배너 없음" 이 spec 2건으로 고정되고, 훅에는 분기가 0이 된다.

**같이 고칠 것:** 그 시점에 `lib/settings.test.ts` 머리 주석(현재 "훅에 남은 분기 2개는 낭독으로 검증한다")과 CLAUDE.md 의 훅 컨벤션 줄("훅에는 I/O 만 두고 판단은 순수 모듈로")이 비로소 문면 그대로 참이 된다. 03-03 의 낭독 체크리스트 1번 항목도 spec 참조로 바꾼다.

**주의:** 리듀서의 "늦게 온 초기 조회는 무시한다" 가드(`state.loaded` 검사, 03-REVIEW IN-01 에서 추가)는 새 action 이름에서도 그대로 유지해야 한다 — `fetched` 가 `loaded`·`failed` 두 갈래를 합치므로 가드를 한 곳에만 두면 된다.
