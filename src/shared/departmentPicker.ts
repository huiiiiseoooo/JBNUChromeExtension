import { DEPARTMENTS, getDepartment, searchDepartments } from '@/sources/departments';
import { h } from './dom';

/**
 * 학과 검색 + 다중 선택 컴포넌트 (새 탭, 설정 화면 공용).
 * 페이지가 저장소 변경 때마다 다시 그려지므로, 검색어와 포커스는 모듈 변수로 유지한다.
 */
let query = '';
let refocus = false;
const MAX_RESULTS = 8;

export function departmentPicker(selected: string[], onChange: (ids: string[]) => void): HTMLElement {
  const input = h('input', {
    type: 'search',
    class: 'dept-search',
    placeholder: '학과 이름 검색 (예: 경영, 컴퓨터, 간호)',
    'aria-label': '학과 검색',
    value: query,
  });

  const results = h('ul', { class: 'dept-results' });
  const renderResults = () => {
    const list = query.trim() ? searchDepartments(query).slice(0, MAX_RESULTS) : [];
    results.replaceChildren(
      ...list.map((d) => {
        const on = selected.includes(d.id);
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: on ? 'dept-option on' : 'dept-option',
              disabled: !d.noticeUrl && !on,
              title: d.noticeUrl ? '' : '이 학과 홈페이지는 아직 자동 연결을 지원하지 않습니다. 설정에서 게시판 주소를 직접 추가해 주세요.',
              onclick: () => {
                refocus = true;
                onChange(on ? selected.filter((x) => x !== d.id) : [...selected, d.id]);
              },
            },
            h('span', { class: 'dept-name' }, d.name),
            h('span', { class: 'dept-college' }, d.noticeUrl ? d.college : `${d.college} · 자동 연결 안 됨`),
            h('span', { class: 'dept-check' }, on ? '✓' : '+'),
          ),
        );
      }),
    );
    if (query.trim() && list.length === 0) results.append(h('li', { class: 'empty' }, '검색 결과가 없습니다.'));
  };
  input.addEventListener('input', () => {
    query = input.value;
    renderResults();
  });
  renderResults();

  if (refocus) {
    refocus = false;
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  const chips = h(
    'div',
    { class: 'chips' },
    selected.map((id) => {
      const d = getDepartment(id);
      return h(
        'span',
        { class: 'chip' },
        d?.name ?? id,
        h(
          'button',
          {
            type: 'button',
            class: 'chip-x',
            'aria-label': `${d?.name ?? id} 선택 해제`,
            onclick: () => onChange(selected.filter((x) => x !== id)),
          },
          '×',
        ),
      );
    }),
  );

  return h(
    'div',
    { class: 'dept-picker' },
    selected.length > 0 && chips,
    input,
    results,
    h('p', { class: 'help' }, `전북대 ${DEPARTMENTS.length}개 학과 중 선택할 수 있어요. 복수전공·부전공이면 여러 개 고르세요.`),
  );
}
