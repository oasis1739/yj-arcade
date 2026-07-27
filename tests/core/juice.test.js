import { describe, it, expect } from 'vitest';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { stubCtx, callNames } from '../helpers/stubCtx.js';

const mk = () => createJuice(makeRng(5));

describe('createJuice — 히트스톱', () => {
  it('처음에는 얼지 않았다', () => {
    expect(mk().frozen()).toBe(false);
  });

  it('hitstop 직후 얼고, 시간이 지나면 풀린다', () => {
    const j = mk();
    j.hitstop(0.1);
    expect(j.frozen()).toBe(true);
    j.update(0.05);
    expect(j.frozen()).toBe(true);
    j.update(0.06);
    expect(j.frozen()).toBe(false);
  });
});

describe('createJuice — 흔들림', () => {
  it('흔들기 전 오프셋은 0이다', () => {
    expect(mk().offset()).toEqual({ x: 0, y: 0 });
  });

  it('흔드는 동안 오프셋이 0이 아니고 크기 안에 있다', () => {
    const j = mk();
    j.shake(10, 0.3);
    j.update(1 / 60);
    const o = j.offset();
    expect(Math.abs(o.x)).toBeLessThanOrEqual(10);
    expect(Math.abs(o.y)).toBeLessThanOrEqual(10);
    expect(Math.abs(o.x) + Math.abs(o.y)).toBeGreaterThan(0);
  });

  it('지속시간이 끝나면 오프셋이 0으로 돌아온다', () => {
    const j = mk();
    j.shake(10, 0.1);
    for (let i = 0; i < 20; i++) j.update(1 / 60);
    expect(j.offset()).toEqual({ x: 0, y: 0 });
  });
});

describe('createJuice — 파티클', () => {
  it('burst가 파티클을 만든다', () => {
    const j = mk();
    j.burst(100, 100, { count: 12 });
    expect(j.count()).toBe(12);
  });

  it('수명이 다하면 사라진다', () => {
    const j = mk();
    j.burst(100, 100, { count: 5, life: 0.1 });
    for (let i = 0; i < 20; i++) j.update(1 / 60);
    expect(j.count()).toBe(0);
  });

  it('draw는 파티클이 있을 때만 그리고 save/restore 짝이 맞는다', () => {
    const j = mk();
    const empty = stubCtx();
    j.draw(empty);
    expect(callNames(empty)).not.toContain('fillRect');

    j.burst(50, 50, { count: 3 });
    const ctx = stubCtx();
    j.draw(ctx);
    const names = callNames(ctx);
    expect(names).toContain('fillRect');
    expect(names.filter((n) => n === 'save').length)
      .toBe(names.filter((n) => n === 'restore').length);
  });

  it('reset이 전부 지운다', () => {
    const j = mk();
    j.burst(1, 1, { count: 9 });
    j.shake(10, 1);
    j.hitstop(1);
    j.reset();
    expect(j.count()).toBe(0);
    expect(j.frozen()).toBe(false);
    expect(j.offset()).toEqual({ x: 0, y: 0 });
  });
});
