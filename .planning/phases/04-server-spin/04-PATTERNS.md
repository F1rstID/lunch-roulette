# Phase 4: 서버 추첨 - Pattern Map

**Mapped:** 2026-09-28
**Files analyzed:** 16 (신규 2 · 수정 13 · 삭제 1)
**Analogs found:** 14 / 16 (exact 9 · role-match 5). 신규 2건(`deno.json`·`deno.lock`)은 **부분 아날로그**만 있다(§No Analog Found)

> **이 페이즈의 핵심 긴장 3건.** 표기는 Phase 2·3 과 같다 — 모든 패턴에 **[그대로] / [변형] / [금지]** 를 붙였다.
>
> 1. **아날로그와 제거 대상이 같은 파일이다.** 두 `index.ts` 의 가장 가까운 아날로그는 자기 자신의 현재 본문인데, 그 본문의 절반(`from("menus")` 1회씩, spin 의 맨 `new Response(` 7회, 조회 에러를 통째로 버리는 `const { data: existing } = …`)이 이번 페이즈의 **삭제 대상**이다. 표시 없이 복사하면 전환이 반쪽만 된다.
> 2. **`deno check` 는 최대 안전장치이면서 한 줄에서는 함정이다.** `restaurants` 임베드의 추론 타입은 배열, 런타임은 객체다(RESEARCH §Q-2b). `row.restaurants[0].name` 은 **통과하면서 틀린다.** 정적 검사의 초록을 근거로 이 줄을 통과시키면 안 된다 → Pattern 1(정규화 헬퍼)이 유일한 안전형.
> 3. **`supabase/functions/deno.json` 은 레포 컨벤션을 물리적으로 지킬 수 없는 첫 파일이다.** 이 레포의 모든 설정 파일은 머리에 한글 Why 블록 주석을 단다(`vitest.config.mts:1-3`·`eslint.config.mjs:15-18`·`tsconfig.json` 은 예외). 그런데 D-01 이 확장자를 `.json` 으로 확정했고 JSON 은 주석을 못 받는다. → **그 Why 는 D-17 의 CLAUDE.md 한 줄이 대신 진다.** D-17 을 "문서 정리" 가 아니라 **이 파일의 누락된 머리 주석**으로 취급할 것.

**프로젝트 스킬 디렉터리:** `.claude/skills` · `.agents/skills` 모두 **없음**(실측) → 추가 규약 로드 없음. 컨벤션 출처는 `CLAUDE.md` + `.planning/codebase/CONVENTIONS.md` 뿐이다.

---

## File Classification

### 신규 (2)

| New File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/functions/deno.json` | config | — | `tsconfig.json:33`(한 줄 설정 + Why 가 딴 문서에 있는 형태) · `vitest.config.mts:1-3`(설정 파일 머리 주석 관례 — **여기서는 적용 불가**) | partial |
| `supabase/functions/deno.lock` | config (generated) | — | `package-lock.json`(269KB, 커밋돼 있고 손으로 고치지 않는다 — 레포에 이미 "생성물을 커밋한다" 선례가 있다) | role-match |

### 수정 (13)

| Modified File | Role | Data Flow | 변경 성격 | Closest Analog | Match |
|---|---|---|---|---|---|
| `supabase/functions/spin-roulette/index.ts` | edge function | request-response → CRUD | **재작성**(조회 3종 교체 + 쿨다운 + 폴백 플래그 + `json()` 통일) | 자기 자신 `:1-97` + `respin-roulette/index.ts:24-36`(`json()` 헬퍼) + `lib/settings.ts:55-73`(설정 파싱 정책의 거울) | exact (self + 형제) |
| `supabase/functions/respin-roulette/index.ts` | edge function | request-response → CRUD | **재작성**(CORS·OPTIONS·`json()` 보존, 본문 교체) | 자기 자신 `:1-89` + 같은 커밋의 `spin-roulette`(헬퍼 이름·시그니처 동일 — D-14 #25) | exact (self + 형제) |
| `package.json` | config | — | `scripts` 1줄 추가 | 자기 자신 `:5-12` | exact (self) |
| `lib/supabase/client.ts` | model (type) | — | `ResultRow.candidates` 1줄 + 주석 | 자기 자신 `:21,24`(필드 옆 한 줄 의미 주석) | exact (self) |
| `lib/errors.ts` | utility (pure) | transform | `formatRespinError` 추가 | 자기 자신 `:1-13` | exact (self) |
| `lib/errors.test.ts` | test (unit) | — | `describe` 1개 + 3케이스 | 자기 자신 `:8-18` | exact (self) |
| `supabase/functions/_shared/spinTime.test.ts` | test (unit) | — | `it` 1개(#16) | 자기 자신 `:51-59` | exact (self) |
| `supabase/functions/_shared/edgeImports.test.ts` | test (contract) | file-I/O → text parse | 계약 확장(#23~, 기존 22건 유지) | 자기 자신 `:1-164` + `supabase/migrations/0005_restaurants_settings.test.ts`(헬퍼·네이밍 원본) | exact (self) |
| `app/page.tsx` | page | request-response | `respin()` 본문만 | 자기 자신 `:213-230` + `:36-38`·`:233-244`(배너 채널 분리 논증) | exact (self) |
| `CLAUDE.md` | docs | — | 진술 5건 정정 + 3줄 추가 | 자기 자신(문체) + Phase 3 의 같은 작업 선례 | exact (self) |
| `.planning/codebase/CONVENTIONS.md` | docs | — | 진술 3건 정정 | 자기 자신 | exact (self) |
| `.planning/codebase/CONCERNS.md` | docs | — | 진술 2건 정정 | 자기 자신 | exact (self) |
| `.planning/todos/pending/wr-01-cutover-window.md` | docs (todo) | — | 4번 정정 + 7번 추가 | 자기 자신 `:9-16`(번호 목록 문체) | exact (self) |

### 삭제 (1)

| Deleted File | 근거 |
|---|---|
| `.planning/todos/pending/wr-02-respin-error-body.md` | D-13a. `resolves_phase: 4` 가 프런트매터에 박혀 있고(`:5`), 해결되면 `done/` 로 옮기지 않고 지우는 것이 Phase 3 의 `in-03-04` 선례다 |

---

## Pattern Assignments

### `supabase/functions/spin-roulette/index.ts` (edge function, request-response → CRUD)

**Primary analog:** 자기 자신. **Secondary:** `respin-roulette/index.ts:24-36`(`json()` 헬퍼의 유일한 실물) · `lib/settings.ts:55-73`(`settingsFromRow` — D-04 가 "대칭이어야 한다" 고 지정한 클라이언트 거울) · RESEARCH §Code Examples 1(`deno check` 통과 확인본 — **타입에 관해서는 이쪽이 정본**).

#### 1. 머리 주석 [변형 — 구조 그대로, 사실만 갱신] ⚠

`spin-roulette/index.ts:1-8` — CONVENTIONS.md:216 이 "가장 좋은 머리 주석 예시" 로 지목한 형식이다. **불릿마다 "무엇을 왜 하는가" 한 줄**이라는 골격을 유지하고 사실만 바꾼다.

```typescript
// 점심 룰렛 추첨 Edge Function.
//
// 매일 KST 11:55에 pg_cron이 이 함수를 호출한다.
// - verify_jwt: false 로 배포 (cron이 익명 호출)
// - 안전장치 1: KST 시각이 11:55 이전이면 거부 (조기 트리거 방지)
// - 안전장치 2: 같은 날짜의 results row가 이미 있으면 즉시 종료 (멱등성)
// - DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 service_role 권한 사용
// - KST 변환·시각 판정·난수 선택은 _shared/ 한 곳으로 합쳤다 (respin-roulette 와의 복붙 제거)
```

| 유지 [그대로] | 갱신 [변형] |
|---|---|
| `// 점심 룰렛 추첨 Edge Function.` + 빈 `//` 줄 + 불릿 목록 구조 | `:3` "매일 KST 11:55에 pg_cron이" → **매분 폴링 + `settings.spin_time`**(0005 cron 이 `* * * * *`). 시각은 이 파일이 정하지 않는다 |
| `- verify_jwt: false 로 배포 (cron이 익명 호출)` 한 줄 | `:5` "11:55 이전이면 거부" → "설정된 추첨 시각(`settings.spin_time`, 없으면 `DEFAULT_SPIN_TIME`) 이전이면 거부" |
| `- DB 접근은 SUPABASE_SERVICE_ROLE_KEY로 …` 한 줄 | **추가 2줄:** 후보 소스가 `candidates` → `restaurants` 조인이라는 사실 + "설정·쿨다운 조회 실패는 기본값으로 진행하고 `console.error` + 응답 플래그로 드러낸다(가용성 > 설정 존중)" — D-04·D-06 의 가용성 논증이 코드 밖에 있으면 다음 사람이 "왜 여기서 안 멈추지" 로 되돌린다 |

**금지:** 이 주석 안에 `console.error`·`restaurants (`·`from("candidates")` 같은 **계약 테스트 토큰을 문자 그대로 쓰지 말 것.** `edgeImports.test.ts` 의 `stripComments` 가 `//` 뒤를 잘라내므로 개수 단언 자체는 안전하지만, `rawSpin`(원본)을 쓰는 단언에 걸리고 Phase 3 이 이 함정으로 12건을 오기했다(CONTEXT D-14).

#### 2. import 블록 [변형 — 핀 + cooldown 추가]

`spin-roulette/index.ts:10-13` (현재)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { kstNow, pickRandom } from "../_shared/kst.ts";
import { DEFAULT_SPIN_TIME, isAfterSpinTime } from "../_shared/spinTime.ts";
```

| 그대로 | 변형 |
|---|---|
| 4줄 순서(타입 전용 d.ts → jsr 값 → `_shared`), `../_shared/*.ts` **확장자 필수**(Deno), `@/` 별칭 금지 | `"jsr:@supabase/supabase-js@2"` → **`"jsr:@supabase/supabase-js@2.117.2"`**(D-02). `edge-runtime.d.ts` 줄은 **핀하지 않는다**(타입 전용, 공식 문서 형태 유지 — RESEARCH §Q-4c 안 C 가 비권고) |
| `import { DEFAULT_SPIN_TIME, isAfterSpinTime } from "../_shared/spinTime.ts";` | `parseSpinTime` 추가(D-04 (3)) → `{ DEFAULT_SPIN_TIME, isAfterSpinTime, parseSpinTime }`. **알파벳 순서**(현재 `DEFAULT_SPIN_TIME, isAfterSpinTime` 가 이미 그렇다) |
| | **새 줄 1개:** `import { applyCooldown, cooldownWindowStart } from "../_shared/cooldown.ts";` — `_shared` import 블록의 마지막에 붙인다(`kst` → `spinTime` → `cooldown` 은 의존 순서가 아니라 사용 순서다) |

#### 3. `json()` 헬퍼 [그대로 — 형제에서 가져오되 CORS 제거] ⚠

`respin-roulette/index.ts:30-36` — 레포에 존재하는 유일한 실물. **spin 은 CORS 가 필요 없다**(pg_cron 서버측 호출).

```typescript
// 모든 응답에 CORS + JSON 헤더를 붙인다.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

→ spin 판:
```typescript
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
```

- **이름·시그니처를 형제와 똑같이** 둔다(`json(body: unknown, status = 200): Response`). Phase 8 낭독에서 두 파일을 diff 로 비교하는 것이 CONTEXT §Specific Ideas 의 의도다.
- 효과: 현재 `new Response(` **7회 → 1회**(실측 베이스라인 §아래 표). 7회의 `{ headers: { "Content-Type": "application/json" } }` 복붙이 사라진다.
- 한 줄 Why 주석을 붙인다(형제의 `// 모든 응답에 CORS + JSON 헤더를 붙인다.` 자리): "CORS 는 붙이지 않는다 — 호출자가 pg_cron 이라 프리플라이트가 없다". 형제와 왜 다른지가 적혀 있지 않으면 다음 사람이 "빠뜨렸다" 고 판단해 넣는다.

#### 4. 설정 읽기 (D-04) [거울 — `lib/settings.ts:55-73` 의 Deno 판] ⚠

**이것이 이 파일에서 가장 중요한 아날로그다.** D-04 가 "클라이언트 `settingsFromRow` 의 warning 과 대칭" 을 요구했고, 그 원본이 이것이다.

`lib/settings.ts:55-73`

```typescript
export function settingsFromRow(row: SettingsRow): { settings: Settings; warning: string | null } {
  const parsed = parseSpinTime(row.spin_time);
  return {
    settings: {
      spinTime: parsed ?? DEFAULT_SETTINGS.spinTime,
      // 음수·NaN 방어: DB check 가 이미 >= 0 을 보장하지만 Realtime 페이로드는 DB 를 거치지 않은
      // 형태로 올 수도 있다고 가정하고 읽는 쪽에서 한 번 더 좁힌다.
      cooldownDays: Number.isFinite(row.cooldown_days) && row.cooldown_days > 0 ? row.cooldown_days : 0,
      …
    },
    // 실패를 삼키지 않는다. 이 문장은 접두 없이 배너에 실리므로 단독으로 읽히는 형태여야 한다.
    warning: parsed
      ? null
      : `추첨 시각 설정값 "${row.spin_time}" 을 읽지 못해 기본값 ${DEFAULT_SPIN_TIME_TEXT} 로 동작해요`,
  };
}
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| **구조 자체:** `parsed ?? 기본값` + "실패를 삼키지 않는다" 를 별도 채널로 돌려주기 | 채널이 `warning: string \| null` → **`settingsFallback: boolean` + `console.error` 1건**(D-04 (2)(3) · D-10). 배너가 없는 실행 환경이라 문장이 아니라 플래그가 채널이다 |
| `Number.isFinite(...)` 로 한 번 더 좁히는 **방어 습관** | 여기서는 `Number(settingsRow.cooldown_days)` 로 넘기고 좁히기는 `cooldownWindowStart` 에 맡긴다(D-04 명시 + `cooldown.ts:16` 이 `Number.isInteger(days) \|\| days <= 0` 으로 흡수). **`lib` 쪽 좁히기를 복사해 오면 로직이 두 곳이 된다** |
| 인라인 Why 주석의 밀도(왜 한 번 더 좁히는가를 2줄로) | `row === null` 은 **에러가 아니다** — `lib/settings.ts:82` 의 `// row === null 은 0행(아직 시드 안 됨)이고 에러가 아니다` 문장을 그대로 옮긴다. D-04 (1) 이 "플래그 없음" 인 이유가 이 한 줄이다 |
| | `row.spin_time` 은 **`any` 다**(RESEARCH §Q-2f·g). `parseSpinTime` 에 넘기기 전 `typeof === "string"` 한 번 — 이 좁히기는 컴파일러가 아니라 규율이 한다 |

#### 5. 멱등 검사 (D-18 + Pitfall 6) [변형 — 에러를 더 이상 버리지 않는다] ⚠

`spin-roulette/index.ts:31-43` (현재)

```typescript
  // 멱등성: 이미 오늘 결과 있으면 종료
  const { data: existing } = await supabase
    .from("results")
    .select("date, menu")
    .eq("date", now.date)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ skipped: "already_decided", date: now.date, menu: existing.menu }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
```

| 그대로 | 변형 |
|---|---|
| `.eq("date", now.date).maybeSingle()` 형태, `if (existing)` 조기 반환 | `select("date, menu")` → **`select("date, menu, restaurant_id")`**(D-18) |
| `skipped: "already_decided"` 키 이름 | 응답에 `restaurant_id: existing.restaurant_id` 추가(D-18) |
| | **`error` 를 구조분해로 받는다** — 현재 코드는 `{ data: existing }` 만 받아 에러를 통째로 버린다. `if (existErr) console.error(…)` 후 **진행**(23505 가 최종 보험, RESEARCH Pitfall 6). 여기서 500 을 내면 그날 추첨만 잃는다 |
| `new Response(JSON.stringify(…))` | `json(…)` 헬퍼 |

#### 6. 후보 조회 + 정규화 (D-03) [신규 — RESEARCH Pattern 1 이 정본] ⚠ 이 페이즈 최대 함정

`spin-roulette/index.ts:45-63` (현재 — **전량 교체 대상**)

```typescript
  // 오늘 후보 조회
  const { data: menus, error: menuErr } = await supabase
    .from("menus")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (menuErr) { … 500 … }
  if (!menus || menus.length === 0) { … skipped: "no_candidates" … }
```

| 그대로 [골격] | 바꿀 것 |
|---|---|
| **`{ data, error }` 구조분해 → 에러면 500 → 0개면 `skipped: "no_candidates"`** 3단 구조. 이 순서가 D-05 에 그대로 남아 있다 | `.from("menus").select("id, name")` → `.from("candidates").select("restaurant_id, created_at, restaurants ( id, name )")` |
| `.order("created_at", { ascending: true })` **한 글자도 바꾸지 않는다** — 옵션 없이 부르면 부모(`candidates`) 정렬이다(RESEARCH §Q-2e, postgrest-js `index.mjs:756-757` 직독). `{ referencedTable: … }` 를 **붙이지 않는다** | `menus.map((m) => ({ name: m.name }))` → 정규화 헬퍼 통과 후 `candidates.map((c) => ({ name: c.name, restaurant_id: c.restaurant_id }))`(D-08) |
| `if (menuErr)` 500 경로 | 500 앞에 `console.error` 1건 추가(D-10) |
| | **`data` 를 추론 타입으로 소비하지 않는다** — `normalizeCandidates(rows: unknown)` 에 그대로 넘긴다 |

**정규화 헬퍼 — RESEARCH §Code Examples 1 / Pattern 1 이 정본**(`deno check` 통과 확인본, `as`·`any` 0):

```typescript
type Candidate = { restaurant_id: string; name: string };

// PostgREST 는 to-one 임베드를 객체로 주지만, Database 제네릭이 없는 클라이언트의 추론 타입은
// 배열이라고 주장한다. 어느 쪽이 와도 같은 결과를 내도록 한 줄로 접는다.
function normalizeCandidates(rows: unknown): { picked: Candidate[]; skipped: number } {
  if (!Array.isArray(rows)) return { picked: [], skipped: 0 };
  const picked: Candidate[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (typeof row !== "object" || row === null) { skipped++; continue; }
    if (!("restaurant_id" in row) || !("restaurants" in row)) { skipped++; continue; }
    const one = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    if (typeof one !== "object" || one === null || !("name" in one)) { skipped++; continue; }
    if (typeof row.restaurant_id !== "string" || typeof one.name !== "string") { skipped++; continue; }
    picked.push({ restaurant_id: row.restaurant_id, name: one.name });   // 담은 순서 유지
  }
  return { picked, skipped };
}
```

- 헬퍼 이름·시그니처를 **두 파일에서 동일하게**(D-14 #25 가 `[1, 1]` 로 고정). 위 `normalizeCandidates` 를 그대로 쓰는 것이 가장 싸다.
- 레포 안의 부분 선례: `lib/errors.ts:10` 의 `error: { message: string } | null` — **라이브러리 타입을 끌어오지 않고 구조적 타입으로만 받는** 기법. 머리 주석의 논증(`lib/errors.ts:4`)을 이 헬퍼 위에 한 줄로 옮긴다("추론 타입을 믿을 수 없어서" 로 이유만 바꿔서).
- `skipped > 0` 이면 `console.error` 1건(D-03·D-10). 조인 미스는 스키마상 도달 불가에 가깝다(`0005:39-42` FK + `on delete cascade`) → 주석에 **"경합 방어가 아니라 형태 방어"** 라고 적는다(RESEARCH §Q-2d). 그래야 다음 사람이 "도달 불가 코드" 로 오해해 지우지 않는다.
- **`!inner` 를 붙이지 않는다** — 타입에 영향이 없고(§Q-2b 실측) FK + cascade 가 이미 inner 를 보장한다.

#### 7. 쿨다운 배선 (D-06) [신규 — `_shared/cooldown.ts` 계약 준수]

호출 계약(`supabase/functions/_shared/cooldown.ts:12,32-35`):

```typescript
export function cooldownWindowStart(today: string, days: number): string | null
export function applyCooldown<T extends { restaurant_id: string }>(
  candidates: T[],
  recentWinnerIds: Iterable<string | null>,
): { picked: T[]; fellBack: boolean }
```

- `from === null` 이면 **조회 자체를 생략**한다(D-06 / SETT-04: 기본 설정 = 쿼리 0회 = 전환 전과 같은 경로). `if (from !== null) { … }` 블록 하나로 감싼다.
- `applyCooldown` 의 2번째 인자는 `Iterable<string | null>` 이다. `recent` 행의 `restaurant_id` 는 `any` 라 좁혀서 넘긴다 — RESEARCH Pattern 4:
  ```typescript
  const ids: (string | null)[] = (recent ?? []).map((r) =>
    typeof r.restaurant_id === "string" ? r.restaurant_id : null);
  ```
- `cooldown.ts:39` 의 `// null 은 전환 이전 레거시 results 행이다 — 매칭 키가 없으므로 무시한다` 가 `null` 을 그대로 넘겨도 되는 근거다. **`.filter(Boolean)` 으로 미리 거르지 말 것** — 거르면 `applyCooldown` 의 그 분기가 영원히 죽고 계약이 한쪽에서만 유지된다.

#### 8. insert + 23505 [그대로 — 형태 보존] ⚠

`spin-roulette/index.ts:68-86`

```typescript
  const { error: insErr } = await supabase.from("results").insert({
    date: now.date,
    menu: winner.name,
    candidates,
  });

  if (insErr) {
    // 동시에 두 번 호출됐다면 unique date 제약으로 거부될 수 있음 — 정상 시나리오
    if (insErr.code === "23505") { … skipped: "race_already_decided" … }
    return … 500 …
  }
```

| 그대로 | 변형 |
|---|---|
| `const { error: insErr } = …` — **`.select()` 를 붙이지 않는다**(RESEARCH §Q-2f: insert/upsert 는 `data: null`, 응답 값은 함수가 든 `winner` 에서 만든다) | insert 본문에 `restaurant_id: winner.restaurant_id` 1줄 추가 |
| `insErr.code === "23505"` 분기 + **그 위의 한 줄 Why 주석**. `edgeImports.test.ts:122-124`(#15)가 `23505` 1회를 고정한다 | 500 경로에 `console.error` 1건(D-10) |
| `skipped: "race_already_decided"` 키 | `new Response(…)` → `json(…)` |

#### 9. 응답 조립 (D-09) [변형 — 키 3개 추가]

`spin-roulette/index.ts:88-96` (현재: `ok`·`date`·`menu`·`candidate_count`)

→ `{ ok: true, date, menu, restaurant_id, candidate_count, picked_count, cooldown_fallback, cooldown_skipped, settings_fallback }`

- `candidate_count` 의 **의미를 바꾸지 않는다**(쿨다운 적용 **전**). 적용 후는 새 키 `picked_count`(D-09).
- 세 boolean 은 **조건부로 빼지 않는다** — `let` 3개를 함수 상단에 선언하고 실패 지점에서 올린다(RESEARCH Pattern 2). 선언 옆 한 줄 주석 3개가 로그 독자의 유일한 범례다:
  ```typescript
  let settingsFallback = false;   // 설정을 못 읽거나 못 읽힌 값이어서 기본값으로 갔다
  let cooldownSkipped = false;    // 쿨다운 창 조회가 실패해 필터를 건너뛰었다
  let cooldownFallback = false;   // 필터 결과가 0개라 전체 후보로 되돌렸다(applyCooldown 이 판정)
  ```
- `skipped: "before_spin_time"` 경로의 `kst: now` **8필드를 줄이지 않는다**(D-05) — cron 로그에서 함수가 본 시각을 보는 유일한 창이다. `spin-roulette/index.ts:21` 이 현재 형태다.

---

### `supabase/functions/respin-roulette/index.ts` (edge function, request-response → CRUD)

**Analog:** 자기 자신 + 같은 커밋의 `spin-roulette`(형제 diff 가 검증 수단이다).

#### 1. 절대 건드리지 않을 것 [금지] ⚠

| 위치 | 내용 | 근거 |
|---|---|---|
| `:10-16` | 머리 주석의 **CORS 논증 7줄**("게이트웨이는 CORS 헤더를 주입하지 않는다(직접 확인)" · "OPTIONS 가 본문을 실행하면 결과가 중복으로 덮어써진다") | 이 문단이 D-12 의 전제를 지킨다. 실측 근거가 코드 밖 어디에도 없다 |
| `:24-28` | `corsHeaders` 객체 3필드 | `edgeImports.test.ts:157-163`(#22)가 `corsHeaders` ≥2회 + `req.method === "OPTIONS"` 1회를 고정 |
| `:30-36` | `json()` 헬퍼(CORS 포함) | D-07. **모든** 반환이 여기를 지나야 D-12 가 산다 |
| `:38-42` | `Deno.serve(async (req) => { if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders }); }` | 프리플라이트가 재추첨을 실행하는 사고 방지 |
| `:69-77` | `upsert(..., { onConflict: "date" })` 형태와 `spun_at: new Date().toISOString()` | D-07 "유지" 목록 |

#### 2. `spin-roulette` 와 같게 만들 것 [복사 — 형제 diff 가 리뷰 수단]

후보 조회(D-03) · `normalizeCandidates`(같은 이름·시그니처) · 설정 조회(D-04) · 쿨다운(D-06) · `console.error` 규약(D-10) · 폴백 플래그 3개(D-09). **`spin-roulette` 쪽을 먼저 완성하고 그 블록을 옮기는 순서**가 D-14 #25 를 자연히 만족시킨다.

#### 3. 다른 것 [의도된 비대칭 — 계약 테스트가 고정]

| 항목 | spin | respin | 근거 |
|---|---|---|---|
| `spinTime.ts` import | 있음 | **없음** | `edgeImports.test.ts:137-139`(#17). 시간 가드가 없으니 `parseSpinTime` 도 불필요 — `settings` 에서 `cooldown_days` 만 쓴다 |
| 시간 가드·멱등 | 있음 | 없음 | D-07(`stalled` 상태의 "지금 돌리기" 여지) |
| `json()` 의 CORS | 없음 | 있음 | 호출자가 pg_cron / 브라우저 |
| `new Response(` 개수 | 1(헬퍼) | **2**(헬퍼 + OPTIONS) | D-14 #24 |
| 쓰기 | `.insert(` + 23505 | `.upsert(` + `onConflict: "date"` | D-07 |

⚠ **`settings` 조회는 respin 에도 넣는다**(D-04 마지막 문장: "`cooldown_days` 만 쓰지만 같은 조회·같은 정책"). `from("settings")` 1회가 두 파일 모두에서 단언된다(D-14).

---

### `supabase/functions/deno.json` (config) — [No Analog: 주석 불가] ⚠

**확정 내용(D-01):**
```json
{ "nodeModulesDir": "none" }
```

- **함수 디렉터리 안(`spin-roulette/`·`respin-roulette/`)에 두지 않는다.** 거기 있으면 Supabase CLI 가 import map 으로 채택해 배포 번들 입력이 바뀐다(RESEARCH §Q-1b, `deploy.ts:810`·`config.go:933-941`). D-14 #23 이 부재를 단언한다.
- `compilerOptions` 등 추가 키를 넣지 않는다(CONTEXT §Claude's Discretion 의 기본값).
- **JSON 은 주석을 못 받는다** → 레포의 "파일 머리에 역할·제약 블록 주석"(CLAUDE.md 코드 컨벤션) 을 지킬 수 없는 첫 파일. Why 는 D-17 의 CLAUDE.md 한 줄이 진다: *"`supabase/functions/deno.json`·`deno.lock` 은 로컬 `check:edge` 전용(배포 미참조). 함수 디렉터리 안에는 `deno.json` 을 두지 않는다."*
- 가장 가까운 형태 선례는 `tsconfig.json:33` — 한 줄 설정이고 그 이유("OOM 전례 때문에 네 곳에서 제외")는 `CLAUDE.md`·`CONVENTIONS.md:55`·`README.md:59-65` 에 산다. **같은 분업 구조를 반복하는 것**이므로 이 레포에서 이질적이지 않다.

### `supabase/functions/deno.lock` (config, generated) — [role-match: `package-lock.json`]

- `deno check --config …` 실행 시 **config 옆에 자동 생성**(276줄, `workspace.packageJson` 섹션 없음 — 실측). 손으로 쓰지 않는다.
- 커밋한다. 레포에 이미 `package-lock.json`(269KB) 을 커밋하는 선례가 있다.
- **루트 `deno.lock` 이 생기면 `.gitignore` 가 아니라 명령을 고친다**(D-02). `.gitignore` 에 현재 deno 관련 항목이 **0건**임을 확인했다 — 새로 추가하지 않는다.
- 드리프트 감지기: `npm run check:edge` 후 `git status` 가 깨끗해야 한다. **`--frozen` 을 스크립트에 넣지 않는다**(diff 를 내며 실패한다 — D-02).

### `package.json` (config)

`package.json:5-12` — `scripts` 블록. 알파벳 순이 아니라 **용도 순**(dev → build → start → lint → test → test:watch)이다.

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

추가할 한 줄(D-01 실측 통과, 0.47s):
```json
    "check:edge": "deno check --config supabase/functions/deno.json supabase/functions/spin-roulette/index.ts supabase/functions/respin-roulette/index.ts"
```
- 위치는 재량이나 **`lint` 다음, `test` 앞**이 "정적 검사끼리 모인다" 는 읽기 순서에 맞는다.
- 두 파일을 한 명령에 나열한다(CONTEXT §Specific Ideas — `deno check` 는 여러 진입점을 받는다).
- 기존 스크립트 6개를 건드리지 않는다. `dependencies`·`devDependencies` 에 **아무것도 추가하지 않는다**(deno 는 `brew` 로 설치된 외부 도구다 — D-01 "루트 `package.json`·`node_modules` 오염 금지").

---

### `lib/supabase/client.ts` (model, type) — 1줄 + 주석

`lib/supabase/client.ts:18-25`

```typescript
export type ResultRow = {
  id: string;
  date: string;
  menu: string; // 이제 매장명 스냅샷. 매장이 지워져도 이 문자열이 남아 있는 것이 기록·랭킹의 전제다
  candidates: { name: string }[];
  spun_at: string;
  restaurant_id: string | null; // 매장 삭제 시 set null (supabase/migrations/0005_restaurants_settings.sql)
};
```

- `:22` → `candidates: { name: string; restaurant_id?: string }[];` + **필드 옆 한 줄 주석**(이 타입의 다른 두 필드가 이미 그 형식이다): `// Phase 4 부터 restaurant_id 포함, 이전 행은 name 만` (D-08).
- `?` 인 이유(레거시 60행에 키가 없다)가 주석의 본체다. **`| undefined` 로 쓰지 않는다** — 레포 전체가 optional 표기를 쓴다(`app/page.tsx:19` `RespinResponse`).
- 소비처 `components/CalendarLog.tsx:223,248,251` 은 `c.name` 만 읽어 **무변경**. 플랜의 완료 조건에 `npx tsc --noEmit` exit 0 을 넣어 이 사실을 고정한다.

### `lib/errors.ts` (utility, pure) — `formatRespinError` 추가

**Analog:** 자기 자신 `:1-13`.

```typescript
// 읽기(SELECT) 실패를 화면에 띄울 한 줄 한국어 문장으로 조립하는 순수 모듈.
// 순수성 자체가 이 파일의 계약이다 — 데이터 클라이언트·React·환경변수를 import 하지 않는다.
// 그래야 테스트 러너가 브라우저 전역이나 NEXT_PUBLIC_* 키 없이 이 파일만 단독으로 불러올 수 있다.
// 에러 타입을 라이브러리에서 가져오지 않고 { message: string } 구조적 타입으로만 받는 이유도 같다.
// message 만 쓴다: details·hint 에는 SQL 조각과 테이블·컬럼명이 실려 화면 노출 시 내부 구조가 샌다.

export function formatLoadError(label: string, error: { message: string } | null): string | null {
  if (!error) return null;
  return `${label} 불러오기 실패: ${error.message}`;
}
```

| 그대로 | 변형 |
|---|---|
| **값 import 0개**(D-13) — `FunctionsHttpError` 도, `supabase` 도 끌어오지 않는다. `:2-4` 의 논증이 그 이유다 | 머리 주석 `:1` "읽기(SELECT) 실패를 …" 이 이제 파일 전체를 설명하지 못한다 → **범위를 한 단어 넓힌다**(예: "읽기(SELECT)·Edge Function 실패를 …"). 4줄 논증 `:2-5` 는 그대로 |
| `label`/`error` 를 받아 한 줄 문장을 돌려주는 **총 함수**, throw 0건 | 시그니처: `formatRespinError(fallbackMessage: string, body: unknown): string` — `string \| null` 이 아니라 **항상 `string`**(D-13). 호출부가 배너에 그대로 싣는다 |
| 함수 위 한 줄 JSDoc 없음 → 이 파일은 **머리 주석에 이유를 모으는** 형식 | RESEARCH §Code Examples 3 이 JSDoc 1줄 + Why 2줄을 함수 위에 붙였다. `lib/errors.ts` 관례상 **함수 위 Why 주석**은 `:16`(`joinLoadErrors` 안쪽)에 선례가 있으므로 어느 쪽이든 무방 — `body` 를 `unknown` 으로 받는 이유와 빈 문자열을 거르는 이유는 **반드시** 남긴다 |

본문(RESEARCH §Code Examples 3, `in` 좁히기가 tsc 5.9.3 · Deno TS 6.0.3 양쪽 통과 확인):
```typescript
export function formatRespinError(fallbackMessage: string, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const message = body.error;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }
  return fallbackMessage;
}
```

### `lib/errors.test.ts` (test, unit) — `describe` 1개 추가

**Analog:** 자기 자신 `:1-18`.

```typescript
import { describe, it, expect } from "vitest";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";

describe("formatLoadError", () => {
  it("에러가 없으면 null 을 준다 (배너 미렌더 신호)", () => {
    expect(formatLoadError("메뉴 목록", null)).toBeNull();
  });
```

| 그대로 | 변형 |
|---|---|
| 명시 import(`globals: false`), `@/lib/errors` 별칭, 함수당 `describe` 1개, **단언 1개 = `it` 1개**, 한글 `it` 이름(조사 앞 띄어쓰기: `null 을`) | import 목록에 `formatRespinError` 추가 |
| 머리 주석 `:1-3` — "무엇을 왜 따로 검사하는가"(`:3` 의 "빈 문자열 분기를 따로 검사하는 이유") | 같은 자리에 **3번째 케이스의 존재 이유**를 한 줄: `error` 가 빈 문자열이면 `"다시 돌리기 실패: "` 로 끝나는 배너가 나온다 |
| `it` 이름에 `(#N)` 번호 **없음** — 이 파일은 `lib/**` 스펙이라 번호 체계가 없다. `_shared/**`·`migrations/**` 만 번호를 쓴다 | 3케이스(D-13): 본문 우선 / 본문 `null`·비객체 / `error` 빈 문자열 |

### `supabase/functions/_shared/spinTime.test.ts` (test, unit) — 1케이스 추가 (D-15)

**Analog:** 자기 자신 `:51-59`(`describe("SPINTIME/QUAL-02 — 기본 추첨 시각의 정의처는 이 파일이다")`).

```typescript
describe("SPINTIME/QUAL-02 — 기본 추첨 시각의 정의처는 이 파일이다", () => {
  it("DEFAULT_SPIN_TIME 이 11시 55분이다 (#9)", () => {
    expect(DEFAULT_SPIN_TIME).toEqual({ hh: 11, mm: 55 });
  });

  it('DEFAULT_SPIN_TIME_TEXT 가 "11:55" 다 (#10)', () => {
    expect(DEFAULT_SPIN_TIME_TEXT).toBe("11:55");
  });
});
```

- 추가할 것: `expect(parseSpinTime(DEFAULT_SPIN_TIME_TEXT)).toEqual(DEFAULT_SPIN_TIME)` — **이 describe 안**(두 상수의 관계를 못 박는 자리다).
- **번호는 `#16`** — 현재 마지막이 `:78`의 `(#15)` 다(실측).
- ⚠ **이 한 건만 리터럴 규칙의 예외다.** 머리 주석 `:3-5` 가 "기대값을 상수에서 가져오지 않는다" 고 못 박았는데, D-15 의 케이스는 **두 상수가 서로 일치한다는 왕복(round-trip)** 자체가 계약이라 양쪽 다 상수여야 한다. `it` 이름이나 한 줄 주석으로 이 예외를 명시할 것 — 안 적으면 다음 리뷰어가 머리 주석 위반으로 되돌린다.
- D-15 의 나머지 4항목은 **이미 존재**하므로 추가하지 않고 플랜에 "인용" 으로 적는다(실측 확인): `spinTime.test.ts:22`(#2 `"11:55:00"`) · `:66`(#12 11:54:59) · `:70`(#13 11:55:00) · `cooldown.test.ts` #1·#7.

### `supabase/functions/_shared/edgeImports.test.ts` (test, contract / file-I/O)

**Analog:** 자기 자신 `:1-164` + `supabase/migrations/0005_restaurants_settings.test.ts:1-37`(헬퍼 원본).

#### 1. 그대로 쓸 헬퍼·상수 [이미 파일 안에 있다 — 재작성 금지]

`:13-19` `readOrEmpty` · `:22-32` `stripAfter`/`stripComments` · `:34-36` `count` · `:39-49` raw/stripped 이중 보유 · `:52` `IMPORT_LINE`. **`existsSync` 만 신규 import 가 필요하다**(#23):

```typescript
import { readFileSync } from "node:fs";
```
→ `import { existsSync, readFileSync } from "node:fs";` (레포에 `existsSync` 사용처 **0건** — 최초).

#### 2. 유지할 단언 [금지 — 지우지 말 것]

`:54-78` #1~#6(`_shared` import 0) · `:85-124` #7a·#7·#8·#9~#15 · `:129-163` #16a·#16·#17·#18~#22. D-14 가 **전부 유지**를 지시했다.
⚠ 재작성이 이 중 일부를 자동으로 깨뜨리지 않는지 확인할 것: #12(`const SPIN_HH`/`const SPIN_MM` 0건) · #13/#20(`type KstParts` 0건) · #14/#21(`hour12` 0건)은 재작성 후에도 0이어야 한다 — 로컬 타입을 새로 선언할 때(D-11) **이름을 `KstParts` 로 쓰면 #13 이 적색이 된다.** `Candidate`·`SettingsLike` 류로 지을 것.

#### 3. 단언 스타일 [그대로]

`:109-112` — 짝 불변식을 배열로 묶는 관용구. 새 단언도 같은 형식을 쓴다.

```typescript
  it("SPIN_HH·SPIN_MM 하드코딩이 둘 다 사라졌다 (#12)", () => {
    // 짝을 이루는 불변식이라 한 번에 단언한다 — 한쪽만 지운 파일은 추첨 시각이 반쪽만 옮겨진 상태다.
    expect([count(spin, /const SPIN_HH/g), count(spin, /const SPIN_MM/g)]).toEqual([0, 0]);
  });
```

- **`toMatch` 금지** — 레포 사용처 0건(Phase 3 실측). `count(…, /…/g)` + 숫자 단언만.
- **양방향 이중 단언 습관 유지**: `from("menus")` **0회**(부재)와 `from("candidates")` **1회**(존재)를 둘 다 센다. 한쪽만 세면 통과하는 구멍이 생긴다(`0005 test:95-99` 의 교훈).
- 임베드 토큰은 **공백 변형 허용 정규식**: `/restaurants\s*\(\s*id\s*,\s*name\s*\)/g` (D-14 — 타입 파서가 공백·별칭에 관대함이 §Q-2b 로 실측됐으므로 텍스트 단언도 같은 관대함을 가져야 한다).
- 순서 불변식(D-05)은 `indexOf` 비교로: `isAfterSpinTime(` < `from("results")`(멱등) < `from("candidates")` < `applyCooldown(` < `.insert(`. **`count` 헬퍼로는 표현할 수 없는 유일한 단언**이라 `spin.indexOf(…)` 를 직접 쓴다 — 레포 최초 형태이므로 한 줄 Why 주석을 붙인다.

#### 4. 신규 단언 3종 [RESEARCH §Code Examples 4 가 정본]

```typescript
it("spin-roulette 디렉터리에 deno.json 이 없다 (#23)", () => {
  expect(existsSync(new URL("../spin-roulette/deno.json", import.meta.url))).toBe(false);
});

it("respin 의 맨 new Response 는 OPTIONS 단락 1곳 + json 헬퍼뿐이다 (#24)", () => {
  expect(count(respin, /new Response\(/g)).toBe(2);
});

it("두 파일의 후보 정규화 헬퍼 이름이 같다 (#25)", () => {
  expect([count(spin, /function normalizeCandidates\(/g), count(respin, /function normalizeCandidates\(/g)])
    .toEqual([1, 1]);
});
```
경로는 **`new URL(…, import.meta.url)`**(`:39-43` 과 같은 형식). cwd 상대 문자열 금지.

#### 5. 기준 숫자 실측 베이스라인 (D-14 "플래너가 실측 후 기입") ⚠

2026-09-28 측정. `raw` = 원본, `str` = `//` 뒤를 잘라낸 사본(= `spin`/`respin` 변수가 보는 값).

| 토큰 | spin raw | spin str | respin raw | respin str | 재작성 후 목표 |
|---|---|---|---|---|---|
| `new Response(` | 7 | 7 | 2 | 2 | spin **1** · respin **2**(#24) |
| `from("menus")` | 1 | 1 | 1 | 1 | **0 / 0** |
| `from("candidates")` | 0 | 0 | 0 | 0 | **1 / 1** |
| `from("settings")` | 0 | 0 | 0 | 0 | **1 / 1** |
| `from("results")` | 2 | 2 | 1 | 1 | spin ≥2(멱등+쿨다운+insert) · respin ≥1 |
| `restaurants` | 0 | 0 | 0 | 0 | ≥1 / ≥1 (임베드 정규식) |
| `_shared/cooldown.ts` | 0 | 0 | 0 | 0 | **1 / 1** |
| `cooldownWindowStart(` | 0 | 0 | 0 | 0 | **1 / 1** |
| `applyCooldown(` | 0 | 0 | 0 | 0 | **1 / 1** |
| `restaurant_id` | 0 | 0 | 0 | 0 | ≥1 / ≥1 |
| `console.error(` | 0 | 0 | 0 | 0 | ≥1 / ≥1 |
| `settings_fallback` | 0 | 0 | 0 | 0 | ≥1 / ≥1 |
| `cooldown_fallback` | 0 | 0 | 0 | 0 | ≥1 / ≥1 |
| `cooldown_skipped` | 0 | 0 | 0 | 0 | ≥1 / ≥1 |
| `parseSpinTime(` | 0 | 0 | 0 | 0 | spin ≥1 · respin **0** |
| `DEFAULT_SPIN_TIME` | 2 | 2 | 0 | 0 | ⚠ **접두 충돌**: 이 패턴은 `DEFAULT_SPIN_TIME_TEXT` 도 센다. 경계(`/DEFAULT_SPIN_TIME\b/g`)를 쓸 것 |
| `isAfterSpinTime(` | 1 | 1 | 0 | 0 | spin 1 · respin 0 |
| `.insert(` | 1 | 1 | 0 | 0 | spin 1 · respin 0 |
| `.upsert(` | 0 | 0 | 1 | **1** | respin 1 (raw 는 `upsert(` 로 세면 **2** — `:7` 주석이 걸린다) |
| `onConflict` | 0 | 0 | 2 | **1** | respin 1 (`:7` 주석 `onConflict: date` 가 raw 에 섞인다) |
| `jsr:@supabase/supabase-js@2` | 1 | 1 | 1 | 1 | `@2.117.2` 핀 토큰으로 1 / 1 |
| `json(` | 0 | 0 | 5 | 5 | spin ≥2(선언+호출) |
| `Deno.serve(` | 1 | 1 | 1 | 1 | 1 / 1 (#7a·#16a) |
| `23505` | 1 | 1 | 0 | 0 | 1 / 0 (#15) |
| `corsHeaders` | 0 | 0 | 3 | 3 | 0 / ≥2 (#22) |

**교훈 2건이 이 표에 박혀 있다:** (1) `upsert(`·`onConflict` 는 raw 와 str 이 다르다 → **str 사본에서 센다**(CONTEXT D-14 가 지적한 그대로). (2) `DEFAULT_SPIN_TIME` 은 접두 충돌이 있다 → `\b` 경계 필수.

---

### `app/page.tsx` — `respin()` 만 (page, request-response)

**Analog:** 자기 자신 `:213-230`.

```typescript
  async function respin() {
    setRespinning(true);
    try {
      // service_role 함수가 results를 덮어쓰고, realtime UPDATE로 휠이 다시 돈다
      const { data, error } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
      if (error) {
        setActionError(`다시 돌리기 실패: ${error.message}`);
        return;
      }
      if (data?.skipped) {
        const reason = data.skipped === "no_candidates" ? "후보가 없어요" : data.skipped;
        setActionError(`다시 돌리기 건너뜀: ${reason}`);
        return;
      }
      setActionError(null);
    } finally {
      setRespinning(false);
    }
  }
```

| 그대로 [금지 — 바꾸지 말 것] | 변형 [D-12] |
|---|---|
| `setRespinning(true)` / `finally { setRespinning(false) }` 구조 | `const { data, error }` → **`const { data, error, response }`**(1줄). 타입은 `Response \| undefined`(RESEARCH §Q-3b 실측) |
| `data?.skipped` 분기와 `"no_candidates" → "후보가 없어요"` 번역(CONVENTIONS.md:186 이 규약으로 문서화) | `error` 분기 안 3줄: 본문 읽기 → fallback 좁히기 → `formatRespinError` 조립 |
| `setActionError(…)` — **쓰기 에러 채널.** `:36-38` 의 주석이 `loadError` 와 합치지 말라는 이유를 적어 뒀다 | 배너 접두 `다시 돌리기 실패: ` **유지**(D-12 문면) |
| `setActionError(null)` 로 끝내는 성공 경로 | **import 를 늘리지 않는다** — `FunctionsHttpError` 값 import 금지(D-12). `app/page.tsx:1-16` 의 import 블록이 무변경인 것이 이 결정의 관찰 가능한 결과다 |
| `// service_role 함수가 results를 덮어쓰고, realtime UPDATE로 휠이 다시 돈다` 한 줄 주석 | **주석 2줄 추가**(RESEARCH §Code Examples 2): `response` 가 `error.context` 와 같은 미독 `Response` 라는 사실 + `.catch(() => null)` 인 이유(게이트웨이 HTML 일 때 두 번째 예외로 배너가 사라지면 안 된다) |

본문(레포 tsc 5.9.3 통과 확인본 — RESEARCH §Code Examples 2):
```typescript
      const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
      if (error) {
        const body: unknown = response ? await response.json().catch(() => null) : null;
        const fallback = error instanceof Error ? error.message : String(error);
        setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, body)}`);
        return;
      }
```
- `error instanceof Error` 로 좁히는 이유: `error` 의 타입이 `any` 다(§Q-3b). 좁히지 않으면 `any` 가 새고, `error.message` 직접 접근은 CLAUDE.md 의 "`any` 를 안 쓴다" 취지와 어긋난다.
- import 추가는 **`@/lib/errors` 한 줄 안에서**: `import { formatLoadError, joinLoadErrors } from "@/lib/errors";`(`:9`) → `formatRespinError` 를 같은 중괄호에 넣는다(알파벳 순: `formatLoadError, formatRespinError, joinLoadErrors`).
- **`RespinResponse`(`:19`)를 수정하지 않는다** — `{ ok?: boolean; skipped?: string; error?: string }` 가 이미 `error` 를 갖고 있고, D-12 는 그것이 "실제로 읽히게" 만드는 작업이다. 선언은 그대로 두고 소비만 생긴다.
- **이 함수 밖은 손대지 않는다.** 후보 소스(`menus`)·`winnerIndex`·화면 문구는 Phase 6 이다(CONTEXT Phase Boundary).

---

### 문서 3개 + todo 2개 (docs — D-17 · D-13a)

**문체:** 세 문서 모두 한글 + 백틱 식별자 + 굵은 강조로 금지/주의 + **줄 번호 인용 습관**(`lib/phase.ts:14-16`). 줄이 바뀌면 함께 갱신. Phase 3 이 같은 작업을 한 선례가 있다(`03-PATTERNS.md` §CLAUDE.md 표).

**정정 대상 — 실측 줄 번호(2026-09-28):**

| 파일:줄 | 현재 진술 | 이 페이즈 후 사실 |
|---|---|---|
| `CLAUDE.md:22-27` | 검증 명령 4줄 블록(`npx tsc` / `npm run lint` / `npm test` / `npm run build`) | **5줄** — `npm run check:edge   # deno check 두 Edge Function (유일한 정적 검사)` 추가(D-17 (1)) |
| `CLAUDE.md:41` | "두 `index.ts` 본문은 여전히 사각지대 — `_shared/edgeImports.test.ts` 의 텍스트 계약 + 낭독으로만 검증되므로 수정 후 직접 확인." | "`deno check`(`npm run check:edge`)가 두 `index.ts` 를 검사한다. 실호출은 컷오버 전 불가"(D-17 (2)) |
| `CLAUDE.md:16` | "`supabase/functions/spin-roulette` — pg_cron이 11:55에 호출하는 추첨 함수 (시간 가드 + 멱등). `respin-roulette` — 클라이언트 '다시 돌리기' (가드 없음, upsert)." | `candidates`→`restaurants` 조인 + `settings` + 쿨다운 반영(D-17 (3)) |
| `CLAUDE.md:18` | 흐름 문단 "클라이언트는 `menus`/`results`를 직접 SELECT…" | 서버 쪽 `menus` 언급 정정(클라이언트 `menus` 는 Phase 6 까지 사실이므로 **함수 쪽만** 고친다)(D-17 (3)) |
| `CLAUDE.md:30-40` 중 코드 컨벤션 | — | D-10 한 줄 추가: "Edge Function 실패·폴백 경로는 `console.error` 로 Supabase 로그에 남긴다. 클라이언트는 배너"(D-17 (4)) |
| `CLAUDE.md:41` 부근(비표준 규약) | — | D-01·D-02 한 줄 추가: `deno.json`·`deno.lock` 의 위치·용도 + 함수 디렉터리 금지 + 버전 올릴 때 2곳 갱신(D-17) |
| `CLAUDE.md` 전체 | "`deno` 는 로컬에 없다" 류 진술 — **grep 결과 CLAUDE.md 에는 없다**(실측). 해당 진술은 `edgeImports.test.ts:1` 과 `CONCERNS.md:195` 에 있다 | D-17 (5) 의 대상은 실제로는 아래 두 줄이다 |
| `CONVENTIONS.md:281` | "**`tsconfig.json`·`eslint.config.mjs`에서 제외돼 있어 타입체크·lint가 돌지 않는다.** 수정 후 배포해서 직접 확인해야 한다." | `deno check`(`npm run check:edge`)가 검사한다. eslint 는 여전히 제외 |
| `CONVENTIONS.md:282` | "그래서 `lib/`를 공유할 수 없다 — `kstNow()`가 두 함수에 복붙돼 있다(`spin-roulette/index.ts:17-35`, `respin-roulette/index.ts:37-55`)." | **Phase 3 이 이미 해결했는데 이 줄이 남아 있다.** `_shared/kst.ts` 단일 정의로 정정(줄 번호도 무효) |
| `CONVENTIONS.md:299-304` | Verification Commands 3줄 + "Edge Function이나 마이그레이션을 건드렸다면 이 명령들이 **검사하지 않으므로** 별도로 확인해야 한다." | `npm test`·`npm run check:edge` 추가. 마지막 문장은 "Edge Function 은 `check:edge`, 마이그레이션은 계약 테스트가 본다. 실호출만 남는다" |
| `CONCERNS.md:191-196` | `### [P1] Edge Function이 타입체크·lint 사각지대` + `:195` "수정 후 `deno check …`를 **수동 실행**하고" + `:196` "Test coverage: 0." | `check:edge` 로 **자동화**됐고 `edgeImports.test.ts` 25건이 텍스트 계약을 덮는다. P1 → 강등(남는 위험은 "실호출 0" 뿐) |
| `CONCERNS.md:148-151` | `### [P2] 핵심 경로에 로깅·알림이 전혀 없다` + "코드 전체에 `console.*` 호출이 **0건**이다" + Recommendations "최소한 Edge Function 양쪽에 `console.error`를 넣어…" | D-10 이 그 권고를 **이행**했다. 남는 항목은 `net._http_response` 점검·헬스체크 cron(범위 밖) |
| `CONCERNS.md:331` | "`spin-roulette`/`respin-roulette` 모두 `from(\"menus\").select(\"id, name\")` → … 스키마를 바꾸면 이 코드는 **컴파일 에러 없이** 다음 11:55에 처음 터진다" | 재작성 완료 + `check:edge` 가 컴파일 에러를 준다. **단, 임베드 배열/객체 함정(D-03)은 정적 검사가 못 잡는다** — 이 사실을 대신 적는다 |
| `todos/pending/wr-01-cutover-window.md:13` | "4. **곧바로** Edge Function 2종 재배포 — `--no-verify-jwt` 필수(config.toml 없음)." | "`supabase/config.toml` 에 `verify_jwt = false` 고정(63fae89); `--no-verify-jwt` 병행은 이중 안전"(D-17) |
| `todos/pending/wr-01-cutover-window.md:9-16` | 6번까지의 번호 목록 | **7번 추가**: 배포 직후 `respin-roulette` 수동 invoke 응답의 `menu` 가 실제 매장명이고 `restaurant_id` 가 uuid 인지 확인 — 임베드 함정은 첫 실호출에서만 드러난다(D-17) |
| `todos/pending/wr-02-respin-error-body.md` | 파일 전체 | **삭제**(D-13a). 본문 마지막 문장이 `error.context.json()` 을 지시하지만 D-12 가 `response` 경로로 바꿨다 — 삭제하므로 정정 불필요 |

⚠ **`CONVENTIONS.md:282` 는 Phase 3 의 누락분이다.** 이 페이즈에서 함께 고친다(같은 문단이고, 안 고치면 D-17 커밋 후에도 그 절만 낡은 채로 남는다).

---

## Shared Patterns

### `json()` 헬퍼로 반환을 통일한다 — CORS 누락이 구조적으로 불가능해진다
**Source:** `supabase/functions/respin-roulette/index.ts:30-36`
**Apply to:** 두 `index.ts` 전부
```typescript
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```
respin 은 CORS 포함, spin 은 제외. 맨 `new Response(` 는 respin 의 OPTIONS 단락 **1곳뿐**(#24가 총 2회로 고정). 500 하나라도 헬퍼를 안 거치면 브라우저가 본문을 차단하고 D-12 가 조용히 죽는다(RESEARCH §Q-3c).

### 폴백 플래그 3개를 `let` 으로 들고 다닌다
**Source:** 레포 선례 없음 — RESEARCH Pattern 2 가 정본. 가장 가까운 정신적 선례는 `lib/settings.ts:38-40`(`error` 와 `warning` 을 **다른 채널**로 분리한 결정과 그 이유 주석)
**Apply to:** 두 `index.ts`
`settingsFallback`·`cooldownSkipped`·`cooldownFallback` 을 상단에 선언 + 한 줄 주석, 성공 응답에 **항상** 싣는다(조건부 제외 금지 — D-09).

### `any` 가 새는 자리마다 `typeof` 한 번
**Source:** `lib/settings.ts:62`(`Number.isFinite(...) && ... > 0` 방어) · `cooldown.ts:13-16`(오염 입력 흡수 + 3줄 Why)
**Apply to:** `settings` 행 3필드 · 쿨다운 행의 `restaurant_id` · 조인 행 전부
`Database` 제네릭이 없어 모든 조회 필드가 `any` 다(§Q-2f·g). eslint 도 함수 디렉터리를 무시한다 → **좁히기는 컴파일러가 아니라 규율이 한다.** 진단 메시지는 `JSON.stringify(값)` 으로 감싼다(`[object Object]` 방지).

### 한글 Why 주석 — "무엇을 하지 말 것인가"까지 적는다
**Source:** `respin-roulette/index.ts:1-16`(CONVENTIONS.md:216 이 지목한 최고 예시) · `lib/errors.ts:1-5` · `cooldown.ts:1-11`
**Apply to:** 두 `index.ts` 머리 주석, 정규화 헬퍼, 폴백 플래그 선언부
"왜 이 흔한 방법을 안 썼는가" 가 이 레포의 시그니처다. 이번 페이즈에서 반드시 남겨야 할 3건: (a) 임베드를 왜 정규화하는가, (b) 조회 실패에 왜 500 이 아니라 진행인가, (c) 조인 미스 가드가 왜 도달 불가처럼 보이는가.

### 텍스트 계약 테스트 골격
**Source:** `supabase/functions/_shared/edgeImports.test.ts:13-52`(원본은 `supabase/migrations/0005_restaurants_settings.test.ts:14-36`)
**Apply to:** `edgeImports.test.ts` 확장분
`readOrEmpty` + `stripComments` + `count()` + raw/str 이중 보유 + `new URL(…, import.meta.url)` + `describe("<영역>/<REQ> — 한글 서술문")` + `it("… (#N)")` + **양방향 이중 단언**.

### vitest 스펙 골격
**Source:** `lib/errors.test.ts:5-11` · `spinTime.test.ts:8-15`
**Apply to:** `lib/errors.test.ts`·`spinTime.test.ts` 추가분
명시 import(`globals: false`) + `lib/**` 는 `@/` 별칭 / `_shared/**` 는 `./spinTime` 상대(확장자 없이) + 한글 `it` 이름 + **단언당 `it` 하나** + 머리 주석에 "안 하기로 한 것과 그 이유".

### 실행 검증 명령 (D-16 — 5종)
**Source:** `package.json:5-12` · CLAUDE.md:22-27
**Apply to:** 모든 태스크
`npx vitest run supabase/functions/_shared lib`(빠른 루프) → `npm test`(기준선 **189 tests / 10 files**) → `npx tsc --noEmit` → `npm run lint` → `npm run build` → **`npm run check:edge`**.
`check:edge` 는 **RED 커밋에서도 초록**이어야 한다(D-16). 그리고 실행 후 `git status` 가 깨끗한지 본다(lock 드리프트 감지기 — D-02).

---

## Anti-Patterns in the Analogs (복사 금지 목록)

아날로그에 실재하지만 이 페이즈가 **따라 하면 안 되는** 줄.

| 아날로그 위치 | 복사 금지 코드 | 이 페이즈의 안전형 | 근거 |
|---|---|---|---|
| `spin-roulette/index.ts:32` | `const { data: existing } = await supabase…` — **`error` 를 구조분해에서 통째로 뺀다** | `const { data: existing, error: existErr } = …` + `console.error` 후 진행 | Pitfall 6. 현재 코드는 조회 실패를 "결과 없음" 과 구분하지 못한다 |
| `spin-roulette/index.ts:20-23,39-42,52-55,59-62,77-80,82-85,88-95` | 맨 `new Response(JSON.stringify(…), { headers: { "Content-Type": "application/json" } })` **7회 복붙** | `json()` 헬퍼 1곳 | D-07 / Pattern 3 |
| 두 파일 `:46-49` / `:52-55` | `.from("menus").select("id, name")` | `.from("candidates").select("restaurant_id, created_at, restaurants ( id, name )")` | D-03. 계약 테스트가 `from("menus")` 0회를 단언 |
| 두 파일 `:66` | `menus.map((m) => ({ name: m.name }))` — 스냅샷에 id 없음 | `{ name, restaurant_id }` | D-08 |
| RESEARCH 가 보여 준 **통과하는 오답** | `row.restaurants[0].name` | `normalizeCandidates(rows: unknown)` | §Q-2b ⚠ `deno check` 가 이 줄을 인증한다 |
| `lib/settings.ts:62` | `Number.isFinite(row.cooldown_days) && row.cooldown_days > 0 ? … : 0` | Edge 에서는 `Number(row.cooldown_days)` 만 하고 `cooldownWindowStart` 에 맡긴다 | 좁히기 로직이 두 곳으로 갈라지면 정의처가 둘이 된다 |
| `spin-roulette/index.ts:15`(Phase 3 이 지운 자리) | 로컬 `type KstParts` 재선언 | 로컬 타입 이름을 `Candidate` 등으로 — **`KstParts` 재사용 금지** | `edgeImports.test.ts:114-116`(#13)가 0건을 단언 |
| `respin-roulette/index.ts:7` | 주석 안의 `upsert(onConflict: date)` | 계약 테스트는 **str 사본**에서 센다 | 실측: raw 2 / str 1 |
| `app/page.tsx:217` | `const { data, error } = …` 후 `error.message` 직접 접근(`any`) | `error instanceof Error ? error.message : String(error)` | §Q-3b |
| `wr-02-respin-error-body.md:7` | "`error instanceof FunctionsHttpError` 면 `await error.context.json()`" | `response` 필드 경로(값 import 0, `any` 0) | D-12 가 todo 의 지시를 **대체**했다. 그래서 todo 를 삭제한다 |

추가 금지:
- **`supabase/functions/<slug>/deno.json` 두기** — 배포가 import map 으로 채택한다(§Q-1b).
- **루트 `deno.lock` 을 `.gitignore` 로 덮기** — 명령을 고치는 쪽이 맞다(D-02).
- **`upsert(...).select()` 로 응답 만들기** — 불필요한 왕복. `data: null` 이다(§Q-2f).
- **`_shared` 에 새 모듈·jsr import 추가** — D-11. `check:edge` 가 `_shared` 를 전이 검사하므로 jsr import 가 섞이면 tsc 쪽이 즉시 깨진다(§Q-7).
- **`console.error`·`from("candidates")` 같은 계약 토큰을 한글 주석에 쓰기** — Phase 3 의 반복된 사고.
- **`npm run dev` 로 확인** — CLAUDE.md 금지(가드런처만). 이 페이즈는 5종 명령으로 전부 검증된다.
- **`app/page.tsx` 의 `respin()` 밖을 건드리기** — Phase 6 범위.

---

## No Analog Found

레포에 선례가 없어 **RESEARCH.md 의 검증된 스니펫이 정본**인 요소들.

| 요소 | Role | Data Flow | Reason |
|---|---|---|---|
| `normalizeCandidates(rows: unknown)` — 추론 타입을 버리는 정규화 헬퍼 | utility (in-function) | transform | 레포의 모든 조회가 `data as XRow[]` 단언으로 끝난다(`app/rank/page.tsx:37` 등). `unknown` 으로 받아 런타임에 좁히는 형태는 **최초**. RESEARCH §Code Examples 1 / Pattern 1 이 정본 |
| `Array.isArray(embed) ? embed[0] : embed` 임베드 접기 | utility | transform | 레포에 PostgREST 임베드 조회 자체가 0건. §Q-2a·b 가 유일한 근거 |
| 폴백 플래그 `let` 3개 + 응답 상시 포함 | edge function | — | 레포에 "부분 실패를 응답에 싣는" 선례 0건(현재 응답은 ok/skipped/error 3형태뿐). RESEARCH Pattern 2 |
| `console.error` | edge function | — | **레포 전체 `console.*` 0건**(CONCERNS:148 실측). 이 페이즈가 최초이자 규약 신설(D-10) |
| `supabase/functions/deno.json` — 주석 없는 설정 파일 | config | — | 레포의 설정 파일은 전부 머리 Why 주석을 단다(`vitest.config.mts:1-3`·`eslint.config.mjs:15-18`). JSON 은 그것이 불가능한 첫 사례 → Why 가 CLAUDE.md 로 이사한다(D-17) |
| `existsSync` 로 **파일 부재**를 단언 | test (contract) | file-I/O | 레포 사용처 0건. `readOrEmpty` 는 부재를 `""` 로 흡수하므로 "없어야 한다" 를 표현할 수 없다. RESEARCH §Code Examples 4(#23) |
| `indexOf` 위치 비교로 **코드 순서**를 단언 | test (contract) | text parse | `count()` 로는 표현 불가. D-05 순서 불변식을 고정하는 유일한 수단이고 레포 최초 |
| `deno.lock` 커밋 | config | — | 형태 선례는 `package-lock.json` 이지만, "생성 명령이 npm 이 아니고 CI 도 없는" 락 파일은 최초. 검증은 `git status` 게이트(D-02) |

---

## Metadata

**Analog search scope:** `supabase/functions/` 전량(두 `index.ts` · `_shared/{spinTime,cooldown}.ts` · `_shared/{edgeImports,spinTime}.test.ts`), `lib/`(`errors.ts`·`errors.test.ts`·`settings.ts`·`supabase/client.ts`), `app/page.tsx` 부분 3구간(`:1-70`·`:200-300`), `supabase/migrations/0005_restaurants_settings.test.ts` 부분 2구간, 루트 설정 4개(`package.json`·`tsconfig.json`·`eslint.config.mjs`·`vitest.config.mts`), 문서 3개(`CLAUDE.md`·`CONVENTIONS.md`·`CONCERNS.md`), todo 2개
**Files scanned:** 21 (전량 읽기 12 · 부분 읽기 5 · grep/count 확인 4)
**실측 확인 목록(2026-09-28):**
- `.claude/skills`·`.agents/skills` → **둘 다 부재**
- 두 `index.ts` 의 토큰 개수 raw/str 24종 → §계약 테스트 베이스라인 표(D-14 의 "플래너가 실측 후 기입" 을 여기서 미리 채웠다. **재작성 후 다시 측정해 목표 열을 확정할 것**)
- `edgeImports.test.ts` 마지막 번호 → **#22**(신규는 #23 부터) / `spinTime.test.ts` 마지막 번호 → **#15**(신규는 #16)
- 테스트 파일 10개(`lib` 4 · `components` 1 · `_shared` 4 · `migrations` 1) — `npm test` 기준선 189 tests / 10 files 와 일치
- `existsSync` 레포 사용처 → **0건** / `toMatch` → 0건(Phase 3 실측 유지)
- `.gitignore` 에 deno 관련 항목 → **0건**
- `package-lock.json` 존재(커밋됨) → `deno.lock` 커밋의 형태 선례
- `supabase/functions/` 하위에 `deno.json`·`deno.lock`·`import_map.json` → **현재 0건**(신규 생성 대상)
- `CONVENTIONS.md:282` 의 "`kstNow()` 가 두 함수에 복붙돼 있다" → **Phase 3 이 해결했는데 남아 있는 낡은 진술**(D-17 범위에 추가 권고)
**플래너가 결정할 것 2건:**
1. `check:edge` 의 `scripts` 내 위치(권장: `lint` 와 `test` 사이) — 재량
2. 계약 테스트 번호 체계: #23~#25 를 기존 두 `describe` 에 나눠 넣을지, `describe("EDGE/SPIN-01 — 새 스키마 위에서 동작한다")` 류를 새로 열지(CONTEXT §Claude's Discretion). **새 describe 권장** — 추가 단언이 20건 가까워 기존 QUAL-02 describe 안에 넣으면 "복붙 제거" 라는 그 describe 의 주제가 흐려진다
**Pattern extraction date:** 2026-09-28
