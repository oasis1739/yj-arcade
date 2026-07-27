import { describe, it, expect } from 'vitest';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';

function mem() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
const mk = () => createRecords(createStorage('yj', mem()));

describe('createRecords', () => {
  it('기록이 없으면 null이다', () => {
    expect(mk().best('neon-snake')).toBe(null);
  });

  it('첫 제출은 항상 신기록이다', () => {
    const r = mk();
    expect(r.submit('neon-snake', 10)).toEqual({ best: 10, isNew: true });
  });

  it('high 정렬은 큰 값만 갱신한다', () => {
    const r = mk();
    r.submit('neon-snake', 10);
    expect(r.submit('neon-snake', 5)).toEqual({ best: 10, isNew: false });
    expect(r.submit('neon-snake', 20)).toEqual({ best: 20, isNew: true });
    expect(r.best('neon-snake')).toBe(20);
  });

  it('low 정렬은 작은 값만 갱신한다', () => {
    const r = mk();
    r.submit('sliding-puzzle', 40, 'low');
    expect(r.submit('sliding-puzzle', 55, 'low')).toEqual({ best: 40, isNew: false });
    expect(r.submit('sliding-puzzle', 22, 'low')).toEqual({ best: 22, isNew: true });
  });

  it('플레이 횟수를 센다', () => {
    const r = mk();
    expect(r.plays('neon-snake')).toBe(0);
    r.submit('neon-snake', 1);
    r.submit('neon-snake', 2);
    expect(r.plays('neon-snake')).toBe(2);
  });

  it('게임끼리 기록이 섞이지 않는다', () => {
    const r = mk();
    r.submit('a', 10);
    r.submit('b', 99);
    expect(r.best('a')).toBe(10);
    expect(r.best('b')).toBe(99);
  });

  it('숫자가 아닌 점수는 무시한다', () => {
    const r = mk();
    expect(r.submit('a', NaN)).toEqual({ best: null, isNew: false });
    expect(r.best('a')).toBe(null);
  });
});
