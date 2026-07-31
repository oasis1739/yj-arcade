import { PALETTE } from '../core/draw.js';

const SCROLL_AT = 6;    // 이 레인 위로 올라가면 판을 한 칸 내린다
const RAMP_LANES = 160; // 이만큼 올라가면 최고 난이도에 도달 (그 이후는 상한 유지)
// 8세·처음 플레이 기준 2차 재조정. 1차 완화(60→100레인, 1.4→1.0)를 거친
// 뒤에도 실제로 다시 플레이해보니 여전히 너무 어려웠다는 피드백 반영.
// /tmp 진단 스크립트로 "플레이어가 서 있는 칸에 몇 초간 차가 안 지나가는가"
// (safe window)를 직접 재서 튜닝했다: 이전 값(레인1 평균 약 2.3초, 램프
// 상한 부근 평균 0.6초·안전창의 47%가 0.4초 미만)은 특히 상한 근처가
// 사실상 반응 불가능한 수준이었다. 기본 속도(1.0→0.7)와 무작위 폭
// (1.8→1.1)을 더 낮추고, 상한까지 가는 거리를 100→160레인으로 늘려 램프를
// 더 길게 펴고, 밀도 증가폭(count의 t 계수)도 2→1.5로 줄였다. 그래도
// t가 오를수록 계속 오르고 상한 이후로는 더 안 오르는 "진짜 램프"는 유지.
export function makeLane(index, rng) {
  // index===1: 학습 레인. 시작 안전지대(0) 바로 다음, 첫 교통을 만나기 전에
  // 위로 한 번 더 안전하게 이동해보며 "한 번의 입력 = 한 칸 전진" 감을
  // 잡게 한다. 그 다음부터는 기존 4번째마다 안전지대 규칙 그대로.
  if (index === 1 || index % 4 === 0) return { type: 'safe', dir: 1, speed: 0, cars: [] };

  const t = Math.min(index / RAMP_LANES, 1);    // 0(시작)..1(최고 난이도), 상한 있음
  const dir = rng.next() < 0.5 ? -1 : 1;
  const speed = 0.7 + rng.next() * 1.1 + t * 1.6;         // 초당 칸 수, 갈수록 빨라진다
  const count = 2 + rng.int(2) + Math.floor(t * 1.5);     // 갈수록 차가 조밀해진다
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
    depth: 0,     // 절대 진행 깊이(위 +1 / 아래 -1) — 판 스크롤과 무관하게 누적
    crossed: 0,   // 지금까지 도달한 "최고" 깊이. 이게 점수다.
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

  // 점수는 "지금까지 실제로 도달한 최고 깊이"다. 위아래로 왔다 갔다 해도
  // depth는 매번 오르내리지만 crossed는 최고점 갱신될 때만 올라간다 — 제자리
  // 왕복으로 점수를 파밍할 수 없게 한다("거리"라는 라벨과 맞는 동작).
  let scored = false;
  if (dlane !== 0) {
    state.depth += dlane;
    if (state.depth > state.crossed) {
      state.crossed = state.depth;
      scored = true;
    }
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
    this.over = false;
  },

  update(dt) {
    if (this.over) return;
    const s = this.s;
    advanceCars(s, dt);

    // 격자를 한 칸씩 건너는 게임이라 연속 아날로그(x/y)가 아니라 이산
    // 스텝(stepX/stepY)을 쓴다 — 한 번의 의도된 입력 = 한 칸. stepY 우선(위/
    // 아래가 진행 방향)은 기존 동작 그대로 유지.
    const p = this.api.input.p1;
    let dc = 0;
    let dl = 0;
    if (p.stepY < 0) dl = 1;
    else if (p.stepY > 0) dl = -1;
    else if (p.stepX > 0) dc = 1;
    else if (p.stepX < 0) dc = -1;

    if (dc !== 0 || dl !== 0) {
      const r = movePlayer(s, dc, dl, this.api.rng);
      if (r.moved) {
        this.api.audio.beep(dl > 0 ? 620 : 420, 40);
        if (r.scored) this.api.onScore(s.crossed);
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
      // 안전지대는 밝은 패널색, 도로는 배경보다 밝은 dim톤 아스팔트로 — 어느 쪽도
      // clear()가 채운 PALETTE.bg와 같은 색이 되면 안 된다 (레인 경계가 사라짐).
      if (lane.type === 'safe') {
        d.rect(OX, y - LANE_H + 6, COLS * CELL, LANE_H - 8, PALETTE.panel);
      } else {
        d.rect(OX, y - LANE_H + 6, COLS * CELL, LANE_H - 8, PALETTE.dim, { alpha: 0.55 });
        d.line(OX, y - LANE_H / 2, OX + COLS * CELL, y - LANE_H / 2, PALETTE.dim,
          { alpha: 0.4, width: 2 });
      }

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
