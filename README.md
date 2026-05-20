# 점심 룰렛 (Lunch Roulette)

매일 11:55(KST)에 자동으로 돌아가는 익명 멀티유저 점심 메뉴 룰렛.

## 개요

- 누구나 접속해서 메뉴를 자유롭게 추가 (완전 익명)
- 11:55(KST)에 서버에서 자동으로 룰렛 회전 → 결과 확정
- 결과는 23:59까지 메인에 고정, 자정에 메뉴 초기화
- 확정된 결과는 캘린더/랭킹 탭에 영구 보존

## 스택

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres, Realtime, Edge Functions, pg_cron) — 무료 티어
- Vercel 배포 — 무료 티어

## 로컬 개발

```bash
cp .env.example .env.local       # Supabase URL/anon key 입력
npm install
npm run dev
```

`http://localhost:3000` 접속.

## 디렉토리

```
app/                Next.js 페이지 (오늘 / log / rank)
components/         UI 컴포넌트
lib/                Supabase 클라이언트, KST/페이즈 헬퍼
supabase/           마이그레이션 + Edge Function
design/             React+Babel CDN 프로토타입 (시각 참조용)
```

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new) 접속 → GitHub 로그인
2. `F1rstID/lunch-roulette` 임포트 (Framework: Next.js 자동 감지)
3. **Environment Variables**에 추가 (`.env.local`의 값 그대로):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://swxiqytyxjlcgubqlozk.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_…`
4. Deploy 클릭. 1~2분 후 `*.vercel.app` 도메인 발급
5. (선택) Vercel Project Settings → Domains에서 커스텀 도메인 연결

## Supabase 인프라

- 프로젝트 ref: `swxiqytyxjlcgubqlozk` (region: ap-northeast-2 / Seoul, F1rstID's Org)
- 테이블: `public.menus`, `public.results`
- pg_cron 잡 2개:
  - `spin-lunch-roulette` (`55 2 * * *` UTC = 11:55 KST) → Edge Function 호출
  - `reset-menus` (`0 15 * * *` UTC = 00:00 KST) → `menus` truncate
- Edge Function: `spin-roulette` (`verify_jwt: false`, KST 11:55 이전 호출은 자동 거부, 멱등성 보장)
- 다른 Supabase 프로젝트로 옮길 때는 `supabase/migrations/0002_cron.sql` 안의
  `swxiqytyxjlcgubqlozk`를 새 ref로 모두 치환한 뒤 재적용

## 메모리 사용 주의

VS Code의 백그라운드 인덱서(TS LSP, ESLint, Tailwind IntelliSense)가 `design/`
폴더의 jsx 프로토타입과 큰 PNG들을 한꺼번에 스캔하면 메모리가 폭주할 수 있어,
`.vscode/settings.json`·`eslint.config.mjs`·`tsconfig.json`·`globals.css`의
Tailwind `@source` 모두에서 `design/`·`supabase/functions/`를 제외해 두었다.
이 파일들을 다시 활성화하려는 경우 주의할 것.
