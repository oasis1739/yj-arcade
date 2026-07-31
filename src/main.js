import { createLoop } from './core/loop.js';
import { createDraw, PALETTE } from './core/draw.js';
import { createAudio } from './core/audio.js';
import { createJuice } from './core/juice.js';
import { makeRng } from './core/rng.js';
import { createInput } from './core/input.js';
import { createStorage } from './core/storage.js';
import { collectGames } from './shell/registry.js';
import { createRecords } from './shell/records.js';
import { createSession } from './shell/session.js';
import { createMenu } from './shell/menu.js';
import { computeFit, toLogicalFactory, LOGICAL_W, LOGICAL_H } from './shell/viewport.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

let fit;
let toLogical;

function resize() {
  fit = computeFit(innerWidth, innerHeight, devicePixelRatio || 1);
  toLogical = toLogicalFactory(fit);
  canvas.width = fit.backingW;
  canvas.height = fit.backingH;
}
addEventListener('resize', resize);
addEventListener('orientationchange', resize);
resize();

// 게임 자동 수집. 파일 하나 추가 = 게임 하나 추가.
const { games, errors } = collectGames(import.meta.glob('./games/*.js', { eager: true }));
if (errors.length) console.warn('[YJ 아케이드] 계약 위반 게임:', errors);

const seed = (Date.now() ^ 0x5f3759df) >>> 0;
// juice(파티클/흔들림)와 게임 rng가 같은 시드로 출발하면 두 스트림이 상관돼
// 버린다 — 예를 들어 같은 프레임에 죽음 연출과 다음 스폰이 겹치는 게임이면
// "터지는 패턴"이 매번 게임 전개와 눈에 띄게 얽혀 보인다. XOR로 갈라놓는다.
const core = {
  draw: createDraw(ctx),
  audio: createAudio(),
  juice: createJuice(makeRng((seed ^ 0x9e3779b9) >>> 0)),
  rng: makeRng(seed),
  input: createInput({
    canvas,
    // pointer 이벤트는 CSS 픽셀 → 캔버스 물리 픽셀 → 논리 좌표 순으로 변환한다.
    toLogical: (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      return toLogical((clientX - r.left) * dpr, (clientY - r.top) * dpr);
    },
  }),
};

const records = createRecords(createRecordsStorage());
function createRecordsStorage() {
  return createStorage('yj-arcade');
}

let mode = 'menu';
const session = createSession({ core, records, onExit: () => { mode = 'menu'; } });
const menu = createMenu({ games, records, draw: core.draw });

// 탭 처리: 포인터가 눌린 프레임에만 반응한다.
function handleTap() {
  const p = core.input.pointer;
  if (!p.pressed) return;
  if (mode === 'menu') {
    const hit = menu.tap(p.x, p.y);
    if (hit?.type === 'game') {
      mode = 'game';
      session.start(hit.game);
      core.audio.beep(660, 60);
      // 이 탭이 메뉴 타일에서 게임 시작으로 모드를 바꿨다. update()가 이어서
      // session.update(dt)를 부르므로, pressed를 안 지우면 방금 그 탭이 새
      // 게임의 0프레임에 "유령 탭"으로 들어가버린다(핸들러가 같은 프레임 안에서
      // 순서대로 실행되기 때문 — 다음 프레임까지 기다리지 않는다).
      p.pressed = false;
      p.released = false;
    }
  } else {
    const action = session.tap(p.x, p.y);
    // "다시하기"/"계속하기"도 같은 프레임에 새/재개된 게임의 update로 이어진다.
    if (action === 'restart' || action === 'resume') {
      p.pressed = false;
      p.released = false;
    }
  }
}

const loop = createLoop({
  dt: 1 / 60,
  update: (dt) => {
    core.input.update(dt);
    handleTap();
    if (mode === 'game') session.update(dt);
    else core.juice.update(dt);
  },
  render: () => {
    // 물리 캔버스를 지우고 논리 좌표계로 들어간다.
    ctx.save();
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(fit.scale, 0, 0, fit.scale, fit.offsetX, fit.offsetY);
      ctx.beginPath();
      ctx.rect(0, 0, LOGICAL_W, LOGICAL_H);
      ctx.clip();

      if (mode === 'game') session.render(ctx);
      else menu.render(ctx);
    } finally {
      ctx.restore();
    }
  },
});

// 탭 전환 시 자동 일시정지 — 아이패드에서 앱을 나갔다 오면 시간이 튀는 걸 막는다.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) loop.stop();
  else loop.start();
});

loop.start();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 캐시는 있으면 좋고 없어도 동작 */ });
  });
}
