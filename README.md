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
