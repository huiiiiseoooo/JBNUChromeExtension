import { describe, expect, it } from 'vitest';
import { cutoffDate, maxPagesFor, mergePosts, nextPageDecision } from '@/core/collect';
import type { Post } from '@/core/types';

const p = (id: string, date: string, pinned = false): Post => ({ id, title: `글${id}`, url: '', date, pinned });
const ctx = (o: Partial<Parameters<typeof nextPageDecision>[1]> = {}) => ({
  cutoff: '2026-10-25', known: new Set<string>(), prevPassDone: false, pageNo: 1, maxPages: 6, ...o,
});

describe('다음 페이지 판단', () => {
  it('기간 안의 글만 있으면 계속, 기간 밖 글이 나오면 멈춤', () => {
    expect(nextPageDecision([p('3', '2026-11-20'), p('2', '2026-11-01')], ctx())).toBe('continue');
    expect(nextPageDecision([p('2', '2026-11-01'), p('1', '2026-10-20')], ctx())).toBe('reached-cutoff');
  });
  it('고정글은 판단에서 뺀다 (오래된 고정글 때문에 멈추지 않음)', () => {
    expect(nextPageDecision([p('9', '2025-01-01', true), p('3', '2026-11-20')], ctx())).toBe('continue');
  });
  it('이미 기간을 채운 상태에서 아는 글만 나오면 따라잡음', () => {
    const known = new Set(['3', '2']);
    expect(nextPageDecision([p('3', '2026-11-20'), p('2', '2026-11-19')], ctx({ known, prevPassDone: true }))).toBe('caught-up');
    expect(nextPageDecision([p('3', '2026-11-20'), p('2', '2026-11-19')], ctx({ known, prevPassDone: false }))).toBe('continue');
  });
  it('최대 페이지와 빈 페이지', () => {
    expect(nextPageDecision([p('3', '2026-11-20')], ctx({ pageNo: 6 }))).toBe('max-pages');
    expect(nextPageDecision([p('9', '2026-11-20', true)], ctx())).toBe('no-more');
    expect(maxPagesFor(30, 10)).toBe(36);
    expect(maxPagesFor(30, 50)).toBe(8);
    expect(maxPagesFor(90, 10)).toBe(40);
  });
});

describe('글 합치기', () => {
  it('예전 글을 유지하고, 기간 지난 글은 버리고, 최신순 정렬', () => {
    const prev = { posts: [p('5', '2026-11-10'), p('1', '2026-10-01')], fetchedAt: 0, coverageFrom: '2026-10-25' };
    const r = mergePosts(prev, [[p('9', '2025-03-01', true), p('7', '2026-11-22'), p('6', '2026-11-21')]], '2026-10-25', 'caught-up');
    expect(r.posts.map((x) => x.id)).toEqual(['9', '7', '6', '5']);
    expect(r.coverageFrom).toBe('2026-10-25');
    expect(r.olderFound).toEqual([]);
  });
  it('뒤 페이지에서 처음 찾은 글은 olderFound 로 알려준다', () => {
    const prev = { posts: [p('7', '2026-11-22')], fetchedAt: 0 };
    const r = mergePosts(prev, [[p('8', '2026-11-23'), p('7', '2026-11-22')], [p('4', '2026-11-05'), p('3', '2026-10-20')]], '2026-10-25', 'reached-cutoff');
    expect(r.olderFound.map((x) => x.id)).toEqual(['4', '3']);
    expect(r.posts.map((x) => x.id)).toEqual(['8', '7', '4']);
    expect(r.coverageFrom).toBe('2026-10-25');
  });
  it('최대 페이지에서 멈추면 실제로 모은 가장 오래된 날짜부터', () => {
    const r = mergePosts(undefined, [[p('8', '2026-11-23'), p('4', '2026-11-05')]], '2026-10-25', 'max-pages');
    expect(r.coverageFrom).toBe('2026-11-05');
  });
  it('고정이 풀린 글은 일반글로 돌아간다', () => {
    const prev = { posts: [p('5', '2026-11-10', true)], fetchedAt: 0 };
    const r = mergePosts(prev, [[p('6', '2026-11-21')]], '2026-10-25', 'continue' as never);
    expect(r.posts.find((x) => x.id === '5')?.pinned).toBe(false);
  });
});

it('cutoffDate', () => {
  expect(cutoffDate(30, new Date(2026, 10, 24, 12).getTime())).toBe('2026-10-25');
});
