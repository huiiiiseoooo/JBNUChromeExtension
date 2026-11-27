/**
 * 확장 전체에서 공유하는 핵심 타입.
 *
 * 구조 요약
 *  - Adapter : "어떤 형식의 게시판 HTML을 Post[] 로 바꾸는 방법" (사이트 CMS 종류별 1개)
 *  - Source  : "어떤 URL의 게시판을 어떤 Adapter 로 읽을지" (게시판 1개당 1개, 데이터)
 *  - Post    : 게시글 1개를 정규화한 형태
 *
 * 새 학과/게시판 추가 = Source 데이터 1줄 추가.
 * 새 CMS 형식 지원   = Adapter 파일 1개 추가 + adapters/index.ts 에 등록.
 */

export type SourceKind = 'notice' | 'news';

export interface Post {
  /** 소스 안에서 고유한 게시글 ID (사이트의 글 번호) */
  id: string;
  title: string;
  url: string;
  /** YYYY-MM-DD 형식. 알 수 없으면 빈 문자열 */
  date: string;
  /** 말머리/분류 (예: 장학, 일반공지) */
  category?: string;
  /** 작성 부서 */
  writer?: string;
  /** 상단 고정 공지 여부 */
  pinned?: boolean;
  /** 뉴스 썸네일 */
  thumbnail?: string;
  /** 뉴스 요약 */
  summary?: string;
}

export interface Source {
  /** 전역 고유 ID. 저장 데이터의 키로 쓰이므로 한번 정하면 바꾸지 않는다. */
  id: string;
  /** 화면에 보일 이름 (예: "학생공지") */
  name: string;
  /** 그룹 이름 (예: "전북대학교", "소프트웨어공학과") */
  group: string;
  kind: SourceKind;
  /** 사용할 Adapter ID */
  adapter: string;
  /** 목록 페이지 URL */
  listUrl: string;
  /** 사용자가 설정에서 직접 추가한 소스인지 */
  custom?: boolean;
}

export interface Adapter {
  id: string;
  /** 설정 화면에 보일 설명 */
  label: string;
  /** 이 어댑터가 처리할 수 있는 목록 URL인지 (사용자 정의 소스 추가 시 검증용) */
  matchesUrl(url: string): boolean;
  /** 목록 페이지 Document 를 Post[] 로 변환. DOM 환경(offscreen/newtab)에서만 호출된다. */
  parse(doc: Document, source: Source): Post[];
  /** n 페이지 주소 (1페이지 포함). 없으면 목록 주소 1페이지만 읽는다 */
  pageUrl?(listUrl: string, page: number): string;
  /** pageUrl 한 페이지당 글 수 (고정글 제외) */
  postsPerPage?: number;
}

export interface Settings {
  keywords: string[];
  /** 선택한 학과 ID (src/sources/departments.json). 복수전공 등을 위해 여러 개 가능 */
  departmentIds: string[];
  /** 새 탭에 보여줄 식당 이름. 빈 배열이면 전부 */
  cafeterias: string[];
  /** 새 탭의 학과 선택 카드를 닫았는지 */
  departmentPromptDismissed: boolean;
  /** 켜져 있는 소스 ID 목록 */
  enabledSourceIds: string[];
  /** 사용자가 추가한 소스 */
  customSources: Source[];
  /** 키워드 공지를 찾을 기간(일): 14 / 30 / 90 */
  lookbackDays: number;
  /** 백그라운드 확인 주기(분) */
  pollMinutes: number;
  /** 새 탭 바로가기 */
  shortcuts: Shortcut[];
}

export interface Shortcut {
  name: string;
  url: string;
}

export interface SourceState {
  posts: Post[];
  fetchedAt: number;
  /** 이 날짜(YYYY-MM-DD) 이후의 글은 빠짐없이 모았다 */
  coverageFrom?: string;
  /** 마지막으로 끝까지 읽었을 때의 기간(일). 기간을 늘리면 다시 끝까지 읽는다 */
  passLookback?: number;
  error?: string;
}

export interface Meal {
  /** 코너/메뉴 구분 (예: 백반, 특식) */
  corner: string;
  items: string[];
}

export interface MealState {
  /** 식단 날짜 (YYYY-MM-DD) */
  date: string;
  /** 식단 페이지에 표시된 날짜 문구 (예: 2026년 11월 23일 월요일) */
  label: string;
  /** 식당 이름 → 끼니(조식/점심/석식) → 메뉴 */
  cafeterias: Record<string, Record<string, Meal[]>>;
  fetchedAt: number;
  error?: string;
}

export interface AppState {
  sources: Record<string, SourceState>;
  meal?: MealState;
  /** 이미 확인한(배지에서 제외할) 키워드 매칭 글. 키는 `${sourceId}:${postId}` */
  seenMatchKeys: string[];
  /** 각 소스에서 처음 읽은 시점 이전 글은 "새 글"로 치지 않기 위한 기준 */
  initializedSourceIds: string[];
}
