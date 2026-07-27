import { describe, it, expect } from 'vitest';
import game, { makeLane, createCrossyState, advanceCars, laneHit, movePlayer } from '../../src/games/crossy-robot.js';
import { makeRng } from '../../src/core/rng.js';

const rng = () => makeRng(99);

describe('레인 생성', () => {
  it('4번째마다 안전지대다', () => {
    expect(makeLane(0, rng()).type).toBe('safe');
    expect(makeLane(4, rng()).type).toBe('safe');
    expect(makeLane(1, rng()).type).toBe('road');
  });

  it('도로에는 차와 방향과 속도가 있다', () => {
    const l = makeLane(1, rng());
    expect(l.cars.length).toBeGreaterThan(0);
    expect(Math.abs(l.dir)).toBe(1);
    expect(l.speed).toBeGreaterThan(0);
  });

  it('안전지대에는 차가 없다', () => {
    expect(makeLane(0, rng()).cars).toEqual([]);
  });
});

describe('초기 상태', () => {
  it('플레이어는 맨 아래 안전지대 가운데에 선다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    expect(s.player.lane).toBe(0);
    expect(s.player.col).toBe(7);
    expect(s.lanes[0].type).toBe('safe');
    expect(s.crossed).toBe(0);
    expect(s.dead).toBe(false);
  });
});

describe('차 이동', () => {
  it('방향대로 움직인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = 1;
    road.speed = 2;
    road.cars = [{ x: 3, w: 2 }];
    advanceCars(s, 0.5);
    expect(road.cars[0].x).toBeCloseTo(4);
  });

  it('오른쪽으로 나가면 왼쪽에서 다시 들어온다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = 1;
    road.speed = 1;
    road.cars = [{ x: 15.5, w: 2 }];
    advanceCars(s, 0.1);
    expect(road.cars[0].x).toBeLessThan(0);
  });

  it('왼쪽으로 나가면 오른쪽에서 다시 들어온다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const road = s.lanes.find((l) => l.type === 'road');
    road.dir = -1;
    road.speed = 1;
    road.cars = [{ x: -2.5, w: 2 }];
    advanceCars(s, 0.1);
    expect(road.cars[0].x).toBeGreaterThan(14);
  });
});

describe('충돌 판정', () => {
  it('차 위에 있으면 맞는다', () => {
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 3)).toBe(true);
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 4)).toBe(true);
  });

  it('차 밖이면 안 맞는다', () => {
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 6)).toBe(false);
    expect(laneHit({ type: 'road', cars: [{ x: 3, w: 2 }] }, 1)).toBe(false);
  });

  it('안전지대에서는 절대 안 맞는다', () => {
    expect(laneHit({ type: 'safe', cars: [] }, 5)).toBe(false);
  });
});

describe('플레이어 이동', () => {
  it('좌우로 움직인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    movePlayer(s, 1, 0, rng());
    expect(s.player.col).toBe(8);
  });

  it('화면 밖으로는 못 나간다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    s.player.col = 0;
    expect(movePlayer(s, -1, 0, rng()).moved).toBe(false);
    expect(s.player.col).toBe(0);
  });

  it('위로 가면 점수가 오른다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const r = movePlayer(s, 0, 1, rng());
    expect(r.scored).toBe(true);
    expect(s.crossed).toBe(1);
  });

  it('되돌아 내려와도 점수는 안 깎인다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    movePlayer(s, 0, 1, rng());
    movePlayer(s, 0, -1, rng());
    expect(s.crossed).toBe(1);
  });

  it('맨 아래에서 더 내려가지 못한다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    expect(movePlayer(s, 0, -1, rng()).moved).toBe(false);
  });

  it('위쪽에 다다르면 판이 스크롤되고 새 레인이 생긴다', () => {
    const s = createCrossyState({ cols: 15, lanes: 11, rng: rng() });
    const r = rng();
    for (let i = 0; i < 9; i++) movePlayer(s, 0, 1, r);
    expect(s.lanes.length).toBe(11);          // 길이는 유지
    expect(s.player.lane).toBeLessThanOrEqual(6);   // SCROLL_AT을 넘지 않는다
    expect(s.crossed).toBe(9);
  });
});

describe('난이도 램프', () => {
  it('레인 인덱스가 커질수록 도로가 더 빠르고 조밀해진다', () => {
    const low = makeLane(1, makeRng(7));
    const high = makeLane(401, makeRng(7));   // 같은 시드 → 랜덤 성분은 동일, 인덱스만 다름
    expect(high.speed).toBeGreaterThan(low.speed);
    expect(high.cars.length).toBeGreaterThanOrEqual(low.cars.length);
  });

  it('난이도는 상한선 이후로 더 이상 오르지 않는다 (사람이 할 만해야 한다)', () => {
    const capped = makeLane(401, makeRng(7));
    const beyondCap = makeLane(4001, makeRng(7));
    expect(beyondCap.speed).toBeCloseTo(capped.speed);
    expect(beyondCap.cars.length).toBe(capped.cars.length);
  });
});

describe('계약', () => {
  it('id와 기본 메타가 맞다', () => {
    expect(game.id).toBe('crossy-robot');
    expect(game.players).toBe(1);
    expect(game.controls).toBe('dpad');
    expect(game.scoreOrder).toBe('high');
  });
});
