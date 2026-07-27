// localStorage 래퍼. 사파리 프라이빗 모드·용량 초과에서 예외가 나도 게임이 죽으면 안 된다.
export function createStorage(prefix, backend) {
  const store = backend === undefined
    ? (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null)
    : backend;
  const key = (k) => `${prefix}:${k}`;

  return {
    get(k, fallback = null) {
      if (!store) return fallback;
      try {
        const raw = store.getItem(key(k));
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(k, value) {
      if (!store) return;
      try {
        store.setItem(key(k), JSON.stringify(value));
      } catch {
        /* 저장 실패는 무해하게 무시 */
      }
    },
    remove(k) {
      if (!store) return;
      try {
        store.removeItem(key(k));
      } catch {
        /* 무시 */
      }
    },
  };
}
