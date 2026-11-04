// 0008 마이그레이션의 텍스트 계약. 로컬 Supabase 스택이 없어 SQL 을 실행하지 못하므로(0005~0007 과 같은 사정)
// "파일에 무엇이 쓰여 있는가" 를 센다. 이 파일이 지키는 것은 셋이다: candidates.source 가 두 값만 허용하고 기본이
// seed 일 것(적용 순간 동작 불변의 근거), 자정 재시드 잡이 source 를 seed 로 명시해 재등록될 것, 그 밖의 표·정책·잡은
// 건드리지 않을 것.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

const raw = readOrEmpty(new URL("./0008_candidate_source.sql", import.meta.url));
// 한글 Why 주석에 'drop' 같은 토큰이 섞여도 세지 않게 줄 주석을 지운 사본에서 센다.
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");
const count = (re: RegExp) => (sql.match(re) ?? []).length;

describe("0008 후보 출처 — candidates.source 컬럼 계약", () => {
  it("파일이 있고 비어 있지 않다", () => {
    expect(raw.length).toBeGreaterThan(300);
  });

  it("source 를 재실행 안전형으로 더한다 — not null, 기본 seed", () => {
    expect(count(/alter table public\.candidates\s+add column if not exists source text not null default 'seed'/g)).toBe(1);
  });

  it("값은 seed·manual 둘뿐이다 — Edge 좁히기와 CandidateSource 타입이 같은 두 낱말을 가정한다", () => {
    expect(count(/check \(source in \('seed', ?'manual'\)\)/g)).toBe(1);
  });

  it("기본값이 seed 인 이유를 말한다 — 구 클라이언트의 insert 와 적용 시점의 행이 전부 seed 로 읽혀 동작이 바뀌지 않는다", () => {
    expect(raw).toMatch(/기본값/);
    expect(raw).toMatch(/구 클라이언트/);
  });

  it("컬럼의 뜻을 DB 에 남긴다 — seed 는 자동 시드, manual 은 사람이 담기", () => {
    expect(raw).toMatch(/comment on column public\.candidates\.source/);
    expect(raw).toMatch(/seed/);
    expect(raw).toMatch(/manual/);
    expect(raw).toMatch(/담기/);
  });
});

describe("0008 — 자정 재시드 잡만 source 를 명시하도록 재등록한다", () => {
  it("reset-candidates 만 unschedule 한다(0005 의 루프 패턴) — 다른 잡 이름은 등장하지 않는다", () => {
    expect(count(/where jobname = 'reset-candidates'/g)).toBe(1);
    expect(count(/cron\.unschedule\(jid\)/g)).toBe(1);
    expect(count(/spin-lunch-roulette|purge-cron-history|reset-menus/g)).toBe(0);
  });

  it("같은 이름·같은 시각(KST 00:00)으로 하나만 재등록한다", () => {
    expect(count(/cron\.schedule\(\s*'reset-candidates',\s*'0 15 \* \* \*'/g)).toBe(1);
    expect(count(/cron\.schedule\(/g)).toBe(1);
  });

  it("잡 본문은 비우고 📌 매장을 seed 로 시드한다 — 기본값에 기대지 않고 뜻을 적는다", () => {
    expect(count(/delete from public\.candidates;/g)).toBe(1);
    expect(count(/insert into public\.candidates \(restaurant_id, source\)\s+select id, 'seed' from public\.restaurants where pinned order by created_at;/g)).toBe(1);
  });

  it("잡 본문($cmd$ 안)에는 주석이 없다 — 본문은 cron.job.command 에 그대로 저장된다", () => {
    // 주석을 지운 사본에서 찍는다 — 머리 주석의 "$cmd$ 안에는…" 문장이 본문으로 잡히지 않게.
    const body = sql.match(/\$cmd\$([\s\S]*?)\$cmd\$/g) ?? [];
    expect(body.length).toBe(1);
    expect(body[0]).not.toMatch(/--/);
  });
});

describe("0008 — 추가만 한다", () => {
  it("drop·다른 표의 alter·정책·publication 을 건드리지 않는다", () => {
    expect(count(/\bdrop\b/g)).toBe(0);
    expect(count(/alter table public\.(restaurants|results|settings|lunch_days)/g)).toBe(0);
    expect(count(/policy/g)).toBe(0);
    expect(count(/publication/g)).toBe(0);
    expect(count(/alter column/g)).toBe(0);
  });
});
