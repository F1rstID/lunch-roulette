// 읽기(SELECT)·Edge Function 실패를 화면에 띄울 한 줄 한국어 문장으로 조립하는 순수 모듈.
// 순수성 자체가 이 파일의 계약이다 — 데이터 클라이언트·React·환경변수를 import 하지 않는다.
// 그래야 테스트 러너가 브라우저 전역이나 NEXT_PUBLIC_* 키 없이 이 파일만 단독으로 불러올 수 있다.
// 에러 타입을 라이브러리에서 가져오지 않고 { message: string } 구조적 타입으로만 받는 이유도 같다.
// message 만 쓴다: details·hint 에는 SQL 조각과 테이블·컬럼명이 실려 화면 노출 시 내부 구조가 샌다.

// 여러 쿼리가 동시에 실패해도 배너는 하나다. 그 한 줄 안에서 항목 경계를 눈으로 구분하는 구분자.
const ERROR_SEPARATOR = " · ";

export function formatLoadError(label: string, error: { message: string } | null): string | null {
  if (!error) return null;
  return `${label} 불러오기 실패: ${error.message}`;
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
function readableMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
