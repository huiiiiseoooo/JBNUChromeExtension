import { h } from '@/shared/dom';
import type { Widget } from '../widget';

const MAX = 4;

export const newsWidget: Widget = {
  id: 'news',
  area: 'main',
  render({ state, sources }) {
    const newsSources = sources.filter((s) => s.kind === 'news');
    const posts = newsSources
      .flatMap((s) => state.sources[s.id]?.posts ?? [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX);

    const more = newsSources[0]?.listUrl;
    return h(
      'section',
      { class: 'card' },
      h(
        'header',
        { class: 'card-head' },
        h('h2', {}, '전북대 주요 뉴스'),
        more && h('a', { href: more, class: 'more' }, '더보기'),
      ),
      newsSources.length === 0
        ? h('p', { class: 'empty' }, '설정에서 뉴스 게시판을 켜면 여기에 표시됩니다.')
        : posts.length === 0
          ? h('p', { class: 'empty' }, '불러오는 중이거나 뉴스가 없습니다.')
          : h(
              'ul',
              { class: 'news-grid' },
              posts.map((p) =>
                h(
                  'li',
                  {},
                  h(
                    'a',
                    { href: p.url, class: 'news-card' },
                    h(
                      'div',
                      { class: 'news-thumb' },
                      p.thumbnail && h('img', { src: p.thumbnail, alt: '', loading: 'lazy' }),
                    ),
                    h('div', { class: 'news-title' }, p.title),
                    h('div', { class: 'news-date' }, p.date),
                  ),
                ),
              ),
            ),
    );
  },
};
