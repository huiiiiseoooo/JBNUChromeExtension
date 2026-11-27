import type { Adapter, Post } from '@/core/types';
import { absoluteUrl, cleanText, normalizeDate } from './util';

/**
 * K2Web CMS 게시판 (전북대 대부분의 학과 홈페이지가 사용).
 * 목록 URL: https://{학과}.jbnu.ac.kr/bbs/{siteId}/{게시판번호}/artclList.do
 * 상세 URL: https://{학과}.jbnu.ac.kr/bbs/{siteId}/{게시판번호}/{글번호}/artclView.do
 */
export const k2web: Adapter = {
  id: 'k2web',
  label: '학과 홈페이지 게시판 (K2Web, …/bbs/…/artclList.do)',
  // row 로 한 페이지 글 수를 늘릴 수 있다 (기본 10~20)
  pageUrl: (listUrl, page) => {
    const u = new URL(listUrl);
    u.searchParams.set('row', '50');
    u.searchParams.set('page', String(page));
    return u.toString();
  },
  postsPerPage: 50,
  matchesUrl: (url) => /^https:\/\/[\w-]+\.jbnu\.ac\.kr\/bbs\/[\w-]+\/\d+\/artclList\.do/.test(url),
  parse(doc, source) {
    const posts: Post[] = [];
    doc.querySelectorAll('tbody tr').forEach((tr) => {
      const link = tr.querySelector<HTMLAnchorElement>('td._artclTdTitle a.artclLinkView');
      if (!link) return;
      const href = link.getAttribute('href') ?? '';
      const id = href.match(/\/(\d+)\/artclView\.do/)?.[1];
      if (!id) return;

      // 제목은 <strong> 안에 있고, 그 앞의 [말머리] 텍스트가 분류다.
      const strong = link.querySelector('strong');
      const title = cleanText(strong?.textContent ?? link.textContent);
      const before = cleanText(link.textContent).replace(title, '');
      const category = before.match(/\[\s*([^\]]+?)\s*\]/)?.[1];

      posts.push({
        id,
        title,
        url: absoluteUrl(href, source.listUrl),
        date: normalizeDate(tr.querySelector('td._artclTdRdate')?.textContent),
        category: category || undefined,
        writer: cleanText(tr.querySelector('td._artclTdWriter')?.textContent) || undefined,
        pinned: tr.classList.contains('headline'),
      });
    });
    return posts;
  },
};
