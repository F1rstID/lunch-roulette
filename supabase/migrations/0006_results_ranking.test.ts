// 0006 마이그레이션의 텍스트 계약. 로컬 Supabase 스택이 없어 SQL 을 실행하지 못하므로(0005 와 같은 사정)
// "파일에 무엇이 쓰여 있는가" 를 센다. 이 파일이 지키는 것은 셋이다: 컬럼 추가뿐이라 구 코드·구 행에 영향이
// 없을 것, 재실행 안전형일 것, 배열 아닌 값을 DB 가 거부할 것.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0006_results_ranking.sql", import.meta.url));
// 한글 Why 주석에 'drop' 같은 토큰이 섞여도 세지 않게 줄 주석을 지운 사본에서 센다.
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0006 결과 순위 컬럼 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(200);
  });

  it("results 에 jsonb 컬럼 ranking 을 재실행 안전형으로 더한다", () => {
    expect(sql).toMatch(/alter table public\.results\s+add column if not exists ranking jsonb/);
  });

  it("배열이 아닌 값은 거부한다 — 화면은 배열만 읽는다", () => {
    expect(sql).toMatch(/jsonb_typeof\(ranking\) = 'array'/);
    // null 은 허용해야 구 행과 구 함수가 그대로 산다.
    expect(sql).toMatch(/ranking is null or/);
  });

  it("제약 추가는 재실행 안전형이다 — add constraint 에는 if not exists 가 없어 존재 검사로 감싼다", () => {
    expect(sql).toMatch(/pg_constraint/);
    expect(count(/add constraint results_ranking_is_array/g)).toBe(1);
  });

  it("컬럼의 뜻을 DB 에 남긴다 — 1번째가 당첨이라는 규칙은 코드 밖에서도 읽혀야 한다", () => {
    expect(raw).toMatch(/comment on column public\.results\.ranking/);
    expect(raw).toMatch(/1번째/);
  });

  it("추가만 한다 — 삭제·변경·cron·정책을 건드리지 않는다", () => {
    expect(count(/drop /g)).toBe(0);
    expect(count(/alter column/g)).toBe(0);
    expect(count(/cron\./g)).toBe(0);
    expect(count(/create policy/g)).toBe(0);
  });
});
