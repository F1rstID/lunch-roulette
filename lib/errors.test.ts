// lib/errors.ts 의 메시지 조립 계약을 고정한다 (01-02 산출물).
// 배너는 "에러가 없으면 아예 렌더하지 않는다"에 기대므로, 없음을 뜻하는 값이 빈 문자열이 아니라 null 이라는 점이 계약의 핵심이다.
// 빈 문자열 분기를 따로 검사하는 이유: null 분기만 보면 빈 문자열 필터가 사라져도 테스트가 초록으로 남아 구분자만 찍힌 배너를 놓친다.
// formatRespinError 의 세 번째 케이스를 따로 두는 이유도 같다: 빈 문자열을 통과시키면 배너가 "다시 돌리기 실패: " 로 끝나 사용자가 읽을 문장이 없다.
// 비객체 본문(문자열·숫자)은 두 번째 케이스와 같은 분기(객체가 아니면 fallback)라 별도 it 을 만들지 않는다.

import { describe, it, expect } from "vitest";
import { formatLoadError, formatRespinError, joinLoadErrors } from "@/lib/errors";

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

describe("formatRespinError", () => {
  it("본문이 보낸 문장이 라이브러리 고정 문구를 이긴다", () => {
    expect(
      formatRespinError("Edge Function returned a non-2xx status code", { error: "후보가 없어요" }),
    ).toBe("후보가 없어요");
  });

  it("본문이 JSON 이 아니어서 null 이면 fallback 문구를 쓴다", () => {
    expect(formatRespinError("Edge Function returned a non-2xx status code", null)).toBe(
      "Edge Function returned a non-2xx status code",
    );
  });

  it("error 가 빈 문자열이면 fallback 을 쓴다 (접두만 남은 배너를 막는다)", () => {
    expect(formatRespinError("Edge Function returned a non-2xx status code", { error: "" })).toBe(
      "Edge Function returned a non-2xx status code",
    );
  });

  // 아래 세 케이스는 "함수 본문이 아예 돌지 못한" 응답을 읽는다. 함수가 만든 { error } 가 없는
  // 구간이라 여기서 키를 하나만 보면 배너가 라이브러리 고정 문구로 끝난다.
  it("게이트웨이의 401 본문({ code, message })에서 문장을 건진다", () => {
    expect(
      formatRespinError("Edge Function returned a non-2xx status code", {
        code: 401,
        message: "Invalid JWT",
      }),
    ).toBe("Invalid JWT");
  });

  it("워커 부팅 실패 본문({ code: BOOT_ERROR, message })에서도 문장을 건진다", () => {
    expect(
      formatRespinError("Edge Function returned a non-2xx status code", {
        code: "BOOT_ERROR",
        message: "worker boot error: failed to create the graph",
      }),
    ).toBe("worker boot error: failed to create the graph");
  });

  it("앞뒤 공백을 떼고 싣는다 (접두와 문장 사이가 벌어지지 않게)", () => {
    expect(formatRespinError("FB", { error: " x " })).toBe("x");
  });

  it("공백만 있는 문장은 빈 문자열과 같이 fallback 으로 떨어진다", () => {
    // 이 케이스가 없으면 .trim() 분기가 사라져도 빈 문자열 케이스만으로 초록이 된다.
    expect(formatRespinError("FB", { error: "   " })).toBe("FB");
  });

  it("긴 본문은 상한에서 잘라 말줄임표를 붙인다 (한 줄 배너가 화면을 덮지 않게)", () => {
    // 200 은 lib/errors.ts 의 RESPIN_ERROR_MAX_LEN 과 같은 값이다. 여기 숫자를 박아 두는 것이
    // 의도다 — 상한을 바꾸면 이 단언이 깨져서 "배너 한 줄" 이라는 전제를 다시 보게 된다.
    const long = "가".repeat(250);
    const formatted = formatRespinError("FB", { error: long });
    expect([formatted.length, formatted.endsWith("…"), formatted.slice(0, 200)]).toEqual([
      201,
      true,
      "가".repeat(200),
    ]);
  });

  it("상한과 같은 길이는 자르지 않는다 (경계)", () => {
    const exact = "나".repeat(200);
    expect(formatRespinError("FB", { error: exact })).toBe(exact);
  });

  it("두 키가 다 있으면 함수가 보낸 error 가 이긴다 (우선순위)", () => {
    expect(
      formatRespinError("Edge Function returned a non-2xx status code", {
        error: "후보가 없어요",
        message: "Invalid JWT",
      }),
    ).toBe("후보가 없어요");
  });
});
