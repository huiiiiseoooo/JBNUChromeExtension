/** 어댑터들이 공통으로 쓰는 작은 도우미 함수 */

export function cleanText(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

/** "2026.11.20", "2026-11-20", "2026/11/20" → "2026-11-20" */
export function normalizeDate(s: string | null | undefined): string {
  const m = cleanText(s).match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

export function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

/** onclick="fn('123')" 같은 문자열에서 따옴표 안 인자들을 꺼낸다 */
export function quotedArgs(s: string | null | undefined): string[] {
  return [...(s ?? '').matchAll(/['"]([^'"]*)['"]/g)].map((m) => m[1]);
}

/**
 * 파싱 전에 HTML 의 인라인 이벤트 속성(onclick, onerror …)을 data-on… 으로 바꾼다.
 * 확장 페이지의 보안 정책(CSP)은 인라인 핸들러를 막는데, DOMParser 로 읽기만 해도
 * 크롬이 "Executing inline event handler violates …" 오류를 남기기 때문이다.
 * <script> 도 실행되진 않지만 필요 없으므로 지운다.
 */
export function neutralizeHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<[a-z][^>]*>/gi, (tag) => tag.replace(/(\s)on([a-z]+)\s*=/gi, '$1data-on$2='));
}

/** 인라인 핸들러 값 읽기 (neutralizeHtml 을 거쳤든 안 거쳤든) */
export function handlerAttr(el: Element, name: string): string | null {
  return el.getAttribute(`data-on${name}`) ?? el.getAttribute(`on${name}`);
}
