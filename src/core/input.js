// 입력 통합. 순수 함수(테스트 대상)와 DOM 결선(createInput)을 분리한다.
// 축: x는 오른쪽이 +, y는 아래가 + (캔버스 좌표와 같은 방향).

export function emptyPad() {
  return {
    x: 0, y: 0, a: false, aHeld: false, b: false, bHeld: false,
    // stepX/stepY: 이산(discrete) 방향 신호. 연속 x/y와 달리 "눌림"이 아니라
    // "한 번의 의도된 입력"을 나타낸다 — 격자 위를 한 칸씩 움직이는 게임(길
    // 건너기 로봇류)은 x/y가 아니라 이걸 써야 한다. 계속 이동하는 게임(플랫폼
    // 이동, 슈팅 등)은 그대로 x/y를 쓴다. 값·타이밍은 createAxisStepper 참고.
    stepX: 0, stepY: 0,
  };
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

// 방향패드 데드존. 논리 반지름의 이 비율 안쪽은 전부 중립으로 본다.
//
// iPhone 가로모드 실측(논리 960×640 → 844×390 CSS, scale 0.609, dpad
// 반지름 R=78 논리px) 기준: 예전 값 0.22 → 17.2 논리px → 기기 10.5pt. 엄지
// 접촉면은 보통 23~34pt(반지름 11.5~17pt)라서, 그냥 얹어 쉬기만 해도
// 데드존을 넘어 "눌림"으로 읽혔다. 0.42 → 32.76 논리px → 기기 약 20.0pt로
// 올려, 엄지 접촉 반지름(최대 17pt)을 여유 있게 넘도록 한다. 그러면서도
// 등록 반경(r*1.35=105.3 논리px)까지는 여전히 넉넉히 남아 패드가 쓸만하다.
const TOUCH_DEADZONE_FRACTION = 0.42;

function zonePad(points, zone, prevA) {
  const pad = emptyPad();
  if (!zone) return pad;
  for (const p of points) {
    if (zone.dpad) {
      const dx = p.x - zone.dpad.cx;
      const dy = p.y - zone.dpad.cy;
      const mag = Math.hypot(dx, dy);
      if (mag <= zone.dpad.r * 1.35) {
        if (mag > zone.dpad.r * TOUCH_DEADZONE_FRACTION) {
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
    if (Math.abs(p.stepX) > Math.abs(out.stepX)) out.stepX = p.stepX;
    if (Math.abs(p.stepY) > Math.abs(out.stepY)) out.stepY = p.stepY;
    out.a ||= p.a;
    out.aHeld ||= p.aHeld;
    out.b ||= p.b;
    out.bHeld ||= p.bHeld;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 이산 방향 스텝. 격자 위를 한 칸씩 움직이는 게임(길 건너기류)을 위한 신호.
// 연속 아날로그 x/y를 "누른 순간 1스텝, 그 다음은 키보드 키 반복처럼" 로
// 바꾼다 — 쥐고 있다고 매 프레임 전진하지 않는다.
//
// 값은 OS/브라우저의 표준 키 반복 감각을 그대로 본떴다(초기 지연 ~0.35초,
// 이후 반복 ~0.18초 ≈ 초당 5.5회 — 사람이 의도적으로 누르는 속도다. 옛
// MOVE_COOLDOWN=0.13초·연속 판정 방식은 초당 7.7회로 반응이 아니라 실수로도
// 여러 칸이 밀렸다).
export const STEP_THRESHOLD = 0.4;      // 이 값을 넘는 축을 "눌림"으로 본다(연속 이동 임계값과 동일)
export const STEP_REPEAT_DELAY = 0.35;  // 첫 스텝 이후 반복이 시작되기까지(초)
export const STEP_REPEAT_RATE = 0.18;   // 이후 반복 간격(초)

// 축 하나(x 또는 y)를 위한 상태기계. 키보드/게임패드/터치 어느 쪽이 흘려주는
// 값이든 이미 -1..1 아날로그로 정규화돼 있으므로 소스를 구분하지 않는다.
export function createAxisStepper() {
  let dir = 0;
  let timer = 0;
  return {
    step(value, dt) {
      const next = Math.abs(value) > STEP_THRESHOLD ? Math.sign(value) : 0;
      if (next !== dir) {
        // 새 방향(혹은 중립)으로 막 바뀐 프레임 — 지연 없이 즉시 발화하고,
        // 계속 눌려 있으면 이제부터 지연을 잰다.
        dir = next;
        timer = STEP_REPEAT_DELAY;
        return dir;
      }
      if (dir === 0) return 0;
      timer -= dt;
      if (timer <= 0) {
        timer = STEP_REPEAT_RATE;
        return dir;
      }
      return 0;
    },
  };
}

// 패드 하나(x,y)를 위한 스테퍼 — 두 축을 독립적으로 추적한다.
export function createPadStepper() {
  const x = createAxisStepper();
  const y = createAxisStepper();
  return {
    step(pad, dt) {
      return { stepX: x.step(pad.x, dt), stepY: y.step(pad.y, dt) };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM 결선. 순수 함수들을 실제 이벤트에 묶는다.
// toLogical(clientX, clientY) → { x, y } 논리 좌표 변환기는 main.js가 준다.
export function createInput({ canvas, toLogical, win = globalThis, nav = globalThis.navigator, doc = globalThis.document }) {
  const down = new Set();
  let prevKeys = new Set();
  let gpPrev = [{ a: false, b: false }, { a: false, b: false }];
  let touchHeld = { p1: { a: false }, p2: { a: false } };
  let controls = 'pointer';
  let layout = padLayout(960, 640, controls);

  const touches = new Map(); // pointerId → {x, y}
  const p1 = emptyPad();
  const p2 = emptyPad();
  const p1Stepper = createPadStepper();
  const p2Stepper = createPadStepper();
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };
  let pointerDownEdge = false;
  let pointerUpEdge = false;

  const onKeyDown = (e) => {
    down.add(e.code);
    // 방향키·스페이스가 페이지를 스크롤하지 않게 막는다.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const onKeyUp = (e) => down.delete(e.code);

  // 아이패드는 홈 제스처·알림·앱 전환으로 백그라운드에 자주 들어간다. pointercancel이
  // 보통 따라오긴 하지만 "보통"만 믿기엔 얇다 — blur/hidden 전환에서 터치를 직접 지워
  // 가상 패드가 눌린 채로 굳어 캐릭터가 혼자 움직이는 사고를 막는다.
  const clearTouchesAndEdges = () => {
    touches.clear();
    touchHeld = { p1: { a: false }, p2: { a: false } };
    pointer.down = false;
    pointer.pressed = false;
    pointer.released = false;
    pointerDownEdge = false;
    pointerUpEdge = false;
  };
  const onBlur = () => { down.clear(); clearTouchesAndEdges(); };
  const onVisibility = () => { if (doc?.hidden) clearTouchesAndEdges(); };

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
  doc?.addEventListener?.('visibilitychange', onVisibility);
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

    // 매 프레임 게임 update 전에 한 번 호출한다. dt는 초(고정 1/60) —
    // 이산 스텝의 반복 지연·간격을 재는 데 쓴다.
    update(dt = 1 / 60) {
      const pts = [...touches.values()];
      const t = padFromTouches(pts, layout, touchHeld);
      touchHeld = t.held;
      const [g0, g1] = readGamepads();

      Object.assign(p1, mergePads(padFromKeys(down, prevKeys, KEYMAP_P1), g0, t.p1));
      Object.assign(p2, mergePads(padFromKeys(down, prevKeys, KEYMAP_P2), g1, t.p2));
      prevKeys = new Set(down);

      // 합쳐진(키보드+게임패드+터치) 아날로그 x/y에서 이산 스텝을 뽑는다 —
      // 소스별이 아니라 합쳐진 값 하나로 재야 세 입력이 똑같이 동작한다.
      Object.assign(p1, p1Stepper.step(p1, dt));
      Object.assign(p2, p2Stepper.step(p2, dt));

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
      doc?.removeEventListener?.('visibilitychange', onVisibility);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      touches.clear();
      down.clear();
    },
  };
}
