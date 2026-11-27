import { h, relativeTime } from '@/shared/dom';
import type { Widget } from '../widget';

const MAX = 8;
let activeTab: string | undefined;

/** 키워드와 상관없이 켜진 게시판별 최신 공지 (탭으로 전환) */
export const latestNoticesWidget: Widget = {
  id: 'latest-notices',
  area: 'side',
  render({ state, sources }) {
    const notices = sources.filter((s) => s.kind === 'notice');
    if (!notices.some((s) => s.id === activeTab)) activeTab = notices[0]?.id;
    const current = notices.find((s) => s.id === activeTab);
    const st = current ? state.sources[current.id] : undefined;
    // 고정 공지가 목록을 다 차지하지 않도록 고정글 3개 + 최신 일반글
    const posts = st?.posts ?? [];
    const pinned = posts.filter((p) => p.pinned).slice(0, 3);
    const normal = posts.filter((p) => !p.pinned);
    const shown = [...pinned, ...normal].slice(0, MAX);


    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      notices.map((s) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: s.id === activeTab ? 'tab active' : 'tab',
            'aria-selected': s.id === activeTab ? 'true' : 'false',
            title: `${s.group} ${s.name}`,
            onclick: (e: Event) => {
              activeTab = s.id;
              (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('widget:rerender', { bubbles: true }));
            },
          },
          s.group === '전북대학교' ? s.name : s.group,
        ),
      ),
    );

    return h(
      'section',
      { class: 'card' },
      h(
        'header',
        { class: 'card-head' },
        h('h2', {}, '최신 공지'),
        current && h('a', { href: current.listUrl, class: 'more' }, '더보기'),
      ),
      tabs,
      !current
        ? h('p', { class: 'empty' }, '설정에서 공지 게시판을 켜주세요.')
        : !st
          ? h('p', { class: 'empty' }, '불러오는 중…')
          : st.error && posts.length === 0
          ? h('p', { class: 'error' }, `불러오기 실패: ${st.error}`)
          : h(
              'ul',
              { class: 'compact-list' },
              shown.map((p) =>
                h(
                  'li',
                  {},
                  h(
                    'a',
                    { href: p.url },
                    p.pinned && h('span', { class: 'pin' }, '공지'),
                    h('span', { class: 'compact-title' }, p.title),
                    h('span', { class: 'date' }, p.date.slice(5)),
                  ),
                ),
              ),
            ),
      st && h('p', { class: 'fetched' }, `업데이트 ${relativeTime(st.fetchedAt)}${st.error ? ' · 최근 시도 실패' : ''}`),
    );
  },
};
