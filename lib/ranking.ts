// 결과 행의 순위(jsonb)에서 화면에 보일 예비 순위를 뽑는 판단(순수). 결과 카드와 기록 상세가 같은 함수를 쓴다.
// 이 파일은 React·supabase 를 끌어오지 않는다 — `lib/supabase/client.ts` 에서는 타입만 가져온다.
//
// 입력을 unknown 으로 받는 이유: jsonb 는 타입 검사를 받지 않고 들어온다. 0006 이전 행은 null 이고,
// 사람이 SQL Editor 에서 고친 행은 어떤 모양이든 될 수 있다. 화면이 그 모양에 기대면 과거 행 하나가 페이지를 깨뜨린다.

export type BackupRank = { rank: number; name: string };

// 당첨 아래에 보이는 예비 수. 2순위·3순위면 웨이팅 한 번을 피하기에 충분하고, 그 아래는 소음이다(Codex 상담 2026-10-06).
export const BACKUP_RANKS_SHOWN = 2;

function nameOf(entry: unknown): string | null {
  if (typeof entry !== "object" || entry === null || !("name" in entry)) return null;
  return typeof entry.name === "string" ? entry.name : null;
}

// 1번째는 당첨이라 뺀다. 순위는 배열의 자리다 — 깨진 원소를 건너뛰며 당기면 3순위가 2순위로 둔갑하므로,
// 그 자리만 비운다. 매장이 지워져도 이름 스냅샷은 그대로 보인다(restaurant_id 는 보지 않는다).
export function backupRanks(ranking: unknown, max: number = BACKUP_RANKS_SHOWN): BackupRank[] {
  if (!Array.isArray(ranking)) return [];
  const backups: BackupRank[] = [];
  for (let index = 1; index < ranking.length && index <= max; index++) {
    const name = nameOf(ranking[index]);
    if (name !== null) backups.push({ rank: index + 1, name });
  }
  return backups;
}
