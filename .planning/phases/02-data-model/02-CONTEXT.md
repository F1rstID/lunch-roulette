# Phase 2: 데이터 모델 - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning
**Source:** 오케스트레이터가 brainstorming(2026-09-16~18)에서 사용자 승인된 설계를 옮김 (discuss-phase 대체)

<domain>
## Phase Boundary

컷오버 마이그레이션 **파일 1개**(`supabase/migrations/0005_restaurants_settings.sql`)와 `lib/supabase/client.ts`의 행 타입을 확정한다. **적용은 하지 않는다**(Phase 8, 사용자가 대시보드 SQL Editor). 로컬 Supabase 스택이 없으므로 검증은 낭독 리뷰 + grep 체크리스트 + `npx tsc --noEmit` + 기존 테스트 통과다. 이 페이즈는 UI·Edge Function·순수 로직을 건드리지 않는다.
</domain>

<decisions>
## Implementation Decisions

### 테이블 설계 (사용자 승인, 변경 금지)
- **D-01** `restaurants` 영구 카탈로그: `id uuid pk default gen_random_uuid()`, `name text not null unique check (char_length(name) between 1 and 24)`, `menus text[] not null default '{}'`, `location text` (null 허용, 한 줄), `pinned boolean not null default false`, `created_at timestamptz not null default now()`. 자정에 지워지지 않는다.
- **D-02** `candidates` 오늘 후보: `restaurant_id uuid primary key references restaurants(id) on delete cascade`, `created_at timestamptz not null default now()`. PK가 곧 "같은 매장 중복 담기 방지". 자정 `delete from public.candidates` 후 `pinned = true` 매장 재시드(`insert … select id from restaurants where pinned order by created_at`).
- **D-03** `settings` 단일행 타입 컬럼(key-value·env 기각): `id int primary key check (id = 1)`, `spin_time time not null default '11:55'`, `cooldown_days int not null default 0 check (cooldown_days >= 0)` (0 = 끔), `history_since date not null default ((now() at time zone 'Asia/Seoul')::date)` (전환일 = 적용일 자동). `updated_at` 없음(트리거 없이는 오해 유발, 앱이 안 읽음). `respin_limit_per_day` 없음(사용자: 무제한).
- **D-04** `results`: 기존 행 보존·변환 없음. `menu text` 컬럼은 **매장명 스냅샷**으로 의미만 바뀜(이름 유지). `alter table … add column if not exists restaurant_id uuid references restaurants(id) on delete set null`. `candidates jsonb`는 그대로 두되 새 행부터 `[{ "name": …, "restaurant_id": … }]` 형태(Phase 4 소관, 스키마 변경 없음).
- **D-05** 마이그레이션 적용 직후 동작 = 현재와 동일: 11:55 추첨, 쿨다운 없음. 동작 변경은 대시보드 UPDATE로만.

### RLS·Realtime (사용자 승인)
- **D-06** `restaurants`·`candidates`: anon select/insert/update/delete 전부 개방 (`using (true)` / `with check (true)`) — 익명 서비스 설계 유지. `settings`: anon **select만** (insert/update/delete 정책 없음 → 대시보드·service_role만). `results`: 기존 정책 유지(select anon, 쓰기 service_role).
- **D-07** `alter publication supabase_realtime add table` 3건: `restaurants`, `candidates`, `settings`. (`results`는 이미 등록됨.) 재실행 안전을 위해 `do $$ … if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='…') …` 가드.

### cron (사용자 승인: 매분 폴링)
- **D-08** `spin-lunch-roulette`: unschedule → `* * * * *` 재등록. 본문은 0002와 동일한 `net.http_post` (URL의 프로젝트 ref `swxiqytyxjlcgubqlozk` 하드코딩 — 0002 선례, 주석으로 "다른 프로젝트면 치환" 명시). 시각 판정은 함수가 `settings.spin_time`으로(Phase 4).
- **D-09** `reset-menus` → 잡 이름 `reset-candidates`로 교체(구 이름 unschedule): `0 15 * * *`(KST 00:00), 본문 `delete from public.candidates; insert into public.candidates (restaurant_id) select id from public.restaurants where pinned order by created_at;`. **`truncate` 0회**(Realtime DELETE 이벤트 필요).

### 순서·재실행 (SHIP-01)
- **D-10** 파일 순서: 확장(없음, 이미 있음) → `restaurants` → `candidates` → `settings` + seed `insert … on conflict (id) do nothing` → `results.restaurant_id` → RLS(`drop policy if exists` → `create policy`) → publication 가드 → cron 교체 → **마지막에** `drop table if exists public.pinned_menus; drop table if exists public.menus;`. 모든 문이 `if not exists` / `if exists` / unschedule→schedule 중 하나.
- **D-11** 데이터 이관 없음: 오늘 `menus`(0행)·`pinned_menus`(0행)는 버림. `results` 60행은 무접촉(`grep -n 'results' 0005` 결과가 `add column`·정책 유지 외 없어야 함).
- **D-12** 롤백 SQL은 별도 파일이 아니라 Phase 8 문서(SHIP-02)에 둔다. 이 페이즈는 forward 파일만.

### TS 타입 (`lib/supabase/client.ts`, 수동 유지)
- **D-13** `RestaurantRow { id: string; name: string; menus: string[]; location: string | null; pinned: boolean; created_at: string }`, `CandidateRow { restaurant_id: string; created_at: string }`, `SettingsRow { id: 1; spin_time: string /* "HH:MM:SS" PostgREST */; cooldown_days: number; history_since: string /* "yyyy-mm-dd" */ }`, `ResultRow`에 `restaurant_id: string | null` 추가(기존 필드 유지). `MenuRow`·`PinnedMenuRow`는 **이 페이즈에서 삭제하지 않는다** — 페이지가 아직 쓰므로 Phase 6에서 제거 (tsc 깨짐 방지).

### 리서치 후 추가 결정 (사용자 승인 2026-09-18, RESEARCH.md Open Questions)
- **D-14** 세 번째 cron 잡 `purge-cron-history` 추가: 매일 1회, `delete from cron.job_run_details where end_time < now() - interval '7 days'`. 매분 폴링의 `job_run_details` 무한 적재(하루 1,440행) 방지. 같은 unschedule→schedule 패턴, 같은 파일.
- **D-15** Docker 드라이런 하네스는 **Phase 2 범위 밖** — Phase 8 컷오버 직전 선택 항목으로 남긴다(로드맵 Phase 8 비고에 한 줄). Phase 2 검증은 vitest 계약 테스트 + 낭독 리뷰 + tsc.
- **D-16** `restaurants.name` 제한은 1~24자 유지(D-01). 주석으로 `MENU_NAME_MAX_LEN`(`lib/constants.ts`)과 같은 값임을 남긴다.
- **D-17** `candidates(created_at)` 인덱스는 넣되 **이름 명시** `create index if not exists candidates_created_at_idx on public.candidates (created_at)`. 무명 `create index`는 재실행 시 중복 생성되므로 파일 전체에서 금지.
- **D-18** (리서치 확정 사항의 반영) `cron.unschedule`은 jobid 루프(0002 패턴)로만 — 이름 인자 형태 금지. `alter publication` 은 `pg_publication_tables` 가드 필수. `create policy if not exists` 문법 없음 → `drop policy if exists`+`create policy`. `net.http_post` 에 `timeout_milliseconds := 5000` 명시. 매장 삭제 시 `results.restaurant_id` set null UPDATE 가 Realtime 으로 나가 휠 재회전을 유발할 수 있음 → 마이그레이션 주석으로 남기고 가드는 Phase 6.

### 리서치·리뷰 후 추가 결정 (사용자 승인 2026-09-21, `02-REVIEW.md` WR-03)
- **D-19** `restaurants` DB 상한: anon 이 PostgREST 로 직접 쓰는 자유 텍스트 컬럼의 경계를 DB 가 든다(클라이언트 검증은 보조 — RESEARCH §Security V5). `name` 은 기존 `char_length(name) between 1 and 24` 에 더해 `btrim(name) <> ''`(공백만 이름 금지)와 `position(E'\n' in name) = 0`(개행 금지). `location` 은 null 허용이되 있으면 `char_length(location) <= 200`. `menus` 는 `cardinality(menus) <= 30`, `array_position(menus, '') is null`(빈 원소 금지), 원소 길이 24자 이하. 원소 길이 검사는 check 가 서브쿼리를 허용하지 않으므로 `create or replace function public.text_array_max_len(arr text[]) returns int`(`language sql immutable strict`)로 빼고 `check (coalesce(public.text_array_max_len(menus), 0) <= 24)` 로 건다. 제약은 전부 컬럼 인라인, 함수는 `create or replace` 라 D-10 의 재실행 안전 원칙이 그대로 유지된다.
  - **근거:** 세 테이블이 모두 Realtime publication 에 있어 거대한 행 하나가 열린 탭 전부로 방송되고 목록 쿼리마다 실려 온다. 리뷰 드라이런 실측에서 anon 롤로 `name = '   '`, 10만자 `location`, 1,000원소 × 1,000자 `menus` 삽입이 전부 성공했다. 구 모델이 `name` 을 24자로 묶은 이유가 정확히 이것인데 새로 생긴 두 자유 텍스트 컬럼만 무제한이었다.
  - **Phase 5 후속(이 페이즈에서는 하지 않는다):** 클라이언트 검증이 같은 숫자를 거울처럼 복제해야 한다 — `lib/constants.ts` 에 `RESTAURANT_LOCATION_MAX_LEN = 200`, `RESTAURANT_MENUS_MAX = 30` 을 추가하고 메뉴 원소 길이는 기존 `MENU_NAME_MAX_LEN = 24` 를 재사용한다. 숫자를 바꿀 때는 DB check 와 이 상수를 함께 고친다.

### Claude's Discretion
- 마이그레이션 파일명(`0005_restaurants_settings.sql` 권장), 주석 문안(한글 Why), 인덱스(`candidates(created_at)`, `restaurants(pinned)` 정도), `settings` seed 방식, publication 가드 함수 형태.
- `history_since` 기본값 표현식의 정확한 형태(KST 기준 오늘이면 됨).
</decisions>

<canonical_refs>
## Canonical References

- `supabase/migrations/0001_init.sql` — 테이블·RLS·publication 문법 선례
- `supabase/migrations/0002_cron.sql` — cron unschedule→schedule 패턴, `net.http_post` 본문, 프로젝트 ref
- `supabase/migrations/0004_pinned_menus.sql` — 최신 reset 잡 본문(교체 대상), 핀 재시드 선례
- `lib/supabase/client.ts` — 행 타입 정의처(자동 생성 아님)
- `.planning/PROJECT.md` Key Decisions — 위 결정의 근거
- `.planning/codebase/CONCERNS.md` "전환 리스크 7항목" — publication 누락·이름 조인 등
- `.planning/codebase/INTEGRATIONS.md` — Supabase 구성
</canonical_refs>

<specific_ideas>
## Specific Ideas

- 파일 머리 블록 주석에 "동작 불변 원칙: 이 파일 적용 직후 동작은 현재와 동일(기본값), 동작 변경은 settings UPDATE로만"을 명시.
- `settings`에 `comment on column`으로 각 컬럼 의미(0=끔, 전환일)를 남기면 대시보드에서 편집할 때 보인다.
</specific_ideas>

<deferred>
## Deferred Ideas

- `results.candidates` jsonb 형태 변경(restaurant_id 포함) — Phase 4 (함수가 쓰는 쪽)
- `MenuRow`·`PinnedMenuRow` 타입 삭제 — Phase 6 (페이지 교체 후)
- 롤백 SQL 문서 — Phase 8 (SHIP-02)
- 이름 기준 `winnerIndex` → id 기준 — Phase 6
</deferred>
