import { describe, it, expect } from 'vitest';
import { makeRng } from '../../src/core/rng.js';

describe('makeRng', () => {
  it('같은 시드는 같은 수열을 낸다', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열을 낸다', () => {
    expect(makeRng(1).next()).not.toBe(makeRng(2).next());
  });

  it('next는 0 이상 1 미만이다', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n)은 0..n-1을 낸다', () => {
    const r = makeRng(3);
    for (let i = 0; i < 500; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('range(a,b)는 a 이상 b 미만이다', () => {
    const r = makeRng(9);
    for (let i = 0; i < 200; i++) {
      const v = r.range(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });

  it('pick은 배열 원소를 낸다', () => {
    const r = makeRng(11);
    const arr = ['가', '나', '다'];
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });

  it('시드 0도 안전하게 동작한다', () => {
    const r = makeRng(0);
    expect(r.next()).toBeGreaterThanOrEqual(0);
    expect(r.next()).toBeLessThan(1);
  });
});
