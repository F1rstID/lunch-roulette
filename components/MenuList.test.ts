// parseMenuInput 의 현재 동작을 회귀 테스트로 못 박는다 (Phase 1 은 동작 변경 금지).
// Phase 5 가 이 함수를 매장 메뉴 입력에 그대로 재사용하므로, 분리·trim·절단·중복 제거의 순서가 계약이다.
// 절단 상한을 MENU_NAME_MAX_LEN 이 아니라 리터럴 24 로 쓰는 이유: 상수를 import 하면 상수 값이 바뀔 때
// 기대값도 같이 움직여 "DB check 제약(char_length 1~24)의 거울" 이라는 사실이 테스트에서 사라진다.

import { describe, it, expect } from "vitest";
import { parseMenuInput } from "@/components/MenuList";

describe("parseMenuInput", () => {
  it("기본 쉼표 3개", () => {
    expect(parseMenuInput("김치찌개, 마라탕, 샐러드", [])).toEqual(["김치찌개", "마라탕", "샐러드"]);
  });

  it("전각 쉼표", () => {
    expect(parseMenuInput("김치찌개，마라탕", [])).toEqual(["김치찌개", "마라탕"]);
  });

  it("꼬리 쉼표·공백", () => {
    expect(parseMenuInput("A, B, ", [])).toEqual(["A", "B"]);
  });

  it("입력 내 중복", () => {
    expect(parseMenuInput("바나나,바나나, 바나나", [])).toEqual(["바나나"]);
  });

  it("기존 메뉴 제외", () => {
    expect(parseMenuInput("바나나, 사과", ["바나나"])).toEqual(["사과"]);
  });

  it("전부 기존이면 빈 배열", () => {
    expect(parseMenuInput("바나나", ["바나나"])).toEqual([]);
  });

  it("빈/공백만", () => {
    expect(parseMenuInput(" , , ", [])).toEqual([]);
  });

  it("단일 항목(쉼표 없음)", () => {
    expect(parseMenuInput("  마라탕  ", [])).toEqual(["마라탕"]);
  });

  it("24자 초과 항목은 24자로", () => {
    expect(parseMenuInput("가".repeat(30) + ", 짧음", [])).toEqual(["가".repeat(24), "짧음"]);
  });

  it("잘린 뒤 중복도 제거", () => {
    // 절단이 중복 판정보다 먼저 일어나야 성립한다 — 순서가 뒤집히면 24자짜리가 두 개 남는다.
    expect(parseMenuInput("가".repeat(30) + "," + "가".repeat(24), [])).toEqual(["가".repeat(24)]);
  });
});
