import { PALETTE } from '../core/draw.js';
import { makeRng } from '../core/rng.js';
import { createStorage } from '../core/storage.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────
//
// 미로는 "칸(cell) + 4방향 벽" 표현을 쓴다. walls[r][c] = { N, S, E, W }
// (true = 벽 있음 = 못 지나감). 생성은 표준 재귀 백트래킹(무작위 DFS)으로 만든
// 완전 미로(perfect maze, 스패닝 트리)라서 항상 모든 칸이 서로 연결된다 —
// "항상 풀 수 있다"가 알고리즘으로 보장된다. 문(door)은 이미 뚫린 통로 위에
// 얹는 논리적 게이트일 뿐, 벽 비트는 건드리지 않는다.

const DIRS = [
  { dr: -1, dc: 0, dir: 'N', opp: 'S' },
  { dr: 1, dc: 0, dir: 'S', opp: 'N' },
  { dr: 0, dc: -1, dir: 'W', opp: 'E' },
  { dr: 0, dc: 1, dir: 'E', opp: 'W' },
];

function inBounds(w, h, r, c) {
  return r >= 0 && r < h && c >= 0 && c < w;
}

function dirBetween(r, c, nr, nc) {
  const dr = nr - r;
  const dc = nc - c;
  const found = DIRS.find((d) => d.dr === dr && d.dc === dc);
  return found ? found.dir : null;
}

function edgeKey(r1, c1, r2, c2) {
  return r1 * 1000 + c1 < r2 * 1000 + c2
    ? `${r1},${c1}|${r2},${c2}`
    : `${r2},${c2}|${r1},${c1}`;
}

// 5단계 구간(밴드)마다 규칙을 하나씩 새로 소개하고, 5구간(41~50)에서 전부
// 합친다. 미로 크기는 구간 경계와 무관하게 5단계마다 한 칸씩 계속 커진다 —
// "구간 안에서도 조금씩 커진다"를 자연스럽게 만족한다.
export function stageConfig(stage) {
  const s = Math.min(50, Math.max(1, Math.floor(stage) || 1));
  const band = Math.min(5, Math.ceil(s / 10));
  const posInBand = (s - 1) % 10; // 0..9

  const size = Math.min(14, 5 + Math.floor((s - 1) / 5));

  const keysCount = band === 2 || band === 5 ? 1 : 0;

  const fog = band === 3 || band === 5;
  let fogRadius = null;
  if (fog) {
    let r = 4 - Math.floor(posInBand / 3);
    if (band === 5) r -= 1;
    fogRadius = Math.max(2, r);
  }

  let patrolCount = 0;
  if (band === 4) patrolCount = posInBand >= 5 ? 2 : 1;
  else if (band === 5) patrolCount = 2;
  const patrolInterval = patrolCount > 0 ? Math.max(0.28, 0.55 - posInBand * 0.025) : null;

  const timeLimit = band === 5 ? Math.max(50, 110 - posInBand * 6) : null;

  return {
    stage: s,
    band,
    mazeW: size,
    mazeH: size,
    keysCount,
    fog,
    fogRadius,
    patrolCount,
    patrolInterval,
    timeLimit,
  };
}

// 무작위 DFS(재귀 백트래킹) — 스택을 직접 관리해 재귀 깊이 걱정 없이 O(w*h)로
// 끝난다. 항상 모든 칸을 하나의 스패닝 트리로 연결한다(=항상 풀 수 있다).
export function generateMaze(w, h, rng) {
  const walls = [];
  for (let r = 0; r < h; r++) {
    const row = [];
    for (let c = 0; c < w; c++) row.push({ N: true, S: true, E: true, W: true });
    walls.push(row);
  }
  const visited = Array.from({ length: h }, () => new Array(w).fill(false));
  const stack = [{ r: 0, c: 0 }];
  visited[0][0] = true;
  let count = 1;
  const total = w * h;

  while (stack.length > 0 && count < total) {
    const cur = stack[stack.length - 1];
    const options = [];
    for (const d of DIRS) {
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      if (inBounds(w, h, nr, nc) && !visited[nr][nc]) {
        options.push({ nr, nc, dir: d.dir, opp: d.opp });
      }
    }
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const pick = options[rng.int(options.length)];
    walls[cur.r][cur.c][pick.dir] = false;
    walls[pick.nr][pick.nc][pick.opp] = false;
    visited[pick.nr][pick.nc] = true;
    count += 1;
    stack.push({ r: pick.nr, c: pick.nc });
  }

  return { w, h, walls };
}

// 벽만 보고(문 무시) 시작점에서 갈 수 있는 모든 칸을 넓힌다.
export function floodFill(maze, start) {
  const seen = new Set([`${start.r},${start.c}`]);
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi];
    qi += 1;
    for (const d of DIRS) {
      if (maze.walls[cur.r][cur.c][d.dir]) continue;
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ r: nr, c: nc });
    }
  }
  return seen;
}

export function isMazeSolvable(maze, start, exit) {
  return floodFill(maze, start).has(`${exit.r},${exit.c}`);
}

// 시작→출구까지의 유일한 경로(스패닝 트리라 유일하다)를 BFS로 구한다.
function findPath(maze, start, exit) {
  const parent = new Map();
  const startKey = `${start.r},${start.c}`;
  parent.set(startKey, null);
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi];
    qi += 1;
    if (cur.r === exit.r && cur.c === exit.c) break;
    for (const d of DIRS) {
      if (maze.walls[cur.r][cur.c][d.dir]) continue;
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      const key = `${nr},${nc}`;
      if (parent.has(key)) continue;
      parent.set(key, `${cur.r},${cur.c}`);
      queue.push({ r: nr, c: nc });
    }
  }
  const exitKey = `${exit.r},${exit.c}`;
  if (!parent.has(exitKey)) return null;
  const path = [];
  let cur = exitKey;
  while (cur !== null) {
    const [r, c] = cur.split(',').map(Number);
    path.push({ r, c });
    cur = parent.get(cur);
  }
  path.reverse();
  return path;
}

// 문(door)까지 감안한 도달 가능 영역. openDoorIds에 없는 문은 잠긴 걸로 본다.
function floodFillWithDoors(maze, start, doorMap, openDoorIds) {
  const seen = new Set([`${start.r},${start.c}`]);
  const queue = [start];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi];
    qi += 1;
    for (const d of DIRS) {
      if (maze.walls[cur.r][cur.c][d.dir]) continue;
      const nr = cur.r + d.dr;
      const nc = cur.c + d.dc;
      const door = doorMap.get(edgeKey(cur.r, cur.c, nr, nc));
      if (door && !openDoorIds.has(door.id)) continue;
      const key = `${nr},${nc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ r: nr, c: nc });
    }
  }
  return seen;
}

// 시작→출구 경로 위의 통로 몇 개를 "문"으로 바꾸고, 각 문의 열쇠를 그 문을
// 열기 "전에" 갈 수 있는 영역 안에 둔다 — 항상 순서대로 풀린다(막힐 수 없다).
export function placeKeysAndDoors(maze, rng, keysCount, start, exit) {
  const keys = [];
  const doors = [];
  const doorMap = new Map();
  if (keysCount <= 0) return { keys, doors, doorMap };

  const path = findPath(maze, start, exit) || [start, exit];
  const edgeCount = Math.max(1, path.length - 1);
  const n = Math.min(keysCount, edgeCount);

  const chosenIdx = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.min(edgeCount - 1, Math.floor(((i + 1) * edgeCount) / (n + 1)));
    if (!chosenIdx.includes(idx)) chosenIdx.push(idx);
  }
  chosenIdx.sort((a, b) => a - b);

  // 문을 전부 먼저 등록해야, 뒤쪽 열쇠 위치를 찾는 flood fill이 "아직 안 딴
  // 뒤쪽 문"도 제대로 막힌 걸로 취급한다(안 그러면 열쇠가 미래의 문 너머에
  // 놓여 잠길 수 있다).
  chosenIdx.forEach((idx, i) => {
    const a = path[idx];
    const b = path[idx + 1];
    const door = { id: i, r: a.r, c: a.c, nr: b.r, nc: b.c, keyId: i, open: false };
    doors.push(door);
    doorMap.set(edgeKey(a.r, a.c, b.r, b.c), door);
  });

  const usedCells = new Set([`${start.r},${start.c}`, `${exit.r},${exit.c}`]);
  const openDoorIds = new Set();

  doors.forEach((door) => {
    const reachable = floodFillWithDoors(maze, start, doorMap, openDoorIds);
    const candidates = [...reachable].filter((k) => !usedCells.has(k)).sort();
    const cellKey = candidates.length > 0
      ? candidates[rng.int(candidates.length)]
      : `${door.r},${door.c}`;
    const [kr, kc] = cellKey.split(',').map(Number);
    keys.push({ id: door.id, r: kr, c: kc, collected: false });
    usedCells.add(cellKey);
    openDoorIds.add(door.id);
  });

  return { keys, doors, doorMap };
}

// 순찰 로봇: 미로 통로를 따라가는 짧은 무작위 걷기 경로를 만들어 그 위를
// 왕복시킨다. 경로 탐색은 아니다 — 고정 길이로 끊어서 항상 끝난다.
export function createPatrols(maze, rng, count, avoid) {
  const patrols = [];
  const avoidSet = new Set((avoid || []).map((p) => `${p.r},${p.c}`));
  const w = maze.w;
  const h = maze.h;
  const MAX_LEN = 7;
  const MAX_ATTEMPTS = 20;

  for (let i = 0; i < count; i++) {
    let route = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !route; attempt++) {
      const sr = rng.int(h);
      const sc = rng.int(w);
      if (avoidSet.has(`${sr},${sc}`)) continue;
      const walk = [{ r: sr, c: sc }];
      const seen = new Set([`${sr},${sc}`]);
      for (let step = 0; step < MAX_LEN; step++) {
        const cur = walk[walk.length - 1];
        const options = DIRS.filter((d) => {
          if (maze.walls[cur.r][cur.c][d.dir]) return false;
          const nr = cur.r + d.dr;
          const nc = cur.c + d.dc;
          const key = `${nr},${nc}`;
          return !seen.has(key) && !avoidSet.has(key);
        });
        if (options.length === 0) break;
        const pick = options[rng.int(options.length)];
        const nr = cur.r + pick.dr;
        const nc = cur.c + pick.dc;
        walk.push({ r: nr, c: nc });
        seen.add(`${nr},${nc}`);
      }
      if (walk.length >= 2) route = walk;
    }
    if (!route) route = [{ r: 0, c: 0 }, { r: 0, c: Math.min(1, w - 1) }];
    patrols.push({ id: i, route, index: 0, dir: 1, timer: 0, initIndex: 0, initDir: 1 });
  }
  return patrols;
}

// 단계 하나를 완전히 만든다. stage 번호 자체가 시드라서 언제 불러도 같은
// 결과가 나온다(makeRng(stage) 하나로 미로·문/열쇠·순찰 전부를 순서대로
// 뽑는다 — Math.random은 쓰지 않는다).
export function createStage(stage) {
  const clamped = Math.min(50, Math.max(1, Math.floor(stage) || 1));
  const cfg = stageConfig(clamped);
  const rng = makeRng(clamped);
  const maze = generateMaze(cfg.mazeW, cfg.mazeH, rng);
  const start = { r: cfg.mazeH - 1, c: 0 };
  const exit = { r: 0, c: cfg.mazeW - 1 };
  const { keys, doors, doorMap } = placeKeysAndDoors(maze, rng, cfg.keysCount, start, exit);
  const avoid = [start, exit, ...keys.map((k) => ({ r: k.r, c: k.c }))];
  const patrols = cfg.patrolCount > 0 ? createPatrols(maze, rng, cfg.patrolCount, avoid) : [];

  return {
    stage: clamped,
    cfg,
    maze,
    start,
    exit,
    keys,
    doors,
    doorMap,
    patrols,
    player: { r: start.r, c: start.c },
    timeLeft: cfg.timeLimit,
    cleared: false,
  };
}

export function canPass(stageData, r, c, nr, nc) {
  const dir = dirBetween(r, c, nr, nc);
  if (!dir) return false;
  if (stageData.maze.walls[r][c][dir]) return false;
  const door = stageData.doorMap.get(edgeKey(r, c, nr, nc));
  if (door && !door.open) return false;
  return true;
}

// 플레이어를 한 칸 움직여본다. 격자 스텝(stepX/stepY)의 "한 번의 의도된
// 입력 = 한 칸"에 정확히 대응한다.
export function tryMove(stageData, dr, dc) {
  if (stageData.cleared) return { moved: false, blocked: false };
  if (dr === 0 && dc === 0) return { moved: false, blocked: false };

  const { r, c } = stageData.player;
  const nr = r + dr;
  const nc = c + dc;
  if (!inBounds(stageData.maze.w, stageData.maze.h, nr, nc)) {
    return { moved: false, blocked: true };
  }
  if (!canPass(stageData, r, c, nr, nc)) {
    return { moved: false, blocked: true };
  }

  stageData.player = { r: nr, c: nc };

  let collectedKey = null;
  for (const key of stageData.keys) {
    if (!key.collected && key.r === nr && key.c === nc) {
      key.collected = true;
      collectedKey = key.id;
      for (const door of stageData.doors) {
        if (door.keyId === key.id) door.open = true;
      }
    }
  }

  const exited = nr === stageData.exit.r && nc === stageData.exit.c;
  if (exited) stageData.cleared = true;

  return { moved: true, blocked: false, collectedKey, exited };
}

// 안개(시야 제한): 플레이어를 중심으로 한 정사각 반경. 그리기 시점에만 쓰는
// 순수 가시성 판정이라 상태는 전혀 바꾸지 않는다.
export function isCellVisible(playerR, playerC, fogRadius, r, c) {
  if (fogRadius == null) return true;
  return Math.max(Math.abs(r - playerR), Math.abs(c - playerC)) <= fogRadius;
}

// 문/열쇠까지 감안해 "실제로 순서대로 열면서 출구까지 갈 수 있는지"를
// 검증한다. 문 개수만큼만 반복하므로 항상 끝난다.
export function isStageSolvable(stageData) {
  const { maze, start, exit, keys, doors, doorMap } = stageData;
  const openDoorIds = new Set();
  let reachable = new Set();
  let changed = true;
  let guard = 0;
  while (changed && guard <= doors.length + 1) {
    changed = false;
    guard += 1;
    reachable = floodFillWithDoors(maze, start, doorMap, openDoorIds);
    for (const door of doors) {
      if (openDoorIds.has(door.id)) continue;
      const key = keys.find((k) => k.id === door.keyId);
      if (key && reachable.has(`${key.r},${key.c}`)) {
        openDoorIds.add(door.id);
        changed = true;
      }
    }
  }
  return reachable.has(`${exit.r},${exit.c}`);
}

export function updatePatrols(stageData, dt) {
  const interval = stageData.cfg.patrolInterval ?? 0.5;
  for (const p of stageData.patrols) {
    if (p.route.length < 2) continue;
    p.timer += dt;
    if (p.timer >= interval) {
      p.timer -= interval;
      p.index += p.dir;
      if (p.index >= p.route.length) {
        p.index = p.route.length - 1;
        p.dir = -1;
      } else if (p.index < 0) {
        p.index = 0;
        p.dir = 1;
      }
    }
  }
}

export function patrolsTouchingPlayer(stageData) {
  return stageData.patrols.some((p) => {
    const cell = p.route[p.index];
    return cell.r === stageData.player.r && cell.c === stageData.player.c;
  });
}

export function tickTimer(stageData, dt) {
  if (stageData.timeLeft == null || stageData.cleared) return { expired: false };
  stageData.timeLeft -= dt;
  if (stageData.timeLeft <= 0) {
    stageData.timeLeft = 0;
    return { expired: true };
  }
  return { expired: false };
}

// 순찰 로봇에 닿거나 시간이 다 되면 "그 단계 처음부터" 다시 — 미로 자체는
// 그대로 두고(같은 시드니까 다시 만들 필요도 없다) 플레이어·열쇠·문·순찰만
// 초기 상태로 되돌린다.
export function resetStageAttempt(stageData) {
  stageData.player = { r: stageData.start.r, c: stageData.start.c };
  for (const key of stageData.keys) key.collected = false;
  for (const door of stageData.doors) door.open = false;
  for (const p of stageData.patrols) {
    p.index = p.initIndex;
    p.dir = p.initDir;
    p.timer = 0;
  }
  stageData.timeLeft = stageData.cfg.timeLimit;
  stageData.cleared = false;
  return stageData;
}

export function loadProgress(storage) {
  const v = storage.get('stage', 1);
  if (!Number.isInteger(v) || v < 1 || v > 50) return 1;
  return v;
}

export function saveProgress(storage, stage) {
  storage.set('stage', Math.min(50, Math.max(1, Math.floor(stage))));
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
// 화면 예약 구역(HUD 점수/일시정지, dpad 오버레이 좌하단)을 다 피해서 미로를
// 놓을 수 있는 사각형. dpad 영역(24,460)~(180,616) 위쪽에서 끝나도록 세로를
// 좁게 잡는다.
const PLAY_X = 40;
const PLAY_Y = 76;
const PLAY_W = 880;
const PLAY_H = 360;

function gridOrigin(cfg) {
  const cell = Math.min(PLAY_W / cfg.mazeW, PLAY_H / cfg.mazeH);
  const gw = cell * cfg.mazeW;
  const gh = cell * cfg.mazeH;
  return { cell, ox: PLAY_X + (PLAY_W - gw) / 2, oy: PLAY_Y + (PLAY_H - gh) / 2 };
}

function doorSegment(door, cell, ox, oy) {
  const ax = ox + door.c * cell;
  const ay = oy + door.r * cell;
  const bx = ox + door.nc * cell;
  const by = oy + door.nr * cell;
  if (door.r === door.nr) {
    const x = Math.max(ax, bx);
    return { x1: x, y1: ay + cell * 0.15, x2: x, y2: ay + cell * 0.85 };
  }
  const y = Math.max(ay, by);
  return { x1: ax + cell * 0.15, y1: y, x2: ax + cell * 0.85, y2: y };
}

const STORAGE_PREFIX = 'maze-50';

export default {
  id: 'maze-50',
  title: '미로 탈출 50',
  tags: ['puzzle'],
  players: 1,
  color: PALETTE.cyan,
  controls: 'dpad',
  scoreOrder: 'high',
  scoreLabel: '단계',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(u * 0.5, u * 0.5, size - u, size - u);
    ctx.strokeStyle = PALETTE.white;
    ctx.lineWidth = Math.max(1, u * 0.25);
    ctx.beginPath();
    ctx.moveTo(u * 1.3, u * 1.3);
    ctx.lineTo(u * 1.3, u * 4.2);
    ctx.lineTo(u * 4.2, u * 4.2);
    ctx.lineTo(u * 4.2, u * 1.3);
    ctx.lineTo(u * 6.6, u * 1.3);
    ctx.stroke();
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillRect(u * 0.7, u * 0.7, u * 1.2, u * 1.2);
    ctx.fillStyle = PALETTE.green;
    ctx.beginPath();
    ctx.arc(size - u * 1.4, size - u * 1.4, u * 0.9, 0, Math.PI * 2);
    ctx.fill();
  },

  init(api) {
    this.api = api;
    this.storage = createStorage(STORAGE_PREFIX);
    this.stageNum = loadProgress(this.storage);
    this.stageData = createStage(this.stageNum);
    this.finished = false;
    this.overReported = false;
    this.api.onScore(this.stageNum);
  },

  cellCenter(r, c) {
    const { cell, ox, oy } = gridOrigin(this.stageData.cfg);
    return { x: ox + c * cell + cell / 2, y: oy + r * cell + cell / 2 };
  },

  handleCleared() {
    const api = this.api;
    const s = this.stageData;
    const ec = this.cellCenter(s.exit.r, s.exit.c);
    api.audio.sweep(520, 900, 220);
    api.juice.burst(ec.x, ec.y, { color: PALETTE.green, count: 26, speed: 200 });
    api.juice.shake(4, 0.15);

    if (this.stageNum >= 50) {
      this.finished = true;
      if (!this.overReported) {
        this.overReported = true;
        api.audio.sweep(400, 1200, 500);
        api.juice.shake(10, 0.3);
        api.onGameOver({ score: this.stageNum });
      }
      return;
    }

    this.stageNum += 1;
    saveProgress(this.storage, this.stageNum);
    this.stageData = createStage(this.stageNum);
    api.onScore(this.stageNum);
  },

  handleFail() {
    const api = this.api;
    const s = this.stageData;
    const pc = this.cellCenter(s.player.r, s.player.c);
    api.audio.noise(200);
    api.juice.shake(10, 0.3);
    api.juice.burst(pc.x, pc.y, { color: PALETTE.red, count: 20, speed: 180 });
    resetStageAttempt(s);
  },

  update(dt) {
    if (this.finished) return;
    const api = this.api;
    const s = this.stageData;

    if (s.cfg.patrolCount > 0) updatePatrols(s, dt);

    let timedOut = false;
    if (s.cfg.timeLimit != null) timedOut = tickTimer(s, dt).expired;

    // 격자를 한 칸씩 움직이는 게임이라 연속 아날로그(x/y)가 아니라 이산
    // 스텝(stepX/stepY)을 쓴다 — 한 번의 의도된 입력 = 한 칸.
    const p = api.input.p1;
    let dr = 0;
    let dc = 0;
    if (p.stepY < 0) dr = -1;
    else if (p.stepY > 0) dr = 1;
    else if (p.stepX > 0) dc = 1;
    else if (p.stepX < 0) dc = -1;

    if (!s.cleared && (dr !== 0 || dc !== 0)) {
      const r = tryMove(s, dr, dc);
      if (r.moved) {
        api.audio.beep(dr < 0 ? 620 : 480, 30);
        if (r.collectedKey !== null && r.collectedKey !== undefined) {
          api.audio.beep(880, 80);
          const kc = this.cellCenter(s.player.r, s.player.c);
          api.juice.burst(kc.x, kc.y, { color: PALETTE.yellow, count: 14, speed: 140 });
        }
        if (r.exited) {
          this.handleCleared();
          return;
        }
      } else if (r.blocked) {
        api.audio.noise(50);
      }
    }

    const patrolHit = s.cfg.patrolCount > 0 && patrolsTouchingPlayer(s);
    if (patrolHit || timedOut) this.handleFail();
  },

  render(ctx) {
    const d = this.api.draw;
    d.clear();

    if (this.finished) {
      d.text('50단계 클리어!', 480, 280, { size: 40, bold: true, color: PALETTE.green, glow: 16 });
      d.text('미로 탈출 성공', 480, 330, { size: 22, color: PALETTE.white });
      return;
    }

    const s = this.stageData;
    const cfg = s.cfg;
    const { cell, ox, oy } = gridOrigin(cfg);

    d.rect(ox, oy, cell * cfg.mazeW, cell * cfg.mazeH, PALETTE.panel);

    for (let r = 0; r < cfg.mazeH; r++) {
      for (let c = 0; c < cfg.mazeW; c++) {
        const x = ox + c * cell;
        const y = oy + r * cell;
        const w = s.maze.walls[r][c];
        if (w.N) d.line(x, y, x + cell, y, PALETTE.white, { width: 3 });
        if (w.W) d.line(x, y, x, y + cell, PALETTE.white, { width: 3 });
        if (w.S) d.line(x, y + cell, x + cell, y + cell, PALETTE.white, { width: 3 });
        if (w.E) d.line(x + cell, y, x + cell, y + cell, PALETTE.white, { width: 3 });
      }
    }

    const exitC = this.cellCenter(s.exit.r, s.exit.c);
    d.circle(exitC.x, exitC.y, cell * 0.32, PALETTE.green, { glow: 14 });
    d.circle(exitC.x, exitC.y, cell * 0.16, PALETTE.panel, {});

    for (const door of s.doors) {
      const seg = doorSegment(door, cell, ox, oy);
      d.line(seg.x1, seg.y1, seg.x2, seg.y2, door.open ? PALETTE.green : PALETTE.orange,
        { width: 6, glow: door.open ? 0 : 8 });
    }

    for (const key of s.keys) {
      if (key.collected) continue;
      const kc = this.cellCenter(key.r, key.c);
      d.circle(kc.x, kc.y, cell * 0.18, PALETTE.yellow, { glow: 10 });
    }

    for (const patrol of s.patrols) {
      const cur = patrol.route[patrol.index];
      const pc = this.cellCenter(cur.r, cur.c);
      d.rect(pc.x - cell * 0.22, pc.y - cell * 0.22, cell * 0.44, cell * 0.44, PALETTE.red, { glow: 10 });
    }

    if (cfg.fog) {
      for (let r = 0; r < cfg.mazeH; r++) {
        for (let c = 0; c < cfg.mazeW; c++) {
          if (isCellVisible(s.player.r, s.player.c, cfg.fogRadius, r, c)) continue;
          d.rect(ox + c * cell, oy + r * cell, cell, cell, PALETTE.bg);
        }
      }
    }

    const pc = this.cellCenter(s.player.r, s.player.c);
    d.circle(pc.x, pc.y, cell * 0.3, PALETTE.cyan, { glow: 16 });

    if (cfg.timeLimit != null) {
      const frac = Math.max(0, s.timeLeft / cfg.timeLimit);
      const barW = 280;
      const barX = 340;
      const barY = 20;
      const barH = 12;
      d.rect(barX, barY, barW, barH, PALETTE.panel);
      const barColor = frac > 0.5 ? PALETTE.green : frac > 0.25 ? PALETTE.yellow : PALETTE.red;
      d.rect(barX, barY, barW * frac, barH, barColor);
    }

    if (cfg.keysCount > 0) {
      const total = s.keys.length;
      const gap = 26;
      const startX = 480 - ((total - 1) * gap) / 2;
      const y = cfg.timeLimit != null ? 48 : 30;
      s.keys.forEach((key, i) => {
        d.circle(startX + i * gap, y, 8, key.collected ? PALETTE.yellow : PALETTE.dim,
          key.collected ? { glow: 8 } : {});
      });
    }
  },

  dispose() {
    this.api = null;
    this.storage = null;
    this.stageData = null;
  },
};
