import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 추가 1: 디자인 프로토타입. 큰 inline SVG/스타일 JSX + PNG 라 과거 인덱서 OOM 전례가 있다.
    "design/**",
    // 추가 2: Deno 전역(Deno.serve)과 jsr: import 를 쓰는 함수 디렉터리 두 개만 제외한다.
    // _shared/ 는 import 를 하나도 하지 않는 순수 TS 라 제외 대상이 아니다 — 린트·타입체크를 받는다.
    "supabase/functions/spin-roulette/**",
    "supabase/functions/respin-roulette/**",
  ]),
]);

export default eslintConfig;
