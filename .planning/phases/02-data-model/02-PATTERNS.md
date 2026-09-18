# Phase 2: 데이터 모델 - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 4 (신규 2 · 수정 2)
**Analogs found:** 4 / 4 (그중 1건은 부분 일치 — `readFileSync` 선례가 레포에 없음)

> **이 페이즈의 핵심 긴장:** 아날로그는 전부 존재하지만 **그대로 베끼면 안 되는 줄이 있다.** `0001_init.sql`은 "한 번만 도는 초기화 파일"로 쓰였기 때문에 무명 `create index`·맨 `create policy`·맨 `alter publication add table`을 쓴다. `0005`는 **재실행 가능**해야 하므로(SHIP-01) 같은 자리에서 형태를 바꿔야 한다. 아래 모든 SQL 패턴에는 **[그대로]/[변형]** 표시를 붙였다. 표시 없이 복사하면 Success Criterion이 깨진다.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/0005_restaurants_settings.sql` (신규) | migration (DDL + cron 등록) | batch / schema-transform | `supabase/migrations/0004_pinned_menus.sql` (구조·주석) + `0001_init.sql` (테이블·RLS·publication) + `0002_cron.sql` (unschedule 루프·`net.http_post`) | exact (합성 아날로그 3개) |
| `supabase/migrations/0005_restaurants_settings.test.ts` (신규) | test (contract spec) | file-I/O → text parse | `components/MenuList.test.ts` (리터럴 기대값 근거 주석) + `lib/errors.test.ts` (describe 분할) + `vitest.config.mts:5-9` (`new URL(..., import.meta.url)`) | role-match / partial — 파일을 읽는 테스트는 레포에 **선례 0건** |
| `lib/supabase/client.ts` (수정) | model (행 타입 계약) | — (타입 선언만) | 자기 자신 `lib/supabase/client.ts:12-30` | exact (self-analog) |
| `vitest.config.mts` (수정) | config | — | 자기 자신 `vitest.config.mts:18-24` | exact (self-analog) |

**프로젝트 스킬 디렉터리:** `.claude/skills` · `.agents/skills` 모두 없음 → 추가 규약 로드 없음. 컨벤션 출처는 `CLAUDE.md`뿐이다.

---

## Pattern Assignments

### `supabase/migrations/0005_restaurants_settings.sql` (migration, batch/schema-transform)

**Primary analog:** `supabase/migrations/0004_pinned_menus.sql` — 가장 최근(2026-09-16) 파일이고, "새 테이블 + RLS + publication + cron 잡 교체"라는 **0005와 동일한 4단 구성**을 이미 갖고 있다. 파일 골격은 여기서 가져온다.

#### 1. 파일/섹션 머리 블록 주석 — 한글 Why [그대로]

`supabase/migrations/0004_pinned_menus.sql:1-3`

```sql
-- 고정(핀) 메뉴: 여기 등록된 이름은 매일 자정 재시드 때 menus 에 자동으로 다시 들어간다.
-- menus 는 매일 truncate 되므로 핀 상태를 그 테이블에 담을 수 없어 별도 영구 테이블로 둔다.
-- name 을 PK 로 — 이름 단위 고정/해제, 중복 핀 자연 방지.
```

레포 컨벤션: `--` 줄 주석 2~3줄, **한글, Why만**, "무엇을 만드는지"가 아니라 "왜 이 형태인지". `/* */` 블록은 레포에 0건이므로 쓰지 않는다. 0005 파일 머리에는 CONTEXT Specific Ideas의 **"동작 불변 원칙"** 문장을 이 형식으로 넣는다.

섹션 배너(`-- ───── N. 제목 ─────`)는 RESEARCH가 제안했을 뿐 **레포 선례가 없다.** 도입하면 0005가 첫 사례다 — 계약 테스트가 섹션을 파싱할 거면 넣고, 아니면 0004식 평문 주석만으로 충분하다(planner 판단).

#### 2. 테이블 생성 [변형 — `if not exists` 추가]

`supabase/migrations/0001_init.sql:2-6` (형태 참조)

```sql
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now()
);
```

| 복사할 것 | 바꿀 것 |
|---|---|
| `public.` 스키마 한정, 2칸 들여쓰기, 컬럼당 한 줄 | `create table` → **`create table if not exists`** |
| `id uuid primary key default gen_random_uuid()` 그대로 | 제약은 **인라인 유지** (`add constraint`에는 `IF NOT EXISTS`가 없다 — RESEARCH Anti-Patterns) |
| `check (char_length(name) between 1 and 24)` 표현식 문자 그대로 (D-16: `lib/constants.ts:8` `MENU_NAME_MAX_LEN = 24`와 같은 값임을 주석으로) | |
| `created_at timestamptz not null default now()` 그대로 | |

`restaurants.name`의 `unique`(CATL-07)도 컬럼 인라인으로 붙인다 → 제약명은 `restaurants_name_key`가 된다(RESEARCH 실측).

#### 3. 인덱스 [변형 — 아날로그가 안티패턴이다] ⚠

`supabase/migrations/0001_init.sql:8` · `:19` — **복사 금지**

```sql
create index on public.menus (created_at);      -- ❌ 무명 = 재실행 시 menus_created_at_idx1 중복 생성
create index on public.results (date desc);     -- ❌ 동일
```

안전형(D-17, RESEARCH Pattern 1):

```sql
create index if not exists candidates_created_at_idx on public.candidates (created_at);
create index if not exists restaurants_pinned_idx    on public.restaurants (pinned);
```

`if not exists`는 **인덱스 이름이 문법적으로 필수**다. 0001의 형태를 흉내 내는 순간 SHIP-01이 깨진다. 이름 정렬(`on` 앞 공백 패딩)은 0004의 정책 줄 정렬 습관과 동일하다.

#### 4. RLS 활성 + 정책 [부분 변형 — 정책은 drop 선행]

`supabase/migrations/0004_pinned_menus.sql:9-13`

```sql
-- RLS: menus 와 동일하게 익명 개방 (로그인 없는 서비스라 누구나 토글)
alter table public.pinned_menus enable row level security;
create policy pinned_read   on public.pinned_menus for select using (true);
create policy pinned_insert on public.pinned_menus for insert with check (true);
create policy pinned_delete on public.pinned_menus for delete using (true);
```

`supabase/migrations/0001_init.sql:25-31` (같은 컨벤션, `results`는 select 정책만)

```sql
-- 익명 read/insert/delete (디자인: no auth라서 누구나 삭제 가능)
create policy menus_read   on public.menus for select using (true);
create policy menus_insert on public.menus for insert with check (true);
create policy menus_delete on public.menus for delete using (true);

-- results: 누구나 읽기, INSERT는 service_role(또는 verify_jwt=false 함수)만
create policy results_read on public.results for select using (true);
```

| 복사할 것 | 바꿀 것 |
|---|---|
| `alter table public.X enable row level security;` — **그대로** (2회 실행 무해, 실측) | |
| 정책 이름 규약 **`{테이블약칭}_{동사}`**: `menus_read`/`pinned_insert`/`results_read` → `restaurants_read`, `candidates_insert`, `settings_read` | `create policy` 앞에 **`drop policy if exists X on public.T;` 한 줄을 반드시 선행**. `create policy if not exists`는 문법 오류다 |
| 정책 이름 컬럼 정렬(`pinned_read  ` 뒤 공백 2칸) | |
| `for select using (true)` / `for insert with check (true)` 형태 | |
| **정책 부재로 권한을 막는 선례가 이미 있다** — 0001:30-31의 `results`. `settings`는 정확히 이 방식을 따른다(select 정책 1건, 쓰기 정책 0건 = SETT-01) | |

#### 5. Realtime publication [변형 — 가드 필수] ⚠

`supabase/migrations/0001_init.sql:33-35` · `0004_pinned_menus.sql:15-16` — **맨 줄은 복사 금지**

```sql
-- Realtime: 핀 토글을 다중 접속에 동기화
alter publication supabase_realtime add table public.pinned_menus;   -- ❌ 재실행 시 ERROR: already member
```

안전형(D-07, RESEARCH Pattern 2) — `do $$ … $$` 가드. 배열 루프 형태는 재량:

```sql
do $$
declare t text;
begin
  foreach t in array array['restaurants', 'candidates', 'settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
```

주석 한 줄은 0004:15 형태("-- Realtime: …")를 유지한다. `alter publication … drop table`은 `drop table` 전에 **불필요**하다(실측).

#### 6. cron 잡 교체 — jobid 루프 unschedule [그대로] ✅

레포가 세 번(0002·0003·0004) 반복한 유일한 멱등 패턴. `cron.unschedule('이름')`은 잡이 없으면 ERROR다(D-18).

`supabase/migrations/0002_cron.sql:5-15` (완전형, `declare` 블록 분리)

```sql
-- 기존 잡이 있으면 제거 (재실행 가능)
do $$
declare
  jid bigint;
begin
  for jid in
    select jobid from cron.job where jobname in ('spin-lunch-roulette', 'reset-menus')
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;
```

`supabase/migrations/0004_pinned_menus.sql:21-26` (압축형 — 최신 파일이 쓴 형태)

```sql
do $$
declare jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'reset-menus'
  loop perform cron.unschedule(jid); end loop;
end $$;
```

0005는 **0002의 `in (...)` 목록형 + 0004의 압축 배치** 조합이 맞다. 목록에 반드시 세 이름이 들어간다: `'spin-lunch-roulette'`, `'reset-menus'`(구 이름 제거 — D-09), `'reset-candidates'`(재실행 대비). D-14의 `'purge-cron-history'`도 같은 목록에.

#### 7. `cron.schedule` 본문 [부분 변형 — timeout 추가]

`supabase/migrations/0002_cron.sql:17-28`

```sql
-- KST 11:55 = UTC 02:55: Edge Function 호출
select cron.schedule(
  'spin-lunch-roulette',
  '55 2 * * *',
  $cmd$
  select net.http_post(
    url := 'https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cmd$
);
```

`supabase/migrations/0004_pinned_menus.sql:28-36` — **스케줄 표현식 옆 인라인 주석**이 이 레포의 관용구다

```sql
select cron.schedule(
  'reset-menus',
  '0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일)
  $cmd$
  truncate table public.menus;                                  -- ❌ 0005 에서 금지 (CAND-04)
  insert into public.menus (name)
  select name from public.pinned_menus order by created_at;     -- ✅ 핀 재시드 선례: order by created_at
  $cmd$
);
```

| 복사할 것 | 바꿀 것 |
|---|---|
| `$cmd$ … $cmd$` 달러 인용, 인자 순서(이름 → 표현식 → 본문), 2칸 들여쓰기 | `'55 2 * * *'` → `'* * * * *'` (D-08). 인라인 주석에 "시각 판정은 Edge Function 이 settings.spin_time 으로 한다"를 남긴다 |
| 표현식 옆 `-- KST 00:00 = UTC 15:00 (전일)` 인라인 계산식 주석 (0004:30) — 낭독 리뷰 체크 3번 항목 | `net.http_post(...)`에 **`timeout_milliseconds := 5000`** 추가 (D-18, Pitfall 7). 0002에 없던 인자이므로 Why 주석 필수 |
| 프로젝트 ref `swxiqytyxjlcgubqlozk` URL 하드코딩 (0002 선례) | 그 옆에 **"다른 프로젝트면 치환"** 주석 추가 (D-08 — 0002에는 없다) |
| 핀 재시드 `select … order by created_at` 구조 (0004:34) | 소스가 `pinned_menus` → `public.restaurants where pinned`, 타깃이 `menus(name)` → `public.candidates (restaurant_id)` |
| | `truncate table` → **`delete from public.candidates;`** (D-09 / CAND-04). 파일 전체에 `truncate` 0건 |

`create extension if not exists pg_net; / pg_cron;`(0002:1-3)은 **다시 쓰지 않는다** — D-10이 "확장(없음, 이미 있음)"으로 명시.

#### 8. `results` 확장 · seed · `comment on` [신규 형태 — 레포 선례 없음]

`alter table … add column if not exists`, `insert … on conflict do nothing`, `comment on column`은 이 레포의 기존 마이그레이션에 **한 번도 등장하지 않는다.** RESEARCH §Pattern 5 / §Code Examples의 실측 스니펫을 정본으로 쓴다. 다만 주변 주석 문체는 위 1번(0004:1-3) 형식을 따른다.

`results` 관련 문은 파일 전체에서 **`add column if not exists` 하나뿐**이어야 한다(HIST-03). `on delete set null` 옆에는 Pitfall 6(매장 삭제 → `results` UPDATE → `app/page.tsx:105-112`의 `applyResult` → 휠 재회전) Why 주석을 남긴다 — 가드는 Phase 6.

#### 9. 구 테이블 제거 [그대로, 파일 최후미]

`drop table if exists public.pinned_menus;` / `drop table if exists public.menus;` — 레포 선례 없음(첫 `drop`). `alter publication … drop table` 선행은 불필요(실측).

---

### `supabase/migrations/0005_restaurants_settings.test.ts` (test, file-I/O → text parse)

**Analog:** `components/MenuList.test.ts` (구조·주석 근거) + `lib/errors.test.ts` (describe 분할) + `vitest.config.mts:5-9` (URL 해석)
**Match quality:** role-match. 레포의 기존 스펙 4개는 전부 **순수 함수 import → 호출 → 단언**이다. **파일을 읽어 텍스트를 파싱하는 스펙은 선례가 0건**이고 `readFileSync`는 레포 어디에도 없다(grep 확인). 아래 (c)는 RESEARCH가 준 신규 패턴이다.

#### (a) 머리 주석 — "이 테스트가 왜 존재하는가" [그대로]

`components/MenuList.test.ts:1-4`

```typescript
// parseMenuInput 의 현재 동작을 회귀 테스트로 못 박는다 (Phase 1 은 동작 변경 금지).
// Phase 5 가 이 함수를 매장 메뉴 입력에 그대로 재사용하므로, 분리·trim·절단·중복 제거의 순서가 계약이다.
// 절단 상한을 MENU_NAME_MAX_LEN 이 아니라 리터럴 24 로 쓰는 이유: 상수를 import 하면 상수 값이 바뀔 때
// 기대값도 같이 움직여 "DB check 제약(char_length 1~24)의 거울" 이라는 사실이 테스트에서 사라진다.
```

**3~4번째 줄이 결정적이다.** RESEARCH가 "기대 컬럼 목록을 리터럴 배열로 적고 타입에서 import 하지 말라"고 한 근거가 이 레포에 **이미 문서화된 선례**다. 0005 스펙 머리 주석은 같은 논증을 SQL↔TS 대조에 적용해 적는다("`lib/supabase/client.ts`를 import 하면 양쪽이 같이 움직여 계약이 사라진다" + "그 모듈은 `NEXT_PUBLIC_SUPABASE_*`를 읽으므로 import 자체가 환경에 묶인다").

`lib/phase.test.ts:1-4`도 같은 형식이며 "테스트하지 않기로 한 것과 그 이유"까지 적는 선례다(`msToNextPhase`).

#### (b) import + describe/it 구조 [그대로]

`components/MenuList.test.ts:6-11` · `lib/errors.test.ts:5-18`

```typescript
import { describe, it, expect } from "vitest";
import { parseMenuInput } from "@/components/MenuList";

describe("parseMenuInput", () => {
  it("기본 쉼표 3개", () => {
    expect(parseMenuInput("김치찌개, 마라탕, 샐러드", [])).toEqual(["김치찌개", "마라탕", "샐러드"]);
  });
```

```typescript
describe("formatLoadError", () => {
  it("에러가 없으면 null 을 준다 (배너 미렌더 신호)", () => {
    expect(formatLoadError("메뉴 목록", null)).toBeNull();
  });
```

규약 (계약 테스트도 동일하게):
- `import { describe, it, expect } from "vitest";` — **명시 import 필수** (`vitest.config.mts:17` `globals: false`, 그 이유가 주석에 적혀 있다).
- `@/` 별칭으로 레포 루트 기준 import (`vitest.config.mts:38-41`의 alias).
- **`it` 이름은 한글 서술문.** 조사 앞 띄어쓰기 습관(`null 을`, `accepting 이다`)까지 일관된다.
- 단언 1개 = `it` 1개. `lib/phase.test.ts:3` 주석의 근거: "어느 경계가 깨졌는지 이름만 보고 알기 위해서" → 0005 스펙도 "무명 인덱스 0건", "`truncate` 0건"을 **각각의 `it`으로** 쪼갠다.
- 의도가 미묘한 케이스에는 `it` 본문 안에 한 줄 Why 주석 (`MenuList.test.ts:47`).
- `describe` 블록은 검사 대상 단위로 분할 (`errors.test.ts`가 함수 2개 → `describe` 2개). 0005는 요구사항 단위(SHIP-01 / SETT-01 / CATL-07 / CAND-04 / HIST-03 / D-13)로 나누는 것이 `02-VALIDATION.md`의 Per-Task Verification Map과 1:1로 맞는다.

#### (c) SQL 파일 읽기 [신규 — 레포 내 유일 인접 선례]

`vitest.config.mts:5-9` — 레포에서 `import.meta.url`을 쓰는 **유일한** 지점

```typescript
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 레포 루트 절대경로 (끝에 슬래시). @/lib/time → <root>/lib/time 으로 이어 붙인다.
const repoRoot = fileURLToPath(new URL("./", import.meta.url));
```

0005 스펙은 같은 `new URL(상대경로, import.meta.url)` 관용구를 쓰되 `readFileSync`와 결합한다(RESEARCH 지정):

```typescript
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("./0005_restaurants_settings.sql", import.meta.url), "utf8");
```

`node:` 접두 import는 `vitest.config.mts:5`가 이미 쓰는 형태다 — 맨 `"fs"`/`"url"`로 쓰지 않는다.
주석 문체도 위와 같이 **"무엇"이 아니라 "왜 이 형태인지"**(예: 주석 제거 사본과 원본 두 벌을 드는 이유).

---

### `lib/supabase/client.ts` (model, 타입 계약 — 수정)

**Analog:** 자기 자신 `lib/supabase/client.ts:12-30`. 새 타입 3개는 기존 블록 바로 아래에 같은 형식으로 덧붙인다.

```typescript
export type MenuRow = {
  id: string;
  name: string;
  created_at: string;
};

export type ResultRow = {
  id: string;
  date: string;
  menu: string;
  candidates: { name: string }[];
  spun_at: string;
};

// 고정 메뉴. 매일 자정 재시드의 소스 (supabase/migrations/0004_pinned_menus.sql).
export type PinnedMenuRow = {
  name: string;
  created_at: string;
};
```

복사할 규약:
- `export type XRow = { … };` — interface 아님, 모두 named export.
- 필드는 **SQL 컬럼 순서 그대로**, 타입은 PostgREST 직렬화형(`timestamptz`/`date`/`time` → `string`).
- **타입 위 한 줄 주석에 출처 마이그레이션 파일 경로를 적는다** (`:26`) → 새 3개 타입은 `(supabase/migrations/0005_restaurants_settings.sql)`로. 이 한 줄이 "수동 유지 타입"의 추적 수단이다(CLAUDE.md: 유일한 정의처, 자동 생성 아님).
- 필드 옆 의미 주석은 D-13/RESEARCH 지정 문구를 쓴다(`spin_time` → `"HH:MM:SS"`, `cooldown_days` → `0 = 끔`).
- `ResultRow.menu`에는 **매장명 스냅샷**이라는 의미 변화 주석을 추가(D-04) — 필드 이름은 그대로.
- `MenuRow`·`PinnedMenuRow`는 **삭제하지 않는다**(D-13 — `app/page.tsx` 등이 참조, 지우면 `tsc` 깨짐).
- 파일 상단 `"use client"` + `createClient` 블록(1-10)은 **무변경**.

주의: 이 모듈은 로드 시점에 `process.env.NEXT_PUBLIC_SUPABASE_*`를 읽는다(5-6행). `lib/constants.ts:1-4`가 상수를 따로 뺀 이유가 정확히 이것이며, 계약 테스트가 이 파일을 import하지 않고 **텍스트로 파싱**해야 하는 이유이기도 하다.

---

### `vitest.config.mts` (config — 수정)

**Analog:** 자기 자신 `vitest.config.mts:18-24`

```typescript
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      // Phase 3 이 만들 Deno 공유 순수 로직 자리. 지금은 매치되는 파일이 0개이고 그래도 무해하다 —
      // 미리 넣어 두는 이유는 그때 이 설정을 다시 건드리지 않게 하기 위해서다.
      "supabase/functions/_shared/**/*.test.ts",
    ],
```

- 추가는 **`"supabase/migrations/**/*.test.ts"` 한 줄뿐**. 패턴은 `디렉터리/**/*.test.ts` 형태로 통일.
- 설명이 필요한 항목에는 **바로 위에 Why 주석**(21-22행 선례). 이 줄은 자명하므로 주석 없이 넣거나 한 줄이면 충분하다.
- **`exclude` 배열은 절대 건드리지 않는다.** `:33-35`에 `supabase/functions/!(_shared)/**` extglob을 "줄이지 말 것"이라는 경고가 이미 적혀 있다(Phase 1 결정). `.planning/**` 제외도 유지.

---

## Shared Patterns

### 한글 Why 주석 (전 파일 공통)
**Source:** `supabase/migrations/0004_pinned_menus.sql:1-3` (SQL) · `components/MenuList.test.ts:1-4` (TS) · `lib/constants.ts:1-4` (TS)
**Apply to:** 4개 파일 전부
파일 머리에 역할·제약을 주석 블록으로. 문장은 **왜 이 형태를 골랐는지**와 **무엇을 하지 말아야 하는지**를 적는다. "무엇을 한다"만 적힌 주석은 이 레포 스타일이 아니다. `lib/constants.ts:4`("여기에는 환경변수를 읽는 코드를 절대 넣지 않는다")처럼 **금지문을 남기는 것**이 관용구다.

### 멱등 재등록 (`do $$ … $$` 루프)
**Source:** `supabase/migrations/0002_cron.sql:5-15` · `0003_reseed_menus.sql:5-13` · `0004_pinned_menus.sql:21-26`
**Apply to:** `0005`의 cron 교체 + (같은 골격을 빌려) publication 가드
세 파일이 반복한 레포 정본. 이름 인자 `cron.unschedule('name')`은 **금지**(D-18).

### 정책 이름 `{테이블}_{동사}`
**Source:** `0001_init.sql:26-31` · `0004_pinned_menus.sql:11-13`
**Apply to:** `restaurants_read/insert/update/delete`, `candidates_*`, `settings_read`
**변형:** 각 `create policy` 앞에 `drop policy if exists`를 쌍으로. 계약 테스트가 "`create policy` 개수 == `drop policy if exists` 개수"를 검사한다(RESEARCH).

### "정책을 만들지 않음으로써 막는다"
**Source:** `0001_init.sql:30-31` — `results`에 select 정책만 두고 쓰기 정책을 만들지 않은 선례
**Apply to:** `settings` (SETT-01). 앱 코드에 "편집 금지" 분기를 만들지 않는다. 이 페이즈 최대 보안 리스크는 실수로 `settings_write` 정책을 추가하는 것이다.

### vitest 스펙 골격
**Source:** `components/MenuList.test.ts:6-11` · `lib/errors.test.ts:5-18` · `lib/phase.test.ts:6-9`
**Apply to:** `0005_restaurants_settings.test.ts`
`import { describe, it, expect } from "vitest";` + `@/` 별칭 + 한글 `it` 이름 + 단언당 `it` 하나 + **기대값은 리터럴**(상수/타입에서 import 금지, 근거는 `MenuList.test.ts:3-4`).

### 실행 검증 명령
**Source:** `package.json:9-11` · `.planning/phases/02-data-model/02-VALIDATION.md:22-23`
**Apply to:** 모든 태스크
`npx vitest run supabase/migrations` (빠른 피드백) → `npm test` → `npx tsc --noEmit` → `npm run lint` → `npm run build`.
`tsconfig.json:33`의 `exclude`에 `supabase/migrations`가 **없으므로** 새 `.test.ts`는 `tsc`·eslint 대상에 자동 포함된다(RESEARCH A6).

---

## Anti-Patterns in the Analogs (복사 금지 목록)

아날로그 파일에 실재하지만 0005가 **따라 하면 안 되는** 줄. 계약 테스트가 이 6개를 그대로 검사 항목으로 삼는다.

| 아날로그 위치 | 복사 금지 코드 | 0005의 안전형 | 근거 |
|---|---|---|---|
| `0001_init.sql:8`, `:19` | `create index on public.X (col);` | `create index if not exists X_col_idx on public.X (col)` | 재실행 시 `_idx1` 중복 생성 (실측) |
| `0001_init.sql:2`, `:11`, `0004:4` | `create table public.X (` | `create table if not exists` | 2회차 ERROR |
| `0001_init.sql:34-35`, `0004:16` | `alter publication supabase_realtime add table public.X;` | `pg_publication_tables` 가드 안의 `execute` | 2회차 ERROR: already member |
| `0001_init.sql:26-31`, `0004:11-13` | 맨 `create policy X on …` | `drop policy if exists X on public.T;` + `create policy` | 2회차 ERROR (`if not exists`는 문법 오류) |
| `0002:34`, `0003:20`, `0004:32` | `truncate table public.menus;` | `delete from public.candidates;` | Realtime DELETE 미전파 (CAND-04, 실측) |
| `0002:22-26` | `net.http_post(url, headers, body)` (timeout 없음) | `timeout_milliseconds := 5000` 추가 | pg_net 기본 2000ms는 콜드스타트에 짧다 (Pitfall 7) |

추가로 `0002:1-3`의 `create extension …`은 **중복 실행할 이유가 없다**(D-10: 확장은 이미 있음).

---

## No Analog Found

| File / 요소 | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `0005` 내 `alter table … add column if not exists` (D-04) | migration | schema-transform | 레포의 기존 마이그레이션 4개에 `alter table … add column`이 **0건**. RESEARCH §재실행 가능성 매트릭스의 실측 스니펫을 정본으로 |
| `0005` 내 `insert … on conflict (id) do nothing` (settings seed) | migration | schema-transform | 레포에 `on conflict` 0건. RESEARCH §Pattern 5 |
| `0005` 내 `comment on column` | migration | metadata | 레포에 0건. RESEARCH §Code Examples 3줄 그대로 |
| `0005` 내 `drop table if exists` | migration | schema-transform | 레포 최초의 테이블 제거 |
| `0005` 내 `foreach … in array` / `format(… %I)` publication 가드 | migration | schema-transform | `do $$` 블록 골격은 0002~0004에 있으나 배열 루프·`execute format`은 선례 없음. RESEARCH §Pattern 2 |
| `0005_…test.ts`의 `readFileSync` + 정규식 파싱 | test | file-I/O | 레포 스펙 4개는 전부 순수 함수 호출. **파일을 읽는 테스트가 처음**이다. `new URL(…, import.meta.url)` 관용구만 `vitest.config.mts:9`에서 빌려 온다 |
| `restaurants` 다중 컬럼 테이블(`text[]`, nullable `location`, `boolean`) | migration | — | 기존 테이블은 전부 3~5컬럼 단순형. `text[]` 컬럼은 레포 최초 |

이 항목들은 planner가 **RESEARCH.md의 검증된 스니펫**을 출처로 인용해야 한다 — 레포 아날로그를 억지로 끌어오면 잘못된 형태가 나온다.

---

## Metadata

**Analog search scope:** `supabase/migrations/` (4파일 전량), `supabase/functions/` 목록, `lib/` (`supabase/client.ts`, `constants.ts`, `errors.test.ts`, `phase.test.ts`), `components/` (`MenuList.test.ts`), 루트 설정(`vitest.config.mts`, `tsconfig.json`, `package.json`, `supabase/config.toml`), `app/page.tsx` realtime 핸들러 구간
**Files scanned:** 15 (전량 읽기 11 · 부분 읽기 1 · 목록·grep 확인 3)
**Grep 확인:** `readFileSync|import.meta.url|fileURLToPath` → 레포 내 히트 1건(`vitest.config.mts`)뿐 · `.claude/skills`·`.agents/skills` 부재
**Pattern extraction date:** 2026-09-18
