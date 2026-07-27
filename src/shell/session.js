import { PALETTE } from '../core/draw.js';

const W = 960;
const H = 640;

export function sessionButtons(w = W, h = H) {
  const bw = 200;
  const bh = 56;
  const cx = w / 2 - bw / 2;
  return {
    pause: { x: w - 68, y: 16, w: 52, h: 52 },
    resume: { x: cx, y: h / 2 - 20, w: bw, h: bh },
    restart: { x: cx, y: h / 2 + 52, w: bw, h: bh },
    menu: { x: cx, y: h / 2 + 124, w: bw, h: bh },
  };
}

export function hitRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 게임 하나의 수명을 관리한다. 셸에서 게임으로 들어가는 유일한 문.
export function createSession({ core, records, onExit }) {
  const B = sessionButtons(W, H);
  let game = null;
  let state = 'idle';
  let score = 0;
  let result = null;

  function makeApi() {
    return {
      w: W,
      h: H,
      input: core.input,
      draw: core.draw,
      audio: core.audio,
      juice: core.juice,
      rng: core.rng,
      onScore(n) { if (Number.isFinite(n)) score = n; },
      onGameOver(res = {}) {
        if (state === 'over') return;
        state = 'over';
        const finalScore = Number.isFinite(res.score) ? res.score : score;
        score = finalScore;
        const rec = records.submit(game.id, finalScore, game.scoreOrder);
        result = { ...res, score: finalScore, ...rec };
      },
    };
  }

  function launch(g) {
    game = g;
    score = 0;
    result = null;
    state = 'playing';
    core.juice.reset();
    core.input.setControls?.(g.controls ?? 'pointer');
    g.init(makeApi());
  }

  return {
    start(g) {
      if (game) game.dispose();
      launch(g);
    },

    stop() {
      if (game) game.dispose();
      game = null;
      state = 'idle';
      score = 0;
      result = null;
    },

    state: () => state,
    score: () => score,
    result: () => result,
    current: () => game,

    update(dt) {
      core.juice.update(dt);
      if (state !== 'playing') return;
      if (core.juice.frozen()) return;
      game.update(dt);
    },

    render(ctx) {
      const d = core.draw;
      if (!game) { d.clear(); return; }

      const off = core.juice.offset();
      ctx.save();
      ctx.translate(off.x, off.y);
      game.render(ctx);
      ctx.restore();
      core.juice.draw(ctx);

      // HUD
      d.text(`${game.scoreLabel} ${score}`, 20, 34, { size: 24, align: 'left', color: PALETTE.white, glow: 6 });
      d.roundRect(B.pause.x, B.pause.y, B.pause.w, B.pause.h, 12, PALETTE.dim, { alpha: 0.7 });
      d.rect(B.pause.x + 17, B.pause.y + 15, 6, 22, PALETTE.white);
      d.rect(B.pause.x + 29, B.pause.y + 15, 6, 22, PALETTE.white);

      if (state === 'paused' || state === 'over') {
        d.rect(0, 0, W, H, PALETTE.bg, { alpha: 0.78 });
        if (state === 'paused') {
          d.text('일시정지', W / 2, H / 2 - 110, { size: 44, bold: true, color: PALETTE.cyan, glow: 16 });
          button(d, B.resume, '계속하기', PALETTE.green);
        } else {
          d.text('게임 끝', W / 2, H / 2 - 150, { size: 44, bold: true, color: PALETTE.magenta, glow: 16 });
          d.text(`${game.scoreLabel} ${score}`, W / 2, H / 2 - 92, { size: 30, color: PALETTE.white });
          if (result?.isNew) {
            d.text('새 최고기록!', W / 2, H / 2 - 50, { size: 24, bold: true, color: PALETTE.yellow, glow: 12 });
          } else if (result?.best !== null && result?.best !== undefined) {
            d.text(`최고 ${result.best}`, W / 2, H / 2 - 50, { size: 22, color: PALETTE.dim });
          }
        }
        button(d, B.restart, '다시하기', PALETTE.cyan);
        button(d, B.menu, '메뉴로', PALETTE.orange);
      }
    },

    tap(x, y) {
      if (!game) return null;

      if (state === 'playing' && hitRect(B.pause, x, y)) {
        state = 'paused';
        return 'pause';
      }
      if (state === 'paused' && hitRect(B.resume, x, y)) {
        state = 'playing';
        return 'resume';
      }
      if ((state === 'paused' || state === 'over') && hitRect(B.restart, x, y)) {
        game.dispose();
        launch(game);
        return 'restart';
      }
      if ((state === 'paused' || state === 'over') && hitRect(B.menu, x, y)) {
        game.dispose();
        game = null;
        state = 'idle';
        onExit();
        return 'menu';
      }
      return null;
    },
  };
}

function button(d, r, label, color) {
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { alpha: 0.16 });
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { fill: false, width: 2, glow: 10 });
  d.text(label, r.x + r.w / 2, r.y + r.h / 2, { size: 24, bold: true, color });
}
