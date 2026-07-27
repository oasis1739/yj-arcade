import { describe, it, expect } from 'vitest';
import {
  emptyPad, KEYMAP_P1, KEYMAP_P2, padFromKeys, padFromGamepad,
  padLayout, padFromTouches, mergePads, createInput,
} from '../../src/core/input.js';

// addEventListener/removeEventListener/dispatch만 있으면 되는 최소 가짜
// EventTarget. jsdom 없이(현재 vitest는 node 환경) createInput의 DOM 결선을
// 테스트하기 위한 것.
function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type, ev = {}) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn(ev);
    },
  };
}

describe('emptyPad', () => {
  it('중립 상태다', () => {
    expect(emptyPad()).toEqual({ x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false });
  });
});

describe('padFromKeys', () => {
  it('좌우 키를 x축으로 바꾼다', () => {
    expect(padFromKeys(new Set(['KeyD']), new Set(), KEYMAP_P1).x).toBe(1);
    expect(padFromKeys(new Set(['KeyA']), new Set(), KEYMAP_P1).x).toBe(-1);
  });

  it('양쪽을 같이 누르면 0이다', () => {
    expect(padFromKeys(new Set(['KeyA', 'KeyD']), new Set(), KEYMAP_P1).x).toBe(0);
  });

  it('아래가 y+ 다', () => {
    expect(padFromKeys(new Set(['KeyS']), new Set(), KEYMAP_P1).y).toBe(1);
    expect(padFromKeys(new Set(['KeyW']), new Set(), KEYMAP_P1).y).toBe(-1);
  });

  it('a는 누른 첫 프레임에만 true다', () => {
    const first = padFromKeys(new Set(['KeyF']), new Set(), KEYMAP_P1);
    expect(first.a).toBe(true);
    expect(first.aHeld).toBe(true);
    const second = padFromKeys(new Set(['KeyF']), new Set(['KeyF']), KEYMAP_P1);
    expect(second.a).toBe(false);
    expect(second.aHeld).toBe(true);
  });

  it('P2는 방향키를 쓴다', () => {
    expect(padFromKeys(new Set(['ArrowRight']), new Set(), KEYMAP_P2).x).toBe(1);
    expect(padFromKeys(new Set(['ArrowRight']), new Set(), KEYMAP_P1).x).toBe(0);
  });
});

describe('padFromGamepad', () => {
  const gp = (axes, buttons) => ({ axes, buttons: buttons.map((p) => ({ pressed: p })) });

  it('게임패드가 없으면 중립을 준다', () => {
    expect(padFromGamepad(null, { a: false, b: false }).pad).toEqual(emptyPad());
  });

  it('스틱을 축으로 바꾸고 데드존을 적용한다', () => {
    expect(padFromGamepad(gp([0.9, 0], [false, false]), { a: false, b: false }).pad.x).toBeCloseTo(0.9);
    expect(padFromGamepad(gp([0.1, 0], [false, false]), { a: false, b: false }).pad.x).toBe(0);
  });

  it('A 버튼 edge를 잡는다', () => {
    const r1 = padFromGamepad(gp([0, 0], [true, false]), { a: false, b: false });
    expect(r1.pad.a).toBe(true);
    const r2 = padFromGamepad(gp([0, 0], [true, false]), r1.next);
    expect(r2.pad.a).toBe(false);
    expect(r2.pad.aHeld).toBe(true);
  });
});

describe('padLayout', () => {
  it('pointer 모드는 존이 없다', () => {
    expect(padLayout(960, 640, 'pointer')).toEqual({ p1: null, p2: null });
  });

  it('dpad 모드는 P1 dpad만 준다', () => {
    const L = padLayout(960, 640, 'dpad');
    expect(L.p1.dpad).toBeTruthy();
    expect(L.p1.a).toBe(null);
    expect(L.p2).toBe(null);
  });

  it('dpad+a 모드는 A 버튼도 준다', () => {
    const L = padLayout(960, 640, 'dpad+a');
    expect(L.p1.a).toBeTruthy();
    expect(L.p1.a.cx).toBeGreaterThan(480); // 오른손 쪽
  });

  it('versus 모드는 두 플레이어 존을 좌우로 나눈다', () => {
    const L = padLayout(960, 640, 'versus');
    expect(L.p1.dpad.cx).toBeLessThan(480);
    expect(L.p2.dpad.cx).toBeGreaterThan(480);
  });
});

describe('padFromTouches', () => {
  const layout = padLayout(960, 640, 'dpad+a');
  const noHeld = { p1: { a: false }, p2: { a: false } };

  it('dpad 중앙을 누르면 0이다', () => {
    const { cx, cy } = layout.p1.dpad;
    const r = padFromTouches([{ x: cx, y: cy }], layout, noHeld);
    expect(r.p1.x).toBe(0);
    expect(r.p1.y).toBe(0);
  });

  it('dpad 오른쪽을 끌면 x가 양수다', () => {
    const { cx, cy, r } = layout.p1.dpad;
    const res = padFromTouches([{ x: cx + r * 0.8, y: cy }], layout, noHeld);
    expect(res.p1.x).toBeGreaterThan(0.5);
  });

  it('A 존을 누르면 a edge가 선다', () => {
    const { cx, cy } = layout.p1.a;
    const res = padFromTouches([{ x: cx, y: cy }], layout, noHeld);
    expect(res.p1.a).toBe(true);
    expect(res.held.p1.a).toBe(true);

    const again = padFromTouches([{ x: cx, y: cy }], layout, res.held);
    expect(again.p1.a).toBe(false);
    expect(again.p1.aHeld).toBe(true);
  });

  it('존 밖 터치는 무시한다', () => {
    const res = padFromTouches([{ x: 480, y: 40 }], layout, noHeld);
    expect(res.p1).toEqual(emptyPad());
  });
});

describe('createInput — 백그라운드 전환 시 터치 정리', () => {
  function setup() {
    const win = fakeTarget();
    const canvas = fakeTarget();
    canvas.setPointerCapture = () => {};
    const doc = fakeTarget();
    doc.hidden = false;
    const input = createInput({
      canvas, win, doc,
      toLogical: (x, y) => ({ x, y }),
      nav: { getGamepads: () => [] },
    });
    const down = (id = 1, x = 100, y = 100) => {
      canvas.dispatch('pointerdown', { pointerId: id, clientX: x, clientY: y, preventDefault() {} });
    };
    return { win, canvas, doc, input, down };
  }

  it('blur에서 눌려있던 터치와 pressed/down 엣지를 지운다', () => {
    const { win, input, down } = setup();
    down();
    input.update();
    expect(input.pointer.down).toBe(true);
    expect(input.pointer.pressed).toBe(true);

    win.dispatch('blur');
    input.update();

    expect(input.pointer.down).toBe(false);
    expect(input.pointer.pressed).toBe(false);
    expect(input.pointer.released).toBe(false);
  });

  it('탭이 백그라운드로 가면(visibilitychange, hidden) 터치를 지운다', () => {
    const { doc, input, down } = setup();
    down();
    input.update();
    expect(input.pointer.down).toBe(true);

    doc.hidden = true;
    doc.dispatch('visibilitychange');
    input.update();

    expect(input.pointer.down).toBe(false);
  });

  it('다시 보여도(hidden=false) 이전 터치가 되살아나지 않는다', () => {
    const { doc, input, down } = setup();
    down();
    input.update();

    doc.hidden = true;
    doc.dispatch('visibilitychange');
    doc.hidden = false;
    doc.dispatch('visibilitychange');
    input.update();

    expect(input.pointer.down).toBe(false);
  });
});

describe('mergePads', () => {
  it('절댓값이 큰 축이 이긴다', () => {
    const a = { ...emptyPad(), x: 0.3 };
    const b = { ...emptyPad(), x: -0.9 };
    expect(mergePads(a, b).x).toBe(-0.9);
  });

  it('버튼은 OR로 합친다', () => {
    const a = { ...emptyPad(), a: true };
    const b = { ...emptyPad(), bHeld: true };
    const m = mergePads(a, b);
    expect(m.a).toBe(true);
    expect(m.bHeld).toBe(true);
  });

  it('null 소스는 건너뛴다', () => {
    expect(mergePads(null, undefined, { ...emptyPad(), y: 1 }).y).toBe(1);
  });
});
