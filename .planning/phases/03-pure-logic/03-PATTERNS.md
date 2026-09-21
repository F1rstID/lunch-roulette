# Phase 3: 순수 로직 - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 27 (신규 10 · 수정 17)
**Analogs found:** 27 / 27 (exact 22 · role-match 5). 단 **신규 형태 요소 4건**은 아날로그가 없어 RESEARCH 스니펫이 정본이다(§No Analog Found)

> **이 페이즈의 핵심 긴장:** 아날로그는 전부 있는데, `supabase/functions/_shared/`에 들어가는 3파일만은 **레포 컨벤션을 의도적으로 어겨야 한다.**
> `lib/time.ts`·`lib/phase.ts`는 (1) `hour12: false`를 쓰고 (2) `now: Date = new Date()` 기본 인자를 달고 (3) 형제 모듈을 `from "./time"`으로 끌어온다. 이 세 가지가 전부 `_shared`에서는 **금지**다(D-04 / D-07 / D-02). 반대로 두 Edge Function의 `../_shared/kst.ts`는 CONVENTIONS.md가 금지한 `../` 상대 경로 + `.ts` 확장자를 **반드시** 써야 한다.
> 그래서 Phase 2와 같은 표기를 유지한다 — 모든 패턴에 **[그대로] / [변형] / [금지]** 를 붙였다. 표시 없이 복사하면 D-02가 깨지고, D-12를 켠 뒤에는 `tsc`가 `TS5097`로 잡는다(RESEARCH §Q1-d 실측).

**프로젝트 스킬 디렉터리:** `.claude/skills` · `.agents/skills` 모두 없음 → 추가 규약 로드 없음. 컨벤션 출처는 `CLAUDE.md` + `.planning/codebase/CONVENTIONS.md`뿐이다.

---

## File Classification

### 신규 (10)

| New File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/functions/_shared/kst.ts` | utility (pure) | transform | `lib/time.ts:29-65` (`kstParts` 본체) + `supabase/functions/spin-roulette/index.ts:15-46` (`kstNow`·`pickRandom` 원본) + `lib/constants.ts:1-4` (import 금지 머리 주석) | exact (합성 3) |
| `supabase/functions/_shared/spinTime.ts` | utility (pure) | transform (parse + predicate) | `lib/errors.ts:1-13` (throw 없는 총 함수 + `null` 반환 계약) + `lib/phase.ts:14-25` (`SPIN_HH`·초 환산) | role-match |
| `supabase/functions/_shared/cooldown.ts` | utility (pure) | batch / transform (filter + fallback) | `components/MenuList.tsx:31-44` (`parseMenuInput` — `Set` 멤버십 필터 순수 함수) | role-match |
| `supabase/functions/_shared/kst.test.ts` | test (unit) | — | `lib/time.test.ts` 전량 | exact |
| `supabase/functions/_shared/spinTime.test.ts` | test (unit) | — | `lib/phase.test.ts` (경계당 `it` 하나) + `lib/errors.test.ts` (`describe` 함수별 분할) | exact |
| `supabase/functions/_shared/cooldown.test.ts` | test (unit) | — | `components/MenuList.test.ts` (리터럴 기대값) + `lib/errors.test.ts` | exact |
| `supabase/functions/_shared/edgeImports.test.ts` | test (contract) | file-I/O → text parse | `supabase/migrations/0005_restaurants_settings.test.ts:1-37,77-128` (`readOrEmpty` + `count()` + `describe("<영역>/<REQ> — …")`) | exact |
| `lib/settings.ts` | model + reducer (pure) | transform / event-driven | `lib/errors.ts:1-20` (순수성이 계약인 모듈) + `components/MenuList.tsx:6-8` (`import type` 근거 주석) + `lib/supabase/client.ts:50-57` (`SettingsRow`) | role-match |
| `lib/settings.test.ts` | test (unit) | — | `lib/errors.test.ts` 전량 | exact |
| `lib/useSettings.ts` | hook (I/O) | request-response + pub-sub | `app/rank/page.tsx:25-65` (초기 SELECT IIFE + `cancelled` / 별도 채널 effect + `removeChannel`) | role-match (레포 첫 훅 **파일**) |

### 수정 (17)

| Modified File | Role | 변경 성격 | Closest Analog | Match |
|---|---|---|---|---|
| `lib/phase.ts` | utility | 재작성(시각 주입 + `stalled`) | 자기 자신 `:1-26` (골격·주석 형식) | exact (self) |
| `lib/phase.test.ts` | test | 재작성 | 자기 자신 `:1-33` | exact (self) |
| `lib/time.ts` | utility | `kstParts` 재수출 + `hourCycle` | 자기 자신 `:29-65` | exact (self) |
| `lib/time.test.ts` | test | 기대 객체 1줄 추가 | 자기 자신 `:56-67` | exact (self) |
| `supabase/functions/spin-roulette/index.ts` | edge function | import 교체(본문 불변) | 공식 `../_shared/x.ts` 패턴 + 자기 자신 `:9-13` (import 블록 위치) | exact |
| `supabase/functions/respin-roulette/index.ts` | edge function | import 교체(본문 불변) | 〃 | exact |
| `app/page.tsx` | page | `currentPhase` 인자 · `resolvedPhase` 제거 · `useSettings` 배선 · `stalled` 분기 | 자기 자신 `:56-62`(배너 조인), `:301-304`, `:336-350` | exact (self) |
| `app/log/page.tsx` | page | `hasResult` 파생 + `useSettings` | 자기 자신 `:20-21,84-88` | exact (self) |
| `app/rank/page.tsx` | page | 〃 | 자기 자신 `:20-33` | exact (self) |
| `components/MenuList.tsx` | component | `readOnly` 계산 교체(순수 헬퍼로 추출) | 자기 자신 `:31-44`(같은 파일의 export 순수 함수 선례) | exact (self) |
| `components/TopBar.tsx` | component | if-체인 → `switch` + `never` | RESEARCH §Pattern 2 (레포에 `switch` 선례 0건) | role-match |
| `components/ResultBlock.tsx` | component | `decided && !winner` → `stalled` | 자기 자신 `:105-120` (문구를 그대로 옮긴다) | exact (self) |
| `components/PhaseTimeline.tsx` | component | `stalled` → `accepting` 매핑 | 자기 자신 `:15-17` | exact (self) |
| `tsconfig.json` | config | `exclude` 좁히기 | 자기 자신 `:33` | exact (self) |
| `eslint.config.mjs` | config | `globalIgnores` 좁히기 | 자기 자신 `:9-18` | exact (self) |
| `CLAUDE.md` | docs | 낡은 진술 5건 정정 + 훅 컨벤션 1줄 | 자기 자신(문체) | exact (self) |
| `.planning/codebase/CONVENTIONS.md` | docs | 낡은 진술 3건 정정 | 자기 자신(문체) | exact (self) |

---

## Pattern Assignments

### `supabase/functions/_shared/kst.ts` (utility, transform)

**Primary analog:** `lib/time.ts:29-65` — 이 함수의 **구현을 그대로 옮기는 것**이 이 파일의 본질이다(D-03: 레포 전체 KST 분해 구현 1곳). 다만 아래 [변형] 3건을 반드시 적용한다.

#### 1. 파일 머리 "import 금지" 주석 [그대로 — 형식만]

`lib/constants.ts:1-4` — 레포에 이미 있는 **"이 파일에 무엇을 넣지 말 것인가"** 형 머리 주석. `_shared/kst.ts`의 머리 주석은 이 논증 구조를 그대로 빌린다(대상만 "환경변수" → "import 문").

```typescript
// 환경변수·supabase 클라이언트·React 에 의존하지 않는 순수 상수 모듈.
// 따로 두는 이유: lib/supabase/client.ts 는 모듈 로드 시점에 createClient(...) 를 실행하며 환경변수를 읽는다.
// 상수 하나를 거기서 가져오면 그 상수를 쓰는 순수 함수까지 환경변수 없이는 import 할 수 없게 된다.
// 여기에는 환경변수를 읽거나 클라이언트를 만드는 코드를 절대 넣지 않는다.
```

`lib/errors.ts:1-5`가 같은 형식의 더 강한 버전이다 — **"순수성 자체가 이 파일의 계약이다"** 한 문장 + 그 이유 3줄. `_shared` 3파일 전부 이 형태로 연다(금지문 필수: "import 를 하나도 하지 않는다").
본문 문안은 RESEARCH §Code Examples의 `_shared/kst.ts` 머리 주석 4줄을 그대로 써도 된다(이미 이 형식이다).

#### 2. `kstParts` 본체 [변형 3건] ⚠

`lib/time.ts:29-65` — **베이스**

```typescript
/** KST 시각 컴포넌트 분해 */
export function kstParts(now: Date = new Date()): {
  year: number;
  ...
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    year: Number(get("year")),
    ...
    hour: Number(get("hour")) % 24, // 24시 → 0시 보정
    ...
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| `new Intl.DateTimeFormat(...).formatToParts(now)` 구조, 옵션 7개 | **`hour12: false` → `hourCycle: "h23"`** (D-04). 둘을 같이 두지 않는다 — `hour12`가 이기면 `hourCycle`이 죽는다(RESEARCH §Q3 실측). `rg -n 'hour12' lib supabase/functions/_shared` → **0건**이 검증 |
| `const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";` 한 줄 그대로 | **`now: Date = new Date()` 기본 인자 제거** → `kstParts(now: Date)`. 기본 인자는 `kstNow()`가 대신한다(D-01). 검증됨: 레포에 `kstParts()` 무인자 호출 **0건**(`app/log/page.tsx:25`·`lib/phase.ts:19,30`·`lib/time.ts:69`·`lib/time.test.ts:58,70` 전부 인자를 넘긴다) |
| `weekdayMap` 리터럴(`Sun: 0 … Sat: 6`)과 `?? 0` 폴백 | **인라인 반환 타입 → named `export type KstParts`** (D-03에서 `lib/time.ts`가 `export type { KstParts }`로 재수출해야 하므로 이름이 필요하다). 타입 이름은 `~Row` 규약 대상이 아니므로 PascalCase 그대로 |
| `hour: Number(get("hour")) % 24` + **인라인 Why 주석** | 주석 문안을 `// 24시 → 0시 보정` → `// h23 에서는 도달 불가. h24 로케일 실수를 막는 방어선으로 남긴다`로 갱신(D-04가 "주석으로 이유를 적는다"를 지시) |
| | **`date: "yyyy-mm-dd"` 필드 추가**(D-15). `spin-roulette/index.ts:30`의 `const date = \`${get("year")}-${get("month")}-${get("day")}\`` 조립식을 그대로 가져온다 |
| | 로케일: `lib/time.ts:39`는 `en-US`, Edge는 `en-CA`. **둘 다 같은 값**을 준다(RESEARCH §Q3, 1500일 mismatch 0). `kstParts` 원본이 `en-US`이므로 `en-US` 유지가 diff를 줄인다 |

#### 3. `kstNow` · `pickRandom` [그대로 — 위치만 이동]

`supabase/functions/spin-roulette/index.ts:42-46` (= `respin-roulette/index.ts:57-61`, 문자 단위 동일)

```typescript
function pickRandom<T>(arr: T[]): T {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return arr[u[0] % arr.length];
}
```

- 본문 4줄은 **한 글자도 바꾸지 않는다**(동작 불변 원칙). `export`만 붙인다.
- `crypto.getRandomValues`는 import하지 않는다 — Deno·Node≥19 전역(RESEARCH §Q2 실측).
- **추가할 것:** 전제조건 주석. `pickRandom([])`은 `undefined`를 주면서 타입은 `T`라고 주장한다(RESEARCH §Pitfall 6). 현행 호출자 두 곳이 `menus.length === 0`을 먼저 검사해서 안 터지는 **호출자 규율 의존 계약**이다 — 이 사실을 한글 Why 주석으로 남긴다. **throw로 바꾸지 않는다**(동작 변경 금지).
- `kstNow()`는 `spin-roulette/index.ts:17-35`의 본문을 `kstParts(new Date())` 한 줄로 축약한다. 반환 타입이 `{date, hour, minute, second}` → `KstParts`로 **넓어지지만** 소비처(`now.date`, `isAfterSpinTime(now)`)는 전부 부분집합이라 안전하다.

#### 4. JSDoc 한 줄 [그대로]

CONVENTIONS.md:224 — `lib/time.ts`·`lib/phase.ts`의 export 함수에만 `/** "yyyy-mm-dd" (KST 기준) */` 형식의 **반환 형식 예시** 한 줄. `@param`/`@returns` 태그는 쓰지 않는다. `_shared`는 `lib/time.ts`의 후계이므로 같은 습관을 잇는다(재량이지만 권장).

---

### `supabase/functions/_shared/spinTime.ts` (utility, parse + predicate)

**Analog:** `lib/errors.ts:1-13` (throw 없는 총 함수 + "없음"을 `null`로 표현하는 계약) + `lib/phase.ts:14-25` (상수·초 환산 산술)

#### 1. "순수성이 계약" 머리 주석 [그대로]

`lib/errors.ts:1-5`

```typescript
// 읽기(SELECT) 실패를 화면에 띄울 한 줄 한국어 문장으로 조립하는 순수 모듈.
// 순수성 자체가 이 파일의 계약이다 — 데이터 클라이언트·React·환경변수를 import 하지 않는다.
// 그래야 테스트 러너가 브라우저 전역이나 NEXT_PUBLIC_* 키 없이 이 파일만 단독으로 불러올 수 있다.
// 에러 타입을 라이브러리에서 가져오지 않고 { message: string } 구조적 타입으로만 받는 이유도 같다.
```

**4번째 줄이 결정적이다.** RESEARCH §Pattern 1이 요구하는 "로컬 최소 구조 타입 `TimeParts`"는 **이 레포가 이미 쓰고 있는 기법**이다(`formatLoadError(label, error: { message: string } | null)`). `spinTime.ts`의 `TimeParts` 주석은 같은 논증을 쓰되 이유만 바꾼다("라이브러리 타입을 안 끌어오려고" → "`./kst`는 Deno가, `./kst.ts`는 tsc가 거부해서").

#### 2. `null`로 실패를 표현하는 총 함수 [그대로]

`lib/errors.ts:10-13`

```typescript
export function formatLoadError(label: string, error: { message: string } | null): string | null {
  if (!error) return null;
  return `${label} 불러오기 실패: ${error.message}`;
}
```

`parseSpinTime(text): SpinTime | null`이 같은 계약이다 — **throw 금지, 실패는 `null`**(D-01). 레포에 `throw`가 한 건도 없다는 사실(`lib/**`·`components/**` grep 0건)이 이 규약의 근거다.

#### 3. 상수·초 환산 [변형 — 상수의 의미가 바뀐다]

`lib/phase.ts:14-25`

```typescript
const SPIN_HH = 11;
const SPIN_MM = 55;
const SPIN_ANIM_SEC = 5;

export function currentPhase(now: Date = new Date()): Phase {
  const p = kstParts(now);
  const total = p.hour * 3600 + p.minute * 60 + p.second;
  const spinAt = SPIN_HH * 3600 + SPIN_MM * 60;
  ...
}
```

| 복사할 것 | 바꿀 것 |
|---|---|
| `p.hour * 3600 + p.minute * 60 + p.second` 초 환산식 → `secondsOfDay(p)` | `SPIN_HH`/`SPIN_MM` 두 상수 → `DEFAULT_SPIN_TIME: SpinTime = { hh: 11, mm: 55 }` 한 덩어리(D-18). `DEFAULT_SPIN_TIME_TEXT = "11:55"`은 Edge·문구용으로 별도 유지 |
| `spin.hh * 3600 + spin.mm * 60` 비교식 (`spin-roulette/index.ts:37-40`의 `isAfterSpinTime`과 동일 산술) | `parseSpinTime(...)!` 비-null 단언을 **쓰지 않는다** — 리터럴 상수를 둔다(D-18) |
| SCREAMING_SNAKE_CASE 모듈 상수 규약(CONVENTIONS.md:25) | 정규식 상수 `RE`는 이름을 좀 더 드러내는 편이 낫다(재량: `SPIN_TIME_RE`) |

#### 4. 정규식 [신규 — RESEARCH 지정]

```typescript
const RE = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
```
소수 초(`"11:55:30.5"`)를 **허용하되 무시**한다(D-18 / §Pitfall 7). 레포에 유사 파서 선례 없음 — RESEARCH §Code Examples가 정본.

#### 5. 이 파일이 "유일한 정의처"임을 주석으로 선언 [그대로 — 형식]

`lib/constants.ts:6-7`

```typescript
// menus.name / pinned_menus.name 의 DB check 제약(char_length 1~24)과 동일. 여기가 유일한 정의처다
// (re-export 를 두지 않는다 — 정의처가 둘로 보이면 어느 쪽을 import 할지 헷갈린다).
```

CONTEXT §Specific Ideas가 요구한 "이 파일이 기본 추첨 시각의 유일한 정의처" 문장은 **정확히 이 형식**으로 적는다. D-16의 CLAUDE.md 정정이 이 주석을 근거로 삼는다.
주의: `lib/time.ts`는 `kstParts`를 **재수출**하므로(D-03) `lib/constants.ts`의 괄호 안 금지문("re-export 를 두지 않는다")은 `kst.ts`에 그대로 복사하면 **모순**이 된다 — `spinTime.ts`에만 쓰고, `kst.ts`에는 "구현은 여기 1곳, `lib/time.ts`는 얇은 재수출" 취지로 바꿔 적는다.

---

### `supabase/functions/_shared/cooldown.ts` (utility, filter + fallback)

**Analog:** `components/MenuList.tsx:31-44` — 레포에서 `Set` 멤버십으로 걸러내는 **유일한** 순수 함수. 주석 형식과 루프 골격을 가져온다.

```typescript
// 쉼표(반각 , / 전각 ，)로 나눠 여러 메뉴를 한 번에 등록한다.
// trim → 빈 항목 제거 → 항목별 24자 상한 → 입력 내 중복 제거 → 이미 있는 메뉴 제외.
// 순수 함수라 I/O 없이 테스트 가능.
export function parseMenuInput(input: string, existing: string[]): string[] {
  const seen = new Set(existing);
  const out: string[] = [];
  for (const piece of input.split(/[,，]/)) {
    const name = piece.trim().slice(0, MENU_NAME_MAX_LEN);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| **머리 주석 2번째 줄의 "→ 화살표 파이프라인"** — 단계 순서 자체가 계약임을 드러내는 표기. `applyCooldown`도 `null 승자 무시 → 제외 → 0개면 전체 폴백`을 한 줄로 적는다 | 반환형 `T[]` → **`{ picked: T[]; fellBack: boolean }`** (D-14). 이 레포에 객체 반환 순수 함수 선례가 없다 → §No Analog Found |
| `const seen = new Set(existing)` → `const blocked = new Set<string>()` 누적 패턴 | 제네릭 제약 `<T extends { restaurant_id: string }>`. 레포 제네릭 선례는 `pickRandom<T>` 하나뿐이고 `extends`는 최초 |
| "순수 함수라 I/O 없이 테스트 가능" 문장 | `cooldownWindowStart`의 날짜 산술은 RESEARCH §Q8 스니펫을 **그대로** 쓴다(`Date.UTC` + `getUTC*`, TZ 3종 실측). `lib/time.ts` 경유 규칙의 예외임을 주석으로 남긴다 — CONVENTIONS.md:146이 `components/CalendarLog.tsx`에 대해 이미 같은 예외를 문서화한 선례가 있다 |

**CONVENTIONS.md:146의 예외 문장(그대로 빌릴 논증):**
> `components/CalendarLog.tsx:18-21,222`는 … 로컬 `Date` 메서드로 달력 그리드를 만든다. 명시적 y/m/d 숫자로부터 요일·일수를 계산하는 **순수 캘린더 산술**이고 "현재 시각"에 의존하지 않으므로 타임존 버그가 나지 않는다.

`cooldownWindowStart`는 **더 강한 버전**이다(로컬 메서드조차 안 쓰고 `getUTC*`만 쓴다). 같은 논증을 한 줄로 적으면 리뷰어가 "시간은 `lib/time.ts` 경유" 규칙 위반으로 오인하지 않는다.

---

### `_shared/kst.test.ts` · `spinTime.test.ts` · `cooldown.test.ts` · `lib/settings.test.ts` (test, unit)

**Analog:** `lib/time.test.ts` (경계 케이스 구성) + `lib/errors.test.ts` (함수별 `describe` 분할) + `lib/phase.test.ts` (경계당 `it` 하나) + `components/MenuList.test.ts` (리터럴 기대값 근거)

#### (a) 머리 주석 — "이 spec이 왜 존재하는가" + "무엇을 일부러 안 하는가" [그대로]

`lib/phase.test.ts:1-4`

```typescript
// lib/phase.ts 의 페이즈 경계를 고정한다. Phase 3 이 추첨 시각을 settings 에서 주입받도록 이 파일을 다시 쓰므로,
// 그 전에 "지금 무엇이 참인지"를 남겨 두지 않으면 전환이 동작을 조용히 바꿔도 알 수 없다.
// 고정 시각은 UTC 문자열로 만든다 (KST = UTC+9). 경계 하나당 it 하나로 쪼갠다 — 어느 경계가 깨졌는지 이름만 보고 알기 위해서.
// msToNextPhase 는 의도적으로 테스트하지 않는다: 참조 0건의 미사용 코드이고 Phase 3 이 제거할 예정이라 계약을 고정하면 삭제를 방해한다.
```

**이 파일이 이번 페이즈를 위해 쓰인 예고편이다.** 재작성본의 머리 주석은 "Phase 3 이 …" → "Phase 4 가 Edge 본문을 다시 쓰므로 …"로 이어 쓴다. 4번째 줄(안 하기로 한 것 + 이유)은 **반드시 유지** — `lib/settings.test.ts`에는 "`useSettings` 훅은 테스트하지 않는다: jsdom·testing-library 3개를 들이는 비용 대비 훅 본문에 분기가 없다(RESEARCH §Q7)"를 같은 자리에 적는다.

#### (b) import + `describe`/`it` 골격 [그대로]

`lib/errors.test.ts:5-11`

```typescript
import { describe, it, expect } from "vitest";
import { formatLoadError, joinLoadErrors } from "@/lib/errors";

describe("formatLoadError", () => {
  it("에러가 없으면 null 을 준다 (배너 미렌더 신호)", () => {
    expect(formatLoadError("메뉴 목록", null)).toBeNull();
  });
```

규약:
- `import { describe, it, expect } from "vitest";` **명시 import 필수**(`vitest.config.mts:17` `globals: false`).
- **`lib/**` spec은 `@/` 별칭**(`vitest.config.mts:41-43` alias). **`_shared/**` spec만 `./kst` 상대 경로 + 확장자 없이**(D-02) — CONVENTIONS.md:70의 "`../`를 쓰지 않는다"의 두 번째 예외가 된다(첫 번째는 `lib/phase.ts:10` `./time`).
- `it` 이름은 **한글 서술문**, 조사 앞 띄어쓰기(`null 을`, `accepting 이다`)까지 일관.
- **단언 1개 = `it` 1개** (근거: `lib/phase.test.ts:3`).
- `describe`는 검사 대상 함수 단위(`lib/errors.test.ts`가 2함수 → 2 describe).

#### (c) 경계 케이스 표기 [그대로]

`lib/time.test.ts:14-25` — UTC 문자열로 KST 경계를 만드는 관용구. `_shared/kst.test.ts`의 D-13 케이스(UTC 14:59:59 / 15:00:00 / 연 경계 / 자정 `00`)는 **이 파일과 거의 같은 시각 리터럴**을 쓰게 된다. 중복을 피하려 하지 말고 같은 리터럴을 쓴다 — `lib/time.test.ts`는 `lib/time.ts`의 **포맷터 계약**을, `_shared/kst.test.ts`는 **분해 계약**을 지키는 서로 다른 스펙이다.

#### (d) 리터럴 기대값 [그대로 — 근거 주석까지]

`components/MenuList.test.ts:1-4`

```typescript
// 절단 상한을 MENU_NAME_MAX_LEN 이 아니라 리터럴 24 로 쓰는 이유: 상수를 import 하면 상수 값이 바뀔 때
// 기대값도 같이 움직여 "DB check 제약(char_length 1~24)의 거울" 이라는 사실이 테스트에서 사라진다.
```

→ `spinTime.test.ts`는 `DEFAULT_SPIN_TIME`을 import해 비교하지 말고 **`{ hh: 11, mm: 55 }` 리터럴**로 단언한다. 같은 논증을 한 줄로 적는다.

---

### `supabase/functions/_shared/edgeImports.test.ts` (test, contract / file-I/O)

**Analog:** `supabase/migrations/0005_restaurants_settings.test.ts` — Phase 2가 만든 **레포 유일의 텍스트 계약 테스트**. 골격·헬퍼·네이밍을 전부 여기서 가져온다.

#### 1. 머리 주석 — "왜 실행이 아니라 텍스트인가" [그대로 — 대상만 치환]

`:1-7`

```typescript
// 0005 컷오버 마이그레이션의 계약을 파일 텍스트로 못 박는다. 이 페이즈에는 로컬 Supabase 스택이 없어
// SQL 을 실행해 볼 수 없다 — 그래서 "실행 결과"가 아니라 "파일에 무엇이 쓰여 있는가"가 유일한 검증 대상이다.
```

→ "로컬 Supabase 스택이 없어 SQL 을 실행" → "**로컬에 deno 가 없어 `deno check` 를 돌릴 수 없어**". 나머지 논증(한계까지 적는 태도)은 그대로.

#### 2. `readOrEmpty` 헬퍼 [그대로 — 복사] ✅

`:12-20`

```typescript
// RED 단계에는 검사 대상 .sql 이 아직 없다. 예외를 그대로 던지면 vitest 가 모듈 로드 실패("Failed to load")로
// 수집 자체를 접어 버려서, "무엇이 왜 없는지"가 단언 실패로 드러나지 않는다 — TDD 게이트가 성립하지 않는다.
function readOrEmpty(url: URL): string {
  try {
    return readFileSync(url, "utf8");
  } catch {
    return "";
  }
}
```

`workflow.tdd_mode: true`라 이 페이즈도 spec이 먼저 RED로 선다 → **헬퍼와 주석을 함께 복사한다.** (두 `index.ts`는 이미 존재하므로 RED 사유는 다르지만, 경로 오타 시 "Failed to load"로 죽는 문제는 동일하다.)

#### 3. 파일 읽기 경로 [변형 — `import.meta.url` 상대] ⚠

`:77-79`

```typescript
const rawSql = readOrEmpty(new URL("./0005_restaurants_settings.sql", import.meta.url));
const sql = stripComments(rawSql, "--");
const clientSrc = readOrEmpty(new URL("../../lib/supabase/client.ts", import.meta.url));
```

- **RESEARCH §Code Examples의 `readFileSync("supabase/functions/spin-roulette/index.ts", "utf8")`(cwd 상대 문자열)는 쓰지 않는다** — 레포 선례는 전부 `new URL(…, import.meta.url)`이고(`vitest.config.mts:9`·`0005 test:77,79`), cwd 의존은 `vitest run <path>` 실행 위치에 따라 깨질 수 있다.
- `_shared/edgeImports.test.ts` 기준 경로: `new URL("../spin-roulette/index.ts", import.meta.url)` / `"../respin-roulette/index.ts"`.
- 주석 제거 사본(`stripComments(src, "//")`)을 함께 드는 것이 **필수에 가깝다**: `spin-roulette/index.ts:5`의 한글 주석에 "11:55"가, `:1-7`에 `kstNow`라는 단어가 등장할 수 있다. `0005 test:6-7`이 정확히 이 이유를 적어 뒀다.

#### 4. 단언 스타일 [변형 — `toMatch` 대신 `count()`] ⚠

**레포에 `toMatch`/`not.toMatch` 사용처가 0건이다**(grep 확인). RESEARCH §Code Examples의 `expect(src).toMatch(/…/)`는 동작하지만 레포 관용구가 아니다. 선례는 `count()` + 숫자 단언이다.

`0005 test:35-37, 95-99`

```typescript
function count(haystack: string, pattern: RegExp): number {
  return haystack.match(pattern)?.length ?? 0;
}

it("create index 가 2건이고 전부 이름 있는 if not exists 형이다 (#3)", () => {
  expect(count(sql, /create index if not exists [a-z_]+_idx on public\./g)).toBe(2);
  // 총 개수까지 같아야 "무명 인덱스 0건"이 성립한다. 한쪽만 세면 무명 인덱스가 섞여도 통과한다.
  expect(count(sql, /create index/g)).toBe(2);
});
```

→ `edgeImports.test.ts`도 `count(src, /from "\.\.\/_shared\/kst\.ts"/g)).toBe(1)` / `count(src, /function kstNow/g)).toBe(0)` 형태로 쓴다. **"한쪽만 세면 통과하는 구멍"을 막는 이중 단언 습관**(위 주석)도 그대로: `import` 문 존재 + 로컬 정의 부재를 **둘 다** 센다.

#### 5. `describe`·`it` 네이밍 [그대로]

`0005 test:86, 158, 186`

```typescript
describe("SQL/SHIP-01 — 모든 문이 재실행 안전형이다", () => {
describe("SQL/SETT-01 — settings 는 anon 읽기 전용이다", () => {
describe("SQL/CAND-04 — 자정 리셋이 Realtime DELETE 를 낸다", () => {
```

- 형식: **`"<영역>/<REQ-ID> — 한글 서술문"`**. 이 페이즈는 `"EDGE/QUAL-02 — 복붙이 _shared 로 합쳐졌다"`, `"SHARED/QUAL-02 — _shared 는 import 0 개다"` 등.
- `it` 이름 끝의 **`(#N)` 일련번호**는 VALIDATION.md의 Per-Task Verification Map과 1:1로 맞추기 위한 Phase 2 관용구다. 03-VALIDATION.md가 같은 표를 쓸 예정이면 번호를 잇는다(재량이나 권장).
- **`describe.each`는 레포 선례 0건.** RESEARCH가 제안한 `describe.each(Object.entries(files))`는 써도 되지만, 두 파일의 단언 집합이 다르므로(`respin`은 `spinTime.ts`를 import하지 않는다 — `respin-roulette/index.ts:1-8`에 시간 가드 없음이 명시) **파일별 `describe` 2개 + 공통 헬퍼 1개**가 레포 스타일에 가깝다.

#### 6. D-02 강제 단언 [신규 — RESEARCH §Validation 권장]

`_shared/*.ts` 3파일에 대해 `count(src, /^import /gm)).toBe(0)`. `0005 test:118`의 `/^\s*alter publication/gm` 처럼 **`^` 만으로는 들여쓴 줄을 놓친다**는 교훈(그 줄 주석에 "뮤테이션으로 확인"이라고 적혀 있다)을 적용해 `/^\s*import\s/gm`으로 쓴다.

---

### `lib/settings.ts` (model + reducer, pure)

**Analog:** `lib/errors.ts:1-20` (파일 전체 구조) + `components/MenuList.tsx:6-8` (`import type` 근거 주석) + `lib/supabase/client.ts:50-57` (`SettingsRow`)

#### 1. `import type` **문장** [그대로 — 주석까지] ⚠

`components/MenuList.tsx:5-11`

```typescript
import { MENU_NAME_MAX_LEN } from "@/lib/constants";
// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 supabase 클라이언트가
// 로드되지 않는다 — parseMenuInput 을 환경변수 없이 테스트할 수 있는 근거다.
import type { MenuRow } from "@/lib/supabase/client";
```

**이 2줄 주석을 `lib/settings.ts`에 그대로 옮긴다**(대상만 `parseMenuInput` → `settingsReducer`). RESEARCH §Q7이 실측한 `supabaseUrl is required.` 즉사가 정확히 이 주석이 막는 사고다. 인라인 `type` modifier(`import { type SettingsRow }`)는 **금지** — 문장 형태여야 모듈이 통째로 지워진다.

#### 2. import 순서 [그대로]

CONVENTIONS.md:59-67 — 그룹 사이 빈 줄 없이 한 덩어리. `lib/settings.ts`의 순서:
1. `import type { SettingsRow } from "@/lib/supabase/client";`
2. `import { DEFAULT_SPIN_TIME, parseSpinTime, type SpinTime } from "@/supabase/functions/_shared/spinTime";`

`@/supabase/functions/_shared/*`는 레포 최초의 import 그룹이다 — **`@/lib/*` 다음**에 둔다(CONVENTIONS.md:64의 `@/lib/supabase/client` → `@/lib/time` → `@/lib/phase` 순서를 잇는 자리). 확장자 없이(D-02·§Q1-c 실측).

#### 3. 타입 선언 형식 [그대로]

`lib/supabase/client.ts:50-57`

```typescript
// 설정 단일행(id = 1). anon 은 읽기만 가능하고 편집은 대시보드(service_role)에서만 한다
// (supabase/migrations/0005_restaurants_settings.sql).
export type SettingsRow = {
  id: 1;
  spin_time: string; // PostgREST time → "HH:MM:SS" (초 포함). 파서는 "11:55" 가 아니라 "11:55:00" 을 받는다
  cooldown_days: number; // 0 = 쿨다운 끔
  history_since: string; // "yyyy-mm-dd" (KST 기준 전환일). results.date 와 문자열 그대로 비교한다
};
```

- `type` alias만(`interface` 금지, CONVENTIONS.md), 필드 옆 한 줄 의미 주석.
- **⚠ 타입 불일치 1건:** `SettingsRow.history_since`는 **non-nullable `string`**인데 D-10의 `Settings.historySince`는 `string | null`이고 RESEARCH §Pattern 3 스니펫은 `row.history_since ?? null`을 쓴다. `?? null`은 `string`에서 무해하지만(eslint `no-unnecessary-condition` 미활성) **의미가 갈린다.** 플래너가 정할 것: (A) `Settings.historySince: string | null` 유지 + `?? null` (D-10 문면 그대로, "전환일 미확정" 상태를 도메인에 남김), (B) `SettingsRow.history_since`를 `string | null`로 넓힘(= Phase 2 산출물 수정, 0005 계약 테스트 `RESULT_ROW_FIELDS`류 단언과 충돌 없음이나 Phase 2 범위 침범). **(A) 권장** — 이 페이즈는 Phase 2 산출물을 건드리지 않는다.

#### 4. 리듀서 [신규 — 레포 선례 0건]

레포에 `useReducer`·리듀서 함수가 **0건**이다(전부 `useState`). `switch` + `const exhaustive: never` 가드도 0건. → RESEARCH §Pattern 2·3이 정본. §No Analog Found 참조.

---

### `lib/useSettings.ts` (hook, request-response + pub-sub)

**Analog:** `app/rank/page.tsx:25-65` — 세 페이지 중 **가장 작은 완전형**(초기 SELECT effect + 구독 effect + cleanup). `app/page.tsx`는 6개 바인딩이 얽혀 있어 골격 참조용으로 적절하지 않다(CLAUDE.md 위험 지점).

#### 1. 초기 SELECT — IIFE + `cancelled` 플래그 [그대로]

`app/rank/page.tsx:25-39`

```typescript
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
      .from("results")
      .select("*")
      .order("date", { ascending: false });
    if (cancelled) return;
    setLoadError(formatLoadError("랭킹", error));
    if (data) setResults(data as ResultRow[]);
  })();
  return () => {
    cancelled = true;
  };
}, []);
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| `let cancelled = false` → IIFE → `if (cancelled) return;` → cleanup에서 `cancelled = true` (CONVENTIONS.md:153-161이 "초기 로드 패턴"으로 문서화) | `setState` 2줄 → `dispatch` 1회. **`error`를 먼저 보고 `failed`, 아니면 `loaded(data ?? null)`** (§Pitfall 5) |
| 빈 의존성 배열 `[]` | 쿼리: `.select("*").eq("id", 1).maybeSingle()` (D-11) |
| `data as XRow[]` 단언 (`any` 금지, `as`로 좁히기 — CONVENTIONS.md:55) | `(data as SettingsRow \| null) ?? null` |

**`maybeSingle`의 0행은 에러가 아니다** — 이 논증의 선례가 `app/page.tsx:53-55`에 이미 주석으로 있다:

```typescript
// 세 쿼리를 한 배너로 합친다. 전부 성공하면 null 이 들어가 배너가 사라진다.
// results 는 maybeSingle 이라 "오늘 결과 없음"이 error 가 아니라 data: null 로 오므로,
// 결과가 아직 없는 정상 상태에서는 배너가 뜨지 않는다.
```
→ `useSettings.ts`에 같은 논증을 "시드 안 된 `settings`" 버전으로 적는다.

#### 2. Realtime 구독 — 별도 effect + `removeChannel` [그대로]

`app/rank/page.tsx:41-65` · `app/log/page.tsx:59-82`

```typescript
useEffect(() => {
  const ch: RealtimeChannel = supabase
    .channel("rank-results")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "results" },
      (payload) => {
        const row = payload.new as ResultRow;
        setResults((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]));
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch);
  };
}, []);
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| `const ch: RealtimeChannel = supabase.channel(...)...subscribe()` + cleanup `supabase.removeChannel(ch)` (CONVENTIONS.md:162) | 바인딩 2개(INSERT·UPDATE) → **`event: "*"` 1개**(D-11). DELETE까지 받아야 기본값 복귀가 성립한다 |
| `import type { RealtimeChannel } from "@supabase/supabase-js";` (외부 패키지 타입은 import 그룹 3번) | 채널 이름 **`"settings-changes"`** — 페이지마다 고유해야 한다는 규약(`"lunch-realtime"`/`"log-results"`/`"rank-results"`)의 연장. `lunch-realtime`에 끼워 넣지 않는다(§Pattern 4: 휠 가드 `initialLoadedRef`와 실패 경로를 섞지 않는다) |
| `payload.new as XRow` 단언 | `payload.eventType === "DELETE" ? null : (payload.new as SettingsRow)` — DELETE의 `payload.old`는 PK만 온다(§Q4-a) |
| 핸들러 위 **한 줄 Why 주석** (`app/log/page.tsx:58`: "자동 추첨(INSERT)은 추가, 다시 돌리기(UPDATE)는 같은 id 행을 교체") | 같은 자리에 "컷오버 전에는 `settings`가 publication에 없어 5~10초마다 재조인한다 — 기본값으로 계속 동작하므로 정상"(§Pitfall 9) |

#### 3. 훅 파일 자체의 규약 [신규]

레포에 `lib/use*.ts`가 0건이다(`lib/`에 `colors·constants·errors·phase·time·supabase/client`만). D-11이 **"공용 훅은 `lib/useX.ts`, `use` 접두"**를 이 페이즈에서 CLAUDE.md 컨벤션에 한 줄 추가하라고 지정했다. `lib/` 모듈 명명 규약이 "소문자 단수 명사"(CONVENTIONS.md:13)이므로 `useSettings.ts`는 **명시적 예외**로 기록돼야 한다 — CONVENTIONS.md:13에도 같은 취지 한 줄이 필요하다(D-16 범위).

`"use client"` 지시자: `lib/supabase/client.ts:1`이 이미 달고 있고 훅은 클라이언트 전용이다 → `lib/useSettings.ts` 맨 위에 `"use client";` + 빈 줄(CONVENTIONS.md:61).

---

### `lib/phase.ts` (utility — 재작성)

**Analog:** 자기 자신. 머리 주석의 **"시간표 + 제약 한 문장"** 구조를 유지하고 내용만 4상태로 갱신한다.

`lib/phase.ts:1-12` (현재)

```typescript
// 현재 KST 시각으로 페이즈를 결정한다.
//
//   00:00 ~ 11:54:59  → accepting
//   11:55:00 ~ 11:55:05  → spinning (애니메이션 동안)
//   11:55:06 ~ 23:59:59  → decided        // ← 틀렸다: 코드는 11:55:05 부터다 (todo IN-03)
//
// 단, 실제 spinning/decided 전환은 서버의 results INSERT 이벤트로 트리거되며,
// 이 함수는 UI의 readOnly 토글과 헤드라인 표시용 페이즈 추정에 쓰인다.

import { kstParts } from "./time";

export type Phase = "accepting" | "spinning" | "decided";
```

| 복사할 것 [그대로] | 바꿀 것 [변형] |
|---|---|
| 머리 주석 구조: **시간표 블록 + 빈 `//` 줄 + "단, 실제 전환은 서버의 results INSERT" 제약 문장**. CONVENTIONS.md:214가 이 파일을 "좋은 머리 주석" 예시로 지목한다 | 시간표에 `stalled` 행 추가 + **`11:55:06` → `11:55:05` 정정**(IN-03). 제약 문장은 `hasResult` 인자가 그 사실을 시그니처에 박았음을 덧붙여 강화 |
| `import { kstParts } from "./time";` — 형제 모듈 상대 import는 CONVENTIONS.md:70이 인정한 **유일한 예외**. `lib/phase.ts`는 계속 이 형태를 쓴다 | `@/supabase/functions/_shared/spinTime`에서 `secondsOfDay`·`type SpinTime`을 추가 import(확장자 없이) |
| `export type Phase = …` 리터럴 유니온(CONVENTIONS.md:34) | `"stalled"` 추가. **⚠ 같은 커밋에서 9개 소비처를 전부 고친다**(§Pitfall 1 — tsc가 안 잡아 준다) |
| `SPIN_ANIM_SEC = 5` 상수 + `// 휠 애니메이션 길이` 주석 | `SPIN_HH`/`SPIN_MM` 삭제(정의처가 `_shared/spinTime.ts`로 이동) |
| 초 환산 → 비교 3줄의 산술 | **`now: Date = new Date()` 기본 인자 제거**(D-07). 검증됨: 무인자 `currentPhase()` 호출 **0건**(`app/page.tsx:28`·`app/log:20`·`app/rank:20` 전부 `now`를 넘긴다). ⚠ 이는 CONVENTIONS.md:144("모든 시간 함수는 기본 인자를 받는다")를 **의도적으로 어기는 것** — 이유(시각 주입 강제)를 주석에 남기고 CONVENTIONS.md도 D-16에서 정정 |
| | `msToNextPhase`(`:28-39`) **삭제**. 참조 0건, `lib/phase.test.ts:4`가 삭제를 예고해 뒀다 |

---

### `lib/time.ts` (utility — 재수출)

**Analog:** 자기 자신 `:1-27`(포맷터는 무변경) / `:29-65`(삭제 대상)

```typescript
const formatter = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: KST_TZ, ...opts });

/** "HH:mm" (KST 24시간제) */
export function formatHhMm(now: Date = new Date()): string {
  return formatter({ hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}
```

| 하는 것 | 하지 않는 것 |
|---|---|
| `kstParts` 본체(`:29-65`)를 삭제하고 **재수출**로 대체. `isolatedModules: true`(tsconfig:13)라 **값과 타입을 나눈다**(§Pitfall 8): `export { kstParts } from "@/supabase/functions/_shared/kst";` + `export type { KstParts } from "…";` | 포맷터 3개(`todayKstDate`·`formatHhMm`·`formatHhMmSs`)와 `formatKstLongDay`의 **동작·시그니처를 바꾸지 않는다**. 기본 인자 `now: Date = new Date()`도 그대로(여기서는 CONVENTIONS.md:144가 계속 유효) |
| `formatHhMm:16`·`formatHhMmSs:25`의 **`hour12: false` → `hourCycle: "h23"`**(D-04). 포맷 결과 동일함이 실측됨 → `lib/time.test.ts`의 문자열 단언 9개는 무변경 | `KST_TZ` 상수·`formatter` 헬퍼·`en-CA` 로케일을 바꾸지 않는다 |
| `formatKstLongDay:69`의 `kstParts(now)` 호출은 그대로 동작(재수출된 것을 쓴다) | 재수출에 `hour12` 잔재를 남기지 않는다 — `rg -n 'hour12' lib supabase/functions/_shared` → **0건**이 D-04의 검증 |

`lib/time.test.ts:58-66` [1줄 추가 — 명시 태스크]

```typescript
expect(kstParts(new Date("2026-09-18T02:55:04Z"))).toEqual({
  year: 2026, month: 9, day: 18, hour: 11, minute: 55, second: 4, weekday: 5,
});
```
→ `date: "2026-09-18",` 한 줄 추가(D-15). `toEqual`은 잉여 키를 거부한다(실측). **다른 단언 9개는 손대지 않는다.**

---

### 두 Edge Function (`spin-roulette` · `respin-roulette`) — import 교체만

**Analog:** 서로. 두 파일의 `kstNow`(`spin:17-35` ≡ `respin:37-55`)와 `pickRandom`(`spin:42-46` ≡ `respin:57-61`)은 **문자 단위로 동일**하다 — 이 복붙이 QUAL-02의 제거 대상이다.

#### 지울 것 (정확한 줄)

| 파일 | 줄 | 대상 |
|---|---|---|
| `spin-roulette/index.ts` | `12-13` | `const SPIN_HH = 11; const SPIN_MM = 55;` |
| | `15` | `type KstParts = { date; hour; minute; second }` 로컬 선언 |
| | `17-35` | `function kstNow()` |
| | `37-40` | `function isAfterSpinTime(p)` |
| | `42-46` | `function pickRandom<T>` |
| `respin-roulette/index.ts` | `35` | 로컬 `type KstParts` |
| | `37-55` | `function kstNow()` |
| | `57-61` | `function pickRandom<T>` |

#### 넣을 것 [변형 — 확장자 필수] ⚠

기존 import 블록(`spin:9-10`, `respin:18-19`) **바로 아래**에 잇는다:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { kstNow, pickRandom } from "../_shared/kst.ts";
import { parseSpinTime, isAfterSpinTime, DEFAULT_SPIN_TIME_TEXT } from "../_shared/spinTime.ts";
```

- **`.ts` 확장자 필수**(Deno 규칙, RESEARCH §Q2 인용). `@/` 별칭 금지 — Deno는 tsconfig paths를 모른다.
- `spinTime.ts` import는 **`spin-roulette`에만.** `respin-roulette`는 시간 가드가 없다(`:1-8` 머리 주석이 "시간 가드 없음"을 명시) → `kst.ts`만 끌어온다.
- `spin-roulette/index.ts:51`의 호출부: `isAfterSpinTime(now)` → `isAfterSpinTime(now, parseSpinTime(DEFAULT_SPIN_TIME_TEXT) ?? { hh: 11, mm: 55 })` 류. **`DEFAULT_SPIN_TIME` 상수를 그대로 넘기는 편이 단순하다**(D-18이 비-null 단언 제거를 지시) — `import { DEFAULT_SPIN_TIME, isAfterSpinTime }`로 가져와 `isAfterSpinTime(now, DEFAULT_SPIN_TIME)`. `settings` 읽기는 Phase 4.

#### 절대 건드리지 않을 것 [금지] ⚠

- `respin-roulette/index.ts:21-33`(`corsHeaders` + `json()` 헬퍼)·`:64-67`(OPTIONS 단락). RESEARCH §Security가 "프리플라이트가 재추첨을 실행하는 사고"를 위험으로 등재했다.
- `spin-roulette/index.ts:106-113`의 `23505` 레이스 처리, 두 파일의 `Deno.serve` 본문 전부.
- 머리 주석 블록(`spin:1-7`, `respin:1-16`) — CONVENTIONS.md:216이 "가장 좋은 예시"로 지목한 문서다. **`kstNow` 복붙이 사라졌다는 사실을 반영하는 한 줄만** 더할 수 있다(재량).

---

### `Phase` 소비처 9곳 — `switch` + `never` 전환

**공통 패턴:** RESEARCH §Pattern 2. 레포에 `switch` 문이 **0건**이므로 이 형태 자체가 신규다(§No Analog Found). 아래는 각 자리의 **현재 코드**와 조치.

| 위치 | 현재 코드 | 조치 |
|---|---|---|
| `components/MenuList.tsx:49` | `const readOnly = phase !== "accepting";` | **SPIN-03 직결.** `phase === "spinning" \|\| phase === "decided"`. D-18이 **순수 헬퍼 추출**(`isCandidateListLocked(phase)` 류)을 지시 → 같은 파일 `:31-44`의 `parseMenuInput`이 **"컴포넌트 파일에서 순수 함수를 named export하고 spec이 `@/components/MenuList`로 import한다"**는 선례다. 새 헬퍼도 같은 자리(컴포넌트 함수 위)에 두고 `components/MenuList.test.ts`에 `describe` 하나를 더한다 |
| `components/TopBar.tsx:17-21` | `if (phase === "accepting") return {…}; if (phase === "spinning") return {…}; return { label: "확정", dot: "done" };` | `switch` + `never`. `stalled` → `{ label: "추첨 대기", dot: "live" }`(D-09). IIFE `(() => {…})()` 형태는 유지 |
| `components/PhaseTimeline.tsx:16-17` | `const activeIdx = STEPS.findIndex((s) => s.id === current); const idx = activeIdx === -1 ? 2 : activeIdx;` | `stalled` → `accepting`(idx 0) 매핑. `STEPS`(`:8-13`)의 `id`에 `"stalled"`를 **추가하지 않는다**(타임라인 단계는 4개 그대로, Phase 6이 디자인) |
| `components/ResultBlock.tsx:105-120` | `if (phase === "decided" && !winner) { … "아직 결과가 없어요" … }` | **조건만 `phase === "stalled"`로 바꿔 옮긴다.** 문구가 이미 정확하다(D-18). 새 분기를 만들지 않고 도달 불가가 된 분기를 남기지 않는다. `:13`의 `spinTime = "11:55"` 기본 prop은 **이 페이즈에서 건드리지 않는다**(Phase 6 / SPIN-06) |
| `app/page.tsx:301-304` (`StageHeader`) | 삼항 2단 → `"오늘의 결과"` / `dot = "done"` | `switch`로 `label`·`dot`을 한 번에. `stalled` → `"추첨 대기중"`(D-09) |
| `app/page.tsx:336-341` (`phaseHeadline`) | if-체인 → `return "오늘의 점심";` | `stalled` 분기 추가 |
| `app/page.tsx:343-350` (`phaseSubhead`) | if-체인 → `return "";` | `stalled` 분기 추가. **`:345`·`:346`의 하드코딩 `11:55` 문구는 그대로 둔다**(Phase 6) |
| `app/page.tsx:148-154` (`wheelPhase`) | `: phase === "spinning" ? "spinning" : "idle"` | 우연히 맞지만 D-08대로 `stalled → "idle"`을 명시. `WheelPhase`(`components/Wheel.tsx:7`)는 별도 유니온이라 `Phase` 확장의 영향을 받지 않는다 — **`Wheel.tsx`는 수정 대상이 아니다** |
| `app/page.tsx:267` (respin 버튼) | `resolvedPhase === "decided" && todayResult` | `resolvedPhase` 제거 후 `phase === "decided" && todayResult`로. `hasResult`가 `decided`를 결정하므로 의미 동일 |

**`resolvedPhase` 제거 (`app/page.tsx:156`)** — 이 한 줄이 사라지면 `:236, 249, 258, 263, 267, 286, 228, 229` 여덟 자리가 전부 `phase`로 바뀐다. `phase`(`:28`)는 `currentPhase(now, settings.spinTime, todayResult !== null)`가 된다.

---

### `tsconfig.json` · `eslint.config.mjs` (config — Wave 0 선행) ⚠

**Analog:** 자기 자신. 두 파일 모두 **한 줄을 두 줄로 쪼개는 것**이 전부다.

`tsconfig.json:33`
```json
"exclude": ["node_modules", "supabase/functions/**", "design/**"]
```
→ `"supabase/functions/spin-roulette/**"`, `"supabase/functions/respin-roulette/**"`로 치환(D-12).

`eslint.config.mjs:15-17`
```javascript
    // 추가: 디자인 프로토타입 JSX(큰 inline SVG/스타일) + Deno Edge Function 제외
    "design/**",
    "supabase/functions/**",
```
→ 같은 방식으로 두 줄. **주석도 함께 갱신**한다("Deno Edge Function 제외" → "Deno 전역을 쓰는 함수 디렉터리만 제외. `_shared/`는 순수 TS라 린트 대상").

- 이 태스크가 **Wave 0 첫 번째**다(D-18 / §Pitfall 4). 순서를 뒤집으면 `_shared` 작업 전체가 검증 사각지대에서 진행된다.
- `vitest.config.mts`는 **무변경**(§Q5 실측). `:36-38`의 extglob exclude 주석("줄이지 말 것")을 지키는 것이 이 페이즈의 불변식이다.
- 적용 직후 기대 효과: `_shared/*.ts` 사이에 `./kst.ts` 상대 import를 쓰면 `TS5097`로 즉시 실패 = D-02가 규약에서 게이트로 승격.

---

### `CLAUDE.md` · `.planning/codebase/CONVENTIONS.md` (docs — D-16)

**정정 대상(정확한 줄):**

| 파일:줄 | 현재 진술 | 이 페이즈 후 사실 |
|---|---|---|
| `CLAUDE.md:44` | "추첨 시각 11:55는 **네 곳에 흩어져 있다**: `lib/phase.ts`(SPIN_HH/MM), `spin-roulette/index.ts`(SPIN_HH/MM), `0002_cron.sql`, UI 문구" | `_shared/spinTime.ts`의 `DEFAULT_SPIN_TIME`이 코드상 유일한 정의처. 남은 중복은 UI 문구(Phase 6) + 마이그레이션 기본값 |
| `CLAUDE.md:45` | "`kstNow()`는 두 Edge Function에 복붙돼 있다 (Deno라 `lib/time.ts` 공유 불가)" | `_shared/kst.ts` 단일 정의. Deno는 `../_shared/kst.ts`, 클라이언트는 `@/supabase/functions/_shared/kst`로 같은 파일을 본다 |
| `CLAUDE.md:38` | "Edge Function은 … `tsconfig`·eslint에서 제외돼 있으므로 **타입체크·lint가 안 돈다**" | `_shared/`는 tsc·eslint·vitest 3중 검사. 제외는 함수 디렉터리 2개뿐. 두 `index.ts`는 여전히 사각지대 → `edgeImports.test.ts` + 낭독 |
| `CLAUDE.md:27` | vitest "수집 대상은 `lib/**`·`components/**`·`supabase/functions/_shared/**`" | `supabase/migrations/**` 누락(Phase 2가 추가함) + `_shared`에 실제 파일이 생김 |
| `CLAUDE.md:12-13` | 엔트리포인트 목록 | `lib/settings.ts`·`lib/useSettings.ts`·`supabase/functions/_shared/` 추가. `lib/phase.ts` 설명의 `accepting\|spinning\|decided`에 `stalled` 추가 |
| `CLAUDE.md:35` 부근(코드 컨벤션) | — | **공용 훅은 `lib/useX.ts`, `use` 접두** 한 줄 추가(D-11) |
| `CLAUDE.md:63` | "미사용 코드: `lib/phase.ts` `msToNextPhase` …" | `msToNextPhase` 삭제됨 → 항목에서 제거 |
| `CONVENTIONS.md:50` | "`globalIgnores`로 `design/**`, `supabase/functions/**`를 제외한다 … **풀지 말 것**" | 함수 디렉터리 2개만 제외. OOM 근거는 `design/**` 쪽 |
| `CONVENTIONS.md:54` | "`exclude`에 `supabase/functions/**` → Edge Function은 타입체크가 돌지 않는다" | 위와 동일 |
| `CONVENTIONS.md:147` | "추첨 시각 11:55는 **네 곳에 중복**" | `CLAUDE.md:44`와 같은 정정 |
| `CONVENTIONS.md:144` | "**모든 시간 함수는 `now: Date = new Date()`를 기본 인자로 받는다**" | `currentPhase`·`kstParts`(`_shared`)는 **예외**(시각 주입 강제, D-07). `lib/time.ts` 포맷터는 그대로 |
| `CONVENTIONS.md:13` | "`lib/` 모듈은 소문자 단수 명사" | 훅 파일 `lib/useSettings.ts` 예외 한 줄 |
| `CONVENTIONS.md:25` | 상수 목록에 `SPIN_HH`/`SPIN_MM`(`lib/phase.ts:14-16`) | 삭제됨 → `DEFAULT_SPIN_TIME`(`_shared/spinTime.ts`)로 교체 |
| `CONVENTIONS.md:34` | `Phase = "accepting" \| "spinning" \| "decided"` | `\| "stalled"` 추가 |
| `CONVENTIONS.md:70` | "상대 경로 `../`를 쓰지 않는다. `lib/phase.ts:10`의 `./time`만 예외" | 예외 2건 추가: `_shared/*.test.ts`의 `./kst`, Edge Function의 `../_shared/*.ts`(확장자 포함) |

**문체:** 두 문서 모두 **한글 + 백틱 식별자 + 굵은 강조로 금지/주의 표시**. 줄 번호를 인용하는 습관(`lib/phase.ts:14-16`)을 유지한다 — 줄이 바뀌면 함께 갱신.
D-16은 이 작업을 **코드와 같은 플랜**에 두라고 지시했다. Phase 8 SHIP-03은 남은 항목만 처리한다.

---

## Shared Patterns

### 한글 Why 주석 — "무엇을 하지 말 것인가"까지 적는다
**Source:** `lib/constants.ts:1-4` · `lib/errors.ts:1-5` · `supabase/functions/respin-roulette/index.ts:1-16` (CONVENTIONS.md:216이 지목한 최고 예시)
**Apply to:** 신규 10파일 전부
파일 머리에 역할·제약 블록. **"왜 이 흔한 방법을 안 썼는가"**가 이 레포의 시그니처다(CONVENTIONS.md:217-222). `_shared` 3파일은 "import 를 하나도 하지 않는다 + 그 이유"를 금지문으로 남긴다.

### 순수 모듈 = 값 import 0개
**Source:** `lib/errors.ts:2-3` · `lib/constants.ts:2-4` · `components/MenuList.tsx:6-8`
**Apply to:** `_shared/*.ts` 3개, `lib/settings.ts`
`lib/supabase/client.ts`는 로드 시점에 `createClient`를 실행한다(`:3-10`) → 값 import 시 vitest가 `supabaseUrl is required.`로 즉사(§Q7 실측). `import type` **문장**만 허용.

### 초기 로드 + 구독 2-effect 골격
**Source:** `app/rank/page.tsx:25-65`(최소 완전형) · `app/log/page.tsx:34-82` · CONVENTIONS.md:153-162
**Apply to:** `lib/useSettings.ts`, 세 페이지의 `useSettings` 배선
`useEffect` + async IIFE + `cancelled` 플래그 / 별도 `useEffect`에 `channel(고유이름).on(...).subscribe()` + cleanup `removeChannel`.

### 로드 에러 배너 조인
**Source:** `app/page.tsx:56-62` · `lib/errors.ts:15-19`
**Apply to:** 세 페이지의 `settings` 에러 합류
```typescript
setLoadError(
  joinLoadErrors([
    formatLoadError("메뉴 목록", menuRes.error),
    formatLoadError("오늘 결과", todayRes.error),
    formatLoadError("고정 메뉴", pinRes.error),
  ]),
);
```
→ `formatLoadError("설정", …)` 한 줄을 배열에 더한다(D-11). `app/log`·`app/rank`는 현재 `formatLoadError` 단독 호출(`log:50`, `rank:33`)이므로 **`joinLoadErrors`로 승격**해야 한다. 쓰기 에러(`actionError`)와는 절대 합치지 않는다(`app/page.tsx:36-38`의 근거 주석).
**개발 중에는 "설정 불러오기 실패: Could not find the table 'public.settings' in the schema cache" 배너가 항상 뜨는 것이 정상**(D-18 / §Q4-c) — 실행자가 버그로 오인하지 않게 플랜에 적는다.

### vitest 스펙 골격
**Source:** `lib/errors.test.ts:5-11` · `lib/phase.test.ts:1-9` · `components/MenuList.test.ts:1-11`
**Apply to:** 신규 spec 5개 + 재작성 1개
명시 import(`globals: false`) + 한글 `it` 이름 + **단언당 `it` 하나** + 기대값은 리터럴 + 머리 주석에 "안 하기로 한 것과 그 이유".

### 텍스트 계약 테스트 골격
**Source:** `supabase/migrations/0005_restaurants_settings.test.ts:1-37,77-128`
**Apply to:** `_shared/edgeImports.test.ts`
`readOrEmpty` + `stripComments` + `count()` + `new URL(…, import.meta.url)` + `describe("<영역>/<REQ> — …")` + `it("… (#N)")` + **양방향 이중 단언**(존재 + 부재를 둘 다 센다).

### 실행 검증 명령
**Source:** `package.json:9-11` · `.planning/phases/02-data-model/02-VALIDATION.md` · RESEARCH §Sampling Rate
**Apply to:** 모든 태스크
`npx vitest run supabase/functions/_shared lib` (~90ms) → `npm test` → `npx tsc --noEmit` → `npm run lint` → `npm run build`.
D-12 적용 **후**에는 `tsc`·`eslint`가 `_shared`를 실제로 본다 — 적용 전 초록은 무의미하다(§Pitfall 4).

---

## Anti-Patterns in the Analogs (복사 금지 목록)

아날로그에 실재하지만 이 페이즈가 **따라 하면 안 되는** 줄. `edgeImports.test.ts`와 `tsc`가 아래 6건을 기계적으로 잡는다.

| 아날로그 위치 | 복사 금지 코드 | 이 페이즈의 안전형 | 근거 |
|---|---|---|---|
| `lib/time.ts:16,25,48` | `hour12: false` | `hourCycle: "h23"` (둘을 같이 쓰지 않는다) | `hour12`가 이기면 `hourCycle`이 죽는다 — D-04 / §Q3 실측 |
| `lib/time.ts:30`, `lib/phase.ts:18,29` | `now: Date = new Date()` 기본 인자 | `kstParts(now: Date)` / `currentPhase(now, spinTime, hasResult)` — 기본 인자 0개 | D-01·D-07. 무인자 호출 0건 확인 |
| `lib/phase.ts:10` | `import { kstParts } from "./time";` (형제 모듈 상대 import) | `_shared` 안에서는 **어떤 import도 금지**, 교차 타입은 로컬 구조 타입 | D-02·D-17 / §Q1-d. D-12 후 `TS5097` |
| `supabase/functions/spin-roulette/index.ts:15` | `type KstParts = { date; hour; minute; second };` 로컬 재선언 | `_shared/kst.ts`의 `KstParts`를 import | QUAL-02(복붙 제거). 단 `spinTime.ts`는 **일부러** 로컬 `TimeParts`를 선언한다 — 이건 복붙이 아니라 D-02 회피 |
| `components/TopBar.tsx:17-21` · `ResultBlock.tsx:14,46,76,105` · `PhaseTimeline.tsx:16-17` · `app/page.tsx:303-304,336-350` | if-체인 + fallback `return` | `switch` + `const exhaustive: never = phase` | §Pitfall 1 — 유니온을 넓혀도 tsc가 침묵한다. `MenuList:49`가 조용히 SPIN-03을 미완성으로 만든다 |
| `supabase/migrations/0005_…test.ts`에 **없는 것** → RESEARCH 스니펫의 `expect(src).toMatch(/…/)` · `readFileSync("상대/cwd/경로")` | `toMatch` + cwd 상대 문자열 경로 | `count(src, /…/g)` + `new URL(…, import.meta.url)` | 레포 `toMatch` 사용처 0건. 경로 관용구는 `vitest.config.mts:9`·`0005 test:77` |

추가 금지:
- **`lunch-realtime` 채널에 `settings` 바인딩을 추가**(§Pattern 4 / CLAUDE.md 위험 지점: "순서 바꾸면 휠 이중 회전").
- **`lib/settings.ts`에서 `supabase` 값 import**(§Q7 즉사).
- **`ResultBlock`에 `stalled` 분기를 새로 작성**(`:105-120`을 옮기는 것이 정답 — 도달 불가 분기를 남기면 죽은 코드).
- **`npm run dev`로 확인**(CLAUDE.md 금지, 가드런처만). 이 페이즈는 `tsc`·`lint`·`test`·`build`로 전부 검증된다.

---

## No Analog Found

레포에 선례가 없어 **RESEARCH.md의 검증된 스니펫이 정본**인 요소들. 억지로 아날로그를 끌어오면 잘못된 형태가 나온다.

| 요소 | Role | Data Flow | Reason |
|---|---|---|---|
| `switch` + `const exhaustive: never` 가드 | component / utility | — | 레포에 `switch` 문 **0건**(전부 if-체인·삼항). RESEARCH §Pattern 2가 정본. 이 페이즈가 첫 사례이자 SPIN-03의 안전장치 |
| `settingsReducer` (리듀서 + action 유니온) | model | event-driven | 레포에 `useReducer`·리듀서 함수 **0건**(전부 `useState`). RESEARCH §Pattern 3 |
| `lib/useSettings.ts` — 훅 **파일** 자체 | hook | request-response + pub-sub | 레포 첫 `lib/use*.ts`. 내부 두 effect는 `app/rank/page.tsx:25-65`에 정확한 아날로그가 있지만, **훅으로 추출해 세 페이지가 공유하는 구조**는 최초 |
| `applyCooldown`의 `{ picked, fellBack }` 객체 반환 | utility | transform | 순수 함수가 객체를 반환하는 선례 0건(`parseMenuInput`·`formatLoadError`·`kstParts` 전부 단일 값/레코드). D-14 + RESEARCH §Pattern 5 |
| `Date.UTC` + `getUTC*` 날짜 산술 | utility | transform | `lib/time.ts`는 전부 `Intl`, `CalendarLog`는 로컬 `Date` 메서드. UTC 전용 산술은 최초 — §Q8의 7케이스 × TZ 3종 실측 스니펫을 그대로 |
| `_shared`의 로컬 구조 타입(`TimeParts`)으로 교차 의존 대체 | utility | — | 기법 자체는 `lib/errors.ts:10`(`{ message: string }`)에 선례가 있으나, **"import이 물리적으로 불가능해서"** 쓰는 것은 최초. §Pattern 1 |
| `event: "*"` postgres_changes 바인딩 | hook | pub-sub | 레포의 구독 6개 바인딩은 전부 `INSERT`/`UPDATE`/`DELETE` 명시. 와일드카드는 최초(§Q4-a가 `payload.eventType` 분기를 요구) |
| `"stalled"` 화면 문구 | component | — | `ResultBlock:105-120`의 문구를 재활용하지만 TopBar/StageHeader/Timeline 문안은 신규. **정확한 문안은 재량, Phase 6이 다듬는다**(D-09) |

---

## Metadata

**Analog search scope:** `lib/` 전량(9파일), `components/` (`MenuList`·`TopBar`·`ResultBlock`·`PhaseTimeline` 해당 구간 + `MenuList.test.ts`), `app/` (`page.tsx` 부분 3구간 · `log/page.tsx` 전량 · `rank/page.tsx` 전량), `supabase/functions/` 2파일 전량, `supabase/migrations/0005_…test.ts` 부분 2구간, 루트 설정 4개(`tsconfig.json`·`eslint.config.mjs`·`vitest.config.mts`·`package.json` 스크립트), 문서 2개(`CLAUDE.md`·`.planning/codebase/CONVENTIONS.md`)
**Files scanned:** 24 (전량 읽기 15 · 부분 읽기 5 · grep 확인 4)
**Grep 확인:**
- `toMatch`·`describe.each` → `lib`·`components`·`supabase`의 `*.test.ts`에 **0건**
- `kstParts()` 무인자 호출 → **0건** (호출 7곳 전부 인자 전달)
- `currentPhase()` 무인자 호출 → **0건** (호출 9곳 전부 인자 전달)
- `Phase` 소비처 → 9곳 확인(RESEARCH §Pitfall 1 표와 일치). `components/Wheel.tsx`는 별도 `WheelPhase` 유니온이라 **대상 아님**
- `.claude/skills`·`.agents/skills` → 부재
**미해결 1건(플래너 결정 필요):** `SettingsRow.history_since`가 non-nullable `string`인데 `Settings.historySince`는 `string | null` — §`lib/settings.ts` 3번 항목의 (A)/(B) 중 택일 (**(A) 권장**)
**Pattern extraction date:** 2026-09-21
