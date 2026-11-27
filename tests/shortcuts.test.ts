import { describe, expect, it } from 'vitest';
import { MAX_SHORTCUTS, migrateSettings, withDepartmentShortcuts } from '@/core/storage';
import { parseSuggestions } from '@/features/search/suggest';
import { normalizeUrl } from '@/newtab/widgets/shortcuts';

describe('바로가기', () => {
  it('주소 정규화: 스킴 없으면 https, http(s)만 허용', () => {
    expect(normalizeUrl('naver.com')).toBe('https://naver.com/');
    expect(normalizeUrl('http://a.jbnu.ac.kr/x')).toBe('http://a.jbnu.ac.kr/x');
    expect(normalizeUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeUrl('localhost')).toBeUndefined();
    expect(normalizeUrl('  ')).toBeUndefined();
  });
  it('학과 홈페이지를 한 번 추가하고, 중복과 10개 초과는 건너뛴다', () => {
    const base = [{ name: '전북대', url: 'https://www.jbnu.ac.kr/' }];
    const once = withDepartmentShortcuts(base, ['software']);
    expect(once.map((s) => s.name)).toEqual(['전북대', '소프트웨어공학과']);
    expect(withDepartmentShortcuts(once, ['software'])).toHaveLength(2);
    const full = Array.from({ length: MAX_SHORTCUTS }, (_, i) => ({ name: `s${i}`, url: `https://s${i}.com/` }));
    expect(withDepartmentShortcuts(full, ['software'])).toHaveLength(MAX_SHORTCUTS);
  });
  it('v2 → v3: 선택된 학과 홈페이지가 일반 바로가기로 저장된다', () => {
    const s = migrateSettings({ version: 2, departmentIds: ['software'], shortcuts: [{ name: '전북대', url: 'https://www.jbnu.ac.kr/' }] } as never);
    expect(s.shortcuts.map((x) => x.name)).toEqual(['전북대', '소프트웨어공학과']);
  });
});

describe('추천검색어 응답', () => {
  it('두 번째 배열만 꺼내고 최대 8개', () => {
    const data = ['전북대', Array.from({ length: 15 }, (_, i) => `전북대 ${i}`), [], [], {}];
    expect(parseSuggestions(data)).toHaveLength(8);
    expect(parseSuggestions(['x', ['a', 1, 'b']])).toEqual(['a', 'b']);
    expect(parseSuggestions({})).toEqual([]);
  });
});
