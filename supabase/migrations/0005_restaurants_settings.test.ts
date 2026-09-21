// 0005 컷오버 마이그레이션의 계약을 파일 텍스트로 못 박는다. 이 페이즈에는 로컬 Supabase 스택이 없어
// SQL 을 실행해 볼 수 없다 — 그래서 "실행 결과"가 아니라 "파일에 무엇이 쓰여 있는가"가 유일한 검증 대상이다.
// 기대 컬럼 목록을 리터럴 배열로 적고 lib/supabase/client.ts 나 SQL 에서 가져오지 않는 이유: 양쪽이 같이 움직이면
// "SQL 과 TS 가 각자 따로 바뀌는 것을 붙잡는다"는 이 스펙의 존재 이유가 사라진다 (components/MenuList.test.ts:3-4 와 같은 논증).
// client.ts 를 import 하지 않고 텍스트로 읽는 이유: 그 모듈은 로드 시점에 NEXT_PUBLIC_SUPABASE_* 를 읽어 테스트를 환경변수에 묶는다.
// 주석 제거 사본(sql)과 원본(rawSql)을 둘 다 드는 이유: 문 개수는 한글 주석에 섞인 같은 토큰까지 세면 안 되고,
// 반대로 낭독 리뷰용 주석(동작 불변·치환·재회전)의 존재 여부는 원본에서만 확인할 수 있다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// RED 단계에는 검사 대상 .sql 이 아직 없다. 예외를 그대로 던지면 vitest 가 모듈 로드 실패("Failed to load")로
// 수집 자체를 접어 버려서, "무엇이 왜 없는지"가 단언 실패로 드러나지 않는다 — TDD 게이트가 성립하지 않는다.
function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

// 줄 주석(-- / //) 뒤를 잘라낸다. 한글 Why 주석에 'create policy' 같은 토큰이 섞이면 개수 단언이 통째로 무력화된다.
function stripAfter(line: string, marker: string): string {
  const at = line.indexOf(marker);
  return at === -1 ? line : line.slice(0, at);
}

function stripComments(source: string, marker: string): string {
  return source
    .split("\n")
    .map((line) => stripAfter(line, marker))
    .join("\n");
}

function count(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

// 제약 전용 줄은 컬럼이 아니다. 인라인 제약(check/unique)은 컬럼 줄 안쪽에 있어 여기 걸리지 않는다.
const CONSTRAINT_KEYWORDS = ["check", "constraint", "primary", "unique", "foreign", "exclude"];

// openMarker 다음부터 줄 맨 앞 closeMarker 전까지의 줄들. ResultRow.candidates 처럼 중첩 중괄호가 있어
// [^}]* 슬라이스는 쓸 수 없다 — 줄 맨 앞 종료 표지만 믿는다.
function blockLines(source: string, openMarker: string, closeMarker: string): string[] {
  const start = source.indexOf(openMarker);
  if (start === -1) return [];
  const body = source.slice(start + openMarker.length);
  const end = body.indexOf("\n" + closeMarker);
  if (end === -1) return [];
  return body.slice(0, end).split("\n");
}

// 주석을 지운 뒤 빈 줄을 반드시 건너뛴다 — 건너뛰지 않으면 빈 문자열 원소가 섞여 컬럼 목록 비교가 거짓 실패한다.
function tableColumns(source: string, table: string): string[] {
  return blockLines(source, `create table if not exists public.${table} (`, ");")
    .map((line) => stripAfter(line, "--").trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(/[\s(,]/)[0])
    .filter((token) => token.length > 0 && !CONSTRAINT_KEYWORDS.includes(token));
}

function typeFields(source: string, typeName: string): string[] {
  return blockLines(source, `export type ${typeName} = {`, "};")
    .map((line) => stripAfter(line, "//").trim())
    .filter((line) => line.length > 0)
    .map((line) => /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line)?.[1] ?? "")
    .filter((name) => name.length > 0 && !CONSTRAINT_KEYWORDS.includes(name));
}

// "<테이블>.<정책이름>" 쌍으로 정규화한다. 개수가 아니라 이름 집합을 비교해야 drop/create 짝이 어긋난 파일을 잡는다.
function policyPairs(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern))
    .map((match) => `${match[2]}.${match[1]}`)
    .sort();
}

const rawSql = readOrEmpty(new URL("./0005_restaurants_settings.sql", import.meta.url));
const sql = stripComments(rawSql, "--");
const clientSrc = readOrEmpty(new URL("../../lib/supabase/client.ts", import.meta.url));

const RESTAURANT_COLUMNS = ["id", "name", "menus", "location", "pinned", "created_at"];
const CANDIDATE_COLUMNS = ["restaurant_id", "created_at"];
const SETTINGS_COLUMNS = ["id", "spin_time", "cooldown_days", "history_since"];
const RESULT_ROW_FIELDS = ["id", "date", "menu", "candidates", "spun_at", "restaurant_id"];

describe("SQL/SHIP-01 — 모든 문이 재실행 안전형이다", () => {
  it("마이그레이션 파일이 존재한다 (#1)", () => {
    expect(rawSql.length).toBeGreaterThan(0);
  });

  it("create table 이 3건이고 전부 if not exists 형이다 (#2)", () => {
    expect([count(sql, /create table/g), count(sql, /create table if not exists/g)]).toEqual([3, 3]);
  });

  it("create index 가 2건이고 전부 이름 있는 if not exists 형이다 (#3)", () => {
    expect(count(sql, /create index if not exists [a-z_]+_idx on public\./g)).toBe(2);
    // 총 개수까지 같아야 "무명 인덱스 0건"이 성립한다. 한쪽만 세면 무명 인덱스가 섞여도 통과한다.
    expect(count(sql, /create index/g)).toBe(2);
  });

  it("drop policy if exists 와 create policy 가 이름까지 1:1 로 짝을 이룬다 (#4)", () => {
    const dropped = policyPairs(sql, /drop policy if exists ([a-z_]+) on public\.([a-z_]+)/g);
    const created = policyPairs(sql, /create policy ([a-z_]+) on public\.([a-z_]+)/g);
    expect([dropped.length, created.length]).toEqual([9, 9]);
    // 개수만 세면 한 정책을 두 번 drop 하고 다른 정책 drop 을 빠뜨린 파일도 통과하는데,
    // 그 파일은 2회차 실행에서 policy already exists 로 끊긴다 (재실행 안전성의 구멍).
    expect(dropped).toEqual(created);
  });

  it("cron 잡 제거가 이름 인자가 아니라 jobid 루프다 (#5)", () => {
    expect(count(sql, /cron\.unschedule\('/g)).toBe(0);
    expect(count(sql, /perform cron\.unschedule\(jid\)/g)).toBe(1);
  });

  it("publication 추가가 맨 alter 가 아니라 pg_publication_tables 가드 안에 있다 (#6)", () => {
    // ^ 만 쓰면 들여쓴 맨 alter 문을 놓친다(뮤테이션으로 확인). 가드 안의 execute format( 문자열은
    // 'alter publication 으로 시작해 따옴표가 앞에 붙으므로 ^\s* 로도 여전히 매치되지 않는다.
    expect(count(sql, /^\s*alter publication/gm)).toBe(0);
    expect(count(sql, /pg_publication_tables/g)).toBeGreaterThan(0);
  });

  it("settings seed 가 on conflict do nothing 형이다 (#7)", () => {
    expect(count(sql, /insert into public\.settings \(id\) values \(1\) on conflict \(id\) do nothing/g)).toBe(1);
  });

  it("create extension 을 다시 선언하지 않는다 (#8)", () => {
    expect(count(sql, /create extension/g)).toBe(0);
  });

  it("publication 가드의 대상이 세 테이블 전부다 (#43)", () => {
    // 개수만 세는 #6 으로는 못 잡는다 — 하나가 빠져도 가드는 1건 그대로이고,
    // 증상은 Phase 5~7 에서 "그 테이블만 Realtime 이벤트가 0건"으로 늦게 드러난다.
    const literal = /array\[([^\]]*)\]/.exec(sql)?.[1] ?? "";
    const targets = literal
      .split(",")
      .map((item) => item.trim().replace(/'/g, ""))
      .filter((item) => item.length > 0);
    expect(targets).toEqual(["restaurants", "candidates", "settings"]);
  });
});

describe("SQL/SHIP-01 — 구 테이블 제거가 파일의 마지막 단계다", () => {
  it("drop table if exists 가 2건이다 (#9)", () => {
    expect(count(sql, /drop table if exists/g)).toBe(2);
  });

  it("구 테이블 제거가 테이블·정책·cron 등록보다 뒤에 있다 (#10)", () => {
    const lastDrop = sql.lastIndexOf("drop table");
    const lastSetup = Math.max(
      sql.lastIndexOf("create table"),
      sql.lastIndexOf("create policy"),
      sql.lastIndexOf("cron.schedule"),
    );
    expect(lastDrop > lastSetup).toBe(true);
  });
});

describe("SQL/SETT-01 — settings 는 anon 읽기 전용이다", () => {
  it("새 테이블 3개가 전부 RLS 활성이다 (#11)", () => {
    expect(count(sql, /enable row level security/g)).toBe(3);
  });

  it("settings 에 select 정책이 1건 있다 (#12)", () => {
    expect(count(sql, /create policy settings_read on public\.settings for select/g)).toBe(1);
  });

  it("settings 에 쓰기 정책이 0건이다 (#13)", () => {
    // 정책 부재 = 기본 거부. 이 페이즈 최대 보안 리스크(settings_write 추가)의 회귀 가드다.
    // 세 동사만 세면 for all 과 for 절 생략(= 기본 ALL)이 통과한다. 지금은 #4 의 [9, 9] 가 우연히 막아 주지만
    // 누가 그 숫자를 [10, 10] 으로 "고치는" 순간 구멍이 열린다 — 정책 총수를 1 로 못 박아 자기 완결적으로 만든다.
    expect(count(sql, /create policy [a-z_]+ on public\.settings\b/g)).toBe(1);
    expect(count(sql, /on public\.settings for (insert|update|delete|all)/g)).toBe(0);
  });
});

describe("SQL/CATL-07 — 매장 이름은 DB 가 중복을 막는다", () => {
  it("restaurants.name 에 unique 가 걸려 있다 (#14)", () => {
    expect(count(sql, /^\s*name text not null unique\b/gm)).toBe(1);
  });

  it("restaurants.name 길이 제한이 1~24자다 (#15)", () => {
    expect(count(sql, /char_length\(name\) between 1 and 24/g)).toBe(1);
  });
});

describe("SQL/CAND-04 — 자정 리셋이 Realtime DELETE 를 낸다", () => {
  it("전체 삭제문 키워드가 파일에 0건이다 (#16)", () => {
    expect(count(sql, /truncate/gi)).toBe(0);
  });

  it("cron.schedule 이 3건이다 (#17)", () => {
    expect(count(sql, /cron\.schedule\(/g)).toBe(3);
  });

  it("reset-candidates 잡이 KST 자정에 등록된다 (#18)", () => {
    expect(count(sql, /cron\.schedule\(\s*'reset-candidates',\s*'0 15 \* \* \*'/g)).toBe(1);
  });

  it("자정 리셋 본문이 행 단위 delete 다 (#19)", () => {
    expect(count(sql, /delete from public\.candidates/g)).toBe(1);
  });

  it("자정 리셋이 핀 매장을 다시 시드한다 (#20)", () => {
    expect(count(sql, /insert into public\.candidates \(restaurant_id\)/g)).toBe(1);
    expect(count(sql, /select id from public\.restaurants where pinned/g)).toBe(1);
  });

  it("구 잡 이름 reset-menus 가 제거 목록에 있다 (#21)", () => {
    expect(count(sql, /'reset-menus'/g)).toBe(1);
  });

  it("purge-cron-history 잡이 실행 이력을 정리한다 (#22)", () => {
    expect(count(sql, /cron\.schedule\(\s*'purge-cron-history'/g)).toBe(1);
    expect(count(sql, /cron\.job_run_details/g)).toBe(1);
  });
});

describe("SQL/HIST-03 — 기존 results 는 손대지 않는다", () => {
  it("public.results 등장이 정확히 1건이다 (#23)", () => {
    expect(count(sql, /public\.results/g)).toBe(1);
  });

  it("그 1건이 restaurant_id 컬럼 추가문이다 (#24)", () => {
    expect(
      count(
        sql,
        /alter table public\.results add column if not exists restaurant_id uuid references public\.restaurants\(id\) on delete set null/g,
      ),
    ).toBe(1);
  });

  it("results 를 지우거나 고치거나 떨구지 않는다 (#25)", () => {
    expect([
      count(sql, /delete from public\.results/g),
      count(sql, /update public\.results/g),
      count(sql, /drop table[^;]*results/g),
    ]).toEqual([0, 0, 0]);
  });

  it("매장 삭제가 휠을 다시 돌릴 수 있다는 부작용이 주석에 남아 있다 (#26)", () => {
    expect(count(rawSql, /재회전/g)).toBeGreaterThan(0);
  });
});

describe("SQL/D-05 — 적용 직후 동작이 현재와 같다", () => {
  it("spin_time 기본값이 11:55 다 (#27)", () => {
    expect(count(sql, /spin_time time not null default '11:55'/g)).toBe(1);
  });

  it("cooldown_days 기본값이 0 이고 음수를 막는다 (#28)", () => {
    expect(count(sql, /cooldown_days int not null default 0/g)).toBe(1);
    expect(count(sql, /check \(cooldown_days >= 0\)/g)).toBe(1);
  });

  it("history_since 기본값이 KST 기준 오늘이다 (#29)", () => {
    expect(count(sql, /history_since date not null default \(\(now\(\) at time zone 'Asia\/Seoul'\)::date\)/g)).toBe(1);
  });

  it("추첨 잡이 매분 폴링이다 (#30)", () => {
    expect(count(sql, /cron\.schedule\(\s*'spin-lunch-roulette',\s*'\* \* \* \* \*'/g)).toBe(1);
  });

  it("Edge Function 호출에 타임아웃이 명시돼 있다 (#31)", () => {
    expect(count(sql, /timeout_milliseconds := 5000/g)).toBe(1);
  });

  it("프로젝트 ref 하드코딩 옆에 치환 안내가 있다 (#32)", () => {
    expect([rawSql.includes("swxiqytyxjlcgubqlozk"), rawSql.includes("치환")]).toEqual([true, true]);
  });

  it("파일 머리에 동작 불변 원칙이 적혀 있다 (#33)", () => {
    expect(count(rawSql, /동작 불변/g)).toBeGreaterThan(0);
  });

  it("자정 스케줄 옆에 KST↔UTC 계산식이 적혀 있다 (#34)", () => {
    expect(count(rawSql, /KST 00:00 = UTC 15:00/g)).toBeGreaterThan(0);
  });

  it("settings 가 단일행으로 강제된다 (#44)", () => {
    // 이 제약이 빠지면 2번 행이 생겨 어느 행이 정본인지 알 수 없게 되고, 앱은 .single() 에서 깨진다.
    expect(count(sql, /id int primary key check \(id = 1\)/g)).toBe(1);
  });
});

describe("SQL/D-01·D-02 — 컬럼 정의가 CONTEXT 원문 그대로다", () => {
  it("restaurants.id 가 uuid 기본키다 (#45)", () => {
    expect(count(sql, /id uuid primary key default gen_random_uuid\(\)/g)).toBe(1);
  });

  it("restaurants.menus 가 빈 배열 기본값을 갖는다 (#46)", () => {
    // default '{}' 가 빠지면 null 배열이 들어와 Phase 3 의 RestaurantRow.menus: string[] 전제가 깨진다.
    expect(count(sql, /menus text\[\] not null default '\{\}'/g)).toBe(1);
  });

  it("candidates.restaurant_id 가 기본키이면서 cascade 다 (#47)", () => {
    // 둘이 같은 줄에 함께 있어야 "같은 매장 중복 담기 방지"와 "매장 삭제 시 후보 자동 정리"가 동시에 성립한다.
    expect(count(sql, /restaurant_id uuid primary key references public\.restaurants\(id\) on delete cascade/g)).toBe(1);
  });
});

// D-19(2026-09-21 사용자 승인): anon 이 PostgREST 로 직접 쓰는 컬럼은 DB 가 경계를 잡는다.
// 세 테이블이 Realtime publication 에 있어 거대한 행 하나가 열린 탭 전부로 방송되기 때문이다.
// 숫자(24·30·200)를 리터럴로 적는 이유는 이 파일 머리의 논증과 같다 — Phase 5 의 lib/constants.ts 가
// 같은 숫자를 복제할 때 한쪽만 움직이면 여기서 깨져야 한다.
describe("SQL/D-19 — restaurants 자유 텍스트 컬럼에 DB 상한이 있다", () => {
  it("restaurants.name 이 공백만인 이름과 개행을 막는다 (#48)", () => {
    // char_length 만으로는 '   ' 가 통과한다(드라이런 실측). 개행은 D-01 의 "한 줄" 전제를 깬다.
    expect(count(sql, /btrim\(name\) <> ''/g)).toBe(1);
    expect(count(sql, /position\(E'\\n' in name\) = 0/g)).toBe(1);
  });

  it("restaurants.location 이 200자 상한을 갖고 null 은 허용한다 (#49)", () => {
    expect(count(sql, /location text check \(location is null or char_length\(location\) <= 200\)/g)).toBe(1);
  });

  it("restaurants.menus 원소 수가 30개 이하로 묶여 있다 (#50)", () => {
    expect(count(sql, /cardinality\(menus\) <= 30/g)).toBe(1);
  });

  it("restaurants.menus 에 빈 문자열 원소를 막는다 (#51)", () => {
    // array_position 은 찾지 못하면 null 을 돌려준다. '' 가 없을 때만 is null 이 참이다.
    expect(count(sql, /array_position\(menus, ''\) is null/g)).toBe(1);
  });

  it("menus 원소 길이 상한이 immutable 함수로 구현돼 있다 (#52)", () => {
    // check 제약은 서브쿼리를 허용하지 않아 unnest 를 함수로 감춘다. immutable 이 아니면 제약이 거부되고,
    // create or replace 가 아니면 2회차 실행이 "already exists" 로 끊긴다.
    expect(count(sql, /create or replace function public\.text_array_max_len\(arr text\[\]\) returns int/g)).toBe(1);
    expect(count(sql, /language sql immutable strict/g)).toBe(1);
    expect(count(sql, /coalesce\(public\.text_array_max_len\(menus\), 0\) <= 24/g)).toBe(1);
  });
});

describe("TS/D-13 — 행 타입이 SQL 컬럼 목록과 일치한다", () => {
  it("client.ts 를 읽었다 (#53)", () => {
    // readOrEmpty 는 경로가 틀려도 "" 를 돌려준다. 이 단언이 없으면 #36·#38·#40·#41 이
    // "[] 대 기대 배열"로 실패해 원인(파일을 못 읽었다)을 필드 불일치로 위장한다. SQL 쪽 #1 과 같은 역할이다.
    expect(clientSrc.length).toBeGreaterThan(0);
  });

  it("SQL restaurants 컬럼이 기대 목록과 같다 (#35)", () => {
    expect(tableColumns(sql, "restaurants")).toEqual(RESTAURANT_COLUMNS);
  });

  it("RestaurantRow 필드가 기대 목록과 같다 (#36)", () => {
    expect(typeFields(clientSrc, "RestaurantRow")).toEqual(RESTAURANT_COLUMNS);
  });

  it("SQL candidates 컬럼이 기대 목록과 같다 (#37)", () => {
    expect(tableColumns(sql, "candidates")).toEqual(CANDIDATE_COLUMNS);
  });

  it("CandidateRow 필드가 기대 목록과 같다 (#38)", () => {
    expect(typeFields(clientSrc, "CandidateRow")).toEqual(CANDIDATE_COLUMNS);
  });

  it("SQL settings 컬럼이 기대 목록과 같다 (#39)", () => {
    expect(tableColumns(sql, "settings")).toEqual(SETTINGS_COLUMNS);
  });

  it("SettingsRow 필드가 기대 목록과 같다 (#40)", () => {
    expect(typeFields(clientSrc, "SettingsRow")).toEqual(SETTINGS_COLUMNS);
  });

  it("ResultRow 에 restaurant_id 가 마지막 필드로 붙어 있다 (#41)", () => {
    expect(typeFields(clientSrc, "ResultRow")).toEqual(RESULT_ROW_FIELDS);
  });

  it("MenuRow 와 PinnedMenuRow 가 아직 남아 있다 (#42)", () => {
    // 페이지가 아직 참조하므로 이 페이즈에서 지우면 tsc 가 깨진다. 제거는 Phase 6.
    expect([count(clientSrc, /export type MenuRow/g), count(clientSrc, /export type PinnedMenuRow/g)]).toEqual([1, 1]);
  });
});
