// lib/ranking.ts 의 계약: 결과 행의 ranking(jsonb) 에서 화면에 보일 예비 순위를 뽑는다.
// jsonb 는 어떤 형태로든 올 수 있다 — 0006 이전 행은 null, 손으로 고친 행은 깨진 원소일 수 있다. 전부 여기서 흡수한다.

import { describe, it, expect } from "vitest";
import { BACKUP_RANKS_SHOWN, backupRanks } from "./ranking";

const r = (id: string, name: string) => ({ restaurant_id: id, name });

describe("backupRanks", () => {
  it("ranking 이 없는 구 행(null·undefined)은 예비가 없다", () => {
    expect(backupRanks(null)).toEqual([]);
    expect(backupRanks(undefined)).toEqual([]);
  });

  it("배열이 아닌 값은 예비가 없다", () => {
    expect(backupRanks("둘째")).toEqual([]);
    expect(backupRanks({ restaurant_id: "a", name: "매장" })).toEqual([]);
    expect(backupRanks(3)).toEqual([]);
  });

  it("1번째는 당첨이라 빼고, 2·3번째를 자리 순위와 함께 돌려준다", () => {
    expect(backupRanks([r("a", "공리"), r("b", "그때그집"), r("c", "논현닭한마리")])).toEqual([
      { rank: 2, name: "그때그집" },
      { rank: 3, name: "논현닭한마리" },
    ]);
  });

  it("후보가 하나면 예비가 없고, 둘이면 2순위 하나다", () => {
    expect(backupRanks([r("a", "공리")])).toEqual([]);
    expect(backupRanks([r("a", "공리"), r("b", "그때그집")])).toEqual([{ rank: 2, name: "그때그집" }]);
  });

  it("상한은 2 — 4번째부터는 보이지 않는다", () => {
    expect(BACKUP_RANKS_SHOWN).toBe(2);
    const five = ["a", "b", "c", "d", "e"].map((id) => r(id, `매장${id}`));
    expect(backupRanks(five).map((b) => b.rank)).toEqual([2, 3]);
  });

  it("상한을 직접 줄 수 있다", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) => r(id, `매장${id}`));
    expect(backupRanks(five, 3).map((b) => b.rank)).toEqual([2, 3, 4]);
    expect(backupRanks(five, 0)).toEqual([]);
  });

  it("깨진 원소는 그 자리만 비우고 순위를 당기지 않는다 — 3순위가 2순위로 둔갑하면 안 된다", () => {
    expect(backupRanks([r("a", "공리"), null, r("c", "논현닭한마리")])).toEqual([{ rank: 3, name: "논현닭한마리" }]);
    expect(backupRanks([r("a", "공리"), { restaurant_id: "b" }, r("c", "논현닭한마리")])).toEqual([
      { rank: 3, name: "논현닭한마리" },
    ]);
    expect(backupRanks([r("a", "공리"), { restaurant_id: "b", name: 7 }, r("c", "논현닭한마리")])).toEqual([
      { rank: 3, name: "논현닭한마리" },
    ]);
  });

  it("매장이 지워져도 이름 스냅샷은 그대로 보인다 — restaurant_id 는 보지 않는다", () => {
    expect(backupRanks([r("a", "공리"), { restaurant_id: null, name: "사라진집" }])).toEqual([
      { rank: 2, name: "사라진집" },
    ]);
  });
});
