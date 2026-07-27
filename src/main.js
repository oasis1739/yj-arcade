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
const core = {
  draw: createDraw(ctx),
  audio: createAudio(),
  juice: createJuice(makeRng(seed)),
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
    }
  } else {
    session.tap(p.x, p.y);
  }
}

const loop = createLoop({
  dt: 1 / 60,
  update: (dt) => {
    core.input.update();
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
