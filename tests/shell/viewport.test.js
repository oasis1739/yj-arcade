import { describe, it, expect } from 'vitest';
import { computeFit, toLogicalFactory, LOGICAL_W, LOGICAL_H } from '../../src/shell/viewport.js';

describe('computeFit', () => {
  it('논리 해상도는 960x640이다', () => {
    expect([LOGICAL_W, LOGICAL_H]).toEqual([960, 640]);
  });

  it('정확히 맞는 크기는 배율 1, 여백 0이다', () => {
    const f = computeFit(960, 640, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetX).toBe(0);
    expect(f.offsetY).toBe(0);
  });

  it('가로가 남으면 좌우에 여백을 준다', () => {
    const f = computeFit(1920, 640, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetX).toBe(480);
    expect(f.offsetY).toBe(0);
  });

  it('세로가 남으면 위아래에 여백을 준다', () => {
    const f = computeFit(960, 1280, 1);
    expect(f.scale).toBe(1);
    expect(f.offsetY).toBe(320);
  });

  it('작은 화면은 축소한다', () => {
    expect(computeFit(480, 320, 1).scale).toBe(0.5);
  });

  it('devicePixelRatio를 백킹 크기에 반영한다', () => {
    const f = computeFit(960, 640, 2);
    expect(f.backingW).toBe(1920);
    expect(f.backingH).toBe(1280);
    expect(f.scale).toBe(2);
  });
});

describe('toLogicalFactory', () => {
  it('여백 없는 화면은 그대로 매핑한다', () => {
    const to = toLogicalFactory(computeFit(960, 640, 1));
    expect(to(0, 0)).toEqual({ x: 0, y: 0 });
    expect(to(960, 640)).toEqual({ x: 960, y: 640 });
  });

  it('여백과 배율을 되돌린다', () => {
    const fit = computeFit(1920, 640, 1); // offsetX 480, scale 1
    const to = toLogicalFactory(fit);
    expect(to(480, 0)).toEqual({ x: 0, y: 0 });
    expect(to(1440, 640)).toEqual({ x: 960, y: 640 });
  });

  it('축소된 화면도 되돌린다', () => {
    const to = toLogicalFactory(computeFit(480, 320, 1)); // scale 0.5
    expect(to(240, 160)).toEqual({ x: 480, y: 320 });
  });
});
