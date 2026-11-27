import type { AppState, Settings, Source } from '@/core/types';

/** 위젯이 그릴 때 받는 데이터. 새 위젯이 더 필요한 데이터가 있으면 여기에 추가한다. */
export interface WidgetContext {
  settings: Settings;
  state: AppState;
  /** 켜져 있는 소스 */
  sources: Source[];
  /** 이 탭을 연 시점에 "새 글" 이었던 매칭 키 (열자마자 읽음 처리돼도 표시 유지용) */
  newAtOpen: Set<string>;
  /** 설정 일부 변경 */
  updateSettings(patch: Partial<Settings>): Promise<void>;
}

/**
 * 새 탭 대시보드의 위젯 1개.
 * 새 기능(학사일정, 식단, 날씨 등)은 Widget 을 만들고 widgets/index.ts 에 등록하면 된다.
 */
export interface Widget {
  id: string;
  /** 배치 영역 */
  area: 'top' | 'main' | 'side';
  /** 데이터가 바뀔 때마다 다시 호출된다 */
  render(ctx: WidgetContext): HTMLElement;
}
