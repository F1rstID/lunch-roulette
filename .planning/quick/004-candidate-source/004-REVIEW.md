# Quick 004 리뷰 — candidates.source (0008)

- 대상: `git diff 6543942..HEAD`(feat/candidate-source 커밋 4개: 7ad01d2·3a79e52·7a45bf1·d1e04eb) + 워킹트리 `README.md`·`CLAUDE.md`. 플랜 `004-PLAN.md` 기준.
- 실행: `npm test`(26 파일 591 통과) · `npx tsc --noEmit`(exit 0) · `npm run check:edge`(exit 0). 코드 수정 없음.
- 숫자 대조: `edgeImports.test.ts` `it(` 67개 = CLAUDE.md "67건" ✓ · `console.error` spin 9 / respin 7 ✓ · `cooldown` 런타임 export 6개 유지(#36) ✓ · 0005 spec #37/#38 참조 ✓ · README·CLAUDE.md `cooldown_days` 제거 "0009" 일치 ✓.
- 적용 창(SQL → 함수 → 머지) 점검: 구 클라이언트 `select("*")`·`insert({restaurant_id})` → 기본 seed, 구 함수는 명시 컬럼이라 `source` 를 안 읽음, Realtime INSERT 페이로드는 `source` 포함·DELETE 는 PK 만(0005 replica identity 기본) — 창 안에서 깨지는 경로 없음.

**Critical: 없음.**

| 번호 | 심각도 | 위치 | 문제 | 제안 |
|---|---|---|---|---|
| 1 | Warning | `README.md:172`(0008 적용 4번) · `components/CandidateList.tsx:197` 푸터 · `components/CandidateList.tsx:117` all_paused 안내 | 📌 매장은 자정에 이미 seed 로 담겨 있어 토글 버튼이 **"빼기"** 다 — "사유 배지가 있는 매장을 담으면 번호로 바뀐다" 는 핀이 아닌 매장에만 성립한다. 플랜은 "담긴 seed 행을 되살리는 제스처 = 빼기 → 담기(두 탭)" 로 정했는데 README 확인 절·푸터 문구("직접 담으면 그래도 올라가요")·전원 쉬기 안내("쉬기를 풀거나 매장을 더 담아 주세요") 어디에도 그 제스처가 없다. 시나리오: 사용자가 `화 방문` 배지가 붙은 📌 매장을 보고 푸터대로 "직접 담기" 를 찾지만 버튼은 빼기뿐 → 원 보고("담겨 있는데 룰렛에 안 보임")와 같은 모양으로 "안 고쳐졌다" 로 읽힌다 | README 4번에 "(📌 로 이미 담긴 매장이면 **빼기 → 담기** — 새 행이 manual)" 추가. 푸터는 "직접 담으면(담겨 있으면 빼고 다시 담으면) 그래도 올라가요" 식으로 제스처를 한 구절에 넣는다. all_paused 안내에도 "빼고 다시 담거나" 를 더한다. 배지 자체는 플랜대로 안 바꿔도 된다 |
| 2 | Warning | `lib/useCandidates.ts:12-13` · `CLAUDE.md:15`(`lib/useCandidates.ts` 항목 "이 테이블이 키와 담은 시각뿐이라") | UPDATE 를 구독하지 않는 **근거**가 0008 로 거짓이 됐다 — 테이블에 의미 있는 컬럼(`source`)이 생겼고 "되살리기" 를 `update({ source: "manual" })` 한 줄로 구현하는 것이 가장 자연스러운 다음 변경이다. 그 경로를 만들면 어느 탭도 이벤트를 받지 못해(재조회 트리거도 없음) 서버 pool 에는 들어가고 화면 휠에서는 빠지는, 0008 이 없애려던 바로 그 불일치가 소리 없이 돌아온다. 결론(2분기)은 여전히 맞지만 이유가 틀리면 다음 사람이 함정을 못 본다 | 두 곳의 이유를 "`source` 를 고치는 쓰기 경로를 **두지 않는다**(되살리기는 빼기 → 담기, 새 행) — 두면 UPDATE 분기를 함께 더해야 한다" 로 바꾼다. CLAUDE.md 위험 표 `candidates.source` 행에도 한 문장 추가 |
| 3 | Warning | `lib/rowset.ts:50-53` (`createRowSetReducer` INSERT: `known ? rows : [...rows, row]`) | INSERT 멱등이 "같은 키면 **무시**" 라서 같은 키의 행 내용이 바뀐 INSERT 를 버린다. 0007 까지는 같은 키의 재INSERT 가 사실상 같은 행(`created_at` 만 다름)이라 무해했지만, 0008 부터 "빼기 → 담기" 는 같은 키로 `source` 가 seed → manual 로 바뀌는 INSERT 다. 시나리오: 다른 사람의 탭 B 가 재연결 틈에 DELETE 를 놓치고 INSERT(manual) 만 받으면 → 무시 → B 는 그 매장을 seed/제외로 계속 보이고 서버는 pool 에 넣는다 — "휠에 없는 매장이 뽑히는" 탭 하나. 전제(이벤트 유실)가 있어 빈도는 낮고, `useCandidates` 에는 `useLunchWeek` 같은 visible 재조회도 없어 리로드 전까지 안 풀린다 | INSERT 도 알려진 키면 통째로 교체(`rows.map(...)`) — UPDATE 분기의 근거("payload.new 는 전체 새 행") 가 그대로 적용된다. `pending` 재적용·재연결 중복 INSERT 는 내용이 같아 교체해도 결과가 같다. `lib/rowset.test.ts` 에 "같은 키·다른 `source` INSERT → 교체" 1건 추가 |
| 4 | Info | `lib/lunchDay.test.ts:269-277`(#57) · `supabase/functions/_shared/cooldown.test.ts` #40 | 0007 대비 가장 큰 가시 변화는 "seed 전원 방문 + manual 하나" 날이다 — 전에는 `fellBack` 으로 전원이 휠에 남았고, 지금은 manual 하나만 휠에 오르고 방문 seed 는 전부 `offWheel`(사유 배지)로 간다(의도된 결정). 이 경우를 pool 수준(#40)만 고정하고 `wheelPool` 수준에서는 안 본다 — #57 은 seed 쪽을 **쉬기**로 둬서 `offWheel` 에 방문 seed 가 들어가는 것·`fellBack === false` 가 화면 입력으로 나오는 것을 확인하지 않는다 | `lunchDay.test.ts` WEEK-02 에 `[{r1 seed},{r2 seed},{r3 manual}]` + `V(r1), V(r2)` → `items [r3]`, `fellBack false`, `offWheel [r1, r2]` 1건 추가 |
| 5 | Info | `supabase/migrations/0008_candidate_source.test.ts:38-48` · `supabase/rollback/0008_candidate_source.rollback.test.ts:53-58` | 주석의 한글 낱말(`기본값`·`구 클라이언트`·`담기`·`역순`·`함수`·`PGRST204`·`잃는\|사라진다`)을 `toMatch` 로 고정한다 — 동작·구조가 아니라 **문장**을 잠근 것이라 주석을 다듬기만 해도 스위트가 깨지고, 반대로 낱말만 남아 있으면 틀린 설명도 통과한다. 나머지(컬럼·check·cron 본문·순서) 계약은 구조를 본다 | 주석 낱말 단언은 지우거나 `comment on column` 한 줄(DB 에 남는 값)로만 좁힌다 |
| 6 | Info | `.planning/quick/004-candidate-source/` | 플랜 5번이 말한 `004-SUMMARY.md` 가 없다(디렉터리에 PLAN 만). STATE.md 는 워킹트리에서 갱신됨 | 리뷰 반영 뒤 SUMMARY 작성(적용 순서·게이트 결과·리뷰 반영 표) |

점검했으나 결함 아님(기록용): `applyWeeklyExclusions` 의 `=== "manual"` 한 방향 판정과 `allPaused`/`fellBack` 의미가 Edge 2종·`wheelPool` 에서 동일(같은 함수, 입력에 `source` 전달 확인) · `listTodayRows` 의 번호 = `offWheel` 밖의 후보 순서 = 휠 `items` 인덱스로 manual 행도 일치 · `winnerIndex` 는 `restaurant_id` 로 `items` 에서 찾아 manual 포함 pool 과 맞음 · 0008 SQL 의 인라인 check + `add column if not exists` 는 재실행 시 전체 절이 스킵돼 안전, `$cmd$` 본문 주석 없음, unschedule 루프는 0005 패턴 · 롤백은 cron 재등록이 `drop column` 보다 앞 · `_shared/cooldown.ts` import 0 유지(타입 export 만 추가) · `lib/` → `app/`/`components/` import 없음 · 훅 분기 추가 없음 · `~Action` 접미 유지.

## 반영 (2026-10-30)

| 번호 | 처리 | 내용 |
|---|---|---|
| 1 | 반영 | README "0008 적용" 4번에 📌 매장은 **빼기 → 담기** 두 번(새 행이 manual) 명시. 오늘 탭 푸터 "직접 담으면 그래도 올라가요(이미 담긴 매장은 빼고 다시 담기)", 전원 쉬기 안내에 "(빼고 다시 담아도 올라가요)" |
| 2 | 반영 | `lib/useCandidates.ts` 머리 주석의 UPDATE 미구독 근거를 "행을 고치는 쓰기가 없다 — source 도 insert 로만, 되살리기는 DELETE + INSERT; update 경로를 두려면 UPDATE 분기를 함께" 로 교체. CLAUDE.md 엔트리포인트 문장과 위험 표(`candidates.source`) 행에 같은 문장 |
| 3 | 반영 | `lib/rowset.ts` — 아는 키의 INSERT 를 "무시" 에서 "통째 교체" 로(UPDATE 와 같은 규칙, payload.new 가 전체 행). 중복 INSERT 멱등은 내용이 같아 결과 동일. `lib/rowset.test.ts` 에 "같은 key 의 INSERT 가 다른 내용으로 오면 자리를 지키며 교체" 1건 |
| 4 | 반영 | `lib/lunchDay.test.ts` #60 — seed 전원 방문 + manual 하나 → items [manual], fellBack false, offWheel [seed 둘] |
| 5 | 기록만 | 0007 spec·롤백 spec 이 같은 패턴(`toMatch(/월요일/)`·`/역순/`·`/함수/`)으로 주석의 뜻을 잠근다 — 레포 선례와 맞추어 유지. 다듬을 때 spec 도 함께 고친다 |
| 6 | 반영 | `004-SUMMARY.md` 작성 |

반영 뒤 게이트: `npm test` 593 · `npx tsc --noEmit` 0 · `npm run lint` 0 · `npm run check:edge` 0 · `npm run build` 성공.
