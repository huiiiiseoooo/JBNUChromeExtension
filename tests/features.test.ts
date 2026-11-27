import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { neutralizeHtml } from '@/adapters/util';
import { getAdapter } from '@/adapters';
import { migrateSettings } from '@/core/storage';
import { parseMeal } from '@/features/meal/parse';
import { DEPARTMENTS, departmentSources, searchDepartments } from '@/sources/departments';

const load = (name: string) =>
  new DOMParser().parseFromString(neutralizeHtml(readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8')), 'text/html');

describe('식단 파서', () => {
  const meal = parseMeal(load('meal-today.html'));
  it('날짜와 식당을 읽는다', () => {
    expect(meal.date).toBe('2026-11-23');
    expect(Object.keys(meal.cafeterias)).toEqual(['진수원', '의대식당', '후생관']);
  });
  it('끼니별 메뉴를 읽고 운영없음은 뺀다', () => {
    expect(meal.cafeterias['진수원']['점심'][0]).toEqual({
      corner: '백반',
      items: ['버섯샤브국', '돈사태김치찜', '베이컨감자채볶음', '비빔만두'],
    });
    expect(meal.cafeterias['진수원']['조식']).toBeUndefined();
    const corners = meal.cafeterias['후생관']['점심'].map((m) => m.corner);
    expect(corners).toContain('특식');
    expect(corners).not.toContain('돌솥'); // 운영없음
  });
});

describe('설정 마이그레이션', () => {
  it('v1 소프트웨어공학과 고정 소스 → 학과 선택으로 옮긴다', () => {
    const s = migrateSettings({
      keywords: ['장학'],
      enabledSourceIds: ['jbnu-notice-campus', 'dept-software-notice'],
      shortcuts: [
        { name: '전북대', url: 'https://www.jbnu.ac.kr/' },
        { name: '소프트웨어공학과', url: 'https://software.jbnu.ac.kr/software/index.do' },
      ],
    });
    expect(s.departmentIds).toEqual(['software']);
    expect(s.enabledSourceIds).toEqual(['jbnu-notice-campus']);
    // 옛 소프트웨어공학과 고정 바로가기는 지우고, v3 단계에서 학과 홈페이지 바로가기로 다시 들어간다
    expect(s.shortcuts.map((x) => x.name)).toEqual(['전북대', '소프트웨어공학과']);
    expect(s.shortcuts[1].url).toBe('https://software.jbnu.ac.kr');
    expect(s.keywords).toEqual(['장학']);
  });
  it('처음 설치면 학과 미선택', () => {
    expect(migrateSettings(undefined).departmentIds).toEqual([]);
  });
});

describe('학과 목록', () => {
  it('ID 가 고유하고 공지 주소가 K2Web 형식이다', () => {
    const ids = DEPARTMENTS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const k2 = getAdapter('k2web')!;
    for (const d of DEPARTMENTS) if (d.noticeUrl) expect(k2.matchesUrl(d.noticeUrl), d.name).toBe(true);
    expect(DEPARTMENTS.filter((d) => d.noticeUrl).length).toBeGreaterThan(60);
  });
  it('검색과 소스 변환', () => {
    expect(searchDepartments('소프트웨어').map((d) => d.id)).toContain('software');
    expect(searchDepartments('컴퓨터 인공').map((d) => d.id)).toContain('csai');
    const [src] = departmentSources(['software', 'no-such-dept']);
    expect(src.id).toBe('dept:software');
    expect(src.listUrl).toBe('https://software.jbnu.ac.kr/bbs/software/527/artclList.do');
  });
});
