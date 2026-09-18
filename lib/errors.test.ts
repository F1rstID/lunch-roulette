// lib/errors.ts 의 메시지 조립 계약을 고정한다 (01-02 산출물).
// 배너는 "에러가 없으면 아예 렌더하지 않는다"에 기대므로, 없음을 뜻하는 값이 빈 문자열이 아니라 null 이라는 점이 계약의 핵심이다.
// 빈 문자열 분기를 따로 검사하는 이유: null 분기만 보면 빈 문자열 필터가 사라져도 테스트가 초록으로 남아 구분자만 찍힌 배너를 놓친다.

import { describe, it, expect } from "vitest";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";

describe("formatLoadError", () => {
  it("에러가 없으면 null 을 준다 (배너 미렌더 신호)", () => {
    expect(formatLoadError("메뉴 목록", null)).toBeNull();
  });

  it("라벨과 error.message 만으로 한 줄 한국어 문장을 만든다", () => {
    expect(formatLoadError("메뉴 목록", { message: "permission denied" })).toBe(
      "메뉴 목록 불러오기 실패: permission denied",
    );
  });
});

describe("joinLoadErrors", () => {
  it("전부 null 이면 null 이다 (빈 문자열이 아니다)", () => {
    expect(joinLoadErrors([null, null])).toBeNull();
  });

  it("빈 문자열만 있어도 null 이다", () => {
    expect(joinLoadErrors(["", ""])).toBeNull();
  });

  it("빈 문자열 조각은 걸러내고 남은 하나만 남긴다", () => {
    expect(joinLoadErrors(["", "a"])).toBe("a");
  });

  it("null 조각이 섞여도 실제 메시지만 남는다", () => {
    expect(joinLoadErrors(["메뉴 목록 불러오기 실패: x", null])).toBe("메뉴 목록 불러오기 실패: x");
  });

  it("여러 건은 가운뎃점 구분자로 한 줄에 합친다", () => {
    expect(joinLoadErrors(["a", "b"])).toBe("a · b");
  });
});
