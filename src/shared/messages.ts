import type { MealState, Post, Source } from '@/core/types';

/** 확장 내부 메시지 (백그라운드 ↔ 페이지 ↔ offscreen). 새 메시지는 여기에 타입을 추가한다. */
export type Message =
  | { type: 'hello' }
  | { type: 'refresh'; force?: boolean }
  | { type: 'markAllSeen' }
  | { type: 'parse'; target: 'offscreen'; html: string; source: Source }
  | { type: 'parseMeal'; target: 'offscreen'; html: string };

/** 빌드마다 바뀌는 ID. 페이지와 백그라운드가 서로 다른 빌드인지 확인할 때 쓴다 */
export const BUILD_ID: string = __BUILD_ID__;

export type ParseResponse = { ok: true; posts: Post[] } | { ok: false; error: string };
export type ParseMealResponse = { ok: true; meal: Omit<MealState, 'fetchedAt'> } | { ok: false; error: string };

/**
 * 확장이 새로고침(업데이트)되면 이미 열려 있던 페이지는 확장과 연결이 끊긴다.
 * 이때 chrome.runtime 은 id 가 사라지고, sendMessage 는 Promise 를 거부하는 대신
 * "Extension context invalidated" 를 동기로 던진다.
 */
export function extensionAlive(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export function send<T = unknown>(msg: Message): Promise<T> {
  try {
    if (!extensionAlive()) return Promise.reject(new Error('Extension context invalidated'));
    return chrome.runtime.sendMessage(msg) as Promise<T>;
  } catch (e) {
    // 동기로 던진 오류도 Promise 거부로 바꿔서, 호출하는 쪽의 .catch() 로 잡히게 한다
    return Promise.reject(e);
  }
}
