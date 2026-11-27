import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { neutralizeHtml } from '@/adapters/util';
import { getAdapter } from '@/adapters';
import { matchKeywords } from '@/core/matcher';
import { BUILTIN_SOURCES } from '@/sources/catalog';
import { departmentSources } from '@/sources/departments';

// 실제 사이트에서 저장한 HTML 로 파서를 검증한다.
// 사이트 구조가 바뀌면 fixture 를 다시 저장하고 이 테스트로 확인한다.
const load = (name: string) =>
  new DOMParser().parseFromString(neutralizeHtml(readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8')), 'text/html');
const src = (id: string) => [...BUILTIN_SOURCES, ...departmentSources(['software'])].find((s) => s.id === id)!;

function parse(fixture: string, sourceId: string) {
  const source = src(sourceId);
  return getAdapter(source.adapter)!.parse(load(fixture), source);
}

describe('jbnu-main-notice', () => {
  const posts = parse('jbnu-notice.html', 'jbnu-notice-campus');
  it('목록을 읽는다', () => {
    expect(posts.length).toBeGreaterThanOrEqual(10);
    for (const p of posts) {
      expect(p.id).toMatch(/^\d+$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.url).toBe(`https://www.jbnu.ac.kr/web/Board/${p.id}/detailView.do`);
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('고정 공지와 분류를 구분한다', () => {
    expect(posts.some((p) => p.pinned)).toBe(true);
    expect(posts.some((p) => !p.pinned)).toBe(true);
    expect(posts.find((p) => p.id === '220144')?.category).toBe('장학');
  });
});

describe('jbnu-main-news', () => {
  const posts = parse('jbnu-news.html', 'jbnu-news');
  it('뉴스 카드를 읽는다', () => {
    expect(posts.length).toBeGreaterThanOrEqual(6);
    expect(posts[0].title).toContain('육군');
    expect(posts[0].date).toBe('2026-11-20');
    expect(posts[0].thumbnail).toMatch(/^https:\/\/www\.jbnu\.ac\.kr\/common\/file\.do/);
  });
});

describe('k2web (소프트웨어공학과)', () => {
  const posts = parse('software-notice.html', 'dept:software');
  it('목록을 읽는다', () => {
    expect(posts.length).toBeGreaterThanOrEqual(10);
    const first = posts[0];
    expect(first.id).toBe('406697');
    expect(first.url).toBe('https://software.jbnu.ac.kr/bbs/software/527/406697/artclView.do');
    expect(first.title).toContain('해외어학연수');
    expect(first.title).not.toContain('[');
    expect(first.category).toBe('일반공지');
    expect(first.date).toBe('2026-11-20');
    expect(first.pinned).toBe(true);
  });
  it('일반글의 말머리를 읽는다', () => {
    const p = posts.find((x) => x.id === '406324');
    expect(p?.category).toBe('특강및공모전');
    expect(p?.pinned).toBe(false);
  });
  it('K2Web 주소를 인식한다', () => {
    const a = getAdapter('k2web')!;
    expect(a.matchesUrl('https://cse.jbnu.ac.kr/bbs/cse/123/artclList.do')).toBe(true);
    expect(a.matchesUrl('https://example.com/bbs/x/1/artclList.do')).toBe(false);
  });
});

describe('matchKeywords', () => {
  const post = { id: '1', title: '2027학년도 1학기 국가장학금 1차 신청', url: '', date: '', category: '장학' };
  it('띄어쓰기/대소문자 무시', () => {
    expect(matchKeywords(post, ['국가 장학금'])).toEqual(['국가 장학금']);
    expect(matchKeywords(post, ['현장실습', '장학'])).toEqual(['장학']);
    expect(matchKeywords(post, ['', ' '])).toEqual([]);
  });
});
