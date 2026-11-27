import { getAdapter } from '@/adapters';
import { neutralizeHtml } from '@/adapters/util';
import { parseMeal } from '@/features/meal/parse';
import type { Message } from '@/shared/messages';

/**
 * MV3 서비스워커에는 DOMParser 가 없어서,
 * 백그라운드가 받아온 HTML 을 이 offscreen 문서에서 파싱한다.
 */
// 인라인 핸들러를 먼저 무력화해야 CSP 위반 오류가 남지 않는다
const toDoc = (html: string) => new DOMParser().parseFromString(neutralizeHtml(html), 'text/html');
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (!('target' in msg) || msg.target !== 'offscreen') return false;
  try {
    if (msg.type === 'parse') {
      const adapter = getAdapter(msg.source.adapter);
      if (!adapter) throw new Error(`알 수 없는 어댑터: ${msg.source.adapter}`);
      sendResponse({ ok: true, posts: adapter.parse(toDoc(msg.html), msg.source) });
    } else if (msg.type === 'parseMeal') {
      sendResponse({ ok: true, meal: parseMeal(toDoc(msg.html)) });
    }
  } catch (e) {
    sendResponse({ ok: false, error: errMsg(e) });
  }
  return false;
});
