// 0005 롤백 스크립트의 텍스트 계약. SQL 을 실행하지 않고(로컬 스택 없음) 파일을 파싱해 형태를 고정한다 —
// 0005 spec 과 같은 방식이다. 롤백은 한 번도 리허설되지 않은 채 장애 순간에 처음 실행되는 파일이라,
// "역순인가·재실행 안전한가·데이터를 지우지 않는가" 를 사람이 읽어 확인하는 대신 여기서 센다.
// 주석 제거 사본에서 세는 이유: 한글 Why 주석에 drop table 같은 토큰이 섞이면 원본 grep 이 자기 자신을 센다(Phase 2 결정).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const SQL_PATH = fileURLToPath(new URL("./0005_restaurants_settings.rollback.sql", import.meta.url));
const sql = readFileSync(SQL_PATH, "utf8");
// -- 로 시작하는 줄 전체와 줄 끝 주석을 지운다. $cmd$ 본문에는 주석이 없다는 것이 0005 의 규칙이라 단순 치환으로 충분하다.
const code = sql
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;

describe("0005 롤백 스크립트 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(sql.length).toBeGreaterThan(500);
  });

  it("새 cron 3종(spin-lunch-roulette·reset-candidates·purge-cron-history)을 jobid 루프로 걷어낸다", () => {
    expect(code).toMatch(/jobname in \('spin-lunch-roulette', 'reset-menus', 'reset-candidates', 'purge-cron-history'\)/);
    expect(code).toMatch(/perform cron\.unschedule\(jid\)/);
  });

  it("구 cron 2종만 재등록한다 — spin 11:55 KST 고정, reset-menus 자정", () => {
    expect(count(code, /cron\.schedule\(/g)).toBe(2);
    expect(code).toMatch(/'spin-lunch-roulette',\s*'55 2 \* \* \*'/);
    expect(code).toMatch(/'reset-menus',\s*'0 15 \* \* \*'/);
  });

  it("menus·pinned_menus 를 재생성한다(재실행 안전형)", () => {
    expect(code).toMatch(/create table if not exists public\.menus \(/);
    expect(code).toMatch(/create table if not exists public\.pinned_menus \(/);
  });

  it("구 정책 6개가 drop if exists → create 쌍으로 있다", () => {
    for (const name of ["menus_read", "menus_insert", "menus_delete", "pinned_read", "pinned_insert", "pinned_delete"]) {
      expect(code).toMatch(new RegExp(`drop policy if exists ${name} on public\\.(menus|pinned_menus);\\s*create policy ${name} on`));
    }
    expect(count(code, /create policy /g)).toBe(6);
  });

  it("publication 가드가 두 테이블을 존재 검사 뒤에 넣는다", () => {
    expect(code).toMatch(/array\['menus', 'pinned_menus'\]/);
    expect(code).toMatch(/pg_publication_tables/);
  });

  it("데이터를 지우지 않는다 — drop table·drop column 은 주석 밖에 0건", () => {
    expect(count(code, /drop table/gi)).toBe(0);
    expect(count(code, /drop column/gi)).toBe(0);
    // 파기 블록은 주석으로만 존재해 사람이 의도적으로 풀어야 한다.
    expect(sql).toMatch(/^-- drop table if exists public\.candidates;/m);
  });

  it("menus 재생성이 cron 재등록보다 앞이다 — 구 함수와 reset-menus 가 그 테이블을 읽는다", () => {
    const menusAt = code.indexOf("create table if not exists public.menus (");
    const firstSchedule = code.indexOf("cron.schedule(");
    expect(menusAt).toBeGreaterThan(-1);
    expect(menusAt).toBeLessThan(firstSchedule);
  });

  it("spin 잡이 같은 프로젝트의 spin-roulette 함수를 부른다", () => {
    expect(code).toMatch(/https:\/\/swxiqytyxjlcgubqlozk\.supabase\.co\/functions\/v1\/spin-roulette/);
  });
});
