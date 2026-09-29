// lib/restaurants.ts 의 매장 도메인 계약을 고정한다 — 폼 검증·위치 링크 판정·정렬·Realtime 병합 (05-01 산출물).
// 기대 숫자(24·30·200)를 상수가 아니라 리터럴로 쓰는 이유: 상수를 가져오면 값이 바뀔 때 기대값도 따라 움직여
// "0005 의 check 제약을 그대로 비춘다" 는 사실이 테스트에서 사라진다 (components/MenuList.test.ts:3-4 와 같은 논증).
// 길이를 코드포인트로 세는 이유: Postgres char_length 가 코드포인트 단위라 UTF-16 코드유닛으로 재면 클라이언트가
// 통과시킨 이모지 이름이 DB 에서 23514 로 튕긴다 — 두 단위가 갈리는 지점이 곧 사용자가 보는 실패다.
// 일부러 안 하는 것: useRestaurants 훅은 테스트하지 않는다 — 레포에 렌더 하네스가 없고, 훅에 분기를 남기지 않는 것이
// 이 모듈의 존재 이유다(lib/settings.test.ts:9-12 와 같은 논증). 행 타입도 가져오지 않고 리터럴 픽스처로 만든다 —
// 그 타입이 사는 모듈은 로드 시점에 환경변수를 읽으므로 spec 이 묶이면 러너에서 즉사한다.

import { describe, it, expect } from "vitest";
import {
  INITIAL_RESTAURANTS_STATE,
  joinMenus,
  parseLocationLink,
  parseRestaurantForm,
  restaurantsReducer,
  sortRestaurants,
} from "@/lib/restaurants";

// 행 픽스처. created_at 은 PostgREST 의 timestamptz 직렬화 형태다.
const ROW_A = {
  id: "r1",
  name: "김밥천국",
  menus: ["김밥"],
  location: null,
  pinned: false,
  created_at: "2026-09-29T02:00:00+09:00",
};
// ROW_A 와 같은 id 의 새 행. UPDATE 가 얕은 병합이 아니라 통째 교체라는 것을 보이는 데 쓴다.
const ROW_A_NEXT = {
  id: "r1",
  name: "김밥나라",
  menus: ["김밥", "라면"],
  location: "2층 안쪽",
  pinned: true,
  created_at: "2026-09-29T02:00:00+09:00",
};
const ROW_B = {
  id: "r2",
  name: "마라탕집",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T03:00:00+09:00",
};
const ROW_PINNED = {
  id: "r3",
  name: "샐러드바",
  menus: [],
  location: null,
  pinned: true,
  created_at: "2026-09-29T04:00:00+09:00",
};
// 같은 핀 그룹 안의 이름 정렬만 보기 위한 셋. 입력 순서를 일부러 사전순과 어긋나게 둔다.
const ROW_DA = {
  id: "r4",
  name: "다",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T05:00:00+09:00",
};
const ROW_GA = {
  id: "r5",
  name: "가",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T06:00:00+09:00",
};
const ROW_NA = {
  id: "r6",
  name: "나",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T07:00:00+09:00",
};

// 개수 경계(30/31)를 만들 때 쓰는 목록. 이름이 서로 달라야 중복 제거에 걸리지 않는다.
const MENUS_30 = Array.from({ length: 30 }, (_, i) => `메뉴${i}`);
const MENUS_31 = Array.from({ length: 31 }, (_, i) => `메뉴${i}`);

describe("parseRestaurantForm — 클라이언트 검증은 보조, 정본은 DB check 다", () => {
  it("이름이 공백뿐이면 거절하고 입력을 요구한다", () => {
    expect(parseRestaurantForm({ name: "   ", menusText: "", location: "" })).toEqual({
      ok: false,
      message: "매장 이름을 입력해 주세요",
    });
  });

  it("이름 1자는 통과한다 (하한 경계)", () => {
    expect(parseRestaurantForm({ name: "김", menusText: "", location: "" })).toEqual({
      ok: true,
      input: { name: "김", menus: [], location: null },
    });
  });

  it("이름 24 코드포인트는 이모지가 섞여도 그대로 통과한다 (상한 경계 — DB 가 허용하는 값을 먼저 막지 않는다)", () => {
    const name = "가".repeat(23) + "🍕";
    expect(parseRestaurantForm({ name, menusText: "", location: "" })).toEqual({
      ok: true,
      input: { name, menus: [], location: null },
    });
  });

  it("이름 25 코드포인트는 자르지 않고 거절한다", () => {
    expect(parseRestaurantForm({ name: "가".repeat(24) + "🍕", menusText: "", location: "" })).toEqual({
      ok: false,
      message: "매장 이름은 24자까지예요",
    });
  });

  it("이름에 줄바꿈이 있으면 거절한다 (DB 의 개행 금지 제약과 같은 규칙)", () => {
    expect(parseRestaurantForm({ name: "김밥\n천국", menusText: "", location: "" })).toEqual({
      ok: false,
      message: "매장 이름에 줄바꿈을 넣을 수 없어요",
    });
  });

  it("이름 앞뒤 공백은 떼고 싣는다", () => {
    expect(parseRestaurantForm({ name: "  김밥천국  ", menusText: "", location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: [], location: null },
    });
  });

  it("메뉴 칸이 비면 빈 배열이다 (선택 필드)", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "", location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: [], location: null },
    });
  });

  it("메뉴는 반각·전각 쉼표 둘 다로 갈린다", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "김치찌개, 마라탕，샐러드", location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: ["김치찌개", "마라탕", "샐러드"], location: null },
    });
  });

  it("메뉴 원소가 25 코드포인트면 24 코드포인트로 잘린다 (개수 초과와 달리 원소는 절단이다)", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "가".repeat(25), location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: ["가".repeat(24)], location: null },
    });
  });

  it("메뉴 입력 안의 중복은 제거된다", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "바나나,바나나", location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: ["바나나"], location: null },
    });
  });

  it("메뉴 30개는 통과한다 (상한 경계)", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: MENUS_30.join(","), location: "" })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: MENUS_30, location: null },
    });
  });

  it("메뉴 31개는 조용히 자르지 않고 거절한다", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: MENUS_31.join(","), location: "" })).toEqual({
      ok: false,
      message: "메뉴는 30개까지예요",
    });
  });

  it("위치가 공백뿐이면 null 이다 (빈 문자열을 DB 로 보내지 않는다)", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "", location: "   " })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: [], location: null },
    });
  });

  it("위치 앞뒤 공백은 떼고 싣는다", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "", location: "  2층 안쪽 골목  " })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: [], location: "2층 안쪽 골목" },
    });
  });

  it("위치 200 코드포인트는 통과한다 (상한 경계)", () => {
    const location = "가".repeat(200);
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "", location })).toEqual({
      ok: true,
      input: { name: "김밥천국", menus: [], location },
    });
  });

  it("위치 201 코드포인트는 거절한다", () => {
    expect(parseRestaurantForm({ name: "김밥천국", menusText: "", location: "가".repeat(201) })).toEqual({
      ok: false,
      message: "위치는 200자까지예요",
    });
  });
});

describe("parseLocationLink — 링크로 렌더할지를 여기서 정한다", () => {
  it("https 주소는 링크가 되고 호스트명을 함께 준다", () => {
    expect(parseLocationLink("https://naver.me/xxx")).toEqual({ href: "https://naver.me/xxx", host: "naver.me" });
  });

  it("http 주소도 링크다", () => {
    expect(parseLocationLink("http://example.com/a/b")).toEqual({
      href: "http://example.com/a/b",
      host: "example.com",
    });
  });

  it("javascript: 스킴은 링크가 아니다 (파싱은 성공하지만 프로토콜 화이트리스트를 통과하지 못한다)", () => {
    expect(parseLocationLink("javascript:alert(1)")).toBeNull();
  });

  it("일반 텍스트 위치는 링크가 아니다", () => {
    expect(parseLocationLink("2층 안쪽 골목")).toBeNull();
  });

  it("위치가 없으면 링크도 없다", () => {
    expect(parseLocationLink(null)).toBeNull();
  });
});

describe("joinMenus — 배열과 한 줄 문자열의 왕복", () => {
  it("빈 배열은 빈 문자열이다 (편집 폼의 메뉴 칸이 undefined 로 차지 않는다)", () => {
    expect(joinMenus([])).toBe("");
  });

  it("두 원소는 쉼표와 공백으로 이어진다", () => {
    expect(joinMenus(["김밥", "라면"])).toBe("김밥, 라면");
  });

  it("이어 붙인 문자열을 다시 파싱하면 같은 배열이 나온다 (왕복 불변)", () => {
    expect(
      parseRestaurantForm({ name: "김밥천국", menusText: joinMenus(["김밥", "라면"]), location: "" }),
    ).toEqual({ ok: true, input: { name: "김밥천국", menus: ["김밥", "라면"], location: null } });
  });
});

describe("sortRestaurants — 핀 먼저, 그 안에서 이름순", () => {
  it("핀 매장이 비핀 매장보다 앞에 온다 (이름순이면 뒤로 갈 매장이어도)", () => {
    expect(sortRestaurants([ROW_B, ROW_PINNED]).map((r) => r.id)).toEqual(["r3", "r2"]);
  });

  it("같은 핀 그룹 안에서는 한국어 이름순이다", () => {
    expect(sortRestaurants([ROW_DA, ROW_GA, ROW_NA]).map((r) => r.name)).toEqual(["가", "나", "다"]);
  });

  it("입력 배열을 변형하지 않는다 (1초 tick 으로 매초 부르는 호출부가 원본을 공유한다)", () => {
    const rows = [ROW_DA, ROW_GA];
    sortRestaurants(rows);
    expect(rows[0].name).toBe("다");
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(sortRestaurants([])).toEqual([]);
  });
});

describe("restaurantsReducer — Realtime 병합", () => {
  it("loaded 가 목록을 세우고 로드 완료로 표시한다", () => {
    expect(restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A, ROW_B] })).toEqual({
      rows: [ROW_A, ROW_B],
      loaded: true,
      error: null,
      pending: [],
    });
  });

  it("failed 는 실패를 노출하되 목록을 비운다 (실패를 '매장 0개' 로 위장하지 않는다)", () => {
    expect(restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "failed", message: "boom" })).toEqual({
      rows: [],
      loaded: true,
      error: "boom",
      pending: [],
    });
  });

  it("이미 로드가 끝난 상태에 늦게 온 loaded 는 무시된다 (옛 조회 응답이 Realtime 값을 되돌리지 않는다)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "loaded", rows: [ROW_B] })).toBe(live);
  });

  it("이미 로드가 끝난 상태에 늦게 온 failed 도 무시된다 (살아 있는 목록이 실패 배너로 덮이지 않는다)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "failed", message: "boom" })).toBe(live);
  });

  it("INSERT 가 행을 더한다", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "changed", event: "INSERT", row: ROW_B }).rows.map((r) => r.id)).toEqual([
      "r1",
      "r2",
    ]);
  });

  it("같은 id 의 INSERT 가 한 번 더 와도 목록이 늘지 않는다 (멱등)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "changed", event: "INSERT", row: ROW_A }).rows).toHaveLength(1);
  });

  it("UPDATE 는 같은 id 의 행을 통째로 교체한다 (얕은 병합이 아니다)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "changed", event: "UPDATE", row: ROW_A_NEXT }).rows).toEqual([ROW_A_NEXT]);
  });

  it("모르는 id 의 UPDATE 는 목록을 바꾸지 않는다", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A] });
    expect(restaurantsReducer(live, { type: "changed", event: "UPDATE", row: ROW_B }).rows).toEqual([ROW_A]);
  });

  it("DELETE 는 id 하나만으로 그 행을 지운다 (페이로드에 id 밖에 없다)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A, ROW_B] });
    expect(restaurantsReducer(live, { type: "changed", event: "DELETE", id: "r1" }).rows.map((r) => r.id)).toEqual([
      "r2",
    ]);
  });

  it("id 가 없는 DELETE 는 아무 행도 지우지 않는다 (무엇을 지울지 알 수 없다)", () => {
    const live = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "loaded", rows: [ROW_A, ROW_B] });
    expect(restaurantsReducer(live, { type: "changed", event: "DELETE", id: null }).rows).toHaveLength(2);
  });
});

// 훅은 초기 조회와 구독을 동시에 띄우므로 남의 INSERT/UPDATE/DELETE 가 조회 응답보다 먼저 도착하는 창이
// 매 마운트마다 열린다. 그 창에서 이벤트를 곧바로 적용하고 loaded 를 올리면 뒤이어 온 조회 응답이
// "늦게 온 옛 값" 으로 버려져 카탈로그가 이벤트에 실린 한 행으로 쪼그라든다(CR-01). 아래 네 건이 그
// 순서를 고정한다 — 리듀서가 순수하므로 훅 없이도 결정적으로 재현된다.
describe("restaurantsReducer — 조회 응답보다 먼저 온 이벤트 (CR-01)", () => {
  it("loaded 전 INSERT 는 버려지지도 즉시 적용되지도 않고 조회 결과 위에 얹힌다", () => {
    const early = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "changed", event: "INSERT", row: ROW_B });
    // 아직 목록을 읽지 못했으므로 loaded 는 거짓이고 행도 세우지 않는다.
    expect([early.rows, early.loaded]).toEqual([[], false]);
    expect(restaurantsReducer(early, { type: "loaded", rows: [ROW_A] }).rows).toEqual([ROW_A, ROW_B]);
  });

  it("loaded 전 UPDATE 는 조회 결과의 같은 행을 새 값으로 바꾼다", () => {
    const early = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "changed", event: "UPDATE", row: ROW_A_NEXT });
    expect(restaurantsReducer(early, { type: "loaded", rows: [ROW_A, ROW_B] }).rows).toEqual([ROW_A_NEXT, ROW_B]);
  });

  it("loaded 전 DELETE 는 조회 결과에서 그 행을 지운다 (조회가 아직 들고 있는 행이다)", () => {
    const early = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "changed", event: "DELETE", id: "r1" });
    const merged = restaurantsReducer(early, { type: "loaded", rows: [ROW_A, ROW_B] });
    expect([merged.rows.map((r) => r.id), merged.pending]).toEqual([["r2"], []]);
  });

  it("loaded 전 이벤트가 있어도 조회 실패는 배너를 세운다 (같은 창의 SELECT 실패를 삼키지 않는다)", () => {
    const early = restaurantsReducer(INITIAL_RESTAURANTS_STATE, { type: "changed", event: "INSERT", row: ROW_B });
    expect(restaurantsReducer(early, { type: "failed", message: "boom" })).toEqual({
      rows: [],
      loaded: true,
      error: "boom",
      pending: [],
    });
  });
});
