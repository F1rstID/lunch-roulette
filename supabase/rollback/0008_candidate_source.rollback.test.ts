// 0008 롤백 스크립트의 텍스트 계약. 롤백은 장애 순간에 처음 실행되므로 "잡을 먼저 되돌리고 컬럼을 나중에 지우는가 ·
// 이 컬럼만 지우는가 · 재실행 안전한가 · 역순(PR 되돌림 → 함수 재배포 → SQL)을 말하는가" 를 사람이 읽기 전에 센다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0008_candidate_source.rollback.sql", import.meta.url));
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0008 롤백 스크립트 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(200);
  });

  it("reset-candidates 잡을 0005 문장(source 없는 insert)으로 되돌린다 — 잡 하나뿐", () => {
    expect(count(/where jobname = 'reset-candidates'/g)).toBe(1);
    expect(count(/cron\.schedule\(\s*'reset-candidates',\s*'0 15 \* \* \*'/g)).toBe(1);
    expect(count(/cron\.schedule\(/g)).toBe(1);
    expect(count(/insert into public\.candidates \(restaurant_id\)\s+select id from public\.restaurants where pinned order by created_at;/g)).toBe(1);
    expect(count(/\(restaurant_id, source\)/g)).toBe(0);
  });

  it("candidates.source 컬럼을 재실행 안전형으로 지운다 — 컬럼 하나뿐", () => {
    expect(count(/alter table public\.candidates\s+drop column if exists source/g)).toBe(1);
    expect(count(/drop column/g)).toBe(1);
  });

  it("잡 재등록이 컬럼 삭제보다 앞이다 — 그 사이 자정이 와도 시드가 빠지지 않는다", () => {
    const schedule = sql.indexOf("cron.schedule(");
    const drop = sql.indexOf("drop column if exists source");
    expect([schedule > 0, drop > 0, schedule < drop]).toEqual([true, true, true]);
  });

  it("다른 것은 건드리지 않는다 — 표 삭제·정책·다른 표·다른 잡", () => {
    expect(count(/drop table/g)).toBe(0);
    expect(count(/policy/g)).toBe(0);
    expect(count(/alter table public\.(restaurants|results|settings|lunch_days)/g)).toBe(0);
    expect(count(/spin-lunch-roulette|purge-cron-history|reset-menus/g)).toBe(0);
  });

  it("적용 역순과 잃는 것을 주석으로 말한다 — 함수 재배포·PR 되돌림이 먼저, 사람이 담은 구분이 사라진다", () => {
    expect(raw).toMatch(/역순/);
    expect(raw).toMatch(/함수/);
    expect(raw).toMatch(/PGRST204/);
    expect(raw).toMatch(/잃는|사라진다/);
  });
});
