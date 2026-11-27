import { departmentPicker } from '@/shared/departmentPicker';
import { h } from '@/shared/dom';
import type { Widget } from '../widget';

/** 이번 탭에서 학과 선택을 진행 중인지 (첫 선택 직후 카드가 사라지지 않도록) */
let inProgress = false;

/** 학과를 아직 고르지 않았으면 새 탭 상단에 학과 선택 카드를 띄운다 */
export const departmentSetupWidget: Widget = {
  id: 'department-setup',
  area: 'main',
  render(ctx) {
    const { settings } = ctx;
    const show = !settings.departmentPromptDismissed && (settings.departmentIds.length === 0 || inProgress);
    if (!show) return h('div', { hidden: true });

    return h(
      'section',
      { class: 'card setup' },
      h(
        'header',
        { class: 'card-head' },
        h('h2', {}, '내 학과 선택'),
        h('span', { class: 'count' }, '학과 공지에서도 키워드를 찾아드려요'),
      ),
      departmentPicker(settings.departmentIds, (ids) => {
        inProgress = true;
        void ctx.updateSettings({ departmentIds: ids });
      }),
      h(
        'div',
        { class: 'row' },
        settings.departmentIds.length > 0
          ? h(
              'button',
              {
                type: 'button',
                class: 'primary',
                onclick: () => {
                  inProgress = false;
                  void ctx.updateSettings({ departmentPromptDismissed: true });
                },
              },
              '완료',
            )
          : h(
              'button',
              {
                type: 'button',
                class: 'ghost',
                onclick: () => void ctx.updateSettings({ departmentPromptDismissed: true }),
              },
              '나중에 (설정에서 선택)',
            ),
      ),
    );
  },
};
