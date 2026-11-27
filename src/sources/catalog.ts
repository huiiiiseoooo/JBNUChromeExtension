import type { Source } from '@/core/types';

/**
 * 전북대 공통 게시판 목록 (데이터).
 * 학과 게시판은 departments.json(scripts/build-departments.ts 로 생성)에서 따로 관리한다.
 *
 * ⚠ id 는 저장 데이터의 키이므로 바꾸지 말 것.
 */
export const BUILTIN_SOURCES: Source[] = [
  // ── 전북대학교 본부 ──
  {
    id: 'jbnu-notice-campus',
    name: '교내공지',
    group: '전북대학교',
    kind: 'notice',
    adapter: 'jbnu-main-notice',
    listUrl: 'https://www.jbnu.ac.kr/web/news/notice/sub01.do',
  },
  {
    id: 'jbnu-notice-student',
    name: '학생공지',
    group: '전북대학교',
    kind: 'notice',
    adapter: 'jbnu-main-notice',
    listUrl: 'https://www.jbnu.ac.kr/web/news/notice/sub02.do',
  },
  {
    id: 'jbnu-notice-job',
    name: '교내채용',
    group: '전북대학교',
    kind: 'notice',
    adapter: 'jbnu-main-notice',
    listUrl: 'https://www.jbnu.ac.kr/web/news/notice/sub03.do',
  },
  {
    id: 'jbnu-notice-seminar',
    name: '특강&세미나',
    group: '전북대학교',
    kind: 'notice',
    adapter: 'jbnu-main-notice',
    listUrl: 'https://www.jbnu.ac.kr/web/news/notice/sub05.do',
  },
  {
    id: 'jbnu-news',
    name: 'JBNU News (주요뉴스)',
    group: '전북대학교',
    kind: 'news',
    adapter: 'jbnu-main-news',
    listUrl: 'https://www.jbnu.ac.kr/web/news/plaza/sub01.do',
  },
];

/** 처음 설치했을 때 켜져 있는 소스 */
export const DEFAULT_ENABLED_SOURCE_IDS = [
  'jbnu-notice-campus',
  'jbnu-notice-student',
  'jbnu-news',
];
