/**
 * 구글 추천검색어 (크롬 주소창과 같은 서버).
 * 입력한 글자가 구글로 전송된다. 검색 자체는 chrome.search 로 사용자의 기본 검색엔진을 쓴다.
 */
const ENDPOINT = 'https://suggestqueries.google.com/complete/search';

export async function fetchSuggestions(query: string, signal?: AbortSignal): Promise<string[]> {
  const q = query.trim();
  if (!q) return [];
  const url = `${ENDPOINT}?${new URLSearchParams({ client: 'chrome', hl: 'ko', ie: 'utf-8', oe: 'utf-8', q })}`;
  const res = await fetch(url, { signal, credentials: 'omit' });
  if (!res.ok) return [];
  return parseSuggestions(await res.json());
}

/** 응답 형식: [검색어, [추천1, 추천2, …], …] */
export function parseSuggestions(data: unknown): string[] {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  return (data[1] as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 8);
}
