import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad } from '../../src/core/input.js';

// 게임에 주입할 가짜 api. render 중 콜백 호출 같은 계약 위반을 기록한다.
export function createFakeApi(ctx, { seed = 1 } = {}) {
  const events = { scores: [], gameOvers: [], illegal: [] };
  let rendering = false;

  // 실제 셸(src/shell/session.js)이 게임에 주는 것과 같은 좁은 juice 파사드다.
  // update()/draw()/reset()은 셸만 부른다 — 여기서도 노출하지 않아야, 게임이
  // 그 메서드들에 실수로 기대는 버그를 이 하네스가 (셸처럼) 잡아낸다.
  const fullJuice = createJuice(makeRng(seed));
  const juice = {
    shake: (...a) => fullJuice.shake(...a),
    burst: (...a) => fullJuice.burst(...a),
    hitstop: (...a) => fullJuice.hitstop(...a),
  };

  const api = {
    w: 960,
    h: 640,
    input: {
      p1: emptyPad(),
      p2: emptyPad(),
      pointer: { x: 480, y: 320, down: false, pressed: false, released: false },
    },
    draw: createDraw(ctx),
    audio: createAudio(null),       // AudioContext 없는 환경 → 전부 무해하게 무시
    juice,
    rng: makeRng(seed),
    onScore(n) {
      if (rendering) events.illegal.push('render 중 onScore 호출');
      events.scores.push(n);
    },
    onGameOver(res) {
      if (rendering) events.illegal.push('render 중 onGameOver 호출');
      events.gameOvers.push(res ?? {});
    },
  };

  return { api, events, setRendering: (v) => { rendering = v; } };
}

// 60초치 입력을 흉내낸다. 방향·버튼·포인터를 골고루 흔들어 코드 경로를 넓게 친다.
export function driveInput(api, frame, rng) {
  const p = api.input.p1;
  if (frame % 17 === 0) { p.x = rng.int(3) - 1; p.y = rng.int(3) - 1; }
  p.a = frame % 23 === 0;
  p.aHeld = frame % 23 < 6;
  p.b = frame % 41 === 0;
  p.bHeld = frame % 41 < 4;
  Object.assign(api.input.p2, p);
  const ptr = api.input.pointer;
  if (frame % 13 === 0) { ptr.x = rng.int(960); ptr.y = rng.int(640); }
  ptr.pressed = frame % 29 === 0;
  ptr.released = frame % 29 === 14;
  ptr.down = frame % 29 < 14;
}
