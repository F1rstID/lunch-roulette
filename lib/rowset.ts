// 목록 상태의 Realtime 병합 규칙 한 벌. 매장 카탈로그와 오늘 후보가 이 구현 하나를 키만 바꿔 쓴다.
// 두 벌로 두지 않는 이유: "조회보다 먼저 온 이벤트" 급 버그는 한쪽에만 고쳐지는 날이 오고(05-REVIEW CR-01),
// 그때 남은 쪽은 아무도 다시 읽지 않는다.
// 키를 주입으로 받는 이유: restaurants 의 PK 는 id 이고 candidates 의 PK 는 restaurant_id 다. 목록이 다른 것은
// 병합 규칙이 아니라 "무엇이 같은 행인가" 뿐이므로, 갈리는 자리를 함수 인자 하나로 좁힌다.
// 조회 전 이벤트를 버퍼에 쌓는 이유: 훅은 초기 조회와 구독을 동시에 띄우므로 남의 이벤트가 응답보다 먼저
// 도착하는 창이 매 마운트마다 열린다. 거기서 이벤트를 곧바로 적용하고 로드 완료를 올리면 뒤이어 온 조회
// 응답(목록의 정본)과 조회 실패(배너의 정본)가 통째로 버려져 목록이 그 한 행으로 쪼그라든다.
// UPDATE 가 모르는 키의 행을 추가까지 하는 이유: payload.new 가 전체 행이라 안전하고, 재연결 틈에 놓친
// INSERT 가 이후 UPDATE 로 복구된다. 변경 스트림은 순서가 보장되므로 DELETE 뒤에 같은 키의 UPDATE 가 와서
// 지워진 행이 되살아나는 일은 없다(D-05).
// 순수성이 계약이다 — React·데이터 클라이언트·환경변수를 값으로 끌어오지 않는다.

// 목록에 적용하는 최소 단위. DELETE 만 행이 아니라 키인 비대칭은 Realtime 페이로드 그대로다.
export type RowChange<Row> =
  | { event: "INSERT" | "UPDATE"; row: Row }
  | { event: "DELETE"; key: string | null };

export type RowSetState<Row> = {
  // 조회 순서를 그대로 유지한다. 표시 순서는 화면 쪽 순수 함수가 따로 정한다 — 정렬을 여기에 넣으면
  // 같은 규칙의 정의처가 둘이 된다.
  rows: Row[];
  loaded: boolean;
  error: string | null;
  // 조회 응답보다 먼저 도착한 이벤트를 도착 순서대로 쌓아 둔 것. 응답이 오면 그 목록 위에 다시 적용한다.
  pending: RowChange<Row>[];
};

// fetched 가 rows 와 error 를 함께 받는 형태가 계약이다 — 조회 성공·실패의 가름이 훅이 아니라 이 리듀서 안에
// 있어야 spec 이 그 판정을 지난다(D-04). DELETE 만 키를 받는 비대칭도 같은 이유로 타입에 박아 둔다.
export type RowSetAction<Row> =
  | { type: "fetched"; rows: Row[] | null; error: { message: string } | null }
  | { type: "changed"; event: "INSERT" | "UPDATE"; row: Row }
  | { type: "changed"; event: "DELETE"; key: string | null };

// 인스턴스마다 새 객체를 만든다 — 모듈 상수 하나를 공유하면 타입 인자가 갈린 두 목록이 같은 배열을 든다.
export function initialRowSetState<Row>(): RowSetState<Row> {
  return { rows: [], loaded: false, error: null, pending: [] };
}

// 이벤트 한 건을 목록에 적용한다. 즉시 적용(조회 후)과 재적용(조회 전 버퍼)이 이 함수 하나를 같이 쓰는 것이
// "조회 전후의 병합 규칙이 같다" 는 보장이다 — 두 벌로 나누면 한쪽만 고쳐지는 날이 온다.
function applyChange<Row>(rows: Row[], change: RowChange<Row>, keyOf: (row: Row) => string): Row[] {
  if (change.event === "DELETE") {
    // 키마저 없으면 무엇을 지울지 알 수 없다. 목록을 비우는 대신 그대로 둔다.
    return change.key === null ? rows : rows.filter((row) => keyOf(row) !== change.key);
  }
  const key = keyOf(change.row);
  const known = rows.some((row) => keyOf(row) === key);
  if (change.event === "INSERT") {
    // 같은 행이 두 번 와도 늘지 않게 한다 — 구독 재연결 직후 같은 이벤트가 되풀이될 수 있고, 조회 응답에
    // 이미 들어 있는 행이 버퍼에도 남아 있는 것은 정상 경로다.
    return known ? rows : [...rows, change.row];
  }
  // 모르는 키면 끝에 더한다. 재연결 틈에 놓친 INSERT 가 이 경로로 복구된다.
  if (!known) return [...rows, change.row];
  // payload.new 는 이미 전체 새 행이다. 얕은 병합({ ...prev, ...row })은 "빠진 필드는 이전 값" 이라는 틀린
  // 가정을 코드에 심으므로 통째로 교체한다.
  return rows.map((row) => (keyOf(row) === key ? change.row : row));
}

export function createRowSetReducer<Row>(
  keyOf: (row: Row) => string,
): (state: RowSetState<Row>, action: RowSetAction<Row>) => RowSetState<Row> {
  return function reducer(state, action) {
    switch (action.type) {
      case "fetched": {
        // 훅은 조회 결과를 정확히 한 번 보낸다. 그런데도 도착 시점에 로드가 이미 끝나 있으면 진짜 중복
        // 응답이라 버린다 — 성공이든 실패든 같은 가드를 지난다.
        if (state.loaded) return state;
        if (action.error) {
          // 행이 함께 와도 실패다. 빈 목록 + 에러이고, 실패를 "0개" 로 위장하지 않는 것이 여기서 error 를
          // 남기는 이유다. 버퍼도 함께 버린다 — 이벤트 몇 건으로 만든 부분 목록을 남기면 배너와 화면이
          // 서로 다른 말을 한다.
          return { rows: [], loaded: true, error: action.error.message, pending: [] };
        }
        // 조회 결과 **위에** 그 사이 도착한 이벤트를 도착 순서대로 다시 적용한다. 순서를 지켜야
        // "INSERT 뒤 DELETE" 가 지워진 행이 되살아나는 결과로 뒤집히지 않는다. 0행은 실패가 아니다.
        return {
          rows: state.pending.reduce((merged, change) => applyChange(merged, change, keyOf), action.rows ?? []),
          loaded: true,
          error: null,
          pending: [],
        };
      }
      case "changed": {
        const change: RowChange<Row> =
          action.event === "DELETE" ? { event: "DELETE", key: action.key } : { event: action.event, row: action.row };
        // 조회 전이면 적용하지 않고 버퍼에 쌓는다. 여기서 로드 완료를 올리지 않는 것이 CR-01 수정의 핵심이다 —
        // 올리면 뒤늦게 도착한 조회 응답과 조회 실패가 통째로 버려진다.
        if (!state.loaded) return { ...state, pending: [...state.pending, change] };
        // error 는 그대로 둔다: 이벤트 하나가 도착했다는 사실이 목록 전체를 읽을 수 있다는 증거는 아니라서,
        // 조회 실패 배너를 여기서 지우면 반쪽짜리 목록이 정상처럼 보인다(설정 단일행과 갈리는 지점이다).
        return { ...state, rows: applyChange(state.rows, change, keyOf) };
      }
      default: {
        // 액션이 더 늘면 이 대입이 컴파일 에러가 된다. 이 리듀서가 갱신을 강제당하는 지점.
        const exhaustive: never = action;
        return exhaustive;
      }
    }
  };
}
