import type { Source } from '@/core/types';
import data from './departments.json';

/**
 * 학과 목록. departments.json 은 `npx tsx scripts/build-departments.ts` 로 다시 만들 수 있다.
 * noticeUrl 이 없는 학과는 홈페이지 형식이 달라 자동 연결이 안 된 곳이다
 * (사용자가 설정에서 게시판 주소를 직접 추가할 수 있음).
 */
export interface Department {
  id: string;
  name: string;
  college: string;
  homepage: string;
  noticeUrl?: string;
}

export const DEPARTMENTS: Department[] = data;

export function getDepartment(id: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.id === id);
}

export const deptSourceId = (deptId: string) => `dept:${deptId}`;

/** 선택한 학과 → 공지 게시판 소스 */
export function departmentSources(ids: string[]): Source[] {
  return ids.flatMap((id) => {
    const d = getDepartment(id);
    if (!d?.noticeUrl) return [];
    return [
      {
        id: deptSourceId(d.id),
        name: '학과공지',
        group: d.name,
        kind: 'notice' as const,
        adapter: 'k2web',
        listUrl: d.noticeUrl,
      },
    ];
  });
}

/** 검색용: 공백 무시, 단과대/학과 이름 모두 매칭 */
export function searchDepartments(q: string): Department[] {
  const n = q.replace(/\s+/g, '');
  if (!n) return DEPARTMENTS;
  return DEPARTMENTS.filter((d) => `${d.college}${d.name}`.replace(/\s+/g, '').includes(n));
}
