import { MAX_SHORTCUTS } from '@/core/storage';
import type { Shortcut } from '@/core/types';
import { h } from '@/shared/dom';
import type { Widget, WidgetContext } from '../widget';

/**
 * 바로가기 (최대 10개). 마지막에 + 칸이 있어서 이름과 주소만 넣으면 바로 추가되고,
 * 마우스를 올리면 × 로 지울 수 있다.
 * 추가 폼은 다시 그려져도 입력 중인 내용이 사라지지 않게 한 번만 만들어 재사용한다.
 */
let ctxRef: WidgetContext | undefined;
let formOpen = false;
let focusOnOpen = false;
let form: HTMLFormElement | undefined;

/** "naver.com" 처럼 쓴 주소도 받아준다. http/https 만 허용 */
export function normalizeUrl(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

function rerender(from: Element) {
  from.dispatchEvent(new CustomEvent('widget:rerender', { bubbles: true }));
}

function buildForm(): HTMLFormElement {
  const name = h('input', { type: 'text', placeholder: '이름', 'aria-label': '바로가기 이름', maxlength: 20 });
  const url = h('input', { type: 'text', placeholder: '주소 (예: naver.com)', 'aria-label': '바로가기 주소' });
  const msg = h('span', { class: 'shortcut-msg', role: 'alert' });
  const reset = () => {
    name.value = '';
    url.value = '';
    msg.textContent = '';
  };
  const cancel = () => {
    reset();
    formOpen = false;
    rerender(f);
  };
  const f = h(
    'form',
    {
      class: 'shortcut-form',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const ctx = ctxRef!;
        const normalized = normalizeUrl(url.value);
        if (!normalized) {
          msg.textContent = '주소를 확인해 주세요';
          url.focus();
          return;
        }
        if (ctx.settings.shortcuts.length >= MAX_SHORTCUTS) {
          msg.textContent = `최대 ${MAX_SHORTCUTS}개까지 만들 수 있어요`;
          return;
        }
        const item: Shortcut = { name: name.value.trim() || new URL(normalized).hostname.replace(/^www\./, ''), url: normalized };
        reset();
        formOpen = false;
        await ctx.updateSettings({ shortcuts: [...ctx.settings.shortcuts, item] });
      },
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key === 'Escape') cancel();
      },
    },
    name,
    url,
    h('button', { type: 'submit', class: 'primary' }, '추가'),
    h('button', { type: 'button', onclick: cancel }, '취소'),
    msg,
  ) as HTMLFormElement;
  return f;
}

export const shortcutsWidget: Widget = {
  id: 'shortcuts',
  area: 'top',
  render(ctx) {
    ctxRef = ctx;
    const list = ctx.settings.shortcuts;
    const canAdd = list.length < MAX_SHORTCUTS;
    if (!canAdd) formOpen = false;

    // 폼이 화면에 붙은 직후(같은 그리기 작업이 끝난 뒤) 이름 칸에 포커스
    if (formOpen && focusOnOpen) {
      focusOnOpen = false;
      queueMicrotask(() => form?.querySelector('input')?.focus());
    }

    const remove = (i: number) => void ctx.updateSettings({ shortcuts: list.filter((_, j) => j !== i) });

    return h(
      'nav',
      { class: 'shortcuts', 'aria-label': '바로가기' },
      list.map((s, i) =>
        h(
          'span',
          { class: 'shortcut-wrap' },
          h('a', { href: s.url, class: 'shortcut', title: s.url }, s.name),
          h(
            'button',
            { type: 'button', class: 'shortcut-del', 'aria-label': `${s.name} 바로가기 삭제`, title: '삭제', onclick: () => remove(i) },
            '×',
          ),
        ),
      ),
      canAdd &&
        (formOpen
          ? (form ??= buildForm())
          : h(
              'button',
              {
                type: 'button',
                class: 'shortcut shortcut-add',
                'aria-label': '바로가기 추가',
                title: `바로가기 추가 (${list.length}/${MAX_SHORTCUTS})`,
                onclick: (e: Event) => {
                  formOpen = true;
                  focusOnOpen = true;
                  rerender(e.currentTarget as Element);
                },
              },
              '+',
            )),
    );
  },
};
