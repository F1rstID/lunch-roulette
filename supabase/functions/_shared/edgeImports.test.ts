// 두 Edge Function 의 복붙 제거를 파일 텍스트로 못 박는다. 로컬 deno 2.9.7 + npm run check:edge 가
// 두 index.ts 의 타입을 검사하지만(전이로 _shared 까지), 이 spec 이 보는 것은 형태다 — 둘은 서로를 대체하지 않는다.
// tsc·eslint 는 여전히 두 index.ts 를 제외하므로 "무엇이 쓰여 있는가"(조회 문자열·jsr 핀·폴백 키·헬퍼 이름)는
// 여기서만 고정된다.
// 한계까지 적어 둔다: 형태만 본다. 타입이 맞는지는 check:edge 가 보고, 그 코드가 실제로 도는지는 아무도 보지 않는다
// — 실호출은 컷오버(Phase 8) 전까지 불가능하다.
// _shared/*.ts 를 import 하지 않고 텍스트로 읽는 이유도 같다 — 여기서 묻는 것은 "무엇이 쓰여 있는가" 이지 동작이 아니다.
// Phase 2 의 마이그레이션 계약 테스트(supabase/migrations/0005_restaurants_settings.test.ts)와 같은 방식이고
// 같은 한계를 갖는다.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";

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
  // 존재를 먼저 못 박는다(_shared 3파일의 #1~#3 과 같은 이유). readOrEmpty 가 읽기 실패를 "" 로 흡수하므로
  // 파일이 이동·개명되면 "복붙이 없다" 쪽 단언은 빈 문자열에서 전부 초록이 되고, 실패는 다른 단언에서
  // "0 이 아니라 1" 로만 나타나 "파일이 없다" 인지 "import 가 빠졌다" 인지 구분되지 않는다.
  // 진입점 개수로 세는 이유: 파일을 읽었다는 사실과 "핸들러가 하나뿐" 이라는 형태를 한 번에 고정한다.
  it("spin-roulette/index.ts 를 읽었고 진입점이 하나다 (#7a)", () => {
    expect(count(spin, /Deno\.serve\(/g)).toBe(1);
  });

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
  // #7a 와 같은 이유 — 이 파일이 사라지면 아래 부재 단언들이 빈 문자열에서 조용히 초록이 된다.
  it("respin-roulette/index.ts 를 읽었고 진입점이 하나다 (#16a)", () => {
    expect(count(respin, /Deno\.serve\(/g)).toBe(1);
  });

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

  it("되돌릴 수 없는 쓰기를 POST 로만 받는다 (#49)", () => {
    // #22 의 짝이자 그 한계를 메우는 단언이다. 프리플라이트 단락은 OPTIONS 만 거르므로,
    // 이 검사가 사라지면 함수 URL 에 대한 GET(링크 미리보기·주소창) 한 번이 곧 재추첨이 된다.
    // 405 까지 세는 이유: 검사만 남기고 200 으로 돌려보내면 거절이 아니라 조용한 무시가 된다.
    expect([
      count(respin, /req\.method !== "POST"/g),
      count(respin, /"method_not_allowed"/g),
      count(respin, /,\s*405\)/g),
    ]).toEqual([1, 1, 1]);
  });
});

// 아래 세 describe 는 Phase 4 의 재작성이 닫아야 할 계약이다. 라이브에 새 테이블이 없어 두 함수를 한 줄도
// 실행할 수 없으므로(컷오버 전), 여기서 묻는 것은 끝까지 "무엇이 쓰여 있는가" 뿐이다 — 임베드가 실제로
// 객체로 오는지 같은 런타임 사실은 Phase 8 의 첫 실호출에서만 드러난다.
// 개수는 전부 주석 제거 사본(spin·respin)에서 센다. 한글 Why 주석에 검사 토큰이 섞이면 게이트가 자기 자신을
// 세어 조용히 무력화되기 때문이다 — 그래서 이 파일의 주석도 토큰 리터럴 대신 한국어 표현을 쓴다.

describe("EDGE/SPIN-01 — spin-roulette 가 candidates ⋈ restaurants · settings · 쿨다운 위에서 돈다", () => {
  it("후보를 오늘 후보 테이블에서 읽고 옛 메뉴 테이블은 더 읽지 않는다 (#23)", () => {
    // 부재와 존재를 한 번에 센다 — 한쪽만 세면 "둘 다 읽는" 중간 상태가 통과한다.
    expect([count(spin, /from\("menus"\)/g), count(spin, /from\("candidates"\)/g)]).toEqual([0, 1]);
  });

  it("후보와 함께 매장을 임베드로 읽는다 (#24)", () => {
    // 공백 변형을 허용한다. PostgREST 파서가 공백에 관대하므로 텍스트 단언도 같은 관대함을 가져야 한다.
    expect(count(spin, /restaurants\s*\(\s*id\s*,\s*name\s*\)/g)).toBe(1);
  });

  it("설정 단일행을 읽는다 — 추첨 시각과 쿨다운 일수의 출처다 (#25)", () => {
    expect(count(spin, /from\("settings"\)/g)).toBe(1);
  });

  it("결과 테이블을 세 번 만진다 (#26)", () => {
    // 숫자의 근거를 여기 적어 둔다: 오늘 결과 존재 확인 1 + 쿨다운 창 조회 1 + 기록 1.
    // 근거 없이 숫자만 남으면 다음 사람이 이 단언을 고칠 수도, 믿을 수도 없다.
    expect(count(spin, /from\("results"\)/g)).toBe(3);
  });

  it("쓰기 본문과 성공 응답이 당첨 매장 id 를 함께 싣는다 (#27)", () => {
    // 기록 본문 1 + 응답 1 = 2. 응답에도 실어야 cron 로그만으로 어느 매장이 뽑혔는지 추적된다.
    expect(count(spin, /restaurant_id: winner\.restaurant_id/g)).toBe(2);
  });

  it("쿨다운 모듈이 배선됐다 (#28)", () => {
    // 창 계산과 필터 적용은 짝이다 — 하나만 있는 파일은 쿨다운이 반쪽만 켜진 상태다.
    expect([
      count(spin, /from "\.\.\/_shared\/cooldown\.ts"/g),
      count(spin, /cooldownWindowStart\(/g),
      count(spin, /applyCooldown\(/g),
    ]).toEqual([1, 1, 1]);
  });

  it("supabase 클라이언트 명세자가 정확 버전으로 핀됐다 (#29)", () => {
    // 로컬 잠금 파일은 배포 번들에 실리지 않는다. 검사한 버전과 배포될 버전을 같게 만드는 장치는 이 핀뿐이다.
    expect([
      count(spin, /jsr:@supabase\/supabase-js@2\.117\.2"/g),
      count(spin, /jsr:@supabase\/supabase-js@2"/g),
    ]).toEqual([1, 0]);
  });

  it("하드코딩된 시각 대신 설정 문자열을 파싱해 판정한다 (#30)", () => {
    // 낱말 경계를 쓰는 이유: 접두가 같은 텍스트 상수까지 함께 세면 숫자가 부풀어 게이트가 헐거워진다.
    expect([
      count(spin, /parseSpinTime\(/g),
      count(spin, /DEFAULT_SPIN_TIME\b/g) >= 1,
    ]).toEqual([1, true]);
  });

  it("시각 판정 → 오늘 결과 확인 → 후보 조회 → 쿨다운 → 기록 순서를 지킨다 (#31)", () => {
    // 개수가 아니라 위치를 묻는 유일한 단언이라 count 헬퍼 대신 indexOf 를 직접 쓴다.
    // 이 순서가 뒤집히면 후보를 비운 뒤 뽑는 경로가 열려 빈 배열에서 난수를 고르게 된다.
    const at = [
      spin.indexOf("isAfterSpinTime("),
      spin.indexOf('from("results")'),
      spin.indexOf('from("candidates")'),
      spin.indexOf("applyCooldown("),
      spin.indexOf(".insert("),
    ];
    expect([
      at.every((i) => i > 0),
      at.every((i, n) => n === 0 || i > at[n - 1]),
    ]).toEqual([true, true]);
  });

  it("실패·폴백 경로가 서버 로그를 남긴다 (#32)", () => {
    // 재작성이 넣을 지점은 일곱 곳이라 하한을 다섯으로 둔다 — 로그를 한두 줄 옮겨도 게이트가 깨지지 않게.
    expect(count(spin, /console\.error\(/g)).toBeGreaterThan(4);
  });

  it("폴백 플래그 세 키가 응답에 상시 실린다 (#33)", () => {
    // 전부 거짓인 줄이 정상이고, 참이 보이면 그날 설정과 DB 를 본다 — 그러려면 키가 항상 있어야 한다.
    expect([
      count(spin, /settings_fallback/g),
      count(spin, /cooldown_fallback/g),
      count(spin, /cooldown_skipped/g),
    ]).toEqual([1, 1, 1]);
  });

  it("조인에서 떨어진 후보 수를 두 응답이 함께 싣는다 (#50)", () => {
    // 후보 없음 응답 1 + 성공 응답 1 = 2. 후보 없음 쪽이 빠지면 "테이블이 비었다" 와
    // "조인이 깨져 전부 떨어졌다" 가 응답에서 같아져 호출자가 둘을 구분할 수 없다.
    expect(count(spin, /excluded_count/g)).toBe(2);
  });

  it("모든 반환이 응답 헬퍼를 지난다 (#34)", () => {
    // 맨 응답 생성이 헬퍼 한 곳뿐이어야 헤더 규약이 한 자리에서 끝난다.
    expect([count(spin, /new Response\(/g), count(spin, /function json\(/g)]).toEqual([1, 1]);
  });
});

describe("EDGE/SPIN-04 — respin-roulette 가 같은 조회 위에서 덮어쓴다", () => {
  it("후보를 오늘 후보 테이블에서 읽고 옛 메뉴 테이블은 더 읽지 않는다 (#35)", () => {
    expect([count(respin, /from\("menus"\)/g), count(respin, /from\("candidates"\)/g)]).toEqual([0, 1]);
  });

  it("후보와 함께 매장을 임베드로 읽는다 (#36)", () => {
    expect(count(respin, /restaurants\s*\(\s*id\s*,\s*name\s*\)/g)).toBe(1);
  });

  it("설정 단일행을 읽는다 — 쿨다운 일수만 쓰지만 같은 조회·같은 정책이다 (#37)", () => {
    expect(count(respin, /from\("settings"\)/g)).toBe(1);
  });

  it("결과 테이블을 두 번 만진다 (#38)", () => {
    // 쿨다운 창 조회 1 + 덮어쓰기 1. 이 숫자가 "이 함수에는 멱등 조회가 없다" 는 사실까지 고정한다.
    expect(count(respin, /from\("results"\)/g)).toBe(2);
  });

  it("쓰기 본문과 성공 응답이 당첨 매장 id 를 함께 싣는다 (#39)", () => {
    expect(count(respin, /restaurant_id: winner\.restaurant_id/g)).toBe(2);
  });

  it("쿨다운 모듈이 배선됐다 (#40)", () => {
    expect([
      count(respin, /from "\.\.\/_shared\/cooldown\.ts"/g),
      count(respin, /cooldownWindowStart\(/g),
      count(respin, /applyCooldown\(/g),
    ]).toEqual([1, 1, 1]);
  });

  it("supabase 클라이언트 명세자가 정확 버전으로 핀됐다 (#41)", () => {
    expect([
      count(respin, /jsr:@supabase\/supabase-js@2\.117\.2"/g),
      count(respin, /jsr:@supabase\/supabase-js@2"/g),
    ]).toEqual([1, 0]);
  });

  it("시간 가드가 없으므로 추첨 시각 파싱도 기본 상수도 쓰지 않는다 (#42)", () => {
    // 부재 단언(#17)의 연장이다. 시간 가드가 없는 함수에 불필요한 의존을 만들지 않는다.
    expect([count(respin, /parseSpinTime\(/g), count(respin, /DEFAULT_SPIN_TIME\b/g)]).toEqual([0, 0]);
  });

  it("실패·폴백 경로가 서버 로그를 남긴다 (#43)", () => {
    // 재작성이 넣을 지점은 다섯 곳이라 하한을 넷으로 둔다.
    expect(count(respin, /console\.error\(/g)).toBeGreaterThan(3);
  });

  it("폴백 플래그 세 키가 응답에 상시 실린다 (#44)", () => {
    expect([
      count(respin, /settings_fallback/g),
      count(respin, /cooldown_fallback/g),
      count(respin, /cooldown_skipped/g),
    ]).toEqual([1, 1, 1]);
  });

  it("조인에서 떨어진 후보 수를 두 응답이 함께 싣는다 (#51)", () => {
    // #50 과 같은 근거. 이쪽은 응답이 곧 사용자 배너라 구분 실패가 화면까지 올라온다.
    expect(count(respin, /excluded_count/g)).toBe(2);
  });

  it("맨 응답 생성은 프리플라이트 단락과 헬퍼 두 곳뿐이다 (#45)", () => {
    // 500 하나라도 헬퍼를 건너뛰면 교차 출처 헤더가 빠져 브라우저가 본문을 차단한다 —
    // 그러면 클라이언트가 함수의 실패 사유를 읽는 경로가 통째로 죽는다.
    expect([count(respin, /new Response\(/g), count(respin, /function json\(/g)]).toEqual([2, 1]);
  });

  it("덮어쓰기는 날짜 충돌 기준 한 번뿐이다 (#46)", () => {
    // 주석 제거 사본에서 센다 — 이 파일 머리 주석이 같은 낱말을 쓰고 있어서 원본으로 세면 두 번이 된다.
    expect([count(respin, /\.upsert\(/g), count(respin, /onConflict: "date"/g)]).toEqual([1, 1]);
  });
});

describe("EDGE/QUAL — 두 파일의 대칭과 설정 파일의 위치", () => {
  it("후보 정규화 헬퍼 이름이 두 파일에서 같다 (#47)", () => {
    // 이름이 같아야 Phase 8 낭독에서 두 파일을 diff 로 나란히 비교할 수 있다.
    expect([
      count(spin, /function normalizeCandidates\(/g),
      count(respin, /function normalizeCandidates\(/g),
    ]).toEqual([1, 1]);
  });

  it("deno 설정 파일이 함수 디렉터리 밖 한 단계 위에 있다 (#48)", () => {
    // 이 파일이 함수 디렉터리 안으로 내려가면 Supabase CLI 가 배포 import map 으로 채택해 번들 입력이 바뀐다.
    // 그 사고는 배포 전까지 조용하므로 위치 자체를 계약으로 못 박는다.
    expect([
      existsSync(new URL("../spin-roulette/deno.json", import.meta.url)),
      existsSync(new URL("../spin-roulette/deno.jsonc", import.meta.url)),
      existsSync(new URL("../spin-roulette/import_map.json", import.meta.url)),
      existsSync(new URL("../respin-roulette/deno.json", import.meta.url)),
      existsSync(new URL("../respin-roulette/deno.jsonc", import.meta.url)),
      existsSync(new URL("../respin-roulette/import_map.json", import.meta.url)),
      existsSync(new URL("../deno.json", import.meta.url)),
    ]).toEqual([false, false, false, false, false, false, true]);
  });
});
