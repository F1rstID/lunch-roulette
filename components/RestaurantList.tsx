"use client";

// 매장 카탈로그 카드 — 등록 폼 · 행 목록 · 인라인 편집 · 핀 토글 · 2단계 삭제 확인 · 빈 상태 · 푸터.
// 이 컴포넌트는 데이터 클라이언트를 한 번도 부르지 않는다: 목록은 props 로 받고 쓰기는 ~Action 콜백으로
// 페이지에 올린다(레포 전역 규칙). 그 덕에 화면 갱신 경로가 Realtime 하나로 유지된다.
// 수정을 행 인라인으로 고른 이유: 상단 폼을 편집 모드로 재사용하면 등록하려고 치던 입력을 잃고, 모달은
// 레포에 전례가 없는 새 패턴인 데다 목록 맥락(옆 매장들)이 가려진다.
// 삭제만 2단계 확인을 두는 이유: 카탈로그는 자정에 지워지지 않는 영구 데이터라 오늘 탭의 즉시 삭제 전례를
// 따르지 않는다. 브라우저 확인 대화상자는 쓰지 않는다 — 스타일 밖이고 자동화·테스트가 막힌다.
// 페이즈에 따른 잠금이 없는 이유: 매장 편집은 추첨 시각과 무관하다. 확정된 결과 행은 매장명 스냅샷이라
// 매장을 지워도 기록·랭킹은 무사하고, 그 사실을 삭제 확인 문구가 사람 말로 알린다.

import * as React from "react";
import { useRef, useState, type CSSProperties } from "react";
import { joinMenus, parseLocationLink, parseRestaurantForm, type RestaurantInput } from "@/lib/restaurants";
// 값이 아니라 타입만 쓴다. `import type` 문장은 트랜스파일에서 통째로 지워져 데이터 클라이언트가
// 로드되지 않는다 — 이 파일이 환경변수 없이도 정적 검사를 받을 수 있는 근거다.
import type { RestaurantRow } from "@/lib/supabase/client";

// 메뉴 입력창 자체의 상한. 원소 상한(24)과 별개다 — 쉼표로 여러 개를 한 줄에 쓰려면 입력창이 훨씬 길어야
// 한다(components/MenuList.tsx 의 INPUT_MAX_LEN 과 같은 논증).
const MENUS_INPUT_MAX_LEN = 120;

// 행에 그대로 펼칠 메뉴 칩 개수. 넘치면 "+n" 한 칸으로 접는다 — 메뉴가 스무 개인 매장 하나가 목록을
// 밀어내면 훑어보기라는 목적이 깨진다. 전체 목록은 칩 툴팁과 편집 폼에서 볼 수 있다.
const MENU_CHIP_LIMIT = 4;

// 목록 영역이 무엇을 그릴지 정하는 세 상태. 빈 배열 하나로는 "아직 못 읽었다"·"못 읽었다"·"정말 0개" 가
// 구분되지 않아, 세 경우가 전부 등록 권유 문구로 뭉개졌다(WR-03).
export type RestaurantListStatus = "loading" | "failed" | "ready";

type Props = {
  // 이미 정렬된 목록이다. 정렬 규칙은 페이지가 useMemo 로 한 번만 적용한다.
  items: RestaurantRow[];
  // 조회가 끝났는지·실패했는지. 훅이 이미 들고 있는 loaded·error 를 페이지가 여기로 넘긴다.
  status: RestaurantListStatus;
  // 네 콜백 모두 성공 여부를 돌려준다 — 폼이 입력을 비울지 보존할지를 그 값으로 정한다.
  onAddAction: (input: RestaurantInput) => Promise<boolean>;
  onUpdateAction: (id: string, input: RestaurantInput) => Promise<boolean>;
  // name 은 실패 메시지에 쓸 표시용. 페이지가 목록을 다시 뒤지지 않게 여기서 넘긴다.
  onRemoveAction: (id: string, name: string) => Promise<boolean>;
  // currentlyPinned = 클릭 시점의 상태. 핸들러가 이걸 뒤집어 한 번만 쓴다.
  onTogglePinAction: (id: string, name: string, currentlyPinned: boolean) => Promise<boolean>;
};

export function RestaurantList({
  items,
  status,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onTogglePinAction,
}: Props) {
  // 한 번에 한 행만 편집한다. 다른 행의 수정을 누르면 대상이 바뀌고 이전 초안은 버린다 — 여러 행을 동시에
  // 열어 두면 어느 폼이 저장됐는지 화면만 보고는 알 수 없다.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // 편집·삭제 확인 중인 행이 원격에서 지워지면 목록에서 빠지고 두 id 는 없는 행을 가리킨 채 남는다.
  // effect 로 되돌리지 않고 렌더 시점에 목록 멤버십으로 거른다: effect 안의 setState 는
  // react-hooks/set-state-in-effect 가 막는 패턴이고(components/Wheel.tsx 선례), 파생값으로 두면
  // stale id 가 남아도 그것을 보고 무언가를 그리는 일 자체가 생기지 않는다.
  const editing = editingId !== null && items.some((r) => r.id === editingId) ? editingId : null;
  const confirming = confirmingId !== null && items.some((r) => r.id === confirmingId) ? confirmingId : null;

  const pinnedCount = items.filter((r) => r.pinned).length;

  return (
    <div className="card" style={s.card}>
      <header style={s.header}>
        <div>
          <div style={s.title}>매장 카탈로그</div>
          <div style={s.subtle}>{`${items.length}개 매장 · 핀 ${pinnedCount}개`}</div>
        </div>
        <div className="mono" style={s.counter}>
          {String(items.length).padStart(2, "0")}
        </div>
      </header>

      <div style={s.createSlot}>
        <RestaurantForm mode="create" initial={EMPTY_DRAFT} onSubmit={onAddAction} />
      </div>

      <ul style={s.list}>
        {status === "loading" && (
          <li style={s.empty}>
            <div style={s.emptyText}>불러오는 중…</div>
          </li>
        )}
        {/* 실패에는 아무것도 그리지 않는다 — 이유는 페이지 배너가 이미 말했고, 여기서 등록을 권하면
            다시 실패할 시도로 사용자를 떠민다. 컷오버(Phase 8) 전 라이브에서는 테이블 자체가 없어
            그 조합이 상시 화면이 된다. 등록 권유는 "정말 0개" 일 때만 맞는 문장이다. */}
        {status === "ready" && items.length === 0 && (
          <li style={s.empty}>
            <div style={s.emptyText}>
              아직 등록된 매장이 없어요.
              <br />
              위에서 첫 매장을 등록해 보세요.
            </div>
          </li>
        )}
        {items.map((r) => (
          <li key={r.id} style={s.row}>
            {editing === r.id ? (
              // key 를 행 id 로 주는 것이 "편집 초안 유지" 의 근거다 — 같은 행에 Realtime 갱신이 와도
              // 폼이 다시 마운트되지 않아 치던 값이 남고, 저장이 마지막 쓰기로 덮는다.
              <RestaurantForm
                key={r.id}
                mode="edit"
                initial={{ name: r.name, menusText: joinMenus(r.menus), location: r.location ?? "" }}
                onSubmit={async (input) => {
                  const ok = await onUpdateAction(r.id, input);
                  if (ok) setEditingId(null);
                  return ok;
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : confirming === r.id ? (
              <DeleteConfirm
                onConfirm={async () => {
                  // 성공하든 실패하든 — 예상 밖 예외로 빠져나가더라도 — 확인 상태는 닫는다.
                  // 닫지 않으면 삭제도 취소도 못 하는 행이 목록에 남는다. 실패 문장은 페이지 배너가 띄운다.
                  try {
                    await onRemoveAction(r.id, r.name);
                  } finally {
                    setConfirmingId(null);
                  }
                }}
                onCancel={() => setConfirmingId(null)}
              />
            ) : (
              <RestaurantRowView
                row={r}
                onEdit={() => {
                  setConfirmingId(null);
                  setEditingId(r.id);
                }}
                onAskRemove={() => {
                  setEditingId(null);
                  setConfirmingId(r.id);
                }}
                onTogglePin={() => onTogglePinAction(r.id, r.name, r.pinned)}
              />
            )}
          </li>
        ))}
      </ul>

      <footer style={s.footer}>
        <span className="micro">규칙</span>
        <span style={s.footerText}>
          📌 고정한 매장은 매일 자정 오늘 후보에 자동으로 담겨요 · 오늘 후보 담기는 오늘 탭에서
        </span>
      </footer>
    </div>
  );
}

type Draft = { name: string; menusText: string; location: string };

const EMPTY_DRAFT: Draft = { name: "", menusText: "", location: "" };

function RestaurantForm({
  mode,
  initial,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: Draft;
  // 파일 내부 전용 컴포넌트라 ~Action 접미사를 붙이지 않는다(경계를 넘지 않으므로 lint 대상이 아니다).
  onSubmit: (input: RestaurantInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [menusText, setMenusText] = useState(initial.menusText);
  const [location, setLocation] = useState(initial.location);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const parsed = parseRestaurantForm({ name, menusText, location });
    if (!parsed.ok) {
      // 검증 실패는 페이지 배너로 보내지 않는다 — 쓰기 실패가 아니고, 고쳐야 할 입력 칸 바로 옆에 있어야
      // 사용자가 어디를 손볼지 안다.
      setFormError(parsed.message);
      return;
    }
    setFormError(null);
    setBusy(true);
    let ok = false;
    try {
      ok = await onSubmit(parsed.input);
    } catch (e) {
      // 콜백은 실패를 boolean 으로 돌려주는 규약이지만, 예상 밖 throw 가 여기서 빠져나가면 busy 가
      // 참으로 갇혀 버튼이 영원히 잠기고 예외는 배너 없는 unhandled rejection 이 된다
      // (app/page.tsx:236-244 가 같은 이유로 try/catch/finally 를 둔다).
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      // 성공·실패·예외 어느 쪽이든 버튼은 다시 눌릴 수 있어야 한다.
      setBusy(false);
    }
    // 실패하면 입력을 그대로 둔다. 다시 치게 만들면 사용자는 같은 값을 두 번 입력한다.
    if (!ok) return;
    if (mode === "create") {
      setName("");
      setMenusText("");
      setLocation("");
      nameRef.current?.focus();
    }
    // 편집 모드의 닫기는 부모가 한다 — 편집 중인 행이 누구인지는 목록이 알고 폼은 모른다.
  }

  const canSubmit = name.trim().length > 0 && !busy;

  return (
    <form onSubmit={submit} style={mode === "create" ? s.formCreate : s.formEdit}>
      <div style={s.fields}>
        {/* 이름·위치에 maxLength 를 걸지 않는다: HTML maxlength 는 UTF-16 코드유닛이라 이모지 하나를
            2로 세고, DB·parseRestaurantForm 은 코드포인트로 센다. 코드유닛으로 막으면 DB 가 허용하는
            24 코드포인트 이름("가"×23 + 🍕)을 입력 단계에서 거부하고, 저장된 값이 상한을 넘는 행은
            편집 폼이 "지우기만 가능" 상태로 열린다. 초과 거절은 parseRestaurantForm 이 이유까지
            말해 주는 한 곳에서만 한다. */}
        <input
          ref={nameRef}
          type="text"
          placeholder="매장 이름 (필수)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ ...s.input, flex: "1 1 160px" }}
        />
        <input
          type="text"
          placeholder="메뉴 (선택) 예) 김치찌개, 제육"
          maxLength={MENUS_INPUT_MAX_LEN}
          value={menusText}
          onChange={(e) => setMenusText(e.target.value)}
          style={{ ...s.input, flex: "2 1 220px" }}
        />
        <input
          type="text"
          placeholder="위치 (선택) 주소 또는 링크"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={{ ...s.input, flex: "2 1 200px" }}
        />
        <div style={s.formButtons}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...s.primaryBtn,
              opacity: canSubmit ? 1 : 0.4,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {mode === "create" ? "등록" : "저장"}
          </button>
          {mode === "edit" && (
            <button type="button" onClick={onCancel} style={s.ghostBtn}>
              취소
            </button>
          )}
        </div>
      </div>
      {formError && (
        <div role="alert" style={s.formError}>
          {formError}
        </div>
      )}
    </form>
  );
}

function RestaurantRowView({
  row,
  onEdit,
  onAskRemove,
  onTogglePin,
}: {
  row: RestaurantRow;
  onEdit: () => void;
  onAskRemove: () => void;
  onTogglePin: () => void;
}) {
  // 링크 판정은 순수 모듈이 한다. 여기서는 값이 있으면 앵커, 없으면 텍스트라는 두 갈래만 그린다.
  const link = parseLocationLink(row.location);
  const shownMenus = row.menus.slice(0, MENU_CHIP_LIMIT);
  const hiddenCount = row.menus.length - shownMenus.length;
  const allMenus = joinMenus(row.menus);

  return (
    <div style={s.rowInner}>
      <div style={s.rowMain}>
        <div style={s.name}>{row.name}</div>
        {row.menus.length > 0 && (
          <div style={s.chips}>
            {shownMenus.map((menu) => (
              <span key={menu} title={allMenus} style={s.chip}>
                {menu}
              </span>
            ))}
            {hiddenCount > 0 && (
              <span title={allMenus} style={s.chipMore}>
                {`+${hiddenCount}`}
              </span>
            )}
          </div>
        )}
        {row.location && (
          <div style={s.meta}>
            {link ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" style={s.link}>
                {link.host}
              </a>
            ) : (
              <span>{row.location}</span>
            )}
          </div>
        )}
      </div>
      <PinButton pinned={row.pinned} onToggle={onTogglePin} />
      <button type="button" aria-label="수정" title="수정" onClick={onEdit} style={s.editBtn}>
        수정
      </button>
      <button type="button" aria-label="삭제" title="삭제" onClick={onAskRemove} style={s.del}>
        ✕
      </button>
    </div>
  );
}

function PinButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={pinned ? "고정 해제" : "고정"}
      aria-pressed={pinned}
      title={pinned ? "고정 해제" : "고정 — 매일 자정 자동으로 오늘 후보에 담겨요"}
      onClick={onToggle}
      style={{
        ...s.pin,
        opacity: pinned ? 1 : 0.32,
        background: pinned ? "var(--accent-soft)" : "transparent",
      }}
    >
      📌
    </button>
  );
}

function DeleteConfirm({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    // 파급(오늘 후보에서 빠짐 · 과거 기록은 남음)을 코드가 아니라 문구로 드러낸다 — 그 처리는 DB 의 외래키
    // 규칙이 이미 하고 있고, 사용자가 알아야 하는 것은 규칙 이름이 아니라 결과다.
    <div style={s.confirm}>
      <span style={s.confirmText}>삭제할까요? 오늘 후보에서도 빠져요 · 과거 기록의 이름은 남아요</span>
      <button type="button" onClick={onConfirm} style={s.dangerBtn}>
        삭제
      </button>
      <button type="button" onClick={onCancel} style={s.ghostBtn}>
        취소
      </button>
    </div>
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
  createSlot: {
    borderBottom: "1px solid var(--line-soft)",
  },
  formCreate: { padding: "14px 20px" },
  formEdit: { padding: 0 },
  fields: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  input: {
    height: 38,
    minWidth: 0,
    padding: "0 12px",
    border: "1px solid var(--line)",
    borderRadius: 9,
    fontSize: 14,
    outline: "none",
    background: "var(--panel)",
    color: "var(--ink)",
    transition: "border-color .12s, box-shadow .12s",
  },
  formButtons: { display: "flex", gap: 6, flexShrink: 0 },
  primaryBtn: {
    appearance: "none",
    border: 0,
    background: "var(--ink)",
    color: "var(--panel)",
    height: 38,
    padding: "0 16px",
    borderRadius: 9,
    fontWeight: 600,
    fontSize: 13.5,
    letterSpacing: "-0.005em",
  },
  ghostBtn: {
    appearance: "none",
    border: "1px solid var(--line)",
    background: "var(--panel)",
    color: "var(--ink-soft)",
    height: 38,
    padding: "0 14px",
    borderRadius: 9,
    fontSize: 13.5,
    cursor: "pointer",
  },
  dangerBtn: {
    appearance: "none",
    border: "1px solid var(--red)",
    background: "var(--panel)",
    color: "var(--red)",
    height: 32,
    padding: "0 14px",
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  formError: {
    marginTop: 8,
    fontSize: 12.5,
    color: "var(--red)",
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    maxHeight: 520,
    overflowY: "auto",
  },
  empty: {
    padding: "32px 20px",
    textAlign: "center",
  },
  emptyText: { color: "var(--muted)", fontSize: 13 },
  row: {
    padding: "10px 20px",
    borderBottom: "1px solid var(--line-soft)",
    animation: "fade-up .2s ease-out both",
  },
  rowInner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  rowMain: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14.5,
    fontWeight: 600,
    color: "var(--ink)",
    letterSpacing: "-0.01em",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  chip: {
    fontSize: 11.5,
    padding: "1px 7px",
    borderRadius: 999,
    background: "var(--bg-soft)",
    color: "var(--ink-soft)",
    border: "1px solid var(--line-soft)",
  },
  chipMore: {
    fontSize: 11.5,
    padding: "1px 7px",
    borderRadius: 999,
    background: "var(--panel)",
    color: "var(--muted)",
    border: "1px solid var(--line)",
  },
  meta: {
    fontSize: 12,
    color: "var(--muted)",
    marginTop: 3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  link: { color: "var(--accent-ink)" },
  editBtn: {
    appearance: "none",
    border: "1px solid var(--line)",
    background: "var(--panel)",
    color: "var(--ink-soft)",
    height: 26,
    padding: "0 10px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
    flexShrink: 0,
  },
  del: {
    appearance: "none",
    border: 0,
    background: "transparent",
    color: "var(--muted)",
    width: 26,
    height: 26,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    flexShrink: 0,
  },
  pin: {
    appearance: "none",
    border: 0,
    width: 26,
    height: 26,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
    flexShrink: 0,
    transition: "opacity .12s",
  },
  confirm: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  confirmText: { flex: 1, minWidth: 200, fontSize: 13, color: "var(--ink-soft)" },
  footer: {
    padding: "12px 20px",
    background: "var(--bg-soft)",
    borderTop: "1px solid var(--line-soft)",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  footerText: { color: "var(--ink-soft)", fontSize: 12.5 },
} satisfies Record<string, CSSProperties>;
