import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────
export function createSnakeState({ cols = 24, rows = 16 } = {}) {
  const cy = Math.floor(rows / 2);
  const cx = Math.floor(cols / 2);
  return {
    cols, rows,
    snake: [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }],
    dir: { x: 1, y: 0 },
    next: { x: 1, y: 0 },
    food: { x: Math.min(cols - 1, cx + 4), y: cy },
    score: 0,
    dead: false,
  };
}

export function turn(s, dx, dy) {
  if (dx === -s.dir.x && dy === -s.dir.y) return s;  // 즉사 방지: 180도 금지
  if (dx === 0 && dy === 0) return s;
  s.next = { x: dx, y: dy };
  return s;
}

export function stepSnake(s, spawnFood) {
  if (s.dead) return s;
  s.dir = s.next;

  const head = { x: s.snake[0].x + s.dir.x, y: s.snake[0].y + s.dir.y };
  head.x = (head.x + s.cols) % s.cols;   // 벽 통과
  head.y = (head.y + s.rows) % s.rows;

  // 꼬리를 포함한 몸 전체와 충돌을 검사한다. 꼬리 칸은 이번 스텝에 비워지긴
  // 하지만, 그 자리로 파고드는 "꼬리 물기"도 실패로 친다 — 단순하고 예측
  // 가능한 규칙이 8살 플레이어에게 더 공정하다.
  for (let i = 0; i < s.snake.length; i++) {
    if (s.snake[i].x === head.x && s.snake[i].y === head.y) {
      s.dead = true;
      return s;
    }
  }

  s.snake.unshift(head);
  if (head.x === s.food.x && head.y === s.food.y) {
    s.score += 1;
    s.food = spawnFood(s);
  } else {
    s.snake.pop();
  }
  return s;
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const COLS = 24;
const ROWS = 16;
const CELL = 36;                       // 24*36 = 864, 16*36 = 576
const OX = (960 - COLS * CELL) / 2;
const OY = (640 - ROWS * CELL) / 2 + 14;
const START_STEP = 0.16;               // 초당 약 6칸
const MIN_STEP = 0.07;

export default {
  id: 'neon-snake',
  title: '네온 스네이크',
  tags: ['action'],
  players: 1,
  color: PALETTE.green,
  controls: 'dpad',
  scoreOrder: 'high',
  scoreLabel: '점수',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.green;
    for (const [x, y] of [[1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2]]) {
      ctx.fillRect(x * u, y * u, u - 2, u - 2);
    }
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(6 * u, 2 * u, u - 2, u - 2);
  },

  init(api) {
    this.api = api;
    this.s = createSnakeState({ cols: COLS, rows: ROWS });
    this.acc = 0;
    this.over = false;
    this.spawn = (s) => {
      // 뱀이 없는 칸에서 고른다. 꽉 차면 머리 위치를 그대로 반환(사실상 승리 상태).
      for (let tries = 0; tries < 200; tries++) {
        const p = { x: api.rng.int(s.cols), y: api.rng.int(s.rows) };
        if (!s.snake.some((q) => q.x === p.x && q.y === p.y)) return p;
      }
      return { ...s.snake[0] };
    };
  },

  update(dt) {
    if (this.over) return;
    const p = this.api.input.p1;
    if (Math.abs(p.x) > Math.abs(p.y)) {
      if (p.x > 0.4) turn(this.s, 1, 0);
      else if (p.x < -0.4) turn(this.s, -1, 0);
    } else {
      if (p.y > 0.4) turn(this.s, 0, 1);
      else if (p.y < -0.4) turn(this.s, 0, -1);
    }

    const step = Math.max(MIN_STEP, START_STEP - this.s.score * 0.004);
    this.acc += dt;
    if (this.acc < step) return;
    this.acc -= step;

    const before = this.s.score;
    stepSnake(this.s, this.spawn);

    if (this.s.score > before) {
      this.api.audio.beep(880, 60);
      const f = this.s.food;
      this.api.juice.burst(OX + f.x * CELL + CELL / 2, OY + f.y * CELL + CELL / 2,
        { color: PALETTE.magenta, count: 10, speed: 140 });
      this.api.onScore(this.s.score);
    }

    if (this.s.dead) {
      this.over = true;
      this.api.audio.sweep(400, 80, 260);
      this.api.juice.shake(10, 0.3);
      const h = this.s.snake[0];
      this.api.juice.burst(OX + h.x * CELL + CELL / 2, OY + h.y * CELL + CELL / 2,
        { color: PALETTE.green, count: 22, speed: 220 });
      this.api.onGameOver({ score: this.s.score });
    }
  },

  render(ctx) {
    const d = this.api.draw;
    d.clear();
    d.rect(OX - 4, OY - 4, COLS * CELL + 8, ROWS * CELL + 8, PALETTE.dim, { fill: false, width: 2 });

    const f = this.s.food;
    d.circle(OX + f.x * CELL + CELL / 2, OY + f.y * CELL + CELL / 2, CELL * 0.3,
      PALETTE.magenta, { glow: 14 });

    this.s.snake.forEach((p, i) => {
      const head = i === 0;
      d.roundRect(OX + p.x * CELL + 3, OY + p.y * CELL + 3, CELL - 6, CELL - 6, 7,
        head ? PALETTE.white : PALETTE.green, { glow: head ? 16 : 6 });
    });
  },

  dispose() {
    this.s = null;
    this.api = null;
  },
};
