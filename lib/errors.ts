// 읽기(SELECT) 실패를 화면에 띄울 한 줄 한국어 문장으로 조립하는 순수 모듈.
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
