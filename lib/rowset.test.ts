// lib/rowset.ts 의 목록 병합 계약을 고정한다 — 키만 다른 두 목록(매장 카탈로그·오늘 후보)이 공유하는 규칙이다.
// 기대값과 행 픽스처를 이 파일 안에서 리터럴로 만드는 이유: 도메인 타입을 하나도 끌어오지 않아야 "키가
// 주입되면 어떤 행에도 성립한다" 는 제네릭의 계약이 spec 에서 눈에 보인다(행 타입이 사는 모듈은 로드 시점에
// 환경변수를 읽으므로 spec 이 묶이면 러너에서 즉사한다는 이유도 그대로다).
// lib/restaurants.test.ts 의 리듀서 spec 과 의도적으로 겹친다 — 여기는 병합 규칙 자체를, 저기는 그 인스턴스의
// 배선(키가 id 라는 사실)을 고정한다. 중복으로 보고 한쪽을 지우면 남은 쪽이 다른 쪽의 회귀를 잡지 못한다.
// 일부러 안 하는 것: 훅은 테스트하지 않는다 — 레포에 렌더 하네스가 없고, 훅에 분기를 남기지 않는 것이 이 모듈의 존재 이유다.

import { describe, it, expect } from "vitest";
import { createRowSetReducer, initialRowSetState } from "@/lib/rowset";

// 이 파일 전용 행 구조체. 키 이름이 id 인 쪽과 그렇지 않은 쪽을 둘 다 두어 주입이 실제로 쓰이는지 본다.
type Labeled = { id: string; label: string };
type Keyed = { restaurant_id: string; created_at: string };

const A: Labeled = { id: "a1", label: "가" };
// A 와 같은 키의 새 행. UPDATE 가 얕은 병합이 아니라 통째 교체라는 것을 보이는 데 쓴다.
const A_NEXT: Labeled = { id: "a1", label: "가나다" };
const B: Labeled = { id: "b1", label: "나" };
const K1: Keyed = { restaurant_id: "r1", created_at: "2026-09-29T03:00:00+09:00" };

const reduce = createRowSetReducer((row: Labeled) => row.id);
const EMPTY = initialRowSetState<Labeled>();

describe("createRowSetReducer — fetched 경로 (D-04)", () => {
  it("fetched 에 rows 가 실리면 목록을 세우고 로드 완료로 표시한다", () => {
    expect(reduce(EMPTY, { type: "fetched", rows: [A, B], error: null })).toEqual({
      rows: [A, B],
      loaded: true,
      error: null,
      pending: [],
    });
  });

  it("fetched 에 error 가 있으면 rows 가 함께 와도 실패 경로다 (행이 왔으니 성공으로 읽지 않는다)", () => {
    expect(reduce(EMPTY, { type: "fetched", rows: [A], error: { message: "boom" } })).toEqual({
      rows: [],
      loaded: true,
      error: "boom",
      pending: [],
    });
  });

  it("fetched 의 rows 가 null 이고 error 도 없으면 빈 목록으로 로드 완료다 (0행은 실패가 아니다)", () => {
    expect(reduce(EMPTY, { type: "fetched", rows: null, error: null })).toEqual({
      rows: [],
      loaded: true,
      error: null,
      pending: [],
    });
  });

  it("이미 로드가 끝난 상태에 온 두 번째 fetched 는 무시된다 (중복 응답)", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A], error: null });
    expect(reduce(live, { type: "fetched", rows: [B], error: null })).toBe(live);
  });

  it("실패로 로드가 끝난 상태에 온 두 번째 fetched 도 무시된다", () => {
    const failed = reduce(EMPTY, { type: "fetched", rows: null, error: { message: "boom" } });
    expect(reduce(failed, { type: "fetched", rows: [A], error: null })).toBe(failed);
  });
});

describe("createRowSetReducer — changed 병합 (D-05)", () => {
  it("INSERT 가 행을 더한다", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A], error: null });
    expect(reduce(live, { type: "changed", event: "INSERT", row: B }).rows).toEqual([A, B]);
  });

  it("같은 key 의 INSERT 가 한 번 더 와도 목록 길이가 그대로다 (멱등)", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A], error: null });
    expect(reduce(live, { type: "changed", event: "INSERT", row: A }).rows).toEqual([A]);
  });

  it("UPDATE 는 같은 key 의 행을 통째로 교체한다 (얕은 병합이 아니다)", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A], error: null });
    expect(reduce(live, { type: "changed", event: "UPDATE", row: A_NEXT }).rows).toEqual([A_NEXT]);
  });

  it("모르는 key 의 UPDATE 는 행을 추가한다 (upsert — 재연결 틈에 놓친 INSERT 를 복구한다)", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A], error: null });
    expect(reduce(live, { type: "changed", event: "UPDATE", row: B }).rows).toEqual([A, B]);
  });

  it("DELETE 가 key 로 그 행을 지운다", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A, B], error: null });
    expect(reduce(live, { type: "changed", event: "DELETE", key: "a1" }).rows).toEqual([B]);
  });

  it("key 가 null 인 DELETE 는 아무 행도 지우지 않는다 (무엇을 지울지 알 수 없다)", () => {
    const live = reduce(EMPTY, { type: "fetched", rows: [A, B], error: null });
    expect(reduce(live, { type: "changed", event: "DELETE", key: null }).rows).toEqual([A, B]);
  });
});

// 훅은 초기 조회와 구독을 동시에 띄우므로 남의 이벤트가 조회 응답보다 먼저 도착하는 창이 매 마운트마다 열린다.
// 그 창에서 이벤트를 곧바로 적용하고 로드 완료를 올리면 뒤이어 온 조회 응답이 "늦게 온 옛 값" 으로 버려져
// 목록이 이벤트에 실린 한 행으로 쪼그라든다(05-REVIEW CR-01). 아래 세 건이 그 순서를 고정한다.
describe("createRowSetReducer — 조회보다 먼저 온 이벤트와 주입된 키 (CR-01 · D-03)", () => {
  it("로드 전 이벤트는 즉시 적용되지도 버려지지도 않고 조회 결과 위에 도착 순서대로 재적용된다", () => {
    const inserted = reduce(EMPTY, { type: "changed", event: "INSERT", row: B });
    const deleted = reduce(inserted, { type: "changed", event: "DELETE", key: "b1" });
    const merged = reduce(deleted, { type: "fetched", rows: [A], error: null });
    // 순서를 지켜야 "INSERT 뒤 DELETE" 가 뒤집혀 지워진 행이 되살아나지 않는다.
    expect([deleted.rows, deleted.loaded, merged.rows, merged.pending]).toEqual([[], false, [A], []]);
  });

  it("로드 전 이벤트가 쌓여 있어도 fetched(error) 는 배너를 세우고 버퍼를 버린다 (반쪽 목록이 정상처럼 보이지 않게)", () => {
    const early = reduce(EMPTY, { type: "changed", event: "INSERT", row: B });
    expect(reduce(early, { type: "fetched", rows: null, error: { message: "boom" } })).toEqual({
      rows: [],
      loaded: true,
      error: "boom",
      pending: [],
    });
  });

  it("주입한 키가 그대로 쓰인다 — restaurant_id 를 키로 만든 인스턴스가 그 필드로 DELETE 를 처리한다", () => {
    const byRestaurant = createRowSetReducer((row: Keyed) => row.restaurant_id);
    const live = byRestaurant(initialRowSetState<Keyed>(), { type: "fetched", rows: [K1], error: null });
    expect(byRestaurant(live, { type: "changed", event: "DELETE", key: "r1" }).rows).toEqual([]);
  });
});
