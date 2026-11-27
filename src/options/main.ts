import '../shared/base.css';
import './options.css';
import { ADAPTERS } from '@/adapters';
import { LOOKBACK_OPTIONS } from '@/core/collect';
import { getSettings, getState, MAX_SHORTCUTS, onStorageChange, saveSettings, toggleableSources } from '@/core/storage';
import type { Settings, Shortcut, Source } from '@/core/types';
import { departmentPicker } from '@/shared/departmentPicker';
import { h } from '@/shared/dom';
import { DEPARTMENTS } from '@/sources/departments';

const allSources = (s: Settings): Source[] => [
  ...toggleableSources(s),
  ...DEPARTMENTS.flatMap((d) => (d.noticeUrl ? [{ listUrl: d.noticeUrl } as Source] : [])),
];

const root = document.getElementById('app')!;
const POLL_OPTIONS = [15, 30, 60, 120];

function flash(el: HTMLElement, text: string) {
  el.textContent = text;
  setTimeout(() => (el.textContent = ''), 2000);
}

function keywordsSection(s: Settings) {
  const ta = h('textarea', { rows: 4, placeholder: '쉼표나 줄바꿈으로 구분 (예: 장학, 현장실습, 졸업)' });
  ta.value = s.keywords.join(', ');
  const msg = h('span', { class: 'msg' });
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '키워드'),
    h('p', { class: 'help' }, '공지 제목(말머리 포함)에 이 단어가 들어 있으면 새 탭에 모아 보여주고 아이콘에 개수를 표시합니다. 띄어쓰기와 대소문자는 무시합니다.'),
    ta,
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'primary',
          onclick: async () => {
            const keywords = [...new Set(ta.value.split(/[,\n]/).map((k) => k.trim()).filter(Boolean))];
            await saveSettings({ keywords });
            flash(msg, '저장했습니다');
          },
        },
        '저장',
      ),
      msg,
    ),
  );
}

function departmentSection(s: Settings) {
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '내 학과'),
    h('p', { class: 'help' }, '선택한 학과의 공지사항도 키워드 검색 대상이 되고, 새 탭 바로가기에 학과 홈페이지가 추가됩니다.'),
    departmentPicker(s.departmentIds, (ids) => void saveSettings({ departmentIds: ids })),
  );
}

function sourcesSection(s: Settings) {
  const on = new Set(s.enabledSourceIds);
  const groups = new Map<string, Source[]>();
  for (const src of toggleableSources(s)) groups.set(src.group, [...(groups.get(src.group) ?? []), src]);

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(s.enabledSourceIds);
    if (checked) next.add(id);
    else next.delete(id);
    void saveSettings({ enabledSourceIds: [...next] });
  };
  const removeCustom = (id: string) =>
    void saveSettings({
      customSources: s.customSources.filter((c) => c.id !== id),
      enabledSourceIds: s.enabledSourceIds.filter((x) => x !== id),
    });

  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '확인할 게시판'),
    [...groups].map(([group, list]) =>
      h(
        'fieldset',
        {},
        h('legend', {}, group),
        list.map((src) =>
          h(
            'label',
            { class: 'check' },
            h('input', {
              type: 'checkbox',
              checked: on.has(src.id),
              onchange: (e: Event) => toggle(src.id, (e.target as HTMLInputElement).checked),
            }),
            h('span', {}, src.name),
            h('span', { class: 'kind' }, src.kind === 'news' ? '뉴스' : '공지'),
            h('a', { href: src.listUrl, target: '_blank', class: 'link' }, '열기'),
            src.custom && h('button', { type: 'button', class: 'small', onclick: () => removeCustom(src.id) }, '삭제'),
          ),
        ),
      ),
    ),
  );
}

function customSourceSection(s: Settings) {
  const group = h('input', { type: 'text', placeholder: '학과 이름 (예: 컴퓨터인공지능학부)' });
  const name = h('input', { type: 'text', placeholder: '게시판 이름 (예: 공지사항)' });
  const url = h('input', { type: 'url', placeholder: 'https://○○.jbnu.ac.kr/bbs/…/artclList.do' });
  const msg = h('span', { class: 'msg' });

  const add = async (e: Event) => {
    e.preventDefault();
    const listUrl = url.value.trim().replace(/\?.*$/, '');
    const adapter = ADAPTERS.find((a) => a.id === 'k2web' && a.matchesUrl(listUrl));
    if (!adapter) return flash(msg, '지원하는 형식의 주소가 아닙니다. 학과 게시판 목록 주소(…/artclList.do)를 넣어주세요.');
    if (allSources(s).some((x) => x.listUrl === listUrl)) return flash(msg, '이미 추가된 게시판입니다.');
    const src: Source = {
      id: `custom-${Date.now().toString(36)}`,
      name: name.value.trim() || '공지사항',
      group: group.value.trim() || new URL(listUrl).hostname.split('.')[0],
      kind: 'notice',
      adapter: adapter.id,
      listUrl,
      custom: true,
    };
    await saveSettings({
      customSources: [...s.customSources, src],
      enabledSourceIds: [...s.enabledSourceIds, src.id],
    });
  };

  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '게시판 직접 추가'),
    h(
      'p',
      { class: 'help' },
      '학과 목록에서 자동 연결이 안 되는 학과나, 학과의 다른 게시판(취업·장학 등)을 추가할 수 있어요. 게시판 목록 페이지를 열고 주소창의 주소를 붙여넣으세요. 주소에 /bbs/…/artclList.do 가 들어가는 형식을 지원합니다.',
    ),
    h('form', { class: 'grid-form', onsubmit: add }, group, name, url, h('button', { class: 'primary' }, '추가')),
    msg,
  );
}

async function cafeteriaSection(s: Settings) {
  const names = Object.keys((await getState()).meal?.cafeterias ?? {});
  const list = names.length ? names : ['진수원', '의대식당', '후생관'];
  const shown = (n: string) => s.cafeterias.length === 0 || s.cafeterias.includes(n);
  const toggle = (n: string, checked: boolean) => {
    const cur = list.filter(shown);
    const next = checked ? [...new Set([...cur, n])] : cur.filter((x) => x !== n);
    // 전부 선택 = 빈 배열 (나중에 식당이 추가돼도 자동으로 보이도록)
    void saveSettings({ cafeterias: next.length === list.length ? [] : next });
  };
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '식단'),
    h('p', { class: 'help' }, '새 탭의 "오늘의 식단"에 보여줄 식당을 고르세요.'),
    list.map((n) =>
      h(
        'label',
        { class: 'check' },
        h('input', { type: 'checkbox', checked: shown(n), onchange: (e: Event) => toggle(n, (e.target as HTMLInputElement).checked) }),
        h('span', {}, n),
      ),
    ),
  );
}

function lookbackSection(s: Settings) {
  const labels: Record<number, string> = { 14: '최근 2주', 30: '최근 1개월', 90: '최근 3개월' };
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '키워드 검색 기간'),
    h('p', { class: 'help' }, '이 기간 안에 올라온 공지에서 키워드를 찾습니다. 기간을 늘리면 처음 한 번은 게시판의 지난 페이지들을 읽어오느라 조금 걸려요.'),
    h(
      'select',
      { onchange: (e: Event) => void saveSettings({ lookbackDays: Number((e.target as HTMLSelectElement).value) }) },
      LOOKBACK_OPTIONS.map((d) => h('option', { value: d, selected: d === s.lookbackDays }, labels[d])),
    ),
  );
}

function pollSection(s: Settings) {
  const sel = h(
    'select',
    { onchange: (e: Event) => void saveSettings({ pollMinutes: Number((e.target as HTMLSelectElement).value) }) },
    POLL_OPTIONS.map((m) => h('option', { value: m, selected: m === s.pollMinutes }, m < 60 ? `${m}분마다` : `${m / 60}시간마다`)),
  );
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '확인 주기'),
    h('p', { class: 'help' }, '크롬이 켜져 있는 동안 이 주기로 게시판을 확인합니다. 새 탭을 열 때도 5분 이상 지난 데이터는 새로 받아옵니다.'),
    sel,
  );
}

function shortcutsSection(s: Settings) {
  const ta = h('textarea', { rows: 5, placeholder: '이름 | 주소 (한 줄에 하나)' });
  ta.value = s.shortcuts.map((x) => `${x.name} | ${x.url}`).join('\n');
  const msg = h('span', { class: 'msg' });
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, '새 탭 바로가기'),
    h('p', { class: 'help' }, `새 탭에서 + 를 눌러 바로 추가할 수도 있어요. 여기서는 한 줄에 하나씩 "이름 | 주소" 형식으로 적어주세요 (최대 ${MAX_SHORTCUTS}개).`),
    ta,
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'primary',
          onclick: async () => {
            const shortcuts: Shortcut[] = [];
            for (const line of ta.value.split('\n')) {
              const [n, u] = line.split('|').map((x) => x.trim());
              if (!n || !u) continue;
              try {
                const parsed = new URL(u);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') shortcuts.push({ name: n, url: parsed.toString() });
              } catch {
                /* 잘못된 줄은 건너뜀 */
              }
            }
            if (shortcuts.length > MAX_SHORTCUTS) flash(msg, `최대 ${MAX_SHORTCUTS}개까지만 저장했습니다`);
            await saveSettings({ shortcuts: shortcuts.slice(0, MAX_SHORTCUTS) });
            if (shortcuts.length <= MAX_SHORTCUTS) flash(msg, '저장했습니다');
          },
        },
        '저장',
      ),
      msg,
    ),
  );
}

async function render() {
  const s = await getSettings();
  root.replaceChildren(
    h('h1', {}, '설정'),
    departmentSection(s),
    keywordsSection(s),
    lookbackSection(s),
    sourcesSection(s),
    await cafeteriaSection(s),
    customSourceSection(s),
    pollSection(s),
    shortcutsSection(s),
  );
}

// 텍스트 입력 중에는 다시 그리지 않도록, 게시판 목록 변경 같은 구조 변경 때만 다시 그린다.
let lastShape = '';
onStorageChange(async (what) => {
  if (what !== 'settings') return;
  const s = await getSettings();
  const shape = JSON.stringify([s.enabledSourceIds, s.customSources.map((c) => c.id), s.departmentIds, s.cafeterias]);
  if (shape !== lastShape) {
    lastShape = shape;
    void render();
  }
});
void getSettings().then((s) => {
  lastShape = JSON.stringify([s.enabledSourceIds, s.customSources.map((c) => c.id), s.departmentIds, s.cafeterias]);
  void render();
});
