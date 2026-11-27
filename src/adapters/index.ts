import type { Adapter } from '@/core/types';
import { jbnuMainNews, jbnuMainNotice } from './jbnuMain';
import { k2web } from './k2web';

/** 새 CMS 형식을 지원하려면 어댑터를 만들고 여기에 추가한다. */
export const ADAPTERS: Adapter[] = [jbnuMainNotice, jbnuMainNews, k2web];

export function getAdapter(id: string): Adapter | undefined {
  return ADAPTERS.find((a) => a.id === id);
}
