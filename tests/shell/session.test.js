import { describe, it, expect } from 'vitest';
import { createSession, sessionButtons, hitRect } from '../../src/shell/session.js';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';
import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad } from '../../src/core/input.js';
import { stubCtx } from '../helpers/stubCtx.js';

function mem() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

function makeCore(ctx) {
  const controlsSeen = [];
  return {
    controlsSeen,
    input: {
      p1: emptyPad(), p2: emptyPad(),
      pointer: { x: 0, y: 0, down: false, pressed: false, released: false },
      setControls: (m) => controlsSeen.push(m),
    },
    draw: createDraw(ctx),
    audio: createAudio(null),
    juice: createJuice(makeRng(1)),
    rng: makeRng(1),
  };
}

function fakeGame(over = {}) {
  const log = [];
  return {
    log,
    id: 'test-game', title: '테스트', tags: ['action'], players: 1,
    color: '#39f6ff', controls: 'dpad', scoreOrder: 'high', scoreLabel: '점수',
    icon() {},
    init(api) { log.push('init'); this.api = api; this.t = 0; },
    update(dt) { log.push('update'); this.t += dt; },
    render() { log.push('render'); },
    dispose() { log.push('dispose'); },
    ...over,
  };
}

function mkSession(ctx, onExit = () => {}) {
  const core = makeCore(ctx);
  const records = createRecords(createStorage('yj', mem()));
  return { session: createSession({ core, records, onExit }), core, records };
}

describe('sessionButtons / hitRect', () => {
  it('일시정지 버튼은 우상단에 있다', () => {
    const b = sessionButtons(960, 640);
    expect(b.pause.x).toBeGreaterThan(800);
    expect(b.pause.y).toBeLessThan(80);
  });

  it('hitRect가 안팎을 구분한다', () => {
    const r = { x: 10, y: 10, w: 100, h: 50 };
    expect(hitRect(r, 50, 30)).toBe(true);
    expect(hitRect(r, 5, 30)).toBe(false);
    expect(hitRect(r, 50, 100)).toBe(false);
  });
});

describe('createSession', () => {
  it('처음에는 idle이다', () => {
    const { session } = mkSession(stubCtx());
    expect(session.state()).toBe('idle');
  });

  it('start가 init을 부르고 playing으로 간다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    expect(g.log).toEqual(['init']);
    expect(session.state()).toBe('playing');
  });

  it('start가 게임의 controls를 입력에 알린다', () => {
    const ctx = stubCtx();
    const { session, core } = mkSession(ctx);
    session.start(fakeGame({ controls: 'versus' }));
    expect(core.controlsSeen).toEqual(['versus']);
  });

  it('새 게임을 시작하면 이전 게임을 dispose한다', () => {
    const { session } = mkSession(stubCtx());
    const a = fakeGame();
    const b = fakeGame();
    session.start(a);
    session.start(b);
    expect(a.log).toContain('dispose');
  });

  it('playing이면 update를 흘려보낸다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(1);
  });

  it('일시정지하면 게임 update가 멈춘다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    session.tap(sessionButtons(960, 640).pause.x + 5, sessionButtons(960, 640).pause.y + 5);
    expect(session.state()).toBe('paused');
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(0);
  });

  it('재개하면 다시 돈다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame();
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.tap(B.resume.x + 5, B.resume.y + 5)).toBe('resume');
    expect(session.state()).toBe('playing');
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(1);
  });

  it('onScore를 받아 점수를 들고 있는다', () => {
    const { session } = mkSession(stubCtx());
    session.start(fakeGame({ update() { this.api.onScore(42); } }));
    session.update(1 / 60);
    expect(session.score()).toBe(42);
  });

  it('onGameOver면 over로 가고 기록을 남기고 update를 멈춘다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({ update() { this.api.onGameOver({ score: 77 }); } });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(records.best('test-game')).toBe(77);
    expect(session.result().isNew).toBe(true);
    const before = g.log.filter((l) => l === 'update').length;
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(before);
  });

  it('over 화면에서 다시하기를 누르면 재시작한다', () => {
    const { session } = mkSession(stubCtx());
    let ended = false;
    const g = fakeGame({ update() { if (!ended) { ended = true; this.api.onGameOver({ score: 1 }); } } });
    session.start(g);
    session.update(1 / 60);
    const B = sessionButtons(960, 640);
    expect(session.tap(B.restart.x + 5, B.restart.y + 5)).toBe('restart');
    expect(session.state()).toBe('playing');
    expect(g.log.filter((l) => l === 'init').length).toBe(2);
  });

  it('메뉴로 나가면 dispose하고 onExit을 부른다', () => {
    let exited = false;
    const { session } = mkSession(stubCtx(), () => { exited = true; });
    const g = fakeGame();
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.tap(B.menu.x + 5, B.menu.y + 5)).toBe('menu');
    expect(g.log).toContain('dispose');
    expect(exited).toBe(true);
    expect(session.state()).toBe('idle');
  });

  it('빈 곳을 탭하면 null이다', () => {
    const { session } = mkSession(stubCtx());
    session.start(fakeGame());
    expect(session.tap(480, 320)).toBe(null);
  });

  it('idle에서 render해도 터지지 않는다', () => {
    const { session } = mkSession(stubCtx());
    expect(() => session.render(stubCtx())).not.toThrow();
  });

  it('render는 게임을 그리고 HUD를 얹는다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame();
    session.start(g);
    session.render(ctx);
    expect(g.log).toContain('render');
    expect(ctx.calls.map((c) => c[0])).toContain('fillText');
  });
});
