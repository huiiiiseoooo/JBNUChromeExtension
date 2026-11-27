import { localDate, MEAL_PAGE_URL } from '@/features/meal/fetch';
import { h } from '@/shared/dom';
import type { Widget } from '../widget';

const TIMES = ['조식', '점심', '석식'] as const;
let selectedTime: string | undefined;

/** 지금 시각에 맞는 끼니 */
function currentTime(): string {
  const d = new Date();
  const m = d.getHours() * 60 + d.getMinutes();
  if (m < 10 * 60) return '조식';
  if (m < 14 * 60) return '점심';
  return '석식';
}

export const mealWidget: Widget = {
  id: 'meal',
  area: 'side',
  render({ settings, state }) {
    const meal = state.meal;
    const time = selectedTime ?? currentTime();
    const names = Object.keys(meal?.cafeterias ?? {}).filter(
      (n) => settings.cafeterias.length === 0 || settings.cafeterias.includes(n),
    );
    const isToday = meal?.date === localDate(Date.now());

    const tabs = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      TIMES.map((t) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: t === time ? 'tab active' : 'tab',
            'aria-selected': t === time ? 'true' : 'false',
            onclick: (e: Event) => {
              selectedTime = t;
              (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('widget:rerender', { bubbles: true }));
            },
          },
          t,
        ),
      ),
    );

    let body: HTMLElement;
    if (!meal || (!meal.fetchedAt && meal.error)) {
      body = h('p', { class: meal?.error ? 'error' : 'empty' }, meal?.error ? `불러오기 실패: ${meal.error}` : '불러오는 중…');
    } else {
      body = h(
        'div',
        { class: 'meal-list' },
        names.map((name) => {
          const meals = meal.cafeterias[name]?.[time] ?? [];
          return h(
            'div',
            { class: 'meal-cafe' },
            h('div', { class: 'meal-cafe-name' }, name),
            meals.length === 0
              ? h('div', { class: 'meal-none' }, '운영 없음')
              : meals.map((m) =>
                  h(
                    'div',
                    { class: 'meal-corner' },
                    m.corner && h('span', { class: 'meal-corner-name' }, m.corner),
                    h('span', { class: 'meal-items' }, m.items.join(', ')),
                  ),
                ),
          );
        }),
      );
    }

    return h(
      'section',
      { class: 'card' },
      h(
        'header',
        { class: 'card-head' },
        h('h2', {}, '오늘의 식단'),
        h('a', { href: MEAL_PAGE_URL, class: 'more' }, '주간 식단'),
      ),
      meal?.label && !isToday && h('p', { class: 'fetched' }, `${meal.label} 기준`),
      tabs,
      body,
    );
  },
};
