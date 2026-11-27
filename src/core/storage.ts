import type { AppState, Settings, Source } from './types';
import { BUILTIN_SOURCES, DEFAULT_ENABLED_SOURCE_IDS } from '@/sources/catalog';
import { departmentSources, getDepartment } from '@/sources/departments';

/**
 * 저장소 규칙
 *  - Settings : chrome.storage.sync  (기기 간 동기화, 작음)
 *  - AppState : chrome.storage.local (게시글 캐시, 큼)
 * 설정 구조가 바뀌면 SETTINGS_VERSION 을 올리고 migrateSettings 에 변환을 추가한다.
 */
const SETTINGS_KEY = 'settings';
const STATE_KEY = 'state';
export const SETTINGS_VERSION = 3;
export const MAX_SHORTCUTS = 10;

export const DEFAULT_SETTINGS: Settings = {
  keywords: [],
  departmentIds: [],
  cafeterias: [],
  departmentPromptDismissed: false,
  enabledSourceIds: DEFAULT_ENABLED_SOURCE_IDS,
  customSources: [],
  lookbackDays: 30,
  pollMinutes: 30,
  shortcuts: [
    { name: '전북대', url: 'https://www.jbnu.ac.kr/' },
    { name: '오아시스', url: 'https://oasis.jbnu.ac.kr/' },
    { name: 'LMS', url: 'https://lms.jbnu.ac.kr/' },
    { name: '도서관', url: 'https://dl.jbnu.ac.kr/' },
  ],
};

const EMPTY_STATE: AppState = { sources: {}, seenMatchKeys: [], initializedSourceIds: [] };

type Stored<T> = T & { version?: number };

export function migrateSettings(raw: Partial<Stored<Settings>> | undefined): Settings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if ((raw.version ?? 1) < 2) {
    // v1 → v2: 소프트웨어공학과가 고정 소스였던 것을 학과 선택으로 옮긴다
    const old = ['dept-software-notice', 'dept-software-news'];
    if (s.enabledSourceIds.some((id) => old.includes(id))) s.departmentIds = ['software'];
    s.enabledSourceIds = s.enabledSourceIds.filter((id) => !old.includes(id));
    s.shortcuts = s.shortcuts.filter((x) => !x.url.includes('software.jbnu.ac.kr'));
  }
  if ((raw.version ?? 1) < 3) {
    // v2 → v3: 학과 홈페이지 바로가기가 자동 표시였던 것을 일반(지울 수 있는) 바로가기로 저장
    s.shortcuts = withDepartmentShortcuts(s.shortcuts, s.departmentIds);
  }
  delete (s as Partial<Stored<Settings>>).version;
  return s;
}

export async function getSettings(): Promise<Settings> {
  const res = await chrome.storage.sync.get(SETTINGS_KEY);
  return migrateSettings(res[SETTINGS_KEY] as Partial<Stored<Settings>> | undefined);
}

/** 학과 홈페이지를 바로가기에 추가 (이미 있거나 10개가 차면 건너뜀) */
export function withDepartmentShortcuts(shortcuts: Settings['shortcuts'], deptIds: string[]): Settings['shortcuts'] {
  const out = [...shortcuts];
  for (const id of deptIds) {
    const d = getDepartment(id);
    if (!d || out.length >= MAX_SHORTCUTS) continue;
    const host = new URL(d.homepage).host;
    if (out.some((x) => URL.canParse(x.url) && new URL(x.url).host === host)) continue;
    // 학과 홈페이지 주소가 http 로 등록돼 있어도 모두 https 로 열린다
    out.push({ name: d.name, url: d.homepage.replace(/^http:/, 'https:') });
  }
  return out;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const prev = await getSettings();
  const next = { ...prev, ...patch };
  // 새로 고른 학과의 홈페이지를 바로가기에 한 번 추가한다 (이후엔 일반 바로가기처럼 지울 수 있음)
  if (patch.departmentIds) {
    const added = patch.departmentIds.filter((id) => !prev.departmentIds.includes(id));
    if (added.length) next.shortcuts = withDepartmentShortcuts(next.shortcuts, added);
  }
  next.shortcuts = next.shortcuts.slice(0, MAX_SHORTCUTS);
  await chrome.storage.sync.set({ [SETTINGS_KEY]: { ...next, version: SETTINGS_VERSION } });
  return next;
}

export async function getState(): Promise<AppState> {
  const res = await chrome.storage.local.get(STATE_KEY);
  return { ...EMPTY_STATE, ...((res[STATE_KEY] as Partial<AppState> | undefined) ?? {}) };
}

export async function saveState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

/** 켜고 끌 수 있는 소스 (전북대 공통 + 사용자 추가) */
export function toggleableSources(settings: Settings): Source[] {
  return [...BUILTIN_SOURCES, ...settings.customSources];
}

/** 실제로 수집할 소스 = 켜진 공통/사용자 소스 + 선택한 학과 공지 */
export function enabledSources(settings: Settings): Source[] {
  const on = new Set(settings.enabledSourceIds);
  return [
    ...toggleableSources(settings).filter((s) => on.has(s.id)),
    ...departmentSources(settings.departmentIds),
  ];
}

/** 설정/상태가 바뀔 때 호출되는 구독 함수. 해제 함수를 돌려준다. */
export function onStorageChange(cb: (what: 'settings' | 'state') => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'sync' && SETTINGS_KEY in changes) cb('settings');
    if (area === 'local' && STATE_KEY in changes) cb('state');
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
