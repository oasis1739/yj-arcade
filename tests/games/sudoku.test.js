import { describe, it, expect } from 'vitest';
import game, {
  boxDims,
  generateSolvedGrid,
  generatePuzzle,
  blanksForSize,
  countSolutions,
  hasConflict,
  findConflictCells,
  createSudokuState,
  selectCell,
  placeValue,
  clearSelected,
  useHint,
  checkWin,
} from '../../src/games/sudoku.js';
import { makeRng } from '../../src/core/rng.js';

function isCompleteValidGrid(grid, size, bw, bh) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r][c];
      if (v < 1 || v > size) return false;
      if (hasConflict(grid, size, bw, bh, r, c, v)) return false;
    }
  }
  return true;
}

describe('스도쿠 생성 규칙', () => {
  it('완성된 그리드는 행·열·박스 규칙을 어기지 않는다 (4/6/9)', () => {
    for (const size of [4, 6, 9]) {
      const { bw, bh } = boxDims(size);
      const grid = generateSolvedGrid(size, makeRng(1));
      expect(isCompleteValidGrid(grid, size, bw, bh)).toBe(true);
    }
  });

  it('생성된 퍼즐은 유효하고 유일하게 풀린다', () => {
    const size = 9;
    const { bw, bh } = boxDims(size);
    const { grid, solution } = generatePuzzle(size, makeRng(7), blanksForSize(size));

    // 주어진 칸은 정답과 일치한다
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== 0) expect(grid[r][c]).toBe(solution[r][c]);
      }
    }
    // 정답 자체가 완전하고 유효한 그리드다
    expect(isCompleteValidGrid(solution, size, bw, bh)).toBe(true);
    // 퍼즐은 정확히 하나의 해를 가진다
    expect(countSolutions(grid, size, bw, bh, 2)).toBe(1);
  });

  it('같은 시드로 생성하면 항상 같은 퍼즐이 나온다 (결정론)', () => {
    const a = generatePuzzle(9, makeRng(42), blanksForSize(9));
    const b = generatePuzzle(9, makeRng(42), blanksForSize(9));
    expect(a.grid).toEqual(b.grid);
    expect(a.solution).toEqual(b.solution);
  });

  it('난이도(보드 크기)가 빈 칸 수를 실제로 바꾼다', () => {
    expect(blanksForSize(4)).toBeLessThan(blanksForSize(6));
    expect(blanksForSize(6)).toBeLessThan(blanksForSize(9));
    expect(blanksForSize(9)).toBe(40);

    for (const size of [4, 6, 9]) {
      const { grid } = generatePuzzle(size, makeRng(3), blanksForSize(size));
      const blanks = grid.flat().filter((v) => v === 0).length;
      expect(blanks).toBeGreaterThan(0);
    }
  });
});

describe('충돌 판정', () => {
  it('같은 행에 같은 숫자가 있으면 충돌이다', () => {
    const size = 9;
    const { bw, bh } = boxDims(size);
    const grid = Array.from({ length: size }, () => new Array(size).fill(0));
    grid[0][0] = 5;
    expect(hasConflict(grid, size, bw, bh, 0, 3, 5)).toBe(true);
    expect(hasConflict(grid, size, bw, bh, 0, 3, 6)).toBe(false);
  });

  it('같은 열에 같은 숫자가 있으면 충돌이다', () => {
    const size = 9;
    const { bw, bh } = boxDims(size);
    const grid = Array.from({ length: size }, () => new Array(size).fill(0));
    grid[2][4] = 7;
    expect(hasConflict(grid, size, bw, bh, 6, 4, 7)).toBe(true);
    expect(hasConflict(grid, size, bw, bh, 6, 4, 1)).toBe(false);
  });

  it('같은 박스에 같은 숫자가 있으면 충돌이다', () => {
    const size = 9;
    const { bw, bh } = boxDims(size);
    const grid = Array.from({ length: size }, () => new Array(size).fill(0));
    grid[0][0] = 9;
    // (1,1)은 (0,0)과 같은 3x3 박스
    expect(hasConflict(grid, size, bw, bh, 1, 1, 9)).toBe(true);
    // (0,3)은 다른 박스, 다른 행·열
    expect(hasConflict(grid, size, bw, bh, 3, 3, 9)).toBe(false);
  });

  it('findConflictCells가 충돌 중인 칸을 모두 찾는다', () => {
    const size = 4;
    const { bw, bh } = boxDims(size);
    const grid = [
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const conflicts = findConflictCells(grid, size, bw, bh);
    expect(conflicts.has('0,0')).toBe(true);
    expect(conflicts.has('0,1')).toBe(true);
    expect(conflicts.size).toBe(2);
  });
});

describe('상태 조작 — 칸 채우기/지우기/힌트/승리', () => {
  function findEmptyCell(state) {
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!state.given[r][c]) return { r, c };
      }
    }
    throw new Error('빈 칸 없음');
  }

  it('빈 칸을 선택해 값을 놓으면 반영된다', () => {
    const state = createSudokuState({ size: 4, rng: makeRng(11) });
    const { r, c } = findEmptyCell(state);
    selectCell(state, r, c);
    const correct = state.solution[r][c];
    const result = placeValue(state, correct);
    expect(result.changed).toBe(true);
    expect(state.grid[r][c]).toBe(correct);
  });

  it('놓은 값을 지우면 다시 빈 칸이 된다', () => {
    const state = createSudokuState({ size: 4, rng: makeRng(11) });
    const { r, c } = findEmptyCell(state);
    selectCell(state, r, c);
    placeValue(state, state.solution[r][c]);
    expect(state.grid[r][c]).not.toBe(0);
    clearSelected(state);
    expect(state.grid[r][c]).toBe(0);
  });

  it('주어진(고정) 칸은 값을 놓거나 지울 수 없다', () => {
    const state = createSudokuState({ size: 4, rng: makeRng(11) });
    let given = null;
    outer: for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (state.given[r][c]) { given = { r, c }; break outer; }
      }
    }
    expect(given).not.toBeNull();
    const before = state.grid[given.r][given.c];
    selectCell(state, given.r, given.c);
    const result = placeValue(state, before === state.size ? 1 : before + 1);
    expect(result.changed).toBe(false);
    expect(state.grid[given.r][given.c]).toBe(before);

    const cleared = clearSelected(state);
    expect(cleared).toBe(false);
    expect(state.grid[given.r][given.c]).toBe(before);
  });

  it('힌트는 최대 3번까지만 쓸 수 있다', () => {
    const state = createSudokuState({ size: 6, rng: makeRng(21) });
    let uses = 0;
    for (let i = 0; i < 3; i++) {
      const ok = useHint(state);
      if (ok) uses++;
    }
    expect(state.hintsUsed).toBe(uses);
    expect(state.hintsUsed).toBeLessThanOrEqual(3);

    // hintsUsed가 이미 3이면(빈 칸이 남아 있어도) 더 이상 늘지 않는다
    state.hintsUsed = 3;
    const before = JSON.stringify(state.grid);
    const ok = useHint(state);
    expect(ok).toBe(false);
    expect(JSON.stringify(state.grid)).toBe(before);
  });

  it('완전하고 정답과 일치하는 그리드에서만 승리한다', () => {
    const state = createSudokuState({ size: 4, rng: makeRng(5) });
    expect(checkWin(state)).toBe(false);

    // 틀린 값으로 다 채워도 승리하지 않는다
    const wrongFull = state.grid.map((row, r) =>
      row.map((v, c) => (v !== 0 ? v : (state.solution[r][c] % state.size) + 1)));
    // 일부러 정답과 다르게 하나 틀리게 만든다
    wrongFull[0][0] = (wrongFull[0][0] % state.size) + 1;
    const wrongState = { ...state, grid: wrongFull };
    expect(checkWin(wrongState)).toBe(false);

    // 정답 그대로 채우면 승리한다
    const solvedState = { ...state, grid: state.solution.map((row) => row.slice()) };
    expect(checkWin(solvedState)).toBe(true);
  });

  it('마지막 빈 칸을 정답으로 채우면 placeValue가 승리를 표시한다', () => {
    const state = createSudokuState({ size: 4, rng: makeRng(99) });
    // 정답이 아닌 칸을 전부 정답으로 채우되 마지막 하나만 남긴다
    const empties = [];
    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        if (!state.given[r][c]) empties.push({ r, c });
      }
    }
    for (let i = 0; i < empties.length - 1; i++) {
      const { r, c } = empties[i];
      state.grid[r][c] = state.solution[r][c];
    }
    const last = empties[empties.length - 1];
    selectCell(state, last.r, last.c);
    const result = placeValue(state, state.solution[last.r][last.c]);
    expect(result.win).toBe(true);
    expect(state.won).toBe(true);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('sudoku');
    expect(game.players).toBe(1);
    expect(game.tags).toContain('puzzle');
    expect(game.controls).toBe('pointer');
    expect(game.scoreOrder).toBe('low');
  });
});
