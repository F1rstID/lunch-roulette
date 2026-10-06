// lib/candidates.ts 의 오늘 후보 계약을 고정한다 — 휠 순서·목록 배지·당첨 인덱스의 정의처가 하나라는 사실이 핵심이다.
// 정렬 키가 3단인 이유: 자정 재시드가 한 문장 insert 라 candidates.created_at 이 전부 같아지고(0005:147-155),
// 그 동률 구간에서 두 번째 키(매장 등록 시각)가 핀을 꽂은 순서를 복원한다 — SQL 은 바꾸지 않는다(todo wr-02).
// 당첨을 식별자로만 찾는 이유: 이름으로 되찾으면 동명 매장이 당첨으로 오인되고, 컷오버 전 구 결과는 메뉴명이라
// 매장과 맞을 수 없다. 이름 폴백이 없다는 것이 계약이다.
// 행 픽스처를 리터럴로 만들고 타입 별칭도 이 파일 안에 두는 이유: 행 타입이 사는 모듈은 로드 시점에 환경변수를
// 읽으므로 spec 이 묶이면 러너에서 즉사한다(lib/restaurants.test.ts:6-8 과 같은 논증).
// 일부러 안 하는 것: 훅·컴포넌트는 테스트하지 않는다 — 레포에 렌더 하네스가 없고, 판단을 여기로 내린 이유가 그것이다.

import { describe, it, expect } from "vitest";
import {
  INITIAL_CANDIDATES_STATE,
  candidatesReducer,
  filterRestaurantsByName,
  findWinnerIndex,
  isNewSpin,
  joinCandidates,
  listTodayRows,
} from "@/lib/candidates";

type Store = {
  id: string;
  name: string;
  menus: string[];
  location: string | null;
  pinned: boolean;
  created_at: string;
};
type Candidate = { restaurant_id: string; created_at: string };
type Today = {
  id: string;
  name: string;
  menus: string[];
  location: string | null;
  pinned: boolean;
  addedAt: string;
};

// 자정 재시드가 한 문장 insert 로 남기는 동률 시각. 트랜잭션 시작 시각이라 행마다 같다.
const RESEED_AT = "2026-09-29T00:00:00+09:00";

const S_GIM: Store = {
  id: "r1",
  name: "김밥천국",
  menus: ["김밥"],
  location: null,
  pinned: false,
  created_at: "2026-09-29T02:00:00+09:00",
};
const S_MARA: Store = {
  id: "r2",
  name: "마라탕집",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T03:00:00+09:00",
};
const S_SALAD: Store = {
  id: "r3",
  name: "샐러드바",
  menus: ["샐러드", "수프"],
  location: "2층 안쪽",
  pinned: true,
  created_at: "2026-09-29T01:00:00+09:00",
};
const S_ABC: Store = {
  id: "r4",
  name: "ABC Deli",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T04:00:00+09:00",
};
// 이름에는 없고 메뉴에만 있는 낱말을 담은 매장. 필터가 메뉴를 보지 않는다는 것을 보이는 데 쓴다.
const S_WOORI: Store = {
  id: "r5",
  name: "우리식당",
  menus: ["돈까스", "우동"],
  location: null,
  pinned: false,
  created_at: "2026-09-29T05:00:00+09:00",
};
const S_GIMNARA: Store = {
  id: "r7",
  name: "김밥나라",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T06:00:00+09:00",
};
// 후보 시각도 매장 시각도 동률이라 마지막 키(매장 id)만 남는 쌍. 입력 순서를 일부러 뒤집어 둔다.
const S_TIE_LATE: Store = {
  id: "r9",
  name: "나집",
  menus: [],
  location: null,
  pinned: true,
  created_at: RESEED_AT,
};
const S_TIE_EARLY: Store = {
  id: "r8",
  name: "가집",
  menus: [],
  location: null,
  pinned: true,
  created_at: RESEED_AT,
};

// 같은 순간을 다른 형식으로 적은 시각 네 벌. 초기 조회 행은 PostgREST 가, 이후 행은 Realtime 페이로드가
// 만들므로 목록은 정상 상태에서 **두 출처가 섞인** 배열이다 — 형식이 갈려도 순서는 순간으로 정해져야 한다.
// 오프셋을 아예 안 적은 "2026-09-28T17:00:00" 형식은 계약으로 고정하지 않는다: ES 명세상 로컬 시각이라
// 러너의 TZ 에 따라 가리키는 순간이 달라져 기대값을 적을 수 없고, Postgres 도 timestamptz 를 그렇게
// 내보내지 않는다.
const INSTANT_Z = "2026-09-28T17:00:00Z";
const INSTANT_MILLIS = "2026-09-28T17:00:00.000Z";
const INSTANT_KST = "2026-09-29T02:00:00+09:00";

// 등록 시각만 다른 두 매장. 첫 키가 동률일 때 두 번째 키가 순서를 정하는지 보는 데 쓴다.
const S_EARLY_REG: Store = {
  id: "r10",
  name: "가게A",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T00:00:00+09:00",
};
const S_LATE_REG: Store = {
  id: "r11",
  name: "가게B",
  menus: [],
  location: null,
  pinned: false,
  created_at: "2026-09-29T08:00:00+09:00",
};

const C_GIM: Candidate = { restaurant_id: "r1", created_at: "2026-09-29T03:00:00+09:00" };
const C_MARA: Candidate = { restaurant_id: "r2", created_at: "2026-09-29T04:00:00+09:00" };
// 재시드로 함께 들어간 두 행. 첫 키가 동률이라 매장 등록 순서가 순서를 정한다.
const C_RESEED_GIM: Candidate = { restaurant_id: "r1", created_at: RESEED_AT };
const C_RESEED_SALAD: Candidate = { restaurant_id: "r3", created_at: RESEED_AT };
const C_TIE_LATE: Candidate = { restaurant_id: "r9", created_at: RESEED_AT };
const C_TIE_EARLY: Candidate = { restaurant_id: "r8", created_at: RESEED_AT };
// 카탈로그에서 이미 사라진 매장을 가리키는 후보. cascade 삭제 이벤트가 두 훅에 따로 도착하는 창의 정상 상태다.
const C_GONE: Candidate = { restaurant_id: "r404", created_at: "2026-09-29T05:00:00+09:00" };

const T_GIM: Today = {
  id: "r1",
  name: "김밥천국",
  menus: ["김밥"],
  location: null,
  pinned: false,
  addedAt: "2026-09-29T03:00:00+09:00",
};
const T_SALAD: Today = {
  id: "r3",
  name: "샐러드바",
  menus: ["샐러드", "수프"],
  location: "2층 안쪽",
  pinned: true,
  addedAt: RESEED_AT,
};

const RESULT_GIM = {
  id: "x1",
  date: "2026-09-29",
  menu: "김밥천국",
  candidates: [],
  spun_at: "2026-09-29T02:55:00+09:00",
  restaurant_id: "r1",
  ranking: null,
};
// 매장이 지워져 on delete set null 이 지나간 결과 행. 이름 스냅샷만 남는다.
const RESULT_ORPHAN = { ...RESULT_GIM, restaurant_id: null };
// 다시 돌리기가 쓴 결과. spun_at 이 항상 새로 찍힌다.
const RESULT_RESPUN = { ...RESULT_GIM, menu: "마라탕집", restaurant_id: "r2", spun_at: "2026-09-29T03:10:00+09:00" };

describe("joinCandidates — 휠 순서의 정의처 (D-06)", () => {
  it("candidates.created_at 오름차순으로 나온다", () => {
    expect(joinCandidates([C_MARA, C_GIM], [S_GIM, S_MARA]).map((c) => c.id)).toEqual(["r1", "r2"]);
  });

  it("candidates.created_at 이 같으면 restaurants.created_at 오름차순이다 (재시드 행이 핀 순서를 복원한다)", () => {
    expect(joinCandidates([C_RESEED_GIM, C_RESEED_SALAD], [S_GIM, S_SALAD]).map((c) => c.id)).toEqual(["r3", "r1"]);
  });

  it("두 키가 모두 같으면 매장 id 순이다 (새로고침마다 순서가 바뀌지 않는 완전 순서)", () => {
    expect(joinCandidates([C_TIE_LATE, C_TIE_EARLY], [S_TIE_LATE, S_TIE_EARLY]).map((c) => c.id)).toEqual(["r8", "r9"]);
  });

  it("카탈로그에 없는 restaurant_id 는 버린다 (cascade 삭제 이벤트가 따로 도착하는 창의 정상 상태)", () => {
    expect(joinCandidates([C_GIM, C_GONE], [S_GIM]).map((c) => c.id)).toEqual(["r1"]);
  });

  it("매장의 이름·메뉴·위치·핀이 그대로 실린다 (표시에 필요한 값을 다시 찾지 않게)", () => {
    expect(joinCandidates([C_RESEED_SALAD], [S_SALAD])).toEqual([
      { id: "r3", name: "샐러드바", menus: ["샐러드", "수프"], location: "2층 안쪽", pinned: true, addedAt: RESEED_AT },
    ]);
  });

  it("후보가 0개면 빈 배열이다", () => {
    expect(joinCandidates([], [S_GIM, S_MARA])).toEqual([]);
  });

  // 아래 셋은 문자열 비교로는 전부 반대 답이 나온다 — 두 출처의 직렬화가 같다는 전제를 지우는 단언이다.
  it('"Z" 와 "+09:00" 이 같은 순간이면 동률로 보고 다음 키(매장 등록 시각)로 넘어간다', () => {
    const rows = joinCandidates(
      [
        { restaurant_id: "r10", created_at: INSTANT_KST },
        { restaurant_id: "r11", created_at: INSTANT_Z },
      ],
      [S_EARLY_REG, S_LATE_REG],
    );
    expect(rows.map((c) => c.id)).toEqual(["r10", "r11"]);
  });

  it("소수 초가 붙은 형식도 같은 순간이면 동률이다", () => {
    const rows = joinCandidates(
      [
        { restaurant_id: "r11", created_at: INSTANT_MILLIS },
        { restaurant_id: "r10", created_at: INSTANT_Z },
      ],
      [S_EARLY_REG, S_LATE_REG],
    );
    expect(rows.map((c) => c.id)).toEqual(["r10", "r11"]);
  });

  it("오프셋이 다르면 문자열이 아니라 순간으로 앞뒤를 정한다", () => {
    const rows = joinCandidates(
      [
        // 02:00 UTC — 문자열로는 앞서 보이지만 실제로는 30분 늦다.
        { restaurant_id: "r10", created_at: "2026-09-29T02:00:00+00:00" },
        // 01:30 UTC
        { restaurant_id: "r11", created_at: "2026-09-29T10:30:00+09:00" },
      ],
      [S_EARLY_REG, S_LATE_REG],
    );
    expect(rows.map((c) => c.id)).toEqual(["r11", "r10"]);
  });
});

describe("filterRestaurantsByName — 이름만 좁힌다 (CAND-02 · D-07)", () => {
  it("빈 질의는 전부 돌려준다", () => {
    expect(filterRestaurantsByName([S_GIM, S_MARA], "").map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("공백뿐인 질의도 전부 돌려준다 (trim 후 판정)", () => {
    expect(filterRestaurantsByName([S_GIM, S_MARA], "   ").map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("대소문자를 가리지 않는다", () => {
    expect(filterRestaurantsByName([S_ABC, S_MARA], "abc").map((r) => r.id)).toEqual(["r4"]);
  });

  it("자소 분리(NFD)로 입력한 한글도 NFC 이름과 맞는다 (맥 키보드·붙여넣기에서 흔하다)", () => {
    expect(filterRestaurantsByName([S_GIM, S_MARA], "김밥".normalize("NFD")).map((r) => r.id)).toEqual(["r1"]);
  });

  it("메뉴는 검색하지 않는다 — 메뉴에만 있는 낱말로는 걸리지 않는다", () => {
    expect(filterRestaurantsByName([S_WOORI, S_MARA], "돈까스")).toEqual([]);
  });

  it("맞는 이름이 없으면 빈 배열이다", () => {
    expect(filterRestaurantsByName([S_GIM, S_MARA], "없는가게")).toEqual([]);
  });
});

// slice 는 필터와 무관한 휠 인덱스다. 배지 색이 휠 조각 색과 같은 매핑을 쓰므로, 필터로 앞쪽 행이 빠졌다고
// 번호를 다시 매기면 목록의 배지와 휠의 조각이 서로 다른 색을 가리킨다.
describe("listTodayRows — 담긴 것이 위, 배지는 휠 인덱스 (D-10 · D-15)", () => {
  it("담긴 매장이 휠 순서로 먼저 오고 slice 가 0부터 매겨진다", () => {
    const rows = listTodayRows([T_SALAD, T_GIM], [S_SALAD, S_GIM, S_GIMNARA, S_MARA], "");
    expect(rows.slice(0, 2).map((row) => [row.restaurant.id, row.slice])).toEqual([
      ["r3", 0],
      ["r1", 1],
    ]);
  });

  it("안 담긴 매장은 넘겨받은 카탈로그 순서 그대로 뒤에 오고 slice 가 null 이다", () => {
    const rows = listTodayRows([T_SALAD, T_GIM], [S_SALAD, S_GIM, S_GIMNARA, S_MARA], "");
    expect(rows.map((row) => [row.restaurant.id, row.slice])).toEqual([
      ["r3", 0],
      ["r1", 1],
      ["r7", null],
      ["r2", null],
    ]);
  });

  it("필터는 담긴 구간과 안 담긴 구간 둘 다에 적용된다", () => {
    const rows = listTodayRows([T_SALAD, T_GIM], [S_SALAD, S_GIM, S_GIMNARA, S_MARA], "마라");
    expect(rows.map((row) => [row.restaurant.id, row.slice])).toEqual([["r2", null]]);
  });

  it("필터로 앞쪽 담긴 매장이 빠져도 남은 담긴 매장의 slice 는 휠 인덱스를 유지한다", () => {
    const rows = listTodayRows([T_SALAD, T_GIM], [S_SALAD, S_GIM, S_GIMNARA, S_MARA], "김밥");
    expect(rows.map((row) => [row.restaurant.id, row.slice])).toEqual([
      ["r1", 1],
      ["r7", null],
    ]);
  });

  it("카탈로그가 비면 빈 배열이다", () => {
    expect(listTodayRows([T_GIM], [], "")).toEqual([]);
  });
});

describe("findWinnerIndex — id 로만 찾는다 (D-07)", () => {
  it("결과의 restaurant_id 가 목록에 있으면 그 인덱스다", () => {
    expect(findWinnerIndex([T_SALAD, T_GIM], RESULT_GIM)).toBe(1);
  });

  it("restaurant_id 가 null 이면 -1 이다 — 이름으로 되찾지 않는다 (매장 삭제 후·컷오버 전 구 결과)", () => {
    expect(findWinnerIndex([T_SALAD, T_GIM], RESULT_ORPHAN)).toBe(-1);
  });

  it("결과가 null 이면 -1 이다", () => {
    expect(findWinnerIndex([T_SALAD, T_GIM], null)).toBe(-1);
  });

  it("같은 이름의 다른 매장이 목록에 있어도 id 가 다르면 -1 이다", () => {
    expect(findWinnerIndex([{ ...T_GIM, id: "r99" }], RESULT_GIM)).toBe(-1);
  });
});

describe("isNewSpin — 휠을 다시 돌릴지 (D-08, todo in-06)", () => {
  it("이전 결과가 없으면 새 추첨이다", () => {
    expect(isNewSpin(null, RESULT_GIM)).toBe(true);
  });

  it("spun_at 이 다르면 새 추첨이다 (다시 돌리기는 항상 새로 쓴다)", () => {
    expect(isNewSpin(RESULT_GIM, RESULT_RESPUN)).toBe(true);
  });

  it("spun_at 이 같으면 새 추첨이 아니다 — on delete set null 이 내보내는 UPDATE 로 휠이 돌지 않는다", () => {
    expect(isNewSpin(RESULT_GIM, RESULT_ORPHAN)).toBe(false);
  });

  // prev 는 REST 로 읽은 행이고 next 는 Realtime 페이로드다. 직렬화가 갈리면 문자열 비교는 같은 추첨을
  // "새 추첨" 이라 답하고, 매장 하나를 지울 때마다 열린 모든 탭의 휠이 5초씩 돈다(in-06 재발).
  it('같은 순간을 "+09:00" 과 "Z" 로 적어도 같은 추첨이다', () => {
    expect(isNewSpin(RESULT_GIM, { ...RESULT_ORPHAN, spun_at: "2026-09-28T17:55:00Z" })).toBe(false);
  });

  it("소수 초가 붙어도 같은 순간이면 같은 추첨이다", () => {
    expect(isNewSpin(RESULT_GIM, { ...RESULT_ORPHAN, spun_at: "2026-09-28T17:55:00.000+00:00" })).toBe(false);
  });

  // 파싱 불가는 "다르다" 가 아니라 문자열 비교로 떨어뜨린다 — 회전 쪽으로 기울이면 위 재발 경로가 열린다.
  it("파싱할 수 없는 시각이라도 문자열이 같으면 같은 추첨이다", () => {
    const broken = { ...RESULT_GIM, spun_at: "not-a-timestamp" };
    expect(isNewSpin(broken, { ...broken, restaurant_id: null })).toBe(false);
  });

  it("파싱할 수 없는 시각의 문자열이 다르면 새 추첨이다", () => {
    const broken = { ...RESULT_GIM, spun_at: "not-a-timestamp" };
    expect(isNewSpin(broken, { ...broken, spun_at: "also-not-a-timestamp" })).toBe(true);
  });
});

describe("candidatesReducer — 인스턴스 배선 (D-02 · D-03)", () => {
  it("fetched 가 후보 목록을 세운다", () => {
    expect(candidatesReducer(INITIAL_CANDIDATES_STATE, { type: "fetched", rows: [C_GIM, C_MARA], error: null })).toEqual(
      { rows: [C_GIM, C_MARA], loaded: true, error: null, pending: [] },
    );
  });

  it("DELETE 는 restaurant_id 를 키로 지운다 — 이 테이블의 PK 가 그 컬럼이다", () => {
    const live = candidatesReducer(INITIAL_CANDIDATES_STATE, { type: "fetched", rows: [C_GIM, C_MARA], error: null });
    expect(candidatesReducer(live, { type: "changed", event: "DELETE", key: "r1" }).rows).toEqual([C_MARA]);
  });
});
