import { describe, it, expect } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

describe('워크스페이스', () => {
  it('런타임 의존성이 0개다', () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it('ES 모듈 워크스페이스다', () => {
    expect(pkg.type).toBe('module');
  });
});
