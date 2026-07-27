import { describe, it, expect } from 'vitest';
import { createLoop } from '../../src/core/loop.js';

describe('createLoop 고정 타임스텝', () => {
  it('경과 시간만큼 update를 돌린다', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    expect(loop.tick((1000 / 60) * 3)).toBe(3);
    expect(updates).toBe(3);
  });

  it('남은 시간을 버리지 않고 누적한다', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    loop.tick((1000 / 60) * 0.5);
    loop.tick((1000 / 60) * 0.5);
    expect(updates).toBe(1);
  });

  it('긴 정지 후에도 죽음의 나선에 빠지지 않는다 (최대 5스텝)', () => {
    let updates = 0;
    const loop = createLoop({ dt: 1 / 60, update: () => updates++, render: () => {} });
    expect(loop.tick(5000)).toBe(5);
    expect(updates).toBe(5);
  });
});
