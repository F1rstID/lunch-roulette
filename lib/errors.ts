// 읽기(SELECT)·쓰기(INSERT/UPDATE/DELETE)·Edge Function 실패를 화면에 띄울 한 줄 한국어 문장으로 조립하는 순수 모듈.
// 순수성 자체가 이 파일의 계약이다 — 데이터 클라이언트·React·환경변수를 import 하지 않는다.
// 그래야 테스트 러너가 브라우저 전역이나 NEXT_PUBLIC_* 키 없이 이 파일만 단독으로 불러올 수 있다.
// 에러 타입을 라이브러리에서 가져오지 않고 { message: string } 구조적 타입으로만 받는 이유도 같다.
// message 만 쓴다: details·hint 에는 SQL 조각과 테이블·컬럼명이 실려 화면 노출 시 내부 구조가 샌다.

// 여러 쿼리가 동시에 실패해도 배너는 하나다. 그 한 줄 안에서 항목 경계를 눈으로 구분하는 구분자.
const ERROR_SEPARATOR = " · ";

// 배너에 실을 문장의 길이 상한. 이 값이 필요한 이유: 여기서 돌려준 문자열은 가공 없이 한 줄
// 배너에 그대로 실린다. PostgREST·게이트웨이가 긴 원문을 주면 배너가 화면을 덮어 버리는데,
// 그 본문의 길이는 이 모듈이 통제하지 못한다(호출자는 네트워크다).
// 이름에 RESPIN_ 을 두지 않는 이유: readableMessage 를 다시 돌리기(formatRespinError)와 매장 쓰기
// (formatRestaurantWriteError)가 함께 쓰므로, 상한은 한 함수가 아니라 배너 한 줄의 성질이다.
const BANNER_MESSAGE_MAX_LEN = 200;

// 읽기 실패 원문도 쓰기 쪽과 같은 상한을 지난다 — 상한은 한 함수가 아니라 배너 한 줄의 성질이다(아래 readableMessage).
export function formatLoadError(label: string, error: { message: string } | null): string | null {
  if (!error) return null;
  return `${label} 불러오기 실패: ${readableMessage(error.message) ?? "알 수 없는 오류"}`;
}

export function joinLoadErrors(parts: (string | null)[]): string | null {
  // 빈 문자열도 걸러낸다 — 라벨이 비어 만들어진 공백 조각이 구분자만 남기는 것을 막는다.
  const messages = parts.filter((part): part is string => Boolean(part));
  if (messages.length === 0) return null;
  return messages.join(ERROR_SEPARATOR);
}

// 배너에 실을 수 있는 한 줄인지 판정한다. 키가 둘(error·message)이라 판정을 한 곳에 모은다 —
// 나누면 "빈 문자열은 거른다" 같은 규칙이 키마다 갈라진다.
// 빈 문자열을 거르는 이유: 그대로 통과시키면 접두만 남아 "다시 돌리기 실패: " 로 끝나는 배너가 나온다.
// 앞뒤 공백을 떼는 이유: 원문을 그대로 실으면 "다시 돌리기 실패:  x " 처럼 접두와 문장 사이가
// 벌어진 배너가 나온다. 공백만 있는 값은 문장이 아니므로 빈 문자열과 같이 취급한다.
function readableMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= BANNER_MESSAGE_MAX_LEN) return trimmed;
  // 잘렸다는 사실을 말줄임표로 남긴다 — 없으면 문장이 원래 거기서 끝난 것처럼 읽힌다.
  return `${trimmed.slice(0, BANNER_MESSAGE_MAX_LEN)}…`;
}

// body 를 unknown 으로 받는 이유: 이 값은 신뢰할 수 없는 네트워크 본문이고, 형태 판정을 여기서 끝내야
// 호출하는 페이지 쪽으로 타입 단언이 새지 않는다.
// 키 우선순위 — 1순위는 함수가 보낸 { error }, 2순위는 게이트웨이·런타임이 보내는 { message } 다.
// 이 헬퍼가 가장 필요한 순간은 함수 본문이 아예 돌지 못한 때인데, verify_jwt 오배포는
// { code: 401, message: "Invalid JWT" }, 워커 부팅 실패는 { code: "BOOT_ERROR", message } 형태라
// error 키가 없다. 1순위만 보면 바로 그 순간에 라이브러리 고정 문구로 끝나 이유를 알 수 없다.
export function formatRespinError(fallbackMessage: string, body: unknown): string {
  if (typeof body === "object" && body !== null) {
    if ("error" in body) {
      const message = readableMessage(body.error);
      if (message !== null) return message;
    }
    if ("message" in body) {
      const message = readableMessage(body.message);
      if (message !== null) return message;
    }
  }
  return fallbackMessage;
}

// 호출부가 오타로 아무 문자열이나 넘기지 못하게 리터럴 유니온으로 묶는다 — 배너 문장의 동사 자리다.
export type RestaurantWriteAction = "등록" | "수정" | "삭제" | "고정" | "고정 해제";

// 매장 쓰기 실패는 익명 사용자가 그대로 읽는다. 사용자가 손쓸 수 있는 두 경우(이름 중복·입력 규칙 위반)만
// 한국어로 갈아끼우는 이유: PostgREST 원문은 제약 이름과 SQL 조각을 실어 와 읽을 수도, 고칠 수도 없다.
// code 를 optional 로 받는 이유: 네트워크·게이트웨이 실패에는 코드가 아예 없고, 그때는 원문을 살려야 원인을 안다.
// 이 함수도 details·hint 는 보지 않는다 — 머리 주석의 이유가 쓰기 경로에서도 그대로다.
export function formatRestaurantWriteError(
  action: RestaurantWriteAction,
  name: string,
  // null 은 "에러는 없는데 영향 행이 0" 이다. PostgREST 의 update/delete 는 대상 행이 이미 사라져도
  // error: null 로 돌아오므로, 그 침묵을 성공으로 보고하지 않으려면 호출부에 줄 문장이 있어야 한다.
  error: { code?: string; message: string } | null,
): string {
  // 실패한 쪽은 쓰기가 아니라 대상이다 — 동사(등록/수정/…)를 붙이면 원인이 흐려진다.
  if (error === null) return `이미 삭제된 매장이에요: ${name}`;
  // unique 위반은 원인이 하나로 정해져 있어 동사도 원문도 필요 없다.
  if (error.code === "23505") return `이미 등록된 매장이에요: ${name}`;
  // check 위반은 어느 필드인지 코드로 알 수 없다. 상한 셋을 다 보여 주는 편이 사용자가 빨리 찾는다.
  if (error.code === "23514") return `입력 규칙에 맞지 않아요(${name}): 이름 1~24자, 메뉴 30개·24자, 위치 200자`;
  // 원문이 공백뿐이면 접두만 남은 배너가 되므로 대체 문구를 쓴다(formatRespinError 와 같은 논증).
  return `매장 "${name}" ${action} 실패: ${readableMessage(error.message) ?? "알 수 없는 오류"}`;
}

// 후보 담기·빼기의 동사 자리. 매장 쓰기와 낱말이 겹치지 않아 유니온을 따로 둔다.
export type CandidateWriteAction = "담기" | "빼기";

// 후보 쓰기는 매장 쓰기와 달리 "실패했지만 사용자에게는 실패가 아닌" 경우가 하나 있다. 그 갈림이 이 함수를
// 따로 두는 이유이고, null 은 호출부가 성공으로 처리하라는 신호다.
// 이 함수도 details·hint 는 보지 않는다 — 머리 주석의 이유가 후보 경로에서도 그대로다.
export function formatCandidateWriteError(
  action: CandidateWriteAction,
  name: string,
  error: { code?: string; message: string },
): string | null {
  // 키 중복은 두 사람이 같은 매장을 동시에 담은 것이다. 원하던 상태가 이미 됐고 화면은 Realtime 이벤트로
  // 맞춰지므로 사용자에게 보일 실패가 아니다. 빼기에는 같은 논증이 서지 않아 일반 문장으로 떨어진다.
  if (error.code === "23505" && action === "담기") return null;
  // 참조 위반은 클릭 직전에 매장이 지워진 경우다. 실패한 쪽은 동작이 아니라 대상이라 동사를 붙이지 않는다.
  if (error.code === "23503") return `이미 삭제된 매장이에요: ${name}`;
  return `매장 "${name}" ${action} 실패: ${readableMessage(error.message) ?? "알 수 없는 오류"}`;
}
