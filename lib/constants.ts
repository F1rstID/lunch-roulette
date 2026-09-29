// 환경변수·supabase 클라이언트·React 에 의존하지 않는 순수 상수 모듈.
// 따로 두는 이유: lib/supabase/client.ts 는 모듈 로드 시점에 createClient(...) 를 실행하며 환경변수를 읽는다.
// 상수 하나를 거기서 가져오면 그 상수를 쓰는 순수 함수까지 환경변수 없이는 import 할 수 없게 된다.
// 여기에는 환경변수를 읽거나 클라이언트를 만드는 코드를 절대 넣지 않는다.

// restaurants.name 의 DB check 제약(char_length 1~24)과 restaurants.menus 원소 상한이 같은 값이다.
// 여기가 유일한 정의처다 (re-export 를 두지 않는다 — 정의처가 둘로 보이면 어느 쪽을 import 할지 헷갈린다).
// 늘릴 때는 0005 의 두 제약과 여기를 함께 고친다.
export const MENU_NAME_MAX_LEN = 24;

// restaurants.menus 의 DB check 제약(cardinality)과 같은 값이다. 늘릴 때는 0005 의 제약과 여기를 함께 고친다.
// 매장명·메뉴 원소의 24 는 위 MENU_NAME_MAX_LEN 을 공용한다 — 같은 숫자에 정의처를 둘로 만들지 않는다.
export const RESTAURANT_MENUS_MAX = 30;

// restaurants.location 의 DB check 제약(char_length)과 같은 값이다. 늘릴 때는 0005 의 제약과 여기를 함께 고친다.
export const RESTAURANT_LOCATION_MAX_LEN = 200;
