// 반응형 레이아웃 클래스(l-*)의 텍스트 계약. 컴포넌트를 렌더하지 않고(레포에 렌더 하네스가 없다)
// 소스를 읽어 이름과 분기 값을 고정한다.
// 이 spec 이 막는 것은 조용한 실패다: className 의 오타는 타입도 lint 도 빌드도 통과하고, 넓은 화면에서는
// 티가 나지 않다가 휴대폰에서만 배치가 무너진다. 개발은 넓은 화면에서 하므로 사람 눈이 마지막에 본다.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CSS_PATH = join(REPO_ROOT, "app/globals.css");
const SOURCE_DIRS = ["app", "components"];
// 분기를 늘리면 화면마다 다른 폭에서 배치가 바뀌어 "어느 폭에서 깨지는가" 를 추적할 수 없게 된다.
const ALLOWED_BREAKPOINTS_PX = [720, 960];

// 블록 주석을 지운 사본에서 센다. 한글 Why 주석에 l-topbar 같은 이름이 나오면 원본 검색이 주석을 정의로 센다.
const css = readFileSync(CSS_PATH, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

const definedClasses = new Set(Array.from(css.matchAll(/\.(l-[a-z0-9-]+)/g), (m) => m[1]));

// className="…" 문자열 리터럴 안의 토큰만 본다. 주석이나 다른 문자열에 나온 l-* 는 세지 않는다.
const usedClasses = new Map<string, string>();
for (const dir of SOURCE_DIRS) {
  for (const file of listTsxFiles(join(REPO_ROOT, dir))) {
    const source = readFileSync(file, "utf8");
    for (const attr of source.matchAll(/className="([^"]*)"/g)) {
      for (const token of attr[1].split(/\s+/)) {
        if (token.startsWith("l-")) usedClasses.set(token, file.slice(REPO_ROOT.length));
      }
    }
  }
}

describe("반응형 레이아웃 클래스 계약", () => {
  it("소스를 실제로 읽었다 — 빈 집합끼리 비교해 통과하는 일을 막는다", () => {
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

  it("l-* 클래스는 템플릿 문자열·조건식이 아니라 문자열 리터럴로만 붙인다", () => {
    // className={`… l-x`} 나 className={cond ? "l-x" : ""} 는 위 두 검사가 읽지 못한다.
    const dynamicUses = SOURCE_DIRS.flatMap((dir) => listTsxFiles(join(REPO_ROOT, dir)))
      .filter((file) => /className=\{[^}]*\bl-[a-z]/.test(readFileSync(file, "utf8")))
      .map((file) => file.slice(REPO_ROOT.length));
    expect(dynamicUses).toEqual([]);
  });

  it("폭 분기는 720px·960px 둘뿐이다", () => {
    const widths = Array.from(css.matchAll(/@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g), (m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    expect(Array.from(new Set(widths)).sort((a, b) => a - b)).toEqual(ALLOWED_BREAKPOINTS_PX);
  });

  it("숨김 유틸 2종만 !important 를 쓴다", () => {
    const importantRules = Array.from(css.matchAll(/([^{}]+)\{[^{}]*!important[^{}]*\}/g), (m) => m[1].trim());
    expect(importantRules.sort()).toEqual([".l-hide-narrow", ".l-hide-stack"]);
  });
});
