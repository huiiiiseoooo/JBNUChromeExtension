import type { Widget } from '../widget';
import { departmentSetupWidget } from './departmentSetup';
import { keywordNoticesWidget } from './keywordNotices';
import { latestNoticesWidget } from './latestNotices';
import { mealWidget } from './meal';
import { newsWidget } from './news';
import { searchWidget } from './search';
import { shortcutsWidget } from './shortcuts';

/**
 * 대시보드에 표시할 위젯 (같은 영역 안에서는 배열 순서 = 화면 순서).
 * 새 기능은 위젯 파일을 만들고 여기에 추가하면 된다.
 */
export const WIDGETS: Widget[] = [
  searchWidget,
  shortcutsWidget,
  departmentSetupWidget,
  keywordNoticesWidget,
  newsWidget,
  mealWidget,
  latestNoticesWidget,
];
