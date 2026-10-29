"use client";

// 오늘 갈 곳 카드 — 목적지(순위 배지·지도) · "웨이팅 있어요 → 다음 식당" · 되돌리기 · "어디서 먹었나요?" 방문 확인.
// 결과 카드(ResultBlock) 아래, 다시 돌리기 위에 decided 에만 놓인다. 결과 카드가 "무엇이 뽑혔나" 를, 이 카드가 "그래서
// 어디 가나·어디 갔나" 를 말한다 — 둘을 합치면 추첨 결과(불변)와 팀의 선택(가변)이 한 글자 크기로 섞인다.
// 이 컴포넌트는 데이터 클라이언트를 한 번도 부르지 않는다 — 판단은 lib/lunchDay.ts 가 끝낸 값을 props 로 받고, 쓰기는
// ~Action 콜백 둘로 페이지에 올린다(레포 전역 규칙). 낙관적 업데이트도 없다: 누른 뒤 화면은 lunch_days Realtime 으로만
// 바뀐다 — 그래야 다른 탭과 같은 순간에 같은 목적지를 본다("모두에게 같이 보여요" 가 그 약속이다).
// 방문 확인은 13시 제한이 없다 — 식당에 앉은 사람이 그때 누른다. 저장 뒤 요약 한 줄로 접히고 "수정" 이 다시 펼친다.
// 그 펼침 상태는 "어느 요약을 보고 눌렀나" 로 들고 있어서, 다른 사람의 저장이 도착해 요약이 바뀌면 자동으로 접힌다 —
// effect 로 상태를 되돌리는 대신 파생으로 끝낸다.

import { useState, type CSSProperties } from "react";
import { mapHref, parseOtherVisitName, type Destination, type VisitSummary } from "@/lib/lunchDay";
import { MENU_NAME_MAX_LEN } from "@/lib/constants";

export type VisitInput = { status: "visited" | "skipped"; id: string | null; name: string | null };

type Props = {
  destination: Destination;
  // 다음 순위 매장. null 이면 마지막 순위라 버튼을 그리지 않는다.
  next: { id: string; name: string } | null;
  // 목적지가 1순위(당첨)인가. 아니면 되돌리기를 보인다.
  isDefault: boolean;
  // 방문 확인 버튼 줄의 재료 — 추첨이 정한 순서 그대로.
  ranking: { restaurant_id: string; name: string }[];
  // id → 카탈로그 위치. 지도 버튼이 링크면 그 링크, 아니면 이름 검색으로 간다.
  locations: ReadonlyMap<string, string | null>;
  visit: VisitSummary;
  // 어느 쓰기든 도는 동안 모든 버튼을 잠근다 — 하루 한 행에 두 쓰기가 겹치면 뒤의 것이 앞의 것을 덮는다.
  busy: boolean;
  onSetDestinationAction: (id: string | null, name: string | null) => Promise<void>;
  onSetVisitAction: (visit: VisitInput) => Promise<void>;
};

export function DestinationCard({
  destination,
  next,
  isDefault,
  ranking,
  locations,
  visit,
  busy,
  onSetDestinationAction,
  onSetVisitAction,
}: Props) {
  // "수정" 을 누른 순간의 요약. 요약이 바뀌면(다른 사람의 저장 도착) 자동으로 접힌다.
  const visitKey = JSON.stringify(visit);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const editing = visit.kind === "unknown" || editingKey === visitKey;

  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [otherError, setOtherError] = useState<string | null>(null);

  async function submitOther() {
    const parsed = parseOtherVisitName(otherText);
    if (!parsed.ok) {
      setOtherError(parsed.message);
      return;
    }
    setOtherError(null);
    await onSetVisitAction({ status: "visited", id: null, name: parsed.name });
    setOtherOpen(false);
    setOtherText("");
  }

  const mapTarget = mapHref(destination.name, locations.get(destination.id ?? "") ?? null);

  return (
    <section style={s.wrap} aria-label="오늘 갈 곳">
      <div style={s.topLine}>
        <span className="micro" style={{ color: "var(--accent-ink)" }}>
          오늘 갈 곳
        </span>
        {/* 이름 없는 공통 상태라는 사실을 상시 말한다 — 누가 바꿨는지는 기록하지 않는다(익명 서비스). */}
        <span style={s.caption}>모두에게 같이 보여요</span>
      </div>

      <div style={s.destRow}>
        <span style={s.destName}>{destination.name}</span>
        {destination.rank !== null && <span style={s.rankBadge}>{destination.rank}순위</span>}
        {/* 새 탭 + opener 차단을 함께 단다 — 위치 문자열은 다른 사용자가 넣은 값이다(LocationLink 와 같은 이유). */}
        <a href={mapTarget} target="_blank" rel="noopener noreferrer" className="l-tap" style={s.mapLink}>
          지도
        </a>
      </div>

      {(next !== null || !isDefault) && (
        <div style={s.actions}>
          {next !== null && (
            <button
              type="button"
              className="l-tap"
              disabled={busy}
              onClick={() => onSetDestinationAction(next.id, next.name)}
              style={{ ...s.primaryButton, opacity: busy ? 0.5 : 1 }}
            >
              웨이팅 있어요 → {next.name}로
            </button>
          )}
          {!isDefault && (
            <button
              type="button"
              className="l-tap"
              disabled={busy}
              onClick={() => onSetDestinationAction(null, null)}
              style={{ ...s.ghostButton, opacity: busy ? 0.5 : 1 }}
            >
              1순위로 되돌리기
            </button>
          )}
        </div>
      )}

      <div style={s.visitSection}>
        <div className="micro" style={s.visitLabel}>
          어디서 먹었나요?
        </div>
        {editing ? (
          <>
            <div style={s.actions}>
              {ranking.map((entry, index) => (
                <button
                  key={entry.restaurant_id}
                  type="button"
                  className="l-tap"
                  disabled={busy}
                  onClick={() => onSetVisitAction({ status: "visited", id: entry.restaurant_id, name: entry.name })}
                  style={{ ...s.ghostButton, opacity: busy ? 0.5 : 1 }}
                >
                  <span style={s.buttonRank}>{index + 1}순위</span> {entry.name}
                </button>
              ))}
              <button
                type="button"
                className="l-tap"
                disabled={busy}
                aria-expanded={otherOpen}
                onClick={() => setOtherOpen((open) => !open)}
                style={{ ...s.ghostButton, opacity: busy ? 0.5 : 1 }}
              >
                다른 매장
              </button>
              <button
                type="button"
                className="l-tap"
                disabled={busy}
                onClick={() => onSetVisitAction({ status: "skipped", id: null, name: null })}
                style={{ ...s.ghostButton, opacity: busy ? 0.5 : 1 }}
              >
                단체 점심 안 함
              </button>
            </div>
            {otherOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitOther();
                }}
                style={s.otherForm}
              >
                {/* 길이 상한을 maxLength 로 걸지 않는다 — 브라우저는 코드유닛으로 세고 규칙은 코드포인트다(매장 탭 폼과 같다).
                    거부는 parseOtherVisitName 이 한다. */}
                <input
                  type="text"
                  aria-label="다른 매장 이름"
                  placeholder={`매장 이름 (${MENU_NAME_MAX_LEN}자까지)`}
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                  className="l-input"
                  style={s.otherInput}
                  autoFocus
                />
                <button type="submit" className="l-tap" disabled={busy} style={{ ...s.primaryButton, opacity: busy ? 0.5 : 1 }}>
                  저장
                </button>
                {otherError !== null && (
                  <div role="alert" style={s.otherError}>
                    {otherError}
                  </div>
                )}
              </form>
            )}
          </>
        ) : (
          <div style={s.summaryLine}>
            <span style={s.summaryText}>
              {visit.kind === "skipped" ? "오늘은 단체 점심 안 했어요" : `오늘은 ${visit.name}에서 먹었어요`}
            </span>
            <button type="button" className="l-tap" onClick={() => setEditingKey(visitKey)} style={s.linkButton}>
              수정
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const s = {
  wrap: {
    background: "white",
    borderTop: "1px solid var(--line)",
    padding: "16px 26px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  topLine: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  caption: { fontSize: 11.5, color: "var(--muted)" },
  // 이름 칸이 줄어들 수 있어야 띄어쓰기 없는 긴 이름이 꺾인다(keep-all 아래에서는 한 단어다).
  destRow: { display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "4px 10px" },
  destName: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", minWidth: 0 },
  rankBadge: {
    fontSize: 11.5,
    fontWeight: 600,
    color: "var(--accent-ink)",
    background: "var(--bg-soft)",
    border: "1px solid var(--line)",
    borderRadius: 6,
    padding: "1px 7px",
  },
  mapLink: { fontSize: 12.5, color: "var(--accent-ink)", fontWeight: 600 },
  // 좁은 폭에서는 버튼이 줄바꿈된다 — 폭 분기가 아니라 flex-wrap 이라 inline 에 둔다(l-* 는 폭 의존 속성에만 쓴다).
  actions: { display: "flex", flexWrap: "wrap", gap: 8 },
  primaryButton: {
    appearance: "none",
    border: "1px solid transparent",
    borderRadius: 9,
    background: "var(--ink)",
    color: "var(--panel)",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 14px",
    cursor: "pointer",
  },
  ghostButton: {
    appearance: "none",
    border: "1px solid var(--line)",
    borderRadius: 9,
    background: "var(--bg-soft)",
    color: "var(--ink)",
    fontSize: 13,
    fontWeight: 600,
    padding: "8px 12px",
    cursor: "pointer",
  },
  buttonRank: { color: "var(--muted)", fontWeight: 500, fontSize: 11.5 },
  // 보조 위계(13px, muted) — 결과·목적지보다 한 단 아래로 읽혀야 한다.
  visitSection: {
    marginTop: 4,
    paddingTop: 10,
    borderTop: "1px solid var(--line-soft)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  visitLabel: { color: "var(--muted)" },
  otherForm: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
  otherInput: {
    flex: "1 1 180px",
    height: 36,
    padding: "0 12px",
    border: "1px solid var(--line)",
    borderRadius: 9,
    outline: "none",
    background: "var(--panel)",
    color: "var(--ink)",
    minWidth: 0,
  },
  otherError: { flexBasis: "100%", fontSize: 12.5, color: "var(--red)" },
  summaryLine: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 10px" },
  summaryText: { fontSize: 13.5, color: "var(--ink-soft)" },
  linkButton: {
    appearance: "none",
    border: 0,
    background: "transparent",
    color: "var(--accent-ink)",
    fontSize: 12.5,
    fontWeight: 600,
    padding: "4px 2px",
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
