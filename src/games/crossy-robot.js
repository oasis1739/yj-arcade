import { PALETTE } from '../core/draw.js';

const SCROLL_AT = 6;   // 이 레인 위로 올라가면 판을 한 칸 내린다

// ── 순수 규칙 ────────────────────────────────────────────────────────────────
export function makeLane(index, rng) {
  if (index % 4 === 0) return { type: 'safe', dir: 1, speed: 0, cars: [] };

  const dir = rng.next() < 0.5 ? -1 : 1;
  const speed = 1.4 + rng.next() * 2.6;         // 초당 칸 수
  const count = 2 + rng.int(2);
  const cars = [];
  for (let i = 0; i < count; i++) {
    cars.push({ x: i * (15 / count) + rng.next() * 2, w: 2 + rng.int(2) });
  }
  return { type: 'road', dir, speed, cars };
}

export function createCrossyState({ cols = 15, lanes = 11, rng }) {
  const list = [];
  for (let i = 0; i < lanes; i++) list.push(makeLane(i, rng));
  list[0] = { type: 'safe', dir: 1, speed: 0, cars: [] };
  return {
    cols,
    lanes: list,
    nextIndex: lanes,
    player: { col: Math.floor(cols / 2), lane: 0 },
    crossed: 0,
    dead: false,
  };
}

export function advanceCars(state, dt) {
  for (const lane of state.lanes) {
    if (lane.type !== 'road') continue;
    for (const car of lane.cars) {
      car.x += lane.dir * lane.speed * dt;
      if (car.x > state.cols) car.x = -car.w;
      if (car.x + car.w < 0) car.x = state.cols;
    }
  }
  return state;
}

export function laneHit(lane, col) {
  if (lane.type !== 'road') return false;
  const p = col + 0.5;
  return lane.cars.some((c) => p >= c.x && p <= c.x + c.w);
}

export function movePlayer(state, dcol, dlane, rng) {
  if (state.dead) return { moved: false, scored: false };

  const col = state.player.col + dcol;
  const lane = state.player.lane + dlane;
  if (col < 0 || col >= state.cols) return { moved: false, scored: false };
  if (lane < 0) return { moved: false, scored: false };

  state.player.col = col;
  state.player.lane = lane;

  let scored = false;
  if (dlane > 0) {
    state.crossed += 1;
    scored = true;
  }

  // 위쪽에 다다르면 판을 한 칸 내리고 새 레인을 위에 붙인다.
  while (state.player.lane > SCROLL_AT) {
    state.lanes.shift();
    state.lanes.push(makeLane(state.nextIndex++, rng));
    state.player.lane -= 1;
  }

  return { moved: true, scored };
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const COLS = 15;
const LANES = 11;
const CELL = 56;                          // 15*56 = 840
const OX = (960 - COLS * CELL) / 2;
const LANE_H = 52;
const BOTTOM = 640 - 24;
const MOVE_COOLDOWN = 0.13;

export default {
  id: 'crossy-robot',
  title: '길 건너기 로봇',
  tags: ['action'],
  players: 1,
  color: PALETTE.yellow,
  controls: 'dpad',
  scoreOrder: 'high',
  scoreLabel: '거리',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.dim;
    ctx.fillRect(0, 2 * u, size, u * 1.6);
    ctx.fillRect(0, 5 * u, size, u * 1.6);
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(3.2 * u, 3.1 * u, 1.6 * u, 1.6 * u);
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(0.6 * u, 5.2 * u, 2.4 * u, 1.2 * u);
  },

  init(api) {
    this.api = api;
    this.s = createCrossyState({ cols: COLS, lanes: LANES, rng: api.rng });
    this.cool = 0;
    this.over = false;
  },

  update(dt) {
    if (this.over) return;
    const s = this.s;
    advanceCars(s, dt);

    this.cool = Math.max(0, this.cool - dt);
    const p = this.api.input.p1;
    if (this.cool === 0) {
      let dc = 0;
      let dl = 0;
      if (p.y < -0.4) dl = 1;
      else if (p.y > 0.4) dl = -1;
      else if (p.x > 0.4) dc = 1;
      else if (p.x < -0.4) dc = -1;

      if (dc !== 0 || dl !== 0) {
        const r = movePlayer(s, dc, dl, this.api.rng);
        if (r.moved) {
          this.cool = MOVE_COOLDOWN;
          this.api.audio.beep(dl > 0 ? 620 : 420, 40);
          if (r.scored) this.api.onScore(s.crossed);
        }
      }
    }

    if (laneHit(s.lanes[s.player.lane], s.player.col)) {
      s.dead = true;
      this.over = true;
      const x = OX + s.player.col * CELL + CELL / 2;
      const y = BOTTOM - s.player.lane * LANE_H;
      this.api.juice.shake(14, 0.35);
      this.api.juice.burst(x, y, { color: PALETTE.yellow, count: 26, speed: 260 });
      this.api.audio.noise(220);
      this.api.onGameOver({ score: s.crossed });
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.s;
    d.clear();

    for (let i = 0; i < s.lanes.length; i++) {
      const lane = s.lanes[i];
      const y = BOTTOM - i * LANE_H;
      d.rect(OX, y - LANE_H + 6, COLS * CELL, LANE_H - 8,
        lane.type === 'safe' ? PALETTE.panel : PALETTE.bg);

      if (lane.type === 'road') {
        for (const car of lane.cars) {
          d.roundRect(OX + car.x * CELL, y - LANE_H + 12, car.w * CELL - 8, LANE_H - 20, 8,
            lane.dir > 0 ? PALETTE.magenta : PALETTE.orange, { glow: 8 });
        }
      }
    }

    const px = OX + s.player.col * CELL + CELL / 2;
    const py = BOTTOM - s.player.lane * LANE_H - LANE_H / 2 + 3;
    d.roundRect(px - 17, py - 17, 34, 34, 8, PALETTE.cyan, { glow: 16 });
    d.rect(px - 8, py - 6, 5, 5, PALETTE.bg);
    d.rect(px + 3, py - 6, 5, 5, PALETTE.bg);
  },

  dispose() {
    this.s = null;
    this.api = null;
  },
};
