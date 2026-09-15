@AGENTS.md

# lunch_roulette — 작업 가이드

매일 11:55 KST에 서버가 자동으로 돌리는 익명 점심 메뉴 룰렛. 인프라·배포·pg_cron 상세는 `README.md`가 정본이다 (여기 중복하지 않는다).

## 엔트리포인트·핵심 흐름

- `app/page.tsx` — 오늘 탭. 메뉴 CRUD + 룰렛 + 결과. 앱의 중심.
- `app/log/page.tsx` — 캘린더 기록. `app/rank/page.tsx` — 랭킹.
- `lib/supabase/client.ts` — 브라우저용 supabase 클라이언트 + `MenuRow`/`ResultRow` 타입. **DB 타입의 유일한 정의처** (자동 생성 아님, 수동 유지).
- `lib/time.ts` — KST 변환 전부. `lib/phase.ts` — 시각 → 페이즈(`accepting|spinning|decided`).
- `supabase/functions/spin-roulette` — pg_cron이 11:55에 호출하는 추첨 함수 (시간 가드 + 멱등). `respin-roulette` — 클라이언트 "다시 돌리기" (가드 없음, upsert).

흐름: 클라이언트는 `menus`/`results`를 직접 SELECT/INSERT/DELETE(anon RLS) → Realtime `postgres_changes`로 동기화. 결과 확정은 **서버(pg_cron → Edge Function → results INSERT)** 만 한다. 클라이언트의 페이즈 계산은 표시용 추정이고, 실제 상태 전환은 results 행 존재 여부가 결정한다.

## 검증 명령

```bash
npx tsc --noEmit   # 타입
npm run lint       # eslint (react-hooks 규칙 포함)
npm run build      # 프로덕션 빌드. NEXT_PUBLIC_SUPABASE_* 없으면 빌드 자체가 실패한다
```

테스트 인프라 없음 (`test` 스크립트·러너·CI 전부 없음). 2026-09-15 기준 lint 에러 1건 존재 (`components/Wheel.tsx` `react-hooks/set-state-in-effect`).

## 코드 컨벤션 (이 레포가 이미 내린 선택 — 따른다)

- **전부 클라이언트 컴포넌트.** 서버 컴포넌트·Route Handler·서버 액션 없음. 데이터 접근은 페이지 컴포넌트 안에서 supabase-js 직접 호출. 새 기능도 이 구조를 따르되, 쓰기 권한이 필요한 로직은 Edge Function으로 보낸다 (results 쓰기는 service_role만).
- **스타일: inline style 객체 + CSS 변수.** 컴포넌트마다 파일 하단에 `const s = {...} satisfies Record<string, CSSProperties>`. 색·폰트·반경은 `app/globals.css`의 `--bg`, `--ink`, `--accent` 등 토큰만 쓴다. Tailwind는 설치돼 있지만 유틸리티 클래스는 거의 안 쓴다 (layout.tsx 정도) — 새 코드도 inline style 쪽을 따른다.
- **콜백 prop 이름은 `~Action` 접미사** (`onAddAction`, `onRemoveAction`, `onChangeMonthAction`). Next.js 클라이언트 경계의 직렬화 lint를 통과시키기 위한 규약이다. `onX`로 지으면 lint가 잡는다.
- **시간은 항상 `lib/time.ts` 경유.** `Date`의 로컬 메서드(`getHours` 등)를 비즈니스 로직에 직접 쓰지 않는다. 날짜 키는 `"yyyy-mm-dd"` KST 문자열이고 `results.date`와 그대로 비교한다.
- 컴포넌트는 named export, 파일명 = 컴포넌트명 (`components/Wheel.tsx`). 페이지 전용 소형 컴포넌트는 페이지 파일 안에 둔다.
- 주석은 한글, Why만. 파일 머리에 역할·제약을 블록 주석으로.
- 마이그레이션은 `supabase/migrations/000N_설명.sql`, cron 등록은 "기존 잡 unschedule → 재등록" 패턴으로 재실행 가능하게.
- Edge Function은 Deno + `jsr:` import. `tsconfig`·eslint에서 제외돼 있으므로 **타입체크·lint가 안 돈다** — 수정 후 직접 확인.

## 비표준 규약·함정

- `design/`은 React CDN 프로토타입 + PNG. **빌드 대상 아님**, 시각 참조용. 인덱서 OOM 전례 때문에 tsconfig/eslint/vscode/Tailwind `@source` 네 군데에서 제외돼 있다. 제외를 풀지 말 것. 컴포넌트를 새로 포팅할 때만 열어본다.
- `supabase/functions/`도 같은 이유로 제외. Edge Function 배포 플래그(`verify_jwt: false`)는 **레포에 없다** (config.toml 없음). 함수를 재배포하면 `--no-verify-jwt`를 잊지 말 것 — `respin-roulette`도 anon publishable key로 호출되므로 동일.
- 추첨 시각 11:55는 **네 곳에 흩어져 있다**: `lib/phase.ts`(SPIN_HH/MM), `supabase/functions/spin-roulette/index.ts`(SPIN_HH/MM), `supabase/migrations/0002_cron.sql`(`55 2 * * *`), UI 문구(`app/page.tsx` "11:55", README). 시각 바꾸면 전부.
- `kstNow()`는 두 Edge Function에 복붙돼 있다 (Deno라 `lib/time.ts` 공유 불가).
- RLS는 의도적으로 열려 있다: 누구나 menus insert/delete 가능, results는 service_role만 쓰기. `respin-roulette`는 인증·레이트리밋 없음 — 익명 서비스 설계상 수용한 것.
- 3개 페이지 모두 1초 `setInterval`로 `now`를 갱신해 리렌더한다. 페이즈 전환 감지 목적. 무거운 계산은 `useMemo`로 감쌀 것.
- `.serena/project.yml`은 serena가 켤 때마다 재포맷한다 — diff에 떠도 커밋 대상 아님.
- **`npm run dev` 크래시 원인=stale `.next` 캐시 (2026-09-15 규명·수리·검증 완료).** 3개월 방치된 Turbopack 영속 캐시(`.next/dev/cache` 6월22일)가 컴파일 단계 node fork storm(2.5분 3508개)을 일으켜 메모리 고갈 → 커널 패닉 2회. **코드/설정 무관**(5월 이후 불변, 프로덕션 정상). `rm -rf .next` 후 가드런처로 재기동 검증: Ready 234ms, `GET / 200`, node 1개/RSS 251MB로 정상. **재발 시 `rm -rf .next`**. 증폭기: Next가 dev에 힙 13GB(RAM 50%) 부여 → `NEXT_DISABLE_MEM_OVERRIDE=1`로 완화. → 메모리 `lunch-roulette-dev-server-kernel-panic`.

## 위험 지점

| 위치 | 왜 위험한가 |
|---|---|
| `lib/supabase/client.ts` `ResultRow` | 4개 파일 + 2개 Edge Function이 같은 스키마를 가정. 컬럼 바꾸면 전부 손봐야 하고 타입은 수동 동기화 |
| `app/page.tsx` realtime 핸들러 | INSERT/UPDATE/DELETE 분기 + `initialLoadedRef`로 초기 로드/실시간 구분. 순서 바꾸면 휠 이중 회전 |
| `app/log`, `app/rank` realtime | **INSERT만 구독** → 다시 돌리기(UPDATE)가 반영 안 됨, 새로고침 필요 |
| `components/Wheel.tsx` useEffect | 회전 상태 머신. lint 에러 있는 곳. `lastSpinRef` 가드 제거하면 재회전 루프 |
| `supabase/migrations/0002_cron.sql` | 프로젝트 ref 하드코딩. 다른 Supabase로 옮기면 치환 필수 (README 참조) |
| `winnerIndex` (`app/page.tsx`) | `menus`에서 **이름으로** 찾는다. 당첨 메뉴가 삭제되면 -1 → 휠 하이라이트 사라짐. 중복 이름이면 첫 번째 |
| 클라이언트 쓰기 에러 | `addMenu`/`removeMenu`/`respin`은 supabase 에러를 확인하지 않는다 (조용히 실패) |

미사용 코드: `lib/phase.ts` `msToNextPhase`, `Wheel` `onSpinCompleteAction` prop (참조 0).
