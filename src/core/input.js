// 입력 통합. 순수 함수(테스트 대상)와 DOM 결선(createInput)을 분리한다.
// 축: x는 오른쪽이 +, y는 아래가 + (캔버스 좌표와 같은 방향).

export function emptyPad() {
  return { x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false };
}

export const KEYMAP_P1 = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  a: ['KeyF', 'Space'], b: ['KeyG'],
};

export const KEYMAP_P2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  a: ['Slash', 'ShiftRight'], b: ['Period'],
};

const anyDown = (set, codes) => codes.some((c) => set.has(c));

export function padFromKeys(downSet, prevSet, keymap) {
  const pad = emptyPad();
  pad.x = (anyDown(downSet, keymap.right) ? 1 : 0) - (anyDown(downSet, keymap.left) ? 1 : 0);
  pad.y = (anyDown(downSet, keymap.down) ? 1 : 0) - (anyDown(downSet, keymap.up) ? 1 : 0);
  pad.aHeld = anyDown(downSet, keymap.a);
  pad.bHeld = anyDown(downSet, keymap.b);
  pad.a = pad.aHeld && !anyDown(prevSet, keymap.a);
  pad.b = pad.bHeld && !anyDown(prevSet, keymap.b);
  return pad;
}

const DEAD = 0.2;
const dead = (v) => (Math.abs(v) < DEAD ? 0 : v);

export function padFromGamepad(gp, prev = { a: false, b: false }) {
  if (!gp) return { pad: emptyPad(), next: { a: false, b: false } };
  const pad = emptyPad();
  // 아날로그 스틱과 D패드(버튼 12~15) 둘 다 받는다.
  const dpadX = (gp.buttons?.[15]?.pressed ? 1 : 0) - (gp.buttons?.[14]?.pressed ? 1 : 0);
  const dpadY = (gp.buttons?.[13]?.pressed ? 1 : 0) - (gp.buttons?.[12]?.pressed ? 1 : 0);
  pad.x = dpadX || dead(gp.axes?.[0] ?? 0);
  pad.y = dpadY || dead(gp.axes?.[1] ?? 0);
  const aDown = !!gp.buttons?.[0]?.pressed;
  const bDown = !!gp.buttons?.[1]?.pressed || !!gp.buttons?.[2]?.pressed;
  pad.aHeld = aDown;
  pad.bHeld = bDown;
  pad.a = aDown && !prev.a;
  pad.b = bDown && !prev.b;
  return { pad, next: { a: aDown, b: bDown } };
}

// 터치 오버레이 존. 논리 해상도 기준으로 계산한다.
export function padLayout(w, h, controls) {
  const R = 78;         // dpad 반지름
  const BR = 52;        // 버튼 반지름
  const M = 24;         // 화면 여백
  const none = { p1: null, p2: null };

  if (controls === 'pointer') return none;

  if (controls === 'dpad') {
    return { p1: { dpad: { cx: M + R, cy: h - M - R, r: R }, a: null }, p2: null };
  }

  if (controls === 'dpad+a') {
    return {
      p1: {
        dpad: { cx: M + R, cy: h - M - R, r: R },
        a: { cx: w - M - BR, cy: h - M - BR, r: BR },
      },
      p2: null,
    };
  }

  if (controls === 'versus') {
    return {
      p1: {
        dpad: { cx: M + R, cy: h - M - R, r: R },
        a: { cx: M + R * 2 + BR + 16, cy: h - M - BR, r: BR },
      },
      p2: {
        dpad: { cx: w - M - R, cy: h - M - R, r: R },
        a: { cx: w - M - R * 2 - BR - 16, cy: h - M - BR, r: BR },
      },
    };
  }

  return none;
}

function zonePad(points, zone, prevA) {
  const pad = emptyPad();
  if (!zone) return pad;
  for (const p of points) {
    if (zone.dpad) {
      const dx = p.x - zone.dpad.cx;
      const dy = p.y - zone.dpad.cy;
      const mag = Math.hypot(dx, dy);
      if (mag <= zone.dpad.r * 1.35) {
        if (mag > zone.dpad.r * 0.22) {
          const k = zone.dpad.r * 0.7;
          pad.x = Math.max(-1, Math.min(1, dx / k));
          pad.y = Math.max(-1, Math.min(1, dy / k));
        }
        continue;
      }
    }
    if (zone.a && Math.hypot(p.x - zone.a.cx, p.y - zone.a.cy) <= zone.a.r * 1.2) {
      pad.aHeld = true;
    }
  }
  pad.a = pad.aHeld && !prevA;
  return pad;
}

export function padFromTouches(points, layout, prevHeld) {
  const p1 = zonePad(points, layout.p1, prevHeld?.p1?.a ?? false);
  const p2 = zonePad(points, layout.p2, prevHeld?.p2?.a ?? false);
  return { p1, p2, held: { p1: { a: p1.aHeld }, p2: { a: p2.aHeld } } };
}

export function mergePads(...pads) {
  const out = emptyPad();
  for (const p of pads) {
    if (!p) continue;
    if (Math.abs(p.x) > Math.abs(out.x)) out.x = p.x;
    if (Math.abs(p.y) > Math.abs(out.y)) out.y = p.y;
    out.a ||= p.a;
    out.aHeld ||= p.aHeld;
    out.b ||= p.b;
    out.bHeld ||= p.bHeld;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 결선. 순수 함수들을 실제 이벤트에 묶는다.
// toLogical(clientX, clientY) → { x, y } 논리 좌표 변환기는 main.js가 준다.
export function createInput({ canvas, toLogical, win = globalThis, nav = globalThis.navigator }) {
  const down = new Set();
  let prevKeys = new Set();
  let gpPrev = [{ a: false, b: false }, { a: false, b: false }];
  let touchHeld = { p1: { a: false }, p2: { a: false } };
  let controls = 'pointer';
  let layout = padLayout(960, 640, controls);

  const touches = new Map(); // pointerId → {x, y}
  const p1 = emptyPad();
  const p2 = emptyPad();
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  let pointerDownEdge = false;
  let pointerUpEdge = false;

  const onKeyDown = (e) => {
    down.add(e.code);
    // 방향키·스페이스가 페이지를 스크롤하지 않게 막는다.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => down.delete(e.code);
  const onBlur = () => down.clear();

  const onPointerDown = (e) => {
    const p = toLogical(e.clientX, e.clientY);
    touches.set(e.pointerId, p);
    pointer.x = p.x; pointer.y = p.y;
    pointerDownEdge = true;
    canvas.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    if (!touches.has(e.pointerId)) return;
    const p = toLogical(e.clientX, e.clientY);
    touches.set(e.pointerId, p);
    pointer.x = p.x; pointer.y = p.y;
    e.preventDefault();
  };
  const onPointerUp = (e) => {
    if (touches.delete(e.pointerId)) pointerUpEdge = true;
    e.preventDefault();
  };

  win.addEventListener('keydown', onKeyDown);
  win.addEventListener('keyup', onKeyUp);
  win.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function readGamepads() {
    const list = nav?.getGamepads?.() ?? [];
    const connected = [...list].filter(Boolean);
    const r0 = padFromGamepad(connected[0] ?? null, gpPrev[0]);
    const r1 = padFromGamepad(connected[1] ?? null, gpPrev[1]);
    gpPrev = [r0.next, r1.next];
    return [r0.pad, r1.pad];
  }

  return {
    p1, p2, pointer,

    setControls(mode) {
      controls = mode;
      layout = padLayout(960, 640, mode);
      touchHeld = { p1: { a: false }, p2: { a: false } };
    },

    layout() { return layout; },

    // 매 프레임 게임 update 전에 한 번 호출한다.
    update() {
      const pts = [...touches.values()];
      const t = padFromTouches(pts, layout, touchHeld);
      touchHeld = t.held;
      const [g0, g1] = readGamepads();

      Object.assign(p1, mergePads(padFromKeys(down, prevKeys, KEYMAP_P1), g0, t.p1));
      Object.assign(p2, mergePads(padFromKeys(down, prevKeys, KEYMAP_P2), g1, t.p2));
      prevKeys = new Set(down);

      pointer.down = touches.size > 0;
      pointer.pressed = pointerDownEdge;
      pointer.released = pointerUpEdge;
      pointerDownEdge = false;
      pointerUpEdge = false;
    },

    dispose() {
      win.removeEventListener('keydown', onKeyDown);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      touches.clear();
      down.clear();
    },
  };
}
