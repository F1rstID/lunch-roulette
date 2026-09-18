// vitest 러너 설정.
// 확장자가 .ts 가 아니라 .mts 인 이유: package.json 에 "type": "module" 이 없어 .ts 설정 파일을 로드하면
// Vite 가 매 실행마다 configLoader 경고를 찍는다. tsconfig include 에 이미 **/*.mts 가 있어 타입체크 범위는 그대로다.

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 레포 루트 절대경로 (끝에 슬래시). @/lib/time → <root>/lib/time 으로 이어 붙인다.
const repoRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  test: {
    // 컴포넌트를 렌더하지 않는다 — 순수 함수만 다루므로 jsdom 을 들이지 않는다.
    environment: "node",
    // spec 이 vitest 에서 describe·it·expect 를 명시 import 한다.
    // tsconfig include 가 **/*.ts 라 spec 도 타입체크 대상인데, 전역에 의존하면 타입이 뜨지 않는다.
    globals: false,
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      // Phase 3 이 만들 Deno 공유 순수 로직 자리. 지금은 매치되는 파일이 0개이고 그래도 무해하다 —
      // 미리 넣어 두는 이유는 그때 이 설정을 다시 건드리지 않게 하기 위해서다.
      "supabase/functions/_shared/**/*.test.ts",
      // 로컬에 Supabase 스택이 없어 마이그레이션 SQL 을 실제로 실행해 볼 수 없다. 대신 계약 테스트가
      // .sql 을 텍스트로 파싱해 검사하므로 spec 이 검사 대상 SQL 파일 옆에 산다 (드라이런은 D-15 로 Phase 8 선택 항목).
      "supabase/migrations/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      ".next/**",
      // design/ 은 React CDN 프로토타입 + PNG 다. 빌드 대상이 아니고, 과거 인덱서 OOM 전례 때문에
      // tsconfig·eslint·vscode·Tailwind 네 곳에서 이미 제외돼 있다. 러너도 같은 경계를 지킨다.
      "design/**",
      // 계획 디렉터리의 스크래치 *.test.ts 가 수집되는 것을 막는다 (예: .planning/phases/**/ref-parse.test.ts).
      ".planning/**",
      // extglob(!(...)) 패턴이며 vitest 의 globber 가 해석한다.
      // supabase/functions/** 로 단순화하면 include 의 _shared 항목까지 통째로 무효화되므로 줄이지 말 것.
      "supabase/functions/!(_shared)/**",
    ],
  },
  resolve: {
    // tsconfig paths 의 "@/*": ["./*"] 재현. 단순 문자열 alias "@" 는 경로에 슬래시가 겹쳐 들어가므로 쓰지 않는다.
    alias: [{ find: /^@\//, replacement: repoRoot }],
  },
});
