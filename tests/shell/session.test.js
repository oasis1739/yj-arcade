import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSession, sessionButtons, hitRect } from '../../src/shell/session.js';
import { createRecords } from '../../src/shell/records.js';
import { createStorage } from '../../src/core/storage.js';
import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad, padLayout } from '../../src/core/input.js';
import { stubCtx } from '../helpers/stubCtx.js';

function mem() {
  const map = new Map();
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

// 실제 core.input처럼 setControls로 받은 모드에 맞춰 layout()이 살아 움직이는
// 가짜. 오버레이 그리기 테스트(터치 패드)에 필요하다.
function makeCore(ctx) {
  const controlsSeen = [];
  let controls = 'pointer';
  return {
    controlsSeen,
    input: {
      p1: emptyPad(), p2: emptyPad(),
      pointer: { x: 0, y: 0, down: false, pressed: false, released: false },
      setControls: (m) => { controlsSeen.push(m); controls = m; },
      layout: () => padLayout(960, 640, controls),
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
    const g = fakeGame({
      update() {
        this.log.push('update');
        if (!this.done) {
          this.done = true;
          this.api.onGameOver({ score: 77 });
        }
      },
    });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(records.best('test-game')).toBe(77);
    expect(session.result().isNew).toBe(true);
    const before = g.log.filter((l) => l === 'update').length;
    expect(before).toBe(1);
    session.update(1 / 60);
    expect(g.log.filter((l) => l === 'update').length).toBe(before);
  });

  it('onGameOver를 같은 프레임에서 두 번 불러도 기록은 한 번만 남는다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({
      update() {
        this.api.onGameOver({ score: 5 });
        this.api.onGameOver({ score: 9 });
      },
    });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(records.plays('test-game')).toBe(1);
    expect(records.best('test-game')).toBe(5);
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

  it('paused 상태에서 render하면 일시정지 오버레이와 버튼 라벨을 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame();
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.state()).toBe('paused');

    session.render(ctx);

    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('일시정지');
    expect(texts).toContain('계속하기');
    expect(texts).toContain('다시하기');
    expect(texts).toContain('메뉴로');

    const saveCount = ctx.calls.filter((c) => c[0] === 'save').length;
    const restoreCount = ctx.calls.filter((c) => c[0] === 'restore').length;
    expect(saveCount).toBe(restoreCount);
    expect(saveCount).toBeGreaterThan(0);
  });

  it('game over에서 신기록이면 최종 점수와 신기록 문구를 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame({ update() { this.api.onGameOver({ score: 77 }); } });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(session.result().isNew).toBe(true);

    session.render(ctx);

    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('게임 끝');
    expect(texts).toContain('점수 77');
    expect(texts).toContain('새 최고기록!');

    const saveCount = ctx.calls.filter((c) => c[0] === 'save').length;
    const restoreCount = ctx.calls.filter((c) => c[0] === 'restore').length;
    expect(saveCount).toBe(restoreCount);
    expect(saveCount).toBeGreaterThan(0);
  });

  it('game over에서 신기록이 아니면 기존 최고기록을 보여준다', () => {
    const ctx = stubCtx();
    const { session, records } = mkSession(ctx);
    records.submit('test-game', 999, 'high');

    const g = fakeGame({ update() { this.api.onGameOver({ score: 50 }); } });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(session.result().isNew).toBe(false);

    session.render(ctx);

    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('게임 끝');
    expect(texts).toContain('최고 999');
    expect(texts).not.toContain('새 최고기록!');
  });

  it('stop하면 게임을 dispose하고 idle로 되돌리며 점수/결과를 초기화한다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame({ update() { this.api.onScore(10); } });
    session.start(g);
    session.update(1 / 60);
    expect(session.score()).toBe(10);

    session.stop();

    expect(g.log).toContain('dispose');
    expect(session.state()).toBe('idle');
    expect(session.score()).toBe(0);
    expect(session.result()).toBe(null);
    expect(session.tap(480, 320)).toBe(null);
  });

  it('game over에서 승자가 있으면 승리 문구를 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame({
      players: 2,
      tags: ['action', 'versus'],
      update() { this.api.onGameOver({ score: 10, winner: 2 }); },
    });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(session.result().winner).toBe(2);

    session.render(ctx);

    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('2P 승리!');
    expect(texts).not.toContain('새 최고기록!');
  });

  it('승자가 없으면 승리 문구를 그리지 않는다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame({ update() { this.api.onGameOver({ score: 3 }); } });
    session.start(g);
    session.update(1 / 60);
    session.render(ctx);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts.some((t) => String(t).includes('승리'))).toBe(false);
  });
});

describe('createSession — onGameOver 없이 나가도 진행 상황을 기록한다 (maze-50류 게임)', () => {
  it('onScore로 진행 상황을 알리고 메뉴로 나가면 최고기록에 반영되지만 플레이 횟수는 늘지 않는다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({ update() { this.api.onScore(7); } });
    session.start(g);
    session.update(1 / 60);

    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.tap(B.menu.x + 5, B.menu.y + 5)).toBe('menu');

    expect(records.best('test-game')).toBe(7);
    expect(records.plays('test-game')).toBe(0);
    expect(session.state()).toBe('idle');
  });

  it('onScore를 한 번도 안 부르고 나가면 아무것도 기록되지 않는다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame(); // 기본 update()는 onScore를 부르지 않는다
    session.start(g);
    session.update(1 / 60);

    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    session.tap(B.menu.x + 5, B.menu.y + 5);

    expect(records.best('test-game')).toBe(null);
    expect(records.plays('test-game')).toBe(0);
  });

  it('onGameOver로 정상 종료된 뒤 메뉴로 나가도 두 번 기록되지 않는다', () => {
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({
      update() {
        if (!this.done) {
          this.done = true;
          this.api.onGameOver({ score: 77 });
        }
      },
    });
    session.start(g);
    session.update(1 / 60);
    expect(session.state()).toBe('over');
    expect(records.plays('test-game')).toBe(1);
    expect(records.best('test-game')).toBe(77);

    const B = sessionButtons(960, 640);
    expect(session.tap(B.menu.x + 5, B.menu.y + 5)).toBe('menu');

    expect(records.plays('test-game')).toBe(1);
    expect(records.best('test-game')).toBe(77);
  });

  it('scoreOrder가 low인 게임(예: 스도쿠의 경과 시간)은 onGameOver 없이 나가면 기록하지 않는다', () => {
    // 시간은 작을수록 좋은데, 끝내지 않고 3초 만에 나간 걸 "3초 기록"으로
    // 남기면 거짓 신기록이 된다 — low 게임은 onGameOver로 다 풀었을 때만
    // 진짜 기록이다.
    const { session, records } = mkSession(stubCtx());
    const g = fakeGame({ scoreOrder: 'low', update() { this.api.onScore(3); } });
    session.start(g);
    session.update(1 / 60);

    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    session.tap(B.menu.x + 5, B.menu.y + 5);

    expect(records.best('test-game')).toBe(null);
    expect(records.plays('test-game')).toBe(0);
  });

  it('진행 상황이 있어도 게임이 크래시하면(메뉴로 강제 이동) 그때까지의 진행은 기록된다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = stubCtx();
    const { session, records } = mkSession(ctx, () => {});
    const g = fakeGame({
      update() {
        this.api.onScore(5);
        throw new Error('boom');
      },
    });
    session.start(g);
    expect(() => session.update(1 / 60)).not.toThrow();

    expect(session.state()).toBe('idle');
    expect(records.best('test-game')).toBe(5);
    expect(records.plays('test-game')).toBe(0);
    vi.restoreAllMocks();
  });
});

describe('createSession — 터치 오버레이', () => {
  it('pointer 컨트롤은 오버레이를 그리지 않는다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    session.start(fakeGame({ controls: 'pointer' }));
    session.render(ctx);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBe(0);
  });

  it('dpad 컨트롤은 dpad 존을 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    session.start(fakeGame({ controls: 'dpad' }));
    session.render(ctx);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).not.toContain('A');   // dpad 단독 모드엔 A 버튼이 없다
  });

  it('dpad+a 컨트롤은 dpad와 A 버튼을 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    session.start(fakeGame({ controls: 'dpad+a' }));
    session.render(ctx);
    const arcs = ctx.calls.filter((c) => c[0] === 'arc');
    expect(arcs.length).toBeGreaterThan(0);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('A');
  });

  it('versus 컨트롤은 두 플레이어 존을 모두 그린다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    session.start(fakeGame({ controls: 'versus', players: 2, tags: ['action', 'versus'] }));
    session.render(ctx);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts).toContain('1P');
    expect(texts).toContain('2P');
    expect(texts.filter((t) => t === 'A').length).toBe(2);
  });

  it('오버레이의 노브 위치는 현재 입력 상태를 그대로 읽는다 (update 없이 두 번 그려도 같다)', () => {
    const ctx = stubCtx();
    const { session, core } = mkSession(ctx);
    session.start(fakeGame({ controls: 'dpad' }));
    core.input.p1.x = 0.6;
    core.input.p1.y = -0.3;

    session.render(ctx);
    const first = ctx.calls.filter((c) => c[0] === 'arc').map((c) => JSON.stringify(c));
    const mark = ctx.calls.length;
    session.render(ctx);
    const second = ctx.calls.slice(mark).filter((c) => c[0] === 'arc').map((c) => JSON.stringify(c));

    expect(second).toEqual(first);
  });
});

describe('createSession — api.solo (2P가 진짜 사람인지 셸이 추측하지 않는다)', () => {
  it('게임을 시작하면 api.solo는 true로 시작한다(2P가 있다고 함부로 가정하지 않는다)', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame({ players: 2, tags: ['action', 'versus'] });
    session.start(g);
    expect(g.api.solo).toBe(true);
  });

  it('1인 게임은 일시정지해도 혼자/2인 토글이 뜨지 않고, 그 자리를 탭해도 아무 일도 안 난다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame({ players: 1 });
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.state()).toBe('paused');

    expect(session.tap(B.solo.x + 5, B.solo.y + 5)).toBe(null);
    expect(g.api.solo).toBe(true); // 1인 게임이라 애초에 의미 없는 값이지만 안 뒤집힌다

    session.render(ctx);
    const texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts.some((t) => String(t).includes('AI'))).toBe(false);
    expect(texts.some((t) => String(t).includes('2인'))).toBe(false);
  });

  it('2인 게임은 일시정지 화면에 혼자/2인 토글이 뜨고, 탭하면 api.solo가 뒤집힌다', () => {
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    const g = fakeGame({ players: 2, tags: ['action', 'versus'] });
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    expect(session.state()).toBe('paused');

    session.render(ctx);
    let texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts.some((t) => String(t).includes('AI'))).toBe(true); // 기본은 혼자(AI 상대)

    expect(session.tap(B.solo.x + 5, B.solo.y + 5)).toBe('twoPlayers');
    expect(g.api.solo).toBe(false);

    ctx.calls.length = 0;
    session.render(ctx);
    texts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(texts.some((t) => String(t).includes('2인 대전 중'))).toBe(true);

    expect(session.tap(B.solo.x + 5, B.solo.y + 5)).toBe('solo');
    expect(g.api.solo).toBe(true);
  });

  it('다시하기로 재시작하면 api.solo가 true로 리셋된다', () => {
    const { session } = mkSession(stubCtx());
    const g = fakeGame({ players: 2, tags: ['action', 'versus'] });
    session.start(g);
    const B = sessionButtons(960, 640);
    session.tap(B.pause.x + 5, B.pause.y + 5);
    session.tap(B.solo.x + 5, B.solo.y + 5); // false로 뒤집는다
    expect(g.api.solo).toBe(false);

    session.tap(B.restart.x + 5, B.restart.y + 5);
    expect(g.api.solo).toBe(true);
  });
});

describe('createSession — 게임 예외로부터 셸을 보호한다', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('update가 던지면 로그를 남기고 메뉴로 돌아가며 전파하지 않는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let exited = false;
    const { session } = mkSession(stubCtx(), () => { exited = true; });
    const g = fakeGame({ update() { throw new Error('boom'); } });
    session.start(g);

    expect(() => session.update(1 / 60)).not.toThrow();

    expect(session.state()).toBe('idle');
    expect(session.current()).toBe(null);
    expect(exited).toBe(true);
    expect(console.error).toHaveBeenCalled();
    expect(session.lastError()).toBeTruthy();
  });

  it('render가 던지면 로그를 남기고 메뉴로 돌아가며 전파하지 않는다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let exited = false;
    const { session } = mkSession(stubCtx(), () => { exited = true; });
    const g = fakeGame({ render() { throw new Error('boom'); } });
    session.start(g);

    expect(() => session.render(stubCtx())).not.toThrow();

    expect(session.state()).toBe('idle');
    expect(session.current()).toBe(null);
    expect(exited).toBe(true);
    expect(console.error).toHaveBeenCalled();
  });

  it('render가 던져도 그 다음 render 호출은 아무 것도 안 그리고 조용히 끝난다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ctx = stubCtx();
    const { session } = mkSession(ctx);
    session.start(fakeGame({ render() { throw new Error('boom'); } }));
    session.render(ctx);
    expect(() => session.render(ctx)).not.toThrow();
    expect(session.state()).toBe('idle');
  });
});
