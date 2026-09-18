// 환경변수·supabase 클라이언트·React 에 의존하지 않는 순수 상수 모듈.
// 따로 두는 이유: lib/supabase/client.ts 는 모듈 로드 시점에 createClient(...) 를 실행하며 환경변수를 읽는다.
// 상수 하나를 거기서 가져오면 그 상수를 쓰는 순수 함수까지 환경변수 없이는 import 할 수 없게 된다.
// 여기에는 환경변수를 읽거나 클라이언트를 만드는 코드를 절대 넣지 않는다.

// menus.name / pinned_menus.name 의 DB check 제약(char_length 1~24)과 동일. 여기가 유일한 정의처다
// (re-export 를 두지 않는다 — 정의처가 둘로 보이면 어느 쪽을 import 할지 헷갈린다).
export const MENU_NAME_MAX_LEN = 24;
