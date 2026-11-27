import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handlerAttr, neutralizeHtml } from '@/adapters/util';

// 확장의 CSP 는 인라인 핸들러를 막고, DOMParser 로 읽기만 해도 크롬이 위반 오류를 남긴다.
// 실제 사이트 HTML 을 neutralizeHtml 로 거르면 on* 속성과 script 가 하나도 남지 않아야 한다.
const fixtures = ['jbnu-notice.html', 'jbnu-news.html', 'software-notice.html', 'meal-today.html'];

describe('인라인 핸들러 무력화', () => {
  for (const name of fixtures) {
    it(name, () => {
      const raw = readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8');
      const doc = new DOMParser().parseFromString(neutralizeHtml(raw), 'text/html');
      const inline = [...doc.querySelectorAll('*')].flatMap((el) =>
        [...el.attributes].filter((a) => /^on/i.test(a.name)).map((a) => `<${el.tagName.toLowerCase()} ${a.name}>`),
      );
      expect(inline).toEqual([]);
      expect(doc.querySelectorAll('script')).toHaveLength(0);
    });
  }
  it('값은 data-on… 으로 그대로 읽을 수 있다', () => {
    const doc = new DOMParser().parseFromString(neutralizeHtml(`<a href="#" onclick="go('7')" ONERROR = "x">t</a><p>onclick=text</p>`), 'text/html');
    const a = doc.querySelector('a')!;
    expect(handlerAttr(a, 'click')).toBe("go('7')");
    expect(a.getAttribute('onclick')).toBeNull();
    expect(doc.querySelector('p')!.textContent).toBe('onclick=text'); // 본문 글자는 건드리지 않음
  });
});
