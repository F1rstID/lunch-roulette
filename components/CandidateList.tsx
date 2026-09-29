"use client";

// 오늘 후보 카드 — 이름 필터 · 카탈로그 전체를 담은 단일 목록 · 행 끝 토글 · 페이즈 잠금 · 빈 상태 3종 · 푸터.
// 두 섹션이 아니라 목록 하나로 그리는 이유: 담기와 빼기가 한 동작(토글)이고, 목록이 둘이면 같은 매장이
// 두 곳에 있는 것처럼 읽힌다. 담긴 매장이 휠 순서로 위에 올라가 "오늘 무엇이 올라갔나" 가 한눈에 보인다.
// 낙관적 업데이트를 하지 않는 이유: 행이 위아래로 옮겨가는 것 자체가 Realtime 피드백이고, 화면 갱신 경로를
// 구독 하나로 유지해야 두 사람이 동시에 담았을 때도 목록이 갈라지지 않는다.
// 📌 가 버튼이 아니라 표시인 이유: 고정 토글은 매장 탭 한 곳에만 둔다 — 같은 상태를 두 화면에서 바꾸면
// 어느 쪽이 최근인지 사용자가 추적해야 한다.
// 잠금이 추첨 대기 상태를 포함하지 않는 이유: 후보가 없어 추첨이 건너뛰어진 날에도 담을 수 있어야 한다.
// 이 컴포넌트는 데이터 클라이언트를 한 번도 부르지 않는다 — 목록은 props 로 받고 쓰기는 ~Action 콜백으로
// 페이지에 올린다(레포 전역 규칙).

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { listTodayRows, type TodayCandidate, type TodayRow } from "@/lib/candidates";
import { SLICE_COLORS } from "@/lib/colors";
import { isCandidateListLocked, type Phase } from "@/lib/phase";
// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 데이터 클라이언트가
// 로드되지 않는다 — 이 파일이 환경변수 없이도 정적 검사를 받을 수 있는 근거다.
import type { RestaurantRow } from "@/lib/supabase/client";

// 행에 한 줄로 미리 보일 메뉴 개수. 칩보다 짧아야 하는 자리라 칩 쪽 상한과 값을 공유하지 않는다 —
// 여기는 훑어보기용 한 줄이고 전체 목록은 매장 탭에서 본다.
const ROW_MENU_PREVIEW = 3;

// 목록 영역이 무엇을 그릴지 정하는 세 상태. 빈 배열 하나로는 "아직 못 읽었다"·"못 읽었다"·"정말 0개" 가
// 구분되지 않아 세 경우가 전부 등록 권유 문구로 뭉개진다(05 WR-03). 매장 탭과 같은 뜻의 유니온이지만
// 컴포넌트끼리 import 하는 전례가 레포에 없어 각자 선언한다.
type ListStatus = "loading" | "failed" | "ready";

type Props = {
  // 오늘 담긴 매장. 순서가 곧 휠 순서다.
  candidates: TodayCandidate[];
  // 이미 정렬된 카탈로그 전체. 정렬 규칙은 페이지가 한 번만 적용한다.
  catalog: RestaurantRow[];
  status: ListStatus;
  phase: Phase;
  // 설정에서 온 추첨 시각 문구. 기본값을 두지 않는다 — 두면 시각이 다시 이 파일에 숨는다.
  spinTimeText: string;
  // name 은 실패 메시지에 쓸 표시용. 페이지가 목록을 다시 뒤지지 않게 여기서 넘긴다.
  onAddAction: (id: string, name: string) => Promise<boolean>;
  onRemoveAction: (id: string, name: string) => Promise<boolean>;
};

export function CandidateList({
  candidates,
  catalog,
  status,
  phase,
  spinTimeText,
  onAddAction,
  onRemoveAction,
}: Props) {
  const [query, setQuery] = useState("");
  // 토글이 도는 동안 재클릭을 무시할 행들. 낙관적 업데이트가 없어 두 번째 클릭도 화면에 남아 있는 같은
  // 상태를 읽으므로, 막지 않으면 두 요청이 같은 방향으로 나간다(05 IN-04 전례).
  // 단일 슬롯이 아니라 집합인 이유: 행 A 가 도는 중에 행 B 를 누르면 슬롯 방식은 A 를 덮고, 먼저 끝난
  // A 의 finally 가 아직 진행 중인 B 의 진행 표시를 지운다. 사람이 두 행을 연달아 누르는 것은 흔하다.
  // 갱신은 항상 새 Set 으로 한다 — 같은 객체를 mutate 하면 참조가 그대로라 React 가 리렌더하지 않는다.
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());

  const readOnly = isCandidateListLocked(phase);
  // useMemo 로 감싸지 않는다: 행 수가 수십 개라 비용이 무시할 만하다. "감싸도 얻는 것이 없다" 는 아니다 —
  // candidates·catalog 는 페이지가 메모해 넘긴 안정 참조이고 query 는 의존성 셋 중 하나일 뿐이라,
  // [candidates, catalog, query] 로 감싸면 매초 tick 렌더(부모의 ~Action 이 매 렌더 새 함수라 이 컴포넌트는
  // 매초 다시 그려진다)에서 재계산이 실제로 준다. 카탈로그가 수백 행이 되면 그때 감싼다.
  // 판단은 순수 함수가 끝냈고 여기서는 부르기만 한다.
  const rows = listTodayRows(candidates, catalog, query);

  return (
    <div className="card" style={s.card}>
      <header style={s.header}>
        <div>
          <div style={s.title}>오늘의 후보</div>
          <div style={s.subtle}>
            {readOnly
              ? `${candidates.length}개 매장 · 마감됨`
              : `${candidates.length}개 매장 · ${spinTimeText}까지 담기`}
          </div>
        </div>
        <div className="mono" style={s.counter}>
          {String(candidates.length).padStart(2, "0")}
        </div>
      </header>

      <div style={s.filter}>
        {/* 잠금 중에도 쓸 수 있게 둔다 — 담지 못하는 것과 훑어보지 못하는 것은 다르다.
            길이 상한을 걸지 않는 이유는 매장 탭 폼과 같다(브라우저는 코드유닛으로 세고 DB 는
            코드포인트로 센다). 여기는 아예 저장되지 않는 값이라 더욱 막을 이유가 없다. */}
        <input
          type="text"
          aria-label="매장 이름 찾기"
          placeholder="매장 이름으로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={s.input}
        />
      </div>

      {/* 실패에는 아무것도 그리지 않는다 — 이유는 페이지 배너가 이미 말했고, 여기서 무언가를 권하면
          다시 실패할 시도로 사용자를 떠민다(05 WR-03). */}
      {status !== "failed" && (
        <ul style={s.list}>
          {/* 로드 중에는 안내 문구만 둔다 — 문구는 매장 탭(RestaurantList)과 같은 것을 쓴다. */}
          {status === "loading" && (
            <li style={s.empty}>
              <div style={s.emptyText}>불러오는 중…</div>
            </li>
          )}
          {status === "ready" && catalog.length === 0 && (
            <li style={s.empty}>
              <div style={s.emptyIllu}>
                <div style={s.emptyDot} />
                <div style={s.emptyDot} />
                <div style={s.emptyDot} />
              </div>
              <div style={s.emptyText}>
                등록된 매장이 없어요.
                <br />
                매장 탭에서 먼저 등록해 주세요.
              </div>
              <Link href="/restaurants" style={s.emptyLink}>
                매장 탭으로
              </Link>
            </li>
          )}
          {status === "ready" && catalog.length > 0 && rows.length === 0 && (
            <li style={s.empty}>
              <div style={s.emptyText}>{`"${query}" 에 맞는 매장이 없어요`}</div>
            </li>
          )}
          {/* 행은 status 가 ready 일 때만 그린다. 두 훅이 따로 도착하므로 카탈로그가 먼저 오고 후보가
              아직 안 온 수백 ms 동안에는 모든 매장이 "안 담김 + 담기 버튼 활성" 으로 보인다 — 헤더
              카운터 00 과 함께 스치는 거짓 화면이고, 그때 담긴 매장을 다시 담으면 23505 가 성공으로
              흡수돼 사용자는 자기가 무엇을 눌렀는지도 모른다. 이 가드가 곧 토글 비활성이다(행 자체가
              없으므로 CandidateRowView 에 status 를 또 넘겨 죽은 분기를 만들지 않는다). */}
          {status === "ready" &&
            rows.map((row) => (
              <CandidateRowView
                key={row.restaurant.id}
                row={row}
                readOnly={readOnly}
                busy={busyIds.has(row.restaurant.id)}
                onToggle={async () => {
                  const { id, name } = row.restaurant;
                  // 행 단위로 잠근다 — 다른 행의 토글은 그대로 눌릴 수 있어야 한다.
                  if (busyIds.has(id)) return;
                  setBusyIds((prev) => new Set(prev).add(id));
                  try {
                    // 성공·실패 어느 쪽에서도 목록을 직접 건드리지 않는다. 갱신은 구독이 한다.
                    await (row.slice !== null ? onRemoveAction(id, name) : onAddAction(id, name));
                  } finally {
                    // 자기 행만 뺀다. 함수형 갱신이라 그 사이 다른 행이 들어와도 함께 지워지지 않는다.
                    setBusyIds((prev) => {
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    });
                  }
                }}
              />
            ))}
        </ul>
      )}

      <footer style={s.footer}>
        <span className="micro">규칙</span>
        <span style={s.footerText}>
          {`${spinTimeText}에 룰렛이 자동으로 돌아가요 · 📌 고정 매장은 매일 자정 자동으로 담겨요 · `}
          <Link href="/restaurants" style={s.footerLink}>
            매장 등록·수정은 매장 탭에서
          </Link>
        </span>
      </footer>
    </div>
  );
}

function CandidateRowView({
  row,
  readOnly,
  busy,
  onToggle,
}: {
  row: TodayRow;
  readOnly: boolean;
  busy: boolean;
  // 파일 내부 전용 컴포넌트라 ~Action 접미사를 붙이지 않는다(경계를 넘지 않으므로 lint 대상이 아니다).
  onToggle: () => void;
}) {
  // 지역 변수로 받아야 아래 렌더에서 숫자로 좁혀진다.
  const slice = row.slice;
  const picked = slice !== null;
  const shown = row.restaurant.menus.slice(0, ROW_MENU_PREVIEW);
  const hidden = row.restaurant.menus.length - shown.length;
  const menuSummary =
    shown.length === 0 ? "메뉴 미등록" : hidden > 0 ? `${shown.join(" · ")} +${hidden}` : shown.join(" · ");
  const disabled = readOnly || busy;

  return (
    <li style={{ ...s.row, opacity: picked ? 1 : 0.62 }}>
      {/* 배지 색은 휠 조각과 같은 매핑을 쓴다 — 목록의 번호와 휠의 조각이 같은 매장을 가리켜야 한다. */}
      {slice !== null ? (
        <span
          className="mono"
          style={{ ...s.idx, background: SLICE_COLORS[slice % SLICE_COLORS.length] }}
        >
          {String(slice + 1).padStart(2, "0")}
        </span>
      ) : (
        <span style={s.idxBlank} />
      )}
      <div style={s.main}>
        <div style={s.name}>{row.restaurant.name}</div>
        <div style={s.meta}>{menuSummary}</div>
      </div>
      {row.restaurant.pinned && (
        <span style={s.pin} title="고정 매장 — 매일 자정 자동으로 담겨요">
          📌
        </span>
      )}
      <button
        type="button"
        aria-pressed={picked}
        aria-label={`${row.restaurant.name} ${picked ? "빼기" : "담기"}`}
        disabled={disabled}
        onClick={onToggle}
        style={{
          ...s.toggle,
          background: picked ? "var(--bg-soft)" : "var(--ink)",
          color: picked ? "var(--ink-soft)" : "var(--panel)",
          borderColor: picked ? "var(--line)" : "transparent",
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {picked ? "빼기" : "담기"}
      </button>
    </li>
  );
}

const s = {
  card: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 20px 14px",
    borderBottom: "1px solid var(--line)",
  },
  title: { fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" },
  subtle: { fontSize: 12.5, color: "var(--muted)", marginTop: 2 },
  counter: {
    fontSize: 22,
    fontWeight: 600,
    color: "var(--ink)",
    padding: "2px 10px",
    background: "var(--bg-soft)",
    borderRadius: 8,
    letterSpacing: "-0.02em",
  },
  filter: {
    padding: "14px 20px",
    borderBottom: "1px solid var(--line-soft)",
  },
  input: {
    width: "100%",
    height: 38,
    padding: "0 12px",
    border: "1px solid var(--line)",
    borderRadius: 9,
    fontSize: 14,
    outline: "none",
    background: "var(--panel)",
    color: "var(--ink)",
    transition: "border-color .12s, box-shadow .12s",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    maxHeight: 420,
    overflowY: "auto",
  },
  empty: {
    padding: "32px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    textAlign: "center",
  },
  emptyIllu: { display: "flex", gap: 6 },
  emptyDot: { width: 6, height: 6, borderRadius: 3, background: "var(--line)" },
  emptyText: { color: "var(--muted)", fontSize: 13 },
  emptyLink: { color: "var(--accent-ink)", fontSize: 13, fontWeight: 600 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 20px",
    borderBottom: "1px solid var(--line-soft)",
    animation: "fade-up .2s ease-out both",
    transition: "opacity .12s",
  },
  idx: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--ink)",
    border: "1px solid var(--line-soft)",
    flexShrink: 0,
  },
  idxBlank: { width: 28, height: 28, flexShrink: 0 },
  main: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14.5,
    fontWeight: 600,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  meta: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pin: { fontSize: 13, lineHeight: 1, flexShrink: 0 },
  toggle: {
    appearance: "none",
    border: "1px solid var(--line)",
    height: 28,
    padding: "0 12px",
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    flexShrink: 0,
    transition: "opacity .12s",
  },
  footer: {
    padding: "12px 20px",
    background: "var(--bg-soft)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  footerText: { color: "var(--ink-soft)", fontSize: 12.5 },
  footerLink: { color: "var(--accent-ink)" },
} satisfies Record<string, CSSProperties>;
