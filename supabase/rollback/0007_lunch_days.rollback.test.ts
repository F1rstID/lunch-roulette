// 0007 롤백 스크립트의 텍스트 계약. 롤백은 장애 순간에 처음 실행되므로 "이 표·이 컬럼만 지우는가 · 재실행
// 안전한가 · 데이터 손실을 숨기지 않는가 · 역순(PR 되돌림 → 함수 재배포 → SQL)을 말하는가" 를 사람이 읽기 전에 센다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0007_lunch_days.rollback.sql", import.meta.url));
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0007 롤백 스크립트 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(200);
  });

  it("lunch_days 표를 재실행 안전형으로 지운다 — 표 하나뿐", () => {
    expect(count(/drop table if exists public\.lunch_days/g)).toBe(1);
    expect(count(/drop table/g)).toBe(1);
  });

  it("restaurants.paused_week 컬럼을 재실행 안전형으로 지운다 — 컬럼 하나뿐", () => {
    expect(count(/alter table public\.restaurants\s+drop column if exists paused_week/g)).toBe(1);
    expect(count(/drop column/g)).toBe(1);
  });

  it("트리거 함수를 따로 지운다 — 표와 함께 떨어지는 것은 트리거뿐이고 함수는 남는다", () => {
    expect(count(/drop function if exists public\.lunch_days_stamp\(\)/g)).toBe(1);
    expect(count(/drop function/g)).toBe(1);
  });

  it("cooldown_days 의 comment 를 0005 문구로 되돌린다 — 컬럼은 애초에 건드리지 않았다", () => {
    expect(raw).toMatch(/comment on column public\.settings\.cooldown_days/);
    expect(raw).toMatch(/최근 N일/);
  });

  it("다른 것은 건드리지 않는다 — cron·정책·results·candidates·settings 컬럼", () => {
    expect(count(/cron\./g)).toBe(0);
    expect(count(/policy/g)).toBe(0);
    expect(count(/\bresults\b|\bcandidates\b/g)).toBe(0);
    expect(count(/alter table public\.settings/g)).toBe(0);
  });

  it("기록·쉬기 데이터가 사라진다는 사실과 적용 역순을 주석으로 말한다", () => {
    expect(raw).toMatch(/사라진다|잃는다|지워진다/);
    expect(raw).toMatch(/역순/);
    expect(raw).toMatch(/함수/);
  });
});
