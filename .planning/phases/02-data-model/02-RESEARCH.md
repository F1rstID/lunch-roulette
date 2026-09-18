# Phase 2: 데이터 모델 - Research

**Researched:** 2026-09-18
**Domain:** PostgreSQL DDL 재실행 가능 마이그레이션 · Supabase RLS/Realtime/pg_cron/pg_net · PostgREST 타입 직렬화 · 수동 유지 TS 행 타입
**Confidence:** HIGH (핵심 SQL 동작 11건을 실제 PostgreSQL 17.11 컨테이너에서 실행해 확인했다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 테이블 설계 (사용자 승인, 변경 금지)
- **D-01** `restaurants` 영구 카탈로그: `id uuid pk default gen_random_uuid()`, `name text not null unique check (char_length(name) between 1 and 24)`, `menus text[] not null default '{}'`, `location text` (null 허용, 한 줄), `pinned boolean not null default false`, `created_at timestamptz not null default now()`. 자정에 지워지지 않는다.
- **D-02** `candidates` 오늘 후보: `restaurant_id uuid primary key references restaurants(id) on delete cascade`, `created_at timestamptz not null default now()`. PK가 곧 "같은 매장 중복 담기 방지". 자정 `delete from public.candidates` 후 `pinned = true` 매장 재시드(`insert … select id from restaurants where pinned order by created_at`).
- **D-03** `settings` 단일행 타입 컬럼(key-value·env 기각): `id int primary key check (id = 1)`, `spin_time time not null default '11:55'`, `cooldown_days int not null default 0 check (cooldown_days >= 0)` (0 = 끔), `history_since date not null default ((now() at time zone 'Asia/Seoul')::date)` (전환일 = 적용일 자동). `updated_at` 없음(트리거 없이는 오해 유발, 앱이 안 읽음). `respin_limit_per_day` 없음(사용자: 무제한).
- **D-04** `results`: 기존 행 보존·변환 없음. `menu text` 컬럼은 **매장명 스냅샷**으로 의미만 바뀜(이름 유지). `alter table … add column if not exists restaurant_id uuid references restaurants(id) on delete set null`. `candidates jsonb`는 그대로 두되 새 행부터 `[{ "name": …, "restaurant_id": … }]` 형태(Phase 4 소관, 스키마 변경 없음).
- **D-05** 마이그레이션 적용 직후 동작 = 현재와 동일: 11:55 추첨, 쿨다운 없음. 동작 변경은 대시보드 UPDATE로만.

#### RLS·Realtime (사용자 승인)
- **D-06** `restaurants`·`candidates`: anon select/insert/update/delete 전부 개방 (`using (true)` / `with check (true)`) — 익명 서비스 설계 유지. `settings`: anon **select만** (insert/update/delete 정책 없음 → 대시보드·service_role만). `results`: 기존 정책 유지(select anon, 쓰기 service_role).
- **D-07** `alter publication supabase_realtime add table` 3건: `restaurants`, `candidates`, `settings`. (`results`는 이미 등록됨.) 재실행 안전을 위해 `do $$ … if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='…') …` 가드.

#### cron (사용자 승인: 매분 폴링)
- **D-08** `spin-lunch-roulette`: unschedule → `* * * * *` 재등록. 본문은 0002와 동일한 `net.http_post` (URL의 프로젝트 ref `swxiqytyxjlcgubqlozk` 하드코딩 — 0002 선례, 주석으로 "다른 프로젝트면 치환" 명시). 시각 판정은 함수가 `settings.spin_time`으로(Phase 4).
- **D-09** `reset-menus` → 잡 이름 `reset-candidates`로 교체(구 이름 unschedule): `0 15 * * *`(KST 00:00), 본문 `delete from public.candidates; insert into public.candidates (restaurant_id) select id from public.restaurants where pinned order by created_at;`. **`truncate` 0회**(Realtime DELETE 이벤트 필요).

#### 순서·재실행 (SHIP-01)
- **D-10** 파일 순서: 확장(없음, 이미 있음) → `restaurants` → `candidates` → `settings` + seed `insert … on conflict (id) do nothing` → `results.restaurant_id` → RLS(`drop policy if exists` → `create policy`) → publication 가드 → cron 교체 → **마지막에** `drop table if exists public.pinned_menus; drop table if exists public.menus;`. 모든 문이 `if not exists` / `if exists` / unschedule→schedule 중 하나.
- **D-11** 데이터 이관 없음: 오늘 `menus`(0행)·`pinned_menus`(0행)는 버림. `results` 60행은 무접촉(`grep -n 'results' 0005` 결과가 `add column`·정책 유지 외 없어야 함).
- **D-12** 롤백 SQL은 별도 파일이 아니라 Phase 8 문서(SHIP-02)에 둔다. 이 페이즈는 forward 파일만.

#### TS 타입 (`lib/supabase/client.ts`, 수동 유지)
- **D-13** `RestaurantRow { id: string; name: string; menus: string[]; location: string | null; pinned: boolean; created_at: string }`, `CandidateRow { restaurant_id: string; created_at: string }`, `SettingsRow { id: 1; spin_time: string /* "HH:MM:SS" PostgREST */; cooldown_days: number; history_since: string /* "yyyy-mm-dd" */ }`, `ResultRow`에 `restaurant_id: string | null` 추가(기존 필드 유지). `MenuRow`·`PinnedMenuRow`는 **이 페이즈에서 삭제하지 않는다** — 페이지가 아직 쓰므로 Phase 6에서 제거 (tsc 깨짐 방지).

### Claude's Discretion
- 마이그레이션 파일명(`0005_restaurants_settings.sql` 권장), 주석 문안(한글 Why), 인덱스(`candidates(created_at)`, `restaurants(pinned)` 정도), `settings` seed 방식, publication 가드 함수 형태.
- `history_since` 기본값 표현식의 정확한 형태(KST 기준 오늘이면 됨).

### Deferred Ideas (OUT OF SCOPE)
- `results.candidates` jsonb 형태 변경(restaurant_id 포함) — Phase 4 (함수가 쓰는 쪽)
- `MenuRow`·`PinnedMenuRow` 타입 삭제 — Phase 6 (페이지 교체 후)
- 롤백 SQL 문서 — Phase 8 (SHIP-02)
- 이름 기준 `winnerIndex` → id 기준 — Phase 6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHIP-01 | 컷오버 마이그레이션 1개: 3테이블 생성, RLS·Realtime 등록, cron 교체, 구 테이블 제거. **재실행 가능** | 재실행 가능성의 실제 경계를 문·단위로 검증했다(§재실행 가능성 매트릭스). 무명 `create index`·`alter publication add table`·`create policy`·`cron.unschedule(name)` 4가지가 재실행 시 **실패하거나 중복을 만든다** — 각각의 안전형을 코드 예제로 제시 |
| SETT-01 | `settings` 단일행 존재, anon은 읽기만, 편집은 대시보드에서만 | Supabase는 public 스키마 새 테이블에 anon DML 권한을 **기본 부여**한다 → `enable row level security` 누락 = 익명 쓰기 전면 개방. 정책 0건 = 기본 거부(default-deny)가 SETT-01의 실제 메커니즘 (§Security Domain) |
| CATL-07 | 같은 이름의 매장은 중복 등록되지 않는다 (DB unique) | `name text not null unique` → `restaurants_name_key`. 위반 시 23505 raw 메시지가 클라이언트에 그대로 노출된다(기존 핀 토글 버그와 동일 경로) — 번역은 Phase 5 소관이나 제약 이름을 RESEARCH에 남긴다 |
| CAND-04 | 자정에 후보가 비워지고 핀 매장만 재시드. **열린 탭에도 반영** | 논리 디코딩 출력으로 직접 확인: `delete from`은 행당 DELETE 메시지(PK 포함), `truncate`는 TRUNCATE 메시지 1건뿐 → Realtime `postgres_changes`에 DELETE가 안 온다. `truncate` 금지의 근거가 실측으로 확정됨 |
| HIST-03 | 전환 이전 `results` 60행 DB 보존 (삭제·변환 없음) | `add column if not exists`는 재실행 시 컬럼·FK 모두 스킵(중복 제약 없음)을 실측 확인. 파일 내 `results` 등장 지점을 자동 검사하는 계약 테스트를 §Validation Architecture에 정의 |
</phase_requirements>

## Summary

이 페이즈의 기술적 난이도는 스키마 설계가 아니라 **"실행해 볼 수 없는 SQL을 한 번에 맞히기"** 에 있다. 설계는 CONTEXT.md D-01~D-13으로 이미 잠겨 있고, 로컬 Supabase 스택이 없어 파일은 Phase 8에 라이브 DB에서 **처음이자 한 번에** 돈다. 따라서 연구의 초점은 "어떤 문이 재실행에 안전한가"를 추측이 아니라 사실로 확정하는 것이었다. Docker가 로컬에 있었으므로 `postgres:17-alpine` 컨테이너를 띄워 D-10이 요구하는 재실행 가능성 주장을 문 단위로 실측했다.

결과 중 **계획을 바꾸는 것이 4건**이다. (1) 이름 없는 `create index on public.t (col)`은 재실행 시 `t_col_idx1`이라는 **두 번째 인덱스를 조용히 만든다** — 0001_init.sql이 쓴 형태가 바로 이것이라 그대로 흉내 내면 "모든 문이 멱등"이라는 Success Criterion 5가 깨진다. `create index if not exists`는 **이름이 필수**다. (2) `alter publication supabase_realtime add table`은 재실행 시 ERROR로 트랜잭션을 끊는다 — D-07의 `pg_publication_tables` 가드는 선택이 아니라 필수이며, 가드 형태의 멱등성도 확인했다. (3) `cron.unschedule('이름')`은 잡이 없으면 ERROR를 던진다(`could not find valid entry for job '%s'`) — 레포가 이미 쓰는 "jobid 루프" 패턴만이 멱등이다. (4) 매분 폴링은 `cron.job_run_details`에 하루 1,440행을 쌓는데 pg_cron은 이 테이블을 **자동으로 비우지 않는다** — 500MB 무료 티어에서 1년이면 무시 못 할 크기다. 세 번째 정리 잡을 추가할지가 이 페이즈에서 유일하게 남은 사용자 판단이다(§Open Questions Q1).

추가로 Realtime 관련 두 가지를 논리 디코딩 출력으로 직접 확인했다. `delete from candidates`는 행마다 DELETE 메시지를 내고 old-record에 PK(`restaurant_id`)가 실려 온다 — CAND-04가 성립한다. 그리고 매장 삭제 시 cascade가 `candidates` DELETE를 내는 것과 **동시에** `results`에 `restaurant_id = null` UPDATE를 낸다. 이 UPDATE는 `app/page.tsx`가 이미 구독 중인 `results` UPDATE 핸들러에 걸려 **휠이 이유 없이 다시 도는** 동작을 만든다(§Pitfall 6). Phase 2에서 코드로 고칠 일은 아니지만, 마이그레이션 주석과 Phase 5·6 인수인계에 반드시 남겨야 한다.

**Primary recommendation:** D-10의 순서를 그대로 지키되 **모든 인덱스에 이름을 붙이고**, publication은 `do $$ if not exists (pg_publication_tables) $$` 가드로, cron은 jobid 루프 unschedule로 쓴다. 그리고 "grep 체크리스트"를 사람 손이 아니라 `supabase/migrations/0005_restaurants_settings.test.ts` vitest 계약 테스트로 자동화한다 — SQL을 실행할 수 없는 이 페이즈에서 회귀를 붙잡을 수 있는 유일한 자동 장치다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 매장 카탈로그 영속(`restaurants`) | Database / Storage | — | 영구 데이터. 앱은 PostgREST로 직접 CRUD |
| 오늘 후보 집합(`candidates`) | Database / Storage | — | PK가 곧 중복 방지 제약. "담기"는 INSERT, "빼기"는 DELETE |
| 이름 중복 방지(CATL-07) | Database / Storage | Browser / Client | DB unique가 정본. 클라이언트 필터는 UX 보조일 뿐 경합에서 깨진다(기존 `menus` 버그 선례) |
| 설정 단일 출처(`settings`) | Database / Storage | — | 앱·Edge Function 양쪽이 같은 행을 읽는다. env·코드 상수 기각 |
| 설정 쓰기 권한 차단 | Database / Storage (RLS) | — | 정책 부재 = 기본 거부. 앱 코드에 "편집 금지" 로직을 두지 않는다 |
| 자정 후보 리셋(CAND-04) | Database / Storage (pg_cron) | — | DB 안에서 완결. Edge Function 왕복 불필요 |
| 추첨 트리거(매분 폴링) | Database / Storage (pg_cron + pg_net) | API / Backend (Edge Function) | cron은 "때리기"만, 시각·쿨다운 판정은 Edge Function(Phase 4) |
| 변경 브로드캐스트 | Database / Storage (logical replication) | Browser / Client | `supabase_realtime` publication 멤버십이 없으면 클라이언트가 아무리 구독해도 이벤트가 0건 |
| 행 타입 계약 | Browser / Client (`lib/supabase/client.ts`) | — | 자동 생성 아님. SQL ↔ TS 동기화는 사람이 책임지므로 테스트로 고정한다 |

**주의:** 이 페이즈는 위 표의 Browser/Client 열에 **코드를 쓰지 않는다**(타입 선언 제외). 클라이언트 구현은 Phase 5·6이다.

## Standard Stack

### Core

이 페이즈가 쓰는 "스택"은 전부 Supabase 플랫폼에 **이미 설치·활성화되어 있는 것들**이다. 새로 추가하는 런타임 의존은 0개다.

| 구성요소 | 버전 | 용도 | 왜 표준인가 |
|---------|------|------|------------|
| PostgreSQL (Supabase 호스팅) | 15~17 계열 (프로젝트 실제 버전 미확인 — §Assumptions A1) | 스키마 정본 | 이 페이즈가 쓰는 문법(`add column if not exists`, `drop policy if exists`, `create index if not exists`)은 모두 PG 9.6+ 기능이라 버전 차이가 없다 [VERIFIED: PostgreSQL 17.11 컨테이너 실행] |
| pg_cron | Supabase 기본 제공, 이미 활성화 (`0002_cron.sql`) | 스케줄러 | DB 안에서 완결. 외부 스케줄러 무료 티어 도입 불필요 [CITED: supabase.com/docs/guides/cron] |
| pg_net | Supabase 기본 제공, 이미 활성화 | cron → Edge Function HTTP | 비동기 fire-and-forget. 트랜잭션 커밋 후 발사 [CITED: supabase.com/docs/guides/database/extensions/pg_net] |
| Supabase Realtime (`supabase_realtime` publication) | 플랫폼 제공 | `postgres_changes` 브로드캐스트 | 앱 3개 페이지가 이미 이 방식에 배선돼 있다 |
| PostgREST | 플랫폼 제공 | 클라이언트 CRUD·JSON 직렬화 | `SettingsRow`·`RestaurantRow` 타입 문자열 형태의 근거 |
| TypeScript | 5.x (레포 `^5`) | 행 타입 계약 | 자동 생성 미도입이 레포의 명시적 선택(CLAUDE.md) |
| vitest | 4.1.11 (정확 고정) | 마이그레이션 계약 테스트 | Phase 1이 이미 깔아 둔 러너. 새 설치 0 |

### Supporting

| 구성요소 | 버전 | 용도 | 언제 쓰나 |
|---------|------|------|----------|
| Docker + `postgres:17-alpine` | Docker 29.2.0 (로컬 확인), 이미지 415MB (이번 연구에서 pull 완료) | 마이그레이션 드라이런(선택) | SQL 문법·멱등성을 **실제로** 돌려 보고 싶을 때. Supabase 전용 객체는 스텁 프렐류드로 대체 (§Pattern 6) |

### Alternatives Considered

| 대신 | 쓸 수도 있는 것 | 트레이드오프 |
|------|----------------|-------------|
| 수동 TS 행 타입 | `supabase gen types typescript` | Supabase CLI가 로컬에 없고(§Environment) 원격 DB 접근이 필요하다. 적용 전에는 새 스키마가 원격에 없으므로 **Phase 2에서는 원리적으로 불가능**. Phase 8 이후 도입 검토 가치는 있음 |
| `supabase db diff`/로컬 스택 | Supabase CLI + Docker 로컬 스택 | CLI 미설치 + 컨테이너 여러 개(48개 이미 구동 중) + 커널 패닉 이력. CONTEXT의 페이즈 경계가 명시적으로 제외 |
| `settings` key-value 테이블 | `(key text pk, value jsonb)` | **사용자가 이미 기각**(D-03). 타입 컬럼이 check 제약·기본값·TS 타입 모두에서 강하다 |
| `truncate` + 재시드 | 현행 `0004` 방식 | **금지**(D-09/CAND-04). 실측으로 Realtime DELETE 미발생 확정 |

**Installation:** 없음. 이 페이즈는 패키지를 설치하지 않는다.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none)* | — | — | — | — | — | 이 페이즈는 외부 패키지를 설치하지 않는다 |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

이 페이즈의 산출물은 SQL 파일 1개 + `lib/supabase/client.ts` 타입 수정 + (권장) vitest 스펙 1개다. `package.json`은 변경되지 않는다. 계획서에 `npm install`이 등장하면 그 자체가 범위 이탈 신호다.

## Architecture Patterns

### System Architecture Diagram

```
                       [ 브라우저 (3개 탭/페이지) ]
                          │  supabase-js (anon publishable key)
              ┌───────────┼───────────────────────────┐
              │           │                           │
        PostgREST      Realtime                 functions.invoke
        (CRUD)         (WebSocket)              (respin only)
              │           ▲                           │
              ▼           │ postgres_changes           ▼
   ┌──────────────────────┴───────────────────────────────────┐
   │                  Supabase Postgres                       │
   │                                                          │
   │  restaurants ──┬─(on delete cascade)──► candidates       │
   │   (영구)        │                         (오늘 후보)      │
   │                └─(on delete set null)──► results         │
   │                                           (영구·불변)     │
   │  settings (id=1 단일행) ──읽기만(anon)                      │
   │                                                          │
   │  ── RLS ──► 행 접근 판정 (Realtime도 같은 정책 통과 필요)     │
   │  ── publication supabase_realtime ──► WAL → Realtime      │
   │                                                          │
   │  pg_cron                                                 │
   │   ├ reset-candidates  (0 15 * * *  = KST 00:00)          │
   │   │    delete from candidates;  ← 행 단위 DELETE 이벤트     │
   │   │    insert … select id from restaurants where pinned   │
   │   └ spin-lunch-roulette (* * * * *  매분)                 │
   │        net.http_post ──────────┐  (fire-and-forget)      │
   └────────────────────────────────┼─────────────────────────┘
                                    ▼
                     [ Edge Function: spin-roulette ]  (Phase 4)
                       settings.spin_time 판정 → 쿨다운 필터
                       → results INSERT (service_role)
                                    │
                                    └──► WAL → Realtime → 모든 탭 동시 갱신
```

핵심 흐름 3개: **(a)** 사용자 조작은 브라우저 → PostgREST → 테이블 → WAL → Realtime → 모든 탭. **(b)** 자정 리셋은 DB 내부에서 완결(외부 왕복 없음)하고 DELETE/INSERT 이벤트로 탭에 전파된다. **(c)** 추첨은 cron이 매분 함수를 때리고, 판정과 쓰기는 전부 함수 쪽이다 — cron SQL에는 시각 로직이 없다.

### Recommended Project Structure

```
supabase/migrations/
├── 0001_init.sql                        # 기존 (menus·results·RLS·publication)
├── 0002_cron.sql                        # 기존 (확장·cron 2잡·프로젝트 ref)
├── 0003_reseed_menus.sql                # 기존 (reset 잡 2차)
├── 0004_pinned_menus.sql                # 기존 (reset 잡 3차·현행)
├── 0005_restaurants_settings.sql        # ★ 이 페이즈 산출물 (컷오버 1파일)
└── 0005_restaurants_settings.test.ts    # ★ 계약 테스트 (권장, §Validation)

lib/supabase/
└── client.ts                            # ★ 행 타입 추가 (D-13)
```

파일 안 섹션 순서는 D-10이 잠갔다. 각 섹션 머리에 `-- ───── N. 제목 ─────` 형태의 배너 주석을 두면 낭독 리뷰와 계약 테스트의 섹션 파싱이 둘 다 쉬워진다.

### Pattern 1: 인덱스는 반드시 이름을 준다 (무명 인덱스 = 비멱등)

**What:** `create index if not exists <이름> on public.t (col);`
**When to use:** 이 파일의 모든 인덱스. 예외 없음.
**왜:** 이름을 생략한 `create index on public.menus (created_at)`(0001 선례)는 재실행 시 `menus_created_at_idx1`을 **새로 만든다**. 그리고 `IF NOT EXISTS`는 이름이 없으면 문법 오류다.

```sql
-- Source: 실측 (PostgreSQL 17.11 컨테이너)
-- 무명 인덱스를 두 번 실행한 결과:
--   t_idx_created_at_idx
--   t_idx_created_at_idx1   ← 중복 생성됨
-- 안전형:
create index if not exists candidates_created_at_idx on public.candidates (created_at);
create index if not exists restaurants_pinned_idx    on public.restaurants (pinned);
```

> [CITED: postgresql.org/docs/current/sql-createindex.html] "Index name is required when `IF NOT EXISTS` is specified."

### Pattern 2: publication 추가는 `pg_publication_tables` 가드로 감싼다

**What:** 존재 검사 후 `execute`
**When to use:** D-07의 3건 전부.
**왜:** `alter publication … add table`은 IF NOT EXISTS 절이 없고, 이미 멤버면 ERROR로 스크립트를 끊는다.

```sql
-- Source: 실측. 재실행 시 실제 에러 메시지:
--   ERROR: relation "t_idx" is already member of publication "supabase_realtime"
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurants'
  ) then
    execute 'alter publication supabase_realtime add table public.restaurants';
  end if;
end $$;
```

3개 테이블에 같은 블록을 3번 쓰는 대신 배열 루프 하나로 줄여도 된다(가드 형태는 Claude 재량):

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

`format(… %I)`은 식별자 인용까지 처리한다. 배열 리터럴은 코드 안 상수이므로 주입 경로가 없다.

### Pattern 3: 정책은 `drop policy if exists` → `create policy`

**What:** 삭제 후 생성 쌍
**왜:** `create policy if not exists`는 **존재하지 않는 문법**이다(실측: `ERROR: syntax error at or near "not"`). `drop policy if exists`는 없을 때 NOTICE만 남기고 통과한다.

```sql
-- Source: 실측
alter table public.settings enable row level security;   -- 두 번 실행해도 무해 (실측 확인)

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
-- settings 에는 insert/update/delete 정책을 만들지 않는다 → RLS 기본 거부 = SETT-01
```

### Pattern 4: cron 교체는 jobid 루프 unschedule → schedule (레포 선례 유지)

**왜:** `cron.unschedule('이름')`은 잡이 없으면 예외를 던진다.

> [CITED: github.com/citusdata/pg_cron `src/job_metadata.c`] `ereport(ERROR, (errmsg("could not find valid entry for job '%s'", jobName)));`

```sql
-- 0002/0003/0004 가 이미 쓰는 패턴. 구 이름(reset-menus)도 같은 목록에 넣어 함께 제거한다.
do $$
declare jid bigint;
begin
  for jid in
    select jobid from cron.job
    where jobname in ('spin-lunch-roulette', 'reset-menus', 'reset-candidates')
  loop
    perform cron.unschedule(jid);
  end loop;
end $$;

select cron.schedule(
  'spin-lunch-roulette',
  '* * * * *',   -- 매분 폴링. 시각 판정은 Edge Function 이 settings.spin_time 으로 한다
  $cmd$
  select net.http_post(
    url := 'https://swxiqytyxjlcgubqlozk.supabase.co/functions/v1/spin-roulette',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 5000   -- pg_net 기본값 2000ms 는 콜드스타트에 짧다
  );
  $cmd$
);

select cron.schedule(
  'reset-candidates',
  '0 15 * * *',  -- KST 00:00 = UTC 15:00 (전일). pg_cron 기본 타임존은 GMT
  $cmd$
  delete from public.candidates;
  insert into public.candidates (restaurant_id)
  select id from public.restaurants where pinned order by created_at;
  $cmd$
);
```

cron 잡 본문은 **문자열**이라 등록 시점에 파싱되지 않는다. 따라서 "잡을 먼저 교체하고 나중에 `menus`를 drop"하는 D-10 순서는 필수가 아니라 **위생**이다(순서가 반대여도 등록은 성공한다). 그러나 잡을 교체하지 않은 채 테이블만 drop하면 매일 UTC 15:00에 잡이 실패하며 `cron.job_run_details`에 에러가 쌓이고 아무도 알아채지 못한다. D-10 순서를 지킨다.

### Pattern 5: 단일행 seed는 `on conflict do nothing` — 재실행이 사용자 편집을 되돌리지 않는다

```sql
-- Source: 실측. seed → 대시보드 UPDATE → 재실행 후에도 UPDATE 값이 그대로 남는다
insert into public.settings (id) values (1) on conflict (id) do nothing;
```

`history_since`의 기본값은 **최초 insert가 성공한 시점**에 한 번만 평가된다. 재실행 시 `do nothing`이므로 전환일이 오늘로 밀리지 않는다 — D-03의 "전환일 = 적용일 자동"이 정확히 이 방식으로 성립한다. (실측: seed 후 `history_since='2000-01-01'`로 수정 → 재실행 → 값 유지 확인.)

```sql
-- Source: 실측. 저장된 기본값 표현식 확인 결과
--   pg_get_expr → ((now() AT TIME ZONE 'Asia/Seoul'::text))::date
history_since date not null default ((now() at time zone 'Asia/Seoul')::date)
```

`now()`는 timestamptz이므로 `at time zone 'Asia/Seoul'`은 **서버 타임존과 무관하게** KST 로컬 시각을 준다(컨테이너 TZ=UTC에서 확인). 동치 대안은 `timezone('Asia/Seoul', now())::date`, `(current_timestamp at time zone 'Asia/Seoul')::date`. 셋 다 같은 값이며 D-03 표현식을 그대로 쓰는 것을 권한다(사용자 승인 문구와 일치).

### Pattern 6 (선택): Docker 드라이런 하네스

로컬에 Supabase 스택은 없지만 **Docker는 있다**(29.2.0 구동 중). Supabase 전용 객체를 스텁으로 만들어 주면 `0005` 파일을 통째로 **두 번** 실행해 문법·멱등성을 진짜로 검증할 수 있다. 이번 연구에서 이 방식이 동작함을 확인했다.

```sql
-- prelude.sql — 스텁. 실제 Supabase 객체의 시그니처만 흉내 낸다.
create publication supabase_realtime;
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint
  language sql as $$ insert into cron.job(jobname, schedule, command)
                     values ($1,$2,$3) returning jobid $$;
create function cron.unschedule(job_id bigint) returns boolean
  language sql as $$ delete from cron.job where jobid = $1 returning true $$;
create schema if not exists net;
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
                              headers jsonb default '{}', timeout_milliseconds int default 2000)
  returns bigint language sql as $$ select 1::bigint $$;
```

```bash
docker run -d --name pg-dryrun -e POSTGRES_PASSWORD=x postgres:17-alpine
docker cp prelude.sql pg-dryrun:/tmp/ && docker cp supabase/migrations/0005_restaurants_settings.sql pg-dryrun:/tmp/
docker exec pg-dryrun psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/prelude.sql
docker exec pg-dryrun psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/0005_restaurants_settings.sql   # 1회차
docker exec pg-dryrun psql -U postgres -v ON_ERROR_STOP=1 -f /tmp/0005_restaurants_settings.sql   # 2회차 = 멱등성 증명
docker rm -f pg-dryrun
```

**이게 검증하는 것:** 문법 오류, 오타 난 컬럼명, check 제약 표현식 유효성, 재실행 시 ERROR 발생 여부, FK 방향, 기본값 평가.
**검증하지 못하는 것:** Supabase RLS 역할(anon/authenticated), Realtime 실제 전파, pg_cron 실제 실행, PostgREST 응답. 스텁 시그니처가 실물과 어긋나면 **가짜 통과/가짜 실패**가 난다 — 스텁은 위 5줄에서 늘리지 말 것.

**권고:** 기본 계획에는 넣지 않는다(CONTEXT의 페이즈 경계가 "낭독 리뷰 + grep + tsc + test"로 검증 수단을 명시했고, 48개 컨테이너가 이미 도는 머신에 커널 패닉 이력이 있다). 다만 **Phase 8 컷오버 직전 1회 실행**은 비용 대비 효과가 매우 크다 — 라이브 DB에서 처음 도는 SQL의 문법 오류를 사전에 잡는 유일한 수단이다. 계획서에는 선택 태스크 또는 Phase 8 체크리스트 항목으로 남기고 사용자 승인을 받는다.

### Anti-Patterns to Avoid

- **무명 `create index`:** 0001_init.sql의 형태를 복사하지 말 것. 재실행 시 중복 인덱스(§Pattern 1).
- **`alter table … add constraint`:** `IF NOT EXISTS`가 없다 [CITED: sql-altertable.html]. 제약은 `create table` 안에 인라인으로 넣어 `create table if not exists`의 보호를 받게 한다.
- **`create table if not exists`를 "스키마 수렴"으로 착각:** 모양이 다른 동명 테이블이 이미 있으면 **조용히 스킵**한다(실측 확인). 재실행 안전 ≠ 스키마 일치.
- **`truncate`:** Realtime DELETE 이벤트가 사라진다(실측). 어떤 이유로도 이 파일에 등장해선 안 된다.
- **`alter publication supabase_realtime drop table` 후 `drop table`:** 불필요하다. `drop table`만으로 publication 멤버십이 함께 사라진다(실측). 두 줄 쓰면 실패 지점만 늘어난다.
- **`results`에 대한 `update`/`delete`/`drop`:** HIST-03 위반. `add column if not exists`·정책·`comment on` 외의 `results` 언급은 전부 잘못이다.
- **`alter table … replica identity full`:** 불필요하고 해롭다. RLS가 켜져 있으면 Realtime은 DELETE에서 **어차피 PK만** 보낸다(§Pitfall 2). WAL만 커진다.

## Don't Hand-Roll

| 문제 | 직접 만들지 말 것 | 대신 쓸 것 | 왜 |
|------|-----------------|-----------|-----|
| 같은 매장 중복 등록 방지 | 클라이언트 `some(r => r.name === name)` 필터 | `name text not null unique` | 두 탭 경합에서 클라이언트 필터는 반드시 뚫린다. 기존 `menus` 중복 버그(CONCERNS [P2])가 정확히 이 실패다 |
| 같은 매장 중복 담기 방지 | `candidates`에 별도 unique 인덱스 | `restaurant_id`를 **PK로** (D-02) | PK 하나가 중복 방지 + 조인 키 + Realtime old-record 키를 전부 겸한다 |
| 매장 삭제 시 후보 정리 | 앱에서 delete 2번 호출 | `on delete cascade` | 앱이 중간에 죽어도 정합성 유지. RI는 RLS를 우회하므로 정책 구멍과 무관 [CITED: ddl-rowsecurity.html] |
| 매장 삭제 시 과거 결과 보호 | 삭제 금지 UI | `on delete set null` + `menu` 매장명 스냅샷 | 이름 스냅샷이 남으므로 캘린더·랭킹 표시가 살아 있다(HIST-01/02 전제) |
| 설정 쓰기 권한 | 앱 코드의 "편집 금지" 분기 | RLS 정책 부재(기본 거부) | 클라이언트 코드는 우회 가능. anon key로 직접 REST를 때리면 끝이다 |
| 자정 리셋 | Edge Function + 스케줄 왕복 | cron 본문의 순수 SQL | 네트워크·인증·타임아웃 실패 지점이 통째로 사라진다 |
| "KST 오늘" 계산 | 앱에서 계산해 insert | `default ((now() at time zone 'Asia/Seoul')::date)` | DB가 단일 시계. 클라이언트 시계 오차·타임존 설정과 무관 |
| 타임스탬프 갱신 추적 | `updated_at` 컬럼 | (없음 — D-03) | 트리거 없는 `updated_at`은 거짓말을 한다. 사용자가 이미 기각 |

**Key insight:** 이 페이즈의 모든 "로직"은 제약·기본값·참조 동작으로 표현될 수 있고, 그렇게 표현하면 앱·Edge Function·다른 탭 어느 경로로 들어와도 동일하게 강제된다. 앱 코드로 옮기는 순간 "RLS가 열린 익명 서비스"라는 이 프로젝트의 전제 때문에 전부 우회 가능해진다.

## Runtime State Inventory

> 이 페이즈는 **파일만** 쓴다. 아래는 "파일을 다 고쳐도 남아 있는 런타임 상태"의 목록이며, 실제 처리 시점은 Phase 8이다. Phase 2의 책임은 **이 목록이 0005 파일 안에 전부 반영돼 있는지** 확인하는 것이다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| 저장 데이터 | 라이브 `results` 약 60행(보존 대상), `menus` 0행·`pinned_menus` 0행(폐기 대상, D-11). 실제 행 수는 원격 조회가 차단돼 미확인 | 코드 편집 없음. Phase 8에서 사용자가 적용 직전 행 수 육안 확인 |
| 라이브 서비스 설정 | ① `cron.job`에 등록된 잡 2개(`spin-lunch-roulette`, `reset-menus`) — 레포의 SQL은 "등록 이력"일 뿐 정본이 아니다. ② `supabase_realtime` publication 멤버십(`menus`, `results`, `pinned_menus`) — DB에만 존재, 레포에 목록 없음. ③ Supabase 대시보드 Publications 토글로도 수정 가능 | 0005가 ①을 unschedule→재등록으로 교체하고, ②는 `drop table`이 자동 정리한다(실측). 별도 조치 불필요 |
| OS 등록 상태 | 없음 — 검증: 로컬 스케줄러·데몬·pm2 미사용. 배포는 Vercel(git push)·Supabase(CLI 수동)뿐 | 없음 |
| 시크릿·환경변수 | `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`(변경 없음), `SUPABASE_SERVICE_ROLE_KEY`(플랫폼 주입, 변경 없음). 프로젝트 ref `swxiqytyxjlcgubqlozk`가 0005의 `net.http_post` URL에 하드코딩된다(0002 선례) | 키 변경 없음. ref는 주석으로 "다른 프로젝트면 치환" 명시(D-08) |
| 빌드 산출물 | `tsconfig.tsbuildinfo`(증분 캐시 — 타입 수정 후 `tsc --noEmit`가 알아서 갱신), `.next/`(dev 서버 캐시, 과거 커널 패닉 원인). 배포된 Edge Function 2개는 **구 스키마 코드 그대로** 라이브에서 돌고 있다 | 0005 적용(Phase 8) ~ Edge Function 재배포 사이에는 함수가 없어진 `menus`를 조회해 실패한다 → **컷오버 순서(마이그레이션 → 함수 배포)가 분리 불가한 한 쌍**임을 Phase 8 체크리스트에 남길 것 |

## Common Pitfalls

### Pitfall 1: "재실행 가능"을 파일 단위로 생각한다

**What goes wrong:** 파일 맨 위에 `if not exists`를 몇 개 붙여 놓고 멱등하다고 믿는다. 실제로는 문 하나만 비멱등이어도 2회차 실행이 그 지점에서 ERROR로 끊기고, **앞부분은 이미 커밋된 상태**가 된다(대시보드 SQL Editor는 스크립트를 하나의 트랜잭션으로 감싸 주지 않는다 — 명시적 `begin/commit`이 없으면 문마다 자동 커밋).
**Why it happens:** `create index`·`alter publication`·`create policy`·`cron.unschedule(name)` 네 가지는 겉보기에 무해하지만 재실행에서 각각 다르게 실패한다.
**How to avoid:** 아래 매트릭스의 "안전형" 열만 사용한다. 계약 테스트가 파일을 스캔해 위반을 잡는다(§Validation).

#### 재실행 가능성 매트릭스 (전부 PostgreSQL 17.11에서 실측)

| 문 | 2회차 결과 | 안전형 |
|----|-----------|--------|
| `create table t (…)` | ERROR: relation already exists | `create table if not exists` ✅ |
| `create table if not exists t (…)` (모양 다름) | NOTICE + **스킵** — 기존 모양 유지 | 안전하지만 수렴 보장 없음 ⚠ |
| `create index on t (col)` (무명) | **중복 인덱스 `t_col_idx1` 생성** ❌ | `create index if not exists t_col_idx on t (col)` ✅ |
| `alter table t add column c …` | ERROR: column already exists | `add column if not exists` ✅ (FK 인라인 포함해 통째 스킵, 제약 중복 없음) |
| `alter table t enable row level security` | 정상 통과 ✅ | 그대로 |
| `create policy p on t …` | ERROR: policy already exists | `drop policy if exists p on t;` → `create policy` ✅ |
| `create policy if not exists …` | **문법 오류** ❌ | 위 쌍을 쓸 것 |
| `alter publication supabase_realtime add table t` | ERROR: already member ❌ | `pg_publication_tables` 가드 ✅ |
| `insert into settings (id) values (1)` | ERROR: duplicate key | `on conflict (id) do nothing` ✅ (기존 편집값 보존 확인) |
| `comment on column …` | 덮어쓰기 ✅ | 그대로 |
| `cron.unschedule('이름')` | **ERROR: could not find valid entry** ❌ | `select jobid from cron.job where jobname in (…)` 루프 ✅ |
| `drop table if exists t` | NOTICE + 통과 ✅ | 그대로 |
| `drop table t` (publication 멤버) | 성공. `pg_publication_tables` 행도 함께 사라짐 ✅ | `alter publication … drop table` 선행 **불필요** |

### Pitfall 2: DELETE 이벤트가 전체 행을 줄 거라고 기대한다

**What goes wrong:** 클라이언트가 `payload.old.name`으로 UI를 갱신하도록 짰는데 `undefined`가 온다.
**Why it happens:** 기본 replica identity(=PK)에서 old-record에는 PK만 실린다. 그리고 `replica identity full`을 켜도 **RLS가 켜진 테이블은 DELETE에서 여전히 PK만** 내려간다.

> [CITED: supabase.com/docs/reference/swift/removeallchannels] "Row Level Security is not applied to delete statements; when RLS is enabled and replica identity is full, only the primary key is sent to clients."

**How to avoid:** `candidates`의 PK를 `restaurant_id`로 둔 D-02 설계가 이 문제를 구조적으로 해결한다 — 삭제 이벤트만으로 "어떤 매장이 빠졌는지" 알 수 있다. `restaurants` 삭제 이벤트는 `id`만 오므로 Phase 5 UI는 **id 기준으로** 목록에서 제거해야 한다(이름 기준 금지).
**Warning signs:** Phase 5/6 코드 리뷰에서 `payload.old`의 PK 아닌 필드를 읽는 코드.

### Pitfall 3: `truncate`는 Realtime에 보이지 않는다

**실측 (논리 디코딩 출력):**

```
=== delete from candidates; insert … select … where pinned ===
 BEGIN
 table public.candidates: DELETE: restaurant_id[uuid]:'1111…'
 table public.candidates: DELETE: restaurant_id[uuid]:'2222…'
 table public.candidates: INSERT: restaurant_id[uuid]:'1111…' created_at[…]:'…'
 COMMIT

=== truncate table candidates ===
 BEGIN
 table public.candidates: TRUNCATE: (no-flags)
 COMMIT          ← 행 단위 메시지 0건. postgres_changes 의 DELETE 핸들러가 호출되지 않는다
```

`delete from`의 성능 우려는 없다 — 후보는 많아야 수십 행이다. CONCERNS [P2]가 기술한 "자정 유령 메뉴" 버그가 이 교체로 해소된다.

### Pitfall 4: RLS를 켜지 않은 채 테이블만 만든다

**What goes wrong:** `settings`가 익명 사용자에게 **쓰기 가능**해진다. SETT-01이 조용히 무너지고, 아무 에러도 나지 않는다.
**Why it happens:** Supabase는 public 스키마의 새 테이블에 `anon`/`authenticated` 역할의 select/insert/update/delete 권한을 **기본으로 부여**한다.

> [CITED: supabase.com/docs/guides/database/postgres/row-level-security] "A table in an exposed schema without RLS is readable and writable by any role with a grant on it." / "Enable RLS on every table in an exposed schema."

**How to avoid:** 새 테이블 3개 각각에 `alter table … enable row level security;`가 있는지 계약 테스트가 검사한다. `settings`는 select 정책 **1건만** 있고 insert/update/delete 정책이 **0건**이어야 한다(정책 부재 = 기본 거부).
**Warning signs:** Supabase 대시보드의 "RLS disabled in public" 경고 배너(Phase 8 적용 후 즉시 확인 가능).

### Pitfall 5: `settings`를 publication에 넣고 select 정책을 빠뜨린다

**What goes wrong:** SETT-02(대시보드 UPDATE의 즉시 반영)가 동작하지 않는다. 구독은 성립하는데 이벤트만 안 온다.
**Why it happens:** Realtime은 INSERT/UPDATE 이벤트를 구독자의 RLS로 필터링한다. anon select 정책이 없으면 행이 통과하지 못한다.
**How to avoid:** D-06의 `settings_read` 정책은 SETT-01(쓰기 차단)과 SETT-02(읽기 브로드캐스트) **둘 다**의 전제다. 둘 중 하나로만 생각하면 "읽기도 막을까?" 같은 잘못된 강화 유혹이 생긴다.

### Pitfall 6: 매장 삭제가 `results` UPDATE를 낳고, 그게 휠을 다시 돌린다 ⚠ 교차 페이즈

**실측:**

```
=== delete from restaurants where id = '1111…' ===
 table public.restaurants: DELETE: id[uuid]:'1111…'
 table public.candidates:  DELETE: restaurant_id[uuid]:'1111…'      ← cascade 도 WAL 에 남는다(좋음)
 table public.results:     UPDATE: id:1 menu:'가게A' restaurant_id:null   ← set null 은 UPDATE 다
```

`app/page.tsx:105-112`는 `results` UPDATE를 구독하고 `applyResult` → `setForceSpin(true)`를 호출한다. 즉 **오늘 당첨된 매장을 카탈로그에서 삭제하면, 열려 있는 모든 탭의 휠이 아무 이유 없이 5초간 다시 돈다.** 결과 값은 바뀌지 않는다(매장명 스냅샷 `menu`는 그대로).

**Phase 2에서 할 일:** `on delete set null` 옆에 이 부작용을 한글 Why 주석으로 남긴다.
**Phase 6에 넘길 일:** `applyResult`가 "의미 있는 변화"(= `menu` 또는 `spun_at` 변경)에서만 `forceSpin`을 켜도록 가드. CONCERNS [P3] `winnerIndex` id 기준 전환과 같은 지점이다.

### Pitfall 7: pg_net 기본 타임아웃 2초

**What goes wrong:** 매분 폴링에서 Edge Function 콜드스타트가 2초를 넘으면 pg_net이 요청을 취소하고 `net._http_response`에 타임아웃으로 기록한다. 클라이언트 연결이 끊긴 함수 실행이 중간에 종료될 수 있다.

> [CITED: supabase.com/docs/guides/database/extensions/pg_net] 시그니처의 `timeout_milliseconds int default 2000`. 응답은 `net._http_response`에 **6시간** 보관된다. "HTTP requests are not started until the transaction is committed."

**How to avoid:** `timeout_milliseconds := 5000`을 명시한다(Supabase cron 퀵스타트 예제도 5000을 쓴다). 0002에는 없던 인자이므로 의도를 주석으로 남긴다.
**디버깅 자산:** 추첨이 안 돌 때 `select * from net._http_response order by created desc limit 20;`이 최근 6시간의 상태 코드·에러를 준다 — 지금 이 프로젝트에 사실상 유일한 관측 수단이다(INTEGRATIONS: "감지 수단이 사실상 없다"). 이 쿼리를 Phase 8 문서에 남기면 운영 가치가 크다.

### Pitfall 8: 매분 cron이 `cron.job_run_details`를 무한히 쌓는다

> [CITED: github.com/citusdata/pg_cron README] "The records in the table are not cleaned automatically… Especially when you have jobs that run every few seconds, it can be a good idea to clean up regularly."

`* * * * *` = 하루 1,440행 + 기존 자정 잡 1행. 각 행은 `command` 전문(≈250자)을 포함하므로 대략 하루 0.5~0.7MB, **1년 200MB 안팎**이다. 무료 티어 DB 용량이 500MB다 [CITED: supabase.com/pricing].
**선택지:** (a) 세 번째 cron 잡으로 정리, (b) 수동 주기 정리, (c) 방치. pg_cron README의 권장형:

```sql
select cron.schedule('purge-cron-history', '10 15 * * *',
  $cmd$ delete from cron.job_run_details where end_time < now() - interval '7 days'; $cmd$);
```

D-08/D-09는 잡 2개만 승인했으므로 **사용자 판단 필요**(§Open Questions Q1).

### Pitfall 9: 무료 티어 호출량 착시

매분 폴링 = 1,440회/일 ≈ 43,200회/월. 무료 티어 Edge Function 호출은 월 500,000회 → **약 8.6%**. Realtime 메시지 월 200만 건, 동시 접속 200 [CITED: supabase.com/pricing]. 사내 소수 사용 규모에서 여유가 크다 — "매분 폴링이 한도를 먹는다"는 우려는 근거가 없다(REQUIREMENTS의 Out of Scope 판단과 일치).

## Code Examples

### PostgREST 직렬화 — `SettingsRow` 문자열 형태의 근거

```sql
-- Source: 실측. PostgREST 는 to_json/json_agg 로 행을 만들므로 아래가 곧 API 응답 형태다.
select to_json(t) from (
  select '11:55'::time as spin_time,
         (now() at time zone 'Asia/Seoul')::date as history_since,
         array['김밥','라멘','']::text[] as menus,
         now()::timestamptz as created_at,
         null::uuid as restaurant_id
) t;
```

```json
{
  "spin_time": "11:55:00",
  "history_since": "2026-09-18",
  "menus": ["김밥", "라멘", ""],
  "created_at": "2026-09-18T08:09:38.485236+00:00",
  "restaurant_id": null
}
```

읽는 법:
- `time` → **`"HH:MM:SS"`** (초 포함). D-13의 주석이 정확하다. Phase 3 파서는 `"11:55"`가 아니라 `"11:55:00"`을 받는다는 전제로 써야 한다.
- `date` → `"yyyy-mm-dd"` — `results.date`·`lib/time.ts`의 KST 날짜 키와 **문자열 그대로 비교 가능**(기존 컨벤션 유지).
- `text[]` → JSON 배열. `menus: string[]`이 정확하다. 빈 문자열 요소도 그대로 오므로 입력 정제는 클라이언트(`parseMenuInput`) 책임.
- `timestamptz` → ISO 8601 **오프셋 형(`+00:00`)**, `Z` 접미사가 아니다. `new Date(...)`는 정상 파싱한다. 기존 `created_at: string` 컨벤션 유지.
- `uuid` null → `null`. `ResultRow.restaurant_id: string | null`이 정확하다.

### `lib/supabase/client.ts` 추가 타입 (D-13 그대로)

```typescript
// 매장 카탈로그. 자정에 지워지지 않는 영구 테이블 (supabase/migrations/0005_restaurants_settings.sql).
export type RestaurantRow = {
  id: string;
  name: string;
  menus: string[];       // text[] → PostgREST 는 JSON 배열로 준다
  location: string | null;
  pinned: boolean;
  created_at: string;
};

// 오늘 후보. PK 가 restaurant_id 라서 같은 매장을 두 번 담을 수 없고,
// Realtime DELETE 이벤트의 payload.old 에도 이 컬럼이 실려 온다 (기본 replica identity = PK).
export type CandidateRow = {
  restaurant_id: string;
  created_at: string;
};

// 설정 단일행(id = 1). anon 은 읽기만 가능하고 편집은 대시보드(service_role)에서만 한다.
export type SettingsRow = {
  id: 1;
  spin_time: string;      // PostgREST time → "HH:MM:SS" (초 포함)
  cooldown_days: number;  // 0 = 쿨다운 끔
  history_since: string;  // "yyyy-mm-dd" (KST 기준 전환일)
};
```

`ResultRow`에는 `restaurant_id: string | null`만 추가한다. `menu`는 이름을 유지하되 **매장명 스냅샷**이라는 의미 변화를 주석으로 남긴다 — 이 한 줄이 HIST-03의 설계 의도를 코드에 고정한다.

### `comment on column` (Specific Ideas 반영)

```sql
comment on column public.settings.spin_time     is '추첨 시각(KST). 앱·Edge Function 이 함께 읽는 단일 출처';
comment on column public.settings.cooldown_days is '최근 N일 당첨 매장 제외. 0 = 끔';
comment on column public.settings.history_since is '매장 전환일. 이 날짜 이후 results 만 기록·랭킹에 집계한다';
```

대시보드 테이블 편집기에서 컬럼 설명으로 노출된다. 덮어쓰기라 재실행 안전(실측).

## State of the Art

| 과거 방식 | 현재 방식 | 언제 바뀌었나 | 영향 |
|----------|----------|--------------|------|
| `truncate` + 재시드 (0002~0004) | `delete from` + 재시드 | 이 페이즈 | Realtime DELETE 전파 확보 (CAND-04). 성능 차이 무의미한 규모 |
| 이름(text)이 곧 식별자 (`menus.name`, `pinned_menus.name` PK) | uuid PK + `name unique` | 이 페이즈 | 이름 변경·중복·조인 문제 동시 해결 (CATL-07, CONCERNS [P2]/[P3]) |
| 별도 핀 테이블(`pinned_menus`) | `restaurants.pinned` 컬럼 | 이 페이즈 | 테이블 1개·구독 1개 감소. "핀만 남고 목록에서 사라져 해제 불가"(CONCERNS [P3]) 버그가 구조적으로 소멸 |
| 시각 하드코딩(8파일 11곳) | `settings.spin_time` 단일행 | 이 페이즈(스키마) → Phase 3·4·6(소비) | cron 표현식에서 시각이 사라지고 `* * * * *`가 된다 |
| cron이 정확한 시각에 1회 발사 | 매분 폴링 + 함수가 판정 | 이 페이즈 | 시각 변경 시 cron 재등록 불필요. 대신 job_run_details 증가(§Pitfall 8) |
| `supabase gen types` 미사용 (수동) | 변화 없음 (수동 유지) | — | 자동 생성은 원격 DB 접근이 필요해 적용 전에는 불가능. Phase 8 이후 재검토 대상 |

**Deprecated/outdated:**
- `menus`·`pinned_menus` 테이블: 이 파일의 마지막 단계에서 제거. TS 타입 `MenuRow`·`PinnedMenuRow`는 **이번엔 남긴다**(D-13 — 페이지가 아직 참조하므로 지우면 `tsc`가 깨진다).
- `reset-menus` 잡 이름: `reset-candidates`로 교체. 구 이름을 unschedule 목록에 반드시 포함.
- `CLAUDE.md`의 "config.toml 없음" 서술: 이미 낡았다(파일이 존재하고 `verify_jwt = false`가 선언돼 있다). 정정은 Phase 8(SHIP-03) 소관 — 이 페이즈에서 건드리지 않는다.

## Project Constraints (from CLAUDE.md)

| 지시 | 이 페이즈에서의 준수 방법 |
|------|------------------------|
| 마이그레이션 파일명 `supabase/migrations/000N_설명.sql` | `0005_restaurants_settings.sql` |
| cron 등록은 "기존 잡 unschedule → 재등록" 패턴으로 재실행 가능하게 | §Pattern 4 (jobid 루프). 구 이름 `reset-menus` 포함 |
| 주석은 한글, Why만. 파일 머리에 역할·제약을 블록 주석으로 | 파일 머리에 "동작 불변 원칙"(Specific Ideas) 명시 |
| DB 타입의 유일한 정의처는 `lib/supabase/client.ts` (자동 생성 아님, 수동 유지) | D-13 타입을 이 파일에만 추가. 새 정의처를 만들지 않는다 |
| 전부 클라이언트 컴포넌트 / 서버 컴포넌트·Route Handler 없음 | 해당 없음 — 이 페이즈는 UI 코드를 쓰지 않는다 |
| 시간은 항상 `lib/time.ts` 경유, 날짜 키는 KST `"yyyy-mm-dd"` | `history_since`가 같은 형태로 직렬화됨을 실측 확인 → 기존 비교 코드와 그대로 호환 |
| `supabase/functions/`·`design/`은 tsconfig·eslint 제외 — 제외를 풀지 말 것 | 계약 스펙은 `supabase/migrations/`에 둔다(제외 대상 아님). vitest exclude의 `supabase/functions/!(_shared)/**` extglob을 건드리지 않는다 |
| 추첨 시각 11:55는 네 곳에 흩어져 있다 | 이 페이즈는 `settings.spin_time` 기본값이라는 **다섯 번째 지점**을 만든다. 코드 쪽 제거는 Phase 3·6 — 이 파일 주석에 "이후 단일 출처가 된다"를 남긴다 |
| `.serena/project.yml`은 커밋 대상 아님 | 커밋 파일 목록에 포함시키지 않는다 |
| `npm run dev` 크래시 시 `rm -rf .next` | 이 페이즈는 dev 서버가 불필요하다. 띄우지 않는다 |
| 라이브 DB·Edge Function·`main`은 Phase 8까지 불변 | 파일만 쓴다. `supabase db push`·`supabase functions deploy`·원격 SQL 실행 금지 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 라이브 프로젝트의 Postgres 메이저 버전은 15~17 계열이다(원격 조회 차단으로 미확인). 이 페이즈가 쓰는 문법은 전부 9.6+ 기능이라 버전 차이가 결과를 바꾸지 않는다 | Standard Stack | 낮음. 15 미만이어도 `add column if not exists`(9.6+)·`create index if not exists`(9.5+)·`drop policy if exists`(9.5+)는 모두 지원된다 |
| A2 | 라이브 `menus`·`pinned_menus`가 0행이라는 D-11 전제 | Runtime State | 행이 남아 있으면 drop으로 데이터가 사라진다. Phase 8 적용 직전 사용자가 육안 확인 |
| A3 | pg_net 타임아웃이 Edge Function 실행을 중단시킬 수 있다 | Pitfall 7 | 중간. 중단되지 않더라도 `timeout_milliseconds := 5000` 명시는 무해하다 |
| A4 | `cron.job_run_details` 1행당 대략 400바이트(command 전문 포함) — 연 200MB 추정 | Pitfall 8 | 추정치. 실제는 수십 MB~수백 MB. 정리 잡의 필요성 판단에만 쓰이며 방향은 바뀌지 않는다 |
| A5 | Supabase 대시보드 SQL Editor는 스크립트를 단일 트랜잭션으로 감싸지 않는다(문 단위 자동 커밋) | Pitfall 1 | 중간. 감싼다면 실패 시 전체 롤백이라 오히려 안전하다. 어느 쪽이든 "모든 문 멱등" 요구는 동일 |
| A6 | 계약 스펙을 `supabase/migrations/*.test.ts`에 두면 tsc·eslint가 자동 포함한다(tsconfig include `**/*.ts`, exclude에 migrations 없음 — 설정 파일로 확인했으나 실제 실행으로는 미검증) | Validation | 낮음. 어긋나면 스펙을 `lib/`로 옮기면 된다 |

## Open Questions (RESOLVED)

1. **`cron.job_run_details` 정리 잡을 0005에 넣을 것인가?** — RESOLVED: D-14 (CONTEXT.md) 추가, `30 15 * * *` 7일 보관
   - 알고 있는 것: pg_cron은 자동 정리하지 않는다(README 인용). 매분 폴링은 하루 1,440행을 만든다. 무료 티어 DB는 500MB.
   - 불확실한 것: 실제 행 크기와 Supabase 플랫폼이 별도 정리를 하는지(플랫폼 문서에 언급 없음).
   - 권고: 세 번째 잡 `purge-cron-history`(`10 15 * * *`, 7일 보관)를 **추가할 것을 권한다**. 5줄이고 되돌리기 쉬우며, 방치 시 발견이 몇 달 뒤가 된다. 다만 D-08/D-09는 잡 2개만 승인했으므로 **계획 단계에서 사용자 확인**이 필요하다(추가하지 않기로 하면 Phase 8 롤백/운영 문서에 "주기적 수동 정리" 항목을 남긴다).

2. **`restaurants.name` 24자 제한이 실제 매장명에 충분한가?** — RESOLVED: D-16 (CONTEXT.md) 24자 유지
   - 알고 있는 것: D-01이 24자를 잠갔고, 기존 `menus`/`pinned_menus`와 동일한 값이다. CONCERNS [P2]는 "식당 카탈로그 전환 때 24자를 넘길 가능성이 크므로 그 마이그레이션에서 재검토"를 권했다.
   - 불확실한 것: 실제 등록될 매장명 길이 분포("○○식당 강남2호점" 정도는 24자 안이나 프랜차이즈 지점명은 넘길 수 있다).
   - 권고: D-01이 사용자 승인 결정이므로 **그대로 24자로 간다**. 다만 `lib/constants.ts`의 `MENU_NAME_MAX_LEN`(24)과 값이 일치한다는 사실을 마이그레이션 주석에 남겨 두면 나중에 늘릴 때 두 곳을 함께 고친다. 늘리는 변경은 `alter table … drop constraint` + 재추가라 멱등 패턴이 깨지므로 별도 마이그레이션이 맞다.

3. **Docker 드라이런(§Pattern 6)을 이 페이즈 계획에 넣을 것인가?** — RESOLVED: D-15 (CONTEXT.md) Phase 8 선택 항목
   - 알고 있는 것: 기술적으로 가능하고 이번 연구에서 검증했다. 이미지는 로컬에 pull되어 있다(415MB).
   - 불확실한 것: CONTEXT의 페이즈 경계가 검증 수단을 "낭독 리뷰 + grep + tsc + test"로 명시했다 — 드라이런 추가는 경계 확장이다.
   - 권고: Phase 2 기본 계획에는 **넣지 않는다**. 대신 Phase 8 컷오버 체크리스트에 "적용 직전 드라이런 1회(선택)" 항목으로 남긴다. 사용자가 원하면 Phase 2 마지막 선택 태스크로 승격.

4. **`candidates`에 `created_at` 인덱스가 실제로 필요한가?** — RESOLVED: D-17 (CONTEXT.md) 넣되 이름 명시
   - 알고 있는 것: CONTEXT가 Claude 재량으로 남겼다. 후보는 많아야 수십 행이고 `order by created_at`은 시퀀셜 스캔으로 충분하다.
   - 권고: `candidates(created_at)`는 **생략**해도 무방하나, 0001의 `menus(created_at)` 선례와의 대칭성 및 비용이 거의 0인 점을 고려해 **넣는 쪽을 약하게 권한다**. `restaurants(pinned)`는 자정 재시드 쿼리의 술어이므로 넣는다. 어느 쪽이든 **이름을 반드시 붙일 것**(§Pattern 1).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest·tsc·build | ✓ | v25.6.1 | — |
| npm | 스크립트 실행 | ✓ | 11.9.0 | — |
| vitest | 계약 테스트 | ✓ (devDependency) | 4.1.11 | — |
| TypeScript | `npx tsc --noEmit` | ✓ | `^5` | — |
| Docker | 마이그레이션 드라이런(선택) | ✓ | 29.2.0, 컨테이너 48개 구동 중 | 낭독 리뷰 + 계약 테스트 |
| `postgres:17-alpine` 이미지 | 드라이런(선택) | ✓ (이번 연구에서 pull, 415MB) | 17.11 | 위와 동일 |
| Supabase CLI | `db push`·`gen types` | ✗ | — | 필요 없음 — 이 페이즈는 원격 적용을 하지 않는다 |
| psql (호스트) | SQL 실행 | ✗ | — | `docker exec … psql` |
| Deno | Edge Function 체크 | ✗ | — | 이 페이즈는 Edge Function을 건드리지 않는다(Phase 4 소관) |
| 로컬 Supabase 스택 | 통합 검증 | ✗ | — | 없음 — 이 페이즈의 근본 제약이자 §Validation Architecture의 존재 이유 |
| 원격 Supabase SQL 실행 | 스키마 검증 | ✗ (정책상 차단) | — | Phase 8에서 사용자가 대시보드로 수행 |

**Missing dependencies with no fallback:**
- 라이브 스키마에 대한 사실 확인(행 수, 현재 cron 잡 목록, publication 멤버십). Phase 8 적용 직전 사용자 육안 확인으로만 해소된다.

**Missing dependencies with fallback:**
- Supabase CLI / 로컬 스택 → 계약 테스트 + (선택) Docker 드라이런.
- psql → `docker exec`.

## Validation Architecture

SQL을 로컬에서 실행할 수 없다는 제약 위에서, **사람이 매번 기억해야 하는 grep 체크리스트를 자동 테스트로 굳히는 것**이 이 페이즈 검증 전략의 핵심이다. `npm test` 한 번으로 SHIP-01의 Success Criteria 5개가 전부 확인되게 만든다.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.11 (정확 고정, Phase 1 산출물) |
| Config file | `vitest.config.mts` (`environment: "node"`, `globals: false`, alias `@/` → repo root) |
| Quick run command | `npx vitest run supabase/migrations` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHIP-01 | 모든 문이 멱등형이다 — 무명 `create index` 0건, 맨 `alter publication … add table` 0건(가드 밖), `create policy` 앞에 항상 `drop policy if exists`, `cron.unschedule('문자열')` 0건 | contract (파일 파싱) | `npx vitest run supabase/migrations` | ❌ Wave 0 |
| SHIP-01 | 구 테이블 제거가 파일의 **마지막** 단계 — 마지막 `drop table` 인덱스 > 마지막 `create table`·`create policy`·`cron.schedule` 인덱스 | contract | 〃 | ❌ Wave 0 |
| SETT-01 | `settings`에 `enable row level security`가 있고, select 정책 1건 · insert/update/delete 정책 0건 | contract | 〃 | ❌ Wave 0 |
| SETT-01 | `SettingsRow` 타입이 존재하고 필드가 SQL 컬럼 목록과 일치 | contract + `tsc` | 〃 + `npx tsc --noEmit` | ❌ Wave 0 |
| CATL-07 | `restaurants.name`에 `unique`와 `char_length(name) between 1 and 24` check가 있다 | contract | 〃 | ❌ Wave 0 |
| CAND-04 | 파일 전체에 `truncate` 0건. `reset-candidates` 잡 본문에 `delete from public.candidates`와 핀 재시드 insert가 모두 있다 | contract | 〃 | ❌ Wave 0 |
| HIST-03 | `results` 등장 지점이 허용 목록(`add column if not exists` / 정책 / `comment on` / 주석)뿐이고 `delete from public.results`·`update public.results`·`drop table … results`가 0건 | contract | 〃 | ❌ Wave 0 |
| D-13 전반 | 4개 행 타입의 필드 집합이 SQL의 `create table` 컬럼 목록과 일치(타입 이름은 제외, 이름만 대조) | contract | 〃 | ❌ Wave 0 |
| 전체 | 타입 컴파일 | static | `npx tsc --noEmit` | ✓ |
| 전체 | 린트 | static | `npm run lint` | ✓ (기존 `Wheel.tsx` 에러 1건은 이 페이즈 범위 밖) |
| 전체 | 빌드 | static | `npm run build` (`.env.local` 필요) | ✓ |
| SHIP-01 (보완) | 사람의 낭독 리뷰 — 아래 체크리스트 | manual | — | 계획서에 체크리스트로 포함 |

**계약 테스트 설계 노트 (planner용):**
- 파일 위치: `supabase/migrations/0005_restaurants_settings.test.ts`. tsconfig `include: ["**/*.ts"]` + exclude에 `supabase/migrations` 없음 → `tsc`·eslint가 자동 포함한다. **vitest만** include 추가가 필요하다: `vitest.config.mts`의 `include` 배열에 `"supabase/migrations/**/*.test.ts"` 한 줄. (`exclude`의 `supabase/functions/!(_shared)/**` extglob은 절대 건드리지 않는다 — Phase 1 결정.)
- 읽기: `readFileSync(new URL("./0005_restaurants_settings.sql", import.meta.url), "utf8")`.
- 정규화: 검사 전에 `--` 주석 줄을 제거한 사본을 만든다. 그러지 않으면 "truncate 금지" 주석이 `truncate` 0건 단언을 거짓 실패시킨다. **주석 제거 전/후 두 사본을 모두 들고** 사용처를 구분할 것(예: 프로젝트 ref 하드코딩 주석 존재 확인은 주석 포함 사본으로).
- 컬럼 목록 기대값은 **리터럴 배열로 스펙 안에 적는다.** 타입에서 import 하지 않는다 — Phase 1 결정("상수를 import 하면 값이 바뀔 때 기대값도 따라가 계약이 사라진다")과 동일한 이유다. 이 스펙의 존재 이유가 "SQL과 TS가 각자 바뀌는 것을 붙잡는 것"이므로 양쪽 중 어느 쪽도 참조해선 안 된다.
- TS 타입 대조는 `lib/supabase/client.ts`를 **import 하지 않고** 소스 텍스트로 파싱한다(그 모듈은 `NEXT_PUBLIC_SUPABASE_*` 환경변수를 읽으므로 import 하면 테스트가 환경에 묶인다 — Phase 1이 `MENU_NAME_MAX_LEN`을 분리한 것과 같은 이유).
- 단언은 "존재"보다 **"개수와 순서"** 를 잡는 쪽이 회귀를 잘 잡는다(예: `create policy` 개수 == `drop policy if exists` 개수).

**낭독 리뷰 체크리스트 (사람, 계획서에 태스크로):**
1. 파일 머리 블록 주석에 "동작 불변 원칙"이 있는가.
2. 프로젝트 ref `swxiqytyxjlcgubqlozk`가 URL에 있고, "다른 프로젝트면 치환" 주석이 붙어 있는가.
3. cron 표현식 `0 15 * * *` 옆에 "KST 00:00 = UTC 15:00(전일)" 계산식 주석이 있는가.
4. `spin_time`·`cooldown_days`·`history_since` 기본값이 D-03과 **문자 단위로** 일치하는가(11:55 / 0 / KST 오늘).
5. `on delete cascade`(candidates)와 `on delete set null`(results)의 방향이 뒤바뀌지 않았는가.
6. `results` 관련 문이 `add column if not exists` 하나뿐인가(직접 읽어 확인).
7. `drop table` 두 줄이 파일 맨 끝인가.
8. §Pitfall 6(매장 삭제 → results UPDATE → 휠 재회전)이 주석으로 남았는가.

### Sampling Rate

- **Per task commit:** `npx vitest run supabase/migrations` (초 단위) + 타입을 건드렸으면 `npx tsc --noEmit`
- **Per wave merge:** `npm test` + `npx tsc --noEmit`
- **Phase gate:** `npx tsc --noEmit` && `npm run lint` && `npm test` && `npm run build` 전부 통과 후 `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `supabase/migrations/0005_restaurants_settings.test.ts` — SHIP-01·SETT-01·CATL-07·CAND-04·HIST-03·D-13을 파일 파싱으로 검사
- [ ] `vitest.config.mts` `include`에 `"supabase/migrations/**/*.test.ts"` 한 줄 추가 (`exclude`는 무변경)
- 프레임워크 설치: 불필요 (vitest 4.1.11 기존)
- 공용 픽스처: 불필요 (스펙 1개가 자기 완결)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | 익명 서비스가 제품 정체성(REQUIREMENTS Out of Scope "로그인·권한"). 이 페이즈가 인증을 도입하지 않는 것은 **의도된 결정**이다 |
| V3 Session Management | no | 세션 없음 |
| V4 Access Control | **yes** | RLS. `settings`는 정책 부재로 기본 거부(SETT-01), `restaurants`·`candidates`는 의도적 전면 개방(D-06), `results`는 읽기만 anon |
| V5 Input Validation | **yes** | DB check 제약: `char_length(name) between 1 and 24`, `cooldown_days >= 0`, `id = 1`. 클라이언트 검증은 보조일 뿐 정본이 아니다 |
| V6 Cryptography | no | 이 페이즈에 암호 연산 없음. `gen_random_uuid()`는 pgcrypto/내장 CSPRNG를 쓰므로 직접 구현하지 않는다 |
| V7 Error Handling & Logging | partial | 제약 위반이 raw Postgres 메시지(23505/23514)로 클라이언트에 노출된다. 번역은 Phase 5·6 소관 — 정보 노출 수준은 제약 이름뿐이라 허용 범위 |
| V13 API & Web Service | **yes** | PostgREST가 public 스키마 테이블을 자동 노출한다. "테이블을 만드는 것 = API를 여는 것"이라는 인식이 필수 |

### Known Threat Patterns for Supabase Postgres + PostgREST + 익명 anon key

| Pattern | STRIDE | Standard Mitigation | 이 페이즈에서 |
|---------|--------|---------------------|--------------|
| RLS 미활성 신규 테이블 → 익명 전면 쓰기 | Tampering / Information Disclosure | `enable row level security` + 명시적 정책 | 새 테이블 3개 전부에 대해 계약 테스트가 강제 (§Pitfall 4) |
| 정책은 만들었으나 grant를 남겨 둠 | Elevation of Privilege | Supabase는 grant 유지 + RLS 게이트가 표준 운영 모델 | 설계대로. `settings`는 grant가 있어도 정책 0건이라 거부된다 |
| `settings` 익명 변조(추첨 시각·쿨다운·전환일 조작) | Tampering | insert/update/delete 정책 **미생성** | SETT-01의 실제 메커니즘. 실수로 `settings_write` 정책을 추가하는 것이 이 페이즈 최대 보안 리스크 |
| 익명 사용자의 매장 대량 삭제 | Denial of Service | (수용) 익명 설계상 감수 — 기존 `menus`와 동일 수준 | 변화 없음. CONCERNS [P2] 기존 항목 유지 |
| cascade를 통한 간접 삭제 | Tampering | RI는 RLS를 우회한다 [CITED: ddl-rowsecurity.html] — 즉 `candidates`에 delete 정책이 없어도 매장 삭제로 후보가 지워진다 | D-06에서 `candidates` delete가 어차피 개방이라 권한 확대는 없다. 다만 "RI는 RLS를 우회한다"는 사실 자체를 계획서가 알고 있어야 한다 |
| 동적 SQL 주입 (`execute`) | Tampering | `format(… %I)` + 코드 내 리터럴만 | §Pattern 2의 `execute`는 하드코딩 배열만 받는다. 사용자 입력 경로 없음 |
| `net.http_post` 대상 URL 변조 | Spoofing | cron 잡 본문은 service_role/postgres만 수정 가능 | 변화 없음(0002 선례) |
| 추첨 함수 무인증 노출 | Spoofing | `verify_jwt = false` + 시간 가드·멱등 | Phase 4 소관. 이 페이즈는 cron 주기만 바꾼다 |

**이 페이즈의 보안 합격선:** 새 테이블 3개 모두 RLS 활성 + `settings` 쓰기 정책 0건. 계약 테스트가 이 둘을 자동 검사하면 SETT-01은 회귀로부터 보호된다.

## Sources

### Primary (HIGH confidence)

- **로컬 실측 — PostgreSQL 17.11 (`postgres:17-alpine` 컨테이너, 2026-09-18):** 무명 인덱스 중복 생성, `create index if not exists` 이름 필수, `create policy if not exists` 문법 오류, `drop policy if exists`→`create policy` 멱등, `enable row level security` 2회 무해, `alter publication add table` 재실행 ERROR + 가드 멱등, `drop table`이 publication 멤버십 자동 제거, `add column if not exists`가 FK 포함 통째 스킵(제약 중복 없음), `comment on column` 덮어쓰기, `insert … on conflict do nothing`이 편집값 보존, `create table if not exists`의 조용한 스킵, `to_json`의 time/date/text[]/timestamptz/uuid 직렬화, `(now() at time zone 'Asia/Seoul')::date` 저장 형태와 서버 타임존 독립성, unique 위반 시 `restaurants_name_key` 제약명
- **로컬 실측 — 논리 디코딩(`wal_level=logical`, test_decoding):** `delete from`의 행 단위 DELETE + PK old-record, `truncate`의 TRUNCATE 단일 메시지, cascade DELETE의 WAL 기록, `on delete set null`이 `results` UPDATE로 나타남
- Context7 `/websites/supabase` — Realtime postgres_changes(replica identity·DELETE에 RLS 미적용·RLS+full이면 PK만), publication 등록 SQL, pg_cron + net.http_post 스케줄 예제, cron.job_run_details 디버깅
- [postgresql.org/docs/current/sql-createindex.html] — IF NOT EXISTS에 인덱스 이름 필수, 자동 이름 규칙
- [postgresql.org/docs/current/sql-altertable.html] — ADD COLUMN IF NOT EXISTS 동작, ADD CONSTRAINT에 IF NOT EXISTS 없음
- [postgresql.org/docs/current/ddl-rowsecurity.html] — "Referential integrity checks … always bypass row security", 테이블 소유자 RLS 우회
- [github.com/citusdata/pg_cron README + src/job_metadata.c] — unschedule 시그니처와 이름 미존재 시 ereport, job_run_details 미자동정리·정리 잡 권장·`cron.log_run`, `cron.timezone` 기본 GMT
- [supabase.com/docs/guides/database/extensions/pg_net] — `timeout_milliseconds default 2000`, `net._http_response` 6시간 보관, 커밋 후 발사
- [supabase.com/docs/guides/database/postgres/row-level-security] — 노출 스키마 기본 grant와 RLS 필수
- [supabase.com/pricing] — 무료 티어: Edge Function 500K 호출/월, Realtime 200 동시접속·200만 메시지/월, DB 500MB

### Secondary (MEDIUM confidence)

- [supabase.com/docs/guides/cron] — Supabase Cron 최소 주기(초 단위까지), 스케줄 문법
- 레포 내부 문서: `.planning/codebase/INTEGRATIONS.md`(Supabase 구성·cron 이력·배포 경로), `.planning/codebase/CONCERNS.md`(11:55 분산, truncate 미전파, menus unique 부재, winnerIndex 이름 매칭), `CLAUDE.md`·`README.md`
- 레포 소스 직접 확인: `supabase/migrations/0001~0004`, `lib/supabase/client.ts`, `app/page.tsx` realtime 핸들러, `vitest.config.mts`, `tsconfig.json`, `eslint.config.mjs`, `supabase/config.toml`

### Tertiary (LOW confidence)

- `cron.job_run_details` 연간 용량 추정(≈200MB) — 행 크기 가정에 기반한 산술. 방향(무시할 수 없다)은 확실하나 수치는 근사
- pg_net 타임아웃이 Edge Function 실행을 중단시키는지 — 공식 문서에 직접 서술 없음. `timeout_milliseconds` 명시 권고는 어느 쪽이든 유효

## Metadata

**Confidence breakdown:**
- 재실행 가능성(멱등성) 규칙: **HIGH** — 13개 문 패턴을 실제 Postgres에서 2회 실행해 확인
- Realtime 이벤트 동작(CAND-04, cascade 부작용): **HIGH** — 논리 디코딩 출력 직접 관측 + Supabase 공식 문서 교차 확인
- PostgREST 타입 직렬화(D-13 문자열 형태): **HIGH** — `to_json` 실측
- RLS·권한 모델: **HIGH** — Supabase 공식 문서 + Postgres 공식 문서
- cron/pg_net 운영 특성(타임아웃·로그 적재·무료 한도): **MEDIUM** — 공식 문서 인용이나 라이브 프로젝트 실측 불가
- 라이브 DB 현재 상태(행 수·잡 목록·publication 멤버십): **LOW** — 원격 조회 차단. Phase 8 사용자 확인 필요

**Research date:** 2026-09-18
**Valid until:** 2026-10-18 (30일 — Postgres/pg_cron 동작은 안정적이나 Supabase 무료 티어 한도와 pg_net 기본값은 변동 가능)

**남긴 부산물:** 로컬 Docker 이미지 `postgres:17-alpine`(415MB)를 이번 연구에서 pull했다. 드라이런(§Pattern 6)을 쓰지 않기로 하면 `docker rmi postgres:17-alpine`로 제거해도 된다. 프로브 컨테이너는 전부 삭제했다.
