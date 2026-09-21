// lib/settings.ts 의 도메인 변환·병합 계약을 고정한다. settings 는 세 페이지가 전부 의존하는 단일 출처라서
// 대시보드에서 누가 이상한 값을 넣거나 행을 지워도 앱이 기본값(11:55 · 쿨다운 0)으로 계속 돌아야 한다(SETT-03).
// 로드 실패(error)와 파싱 경고(warning)를 서로 다른 필드로 가르는 계약도 여기서 못 박는다 —
// 한 필드에 몰면 로드가 성공한 경우에도 경고가 "설정 불러오기 실패:" 접두를 달고 나와 거짓말이 된다.
// 기대값은 리터럴로 적는다: 추첨 시각을 { hh: 11, mm: 55 } 로 직접 써서 "11:55 가 기본" 이라는 계약이
// 상수 변경에 딸려가지 않게 한다 (lib/phase.test.ts 와 같은 이유).
// 일부러 안 하는 것 ①: 행 타입(SettingsRow)을 import 하지 않고 리터럴 픽스처로 만든다 — 그 모듈은 로드
// 시점에 supabase 클라이언트를 만들어 환경변수를 요구하므로, spec 이 묶이면 러너에서 즉사한다(리서치 §Q7).
// 일부러 안 하는 것 ②: useSettings 훅은 테스트하지 않는다 — 렌더 하네스(DOM 구현 + 렌더 테스트 라이브러리)
// 3개를 들이는 비용 대비 훅 본문이 거의 배관뿐이다(리서치 §Q7). 판단은 전부 이 파일이 검사하는 리듀서에
// 있고, 훅에 남은 분기 2개(에러/0행, DELETE/그 외)만 낭독으로 검증한다 — 그 둘을 리듀서로 내리는 일은
// .planning/todos/pending/in-03-usesettings-branches-to-reducer.md 에 있다.

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  INITIAL_SETTINGS_STATE,
  settingsFromRow,
  settingsReducer,
} from "@/lib/settings";

// id 를 `1 as const` 로 고정한다 — 그냥 1 이면 number 로 넓어져 행 타입의 리터럴 1 에 붙지 않는다.
// spin_time 이 "HH:MM" 이 아니라 "HH:MM:SS" 인 것은 PostgREST 의 time 직렬화 형태다.
const ROW_DEFAULT = { id: 1 as const, spin_time: "11:55:00", cooldown_days: 0, history_since: "2026-09-21" };
const ROW_1230 = { id: 1 as const, spin_time: "12:30:00", cooldown_days: 3, history_since: "2026-09-21" };
// 사람이 대시보드에서 초·콜론을 빠뜨린 형태. 파서가 읽지 못하는 값의 대표다.
const ROW_BROKEN = { id: 1 as const, spin_time: "1155", cooldown_days: 0, history_since: "2026-09-21" };
const ROW_NEGATIVE = { id: 1 as const, spin_time: "11:55:00", cooldown_days: -1, history_since: "2026-09-21" };
// history_since 키가 통째로 빠진 페이로드. 행 타입은 이 형태를 표현하지 못해 타입을 우회해 넣는다 —
// Realtime payload 는 DB 를 거치지 않은 형태로도 온다고 가정하는 것이 이 모듈의 방어선이다.
const ROW_NO_HISTORY = { id: 1 as const, spin_time: "11:55:00", cooldown_days: 0 } as unknown as typeof ROW_DEFAULT;

describe("DEFAULT_SETTINGS — 로드 전에도 앱은 11:55 · 쿨다운 0 으로 돈다 (SETT-03)", () => {
  it("기본 추첨 시각이 11시 55분이다", () => {
    expect(DEFAULT_SETTINGS.spinTime).toEqual({ hh: 11, mm: 55 });
  });

  it("기본 쿨다운이 0 이다 (꺼진 상태)", () => {
    expect(DEFAULT_SETTINGS.cooldownDays).toBe(0);
  });

  it("기본 전환일이 null 이다 (전환일 미확정 — Phase 7 은 이 상태에서 집계하지 않는다)", () => {
    expect(DEFAULT_SETTINGS.historySince).toBeNull();
  });

  it("초기 상태는 기본 설정 + 아직 로드 전이고 에러·경고가 없다", () => {
    expect(INITIAL_SETTINGS_STATE).toEqual({
      settings: DEFAULT_SETTINGS,
      loaded: false,
      error: null,
      warning: null,
    });
  });
});

describe("settingsFromRow — 예외를 던지지 않는 총 함수다 (SETT-03)", () => {
  it("PostgREST 직렬화 형태 \"11:55:00\" 을 { hh: 11, mm: 55 } 로 읽는다 (SETT-02)", () => {
    expect(settingsFromRow(ROW_DEFAULT).settings.spinTime).toEqual({ hh: 11, mm: 55 });
  });

  it("대시보드에서 바꾼 \"12:30:00\" 을 { hh: 12, mm: 30 } 으로 읽는다", () => {
    expect(settingsFromRow(ROW_1230).settings.spinTime).toEqual({ hh: 12, mm: 30 });
  });

  it("정상 행에서는 warning 이 null 이다", () => {
    expect(settingsFromRow(ROW_DEFAULT).warning).toBeNull();
  });

  it("잘못된 spin_time(\"1155\")이면 기본 시각으로 착지한다", () => {
    expect(settingsFromRow(ROW_BROKEN).settings.spinTime).toEqual({ hh: 11, mm: 55 });
  });

  it("그때 warning 이 null 이 아니다 (실패를 삼키지 않는다)", () => {
    expect(settingsFromRow(ROW_BROKEN).warning).not.toBeNull();
  });

  it("음수 cooldown_days(-1)는 0 으로 좁힌다", () => {
    expect(settingsFromRow(ROW_NEGATIVE).settings.cooldownDays).toBe(0);
  });

  it("양수 cooldown_days(3)는 그대로 통과한다", () => {
    expect(settingsFromRow(ROW_1230).settings.cooldownDays).toBe(3);
  });

  it("history_since 문자열이 그대로 historySince 에 실린다", () => {
    expect(settingsFromRow(ROW_DEFAULT).settings.historySince).toBe("2026-09-21");
  });

  it("history_since 키가 없는 행도 undefined 가 아니라 null 로 착지한다 (=== null 검사가 성립한다)", () => {
    expect(settingsFromRow(ROW_NO_HISTORY).settings.historySince).toBeNull();
  });
});

describe("settingsReducer — 로드 경로 (SETT-03)", () => {
  it("loaded(row) 는 설정을 갈아끼우고 로드 완료로 표시한다", () => {
    expect(settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_1230 })).toEqual({
      settings: { spinTime: { hh: 12, mm: 30 }, cooldownDays: 3, historySince: "2026-09-21" },
      loaded: true,
      error: null,
      warning: null,
    });
  });

  it("loaded(null) — 시드 안 된 정상 상태는 기본값으로 로드 완료이고 error 가 없다", () => {
    expect(settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: null })).toEqual({
      settings: DEFAULT_SETTINGS,
      loaded: true,
      error: null,
      warning: null,
    });
  });

  it("failed 는 기본값을 유지한 채 error 로 실패를 노출한다 (앱은 계속 동작한다)", () => {
    expect(settingsReducer(INITIAL_SETTINGS_STATE, { type: "failed", message: "boom" })).toEqual({
      settings: DEFAULT_SETTINGS,
      loaded: true,
      error: "boom",
      warning: null,
    });
  });

  it("이미 로드가 끝난 상태에 온 failed 는 무시된다 (훅은 조회 결과를 한 번만 보낸다)", () => {
    const warned = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_BROKEN });
    expect(settingsReducer(warned, { type: "failed", message: "boom" })).toBe(warned);
  });

  it("잘못된 spin_time 행을 읽으면 기본 시각 + warning 이고 error 는 null 이다 (불러오기는 성공했다)", () => {
    const next = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_BROKEN });
    expect({ spinTime: next.settings.spinTime, error: next.error, hasWarning: next.warning !== null }).toEqual({
      spinTime: { hh: 11, mm: 55 },
      error: null,
      hasWarning: true,
    });
  });
});

describe("settingsReducer — Realtime 병합 (SETT-02)", () => {
  it("changed(\"UPDATE\") 가 추첨 시각을 갱신한다 (새로고침 없이 반영)", () => {
    const loaded = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_DEFAULT });
    expect(settingsReducer(loaded, { type: "changed", event: "UPDATE", row: ROW_1230 }).settings.spinTime).toEqual({
      hh: 12,
      mm: 30,
    });
  });

  it("같은 UPDATE 가 쿨다운도 갱신한다 (payload.new 가 전체 행이라 통째 교체다)", () => {
    const loaded = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_DEFAULT });
    expect(settingsReducer(loaded, { type: "changed", event: "UPDATE", row: ROW_1230 }).settings.cooldownDays).toBe(3);
  });

  it("changed(\"INSERT\") 도 같은 경로로 병합된다", () => {
    const empty = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: null });
    expect(settingsReducer(empty, { type: "changed", event: "INSERT", row: ROW_1230 }).settings.spinTime).toEqual({
      hh: 12,
      mm: 30,
    });
  });

  it("잘못된 행 다음에 정상 행이 오면 warning 이 지워진다 (오타를 고치면 경고도 사라진다)", () => {
    const warned = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_BROKEN });
    expect(settingsReducer(warned, { type: "changed", event: "UPDATE", row: ROW_DEFAULT }).warning).toBeNull();
  });

  it("changed(\"DELETE\") 는 기본값으로 복귀한다 (payload.old 가 PK 만이라 재구성이 불가능하다)", () => {
    const loaded = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_1230 });
    expect(settingsReducer(loaded, { type: "changed", event: "DELETE", row: null }).settings).toEqual(DEFAULT_SETTINGS);
  });

  it("DELETE 이후 error 와 warning 이 둘 다 null 이다 (행 삭제는 실패가 아니다)", () => {
    const warned = settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_BROKEN });
    const next = settingsReducer(warned, { type: "changed", event: "DELETE", row: null });
    expect({ error: next.error, warning: next.warning }).toEqual({ error: null, warning: null });
  });

  it("리듀서는 넘겨받은 state 를 변형하지 않는다", () => {
    settingsReducer(INITIAL_SETTINGS_STATE, { type: "loaded", row: ROW_1230 });
    expect(INITIAL_SETTINGS_STATE.loaded).toBe(false);
  });
});

// 초기 SELECT 가 왕복하는 수백 ms 사이에 대시보드 편집이 도착하면 두 갈래가 순서를 바꿔 들어온다.
// 리듀서는 "더 새 값이 이긴다" 를 시간이 아니라 loaded 플래그로 판정한다 — 훅이 조회 결과를 정확히
// 한 번만 보내므로, 도착 시점에 loaded 가 이미 참이면 Realtime 이 앞섰다는 뜻이기 때문이다.
describe("settingsReducer — 이벤트 순서가 뒤집혀도 더 새 값이 이긴다 (SETT-02)", () => {
  it("UPDATE 뒤에 늦게 도착한 초기 조회 결과는 옛 행으로 되돌리지 못한다", () => {
    const updated = settingsReducer(INITIAL_SETTINGS_STATE, { type: "changed", event: "UPDATE", row: ROW_1230 });
    expect(settingsReducer(updated, { type: "loaded", row: ROW_DEFAULT }).settings.spinTime).toEqual({
      hh: 12,
      mm: 30,
    });
  });

  it("UPDATE 뒤에 늦게 도착한 조회 실패는 배너를 띄우지 않고 받은 행을 유지한다", () => {
    const updated = settingsReducer(INITIAL_SETTINGS_STATE, { type: "changed", event: "UPDATE", row: ROW_1230 });
    const next = settingsReducer(updated, { type: "failed", message: "boom" });
    expect({ error: next.error, spinTime: next.settings.spinTime }).toEqual({
      error: null,
      spinTime: { hh: 12, mm: 30 },
    });
  });

  it("DELETE 뒤에 늦게 도착한 조회 결과도 지워진 행을 되살리지 못한다", () => {
    const deleted = settingsReducer(INITIAL_SETTINGS_STATE, { type: "changed", event: "DELETE", row: null });
    const next = settingsReducer(deleted, { type: "loaded", row: ROW_1230 });
    expect({ settings: next.settings, loaded: next.loaded }).toEqual({
      settings: DEFAULT_SETTINGS,
      loaded: true,
    });
  });
});
