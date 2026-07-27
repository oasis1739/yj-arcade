import { describe, it, expect } from 'vitest';
import { createStorage } from '../../src/core/storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('createStorage', () => {
  it('값을 저장하고 되읽는다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('best', 120);
    expect(s.get('best')).toBe(120);
  });

  it('객체도 왕복한다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('cfg', { mute: true, level: 3 });
    expect(s.get('cfg')).toEqual({ mute: true, level: 3 });
  });

  it('없는 키는 fallback을 준다', () => {
    const s = createStorage('yj', fakeBackend());
    expect(s.get('nope', 0)).toBe(0);
    expect(s.get('nope')).toBe(null);
  });

  it('prefix를 키에 붙인다', () => {
    const be = fakeBackend();
    createStorage('yj', be).set('best', 1);
    expect([...be.map.keys()]).toEqual(['yj:best']);
  });

  it('remove가 지운다', () => {
    const s = createStorage('yj', fakeBackend());
    s.set('best', 5);
    s.remove('best');
    expect(s.get('best', -1)).toBe(-1);
  });

  it('깨진 JSON이면 fallback을 준다', () => {
    const be = fakeBackend();
    be.map.set('yj:best', '{깨짐');
    expect(createStorage('yj', be).get('best', 0)).toBe(0);
  });

  it('backend가 던져도 앱이 죽지 않는다', () => {
    const throwing = {
      getItem() { throw new Error('보안 오류'); },
      setItem() { throw new Error('용량 초과'); },
      removeItem() { throw new Error('보안 오류'); },
    };
    const s = createStorage('yj', throwing);
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a', 'fallback')).toBe('fallback');
    expect(() => s.remove('a')).not.toThrow();
  });

  it('backend가 아예 없어도 동작한다', () => {
    const s = createStorage('yj', null);
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a', 9)).toBe(9);
  });
});
