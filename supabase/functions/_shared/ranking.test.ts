// _shared/ranking.ts 의 계약: 후보 순서를 정하는 셔플이 결정적으로 검사된다(난수 주입), 입력을 바꾸지 않는다,
// 원소를 잃거나 만들지 않는다. 1번째 원소가 당첨이라는 뜻은 호출부(두 Edge Function)가 부여한다.

import { describe, it, expect } from "vitest";
import { rankCandidates, type RankedEntry } from "./ranking";

const entry = (id: string): RankedEntry => ({ restaurant_id: id, name: `매장 ${id}` });
const pool = [entry("a"), entry("b"), entry("c"), entry("d")];

// 고정 수열을 돌려주는 난수. 수열이 바닥나면 마지막 값을 반복한다.
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("rankCandidates", () => {
  it("빈 후보는 빈 순위다", () => {
    expect(rankCandidates([], () => 0.5)).toEqual([]);
  });

  it("후보 하나는 그대로 1순위다", () => {
    expect(rankCandidates([entry("a")], () => 0.5)).toEqual([entry("a")]);
  });

  it("난수가 항상 상한 직전이면 순서가 바뀌지 않는다 — Fisher-Yates 에서 j = i", () => {
    expect(rankCandidates(pool, () => 0.999999)).toEqual(pool);
  });

  it("난수가 항상 0 이면 정해진 순서가 나온다 — 알고리즘이 바뀌면 이 값이 바뀐다", () => {
    // i=3: swap(3,0) → d b c a / i=2: swap(2,0) → c b d a / i=1: swap(1,0) → b c d a
    expect(rankCandidates(pool, () => 0).map((e) => e.restaurant_id)).toEqual(["b", "c", "d", "a"]);
  });

  it("주입한 수열대로 결정적이다 — 수열 [0.1, 0.7, 0.3] 의 결과를 고정한다", () => {
    // i=3: j=floor(0.1*4)=0 → d b c a / i=2: j=floor(0.7*3)=2 → 그대로 / i=1: j=floor(0.3*2)=0 → b d c a
    expect(rankCandidates(pool, sequence([0.1, 0.7, 0.3])).map((e) => e.restaurant_id)).toEqual(["b", "d", "c", "a"]);
  });

  it("원소를 잃거나 만들지 않는다 — 같은 집합의 순열이다", () => {
    const ranked = rankCandidates(pool, sequence([0.9, 0.2, 0.6]));
    expect(ranked).toHaveLength(pool.length);
    expect(new Set(ranked.map((e) => e.restaurant_id))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const copy = pool.map((e) => ({ ...e }));
    rankCandidates(pool, () => 0);
    expect(pool).toEqual(copy);
  });

  it("기본 난수(crypto)로도 같은 집합의 순열을 돌려준다", () => {
    const ranked = rankCandidates(pool);
    expect(new Set(ranked.map((e) => e.restaurant_id))).toEqual(new Set(["a", "b", "c", "d"]));
  });
});
