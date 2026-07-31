import { PALETTE } from '../core/draw.js';

const W = 960;
const H = 640;

export function sessionButtons(w = W, h = H) {
  const bw = 200;
  const bh = 56;
  const cx = w / 2 - bw / 2;
  return {
    pause: { x: w - 68, y: 16, w: 52, h: 52 },
    // 2인 게임(players === 2)의 일시정지 화면에만 뜨는 "혼자/2인" 토글.
    // 제목("일시정지")과 계속하기 버튼 사이 여유 구간에 얹는다.
    solo: { x: cx, y: h / 2 - 80, w: bw, h: 36 },
    resume: { x: cx, y: h / 2 - 20, w: bw, h: bh },
    restart: { x: cx, y: h / 2 + 52, w: bw, h: bh },
    menu: { x: cx, y: h / 2 + 124, w: bw, h: bh },
  };
}

export function hitRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// 게임 코드가 던지면 애 손에 죽은 화면을 쥐어줄 수 없다 — 아이패드 풀스크린
// PWA에서는 새로고침도 못 한다. 이 문구는 콘솔 로그에 붙어 원인을 남긴다.
const CRASH_MESSAGE = '이 게임에 문제가 생겼어요';

// 게임 하나의 수명을 관리한다. 셸에서 게임으로 들어가는 유일한 문.
export function createSession({ core, records, onExit }) {
  const B = sessionButtons(W, H);
  let game = null;
  let state = 'idle';
  let score = 0;
  let result = null;
  let lastError = null;
  // maze-50처럼 onGameOver 없이 스테이지를 계속 깨며 진행하는 게임은
  // onScore(n)만 부르고 그냥 플레이를 멈춘다 — 그 진행 상황을 메뉴 기록에
  // 반영하려면 셸이 "이 세션에서 onScore가 한 번이라도 왔는가"를 직접
  // 추적해야 한다(exitToMenu/stop에서 참고).
  let hasProgress = false;
  // 지금 이 세션의 api 객체. 참조를 들고 있어야 일시정지 화면의 "혼자/2인"
  // 토글이 이미 게임에 넘어간 api.solo를 나중에 다시 뒤집을 수 있다.
  let api = null;

  function makeApi() {
    return {
      w: W,
      h: H,
      input: core.input,
      draw: core.draw,
      audio: core.audio,
      // core.juice 전체가 아니라 계약이 문서화한 세 메서드만 준다. 셸이 juice의
      // 수명(reset/update/draw)을 쥐고 있으므로, 게임이 실수로 update()/draw()/
      // reset()을 불러버리면 파티클이 두 배로 흐르거나 히트스톱이 반토막나거나
      // 셸 상태가 통째로 지워진다 — 계약 테스트는 이걸 잡아낼 수 없다.
      juice: {
        shake: (...a) => core.juice.shake(...a),
        burst: (...a) => core.juice.burst(...a),
        hitstop: (...a) => core.juice.hitstop(...a),
      },
      rng: core.rng,
      // 2P가 진짜 사람인지 셸은 추측하지 않는다("입력이 들어온 적 있으니
      // 사람일 것"은 오탐이 흔하다) — 매번 혼자라고 가정하고 시작해서,
      // 로컬 플레이어가 일시정지 화면의 토글로 명시적으로 뒤집게 한다.
      solo: true,
      onScore(n) { if (Number.isFinite(n)) { score = n; hasProgress = true; } },
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
    lastError = null;
    hasProgress = false;
    state = 'playing';
    core.juice.reset();
    core.input.setControls?.(g.controls ?? 'pointer');
    api = makeApi();
    g.init(api);
  }

  // onGameOver 없이 중간에 멈춘 세션의 진행 상황을 기록으로 남긴다.
  // - onGameOver가 이미 기록했다면(state === 'over') 또 남기지 않는다.
  // - onScore가 한 번도 안 왔으면(hasProgress === false) 남길 게 없다.
  // - scoreOrder가 'low'인 게임(예: 스도쿠의 경과 시간)은 건너뛴다 — "작을수록
  //   좋음" 게임에서 끝내지 않은 중간값(예: 시작하자마자 나간 3초)은 실제로
  //   잘한 게 아니라 그냥 안 끝낸 것뿐인데, 그걸 기록하면 "3초 만에 클리어"
  //   같은 거짓 신기록이 뜬다. 반면 'high'는 중간에 그만둬도 "거기까지는
  //   도달했다"는 게 정직한 사실이라 기록해도 안전하다.
  function recordProgressOnExit() {
    if (!game || state === 'over' || !hasProgress) return;
    if (game.scoreOrder === 'low') return;
    records.recordProgress(game.id, score, game.scoreOrder);
  }

  // 일시정지/오버 화면의 "메뉴로" 버튼과 정확히 같은 종료 경로. 게임이 터졌을
  // 때도 셸 상태가 갈라지지 않도록 이걸 재사용한다.
  function exitToMenu() {
    recordProgressOnExit();
    if (game) {
      try { game.dispose(); } catch { /* 게임이 이미 망가졌어도 dispose 실패는 무시 */ }
    }
    game = null;
    api = null;
    state = 'idle';
    score = 0;
    result = null;
    onExit();
  }

  function crash(err) {
    lastError = CRASH_MESSAGE;
    console.error(`[YJ 아케이드] ${CRASH_MESSAGE}:`, err);
    exitToMenu();
  }

  return {
    start(g) {
      if (game) game.dispose();
      launch(g);
    },

    stop() {
      recordProgressOnExit();
      if (game) game.dispose();
      game = null;
      api = null;
      state = 'idle';
      score = 0;
      result = null;
    },

    state: () => state,
    score: () => score,
    result: () => result,
    current: () => game,
    lastError: () => lastError,

    update(dt) {
      core.juice.update(dt);
      if (state !== 'playing') return;
      if (core.juice.frozen()) return;
      try {
        game.update(dt);
      } catch (err) {
        crash(err);
      }
    },

    render(ctx) {
      const d = core.draw;
      if (!game) { d.clear(); return; }

      const off = core.juice.offset();
      ctx.save();
      ctx.translate(off.x, off.y);
      let renderError = null;
      try {
        game.render(ctx);
      } catch (err) {
        renderError = err;
      } finally {
        ctx.restore();
      }
      if (renderError) {
        // game.render가 어디까지 그리다 던졌는지 알 수 없으니, 화면을 지우고
        // 메뉴로 돌아가는 편이 이상한 잔상을 그대로 보여주는 것보다 낫다.
        crash(renderError);
        d.clear();
        return;
      }
      core.juice.draw(ctx);

      drawTouchOverlay(d, core.input);

      // HUD
      d.text(`${game.scoreLabel} ${score}`, 20, 34, { size: 24, align: 'left', color: PALETTE.white, glow: 6 });
      d.roundRect(B.pause.x, B.pause.y, B.pause.w, B.pause.h, 12, PALETTE.dim, { alpha: 0.7 });
      d.rect(B.pause.x + 17, B.pause.y + 15, 6, 22, PALETTE.white);
      d.rect(B.pause.x + 29, B.pause.y + 15, 6, 22, PALETTE.white);

      if (state === 'paused' || state === 'over') {
        d.rect(0, 0, W, H, PALETTE.bg, { alpha: 0.78 });
        if (state === 'paused') {
          d.text('일시정지', W / 2, H / 2 - 110, { size: 44, bold: true, color: PALETTE.cyan, glow: 16 });
          if (game.players === 2) {
            const label = api.solo ? '혼자 하기 (AI 상대) — 탭해서 2인으로' : '2인 대전 중 — 탭해서 혼자로';
            button(d, B.solo, label, PALETTE.yellow, 17);
          }
          button(d, B.resume, '계속하기', PALETTE.green);
        } else {
          d.text('게임 끝', W / 2, H / 2 - 150, { size: 44, bold: true, color: PALETTE.magenta, glow: 16 });
          d.text(`${game.scoreLabel} ${score}`, W / 2, H / 2 - 92, { size: 30, color: PALETTE.white });
          if (result?.winner === 1 || result?.winner === 2) {
            d.text(`${result.winner}P 승리!`, W / 2, H / 2 - 50, { size: 26, bold: true, color: PALETTE.yellow, glow: 12 });
          } else if (result?.isNew) {
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
      if (state === 'paused' && game.players === 2 && hitRect(B.solo, x, y)) {
        api.solo = !api.solo;
        return api.solo ? 'solo' : 'twoPlayers';
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
        exitToMenu();
        return 'menu';
      }
      return null;
    },
  };
}

function button(d, r, label, color, size = 24) {
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { alpha: 0.16 });
  d.roundRect(r.x, r.y, r.w, r.h, 14, color, { fill: false, width: 2, glow: 10 });
  d.text(label, r.x + r.w / 2, r.y + r.h / 2, { size, bold: true, color });
}

// 가상 터치 패드 오버레이. input.padLayout()이 정의한 존만 그린다 — pointer
// 모드는 존이 없으니 아무것도 안 그린다. 게임을 가리면 안 되니 반투명으로만.
// 노브 위치는 core.input.p1/p2를 그대로 읽는다(카운터 누적 아님) — render를
// update 없이 두 번 불러도 같은 값을 읽으므로 순수성이 깨지지 않는다.
function drawTouchOverlay(d, input) {
  const layout = input.layout?.();
  if (!layout) return;
  const dual = !!(layout.p1 && layout.p2);
  drawPadZone(d, layout.p1, input.p1, dual ? '1P' : null);
  drawPadZone(d, layout.p2, input.p2, dual ? '2P' : null);
}

function drawPadZone(d, zone, pad, label) {
  if (!zone) return;

  if (zone.dpad) {
    const { cx, cy, r } = zone.dpad;
    d.circle(cx, cy, r, PALETTE.white, { fill: false, width: 3, alpha: 0.3 });
    d.circle(cx, cy, r * 0.22, PALETTE.white, { fill: false, width: 2, alpha: 0.22 });
    const kx = cx + (pad?.x ?? 0) * r * 0.6;
    const ky = cy + (pad?.y ?? 0) * r * 0.6;
    d.circle(kx, ky, r * 0.3, PALETTE.cyan, { alpha: 0.4, glow: 8 });
    if (label) d.text(label, cx, cy - r - 14, { size: 16, bold: true, color: PALETTE.white, alpha: 0.5 });
  }

  if (zone.a) {
    const { cx, cy, r } = zone.a;
    const held = !!pad?.aHeld;
    d.circle(cx, cy, r, PALETTE.magenta, { alpha: held ? 0.5 : 0.25, glow: held ? 14 : 0 });
    d.circle(cx, cy, r, PALETTE.white, { fill: false, width: 2, alpha: 0.35 });
    d.text('A', cx, cy, { size: 24, bold: true, color: PALETTE.white, alpha: 0.6 });
  }
}
