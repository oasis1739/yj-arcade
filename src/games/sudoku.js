import { PALETTE } from '../core/draw.js';

// ── 순수 규칙 (테스트 대상) ───────────────────────────────────────────────────

// 박스(작은 사각형) 크기. bw = 박스 가로 칸 수, bh = 박스 세로 칸 수.
// 6x6은 정사각형이 아닌 3x2 박스(가로 3칸 x 세로 2칸)를 쓰는 게 표준이다.
export function boxDims(size) {
  if (size === 4) return { bw: 2, bh: 2 };
  if (size === 6) return { bw: 3, bh: 2 };
  return { bw: 3, bh: 3 }; // 9
}

// 9x9는 규칙에 명시된 40. 4x4/6x6은 8살 플레이어가 시작하는 쉬운/중간 난이도로
// 비율을 맞춘다(4x4는 16칸 중 6칸, 6x6은 36칸 중 18칸 비움).
export function blanksForSize(size) {
  if (size === 4) return 6;
  if (size === 6) return 18;
  return 40;
}

function cloneGrid(g) {
  return g.map((row) => row.slice());
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// (r,c)에 값 v를 놓았을 때 자기 자신은 무시하고 같은 행·열·박스의 다른 칸과
// 충돌하는지만 본다. 그리드에 이미 들어있는 (r,c) 값이 무엇이든 상관없다.
function isValidPlacement(grid, size, bw, bh, r, c, v) {
  for (let i = 0; i < size; i++) {
    if (i !== c && grid[r][i] === v) return false;
    if (i !== r && grid[i][c] === v) return false;
  }
  const br = Math.floor(r / bh) * bh;
  const bc = Math.floor(c / bw) * bw;
  for (let i = 0; i < bh; i++) {
    for (let j = 0; j < bw; j++) {
      const rr = br + i;
      const cc = bc + j;
      if ((rr !== r || cc !== c) && grid[rr][cc] === v) return false;
    }
  }
  return true;
}

export function hasConflict(grid, size, bw, bh, r, c, value) {
  return !isValidPlacement(grid, size, bw, bh, r, c, value);
}

export function findConflictCells(grid, size, bw, bh) {
  const set = new Set();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (v === 0) continue;
      if (!isValidPlacement(grid, size, bw, bh, r, c, v)) set.add(`${r},${c}`);
    }
  }
  return set;
}

// 완성된 정답 그리드를 만든다. 백트래킹으로 채우면 최악의 경우 시간을 보장하기
// 어렵다(호출부는 60초 시뮬레이션 안에서 절대 멈추면 안 된다) — 대신 "기본
// 패턴 + 숫자/행/열 뒤섞기" 방식을 쓴다. 이 방식은 항상 O(size^2)에 끝나고
// 절대 실패하지 않는다.
export function generateSolvedGrid(size, rng) {
  const { bw, bh } = boxDims(size);

  const base = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push((bw * (r % bh) + Math.floor(r / bh) + c) % size);
    }
    base.push(row);
  }

  const digits = shuffle(Array.from({ length: size }, (_, i) => i), rng);

  const bandCount = size / bh;
  const rowOrder = [];
  for (const band of shuffle(Array.from({ length: bandCount }, (_, i) => i), rng)) {
    const rowsInBand = shuffle(Array.from({ length: bh }, (_, i) => band * bh + i), rng);
    rowOrder.push(...rowsInBand);
  }

  const stackCount = size / bw;
  const colOrder = [];
  for (const stack of shuffle(Array.from({ length: stackCount }, (_, i) => i), rng)) {
    const colsInStack = shuffle(Array.from({ length: bw }, (_, i) => stack * bw + i), rng);
    colOrder.push(...colsInStack);
  }

  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(digits[base[rowOrder[r]][colOrder[c]]] + 1);
    }
    grid.push(row);
  }
  return grid;
}

// grid(0=빈칸)의 해 개수를 limit까지 센다. maxSteps로 재귀 호출 수를 강하게
// 제한해서 어떤 입력에서도 멈추지 않는다 — 예산을 넘기면 "유일하지 않다"로
// 보수적으로 취급해(limit 반환) 그 칸은 비우지 않는다.
export function countSolutions(grid, size, bw, bh, limit = 2, maxSteps = 50000) {
  const g = cloneGrid(grid);
  let count = 0;
  let steps = 0;
  let aborted = false;

  function findEmpty() {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (g[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function solve() {
    if (count >= limit || aborted) return;
    steps++;
    if (steps > maxSteps) { aborted = true; return; }
    const pos = findEmpty();
    if (!pos) { count++; return; }
    const [r, c] = pos;
    for (let v = 1; v <= size; v++) {
      if (count >= limit || aborted) return;
      if (isValidPlacement(g, size, bw, bh, r, c, v)) {
        g[r][c] = v;
        solve();
        g[r][c] = 0;
      }
    }
  }

  solve();
  return aborted ? limit : count;
}

// 완성된 그리드에서 시작해 rng로 섞은 순서대로 칸을 하나씩 비워본다. 비운 뒤
// 해가 정확히 하나인지 확인하고, 아니면 되돌린다("구멍 파기" 표준 기법).
export function generatePuzzle(size, rng, blanks = blanksForSize(size)) {
  const solution = generateSolvedGrid(size, rng);
  const { bw, bh } = boxDims(size);
  const grid = cloneGrid(solution);

  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) cells.push([r, c]);
  }
  const order = shuffle(cells, rng);

  let removed = 0;
  for (const [r, c] of order) {
    if (removed >= blanks) break;
    const backup = grid[r][c];
    grid[r][c] = 0;
    const solCount = countSolutions(grid, size, bw, bh, 2);
    if (solCount === 1) {
      removed += 1;
    } else {
      grid[r][c] = backup;
    }
  }

  const given = grid.map((row) => row.map((v) => v !== 0));
  return { grid, solution, given, blanks: removed };
}

export function createSudokuState({ size, rng }) {
  const { bw, bh } = boxDims(size);
  const { grid, solution, given } = generatePuzzle(size, rng, blanksForSize(size));
  return {
    size, bw, bh,
    grid, solution, given,
    selected: null,
    hintsUsed: 0,
    hintsMax: 3,
    elapsed: 0,
    won: false,
  };
}

export function selectCell(state, r, c) {
  if (r < 0 || r >= state.size || c < 0 || c >= state.size) return state;
  state.selected = { r, c };
  return state;
}

export function checkWin(state) {
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (state.grid[r][c] !== state.solution[r][c]) return false;
    }
  }
  return true;
}

export function placeValue(state, value) {
  if (state.won || !state.selected) return { changed: false };
  const { r, c } = state.selected;
  if (state.given[r][c]) return { changed: false };
  if (!Number.isInteger(value) || value < 1 || value > state.size) return { changed: false };

  state.grid[r][c] = value;
  const conflict = hasConflict(state.grid, state.size, state.bw, state.bh, r, c, value);
  let win = false;
  if (!conflict && checkWin(state)) {
    state.won = true;
    win = true;
  }
  return { changed: true, conflict, win };
}

export function clearSelected(state) {
  if (state.won || !state.selected) return false;
  const { r, c } = state.selected;
  if (state.given[r][c]) return false;
  if (state.grid[r][c] === 0) return false;
  state.grid[r][c] = 0;
  return true;
}

// 선택된 칸이 비어 있거나 틀렸으면 그 칸을, 아니면 맨 처음 만나는 오답/빈 칸을
// 정답으로 채운다. 3번 한도를 넘기면 아무것도 하지 않는다.
export function useHint(state) {
  if (state.won) return false;
  if (state.hintsUsed >= state.hintsMax) return false;

  let target = null;
  if (state.selected) {
    const { r, c } = state.selected;
    if (!state.given[r][c] && state.grid[r][c] !== state.solution[r][c]) target = { r, c };
  }
  if (!target) {
    search:
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!state.given[r][c] && state.grid[r][c] !== state.solution[r][c]) {
          target = { r, c };
          break search;
        }
      }
    }
  }
  if (!target) return false;

  state.grid[target.r][target.c] = state.solution[target.r][target.c];
  state.hintsUsed += 1;
  state.selected = target;
  if (checkWin(state)) state.won = true;
  return true;
}

// ── 계약 객체 ────────────────────────────────────────────────────────────────
const BOARD_PX = 380;
const OX = (960 - BOARD_PX) / 2;
const OY = 92;

const SIZES = [4, 6, 9];
const SIZE_LABELS = { 4: '4×4  쉬움', 6: '6×6  보통', 9: '9×9  어려움' };

// 크기 선택 화면 버튼(pointer 전용 — 가상패드 예약 구역이 없다).
const MENU_BTN_W = 400;
const MENU_BTN_H = 96;
const MENU_BTN_X = (960 - MENU_BTN_W) / 2;
const MENU_BTN_GAP = 26;
const MENU_BTN_Y0 = 148;

function menuButtonRect(i) {
  return { x: MENU_BTN_X, y: MENU_BTN_Y0 + i * (MENU_BTN_H + MENU_BTN_GAP), w: MENU_BTN_W, h: MENU_BTN_H };
}

const NUM_BTN = 46;
const NUM_GAP = 8;
const NUM_Y = 486;

function numButtonRects(size) {
  const rowW = size * NUM_BTN + (size - 1) * NUM_GAP;
  const startX = (960 - rowW) / 2;
  const rects = [];
  for (let i = 0; i < size; i++) {
    rects.push({ value: i + 1, x: startX + i * (NUM_BTN + NUM_GAP), y: NUM_Y, w: NUM_BTN, h: NUM_BTN });
  }
  return rects;
}

const ACTION_Y = 550;
const ACTION_H = 46;
const ACTION_W = 140;
const ACTION_GAP = 24;
const ACTION_X0 = (960 - (ACTION_W * 3 + ACTION_GAP * 2)) / 2;

function actionRects() {
  return {
    erase: { x: ACTION_X0, y: ACTION_Y, w: ACTION_W, h: ACTION_H },
    hint: { x: ACTION_X0 + ACTION_W + ACTION_GAP, y: ACTION_Y, w: ACTION_W, h: ACTION_H },
    menu: { x: ACTION_X0 + (ACTION_W + ACTION_GAP) * 2, y: ACTION_Y, w: ACTION_W, h: ACTION_H },
  };
}

function inRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export default {
  id: 'sudoku',
  title: '스도쿠',
  tags: ['puzzle'],
  players: 1,
  color: PALETTE.cyan,
  controls: 'pointer',
  scoreOrder: 'low',
  scoreLabel: '시간',
  archived: false,

  icon(ctx, size) {
    const u = size / 8;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(u, u, size - 2 * u, size - 2 * u);
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let i = 1; i < 3; i++) {
      const p = u + (i * (size - 2 * u)) / 3;
      ctx.beginPath();
      ctx.moveTo(p, u);
      ctx.lineTo(p, size - u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(u, p);
      ctx.lineTo(size - u, p);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.yellow;
    ctx.fillRect(u + (size - 2 * u) / 3 + 1, u + 1, (size - 2 * u) / 3 - 2, (size - 2 * u) / 3 - 2);
    ctx.fillStyle = PALETTE.white;
    ctx.font = `bold ${Math.floor(u * 1.6)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('5', size / 2, size / 2 + u * 0.1);
  },

  init(api) {
    this.api = api;
    this.phase = 'menu'; // 'menu' | 'play'
    this.state = null;
    this.lastReportedSec = -1;
    this.wonReported = false;
  },

  startGame(size) {
    this.state = createSudokuState({ size, rng: this.api.rng });
    this.phase = 'play';
    this.lastReportedSec = -1;
    this.wonReported = false;
    this.api.audio.beep(520, 60);
  },

  reportWinIfNeeded() {
    if (this.state && this.state.won && !this.wonReported) {
      this.wonReported = true;
      this.api.audio.sweep(440, 920, 320);
      this.api.juice.burst(480, OY + BOARD_PX / 2, { color: PALETTE.green, count: 30, speed: 200 });
      this.api.juice.shake(6, 0.2);
      this.api.onGameOver({ score: Math.floor(this.state.elapsed) });
    }
  },

  handleMenuTap(x, y) {
    for (let i = 0; i < SIZES.length; i++) {
      if (inRect(x, y, menuButtonRect(i))) {
        this.startGame(SIZES[i]);
        return;
      }
    }
  },

  handlePlayTap(x, y) {
    const s = this.state;

    if (x >= OX && x <= OX + BOARD_PX && y >= OY && y <= OY + BOARD_PX) {
      const cell = BOARD_PX / s.size;
      const c = Math.min(s.size - 1, Math.floor((x - OX) / cell));
      const r = Math.min(s.size - 1, Math.floor((y - OY) / cell));
      selectCell(s, r, c);
      this.api.audio.beep(300, 30);
      return;
    }

    for (const rect of numButtonRects(s.size)) {
      if (inRect(x, y, rect)) {
        const result = placeValue(s, rect.value);
        if (result.changed) {
          if (result.conflict) {
            this.api.audio.noise(90);
            this.api.juice.shake(4, 0.12);
          } else {
            this.api.audio.beep(720, 55);
            const { r, c } = s.selected;
            this.api.juice.burst(OX + c * (BOARD_PX / s.size) + (BOARD_PX / s.size) / 2,
              OY + r * (BOARD_PX / s.size) + (BOARD_PX / s.size) / 2,
              { color: PALETTE.cyan, count: 8, speed: 100 });
          }
          this.reportWinIfNeeded();
        }
        return;
      }
    }

    const actions = actionRects();
    if (inRect(x, y, actions.erase)) {
      if (clearSelected(s)) this.api.audio.beep(260, 40);
      return;
    }
    if (inRect(x, y, actions.hint)) {
      if (useHint(s)) {
        this.api.audio.beep(940, 90);
        const { r, c } = s.selected;
        this.api.juice.burst(OX + c * (BOARD_PX / s.size) + (BOARD_PX / s.size) / 2,
          OY + r * (BOARD_PX / s.size) + (BOARD_PX / s.size) / 2,
          { color: PALETTE.yellow, count: 12, speed: 120 });
        this.reportWinIfNeeded();
      }
      return;
    }
    if (inRect(x, y, actions.menu)) {
      this.phase = 'menu';
      this.state = null;
      this.api.audio.beep(340, 50);
    }
  },

  update(dt) {
    const api = this.api;
    const ptr = api.input.pointer;

    if (this.phase === 'menu') {
      if (ptr.pressed) this.handleMenuTap(ptr.x, ptr.y);
      return;
    }

    const s = this.state;
    if (!s.won) {
      s.elapsed += dt;
      const sec = Math.floor(s.elapsed);
      if (sec !== this.lastReportedSec) {
        this.lastReportedSec = sec;
        api.onScore(sec);
      }
    }

    if (ptr.pressed) this.handlePlayTap(ptr.x, ptr.y);
  },

  render(ctx) {
    const d = this.api.draw;
    d.clear();

    if (this.phase === 'menu') {
      d.text('스도쿠 — 크기를 골라요', 480, 96, { size: 30, color: PALETTE.white, bold: true });
      SIZES.forEach((size, i) => {
        const rect = menuButtonRect(i);
        d.roundRect(rect.x, rect.y, rect.w, rect.h, 14, PALETTE.panel, { fill: true });
        d.roundRect(rect.x, rect.y, rect.w, rect.h, 14, PALETTE.cyan, { fill: false, width: 2 });
        d.text(SIZE_LABELS[size], rect.x + rect.w / 2, rect.y + rect.h / 2, { size: 28, color: PALETTE.white, bold: true });
      });
      return;
    }

    const s = this.state;
    const cell = BOARD_PX / s.size;
    const conflicts = findConflictCells(s.grid, s.size, s.bw, s.bh);

    // 선택된 칸의 행·열·박스 강조
    if (s.selected) {
      const { r, c } = s.selected;
      d.rect(OX, OY + r * cell, BOARD_PX, cell, PALETTE.panel, { alpha: 0.55 });
      d.rect(OX + c * cell, OY, cell, BOARD_PX, PALETTE.panel, { alpha: 0.55 });
      const br = Math.floor(r / s.bh) * s.bh;
      const bc = Math.floor(c / s.bw) * s.bw;
      d.rect(OX + bc * cell, OY + br * cell, s.bw * cell, s.bh * cell, PALETTE.panel, { alpha: 0.4 });
    }

    // 칸 배경(충돌 시 붉게) + 숫자
    for (let r = 0; r < s.size; r++) {
      for (let c = 0; c < s.size; c++) {
        const v = s.grid[r][c];
        const x = OX + c * cell;
        const y = OY + r * cell;
        const isConflict = conflicts.has(`${r},${c}`);
        if (isConflict) d.rect(x + 1, y + 1, cell - 2, cell - 2, PALETTE.red, { alpha: 0.28 });
        if (v !== 0) {
          const color = isConflict ? PALETTE.red : (s.given[r][c] ? PALETTE.white : PALETTE.cyan);
          d.text(String(v), x + cell / 2, y + cell / 2 + 1, { size: Math.floor(cell * 0.52), color, bold: true });
        }
      }
    }

    // 선택 칸 테두리
    if (s.selected) {
      const { r, c } = s.selected;
      d.rect(OX + c * cell + 1, OY + r * cell + 1, cell - 2, cell - 2, PALETTE.yellow, { fill: false, width: 3 });
    }

    // 그리드 선(박스 경계는 굵게)
    for (let i = 0; i <= s.size; i++) {
      const thick = i % s.bw === 0;
      d.line(OX + i * cell, OY, OX + i * cell, OY + BOARD_PX, thick ? PALETTE.white : PALETTE.dim, { width: thick ? 3 : 1 });
    }
    for (let i = 0; i <= s.size; i++) {
      const thick = i % s.bh === 0;
      d.line(OX, OY + i * cell, OX + BOARD_PX, OY + i * cell, thick ? PALETTE.white : PALETTE.dim, { width: thick ? 3 : 1 });
    }

    // 숫자 패드
    for (const rect of numButtonRects(s.size)) {
      d.roundRect(rect.x, rect.y, rect.w, rect.h, 8, PALETTE.panel, { fill: true });
      d.roundRect(rect.x, rect.y, rect.w, rect.h, 8, PALETTE.dim, { fill: false, width: 1 });
      d.text(String(rect.value), rect.x + rect.w / 2, rect.y + rect.h / 2, { size: 22, color: PALETTE.white, bold: true });
    }

    // 지우기 / 힌트 / 메뉴 버튼
    const actions = actionRects();
    d.roundRect(actions.erase.x, actions.erase.y, actions.erase.w, actions.erase.h, 10, PALETTE.panel, { fill: true });
    d.text('지우기', actions.erase.x + actions.erase.w / 2, actions.erase.y + actions.erase.h / 2, { size: 20, color: PALETTE.white });

    d.roundRect(actions.hint.x, actions.hint.y, actions.hint.w, actions.hint.h, 10, PALETTE.panel, { fill: true });
    d.text(`힌트 ${s.hintsMax - s.hintsUsed}/${s.hintsMax}`, actions.hint.x + actions.hint.w / 2, actions.hint.y + actions.hint.h / 2,
      { size: 20, color: s.hintsUsed >= s.hintsMax ? PALETTE.dim : PALETTE.yellow });

    d.roundRect(actions.menu.x, actions.menu.y, actions.menu.w, actions.menu.h, 10, PALETTE.panel, { fill: true });
    d.text(s.won ? '새 게임' : '메뉴', actions.menu.x + actions.menu.w / 2, actions.menu.y + actions.menu.h / 2, { size: 20, color: PALETTE.white });

    if (s.won) {
      d.rect(OX - 6, OY - 6, BOARD_PX + 12, BOARD_PX + 12, PALETTE.bg, { alpha: 0.55 });
      d.text('완성!', 480, OY + BOARD_PX / 2 - 20, { size: 44, color: PALETTE.green, bold: true });
      d.text(formatTime(s.elapsed), 480, OY + BOARD_PX / 2 + 30, { size: 28, color: PALETTE.white });
    }
  },

  dispose() {
    this.state = null;
    this.api = null;
  },
};
