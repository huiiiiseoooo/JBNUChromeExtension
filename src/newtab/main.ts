import '../shared/base.css';
import './newtab.css';
import { collectMatches } from '@/core/matcher';
import { enabledSources, getSettings, getState, onStorageChange, saveSettings } from '@/core/storage';
import type { Settings } from '@/core/types';
import { h, relativeTime } from '@/shared/dom';
import { BUILD_ID, extensionAlive, send } from '@/shared/messages';
import type { WidgetContext } from './widget';
import { WIDGETS } from './widgets';

const root = document.getElementById('app')!;
let newAtOpen = new Set<string>();
/** 백그라운드가 이 페이지와 다른(옛) 빌드로 돌고 있으면 true */
let backgroundOutdated = false;
let firstRender = true;

async function render() {
  // 확장이 업데이트돼서 이 탭이 끊겼으면 새 버전으로 다시 연다 (끊긴 채로 저장소를 읽으면 오류가 남)
  if (!extensionAlive()) {
    location.reload();
    return;
  }
  const [settings, state] = await Promise.all([getSettings(), getState()]);
  const sources = enabledSources(settings);

  if (firstRender) {
    // 탭을 연 시점의 "새 글" 을 기억해 두고, 백그라운드에는 읽음 처리를 요청한다.
    newAtOpen = new Set(collectMatches(sources, state, settings).filter((m) => m.isNew).map((m) => m.key));
    firstRender = false;
  }

  const ctx: WidgetContext = {
    settings,
    state,
    sources,
    newAtOpen,
    updateSettings: async (patch: Partial<Settings>) => {
      await saveSettings(patch);
    },
  };

  // 재사용되는 입력창(검색창, 바로가기 추가 폼)은 새 화면으로 옮겨지는 순간 포커스가 풀리므로,
  // 위젯을 그리기 전에 기억해 두었다가 마지막에 복원한다
  const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
  const sel = focused ? [focused.selectionStart, focused.selectionEnd] : null;

  const areas = { top: h('div', { class: 'area-top' }), main: h('div', { class: 'area-main' }), side: h('div', { class: 'area-side' }) };
  for (const w of WIDGETS) {
    try {
      areas[w.area].append(w.render(ctx));
    } catch (e) {
      console.error(`위젯 ${w.id} 렌더링 실패`, e);
    }
  }

  const fetchedTimes = sources.map((s) => state.sources[s.id]?.fetchedAt ?? 0).filter(Boolean);
  const lastFetched = fetchedTimes.length ? Math.min(...fetchedTimes) : 0;
  const failed = sources.filter((s) => state.sources[s.id]?.error);

  const refreshBtn = h(
    'button',
    {
      type: 'button',
      class: 'ghost',
      onclick: async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '새로고침 중…';
        await send({ type: 'refresh', force: true }).catch(() => undefined);
      },
    },
    '새로고침',
  );

  const footer = h(
    'footer',
    { class: 'status' },
    h('span', {}, `업데이트 ${relativeTime(lastFetched)}`),
    failed.length > 0 &&
      h('span', { class: 'error', title: failed.map((s) => `${s.group} ${s.name}: ${state.sources[s.id]?.error}`).join('\n') }, `${failed.length}개 게시판 불러오기 실패`),
    refreshBtn,
    h('a', { href: chrome.runtime.getURL('options/index.html'), class: 'ghost' }, '설정'),
  );

  const banner =
    backgroundOutdated &&
    h(
      'div',
      { class: 'update-banner' },
      h('span', {}, '확장 프로그램이 업데이트됐어요. 적용해야 새 기능(학과 공지, 식단 등)이 동작해요.'),
      h('button', { type: 'button', class: 'primary', onclick: () => chrome.runtime.reload() }, '업데이트 적용'),
    );

  // 다시 그려도 스크롤 위치가 튀지 않도록 기억했다가 복원
  const prevScroll = root.querySelector<HTMLElement>('.post-list')?.scrollTop ?? 0;

  const layout = h('div', { class: 'layout' }, areas.main, areas.side);
  root.replaceChildren(...[banner, areas.top, layout, footer].filter((x): x is HTMLElement => !!x));

  if (focused?.isConnected && document.activeElement !== focused) {
    focused.focus({ preventScroll: true });
    if (sel && sel[0] != null) focused.setSelectionRange(sel[0], sel[1]);
  }

  limitListHeight(root.querySelector<HTMLElement>('.post-list'), 10, prevScroll);
}

/** 목록이 visible 개보다 길면, visible 번째 글까지만 보이게 높이를 맞추고 나머지는 스크롤 */
function limitListHeight(list: HTMLElement | null, visible: number, scrollTop: number) {
  if (!list) return;
  const items = list.children;
  if (items.length <= visible) return;
  const last = items[visible - 1] as HTMLElement;
  list.style.maxHeight = `${last.offsetTop + last.offsetHeight - list.offsetTop}px`;
  list.classList.add('scrollable');
  list.scrollTop = scrollTop;
}

root.addEventListener('widget:rerender', () => void render());
onStorageChange(() => void render());

// 창을 떠날 때 다시 읽음 처리 (열어둔 동안 들어온 새 글 포함)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void send({ type: 'markAllSeen' }).catch(() => undefined);
  // 업데이트 전에 열어둔 탭으로 돌아오면 새 버전으로 다시 연다
  else if (!extensionAlive()) location.reload();
});

// 이 페이지는 디스크의 새 파일로 열리지만, 백그라운드는 확장을 새로고침하기 전까지 옛 코드로 돈다.
// 빌드 ID 가 다르면 배너로 알려준다 (개발 중 dist 를 다시 빌드했을 때 주로 발생).
void send<{ buildId?: string } | undefined>({ type: 'hello' })
  .then((res) => res?.buildId !== BUILD_ID)
  .catch(() => true)
  .then((outdated) => {
    if (outdated !== backgroundOutdated) {
      backgroundOutdated = outdated;
      void render();
    }
  });

void render().then(() => {
  void send({ type: 'markAllSeen' }).catch(() => undefined);
  // 오래된 데이터면 백그라운드에 갱신 요청 (결과는 storage 변경으로 다시 그려짐)
  void send({ type: 'refresh' }).catch(() => undefined);
});
