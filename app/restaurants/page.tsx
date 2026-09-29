"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatHhMmSs, formatKstLongDay, todayKstDate } from "@/lib/time";
import { currentPhase } from "@/lib/phase";
import { formatLoadError, formatRestaurantWriteError, joinLoadErrors } from "@/lib/errors";
import { sortRestaurants, type RestaurantInput } from "@/lib/restaurants";
import { useRestaurants } from "@/lib/useRestaurants";
import { useSettings } from "@/lib/useSettings";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/ErrorBanner";
import { RestaurantList } from "@/components/RestaurantList";

export default function RestaurantsPage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = todayKstDate(now);

  const { rows, error: catalogError } = useRestaurants();

  const [hasTodayResult, setHasTodayResult] = useState(false);
  // 마지막 쓰기(등록·수정·삭제·핀) 실패 메시지. 성공하면 지운다.
  const [actionError, setActionError] = useState<string | null>(null);
  // 초기 로드(SELECT) 실패 메시지. actionError 와 한 state 로 합치지 않는다 — 쓰기가 성공할 때마다
  // setActionError(null) 이 불리므로, 합치면 읽기 실패 메시지가 사용자 모르게 지워진다.
  const [loadError, setLoadError] = useState<string | null>(null);

  // 추첨 시각은 settings 가 정한다. 로드 전·실패 시에도 기본값(11:55)으로 계속 동작한다(SETT-03).
  const { settings, error: settingsError, warning: settingsWarning } = useSettings();

  const phase = currentPhase(now, settings.spinTime, hasTodayResult);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 오늘 결과의 존재만 본다. 0행은 에러가 아니라 data: null, error: null 로 온다(단일행 조회 거동).
      const { data, error } = await supabase
        .from("results")
        .select("date")
        .eq("date", todayKey)
        .maybeSingle();
      if (cancelled) return;
      setLoadError(formatLoadError("오늘 결과", error));
      setHasTodayResult(data !== null);
    })();
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  // 이 탭은 결과 테이블을 구독하지 않는다. 페이즈 필은 표시용이고 여기에는 잠금이 걸리지 않아서,
  // 탭을 열어 둔 채 추첨 시각이 지나면 필이 새로고침 전까지 "추첨 대기" 에 머무는 것이 전부다.
  // 구독을 하나 더 늘리면 얻는 것(필 갱신)보다 실패 경로가 늘어나는 비용이 크다.

  // 매초 리렌더되는 페이지라 정렬을 메모한다 — 감싸지 않으면 1초마다 목록 전체를 다시 정렬한다.
  const items = useMemo(() => sortRestaurants(rows), [rows]);

  // 아래 네 핸들러는 수동 memo 로 감싸지 않는다. 소비자(RestaurantList)가 memo 컴포넌트가 아니라
  // 참조 안정성의 이득이 없고, React Compiler lint(preserve-manual-memoization)가 async 핸들러의
  // 수동 memo 를 보존하지 못해 에러를 낸다(app/page.tsx:167-169 와 같은 논증).
  // 네 핸들러 모두 낙관적 업데이트를 하지 않는다 — 화면은 Realtime 이벤트로만 갱신된다.
  async function addRestaurant(input: RestaurantInput): Promise<boolean> {
    const { error } = await supabase
      .from("restaurants")
      .insert({ name: input.name, menus: input.menus, location: input.location });
    if (error) {
      setActionError(formatRestaurantWriteError("등록", input.name, error));
      return false;
    }
    setActionError(null);
    return true;
  }

  async function updateRestaurant(id: string, input: RestaurantInput): Promise<boolean> {
    const { error } = await supabase
      .from("restaurants")
      .update({ name: input.name, menus: input.menus, location: input.location })
      .eq("id", id);
    if (error) {
      setActionError(formatRestaurantWriteError("수정", input.name, error));
      return false;
    }
    setActionError(null);
    return true;
  }

  async function removeRestaurant(id: string, name: string): Promise<boolean> {
    // 오늘 후보·과거 결과에 대한 뒤처리를 하지 않는다 — 두 파급은 DB 의 외래키 규칙(0005)이 이미 처리한다.
    const { error } = await supabase.from("restaurants").delete().eq("id", id);
    if (error) {
      setActionError(formatRestaurantWriteError("삭제", name, error));
      return false;
    }
    setActionError(null);
    return true;
  }

  async function toggleRestaurantPin(id: string, name: string, currentlyPinned: boolean): Promise<boolean> {
    // 핀 컬럼 하나만 뒤집는다. 오늘 후보를 여기서 담지 않는 이유: 자정 재시드는 DB cron(0005) 몫이고,
    // 즉시 담기는 오늘 탭의 토글(Phase 6)이다.
    const { error } = await supabase
      .from("restaurants")
      .update({ pinned: !currentlyPinned })
      .eq("id", id);
    if (error) {
      setActionError(
        formatRestaurantWriteError(currentlyPinned ? "고정 해제" : "고정", name, error),
      );
      return false;
    }
    setActionError(null);
    return true;
  }

  // 설정 실패·경고는 훅이 소유하므로 닫기 버튼(setLoadError(null))으로 사라지지 않는다. 매장 목록 실패도
  // 같다 — 컷오버(Phase 8) 전에는 라이브에 매장 테이블이 없어 이 배너 + 빈 목록이 정상 상태다.
  // 파싱 경고는 이미 완성된 문장이라 접두를 붙이지 않는다.
  const loadBanner = joinLoadErrors([
    loadError,
    formatLoadError("매장 목록", catalogError ? { message: catalogError } : null),
    formatLoadError("설정", settingsError ? { message: settingsError } : null),
    settingsWarning,
  ]);

  return (
    <>
      <TopBar active="restaurants" phase={phase} clockTime={formatHhMmSs(now)} />
      <main className="wrap" style={{ flex: 1 }}>
        <div style={pageHeadStyles.head}>
          <div className="micro" style={{ marginBottom: 8 }}>
            {formatKstLongDay(now)}
          </div>
          <h1 style={pageHeadStyles.h1}>매장</h1>
          <div style={pageHeadStyles.sub}>
            룰렛에 올릴 가게를 여기에 모아 둬요 · 오늘 후보 담기는 오늘 탭에서
          </div>
        </div>

        <ErrorBanner message={loadBanner} onCloseAction={() => setLoadError(null)} />
        <ErrorBanner message={actionError} onCloseAction={() => setActionError(null)} />

        <RestaurantList
          items={items}
          onAddAction={addRestaurant}
          onUpdateAction={updateRestaurant}
          onRemoveAction={removeRestaurant}
          onTogglePinAction={toggleRestaurantPin}
        />
      </main>
    </>
  );
}

const pageHeadStyles = {
  head: { padding: "36px 0 24px" },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    margin: "0 0 6px",
  },
  sub: { color: "var(--muted)", fontSize: 14 },
} satisfies Record<string, CSSProperties>;
