import type { Meal, MealState } from '@/core/types';
import { cleanText } from '@/adapters/util';

/**
 * 전북대 식단 (식당별 식단, 오늘) HTML → MealState.
 * 표 구조: thead 에 식당 이름들, tbody 각 행 = 끼니(조식/점심/석식), 셀 = dl.txt-list-02 (dt 코너 / dd 메뉴)
 */
export function parseMeal(doc: Document): Omit<MealState, 'fetchedAt'> {
  const label = cleanText(doc.querySelector('.com-move-box-02 .title')?.textContent);
  const m = label.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const date = m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';

  const names = [...doc.querySelectorAll('thead th')].slice(1).map((th) => cleanText(th.textContent));
  if (names.length === 0) throw new Error('식단 표를 찾지 못했습니다');
  const cafeterias: MealState['cafeterias'] = Object.fromEntries(names.map((n) => [n, {}]));

  doc.querySelectorAll('tbody tr').forEach((tr) => {
    const time = cleanText(tr.querySelector('th')?.textContent);
    if (!time) return;
    tr.querySelectorAll('td').forEach((td, i) => {
      const name = names[i];
      if (!name) return;
      const meals: Meal[] = [];
      td.querySelectorAll('dl').forEach((dl) => {
        const corner = cleanText(dl.querySelector('dt')?.textContent);
        const items = (dl.querySelector('dd')?.textContent ?? '')
          .split('\n')
          .map((x) => cleanText(x))
          .filter((x) => x && x !== '*');
        if (items.length === 0 || items.every((x) => x === '운영없음')) return;
        meals.push({ corner, items });
      });
      if (meals.length) cafeterias[name][time] = meals;
    });
  });

  return { date, label, cafeterias };
}
