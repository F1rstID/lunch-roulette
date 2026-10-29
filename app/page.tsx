"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, type ResultRow } from "@/lib/supabase/client";
import { todayKstDate, formatKstLongDay, formatHhMmSs, formatSpinTime, kstParts } from "@/lib/time";
import { currentPhase, displayPhase, type Phase } from "@/lib/phase";
import {
  formatCandidateWriteError,
  formatLoadError,
  formatLunchDayWriteError,
  formatRespinError,
  joinLoadErrors,
} from "@/lib/errors";
import { findWinnerIndex, isNewSpin, joinCandidates } from "@/lib/candidates";
import { destinationOf, mapHref, nextDestination, visitSummary, weeklyExclusionMap } from "@/lib/lunchDay";
import { backupRanks } from "@/lib/ranking";
import { sortRestaurants } from "@/lib/restaurants";
import { useCandidates } from "@/lib/useCandidates";
import { useLunchWeek } from "@/lib/useLunchWeek";
import { useRestaurants } from "@/lib/useRestaurants";
import { useSettings } from "@/lib/useSettings";
import { weekStartOf } from "@/supabase/functions/_shared/cooldown";
import { TopBar } from "@/components/TopBar";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Wheel, type WheelPhase } from "@/components/Wheel";
import { CandidateList } from "@/components/CandidateList";
import { DestinationCard, type VisitInput } from "@/components/DestinationCard";
import { ResultBlock } from "@/components/ResultBlock";

// respin-roulette Edge Function 응답 (supabase/functions/respin-roulette/index.ts 와 맞춘다).
// error 키는 일부러 없다: 함수의 { error } 본문은 non-2xx 에서만 오고 그때 data 는 null 이라
// 이 타입으로 도달하지 않는다. 그 본문은 response.json() 으로 읽어 formatRespinError 가
// unknown 으로 받는다. 여기 error 를 두면 "2xx 에도 error 가 올 수 있다" 는 거짓말이 된다.
type RespinResponse = { ok?: boolean; skipped?: string };

// 구독마다 토픽에 붙일 일련번호. React 의 useId 를 쓰지 않는 이유는 문자 집합이다 — React 19 의 id 는
// «r0» 처럼 ASCII 밖 문자를 담고, 토픽은 소켓 위로 그대로 나가는 식별자라 ASCII 로 묶어 두는 편이 안전하다.
let topicSeq = 0;

export default function TodayPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = todayKstDate(now);
  // 주 시작(월요일). 요일은 KST 분해에서 온다 — 로컬 Date 요일 메서드를 쓰지 않는다. 자정에 todayKey 와 함께 바뀐다.
  // weekStartOf 가 null 을 주는 것은 오염 입력일 때뿐이고 todayKey 는 늘 날짜꼴이라 폴백은 형식상이다.
  const weekday = kstParts(now).weekday;
  const weekStart = useMemo(() => weekStartOf(todayKey, weekday) ?? todayKey, [todayKey, weekday]);

  const [todayResult, setTodayResult] = useState<ResultRow | null>(null);
  const [forceSpin, setForceSpin] = useState(false);
  const [respinning, setRespinning] = useState(false);
  // 목적지·방문 쓰기가 도는 동안 카드의 버튼을 잠근다 — 하루 한 행이라 두 쓰기가 겹치면 뒤가 앞을 덮는다.
  const [dayBusy, setDayBusy] = useState(false);
  // 마지막 쓰기(후보 담기·빼기·다시 돌리기) 실패 메시지. 성공하면 지운다.
  const [actionError, setActionError] = useState<string | null>(null);
  // 초기 로드(SELECT) 실패 메시지. actionError 와 한 state 로 합치지 않는다 — 쓰기가 성공할 때마다
  // setActionError(null) 이 불리므로, 합치면 읽기 실패 메시지가 사용자 모르게 지워진다.
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialLoadedRef = useRef(false);
  // 결과 행의 동기 거울. 구독 페이로드의 DELETE 계열에는 PK 만 실려 와 이전 추첨 시각을 읽을 수 없고,
  // state 는 이벤트가 도착한 시점에 최신이 아닐 수 있다. 회전 여부를 그 두 값의 비교로 정하므로 렌더를
  // 기다리지 않는 거울이 필요하다 — 초기 조회와 이벤트 처리 양쪽에서 함께 세운다.
  const todayResultRef = useRef<ResultRow | null>(null);

  const { rows: restaurantRows, loaded: restaurantsLoaded, error: restaurantsError } = useRestaurants();
  const { rows: candidateRows, loaded: candidatesLoaded, error: candidatesError } = useCandidates();
  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const {
    settings,
    loaded: settingsLoaded,
    error: settingsError,
    warning: settingsWarning,
  } = useSettings();
  // 이번 주 점심 기록(월~오늘)과 당첨(월~어제). 재연결·탭 복귀마다 다시 읽는다 — 이 훅만의 규칙(lib/useLunchWeek.ts 머리 주석).
  const week = useLunchWeek(weekStart, todayKey);

  // todayResult 가 선언된 뒤라야 계산할 수 있다 — decided 를 결정하는 것은 시각이 아니라 결과 행의 존재다.
  // 설정 조회가 끝나기 전에는 기본 시각으로 계산한 "추첨 대기" 를 가린다 — 대시보드가 시각을 늦춰 둔 날
  // 첫 페인트에서만 그 라벨이 스쳤다가 바뀐다(D-23).
  const phase = displayPhase(currentPhase(now, settings.spinTime, todayResult !== null), settingsLoaded);
  // 화면이 보는 페이즈. 다시 돌리기로 결과 행이 먼저 바뀌어도 휠이 도는 5초 동안은 새 당첨을 숨긴다 —
  // 그러지 않으면 카드·머리글·상단 상태가 휠보다 먼저 답을 말해 회전이 연출이 아니라 지연이 된다.
  // 후보 목록 잠금과 다시 돌리기 버튼의 표시 조건은 실제 페이즈(phase)를 그대로 본다.
  const shownPhase: Phase = forceSpin ? "spinning" : phase;
  const spinTimeText = formatSpinTime(settings.spinTime);

  // 아래 넷은 매초 리렌더되는 페이지가 쓰는 파생값이라 전부 메모한다.
  // 휠·카운터·목록이 같은 배열 하나를 본다 — 순서의 정의처를 둘로 만들지 않는다.
  const todayCandidates = useMemo(
    () => joinCandidates(candidateRows, restaurantRows),
    [candidateRows, restaurantRows],
  );
  // 안 담긴 구간의 순서(핀 먼저 · 이름순)는 여기서 한 번만 정해 목록에 넘긴다.
  const catalog = useMemo(() => sortRestaurants(restaurantRows), [restaurantRows]);
  // 이번 주 제외 — 휠에서 빠지고 목록에 사유 배지로 남는 매장. 서버(Edge)와 같은 함수(_shared/cooldown.ts)로 판정한다.
  // 카탈로그 전체를 넘긴다: 안 담긴 쉬기 매장도 배지를 받아 "담아도 안 뽑힌다" 가 담기 전에 보인다.
  const excluded = useMemo(
    () => weeklyExclusionMap(weekStart, todayKey, week.winners, week.days, restaurantRows),
    [weekStart, todayKey, week.winners, week.days, restaurantRows],
  );
  // 휠에 실제로 올라가는 후보. 당첨 인덱스도 이 배열 기준이다 — 제외된 매장은 칸이 없으니 당첨일 수도 없다
  // (서버가 같은 규칙으로 pool 을 만들었다면. 방문 전멸 폴백의 날은 예외라 -1 이 될 수 있고 그때 하이라이트만 빠진다).
  const wheelItems = useMemo(() => todayCandidates.filter((c) => !excluded.has(c.id)), [todayCandidates, excluded]);
  const winnerIndex = useMemo(() => findWinnerIndex(wheelItems, todayResult), [wheelItems, todayResult]);
  // 이름은 결과 행의 스냅샷이고 메뉴·위치는 지금 카탈로그에 있는 값이다. 두 출처가 다른 것이 의도다 —
  // 매장을 지워도 결과의 이름은 남아야 기록·랭킹이 성립하고(CATL-03), 상세만 비는 것이 맞는 화면이다.
  const winner = useMemo(() => {
    if (todayResult === null) return null;
    const store = restaurantRows.find((row) => row.id === todayResult.restaurant_id);
    return { name: todayResult.menu, menus: store?.menus ?? [], location: store?.location ?? null };
  }, [todayResult, restaurantRows]);
  // id → 위치. 목적지 카드와 2·3순위의 지도 링크가 쓴다(위치가 링크면 그 링크, 아니면 이름 검색).
  const locations = useMemo(
    () => new Map(restaurantRows.map((row) => [row.id, row.location] as const)),
    [restaurantRows],
  );
  // 2·3순위 + 지도. 모양 검사와 상한은 순수 함수가 맡는다 — 0006 이전 행(null)이면 빈 배열이다.
  // rank 는 자리 순위라 ranking[rank - 1] 이 그 항목이다(lib/ranking.ts 가 자리를 보존한다).
  const backups = useMemo(
    () =>
      backupRanks(todayResult?.ranking).map((backup) => {
        const id = todayResult?.ranking?.[backup.rank - 1]?.restaurant_id;
        return { ...backup, href: mapHref(backup.name, (id ? locations.get(id) : null) ?? null) };
      }),
    [todayResult, locations],
  );
  // 오늘 갈 곳. 오늘 행이 없으면 1순위, 있으면 lunch_days 와 결과 행의 시각 비교로 정한다(규칙은 _shared/cooldown.ts).
  const todayDay = useMemo(() => week.days.find((day) => day.date === todayKey) ?? null, [week.days, todayKey]);
  const destination = useMemo(() => destinationOf(todayResult, todayDay), [todayResult, todayDay]);
  const next = destination === null ? null : nextDestination(todayResult?.ranking ?? null, destination.id);
  const isDefault = destination === null || destination.id === todayResult?.restaurant_id;
  const visit = visitSummary(todayDay);
  // 뽑는(뽑은) 후보 수. decided 는 결과 행이 말하는 pool(ranking), 그 전은 지금 휠에 있는 수다.
  const poolCount = todayResult?.ranking?.length ?? wheelItems.length;
  const allExcluded = todayCandidates.length > 0 && wheelItems.length === 0;

  // 빈 배열 하나로는 "아직 못 읽었다"·"못 읽었다"·"정말 0개" 가 구분되지 않는다. 두 훅이 들고 있는
  // loaded·error 를 여기서 세 상태로 좁혀 넘긴다 — 실패 화면에 등록 권유 문구가 뜨지 않게 하는 최소 경로다.
  const listStatus = restaurantsError || candidatesError
    ? "failed"
    : !restaurantsLoaded || !candidatesLoaded
      ? "loading"
      : "ready";

  useEffect(() => {
    let cancelled = false;
    initialLoadedRef.current = false;
    (async () => {
      // 이 페이지가 직접 읽는 것은 오늘 결과 하나뿐이다 — 매장 카탈로그와 오늘 후보는 각자의 훅이 읽고
      // 구독까지 맡는다. maybeSingle 이라 "오늘 결과 없음" 은 error 가 아니라 data: null 로 오므로,
      // 결과가 아직 없는 정상 상태에서는 배너가 뜨지 않는다.
      const { data, error } = await supabase
        .from("results")
        .select("*")
        .eq("date", todayKey)
        .maybeSingle();
      if (cancelled) return;
      setLoadError(formatLoadError("오늘 결과", error));
      const row = data ? (data as ResultRow) : null;
      // state 와 거울을 같은 값으로 함께 세운다. 한쪽만 세우면 첫 구독 이벤트가 엉뚱한 이전 값과 비교된다.
      todayResultRef.current = row;
      setTodayResult(row);
      initialLoadedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  useEffect(() => {
    // results INSERT(자동 추첨) / UPDATE(다시 돌리기) 공통 처리.
    // 회전은 추첨 시각이 새로 쓰였을 때만 켠다: 매장 삭제가 내보내는 갱신(restaurant_id 가 null 로 바뀐다)
    // 은 그 시각이 그대로라 여기서 걸러지고, 휠은 멈춘 채 행만 갱신돼 하이라이트만 사라진다. 걸러 내지
    // 않으면 매장 하나를 지울 때마다 열린 모든 탭의 휠이 5초씩 돈다(todo in-06). 다시 돌리기는 항상 새
    // 시각을 쓰므로 정상 재회전은 살아 있다.
    // 초기 로드 가드의 뜻은 그대로다 — 초기 조회가 끝난 뒤 도착한 이벤트만 휠을 돌린다.
    // 회전 켜기를 setState 업데이터 안에 넣지 않는 이유: 개발용 이중 실행에서 두 번 불린다.
    const applyResult = (row: ResultRow) => {
      if (row.date !== todayKey) return;
      const prev = todayResultRef.current;
      todayResultRef.current = row;
      setTodayResult(row);
      if (initialLoadedRef.current && isNewSpin(prev, row)) {
        setForceSpin(true);
        setTimeout(() => setForceSpin(false), 5000);
      }
    };

    // 토픽은 마운트당이 아니라 **구독마다** 새로 매긴다. state 에 두면 자정에 todayKey 가 바뀌어 같은
    // 인스턴스가 재구독할 때 realtime-js 가 아직 leave 중인(ack 를 기다리는) 옛 채널을 같은 토픽으로
    // 그대로 돌려주고, subscribe() 는 그 채널이 closed 가 아니라서 join 을 통째로 건너뛴다 — 예외도
    // 콜백도 없이 죽어 밤새 열어 둔 탭이 다음 날 결과를 못 받는다(CR-01).
    const channel: RealtimeChannel = supabase
      .channel(`results-${++topicSeq}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "results" },
        (payload) => applyResult(payload.new as ResultRow),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "results" },
        (payload) => applyResult(payload.new as ResultRow),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [todayKey]);

  // WheelPhase 는 Phase 와 별개 유니온이라 stalled 가 없다. accepting 과 stalled 는 둘 다 "idle" —
  // 추첨이 건너뛰어진 날에도 휠은 멈춰 있어야 한다.
  const wheelPhase: WheelPhase = forceSpin
    ? "spinning"
    : todayResult
      ? "decided"
      : phase === "spinning"
        ? "spinning"
        : "idle";

  // 아래 두 핸들러는 useCallback 으로 감싸지 않는다. 소비자(CandidateList, button)가 memo 컴포넌트가
  // 아니라 참조 안정성의 이득이 없고, React Compiler lint(preserve-manual-memoization)가
  // async 핸들러의 수동 memo 를 보존하지 못해 에러를 낸다.
  // 둘 다 낙관적 업데이트를 하지 않는다 — 목록은 구독 이벤트로만 옮겨간다.
  // 둘 다 본문을 try/catch 로 감싼다. supabase-js 는 fetch 실패까지 { error } 로 돌려주므로 평소에는
  // 던지지 않지만, 예상 밖 throw 가 핸들러를 빠져나가면 배너 없는 unhandled rejection 이 되고 목록은
  // boolean 을 받지 못해 행이 진행 중 상태에 갇힌다.

  // 두 핸들러가 같은 판정을 두 벌로 갖지 않게 한 곳에 모은다: 번역이 비면 사용자에게 보일 실패가
  // 아니므로(같은 매장을 둘이 동시에 담은 경우) 배너를 지우고 성공으로 돌려준다 — D-17.
  function reportCandidateWrite(message: string | null): boolean {
    setActionError(message);
    return message === null;
  }

  async function addCandidate(id: string, name: string): Promise<boolean> {
    try {
      const { error } = await supabase.from("candidates").insert({ restaurant_id: id });
      if (error) return reportCandidateWrite(formatCandidateWriteError("담기", name, error));
      setActionError(null);
      return true;
    } catch (e) {
      return reportCandidateWrite(
        formatCandidateWriteError("담기", name, { message: thrownMessage(e) }),
      );
    }
  }

  async function removeCandidate(id: string, name: string): Promise<boolean> {
    try {
      // 영향 행 수를 보지 않는다 — "이미 빠져 있음" 이 원하던 상태이고, 그것을 실패로 알리면 사용자는
      // 고칠 것이 없는 배너를 본다(매장 삭제와 갈리는 지점이다).
      const { error } = await supabase.from("candidates").delete().eq("restaurant_id", id);
      if (error) return reportCandidateWrite(formatCandidateWriteError("빼기", name, error));
      setActionError(null);
      return true;
    } catch (e) {
      return reportCandidateWrite(
        formatCandidateWriteError("빼기", name, { message: thrownMessage(e) }),
      );
    }
  }

  // 목적지·방문 쓰기(D-14). upsert 에 바꿀 컬럼만 보낸다 — PostgREST 는 보낸 컬럼만 갱신하므로 목적지 쓰기가 방문을,
  // 방문 쓰기가 목적지를 건드리지 않는다. 시각 컬럼의 값은 DB 트리거가 now() 로 바꾼다(0007) — 여기 값은 "건드렸다" 는
  // 신호다. 낙관적 업데이트 없음: 화면은 lunch_days Realtime 으로만 바뀐다(모든 탭이 같은 순간에 같은 목적지를 본다).
  async function setDestination(id: string | null, name: string | null) {
    const target = name ?? "1순위";
    setDayBusy(true);
    try {
      const { error } = await supabase.from("lunch_days").upsert(
        {
          date: todayKey,
          destination_id: id,
          destination_name: name,
          destination_set_at: new Date().toISOString(),
        },
        { onConflict: "date" },
      );
      if (error) {
        setActionError(formatLunchDayWriteError("목적지 변경", target, error));
        return;
      }
      setActionError(null);
    } catch (e) {
      setActionError(formatLunchDayWriteError("목적지 변경", target, { message: thrownMessage(e) }));
    } finally {
      setDayBusy(false);
    }
  }

  async function setVisit(input: VisitInput) {
    const target = input.status === "skipped" ? "단체 점심 안 함" : (input.name ?? "매장");
    setDayBusy(true);
    try {
      const { error } = await supabase.from("lunch_days").upsert(
        {
          date: todayKey,
          visit_status: input.status,
          visited_id: input.id,
          visited_name: input.name,
          visited_at: new Date().toISOString(),
        },
        { onConflict: "date" },
      );
      if (error) {
        setActionError(formatLunchDayWriteError("방문 기록", target, error));
        return;
      }
      setActionError(null);
    } catch (e) {
      setActionError(formatLunchDayWriteError("방문 기록", target, { message: thrownMessage(e) }));
    } finally {
      setDayBusy(false);
    }
  }

  async function respin() {
    setRespinning(true);
    try {
      // service_role 함수가 results를 덮어쓰고, realtime UPDATE로 휠이 다시 돈다.
      // 세 번째 값은 supabase-js 가 non-2xx 에서 던진 에러의 context 와 같은 미독 Response 다 —
      // 라이브러리가 본문을 읽기 전에 던지므로 여기서 정확히 한 번 읽을 수 있다.
      const { data, error, response } = await supabase.functions.invoke<RespinResponse>("respin-roulette");
      if (error) {
        // 본문이 JSON 이 아닐 수 있다(게이트웨이 HTML). 두 번째 예외가 나면 배너가 통째로 사라지므로 값으로 받는다.
        const body: unknown = response ? await response.json().catch(() => null) : null;
        const fallback = error instanceof Error ? error.message : String(error);
        setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, body)}`);
        return;
      }
      if (data?.skipped) {
        // 두 코드값은 함수가 보낸 그대로다(supabase/functions/_shared/edgeImports.test.ts 가 양쪽을 고정한다).
        const reason =
          data.skipped === "no_candidates"
            ? "후보가 없어요"
            : data.skipped === "all_paused"
              ? "후보가 전부 이번 주 쉬기 중이에요"
              : data.skipped;
        setActionError(`다시 돌리기 건너뜀: ${reason}`);
        return;
      }
      setActionError(null);
    } catch (e) {
      // invoke() 는 던지지 않고 본문 파싱 거부도 .catch 가 흡수하지만, 예상 밖 throw 가 여기서
      // 빠져나가면 배너 없는 unhandled rejection 이 되어 사용자는 "아무 일도 없는 화면" 만 본다.
      // 쓰기 실패이므로 actionError 다 — loadError 와 합치지 않는다(쓰기 성공이 읽기 실패를 지운다).
      const fallback = e instanceof Error ? e.message : String(e);
      setActionError(`다시 돌리기 실패: ${formatRespinError(fallback, null)}`);
    } finally {
      setRespinning(false);
    }
  }

  const clockTime = formatHhMmSs(now);
  const headline = phaseHeadline(shownPhase, todayResult?.menu);
  const subhead = phaseSubhead(
    shownPhase,
    todayCandidates.length,
    spinTimeText,
    todayResult?.menu,
    // 목적지가 1순위와 다른 날만 넘긴다 — 같은 날은 당첨 이름이 곧 갈 곳이다.
    destination !== null && !isDefault ? destination.name : undefined,
  );

  // 페이지 쿼리 하나(loadError)에 훅 셋의 실패·경고를 렌더 시점에 합친다. 훅 쪽은 각자가 소유하므로
  // 닫기 버튼(setLoadError(null))으로 사라지지 않는다. 컷오버(Phase 8) 전 라이브에는 매장·후보·설정
  // 세 테이블이 아직 없어 그 세 조각이 함께 뜨는 것이 정상이고, 오히려 배너가 안 뜨면 에러를 삼키고
  // 있다는 신호다. 파싱 경고는 이미 완성된 문장이라 접두를 붙이지 않고 그대로 싣는다.
  const loadBanner = joinLoadErrors([
    loadError,
    formatLoadError("매장 카탈로그", restaurantsError ? { message: restaurantsError } : null),
    formatLoadError("오늘 후보", candidatesError ? { message: candidatesError } : null),
    formatLoadError("설정", settingsError ? { message: settingsError } : null),
    formatLoadError("이번 주 기록", week.error ? { message: week.error } : null),
    settingsWarning,
  ]);

  return (
    <>
      <TopBar
        active="today"
        candidateCount={todayCandidates.length}
        phase={shownPhase}
        clockTime={clockTime}
      />

      <main className="wrap" style={{ flex: 1 }}>
        <div className="l-page-head">
          <div>
            <div className="micro" style={{ marginBottom: 8 }}>
              {formatKstLongDay(now)}
            </div>
            <h1 style={pageHeadStyles.h1}>{headline}</h1>
            <div style={pageHeadStyles.sub}>{subhead}</div>
          </div>
          <PhaseTimeline current={shownPhase} spinTime={settings.spinTime} />
        </div>

        <ErrorBanner message={loadBanner} onCloseAction={() => setLoadError(null)} />
        <ErrorBanner message={actionError} onCloseAction={() => setActionError(null)} />

        <div className="l-cols-today" style={layoutStyles.cols}>
          <div style={layoutStyles.left}>
            <div className="card" style={layoutStyles.stage}>
              <StageHeader phase={shownPhase} />
              <div className="l-wheel-holder" style={layoutStyles.wheelHolder}>
                <Wheel
                  items={wheelItems}
                  phase={wheelPhase}
                  winnerIndex={winnerIndex}
                  size={460}
                  spinTimeText={spinTimeText}
                />
              </div>
              <ResultBlock
                phase={shownPhase}
                poolCount={poolCount}
                winner={winner}
                backups={backups}
                spinTimeText={spinTimeText}
              />
              {/* 결과 카드와 같은 가림(shownPhase) — 다시 돌리기의 5초 동안 새 목적지를 먼저 말하지 않는다. */}
              {shownPhase === "decided" && todayResult && destination !== null && (
                <DestinationCard
                  destination={destination}
                  next={next}
                  isDefault={isDefault}
                  ranking={todayResult.ranking ?? []}
                  locations={locations}
                  visit={visit}
                  busy={dayBusy}
                  onSetDestinationAction={setDestination}
                  onSetVisitAction={setVisit}
                />
              )}
              {phase === "decided" && todayResult && (
                <div style={respinStyles.wrap}>
                  <button
                    type="button"
                    onClick={respin}
                    disabled={respinning || forceSpin}
                    style={respinStyles.button}
                  >
                    {respinning || forceSpin ? "다시 돌리는 중…" : "🎲 다시 돌리기"}
                  </button>
                  <span style={respinStyles.hint}>전체 순위를 새로 뽑아 모두에게 반영돼요</span>
                </div>
              )}
            </div>
          </div>

          <div style={layoutStyles.right}>
            <CandidateList
              candidates={todayCandidates}
              catalog={catalog}
              excluded={excluded}
              wheelCount={wheelItems.length}
              allExcluded={allExcluded}
              status={listStatus}
              phase={phase}
              spinTimeText={spinTimeText}
              onAddAction={addCandidate}
              onRemoveAction={removeCandidate}
            />
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

// 시계를 두지 않는다 — 상단 바가 이미 보여 주고, 같은 값이 세 곳에 있으면 눈이 셋을 다 읽는다.
function StageHeader({ phase }: { phase: Phase }) {
  const { label, dot } = ((): { label: string; dot: string } => {
    switch (phase) {
      case "accepting":
        return { label: "후보 접수중", dot: "live" };
      case "spinning":
        return { label: "룰렛 회전중", dot: "spin" };
      case "decided":
        return { label: "오늘의 결과", dot: "done" };
      case "stalled":
        return { label: "추첨 대기중", dot: "live" };
      default: {
        // 유니온에 상태가 더 늘면 이 대입이 컴파일 에러가 된다. 이 자리가 갱신을 강제당하는 지점.
        const exhaustive: never = phase;
        return exhaustive;
      }
    }
  })();
  return (
    <div style={stageStyles.header}>
      <span style={{ color: "var(--ink)", fontWeight: 600, fontSize: 13 }}>{label}</span>
      <span className={`dot ${dot}`} />
    </div>
  );
}

function Footer() {
  return (
    <footer style={footerStyles.wrap}>
      <div className="wrap" style={footerStyles.inner}>
        <span>점심 룰렛 · v0.1 · 결과는 매일 자정에 초기화돼요</span>
      </div>
    </footer>
  );
}

function thrownMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function phaseHeadline(phase: Phase, winnerName?: string) {
  if (phase === "accepting") return "오늘 점심 뭐 먹지?";
  if (phase === "spinning") return "운명의 카운트다운…";
  if (phase === "decided" && winnerName) return "오늘은 이거예요.";
  if (phase === "stalled") return "아직 안 정해졌어요.";
  return "오늘의 점심";
}

// 시각을 인자로 받는다. 기본값을 두면 설정을 넘기지 않은 호출부가 조용히 옛 시각을 그리게 된다(SPIN-06).
function phaseSubhead(
  phase: Phase,
  count: number,
  spinTimeText: string,
  winnerName?: string,
  destinationName?: string,
) {
  if (phase === "accepting")
    return `현재 ${count}개 매장이 룰렛에 올라가 있어요. ${spinTimeText}에 자동으로 결정돼요.`;
  // 다시 돌리기의 회전에도 같은 문장이 걸리므로 시작 시각을 말하지 않는다 — 13시의 재추첨에 "11:55에 시작되어" 는 거짓이다.
  if (phase === "spinning") return "약 5초 뒤에 결과가 나와요.";
  // 목적지가 바뀐 날은 당첨 대신 갈 곳을 말한다 — 머리글이 당첨만 말하면 카드와 머리글이 다른 매장을 가리킨다.
  if (phase === "decided" && destinationName) return `"오늘 갈 곳: ${destinationName}" · 결과는 자정에 초기화됩니다.`;
  // "더는 변경할 수 없어요" 를 지웠다 — 다시 돌리기가 있는 한 거짓이다.
  if (phase === "decided" && winnerName) return `"${winnerName}" · 결과는 자정에 초기화됩니다.`;
  if (phase === "stalled")
    return `추첨 시각이 지났지만 결과가 없어요. 현재 ${count}개 매장이 올라가 있어요.`;
  return "";
}

// 머리 영역의 배치(제목 옆 타임라인 ↔ 아래 타임라인)는 app/globals.css 의 l-page-head 가 가진다.
const pageHeadStyles = {
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 6px",
  },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;

const layoutStyles = {
  // 격자(2단 ↔ 1단)는 l-cols-today 가 가진다. 여기에 display·gridTemplateColumns 를 다시 적으면
  // inline 이 이겨 휴대폰에서도 2단으로 남는다.
  cols: { paddingBottom: 56 },
  left: { display: "flex", flexDirection: "column", gap: 16 },
  right: { display: "flex", flexDirection: "column", gap: 16 },
  stage: {
    padding: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  wheelHolder: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background:
      "radial-gradient(circle at center, oklch(0.99 0.005 80) 0%, oklch(0.965 0.006 80) 70%)",
  },
} satisfies Record<string, CSSProperties>;

const stageStyles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--line)",
    background: "white",
  },
} satisfies Record<string, CSSProperties>;

const respinStyles = {
  wrap: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px 12px",
    padding: "14px 26px 18px",
    borderTop: "1px solid var(--line)",
    background: "white",
  },
  button: {
    appearance: "none",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--bg-soft)",
    color: "var(--ink)",
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    cursor: "pointer",
  },
  hint: { color: "var(--muted)", fontSize: 12.5 },
} satisfies Record<string, CSSProperties>;

const footerStyles = {
  wrap: {
    borderTop: "1px solid var(--line)",
    padding: "16px 0",
    background: "var(--bg)",
  },
  inner: {
    color: "var(--muted)",
    fontSize: 12,
  },
} satisfies Record<string, CSSProperties>;
