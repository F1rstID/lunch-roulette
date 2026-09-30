// 반응형 레이아웃 클래스(l-*)의 텍스트 계약. 컴포넌트를 렌더하지 않고(레포에 렌더 하네스가 없다)
// 소스를 읽어 이름과 분기 조건을 고정한다.
// 이 spec 이 막는 것은 조용한 실패다: className 의 오타는 타입도 lint 도 빌드도 통과하고, 넓은 화면에서는
// 티가 나지 않다가 휴대폰에서만 배치가 무너진다. 개발은 넓은 화면에서 하므로 사람 눈이 마지막에 본다.
//
// 이 spec 이 보지 못하는 것 두 가지 — 고칠 때 사람이 확인한다:
// 1. l-* 가 가진 속성을 같은 요소의 inline style 에 다시 적는 것(globals.css 규칙 1). 스타일 객체가
//    spread 로 합쳐지면 텍스트만으로는 어느 속성이 그 요소에 닿는지 알 수 없다.
// 2. 접두 자체의 오타(I-hide-narrow, 1-tap). l- 로 시작하지 않으면 이 spec 의 대상이 아니게 된다.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CSS_PATH = join(REPO_ROOT, "app/globals.css");
const SOURCE_DIRS = ["app", "components"];
// 조건을 늘리면 화면마다 다른 폭에서 배치가 바뀌어 "어느 폭에서 깨지는가" 를 추적할 수 없게 된다.
// 값이 아니라 조건문 전체를 고정하는 이유: 값만 뽑으면 복합 조건·em·범위 문법이 검사를 비껴간다.
const ALLOWED_MEDIA_CONDITIONS = ["(max-width: 720px)", "(max-width: 960px)", "(pointer: coarse)"];

// 블록 주석을 지운 사본에서 센다. 한글 Why 주석에 l-topbar 같은 이름이 나오면 원본 검색이 주석을 정의로 센다.
const css = readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const relative = (file: string) => file.slice(REPO_ROOT.length);

// 주석을 지운 사본. 주석에는 l-page-head 같은 이름이 설명으로 나온다.
const sources = SOURCE_DIRS.flatMap((dir) => listTsxFiles(join(REPO_ROOT, dir))).map((file) => ({
  file: relative(file),
  code: readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, ""),
}));

const definedClasses = new Set(Array.from(css.matchAll(/\.(l-[a-z0-9-]+)/g), (m) => m[1]));

const usedClasses = new Map<string, string>();
for (const { file, code } of sources) {
  for (const attr of code.matchAll(/className="([^"]*)"/g)) {
    for (const token of attr[1].split(/\s+/)) {
      if (token.startsWith("l-")) usedClasses.set(token, file);
    }
  }
}

describe("반응형 레이아웃 클래스 계약", () => {
  it("소스를 실제로 읽었다 — 빈 집합끼리 비교해 통과하는 일을 막는다", () => {
    expect(sources.length).toBeGreaterThan(10);
    expect(definedClasses.size).toBeGreaterThan(5);
    expect(usedClasses.size).toBeGreaterThan(5);
  });

  it("컴포넌트가 쓰는 l-* 클래스는 전부 globals.css 에 정의돼 있다", () => {
    const undefinedUses = Array.from(usedClasses)
      .filter(([name]) => !definedClasses.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(undefinedUses).toEqual([]);
  });

  it("globals.css 의 l-* 클래스는 전부 어딘가에서 쓰인다 — 죽은 규칙을 남기지 않는다", () => {
    const unused = Array.from(definedClasses).filter((name) => !usedClasses.has(name));
    expect(unused).toEqual([]);
  });

  it('l-* 토큰은 className="…" 리터럴 안에만 나온다', () => {
    // 읽을 수 있는 형태를 찾는 대신, 읽을 수 없는 자리에 l-* 가 있는지를 본다. 템플릿 문자열·작은따옴표·
    // 변수에 담긴 클래스는 위 두 검사가 보지 못하므로 그 형태 자체를 막는다.
    const stray = sources.flatMap(({ file, code }) => {
      const outside = code.replace(/className="[^"]*"/g, "");
      return Array.from(outside.matchAll(/(?<![\w-])l-[a-z][a-z0-9-]*/g), (m) => `${m[0]} (${file})`);
    });
    expect(stray).toEqual([]);
  });

  it("media query 는 허용된 세 조건뿐이고 container query 는 쓰지 않는다", () => {
    const conditions = Array.from(css.matchAll(/@media\s*([^{]+)\{/g), (m) => m[1].trim());
    expect(Array.from(new Set(conditions)).sort()).toEqual(ALLOWED_MEDIA_CONDITIONS);
    expect(css).not.toMatch(/@container/);
  });

  it("숨김 유틸 2종만 !important 를 쓴다", () => {
    const importantRules = Array.from(css.matchAll(/([^{}]+)\{[^{}]*!important[^{}]*\}/g), (m) => m[1].trim());
    expect(importantRules.sort()).toEqual([".l-hide-narrow", ".l-hide-stack"]);
  });
});
