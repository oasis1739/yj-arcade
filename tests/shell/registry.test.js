import { describe, it, expect } from 'vitest';
import { baseName, validateGame, collectGames, visibleGames, TAGS } from '../../src/shell/registry.js';

const noop = () => {};
const okGame = (over = {}) => ({
  default: {
    id: 'neon-snake', title: '네온 스네이크', tags: ['action'], players: 1,
    color: '#39f6ff', controls: 'dpad', scoreOrder: 'high', scoreLabel: '점수',
    icon: noop, init: noop, update: noop, render: noop, dispose: noop,
    ...over,
  },
});

describe('baseName', () => {
  it('경로에서 확장자 없는 파일명을 뽑는다', () => {
    expect(baseName('../src/games/neon-snake.js')).toBe('neon-snake');
  });
});

describe('validateGame', () => {
  it('올바른 게임은 오류가 없다', () => {
    expect(validateGame(okGame(), 'x/neon-snake.js')).toEqual([]);
  });

  it('default export가 없으면 잡는다', () => {
    expect(validateGame({}, 'x/neon-snake.js').join()).toMatch(/default/);
  });

  it('id가 파일명과 다르면 잡는다', () => {
    expect(validateGame(okGame({ id: 'other' }), 'x/neon-snake.js').join()).toMatch(/id/);
  });

  it('필수 함수가 빠지면 잡는다', () => {
    expect(validateGame(okGame({ update: undefined }), 'x/neon-snake.js').join()).toMatch(/update/);
  });

  it('모르는 태그를 잡는다', () => {
    expect(validateGame(okGame({ tags: ['shooter'] }), 'x/neon-snake.js').join()).toMatch(/tags/);
  });

  it('태그가 비면 잡는다', () => {
    expect(validateGame(okGame({ tags: [] }), 'x/neon-snake.js').join()).toMatch(/tags/);
  });

  it('players는 1 또는 2만 허용한다', () => {
    expect(validateGame(okGame({ players: 3 }), 'x/neon-snake.js').join()).toMatch(/players/);
  });

  it('color는 hex여야 한다', () => {
    expect(validateGame(okGame({ color: 'cyan' }), 'x/neon-snake.js').join()).toMatch(/color/);
  });

  it('모르는 controls를 잡는다', () => {
    expect(validateGame(okGame({ controls: 'gyro' }), 'x/neon-snake.js').join()).toMatch(/controls/);
  });

  it('scoreOrder를 검사한다', () => {
    expect(validateGame(okGame({ scoreOrder: 'best' }), 'x/neon-snake.js').join()).toMatch(/scoreOrder/);
  });

  it('players 2면 versus 태그를 요구한다', () => {
    expect(validateGame(okGame({ players: 2 }), 'x/neon-snake.js').join()).toMatch(/versus/);
  });
});

describe('collectGames', () => {
  it('모듈 맵에서 게임을 모은다', () => {
    const { games, errors } = collectGames({
      '../src/games/neon-snake.js': okGame(),
      '../src/games/crossy-robot.js': okGame({ id: 'crossy-robot', title: '길 건너기 로봇' }),
    });
    expect(errors).toEqual([]);
    expect(games.map((g) => g.id).sort()).toEqual(['crossy-robot', 'neon-snake']);
  });

  it('잘못된 게임은 목록에서 빼고 오류로 보고한다', () => {
    const { games, errors } = collectGames({
      '../src/games/neon-snake.js': okGame(),
      '../src/games/broken.js': okGame({ id: 'broken', tags: [] }),
    });
    expect(games.map((g) => g.id)).toEqual(['neon-snake']);
    expect(errors.length).toBe(1);
  });

  it('id가 중복되면 오류다', () => {
    const { errors } = collectGames({
      '../src/games/a.js': okGame({ id: 'a' }),
      '../src/games/b.js': okGame({ id: 'a', title: '비' }),
    });
    expect(errors.join()).toMatch(/중복/);
  });

  it('태그 순서 다음 제목 가나다순으로 정렬한다', () => {
    const { games } = collectGames({
      '../src/games/zeta.js': okGame({ id: 'zeta', title: '하하', tags: ['puzzle'] }),
      '../src/games/alpha.js': okGame({ id: 'alpha', title: '나나', tags: ['action'] }),
      '../src/games/beta.js': okGame({ id: 'beta', title: '가가', tags: ['action'] }),
    });
    expect(games.map((g) => g.id)).toEqual(['beta', 'alpha', 'zeta']);
    expect(TAGS.indexOf('action')).toBeLessThan(TAGS.indexOf('puzzle'));
  });

  it('기본값을 채워준다', () => {
    const { games } = collectGames({
      '../src/games/neon-snake.js': okGame({ controls: undefined, scoreOrder: undefined, scoreLabel: undefined, archived: undefined }),
    });
    expect(games[0].controls).toBe('pointer');
    expect(games[0].scoreOrder).toBe('high');
    expect(games[0].scoreLabel).toBe('점수');
    expect(games[0].archived).toBe(false);
  });
});

describe('visibleGames', () => {
  const games = [
    { id: 'a', tags: ['action'], archived: false },
    { id: 'b', tags: ['puzzle'], archived: false },
    { id: 'c', tags: ['action'], archived: true },
  ];

  it('archived는 숨긴다', () => {
    expect(visibleGames(games).map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('태그로 거른다', () => {
    expect(visibleGames(games, 'action').map((g) => g.id)).toEqual(['a']);
  });
});
