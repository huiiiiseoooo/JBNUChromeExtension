import type { Adapter, Post } from '@/core/types';
import { absoluteUrl, cleanText, handlerAttr, normalizeDate, quotedArgs } from './util';

/**
 * 전북대 본부 홈페이지(www.jbnu.ac.kr/web/...) 게시판.
 * 목록 링크가 onclick="pf_DetailMove('글번호')" 형태이고,
 * 상세 페이지는 /web/Board/{글번호}/detailView.do 로 바로 열린다.
 */
function detailUrl(id: string, base: string): string {
  return absoluteUrl(`/web/Board/${id}/detailView.do`, base);
}

const matchesUrl = (url: string) => /^https:\/\/www\.jbnu\.ac\.kr\/web\//.test(url);

/** 표 형식 공지 목록 (교내공지, 학생공지 등) */
const pageUrl = (listUrl: string, page: number) => {
  const u = new URL(listUrl);
  u.searchParams.set('pageIndex', String(page));
  return u.toString();
};

export const jbnuMainNotice: Adapter = {
  id: 'jbnu-main-notice',
  label: '전북대 본부 공지 게시판 (표 형식)',
  matchesUrl,
  pageUrl,
  postsPerPage: 10,
  parse(doc, source) {
    const posts: Post[] = [];
    doc.querySelectorAll('tbody tr').forEach((tr) => {
      const link = tr.querySelector<HTMLAnchorElement>('td.td-title a.title');
      if (!link) return;
      const id = quotedArgs(handlerAttr(link, 'click'))[0];
      if (!id) return;
      const tagCell = tr.querySelector('[class^="tag-type"]');
      posts.push({
        id,
        title: cleanText(link.textContent),
        url: detailUrl(id, source.listUrl),
        date: normalizeDate(tr.querySelector('.etc-list li')?.textContent),
        category: cleanText(tagCell?.textContent) || undefined,
        writer: cleanText(tr.querySelector('.brd-writer')?.textContent) || undefined,
        pinned: tr.classList.contains('tr-noticed'),
      });
    });
    return posts;
  },
};

/** 카드 형식 뉴스 목록 (JBNU News) */
export const jbnuMainNews: Adapter = {
  id: 'jbnu-main-news',
  label: '전북대 본부 뉴스 게시판 (카드 형식)',
  matchesUrl,
  parse(doc, source) {
    const posts: Post[] = [];
    doc.querySelectorAll('ul.com-brd-list-05 > li > a').forEach((a) => {
      const id = quotedArgs(handlerAttr(a, 'click'))[0];
      if (!id) return;
      const img = a.querySelector('.img-box img')?.getAttribute('src');
      const etc = [...a.querySelectorAll('.etc-list li')].map((li) => cleanText(li.textContent));
      posts.push({
        id,
        title: cleanText(a.querySelector('.title')?.textContent),
        url: detailUrl(id, source.listUrl),
        date: normalizeDate(etc.find((t) => /\d{4}-\d{2}-\d{2}/.test(t))),
        writer: etc[0] || undefined,
        summary: cleanText(a.querySelector('.ctt')?.textContent) || undefined,
        thumbnail: img ? absoluteUrl(img, source.listUrl) : undefined,
      });
    });
    return posts;
  },
};
