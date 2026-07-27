import { describe, it, expect } from 'vitest';
import game, { createSnakeState, turn, stepSnake } from '../../src/games/neon-snake.js';

const fixedFood = (x, y) => () => ({ x, y });

describe('스네이크 규칙', () => {
  it('초기 상태는 살아 있고 점수가 0이다', () => {
    const s = createSnakeState({});
    expect(s.dead).toBe(false);
    expect(s.score).toBe(0);
    expect(s.snake.length).toBeGreaterThanOrEqual(3);
  });

  it('한 칸 전진한다', () => {
    const s = createSnakeState({});
    const headBefore = { ...s.snake[0] };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake[0].x).toBe(headBefore.x + 1);
    expect(s.snake[0].y).toBe(headBefore.y);
  });

  it('길이는 먹기 전까지 유지된다', () => {
    const s = createSnakeState({});
    const len = s.snake.length;
    stepSnake(s, fixedFood(-9, -9));
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake.length).toBe(len);
  });

  it('먹으면 점수가 오르고 길어진다', () => {
    const s = createSnakeState({});
    const len = s.snake.length;
    s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    stepSnake(s, fixedFood(0, 0));
    expect(s.score).toBe(1);
    expect(s.snake.length).toBe(len + 1);
  });

  it('반대 방향으로는 못 돈다', () => {
    const s = createSnakeState({});   // 오른쪽으로 진행 중
    turn(s, -1, 0);
    expect(s.next).toEqual({ x: 1, y: 0 });
  });

  it('직각으로는 돈다', () => {
    const s = createSnakeState({});
    turn(s, 0, 1);
    stepSnake(s, fixedFood(-9, -9));
    expect(s.dir).toEqual({ x: 0, y: 1 });
  });

  it('벽을 지나면 반대편으로 나온다', () => {
    const s = createSnakeState({ cols: 5, rows: 5 });
    s.snake = [{ x: 4, y: 2 }, { x: 3, y: 2 }];
    s.dir = { x: 1, y: 0 };
    s.next = { x: 1, y: 0 };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.snake[0]).toEqual({ x: 0, y: 2 });
  });

  it('자기 몸을 물면 죽는다', () => {
    const s = createSnakeState({ cols: 10, rows: 10 });
    s.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 4 }, { x: 5, y: 4 }];
    s.dir = { x: 0, y: -1 };
    s.next = { x: 0, y: -1 };
    stepSnake(s, fixedFood(-9, -9));
    expect(s.dead).toBe(true);
  });

  it('죽은 뒤에는 움직이지 않는다', () => {
    const s = createSnakeState({});
    s.dead = true;
    const before = JSON.stringify(s.snake);
    stepSnake(s, fixedFood(-9, -9));
    expect(JSON.stringify(s.snake)).toBe(before);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('neon-snake');
    expect(game.players).toBe(1);
    expect(game.tags).toContain('action');
    expect(game.controls).toBe('dpad');
  });
});
