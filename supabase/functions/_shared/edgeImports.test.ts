// 두 Edge Function 의 복붙 제거를 파일 텍스트로 못 박는다. deno 가 로컬에 없어 deno check 를 돌릴 수 없고,
// 두 index.ts 는 tsc·eslint 제외 대상이라 정적 검사도 닿지 않는다 — 이것이 그 두 파일에 대한 유일한 자동 회귀 장치다.
// 한계까지 적어 둔다: 형태만 본다. import 경로가 실제로 해석되는지, 타입이 맞는지는 확인하지 않는다(배포는 Phase 8).
// _shared/*.ts 를 import 하지 않고 텍스트로 읽는 이유도 같다 — 여기서 묻는 것은 "무엇이 쓰여 있는가" 이지 동작이 아니다.
// Phase 2 의 마이그레이션 계약 테스트(supabase/migrations/0005_restaurants_settings.test.ts)와 같은 방식이고
// 같은 한계를 갖는다.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// RED 단계에는 검사 대상 _shared/*.ts 가 아직 없다. 예외를 그대로 던지면 vitest 가 모듈 로드 실패("Failed to load")로
// 수집 자체를 접어 버려서, "무엇이 왜 없는지" 가 단언 실패로 드러나지 않는다 — TDD 게이트가 성립하지 않는다.
function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}

// 줄 주석(//) 뒤를 잘라낸다. 한글 Why 주석에 kstNow 같은 토큰이 섞이면 개수 단언이 자기 자신을 세어 무력화된다.
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

// 원본(raw)과 주석 제거 사본을 둘 다 든다: 존재 여부는 원본에서, 개수 단언은 주석 없는 사본에서 센다.
const rawKst = readOrEmpty(new URL("./kst.ts", import.meta.url));
const rawSpinTime = readOrEmpty(new URL("./spinTime.ts", import.meta.url));
const rawCooldown = readOrEmpty(new URL("./cooldown.ts", import.meta.url));
const rawSpin = readOrEmpty(new URL("../spin-roulette/index.ts", import.meta.url));
const rawRespin = readOrEmpty(new URL("../respin-roulette/index.ts", import.meta.url));

const kst = stripComments(rawKst, "//");
const spinTime = stripComments(rawSpinTime, "//");
const cooldown = stripComments(rawCooldown, "//");
const spin = stripComments(rawSpin, "//");
const respin = stripComments(rawRespin, "//");

// ^ 만 쓰면 들여쓴 import 를 놓친다(0005 spec:118 의 교훈). \s* 를 넣어 줄 맨 앞 공백을 흡수한다.
const IMPORT_LINE = /^\s*import\s/gm;

describe("SHARED/QUAL-02 — _shared 3파일은 import 문이 0개다", () => {
  it("kst.ts 가 존재한다 (#1)", () => {
    expect(rawKst.length).toBeGreaterThan(0);
  });

  it("spinTime.ts 가 존재한다 (#2)", () => {
    expect(rawSpinTime.length).toBeGreaterThan(0);
  });

  it("cooldown.ts 가 존재한다 (#3)", () => {
    expect(rawCooldown.length).toBeGreaterThan(0);
  });

  it("kst.ts 의 import 문이 0건이다 (#4)", () => {
    expect(count(kst, IMPORT_LINE)).toBe(0);
  });

  it("spinTime.ts 의 import 문이 0건이다 — kst.ts 조차 끌어오지 않는다 (#5)", () => {
    expect(count(spinTime, IMPORT_LINE)).toBe(0);
  });

  it("cooldown.ts 의 import 문이 0건이다 (#6)", () => {
    expect(count(cooldown, IMPORT_LINE)).toBe(0);
  });
});

describe("EDGE/QUAL-02 — spin-roulette 의 복붙이 _shared 로 합쳐졌다", () => {
  it('_shared/kst.ts 를 확장자와 함께 import 한다 — Deno 요구사항 (#7)', () => {
    expect(count(spin, /from "\.\.\/_shared\/kst\.ts"/g)).toBe(1);
  });

  it("_shared/spinTime.ts 를 확장자와 함께 import 한다 (#8)", () => {
    expect(count(spin, /from "\.\.\/_shared\/spinTime\.ts"/g)).toBe(1);
  });

  it("로컬 kstNow 복붙이 남아 있지 않다 (#9)", () => {
    expect(count(spin, /function kstNow/g)).toBe(0);
  });

  it("로컬 pickRandom 복붙이 남아 있지 않다 (#10)", () => {
    expect(count(spin, /function pickRandom/g)).toBe(0);
  });

  it("로컬 isAfterSpinTime 복붙이 남아 있지 않다 (#11)", () => {
    expect(count(spin, /function isAfterSpinTime/g)).toBe(0);
  });

  it("SPIN_HH·SPIN_MM 하드코딩이 둘 다 사라졌다 (#12)", () => {
    // 짝을 이루는 불변식이라 한 번에 단언한다 — 한쪽만 지운 파일은 추첨 시각이 반쪽만 옮겨진 상태다.
    expect([count(spin, /const SPIN_HH/g), count(spin, /const SPIN_MM/g)]).toEqual([0, 0]);
  });

  it("로컬 KstParts 타입 재선언이 없다 (#13)", () => {
    expect(count(spin, /type KstParts/g)).toBe(0);
  });

  it("hour12 옵션이 복붙과 함께 사라졌다 (#14)", () => {
    expect(count(spin, /hour12/g)).toBe(0);
  });

  it("23505 레이스 처리가 그대로 남아 있다 — 이 플랜은 import 만 바꾼다 (#15)", () => {
    expect(count(spin, /23505/g)).toBe(1);
  });
});

describe("EDGE/QUAL-02 — respin-roulette 의 복붙이 _shared 로 합쳐졌다", () => {
  it("_shared/kst.ts 를 확장자와 함께 import 한다 (#16)", () => {
    expect(count(respin, /from "\.\.\/_shared\/kst\.ts"/g)).toBe(1);
  });

  it("_shared/spinTime.ts 는 import 하지 않는다 — 이 함수에는 시간 가드가 없다 (#17)", () => {
    expect(count(respin, /from "\.\.\/_shared\/spinTime\.ts"/g)).toBe(0);
  });

  it("로컬 kstNow 복붙이 남아 있지 않다 (#18)", () => {
    expect(count(respin, /function kstNow/g)).toBe(0);
  });

  it("로컬 pickRandom 복붙이 남아 있지 않다 (#19)", () => {
    expect(count(respin, /function pickRandom/g)).toBe(0);
  });

  it("로컬 KstParts 타입 재선언이 없다 (#20)", () => {
    expect(count(respin, /type KstParts/g)).toBe(0);
  });

  it("hour12 옵션이 복붙과 함께 사라졌다 (#21)", () => {
    expect(count(respin, /hour12/g)).toBe(0);
  });

  it("OPTIONS 프리플라이트 단락과 CORS 헤더가 보존돼 있다 (#22)", () => {
    // 짝을 이루는 보안 불변식이라 함께 단언한다. 프리플라이트가 본문을 실행하면 재추첨이 중복으로 덮어써진다.
    expect([
      count(respin, /req\.method === "OPTIONS"/g),
      count(respin, /corsHeaders/g) >= 2,
    ]).toEqual([1, true]);
  });
});
