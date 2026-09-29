// 쉼표로 여러 메뉴를 한 줄에 적는 입력의 파싱과 길이 절단이 사는 곳.
// 절단 단위가 코드포인트인 이유: DB 의 길이 검사가 같은 단위라, 코드유닛으로 자르면 이모지 하나가 반 토막 난
// 채 저장된다 — 깨진 문자열은 되돌릴 수 없고 결과·기록·랭킹의 이름 스냅샷까지 따라간다.
// 오늘 탭과 매장 탭이 같은 구현 하나를 부르게 해 절단·중복 제거 규칙이 두 벌로 갈리지 않게 한다.
// 이 파일이 생긴 이유: 파싱이 컴포넌트에 살아 있는 동안에는 lib/ 가 components/ 를 가져오는 단방향 규칙의
// 예외가 필요했다(CATL-06). 정의처를 여기로 내리면서 그 예외가 코드에서 사라졌다.
// 순수성이 계약이다 — 데이터 클라이언트·React·환경변수를 값으로 끌어오지 않는다.

import { MENU_NAME_MAX_LEN } from "@/lib/constants";

// 문자열을 코드포인트 배열로 펼친 뒤 앞에서 max 개만 남긴다. String.prototype.slice 는 코드유닛을 세므로
// 대리쌍(이모지) 한가운데를 자를 수 있다.
export function truncateToCodePoints(text: string, max: number): string {
  return Array.from(text).slice(0, max).join("");
}

// 쉼표(반각 , / 전각 ，)로 나눠 여러 메뉴를 한 번에 등록한다.
// trim → 빈 항목 제거 → 항목별 24 코드포인트 상한 → 입력 내 중복 제거 → 이미 있는 메뉴 제외.
// 절단이 중복 판정보다 앞이라는 순서가 계약이다 — 뒤집으면 같은 값으로 잘릴 둘이 따로 남는다.
export function parseMenuInput(input: string, existing: string[]): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  for (const piece of input.split(/[,，]/)) {
    const name = truncateToCodePoints(piece.trim(), MENU_NAME_MAX_LEN);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
