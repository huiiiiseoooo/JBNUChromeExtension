import { cutoffDate } from '@/core/collect';
import { collectMatches } from '@/core/matcher';
import { h, highlight } from '@/shared/dom';
import type { Widget } from '../widget';

/** 핵심 기능: 키워드에 걸린 공지 목록 + 키워드 편집 */
export const keywordNoticesWidget: Widget = {
  id: 'keyword-notices',
  area: 'main',
  render(ctx) {
    const { settings, state, sources, newAtOpen } = ctx;
    const matches = collectMatches(sources, state, settings);

    // 검색 기간 표시: "최근 1개월 · 10/25 이후 공지에서 찾음" (+ 기간을 다 못 채운 게시판 안내)
    const cutoff = cutoffDate(settings.lookbackDays);
    const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
    const period = settings.lookbackDays === 14 ? '2주' : settings.lookbackDays === 90 ? '3개월' : '1개월';
    const notices = sources.filter((s) => s.kind === 'notice');
    const short = notices.filter((s) => {
      const from = state.sources[s.id]?.coverageFrom;
      return !from || from > cutoff;
    });
    const coverage = h(
      'p',
      {
        class: 'coverage',
        title: short.length
          ? short.map((s) => `${s.group} ${s.name}: ${state.sources[s.id]?.coverageFrom ? md(state.sources[s.id]!.coverageFrom!) + '부터' : '불러오는 중'}`).join('\n')
          : '',
      },
      `최근 ${period} (${md(cutoff)} 이후) 공지 ${notices.length}곳에서 찾은 글`,
      short.length > 0 && h('span', { class: 'coverage-warn' }, ` · ${short.length}곳은 아직 기간을 다 못 채움`),
    );

    const input = h('input', { type: 'text', placeholder: '키워드 추가 (예: 장학, 현장실습)', 'aria-label': '키워드 추가' });
    const addKeyword = (e: Event) => {
      e.preventDefault();
      const words = input.value
        .split(',')
        .map((w) => w.trim())
        .filter((w) => w && !settings.keywords.includes(w));
      if (words.length) void ctx.updateSettings({ keywords: [...settings.keywords, ...words] });
      input.value = '';
    };

    const chips = h(
      'div',
      { class: 'chips' },
      settings.keywords.map((k) =>
        h(
          'span',
          { class: 'chip' },
          k,
          h(
            'button',
            {
              type: 'button',
              class: 'chip-x',
              'aria-label': `${k} 삭제`,
              onclick: () => void ctx.updateSettings({ keywords: settings.keywords.filter((x) => x !== k) }),
            },
            '×',
          ),
        ),
      ),
      h('form', { class: 'chip-form', onsubmit: addKeyword }, input),
    );

    let body: HTMLElement;
    if (settings.keywords.length === 0) {
      body = h('p', { class: 'empty' }, '찾고 싶은 키워드를 추가하면, 공지에 그 단어가 올라왔을 때 여기에 모아 보여줍니다.');
    } else if (matches.length === 0) {
      body = h('p', { class: 'empty' }, '현재 공지 목록에 키워드와 맞는 글이 없습니다.');
    } else {
      body = h(
        'ul',
        { class: 'post-list' },
        matches.map((m) =>
          h(
            'li',
            { class: newAtOpen.has(m.key) || m.isNew ? 'post is-new' : 'post' },
            h(
              'a',
              { href: m.post.url, class: 'post-link' },
              h(
                'div',
                { class: 'post-meta' },
                (newAtOpen.has(m.key) || m.isNew) && h('span', { class: 'badge-new' }, 'NEW'),
                h('span', { class: 'src' }, `${m.source.group} · ${m.source.name}`),
                h('span', { class: 'date' }, m.post.date),
              ),
              h('div', { class: 'post-title' }, highlight(m.post.title, m.keywords)),
            ),
          ),
        ),
      );
    }

    return h(
      'section',
      { class: 'card' },
      h('header', { class: 'card-head' }, h('h2', {}, '키워드 공지'), h('span', { class: 'count' }, `${matches.length}건`)),
      coverage,
      chips,
      body,
    );
  },
};
