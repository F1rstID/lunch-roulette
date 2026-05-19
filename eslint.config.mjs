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
    // 추가: 디자인 프로토타입 JSX(큰 inline SVG/스타일) + Deno Edge Function 제외
    "design/**",
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
