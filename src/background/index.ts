import { getAdapter } from '@/adapters';
import { cutoffDate, maxPagesFor, mergePosts, nextPageDecision, type StopReason } from '@/core/collect';
import { collectMatches, matchKey } from '@/core/matcher';
import { enabledSources, getSettings, getState, saveState } from '@/core/storage';
import type { AppState, MealState, Post, Source, SourceState } from '@/core/types';
import { BUILD_ID, type Message, type ParseMealResponse, type ParseResponse } from '@/shared/messages';
import { fetchMealHtml, mealIsStale } from '@/features/meal/fetch';

const ALARM = 'poll';
const OFFSCREEN_URL = 'offscreen/index.html';
const FETCH_TIMEOUT_MS = 15_000;
/** 열린 새 탭에서 refresh 를 요청해도, 이 시간 안에 받은 데이터면 다시 받지 않는다 */
const MIN_REFETCH_MS = 5 * 60_000;
/** 여러 페이지를 읽을 때 사이트에 부담을 주지 않도록 두는 간격 */
const PAGE_DELAY_MS = 300;

// ── 스케줄 ─────────────────────────────────────────────
async function schedule() {
  const { pollMinutes } = await getSettings();
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.create(ALARM, { periodInMinutes: Math.max(5, pollMinutes), delayInMinutes: 0.1 });
}

/** 백그라운드 작업 실패는 화면(게시판별 오류 표시)으로 알리므로, 처리 안 된 Promise 오류로 남기지 않는다 */
const quiet = (p: Promise<unknown>) => void p.catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => quiet(schedule()));
chrome.runtime.onStartup.addListener(() => quiet(schedule()));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes.settings) return;
  const prev = changes.settings.oldValue as { pollMinutes?: number; lookbackDays?: number } | undefined;
  const next = changes.settings.newValue as { pollMinutes?: number; lookbackDays?: number } | undefined;
  if (prev?.pollMinutes !== next?.pollMinutes) quiet(schedule());
  // 기간이 늘면 다시 모으고, 켜진 소스/키워드가 바뀌면 새 소스만 받아온 뒤 배지 갱신
  const lookbackChanged = prev?.lookbackDays !== next?.lookbackDays;
  quiet(refreshAll(lookbackChanged).then(updateBadge));
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) quiet(refreshAll(true));
});

// 툴바 아이콘 클릭 → 대시보드(새 탭) 열기
chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL('newtab/index.html') });
});

// ── 메시지 ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === 'hello') {
    sendResponse({ buildId: BUILD_ID });
    return false;
  }
  // 실패해도 항상 응답해서, 보낸 쪽이 기다리다 끊기거나 처리 안 된 오류가 남지 않게 한다
  const reply = (p: Promise<unknown>) =>
    p.then(
      () => sendResponse({ ok: true }),
      (e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }),
    );
  if (msg.type === 'refresh') {
    void reply(refreshAll(!!msg.force));
    return true;
  }
  if (msg.type === 'markAllSeen') {
    void reply(markAllSeen());
    return true;
  }
  return false;
});

// ── 수집 ───────────────────────────────────────────────
let inflight: Promise<void> | null = null;

function refreshAll(force: boolean): Promise<void> {
  // 알람과 새 탭이 동시에 요청해도 한 번만 실행
  inflight ??= doRefresh(force).finally(() => (inflight = null));
  return inflight;
}

async function doRefresh(force: boolean) {
  const settings = await getSettings();
  const sources = enabledSources(settings);
  const state = await getState();
  const now = Date.now();

  const targets = sources.filter((s) => {
    const prev = state.sources[s.id];
    return force || !prev || now - prev.fetchedAt > MIN_REFETCH_MS;
  });

  const cutoff = cutoffDate(settings.lookbackDays, now);

  // 게시판마다 끝나는 대로 바로 저장 → 처음 여러 페이지를 읽을 때도 화면이 하나씩 채워진다.
  // (비동기 작업 중 다른 곳에서 바뀌었을 수 있으니 잠금 안에서 최신 상태를 다시 읽고 합친다)
  const mealJob = (force || mealIsStale(state.meal, now) ? refreshMeal(now) : Promise.resolve(undefined)).then(
    (meal) =>
      meal &&
      updateState((latest) => {
        latest.meal = meal.ok
          ? meal.value
          : { ...(latest.meal ?? { date: '', label: '', cafeterias: {} }), fetchedAt: latest.meal?.fetchedAt ?? 0, error: meal.error };
      }),
  );

  const sourceJobs = targets.map(async (s) => {
    let result: { pages: Post[][]; stop: StopReason } | { error: string };
    try {
      result = await fetchSource(s, state.sources[s.id], cutoff, settings.lookbackDays);
    } catch (e) {
      result = { error: e instanceof Error ? e.message : String(e) };
    }
    await updateState((latest) => applySourceResult(latest, s, result, cutoff, settings.lookbackDays, now));
  });

  await Promise.all([mealJob, ...sourceJobs]);
  await updateState(pruneSeen);
  await updateBadge();
}

function applySourceResult(
  latest: AppState,
  source: Source,
  result: { pages: Post[][]; stop: StopReason } | { error: string },
  cutoff: string,
  lookbackDays: number,
  now: number,
) {
  const prev = latest.sources[source.id];
  if ('error' in result) {
    latest.sources[source.id] = { ...(prev ?? { posts: [], fetchedAt: 0 }), error: result.error };
    return;
  }
  const merged = mergePosts(prev, result.pages, cutoff, result.stop);
  latest.sources[source.id] = {
    posts: merged.posts,
    fetchedAt: now,
    coverageFrom: merged.coverageFrom,
    passLookback: Math.max(lookbackDays, result.stop === 'caught-up' ? (prev?.passLookback ?? 0) : 0),
  };
  if (!latest.initializedSourceIds.includes(source.id)) {
    // 처음 읽은 소스의 기존 글은 "새 글" 로 치지 않는다 (설치 직후 배지 폭탄 방지)
    latest.initializedSourceIds.push(source.id);
    latest.seenMatchKeys.push(...merged.posts.map((p) => matchKey(source.id, p.id)));
  } else {
    // 기간을 넓혀서 뒤 페이지에서 찾은 옛 글도 "새 글" 이 아니다
    latest.seenMatchKeys.push(...merged.olderFound.map((p) => matchKey(source.id, p.id)));
  }
}

/** 1페이지부터 기간을 채울 때까지 (또는 이미 저장된 글을 만날 때까지) 읽는다 */
async function fetchSource(
  source: Source,
  prev: SourceState | undefined,
  cutoff: string,
  lookbackDays: number,
): Promise<{ pages: Post[][]; stop: StopReason }> {
  const adapter = getAdapter(source.adapter);
  const known = new Set(prev?.posts.map((p) => p.id) ?? []);
  const prevPassDone = (prev?.passLookback ?? 0) >= lookbackDays;
  // 뉴스는 최신 몇 개만 보여주므로 1페이지만
  const paged = source.kind !== 'news' && !!adapter?.pageUrl;
  const maxPages = paged ? maxPagesFor(lookbackDays, adapter!.postsPerPage) : 1;

  const pages: Post[][] = [];
  for (let pageNo = 1; ; pageNo++) {
    const url = paged ? adapter!.pageUrl!(source.listUrl, pageNo) : source.listUrl;
    const posts = await fetchPage(url, source);
    if (pageNo === 1 && posts.length === 0) throw new Error('게시글을 찾지 못했습니다 (사이트 구조 변경 가능성)');
    pages.push(posts);
    const decision = nextPageDecision(posts, { cutoff, known, prevPassDone, pageNo, maxPages });
    if (decision !== 'continue') return { pages, stop: decision };
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }
}

async function fetchPage(url: string, source: Source): Promise<Post[]> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), credentials: 'omit' }).catch(timeoutError);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = await toOffscreen<ParseResponse>({ type: 'parse', target: 'offscreen', html: await res.text(), source });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.posts;
}

type MealResult = { ok: true; value: MealState } | { ok: false; error: string };
async function refreshMeal(now: number): Promise<MealResult> {
  try {
    const html = await fetchMealHtml(FETCH_TIMEOUT_MS).catch(timeoutError);
    const parsed = await toOffscreen<ParseMealResponse>({ type: 'parseMeal', target: 'offscreen', html });
    if (!parsed.ok) throw new Error(parsed.error);
    return { ok: true, value: { ...parsed.meal, fetchedAt: now } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function timeoutError(e: unknown): never {
  if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error('응답 시간 초과');
  throw e;
}

async function toOffscreen<T>(msg: Message): Promise<T> {
  await ensureOffscreen();
  const res = await Promise.race([
    chrome.runtime.sendMessage(msg) as Promise<T | undefined>,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('파서 응답 없음')), FETCH_TIMEOUT_MS)),
  ]);
  if (res === undefined) throw new Error('파서 응답 없음');
  return res;
}

// ── 상태 쓰기 잠금 ─────────────────────────────────────
// 새로고침과 읽음 처리가 동시에 상태를 읽고 써서 서로 덮어쓰지 않도록 한 줄로 세운다.
let stateLock: Promise<unknown> = Promise.resolve();
function updateState(mutate: (s: AppState) => void): Promise<void> {
  const run = stateLock.then(async () => {
    const s = await getState();
    mutate(s);
    await saveState(s);
  });
  stateLock = run.catch(() => undefined);
  return run;
}

let creatingOffscreen: Promise<void> | null = null;
async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  const existing = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [url],
  });
  if (existing.length > 0) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: '게시판 HTML 목록을 파싱하기 위해 필요합니다.',
    })
    .catch((e: unknown) => {
      // 다른 요청이 방금 만들었으면 이미 있으므로 괜찮다
      if (!String(e).includes('single offscreen')) throw e;
    })
    .finally(() => (creatingOffscreen = null));
  await creatingOffscreen;
}

// ── 배지 / 읽음 처리 ───────────────────────────────────
async function updateBadge() {
  const [settings, state] = await Promise.all([getSettings(), getState()]);
  const count = collectMatches(enabledSources(settings), state, settings).filter((m) => m.isNew).length;
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  await chrome.action.setBadgeText({ text: count === 0 ? '' : count > 99 ? '99+' : String(count) });
}

async function markAllSeen() {
  const settings = await getSettings();
  await updateState((state) => {
    const keys = collectMatches(enabledSources(settings), state, settings).map((m) => m.key);
    state.seenMatchKeys = [...new Set([...state.seenMatchKeys, ...keys])];
  });
  await updateBadge();
}

/** 더 이상 목록에 없는 글의 읽음 기록은 지워서 저장소가 계속 커지지 않게 한다 */
function pruneSeen(state: AppState) {
  const alive = new Set<string>();
  for (const [sid, s] of Object.entries(state.sources)) {
    for (const p of s.posts) alive.add(matchKey(sid, p.id));
  }
  state.seenMatchKeys = state.seenMatchKeys.filter((k) => alive.has(k));
}
