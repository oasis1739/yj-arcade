import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────
//
// 게임 흐름: 매 라운드 길이 L(순서 길이)의 시퀀스를 도형이 하나씩 빛나며
// 재생한다('showing') → 다 보여주면 입력을 받는다('input') → 끝까지 맞히면
// 다음 라운드(L+1)로, 틀리면 목숨을 하나 잃고 같은 시퀀스를 다시 보여준다
// ('wrongPause' → 'showing'). 목숨 3개를 다 잃으면 'gameover'.
//
// 난이도는 오직 L(순서 길이)에 의해서만 결정된다(순수 함수 shapeCountForLength/
// litDurationMs/soundHintEnabled) — 8세 플레이어가 1단계(L=2)에서 반드시
// 성공하도록 시작은 아주 쉽고, L이 오를 때마다 조금씩만 조여든다.

const GAP_MS = 220;        // 도형이 꺼져 있는 구간(다음 빛 전 여백)
const WRONG_PAUSE_MS = 650; // 오답 후 다시 보여주기 전 대기 시간

// 소리 힌트: 2~6개 구간까지는 색+소리를 함께 준다. 7부터는 색만.
export function soundHintEnabled(len) {
  return len <= 6;
}

// 노출 시간: 9부터 줄어든다. 400ms 밑으로는 8세 반응속도로도 못 따라가므로 클램프.
export function litDurationMs(len) {
  if (len < 9) return 900;
  return Math.max(400, 900 - (len - 8) * 60);
}

// 도형 개수: 11부터 화면의 도형 자체를 늘린다(최대 9개, 규칙 문서의 "4~9개").
export function shapeCountForLength(len) {
  if (len < 11) return 4;
  return Math.min(9, 4 + Math.floor((len - 11) / 3) + 1);
}

// 길이 len짜리 시퀀스를 [0, shapeCount) 범위에서 뽑는다. 사이먼류 기억 게임은
// 연속 반복도 정상적인 패턴이라 중복을 막지 않는다.
export function generateSequence(len, shapeCount, rng) {
  const seq = [];
  for (let i = 0; i < len; i++) seq.push(rng.int(shapeCount));
  return seq;
}

function startPlayback(state) {
  state.playIndex = 0;
  state.playStage = 'lit';
  state.playTimer = litDurationMs(state.seqLen);
  state.litSlot = state.sequence[0];
  state.justLit = true;
  state.inputIndex = 0;
  state.wrongSlot = -1;
  state.phase = 'showing';
}

export function createMemoryState({ rng }) {
  const seqLen = 2;
  const shapeCount = shapeCountForLength(seqLen);
  const sequence = generateSequence(seqLen, shapeCount, rng);
  const state = {
    seqLen,
    shapeCount,
    sequence,
    lives: 3,
    score: 0,
    phase: 'showing',
    playIndex: 0,
    playStage: 'lit',
    playTimer: litDurationMs(seqLen),
    litSlot: sequence[0],
    justLit: true,
    inputIndex: 0,
    wrongSlot: -1,
    wrongTimer: 0,
  };
  return state;
}

// 재생 애니메이션(어느 칸이 빛나는지, 얼마나 오래)은 오직 이 함수(그리고 이
// 함수를 부르는 update(dt))로만 진행된다 — render()는 절대 시계를 읽지 않고
// state.litSlot을 그릴 뿐이다.
export function advancePlayback(state, dtMs) {
  if (state.phase !== 'showing') return;
  state.justLit = false;
  state.playTimer -= dtMs;
  while (state.playTimer <= 0 && state.phase === 'showing') {
    if (state.playStage === 'lit') {
      state.playStage = 'gap';
      state.litSlot = -1;
      state.playTimer += GAP_MS;
    } else {
      state.playIndex += 1;
      if (state.playIndex >= state.sequence.length) {
        state.phase = 'input';
        state.litSlot = -1;
        state.playTimer = 0;
        break;
      }
      state.playStage = 'lit';
      state.litSlot = state.sequence[state.playIndex];
      state.playTimer += litDurationMs(state.seqLen);
      state.justLit = true;
    }
  }
}

// phase !== 'input'이면(재생 중이면) 탭을 완전히 무시한다.
export function submitTap(state, slotIndex) {
  if (state.phase !== 'input') return { ignored: true };

  const expected = state.sequence[state.inputIndex];
  if (slotIndex !== expected) {
    state.lives -= 1;
    state.wrongSlot = slotIndex;
    if (state.lives <= 0) {
      state.phase = 'gameover';
      return { ignored: false, correct: false, gameOver: true };
    }
    state.phase = 'wrongPause';
    state.wrongTimer = WRONG_PAUSE_MS;
    return { ignored: false, correct: false, gameOver: false };
  }

  state.inputIndex += 1;
  if (state.inputIndex >= state.sequence.length) {
    state.score = Math.max(state.score, state.seqLen);
    return { ignored: false, correct: true, roundComplete: true };
  }
  return { ignored: false, correct: true, roundComplete: false };
}

// 성공 후 다음 라운드로: 순서가 1개 길어지고 새 시퀀스를 뽑는다(rng 소비).
export function advanceToNextRound(state, rng) {
  state.seqLen += 1;
  state.shapeCount = shapeCountForLength(state.seqLen);
  state.sequence = generateSequence(state.seqLen, state.shapeCount, rng);
  startPlayback(state);
}

// 오답 후 재시도: 같은 시퀀스를 유지한 채 재생/입력 진행 상태만 초기화한다.
export function retryRound(state) {
  startPlayback(state);
}

export function advanceWrongPause(state, dtMs) {
  if (state.phase !== 'wrongPause') return;
  state.wrongTimer -= dtMs;
  if (state.wrongTimer <= 0) retryRound(state);
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────

// 도형 9종(모양+색 조합). shapeCount만큼 앞에서부터 잘라 쓴다. 처음 4개
// (원/네모/세모/마름모)는 특히 서로 확실히 구별되도록 골랐다 — 1단계가
// 8세 플레이어에게 명확해야 하기 때문.
const SHAPE_DEFS = [
  { kind: 'circle', color: PALETTE.cyan },
  { kind: 'square', color: PALETTE.magenta },
  { kind: 'triangle', color: PALETTE.yellow },
  { kind: 'diamond', color: PALETTE.green },
  { kind: 'hex', color: PALETTE.orange },
  { kind: 'star', color: PALETTE.red },
  { kind: 'cross', color: PALETTE.white },
  { kind: 'triangleDown', color: PALETTE.cyan },
  { kind: 'ring', color: PALETTE.magenta },
];

// 도형 개수별 배치(전부 화면 예약 구역 밖: 점수 HUD/일시정지 버튼과 안 겹침).
const LAYOUTS = {
  4: [[310, 267], [650, 267], [310, 462], [650, 462]],
  5: [[253, 270], [480, 270], [707, 270], [310, 460], [650, 460]],
  6: [[253, 270], [480, 270], [707, 270], [253, 460], [480, 460], [707, 460]],
  7: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [480, 530]],
  8: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [310, 530], [650, 530]],
  9: [[253, 220], [480, 220], [707, 220], [253, 375], [480, 375], [707, 375], [253, 530], [480, 530], [707, 530]],
};

function iconRadius(n) {
  return n <= 6 ? 58 : 48;
}

function slotCenter(state, i) {
  return LAYOUTS[state.shapeCount][i];
}

function hitTestSlot(state, x, y) {
  const layout = LAYOUTS[state.shapeCount];
  const r = iconRadius(state.shapeCount) + 22;
  for (let i = 0; i < state.shapeCount; i++) {
    const [cx, cy] = layout[i];
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return i;
  }
  return -1;
}

// 재생 중 빛나는 순서에 맞춰 나는 톤. 도(C5)부터 도(C6)까지 9음.
const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 1174.66];

function polygonPoints(kind, cx, cy, r) {
  switch (kind) {
    case 'triangle':
      return [[cx, cy - r], [cx + r * 0.87, cy + r * 0.6], [cx - r * 0.87, cy + r * 0.6]];
    case 'triangleDown':
      return [[cx, cy + r], [cx + r * 0.87, cy - r * 0.6], [cx - r * 0.87, cy - r * 0.6]];
    case 'diamond':
      return [[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]];
    case 'hex': {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      return pts;
    }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
      }
      return pts;
    }
    case 'cross': {
      const t = r * 0.38;
      return [
        [cx - t, cy - r], [cx + t, cy - r], [cx + t, cy - t],
        [cx + r, cy - t], [cx + r, cy + t], [cx + t, cy + t],
        [cx + t, cy + r], [cx - t, cy + r], [cx - t, cy + t],
        [cx - r, cy + t], [cx - r, cy - t], [cx - t, cy - t],
      ];
    }
    default:
      return null;
  }
}

// 도형 하나를 그린다. api.draw는 원/네모만 지원하므로 다각형(세모/마름모/
// 육각형/별/십자)은 render(ctx)로 직접 받는 raw ctx에 경로를 그린다.
function drawShape(ctx, kind, cx, cy, r, color, opts = {}) {
  const { filled = true, glow = 0, alpha = 1, lineWidth = 4 } = opts;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.shadowBlur = glow;
  ctx.shadowColor = glow ? color : 'transparent';

  if (kind === 'circle' || kind === 'ring') {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (kind === 'ring' || !filled) ctx.stroke(); else ctx.fill();
    ctx.restore();
    return;
  }
  if (kind === 'square') {
    if (filled) ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    else ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }

  const pts = polygonPoints(kind, cx, cy, r);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (filled) ctx.fill(); else ctx.stroke();
  ctx.restore();
}

export default {
  id: 'memory-sequence',
  title: '그림 기억',
  tags: ['puzzle'],
  players: 1,
  color: PALETTE.magenta,
  controls: 'pointer',
  scoreOrder: 'high',
  scoreLabel: '단계',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(u, u, size - 2 * u, size - 2 * u);
    const spots = [
      { x: 2.6, y: 2.6, color: PALETTE.cyan, lit: false },
      { x: 5.4, y: 2.6, color: PALETTE.magenta, lit: true },
      { x: 2.6, y: 5.4, color: PALETTE.yellow, lit: false },
      { x: 5.4, y: 5.4, color: PALETTE.green, lit: false },
    ];
    for (const s of spots) {
      ctx.save();
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.lit ? 1 : 0.45;
      if (s.lit) {
        ctx.shadowBlur = u * 1.4;
        ctx.shadowColor = s.color;
      }
      ctx.beginPath();
      ctx.arc(s.x * u, s.y * u, u * 1.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  init(api) {
    this.api = api;
    this.state = createMemoryState({ rng: api.rng });
    this.lastReportedScore = 0;
    this.gameOverReported = false;
  },

  reportGameOverIfNeeded() {
    if (this.state.phase === 'gameover' && !this.gameOverReported) {
      this.gameOverReported = true;
      this.api.audio.noise(240);
      this.api.juice.shake(10, 0.3);
      this.api.onGameOver({ score: this.state.score });
    }
  },

  update(dt) {
    const api = this.api;
    const s = this.state;
    const dtMs = dt * 1000;

    if (s.phase === 'gameover') return;

    if (s.phase === 'showing') {
      advancePlayback(s, dtMs);
      if (s.justLit) {
        if (soundHintEnabled(s.seqLen)) api.audio.beep(NOTES[s.litSlot], 130);
        const [cx, cy] = slotCenter(s, s.litSlot);
        api.juice.burst(cx, cy, { color: SHAPE_DEFS[s.litSlot].color, count: 10, speed: 90 });
      }
      return;
    }

    if (s.phase === 'input') {
      const ptr = api.input.pointer;
      if (ptr.pressed) {
        const slot = hitTestSlot(s, ptr.x, ptr.y);
        if (slot !== -1) {
          const [cx, cy] = slotCenter(s, slot);
          const result = submitTap(s, slot);
          if (result.correct) {
            api.audio.beep(760, 55);
            api.juice.burst(cx, cy, { color: PALETTE.white, count: 8, speed: 90 });
            if (result.roundComplete) {
              api.audio.sweep(500, 1050, 280);
              api.juice.shake(4, 0.15);
              if (s.score !== this.lastReportedScore) {
                this.lastReportedScore = s.score;
                api.onScore(s.score);
              }
              advanceToNextRound(s, api.rng);
            }
          } else {
            api.audio.noise(160);
            api.juice.shake(8, 0.2);
            api.juice.burst(cx, cy, { color: PALETTE.red, count: 14, speed: 140 });
          }
        }
      }
      this.reportGameOverIfNeeded();
      return;
    }

    if (s.phase === 'wrongPause') {
      advanceWrongPause(s, dtMs);
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.state;
    d.clear();

    // 목숨 3개 — 점수 HUD((0,8)~(280,56))와 일시정지 버튼((892,16)~(944,68))
    // 둘 다와 겹치지 않는 y=96 자리에 그린다.
    const liveXs = [430, 480, 530];
    for (let i = 0; i < 3; i++) {
      const filled = i < s.lives;
      d.circle(liveXs[i], 96, 10, filled ? PALETTE.red : PALETTE.dim, { fill: filled, width: 2 });
    }

    const layout = LAYOUTS[s.shapeCount];
    const r = iconRadius(s.shapeCount);
    for (let i = 0; i < s.shapeCount; i++) {
      const [cx, cy] = layout[i];
      const def = SHAPE_DEFS[i];
      const isLit = s.litSlot === i;
      const isWrong = s.phase === 'wrongPause' && s.wrongSlot === i;
      const color = isWrong ? PALETTE.red : def.color;
      drawShape(ctx, def.kind, cx, cy, r, color, {
        filled: true,
        alpha: isLit || isWrong ? 1 : 0.4,
        glow: isLit ? 26 : (isWrong ? 18 : 0),
        lineWidth: 5,
      });
      if (s.phase === 'input') {
        drawShape(ctx, def.kind, cx, cy, r + 9, PALETTE.white, { filled: false, alpha: 0.5, lineWidth: 3 });
      }
    }

    if (s.phase === 'gameover') {
      d.rect(0, 70, 960, 640 - 70, PALETTE.bg, { alpha: 0.72 });
      d.text('게임 종료', 480, 300, { size: 44, color: PALETTE.red, bold: true });
      d.text(`최고 단계 ${s.score}`, 480, 350, { size: 26, color: PALETTE.white });
    }
  },

  dispose() {
    this.state = null;
    this.api = null;
  },
};
