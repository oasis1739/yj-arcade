import { PALETTE } from '../core/draw.js';

// ── 튜닝 상수 ────────────────────────────────────────────────────────────────
export const LANES = 3;
export const CELLS_PER_LANE = 6;
export const LANE_UNITS = 100;      // 레인 길이(추상 단위). 0 = 농장 울타리, 100 = 벌레 스폰 지점
export const CELL_START = 12;
export const CELL_STEP = 14;        // 6칸: 12,26,40,54,68,82

// 포탑 3종. cost·damage·range·rate가 서로 달라 "뭘 놓을지"가 실제로 갈린다.
// 허수아비는 싸고 빠르지만(골드당 dps 1위) 방어구 앞에서 거의 무력화된다.
// 물대포는 사거리가 길어 레인 커버리지가 좋다(칸을 덜 채워도 된다).
// 감자캐논은 비싸고 느리지만 한 방이 커서 방어구 달린 강화 로봇에 특효다.
export const TURRET_TYPES = {
  scarecrow: {
    key: 'scarecrow', name: '허수아비', cost: 18, damage: 2, range: 15, rate: 1.6,
    color: PALETTE.yellow, shotFreq: 560,
  },
  water: {
    key: 'water', name: '물대포', cost: 38, damage: 5, range: 28, rate: 0.9,
    color: PALETTE.cyan, shotFreq: 340,
  },
  potato: {
    key: 'potato', name: '감자캐논', cost: 60, damage: 10, range: 20, rate: 0.5,
    color: PALETTE.orange, shotFreq: 180,
  },
};
export const TURRET_KEYS = Object.keys(TURRET_TYPES);

export function cellPosition(cellIndex) {
  return CELL_START + cellIndex * CELL_STEP;
}

// ── 웨이브 난이도 곡선 (순수, rng 없음 — 테스트로 램프를 바로 검증할 수 있다) ──
export function waveEnemyPlan(wave) {
  const count = 4 + Math.floor((wave - 1) * 1.4);
  const hp = 6 + (wave - 1) * 2.2;
  const speed = 5 + (wave - 1) * 0.35;
  const armored = wave % 5 === 0;          // 5웨이브마다 방어구 로봇이 섞인다
  const goldReward = 5 + Math.floor(wave * 0.3);
  return { count, hp, speed, armored, goldReward };
}

// ── 상태 ────────────────────────────────────────────────────────────────────
export function createDefenseState({
  lanes = LANES, cellsPerLane = CELLS_PER_LANE, rng, startGold = 100, startHealth = 10,
} = {}) {
  return {
    lanes,
    cellsPerLane,
    gold: startGold,
    health: startHealth,
    maxHealth: startHealth,
    wave: 0,
    wavesCleared: 0,
    kills: 0,
    score: 0,
    enemies: [],
    defenders: Array.from({ length: lanes }, () => Array(cellsPerLane).fill(null)),
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    waveGap: 1.5,     // 첫 웨이브 전 짧은 준비 시간 — 카드 UI를 볼 틈을 준다
    dead: false,
    rng,
  };
}

export function startNextWave(state, rng) {
  state.wave += 1;
  const plan = waveEnemyPlan(state.wave);
  const queue = [];
  for (let i = 0; i < plan.count; i++) {
    const armored = plan.armored && i % 3 === 2;
    const hp = armored ? plan.hp * 1.8 : plan.hp;
    queue.push({
      lane: rng.int(state.lanes),
      hp,
      maxHp: hp,
      speed: plan.speed,
      armor: armored ? 3 : 0,
      goldReward: armored ? plan.goldReward + 5 : plan.goldReward,
      pos: LANE_UNITS,
      alive: true,
    });
  }
  state.spawnQueue = queue;
  state.spawnTimer = 0;
  state.waveActive = true;
  return state;
}

// 대기 중인 스폰 큐에서 하나씩 시간차를 두고 필드에 올린다.
export function tickSpawning(state, dt) {
  if (!state.waveActive || state.spawnQueue.length === 0) return null;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return null;
  const enemy = state.spawnQueue.shift();
  state.enemies.push(enemy);
  const wave = Math.max(1, state.wave);
  state.spawnTimer = Math.max(0.35, 1.1 - wave * 0.03);   // 웨이브가 오를수록 조밀하게 나온다
  return enemy;
}

// 벌레 로봇을 농장(pos 0) 쪽으로 전진시킨다. 도달하면 체력을 깎고 치운다.
export function advanceEnemies(state, dt) {
  let reached = 0;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    e.pos -= e.speed * dt;
    if (e.pos <= 0) {
      e.alive = false;
      state.health = Math.max(0, state.health - 1);
      reached += 1;
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive);
  return reached;
}

export function canAfford(state, typeKey) {
  const type = TURRET_TYPES[typeKey];
  return !!type && state.gold >= type.cost;
}

export function placeDefender(state, laneIdx, cellIdx, typeKey) {
  if (state.dead) return { placed: false, reason: 'dead' };
  const type = TURRET_TYPES[typeKey];
  if (!type) return { placed: false, reason: 'invalid-type' };
  if (laneIdx < 0 || laneIdx >= state.lanes) return { placed: false, reason: 'out-of-bounds' };
  if (cellIdx < 0 || cellIdx >= state.cellsPerLane) return { placed: false, reason: 'out-of-bounds' };
  if (state.defenders[laneIdx][cellIdx]) return { placed: false, reason: 'occupied' };
  if (state.gold < type.cost) return { placed: false, reason: 'gold' };
  state.gold -= type.cost;
  state.defenders[laneIdx][cellIdx] = { type: typeKey, cooldown: 0, lane: laneIdx, cell: cellIdx };
  return { placed: true };
}

// 배치된 포탑을 전부 한 틱 갱신한다: 쿨다운을 줄이고, 준비됐으면 같은 레인에서
// 사거리 안의 가장 가까운 적을 쏜다. 방어구는 데미지를 깎지만 최소 1은 들어간다.
export function updateDefenders(state, dt) {
  const events = [];
  for (let laneIdx = 0; laneIdx < state.defenders.length; laneIdx++) {
    const lane = state.defenders[laneIdx];
    for (let cellIdx = 0; cellIdx < lane.length; cellIdx++) {
      const d = lane[cellIdx];
      if (!d) continue;
      d.cooldown -= dt;
      if (d.cooldown > 0) continue;
      const type = TURRET_TYPES[d.type];
      const myPos = cellPosition(cellIdx);

      let target = null;
      let bestDist = Infinity;
      for (const e of state.enemies) {
        if (!e.alive || e.lane !== laneIdx) continue;
        const dist = Math.abs(e.pos - myPos);
        if (dist <= type.range && dist < bestDist) { bestDist = dist; target = e; }
      }
      if (!target) continue;

      d.cooldown = 1 / type.rate;
      const dmg = Math.max(1, type.damage - target.armor);
      target.hp -= dmg;
      events.push({ kind: 'shot', lane: laneIdx, cell: cellIdx, type: d.type, pos: target.pos });

      if (target.hp <= 0 && target.alive) {
        target.alive = false;
        state.gold += target.goldReward;
        state.kills += 1;
        state.score = state.kills + state.wavesCleared * 10;
        events.push({ kind: 'kill', lane: laneIdx, pos: target.pos });
      }
    }
  }
  state.enemies = state.enemies.filter((e) => e.alive);
  return events;
}

// 스폰 큐가 비고 살아있는 적이 없으면 웨이브 클리어. 다음 웨이브까지 텀을 둔다.
export function checkWaveComplete(state) {
  if (!state.waveActive) return false;
  if (state.spawnQueue.length > 0 || state.enemies.length > 0) return false;
  state.waveActive = false;
  state.wavesCleared += 1;
  state.score = state.kills + state.wavesCleared * 10;
  state.waveGap = 3;
  return true;
}

export function checkGameOver(state) {
  if (state.dead) return true;
  if (state.health <= 0) {
    state.dead = true;
    return true;
  }
  return false;
}

// ── 화면 배치 (그리기 + 탭 판정이 공유하는 순수 좌표 변환) ───────────────────
const FIELD_LEFT = 120;
const FIELD_RIGHT = 900;
const FIELD_TOP = 76;
const LANE_H = 148;                 // 3레인 * 148 = 444 → 76..520
const CELL_W = 78;
const CELL_H = 96;
const CARD_Y = 528;
const CARD_H = 96;
const CARD_W = 260;
const CARD_GAP = 20;
const CARD_START_X = 70;

function laneCenterY(laneIdx) {
  return FIELD_TOP + laneIdx * LANE_H + LANE_H / 2;
}
function posToX(pos) {
  return FIELD_LEFT + (pos / LANE_UNITS) * (FIELD_RIGHT - FIELD_LEFT);
}
function cellCenter(laneIdx, cellIdx) {
  return { x: posToX(cellPosition(cellIdx)), y: laneCenterY(laneIdx) };
}
function cardRect(i) {
  return { x: CARD_START_X + i * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H };
}

// 탭 좌표 → 밭 칸. 순수 함수라 캔버스 없이 테스트할 수 있다.
export function pickCellAt(x, y, lanes = LANES, cellsPerLane = CELLS_PER_LANE) {
  if (y < FIELD_TOP || y >= FIELD_TOP + LANE_H * lanes) return null;
  const laneIdx = Math.floor((y - FIELD_TOP) / LANE_H);
  for (let c = 0; c < cellsPerLane; c++) {
    const { x: cx, y: cy } = cellCenter(laneIdx, c);
    if (Math.abs(x - cx) <= CELL_W / 2 && Math.abs(y - cy) <= CELL_H / 2) return { lane: laneIdx, cell: c };
  }
  return null;
}

// 탭 좌표 → 하단 포탑 카드.
export function pickCardAt(x, y) {
  for (let i = 0; i < TURRET_KEYS.length; i++) {
    const r = cardRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return TURRET_KEYS[i];
  }
  return null;
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
export default {
  id: 'farm-defense',
  title: '농장 디펜스',
  tags: ['defense'],
  players: 1,
  color: PALETTE.green,
  controls: 'pointer',
  scoreOrder: 'high',
  scoreLabel: '점수',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.green;
    ctx.fillRect(0, 5.6 * u, size, 1.2 * u);
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(1.3 * u, 2.4 * u, 1.4 * u, 3.2 * u);
    ctx.fillRect(0.6 * u, 2 * u, 2.8 * u, 0.9 * u);
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(5 * u, 4.3 * u, 2 * u, 1.5 * u);
    ctx.fillStyle = PALETTE.magenta;
    ctx.fillRect(5.3 * u, 4.7 * u, 0.5 * u, 0.5 * u);
    ctx.fillRect(6.3 * u, 4.7 * u, 0.5 * u, 0.5 * u);
  },

  init(api) {
    this.api = api;
    this.s = createDefenseState({ rng: api.rng });
    this.selected = null;
    this.over = false;
    this.lastScore = 0;
  },

  update(dt) {
    if (this.over) return;
    const api = this.api;
    const s = this.s;

    // ── 입력: 카드 선택 → 밭 칸 탭으로 배치 ──
    const ptr = api.input.pointer;
    if (ptr.pressed) {
      const cardKey = pickCardAt(ptr.x, ptr.y);
      if (cardKey) {
        this.selected = this.selected === cardKey ? null : cardKey;
        api.audio.beep(480, 30);
      } else {
        const cell = pickCellAt(ptr.x, ptr.y, s.lanes, s.cellsPerLane);
        if (cell && this.selected) {
          const res = placeDefender(s, cell.lane, cell.cell, this.selected);
          if (res.placed) {
            const { x, y } = cellCenter(cell.lane, cell.cell);
            api.audio.beep(660, 55);
            api.juice.burst(x, y, { color: TURRET_TYPES[this.selected].color, count: 10, speed: 120 });
          } else {
            api.audio.beep(160, 90, 'square');
          }
        }
      }
    }

    // ── 웨이브 진행 ──
    if (!s.waveActive) {
      s.waveGap -= dt;
      if (s.waveGap <= 0) startNextWave(s, api.rng);
    } else {
      tickSpawning(s, dt);
    }

    const reached = advanceEnemies(s, dt);
    if (reached > 0) {
      api.juice.shake(5 * reached, 0.25);
      api.audio.noise(160);
    }

    const events = updateDefenders(s, dt);
    for (const ev of events) {
      if (ev.kind === 'shot') {
        api.audio.beep(TURRET_TYPES[ev.type].shotFreq, 25);
      } else if (ev.kind === 'kill') {
        const x = posToX(ev.pos);
        const y = laneCenterY(ev.lane);
        api.juice.burst(x, y, { color: PALETTE.orange, count: 14, speed: 180 });
        api.audio.beep(920, 45);
      }
    }

    checkWaveComplete(s);

    if (s.score !== this.lastScore) {
      this.lastScore = s.score;
      api.onScore(s.score);
    }

    if (checkGameOver(s)) {
      this.over = true;
      api.juice.shake(22, 0.5);
      api.audio.sweep(320, 60, 420);
      api.onGameOver({ score: s.score });
    }
  },

  render(ctx) {
    const d = this.api.draw;
    const s = this.s;
    d.clear();

    // 밭 레인 배경
    for (let i = 0; i < s.lanes; i++) {
      const y = FIELD_TOP + i * LANE_H;
      d.rect(FIELD_LEFT - 20, y + 6, (FIELD_RIGHT - FIELD_LEFT) + 40, LANE_H - 12,
        i % 2 === 0 ? PALETTE.panel : PALETTE.dim, { alpha: i % 2 === 0 ? 0.5 : 0.22 });
    }

    // 배치 슬롯 테두리
    for (let laneIdx = 0; laneIdx < s.lanes; laneIdx++) {
      for (let c = 0; c < s.cellsPerLane; c++) {
        const { x, y } = cellCenter(laneIdx, c);
        const occupied = s.defenders[laneIdx][c];
        d.roundRect(x - CELL_W / 2, y - CELL_H / 2, CELL_W, CELL_H, 10, PALETTE.dim,
          { fill: false, width: 2, alpha: occupied ? 0.25 : 0.55 });
      }
    }

    // 농장 울타리
    d.roundRect(FIELD_LEFT - 46, FIELD_TOP - 4, 34, LANE_H * s.lanes + 8, 8, PALETTE.green, { alpha: 0.35 });
    d.text('농장', FIELD_LEFT - 29, FIELD_TOP + 14, { size: 14, color: PALETTE.green });

    // 배치된 포탑
    for (let laneIdx = 0; laneIdx < s.lanes; laneIdx++) {
      for (let c = 0; c < s.cellsPerLane; c++) {
        const def = s.defenders[laneIdx][c];
        if (!def) continue;
        const type = TURRET_TYPES[def.type];
        const { x, y } = cellCenter(laneIdx, c);
        d.roundRect(x - 26, y - 26, 52, 52, 10, type.color, { glow: 10 });
        d.text(type.name[0], x, y, { size: 22, color: PALETTE.bg, bold: true });
      }
    }

    // 벌레 로봇
    for (const e of s.enemies) {
      const x = posToX(e.pos);
      const y = laneCenterY(e.lane);
      d.roundRect(x - 20, y - 20, 40, 40, 8, e.armor > 0 ? PALETTE.magenta : PALETTE.red,
        { glow: e.armor > 0 ? 12 : 6 });
      const ratio = Math.max(0, e.hp / e.maxHp);
      d.rect(x - 20, y - 28, 40, 5, PALETTE.dim);
      d.rect(x - 20, y - 28, 40 * ratio, 5, PALETTE.green);
    }

    // 상단 정보 바 (셸 HUD/일시정지 예약구역은 피한다)
    const waveLabel = s.waveActive
      ? `웨이브 ${s.wave}`
      : `다음 웨이브 준비 ${Math.max(0, Math.ceil(s.waveGap))}`;
    d.text(waveLabel, 310, 28, { size: 20, align: 'left', color: PALETTE.white });
    d.text(`골드 ${s.gold}`, 310, 52, { size: 16, align: 'left', color: PALETTE.yellow });
    for (let i = 0; i < s.maxHealth; i++) {
      d.circle(690 + i * 17, 34, 6, i < s.health ? PALETTE.red : PALETTE.dim, { glow: i < s.health ? 6 : 0 });
    }

    // 하단 포탑 카드
    for (let i = 0; i < TURRET_KEYS.length; i++) {
      const key = TURRET_KEYS[i];
      const type = TURRET_TYPES[key];
      const r = cardRect(i);
      const affordable = s.gold >= type.cost;
      const selected = this.selected === key;
      d.roundRect(r.x, r.y, r.w, r.h, 14, PALETTE.panel, { alpha: 0.9 });
      d.roundRect(r.x, r.y, r.w, r.h, 14, selected ? PALETTE.white : type.color,
        { fill: false, width: selected ? 4 : 2, glow: selected ? 14 : 6 });
      d.roundRect(r.x + 14, r.y + 14, 34, 34, 8, type.color, { glow: 8 });
      d.text(type.name, r.x + 60, r.y + 24, { size: 18, align: 'left', color: PALETTE.white, bold: true });
      d.text(`골드 ${type.cost}`, r.x + 60, r.y + 48,
        { size: 14, align: 'left', color: affordable ? PALETTE.yellow : PALETTE.dim });
      d.text(`공격 ${type.damage} · 사거리 ${Math.round(type.range)}`, r.x + 16, r.y + 76,
        { size: 12, align: 'left', color: PALETTE.dim });
    }

    if (s.dead) {
      d.text('농장이 무너졌다!', 500, 300, { size: 28, bold: true, color: PALETTE.red, glow: 14 });
    }
  },

  dispose() {
    this.s = null;
    this.api = null;
    this.selected = null;
  },
};
