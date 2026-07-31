import { createDraw } from '../../src/core/draw.js';
import { createAudio } from '../../src/core/audio.js';
import { createJuice } from '../../src/core/juice.js';
import { makeRng } from '../../src/core/rng.js';
import { emptyPad } from '../../src/core/input.js';

// 게임에 주입할 가짜 api. render 중 콜백 호출 같은 계약 위반을 기록한다.
//
// solo 기본값은 false다(=1P·2P 둘 다 사람) — driveInput()이 p1/p2를 서로
// 다른 패턴으로 흔드는 이유가 "승패 로직이 두 입력을 다 읽는지"를 검증하기
// 위해서인데, api.solo가 true(=2P는 AI로 대체)면 게임이 2P 입력을 정당하게
// 무시해버려서 그 검증이 무력화된다. "1인 플레이 시 AI로 완주하는지"를 따로
// 검증하고 싶은 게임 테스트는 { solo: true }를 넘겨라(src/games/baseball-battle
// 테스트 참고).
export function createFakeApi(ctx, { seed = 1, solo = false } = {}) {
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
    solo,
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
//
// p1과 p2는 서로 다른 주기로 독립 구동한다. 예전엔 p2가 매 프레임 p1을
// Object.assign으로 그대로 복사해 1P와 2P가 항상 바이트 단위로 같았다 —
// 그러면 승패 로직이 p1만 읽어도(2P를 아예 무시해도) 이 하네스로는 절대
// 들키지 않는다. 두 선수가 실제로 비대칭이어야 versus 게임을 의미 있게
// 커버한다.
export function driveInput(api, frame, rng) {
  const p1 = api.input.p1;
  if (frame % 17 === 0) { p1.x = rng.int(3) - 1; p1.y = rng.int(3) - 1; }
  p1.a = frame % 23 === 0;
  p1.aHeld = frame % 23 < 6;
  p1.b = frame % 41 === 0;
  p1.bHeld = frame % 41 < 4;
  // stepX/stepY: 이산 스텝 신호. 실제 createInput처럼 매 프레임 나는 게
  // 아니라 간간이 한 칸씩(가끔은 0으로 "안 움직임"도) 펄스로 흉내낸다 —
  // x/y와는 다른 위상(9프레임 주기)을 써서 두 신호를 각각 구동한다.
  p1.stepX = frame % 9 === 2 ? rng.int(3) - 1 : 0;
  p1.stepY = frame % 9 === 6 ? rng.int(3) - 1 : 0;

  const p2 = api.input.p2;
  if (frame % 19 === 0) { p2.x = rng.int(3) - 1; p2.y = rng.int(3) - 1; }
  p2.a = frame % 31 === 0;
  p2.aHeld = frame % 31 < 9;
  p2.b = frame % 37 === 0;
  p2.bHeld = frame % 37 < 5;
  p2.stepX = frame % 11 === 3 ? rng.int(3) - 1 : 0;
  p2.stepY = frame % 11 === 8 ? rng.int(3) - 1 : 0;

  const ptr = api.input.pointer;
  if (frame % 13 === 0) { ptr.x = rng.int(960); ptr.y = rng.int(640); }
  ptr.pressed = frame % 29 === 0;
  ptr.released = frame % 29 === 14;
  ptr.down = frame % 29 < 14;
}
