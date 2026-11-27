import type { MealState } from '@/core/types';

/**
 * 전북대 식단은 식단 페이지가 CSRF 토큰과 세션 쿠키를 받아
 * POST /cafeteria/dataAjax.do 로 불러온다. 브라우저에서 그 페이지를 열 때와 같은 순서로 요청한다.
 * (로그인 없이 누구나 볼 수 있는 공개 식단)
 */
export const MEAL_PAGE_URL = 'https://www.jbnu.ac.kr/web/unvrslife/campuslife/cafeteria.do';
const MEAL_DATA_URL = 'https://www.jbnu.ac.kr/web/unvrslife/campuslife/cafeteria/dataAjax.do';

/** 식단을 다시 받아야 하는지: 날짜가 바뀌었거나 3시간 넘게 지났으면 */
export function mealIsStale(meal: MealState | undefined, now: number): boolean {
  if (!meal || meal.error || !meal.fetchedAt) return true;
  if (meal.date !== localDate(now)) return true;
  return now - meal.fetchedAt > 3 * 60 * 60_000;
}

export function localDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchMealHtml(timeoutMs: number): Promise<string> {
  const page = await fetch(MEAL_PAGE_URL, { credentials: 'include', signal: AbortSignal.timeout(timeoutMs) });
  if (!page.ok) throw new Error(`식단 페이지 HTTP ${page.status}`);
  const token = (await page.text()).match(/<meta name="_csrf" content="([^"]+)"/)?.[1];
  if (!token) throw new Error('식단 페이지에서 토큰을 찾지 못했습니다');

  const res = await fetch(MEAL_DATA_URL, {
    method: 'POST',
    credentials: 'include',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-CSRF-Token': token,
      AJAX: 'true',
    },
    body: new URLSearchParams({ type: 'rest' }),
  });
  if (!res.ok) throw new Error(`식단 HTTP ${res.status}`);
  return res.text();
}
