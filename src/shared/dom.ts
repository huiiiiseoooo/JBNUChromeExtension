/** 프레임워크 없이 DOM 을 짧게 만드는 도우미. innerHTML 을 쓰지 않아 XSS 걱정이 없다. */
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
type Child = Node | string | number | null | undefined | false | Child[];

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.className = String(v);
    } else if (v === true) {
      el.setAttribute(k, '');
    } else {
      el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** 텍스트에서 키워드 부분을 <mark> 로 감싼다 (공백 무시 비교는 하지 않고 단순 포함만) */
export function highlight(text: string, keywords: string[]): Child[] {
  const ks = keywords.filter(Boolean).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (ks.length === 0) return [text];
  const re = new RegExp(`(${ks.join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 === 1 ? h('mark', {}, part) : part));
}

export function relativeTime(ts: number): string {
  if (!ts) return '아직 없음';
  const diff = Math.round((Date.now() - ts) / 60_000);
  if (diff < 1) return '방금';
  if (diff < 60) return `${diff}분 전`;
  if (diff < 1440) return `${Math.floor(diff / 60)}시간 전`;
  return `${Math.floor(diff / 1440)}일 전`;
}
