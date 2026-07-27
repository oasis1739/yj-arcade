import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectGames } from '../src/shell/registry.js';
import { stubCtx } from './helpers/stubCtx.js';
import { createFakeApi, driveInput } from './helpers/fakeApi.js';
import { makeRng } from '../src/core/rng.js';

const modules = import.meta.glob('../src/games/*.js', { eager: true });
const { games, errors } = collectGames(modules);

describe('게임 계약 — 전체', () => {
  it('계약 위반 없이 전부 수집된다', () => {
    expect(errors).toEqual([]);
  });

  it('수집된 게임 수가 파일 수와 같다', () => {
    expect(games.length).toBe(Object.keys(modules).length);
  });
});

// 게임이 0개여도 이 파일은 통과해야 한다.
describe.each(games.map((g) => [g.id, g]))('게임 계약 — %s', (id, game) => {
  let timers;
  let originals;

  beforeEach(() => {
    // 게임이 만든 타이머를 dispose가 정리하는지 감시한다.
    timers = { open: new Set(), nextId: 1 };
    originals = {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
    globalThis.setInterval = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.setTimeout = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.clearInterval = (t) => timers.open.delete(t);
    globalThis.clearTimeout = (t) => timers.open.delete(t);
  });

  afterEach(() => {
    Object.assign(globalThis, originals);
  });

  it('아이콘을 그린다', () => {
    const ctx = stubCtx(64, 64);
    expect(() => game.icon(ctx, 64)).not.toThrow();
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('60초를 돌려도 터지지 않는다', () => {
    const ctx = stubCtx();
    const { api, events, setRendering } = createFakeApi(ctx);
    const rng = makeRng(1234);

    game.init(api);
    for (let f = 0; f < 3600; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
      if (f % 10 === 0) {
        setRendering(true);
        game.render(ctx);
        setRendering(false);
      }
    }
    game.dispose();

    expect(events.illegal).toEqual([]);
    expect(ctx.calls.length).toBeGreaterThan(0);
  });

  it('보고하는 점수는 유한한 숫자다', () => {
    const ctx = stubCtx();
    const { api, events } = createFakeApi(ctx);
    const rng = makeRng(77);

    game.init(api);
    for (let f = 0; f < 1800; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
    }
    game.dispose();

    for (const s of events.scores) {
      expect(Number.isFinite(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
    }
    for (const r of events.gameOvers) {
      if (r.score !== undefined) expect(Number.isFinite(r.score)).toBe(true);
    }
  });

  it('render는 상태를 바꾸지 않는다 (두 번 그려도 같은 호출)', () => {
    // api.draw는 이 ctx에 묶여 있으므로 같은 ctx에 두 번 그리고 앞뒤를 비교한다.
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 120; f++) game.update(1 / 60);

    game.render(ctx);
    const first = ctx.calls.map((c) => c[0]).join(',');
    const mark = ctx.calls.length;
    game.render(ctx);
    const second = ctx.calls.slice(mark).map((c) => c[0]).join(',');
    game.dispose();

    expect(second).toBe(first);
  });

  it('dispose가 만든 타이머를 모두 정리한다', () => {
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 60; f++) game.update(1 / 60);
    game.dispose();
    expect([...timers.open]).toEqual([]);
  });

  it('init을 다시 부르면 깨끗하게 재시작한다', () => {
    const ctx = stubCtx();
    const { api, events } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 300; f++) game.update(1 / 60);
    game.dispose();

    const before = events.gameOvers.length;
    game.init(api);
    expect(() => {
      for (let f = 0; f < 60; f++) game.update(1 / 60);
      game.render(ctx);
    }).not.toThrow();
    game.dispose();
    expect(events.gameOvers.length).toBeGreaterThanOrEqual(before);
  });
});
