// 0006 롤백 스크립트의 텍스트 계약. 컬럼 하나를 되돌리는 파일이지만, 롤백은 장애 순간에 처음 실행되므로
// "이 컬럼만 지우는가 · 재실행 안전한가 · 데이터 손실을 숨기지 않는가" 를 사람이 읽기 전에 여기서 센다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0006_results_ranking.rollback.sql", import.meta.url));
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0006 롤백 스크립트 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(150);
  });

  it("ranking 컬럼만 재실행 안전형으로 지운다", () => {
    expect(sql).toMatch(/alter table public\.results\s+drop column if exists ranking/);
    expect(count(/drop column/g)).toBe(1);
  });

  it("다른 것은 건드리지 않는다 — 테이블·cron·정책·당첨 컬럼", () => {
    expect(count(/drop table/g)).toBe(0);
    expect(count(/cron\./g)).toBe(0);
    expect(count(/policy/g)).toBe(0);
    expect(count(/\bmenu\b|restaurant_id|candidates/g)).toBe(0);
  });

  it("순위 데이터가 사라진다는 사실을 주석으로 말한다", () => {
    expect(raw).toMatch(/순위/);
    expect(raw).toMatch(/사라진다|잃는다|지워진다/);
  });
});
