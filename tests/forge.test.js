import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TAGS, CONTROLS, SCORE_ORDERS } from '../src/shell/registry.js';

const catalog = JSON.parse(readFileSync(new URL('../forge/catalog.json', import.meta.url)).toString());
const contract = readFileSync(new URL('../forge/contract.md', import.meta.url)).toString();

describe('forge/catalog.json', () => {
  it('큐가 비어 있지 않다', () => {
    expect(catalog.queue.length).toBeGreaterThan(0);
  });

  it('모든 항목이 계약과 맞는 메타를 갖는다', () => {
    for (const e of catalog.queue) {
      expect(e.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(typeof e.title).toBe('string');
      expect(e.tags.every((t) => TAGS.includes(t))).toBe(true);
      expect([1, 2]).toContain(e.players);
      expect(CONTROLS).toContain(e.controls);
      expect(SCORE_ORDERS).toContain(e.scoreOrder);
      expect(e.rules.length).toBeGreaterThanOrEqual(3);
      expect(e.win.length).toBeGreaterThan(0);
      expect(e.difficulty.length).toBeGreaterThan(0);
    }
  });

  it('2인 게임은 versus 태그를 갖는다', () => {
    for (const e of catalog.queue) {
      if (e.players === 2) expect(e.tags).toContain('versus');
    }
  });

  it('id가 중복되지 않는다', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('스펙이 요청한 스도쿠와 야구 배틀왕이 큐에 있다', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(ids).toContain('sudoku');
    expect(ids).toContain('baseball-battle');
  });

  it('오너가 지정한 농장 디펜스와 무한의 계단이 큐에 있다', () => {
    const ids = catalog.queue.map((e) => e.id);
    expect(ids).toContain('farm-defense');
    expect(ids).toContain('infinite-stairs');
  });

  it('세 축(혼자/아빠랑/두뇌)이 큐에 골고루 있다', () => {
    const hasVersus = catalog.queue.some((e) => e.players === 2 && e.tags.includes('versus'));
    const hasPuzzle = catalog.queue.some((e) => e.tags.includes('puzzle'));
    const hasSoloAction = catalog.queue.some((e) => e.players === 1 && e.tags.includes('action'));
    expect(hasVersus).toBe(true);
    expect(hasPuzzle).toBe(true);
    expect(hasSoloAction).toBe(true);
  });
});

describe('forge/contract.md', () => {
  it('모범 예시 두 개를 가리킨다', () => {
    expect(contract).toContain('src/games/neon-snake.js');
    expect(contract).toContain('src/games/crossy-robot.js');
  });

  it('계약 테스트 실행 명령을 알려준다', () => {
    expect(contract).toContain('tests/contract.test.js');
  });

  it('Math.random 금지를 명시한다', () => {
    expect(contract).toContain('Math.random');
  });
});
