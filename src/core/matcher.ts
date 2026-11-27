import type { AppState, Post, Settings, Source } from './types';

/** 비교용 정규화: 공백 제거 + 소문자. "국가 장학금" 키워드가 "국가장학금" 제목과도 맞도록. */
function norm(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/** 제목(+분류)에 들어 있는 키워드들을 돌려준다. 없으면 빈 배열. */
export function matchKeywords(post: Post, keywords: string[]): string[] {
  const hay = norm(`${post.category ?? ''} ${post.title}`);
  return keywords.filter((k) => {
    const n = norm(k);
    return n.length > 0 && hay.includes(n);
  });
}

export interface MatchedPost {
  post: Post;
  source: Source;
  keywords: string[];
  key: string;
  isNew: boolean;
}

export const matchKey = (sourceId: string, postId: string) => `${sourceId}:${postId}`;

/** 켜진 공지 소스에서 키워드에 걸린 글 전체 (최신순) */
export function collectMatches(
  sources: Source[],
  state: AppState,
  settings: Settings,
): MatchedPost[] {
  const seen = new Set(state.seenMatchKeys);
  const out: MatchedPost[] = [];
  for (const source of sources) {
    if (source.kind !== 'notice') continue;
    for (const post of state.sources[source.id]?.posts ?? []) {
      const keywords = matchKeywords(post, settings.keywords);
      if (keywords.length === 0) continue;
      const key = matchKey(source.id, post.id);
      out.push({ post, source, keywords, key, isNew: !seen.has(key) });
    }
  }
  // 같은 글이 여러 게시판에 올라온 경우 하나만 남긴다 (제목 기준)
  const unique = new Map<string, MatchedPost>();
  for (const m of out) {
    const t = norm(m.post.title);
    if (!unique.has(t)) unique.set(t, m);
  }
  return [...unique.values()].sort((a, b) => b.post.date.localeCompare(a.post.date));
}
