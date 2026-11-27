import type { Post, SourceState } from './types';

/**
 * 게시판 여러 페이지 수집 규칙 (순수 함수, 테스트 대상).
 *
 *  - 설정한 기간(lookbackDays) 안의 글을 모으기 위해 1페이지부터 차례로 읽는다.
 *  - 이미 저장된 글을 다시 만나면(따라잡음) 그만 읽는다 → 평소에는 1페이지만 읽는다.
 *  - 상단 고정글은 페이지마다 반복되므로 판단에서 뺀다.
 */

export const LOOKBACK_OPTIONS = [14, 30, 90] as const;

/** 바쁜 게시판(교내공지, 하루 ~10개) 기준으로 기간을 채우는 데 필요한 페이지 수. 최대 40페이지 */
export function maxPagesFor(lookbackDays: number, postsPerPage = 10): number {
  return Math.min(40, Math.max(1, Math.ceil((lookbackDays * 12) / postsPerPage)));
}

/** 오늘로부터 n일 전 (YYYY-MM-DD, 로컬 시간) */
export function cutoffDate(lookbackDays: number, now = Date.now()): string {
  const d = new Date(now - lookbackDays * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type StopReason = 'reached-cutoff' | 'caught-up' | 'no-more' | 'max-pages';

/** 방금 읽은 페이지를 보고 다음 페이지를 더 읽어야 하는지 판단 */
export function nextPageDecision(
  page: Post[],
  ctx: {
    cutoff: string;
    known: Set<string>;
    /** 이 기간으로 끝까지 한 번 다 읽은 적이 있는지 (그렇다면 아는 글을 만나면 멈춘다) */
    prevPassDone: boolean;
    pageNo: number;
    maxPages: number;
  },
): StopReason | 'continue' {
  const normal = page.filter((p) => !p.pinned);
  if (normal.length === 0) return 'no-more';
  const dated = normal.filter((p) => p.date);
  if (dated.length && dated.some((p) => p.date < ctx.cutoff)) return 'reached-cutoff';
  if (ctx.prevPassDone && normal.every((p) => ctx.known.has(p.id))) return 'caught-up';
  if (ctx.pageNo >= ctx.maxPages) return 'max-pages';
  return 'continue';
}

const byNewest = (a: Post, b: Post) =>
  b.date.localeCompare(a.date) || Number(b.id) - Number(a.id) || b.id.localeCompare(a.id);

/**
 * 이전에 저장된 글 + 이번에 읽은 페이지들을 합친다.
 * 기간이 지난 글은 버리고(고정글 제외), 이번에 2페이지 이후에서 처음 발견한 글 목록도 돌려준다
 * (이런 글은 "새 글"이 아니라 기간을 넓혀서 보인 옛 글이므로 배지에서 제외해야 한다).
 */
export function mergePosts(
  prev: SourceState | undefined,
  pages: Post[][],
  cutoff: string,
  stop: StopReason,
): { posts: Post[]; coverageFrom: string; olderFound: Post[] } {
  const known = new Set(prev?.posts.map((p) => p.id) ?? []);
  const map = new Map<string, Post>();
  // 예전 글은 고정 여부를 다시 확인할 수 없으므로 일반글로 둔다 (고정글은 매번 1페이지에 다시 나옴)
  for (const p of prev?.posts ?? []) map.set(p.id, { ...p, pinned: false });
  // 같은 글이 고정글과 일반글로 두 번 나올 수 있으므로 고정 여부는 따로 모은다
  const pinnedIds = new Set(pages.flat().filter((p) => p.pinned).map((p) => p.id));
  const seenThisRun = new Set<string>();
  const olderFound: Post[] = [];
  pages.forEach((page, i) => {
    for (const p of page) {
      if (i > 0 && !p.pinned && !known.has(p.id) && !seenThisRun.has(p.id)) olderFound.push(p);
      seenThisRun.add(p.id);
      map.set(p.id, { ...p, pinned: pinnedIds.has(p.id) });
    }
  });

  const all = [...map.values()].filter((p) => p.pinned || !p.date || p.date >= cutoff);
  const pinned = all.filter((p) => p.pinned);
  const normal = all.filter((p) => !p.pinned).sort(byNewest);

  const fullyCovered =
    stop === 'reached-cutoff' || (stop === 'caught-up' && !!prev?.coverageFrom && prev.coverageFrom <= cutoff);
  const oldest = normal.filter((p) => p.date).at(-1)?.date ?? cutoff;
  const coverageFrom = fullyCovered ? cutoff : oldest > cutoff ? oldest : cutoff;

  return { posts: [...pinned, ...normal], coverageFrom, olderFound };
}
