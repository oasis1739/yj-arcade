import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectGames } from '../src/shell/registry.js';
import { stubCtx } from './helpers/stubCtx.js';
import { createFakeApi, driveInput } from './helpers/fakeApi.js';
import { makeRng } from '../src/core/rng.js';

const modules = import.meta.glob('../src/games/*.js', { eager: true });
const { games, errors } = collectGames(modules);

// ctx.calls 항목은 [메서드명, ...args]. 안정적으로 직렬화하되, 직렬화 불가능한
// 인자(순환 참조, 함수 등)가 섞여도 던지지 않고 String()으로 대체한다.
function serializeCalls(calls) {
  return calls.map((call) => {
    try {
      return JSON.stringify(call);
    } catch {
      return call
        .map((arg) => {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');
    }
  });
}

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
    // 메서드명뿐 아니라 인자까지 비교해야, 내부 카운터로 좌표가 미묘하게
    // 흐르는 render()도 잡아낼 수 있다.
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 120; f++) game.update(1 / 60);

    game.render(ctx);
    const first = serializeCalls(ctx.calls);
    const mark = ctx.calls.length;
    game.render(ctx);
    const second = serializeCalls(ctx.calls.slice(mark));
    game.dispose();

    expect(second).toEqual(first);
  });

  it('dispose가 만든 타이머를 모두 정리한다', () => {
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 60; f++) game.update(1 / 60);
    game.dispose();
    expect([...timers.open]).toEqual([]);
  });

  it('init을 다시 부르면 깨끗하게 재시작한다 (같은 시드+입력 → 같은 결과)', () => {
    // 재시작이 진짜 "깨끗한지"는 관찰 가능한 산출물(그리기 호출, 점수)이
    // 같은 조건에서 결정론적으로 재현되는지로만 검증할 수 있다.
    // 모듈 스코프 등에 상태가 새어 있으면 두 번째 실행이 첫 번째와 갈라진다.
    const SEED = 4242;
    const RNG_SEED = 99;
    const FRAMES = 120;

    function runOnce(ctx) {
      const { api, events } = createFakeApi(ctx, { seed: SEED });
      const rng = makeRng(RNG_SEED);
      game.init(api);
      for (let f = 0; f < FRAMES; f++) {
        driveInput(api, f, rng);
        game.update(1 / 60);
        game.render(ctx);
      }
      game.dispose();
      return { calls: serializeCalls(ctx.calls), scores: events.scores.slice() };
    }

    const runA = runOnce(stubCtx());

    let runB;
    expect(() => {
      runB = runOnce(stubCtx());
    }).not.toThrow();

    expect(runB.calls).toEqual(runA.calls);
    expect(runB.scores).toEqual(runA.scores);
  });
});
