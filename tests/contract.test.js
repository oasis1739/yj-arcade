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
// 화면 밖 좌표를 어디까지 정당한 "화면 밖 스폰"으로 봐줄지의 여유 박스.
// 논리 화면(960x640)의 절반만큼 사방으로 여유를 준다 — 왼쪽 밖에서 등장하는
// 차처럼 의도적인 화면 밖 스폰은 통과시키되, x=5000류의 명백한 오작동은 잡는다.
const SCREEN_MARGIN_X = 480;
const SCREEN_MARGIN_Y = 320;
// 좌표를 갖는 그리기 호출만 뽑는다. ctx.roundRect는 네이티브 Canvas API 메서드고,
// core/draw.js의 roundRect 헬퍼는 beginPath+moveTo+arcTo로 구현되어 있어 실제로는
// moveTo/lineTo 호출로 잡힌다 — 두 경로 다 커버한다.
const COORD_METHODS = new Set(['fillRect', 'strokeRect', 'roundRect', 'rect', 'arc', 'fillText', 'strokeText', 'moveTo', 'lineTo']);

function extractPoints(call) {
  const [method, ...args] = call;
  switch (method) {
    case 'fillRect': case 'strokeRect': case 'roundRect': case 'rect': {
      const [x, y, w, h] = args;
      return [[x, y], [x + w, y + h]];
    }
    case 'arc': {
      const [cx, cy, r] = args;
      return [[cx - r, cy - r], [cx + r, cy + r]];
    }
    case 'fillText': case 'strokeText': {
      const [, x, y] = args;
      return [[x, y]];
    }
    case 'moveTo': case 'lineTo': {
      const [x, y] = args;
      return [[x, y]];
    }
    default:
      return [];
  }
}

describe.each(games.map((g) => [g.id, g]))('게임 계약 — %s', (id, game) => {
  let timers;
  let listeners;
  let rafs;
  let originals;

  beforeEach(() => {
    // 게임이 만든 타이머·리스너·rAF를 dispose가 정리하는지 감시한다. 넷 다
    // 같은 패턴(카운팅 스텁 설치 → afterEach에서 원복)이다.
    timers = { open: new Set(), nextId: 1 };
    listeners = { open: new Map(), nextId: 1 };
    rafs = { open: new Set(), nextId: 1 };
    originals = {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      addEventListener: globalThis.addEventListener,
      removeEventListener: globalThis.removeEventListener,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      cancelAnimationFrame: globalThis.cancelAnimationFrame,
    };
    globalThis.setInterval = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.setTimeout = () => { const t = timers.nextId++; timers.open.add(t); return t; };
    globalThis.clearInterval = (t) => timers.open.delete(t);
    globalThis.clearTimeout = (t) => timers.open.delete(t);

    globalThis.addEventListener = (type, listener) => {
      listeners.open.set(listeners.nextId++, { type, listener });
    };
    globalThis.removeEventListener = (type, listener) => {
      for (const [key, rec] of listeners.open) {
        if (rec.type === type && rec.listener === listener) { listeners.open.delete(key); break; }
      }
    };
    globalThis.requestAnimationFrame = () => { const t = rafs.nextId++; rafs.open.add(t); return t; };
    globalThis.cancelAnimationFrame = (t) => { rafs.open.delete(t); };
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

  it('그리기 호출이 화면 근처에 머문다 (좌표 대부분이 960x640 + 여유 박스 안)', () => {
    // ctx.calls.length > 0만으로는 (0,0)에 점 하나 찍고 끝인 게임도 통과한다.
    // 실제 좌표를 뽑아 화면(+여유 박스) 안에 대부분 들어오는지까지 본다.
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    const rng = makeRng(555);

    game.init(api);
    for (let f = 0; f < 3600; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
      if (f % 10 === 0) game.render(ctx);
    }
    game.dispose();

    const points = [];
    for (const call of ctx.calls) points.push(...extractPoints(call));
    expect(points.length).toBeGreaterThan(0);

    const inBox = points.filter(([x, y]) =>
      x >= -SCREEN_MARGIN_X && x <= 960 + SCREEN_MARGIN_X &&
      y >= -SCREEN_MARGIN_Y && y <= 640 + SCREEN_MARGIN_Y);
    const fraction = inBox.length / points.length;
    expect(fraction).toBeGreaterThanOrEqual(0.85);
  });

  it('배경만 채우고 끝나지 않는다 (60초 동안 배경 채우기보다 뚜렷이 많이 그린다)', () => {
    // d.clear()만 부르는 render()는 프레임당 save/fillRect/restore 3콜만 남긴다.
    // 실제로 뭔가 그리는 게임은 그 몇 배는 더 많은 ctx 호출을 남겨야 한다.
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    const rng = makeRng(777);

    game.init(api);
    let renderCount = 0;
    for (let f = 0; f < 3600; f++) {
      driveInput(api, f, rng);
      game.update(1 / 60);
      if (f % 10 === 0) { game.render(ctx); renderCount++; }
    }
    game.dispose();

    const bareBackgroundCalls = renderCount * 3;
    expect(ctx.calls.length).toBeGreaterThanOrEqual(bareBackgroundCalls * 3);
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

  it('dispose가 만든 타이머·리스너·rAF를 모두 정리한다', () => {
    const ctx = stubCtx();
    const { api } = createFakeApi(ctx);
    game.init(api);
    for (let f = 0; f < 60; f++) game.update(1 / 60);
    game.render(ctx);
    game.dispose();
    expect([...timers.open]).toEqual([]);
    expect([...listeners.open.keys()]).toEqual([]);
    expect([...rafs.open]).toEqual([]);
  });

  // players === 2인 게임에만 적용된다. 1인 게임에서는 skip으로 표시되어
  // 실패하지도, 거짓으로 통과하지도 않는다.
  (game.players === 2 ? it : it.skip)(
    '2인 게임은 60초 안에 승자(1 또는 2)를 onGameOver로 보고한다',
    () => {
      const ctx = stubCtx();
      const { api, events } = createFakeApi(ctx);
      const rng = makeRng(2468);

      game.init(api);
      for (let f = 0; f < 3600; f++) {
        driveInput(api, f, rng);
        game.update(1 / 60);
      }
      game.dispose();

      const hasWinner = events.gameOvers.some((r) => r.winner === 1 || r.winner === 2);
      expect(hasWinner).toBe(true);
    },
  );

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
