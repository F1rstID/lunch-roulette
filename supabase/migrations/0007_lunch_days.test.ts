// 0007 마이그레이션의 텍스트 계약. 로컬 Supabase 스택이 없어 SQL 을 실행하지 못하므로(0005·0006 과 같은 사정)
// "파일에 무엇이 쓰여 있는가" 를 센다. 이 파일이 지키는 것은 넷이다: 추가만 해서 구 코드·구 행에 영향이 없을 것,
// 재실행 안전형일 것, lunch_days 의 모양(날짜 PK·방문 상태 3값·FK set null)이 코드의 가정과 같을 것,
// 쓰기 권한이 anon select/insert/update 까지만 열리고 delete 는 열리지 않을 것.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0007_lunch_days.sql", import.meta.url));
// 한글 Why 주석에 'drop' 같은 토큰이 섞여도 세지 않게 줄 주석을 지운 사본에서 센다.
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0007 주간 점심 기록 — lunch_days 표 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(500);
  });

  it("lunch_days 를 재실행 안전형으로 만든다 — 하루 한 행이라 date 가 PK 다", () => {
    expect(count(/create table if not exists public\.lunch_days/g)).toBe(1);
    expect(sql).toMatch(/date date primary key/);
  });

  it("방문 상태는 unknown·visited·skipped 셋뿐이고 기본은 unknown 이다", () => {
    expect(sql).toMatch(/visit_status text not null default 'unknown'/);
    expect(sql).toMatch(/check \(visit_status in \('unknown', ?'visited', ?'skipped'\)\)/);
  });

  it("목적지·방문 매장은 FK set null 이다 — 매장을 지워도 그날 기록(이름 스냅샷)은 남는다", () => {
    expect(count(/references public\.restaurants\(id\) on delete set null/g)).toBe(2);
    expect(sql).toMatch(/destination_name text/);
    expect(sql).toMatch(/visited_name text/);
  });

  it("시각 컬럼 셋 — 목적지 설정 시각(stale 판정)·방문 시각·갱신 시각", () => {
    expect(sql).toMatch(/destination_set_at timestamptz/);
    expect(sql).toMatch(/visited_at timestamptz/);
    expect(sql).toMatch(/updated_at timestamptz not null default now\(\)/);
  });
});

describe("0007 — 권한은 anon 읽기·쓰기·고치기까지만 열린다", () => {
  it("RLS 를 켠다", () => {
    expect(count(/alter table public\.lunch_days enable row level security/g)).toBe(1);
  });

  it("정책은 drop→create 쌍 셋(read·insert·update)이고 delete 정책은 만들지 않는다 — 되돌리기는 null 로 update 다", () => {
    for (const name of ["lunch_days_read", "lunch_days_insert", "lunch_days_update"]) {
      expect(count(new RegExp(`drop policy if exists ${name} on public\\.lunch_days`, "g"))).toBe(1);
      expect(count(new RegExp(`create policy ${name} on public\\.lunch_days`, "g"))).toBe(1);
    }
    expect(count(/lunch_days_delete/g)).toBe(0);
    expect(count(/for delete/g)).toBe(0);
    expect(count(/create policy/g)).toBe(3);
  });

  it("settings·results 에는 정책을 더하지 않는다 — settings 쓰기 정책은 이 레포에서 가장 위험한 변경이다", () => {
    expect(count(/create policy \w+ on public\.(settings|results)/g)).toBe(0);
  });

  it("Realtime publication 에 lunch_days 를 존재 검사로 더한다(0005 루프 재사용)", () => {
    expect(sql).toMatch(/foreach t in array array\['lunch_days'\]/);
    expect(sql).toMatch(/pg_publication_tables/);
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.%I/);
  });
});

describe("0007 — 매장 쉬기 컬럼과 쿨다운 폐기", () => {
  it("restaurants.paused_week 를 재실행 안전형으로 더한다 — 그 주 월요일 날짜, null 이면 쉬지 않음", () => {
    expect(count(/alter table public\.restaurants\s+add column if not exists paused_week date/g)).toBe(1);
    expect(raw).toMatch(/comment on column public\.restaurants\.paused_week/);
    expect(raw).toMatch(/월요일/);
  });

  it("settings.cooldown_days 는 컬럼을 남기되 미사용임을 comment 로 적는다 — 제거는 다음 마이그레이션", () => {
    expect(raw).toMatch(/comment on column public\.settings\.cooldown_days/);
    expect(raw).toMatch(/미사용/);
    expect(count(/drop column/g)).toBe(0);
  });

  it("표의 뜻을 DB 에 남긴다 — 목적지가 비면 1순위, 방문이 unknown 이면 확인 안 됨", () => {
    expect(raw).toMatch(/comment on table public\.lunch_days/);
    expect(raw).toMatch(/1순위/);
    expect(raw).toMatch(/확인 안 됨/);
  });

  it("추가만 한다 — drop(정책 교체 제외)·cron·settings 쓰기를 건드리지 않는다", () => {
    expect(count(/drop (?!policy if exists)/g)).toBe(0);
    expect(count(/drop table/g)).toBe(0);
    expect(count(/cron\./g)).toBe(0);
    expect(count(/alter column/g)).toBe(0);
  });
});
