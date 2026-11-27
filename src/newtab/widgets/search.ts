import { fetchSuggestions } from '@/features/search/suggest';
import { h } from '@/shared/dom';
import type { Widget } from '../widget';

/**
 * 검색창 + 추천검색어 드롭다운.
 * 대시보드는 데이터가 바뀔 때마다 다시 그려지므로, 입력 중인 글자와 드롭다운이 사라지지 않게
 * 요소를 한 번만 만들고 재사용한다. 검색은 웹스토어 정책에 맞게 사용자의 기본 검색엔진(chrome.search)으로 한다.
 */
let el: HTMLElement | null = null;

function search(text: string) {
  const q = text.trim();
  if (q) void chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
}

function build(): HTMLElement {
  const input = h('input', {
    type: 'search',
    class: 'search-input',
    placeholder: '검색어 입력',
    'aria-label': '웹 검색',
    autocomplete: 'off',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-controls': 'suggest-list',
    'aria-expanded': 'false',
    autofocus: true,
  });
  const list = h('ul', { class: 'suggest-list', id: 'suggest-list', role: 'listbox', hidden: true });

  let typed = ''; // 사용자가 직접 입력한 글자 (방향키로 고르는 동안 원래 값 복원용)
  let items: string[] = [];
  let active = -1;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ctrl: AbortController | undefined;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };

  const renderList = () => {
    list.replaceChildren(
      ...items.map((s, i) => {
        // 구글처럼 입력한 부분은 보통 글씨, 나머지는 굵게
        const rest = s.toLowerCase().startsWith(typed.toLowerCase()) ? [s.slice(0, typed.length), h('b', {}, s.slice(typed.length))] : [s];
        return h(
          'li',
          {
            role: 'option',
            class: i === active ? 'suggest-item active' : 'suggest-item',
            'aria-selected': i === active ? 'true' : 'false',
            // blur 보다 먼저 처리되도록 mousedown 사용
            onmousedown: (e: Event) => {
              e.preventDefault();
              search(s);
            },
            onmousemove: () => {
              if (active !== i) {
                active = i;
                renderList();
              }
            },
          },
          h('span', { class: 'suggest-icon', 'aria-hidden': 'true' }, '⌕'),
          h('span', { class: 'suggest-text' }, rest),
        );
      }),
    );
    const open = items.length > 0 && document.activeElement === input;
    list.hidden = !open;
    input.setAttribute('aria-expanded', String(open));
  };

  input.addEventListener('input', () => {
    typed = input.value;
    active = -1;
    clearTimeout(timer);
    ctrl?.abort();
    if (!typed.trim()) {
      items = [];
      renderList();
      return;
    }
    timer = setTimeout(async () => {
      ctrl = new AbortController();
      try {
        items = await fetchSuggestions(typed, ctrl.signal);
        renderList();
      } catch {
        /* 네트워크 오류·취소는 무시 (추천 없이 검색은 그대로 가능) */
      }
    }, 120);
  });

  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return; // 한글 조합 중 Enter/방향키는 무시
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      const n = items.length;
      active = e.key === 'ArrowDown' ? (active + 1 >= n ? -1 : active + 1) : active - 1 < -1 ? n - 1 : active - 1;
      input.value = active === -1 ? typed : items[active];
      renderList();
    } else if (e.key === 'Escape') {
      if (!list.hidden) {
        input.value = typed;
        close();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      search(input.value);
    }
  });

  input.addEventListener('focus', () => renderList());
  input.addEventListener('blur', () => close());

  return h('div', { class: 'search' }, input, list);
}

export const searchWidget: Widget = {
  id: 'search',
  area: 'top',
  render() {
    el ??= build();
    return el;
  },
};
