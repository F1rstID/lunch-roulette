// 후보 순서를 정하는 순수 함수. Deno(추첨 함수 2종)와 클라이언트가 같은 파일을 본다.
// 이 파일은 아무것도 import 하지 않는다 — _shared 의 다른 세 모듈과 같은 계약이다
// (Deno 는 .ts 확장자를 요구하고 tsc 는 거부하므로, 서로 import 하는 순간 한쪽이 깨진다).
//
// 왜 당첨 하나가 아니라 순서 전체를 정하는가: 당첨 매장에 웨이팅이 걸리면 팀은 다른 곳으로 간다.
// 그때 갈 곳이 추첨 시각에 이미 정해져 있어야 "마음에 들 때까지 다시 뽑기" 가 되지 않는다.
// 1번째 원소가 당첨이라는 뜻은 호출부가 부여한다 — 이 파일은 순열만 돌려준다.

export type RankedEntry = { restaurant_id: string; name: string };

// Fisher-Yates. 난수를 주입받는 이유는 테스트다 — Math.random 을 직접 부르면 순서를 단언할 수 없다.
// 뒤에서 앞으로 돌며 j ∈ [0, i] 를 뽑는 표준형이라, random 이 항상 1 에 가까우면 순서가 그대로이고
// 항상 0 이면 결정된 순서가 나온다(spec 이 그 두 값을 고정한다). 입력은 복사해 바꾸지 않는다.
export function rankCandidates(pool: readonly RankedEntry[], random: () => number = Math.random): RankedEntry[] {
  const ranked = pool.slice();
  for (let i = ranked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = ranked[i];
    ranked[i] = ranked[j];
    ranked[j] = tmp;
  }
  return ranked;
}
