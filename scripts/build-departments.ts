/**
 * 전북대 학과 목록 + 각 학과 공지사항 게시판 주소를 수집해서
 * src/sources/departments.json 을 만든다.
 *
 *   npx tsx scripts/build-departments.ts
 *
 * 학과 개편/홈페이지 변경 시 다시 실행하면 된다. 요청은 순차로, 간격을 두고 보낸다.
 */
import { JSDOM } from 'jsdom';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://www.jbnu.ac.kr';
const UA = 'Mozilla/5.0 (JBNU keyword notifier; department catalog builder)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, init: RequestInit = {}): Promise<{ url: string; html: string } | null> {
  try {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return { url: res.url, html: await res.text() };
  } catch {
    return null;
  }
}
const doc = (html: string) => new JSDOM(html).window.document;

export interface Department {
  id: string;
  name: string;
  college: string;
  homepage: string;
  /** 공지사항 목록 주소 (K2Web). 찾지 못하면 없음 */
  noticeUrl?: string;
}

/** K2Web 학과 사이트: 루트 → subDomainChk 로 실제 메인 주소를 알아낸다 */
async function resolveMain(homepage: string): Promise<{ url: string; html: string } | null> {
  const origin = new URL(homepage.replace(/^http:/, 'https:')).origin;
  const root = await get(origin + '/');
  if (!root) return null;
  if (!/subDomainChk/.test(root.html)) return root;
  const chk = await get(origin + '/subDomain/subDomainChk.do', { method: 'POST' });
  try {
    const siteUrl = JSON.parse(chk?.html ?? '{}').siteUrl as string | undefined;
    if (siteUrl && siteUrl !== 'noSubDomain') return await get(siteUrl);
  } catch {
    /* noop */
  }
  return null;
}

/** 공지 게시판 후보를 점수순으로. 실제 글이 있는 첫 번째 게시판을 고른다 (빈 게시판 제외) */
async function findNoticeUrl(main: { url: string; html: string }): Promise<string | undefined> {
  for (const url of noticeCandidates(main)) {
    const list = await get(url);
    await sleep(200);
    if (list && /artclLinkView/.test(list.html)) return url;
  }
  return undefined;
}

function noticeCandidates(main: { url: string; html: string }): string[] {
  const d = doc(main.html);
  const links = [...d.querySelectorAll('a[href*="artclList.do"]')] as HTMLAnchorElement[];
  const score = (a: HTMLAnchorElement) => {
    const t = `${a.getAttribute('title') ?? ''} ${a.textContent ?? ''}`.replace(/\s+/g, '');
    if (/학과공지|학부공지|공지사항/.test(t)) return 3;
    if (/공지/.test(t)) return 2;
    return 0;
  };
  const ranked = links.map((a) => ({ a, s: score(a) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s);
  const urls = ranked.map(({ a }) => {
    const u = new URL(a.getAttribute('href')!, main.url);
    u.search = '';
    u.protocol = 'https:';
    return u.toString();
  });
  return [...new Set(urls)];
}

async function main() {
  const home = await get(`${BASE}/web/index.do`);
  if (!home) throw new Error('홈페이지를 불러오지 못했습니다');
  const colleges = new Map<string, string>();
  for (const a of doc(home.html).querySelectorAll('a[href^="/web/unvr/university.do?unq="]')) {
    const name = (a.getAttribute('title') || a.textContent || '').trim();
    if (name && name !== '본부직속') colleges.set(a.getAttribute('href')!, name);
  }

  const depts: Department[] = [];
  const seenHome = new Set<string>();
  for (const [href, college] of colleges) {
    const page = await get(BASE + href);
    await sleep(300);
    if (!page) continue;
    for (const a of doc(page.html).querySelectorAll('a[title$="홈페이지 새 창 열림"]')) {
      const name = a.getAttribute('title')!.replace(/\s*홈페이지 새 창 열림$/, '').trim();
      const homepage = a.getAttribute('href')!;
      if (!/\.jbnu\.ac\.kr/.test(homepage)) continue;
      if (/캠퍼스$/.test(name)) continue; // 캠퍼스 홈페이지는 학과가 아님
      const key = `${name}|${homepage}`;
      if (seenHome.has(key)) continue;
      seenHome.add(key);
      depts.push({ id: '', name, college, homepage });
    }
  }
  console.log(`단과대 ${colleges.size}개, 학과 ${depts.length}개`);

  const mainCache = new Map<string, string | undefined>();
  for (const d of depts) {
    const host = new URL(d.homepage).host;
    if (!mainCache.has(host)) {
      const m = await resolveMain(d.homepage);
      mainCache.set(host, m ? await findNoticeUrl(m) : undefined);
      await sleep(300);
    }
    d.noticeUrl = mainCache.get(host);
    console.log(`${d.noticeUrl ? 'O' : 'X'} ${d.college} / ${d.name} ${d.noticeUrl ?? d.homepage}`);
  }

  // id = 서브도메인 (같은 홈페이지를 쓰는 전공은 -2, -3 …). 저장 데이터 키이므로 안정적이어야 한다.
  const used = new Map<string, number>();
  for (const d of depts) {
    const base = new URL(d.homepage).host.split('.')[0];
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    d.id = n === 1 ? base : `${base}-${n}`;
  }

  const out = resolve(import.meta.dirname, '../src/sources/departments.json');
  writeFileSync(out, JSON.stringify(depts.sort((a, b) => a.college.localeCompare(b.college, 'ko') || a.name.localeCompare(b.name, 'ko')), null, 2) + '\n');
  console.log(`저장: ${out} (공지 게시판 찾음 ${depts.filter((d) => d.noticeUrl).length}/${depts.length})`);
}

void main();
